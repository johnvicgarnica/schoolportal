import React, { useState, useMemo } from 'react';
import {
  FacultyFolder,
  FacultyPersonalFile,
  UserProfile,
} from '../types';
import { extractFacultySurname } from '../lib/firebase';
import { GoogleDriveWebview } from './GoogleDriveWebview';
import {
  Folder,
  FolderOpen,
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
  LayoutGrid,
} from 'lucide-react';

interface AdminFacultyFoldersDirectoryProps {
  facultyList: Array<{ id: string; name: string; email: string; department?: string; createdAt?: string }>;
  facultyFolders: FacultyFolder[];
  facultyFiles: FacultyPersonalFile[];
  currentUser: UserProfile;
  onDeleteFacultyFolder?: (id: string) => void;
  onDeleteFacultyFile?: (id: string) => void;
}

export const AdminFacultyFoldersDirectory: React.FC<AdminFacultyFoldersDirectoryProps> = ({
  facultyList,
  facultyFolders,
  facultyFiles,
  currentUser,
  onDeleteFacultyFolder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_folders' | 'empty'>('all');
  const [selectedFacultyEmail, setSelectedFacultyEmail] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderDriveEmbed, setShowFolderDriveEmbed] = useState<boolean>(true);
  const [previewWebviewModal, setPreviewWebviewModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    subtitle?: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
    subtitle: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
  }, [allFacultyAccounts, searchTerm, statusFilter, facultyDataMap]);

  // Currently Selected Faculty Details
  const activeFaculty = useMemo(() => {
    if (!selectedFacultyEmail) return null;
    return allFacultyAccounts.find((f) => f.email === selectedFacultyEmail) || null;
  }, [allFacultyAccounts, selectedFacultyEmail]);

  const activeFacultyFolders = useMemo(() => {
    if (!selectedFacultyEmail) return [];
    return facultyDataMap.folderMap[selectedFacultyEmail] || [];
  }, [facultyDataMap, selectedFacultyEmail]);

  const activeFacultyFiles = useMemo(() => {
    if (!selectedFacultyEmail) return [];
    return facultyDataMap.fileMap[selectedFacultyEmail] || [];
  }, [facultyDataMap, selectedFacultyEmail]);

  // Selected folder inside active faculty
  const activeFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return activeFacultyFolders.find((f) => f.id === selectedFolderId) || null;
  }, [activeFacultyFolders, selectedFolderId]);

  const filesInActiveFolder = useMemo(() => {
    if (!selectedFolderId) return [];
    return activeFacultyFiles.filter((f) => f.folderId === selectedFolderId);
  }, [activeFacultyFiles, selectedFolderId]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0d1524] text-slate-100 px-4 py-3 rounded-2xl shadow-xl border border-[#24334b] flex items-center space-x-3 text-xs font-mono animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[#24334b]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] sm:text-xs font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Faculty Folders Explorer</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-sans text-white">
            Faculty Repositories by Surname
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
            Each folder below represents a registered faculty member organized by their <strong className="text-slate-100 font-semibold">SURNAME</strong>. Open any faculty directory to inspect their created lesson folders, Daily Lesson Logs, and uploaded files.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <div className="text-slate-400 text-[10px]">Total Faculty</div>
            <div className="text-lg font-bold text-white">{allFacultyAccounts.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <div className="text-slate-400 text-[10px]">Total Folders</div>
            <div className="text-lg font-bold text-blue-300">{facultyFolders.length}</div>
          </div>
        </div>
      </div>

      {/* DETAILED VIEW OF SELECTED FACULTY */}
      {activeFaculty ? (
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-fadeIn">
          {/* Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#24334b] pb-5">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(null);
                  setSelectedFacultyEmail(null);
                }}
                className="p-2.5 bg-[#1c273a] hover:bg-[#25344d] text-slate-200 border border-[#2d3e57] rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold font-mono cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Faculty Surnames</span>
              </button>

              <div className="h-5 w-px bg-[#24334b]" />

              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-[#1c273a] text-slate-200 border border-[#2d3e57] rounded-2xl font-bold font-mono text-sm">
                  📁 {extractFacultySurname(activeFaculty.name)}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                    {activeFaculty.name}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono flex items-center space-x-2">
                    <span>{activeFaculty.email}</span>
                    <span>•</span>
                    <span className="text-blue-400 font-semibold">{activeFacultyFolders.length} folders created</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedFolderId && (
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="px-3.5 py-2 bg-[#1c273a] hover:bg-[#25344d] text-slate-200 border border-[#2d3e57] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {extractFacultySurname(activeFaculty.name)}'s Folders</span>
              </button>
            )}
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
                        Created on {activeFolder.createdAt || 'Recent'} • {filesInActiveFolder.length} documents
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    {activeFolder.driveUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowFolderDriveEmbed(!showFolderDriveEmbed)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs border ${
                            showFolderDriveEmbed
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-[#1c273a] text-emerald-300 border-[#2d3e57] hover:bg-[#25344d]'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>{showFolderDriveEmbed ? 'Collapse Webview' : 'Show Webview'}</span>
                        </button>

                        <a
                          href={activeFolder.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Open in Drive</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                        </a>
                      </>
                    )}

                    {currentUser?.role === 'Admin' && onDeleteFacultyFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          const isConfirmed = window.confirm(
                            `Are you sure you want to delete folder "${activeFolder.name}" and all its uploaded files?`
                          );
                          if (isConfirmed) {
                            onDeleteFacultyFolder(activeFolder.id);
                            setSelectedFolderId(null);
                            showToast(`🗑️ Folder "${activeFolder.name}" deleted from faculty repository.`);
                          }
                        }}
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

              {/* Embedded Google Drive Webview for the Folder */}
              {activeFolder.driveUrl && showFolderDriveEmbed && (
                <div className="animate-fadeIn">
                  <GoogleDriveWebview
                    url={activeFolder.driveUrl}
                    title={`${activeFolder.name} - Google Drive`}
                    subtitle={`Faculty Workspace Folder • ${activeFaculty.name}`}
                    initialHeight={460}
                    allowToggleViewMode={true}
                  />
                </div>
              )}
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
                <div className="text-center py-12 px-4 border-2 border-dashed border-[#24334b] rounded-3xl bg-[#0f1725] space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                    <Folder className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">No Folders Created Yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {activeFaculty.name} has not created any personal folders in their workspace yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeFacultyFolders.map((folder) => {
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

                          <h5 className="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                            {folder.name}
                          </h5>

                          {folder.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {folder.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#24334b] flex items-center justify-between text-xs font-mono text-slate-400">
                          <div className="flex items-center space-x-2">
                            {folder.driveUrl && (
                              <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center space-x-1">
                                <HardDrive className="w-3 h-3 text-emerald-400" />
                                <span>Drive Webview</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {currentUser?.role === 'Admin' && onDeleteFacultyFolder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isConfirmed = window.confirm(
                                    `Delete folder "${folder.name}" and all its files from ${activeFaculty.name}'s repository?`
                                  );
                                  if (isConfirmed) {
                                    onDeleteFacultyFolder(folder.id);
                                    showToast(`🗑️ Folder "${folder.name}" deleted.`);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                title="Delete Folder"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-blue-400 font-bold flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                              <span>Inspect</span>
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
                      {/* Top Surname Badge & Status (Clean uniform typography, no highlighted background) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className={`p-3 rounded-2xl border ${hasFolders ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-[#1c273a] border-[#2d3e57] text-slate-400'} shrink-0`}>
                            <Folder className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h3 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight group-hover:text-blue-400 transition-colors">
                                {surname}
                              </h3>
                            </div>
                            <div className="text-xs text-slate-300 font-semibold truncate max-w-[170px]">
                              {faculty.name}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          hasFolders ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-[#1c273a] text-slate-400 border border-[#2d3e57]'
                        }`}>
                          {hasFolders ? `${folders.length} Folders` : 'Empty'}
                        </span>
                      </div>

                      {/* Faculty Meta Details */}
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

                      {/* Folder Name Previews */}
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

                    {/* Bottom Action */}
                    <div className="pt-3 border-t border-[#24334b] flex items-center justify-end text-xs font-mono">
                      <span className="text-blue-400 font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>Open Folder</span>
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

      {/* DOCUMENT / FOLDER WEBVIEW PREVIEW MODAL FOR ADMIN */}
      {previewWebviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#141c2c] rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-[#24334b] flex flex-col overflow-hidden animate-scaleUp">
            <div className="p-4 bg-[#0f1725] text-white flex items-center justify-between border-b border-[#24334b]">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate font-mono">
                    {previewWebviewModal.title}
                  </h3>
                  {previewWebviewModal.subtitle && (
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {previewWebviewModal.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={previewWebviewModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center space-x-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Drive</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewWebviewModal({ isOpen: false, url: '', title: '', subtitle: '' })
                  }
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1c273a] rounded-xl transition-all cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#0d1524] flex-1 overflow-auto">
              <GoogleDriveWebview
                url={previewWebviewModal.url}
                title={previewWebviewModal.title}
                subtitle={previewWebviewModal.subtitle}
                initialHeight={520}
                allowToggleViewMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
