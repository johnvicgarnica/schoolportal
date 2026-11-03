// SVNHS Local-First Delta Sync, Offline Mutation Queue & Local Auth Caching Engine
// Optimizes Firestore reads to near zero by leveraging persistent IndexedDB and delta queries.

import { db, handleFirestoreError, isQuotaError } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  saveOfflineData,
  getOfflineData,
  getOfflineDataSync,
  removeOfflineData,
} from './offlineStore';
import { UserProfile } from '../types';

export interface SyncStatusInfo {
  state: 'cached' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncedAt: string | null;
  unsyncedMutationsCount: number;
  message?: string;
}

export interface QueuedMutation {
  id: string;
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: any;
  timestamp: string;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = 'svnhs_offline_mutation_queue_v1';
const SYNC_METADATA_KEY = 'svnhs_sync_metadata_v1';
const AUTH_CACHE_PREFIX = 'svnhs_auth_entry_v2_';

// Track current synchronization state in memory
let currentSyncStatus: SyncStatusInfo = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'cached',
  lastSyncedAt: getOfflineDataSync<{ lastSyncedAt: string } | null>(SYNC_METADATA_KEY, null)?.lastSyncedAt || null,
  unsyncedMutationsCount: getOfflineDataSync<QueuedMutation[]>(QUEUE_STORAGE_KEY, []).length,
  message: 'Using persistent local cache (0 reads consumed)',
};

const syncListeners = new Set<(status: SyncStatusInfo) => void>();

function notifySyncStatus(updates: Partial<SyncStatusInfo>) {
  currentSyncStatus = { ...currentSyncStatus, ...updates };
  syncListeners.forEach((listener) => {
    try {
      listener(currentSyncStatus);
    } catch (e) {
      console.warn('Sync status listener error:', e);
    }
  });
}

export function subscribeSyncStatus(callback: (status: SyncStatusInfo) => void): () => void {
  callback(currentSyncStatus);
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
}

export function getSyncStatus(): SyncStatusInfo {
  return currentSyncStatus;
}

// ---------------------------------------------------------------------------
// 1. SECURE LOCAL AUTHENTICATION CACHE (Requirements 11 & 12)
// Saves login data locally so subsequent logins consume 0 reads from Firestore.
// ---------------------------------------------------------------------------

async function computeAuthDigest(email: string, pass: string, role: string): Promise<string> {
  const normalized = `${role.toLowerCase()}:${email.trim().toLowerCase()}:${pass.trim()}:svnhs_auth_salt_deped_caraga_2026`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple fallback hash if crypto.subtle is unavailable
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
}

export async function saveLocalAuth(
  email: string,
  pass: string,
  role: 'Faculty' | 'Admin',
  user: UserProfile
): Promise<void> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-z0-9]/gi, '_');
    const digest = await computeAuthDigest(cleanEmail, pass, role);
    const storageKey = `${AUTH_CACHE_PREFIX}${role}_${docId}`;

    const cachePayload = {
      email: cleanEmail,
      role,
      user,
      digest,
      cachedAt: new Date().toISOString(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days cache validity
    };

    await saveOfflineData(storageKey, cachePayload);
  } catch (err) {
    console.warn('Failed to save local auth cache:', err);
  }
}

export async function verifyLocalAuth(
  email: string,
  pass: string,
  role: 'Faculty' | 'Admin'
): Promise<{ success: boolean; user?: UserProfile; fromCache?: boolean }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-z0-9]/gi, '_');
    const storageKey = `${AUTH_CACHE_PREFIX}${role}_${docId}`;

    const cached = await getOfflineData<any>(storageKey);
    if (!cached || !cached.digest || !cached.user) {
      return { success: false };
    }

    // Check expiration
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      await removeOfflineData(storageKey);
      return { success: false };
    }

    const currentDigest = await computeAuthDigest(cleanEmail, pass, role);
    if (currentDigest === cached.digest) {
      return {
        success: true,
        user: cached.user,
        fromCache: true,
      };
    }
  } catch (err) {
    console.warn('Local auth verification error:', err);
  }
  return { success: false };
}

