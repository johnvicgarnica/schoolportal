import React, { useState, useMemo } from 'react';
import {
  FacultyFolder,
  FacultyPersonalFile,
  UserProfile,
} from '../types';
import { extractFacultySurname } from '../lib/firebase';
import { FacultyDocumentViewerModal } from './FacultyDocumentViewerModal';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  ExternalLink,
  Check,
  FileText,
  FileSpreadsheet,
  File,
  HardDrive,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Building,
  Trash2,
  X,
  Eye,
  Download,
  Clock,
  Plus,
} from 'lucide-react';

interface AdminFacultyFoldersDirectoryProps {
  facultyList: Array<{ id: string; name: string; email: string; department?: string; createdAt?: string }>;
  facultyFolders: FacultyFolder[];
  facultyFiles: FacultyPersonalFile[];
  currentUser: UserProfile;
  onAddFacultyFolder?: (folder: Omit<FacultyFolder, 'id' | 'createdAt' | 'updatedAt' | 'itemCount'>) => void;
  onDeleteFacultyFolder?: (id: string) => void;
  onDeleteFacultyFile?: (id: string) => void;
}

const CATEGORY_OPTIONS = [
  'Daily Lesson Log (DLL)',
  'Table of Specifications (TOS)',
  'Test Questions & Answer Keys',
  'Budget of Work (BOW)',
  'Learning Activity Sheets (LAS)',
  'Instructional Media & PPT',
  'Class Records & Grades',
  'DepEd Forms & Portfolio',
  'General Subject Materials',
];

