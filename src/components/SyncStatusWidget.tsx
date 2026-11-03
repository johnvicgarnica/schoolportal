import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle2, CloudOff, AlertCircle, Clock } from 'lucide-react';
import { subscribeSyncStatus, performDeltaSync, SyncStatusInfo } from '../lib/syncManager';

export const SyncStatusWidget: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(() => ({
    state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'cached',
    lastSyncedAt: null,
    unsyncedMutationsCount: 0,
    message: 'Using local cache',
  }));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('Never synced');
  const [showToast, setShowToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeSyncStatus((status) => {
      setSyncStatus(status);
      if (status.lastSyncedAt) {
        updateTimeAgo(status.lastSyncedAt);
      }
    });
    return () => unsub();
  }, []);

  const updateTimeAgo = (isoString: string) => {
    try {
      const past = new Date(isoString).getTime();
      const diffSec = Math.floor((Date.now() - past) / 1000);
      if (diffSec < 45) {
        setLastSyncText('Just now');
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        setLastSyncText(`${mins}m ago`);
      } else {
        const hours = Math.floor(diffSec / 3600);
        setLastSyncText(`${hours}h ago`);
      }
    } catch {
      setLastSyncText('Recently');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (syncStatus.lastSyncedAt) {
        updateTimeAgo(syncStatus.lastSyncedAt);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [syncStatus.lastSyncedAt]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await performDeltaSync();
      const msg =
        result.totalUpdated > 0
          ? `Synced ${result.totalUpdated} updated record(s)`
          : 'Database is up to date (0 reads consumed)';
      setShowToast(msg);
      setTimeout(() => setShowToast(null), 3500);
    } catch (err) {
      setShowToast('Sync check failed. Continuing with local cache.');
      setTimeout(() => setShowToast(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = () => {
    if (syncStatus.state === 'offline') {
      return (
        <span className="flex items-center space-x-1.5 text-slate-400 bg-slate-800/80 border border-slate-700/60 px-2 py-1 rounded-lg text-[11px] font-semibold">
          <CloudOff className="w-3 h-3 text-slate-400" />
          <span>Offline (Cache Active)</span>
        </span>
      );
    }

    if (isSyncing || syncStatus.state === 'syncing') {
      return (
        <span className="flex items-center space-x-1.5 text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg text-[11px] font-semibold animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
          <span>Syncing Delta...</span>
        </span>
      );
    }

    if (syncStatus.state === 'synced') {
      return (
        <span
          title={`Last verified with database: ${syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString() : 'Recently'}`}
          className="flex items-center space-x-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg text-[11px] font-semibold"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Synced ({lastSyncText})</span>
        </span>
      );
    }

    // Default: using persistent local cache
    return (
      <span
        title="Application running fast with 0 repeat database reads"
        className="flex items-center space-x-1.5 text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-lg text-[11px] font-semibold"
      >
        <Database className="w-3 h-3 text-cyan-400" />
        <span>Local Cache Active</span>
      </span>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {getStatusBadge()}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          title="Manual sync: check cloud for new or modified records only"
          className="p-1.5 bg-[#1c273a] hover:bg-blue-600/30 text-slate-300 hover:text-white rounded-lg border border-[#2d3e57] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center space-x-2">
      {getStatusBadge()}

      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing}
        title="Manual Sync: Fetch only new or modified documents from Firestore"
        className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1a2538] hover:bg-blue-600/20 active:bg-blue-600/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 shadow-2xs hover:scale-[1.02] active:scale-95"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        <span className="hidden sm:inline">Sync Now</span>
      </button>

      {/* Floating toast notification after sync */}
      {showToast && (
        <div className="absolute top-10 right-0 z-50 bg-[#0f172a] text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-blue-500/40 shadow-xl flex items-center space-x-2 whitespace-nowrap animate-fadeIn">
          <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{showToast}</span>
        </div>
      )}
    </div>
  );
};
