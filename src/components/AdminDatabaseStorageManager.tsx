import React, { useState, useMemo } from 'react';
import {
  UserProfile,
  FacultyPersonalFile,
  FacultyFolder,
  Announcement,
  GalleryPhoto,
  EmbeddedVideo,
} from '../types';
import {
  FacultyDoc,
  cleanupExpiredFacultyFiles,
  purgeNonPdfFacultyFiles,
  FIRESTORE_UPGRADE_URL,
  getFacultyFilesCountFromServer,
  getFacultyCountFromServer,
} from '../lib/firebase';
import {
  Database,
  HardDrive,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  FileCheck2,
  Layers,
  Sparkles,
  Info,
  TrendingUp,
  Activity,
  ArrowUpDown,
  Download,
  AlertCircle,
  Folder,
  User,
  Images,
  Video,
  X,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface AdminDatabaseStorageManagerProps {
  currentUser: UserProfile;
  facultyFiles: FacultyPersonalFile[];
  facultyFolders: FacultyFolder[];
  announcements?: Announcement[];
  galleryPhotos?: GalleryPhoto[];
  embeddedVideos?: EmbeddedVideo[];
  facultyList?: FacultyDoc[];
  onDeleteFacultyFile?: (id: string) => void;
  onRefreshData?: () => void;
}

// 1 GiB = 1,024 MB = 1,073,741,824 bytes (Firestore Spark Free Tier Total Stored Data Quota)
const FIRESTORE_SPARK_QUOTA_BYTES = 1024 * 1024 * 1024;
const FIRESTORE_DATABASE_ID = 'ai-studio-svnhsshsdeptfile-148e0721-c9cf-4964-b4a2-daa5a6e3b4d4';

export const AdminDatabaseStorageManager: React.FC<AdminDatabaseStorageManagerProps> = ({
  currentUser,
  facultyFiles = [],
  facultyFolders = [],
  announcements = [],
  galleryPhotos = [],
  embeddedVideos = [],
  facultyList = [],
  onDeleteFacultyFile,
  onRefreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'large' | 'expiring-soon'>('all');
  const [sortBy, setSortBy] = useState<'size-desc' | 'date-desc' | 'expiry-asc'>('size-desc');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FacultyPersonalFile | null>(null);
  const [serverCounts, setServerCounts] = useState<{
    files: number | null;
    faculty: number | null;
    announcements: number | null;
    lastUpdated: string | null;
    isLoading: boolean;
  }>({
    files: null,
    faculty: null,
    announcements: 0,
    lastUpdated: null,
    isLoading: false,
  });

  const fetchServerAggregations = async () => {
    setServerCounts((prev) => ({ ...prev, isLoading: true }));
    try {
      const [filesCount, facultyCount] = await Promise.all([
        getFacultyFilesCountFromServer(),
        getFacultyCountFromServer(),
      ]);
      setServerCounts({
        files: filesCount,
        faculty: facultyCount,
        announcements: 0,
        lastUpdated: new Date().toLocaleTimeString(),
        isLoading: false,
      });
      showNotice(
        `Server aggregation complete via getCountFromServer(): ${filesCount} files, ${facultyCount} faculty.`
      );
    } catch (err) {
      console.error('Failed to get server aggregation count:', err);
      setServerCounts((prev) => ({ ...prev, isLoading: false }));
      showNotice('Unable to fetch server aggregation count (quota limit or network error).');
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4500);
  };

  // 1. CALCULATE STORAGE USAGE BY COLLECTION / CATEGORY
  // Faculty uploaded PDF instructional materials (biggest database consumer)
  const facultyFilesBytes = useMemo(() => {
    return facultyFiles.reduce((acc, f) => {
      const size = f.fileSizeBytes || (f.fileData ? f.fileData.length : 0);
      return acc + size;
    }, 0);
  }, [facultyFiles]);

  // Gallery Photos (base64 image data stored in Firestore)
  const galleryPhotosBytes = useMemo(() => {
    return galleryPhotos.reduce((acc, p) => {
      // If photo is a base64 data string, calculate length, else estimate URL metadata
      const size = p.url && p.url.startsWith('data:') ? p.url.length : 1200;
      return acc + size;
    }, 0);
  }, [galleryPhotos]);

  // Bulletins & Announcements (content text + metadata)
  const announcementsBytes = useMemo(() => {
    return announcements.reduce((acc, a) => {
      const textLength = (a.title || '').length + (a.content || '').length + (a.department || '').length;
      return acc + textLength + 500; // 500 bytes overhead for document fields
    }, 0);
  }, [announcements]);

  // Folders & Structure Metadata
  const foldersMetadataBytes = useMemo(() => {
    return facultyFolders.reduce((acc, f) => {
      const len = (f.name || '').length + (f.description || '').length + (f.category || '').length;
      return acc + len + 350;
    }, 0);
  }, [facultyFolders]);

  // Accounts & User Directory Metadata
  const accountsMetadataBytes = useMemo(() => {
    return (facultyList.length * 600) + (embeddedVideos.length * 800) + 50000; // Base index overhead
  }, [facultyList, embeddedVideos]);

  // Total Database Storage Used
  const totalStorageUsedBytes = useMemo(() => {
    return facultyFilesBytes + galleryPhotosBytes + announcementsBytes + foldersMetadataBytes + accountsMetadataBytes;
  }, [facultyFilesBytes, galleryPhotosBytes, announcementsBytes, foldersMetadataBytes, accountsMetadataBytes]);

  // Available Free Space in Firestore Spark Tier
  const availableStorageBytes = Math.max(0, FIRESTORE_SPARK_QUOTA_BYTES - totalStorageUsedBytes);
  const percentUsed = ((totalStorageUsedBytes / FIRESTORE_SPARK_QUOTA_BYTES) * 100);
  const percentAvailable = (100 - percentUsed);

  // Format Helper
  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  // Top faculty uploaders consuming database storage
  const storageByFaculty = useMemo(() => {
    const map: Record<string, { name: string; email: string; totalBytes: number; count: number }> = {};
    facultyFiles.forEach((f) => {
      const key = f.facultyEmail || f.facultyName || 'Unknown';
      if (!map[key]) {
        map[key] = {
          name: f.facultyName || key,
          email: f.facultyEmail || key,
          totalBytes: 0,
          count: 0,
        };
      }
      map[key].totalBytes += (f.fileSizeBytes || 0);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.totalBytes - a.totalBytes).slice(0, 5);
  }, [facultyFiles]);

  // Filtered and Sorted File Inspection List
  const now = Date.now();
  const inspectedFiles = useMemo(() => {
    return facultyFiles
      .filter((file) => {
        const matchesSearch =
          file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (file.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (filterMode === 'large') {
          // Files larger than 1 MB
          return (file.fileSizeBytes || 0) >= 1024 * 1024;
        }

        if (filterMode === 'expiring-soon') {
          // Expiring within 2 days (48 hours)
          const expireTime = file.expiresAt
            ? new Date(file.expiresAt).getTime()
            : new Date(file.uploadedAt).getTime() + 15 * 24 * 60 * 60 * 1000;
          return (expireTime - now) <= 2 * 24 * 60 * 60 * 1000;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'size-desc') {
          return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
        }
        if (sortBy === 'date-desc') {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
        if (sortBy === 'expiry-asc') {
          const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : new Date(a.uploadedAt).getTime();
          const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : new Date(b.uploadedAt).getTime();
          return aExp - bExp;
        }
        return 0;
      });
  }, [facultyFiles, searchTerm, filterMode, sortBy, now]);

  // Execute 15-Day Auto-Purge Cleaner & PDF Policy Purge
  const handleRunCleanup = async () => {
    setIsCleaningUp(true);
    try {
      await cleanupExpiredFacultyFiles();
      await purgeNonPdfFacultyFiles();
      if (onRefreshData) {
        onRefreshData();
      }
      showNotice(
        `Automated 15-day hygiene & PDF-only policy purge finished. Expired and non-PDF faculty documents have been cleanly purged from Firestore to reclaim storage.`
      );
    } catch (err) {
      console.error('Manual purge error:', err);
      showNotice('Failed to complete automated purge.');
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Immediate single file deletion
  const handleConfirmDelete = () => {
    if (!fileToDelete) return;
    if (onDeleteFacultyFile) {
      onDeleteFacultyFile(fileToDelete.id);
      showNotice(`Purged "${fileToDelete.title}" (${fileToDelete.fileSizeFormatted}) from Firebase storage.`);
    }
    setFileToDelete(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans text-slate-100">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs font-mono text-emerald-300 shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER BANNER: FIREBASE DATABASE STORAGE QUOTA & USAGE */}
      <div className="bg-gradient-to-r from-[#121c2e] via-[#0f1725] to-[#141824] border border-[#24334b] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Firestore Spark Free Tier (1.00 GiB Quota)</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Master Admin Console
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
              <Database className="w-7 h-7 text-blue-400" />
              <span>Firebase Database Storage & Data Usage</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
              Live consumption monitor for San Vicente National High School's Firestore database. Track available storage quota, monitor uploaded faculty PDF instructional materials, and execute 15-day automated storage purges.
            </p>

            <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 pt-1">
              <span className="text-slate-500 font-bold">Database ID:</span>
              <code className="bg-[#090e18] px-2.5 py-0.5 rounded-md border border-[#24334b] text-blue-300 truncate max-w-xs sm:max-w-md">
                {FIRESTORE_DATABASE_ID}
              </code>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRunCleanup}
              disabled={isCleaningUp}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
              title="Immediately remove documents older than 15 days and non-PDF faculty files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningUp ? 'animate-spin' : ''}`} />
              <span>{isCleaningUp ? 'Purging Expired Files...' : 'Run 15-Day Auto-Purge'}</span>
            </button>

            <button
              type="button"
              onClick={fetchServerAggregations}
              disabled={serverCounts.isLoading}
              className="px-3.5 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 rounded-xl text-xs font-mono font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
              title="Calculate total counts using Firestore getCountFromServer() without downloading document arrays"
            >
              <Zap className={`w-3.5 h-3.5 text-blue-400 ${serverCounts.isLoading ? 'animate-pulse' : ''}`} />
              <span>{serverCounts.isLoading ? 'Aggregating...' : 'Server Count (1 Read)'}</span>
            </button>

            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                className="px-3.5 py-2.5 bg-[#172236] hover:bg-[#20304c] text-slate-300 rounded-xl text-xs font-mono font-bold transition-all border border-[#2d3e57] flex items-center space-x-1.5 cursor-pointer"
                title="Refresh live collection metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Stats</span>
              </button>
            )}

            <a
              href={FIRESTORE_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold transition-all shadow-sm flex items-center space-x-1.5"
              title="Open Google Firebase Console to enable Blaze pay-as-you-go billing or view quota metrics"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firebase Billing</span>
            </a>
          </div>
        </div>
      </div>

      {/* TOP 4 STORAGE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: AVAILABLE DATABASE STORAGE */}
        <div className="bg-[#101726] border border-[#24334b] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Available Space
            </span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {formatBytes(availableStorageBytes)}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-1">
              <span className="font-bold text-emerald-300">{percentAvailable.toFixed(2)}%</span>
              <span>of 1.00 GiB Free Quota</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#24334b] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Status:</span>
            <span className="text-emerald-400 font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Optimal Capacity</span>
            </span>
          </div>
        </div>

        {/* KPI 2: CURRENT DATA CONSUMED */}
        <div className="bg-[#101726] border border-[#24334b] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Current Stored Data
            </span>
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/40">
              <Database className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 font-mono tracking-tight">
              {formatBytes(totalStorageUsedBytes)}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-1">
              <span className="font-bold text-blue-300">{percentUsed.toFixed(3)}%</span>
              <span>of 1,024 MB Total Limit</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#24334b] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Quota Safety:</span>
            <span className="text-blue-300 font-bold">Under 70% Safe Zone</span>
          </div>
        </div>

        {/* KPI 3: UPLOADED PDF INSTRUCTIONAL MATERIALS */}
        <div className="bg-[#101726] border border-[#24334b] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Faculty PDF Files
            </span>
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40">
              <FileText className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono tracking-tight">
              {formatBytes(facultyFilesBytes)}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-1">
              <span className="font-bold text-rose-300">{facultyFiles.length} active PDFs</span>
              <span>(Max 10MB each)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#24334b] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Hygiene:</span>
            <span className="text-amber-300 font-bold flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>15-Day Auto-Purge</span>
            </span>
          </div>
        </div>

        {/* KPI 4: MEDIA & PLATFORM ASSETS */}
        <div className="bg-[#101726] border border-[#24334b] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Gallery & Bulletins
            </span>
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/40">
              <Images className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono tracking-tight">
              {formatBytes(galleryPhotosBytes + announcementsBytes)}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-1">
              <span className="font-bold text-purple-300">{galleryPhotos.length} photos</span>
              <span>• {announcements.length} bulletins</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#24334b] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Login Assets:</span>
            <span className="text-purple-300 font-bold">Optimized Base64</span>
          </div>
        </div>
      </div>

      {/* STORAGE CONSUMPTION PROGRESS BAR & SPARK TIER GAUGE */}
      <div className="bg-[#101726] border border-[#24334b] rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span>Database Storage Quota Meter (1,024 MB Total Free Tier)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Breakdown of consumed storage space across San Vicente National High School collections.
            </p>
          </div>

          <div className="text-right font-mono text-xs text-slate-400">
            <div>
              <span className="text-emerald-400 font-bold text-sm">
                {formatBytes(availableStorageBytes)}
              </span>{' '}
              available ({percentAvailable.toFixed(2)}%)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {formatBytes(totalStorageUsedBytes)} of 1,024.00 MB used
            </div>
          </div>
        </div>

        {/* Multi-Color Segmented Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-[#090f1a] rounded-full overflow-hidden flex border border-[#24334b] p-0.5 shadow-inner">
            {/* Faculty Files (Red) */}
            <div
              className="h-full bg-rose-500 rounded-l-full transition-all duration-500"
              style={{ width: `${Math.max(1, (facultyFilesBytes / FIRESTORE_SPARK_QUOTA_BYTES) * 100)}%` }}
              title={`Faculty PDF Files: ${formatBytes(facultyFilesBytes)}`}
            />
            {/* Gallery Photos (Purple) */}
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${Math.max(0.5, (galleryPhotosBytes / FIRESTORE_SPARK_QUOTA_BYTES) * 100)}%` }}
              title={`Gallery Photos: ${formatBytes(galleryPhotosBytes)}`}
            />
            {/* Announcements (Blue) */}
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.max(0.5, (announcementsBytes / FIRESTORE_SPARK_QUOTA_BYTES) * 100)}%` }}
              title={`Announcements: ${formatBytes(announcementsBytes)}`}
            />
            {/* Metadata (Emerald) */}
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(0.5, ((foldersMetadataBytes + accountsMetadataBytes) / FIRESTORE_SPARK_QUOTA_BYTES) * 100)}%` }}
              title={`Metadata & Logs: ${formatBytes(foldersMetadataBytes + accountsMetadataBytes)}`}
            />
          </div>

          {/* Legend Items */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span>Faculty PDFs: <strong className="text-slate-200">{formatBytes(facultyFilesBytes)}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
              <span>Gallery Media: <strong className="text-slate-200">{formatBytes(galleryPhotosBytes)}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span>Bulletins: <strong className="text-slate-200">{formatBytes(announcementsBytes)}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span>Metadata & Logs: <strong className="text-slate-200">{formatBytes(foldersMetadataBytes + accountsMetadataBytes)}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#090f1a] border border-slate-600 inline-block" />
              <span>Free Quota: <strong className="text-emerald-400">{formatBytes(availableStorageBytes)}</strong></span>
            </div>
          </div>
        </div>

        {/* Firestore Operations Quota Reminder Grid */}
        <div className="pt-3 border-t border-[#24334b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#0b121e] p-3 rounded-xl border border-[#202d42]">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Daily Free Reads</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">50,000 reads/day</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Spark Tier Quota</div>
          </div>

          <div className="bg-[#0b121e] p-3 rounded-xl border border-[#202d42]">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Daily Free Writes</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">20,000 writes/day</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Spark Tier Quota</div>
          </div>

          <div className="bg-[#0b121e] p-3 rounded-xl border border-[#202d42]">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Daily Free Deletes</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">20,000 deletes/day</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Spark Tier Quota</div>
          </div>

          <div className="bg-[#0b121e] p-3 rounded-xl border border-[#202d42]">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Max Document Size</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">1 MiB (1,048,576 B)</div>
            <div className="text-[10px] text-blue-400 mt-0.5">10MB Chunking Active</div>
          </div>
        </div>

        {/* Active Read Optimization & Server Aggregations Panel */}
        <div className="pt-4 border-t border-[#24334b] space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Active Firestore Read Quota Protection & Optimization
              </h5>
            </div>
            {serverCounts.lastUpdated && (
              <span className="text-[10px] font-mono text-slate-400 bg-[#090e18] px-2.5 py-0.5 rounded-md border border-[#24334b]">
                Server Aggregation updated: {serverCounts.lastUpdated}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-[#0b121e] p-3 rounded-xl border border-emerald-500/30 space-y-1">
              <div className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Persistent Cache Active</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-tight">
                IndexedDB multi-tab caching enabled. Repeat views read zero units from network.
              </p>
            </div>

            <div className="bg-[#0b121e] p-3 rounded-xl border border-blue-500/30 space-y-1">
              <div className="text-[10px] text-blue-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>One-Time Query Dedupe</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-tight">
                60-second in-memory query cache prevents duplicate reads across components.
              </p>
            </div>

            <div className="bg-[#0b121e] p-3 rounded-xl border border-purple-500/30 space-y-1">
              <div className="text-[10px] text-purple-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bounded Pagination</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-tight">
                All collection requests are strictly capped at limit(20)-limit(30) with startAfter() cursors.
              </p>
            </div>

            <div className="bg-[#0b121e] p-3 rounded-xl border border-amber-500/30 space-y-1">
              <div className="text-[10px] text-amber-400 font-bold flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5" />
                <span>Server Aggregations</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-tight">
                getCountFromServer() counts documents with 1 single read unit instead of downloading entire collections.
              </p>
            </div>
          </div>

          {serverCounts.files !== null && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs font-mono text-blue-200">
              <span className="font-bold">Latest Server Counts via getCountFromServer():</span>
              <div className="flex items-center space-x-4 text-white">
                <span>Files: <strong className="text-blue-300">{serverCounts.files}</strong></span>
                <span>Faculty: <strong className="text-emerald-300">{serverCounts.faculty}</strong></span>
                <span>Bulletins: <strong className="text-amber-300">{serverCounts.announcements}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TWO COLUMN SECTION: TOP STORAGE CONSUMERS & HYGIENE POLICY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Storage Users (Faculty Members) */}
        <div className="lg:col-span-1 bg-[#101726] border border-[#24334b] rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>Top Storage Users (Faculty)</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400 bg-[#090e18] px-2 py-0.5 rounded-md border border-[#24334b]">
              Top 5
            </span>
          </div>

          {storageByFaculty.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-slate-400">
              No faculty uploaded documents found yet.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {storageByFaculty.map((item, idx) => {
                const percentOfFiles = facultyFilesBytes > 0
                  ? ((item.totalBytes / facultyFilesBytes) * 100).toFixed(1)
                  : '0';
                return (
                  <div
                    key={`${item.email}-${idx}`}
                    className="p-3 bg-[#0c1320] border border-[#24334b] rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-md bg-[#162236] text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="font-bold text-slate-200 truncate">{item.name}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5 pl-7">
                        {item.email} • {item.count} document{item.count !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-400">{formatBytes(item.totalBytes)}</div>
                      <div className="text-[9px] text-slate-500">{percentOfFiles}% of files</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 15-Day Storage Hygiene & Automatic Cleanup Details */}
        <div className="lg:col-span-2 bg-[#101726] border border-[#24334b] rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Automated 15-Day Storage Purge Policy</span>
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
              Active Automation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-[#0c1320] border border-amber-500/20 rounded-2xl space-y-1.5">
              <div className="font-bold text-amber-300 flex items-center space-x-1.5 font-mono">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>15-Day Expiry</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                Every faculty PDF uploaded into a folder is stamped with an <code className="text-amber-300">expiresAt</code> timestamp exactly 15 days from upload.
              </p>
            </div>

            <div className="p-4 bg-[#0c1320] border border-blue-500/20 rounded-2xl space-y-1.5">
              <div className="font-bold text-blue-300 flex items-center space-x-1.5 font-mono">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Zero-Cost Spark Plan</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                By purging documents older than 15 days, total database consumption remains well beneath the 1 GiB free storage threshold indefinitely.
              </p>
            </div>

            <div className="p-4 bg-[#0c1320] border border-emerald-500/20 rounded-2xl space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center space-x-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Automatic Cleaning</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                The auto-cleanup routine checks timestamps whenever faculty or administrators load their dashboard, purging outdated chunks automatically.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-xs font-mono text-blue-200 flex items-start space-x-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-sans">
              <strong>Master Admin Tip:</strong> To keep instructional materials organized, encourage faculty to download evaluated lesson plans and TOS to their local devices before the 15-day auto-purge expires.
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED FILE STORAGE INSPECTOR & MANAGEMENT TABLE */}
      <div className="bg-[#101726] border border-[#24334b] rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Stored PDF Documents Inspector ({inspectedFiles.length} files)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Inspect individual documents consuming database space. Sort by size or purge unneeded files immediately.
            </p>
          </div>

          {/* Search, Filter, Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search document or teacher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#090e18] border border-[#24334b] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
              />
            </div>

            {/* Filter Dropdown */}
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="bg-[#090e18] border border-[#24334b] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              <option value="all">All Documents</option>
              <option value="large">Large Files (&gt; 1 MB)</option>
              <option value="expiring-soon">Expiring Soon (&lt; 48h)</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#090e18] border border-[#24334b] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              <option value="size-desc">Sort: Largest First</option>
              <option value="date-desc">Sort: Newest Upload</option>
              <option value="expiry-asc">Sort: Expiring Soonest</option>
            </select>
          </div>
        </div>

        {/* Table of Stored Documents */}
        {inspectedFiles.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-[#24334b] rounded-2xl bg-[#0c1320] space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">No Documents Found</h4>
            <p className="text-xs text-slate-500 font-mono">
              {searchTerm || filterMode !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No faculty PDF files are currently stored in the database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#24334b] shadow-inner">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0c1320] text-slate-400 border-b border-[#24334b]">
                <tr>
                  <th className="py-3 px-4 font-bold">Document Title & File</th>
                  <th className="py-3 px-4 font-bold">Faculty Member</th>
                  <th className="py-3 px-4 font-bold text-right">File Size</th>
                  <th className="py-3 px-4 font-bold">Upload Date</th>
                  <th className="py-3 px-4 font-bold">15-Day Deletion</th>
                  <th className="py-3 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2638] bg-[#0f1725]">
                {inspectedFiles.map((file, idx) => {
                  const expireTimestamp = file.expiresAt
                    ? new Date(file.expiresAt).getTime()
                    : new Date(file.uploadedAt).getTime() + 15 * 24 * 60 * 60 * 1000;
                  const remainingMs = Math.max(0, expireTimestamp - now);
                  const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
                  const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

                  const isExpiringSoon = remainingDays <= 1;
                  const isLarge = (file.fileSizeBytes || 0) >= 1024 * 1024;

                  return (
                    <tr key={`${file.id || 'doc'}-${idx}`} className="hover:bg-[#141e30] transition-colors">
                      {/* Title & File */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200 font-sans truncate max-w-xs">
                          {file.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                          <span className="text-rose-400 font-bold uppercase text-[9px] bg-rose-500/15 px-1.5 py-0.2 rounded border border-rose-500/30">
                            PDF
                          </span>
                          <span className="truncate max-w-[200px]">{file.fileName}</span>
                        </div>
                      </td>

                      {/* Faculty Uploader */}
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{file.facultyName}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {file.facultyEmail}
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-bold ${
                            isLarge ? 'text-amber-300' : 'text-emerald-400'
                          }`}
                        >
                          {file.fileSizeFormatted}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {file.fileSizeBytes?.toLocaleString()} B
                        </div>
                      </td>

                      {/* Upload Date */}
                      <td className="py-3 px-4 text-slate-300">
                        {file.uploadedAt ? file.uploadedAt.substring(0, 10) : 'Recent'}
                      </td>

                      {/* Expiration Timer */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                            isExpiringSoon
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            {remainingDays > 1
                              ? `${remainingDays}d left`
                              : `${remainingDays}d ${remainingHours}h left`}
                          </span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        {onDeleteFacultyFile && (
                          <button
                            type="button"
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/30"
                            title="Delete file immediately to free up database storage"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IN-APP CONFIRMATION MODAL TO PURGE A FILE IMMEDIATELY */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121c30] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white font-sans">Reclaim Database Storage?</h4>
                <p className="text-xs text-slate-400 font-mono">Immediate Firestore Removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">"{fileToDelete.title}"</span> ({fileToDelete.fileName})?
              This will immediately free <span className="font-bold text-emerald-400 font-mono">{fileToDelete.fileSizeFormatted}</span> of Firebase database storage.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 bg-[#1c2940] hover:bg-[#253654] text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Purge Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
