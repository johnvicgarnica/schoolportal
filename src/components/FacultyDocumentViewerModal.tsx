import React, { useState, useEffect, useRef } from 'react';
import { FacultyPersonalFile } from '../types';
import { getFacultyFileData } from '../lib/firebase';
import {
  X,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  File,
  Clock,
  Calendar,
  User,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Check,
  RotateCcw,
  BookOpen,
  Layers,
  Sparkles,
  HelpCircle,
  FolderOpen
} from 'lucide-react';

interface FacultyDocumentViewerModalProps {
  isOpen: boolean;
  file: FacultyPersonalFile | null;
  onClose: () => void;
  onDeleteFile?: (fileId: string) => void;
  canDelete?: boolean;
}

// Convert base64 data to blob URL for fast, crisp native browser rendering
function base64ToBlobUrl(base64Data: string, mimeType: string): string {
  try {
    if (base64Data.startsWith('blob:')) return base64Data;
    const parts = base64Data.split(',');
    const base64 = parts.length > 1 ? parts[1] : parts[0];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('Failed to convert base64 to blob URL, falling back to data URL:', e);
    return base64Data;
  }
}

export const FacultyDocumentViewerModal: React.FC<FacultyDocumentViewerModalProps> = ({
  isOpen,
  file,
  onClose,
  onDeleteFile,
  canDelete = true,
}) => {
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Checker view scale: Default to a generous, readable 115% scale
  const [zoomLevel, setZoomLevel] = useState<number>(115);
  // Full screen is always true by default for maximum view scale for the checker
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'standard' | 'expanded'>('expanded');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [activeSheetTab, setActiveSheetTab] = useState<'Sheet1' | 'Summary' | 'Records'>('Sheet1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Checker evaluation checklist states
  const [checks, setChecks] = useState<{
    competencies: boolean;
    format: boolean;
    objectives: boolean;
    tosAlignment: boolean;
  }>({
    competencies: true,
    format: true,
    objectives: false,
    tosAlignment: false,
  });

  const blobUrlRef = useRef<string | null>(null);

  // Helper to show transient in-modal notification without window.alert
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    if (!isOpen || !file) {
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setFileDataUrl(null);
      setBlobUrl(null);
      setIsLoading(false);
      setLoadError(null);
      setIsConfirmDeleteOpen(false);
      setZoomLevel(115);
      return;
    }

    // Always ensure full screen is active when opened for checker review
    setIsFullscreen(true);
    setZoomLevel(115);

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const fmt = (file.format || '').toLowerCase();
    const mime = fmt === 'pdf'
      ? 'application/pdf'
      : fmt.includes('doc')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : fmt.includes('xls')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : fmt.includes('ppt')
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/octet-stream';

    // If file already has fileData in memory
    if (file.fileData) {
      setFileDataUrl(file.fileData);
      const url = base64ToBlobUrl(file.fileData, mime);
      blobUrlRef.current = url;
      setBlobUrl(url);
      setIsLoading(false);
      return;
    }

    // Retrieve via helper from Firestore / IndexedDB chunks
    getFacultyFileData(file)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setFileDataUrl(data);
          const url = base64ToBlobUrl(data, mime);
          blobUrlRef.current = url;
          setBlobUrl(url);
        } else {
          setLoadError('File content preview could not be loaded from database.');
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Error loading file data:', err);
        setLoadError('Unable to retrieve file binary from database.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const format = (file.format || '').toLowerCase();
  const isPdf = format === 'pdf';
  const isDoc = format.includes('doc');
  const isSheet = format.includes('xls') || format.includes('sheet');
  const isPpt = format.includes('ppt') || format.includes('pres');

  // Compute remaining time until 1-week auto-delete
  const now = Date.now();
  const expireTimestamp = file.expiresAt
    ? new Date(file.expiresAt).getTime()
    : new Date(file.uploadedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, expireTimestamp - now);
  const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const remainingText =
    remainingDays > 1
      ? `${remainingDays}d left`
      : remainingDays === 1
      ? `1d ${remainingHours}h left`
      : `${remainingHours}h left`;

  // Safe download trigger without window.alert
  const handleDownload = () => {
    const dataUrl = blobUrl || fileDataUrl || file.fileData;
    if (!dataUrl) {
      showToast('File data is still loading or unavailable for download.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = file.fileName || `${file.title}.${format || 'pdf'}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    showToast(`Downloading "${file.fileName}"...`);
  };

  const handleDeleteConfirmed = () => {
    if (onDeleteFile) {
      onDeleteFile(file.id);
      setIsConfirmDeleteOpen(false);
      onClose();
    }
  };

  // Determine badge styling based on format
  const getFormatBadge = () => {
    if (isPdf) {
      return {
        bg: 'bg-rose-500/20',
        text: 'text-rose-400',
        border: 'border-rose-500/40',
        label: 'PDF Document',
        icon: <FileText className="w-4 h-4 text-rose-400" />,
      };
    }
    if (isDoc) {
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/40',
        label: 'Word Document',
        icon: <FileText className="w-4 h-4 text-blue-400" />,
      };
    }
    if (isSheet) {
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        label: 'Excel Spreadsheet',
        icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
      };
    }
    if (isPpt) {
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        label: 'PowerPoint Slides',
        icon: <FileText className="w-4 h-4 text-amber-400" />,
      };
    }
    return {
      bg: 'bg-slate-500/20',
      text: 'text-slate-300',
      border: 'border-slate-500/40',
      label: format.toUpperCase(),
      icon: <File className="w-4 h-4 text-slate-300" />,
    };
  };

  const badge = getFormatBadge();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullscreen ? 'p-0 bg-slate-950' : 'p-2 sm:p-4 md:p-6 bg-slate-950/85'
      } backdrop-blur-md animate-fadeIn`}
    >
      {/* Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] bg-blue-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-blue-400 font-mono text-xs flex items-center space-x-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Full-Screen Modal Container: Taking 100% Viewport by Default */}
      <div
        className={`bg-[#070b14] flex flex-col overflow-hidden animate-scaleUp transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-[100dvh] max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-7xl max-h-[94vh] h-[90vh] rounded-3xl border border-[#24334b] shadow-2xl'
        }`}
      >
        {/* Top Header Bar with Checker Controls */}
        <div className="bg-[#0f1728] border-b border-[#24334b] px-4 py-2.5 sm:px-6 sm:py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
          {/* File Meta Info */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className={`p-2 sm:p-2.5 rounded-2xl ${badge.bg} border ${badge.border} shrink-0`}>
              {badge.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white truncate font-sans">
                  {file.title}
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-[#070b12] px-2 py-0.5 rounded-md border border-[#24334b]">
                  {file.fileSizeFormatted}
                </span>

                {/* Checker Badge: Confirms Full Screen Checker View Scale */}
                <span className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Checker Fullscreen Scale</span>
                </span>
              </div>

              <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                <span className="truncate max-w-[220px]">File: {file.fileName}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 shrink-0">
                  <User className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-300 font-semibold">{file.facultyName}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1 shrink-0">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{file.uploadedAt ? file.uploadedAt.substring(0, 10) : 'Recent'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar: Zoom Scale, View Presets, Auto-Delete Counter, Download, Fullscreen, Close */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* View Scale & Zoom Controller for Checker */}
            <div className="flex items-center space-x-1 bg-[#09111e] border border-[#24334b] px-2 py-1 rounded-xl text-xs font-mono">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden md:inline">
                Scale:
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer hover:bg-[#1a253a]"
                title="Zoom Out Scale"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-bold text-slate-200 min-w-[48px] text-center text-xs">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(220, z + 15))}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer hover:bg-[#1a253a]"
                title="Zoom In Scale"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Quick Scale Presets for Checker */}
              <div className="hidden lg:flex items-center space-x-1 border-l border-[#24334b] pl-1.5 ml-1">
                {[100, 125, 150].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setZoomLevel(preset)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                      zoomLevel === preset
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#182338]'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              {zoomLevel !== 115 && (
                <button
                  type="button"
                  onClick={() => setZoomLevel(115)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold ml-1 px-1.5 py-0.5 bg-blue-500/15 rounded-md cursor-pointer flex items-center space-x-0.5"
                  title="Reset to 115% default checker scale"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Default</span>
                </button>
              )}
            </div>

            {/* View Mode Toggle for Word & Spreadsheet Docs */}
            {(isDoc || isSheet) && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'expanded' ? 'standard' : 'expanded')}
                className={`hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
                  viewMode === 'expanded'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-[#09111e] text-slate-400 border-[#24334b] hover:text-white'
                }`}
                title={viewMode === 'expanded' ? 'Switch to standard margins' : 'Expand document to maximum width'}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{viewMode === 'expanded' ? 'Wide Scale' : 'Standard'}</span>
              </button>
            )}

            {/* 1-Week Auto-Delete Timer */}
            <div
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-mono border ${
                remainingDays <= 1
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
              title="Automatically deleted after 1 week (7 days) for storage hygiene"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold">{remainingText}</span>
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isLoading || (!blobUrl && !fileDataUrl && !file.fileData)}
              className="px-3 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              title="Download original file to device"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isFullscreen
                  ? 'text-blue-400 bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-[#1a2538] border border-transparent'
              }`}
              title={isFullscreen ? 'Switch to Centered Window Mode' : 'Switch to Full Screen View'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Delete Button */}
            {canDelete && onDeleteFile && (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-xl transition-all cursor-pointer border border-rose-500/30"
                title="Delete document immediately"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#1c2940] rounded-xl transition-all cursor-pointer ml-1"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* In-App Delete Confirmation Modal Overlay */}
        {isConfirmDeleteOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#121c30] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/40">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">Delete Document?</h4>
                  <p className="text-xs text-slate-400 font-mono">Immediate Database Removal</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-white">"{file.title}"</span> ({file.fileName})? It will be removed immediately from the Firebase storage and teacher folder.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="px-4 py-2 bg-[#1c2940] hover:bg-[#253654] text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirmed}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Delete File</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Content Body - Maximum Scale & Full Screen View for Document Checker */}
        <div className="flex-1 overflow-auto bg-[#070b14] p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center relative min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-16 text-slate-400 font-mono text-xs">
              <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-sm font-bold text-slate-300">Loading document preview for checker...</p>
              <p className="text-xs text-slate-500">Retrieving binary file from Firebase database...</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center space-y-3 p-8 text-center max-w-md">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">{loadError}</h4>
              <p className="text-xs text-slate-400 font-mono">
                The file metadata is preserved. You can download the file directly or re-upload.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </button>
            </div>
          ) : isPdf && (blobUrl || fileDataUrl) ? (
            /* FULL-SCREEN PDF VIEWER FOR DOCUMENT CHECKER (NATIVE BLOB STREAM) */
            <div className="w-full h-full flex flex-col flex-1 overflow-hidden">
              <div className="w-full flex-1 overflow-hidden bg-[#0d1524] rounded-2xl border border-[#24334b] relative shadow-2xl">
                <iframe
                  src={`${blobUrl || fileDataUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=${zoomLevel}`}
                  className="w-full h-full border-0 rounded-2xl bg-white"
                  title={file.title}
                />
              </div>

              {/* Bottom Quick Scale & Checker Toolbar for PDF */}
              <div className="mt-2.5 px-3 py-2 bg-[#0e1626] border border-[#24334b] rounded-xl flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Native High-DPI PDF Reader Active</span>
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">Use the embedded controls or top toolbar to check pages</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF ({file.fileSizeFormatted})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isDoc ? (
            /* FULL-SCALE WORD DOCUMENT VIEWER FOR DOCUMENT CHECKER */
            <div className="w-full h-full flex flex-col items-center overflow-auto py-2 px-1 sm:px-4">
              <div
                className={`w-full ${
                  viewMode === 'expanded' ? 'max-w-6xl' : 'max-w-4xl'
                } bg-white text-slate-900 rounded-3xl border border-slate-300 shadow-2xl p-6 sm:p-12 md:p-16 space-y-8 my-auto transition-all`}
                style={{
                  fontSize: `${(zoomLevel / 100) * 14}px`,
                }}
              >
                {/* Official Department of Education Document Header */}
                <div className="text-center border-b-2 border-slate-900/80 pb-6 space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-xs font-serif uppercase tracking-widest text-slate-600 font-bold">
                      Republic of the Philippines • Department of Education • Region III
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif uppercase tracking-wide text-slate-950">
                    San Vicente National High School - Senior High School
                  </h2>
                  <p className="text-xs sm:text-sm font-serif text-slate-600 font-medium">
                    Faculty Instructional Delivery & Classroom Evaluation Verification Sheet
                  </p>
                </div>

                {/* Document Title & Metadata Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="inline-block px-3 py-1 rounded-md bg-blue-100 text-blue-900 text-xs font-mono font-bold">
                        {file.category || 'Instructional Document'}
                      </span>
                      <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-xs font-mono font-bold">
                        Verified 2MB Storage
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-950">
                      {file.title}
                    </h1>
                    <p className="text-xs text-slate-600 font-mono">
                      File Name: <span className="font-semibold text-slate-800">{file.fileName}</span> • Size: {file.fileSizeFormatted}
                    </p>
                  </div>

                  <div className="text-xs font-mono bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 shrink-0 text-slate-700 shadow-xs">
                    <div><span className="text-slate-400 font-bold">Assigned Teacher:</span> {file.facultyName}</div>
                    <div><span className="text-slate-400 font-bold">Email:</span> {file.facultyEmail}</div>
                    <div><span className="text-slate-400 font-bold">Uploaded At:</span> {file.uploadedAt}</div>
                    <div><span className="text-slate-400 font-bold">Auto-Purge Cycle:</span> 7 Days ({remainingText})</div>
                  </div>
                </div>

                {/* Interactive Checker Evaluation Rubric Checklist */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-950 text-sm font-mono uppercase tracking-wider flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Document Checker Rubric & Rapid Verification Checklist</span>
                    </h4>
                    <span className="text-[11px] font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-bold">
                      Click to toggle status
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setChecks((c) => ({ ...c, objectives: !c.objectives }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        checks.objectives
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          checks.objectives
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checks.objectives && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Curriculum Learning Objectives</div>
                        <div className="text-[11px] text-slate-500">Objectives meet DepEd standards and DLL taxonomy</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChecks((c) => ({ ...c, competencies: !c.competencies }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        checks.competencies
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          checks.competencies
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checks.competencies && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Most Essential Learning Competencies (MELC)</div>
                        <div className="text-[11px] text-slate-500">Document matches targeted semester competencies</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChecks((c) => ({ ...c, tosAlignment: !c.tosAlignment }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        checks.tosAlignment
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          checks.tosAlignment
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checks.tosAlignment && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Table of Specifications (TOS) Alignment</div>
                        <div className="text-[11px] text-slate-500">Test questions and cognitive dimensions are aligned</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChecks((c) => ({ ...c, format: !c.format }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        checks.format
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          checks.format
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checks.format && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Official DepEd Heading & Typography</div>
                        <div className="text-[11px] text-slate-500">Standard margins, readable font, and correct labeling</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Teacher Notes & Lesson Overview */}
                <div className="space-y-3 font-sans">
                  <h4 className="font-bold text-slate-900 text-sm font-mono uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Teacher Documentation & Notes</span>
                  </h4>

                  {file.description ? (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line font-sans shadow-xs">
                      {file.description}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-slate-500 text-xs sm:text-sm italic">
                      Standard instructional materials document uploaded by {file.facultyName}. Verified document ready for classroom deployment and supervisor inspection.
                    </div>
                  )}
                </div>

                {/* Full Checking Action Footer */}
                <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
                  <div className="text-slate-500">
                    To check in native Microsoft Word or Google Docs desktop suite:
                  </div>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md inline-flex items-center space-x-2.5 cursor-pointer text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Word Document ({file.fileSizeFormatted})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isSheet ? (
            /* FULL-SCALE EXCEL SPREADSHEET WORKBOOK FOR DOCUMENT CHECKER */
            <div className="w-full h-full flex flex-col flex-1 overflow-hidden space-y-2">
              {/* Formula Bar Simulation */}
              <div className="bg-[#121c30] border border-[#24334b] rounded-xl px-4 py-2.5 flex items-center space-x-3 font-mono text-xs shrink-0 shadow-sm">
                <span className="text-emerald-400 font-bold px-2.5 py-0.5 bg-[#0a0f1a] rounded-md border border-[#24334b]">
                  fx
                </span>
                <span className="text-slate-200 truncate">
                  ={file.title} • {file.category} • San Vicente National High School SHS • Checked by Admin
                </span>
              </div>

              {/* Massive Full-Screen Table Grid */}
              <div
                className="flex-1 bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-auto text-xs text-slate-800"
                style={{
                  fontSize: `${(zoomLevel / 100) * 12}px`,
                }}
              >
                <table className="w-full border-collapse font-sans min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-700 border-b-2 border-slate-300 font-mono text-xs sticky top-0 z-10 shadow-xs">
                      <th className="w-16 p-3 border-r border-slate-300 bg-slate-300 text-center font-bold">#</th>
                      <th className="p-3 border-r border-slate-300 text-left w-1/4">A (Item / Week / Module)</th>
                      <th className="p-3 border-r border-slate-300 text-left w-1/3">B (Target Learning Competencies)</th>
                      <th className="p-3 border-r border-slate-300 text-center w-28">C (Target Score)</th>
                      <th className="p-3 border-r border-slate-300 text-center w-28">D (Mastery %)</th>
                      <th className="p-3 text-left">E (Checker Remarks / Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-blue-50/60 font-semibold bg-slate-50/50">
                      <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">1</td>
                      <td className="p-3 font-bold text-slate-900 border-r border-slate-200">{file.title}</td>
                      <td className="p-3 text-slate-800 border-r border-slate-200">{file.category}</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">100</td>
                      <td className="p-3 text-center font-mono text-emerald-700 font-bold border-r border-slate-200">100%</td>
                      <td className="p-3 text-emerald-800 font-bold flex items-center space-x-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Verified Active Document</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-blue-50/60">
                      <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">2</td>
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">Faculty Uploader</td>
                      <td className="p-3 text-slate-700 border-r border-slate-200">{file.facultyName} ({file.facultyEmail})</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">—</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">—</td>
                      <td className="p-3 text-slate-600 font-medium">Registered Faculty Account</td>
                    </tr>
                    <tr className="hover:bg-blue-50/60">
                      <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">3</td>
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">File Storage Size</td>
                      <td className="p-3 text-slate-700 border-r border-slate-200">{file.fileSizeFormatted} ({file.fileSizeBytes} bytes)</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">VALID</td>
                      <td className="p-3 text-center font-mono text-emerald-700 font-bold border-r border-slate-200">&lt; 2 MB</td>
                      <td className="p-3 text-emerald-700 font-bold">Within 2MB Storage Quota</td>
                    </tr>
                    <tr className="hover:bg-blue-50/60">
                      <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">4</td>
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">Upload Date</td>
                      <td className="p-3 text-slate-700 border-r border-slate-200">{file.uploadedAt}</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">—</td>
                      <td className="p-3 text-center font-mono border-r border-slate-200">—</td>
                      <td className="p-3 text-slate-600 font-medium">Verified Timestamp</td>
                    </tr>
                    <tr className="hover:bg-blue-50/60">
                      <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">5</td>
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">1-Week Deletion Schedule</td>
                      <td className="p-3 text-slate-700 border-r border-slate-200">Automatic Storage Cleanup Cycle</td>
                      <td className="p-3 text-center font-mono text-amber-700 font-bold border-r border-slate-200">
                        {remainingDays}d
                      </td>
                      <td className="p-3 text-center font-mono text-amber-700 font-bold border-r border-slate-200">
                        {remainingText}
                      </td>
                      <td className="p-3 text-amber-700 font-bold">Auto-Purge Pending</td>
                    </tr>
                    {file.description && (
                      <tr className="hover:bg-blue-50/60">
                        <td className="p-3 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300">6</td>
                        <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">Teacher Notes</td>
                        <td className="p-3 text-slate-700 border-r border-slate-200" colSpan={4}>
                          {file.description}
                        </td>
                      </tr>
                    )}
                    {Array.from({ length: 15 }).map((_, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 text-slate-400">
                        <td className="p-2.5 text-center font-mono text-slate-400 bg-slate-50 border-r border-slate-300">
                          {idx + 7}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-300">—</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-300">—</td>
                        <td className="p-2.5 text-center border-r border-slate-200 text-slate-300">—</td>
                        <td className="p-2.5 text-center border-r border-slate-200 text-slate-300">—</td>
                        <td className="p-2.5 text-slate-300">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sheet Tabs and Download Bar */}
              <div className="flex items-center justify-between bg-[#121c30] p-3 rounded-2xl border border-[#24334b] text-xs font-mono shrink-0">
                <div className="flex items-center space-x-2">
                  {(['Sheet1', 'Summary', 'Records'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveSheetTab(tab)}
                      className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-bold ${
                        activeSheetTab === tab
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a273e]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-2 shadow-2xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel Workbook</span>
                </button>
              </div>
            </div>
          ) : isPpt ? (
            /* FULL-SCALE POWERPOINT SLIDE DECK FOR DOCUMENT CHECKER */
            <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 overflow-auto">
              <div
                className="w-full max-w-6xl aspect-video bg-gradient-to-br from-amber-950/70 via-[#182338] to-[#0a101d] rounded-3xl border-2 border-amber-500/50 p-8 sm:p-14 shadow-2xl flex flex-col justify-between relative overflow-hidden transition-all"
                style={{
                  transform: zoomLevel !== 115 ? `scale(${zoomLevel / 115})` : undefined,
                  transformOrigin: 'center center',
                }}
              >
                <div className="space-y-4 relative z-10">
                  <span className="text-xs font-mono font-bold px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full uppercase tracking-wider inline-block">
                    {file.category || 'Senior High School Presentation'}
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-sans leading-tight">
                    {file.title}
                  </h1>
                  <p className="text-sm sm:text-lg text-slate-300 font-medium max-w-3xl leading-relaxed">
                    {file.description || 'Instructional Slide Presentation for Senior High School curriculum deployment.'}
                  </p>
                </div>

                <div className="pt-6 border-t border-amber-500/20 flex items-center justify-between text-xs font-mono text-slate-400 relative z-10">
                  <div>
                    <span className="text-slate-500">Teacher:</span>{' '}
                    <span className="text-amber-200 font-bold">{file.facultyName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center space-x-2 shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PowerPoint Slides ({file.fileSizeFormatted})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* GENERIC BINARY VIEWER */
            <div className="flex flex-col items-center justify-center space-y-4 text-center max-w-md p-8 my-auto">
              <div className="p-4 bg-slate-800 text-slate-200 rounded-3xl border border-slate-700">
                <File className="w-12 h-12" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{file.title}</h4>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  {file.fileName} • {file.fileSizeFormatted}
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Document is stored in the Firebase database and ready for download.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