const COLOR_THEMES = [
  { name: 'Emerald', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  { name: 'Blue', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300' },
  { name: 'Indigo', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-300' },
  { name: 'Purple', bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-300' },
  { name: 'Amber', bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-300' },
  { name: 'Rose', bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-300' },
];

export const AdminFacultyFoldersDirectory: React.FC<AdminFacultyFoldersDirectoryProps> = ({
  facultyList,
  facultyFolders,
  facultyFiles,
  currentUser,
  onAddFacultyFolder,
  onDeleteFacultyFolder,
  onDeleteFacultyFile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_folders' | 'empty'>('all');
  const [selectedFacultyEmail, setSelectedFacultyEmail] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<FacultyPersonalFile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-app confirmation modal states (no window.confirm)
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; title: string; fileName: string } | null>(null);

  // Admin Create Folder Modal state
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCategory, setNewFolderCategory] = useState(CATEGORY_OPTIONS[0]);
  const [newFolderColor, setNewFolderColor] = useState('Blue');
  const [newFolderDescription, setNewFolderDescription] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Combine registered faculty list + any additional faculty emails from folders
  const allFacultyAccounts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; department: string; createdAt?: string }>();

    // 1. From registered faculty directory
    facultyList.forEach((f) => {
      const emailClean = (f.email || '').toLowerCase().trim();
      if (emailClean) {
        map.set(emailClean, {
          id: f.id,
          name: f.name || emailClean.split('@')[0],
          email: emailClean,
          department: f.department || 'Senior High School Dept.',
          createdAt: f.createdAt,
        });
      }
    });

    // 2. From faculty folders if any account wasn't in directory
    facultyFolders.forEach((folder) => {
      const emailClean = (folder.facultyEmail || '').toLowerCase().trim();
      if (emailClean && !map.has(emailClean)) {
        map.set(emailClean, {
          id: `fac-${emailClean}`,
          name: folder.facultyName || emailClean.split('@')[0],
          email: emailClean,
          department: 'Senior High School Dept.',
          createdAt: folder.createdAt,
        });
      }
    });

    const list = Array.from(map.values());

    // Sort alphabetically by extracted SURNAME
    list.sort((a, b) => {
      const surnameA = extractFacultySurname(a.name);
      const surnameB = extractFacultySurname(b.name);
      return surnameA.localeCompare(surnameB);
    });

    return list;
  }, [facultyList, facultyFolders]);

  // Group folders and files by faculty email
  const facultyDataMap = useMemo(() => {
    const folderMap: Record<string, FacultyFolder[]> = {};
    const fileMap: Record<string, FacultyPersonalFile[]> = {};

    facultyFolders.forEach((folder) => {
      const email = (folder.facultyEmail || '').toLowerCase().trim();
      if (!folderMap[email]) folderMap[email] = [];
      folderMap[email].push(folder);
    });

    facultyFiles.forEach((file) => {
      const email = (file.facultyEmail || '').toLowerCase().trim();
      if (!fileMap[email]) fileMap[email] = [];
      fileMap[email].push(file);
    });

    return { folderMap, fileMap };
  }, [facultyFolders, facultyFiles]);

  // Filter faculty by search query and status
  const filteredFaculty = useMemo(() => {
    return allFacultyAccounts.filter((faculty) => {
      const surname = extractFacultySurname(faculty.name);
      const folders = facultyDataMap.folderMap[faculty.email] || [];

      const matchesSearch =
        surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faculty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faculty.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        folders.some((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'has_folders') {
        matchesStatus = folders.length > 0;
      } else if (statusFilter === 'empty') {
        matchesStatus = folders.length === 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [allFacultyAccounts, facultyDataMap, searchTerm, statusFilter]);

  // Active faculty being inspected
  const activeFaculty = useMemo(() => {
    if (!selectedFacultyEmail) return null;
    return allFacultyAccounts.find((f) => f.email === selectedFacultyEmail) || null;
  }, [allFacultyAccounts, selectedFacultyEmail]);

  // Folders for active faculty
  const activeFacultyFolders = useMemo(() => {
    if (!selectedFacultyEmail) return [];
    return facultyDataMap.folderMap[selectedFacultyEmail] || [];
  }, [facultyDataMap, selectedFacultyEmail]);

  // Active folder within inspected faculty
  const activeFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return activeFacultyFolders.find((f) => f.id === selectedFolderId) || null;
  }, [activeFacultyFolders, selectedFolderId]);

  // Files in the active folder
  const filesInActiveFolder = useMemo(() => {
    if (!selectedFolderId || !selectedFacultyEmail) return [];
    const allFacultyFiles = facultyDataMap.fileMap[selectedFacultyEmail] || [];
    return allFacultyFiles.filter((file) => file.folderId === selectedFolderId);
  }, [facultyDataMap, selectedFolderId, selectedFacultyEmail]);

  // Confirm folder deletion
  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete || !onDeleteFacultyFolder) return;
    onDeleteFacultyFolder(folderToDelete.id);
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId(null);
    }
    showToast(`🗑️ Folder "${folderToDelete.name}" deleted.`);
    setFolderToDelete(null);
  };

  // Confirm file deletion
  const handleConfirmDeleteFile = () => {
    if (!fileToDelete || !onDeleteFacultyFile) return;
    onDeleteFacultyFile(fileToDelete.id);
    if (selectedPreviewFile?.id === fileToDelete.id) {
      setSelectedPreviewFile(null);
    }
    showToast(`Document "${fileToDelete.title}" removed.`);
    setFileToDelete(null);
  };

  // Admin create folder for faculty
  const handleCreateFolderForFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFaculty || !newFolderName.trim() || !onAddFacultyFolder) return;

    onAddFacultyFolder({
      facultyEmail: activeFaculty.email,
      facultyName: activeFaculty.name,
      facultySurname: extractFacultySurname(activeFaculty.name),
      name: newFolderName.trim(),
      description: newFolderDescription.trim(),
      category: newFolderCategory,
      color: newFolderColor,
    });

    showToast(`Folder "${newFolderName.trim()}" created for ${activeFaculty.name}.`);
    setIsAddFolderModalOpen(false);
    setNewFolderName('');
    setNewFolderDescription('');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 text-xs font-mono animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-full flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Master Admin & Principal Console</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                Unique Firebase Storage
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-sans tracking-tight">
              Faculty Repository & Personal Folders Directory
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-3xl leading-relaxed">
              Alphabetical index by faculty surname. Inspect uploaded DLL, TOS, TQ, and instructional files (PDF, DOCX, DOC, PPTX, XLSX up to 2MB). Files are automatically purged after 1 week.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0 text-xs font-mono">
            <div className="bg-[#0d1524] border border-[#24334b] rounded-2xl p-3 text-center min-w-[100px]">
              <div className="text-[10px] text-slate-400">Total Teachers</div>
              <div className="text-lg font-bold text-slate-100 mt-0.5">{allFacultyAccounts.length}</div>
            </div>
            <div className="bg-[#0d1524] border border-[#24334b] rounded-2xl p-3 text-center min-w-[100px]">
              <div className="text-[10px] text-slate-400">Total Folders</div>
              <div className="text-lg font-bold text-blue-400 mt-0.5">{facultyFolders.length}</div>
            </div>
            <div className="bg-[#0d1524] border border-[#24334b] rounded-2xl p-3 text-center min-w-[100px]">
              <div className="text-[10px] text-slate-400">Total Files</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{facultyFiles.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeFaculty ? (
        /* VIEWING A SPECIFIC FACULTY MEMBER'S FOLDERS */
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 sm:p-8 space-y-6 animate-fadeIn shadow-sm">
          {/* Breadcrumb Navigation Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#24334b] pb-5">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(null);
                  setSelectedFacultyEmail(null);
                }}
                className="p-2.5 bg-[#172236] hover:bg-[#20304c] text-slate-200 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold font-mono cursor-pointer border border-[#2d3e57]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Faculty Surnames</span>
              </button>

              {activeFolder && (
                <>
                  <div className="h-5 w-px bg-[#24334b]" />
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(null)}
                    className="p-2.5 bg-[#172236] hover:bg-[#20304c] text-slate-200 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold font-mono cursor-pointer border border-[#2d3e57]"
                  >
                    <span>{extractFacultySurname(activeFaculty.name)}'s Folders</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {!activeFolder && onAddFacultyFolder && (
                <button
                  type="button"
                  onClick={() => setIsAddFolderModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Create Folder for Teacher</span>
                </button>
              )}
            </div>
          </div>

          {/* If viewing inside a specific folder of this faculty */}
          {activeFolder ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-slate-100">{activeFolder.name}</h4>
                        <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-md font-bold">
                          {activeFolder.category || 'General'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Teacher: {activeFaculty.name} ({activeFaculty.email}) • {filesInActiveFolder.length} documents
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    {currentUser?.role === 'Admin' && onDeleteFacultyFolder && (
                      <button
                        type="button"
                        onClick={() =>
                          setFolderToDelete({ id: activeFolder.id, name: activeFolder.name })
                        }
                        className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                        title="Delete Faculty Folder"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span>Delete Folder</span>
                      </button>
                    )}
                  </div>
                </div>

                {activeFolder.description && (
                  <p className="text-xs text-slate-300 pt-2 border-t border-[#24334b] leading-relaxed font-sans">
                    <span className="font-bold text-slate-100">Faculty Notes: </span>
                    {activeFolder.description}
                  </p>
                )}
              </div>

              {/* UNIQUE FILE STORAGE SECTION: DOCUMENT PREVIEWS & LIST */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                    <span>Documents in "{activeFolder.name}"</span>
                    <span className="bg-[#172236] text-blue-300 border border-[#2d3e57] px-2 py-0.5 rounded-full text-[10px]">
                      {filesInActiveFolder.length} files
                    </span>
                  </h3>
                </div>

                {filesInActiveFolder.length === 0 ? (
                  <div className="bg-[#0f1725] border-2 border-dashed border-[#24334b] rounded-3xl p-8 sm:p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 mx-auto flex items-center justify-center">
                      <File className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-slate-200">
                      No Documents Uploaded Yet
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {activeFaculty.name} has not uploaded any files into this folder yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filesInActiveFolder.map((file) => {
                      const fmt = (file.format || '').toLowerCase();
                      const isPdf = fmt === 'pdf';
                      const isDoc = fmt.includes('doc');
                      const isSheet = fmt.includes('xls') || fmt.includes('sheet');
                      const isPpt = fmt.includes('ppt') || fmt.includes('pres');

                      let themeBorder = 'border-slate-700 hover:border-slate-500';
                      let badgeBg = 'bg-slate-700/50 text-slate-300 border-slate-600';
                      let typeLabel = fmt.toUpperCase();
                      let iconComp = <File className="w-5 h-5 text-slate-300" />;

                      if (isPdf) {
                        themeBorder = 'border-rose-500/30 hover:border-rose-500/70';
                        badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                        typeLabel = 'PDF';
                        iconComp = <FileText className="w-5 h-5 text-rose-400" />;
                      } else if (isDoc) {
                        themeBorder = 'border-blue-500/30 hover:border-blue-500/70';
                        badgeBg = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                        typeLabel = 'WORD';
                        iconComp = <FileText className="w-5 h-5 text-blue-400" />;
                      } else if (isSheet) {
                        themeBorder = 'border-emerald-500/30 hover:border-emerald-500/70';
                        badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                        typeLabel = 'EXCEL';
                        iconComp = <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
                      } else if (isPpt) {
                        themeBorder = 'border-amber-500/30 hover:border-amber-500/70';
                        badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                        typeLabel = 'POWERPOINT';
                        iconComp = <FileText className="w-5 h-5 text-amber-400" />;
                      }

                      // Remaining days
                      const now = Date.now();
                      const expireMs = file.expiresAt
                        ? new Date(file.expiresAt).getTime()
                        : new Date(file.uploadedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
                      const diffDays = Math.max(0, Math.ceil((expireMs - now) / (24 * 60 * 60 * 1000)));

                      return (
                        <div
                          key={file.id}
                          onClick={() => setSelectedPreviewFile(file)}
                          className={`bg-[#0f1725] border-2 ${themeBorder} rounded-3xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 group hover:-translate-y-0.5 relative overflow-hidden`}
                        >
                          {/* Visual Preview Thumbnail Box */}
                          <div className="w-full h-36 bg-[#0a0f1a] rounded-2xl border border-[#24334b] flex flex-col justify-between p-3 relative overflow-hidden group-hover:border-blue-500/40 transition-colors">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${badgeBg}`}
                              >
                                {typeLabel}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-[#141c2c] px-2 py-0.5 rounded-md border border-[#24334b]">
                                {file.fileSizeFormatted}
                              </span>
                            </div>

                            <div className="flex-1 flex flex-col justify-center items-center py-2 space-y-1.5 text-center">
                              <div className="p-2 rounded-xl bg-[#141c2c] border border-[#24334b] shadow-inner group-hover:scale-110 transition-transform">
                                {iconComp}
                              </div>
                              <div className="text-xs font-bold text-slate-200 line-clamp-1 px-2 font-sans">
                                {file.title}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                                {file.fileName}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#1c273a] text-[10px] font-mono text-slate-400">
                              <span className="flex items-center space-x-1 text-blue-400 font-bold group-hover:text-blue-300">
                                <Eye className="w-3 h-3" />
                                <span>Inspect Preview</span>
                              </span>
                              <span className="text-slate-500">{file.uploadedAt ? file.uploadedAt.substring(0, 10) : ''}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                              {file.title}
                            </h4>
                            <div className="flex items-center space-x-1.5 text-[11px] font-mono text-amber-300/90 pt-0.5">
                              <Clock className="w-3 h-3 shrink-0 text-amber-400" />
                              <span>Auto-deletes in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div
                            className="pt-2 border-t border-[#24334b] flex items-center justify-between text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPreviewFile(file)}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <div className="flex items-center space-x-1">
                              {file.fileData && (
                                <a
                                  href={file.fileData}
                                  download={file.fileName}
                                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c273a] rounded-lg transition-all"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {currentUser?.role === 'Admin' && onDeleteFacultyFile && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFileToDelete({ id: file.id, title: file.title, fileName: file.fileName })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* List of Folders that this faculty created */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Personal Folders Created by {activeFaculty.name} ({activeFacultyFolders.length})
                </h4>
              </div>

              {activeFacultyFolders.length === 0 ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-[#24334b] rounded-3xl bg-[#0f1725] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                    <Folder className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">No Folders Created Yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {activeFaculty.name} has not created any personal folders in their workspace yet.
                  </p>
                  {onAddFacultyFolder && (
                    <button
                      type="button"
                      onClick={() => setIsAddFolderModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-xs inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Folder for {activeFaculty.name}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeFacultyFolders.map((folder) => {
                    const count = (facultyDataMap.fileMap[activeFaculty.email] || []).filter(
                      (f) => f.folderId === folder.id
                    ).length;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="bg-[#0f1725] hover:bg-[#1a2638] border border-[#24334b] hover:border-blue-500/60 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="p-3 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-2xl shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <Folder className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#141c2c] border border-[#24334b] text-slate-300 rounded-md">
                              {folder.category || 'General'}
                            </span>
                          </div>

                          <h5 className="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1 font-sans">
                            {folder.name}
                          </h5>

                          {folder.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                              {folder.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#24334b] flex items-center justify-between text-xs font-mono text-slate-400">
                          <span className="text-[11px] text-blue-300 font-bold bg-[#141c2c] px-2 py-0.5 rounded-md border border-[#24334b]">
                            {count} {count === 1 ? 'file' : 'files'}
                          </span>

                          <div className="flex items-center space-x-2">
                            {currentUser?.role === 'Admin' && onDeleteFacultyFolder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete({ id: folder.id, name: folder.name });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                title="Delete Folder"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-blue-400 font-bold flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ALL FACULTY SURNAMES LIST / DIRECTORY */
        <div className="space-y-5">
          {/* Controls Bar: Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141c2c] p-4 rounded-2xl border border-[#24334b] shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by faculty surname (e.g., GARNICA, SANTOS), name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-[#101a2c] transition-all"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-[#1c273a] text-slate-300 border border-[#2d3e57] hover:bg-[#25344d]'
                }`}
              >
                All Faculty ({allFacultyAccounts.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('has_folders')}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  statusFilter === 'has_folders'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-[#1c273a] text-emerald-300 border border-[#2d3e57] hover:bg-[#25344d]'
                }`}
              >
                With Folders ({allFacultyAccounts.filter((f) => (facultyDataMap.folderMap[f.email] || []).length > 0).length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('empty')}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  statusFilter === 'empty'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-[#1c273a] text-amber-300 border border-[#2d3e57] hover:bg-[#25344d]'
                }`}
              >
                Empty Workspaces
              </button>
            </div>
          </div>

          {/* Surnames Grid */}
          {filteredFaculty.length === 0 ? (
            <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-10 text-center text-xs font-mono text-slate-400 space-y-2">
              <p>No faculty records found matching "{searchTerm}"</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="text-blue-400 hover:underline font-bold cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFaculty.map((faculty) => {
                const surname = extractFacultySurname(faculty.name);
                const folders = facultyDataMap.folderMap[faculty.email] || [];
                const hasFolders = folders.length > 0;

                return (
                  <div
                    key={faculty.email}
                    onClick={() => setSelectedFacultyEmail(faculty.email)}
                    className="bg-[#141c2c] border border-[#24334b] hover:border-blue-500/60 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group hover:-translate-y-0.5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-3 rounded-2xl border ${
                              hasFolders
                                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                : 'bg-[#1c273a] border-[#2d3e57] text-slate-400'
                            } shrink-0`}
                          >
                            <Folder className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h3 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight group-hover:text-blue-400 transition-colors font-sans">
                                {surname}
                              </h3>
                            </div>
                            <div className="text-xs text-slate-300 font-semibold truncate max-w-[170px] font-sans">
                              {faculty.name}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            hasFolders
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-[#1c273a] text-slate-400 border border-[#2d3e57]'
                          }`}
                        >
                          {hasFolders ? `${folders.length} Folders` : 'Empty'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs font-mono text-slate-400 pt-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-300">{faculty.email}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 truncate">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-300">{faculty.department}</span>
                        </div>
                      </div>

                      {hasFolders && (
                        <div className="pt-2 border-t border-[#24334b] space-y-1">
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            Faculty Folders:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {folders.slice(0, 3).map((f) => (
                              <span
                                key={f.id}
                                className="text-[11px] font-sans bg-[#0d1524] border border-[#24334b] text-slate-300 px-2 py-0.5 rounded-md truncate max-w-[150px]"
                              >
                                {f.name}
                              </span>
                            ))}
                            {folders.length > 3 && (
                              <span className="text-[11px] font-mono text-slate-400 px-1 py-0.5">
                                +{folders.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#24334b] flex items-center justify-end text-xs font-mono">
                      <span className="text-blue-400 font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>Open Repository</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADMIN ADD FOLDER MODAL */}
      {isAddFolderModalOpen && activeFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-[#121c30] rounded-3xl border border-[#24334b] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scaleUp text-slate-100">
            <div className="flex items-center justify-between border-b border-[#24334b] p-5 sm:p-6 pb-4 shrink-0 bg-[#141c2c]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/40">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Create Folder for {activeFaculty.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Unique Firebase Storage
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddFolderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer hover:bg-[#1a2638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderForFaculty} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-700">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Folder Name / Subject Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Grade 11 General Mathematics DLL"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Category
                  </label>
                  <select
                    value={newFolderCategory}
                    onChange={(e) => setNewFolderCategory(e.target.value)}
                    className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Description / Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe what materials will be stored here..."
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                    className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end space-x-3 px-6 py-4 border-t border-[#24334b] bg-[#101726]">
                <button
                  type="button"
                  onClick={() => setIsAddFolderModalOpen(false)}
                  className="px-4 py-2 bg-[#172236] hover:bg-[#20304c] text-slate-300 rounded-xl font-bold transition-all cursor-pointer font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer font-mono text-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM FOLDER DELETION (NO window.confirm) */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121c30] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Delete Faculty Folder?</h4>
                <p className="text-xs text-slate-400 font-mono">Irreversible Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Are you sure you want to delete folder <span className="font-bold text-white">"{folderToDelete.name}"</span> and all its uploaded documents from the Firebase database?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-[#1c2940] hover:bg-[#253654] text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Folder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM FILE DELETION (NO window.confirm) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121c30] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Delete Document?</h4>
                <p className="text-xs text-slate-400 font-mono">Permanent Removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">"{fileToDelete.title}"</span> ({fileToDelete.fileName}) from this teacher's folder?
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
                onClick={handleConfirmDeleteFile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      <FacultyDocumentViewerModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onDeleteFile={(id) => {
          if (onDeleteFacultyFile) {
            onDeleteFacultyFile(id);
            showToast('Document deleted.');
          }
        }}
        canDelete={currentUser?.role === 'Admin'}
      />
    </div>
  );
};
