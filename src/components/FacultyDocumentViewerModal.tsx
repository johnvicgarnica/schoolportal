import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FacultyPersonalFile, UserProfile, MasterTeacherComment } from '../types';
import { getFacultyFileData, saveMasterTeacherCommentToFile } from '../lib/firebase';
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
  FolderOpen,
  Edit2,
  Search,
  Table as TableIcon,
  Send,
  MessageSquare,
  Award,
  GraduationCap,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';

interface FacultyDocumentViewerModalProps {
  isOpen: boolean;
  file: FacultyPersonalFile | null;
  onClose: () => void;
  onDeleteFile?: (fileId: string) => void;
  canDelete?: boolean;
  onOpenSpreadsheetEditor?: (file: FacultyPersonalFile, fileDataUrl?: string) => void;
  currentUser?: UserProfile | null;
  onCommentSaved?: (updatedFile: FacultyPersonalFile) => void;
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

// Helper to generate Excel column letters (A, B, ... Z, AA, AB, ...)
function getColumnLetter(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

export const FacultyDocumentViewerModal: React.FC<FacultyDocumentViewerModalProps> = ({
  isOpen,
  file,
  onClose,
  onDeleteFile,
  canDelete = true,
  onOpenSpreadsheetEditor,
  currentUser,
  onCommentSaved,
}) => {
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Master Teacher Comment States
  const [commentsList, setCommentsList] = useState<MasterTeacherComment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('');
  const [reviewerDesignation, setReviewerDesignation] = useState<string>('Master Teacher');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [activeFeedbackPreset, setActiveFeedbackPreset] = useState<string | null>(null);

  const MT_PRESETS = [
    '✓ Checked & Approved compliant with DepEd standards and curriculum guide.',
    '⭐ Commendation: Excellent pedagogical alignment with MELCs and student engagement.',
    '📌 Ensure instructional materials, slide decks, and activity sheets for all days are attached.',
    '🔍 Review cognitive dimension weighting on TOS to balance Bloom\'s taxonomy.',
    '📝 Add formative assessment answer keys and grading rubric.',
    '⚡ Complied. Ready for classroom execution and instructional delivery.',
  ];

  // Real Excel/Spreadsheet parsed workbook and sheet states
  const [parsedWorkbook, setParsedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [parsedSheetNames, setParsedSheetNames] = useState<string[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [parsedSheetData, setParsedSheetData] = useState<(string | number)[][]>([]);
  const [isParsingSpreadsheet, setIsParsingSpreadsheet] = useState<boolean>(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{ r: number; c: number; value: string } | null>(null);
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState<string>('');
  
  // Checker view scale: Default to a generous, readable 115% scale
  const [zoomLevel, setZoomLevel] = useState<number>(115);
  // Full screen is always true by default for maximum view scale for the checker
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'standard' | 'expanded'>('expanded');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
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

  // Master Teacher Admin Verification:
  // Only an admin who has a master teacher role can post comments.
  // Faculty can only view the comments and cannot type comments.
  const isMasterTeacherAdmin = useMemo(() => {
    if (!currentUser) return false;
    const isAdmin =
      currentUser.role === 'Admin' ||
      (currentUser as any).isAdmin === true ||
      currentUser.role?.toLowerCase() === 'admin';
    if (!isAdmin) return false;

    const desig = (currentUser.designation || '').toLowerCase().trim();
    const email = (currentUser.email || '').toLowerCase().trim();
    const name = (currentUser.name || '').toLowerCase().trim();

    return (
      desig.includes('master teacher') ||
      desig.includes('mt') ||
      email.includes('norma') ||
      email.includes('jabagat') ||
      name.includes('norma')
    );
  }, [currentUser]);

  // Compute maximum columns in current active sheet
  const maxCols = useMemo(() => {
    if (!parsedSheetData || parsedSheetData.length === 0) return 8;
    const longestRow = Math.max(...parsedSheetData.map((row) => (Array.isArray(row) ? row.length : 0)));
    return Math.max(8, Math.min(100, longestRow));
  }, [parsedSheetData]);

  // Compute search matches count
  const searchFilteredRowCount = useMemo(() => {
    if (!spreadsheetSearchQuery.trim()) return parsedSheetData.length;
    const q = spreadsheetSearchQuery.toLowerCase();
    return parsedSheetData.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q))
    ).length;
  }, [parsedSheetData, spreadsheetSearchQuery]);

  // Helper to show transient in-modal notification without window.alert
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Parse Excel workbook from Base64
  const parseSpreadsheetData = (dataUrlOrBase64: string) => {
    setIsParsingSpreadsheet(true);
    setSpreadsheetError(null);
    try {
      const base64Data = dataUrlOrBase64.includes(',')
        ? dataUrlOrBase64.split(',')[1]
        : dataUrlOrBase64;

      const wb = XLSX.read(base64Data, {
        type: 'base64',
        cellDates: true,
        raw: false,
      });

      setParsedWorkbook(wb);
      const sheets = wb.SheetNames || [];
      setParsedSheetNames(sheets);

      const firstSheet = sheets[0] || 'Sheet1';
      setActiveSheetName(firstSheet);

      if (wb.Sheets[firstSheet]) {
        const data = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[firstSheet], {
          header: 1,
          defval: '',
          blankrows: true,
        });
        setParsedSheetData((data || []) as (string | number)[][]);
        if (data && data.length > 0 && data[0]?.length > 0) {
          setSelectedCellInfo({ r: 0, c: 0, value: String(data[0][0] ?? '') });
        } else {
          setSelectedCellInfo(null);
        }
      } else {
        setParsedSheetData([]);
        setSelectedCellInfo(null);
      }
    } catch (err: any) {
      console.error('Failed to parse original spreadsheet file:', err);
      setSpreadsheetError('Unable to parse the original Excel spreadsheet binary.');
    } finally {
      setIsParsingSpreadsheet(false);
    }
  };

  // Switch sheet tab within parsed workbook
  const handleSwitchSheet = (newSheetName: string) => {
    if (!parsedWorkbook || newSheetName === activeSheetName) return;
    setActiveSheetName(newSheetName);
    const ws = parsedWorkbook.Sheets[newSheetName];
    if (ws) {
      const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
        header: 1,
        defval: '',
        blankrows: true,
      });
      setParsedSheetData((data || []) as (string | number)[][]);
      if (data && data.length > 0 && data[0]?.length > 0) {
        setSelectedCellInfo({ r: 0, c: 0, value: String(data[0][0] ?? '') });
      } else {
        setSelectedCellInfo(null);
      }
    } else {
      setParsedSheetData([]);
      setSelectedCellInfo(null);
    }
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
      setParsedWorkbook(null);
      setParsedSheetNames([]);
      setActiveSheetName('');
      setParsedSheetData([]);
      setSelectedCellInfo(null);
      setSpreadsheetSearchQuery('');
      setSpreadsheetError(null);
      setCommentsList([]);
      setNewCommentText('');
      setActiveFeedbackPreset(null);
      return;
    }

    // Initialize Master Teacher comments list from file
    const initialComments: MasterTeacherComment[] =
      file.masterTeacherComments && file.masterTeacherComments.length > 0
        ? [...file.masterTeacherComments]
        : file.masterTeacherComment
        ? [
            {
              id: 'initial-comment',
              comment: file.masterTeacherComment,
              commentedBy: file.masterTeacherCommentedBy || 'Norma Jabagat',
              designation: 'Master Teacher',
              commentedAt: file.masterTeacherCommentedAt || file.uploadedAt || new Date().toISOString(),
            },
          ]
        : [];
    setCommentsList(initialComments);
    setNewCommentText('');
    setReviewerName(currentUser?.name || 'Norma Jabagat');
    setReviewerDesignation(currentUser?.designation || 'Master Teacher');

    // Always ensure full screen is active when opened for checker review
    setIsFullscreen(true);
    setZoomLevel(115);

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const fmt = (file.format || '').toLowerCase();
    const isSpreadsheet = fmt.includes('xls') || fmt.includes('sheet');
    const mime = fmt === 'pdf'
      ? 'application/pdf'
      : fmt.includes('doc')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : isSpreadsheet
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
      if (isSpreadsheet) {
        parseSpreadsheetData(file.fileData);
      }
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
          if (isSpreadsheet) {
            parseSpreadsheetData(data);
          }
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

  const handleSaveMasterTeacherComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isMasterTeacherAdmin) {
      showToast('⚠️ Access Denied: Only an Administrator with a Master Teacher role can post comments.');
      return;
    }
    if (!file || !newCommentText.trim()) {
      showToast('Please type a comment before posting.');
      return;
    }

    setIsSubmittingComment(true);
    try {
      const author = reviewerName.trim() || currentUser?.name || 'Norma Jabagat';
      const role = reviewerDesignation.trim() || 'Master Teacher';
      const commentText = newCommentText.trim();

      const updatedFile = await saveMasterTeacherCommentToFile(
        file.id,
        commentText,
        author,
        role
      );

      const newCommentObj: MasterTeacherComment = {
        id: `mtc-${Date.now()}`,
        comment: commentText,
        commentedBy: author,
        designation: role,
        commentedAt: new Date().toISOString(),
      };

      setCommentsList((prev) => [newCommentObj, ...prev]);
      setNewCommentText('');
      setActiveFeedbackPreset(null);
      showToast('✓ Master Teacher comment saved and synced to faculty workspace!');

      if (onCommentSaved && updatedFile) {
        onCommentSaved(updatedFile);
      }
    } catch (err) {
      console.error('Error saving Master Teacher comment:', err);
      showToast('⚠️ Could not save comment. Please retry.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!isOpen || !file) return null;

  const format = (file.format || '').toLowerCase();
  const isPdf = format === 'pdf';
  const isDoc = format.includes('doc');
  const isSheet = format.includes('xls') || format.includes('sheet');
  const isPpt = format.includes('ppt') || format.includes('pres');

  // Compute remaining time until 15-day auto-delete
  const now = Date.now();
  const expireTimestamp = file.expiresAt
    ? new Date(file.expiresAt).getTime()
    : new Date(file.uploadedAt).getTime() + 15 * 24 * 60 * 60 * 1000;
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

            {/* 15-Day Auto-Delete Timer */}
            <div
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-mono border ${
                remainingDays <= 1
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
              title="Automatically deleted after 15 days for storage hygiene"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold">{remainingText}</span>
            </div>

            {/* Interactive Spreadsheet Editor Button for Excel files */}
            {isSheet && onOpenSpreadsheetEditor && (
              <button
                type="button"
                onClick={() => {
                  onOpenSpreadsheetEditor(file, fileDataUrl || file.fileData);
                  onClose();
                }}
                className="px-3 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                title="Edit in interactive Google Sheets / in-app spreadsheet editor"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit in Sheets</span>
              </button>
            )}

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
            /* FULL-SCREEN PDF VIEWER FOR DOCUMENT CHECKER (NATIVE BLOB STREAM) + MASTER TEACHER COMMENTS SECTION */
            <div className="w-full h-full flex flex-col flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Native PDF Reader Frame */}
              <div className="w-full h-[62vh] min-h-[460px] rounded-2xl border border-[#24334b] relative shadow-2xl overflow-hidden bg-[#0d1524] shrink-0">
                <iframe
                  src={`${blobUrl || fileDataUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=${zoomLevel}`}
                  className="w-full h-full border-0 bg-white"
                  title={file.title}
                />
              </div>

              {/* Bottom Quick Scale & Checker Toolbar for PDF */}
              <div className="px-4 py-2.5 bg-[#0e1626] border border-[#24334b] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400 shrink-0 shadow-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Native High-DPI PDF Reader Active</span>
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="text-slate-400 hidden sm:inline">{file.fileName} ({file.fileSizeFormatted})</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('master-teacher-comments-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-amber-300 hover:text-amber-200 font-bold flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {commentsList.length > 0 ? `Master Teacher Comments (${commentsList.length})` : 'Write MT Comment'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* SECTION BELOW THE PDF VIEWER: MASTER TEACHER EVALUATION & COMMENTS */}
              <div
                id="master-teacher-comments-section"
                className="w-full bg-[#0c1322] border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl shrink-0 font-sans text-left"
              >
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#202f48] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-2xl shrink-0 shadow-inner">
                      <GraduationCap className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          Master Teacher Document Evaluation & Comments
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-md uppercase">
                          Official Review
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans mt-0.5">
                        Supervisory notes and feedback on instructional delivery for teacher <span className="text-indigo-200 font-semibold">{file.facultyName}</span>. Comments are synced directly to the faculty's personal workspace.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center space-x-2">
                    {commentsList.length > 0 ? (
                      <span className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold rounded-xl flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{commentsList.length} Comment{commentsList.length === 1 ? '' : 's'} Logged</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold rounded-xl flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Pending Review</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Writer Box: Master Teacher Comments Composer (ONLY for Admin with Master Teacher role) */}
                {isMasterTeacherAdmin ? (
                  <div className="bg-[#121c30] border border-[#24334b] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm text-left">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <label className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        <span>Write Master Teacher Comment & Recommendations</span>
                      </label>

                      <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
                        <span className="text-slate-500">Reviewer:</span>
                        <span className="font-bold text-slate-200">{currentUser?.name || reviewerName || 'Norma Jabagat'}</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px]">
                          {currentUser?.designation || reviewerDesignation || 'Master Teacher'}
                        </span>
                      </div>
                    </div>

                    {/* Preset Feedback Templates */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                        Quick Feedback Templates (Click to insert):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {MT_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewCommentText((prev) => (prev ? `${prev}\n${preset}` : preset));
                              setActiveFeedbackPreset(preset);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-sans transition-all cursor-pointer text-left border ${
                              activeFeedbackPreset === preset
                                ? 'bg-indigo-600/40 border-indigo-400 text-white'
                                : 'bg-[#182438] hover:bg-indigo-600/30 hover:border-indigo-400/50 border-[#273852] text-slate-300 hover:text-white'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Type your official supervisory comment, instructional suggestions, or compliance notes for the faculty member..."
                        className="w-full bg-[#0a101d] border border-[#24334b] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-slate-100 placeholder:text-slate-500 font-sans transition-all leading-relaxed"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs">
                        <span className="text-[11px] text-slate-500">
                          {newCommentText.length} characters • Once posted, the faculty will immediately see this comment on this document.
                        </span>

                        <div className="flex items-center space-x-2">
                          {newCommentText && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewCommentText('');
                                setActiveFeedbackPreset(null);
                              }}
                              className="px-3 py-1.5 bg-[#182438] hover:bg-[#20304a] text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer text-[11px]"
                            >
                              Clear
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleSaveMasterTeacherComment}
                            disabled={isSubmittingComment || !newCommentText.trim()}
                            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer text-xs ${
                              isSubmittingComment || !newCommentText.trim()
                                ? 'bg-indigo-900/50 text-indigo-300/50 cursor-not-allowed border border-indigo-800/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:scale-105 active:scale-95'
                            }`}
                          >
                            {isSubmittingComment ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Posting Comment...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Post Master Teacher Comment</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Read-Only Notice: Faculty and non-Master-Teacher users can only view feedback */
                  <div className="bg-[#121c30] border border-[#24334b] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                        <Award className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-slate-100 font-sans">
                            Master Teacher Evaluation & Feedback
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700 font-bold">
                            Faculty View (Read-Only)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          Only an Administrator who holds a Master Teacher role can write and post supervisory evaluation comments. Faculty members can only review all evaluation remarks and instructional recommendations below.
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl shrink-0 font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Viewing Mode</span>
                    </div>
                  </div>
                )}

                {/* Existing Comments History (Visible to both Master Teacher and Faculty) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202f48] pb-2">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Document Evaluation & Feedback History ({commentsList.length})</span>
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Visible to Faculty & School Administrators
                    </span>
                  </div>

                  {commentsList.length === 0 ? (
                    <div className="p-6 bg-[#0a101d] rounded-2xl border border-dashed border-[#24334b] text-center space-y-2">
                      <MessageSquare className="w-8 h-8 text-slate-500 mx-auto opacity-70" />
                      <h5 className="text-xs font-bold text-slate-300 font-mono">No Comments on this Document Yet</h5>
                      <p className="text-xs text-slate-400 max-w-lg mx-auto font-sans leading-relaxed">
                        When the Master Teacher inspects this PDF, evaluative feedback, remarks, and recommendations will appear here so the faculty can view them and ensure curriculum alignment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {commentsList.map((c, i) => (
                        <div
                          key={c.id || i}
                          className="bg-[#121c30] border border-[#24334b] hover:border-indigo-500/40 rounded-2xl p-4 sm:p-5 space-y-2.5 transition-all shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2940] pb-2.5">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono shadow-xs">
                                {(c.commentedBy || 'MT').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-white font-sans">{c.commentedBy || 'Master Teacher'}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                    {c.designation || 'Master Teacher'}
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span className="hidden sm:inline">Verified Reviewer</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{c.commentedAt ? new Date(c.commentedAt).toLocaleString() : 'Just now'}</span>
                            </div>
                          </div>

                          <div className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed whitespace-pre-line pl-1">
                            {c.comment}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                        Verified 10MB Storage
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
            /* FULL-SCALE ORIGINAL EXCEL SPREADSHEET WORKBOOK VIEWER */
            <div className="w-full h-full flex flex-col flex-1 overflow-hidden space-y-2">
              {/* Formula Bar & Search Filter Controller */}
              <div className="bg-[#121c30] border border-[#24334b] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shrink-0 shadow-sm">
                <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
                  {/* Active Cell Address */}
                  <span className="text-emerald-400 font-bold px-2.5 py-1 bg-[#0a0f1a] rounded-lg border border-[#24334b] shrink-0">
                    {selectedCellInfo
                      ? `${getColumnLetter(selectedCellInfo.c)}${selectedCellInfo.r + 1}`
                      : 'A1'}
                  </span>
                  
                  {/* Formula / Cell Content Display */}
                  <div className="flex-1 bg-[#09111e] px-3 py-1 rounded-lg border border-[#24334b] text-slate-100 truncate min-h-[30px] flex items-center shadow-inner">
                    <span className="text-emerald-400 font-bold mr-2 select-none">fx</span>
                    <span className="truncate text-slate-200">
                      {selectedCellInfo?.value !== undefined
                        ? selectedCellInfo.value
                        : parsedSheetData[0]?.[0] !== undefined
                        ? String(parsedSheetData[0][0])
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Search / Filter within Sheet */}
                <div className="flex items-center space-x-2 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={spreadsheetSearchQuery}
                      onChange={(e) => setSpreadsheetSearchQuery(e.target.value)}
                      placeholder="Search cells (e.g. learner name)..."
                      className="pl-8 pr-3 py-1 bg-[#09111e] border border-[#24334b] rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
                    />
                    {spreadsheetSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSpreadsheetSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {onOpenSpreadsheetEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSpreadsheetEditor(file, fileDataUrl || file.fileData);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all"
                      title="Open in interactive spreadsheet editor to edit and save changes"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit Live in App</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Real Spreadsheet Grid */}
              <div
                className="flex-1 bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-auto text-xs text-slate-800 relative"
                style={{
                  fontSize: `${(zoomLevel / 100) * 12}px`,
                }}
              >
                {isParsingSpreadsheet ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3 font-mono text-xs text-slate-500">
                    <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="font-bold text-slate-700">Reading original spreadsheet data...</p>
                    <p className="text-[11px] text-slate-400">Extracting worksheets, columns, and records</p>
                  </div>
                ) : spreadsheetError ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3 font-mono text-xs text-center p-6">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl border border-amber-300">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-slate-800">{spreadsheetError}</p>
                    <p className="text-slate-500 max-w-md">
                      You can download the original file to view it in Microsoft Excel or Google Sheets desktop.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Download File
                    </button>
                  </div>
                ) : parsedSheetData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-2 font-mono text-xs text-slate-400 text-center">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                    <p className="font-bold text-slate-600">This worksheet is currently empty.</p>
                    {onOpenSpreadsheetEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSpreadsheetEditor(file, fileDataUrl || file.fileData);
                          onClose();
                        }}
                        className="mt-2 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
                      >
                        Open Editor to Add Data
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full border-collapse font-sans min-w-max select-text">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-mono text-xs sticky top-0 z-20 shadow-xs">
                        {/* Top-left corner cell */}
                        <th className="w-14 min-w-[56px] p-2 border-r border-b border-slate-300 bg-slate-200 text-center font-bold text-[11px] text-slate-600 sticky left-0 z-30 select-none">
                          #
                        </th>
                        {/* Dynamic Column Headers (A, B, C...) based on maxCols */}
                        {Array.from({ length: maxCols }).map((_, c) => (
                          <th
                            key={c}
                            className="p-2 border-r border-b border-slate-300 text-center font-bold text-[11px] min-w-[120px] bg-slate-100 select-none tracking-wider text-slate-600"
                          >
                            {getColumnLetter(c)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parsedSheetData.map((row, r) => {
                        const rowMatchesSearch =
                          !spreadsheetSearchQuery.trim() ||
                          row.some(
                            (cell) =>
                              cell !== null &&
                              cell !== undefined &&
                              String(cell)
                                .toLowerCase()
                                .includes(spreadsheetSearchQuery.toLowerCase())
                          );

                        // If user is searching and this row doesn't match, fade slightly
                        const isDimmed = spreadsheetSearchQuery.trim() && !rowMatchesSearch;

                        return (
                          <tr
                            key={r}
                            className={`transition-colors ${
                              isDimmed
                                ? 'opacity-30 bg-slate-50'
                                : r % 2 === 0
                                ? 'bg-white hover:bg-emerald-50/40'
                                : 'bg-slate-50/60 hover:bg-emerald-50/40'
                            }`}
                          >
                            {/* Sticky Row Number Index */}
                            <td className="w-14 min-w-[56px] p-2 text-center font-mono text-slate-500 bg-slate-100 border-r border-slate-300 sticky left-0 z-10 select-none font-semibold text-[11px]">
                              {r + 1}
                            </td>

                            {/* Real Cells from the uploaded file */}
                            {Array.from({ length: maxCols }).map((_, c) => {
                              const cellValue = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
                              const isSelected = selectedCellInfo?.r === r && selectedCellInfo?.c === c;
                              const isCellSearchMatch =
                                spreadsheetSearchQuery.trim() &&
                                cellValue
                                  .toLowerCase()
                                  .includes(spreadsheetSearchQuery.toLowerCase());

                              return (
                                <td
                                  key={c}
                                  onClick={() => setSelectedCellInfo({ r, c, value: cellValue })}
                                  className={`p-2 border-r border-slate-200 text-slate-800 transition-all cursor-cell whitespace-nowrap min-w-[120px] max-w-[340px] truncate ${
                                    isSelected
                                      ? 'ring-2 ring-emerald-500 bg-emerald-50 font-bold z-10'
                                      : isCellSearchMatch
                                      ? 'bg-amber-100 font-bold text-amber-950 ring-1 ring-amber-400'
                                      : ''
                                  }`}
                                  title={cellValue || undefined}
                                >
                                  {cellValue}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Sheet Tabs & Information Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121c30] p-3 rounded-2xl border border-[#24334b] text-xs font-mono shrink-0 shadow-sm">
                {/* Real Workbook Sheet Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto max-w-[65vw] scrollbar-thin py-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-bold mr-1 flex items-center space-x-1 shrink-0">
                    <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sheets:</span>
                  </span>
                  {parsedSheetNames.length > 0 ? (
                    parsedSheetNames.map((sheetName) => (
                      <button
                        key={sheetName}
                        type="button"
                        onClick={() => handleSwitchSheet(sheetName)}
                        className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer font-bold whitespace-nowrap flex items-center space-x-1.5 text-xs ${
                          activeSheetName === sheetName
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[#182338] text-slate-300 hover:text-white hover:bg-[#20304a] border border-[#24334b]'
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 opacity-80" />
                        <span>{sheetName}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">Sheet1</span>
                  )}
                </div>

                {/* Right Summary & Download */}
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-[11px] text-slate-400 hidden lg:inline">
                    {parsedSheetData.length} Rows • {maxCols} Cols
                    {spreadsheetSearchQuery.trim() && (
                      <span className="text-amber-400 ml-1">
                        ({searchFilteredRowCount} matching)
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all"
                    title="Download original file"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Original Excel</span>
                  </button>
                </div>
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