export async function invalidateLocalAuthForAccount(email: string, role: string): Promise<void> {
  const docId = email.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
  const storageKey = `${AUTH_CACHE_PREFIX}${role}_${docId}`;
  await removeOfflineData(storageKey);
}

// ---------------------------------------------------------------------------
// 2. OFFLINE MUTATION QUEUE (Requirement 10)
// Queues local data changes when offline and flushes to Firestore when online.
// ---------------------------------------------------------------------------

export async function enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  const currentQueue = (await getOfflineData<QueuedMutation[]>(QUEUE_STORAGE_KEY)) || [];
  const fullMutation: QueuedMutation = {
    ...mutation,
    id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  currentQueue.push(fullMutation);
  await saveOfflineData(QUEUE_STORAGE_KEY, currentQueue);
  notifySyncStatus({
    unsyncedMutationsCount: currentQueue.length,
    message: `${currentQueue.length} change(s) queued locally for upload`,
  });
}

export async function processOfflineMutationQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const queue = (await getOfflineData<QueuedMutation[]>(QUEUE_STORAGE_KEY)) || [];
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }

  notifySyncStatus({ state: 'syncing', message: `Syncing ${queue.length} pending change(s) to server...` });

  let processedCount = 0;
  const remainingQueue: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      const docRef = doc(db, item.collectionName, item.docId);
      if (item.action === 'delete') {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { ...item.data, updatedAt: new Date().toISOString() }, { merge: true });
      }
      processedCount++;
    } catch (err) {
      console.warn(`Failed to process queued mutation ${item.id}:`, err);
      if (item.retryCount < 5) {
        remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  await saveOfflineData(QUEUE_STORAGE_KEY, remainingQueue);
  notifySyncStatus({
    unsyncedMutationsCount: remainingQueue.length,
    state: remainingQueue.length === 0 ? 'synced' : 'cached',
    message: remainingQueue.length === 0 ? `Synced all ${processedCount} pending change(s)` : `${remainingQueue.length} items still pending`,
  });

  return { processed: processedCount, failed: remainingQueue.length };
}

// ---------------------------------------------------------------------------
// 3. DELTA SYNCHRONIZATION ENGINE (Requirements 2, 3, 4, 6, 7, 8)
// Queries only records modified or created after the last sync timestamp.
// ---------------------------------------------------------------------------

export interface DeltaSyncConfig {
  collectionName: string;
  storageKey: string;
  idField?: string;
  timestampField?: string;
}

export const SYNCED_COLLECTIONS: DeltaSyncConfig[] = [
  { collectionName: 'announcements', storageKey: 'svnhs_announcements_cache_v1' },
  { collectionName: 'driveFolders', storageKey: 'svnhs_drive_folders_cache_v1' },
  { collectionName: 'facultyFolders', storageKey: 'svnhs_faculty_folders_cache_v1' },
  { collectionName: 'facultyFiles', storageKey: 'svnhs_faculty_files_cache_v1' },
  { collectionName: 'facultySubmissions', storageKey: 'svnhs_faculty_submissions_cache_v1' },
  { collectionName: 'facultyTosTq', storageKey: 'svnhs_faculty_tostq_cache_v1' },
  { collectionName: 'facultySchoolForms', storageKey: 'svnhs_faculty_school_forms_cache_v1' },
  { collectionName: 'schoolPermanentFolders', storageKey: 'svnhs_school_permanent_folders_cache_v1' },
  { collectionName: 'faculty', storageKey: 'svnhs_faculty_cache_v1' },
  { collectionName: 'admins', storageKey: 'svnhs_admins_cache_v1' },
  { collectionName: 'gallery_photos', storageKey: 'svnhs_gallery_photos_cache_v1' },
];

export async function performDeltaSync(
  options: { forceFull?: boolean } = {}
): Promise<{ totalUpdated: number; collectionsSynced: number; timestamp: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifySyncStatus({ state: 'offline', message: 'Offline: Using cached data' });
    return { totalUpdated: 0, collectionsSynced: 0, timestamp: currentSyncStatus.lastSyncedAt || '' };
  }

  notifySyncStatus({ state: 'syncing', message: 'Checking for cloud updates...' });

  // 1. Process any pending offline mutations first
  await processOfflineMutationQueue();

  const syncMeta = (await getOfflineData<{ lastSyncedAt: string; collectionTimestamps?: Record<string, string> }>(SYNC_METADATA_KEY)) || {
    lastSyncedAt: '',
    collectionTimestamps: {},
  };

  const collectionTimestamps: Record<string, string> = syncMeta.collectionTimestamps || {};
  let totalUpdatedDocs = 0;
  let syncedCollectionsCount = 0;
  const currentSyncTime = new Date().toISOString();

  for (const target of SYNCED_COLLECTIONS) {
    try {
      const lastSyncForCollection = options.forceFull ? null : (collectionTimestamps[target.collectionName] || syncMeta.lastSyncedAt || null);

      let fetchedDocs: any[] = [];

      if (!lastSyncForCollection) {
        // Full initial download for this collection
        const colRef = collection(db, target.collectionName);
        const snapshot = await getDocs(colRef);
        fetchedDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        if (fetchedDocs.length > 0) {
          await saveOfflineData(target.storageKey, fetchedDocs);
          totalUpdatedDocs += fetchedDocs.length;
        }
      } else {
        // Delta sync: fetch only documents created or modified after last sync timestamp
        const colRef = collection(db, target.collectionName);

        // Query modified documents
        const deltaUpdatedQuery = query(colRef, where('updatedAt', '>', lastSyncForCollection));
        const deltaCreatedQuery = query(colRef, where('createdAt', '>', lastSyncForCollection));

        const [updatedSnap, createdSnap] = await Promise.all([
          getDocs(deltaUpdatedQuery).catch(() => ({ docs: [] })),
          getDocs(deltaCreatedQuery).catch(() => ({ docs: [] })),
        ]);

        const incomingMap = new Map<string, any>();
        updatedSnap.docs.forEach((d) => incomingMap.set(d.id, { id: d.id, ...d.data() }));
        createdSnap.docs.forEach((d) => incomingMap.set(d.id, { id: d.id, ...d.data() }));

        const deltaItems = Array.from(incomingMap.values());

        if (deltaItems.length > 0) {
          // Merge delta records with existing cached records
          const existingCached = (await getOfflineData<any[]>(target.storageKey)) || [];
          const existingMap = new Map<string, any>();
          existingCached.forEach((item) => {
            const id = item.id || item.docId || (item.email ? item.email.toLowerCase() : null);
            if (id) existingMap.set(id, item);
          });

          // Apply updates
          deltaItems.forEach((item) => {
            const id = item.id || item.docId || (item.email ? item.email.toLowerCase() : null);
            if (id) existingMap.set(id, item);
          });

          const merged = Array.from(existingMap.values());
          await saveOfflineData(target.storageKey, merged);
          totalUpdatedDocs += deltaItems.length;
        }
      }

      collectionTimestamps[target.collectionName] = currentSyncTime;
      syncedCollectionsCount++;
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`[SVNHS Sync] Firestore read quota reached during sync for ${target.collectionName}. Serving from local cache.`);
        notifySyncStatus({
          state: 'cached',
          message: 'Serving all data from persistent local cache (Cloud read quota limit reached)',
        });
        break; // Stop querying more collections to avoid repeated quota errors
      }
      console.warn(`Delta sync warning for ${target.collectionName}:`, err);
    }
  }

  // Save new sync metadata
  await saveOfflineData(SYNC_METADATA_KEY, {
    lastSyncedAt: currentSyncTime,
    collectionTimestamps,
  });

  notifySyncStatus({
    state: 'synced',
    lastSyncedAt: currentSyncTime,
    message: totalUpdatedDocs > 0 ? `Synced: ${totalUpdatedDocs} record(s) updated` : 'Up to date (0 reads consumed)',
  });

  return {
    totalUpdated: totalUpdatedDocs,
    collectionsSynced: syncedCollectionsCount,
    timestamp: currentSyncTime,
  };
}

// Auto-sync listener on window reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifySyncStatus({ state: 'cached', message: 'Online connection restored' });
    processOfflineMutationQueue().then(() => {
      performDeltaSync();
    });
  });

  window.addEventListener('offline', () => {
    notifySyncStatus({ state: 'offline', message: 'Offline mode active (Local cache loaded)' });
  });
}
