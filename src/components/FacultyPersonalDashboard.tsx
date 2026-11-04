import React, { useState, useMemo, useEffect } from 'react';
import {
  FacultyFolder,
  FacultyPersonalFile,
  UserProfile,
  SchoolPermanentFolder,
} from '../types';
import {
  getStoredSchoolPermanentFolders,
  getStoredFaculty,
  saveFacultyFileToFirestore,
  getFacultyFileData,
  getStoredTermWeeksConfig,
  getStoredActiveTermId,
  subscribeTermWeeksConfig,
  subscribeActiveTermId,
  TermWeeksConfig,
  syncFacultyDllSubmissionReportOnUpload,
} from '../lib/firebase';
import { FacultyDocumentViewerModal } from './FacultyDocumentViewerModal';
import { GoogleDocsSpreadsheetEditor } from './GoogleDocsSpreadsheetEditor';
import {
  Folder,
  FolderPlus,
  FileText,
  FileSpreadsheet,
  File,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Search,
  ExternalLink,
  Download,
  Check,
  Eye,
  X,
  Layers,
  Calendar,
  FolderOpen,
  FolderLock,
  ChevronRight,
  ShieldCheck,
  User,
  ArrowLeft,
  RefreshCw,
  Lock,
  GraduationCap,
  Clock,
  HardDrive,
  AlertCircle,
  FileCheck2,
  Sparkles,
  BookOpen,
  Award,
} from 'lucide-react';

interface FacultyPersonalDashboardProps {
  currentUser: UserProfile;
  facultyFolders: FacultyFolder[];
  facultyFiles: FacultyPersonalFile[];
  schoolPermanentFolders?: SchoolPermanentFolder[];
  onAddFolder: (folder: Omit<FacultyFolder, 'id' | 'createdAt' | 'updatedAt' | 'itemCount'>) => void;
  onEditFolder: (id: string, updated: Partial<FacultyFolder>) => void;
  onDeleteFolder: (id: string) => void;
  onAddFile: (file: Omit<FacultyPersonalFile, 'id' | 'uploadedAt'>) => void;
  onDeleteFile: (id: string) => void;
  onNavigateToRepository?: () => void;
  onNavigateToAdminDashboard?: () => void;
  onNavigateToSubmissionReport?: () => void;
  activeTermId?: string;
  termWeeksConfig?: TermWeeksConfig;
}

export const FACULTY_FOLDER_CATEGORIES = ['DLL', 'TOS&TQ'] as const;
export type FacultyFolderCategory = (typeof FACULTY_FOLDER_CATEGORIES)[number];

export const GRADE_LEVEL_OPTIONS = ['7', '8', '9', '10', '11', '12'] as const;
export type GradeLevelOption = (typeof GRADE_LEVEL_OPTIONS)[number];

