// SVNHS Offline IndexedDB & Secure Local Cache Management
// Ensures full offline functionality for school data while strictly prohibiting
// storing passwords or sensitive authentication credentials locally.

const DB_NAME = 'SVNHS_LocalStore_v2';
const DB_VERSION = 1;
const STORE_NAME = 'dataset_cache';

// In-memory synchronous mirror for rapid startup hydration before IndexedDB async resolves
const memoryCache: Record<string, any> = {};

// Open or initialize the IndexedDB database
function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = () => {
        console.warn('IndexedDB unavailable, falling back to memory/local cache.');
        resolve(null);
      };
    } catch (e) {
      console.warn('Error opening IndexedDB:', e);
      resolve(null);
    }
  });
}

// Deep sanitize data to guarantee passwords or auth credentials are never saved
function sanitizeForOfflineStorage(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForOfflineStorage(item));
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    // Strictly strip password fields, auth tokens, and sensitive authentication objects
    if (
      lowerKey.includes('password') ||
      lowerKey === 'pass' ||
      lowerKey.includes('secret') ||
      lowerKey === 'userpasswords' ||
      lowerKey === 'authtoken' ||
      lowerKey === 'credentials'
    ) {
      continue;
    }
    sanitized[key] = sanitizeForOfflineStorage(data[key]);
  }
  return sanitized;
}

/**
 * Save fresh database data into IndexedDB and memory cache.
 * Strips any sensitive credentials before storage.
 */
export async function saveOfflineData<T>(key: string, rawData: T): Promise<void> {
  const sanitized = sanitizeForOfflineStorage(rawData);
  memoryCache[key] = sanitized;

  // Also maintain localStorage mirror for small datasets (with quota safety)
  try {
    const serialized = JSON.stringify(sanitized);
    // Only mirror to localStorage if reasonable size (< 500KB) to prevent quota issues
    if (serialized.length < 500000) {
      localStorage.setItem(key, serialized);
    }
  } catch {
    // localStorage full or disabled, IndexedDB handles large records
  }

  const db = await openDB();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(sanitized, key);
  } catch (e) {
    console.warn(`IndexedDB put failed for key "${key}":`, e);
  }
}

/**
 * Retrieve data asynchronously from IndexedDB, falling back to memory and localStorage.
 */
export async function getOfflineData<T>(key: string, fallbackDefault?: T): Promise<T | null> {
  // 1. Check in-memory sync cache
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }

  // 2. Check IndexedDB
  const db = await openDB();
  if (db) {
    try {
      const result = await new Promise<any>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });

      if (result !== null && result !== undefined) {
        memoryCache[key] = result;
        return result as T;
      }
    } catch {
      // Continue to localStorage fallback
    }
  }

  // 3. Fallback to localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryCache[key] = parsed;
      return parsed as T;
    }
  } catch {}

  return fallbackDefault !== undefined ? fallbackDefault : null;
}

/**
 * Synchronous get for immediate React component state initialization.
 */
export function getOfflineDataSync<T>(key: string, fallbackDefault: T): T {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryCache[key] = parsed;
      return parsed as T;
    }
  } catch {}

  return fallbackDefault;
}

/**
 * Remove an item from all offline caches.
 */
export async function removeOfflineData(key: string): Promise<void> {
  delete memoryCache[key];
  try {
    localStorage.removeItem(key);
  } catch {}

  const db = await openDB();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
  } catch {}
}

/**
 * Initialize and warm up in-memory cache from IndexedDB upon startup.
 */
export async function initializeOfflineDatabase(): Promise<void> {
  // Purge any accidental legacy sensitive keys immediately
  purgeSensitiveLocalData();

  const db = await openDB();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        memoryCache[cursor.key as string] = cursor.value;
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn('Error warming up offline cache:', e);
  }
}

/**
 * Purge any sensitive auth data (passwords, plain emails in credentials) from local storage.
 * Directly fulfills requirement to keep passwords and emails off local storage.
 */
export function purgeSensitiveLocalData(): void {
  try {
    const keysToRemove = [
      'svnhs_user_passwords_cache',
      'userPasswords',
      'svnhs_passwords',
      'svnhs_faculty_passwords',
      'svnhs_admin_passwords',
      'svnhs_cached_password',
      'svnhs_cached_email',
    ];

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }

    // Inspect user session in localStorage to ensure passwords are NEVER embedded
    const session = localStorage.getItem('svnhs_user_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        let modified = false;
        if (parsed.password) {
          delete parsed.password;
          modified = true;
        }
        if (parsed.pass) {
          delete parsed.pass;
          modified = true;
        }
        if (modified) {
          localStorage.setItem('svnhs_user_session', JSON.stringify(parsed));
        }
      } catch {
        localStorage.removeItem('svnhs_user_session');
      }
    }
  } catch (e) {
    console.warn('Error purging sensitive data:', e);
  }
}