const CATEGORY_OPTIONS = [
  'DLL',
  'TOS&TQ',
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
  { name: 'Emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-600', ring: 'ring-emerald-500' },
  { name: 'Blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', ring: 'ring-blue-500' },
  { name: 'Indigo', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600', ring: 'ring-indigo-500' },
  { name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', ring: 'ring-purple-500' },
  { name: 'Amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-600', ring: 'ring-amber-500' },
  { name: 'Rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-600', ring: 'ring-rose-500' },
];

const ALLOWED_EXTENSIONS = ['pdf'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const FacultyPersonalDashboard: React.FC<FacultyPersonalDashboardProps> = ({
  currentUser,
  facultyFolders,
  facultyFiles,
  schoolPermanentFolders,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  onAddFile,
  onDeleteFile,
  onNavigateToAdminDashboard,
  activeTermId: propActiveTermId,
  termWeeksConfig: propTermWeeksConfig,
}) => {
  // Permanent School-Wide Folders state ("SCHOOL FORMS" and "SCHOOL DOCUMENTS")
  const [livePermanentFolders, setLivePermanentFolders] = useState<SchoolPermanentFolder[]>(() => {
    return schoolPermanentFolders && schoolPermanentFolders.length > 0
      ? schoolPermanentFolders
      : getStoredSchoolPermanentFolders();
  });

  useEffect(() => {
    if (schoolPermanentFolders && schoolPermanentFolders.length > 0) {
      setLivePermanentFolders(schoolPermanentFolders);
    }
  }, [schoolPermanentFolders]);

  // Permanent folders are kept in sync via props from App.tsx without opening duplicate Firestore listeners.

  // Filter STRICTLY for current logged in faculty member
  const userEmail = (currentUser.email || '').toLowerCase().trim();
  const myFolders = useMemo(() => {
    return facultyFolders.filter(
      (f) => (f.facultyEmail || '').toLowerCase().trim() === userEmail
    );
  }, [facultyFolders, userEmail]);

  const myFiles = useMemo(() => {
    return facultyFiles.filter(
      (f) => (f.facultyEmail || '').toLowerCase().trim() === userEmail
    );
  }, [facultyFiles, userEmail]);

  // Resolve advisoryRole from current user profile with fallback to stored cache
  const [liveAdvisoryRole, setLiveAdvisoryRole] = useState<'Class Adviser' | 'Non-Adviser'>(() => {
    const roleClean = (currentUser.advisoryRole || '').toLowerCase().trim();
    if (roleClean === 'class adviser' || roleClean === 'class-adviser' || roleClean === 'adviser') return 'Class Adviser';
    const stored = getStoredFaculty();
    const cleanEmail = (currentUser.email || '').toLowerCase().trim();
    const match = stored.find((f) => (f.email || '').toLowerCase().trim() === cleanEmail);
    if (match?.advisoryRole) return match.advisoryRole;
    const DEMO_ADVISER_EMAILS = [
      'johnvic.garnica@deped.gov.ph',
      'maria.santos@deped.gov.ph',
      'roberto.delacruz@deped.gov.ph',
      'elena.bautista@deped.gov.ph',
    ];
    if (DEMO_ADVISER_EMAILS.includes(cleanEmail)) return 'Class Adviser';
    return 'Non-Adviser';
  });

  useEffect(() => {
    const roleClean = (currentUser.advisoryRole || '').toLowerCase().trim();
    if (roleClean === 'class adviser' || roleClean === 'class-adviser' || roleClean === 'adviser') {
      setLiveAdvisoryRole('Class Adviser');
    }
  }, [currentUser.advisoryRole]);

  // Dynamically resolve whether current faculty user is a Class Adviser
  const isClassAdviser = useMemo(() => {
    const roleClean = (liveAdvisoryRole || currentUser.advisoryRole || '').toLowerCase().trim();
    if (roleClean === 'class adviser' || roleClean === 'class-adviser' || roleClean === 'adviser') return true;
    const desigClean = (currentUser.designation || '').toLowerCase().trim();
    if (desigClean.includes('class adviser') || desigClean.includes('adviser')) return true;
    const DEMO_ADVISER_EMAILS = [
      'johnvic.garnica@deped.gov.ph',
      'maria.santos@deped.gov.ph',
      'roberto.delacruz@deped.gov.ph',
      'elena.bautista@deped.gov.ph',
    ];
    if (DEMO_ADVISER_EMAILS.includes(userEmail)) return true;
    return false;
  }, [liveAdvisoryRole, currentUser.advisoryRole, currentUser.designation, userEmail]);

  const effectiveUser = useMemo<UserProfile>(() => {
    return {
      ...currentUser,
      advisoryRole: isClassAdviser ? 'Class Adviser' : 'Non-Adviser',
    };
  }, [currentUser, isClassAdviser]);

  // Selected Active Folder
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Active Folder Object (Resolves either to permanent school folder or personal faculty folder)
  const activePermanentFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return livePermanentFolders.find((f) => f.id === activeFolderId) || null;
  }, [livePermanentFolders, activeFolderId]);

  const activePersonalFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return myFolders.find((f) => f.id === activeFolderId) || null;
  }, [myFolders, activeFolderId]);

  const isPermanentActive = Boolean(activePermanentFolder);

  const activeFolder = useMemo(() => {
    if (activePermanentFolder) {
      return {
        id: activePermanentFolder.id,
        name: activePermanentFolder.name,
        description: activePermanentFolder.description,
        category: activePermanentFolder.category,
        color: activePermanentFolder.color,
        driveUrl: activePermanentFolder.driveUrl,
        driveId: activePermanentFolder.driveId,
        facultyEmail: 'admin@deped.gov.ph',
        facultyName: 'School Administration',
        facultySurname: 'Admin',
        createdAt: activePermanentFolder.updatedAt,
        updatedAt: activePermanentFolder.updatedAt,
      } as FacultyFolder;
    }
    return activePersonalFolder;
  }, [activePermanentFolder, activePersonalFolder]);

  // Check if current active folder is a DLL folder
  const isDllFolder = useMemo(() => {
    if (!activeFolder) return false;
    const cat = (activeFolder.category || '').toLowerCase();
    const name = (activeFolder.name || '').toLowerCase();
    return cat === 'dll' || cat.includes('daily lesson log') || name.startsWith('dll') || name.includes('dll');
  }, [activeFolder]);

  // Current academic term and weeks count for DLL submissions (reusing parent props to save Firestore reads)
  const [activeTermId, setActiveTermId] = useState<string>(() => propActiveTermId || getStoredActiveTermId());
  const [termWeeksConfig, setTermWeeksConfig] = useState<TermWeeksConfig>(() => propTermWeeksConfig || getStoredTermWeeksConfig());
  const [specifiedWeek, setSpecifiedWeek] = useState<number>(1);

  useEffect(() => {
    if (propActiveTermId) setActiveTermId(propActiveTermId);
  }, [propActiveTermId]);

  useEffect(() => {
    if (propTermWeeksConfig) setTermWeeksConfig(propTermWeeksConfig);
  }, [propTermWeeksConfig]);

  useEffect(() => {
    // Only subscribe directly if parent App.tsx didn't pass configs down
    if (propActiveTermId && propTermWeeksConfig) return;
    const unsubTerm = subscribeActiveTermId((term) => setActiveTermId(term));
    const unsubWeeks = subscribeTermWeeksConfig((cfg) => setTermWeeksConfig(cfg));
    return () => {
      unsubTerm();
      unsubWeeks();
    };
  }, [propActiveTermId, propTermWeeksConfig]);

  const currentTermWeeksCount = useMemo(() => {
    const count = (termWeeksConfig as any)?.[activeTermId];
    return typeof count === 'number' && count >= 1 && count <= 12 ? count : 11;
  }, [termWeeksConfig, activeTermId]);

  // Auto-renamed Document Title for DLL Folders in format: Subject+Grade Level+Week
  const autoDllDocTitle = useMemo(() => {
    if (!activeFolder || !isDllFolder) return '';
    let dllSub = activeFolder.subjectTitle || '';
    let dllGr = activeFolder.gradeLevel || '';

    if (!dllSub || !dllGr) {
      const parts = (activeFolder.name || '').trim().split(' ');
      if (parts.length >= 3 && (parts[0] === 'DLL' || parts[0] === 'TOS&TQ')) {
        const lastPart = parts[parts.length - 1];
        if (GRADE_LEVEL_OPTIONS.includes(lastPart as any)) {
          if (!dllGr) dllGr = lastPart;
          if (!dllSub) dllSub = parts.slice(1, -1).join(' ');
        } else {
          if (!dllSub) dllSub = parts.slice(1).join(' ');
        }
      } else if (parts.length === 2 && parts[0] === 'DLL') {
        if (!dllSub) dllSub = parts[1];
      } else {
        if (!dllSub) dllSub = activeFolder.name;
      }
    }

    const titleCore = `${dllSub} ${dllGr}`.replace(/\s+/g, ' ').trim() || activeFolder.name;
    return `${titleCore} Week ${specifiedWeek}`.replace(/\s+/g, ' ').trim();
  }, [activeFolder, isDllFolder, specifiedWeek]);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Filtered permanent folders
  const filteredPermanentFolders = useMemo(() => {
    return livePermanentFolders.filter((f) => {
      const matchSearch =
        searchTerm === '' ||
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.category && f.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory =
        selectedCategoryFilter === 'all' || f.category === selectedCategoryFilter;
      return matchSearch && matchCategory;
    });
  }, [livePermanentFolders, searchTerm, selectedCategoryFilter]);

  // Filtered personal folders
  const filteredFolders = useMemo(() => {
    return myFolders.filter((folder) => {
      const matchesSearch =
        searchTerm === '' ||
        folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (folder.description && folder.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (folder.subjectTitle && folder.subjectTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (folder.category && folder.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory =
        selectedCategoryFilter === 'all' ||
        folder.category === selectedCategoryFilter ||
        (selectedCategoryFilter === 'DLL' && (folder.category === 'DLL' || folder.name.startsWith('DLL') || folder.category?.includes('DLL'))) ||
        (selectedCategoryFilter === 'TOS&TQ' && (folder.category === 'TOS&TQ' || folder.name.startsWith('TOS&TQ') || folder.category?.includes('TOS')));
      return matchesSearch && matchCategory;
    });
  }, [myFolders, searchTerm, selectedCategoryFilter]);

  // Modals & Document Viewer State
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FacultyFolder | null>(null);
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<FacultyPersonalFile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Spreadsheet Editor state
  const [editingSpreadsheetFile, setEditingSpreadsheetFile] = useState<FacultyPersonalFile | null>(null);
  const [editingSpreadsheetDataUrl, setEditingSpreadsheetDataUrl] = useState<string | null>(null);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState<boolean>(false);

  // In-App Confirmation Modal States (Replacing window.confirm)
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; title: string; fileName: string } | null>(null);

  // Form States - Folder Creation / Editing (FolderCategory + SubjectTitle + Grade Level)
  const [folderCategory, setFolderCategory] = useState<string>('DLL');
  const [subjectTitle, setSubjectTitle] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<string>('7');
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderColor, setFolderColor] = useState('Emerald');

  // Computed Auto-Generated Folder Name in format FolderCategory+SubjectTitle+Grade Level
  const autoFolderName = useMemo(() => {
    const cat = folderCategory || 'DLL';
    const sub = subjectTitle.trim();
    const gr = gradeLevel || '7';
    if (!sub) return `${cat} [Subject Title] ${gr}`;
    return `${cat} ${sub} ${gr}`;
  }, [folderCategory, subjectTitle, gradeLevel]);

  // Form States - Upload File to Folder (Max 2MB)
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [fileCategory, setFileCategory] = useState(CATEGORY_OPTIONS[0]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Files in Active Folder (filtering by folderId)
  const filesInActiveFolder = useMemo(() => {
    if (!activeFolderId) return [];
    if (isPermanentActive) {
      return facultyFiles.filter((f) => f.folderId === activeFolderId);
    }
    return myFiles.filter((f) => f.folderId === activeFolderId);
  }, [facultyFiles, myFiles, activeFolderId, isPermanentActive]);

  const handleOpenNewFolderModal = () => {
    setFolderCategory('DLL');
    setSubjectTitle('');
    setGradeLevel('7');
    setFolderName('');
    setFolderDescription('');
    setFolderColor('Emerald');
    setEditingFolder(null);
    setIsNewFolderModalOpen(true);
  };

  const handleOpenEditFolderModal = (folder: FacultyFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (folder.id === 'school-forms' || folder.id === 'school-documents') {
      showToast('Permanent school-wide folders can only be edited by administrators in the Admin Dashboard.');
      return;
    }
    setEditingFolder(folder);
    const cat = folder.category === 'TOS&TQ' || folder.name.startsWith('TOS&TQ') ? 'TOS&TQ' : 'DLL';
    setFolderCategory(cat);

    let parsedSubject = folder.subjectTitle || '';
    let parsedGrade = folder.gradeLevel || '7';

    if (!parsedSubject) {
      const parts = folder.name.split(' ');
      if (parts.length >= 3 && (parts[0] === 'DLL' || parts[0] === 'TOS&TQ')) {
        const lastPart = parts[parts.length - 1];
        if (GRADE_LEVEL_OPTIONS.includes(lastPart as any)) {
          parsedGrade = lastPart;
          parsedSubject = parts.slice(1, -1).join(' ');
        } else {
          parsedSubject = parts.slice(1).join(' ');
        }
      } else {
        parsedSubject = folder.name;
      }
    }

    setSubjectTitle(parsedSubject);
    setGradeLevel(parsedGrade);
    setFolderName(folder.name);
    setFolderDescription(folder.description || '');
    setFolderColor(folder.color || 'Emerald');
    setIsNewFolderModalOpen(true);
  };

  // Create or Update Folder
  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSubject = subjectTitle.trim();
    if (!cleanSubject) {
      showToast('Please type the Subject Title (e.g. Mathematics, Science, English).');
      return;
    }

    // Automatically create folder name with format of FolderCategory+SubjectTitle+Grade Level
    const finalFolderName = `${folderCategory} ${cleanSubject} ${gradeLevel}`;

    if (editingFolder) {
      if (editingFolder.id === 'school-forms' || editingFolder.id === 'school-documents') {
        showToast('Permanent school-wide folders cannot be edited here.');
        setIsNewFolderModalOpen(false);
        return;
      }
      onEditFolder(editingFolder.id, {
        name: finalFolderName,
        description: folderDescription.trim(),
        category: folderCategory,
        color: folderColor,
        subjectTitle: cleanSubject,
        gradeLevel: gradeLevel,
      });
      showToast(`Folder "${finalFolderName}" updated successfully.`);
    } else {
      onAddFolder({
        facultyEmail: currentUser.email,
        facultyName: currentUser.name,
        facultySurname: '', // Handled in lib/firebase.ts
        name: finalFolderName,
        description: folderDescription.trim(),
        category: folderCategory,
        color: folderColor,
        subjectTitle: cleanSubject,
        gradeLevel: gradeLevel,
      });
      showToast(`Personal folder "${finalFolderName}" created successfully!`);
    }

    setIsNewFolderModalOpen(false);
  };

  // Confirm Folder Deletion
  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;
    onDeleteFolder(folderToDelete.id);
    if (activeFolderId === folderToDelete.id) {
      setActiveFolderId(null);
    }
    showToast(`Folder "${folderToDelete.name}" and all contained documents deleted.`);
    setFolderToDelete(null);
  };

  // Confirm File Deletion
  const handleConfirmDeleteFile = () => {
    if (!fileToDelete) return;
    onDeleteFile(fileToDelete.id);
    if (selectedPreviewFile?.id === fileToDelete.id) {
      setSelectedPreviewFile(null);
    }
    showToast(`File "${fileToDelete.title}" removed from folder.`);
    setFileToDelete(null);
  };

  // Open File Upload Modal
  const handleOpenAddFileModal = (folderId: string) => {
    setActiveFolderId(folderId);
    const targetFolder =
      livePermanentFolders.find((f) => f.id === folderId) ||
      myFolders.find((f) => f.id === folderId) ||
      activeFolder;

    const cat = (targetFolder?.category || '').toLowerCase();
    const name = (targetFolder?.name || '').toLowerCase();
    const isTargetDll = cat === 'dll' || cat.includes('daily lesson log') || name.startsWith('dll') || name.includes('dll');

    if (isTargetDll && targetFolder) {
      const dllCat = targetFolder.category || 'DLL';
      let dllSub = targetFolder.subjectTitle || '';
      let dllGr = targetFolder.gradeLevel || '';

      if (!dllSub || !dllGr) {
        const parts = (targetFolder.name || '').trim().split(' ');
        if (parts.length >= 3 && (parts[0] === 'DLL' || parts[0] === 'TOS&TQ')) {
          const lastPart = parts[parts.length - 1];
          if (GRADE_LEVEL_OPTIONS.includes(lastPart as any)) {
            if (!dllGr) dllGr = lastPart;
            if (!dllSub) dllSub = parts.slice(1, -1).join(' ');
          } else {
            if (!dllSub) dllSub = parts.slice(1).join(' ');
          }
        } else if (parts.length === 2 && parts[0] === 'DLL') {
          if (!dllSub) dllSub = parts[1];
        } else {
          if (!dllSub) dllSub = targetFolder.name;
        }
      }

      const titleCore = `${dllSub} ${dllGr}`.replace(/\s+/g, ' ').trim() || targetFolder.name;
      const autoTitle = `${titleCore} Week 1`.replace(/\s+/g, ' ').trim();
      setFileTitle(autoTitle);
    } else {
      setFileTitle('');
    }
    setFileCategory(targetFolder?.category || CATEGORY_OPTIONS[0]);
    setFileDescription('');
    setSpecifiedWeek(1);
    setAttachedFile(null);
    setUploadError(null);
    setIsAddFileModalOpen(true);
  };

  // Open spreadsheet in interactive Google Docs / Sheets editor
  const handleOpenSpreadsheetEditor = async (file: FacultyPersonalFile) => {
    setIsLoadingSpreadsheet(true);
    try {
      let data = file.fileData;
      if (!data) {
        data = await getFacultyFileData(file);
      }
      setEditingSpreadsheetFile(file);
      setEditingSpreadsheetDataUrl(data || '');
    } catch (err) {
      console.error('Error opening spreadsheet editor:', err);
      showToast('Could not open spreadsheet data.');
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  // Save updated spreadsheet to Firebase
  const handleSaveSpreadsheet = async (updatedFileDoc: FacultyPersonalFile) => {
    try {
      await saveFacultyFileToFirestore(updatedFileDoc);
      showToast(`Spreadsheet "${updatedFileDoc.title}" updated and saved directly to Firebase!`);
    } catch (err) {
      console.error('Error updating spreadsheet in Firebase:', err);
      showToast('Error saving changes to Firebase.');
    }
  };

  // Validate File Selection (Strictly Max 2MB, PDF/XLS/XLSX/DOC/DOCX)
  const handleFileSelection = (selectedFile: File) => {
    setUploadError(null);

    const ext = (selectedFile.name.split('.').pop() || '').toLowerCase();
    const isPermanent = activeFolderId === 'school-forms' || activeFolderId === 'school-documents';

    // Allowed extensions based on folder context: strictly PDF only for personal faculty folders
    const validExts = isPermanent
      ? ['xlsx', 'xls', 'pdf', 'docx', 'doc']
      : ['pdf'];

    if (!validExts.includes(ext)) {
      setUploadError(
        isPermanent
          ? `Invalid file type ".${ext || 'unknown'}". Allowed formats: ${validExts.map((e) => `.${e}`).join(', ')}`
          : 'Only PDF documents (.pdf) are allowed in faculty folders. Please select a PDF file.'
      );
      setAttachedFile(null);
      return;
    }

    // 2. Strict file size validation (maximum 2MB)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setUploadError(
        `File exceeds strict maximum limit of 2MB (Selected file is ${sizeMb} MB). Please choose a file under 2MB.`
      );
      setAttachedFile(null);
      return;
    }

    setAttachedFile(selectedFile);
    if (isDllFolder) {
      setFileTitle(autoDllDocTitle);
    } else if (!fileTitle.trim()) {
      setFileTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Submit File Upload with Base64 Conversion and direct Firebase storage
  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolderId || !attachedFile) {
      setUploadError('Please select a valid file to upload.');
      return;
    }

    const finalTitle = isDllFolder ? autoDllDocTitle : fileTitle.trim();
    if (!finalTitle) {
      setUploadError('Please enter a document title.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Read file into Data URL
      const reader = new FileReader();
      reader.onload = () => {
        const fileDataUrl = reader.result as string;
        const fileSizeBytes = attachedFile.size;
        const sizeMb = fileSizeBytes / (1024 * 1024);
        const fileSizeFormatted =
          sizeMb >= 1
            ? `${sizeMb.toFixed(2)} MB`
            : `${(fileSizeBytes / 1024).toFixed(0)} KB`;
        const ext = (attachedFile.name.split('.').pop() || 'pdf').toLowerCase();

        const finalFileName = attachedFile.name;

        const isPermanent = activeFolderId === 'school-forms' || activeFolderId === 'school-documents';
        // Permanent folders DO NOT auto-expire, personal folders auto-delete after 15 days
        const expiresAt = isPermanent
          ? undefined
          : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

        const filePayload: Omit<FacultyPersonalFile, 'id' | 'uploadedAt'> = {
          folderId: activeFolderId,
          facultyEmail: currentUser.email,
          facultyName: currentUser.name,
          title: finalTitle,
          fileName: finalFileName,
          fileSizeBytes,
          fileSizeFormatted,
          format: ext,
          category: fileCategory,
          expiresAt,
          fileData: fileDataUrl,
          description: isDllFolder ? `Week ${specifiedWeek}` : fileDescription.trim(),
          week: isDllFolder ? specifiedWeek : undefined,
          specifiedWeek: isDllFolder ? specifiedWeek : undefined,
        };

        onAddFile(filePayload);

        // If uploading to a DLL folder, immediately evaluate and sync DLL submission status
        if (isDllFolder) {
          const tempFile: FacultyPersonalFile = {
            ...filePayload,
            id: `ffile-temp-${Date.now()}`,
            uploadedAt: new Date().toISOString(),
          };
          syncFacultyDllSubmissionReportOnUpload(
            currentUser.email,
            [tempFile, ...facultyFiles],
            facultyFolders,
            activeTermId,
            currentUser.name,
            currentUser.department
          ).catch((e) => console.warn('Background DLL submission report sync error:', e));
        }

        setIsUploading(false);
        setIsAddFileModalOpen(false);
        showToast(
          isPermanent
            ? `File "${finalTitle}" successfully saved to School Firebase Repository!`
            : isDllFolder
            ? `DLL Document "${finalTitle}" recorded for Week ${specifiedWeek}! Submission report updated.`
            : `Document "${finalTitle}" uploaded to folder! Auto-deletes after 15 days.`
        );
      };

      reader.onerror = () => {
        setUploadError('Failed to read file from local storage. Please try again.');
        setIsUploading(false);
      };

      reader.readAsDataURL(attachedFile);
    } catch (err) {
      console.error('File upload error:', err);
      setUploadError('Unexpected error during upload.');
      setIsUploading(false);
    }
  };

  // Helper: File Download
  const handleDirectDownload = (file: FacultyPersonalFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.fileData) {
      const a = document.createElement('a');
      a.href = file.fileData;
      a.download = file.fileName || `${file.title}.${file.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setSelectedPreviewFile(file);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 text-xs font-mono animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Faculty Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl px-5 py-3.5 sm:px-6 sm:py-4 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Layers className="w-56 h-56 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="bg-white/15 backdrop-blur-md text-blue-100 text-[10px] sm:text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-white/20 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Personal Faculty Workspace</span>
              </span>
              <span className="text-blue-200 text-[11px] sm:text-xs font-mono font-semibold">
                Unique Firebase Storage
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans text-white">
              Welcome, {currentUser.name}
            </h1>
            <p className="text-blue-100 text-xs font-medium max-w-2xl leading-normal">
              Your personalized repository for Daily Lesson Logs (DLL), Table of Specifications (TOS), Test Questions, and class instructional materials. Upload PDF documents (.pdf up to 2MB).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenNewFolderModal}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer hover:scale-[1.02] active:scale-95 border border-emerald-400/50"
            >
              <FolderPlus className="w-4 h-4 text-white" />
              <span>+ Create Personal Folder</span>
            </button>
          </div>
        </div>

        {/* Quick Workspace Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs font-mono">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <div className="text-blue-200 text-[11px]">School Permanent Folders</div>
            <div className="text-xl font-bold text-white mt-0.5">{livePermanentFolders.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <div className="text-blue-200 text-[11px]">Personal Folders</div>
            <div className="text-xl font-bold text-white mt-0.5">{myFolders.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <div className="text-blue-200 text-[11px]">Uploaded Documents</div>
            <div className="text-xl font-bold text-white mt-0.5">{myFiles.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <div className="text-blue-200 text-[11px]">Retention Policy</div>
            <div className="text-xs font-bold text-amber-300 mt-1 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>15-Day Auto-Delete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Header Bar */}
      <div className="bg-[#141c2c] p-3 rounded-2xl border border-[#24334b] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2.5 px-3 py-1 text-sm font-mono font-bold text-white">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>My Folders & Workspace</span>
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-mono ml-1 border border-slate-700">
              {myFolders.length + livePermanentFolders.length} folders
            </span>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 px-3 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Storage linked to Firebase Database</span>
        </div>
      </div>

      {/* Main Workspace Navigation & Active Folder View */}
      {activeFolder ? (
        /* INSIDE ACTIVE FOLDER VIEW */
        <div className="bg-[#0f1725] border border-[#24334b] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#24334b] pb-5">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setActiveFolderId(null);
                }}
                className="p-2.5 bg-[#172236] hover:bg-[#20304c] text-slate-200 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold font-mono cursor-pointer border border-[#2d3e57]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Folders</span>
              </button>

              <div className="h-5 w-px bg-[#24334b]" />

              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl ${
                    isPermanentActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {isPermanentActive ? <FolderLock className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                      {activeFolder.name}
                    </h2>

                    {isPermanentActive && (
                      <span className="bg-indigo-600 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>Permanent</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5">
                    <span className="bg-[#172236] px-2 py-0.5 rounded-md font-semibold text-slate-300 border border-[#24334b]">
                      {activeFolder.category || 'General'}
                    </span>
                    <span>•</span>
                    {isPermanentActive ? (
                      <span className="text-emerald-400 font-bold flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Firebase Cloud Storage (Permanent Repository • Max 2MB)</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold">Firebase Cloud Storage (Max 2MB)</span>
                    )}
                    <span>•</span>
                    <span>{filesInActiveFolder.length} documents uploaded</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isPermanentActive ? (
                <button
                  type="button"
                  onClick={() => handleOpenAddFileModal(activeFolder.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {activeFolder.id === 'school-forms'
                      ? '+ Upload School Form (Max 2MB)'
                      : '+ Upload School Document (Max 2MB)'}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenAddFileModal(activeFolder.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Document (Max 2MB)</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleOpenEditFolderModal(activeFolder, e)}
                    className="p-2 bg-[#172236] hover:bg-[#20304c] text-slate-300 rounded-xl transition-all cursor-pointer border border-[#2d3e57]"
                    title="Edit Folder Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFolderToDelete({ id: activeFolder.id, name: activeFolder.name })
                    }
                    className="p-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-xl transition-all cursor-pointer border border-rose-500/30"
                    title="Delete Folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Folder Description */}
          {activeFolder.description && (
            <p className="text-xs sm:text-sm text-slate-300 bg-[#141c2c] p-4 rounded-2xl border border-[#24334b] font-medium leading-relaxed font-sans">
              <span className="font-bold text-slate-100">Folder Notes: </span>
              {activeFolder.description}
            </p>
          )}

          {/* 1-WEEK RETENTION INFO BANNER FOR PERSONAL WORKSPACE ONLY */}
          {!isPermanentActive && (
            <div className="bg-[#141c2c] border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-300">
                    Automatic 15-Day File Deletion Policy
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Uploaded personal files are automatically cleaned up 15 days after upload to preserve storage space. School permanent forms and documents remain permanently.
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl shrink-0">
                ✓ Unique Firebase File Storage Active
              </div>
            </div>
          )}

          {/* FIREBASE CLOUD STORAGE PERMANENT REPOSITORY BANNER */}
          {isPermanentActive && (
            <div className="bg-[#111928] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                      <span>Firebase Cloud Storage Central Repository</span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] normal-case font-bold">
                        Permanent • Max 2MB
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                      All files and forms in this folder are stored permanently in Firebase Cloud Storage. No external Google Drive links.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddFileModal(activeFolder.id)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload to Firebase (Max 2MB)</span>
                </button>
              </div>
            </div>
          )}

          {/* FIREBASE FILE STORAGE SECTION: DOCUMENT PREVIEWS & LIST */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <span>
                  Documents Inside "{activeFolder.name}"
                </span>
                <span className="bg-[#172236] text-blue-300 border border-[#2d3e57] px-2 py-0.5 rounded-full text-[10px]">
                  {filesInActiveFolder.length} files
                </span>
              </h3>

              <button
                type="button"
                onClick={() => handleOpenAddFileModal(activeFolder.id)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Document</span>
              </button>
            </div>

            {filesInActiveFolder.length === 0 ? (
              /* Empty State in Folder */
              <div className="bg-[#141c2c] border-2 border-dashed border-[#24334b] rounded-3xl p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 mx-auto flex items-center justify-center shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-100">
                    No Files in this Folder Yet
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    Upload your documents and forms with a maximum size of 2MB. Files are saved directly to the Firebase database with no external Google Drive links required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddFileModal(activeFolder.id)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-mono font-bold rounded-2xl transition-all shadow-sm inline-flex items-center space-x-2 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Document (Max 2MB)</span>
                </button>
              </div>
            ) : (
              /* GRID OF FILE PREVIEW CARDS */
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
                    themeBorder = 'border-emerald-500/40 hover:border-emerald-500/80 bg-emerald-950/20';
                    badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    typeLabel = 'EXCEL';
                    iconComp = <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
                  } else if (isPpt) {
                    themeBorder = 'border-amber-500/30 hover:border-amber-500/70';
                    badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                    typeLabel = 'POWERPOINT';
                    iconComp = <FileText className="w-5 h-5 text-amber-400" />;
                  }

                  // Auto delete diff calculation
                  const now = Date.now();
                  const expireMs = file.expiresAt
                    ? new Date(file.expiresAt).getTime()
                    : new Date(file.uploadedAt).getTime() + 15 * 24 * 60 * 60 * 1000;
                  const diffDays = Math.max(0, Math.ceil((expireMs - now) / (24 * 60 * 60 * 1000)));

                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        if (isSheet) {
                          handleOpenSpreadsheetEditor(file);
                        } else {
                          setSelectedPreviewFile(file);
                        }
                      }}
                      className={`bg-[#141c2c] border-2 ${themeBorder} rounded-3xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 group hover:-translate-y-0.5 relative overflow-hidden`}
                    >
                      {/* AUTOMATIC VISUAL PREVIEW THUMBNAIL BOX */}
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

                        {/* Visual Representation of Document Content Inside Thumbnail */}
                        <div className="flex-1 flex flex-col justify-center items-center py-2 space-y-1 text-center">
                          <div className="p-2 rounded-xl bg-[#141c2c] border border-[#24334b] shadow-inner group-hover:scale-110 transition-transform">
                            {iconComp}
                          </div>
                          <div className="text-xs font-bold text-slate-200 line-clamp-1 px-2 font-sans">
                            {file.title}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">
                            {file.fileName}
                          </div>
                        </div>

                        {/* Quick Click-to-View Overlay Hint */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#1c273a] text-[10px] font-mono text-slate-400">
                          {isSheet ? (
                            <span className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:text-emerald-300">
                              <Edit2 className="w-3 h-3" />
                              <span>Click to Edit Spreadsheet</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-blue-400 font-bold group-hover:text-blue-300">
                              <Eye className="w-3 h-3" />
                              <span>Click to Preview</span>
                            </span>
                          )}
                          <span className="text-slate-500">{file.uploadedAt ? file.uploadedAt.substring(0, 10) : ''}</span>
                        </div>
                      </div>

                      {/* File Details & Badges */}
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                            {file.title}
                          </h4>
                        </div>

                        {/* SF 2 Grade Level & Section Badge */}
                        {(file.gradeLevel || file.section) && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                              🎓 {file.gradeLevel || 'Grade'} - {file.section || 'General'}
                            </span>
                          </div>
                        )}

                        {/* Master Teacher Comment Indicator for Faculty */}
                        {(file.masterTeacherComment || (file.masterTeacherComments && file.masterTeacherComments.length > 0)) && (
                          <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-xl p-2 space-y-1">
                            <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-[10px] font-mono">
                              <Award className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Master Teacher Feedback Attached</span>
                            </div>
                            <p className="text-[11px] text-slate-200 line-clamp-1 italic font-sans pl-1">
                              "{file.masterTeacherComment || file.masterTeacherComments?.[0]?.comment}"
                            </p>
                          </div>
                        )}

                        {/* Author info for school permanent folders */}
                        {isPermanentActive ? (
                          <div className="text-[10px] font-mono text-slate-400 flex items-center space-x-1 pt-0.5">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Uploaded by: {file.facultyName || 'School Faculty'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-amber-300/90 pt-0.5">
                            <Clock className="w-3 h-3 shrink-0 text-amber-400" />
                            <span>Auto-deletes in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div
                        className="pt-2 border-t border-[#24334b] flex items-center justify-between text-xs font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isSheet ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSpreadsheetEditor(file)}
                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-all border border-emerald-500/30"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Edit in App</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewFile(file)}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        )}

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => handleDirectDownload(file, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c273a] rounded-lg transition-all"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setFileToDelete({ id: file.id, title: file.title, fileName: file.fileName })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
        /* FOLDERS OVERVIEW LIST & GRID */
        <div className="space-y-6">
          {/* Controls Bar: Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141c2c] p-4 rounded-2xl border border-[#24334b] shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search your personal folders by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#101a2c] transition-all"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-[#0d1524] border border-[#24334b] rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Categories ({myFolders.length})</option>
                <option value="DLL">DLL (Daily Lesson Log)</option>
                <option value="TOS&TQ">TOS&TQ (Table of Specifications & Exam)</option>
                {CATEGORY_OPTIONS.filter((c) => c !== 'DLL' && c !== 'TOS&TQ').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION 1: PERMANENT SCHOOL-WIDE FOLDERS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#24334b] pb-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
                  <FolderLock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                    <span>School Permanent Folders</span>
                    <span className="bg-indigo-600 text-white text-[10px] font-mono px-2 py-0.2 rounded-full font-bold">
                      Central School Directory
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Official central folders managed centrally by school administrators.
                  </p>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 hidden sm:block">
                {filteredPermanentFolders.length} Central Folders
              </div>
            </div>

            {filteredPermanentFolders.length === 0 ? (
              <div className="bg-[#141c2c] border border-[#24334b] rounded-2xl p-4 text-center text-xs font-mono text-slate-400">
                No permanent school folders match "{searchTerm}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPermanentFolders.map((permFolder) => {
                  const isForms = permFolder.id === 'school-forms';
                  const isDocs = permFolder.id === 'school-documents';

                  return (
                    <div
                      key={permFolder.id}
                      onClick={() => setActiveFolderId(permFolder.id)}
                      className="bg-gradient-to-br from-[#141c2c] to-[#172236] hover:border-indigo-500/70 border-2 border-[#24334b] rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group hover:-translate-y-0.5 relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-3">
                            <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-xs shrink-0">
                              {isForms ? (
                                <FileSpreadsheet className="w-6 h-6" />
                              ) : isDocs ? (
                                <FileText className="w-6 h-6" />
                              ) : (
                                <FolderLock className="w-6 h-6" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
                                  {permFolder.category}
                                </span>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#0d1524] text-slate-300 border border-[#24334b] flex items-center space-x-1">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>{permFolder.isPermanent ? 'Permanent' : 'School Folder'}</span>
                                </span>
                              </div>
                              <h3 className="font-extrabold text-base sm:text-lg text-slate-100 group-hover:text-blue-400 transition-colors mt-1 font-sans">
                                {permFolder.name}
                              </h3>
                            </div>
                          </div>

                          <div
                            className="p-1.5 text-slate-400 bg-[#0d1524] rounded-xl border border-[#24334b] shadow-2xs"
                            title="School Central Folder"
                          >
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-sans">
                          {permFolder.description || 'Central department repository folder.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#24334b] flex items-center justify-between text-xs font-mono">
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Official Central Folder</span>
                        </span>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-1.5 py-0.5 rounded font-mono font-medium">
                            Firebase Storage • 2MB Max
                          </span>
                          <div className="flex items-center space-x-1 text-[11px] font-bold text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1 transition-transform">
                            <span>Open Folder</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: PERSONAL FACULTY FOLDERS */}
          <div className="space-y-4 pt-4 border-t border-[#24334b]">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                    Personal Faculty Folders ({myFolders.length})
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Unique Firebase file storage for DLL, TOS, TQ, and instructional materials (PDF only, Max 2MB per document, 15-day auto-delete).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenNewFolderModal}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Folder</span>
              </button>
            </div>

            {/* Folders Grid / Empty State */}
            {myFolders.length === 0 ? (
              <div className="bg-[#141c2c] border-2 border-dashed border-[#24334b] rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 mx-auto flex items-center justify-center shadow-inner">
                  <FolderPlus className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-100">No Personal Folders Created Yet</h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    Create personal folders to organize your Daily Lesson Logs (DLL), Table of Specifications (TOS), and personal teaching materials with unique Firebase file storage and automatic previews.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewFolderModal}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-mono font-bold rounded-2xl transition-all shadow-sm inline-flex items-center space-x-2 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <FolderPlus className="w-4 h-4 text-white" />
                  <span>+ Create Personal Folder</span>
                </button>
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-8 text-center text-xs font-mono text-slate-400 space-y-2">
                <p>No personal folders match your search query: "{searchTerm}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategoryFilter('all');
                  }}
                  className="text-blue-400 hover:underline font-bold"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFolders.map((folder) => {
                  const filesCount = myFiles.filter((f) => f.folderId === folder.id).length;
                  const theme = COLOR_THEMES.find((t) => t.name === folder.color) || COLOR_THEMES[0];

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      className="bg-[#141c2c] border border-[#24334b] hover:border-blue-500/70 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group hover:-translate-y-0.5 relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        {/* Top Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-2xl ${theme.bg} ${theme.border} border ${theme.icon} shrink-0`}>
                              <Folder className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#0d1524] text-slate-300 border border-[#24334b] rounded-md">
                                {folder.category || 'General'}
                              </span>
                              <h3 className="font-bold text-sm sm:text-base text-slate-100 line-clamp-1 group-hover:text-blue-400 transition-colors mt-1 font-sans">
                                {folder.name}
                              </h3>
                            </div>
                          </div>

                          {/* Quick Folder Controls */}
                          <div
                            className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditFolderModal(folder, e)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c273a] rounded-lg transition-all"
                              title="Edit folder"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFolderToDelete({ id: folder.id, name: folder.name })}
                              className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-all"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {folder.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                            {folder.description}
                          </p>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="pt-3 border-t border-[#24334b] flex items-center justify-between text-xs font-mono text-slate-400">
                        <span className="text-[11px] text-blue-300 font-bold bg-[#0d1524] px-2 py-0.5 rounded-md border border-[#24334b]">
                          {filesCount} {filesCount === 1 ? 'file' : 'files'}
                        </span>

                        <div className="flex items-center space-x-1 text-[11px] font-bold text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1 transition-transform">
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT FOLDER MODAL (NO GOOGLE DRIVE FIELD) */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-[#121c30] rounded-3xl border border-[#24334b] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scaleUp text-slate-100">
            <div className="flex items-center justify-between border-b border-[#24334b] p-5 sm:p-6 pb-4 shrink-0 bg-[#141c2c]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/40">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingFolder ? 'Edit Personal Folder' : 'Create New Personal Folder'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Owner: {currentUser.name} • Unique Storage
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer hover:bg-[#1a2638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFolder} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-700">
                {/* 1. FIRST OPTION: FOLDER CATEGORY (options: "DLL" or "TOS&TQ") */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>Folder Category *</span>
                    </label>
                    <span className="text-[10px] text-blue-400 font-mono">Options: DLL or TOS&TQ</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFolderCategory('DLL')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        folderCategory === 'DLL'
                          ? 'bg-blue-600/25 border-blue-500 text-white ring-2 ring-blue-500/50 shadow-md'
                          : 'bg-[#0d1524] border-[#24334b] text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono tracking-wide">DLL</span>
                        {folderCategory === 'DLL' && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans mt-1">Daily Lesson Log</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFolderCategory('TOS&TQ')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        folderCategory === 'TOS&TQ'
                          ? 'bg-indigo-600/25 border-indigo-500 text-white ring-2 ring-indigo-500/50 shadow-md'
                          : 'bg-[#0d1524] border-[#24334b] text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono tracking-wide">TOS&TQ</span>
                        {folderCategory === 'TOS&TQ' && (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans mt-1">Table of Specs & Exam</span>
                    </button>
                  </div>
                </div>

                {/* 2. NEXT OPTION: SUBJECT TITLE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Subject Title *</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Type Subject</span>
                  </div>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g., Mathematics, English, Science, General Mathematics..."
                      value={subjectTitle}
                      onChange={(e) => setSubjectTitle(e.target.value)}
                      className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all font-sans"
                    />
                  </div>
                </div>

                {/* 3. NEXT OPTION: GRADE LEVEL (options: 7, 8, 9, 10, 11, 12) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                      <span>Grade Level *</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono">Select: 7 to 12</span>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {GRADE_LEVEL_OPTIONS.map((g) => {
                      const isSelected = gradeLevel === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGradeLevel(g)}
                          className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer font-mono font-bold text-xs flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/50 shadow-md scale-105'
                              : 'bg-[#0d1524] border-[#24334b] text-slate-400 hover:text-white hover:border-slate-600'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-sans opacity-70">Grade</span>
                          <span className="text-sm font-extrabold">{g}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. AUTOMATICALLY CREATED FOLDER NAME (FolderCategory + SubjectTitle + Grade Level) */}
                <div className="bg-[#0b121e] border-2 border-blue-500/40 rounded-2xl p-4 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Automatically Created Folder Name</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
                      Format: Category + Subject + Grade
                    </span>
                  </div>

                  <div className="flex items-center space-x-2.5 bg-[#090e18] border border-[#24334b] rounded-xl px-3.5 py-2.5">
                    <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-bold font-mono text-white tracking-wide truncate">
                      {subjectTitle.trim()
                        ? `${folderCategory} ${subjectTitle.trim()} ${gradeLevel}`
                        : `${folderCategory} [Type Subject Title Above] ${gradeLevel}`}
                    </span>
                  </div>

                  <p className="text-[11px] font-sans text-slate-400 leading-normal">
                    The folder will be saved directly to your workspace with this automatically structured name.
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Description / Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe what materials will be stored here..."
                    value={folderDescription}
                    onChange={(e) => setFolderDescription(e.target.value)}
                    className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans"
                  />
                </div>

                {/* Color Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Folder Theme Color
                  </label>
                  <div className="flex items-center space-x-2">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.name}
                        type="button"
                        onClick={() => setFolderColor(theme.name)}
                        className={`w-7 h-7 rounded-xl ${theme.bg} ${theme.border} border-2 transition-all flex items-center justify-center cursor-pointer ${
                          folderColor === theme.name ? 'ring-2 ' + theme.ring + ' scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={theme.name}
                      >
                        {folderColor === theme.name && <Check className="w-3.5 h-3.5 text-slate-800" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="shrink-0 flex items-center justify-end space-x-3 px-6 py-4 border-t border-[#24334b] bg-[#101726]">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-4 py-2 bg-[#172236] hover:bg-[#20304c] text-slate-300 rounded-xl font-bold transition-all cursor-pointer font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer font-mono text-xs"
                >
                  {editingFolder ? 'Save Changes' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD FILE MODAL (MAX 2MB, PDF/XLS/XLSX) - SMOOTHLY SCROLLABLE DIALOG */}
      {isAddFileModalOpen && activeFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-[#111927] rounded-3xl border border-[#24334b] shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scaleUp text-slate-100">
            {/* Fixed Header */}
            <div className="flex items-center justify-between border-b border-[#24334b] px-6 py-4 shrink-0 bg-[#141e30]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                    Upload to "{activeFolder.name}"
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Firebase Cloud Storage • Max 2MB Limit • Direct App Editing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddFileModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer hover:bg-[#1f2b3e]"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleFileSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-700">
                {uploadError && (
                  <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center space-x-2.5 text-xs font-mono text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Document Title (Auto-renamed to "Subject+Grade Level+Week" & uneditable for DLL folders) */}
                {isDllFolder ? (
                  <div className="space-y-1.5 bg-[#090f1a] border-2 border-emerald-500/40 p-4 rounded-2xl shadow-inner">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Document Title (Auto-Renamed)</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/40 flex items-center space-x-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Uneditable by Faculty</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <input
                        type="text"
                        readOnly
                        value={autoDllDocTitle}
                        className="w-full bg-transparent text-xs text-emerald-200 font-mono font-bold focus:outline-none cursor-not-allowed select-all"
                        title="Document title is auto-renamed to 'Subject+Grade Level+Week' and uneditable by faculty."
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                      <span className="text-emerald-400 font-bold">Format: Subject+Grade Level+Week</span>
                      <span className="text-slate-300 font-semibold">{autoDllDocTitle}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Q1 Learner Portfolio or School Form Report"
                      value={fileTitle}
                      onChange={(e) => setFileTitle(e.target.value)}
                      className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans"
                    />
                  </div>
                )}

                {/* File Picker with 2MB validation and drag & drop */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block flex items-center justify-between">
                    <span>
                      {isPermanentActive
                        ? 'Select File (.xlsx, .xls, .pdf, .docx, .doc) *'
                        : 'Select PDF Document (.pdf only) *'}
                    </span>
                    <span className="text-emerald-400 font-bold">Strict 2MB Limit</span>
                  </label>
                  <div className="border-2 border-dashed border-[#24334b] hover:border-emerald-500/60 rounded-2xl p-5 text-center bg-[#0d1524] transition-all relative">
                    <input
                      type="file"
                      required
                      accept={
                        isPermanentActive
                          ? '.xlsx,.xls,.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                          : '.pdf,application/pdf'
                      }
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelection(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <div className="p-2.5 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/30">
                        <Upload className="w-5 h-5" />
                      </div>
                      {attachedFile ? (
                        <div className="space-y-1">
                          <p className="font-bold text-emerald-400 text-xs">
                            ✓ Selected File: {attachedFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Size: {(attachedFile.size / (1024 * 1024)).toFixed(2)} MB • Strictly under 2MB limit
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-slate-300 font-bold text-xs">
                            {isPermanentActive
                              ? 'Click to select or drag and drop spreadsheet / document'
                              : 'Click to select or drag and drop PDF document'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {isPermanentActive
                              ? 'Allowed: .xlsx, .xls, .pdf, .docx, .doc • Maximum size 2.0 MB'
                              : 'Allowed: PDF (.pdf) only • Maximum size 2.0 MB'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Material Category */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Classification
                  </label>
                  <select
                    value={fileCategory}
                    onChange={(e) => setFileCategory(e.target.value)}
                    className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specify Week for DLL folders, or Notes / Remarks for other folders */}
                {isDllFolder ? (
                  <div className="space-y-2 bg-[#0a1120] border border-blue-500/40 p-3.5 rounded-2xl shadow-inner">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        <span>Specify Week</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/40">
                        {activeTermId === 'term-1' ? '1st Term' : activeTermId === 'term-2' ? '2nd Term' : '3rd Term'} ({currentTermWeeksCount} Weeks)
                      </span>
                    </div>

                    <select
                      value={specifiedWeek}
                      onChange={(e) => setSpecifiedWeek(Number(e.target.value))}
                      className="w-full bg-[#111b2e] border border-blue-500/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer font-sans font-bold"
                    >
                      {Array.from({ length: currentTermWeeksCount }, (_, i) => i + 1).map((w) => (
                        <option key={w} value={w} className="bg-[#0d1524] text-white">
                          Week {w}
                        </option>
                      ))}
                    </select>

                    <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                      💡 When all your workspace DLL folders have an uploaded document for <strong>Week {specifiedWeek}</strong>, your status will be marked as <strong className="text-emerald-400">"Submitted"</strong> in the submission report. If one or more DLL folders are not uploaded, it will be marked <strong className="text-rose-400">"Incomplete"</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Notes / Remarks (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional notes or remarks regarding this upload..."
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      className="w-full bg-[#0d1524] border border-[#24334b] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans"
                    />
                  </div>
                )}

                {/* Storage & Expiration Information Notice */}
                {isPermanentActive ? (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300/90 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Permanent School Repository: Files uploaded here remain permanently in Firebase and do not auto-delete.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300/90 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Personal Workspace Retention: Document will be automatically cleaned up after 15 days.</span>
                  </div>
                )}
              </div>

              {/* Fixed Action Footer */}
              <div className="shrink-0 flex items-center justify-between border-t border-[#24334b] px-6 py-4 bg-[#0e1625]">
                <div className="text-[11px] text-slate-400 font-mono">
                  {attachedFile ? (
                    <span className="text-emerald-400 font-bold">
                      {(attachedFile.size / (1024 * 1024)).toFixed(2)} MB / 2.0 MB Max
                    </span>
                  ) : (
                    <span>Max limit: 2.0 MB • Firebase Direct Storage</span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddFileModalOpen(false)}
                    className="px-4 py-2 bg-[#172236] hover:bg-[#20304c] text-slate-300 rounded-xl font-bold transition-all cursor-pointer font-mono text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !attachedFile}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer flex items-center space-x-1.5 font-mono text-xs"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading to Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload to Firebase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM FOLDER DELETION MODAL (NO window.confirm) */}
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
              Are you sure you want to delete folder <span className="font-bold text-white">"{folderToDelete.name}"</span> and all documents uploaded inside it? This will remove the folder and files permanently from the Firebase database.
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

      {/* IN-APP CONFIRM FILE DELETION MODAL (NO window.confirm) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121c30] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Delete Document?</h4>
                <p className="text-xs text-slate-400 font-mono">Immediate Removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-white">"{fileToDelete.title}"</span> ({fileToDelete.fileName}) from this folder?
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
                <span>Yes, Remove File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL INTERACTIVE DOCUMENT PREVIEW MODAL */}
      <FacultyDocumentViewerModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onDeleteFile={(id) => {
          onDeleteFile(id);
          showToast('Document deleted.');
        }}
        canDelete={true}
        currentUser={currentUser}
        onCommentSaved={(updated) => {
          setSelectedPreviewFile(updated);
        }}
        onOpenSpreadsheetEditor={(file, dataUrl) => {
          setSelectedPreviewFile(null);
          setEditingSpreadsheetFile(file);
          setEditingSpreadsheetDataUrl(dataUrl || file.fileData || '');
        }}
      />

      {/* FULL IN-APP GOOGLE DOCS / SHEETS SPREADSHEET EDITOR */}
      {editingSpreadsheetFile && (
        <GoogleDocsSpreadsheetEditor
          file={editingSpreadsheetFile}
          fileDataUrl={editingSpreadsheetDataUrl || ''}
          onClose={() => {
            setEditingSpreadsheetFile(null);
            setEditingSpreadsheetDataUrl(null);
          }}
          onSaveFile={handleSaveSpreadsheet}
          readOnly={false}
        />
      )}
    </div>
  );
};
