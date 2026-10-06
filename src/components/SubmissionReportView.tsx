import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, FacultyFolder } from '../types';
import {
  subscribeFaculty,
  getStoredFaculty,
  subscribeFacultySubmissions,
  saveFacultySubmissionToFirestore,
  batchSaveFacultySubmissionsToFirestore,
  saveWeekDataToFirestore,
  getStoredFacultySubmissions,
  getStoredFacultyStatuses,
  getStoredFacultyComments,
  saveFacultyStatusesToLocalStorage,
  saveFacultyCommentsToLocalStorage,
  extractFacultySurname,
  FacultyDoc,
  SubmissionCategory,
  ItemSubmissionStatus,
  TermWeeksConfig,
  DEFAULT_TERM_WEEKS_CONFIG,
  MAX_TERM_WEEKS,
  MIN_TERM_WEEKS,
  getStoredTermWeeksConfig,
  saveTermWeeksConfigToFirestore,
  subscribeTermWeeksConfig,
  getStoredActiveTermId,
  saveActiveTermIdToFirestore,
  subscribeActiveTermId,
  ClassAdviserSchoolFormsRecord,
  saveClassAdviserFormCheckboxToFirestore,
  batchSaveClassAdviserSchoolFormsToFirestore,
  subscribeClassAdviserSchoolForms,
  getStoredClassAdviserSchoolForms,
} from '../lib/firebase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  FileCheck2,
  CheckSquare,
  Square,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  BarChart3,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Building2,
  Check,
  Copy,
  Layers,
  Save,
  Cloud,
  ShieldCheck,
  Eye,
  Lock,
  FileText,
  HelpCircle,
  TrendingUp,
  PieChart as PieChartIcon,
  SlidersHorizontal,
  Plus,
  Minus,
  X,
  CalendarDays,
  Settings,
  Star,
  BookmarkCheck,
  LogOut,
  ArrowLeft,
  MessageSquare,
  Info,
  GraduationCap,
  CheckCheck,
} from 'lucide-react';

interface SubmissionReportViewProps {
  currentUser: UserProfile;
  facultyFolders?: FacultyFolder[];
  initialCategory?: SubmissionCategoryTab;
}

export interface TermDefinition {
  id: string;
  name: string;
  description: string;
  weeks?: number;
}

export const BASE_TERMS: TermDefinition[] = [
  { id: 'term-1', name: '1st Term', description: 'Weeks 1 to 11' },
  { id: 'term-2', name: '2nd Term', description: 'Weeks 1 to 11' },
  { id: 'term-3', name: '3rd Term', description: 'Weeks 1 to 11' },
];

export type SubmissionCategoryTab = SubmissionCategory | 'class-advisers';

export interface CategoryDefinition {
  id: SubmissionCategoryTab;
  name: string;
  fullName: string;
  shortDescription: string;
  icon: string;
  badgeColor: string;
  activeBg: string;
  borderColor: string;
  itemType: 'weekly' | 'terms' | 'school-forms';
}

// Section 1 Columns: SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10
export const STANDARD_SF_COLUMNS = [
  { key: 'sf1' as const, label: 'SF 1', name: 'School Register', desc: 'Master list of enrolled learners per section' },
  { key: 'sf3' as const, label: 'SF 3', name: 'Books Issued & Returned', desc: 'Textbook and instructional material inventory' },
  { key: 'sf4' as const, label: 'SF 4', name: "Learner's Movement", desc: 'Monthly summary of learner transfers and dropouts' },
  { key: 'sf5' as const, label: 'SF 5', name: 'Report on Promotion', desc: 'Promotion, retained, and conditional learner grades' },
  { key: 'sf6' as const, label: 'SF 6', name: 'Summarized Promotion', desc: 'Consolidated promotion report per track and strand' },
  { key: 'sf8' as const, label: 'SF 8', name: 'Health & Nutrition', desc: 'Learner BMI, nutritional status, and health summary' },
  { key: 'sf10' as const, label: 'SF 10', name: 'Permanent Academic Record', desc: 'Official learner Form 137 / transcript permanent file' },
] as const;

// Section 2 Columns: SF 2 Monthly Checklist (June to April)
export const SF2_MONTH_COLUMNS = [
  { key: 'sf2_june' as const, label: 'JUNE', fullMonth: 'June Attendance' },
  { key: 'sf2_july' as const, label: 'JULY', fullMonth: 'July Attendance' },
  { key: 'sf2_august' as const, label: 'AUGUST', fullMonth: 'August Attendance' },
  { key: 'sf2_september' as const, label: 'SEPTEMBER', fullMonth: 'September Attendance' },
  { key: 'sf2_october' as const, label: 'OCTOBER', fullMonth: 'October Attendance' },
  { key: 'sf2_november' as const, label: 'NOVEMBER', fullMonth: 'November Attendance' },
  { key: 'sf2_december' as const, label: 'DECEMBER', fullMonth: 'December Attendance' },
  { key: 'sf2_january' as const, label: 'JANUARY', fullMonth: 'January Attendance' },
  { key: 'sf2_february' as const, label: 'FEBRUARY', fullMonth: 'February Attendance' },
  { key: 'sf2_march' as const, label: 'MARCH', fullMonth: 'March Attendance' },
  { key: 'sf2_april' as const, label: 'APRIL', fullMonth: 'April Attendance' },
] as const;

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'class-advisers',
    name: 'Class Advisers',
    fullName: 'Class Adviser School Forms (SF 1-10 & SF 2 Monthly)',
    shortDescription: 'Section 1: SF 1, 3, 4, 5, 6, 8, 10 & Section 2: SF 2 Monthly Attendance (June-April)',
    icon: '🎓',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeBg: 'bg-emerald-600 text-white',
    borderColor: 'border-emerald-500',
    itemType: 'school-forms',
  },
  {
    id: 'dll',
    name: 'DLL',
    fullName: 'Daily Lesson Log',
    shortDescription: 'Weekly instructional lesson logs and teaching deliverables per term',
    icon: '📝',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    activeBg: 'bg-blue-600 text-white',
    borderColor: 'border-blue-500',
    itemType: 'weekly',
  },
  {
    id: 'tos',
    name: 'TOS',
    fullName: 'Table of Specifications',
    shortDescription: 'Assessment blueprints & competency matrices for Term 1 TOS, Term 2 TOS, and Term 3 TOS',
    icon: '📊',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    activeBg: 'bg-purple-600 text-white',
    borderColor: 'border-purple-500',
    itemType: 'terms',
  },
  {
    id: 'tq',
    name: 'TQ',
    fullName: 'Test Questions',
    shortDescription: 'Summative & periodic exam questionnaires for Term 1 TQ, Term 2 TQ, and Term 3 TQ',
    icon: '📑',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    activeBg: 'bg-amber-600 text-white',
    borderColor: 'border-amber-500',
    itemType: 'terms',
  },
];

export const SubmissionReportView: React.FC<SubmissionReportViewProps> = ({
  currentUser,
  facultyFolders = [],
  initialCategory,
}) => {
  // Check if current user has coordinator or administrator role
  const isCoordinator =
    currentUser.designation === 'Coordinator' ||
    (currentUser.designation?.toLowerCase().includes('coordinator') ?? false) ||
    currentUser.role === 'Coordinator' ||
    currentUser.role?.toLowerCase() === 'coordinator' ||
    (currentUser.email?.toLowerCase().includes('coordinator') ?? false);

  const userEmailClean = (currentUser.email || '').toLowerCase().trim();
  const isMasterAdmin =
    currentUser.role === 'Admin' && (
      userEmailClean === 'johnvic.garnica@deped.gov.ph' ||
      userEmailClean === 'johnvicgarnica@deped.gov.ph' ||
      userEmailClean === 'garjohn@deped.gov.ph' ||
      userEmailClean === 'johnvicgarnica1@gmail.com' ||
      (currentUser.designation?.toLowerCase().includes('master admin') ?? false) ||
      currentUser.name?.toLowerCase().includes('garnica')
    );

  // ONLY THE COORDINATOR AND THE MASTER ADMIN CAN SEE THE CLASS ADVISER PAGE AND CAN EDIT
  const canManageClassAdvisers = isCoordinator || isMasterAdmin;

  // ONLY SCHOOL PRINCIPAL, MASTER TEACHER, AND MASTER ADMIN CAN EDIT DLL, TOS, AND TQ
  const designationLower = (currentUser.designation || '').toLowerCase().trim();
  const isPrincipal =
    designationLower.includes('school principal') ||
    designationLower.includes('principal');
  const isMasterTeacher = designationLower.includes('master teacher');
  const canEditDllTosTq = isMasterAdmin || isPrincipal || isMasterTeacher;

  const isAdmin =
    currentUser.role === 'Admin' ||
    (currentUser as any).isAdmin === true ||
    currentUser.role?.toLowerCase() === 'admin' ||
    isCoordinator;

  // Registered faculty state from Firebase & localStorage cache
  const [registeredFaculty, setRegisteredFaculty] = useState<FacultyDoc[]>(() => getStoredFaculty());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dynamically & robustly resolve whether current user is a Class Adviser
  const isClassAdviser = useMemo(() => {
    // 1. Direct advisoryRole check (case-insensitive & trimmed)
    const roleClean = (currentUser.advisoryRole || '').toLowerCase().trim();
    if (roleClean === 'class adviser' || roleClean === 'class-adviser' || roleClean === 'adviser') {
      return true;
    }
    // 2. Direct designation / role check
    const desigClean = (currentUser.designation || '').toLowerCase().trim();
    if (desigClean.includes('class adviser') || desigClean.includes('adviser')) {
      return true;
    }
    const roleStr = (currentUser.role || '').toLowerCase().trim();
    if (roleStr.includes('adviser')) {
      return true;
    }

    // 3. User email lookup against registered faculty or cache
    const emailClean = (currentUser.email || '').toLowerCase().trim();
    if (emailClean) {
      const match = registeredFaculty.find((f) => (f.email || '').toLowerCase().trim() === emailClean);
      if (match) {
        const mRole = (match.advisoryRole || '').toLowerCase().trim();
        if (mRole === 'class adviser' || mRole === 'class-adviser' || mRole === 'adviser') {
          return true;
        }
      }

      const stored = getStoredFaculty();
      const storedMatch = stored.find((f) => (f.email || '').toLowerCase().trim() === emailClean);
      if (storedMatch) {
        const sRole = (storedMatch.advisoryRole || '').toLowerCase().trim();
        if (sRole === 'class adviser' || sRole === 'class-adviser' || sRole === 'adviser') {
          return true;
        }
      }

      // Default demo faculty accounts designated as Class Advisers
      const DEMO_ADVISERS = [
        'johnvic.garnica@deped.gov.ph',
        'maria.santos@deped.gov.ph',
        'roberto.delacruz@deped.gov.ph',
        'elena.bautista@deped.gov.ph',
      ];
      if (DEMO_ADVISERS.includes(emailClean)) {
        return true;
      }
    }
    return false;
  }, [currentUser, registeredFaculty]);

  // Navigation & Category States:
  // Coordinators ONLY see Class Advisers (DLL, TOS, TQ removed)
  // Non-Advisers only see DLL, TOS, TQ (defaults to DLL)
  // Class Advisers see CLASS ADVISERS, DLL, TOS, TQ (defaults to Class Advisers)
  // Master Admin sees CLASS ADVISERS, DLL, TOS, TQ (defaults to Class Advisers)
  const [activeCategory, setActiveCategory] = useState<SubmissionCategoryTab>(() => {
    if (isCoordinator) {
      return 'class-advisers';
    }
    if (initialCategory) {
      if (initialCategory === 'class-advisers' && !canManageClassAdvisers && !isClassAdviser) {
        return 'dll';
      }
      return initialCategory;
    }
    if (!canManageClassAdvisers && !isClassAdviser) {
      return 'dll';
    }
    return 'class-advisers';
  });

  // Sync when initialCategory prop changes
  useEffect(() => {
    if (isCoordinator) {
      setActiveCategory('class-advisers');
      return;
    }
    if (initialCategory) {
      if (initialCategory === 'class-advisers' && (canManageClassAdvisers || isClassAdviser)) {
        setActiveCategory('class-advisers');
      } else if (initialCategory !== 'class-advisers') {
        setActiveCategory(initialCategory);
      }
    }
  }, [initialCategory, canManageClassAdvisers, isClassAdviser, isCoordinator]);

  // Keep Coordinator on class-advisers, and keep non-adviser faculty on DLL, TOS, or TQ (never class-advisers)
  useEffect(() => {
    if (isCoordinator && activeCategory !== 'class-advisers') {
      setActiveCategory('class-advisers');
    } else if (!canManageClassAdvisers && !isClassAdviser && activeCategory === 'class-advisers') {
      setActiveCategory('dll');
    }
  }, [isCoordinator, canManageClassAdvisers, isClassAdviser, activeCategory]);
  const [activeDefaultTermId, setActiveDefaultTermId] = useState<string>(() => getStoredActiveTermId());
  const [selectedTermId, setSelectedTermId] = useState<string>(() => getStoredActiveTermId());
  const [isSettingActiveTerm, setIsSettingActiveTerm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'with-comments' | 'incomplete' | 'late' | 'in-progress' | 'none'>('all');
  const [viewMode, setViewMode] = useState<'faculty-chart' | 'weekly-chart' | 'pie-chart'>('faculty-chart');
  const [facultyPieTab, setFacultyPieTab] = useState<'both' | 'compliance' | 'volume' | 'periods'>('both');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Class Adviser School Forms Data Map (SF 1, 3, 4, 5, 6, 8, 10 & SF 2 Monthly)
  const [classAdviserData, setClassAdviserData] = useState<Record<string, ClassAdviserSchoolFormsRecord>>(() => getStoredClassAdviserSchoolForms());

  // Subscribe to real-time Class Adviser School Forms from Firebase
  useEffect(() => {
    const unsub = subscribeClassAdviserSchoolForms((map) => {
      setClassAdviserData(map || {});
    });
    return () => unsub();
  }, []);

  // Term Weeks Configuration (Max 12 weeks per term)
  const [termWeeksConfig, setTermWeeksConfig] = useState<TermWeeksConfig>(() => getStoredTermWeeksConfig());
  const [isSettingWeeksModalOpen, setIsSettingWeeksModalOpen] = useState<boolean>(false);
  const [tempWeeksConfig, setTempWeeksConfig] = useState<TermWeeksConfig>(() => getStoredTermWeeksConfig());
  const [isSavingWeeksConfig, setIsSavingWeeksConfig] = useState<boolean>(false);
  const [isSavingSingleTerm, setIsSavingSingleTerm] = useState<string | null>(null);
  const [savedTermSuccess, setSavedTermSuccess] = useState<Record<string, boolean>>({});
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);

  // Persistence / Saving States
  const [isSavingIndex, setIsSavingIndex] = useState<number | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [selectedItemToSave, setSelectedItemToSave] = useState<number>(0);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);

  // Subscribe to real-time term weeks configuration from Firebase
  useEffect(() => {
    const unsub = subscribeTermWeeksConfig((config) => {
      setTermWeeksConfig(config);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time active default academic term from Firebase
  useEffect(() => {
    const unsub = subscribeActiveTermId((termId) => {
      setActiveDefaultTermId(termId);
    });
    return () => unsub();
  }, []);

  // Compute active term storage ID
  // DLL is per academic term (term-1, term-2, term-3)
  // TOS and TQ are tracked across the 3 terms (Term 1, Term 2, Term 3) in a unified annual document
  const effectiveTermId = activeCategory === 'dll' ? selectedTermId : 'annual';

  // Current active term's configured week count (1 to 12)
  const currentTermWeeks = useMemo(() => {
    if (activeCategory !== 'dll') return 3;
    const count = termWeeksConfig[selectedTermId as keyof TermWeeksConfig];
    return typeof count === 'number' && count >= MIN_TERM_WEEKS && count <= MAX_TERM_WEEKS ? count : 11;
  }, [activeCategory, selectedTermId, termWeeksConfig]);

  // Dynamic list of academic terms with accurate configured weeks
  const termsList: TermDefinition[] = useMemo(() => {
    return [
      { id: 'term-1', name: '1st Term', description: `Weeks 1 to ${termWeeksConfig['term-1'] || 11}`, weeks: termWeeksConfig['term-1'] || 11 },
      { id: 'term-2', name: '2nd Term', description: `Weeks 1 to ${termWeeksConfig['term-2'] || 11}`, weeks: termWeeksConfig['term-2'] || 11 },
      { id: 'term-3', name: '3rd Term', description: `Weeks 1 to ${termWeeksConfig['term-3'] || 11}`, weeks: termWeeksConfig['term-3'] || 11 },
    ];
  }, [termWeeksConfig]);

  // Submissions map: key is facultyEmail, value is boolean array
  const [submissions, setSubmissions] = useState<Record<string, boolean[]>>(() => {
    return getStoredFacultySubmissions(getStoredActiveTermId(), 'dll');
  });

  // Statuses map: key is facultyEmail, value is ItemSubmissionStatus array ('unchecked' | 'checked' | 'with-comments')
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemSubmissionStatus[]>>(() => {
    return getStoredFacultyStatuses(getStoredActiveTermId(), 'dll');
  });

  // Comments map: key is facultyEmail, value is Record<string, string> mapping item index to comment
  const [itemComments, setItemComments] = useState<Record<string, Record<string, string>>>(() => {
    return getStoredFacultyComments(getStoredActiveTermId(), 'dll');
  });

  // Admin Box Click Modal: allows admin to select 'Checked' (No Comments) vs 'With Comments'
  const [activeCellAction, setActiveCellAction] = useState<{
    facultyEmail: string;
    facultyName: string;
    facultySurname: string;
    department: string;
    itemIndex: number;
    colLabel: string;
    currentStatus: ItemSubmissionStatus;
    currentComment: string;
  } | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<ItemSubmissionStatus>('checked');
  const [commentInput, setCommentInput] = useState<string>('');

  // Faculty Modal: allows faculty to view full comments on their items
  const [facultyDetailModal, setFacultyDetailModal] = useState<{
    colLabel: string;
    status: ItemSubmissionStatus;
    comment: string;
  } | null>(null);

  // Subscribe to faculty list
  useEffect(() => {
    const unsub = subscribeFaculty((list) => {
      setRegisteredFaculty(list || []);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to faculty submissions whenever category or term changes
  useEffect(() => {
    if (activeCategory === 'class-advisers') return;
    const cat = activeCategory as SubmissionCategory;
    const cachedSub = getStoredFacultySubmissions(effectiveTermId, cat);
    const cachedStat = getStoredFacultyStatuses(effectiveTermId, cat);
    const cachedComm = getStoredFacultyComments(effectiveTermId, cat);

    setSubmissions(cachedSub || {});
    setItemStatuses(cachedStat || {});
    setItemComments(cachedComm || {});

    const unsub = subscribeFacultySubmissions(effectiveTermId, cat, (subs, stats, comms) => {
      setSubmissions(subs || {});
      if (stats) setItemStatuses(stats);
      if (comms) setItemComments(comms);
    });

    return () => unsub();
  }, [effectiveTermId, activeCategory]);

  // Combine registered faculty from Firestore with any unique faculty found in facultyFolders
  const allFaculty = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; department: string; surname: string; advisoryRole?: 'Class Adviser' | 'Non-Adviser' }>();

    // Add registered faculty from collection
    registeredFaculty.forEach((f) => {
      const email = (f.email || '').toLowerCase().trim();
      if (email) {
        map.set(email, {
          id: f.id || email,
          name: f.name || email.split('@')[0],
          email: email,
          department: f.department || 'Senior High School Dept.',
          surname: extractFacultySurname(f.name || email),
          advisoryRole: f.advisoryRole || 'Non-Adviser',
        });
      }
    });

    // Also include any faculty from facultyFolders who might not be in the direct faculty doc list yet
    facultyFolders.forEach((f) => {
      const email = (f.facultyEmail || '').toLowerCase().trim();
      if (email && !map.has(email)) {
        map.set(email, {
          id: `folder-faculty-${email}`,
          name: f.facultyName || email.split('@')[0],
          email: email,
          department: 'Senior High School Dept.',
          surname: f.facultySurname || extractFacultySurname(f.facultyName || email),
          advisoryRole: 'Non-Adviser',
        });
      }
    });

    // If still empty (e.g. fresh database before initial sign-in), provide default template faculty for demonstration
    if (map.size === 0) {
      const demoFaculty = [
        { id: 'f-1', name: 'John Vic Garnica', email: 'johnvic.garnica@deped.gov.ph', department: 'TVL / ICT Strand', surname: 'GARNICA', advisoryRole: 'Class Adviser' as const },
        { id: 'f-2', name: 'Maria Santos', email: 'maria.santos@deped.gov.ph', department: 'STEM Strand', surname: 'SANTOS', advisoryRole: 'Class Adviser' as const },
        { id: 'f-3', name: 'Roberto Dela Cruz', email: 'roberto.delacruz@deped.gov.ph', department: 'HUMSS Strand', surname: 'DELA CRUZ', advisoryRole: 'Class Adviser' as const },
        { id: 'f-4', name: 'Elena Bautista', email: 'elena.bautista@deped.gov.ph', department: 'ABM Strand', surname: 'BAUTISTA', advisoryRole: 'Class Adviser' as const },
        { id: 'f-5', name: 'Mark Anthony Reyes', email: 'mark.reyes@deped.gov.ph', department: 'GAS Strand', surname: 'REYES', advisoryRole: 'Non-Adviser' as const },
        { id: 'f-6', name: 'Grace Lim', email: 'grace.lim@deped.gov.ph', department: 'Core Academics', surname: 'LIM', advisoryRole: 'Non-Adviser' as const },
      ];
      demoFaculty.forEach((d) => map.set(d.email, d));
    }

    const list = Array.from(map.values());
    // Sort alphabetically by surname
    return list.sort((a, b) => a.surname.localeCompare(b.surname));
  }, [registeredFaculty, facultyFolders]);

  // Class Advisers list: ONLY faculty members designated as "Class Adviser"
  const classAdvisersList = useMemo(() => {
    return allFaculty.filter((f) => f.advisoryRole === 'Class Adviser');
  }, [allFaculty]);

  // Filtered Class Advisers based on search and department
  const filteredClassAdvisers = useMemo(() => {
    return classAdvisersList.filter((f) => {
      if (departmentFilter !== 'all' && !(f.department || '').toLowerCase().includes(departmentFilter.toLowerCase())) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = (f.name || '').toLowerCase().includes(q);
        const matchesEmail = (f.email || '').toLowerCase().includes(q);
        const matchesSurname = (f.surname || '').toLowerCase().includes(q);
        const matchesDept = (f.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesSurname && !matchesDept) return false;
      }
      return true;
    });
  }, [classAdvisersList, departmentFilter, searchTerm]);

  // Overall compliance metrics for Class Advisers
  const adviserStats = useMemo(() => {
    const totalAdvisers = classAdvisersList.length;
    if (totalAdvisers === 0) {
      return {
        totalAdvisers: 0,
        sfTotalComplied: 0,
        sfTotalPossible: 0,
        sfPercentage: 0,
        sf2TotalComplied: 0,
        sf2TotalPossible: 0,
        sf2Percentage: 0,
        fullyCompliantAdvisers: 0,
      };
    }

    let sfTotalComplied = 0;
    const sfTotalPossible = totalAdvisers * STANDARD_SF_COLUMNS.length; // 7 forms

    let sf2TotalComplied = 0;
    const sf2TotalPossible = totalAdvisers * SF2_MONTH_COLUMNS.length; // 11 months

    let fullyCompliantCount = 0;

    classAdvisersList.forEach((adviser) => {
      const emailKey = adviser.email.toLowerCase().trim();
      const rec = classAdviserData[emailKey] || {};

      let adviserSfComplied = 0;
      STANDARD_SF_COLUMNS.forEach((col) => {
        if (rec[col.key]) adviserSfComplied++;
      });
      sfTotalComplied += adviserSfComplied;

      let adviserSf2Complied = 0;
      SF2_MONTH_COLUMNS.forEach((col) => {
        if (rec[col.key]) adviserSf2Complied++;
      });
      sf2TotalComplied += adviserSf2Complied;

      if (adviserSfComplied === STANDARD_SF_COLUMNS.length && adviserSf2Complied === SF2_MONTH_COLUMNS.length) {
        fullyCompliantCount++;
      }
    });

    const sfPercentage = sfTotalPossible > 0 ? Math.round((sfTotalComplied / sfTotalPossible) * 100) : 0;
    const sf2Percentage = sf2TotalPossible > 0 ? Math.round((sf2TotalComplied / sf2TotalPossible) * 100) : 0;

    return {
      totalAdvisers,
      sfTotalComplied,
      sfTotalPossible,
      sfPercentage,
      sf2TotalComplied,
      sf2TotalPossible,
      sf2Percentage,
      fullyCompliantAdvisers: fullyCompliantCount,
    };
  }, [classAdvisersList, classAdviserData]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    allFaculty.forEach((f) => {
      if (f.department) set.add(f.department);
    });
    return Array.from(set);
  }, [allFaculty]);

  // Category Configuration
  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
  const isWeeklyCategory = currentCategory.itemType === 'weekly';

  // Dynamic Column Definitions based on category and configured term weeks
  // For TOS and TQ: Each of the 3 terms (TERM 1, TERM 2, TERM 3) spans 3 sub-columns: ST 1, ST 2, TE 1/2/3
  const columnItems = useMemo(() => {
    if (activeCategory === 'dll') {
      return Array.from({ length: currentTermWeeks }, (_, i) => ({
        index: i,
        key: `w-${i + 1}`,
        headerLabel: `W${i + 1}`,
        fullLabel: `Week ${i + 1}`,
        shortLabel: `W${i + 1}`,
        termGroup: null,
        description: `Week ${i + 1} Daily Lesson Log`,
      }));
    } else if (activeCategory === 'tos') {
      return [
        // TERM 1 TOS (ST 1, ST 2, TE 1)
        { index: 0, key: 'tos-t1-st1', termGroup: 'TERM 1 TOS', termId: 'term-1', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 1 TOS - ST 1', shortLabel: 'T1 ST 1', description: 'Term 1 Table of Specifications - Summative Test 1' },
        { index: 1, key: 'tos-t1-st2', termGroup: 'TERM 1 TOS', termId: 'term-1', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 1 TOS - ST 2', shortLabel: 'T1 ST 2', description: 'Term 1 Table of Specifications - Summative Test 2' },
        { index: 2, key: 'tos-t1-te1', termGroup: 'TERM 1 TOS', termId: 'term-1', subLabel: 'TE 1', headerLabel: 'TE 1', fullLabel: 'Term 1 TOS - TE 1', shortLabel: 'T1 TE 1', description: 'Term 1 Table of Specifications - Term Exam 1' },
        // TERM 2 TOS (ST 1, ST 2, TE 2)
        { index: 3, key: 'tos-t2-st1', termGroup: 'TERM 2 TOS', termId: 'term-2', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 2 TOS - ST 1', shortLabel: 'T2 ST 1', description: 'Term 2 Table of Specifications - Summative Test 1' },
        { index: 4, key: 'tos-t2-st2', termGroup: 'TERM 2 TOS', termId: 'term-2', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 2 TOS - ST 2', shortLabel: 'T2 ST 2', description: 'Term 2 Table of Specifications - Summative Test 2' },
        { index: 5, key: 'tos-t2-te2', termGroup: 'TERM 2 TOS', termId: 'term-2', subLabel: 'TE 2', headerLabel: 'TE 2', fullLabel: 'Term 2 TOS - TE 2', shortLabel: 'T2 TE 2', description: 'Term 2 Table of Specifications - Term Exam 2' },
        // TERM 3 TOS (ST 1, ST 2, TE 3)
        { index: 6, key: 'tos-t3-st1', termGroup: 'TERM 3 TOS', termId: 'term-3', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 3 TOS - ST 1', shortLabel: 'T3 ST 1', description: 'Term 3 Table of Specifications - Summative Test 1' },
        { index: 7, key: 'tos-t3-st2', termGroup: 'TERM 3 TOS', termId: 'term-3', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 3 TOS - ST 2', shortLabel: 'T3 ST 2', description: 'Term 3 Table of Specifications - Summative Test 2' },
        { index: 8, key: 'tos-t3-te3', termGroup: 'TERM 3 TOS', termId: 'term-3', subLabel: 'TE 3', headerLabel: 'TE 3', fullLabel: 'Term 3 TOS - TE 3', shortLabel: 'T3 TE 3', description: 'Term 3 Table of Specifications - Term Exam 3' },
      ];
    } else {
      return [
        // TERM 1 TQ (ST 1, ST 2, TE 1)
        { index: 0, key: 'tq-t1-st1', termGroup: 'TERM 1 TQ', termId: 'term-1', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 1 TQ - ST 1', shortLabel: 'T1 ST 1', description: 'Term 1 Test Questions - Summative Test 1' },
        { index: 1, key: 'tq-t1-st2', termGroup: 'TERM 1 TQ', termId: 'term-1', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 1 TQ - ST 2', shortLabel: 'T1 ST 2', description: 'Term 1 Test Questions - Summative Test 2' },
        { index: 2, key: 'tq-t1-te1', termGroup: 'TERM 1 TQ', termId: 'term-1', subLabel: 'TE 1', headerLabel: 'TE 1', fullLabel: 'Term 1 TQ - TE 1', shortLabel: 'T1 TE 1', description: 'Term 1 Test Questions - Term Exam 1' },
        // TERM 2 TQ (ST 1, ST 2, TE 2)
        { index: 3, key: 'tq-t2-st1', termGroup: 'TERM 2 TQ', termId: 'term-2', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 2 TQ - ST 1', shortLabel: 'T2 ST 1', description: 'Term 2 Test Questions - Summative Test 1' },
        { index: 4, key: 'tq-t2-st2', termGroup: 'TERM 2 TQ', termId: 'term-2', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 2 TQ - ST 2', shortLabel: 'T2 ST 2', description: 'Term 2 Test Questions - Summative Test 2' },
        { index: 5, key: 'tq-t2-te2', termGroup: 'TERM 2 TQ', termId: 'term-2', subLabel: 'TE 2', headerLabel: 'TE 2', fullLabel: 'Term 2 TQ - TE 2', shortLabel: 'T2 TE 2', description: 'Term 2 Test Questions - Term Exam 2' },
        // TERM 3 TQ (ST 1, ST 2, TE 3)
        { index: 6, key: 'tq-t3-st1', termGroup: 'TERM 3 TQ', termId: 'term-3', subLabel: 'ST 1', headerLabel: 'ST 1', fullLabel: 'Term 3 TQ - ST 1', shortLabel: 'T3 ST 1', description: 'Term 3 Test Questions - Summative Test 1' },
        { index: 7, key: 'tq-t3-st2', termGroup: 'TERM 3 TQ', termId: 'term-3', subLabel: 'ST 2', headerLabel: 'ST 2', fullLabel: 'Term 3 TQ - ST 2', shortLabel: 'T3 ST 2', description: 'Term 3 Test Questions - Summative Test 2' },
        { index: 8, key: 'tq-t3-te3', termGroup: 'TERM 3 TQ', termId: 'term-3', subLabel: 'TE 3', headerLabel: 'TE 3', fullLabel: 'Term 3 TQ - TE 3', shortLabel: 'T3 TE 3', description: 'Term 3 Test Questions - Term Exam 3' },
      ];
    }
  }, [activeCategory, currentTermWeeks]);

  // Two-tier header grouping for TOS and TQ to mirror the requested layout
  const termGroups = useMemo(() => {
    if (activeCategory === 'tos') {
      return [
        { label: 'TERM 1 TOS', span: 3, startIndex: 0 },
        { label: 'TERM 2 TOS', span: 3, startIndex: 3 },
        { label: 'TERM 3 TOS', span: 3, startIndex: 6 },
      ];
    }
    if (activeCategory === 'tq') {
      return [
        { label: 'TERM 1 TQ', span: 3, startIndex: 0 },
        { label: 'TERM 2 TQ', span: 3, startIndex: 3 },
        { label: 'TERM 3 TQ', span: 3, startIndex: 6 },
      ];
    }
    return null;
  }, [activeCategory]);

  const totalItemCount = columnItems.length;

  // Toast Helper
  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 3000);
  };

  // Toggle individual School Form or SF 2 Month checkbox for a Class Adviser
  const handleToggleAdviserCheckbox = async (
    facultyEmail: string,
    field: string,
    currentValue: boolean,
    facultyName: string,
    department: string
  ) => {
    // ONLY COORDINATOR AND MASTER ADMIN CAN EDIT
    if (!canManageClassAdvisers) {
      showToast('⚠️ Only the Coordinator and Master Admin can edit Class Adviser compliance records.');
      return;
    }

    const nextVal = !currentValue;
    const cleanEmail = facultyEmail.toLowerCase().trim();

    // Optimistic UI update
    setClassAdviserData((prev) => {
      const existing = prev[cleanEmail] || {
        facultyEmail: cleanEmail,
        facultyName,
        department,
      };
      return {
        ...prev,
        [cleanEmail]: {
          ...existing,
          [field]: nextVal,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.name || (isCoordinator ? 'Coordinator' : 'Master Admin'),
        },
      };
    });

    try {
      await saveClassAdviserFormCheckboxToFirestore(cleanEmail, field, nextVal, {
        facultyName,
        department,
        updatedBy: currentUser.name || (isCoordinator ? 'Coordinator' : 'Master Admin'),
      });
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const fieldTitle = field.startsWith('sf2_')
        ? `SF 2 ${field.replace('sf2_', '').toUpperCase()}`
        : field.toUpperCase();
      showToast(`⚡ ${fieldTitle}: ${nextVal ? 'COMPLIED ✓' : 'UNCHECKED'} for ${facultyName} (Saved to Firebase)`);
    } catch (err) {
      console.error('Error saving checkbox to Firestore:', err);
      showToast('⚠️ Error saving to Firebase');
    }
  };

  // Batch toggle all 7 School Forms (SF 1, 3, 4, 5, 6, 8, 10) for one Class Adviser
  const handleBatchToggleAdviserSf = async (
    facultyEmail: string,
    targetState: boolean,
    facultyName: string,
    department: string
  ) => {
    // ONLY COORDINATOR AND MASTER ADMIN CAN EDIT
    if (!canManageClassAdvisers) {
      showToast('⚠️ Only the Coordinator and Master Admin can edit Class Adviser compliance records.');
      return;
    }

    const cleanEmail = facultyEmail.toLowerCase().trim();
    const updates: Partial<ClassAdviserSchoolFormsRecord> = {
      sf1: targetState,
      sf3: targetState,
      sf4: targetState,
      sf5: targetState,
      sf6: targetState,
      sf8: targetState,
      sf10: targetState,
    };

    // Optimistic
    setClassAdviserData((prev) => {
      const existing = prev[cleanEmail] || { facultyEmail: cleanEmail, facultyName, department };
      return {
        ...prev,
        [cleanEmail]: {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.name || (isCoordinator ? 'Coordinator' : 'Master Admin'),
        },
      };
    });

    try {
      await batchSaveClassAdviserSchoolFormsToFirestore(cleanEmail, updates, {
        facultyName,
        department,
        updatedBy: currentUser.name || (isCoordinator ? 'Coordinator' : 'Master Admin'),
      });
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast(`⚡ All 7 SF Forms marked as ${targetState ? 'COMPLIED ✓' : 'CLEARED'} for ${facultyName}`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error saving to Firebase');
    }
  };

  // Batch toggle all 11 SF 2 Months for one Class Adviser
  const handleBatchToggleAdviserSf2 = async (
    facultyEmail: string,
    targetState: boolean,
    facultyName: string,
    department: string
  ) => {
    // ONLY COORDINATOR AND MASTER ADMIN CAN EDIT
    if (!canManageClassAdvisers) {
      showToast('⚠️ Only the Coordinator and Master Admin can edit Class Adviser compliance records.');
      return;
    }
    const cleanEmail = facultyEmail.toLowerCase().trim();
    const updates: Partial<ClassAdviserSchoolFormsRecord> = {
      sf2_june: targetState,
      sf2_july: targetState,
      sf2_august: targetState,
      sf2_september: targetState,
      sf2_october: targetState,
      sf2_november: targetState,
      sf2_december: targetState,
      sf2_january: targetState,
      sf2_february: targetState,
      sf2_march: targetState,
      sf2_april: targetState,
    };

    // Optimistic
    setClassAdviserData((prev) => {
      const existing = prev[cleanEmail] || { facultyEmail: cleanEmail, facultyName, department };
      return {
        ...prev,
        [cleanEmail]: {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.name || currentUser.designation || 'Coordinator',
        },
      };
    });

    try {
      await batchSaveClassAdviserSchoolFormsToFirestore(cleanEmail, updates, {
        facultyName,
        department,
        updatedBy: currentUser.name || currentUser.designation || 'Coordinator',
      });
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast(`⚡ All 11 SF 2 Months marked as ${targetState ? 'COMPLIED ✓' : 'CLEARED'} for ${facultyName}`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error saving to Firebase');
    }
  };

  // Handle setting official active academic term (Default across all users and page refreshes)
  const handleSetCurrentActiveTerm = async (termIdToSet: string) => {
    if (!canEditDllTosTq) return;
    setIsSettingActiveTerm(true);
    try {
      await saveActiveTermIdToFirestore(termIdToSet);
      setActiveDefaultTermId(termIdToSet);
      setSelectedTermId(termIdToSet);
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const termObj = termsList.find((t) => t.id === termIdToSet);
      const termName = termObj?.name || (termIdToSet === 'term-1' ? '1st Term' : termIdToSet === 'term-2' ? '2nd Term' : '3rd Term');
      showToast(`⭐ ${termName} is now saved in Firebase as the default Current Term on page refresh!`);
    } catch (err) {
      console.error('Error saving current active term:', err);
      showToast('⚠️ Failed to save current term to Firebase');
    } finally {
      setIsSettingActiveTerm(false);
    }
  };

  // Handle saving configured weeks for a specific single term immediately to Firebase
  const handleSaveSingleTermWeeks = async (termId: 'term-1' | 'term-2' | 'term-3', customWeeks?: number) => {
    if (!canEditDllTosTq) return;
    setIsSavingSingleTerm(termId);
    try {
      const targetWeeks = customWeeks !== undefined ? customWeeks : (tempWeeksConfig[termId] || 11);
      const sanitizedWeeks = Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(targetWeeks) || 11));
      const updated: TermWeeksConfig = {
        'term-1': termId === 'term-1' ? sanitizedWeeks : (tempWeeksConfig['term-1'] || termWeeksConfig['term-1'] || 11),
        'term-2': termId === 'term-2' ? sanitizedWeeks : (tempWeeksConfig['term-2'] || termWeeksConfig['term-2'] || 11),
        'term-3': termId === 'term-3' ? sanitizedWeeks : (tempWeeksConfig['term-3'] || termWeeksConfig['term-3'] || 11),
      };
      setTempWeeksConfig(updated);
      setTermWeeksConfig(updated);
      await saveTermWeeksConfigToFirestore(updated);
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      setSavedTermSuccess((prev) => ({ ...prev, [termId]: true }));
      setTimeout(() => {
        setSavedTermSuccess((prev) => ({ ...prev, [termId]: false }));
      }, 3000);

      const termName = termId === 'term-1' ? '1st Term' : termId === 'term-2' ? '2nd Term' : '3rd Term';
      showToast(`💾 Saved ${termName} to Firebase: ${sanitizedWeeks} Weeks (W1–W${sanitizedWeeks})`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Failed to save term weeks configuration to Firebase');
    } finally {
      setIsSavingSingleTerm(null);
    }
  };

  // Quick adjustment with optional auto-save to Firebase
  const handleQuickChangeTermWeeks = async (termId: 'term-1' | 'term-2' | 'term-3', newWeeks: number) => {
    if (!canEditDllTosTq) return;
    const sanitizedWeeks = Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(newWeeks) || 11));
    const updated: TermWeeksConfig = {
      ...tempWeeksConfig,
      [termId]: sanitizedWeeks,
    };
    setTempWeeksConfig(updated);

    if (autoSaveEnabled) {
      setTermWeeksConfig(updated);
      await saveTermWeeksConfigToFirestore(updated);
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSavedTermSuccess((prev) => ({ ...prev, [termId]: true }));
      setTimeout(() => {
        setSavedTermSuccess((prev) => ({ ...prev, [termId]: false }));
      }, 2500);
    }
  };

  // Handle saving configured weeks per term (All terms at once)
  const handleSaveWeeksConfiguration = async () => {
    if (!canEditDllTosTq) return;
    setIsSavingWeeksConfig(true);
    try {
      const sanitized: TermWeeksConfig = {
        'term-1': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(tempWeeksConfig['term-1']) || 11)),
        'term-2': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(tempWeeksConfig['term-2']) || 11)),
        'term-3': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(tempWeeksConfig['term-3']) || 11)),
      };
      await saveTermWeeksConfigToFirestore(sanitized);
      setTermWeeksConfig(sanitized);
      setTempWeeksConfig(sanitized);
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsSettingWeeksModalOpen(false);
      showToast(`⚙️ Number of weeks saved to Firebase! (Term 1: ${sanitized['term-1']}w, Term 2: ${sanitized['term-2']}w, Term 3: ${sanitized['term-3']}w)`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Failed to save term weeks configuration');
    } finally {
      setIsSavingWeeksConfig(false);
    }
  };

  // Item status & comment helpers
  const getItemStatus = (email: string, index: number): ItemSubmissionStatus => {
    const cleanEmail = email.toLowerCase().trim();
    const fStatuses = itemStatuses[cleanEmail];
    if (fStatuses && fStatuses[index]) {
      return fStatuses[index];
    }
    const fWeeks = submissions[cleanEmail];
    if (fWeeks && fWeeks[index]) {
      return 'checked';
    }
    return 'unchecked';
  };

  const getItemComment = (email: string, index: number): string => {
    const cleanEmail = email.toLowerCase().trim();
    const fComments = itemComments[cleanEmail];
    if (fComments) {
      return fComments[String(index)] || fComments[index] || '';
    }
    return '';
  };

  // Open the review options modal for a specific box (Admin)
  const handleOpenCellAction = (
    faculty: { email: string; name: string; surname: string; department: string },
    col: { index: number; fullLabel: string }
  ) => {
    if (!canEditDllTosTq) return;
    const currentStatus = getItemStatus(faculty.email, col.index);
    const currentComment = getItemComment(faculty.email, col.index);
    setActiveCellAction({
      facultyEmail: faculty.email,
      facultyName: faculty.name,
      facultySurname: faculty.surname,
      department: faculty.department,
      itemIndex: col.index,
      colLabel: col.fullLabel,
      currentStatus,
      currentComment,
    });
    // Default to 'checked' if currently unchecked, or keep existing status
    setSelectedActionType(currentStatus === 'unchecked' ? 'checked' : currentStatus);
    setCommentInput(currentComment || '');
  };

  // Save selected status and comments for a specific box
  const [autoSavingItemKey, setAutoSavingItemKey] = useState<string | null>(null);

  const handleSaveCellStatus = async (
    facultyEmail: string,
    itemIndex: number,
    newStatus: ItemSubmissionStatus,
    commentText: string
  ) => {
    if (!canEditDllTosTq) return;

    const cleanEmail = facultyEmail.toLowerCase().trim();
    const currentWeeks = submissions[cleanEmail] ? [...submissions[cleanEmail]] : Array(totalItemCount).fill(false);
    while (currentWeeks.length < totalItemCount) {
      currentWeeks.push(false);
    }
    currentWeeks[itemIndex] = newStatus !== 'unchecked';

    const currentStatuses: ItemSubmissionStatus[] = itemStatuses[cleanEmail]
      ? [...itemStatuses[cleanEmail]]
      : Array(totalItemCount).fill('unchecked' as ItemSubmissionStatus);
    while (currentStatuses.length < totalItemCount) {
      currentStatuses.push('unchecked');
    }
    currentStatuses[itemIndex] = newStatus;

    const currentComments: Record<string, string> = itemComments[cleanEmail]
      ? { ...itemComments[cleanEmail] }
      : {};
    if (newStatus === 'with-comments' || newStatus === 'incomplete' || newStatus === 'late') {
      currentComments[String(itemIndex)] = commentText.trim() || (newStatus === 'late' ? 'Submitted late.' : '');
    } else {
      delete currentComments[String(itemIndex)];
      delete currentComments[itemIndex];
    }

    setSubmissions((prev) => ({ ...prev, [cleanEmail]: currentWeeks }));
    setItemStatuses((prev) => ({ ...prev, [cleanEmail]: currentStatuses }));
    setItemComments((prev) => ({ ...prev, [cleanEmail]: currentComments }));

    const facultyObj = allFaculty.find((f) => f.email === cleanEmail);
    const colName = columnItems[itemIndex]?.fullLabel || `Item ${itemIndex + 1}`;
    const statusLabel =
      newStatus === 'checked'
        ? 'Checked (No Comments)'
        : newStatus === 'with-comments'
        ? 'With Comments (Corrections)'
        : newStatus === 'incomplete'
        ? 'Incomplete (Lacking Requirements)'
        : newStatus === 'late'
        ? 'Late (Submitted Late)'
        : 'Unchecked (Pending)';
    const itemKey = `${cleanEmail}_${itemIndex}`;

    setAutoSavingItemKey(itemKey);
    try {
      await saveFacultySubmissionToFirestore(
        effectiveTermId,
        activeCategory,
        cleanEmail,
        currentWeeks,
        facultyObj?.name,
        facultyObj?.department,
        currentStatuses,
        currentComments
      );
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTimestamp(timeStr);
      showToast(`☁️ Auto-saved: ${facultyObj?.surname || cleanEmail} • ${colName} (${statusLabel})`);
    } catch (err) {
      console.error('Error auto-saving item status to Firebase Firestore:', err);
      showToast(`⚠️ Failed to auto-save ${colName} to Firebase`);
    } finally {
      setTimeout(() => {
        setAutoSavingItemKey((prev) => (prev === itemKey ? null : prev));
      }, 500);
    }
  };

  // Legacy direct toggle handler: redirects to handleOpenCellAction for full options
  const handleToggleItem = async (facultyEmail: string, itemIndex: number) => {
    if (!canEditDllTosTq) return;
    const facultyObj = allFaculty.find((f) => f.email.toLowerCase().trim() === facultyEmail.toLowerCase().trim());
    const colObj = columnItems[itemIndex];
    if (facultyObj && colObj) {
      handleOpenCellAction(facultyObj, colObj);
    }
  };

  // Check all items for a single faculty member
  const handleCheckAllItems = async (facultyEmail: string, checkValue: boolean) => {
    if (!canEditDllTosTq) return;

    const cleanEmail = facultyEmail.toLowerCase().trim();
    const currentWeeks = Array(totalItemCount).fill(checkValue);
    const currentStatuses: ItemSubmissionStatus[] = Array(totalItemCount).fill(
      checkValue ? ('checked' as ItemSubmissionStatus) : ('unchecked' as ItemSubmissionStatus)
    );
    const currentComments: Record<string, string> = checkValue ? (itemComments[cleanEmail] || {}) : {};

    setSubmissions((prev) => ({ ...prev, [cleanEmail]: currentWeeks }));
    setItemStatuses((prev) => ({ ...prev, [cleanEmail]: currentStatuses }));
    if (!checkValue) {
      setItemComments((prev) => ({ ...prev, [cleanEmail]: {} }));
    }

    const facultyObj = allFaculty.find((f) => f.email === cleanEmail);
    const actionLabel = checkValue ? 'All items checked (No Comments)' : 'All items cleared';

    try {
      await saveFacultySubmissionToFirestore(
        effectiveTermId,
        activeCategory,
        cleanEmail,
        currentWeeks,
        facultyObj?.name,
        facultyObj?.department,
        currentStatuses,
        !checkValue ? {} : currentComments
      );
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTimestamp(timeStr);
      showToast(`☁️ Auto-saved: ${facultyObj?.surname || cleanEmail} • ${actionLabel}`);
    } catch (err) {
      console.error('Error auto-saving bulk items to Firebase:', err);
      showToast(`⚠️ Failed to auto-save changes to Firebase`);
    }
  };

  // Save data for a specific column/term/week to Firebase Firestore
  const handleSaveItemToFirebase = async (itemIndex: number) => {
    if (!canEditDllTosTq) return;
    setIsSavingIndex(itemIndex);
    const itemObj = columnItems[itemIndex];
    try {
      await saveWeekDataToFirestore(
        effectiveTermId,
        activeCategory,
        itemIndex,
        submissions,
        allFaculty.map((f) => ({ email: f.email, name: f.name, department: f.department })),
        itemStatuses,
        itemComments
      );
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast(`☁️ ${itemObj?.fullLabel} data saved to Firebase Firestore for retention!`);
    } catch (e) {
      console.error(e);
      showToast(`⚠️ Error saving ${itemObj?.fullLabel} data to Firebase`);
    } finally {
      setIsSavingIndex(null);
    }
  };

  // Save all items for the current category to Firebase
  const handleSaveAllToFirebase = async () => {
    if (!canEditDllTosTq) return;
    setIsSavingAll(true);
    try {
      await batchSaveFacultySubmissionsToFirestore(
        effectiveTermId,
        activeCategory,
        submissions,
        itemStatuses,
        itemComments
      );
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast(`☁️ All ${currentCategory.name} records saved to Firebase Firestore successfully!`);
    } catch (e) {
      console.error(e);
      showToast('⚠️ Error saving submission data to Firebase');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Filtered faculty list
  const filteredFaculty = useMemo(() => {
    return allFaculty.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.surname.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = departmentFilter === 'all' || f.department === departmentFilter;

      const items = submissions[f.email] || Array(totalItemCount).fill(false);
      const visibleSlice = items.slice(0, totalItemCount);
      const count = visibleSlice.filter(Boolean).length;

      let matchStatus = true;
      if (statusFilter === 'complete') matchStatus = count === totalItemCount;
      else if (statusFilter === 'with-comments') {
        const cleanEmail = f.email.toLowerCase().trim();
        const fStatuses = itemStatuses[cleanEmail] || [];
        matchStatus = fStatuses.slice(0, totalItemCount).some((s) => s === 'with-comments');
      }
      else if (statusFilter === 'incomplete') {
        const cleanEmail = f.email.toLowerCase().trim();
        const fStatuses = itemStatuses[cleanEmail] || [];
        matchStatus = fStatuses.slice(0, totalItemCount).some((s) => s === 'incomplete');
      }
      else if (statusFilter === 'late') {
        const cleanEmail = f.email.toLowerCase().trim();
        const fStatuses = itemStatuses[cleanEmail] || [];
        matchStatus = fStatuses.slice(0, totalItemCount).some((s) => s === 'late');
      }
      else if (statusFilter === 'in-progress') matchStatus = count > 0 && count < totalItemCount;
      else if (statusFilter === 'none') matchStatus = count === 0;

      return matchSearch && matchDept && matchStatus;
    });
  }, [allFaculty, searchTerm, departmentFilter, statusFilter, submissions, itemStatuses, totalItemCount]);

  // Calculate Progress Stats
  const stats = useMemo(() => {
    const totalPossible = allFaculty.length * totalItemCount;
    let totalCompleted = 0;
    let totalCleanChecked = 0;
    let totalWithComments = 0;
    let totalIncomplete = 0;
    let totalLate = 0;
    let completedFacultyCount = 0;
    let inProgressFacultyCount = 0;
    let noSubmissionFacultyCount = 0;
    let facultyWithCommentsCount = 0;
    let facultyWithIncompleteCount = 0;
    let facultyWithLateCount = 0;

    allFaculty.forEach((f) => {
      const cleanEmail = f.email.toLowerCase().trim();
      const items = submissions[cleanEmail] || Array(totalItemCount).fill(false);
      const visibleSlice = items.slice(0, totalItemCount);
      const count = visibleSlice.filter(Boolean).length;
      totalCompleted += count;

      const fStatuses = itemStatuses[cleanEmail] || [];
      let fHasComments = false;
      let fHasIncomplete = false;
      let fHasLate = false;
      for (let i = 0; i < totalItemCount; i++) {
        const st: ItemSubmissionStatus = fStatuses[i] || (visibleSlice[i] ? 'checked' : 'unchecked');
        if (st === 'checked') {
          totalCleanChecked++;
        } else if (st === 'with-comments') {
          totalWithComments++;
          fHasComments = true;
        } else if (st === 'incomplete') {
          totalIncomplete++;
          fHasIncomplete = true;
        } else if (st === 'late') {
          totalLate++;
          fHasLate = true;
        }
      }

      if (fHasComments) facultyWithCommentsCount++;
      if (fHasIncomplete) facultyWithIncompleteCount++;
      if (fHasLate) facultyWithLateCount++;
      if (count === totalItemCount) completedFacultyCount++;
      else if (count > 0) inProgressFacultyCount++;
      else noSubmissionFacultyCount++;
    });

    const overallPercentage =
      totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    return {
      totalFaculty: allFaculty.length,
      totalPossible,
      totalCompleted,
      totalCleanChecked,
      totalWithComments,
      totalIncomplete,
      totalLate,
      facultyWithCommentsCount,
      facultyWithIncompleteCount,
      facultyWithLateCount,
      completedFacultyCount,
      inProgressFacultyCount,
      noSubmissionFacultyCount,
      overallPercentage,
    };
  }, [allFaculty, submissions, itemStatuses, totalItemCount]);

  // My personal submission status (for registered faculty)
  const myStatus = useMemo(() => {
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const items = submissions[userEmail] || Array(totalItemCount).fill(false);
    const visibleSlice = items.slice(0, totalItemCount);
    const count = visibleSlice.filter(Boolean).length;
    const pct = Math.round((count / totalItemCount) * 100);

    const fStatuses = itemStatuses[userEmail] || [];
    const fComments = itemComments[userEmail] || {};

    let cleanCheckedCount = 0;
    let withCommentsCount = 0;
    let incompleteCount = 0;
    let lateCount = 0;
    const itemsStatuses: ItemSubmissionStatus[] = [];
    const itemsCommentsList: string[] = [];

    for (let i = 0; i < totalItemCount; i++) {
      const st: ItemSubmissionStatus = fStatuses[i] || (visibleSlice[i] ? 'checked' : 'unchecked');
      itemsStatuses.push(st);
      const comm = fComments[String(i)] || fComments[i] || '';
      itemsCommentsList.push(comm);

      if (st === 'checked') cleanCheckedCount++;
      else if (st === 'with-comments') withCommentsCount++;
      else if (st === 'incomplete') incompleteCount++;
      else if (st === 'late') lateCount++;
    }

    const pendingCount = Math.max(0, totalItemCount - count);

    return {
      itemsSubmitted: count,
      totalItems: totalItemCount,
      percentage: pct,
      items: visibleSlice,
      cleanCheckedCount,
      withCommentsCount,
      incompleteCount,
      lateCount,
      pendingCount,
      itemsStatuses,
      itemsComments: itemsCommentsList,
      hasComments: withCommentsCount > 0,
      hasIncomplete: incompleteCount > 0,
      hasLate: lateCount > 0,
    };
  }, [currentUser, submissions, itemStatuses, itemComments, totalItemCount]);

  // Chart Data: Progress per Faculty
  const facultyChartData = useMemo(() => {
    return filteredFaculty.map((f) => {
      const items = submissions[f.email] || Array(totalItemCount).fill(false);
      const visibleSlice = items.slice(0, totalItemCount);
      const submittedCount = visibleSlice.filter(Boolean).length;
      const percentage = Math.round((submittedCount / totalItemCount) * 100);

      return {
        name: f.surname || f.name.split(' ')[0],
        fullName: f.name,
        email: f.email,
        department: f.department,
        submittedCount: submittedCount,
        totalItems: totalItemCount,
        percentage: percentage,
      };
    });
  }, [filteredFaculty, submissions, totalItemCount]);

  // Chart Data: Column Compliance Trend (Weeks or Term 1/2/3)
  const trendChartData = useMemo(() => {
    return columnItems.map((col) => {
      let count = 0;
      allFaculty.forEach((f) => {
        const items = submissions[f.email] || Array(totalItemCount).fill(false);
        if (items[col.index]) count++;
      });
      const pct = allFaculty.length > 0 ? Math.round((count / allFaculty.length) * 100) : 0;
      return {
        itemLabel: col.fullLabel,
        shortLabel: col.headerLabel,
        submittedCount: count,
        totalFaculty: allFaculty.length,
        percentage: pct,
      };
    });
  }, [allFaculty, submissions, columnItems, totalItemCount]);

  // Pie Chart Dataset 1: Overall Department Compliance Status Distribution
  const compliancePieData = useMemo(() => {
    const data = [
      {
        name: '100% Fully Compliant',
        shortName: 'Completed',
        value: stats.completedFacultyCount,
        color: '#10B981', // Emerald 500
        percentage: stats.totalFaculty > 0 ? Math.round((stats.completedFacultyCount / stats.totalFaculty) * 100) : 0,
        description: `Submitted all ${totalItemCount} ${isWeeklyCategory ? 'weeks' : 'terms'}`,
      },
      {
        name: 'In Progress (Partial)',
        shortName: 'In Progress',
        value: stats.inProgressFacultyCount,
        color: '#F59E0B', // Amber 500
        percentage: stats.totalFaculty > 0 ? Math.round((stats.inProgressFacultyCount / stats.totalFaculty) * 100) : 0,
        description: `Submitted 1 to ${Math.max(1, totalItemCount - 1)} ${isWeeklyCategory ? 'weeks' : 'terms'}`,
      },
      {
        name: 'Not Started / Pending',
        shortName: 'Pending',
        value: stats.noSubmissionFacultyCount,
        color: '#94A3B8', // Slate 400
        percentage: stats.totalFaculty > 0 ? Math.round((stats.noSubmissionFacultyCount / stats.totalFaculty) * 100) : 0,
        description: `0 ${isWeeklyCategory ? 'weeks' : 'terms'} recorded`,
      },
    ];

    // Filter out 0 values for clean pie chart display unless all are 0
    const nonZero = data.filter((d) => d.value > 0);
    return nonZero.length > 0 ? nonZero : data;
  }, [stats, totalItemCount, isWeeklyCategory]);

  // Pie Chart Dataset 2: Deliverables Volume (Checked vs With Comments vs Pending items)
  const volumePieData = useMemo(() => {
    const pendingItems = Math.max(0, stats.totalPossible - stats.totalCompleted);
    const data = [
      {
        name: 'Checked (No Comments)',
        shortName: 'Checked',
        value: stats.totalCleanChecked,
        color: '#10B981', // Emerald 500
        percentage: stats.totalPossible > 0 ? Math.round((stats.totalCleanChecked / stats.totalPossible) * 100) : 0,
        description: `Reviewed and approved with no corrections needed`,
      },
      {
        name: 'With Comments (Corrections)',
        shortName: 'With Comments',
        value: stats.totalWithComments,
        color: '#F59E0B', // Amber 500
        percentage: stats.totalPossible > 0 ? Math.round((stats.totalWithComments / stats.totalPossible) * 100) : 0,
        description: `Deliverables marked with feedback or corrections`,
      },
      {
        name: 'Incomplete (Lacking)',
        shortName: 'Incomplete',
        value: stats.totalIncomplete,
        color: '#EF4444', // Rose / Red 500
        percentage: stats.totalPossible > 0 ? Math.round((stats.totalIncomplete / stats.totalPossible) * 100) : 0,
        description: `Deliverables marked lacking required components or attachments`,
      },
      {
        name: 'Late (Submitted Late)',
        shortName: 'Late',
        value: stats.totalLate,
        color: '#F97316', // Orange 500
        percentage: stats.totalPossible > 0 ? Math.round((stats.totalLate / stats.totalPossible) * 100) : 0,
        description: `Deliverables submitted past the scheduled deadline`,
      },
      {
        name: 'Pending Deliverables',
        shortName: 'Pending',
        value: pendingItems,
        color: '#CBD5E1', // Slate 300
        percentage: stats.totalPossible > 0 ? Math.round((pendingItems / stats.totalPossible) * 100) : 0,
        description: `Deliverables awaiting submission or checking`,
      },
    ];
    const nonZero = data.filter((d) => d.value > 0);
    return nonZero.length > 0 ? nonZero : data;
  }, [stats]);

  // Pie Chart Dataset 3: Deliverable Distribution by Period (Weeks or Terms)
  const periodDistributionPieData = useMemo(() => {
    const COLOR_PALETTE = [
      '#3B82F6', // blue
      '#6366F1', // indigo
      '#8B5CF6', // purple
      '#A855F7', // fuchsia
      '#EC4899', // pink
      '#F43F5E', // rose
      '#F97316', // orange
      '#F59E0B', // amber
      '#10B981', // emerald
      '#14B8A6', // teal
      '#06B6D4', // cyan
    ];

    return trendChartData.map((col, idx) => ({
      name: col.shortLabel,
      fullName: col.itemLabel,
      value: col.submittedCount,
      totalFaculty: col.totalFaculty,
      percentage: col.percentage,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    }));
  }, [trendChartData]);

  // Export to CSV (Privacy aware)
  const handleExportCSV = () => {
    if (!isAdmin) {
      // In Faculty Mode, export aggregate department summary & personal status only
      const headers = [
        'Category',
        'Period',
        'Total Registered Teachers',
        'Overall Compliance %',
        'Total Clean Checked',
        'Total With Comments',
        'Total Incomplete',
        'Total Late',
        'Pending Deliverables',
        'My Personal Submissions',
        'My Clean Checked',
        'My With Comments',
        'My Incomplete',
        'My Late',
        'My Compliance %',
      ];
      const row = [
        `"${currentCategory.name}"`,
        `"${effectiveTermId}"`,
        stats.totalFaculty,
        `"${stats.overallPercentage}%"`,
        stats.totalCleanChecked,
        stats.totalWithComments,
        stats.totalIncomplete,
        stats.totalLate,
        Math.max(0, stats.totalPossible - stats.totalCompleted),
        `"${myStatus.itemsSubmitted}/${totalItemCount}"`,
        myStatus.cleanCheckedCount,
        myStatus.withCommentsCount,
        myStatus.incompleteCount,
        myStatus.lateCount,
        `"${myStatus.percentage}%"`,
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `SVNHS_SHS_${activeCategory.toUpperCase()}_Summary_Report_${effectiveTermId}_${new Date()
          .toISOString()
          .substring(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`📊 ${currentCategory.name} Aggregate Summary Report downloaded!`);
      return;
    }

    // Admin full export
    const headers = [
      'Category',
      'Term/Period',
      'Surname',
      'Full Name',
      'Email',
      'Department',
      ...columnItems.map((col) => col.fullLabel),
      `Total Submissions (of ${totalItemCount})`,
      'Checked (Clean)',
      'With Comments',
      'Incomplete (Lacking)',
      'Late (Submitted Late)',
      'Completion %',
    ];
    const rows = allFaculty.map((f) => {
      const cleanEmail = f.email.toLowerCase().trim();
      const items = submissions[cleanEmail] || Array(totalItemCount).fill(false);
      const visibleSlice = items.slice(0, totalItemCount);
      const count = visibleSlice.filter(Boolean).length;
      const pct = Math.round((count / totalItemCount) * 100);

      const fStatuses = itemStatuses[cleanEmail] || [];
      const fComments = itemComments[cleanEmail] || {};
      let cleanCount = 0;
      let commentedCount = 0;
      let incompleteCount = 0;
      let lateCount = 0;

      const cols = visibleSlice.map((_, i) => {
        const st = fStatuses[i] || (visibleSlice[i] ? 'checked' : 'unchecked');
        if (st === 'checked') {
          cleanCount++;
          return 'CHECKED';
        }
        if (st === 'with-comments') {
          commentedCount++;
          const comm = fComments[String(i)] || fComments[i];
          return comm ? `WITH COMMENTS ("${comm.replace(/"/g, '""')}")` : 'WITH COMMENTS';
        }
        if (st === 'incomplete') {
          incompleteCount++;
          const comm = fComments[String(i)] || fComments[i];
          return comm ? `INCOMPLETE ("${comm.replace(/"/g, '""')}")` : 'INCOMPLETE';
        }
        if (st === 'late') {
          lateCount++;
          const comm = fComments[String(i)] || fComments[i];
          return comm ? `LATE ("${comm.replace(/"/g, '""')}")` : 'LATE';
        }
        return 'PENDING';
      });

      return [
        `"${currentCategory.name}"`,
        `"${effectiveTermId}"`,
        `"${f.surname}"`,
        `"${f.name}"`,
        `"${f.email}"`,
        `"${f.department}"`,
        ...cols.map((c) => `"${c}"`),
        count,
        cleanCount,
        commentedCount,
        incompleteCount,
        lateCount,
        `"${pct}%"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `SVNHS_SHS_${activeCategory.toUpperCase()}_Submission_Report_${effectiveTermId}_${new Date()
        .toISOString()
        .substring(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📊 ${currentCategory.name} CSV Report downloaded!`);
  };

  // Copy Summary to Clipboard (Privacy aware)
  const handleCopySummary = () => {
    if (!isAdmin) {
      // In Faculty Mode, copy only aggregate summary without colleague names
      const summaryText =
        `SVNHS SHS DEPARTMENT - ${currentCategory.fullName.toUpperCase()} (${currentCategory.name}) SUBMISSION OVERVIEW\n` +
        `Period: ${isWeeklyCategory ? termsList.find((t) => t.id === selectedTermId)?.name + ` (Weeks 1 to ${currentTermWeeks})` : 'All Terms (Term 1, Term 2, Term 3)'}\n` +
        `Total Faculty Members: ${stats.totalFaculty}\n` +
        `Overall Compliance: ${stats.overallPercentage}%\n` +
        `Total Checked (No Comments): ${stats.totalCleanChecked}\n` +
        `Total With Comments: ${stats.totalWithComments}\n` +
        `Total Incomplete (Lacking): ${stats.totalIncomplete}\n` +
        `Total Late Submissions: ${stats.totalLate}\n` +
        `100% Completed: ${stats.completedFacultyCount} / ${stats.totalFaculty} (${Math.round((stats.completedFacultyCount / (stats.totalFaculty || 1)) * 100)}%)\n` +
        `In Progress: ${stats.inProgressFacultyCount} / ${stats.totalFaculty}\n` +
        `Pending/Not Started: ${stats.noSubmissionFacultyCount} / ${stats.totalFaculty}\n` +
        `Total Deliverables Submitted: ${stats.totalCompleted} / ${stats.totalPossible}\n\n` +
        `My Personal Status (${currentUser.name}): ${myStatus.itemsSubmitted} / ${totalItemCount} (${myStatus.percentage}%)\n` +
        `- Checked (Clean): ${myStatus.cleanCheckedCount}\n` +
        `- With Comments: ${myStatus.withCommentsCount}\n` +
        `- Incomplete (Lacking): ${myStatus.incompleteCount}\n` +
        `- Late: ${myStatus.lateCount}\n`;
      navigator.clipboard.writeText(summaryText);
      showToast(`📋 ${currentCategory.name} Summary copied to clipboard!`);
      return;
    }

    const summaryText =
      `SVNHS SHS DEPARTMENT - ${currentCategory.fullName.toUpperCase()} (${currentCategory.name}) SUBMISSION REPORT\n` +
      `Period: ${isWeeklyCategory ? termsList.find((t) => t.id === selectedTermId)?.name + ` (Weeks 1 to ${currentTermWeeks})` : 'All Terms (Term 1, Term 2, Term 3)'}\n` +
      `Total Faculty: ${stats.totalFaculty}\n` +
      `Overall Compliance: ${stats.overallPercentage}%\n` +
      `Total Checked (No Comments): ${stats.totalCleanChecked}\n` +
      `Total With Comments: ${stats.totalWithComments}\n` +
      `Total Incomplete (Lacking): ${stats.totalIncomplete}\n` +
      `Total Late Submissions: ${stats.totalLate}\n` +
      `100% Completed: ${stats.completedFacultyCount} / ${stats.totalFaculty}\n\n` +
      `Faculty Compliance List:\n` +
      allFaculty
        .map((f) => {
          const cleanEmail = f.email.toLowerCase().trim();
          const items = submissions[cleanEmail] || Array(totalItemCount).fill(false);
          const count = items.slice(0, totalItemCount).filter(Boolean).length;
          const fStatuses = itemStatuses[cleanEmail] || [];
          let clean = 0;
          let withComm = 0;
          let inc = 0;
          let late = 0;
          for (let i = 0; i < totalItemCount; i++) {
            const st = fStatuses[i] || (items[i] ? 'checked' : 'unchecked');
            if (st === 'checked') clean++;
            else if (st === 'with-comments') withComm++;
            else if (st === 'incomplete') inc++;
            else if (st === 'late') late++;
          }
          return `- ${f.surname}, ${f.name} (${f.department}): ${count}/${totalItemCount} (${clean} Clean, ${withComm} With Comments, ${inc} Incomplete, ${late} Late)`;
        })
        .join('\n');

    navigator.clipboard.writeText(summaryText);
    showToast(`📋 ${currentCategory.name} Summary copied to clipboard!`);
  };

  const getBarColor = (count: number, maxCount: number = totalItemCount) => {
    if (count === maxCount && maxCount > 0) return '#10B981'; // Emerald 500
    const ratio = maxCount > 0 ? count / maxCount : 0;
    if (ratio >= 0.7) return '#3B82F6'; // Blue 500
    if (ratio >= 0.4) return '#F59E0B'; // Amber 500
    if (count > 0) return '#F97316'; // Orange 500
    return '#94A3B8'; // Slate 400
  };

  // Render Personal Class Adviser View (For logged in faculty who are designated Class Advisers)
  const renderClassAdviserFacultyPersonalView = () => {
    const myEmailKey = (currentUser.email || '').toLowerCase().trim();
    const rec = classAdviserData[myEmailKey] || {};
    let mySfComplied = 0;
    STANDARD_SF_COLUMNS.forEach((col) => {
      if (rec[col.key]) mySfComplied++;
    });
    let mySf2Complied = 0;
    SF2_MONTH_COLUMNS.forEach((m) => {
      if (rec[m.key]) mySf2Complied++;
    });
    const totalForms = STANDARD_SF_COLUMNS.length + SF2_MONTH_COLUMNS.length;
    const totalComplied = mySfComplied + mySf2Complied;
    const overallPct = Math.round((totalComplied / totalForms) * 100);
    const isAllComplete = mySfComplied === STANDARD_SF_COLUMNS.length && mySf2Complied === SF2_MONTH_COLUMNS.length;

    return (
      <div className="space-y-6">
        {/* Header / Summary Card */}
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🎓</span>
                <h3 className="text-base font-bold text-slate-100 font-sans">
                  My Class Adviser School Forms Compliance Portal
                </h3>
                <span className="bg-emerald-600 text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {currentUser.name} • Class Adviser
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">
                Fast-track your submitted documents! Review Section 1 (Standard School Forms SF 1–10) and Section 2 (SF 2 Monthly Attendance June–April) verified by Coordinator / Administrator.
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {totalComplied} / {totalForms} Checkpoints
                </div>
                <div className="text-xs text-slate-400 font-mono font-bold">
                  {overallPct}% Overall Compliance
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#0d1524] border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 shadow-2xs text-lg font-mono">
                {overallPct}%
              </div>
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#24334b]">
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-xl text-xs font-mono font-bold border border-blue-500/40">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Section 1: {mySfComplied} / {STANDARD_SF_COLUMNS.length} SF Forms Verified</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-xl text-xs font-mono font-bold border border-purple-500/40">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Section 2: {mySf2Complied} / {SF2_MONTH_COLUMNS.length} Months Verified</span>
            </div>
            {isAllComplete && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-mono font-bold border border-emerald-500/40">
                <CheckCheck className="w-3.5 h-3.5" />
                <span>100% Fully Compliant Class Adviser</span>
              </div>
            )}
            {rec.updatedAt && (
              <div className="flex items-center space-x-1 px-3 py-1 bg-[#0d1524] text-slate-400 rounded-xl text-[11px] font-mono border border-[#24334b]">
                <span>Last verified: {new Date(rec.updatedAt).toLocaleDateString()} {new Date(rec.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: MY STANDARD SCHOOL FORMS */}
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#24334b]">
            <div className="flex items-center space-x-2">
              <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                Section 1
              </span>
              <h4 className="text-base font-bold text-slate-100 font-sans">
                Standard School Forms (SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              DepEd Verification Status
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {STANDARD_SF_COLUMNS.map((col) => {
              const isComplied = Boolean(rec[col.key]);
              return (
                <div
                  key={col.key}
                  className={`p-4 rounded-2xl border transition-all space-y-2 ${
                    isComplied
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-100'
                      : 'bg-[#0d1524] border-[#24334b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold font-mono text-emerald-400">
                      {col.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase ${
                        isComplied
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isComplied ? 'COMPLIED ✓' : 'PENDING'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">{col.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 leading-snug">{col.desc}</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">
                      {isComplied ? 'Proof of Compliance on file' : 'Awaiting verification'}
                    </span>
                    {isComplied && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: MY SCHOOL FORM 2 MONTHLY ATTENDANCE */}
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#24334b]">
            <div className="flex items-center space-x-2">
              <span className="bg-purple-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                Section 2
              </span>
              <h4 className="text-base font-bold text-slate-100 font-sans">
                School Form 2 (SF 2) Monthly Learner Attendance Record
              </h4>
            </div>
            <span className="text-xs text-purple-400 font-mono font-bold">
              June to April (11 Months)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {SF2_MONTH_COLUMNS.map((m) => {
              const isComplied = Boolean(rec[m.key]);
              return (
                <div
                  key={m.key}
                  className={`p-3 rounded-2xl border text-center transition-all space-y-1.5 ${
                    isComplied
                      ? 'bg-purple-950/30 border-purple-500/40 text-slate-100'
                      : 'bg-[#0d1524] border-[#24334b] text-slate-300'
                  }`}
                >
                  <div className="text-xs font-mono font-extrabold text-purple-300">
                    {m.label}
                  </div>
                  <div
                    className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase ${
                      isComplied
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isComplied ? 'COMPLIED ✓' : 'PENDING'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {m.fullMonth.split(' ')[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render Administrator & Coordinator Matrix for Class Advisers (Section 1 SF 1-10 & Section 2 SF 2)
  const renderClassAdviserMatrix = () => {
    return (
      <div className="space-y-6">
        {/* Filter & Search Bar */}
        <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-xs p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#24334b]">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                🎓
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-sans">
                  Class Adviser School Forms Compliance Matrix
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Tick checkboxes when documents are received and verified. Changes persist immediately to Firebase as official proof of compliance.
                </p>
              </div>
            </div>

            {/* Cloud Sync Status */}
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Real-Time Firebase Compliance Sync</span>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search class advisers by name, surname, or DepEd email..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#0d1524] border border-[#24334b] rounded-xl text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-mono"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="sm:col-span-5">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                aria-label="Filter by department"
                className="w-full px-3 py-2.5 bg-[#0d1524] border border-[#24334b] rounded-xl text-xs font-mono text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all" className="bg-[#0d1524] text-slate-100">All Departments ({classAdvisersList.length} Advisers)</option>
                <option value="Senior High School" className="bg-[#0d1524] text-slate-100">Senior High School Department</option>
                <option value="Junior High School" className="bg-[#0d1524] text-slate-100">Junior High School Department</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 1: STANDARD SCHOOL FORMS (SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10) */}
        <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-[#0f1725] border-b border-[#24334b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  Section 1
                </span>
                <h4 className="text-base font-bold text-slate-100 font-sans">
                  List of Class Advisers — School Forms (SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10)
                </h4>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Beside each class adviser's name are checkboxes for SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, and SF 10. Ticking saves proof of compliance to Firebase.
              </p>
            </div>

            <div className="text-xs font-mono text-slate-300 flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-[#1a2638] rounded-xl border border-[#2d4060]">
                Total Advisers: <strong className="text-emerald-400">{filteredClassAdvisers.length}</strong>
              </span>
            </div>
          </div>

          {/* Section 1 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-[#0d1524] text-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider border-b border-[#24334b]">
                  <th className="py-3 px-4 w-60 sm:w-72">Class Adviser</th>
                  <th className="py-3 px-3 w-36 sm:w-44">Department</th>
                  {STANDARD_SF_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="py-3 px-2 text-center border-l border-[#24334b] w-14 sm:w-16"
                      title={`${col.label}: ${col.name} — ${col.desc}`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-emerald-400 font-extrabold text-xs">{col.label}</span>
                        <span className="text-[9px] text-slate-400 font-normal truncate max-w-[55px] hidden sm:inline">
                          {col.name.split(' ')[0]}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center w-28 border-l border-[#24334b]">
                    Progress
                  </th>
                  <th className="py-3 px-3 text-center w-36 border-l border-[#24334b]">
                    Batch Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24334b] text-xs font-mono">
                {filteredClassAdvisers.length === 0 ? (
                  <tr>
                    <td colSpan={4 + STANDARD_SF_COLUMNS.length} className="py-12 text-center text-slate-400 bg-[#141c2c]">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <div className="font-bold text-sm text-slate-200">No Class Advisers found</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {classAdvisersList.length === 0
                          ? 'No faculty members have been designated as "Class Adviser" yet. Designate faculty in Faculty Account Directory.'
                          : 'Try adjusting your search query or department filter.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClassAdvisers.map((adviser) => {
                    const emailKey = adviser.email.toLowerCase().trim();
                    const record = classAdviserData[emailKey] || {};
                    const isJHS = (adviser.department || '').toLowerCase().includes('junior');

                    // Count compiled in Section 1
                    let compliedCount = 0;
                    STANDARD_SF_COLUMNS.forEach((col) => {
                      if (record[col.key]) compliedCount++;
                    });
                    const isAllComplied = compliedCount === STANDARD_SF_COLUMNS.length;

                    return (
                      <tr
                        key={adviser.email}
                        className="bg-[#141c2c] hover:bg-[#1a2538] transition-colors border-b border-[#24334b]"
                      >
                        {/* Class Adviser Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-emerald-300 shrink-0 bg-emerald-950/70 border border-emerald-500/40">
                              🎓
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate text-xs flex items-center space-x-1.5">
                                <span>{adviser.surname}, {adviser.name}</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-sans font-bold">
                                  Adviser
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate font-mono">
                                {adviser.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-300 text-[11px]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isJHS
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {isJHS ? 'Junior High' : 'Senior High'}
                          </span>
                        </td>

                        {/* Section 1 Checkboxes: SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10 */}
                        {STANDARD_SF_COLUMNS.map((col) => {
                          const isChecked = Boolean(record[col.key]);
                          return (
                            <td
                              key={col.key}
                              className="py-2.5 px-2 text-center border-l border-[#24334b]"
                            >
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleAdviserCheckbox(
                                      adviser.email,
                                      col.key,
                                      isChecked,
                                      adviser.name,
                                      adviser.department
                                    )
                                  }
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                    isChecked
                                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-xs scale-105'
                                      : 'bg-[#0d1524] border-[#2d4060] hover:border-emerald-500/60 hover:bg-[#1a2638] text-transparent'
                                  }`}
                                  title={`${adviser.name} - ${col.label} (${col.name}): ${isChecked ? 'COMPLIED ✓ (Click to uncheck)' : 'Click to tick as Complied'}`}
                                  aria-label={`Toggle ${col.label} for ${adviser.name}`}
                                >
                                  <Check className={`w-4 h-4 stroke-[3] ${isChecked ? 'text-white' : 'opacity-0'}`} />
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        {/* Section 1 Progress */}
                        <td className="py-3 px-3 text-center border-l border-[#24334b]">
                          <div className="flex flex-col items-center">
                            <span className={`text-[11px] font-bold ${
                              isAllComplied ? 'text-emerald-400' : 'text-slate-300'
                            }`}>
                              {compliedCount} / {STANDARD_SF_COLUMNS.length}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              isAllComplied
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isAllComplied ? 'COMPLIED ✓' : `${Math.round((compliedCount / STANDARD_SF_COLUMNS.length) * 100)}%`}
                            </span>
                          </div>
                        </td>

                        {/* Quick Action: Batch 7 SF */}
                        <td className="py-3 px-3 text-center border-l border-[#24334b]">
                          <button
                            type="button"
                            onClick={() =>
                              handleBatchToggleAdviserSf(
                                adviser.email,
                                !isAllComplied,
                                adviser.name,
                                adviser.department
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                              isAllComplied
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-500/40'
                            }`}
                            title={isAllComplied ? 'Clear all 7 SF for this adviser' : 'Check all 7 SF as Complied'}
                          >
                            {isAllComplied ? 'Clear SF' : 'Check 7 SF'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section 1 Footer */}
          <div className="p-3 bg-[#0f1725] border-t border-[#24334b] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>Section 1 Forms: <strong>SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10</strong></span>
            </div>
            <div>
              Saved in Firebase Firestore collection: <span className="text-emerald-400 font-bold">classAdviserSchoolForms</span>
            </div>
          </div>
        </div>

        {/* SECTION 2 (BELOW): EXCLUSIVELY FOR SCHOOL FORM 2 (SF 2) WITH CHECKBOXES FOR JUNE TO APRIL */}
        <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-[#0f1725] border-b border-[#24334b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-purple-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  Section 2
                </span>
                <h4 className="text-base font-bold text-slate-100 font-sans">
                  School Form 2 (SF 2) Monthly Attendance Record — Exclusive Dashboard
                </h4>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Exclusively for School Form 2 with the same list of Class Advisers. Beside their names are checkboxes for "JUNE" "JULY" "AUGUST" "SEPTEMBER" "OCTOBER" "NOVEMBER" "DECEMBER" "JANUARY" "FEBRUARY" "MARCH" "APRIL".
              </p>
            </div>

            <div className="text-xs font-mono text-slate-300 flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-[#1a2638] rounded-xl border border-[#2d4060]">
                11 Months Tracked: <strong className="text-purple-400">June–April</strong>
              </span>
            </div>
          </div>

          {/* Section 2 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-[#0d1524] text-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider border-b border-[#24334b]">
                  <th className="py-3 px-4 w-56 sm:w-64">Class Adviser</th>
                  <th className="py-3 px-3 w-32 sm:w-36">Department</th>
                  {SF2_MONTH_COLUMNS.map((m) => (
                    <th
                      key={m.key}
                      className="py-3 px-1 text-center border-l border-[#24334b] w-12 sm:w-14"
                      title={`School Form 2 - ${m.fullMonth}`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-purple-400 font-extrabold text-[10px] sm:text-xs">{m.label.substring(0, 3)}</span>
                        <span className="text-[8px] text-slate-400 font-normal hidden lg:inline">
                          {m.label}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center w-28 border-l border-[#24334b]">
                    SF 2 Status
                  </th>
                  <th className="py-3 px-3 text-center w-36 border-l border-[#24334b]">
                    Batch Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24334b] text-xs font-mono">
                {filteredClassAdvisers.length === 0 ? (
                  <tr>
                    <td colSpan={4 + SF2_MONTH_COLUMNS.length} className="py-12 text-center text-slate-400 bg-[#141c2c]">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <div className="font-bold text-sm text-slate-200">No Class Advisers found for SF 2</div>
                    </td>
                  </tr>
                ) : (
                  filteredClassAdvisers.map((adviser) => {
                    const emailKey = adviser.email.toLowerCase().trim();
                    const record = classAdviserData[emailKey] || {};
                    const isJHS = (adviser.department || '').toLowerCase().includes('junior');

                    // Count compiled months in Section 2
                    let compliedCount = 0;
                    SF2_MONTH_COLUMNS.forEach((m) => {
                      if (record[m.key]) compliedCount++;
                    });
                    const isAllComplied = compliedCount === SF2_MONTH_COLUMNS.length;

                    return (
                      <tr
                        key={`sf2-${adviser.email}`}
                        className="bg-[#141c2c] hover:bg-[#1a2538] transition-colors border-b border-[#24334b]"
                      >
                        {/* Class Adviser Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs text-purple-300 shrink-0 bg-purple-950/70 border border-purple-500/40">
                              📋
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate text-xs">
                                {adviser.surname}, {adviser.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate font-mono">
                                {adviser.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-300 text-[11px]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isJHS
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {isJHS ? 'Junior High' : 'Senior High'}
                          </span>
                        </td>

                        {/* Section 2 Checkboxes: JUNE, JULY, AUGUST, SEPTEMBER, OCTOBER, NOVEMBER, DECEMBER, JANUARY, FEBRUARY, MARCH, APRIL */}
                        {SF2_MONTH_COLUMNS.map((m) => {
                          const isChecked = Boolean(record[m.key]);
                          return (
                            <td
                              key={m.key}
                              className="py-2.5 px-1 text-center border-l border-[#24334b]"
                            >
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleAdviserCheckbox(
                                      adviser.email,
                                      m.key,
                                      isChecked,
                                      adviser.name,
                                      adviser.department
                                    )
                                  }
                                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer border ${
                                    isChecked
                                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-xs scale-105'
                                      : 'bg-[#0d1524] border-[#2d4060] hover:border-purple-500/60 hover:bg-[#1a2638] text-transparent'
                                  }`}
                                  title={`${adviser.name} - SF 2 ${m.label}: ${isChecked ? 'COMPLIED ✓ (Click to uncheck)' : 'Click to tick as Complied'}`}
                                  aria-label={`Toggle SF 2 ${m.label} for ${adviser.name}`}
                                >
                                  <Check className={`w-3.5 h-3.5 stroke-[3] ${isChecked ? 'text-white' : 'opacity-0'}`} />
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        {/* Section 2 Progress */}
                        <td className="py-3 px-3 text-center border-l border-[#24334b]">
                          <div className="flex flex-col items-center">
                            <span className={`text-[11px] font-bold ${
                              isAllComplied ? 'text-purple-400' : 'text-slate-300'
                            }`}>
                              {compliedCount} / {SF2_MONTH_COLUMNS.length}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              isAllComplied
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isAllComplied ? 'COMPLIED ✓' : `${Math.round((compliedCount / SF2_MONTH_COLUMNS.length) * 100)}%`}
                            </span>
                          </div>
                        </td>

                        {/* Quick Action: Batch SF 2 */}
                        <td className="py-3 px-3 text-center border-l border-[#24334b]">
                          <button
                            type="button"
                            onClick={() =>
                              handleBatchToggleAdviserSf2(
                                adviser.email,
                                !isAllComplied,
                                adviser.name,
                                adviser.department
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                              isAllComplied
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border-purple-500/40'
                            }`}
                            title={isAllComplied ? 'Clear all 11 SF 2 months for this adviser' : 'Check all 11 months as Complied'}
                          >
                            {isAllComplied ? 'Clear SF 2' : 'Check 11 Months'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2 Footer */}
          <div className="p-3 bg-[#0f1725] border-t border-[#24334b] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block animate-pulse" />
              <span>Exclusively School Form 2: <strong>JUNE • JULY • AUGUST • SEPTEMBER • OCTOBER • NOVEMBER • DECEMBER • JANUARY • FEBRUARY • MARCH • APRIL</strong></span>
            </div>
            <div className="text-emerald-300 font-bold">
              ✓ Proof of compliance saved directly to Firebase on tick
            </div>
          </div>
        </div>
      </div>
    );
  };

  const currentTerm = termsList.find((t) => t.id === selectedTermId) || termsList[0];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-mono flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-400/30 shadow-inner">
                <FileCheck2 className="w-6 h-6 text-blue-300" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans">
                Faculty Submission Report
              </h2>

              {isWeeklyCategory ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono px-3 py-1 rounded-full font-bold">
                  {currentTerm.name}: Weeks 1 to {currentTermWeeks}
                </span>
              ) : (
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono px-3 py-1 rounded-full font-bold">
                  Term 1, Term 2 & Term 3 Tracking
                </span>
              )}

              {isAdmin ? (
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300 inline" />
                  <span>Admin Mode (Editable Directory)</span>
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <Eye className="w-3.5 h-3.5 text-amber-300 inline" />
                  <span>Faculty Visualizer Mode</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-blue-100/80 max-w-2xl">
              Track and monitor instructional compliance across <strong className="text-white">Daily Lesson Logs (DLL: Configurable up to 12 Weeks)</strong>, <strong className="text-white">Table of Specifications (TOS: Term 1, 2, 3)</strong>, and <strong className="text-white">Test Questions (TQ: Term 1, 2, 3)</strong> with persistent Firebase cloud retention.
            </p>
          </div>

          {/* Action Controls & Selectors */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Term Dropdown Selector (Active for DLL) with Admin Current Term Setter */}
            {isWeeklyCategory ? (
              <>
                <div className="flex items-center space-x-1.5">
                  <div className="relative">
                    <select
                      value={selectedTermId}
                      onChange={(e) => {
                        setSelectedTermId(e.target.value);
                      }}
                      aria-label="Select Academic Term"
                      className="appearance-none bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs sm:text-sm font-mono font-bold rounded-2xl pl-3.5 pr-9 py-2.5 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-400"
                    >
                      {termsList.map((t) => {
                        const isDefault = t.id === activeDefaultTermId;
                        return (
                          <option key={t.id} value={t.id} className="bg-slate-900 text-white font-mono">
                            {t.name} {isDefault ? '⭐ [Current Term]' : ''} ({t.description})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-white/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Admin Button: Set as Current Term to persist in Firebase across refreshes */}
                  {canEditDllTosTq ? (
                    selectedTermId === activeDefaultTermId ? (
                      <div
                        className="flex items-center space-x-1.5 px-3 py-2 bg-amber-500/20 text-amber-200 border border-amber-400/40 rounded-2xl text-xs font-mono font-bold shadow-xs select-none"
                        title="Official Current Academic Term saved in Firebase (automatically loaded on page load & refresh)"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                        <span className="hidden sm:inline">Current Term</span>
                        <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono font-extrabold">Default ✓</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetCurrentActiveTerm(selectedTermId)}
                        disabled={isSettingActiveTerm}
                        className="px-3.5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-mono font-extrabold rounded-2xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95 border border-amber-200"
                        title={`Set ${currentTerm.name} as the official default Current Term in Firebase so it opens on refresh`}
                      >
                        {isSettingActiveTerm ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                        ) : (
                          <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                        )}
                        <span>Set as Current Term</span>
                      </button>
                    )
                  ) : (
                    selectedTermId === activeDefaultTermId ? (
                      <div
                        className="flex items-center space-x-1.5 px-3 py-2 bg-amber-500/20 text-amber-200 border border-amber-400/40 rounded-2xl text-xs font-mono font-bold select-none"
                        title="Currently viewing the official active academic term"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                        <span>Current Term</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedTermId(activeDefaultTermId)}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-amber-200 hover:text-white rounded-2xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 border border-white/20"
                        title="Switch view back to the current active academic term"
                      >
                        <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                        <span className="hidden sm:inline">Go to Current (T{activeDefaultTermId.replace('term-', '')})</span>
                      </button>
                    )
                  )}
                </div>

                {/* Inline Week Adjuster & Immediate Save Button (Principal, MT, Master Admin) or Indicator */}
                {canEditDllTosTq ? (
                  <div className="flex items-center space-x-1.5 bg-white/10 border border-white/20 p-1 rounded-2xl shadow-inner backdrop-blur-xs">
                    <span className="text-[11px] font-mono font-bold text-blue-200 pl-2 hidden sm:inline">
                      Weeks:
                    </span>

                    {/* Stepper */}
                    <div className="flex items-center space-x-1 bg-slate-900/60 border border-white/10 rounded-xl px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickChangeTermWeeks(
                            selectedTermId as any,
                            Math.max(MIN_TERM_WEEKS, currentTermWeeks - 1)
                          )
                        }
                        disabled={currentTermWeeks <= MIN_TERM_WEEKS}
                        className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer"
                        title="Decrease weeks"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-7 text-center font-mono font-extrabold text-xs text-white">
                        {currentTermWeeks}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleQuickChangeTermWeeks(
                            selectedTermId as any,
                            Math.min(MAX_TERM_WEEKS, currentTermWeeks + 1)
                          )
                        }
                        disabled={currentTermWeeks >= MAX_TERM_WEEKS}
                        className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer"
                        title="Increase weeks"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Dropdown (1 to 12) */}
                    <select
                      value={currentTermWeeks}
                      onChange={(e) =>
                        handleQuickChangeTermWeeks(
                          selectedTermId as any,
                          Number(e.target.value)
                        )
                      }
                      aria-label="Select weeks"
                      className="bg-slate-900/60 border border-white/10 text-white text-xs font-mono font-bold rounded-xl px-2 py-1.5 cursor-pointer focus:outline-hidden"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                        <option key={w} value={w} className="bg-slate-900 text-white">
                          {w} {w === 1 ? 'Wk' : 'Wks'}
                        </option>
                      ))}
                    </select>

                    {/* Save Button for active term weeks */}
                    <button
                      type="button"
                      onClick={() => handleSaveSingleTermWeeks(selectedTermId as any, currentTermWeeks)}
                      disabled={isSavingSingleTerm === selectedTermId}
                      className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95 border ${
                        savedTermSuccess[selectedTermId]
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 border-blue-400/40 text-white'
                      }`}
                      title={`Save ${currentTerm.name} (${currentTermWeeks} weeks) directly to Firebase Firestore`}
                    >
                      {isSavingSingleTerm === selectedTermId ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : savedTermSuccess[selectedTermId] ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-blue-200" />
                      )}
                      <span>
                        {isSavingSingleTerm === selectedTermId
                          ? 'Saving...'
                          : savedTermSuccess[selectedTermId]
                          ? 'Saved ✓'
                          : 'Save Weeks'}
                      </span>
                    </button>

                    {/* Open Full Configure Modal Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setTempWeeksConfig(termWeeksConfig);
                        setIsSettingWeeksModalOpen(true);
                      }}
                      className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                      title="Open full weeks per term configuration modal"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-white/10 border border-white/20 px-3.5 py-2.5 rounded-2xl text-xs font-mono text-white flex items-center space-x-2 font-bold">
                    <Calendar className="w-4 h-4 text-blue-300" />
                    <span>{currentTerm.name}: Weeks 1 to {currentTermWeeks}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/10 border border-white/20 px-3.5 py-2.5 rounded-2xl text-xs font-mono text-white flex items-center space-x-1.5 font-bold">
                <Calendar className="w-4 h-4 text-purple-300" />
                <span>All 3 Academic Terms</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-2xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95 border border-emerald-500/50"
              title="Download CSV Report"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold rounded-2xl transition-all border border-white/20 flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="Copy Summary Text"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copy Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION SELECTOR TABS: Class Advisers, DLL, TOS, and TQ */}
      <div className="bg-[#141c2c] p-2.5 sm:p-3 rounded-3xl border border-[#24334b] shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 flex-1">
            {CATEGORIES.map((cat) => {
              // FOR COORDINATOR: ONLY show the "Class Advisers" tab and REMOVE the DLL, TOS, and TQ tabs!
              // Since only "School Principal", "Master Teacher", and "Master Admin" can edit DLL, TOS, and TQ.
              if (isCoordinator && cat.id !== 'class-advisers') {
                return null;
              }

              // Show CLASS ADVISERS tab ONLY to Coordinator, Master Admin, and designated Class Advisers!
              // Those designated with "Non-Adviser" role will ONLY see DLL, TOS, and TQ!
              if (cat.id === 'class-advisers') {
                const canSeeClassAdviserTab = canManageClassAdvisers || isClassAdviser;
                if (!canSeeClassAdviserTab) {
                  return null;
                }
              }
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedItemToSave(0);
                  }}
                  className={`flex-1 min-w-[130px] px-3 py-3 rounded-2xl font-sans font-bold text-xs sm:text-sm transition-all duration-200 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 cursor-pointer border ${
                    isActive
                      ? `${cat.activeBg} border-transparent shadow-md scale-[1.01] text-white`
                      : 'bg-[#0d1524] text-slate-200 hover:text-white hover:bg-[#1a2638] border-[#24334b]'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <div className="text-center sm:text-left">
                    <span className="font-extrabold uppercase tracking-wider">{cat.name}</span>
                    <span className={`hidden md:inline ml-1 text-xs opacity-90 font-normal ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      • {cat.fullName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cloud Sync & Last Saved Indicator */}
          <div className="flex items-center justify-between sm:justify-end space-x-3 px-2 py-1 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-1.5 text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-bold">
              <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Firebase Cloud Sync</span>
            </div>
            {lastSavedTimestamp && (
              <span className="text-[11px] text-slate-400 hidden lg:inline">
                Saved at {lastSavedTimestamp}
              </span>
            )}
          </div>
        </div>

        {/* Current Active Category Description Banner */}
        <div className="mt-2.5 pt-2.5 border-t border-[#24334b] px-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 font-mono gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100">{currentCategory.name}:</span>
            <span className="text-slate-300">{currentCategory.fullName} — {currentCategory.shortDescription}</span>
          </div>
          <div className="text-slate-400 font-medium">
            {activeCategory === 'class-advisers' ? (
              <span className="font-bold text-emerald-400">
                Section 1: SF 1, 3, 4, 5, 6, 8, 10 • Section 2: SF 2 Monthly Attendance (June–April)
              </span>
            ) : isWeeklyCategory ? (
              <>
                Active: <span className="font-bold text-blue-400">{currentTerm.name}</span> • <span className="font-bold text-indigo-400">Weeks 1 to {currentTermWeeks}</span>
              </>
            ) : (
              <>
                Checklist: <span className="font-bold text-purple-400">TERM 1 ({activeCategory.toUpperCase()}: ST 1, ST 2, TE 1)</span> • <span className="font-bold text-purple-400">TERM 2 ({activeCategory.toUpperCase()}: ST 1, ST 2, TE 2)</span> • <span className="font-bold text-purple-400">TERM 3 ({activeCategory.toUpperCase()}: ST 1, ST 2, TE 3)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Metrics Cards (Administrator Only) */}
      {isAdmin && (
        activeCategory === 'class-advisers' ? (
          canManageClassAdvisers ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Metric 1: Total Class Advisers */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>Class Advisers</span>
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                  {adviserStats.totalAdvisers}
                </span>
                <span className="text-xs text-slate-400 font-mono">advisers</span>
              </div>
              <p className="text-[11px] text-emerald-400 truncate font-mono">
                Designated Class Advisers
              </p>
            </div>

            {/* Metric 2: Section 1 Compliance (SF 1, 3, 4, 5, 6, 8, 10) */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>Section 1 (SF 1-10)</span>
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-xl">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                  {adviserStats.sfPercentage}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({adviserStats.sfTotalComplied}/{adviserStats.sfTotalPossible})
                </span>
              </div>
              <div className="w-full bg-[#0d1524] rounded-full h-2 overflow-hidden border border-[#24334b]">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${adviserStats.sfPercentage}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Section 2 Compliance (SF 2 June to April) */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>Section 2 (SF 2 Monthly)</span>
                <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-xl">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                  {adviserStats.sf2Percentage}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({adviserStats.sf2TotalComplied}/{adviserStats.sf2TotalPossible})
                </span>
              </div>
              <div className="w-full bg-[#0d1524] rounded-full h-2 overflow-hidden border border-[#24334b]">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${adviserStats.sf2Percentage}%` }}
                />
              </div>
            </div>

            {/* Metric 4: 100% Fully Compliant Advisers */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>100% Compliant</span>
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                  {adviserStats.fullyCompliantAdvisers}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  / {adviserStats.totalAdvisers}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300 font-mono truncate font-medium">
                Completed all SF & SF 2
              </p>
            </div>

            {/* Metric 5: SF 1 to 10 Forms */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>Forms Monitored</span>
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xl">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                  7 Forms
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                SF 1, 3, 4, 5, 6, 8, 10
              </p>
            </div>

            {/* Metric 6: SF 2 Attendance Months */}
            <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
                <span>SF 2 Months</span>
                <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-teal-300 font-mono">
                  11 Months
                </span>
              </div>
              <p className="text-[11px] text-teal-400 truncate font-mono font-medium">
                June to April School Year
              </p>
            </div>
          </div>
          ) : null
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Metric 1: Overall Compliance */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>{currentCategory.name} Compliance</span>
              <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                {stats.overallPercentage}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({stats.totalCompleted}/{stats.totalPossible} {isWeeklyCategory ? 'wks' : 'terms'})
              </span>
            </div>
            <div className="w-full bg-[#0d1524] rounded-full h-2 overflow-hidden border border-[#24334b]">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.overallPercentage}%` }}
              />
            </div>
          </div>

          {/* Metric 2: Registered Faculty */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>Registered Faculty</span>
              <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                {stats.totalFaculty}
              </span>
              <span className="text-xs text-slate-400 font-mono">teachers</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              JHS & SHS Teachers
            </p>
          </div>

          {/* Metric 3: Checked Clean */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>Checked (Clean)</span>
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {stats.totalCleanChecked}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                / {stats.totalCompleted} submitted
              </span>
            </div>
            <p className="text-[11px] text-emerald-300 font-mono font-medium truncate">
              {stats.completedFacultyCount} teacher(s) 100% compliant ({isWeeklyCategory ? `Weeks 1–${currentTermWeeks}` : 'Terms 1, 2 & 3'})
            </p>
          </div>

          {/* Metric 4: With Comments (Corrections) */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>With Comments</span>
              <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xl">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                {stats.totalWithComments}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                deliverables
              </span>
            </div>
            <p className="text-[11px] text-amber-300 truncate font-mono font-medium">
              {stats.facultyWithCommentsCount} faculty member(s) have corrections
            </p>
          </div>

          {/* Metric 5: Incomplete (Lacking Requirements) */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>Incomplete (Lacking)</span>
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-xl">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">
                {stats.totalIncomplete}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                lacking
              </span>
            </div>
            <p className="text-[11px] text-rose-300 truncate font-mono font-medium">
              {stats.facultyWithIncompleteCount} faculty member(s) have lacking items
            </p>
          </div>

          {/* Metric 6: Late Submissions */}
          <div className="bg-[#141c2c] p-4 sm:p-5 rounded-3xl border border-[#24334b] shadow-2xs space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-medium">
              <span>Late Submissions</span>
              <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-orange-400 font-mono">
                {stats.totalLate}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                late
              </span>
            </div>
            <p className="text-[11px] text-orange-300 truncate font-mono font-medium">
              {stats.facultyWithLateCount} faculty member(s) have late deliveries
            </p>
          </div>
        </div>
        )
      )}

      {/* NON-ADMIN FACULTY HIGHLIGHT CARD (When Directory Table is Hidden) */}
      {!isAdmin && (
        activeCategory === 'class-advisers' ? (
          isClassAdviser ? (
            renderClassAdviserFacultyPersonalView()
          ) : (
            <div className="bg-[#141c2c] border border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xl mx-auto">
                🔒
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-sans">
                Class Adviser Section Restricted
              </h3>
              <p className="text-xs text-slate-300 font-mono max-w-md mx-auto">
                You are currently designated with the "Non-Adviser" role. Only designated Class Advisers, the Coordinator, and Master Admin have access to Class Adviser school forms.
              </p>
            </div>
          )
        ) : (
        <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🌟</span>
                <h3 className="text-base font-bold text-slate-100 font-sans">
                  My {currentCategory.fullName} ({currentCategory.name}) Submission Status
                </h3>
                <span className="bg-blue-600 text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {currentUser.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">
                {isWeeklyCategory
                  ? `${currentTerm.name} instructional progress. Green indicates verified with no comments; Amber indicates corrections requested; Red indicates lacking requirements; Orange indicates late submission.`
                  : `Academic terms progress for ${currentCategory.name} (Term 1, Term 2, Term 3). Check below for review status and feedback.`}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-extrabold text-blue-400 font-mono">
                  {myStatus.itemsSubmitted} / {totalItemCount} {isWeeklyCategory ? 'Weeks' : 'Deliverables'}
                </div>
                <div className="text-xs text-slate-400 font-mono font-bold">
                  {myStatus.percentage}% Complete
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#0d1524] border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 shadow-2xs text-lg font-mono">
                {myStatus.percentage}%
              </div>
            </div>
          </div>

          {/* Breakdown summary pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-mono font-bold border border-emerald-500/40">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{myStatus.cleanCheckedCount} Checked (No Comments)</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-mono font-bold border border-amber-500/40">
              <MessageSquare className="w-3.5 h-3.5 fill-current" />
              <span>{myStatus.withCommentsCount} With Comments</span>
            </div>
            {myStatus.incompleteCount > 0 && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-mono font-bold border border-rose-500/40">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>{myStatus.incompleteCount} Incomplete (Lacking)</span>
              </div>
            )}
            {myStatus.lateCount > 0 && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-orange-500/20 text-orange-300 rounded-xl text-xs font-mono font-bold border border-orange-500/40">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>{myStatus.lateCount} Late</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-[#0d1524] text-slate-300 rounded-xl text-xs font-mono font-bold border border-[#24334b]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{myStatus.pendingCount} Pending</span>
            </div>
          </div>

          {/* Item Checkmarks Visualizer for this Faculty Member */}
          <div className="pt-3 border-t border-[#24334b] space-y-2.5">
            <span className="text-xs font-mono font-bold text-slate-300 block">Deliverable Statuses:</span>
            {termGroups ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {termGroups.map((group) => {
                  const groupCols = columnItems.slice(group.startIndex, group.startIndex + group.span);
                  const groupCheckedCount = groupCols.filter((c) => {
                    const st = myStatus.itemsStatuses[c.index] || (myStatus.items[c.index] ? 'checked' : 'unchecked');
                    return st === 'checked' || st === 'with-comments' || st === 'late';
                  }).length;
                  return (
                    <div
                      key={group.label}
                      className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-[#24334b] pb-2">
                        <span className={`text-xs font-mono font-black tracking-wide ${
                          activeCategory === 'tos' ? 'text-purple-300' : 'text-amber-300'
                        }`}>
                          {group.label}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#141c2c] text-slate-300 border border-[#24334b]">
                          {groupCheckedCount} / {groupCols.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {groupCols.map((col) => {
                          const status = myStatus.itemsStatuses[col.index] || (myStatus.items[col.index] ? 'checked' : 'unchecked');
                          const comment = myStatus.itemsComments[col.index] || '';
                          const isChecked = status === 'checked';
                          const isWithComments = status === 'with-comments';
                          const isIncomplete = status === 'incomplete';
                          const isLate = status === 'late';
                          const displayLabel = col.headerLabel;

                          if (isIncomplete) {
                            return (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() =>
                                  setFacultyDetailModal({
                                    colLabel: col.fullLabel,
                                    status: 'incomplete',
                                    comment: comment || 'This submission was marked incomplete (lacking requirements) by the administrator.',
                                  })
                                }
                                className="px-2 py-1.5 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center border bg-rose-500 text-white border-rose-600 shadow-2xs hover:bg-rose-600 transition-all cursor-pointer"
                                title={`${col.fullLabel}: Incomplete • Click to view`}
                              >
                                <span>{displayLabel}</span>
                                <AlertCircle className="w-3 h-3 mt-0.5" />
                              </button>
                            );
                          }

                          if (isWithComments) {
                            return (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() =>
                                  setFacultyDetailModal({
                                    colLabel: col.fullLabel,
                                    status: 'with-comments',
                                    comment: comment || 'This submission was checked and marked with corrections by the administrator.',
                                  })
                                }
                                className="px-2 py-1.5 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center border bg-amber-500 text-white border-amber-600 shadow-2xs hover:bg-amber-600 transition-all cursor-pointer"
                                title={`${col.fullLabel}: With Comments • Click to view`}
                              >
                                <span>{displayLabel}</span>
                                <MessageSquare className="w-3 h-3 fill-current mt-0.5" />
                              </button>
                            );
                          }

                          if (isLate) {
                            return (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() =>
                                  setFacultyDetailModal({
                                    colLabel: col.fullLabel,
                                    status: 'late',
                                    comment: comment || 'This submission was marked as submitted past deadline by the administrator.',
                                  })
                                }
                                className="px-2 py-1.5 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center border bg-orange-500 text-white border-orange-600 shadow-2xs hover:bg-orange-600 transition-all cursor-pointer"
                                title={`${col.fullLabel}: Late • Click to view`}
                              >
                                <span>{displayLabel}</span>
                                <Clock className="w-3 h-3 mt-0.5" />
                              </button>
                            );
                          }

                          if (isChecked) {
                            return (
                              <div
                                key={col.key}
                                className="px-2 py-1.5 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center border bg-emerald-500 text-white border-emerald-600 shadow-2xs"
                                title={`${col.fullLabel}: Checked (Clean / Approved)`}
                              >
                                <span>{displayLabel}</span>
                                <Check className="w-3 h-3 stroke-[3] mt-0.5" />
                              </div>
                            );
                          }

                          return (
                            <div
                              key={col.key}
                              className="px-2 py-1.5 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center border bg-[#0d1524] text-slate-400 border-[#24334b]"
                              title={`${col.fullLabel}: Pending`}
                            >
                              <span>{displayLabel}</span>
                              <Clock className="w-3 h-3 text-slate-500 mt-0.5" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {columnItems.map((col, idx) => {
                  const status = myStatus.itemsStatuses[idx] || (myStatus.items[idx] ? 'checked' : 'unchecked');
                  const comment = myStatus.itemsComments[idx] || '';
                  const isChecked = status === 'checked';
                  const isWithComments = status === 'with-comments';
                  const isIncomplete = status === 'incomplete';
                  const isLate = status === 'late';
                  const displayLabel = isWeeklyCategory ? col.headerLabel : col.shortLabel;

                  if (isIncomplete) {
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() =>
                          setFacultyDetailModal({
                            colLabel: col.fullLabel,
                            status: 'incomplete',
                            comment: comment || 'This submission was marked incomplete (lacking requirements) by the administrator.',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border bg-rose-500 text-white border-rose-600 shadow-2xs hover:bg-rose-600 transition-all cursor-pointer"
                        title={`${col.fullLabel}: Incomplete (Lacking Requirements) • Click to view what is lacking`}
                      >
                        <span>{displayLabel}</span>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] bg-rose-700/60 px-1.5 py-0.5 rounded-md font-medium">Incomplete</span>
                      </button>
                    );
                  }

                  if (isWithComments) {
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() =>
                          setFacultyDetailModal({
                            colLabel: col.fullLabel,
                            status: 'with-comments',
                            comment: comment || 'This submission was checked and marked with corrections by the administrator.',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border bg-amber-500 text-white border-amber-600 shadow-2xs hover:bg-amber-600 transition-all cursor-pointer"
                        title={`${col.fullLabel}: Checked with Comments • Click to view administrator feedback`}
                      >
                        <span>{displayLabel}</span>
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[10px] bg-amber-700/60 px-1.5 py-0.5 rounded-md font-medium">With Comments</span>
                      </button>
                    );
                  }

                  if (isLate) {
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() =>
                          setFacultyDetailModal({
                            colLabel: col.fullLabel,
                            status: 'late',
                            comment: comment || 'This submission was marked as submitted past deadline by the administrator.',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border bg-orange-500 text-white border-orange-600 shadow-2xs hover:bg-orange-600 transition-all cursor-pointer"
                        title={`${col.fullLabel}: Late (Submitted Late) • Click to view remarks`}
                      >
                        <span>{displayLabel}</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] bg-orange-700/60 px-1.5 py-0.5 rounded-md font-medium">Late</span>
                      </button>
                    );
                  }

                  if (isChecked) {
                    return (
                      <div
                        key={col.key}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border bg-emerald-500 text-white border-emerald-600 shadow-2xs"
                        title={`${col.fullLabel}: Checked (Clean / No Comments)`}
                      >
                        <span>{displayLabel}</span>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="text-[10px] bg-emerald-700/60 px-1.5 py-0.5 rounded-md font-medium">Checked</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={col.key}
                      className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border bg-[#0d1524] text-slate-300 border-[#24334b]"
                      title={`${col.fullLabel}: Pending`}
                    >
                      <span>{displayLabel}</span>
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Pending</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prominent Admin Incomplete / Lacking Feedback Panel */}
          {myStatus.incompleteCount > 0 && (
            <div className="mt-3 pt-3 border-t border-[#24334b] bg-rose-500/10 rounded-2xl p-4 border border-rose-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs font-mono">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Lacking Submission Requirements ({myStatus.incompleteCount} item{myStatus.incompleteCount > 1 ? 's' : ''} marked Incomplete):</span>
                </div>
                <span className="text-[11px] font-mono text-rose-200 bg-rose-500/30 px-2.5 py-0.5 rounded-full font-bold border border-rose-500/40">
                  Missing Requirements
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {columnItems.map((col, idx) => {
                  if (myStatus.itemsStatuses[idx] !== 'incomplete') return null;
                  const commentText = myStatus.itemsComments[idx];
                  return (
                    <div key={col.key} className="bg-[#0d1524] border border-rose-500/40 rounded-xl p-3 text-xs font-mono space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          <span>{col.fullLabel}</span>
                        </span>
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40">
                          Incomplete / Lacking
                        </span>
                      </div>
                      <p className="text-slate-300 pl-3 border-l-2 border-rose-400 text-xs italic">
                        "{commentText || 'The submitted deliverable is lacking required parts, competencies, attachments, or signatures.'}"
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-rose-300 font-mono pt-1">
                ⚠️ <strong>Action Needed:</strong> Please provide the missing components and upload your complete file to your personal Faculty Folder.
              </p>
            </div>
          )}

          {/* Prominent Admin Comments Feedback Panel */}
          {myStatus.withCommentsCount > 0 && (
            <div className="mt-3 pt-3 border-t border-[#24334b] bg-amber-500/10 rounded-2xl p-4 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs font-mono">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Administrator Comments & Corrections ({myStatus.withCommentsCount} item{myStatus.withCommentsCount > 1 ? 's' : ''}):</span>
                </div>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/40">
                  Action Required
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {columnItems.map((col, idx) => {
                  if (myStatus.itemsStatuses[idx] !== 'with-comments') return null;
                  const commentText = myStatus.itemsComments[idx];
                  return (
                    <div key={col.key} className="bg-[#0d1524] border border-amber-500/40 rounded-xl p-3 text-xs font-mono space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                          <span>{col.fullLabel}</span>
                        </span>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                          With Comments
                        </span>
                      </div>
                      <p className="text-slate-300 pl-3 border-l-2 border-amber-400 text-xs italic">
                        "{commentText || 'Please review this submission and coordinate with the administrator for corrections.'}"
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-amber-300 font-mono pt-1">
                💡 <strong>Next Step:</strong> Please apply the necessary corrections and re-upload your revised file to your personal faculty folder.
              </p>
            </div>
          )}

          {/* Prominent Admin Late Submissions Panel */}
          {myStatus.lateCount > 0 && (
            <div className="mt-3 pt-3 border-t border-[#24334b] bg-orange-500/10 rounded-2xl p-4 border border-orange-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-orange-300 font-bold text-xs font-mono">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Late Submissions Recorded ({myStatus.lateCount} item{myStatus.lateCount > 1 ? 's' : ''}):</span>
                </div>
                <span className="text-[11px] font-mono text-orange-300 bg-orange-500/20 px-2.5 py-0.5 rounded-full font-bold border border-orange-500/40">
                  Submitted Late
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {columnItems.map((col, idx) => {
                  if (myStatus.itemsStatuses[idx] !== 'late') return null;
                  const commentText = myStatus.itemsComments[idx];
                  return (
                    <div key={col.key} className="bg-[#0d1524] border border-orange-500/40 rounded-xl p-3 text-xs font-mono space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-orange-300 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                          <span>{col.fullLabel}</span>
                        </span>
                        <span className="text-[10px] font-bold text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/40">
                          Late Submission
                        </span>
                      </div>
                      <p className="text-slate-300 pl-3 border-l-2 border-orange-400 text-xs italic">
                        "{commentText || 'Deliverable was received past the scheduled deadline.'}"
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-orange-300 font-mono pt-1">
                ⏰ <strong>Reminder:</strong> Please ensure upcoming deliverables are submitted on time according to the department schedule.
              </p>
            </div>
          )}

          {/* Clean Compliance Banner */}
          {myStatus.itemsSubmitted > 0 && myStatus.withCommentsCount === 0 && myStatus.incompleteCount === 0 && myStatus.lateCount === 0 && (
            <div className="mt-3 pt-3 border-t border-[#24334b] bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/30 flex items-center space-x-2 text-xs font-mono text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                All <strong>{myStatus.itemsSubmitted}</strong> of your submitted {currentCategory.name} records are <strong>Checked on-time with no comments</strong> (clean compliance). Great job!
              </span>
            </div>
          )}
        </div>
        )
      )}

      {/* SECTION 1: FACULTY SUBMISSION DIRECTORY (ADMINISTRATOR ONLY) */}
      {isAdmin ? (
        activeCategory === 'class-advisers' ? (
          canManageClassAdvisers ? (
            renderClassAdviserMatrix()
          ) : (
            <div className="bg-[#141c2c] border border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xl mx-auto">
                🔒
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-sans">
                Class Adviser Compliance Matrix Restricted
              </h3>
              <p className="text-xs text-slate-300 font-mono max-w-md mx-auto">
                Only the Coordinator and the Master Admin have permission to view and edit the Class Adviser compliance matrix.
              </p>
            </div>
          )
        ) : (
        <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-xs overflow-hidden">
          {/* Controls & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-[#24334b] bg-[#0f1725] space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-2xl ${currentCategory.activeBg} text-white flex items-center justify-center font-bold text-base shadow-sm`}>
                  {currentCategory.icon}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-sans">
                    {currentCategory.fullName} ({currentCategory.name}) Faculty Submission Directory
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {isWeeklyCategory
                      ? `Check each week (W1 – W${currentTermWeeks}) to record instructional submissions for all faculty members.`
                      : `Check each term deliverable: TERM 1 (ST 1, ST 2, TE 1), TERM 2 (ST 1, ST 2, TE 2), and TERM 3 (ST 1, ST 2, TE 3) for all faculty members.`}
                  </p>
                </div>
              </div>

              {/* Administrator Per-Item Retention & Save Controls */}
              {canEditDllTosTq ? (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Auto-Save Live Badge */}
                  <div
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-2xl text-xs font-mono font-bold select-none shadow-2xs"
                    title="Checkbox changes are automatically and immediately synced to Firebase Firestore in real-time"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Auto-Save Active</span>
                  </div>

                  {/* Specific Column Save Dropdown */}
                  <div className="flex items-center space-x-1 bg-[#0d1524] border border-[#24334b] p-1 rounded-2xl shadow-2xs">
                    <span className="text-[11px] font-mono font-bold text-slate-400 pl-2">Save:</span>
                    <select
                      value={selectedItemToSave}
                      onChange={(e) => setSelectedItemToSave(Number(e.target.value))}
                      aria-label="Select item to save"
                      className="bg-transparent text-xs font-mono font-bold text-slate-100 px-2 py-1 cursor-pointer focus:outline-hidden"
                    >
                      {columnItems.map((col, i) => (
                        <option key={col.key} value={i} className="bg-[#0d1524] text-slate-100">
                          {col.fullLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSaveItemToFirebase(selectedItemToSave)}
                      disabled={isSavingIndex === selectedItemToSave}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center space-x-1 cursor-pointer active:scale-95 shadow-2xs"
                      title={`Save ${columnItems[selectedItemToSave]?.fullLabel} data permanently to Firebase`}
                    >
                      {isSavingIndex === selectedItemToSave ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save {columnItems[selectedItemToSave]?.shortLabel}</span>
                    </button>
                  </div>

                  {/* Save All to Firebase Button */}
                  <button
                    type="button"
                    onClick={handleSaveAllToFirebase}
                    disabled={isSavingAll}
                    className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-2xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer active:scale-95"
                    title={`Save all ${currentCategory.name} records to Firebase Firestore for permanent retention`}
                  >
                    {isSavingAll ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4 text-indigo-200" />
                    )}
                    <span>Save All to Firebase</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span>View Only Mode (Only Principal, Master Teacher, and Master Admin can edit)</span>
                </div>
              )}
            </div>

            {/* Search, Filter & Status Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search faculty by name, surname, or email..."
                  className="w-full pl-9 pr-4 py-2 bg-[#0d1524] border border-[#24334b] rounded-xl text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-mono"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="sm:col-span-3">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  aria-label="Filter by Department or Strand"
                  className="w-full px-3 py-2 bg-[#0d1524] border border-[#24334b] rounded-xl text-xs font-mono text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all" className="bg-[#0d1524] text-slate-100">All Departments / Strands</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept} className="bg-[#0d1524] text-slate-100">
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="sm:col-span-4 flex items-center space-x-1 text-xs font-mono overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 min-w-[50px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  All ({allFaculty.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('complete')}
                  className={`flex-1 min-w-[50px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'complete'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  Done ({stats.completedFacultyCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('with-comments')}
                  className={`flex-1 min-w-[55px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'with-comments'
                      ? 'bg-amber-600 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  Comments ({stats.facultyWithCommentsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('incomplete')}
                  className={`flex-1 min-w-[55px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'incomplete'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  Incomplete ({stats.facultyWithIncompleteCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('late')}
                  className={`flex-1 min-w-[50px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'late'
                      ? 'bg-orange-600 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  Late ({stats.facultyWithLateCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('in-progress')}
                  className={`flex-1 min-w-[50px] py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'in-progress'
                      ? 'bg-slate-700 text-white'
                      : 'bg-[#0d1524] text-slate-300 border border-[#24334b] hover:bg-[#1a2638] hover:text-white'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
          </div>

          {/* Directory Table / Matrix View */}
          <div className="overflow-x-auto">
            <table className={`w-full text-left border-collapse ${termGroups ? 'min-w-[1040px]' : 'min-w-[700px]'}`}>
              <thead>
                {termGroups ? (
                  <>
                    {/* Tier 1 Header Row: Grouped by TERM 1 TOS/TQ, TERM 2 TOS/TQ, TERM 3 TOS/TQ */}
                    <tr className="bg-[#0d1524] text-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider border-b border-[#24334b]">
                      <th rowSpan={2} className="py-3 px-4 w-52 sm:w-64 border-r border-[#24334b] align-middle text-slate-200">
                        Faculty Member
                      </th>
                      <th rowSpan={2} className="py-3 px-3 w-32 sm:w-40 border-r border-[#24334b] align-middle text-slate-200">
                        Department
                      </th>
                      {termGroups.map((group, gIdx) => (
                        <th
                          key={group.label}
                          colSpan={group.span}
                          className={`py-2 px-3 text-center border-l-2 border-b border-[#24334b] font-black text-xs tracking-wider ${
                            activeCategory === 'tos'
                              ? 'bg-[#151c30] text-purple-300 border-t-2 border-t-purple-500 border-l-purple-500/40'
                              : 'bg-[#1c1a27] text-amber-300 border-t-2 border-t-amber-500 border-l-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-extrabold">{group.label}</span>
                          </div>
                        </th>
                      ))}
                      <th rowSpan={2} className="py-3 px-3 text-center w-24 border-l border-[#24334b] align-middle text-slate-200">
                        Progress
                      </th>
                      <th rowSpan={2} className="py-3 px-3 text-center w-24 border-l border-[#24334b] align-middle text-slate-200">
                        Quick Action
                      </th>
                    </tr>
                    {/* Tier 2 Sub-column Headers: ST 1, ST 2, TE 1 | ST 1, ST 2, TE 2 | ST 1, ST 2, TE 3 */}
                    <tr className="bg-[#090f1a] text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider border-b border-[#24334b]">
                      {columnItems.map((col) => {
                        const isTermStart = col.index % 3 === 0;
                        return (
                          <th
                            key={col.key}
                            className={`py-1.5 px-1 text-center ${
                              isTermStart ? 'border-l-2 border-l-[#3b4f73]' : 'border-l border-l-[#24334b]'
                            } w-12 sm:w-14`}
                            title={`${col.fullLabel}. Click save icon to persist to Firebase.`}
                          >
                            <div className="flex flex-col items-center justify-center">
                              <span
                                className={`text-[10.5px] font-black ${
                                  activeCategory === 'tos' ? 'text-purple-200' : 'text-amber-200'
                                }`}
                              >
                                {col.headerLabel}
                              </span>
                              {canEditDllTosTq && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveItemToFirebase(col.index)}
                                  disabled={isSavingIndex === col.index}
                                  className="mt-0.5 p-0.5 rounded text-slate-400 hover:text-blue-400 hover:bg-[#1c273a] transition-all cursor-pointer"
                                  title={`Save ${col.fullLabel} data to Firebase`}
                                >
                                  {isSavingIndex === col.index ? (
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-400" />
                                  ) : (
                                    <Save className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </>
                ) : (
                  /* Standard 1-Tier Header for DLL */
                  <tr className="bg-[#0d1524] text-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider border-b border-[#24334b]">
                    <th className="py-3 px-4 w-60 sm:w-72">Faculty Member</th>
                    <th className="py-3 px-3 w-36 sm:w-44">Department</th>
                    {columnItems.map((col) => (
                      <th
                        key={col.key}
                        className="py-2.5 px-2 text-center border-l border-[#24334b] w-12"
                        title={`${col.fullLabel}. Click save icon to persist to Firebase.`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[11px] font-extrabold text-blue-400">
                            {col.headerLabel}
                          </span>
                          {canEditDllTosTq && (
                            <button
                              type="button"
                              onClick={() => handleSaveItemToFirebase(col.index)}
                              disabled={isSavingIndex === col.index}
                              className="mt-0.5 p-0.5 rounded text-slate-400 hover:text-blue-400 hover:bg-[#1c273a] transition-all cursor-pointer"
                              title={`Save ${col.fullLabel} data to Firebase`}
                            >
                              {isSavingIndex === col.index ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center w-28 border-l border-[#24334b]">
                      Progress
                    </th>
                    <th className="py-3 px-3 text-center w-28">Quick Action</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-[#24334b] text-xs font-mono">
                {filteredFaculty.length === 0 ? (
                  <tr>
                    <td colSpan={4 + totalItemCount} className="py-12 text-center text-slate-400 bg-[#141c2c]">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <div className="font-bold text-sm text-slate-200">No faculty members found</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Try adjusting your search query or department filter.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredFaculty.map((faculty) => {
                    const items = submissions[faculty.email] || Array(totalItemCount).fill(false);
                    const visibleSlice = items.slice(0, totalItemCount);
                    const completedCount = visibleSlice.filter(Boolean).length;
                    const pct = Math.round((completedCount / totalItemCount) * 100);
                    const isAllChecked = completedCount === totalItemCount;

                    return (
                      <tr
                        key={faculty.email}
                        className="bg-[#141c2c] hover:bg-[#1c273c] transition-colors border-b border-[#24334b]"
                      >
                        {/* Faculty Name & Info (Uniform clean styling, no alternating color) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[11px] text-blue-300 shrink-0 shadow-2xs bg-[#1f2d45] border border-[#2d4060]"
                            >
                              {faculty.surname.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate text-xs">
                                {faculty.surname}, {faculty.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate font-mono">
                                {faculty.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-300 text-[11px]">
                          <span className="bg-[#0d1524] text-slate-300 border border-[#24334b] px-2 py-0.5 rounded-md truncate max-w-[140px] inline-block font-sans font-medium">
                            {faculty.department || 'SHS Dept.'}
                          </span>
                        </td>

                        {/* Checkboxes (Weeks or Term 1, Term 2, Term 3) */}
                        {columnItems.map((col) => {
                          const itemStatus = getItemStatus(faculty.email, col.index);
                          const itemComment = getItemComment(faculty.email, col.index);
                          const isCurrentlySaving = autoSavingItemKey === `${faculty.email.toLowerCase().trim()}_${col.index}`;
                          const isChecked = itemStatus === 'checked';
                          const isWithComments = itemStatus === 'with-comments';
                          const isIncomplete = itemStatus === 'incomplete';
                          const isLate = itemStatus === 'late';
                          const isTermStart = termGroups && col.index % 3 === 0;

                          return (
                            <td
                              key={col.key}
                              className={`py-2 px-1 text-center ${
                                isTermStart ? 'border-l-2 border-l-[#3b4f73]' : 'border-l border-l-[#24334b]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => canEditDllTosTq && handleOpenCellAction(faculty, col)}
                                disabled={!canEditDllTosTq}
                                aria-label={`Review ${col.fullLabel} for ${faculty.name}`}
                                className={`rounded-lg border flex items-center justify-center mx-auto transition-all ${canEditDllTosTq ? 'cursor-pointer active:scale-90' : 'cursor-default'} relative ${
                                  isWeeklyCategory ? 'w-7 h-7' : 'w-7 h-7 sm:w-8 sm:h-7'
                                } ${
                                  isChecked
                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs hover:bg-emerald-600'
                                    : isWithComments
                                    ? 'bg-amber-500 border-amber-600 text-white shadow-2xs hover:bg-amber-600 ring-1 ring-amber-400'
                                    : isIncomplete
                                    ? 'bg-rose-500 border-rose-600 text-white shadow-2xs hover:bg-rose-600 ring-1 ring-rose-400'
                                    : isLate
                                    ? 'bg-orange-500 border-orange-600 text-white shadow-2xs hover:bg-orange-600 ring-1 ring-orange-400'
                                    : 'bg-[#0d1524] border-[#24334b] text-transparent hover:border-slate-500 hover:bg-[#1a2638]'
                                } ${isCurrentlySaving ? 'ring-2 ring-blue-400 ring-offset-1 scale-95' : ''}`}
                                title={`${faculty.name} - ${col.fullLabel}: ${
                                  isChecked
                                    ? 'Checked (No Comments / Approved)'
                                    : isWithComments
                                    ? `With Comments: "${itemComment || 'Feedback recorded'}"`
                                    : isIncomplete
                                    ? `Incomplete (Lacking): "${itemComment || 'Lacking requirements'}"`
                                    : isLate
                                    ? `Late (Submitted Late): "${itemComment || 'Submitted past deadline'}"`
                                    : 'Pending / Not Checked'
                                } • Click to select Checked, With Comments, Incomplete, Late, or Pending`}
                              >
                                {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                                {isWithComments && <MessageSquare className="w-3.5 h-3.5 fill-current" />}
                                {isIncomplete && <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
                                {isLate && <Clock className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </button>
                            </td>
                          );
                        })}

                        {/* Progress Bar & Number */}
                        <td className="py-3 px-3 text-center border-l border-[#24334b]">
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                isAllChecked
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : completedCount >= Math.ceil(totalItemCount / 2)
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : completedCount > 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-[#0d1524] text-slate-400 border border-[#24334b]'
                              }`}
                            >
                              {completedCount} / {totalItemCount}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-bold">
                              {pct}%
                            </span>
                          </div>
                        </td>

                        {/* Quick Action Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => canEditDllTosTq && handleCheckAllItems(faculty.email, !isAllChecked)}
                            disabled={!canEditDllTosTq}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all ${
                              !canEditDllTosTq
                                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700'
                                : isAllChecked
                                ? 'bg-[#1c273a] text-slate-300 hover:bg-[#25344d] border border-[#2d3e57] cursor-pointer'
                                : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/40 cursor-pointer'
                            }`}
                            title={!canEditDllTosTq ? 'Only Principal, Master Teacher, and Master Admin can edit' : isAllChecked ? `Clear all ${currentCategory.name} submissions` : `Mark all ${currentCategory.name} complete (Checked)`}
                          >
                            {isAllChecked ? 'Reset' : 'Check All'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Directory Footer Info */}
          <div className="p-4 bg-[#0f1725] border-t border-[#24334b] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 inline-flex items-center justify-center text-white text-[9px] font-bold">✓</span>
                <span className="text-slate-200 font-bold">Checked</span> (No comments)
              </div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-500 inline-flex items-center justify-center text-white text-[9px]">💬</span>
                <span className="text-amber-300 font-bold">With Comments</span> (Corrections)
              </div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-rose-500 inline-flex items-center justify-center text-white text-[9px] font-bold">!</span>
                <span className="text-rose-300 font-bold">Incomplete</span> (Lacking requirements)
              </div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-orange-500 inline-flex items-center justify-center text-white text-[9px]">⏰</span>
                <span className="text-orange-300 font-bold">Late</span> (Submitted late)
              </div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-[#0d1524] border border-[#24334b] inline-block" />
                <span className="text-slate-400">Empty</span> (Pending)
              </div>
            </div>
            <div>
              Showing <span className="font-bold text-slate-200">{filteredFaculty.length}</span> faculty members for{' '}
              <span className="font-bold text-blue-400">
                {currentCategory.name} • {isWeeklyCategory ? `${currentTerm.name} (Weeks 1–${currentTermWeeks})` : 'Term 1, Term 2 & Term 3'}
              </span>
            </div>
          </div>
        </div>
        )
      ) : null}

      {/* SECTION 2: FACULTY SUBMISSION PROGRESS VISUALIZER (ADMINISTRATOR ONLY) */}
      {isAdmin && activeCategory !== 'class-advisers' ? (
        <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24334b] pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-300">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 font-sans">
                    {currentCategory.fullName} ({currentCategory.name}) Progress Visualizer
                  </h3>
                  <span className="bg-blue-500/20 text-blue-300 text-xs font-mono px-2 py-0.5 rounded-full font-bold border border-blue-500/40">
                    {isWeeklyCategory ? currentTerm.name : 'Terms 1, 2 & 3'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {isWeeklyCategory
                    ? `Analytical charts representing submitted weeks out of ${currentTermWeeks} for all faculty members.`
                    : `Visualizer showing Term 1 ${currentCategory.name}, Term 2 ${currentCategory.name}, and Term 3 ${currentCategory.name} compliance.`}
                </p>
              </div>
            </div>

            {/* Toggle View: Admin Visualizer Modes */}
            <div className="flex items-center space-x-1.5 bg-[#0d1524] p-1 rounded-2xl border border-[#24334b] text-xs font-mono font-bold">
              <button
                type="button"
                onClick={() => setViewMode('faculty-chart')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'faculty-chart'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                By Faculty Member
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly-chart')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'weekly-chart'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {isWeeklyCategory ? `Weekly Trend (W1–W${currentTermWeeks})` : `Term Trend`}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pie-chart')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'pie-chart'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Pie Chart</span>
              </button>
            </div>
          </div>

          {/* ADMIN VISUALIZER PIE CHART VIEW */}
          {viewMode === 'pie-chart' ? (
            <div className="space-y-6">
              {/* Render Selected Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Faculty Compliance Status Pie Chart */}
                <div className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                        <span>Faculty Compliance Status Breakdown</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Distribution across {stats.totalFaculty} teachers ({currentCategory.name})
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                      {stats.overallPercentage}% Overall
                    </span>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={compliancePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          nameKey="name"
                        >
                          {compliancePieData.map((entry, index) => (
                            <Cell key={`cell-comp-${index}`} fill={entry.color} stroke="#141c2c" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-mono space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                    <span className="font-bold text-white text-xs">{data.name}</span>
                                  </div>
                                  <div className="text-slate-300 text-xs pt-1 border-t border-slate-800">
                                    Faculty Count: <span className="font-bold text-emerald-400">{data.value}</span> / {stats.totalFaculty} ({data.percentage}%)
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {data.description}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => <span className="text-xs font-mono font-medium text-slate-700">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/80 text-center font-mono">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">100% Done</div>
                      <div className="text-sm font-extrabold text-emerald-800">
                        {stats.completedFacultyCount} <span className="text-[10px] font-normal text-emerald-600">({Math.round((stats.completedFacultyCount / (stats.totalFaculty || 1)) * 100)}%)</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="text-[10px] text-amber-700 font-bold uppercase">In Progress</div>
                      <div className="text-sm font-extrabold text-amber-800">
                        {stats.inProgressFacultyCount} <span className="text-[10px] font-normal text-amber-600">({Math.round((stats.inProgressFacultyCount / (stats.totalFaculty || 1)) * 100)}%)</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="text-[10px] text-slate-600 font-bold uppercase">Pending</div>
                      <div className="text-sm font-extrabold text-slate-700">
                        {stats.noSubmissionFacultyCount} <span className="text-[10px] font-normal text-slate-500">({Math.round((stats.noSubmissionFacultyCount / (stats.totalFaculty || 1)) * 100)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Deliverables Target Ratio Pie Chart */}
                <div className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                        <span>Deliverables Target Volume Ratio</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {stats.totalCompleted} submitted of {stats.totalPossible} expected deliverables
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full">
                      {stats.totalCompleted} / {stats.totalPossible}
                    </span>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={volumePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          nameKey="name"
                        >
                          {volumePieData.map((entry, index) => (
                            <Cell key={`cell-vol-${index}`} fill={entry.color} stroke="#141c2c" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-[#0d1524] text-white p-3 rounded-2xl shadow-xl border border-[#24334b] text-xs font-mono space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                    <span className="font-bold text-white text-xs">{data.name}</span>
                                  </div>
                                  <div className="text-slate-300 text-xs pt-1 border-t border-[#24334b]">
                                    Deliverables: <span className="font-bold text-blue-400">{data.value}</span> / {stats.totalPossible} ({data.percentage}%)
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {data.description}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => <span className="text-xs font-mono font-medium text-slate-300">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#24334b] text-center font-mono">
                    <div className="p-2.5 rounded-xl bg-[#0d1524] border border-blue-500/30">
                      <div className="text-[10px] text-blue-300 font-bold uppercase">Submitted Files</div>
                      <div className="text-sm font-extrabold text-blue-400">
                        {stats.totalCompleted} <span className="text-[10px] font-normal text-blue-300">({stats.overallPercentage}%)</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d1524] border border-[#24334b]">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Pending Files</div>
                      <div className="text-sm font-extrabold text-slate-200">
                        {Math.max(0, stats.totalPossible - stats.totalCompleted)} <span className="text-[10px] font-normal text-slate-400">({100 - stats.overallPercentage}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Chart 3: Period / Weekly Submissions Pie Breakdown */}
            <div className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                      <span>
                        {isWeeklyCategory
                          ? `Weekly Submission Distribution (${currentTerm.name} • W1 to W${currentTermWeeks})`
                          : `Term Compliance Distribution (Term 1, Term 2 & Term 3)`}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Submissions recorded per {isWeeklyCategory ? 'week' : 'term'} milestone across all faculty
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full">
                    {totalItemCount} {isWeeklyCategory ? 'Weeks' : 'Terms'}
                  </span>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={periodDistributionPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {periodDistributionPieData.map((entry, index) => (
                          <Cell key={`cell-period-${index}`} fill={entry.color} stroke="#141c2c" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#0d1524] text-white p-3 rounded-2xl shadow-xl border border-[#24334b] text-xs font-mono space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  <span className="font-bold text-white text-xs">{data.fullName || data.name}</span>
                                </div>
                                <div className="text-slate-300 text-xs pt-1 border-t border-[#24334b]">
                                  Faculty Submitted: <span className="font-bold text-emerald-400">{data.value}</span> / {data.totalFaculty} ({data.percentage}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={40}
                        formatter={(value) => <span className="text-xs font-mono font-medium text-slate-300">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            {/* Department Aggregate Summary Stats Footer */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono shadow-md">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Official SVNHS {currentCategory.fullName} ({currentCategory.name}) Compliance Report
                </span>
              </div>
              <div className="text-slate-400">
                Department Total: <span className="font-bold text-emerald-400">{stats.totalCompleted}</span> / {stats.totalPossible} deliverables ({stats.overallPercentage}%)
              </div>
            </div>
          </div>
        ) : viewMode === 'faculty-chart' ? (
          /* ADMIN: BAR CHART BY FACULTY MEMBER */
          <div className="space-y-3">
            <div className="h-[380px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={facultyChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 65 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}
                    height={60}
                  />
                  <YAxis
                    domain={[0, totalItemCount]}
                    ticks={Array.from({ length: totalItemCount + 1 }, (_, i) => i).filter(
                      (i) => totalItemCount <= 6 || i % 2 === 0 || i === totalItemCount
                    )}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    label={{
                      value: `${currentCategory.name} Submitted (out of ${totalItemCount})`,
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#94a3b8',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      dy: 70,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-mono space-y-1">
                            <div className="font-bold text-sm text-blue-300">{data.fullName}</div>
                            <div className="text-slate-400 text-[11px]">{data.department}</div>
                            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between space-x-3">
                              <span className="text-slate-300">{currentCategory.name} Submitted:</span>
                              <span className="font-extrabold text-emerald-400 text-sm">
                                {data.submittedCount} / {totalItemCount} {isWeeklyCategory ? 'Weeks' : 'Terms'} ({data.percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="submittedCount" radius={[8, 8, 0, 0]} maxBarSize={45}>
                    {facultyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.submittedCount, totalItemCount)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                <span>{totalItemCount} {isWeeklyCategory ? 'Weeks' : 'Terms'} (100% Complete)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" />
                <span>≥ 70% (High Compliance)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
                <span>≥ 40% (Moderate)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-orange-500 inline-block" />
                <span>1 – {Math.max(1, Math.floor(totalItemCount * 0.4))} (Low)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-400 inline-block" />
                <span>0 (No Submission)</span>
              </div>
            </div>
          </div>
        ) : (
          /* ADMIN: BAR CHART BY WEEKLY / TERM TREND */
          <div className="space-y-3">
            <div className="h-[360px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trendChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}
                  />
                  <YAxis
                    domain={[0, allFaculty.length > 0 ? allFaculty.length : 10]}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    label={{
                      value: `Number of Faculty Submitted (${currentCategory.name})`,
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#94a3b8',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      dy: 80,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-mono space-y-1">
                            <div className="font-bold text-sm text-blue-300">{data.itemLabel}</div>
                            <div className="pt-1 flex items-center justify-between space-x-3">
                              <span className="text-slate-300">Compliance:</span>
                              <span className="font-extrabold text-emerald-400">
                                {data.submittedCount} / {data.totalFaculty} ({data.percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="submittedCount" fill="#3B82F6" radius={[8, 8, 0, 0]} maxBarSize={55}>
                    {trendChartData.map((entry, index) => (
                      <Cell
                        key={`cell-trend-${index}`}
                        fill={entry.percentage >= 80 ? '#10B981' : entry.percentage >= 50 ? '#3B82F6' : '#F59E0B'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
              Department-wide {currentCategory.fullName} ({currentCategory.name}) compliance breakdown for{' '}
              {isWeeklyCategory ? `${currentTerm.name} (Weeks 1 to ${currentTermWeeks})` : 'Term 1, Term 2 and Term 3'}
            </div>
          </div>
        )}
      </div>
    ) : null}

      {/* ADMIN: SET NUMBER OF WEEKS PER TERM MODAL (1 to 12 Weeks Max) */}
      {isSettingWeeksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-slate-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 flex items-start justify-between shrink-0 border-b border-[#24334b]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-400/30">
                  <CalendarDays className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-sans tracking-tight text-white">
                    Set Number of Weeks per Term
                  </h3>
                  <p className="text-xs text-blue-200/80 font-mono">
                    Configure instructional week checkboxes for each academic term (Max: 12 Weeks)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingWeeksModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0 overscroll-contain bg-[#141c2c]">
              {/* Default Active Academic Term (On Page Load & Refresh) */}
              <div className="bg-[#0f1725] border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-100 text-xs font-mono uppercase tracking-wider">
                        Default Current Academic Term
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Saved in Firebase so the page automatically opens this term on load and refresh
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 self-start sm:self-auto">
                    <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/40">
                      Active: {activeDefaultTermId === 'term-1' ? '1st Term' : activeDefaultTermId === 'term-2' ? '2nd Term' : '3rd Term'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'term-1', name: '1st Academic Term' },
                      { id: 'term-2', name: '2nd Academic Term' },
                      { id: 'term-3', name: '3rd Academic Term' },
                    ] as const
                  ).map((t) => {
                    const isCurrentDefault = activeDefaultTermId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSetCurrentActiveTerm(t.id)}
                        disabled={isSettingActiveTerm}
                        className={`px-3 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer border ${
                          isCurrentDefault
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                            : 'bg-[#0d1524] hover:bg-[#1a2638] text-slate-200 border-[#24334b] hover:border-amber-500/40'
                        }`}
                        title={`Click to set ${t.name} as the official default term saved in Firebase`}
                      >
                        <span className="flex items-center space-x-1.5">
                          {isCurrentDefault ? (
                            <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                          )}
                          <span>{t.name}</span>
                        </span>
                        {isCurrentDefault && (
                          <span className="text-[10px] bg-slate-950/20 text-slate-950 px-1.5 py-0.5 rounded-md font-extrabold">
                            Saved ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Presets & Auto-save Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-500">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cfg = { 'term-1': 11, 'term-2': 11, 'term-3': 11 };
                      setTempWeeksConfig(cfg);
                      if (autoSaveEnabled) {
                        saveTermWeeksConfigToFirestore(cfg);
                        setTermWeeksConfig(cfg);
                        showToast('💾 Applied and auto-saved 11 Weeks preset to Firebase!');
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer"
                  >
                    Default 11 Wks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cfg = { 'term-1': 10, 'term-2': 10, 'term-3': 10 };
                      setTempWeeksConfig(cfg);
                      if (autoSaveEnabled) {
                        saveTermWeeksConfigToFirestore(cfg);
                        setTermWeeksConfig(cfg);
                        showToast('💾 Applied and auto-saved 10 Weeks preset to Firebase!');
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer"
                  >
                    10 Wks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cfg = { 'term-1': 12, 'term-2': 12, 'term-3': 12 };
                      setTempWeeksConfig(cfg);
                      if (autoSaveEnabled) {
                        saveTermWeeksConfigToFirestore(cfg);
                        setTermWeeksConfig(cfg);
                        showToast('💾 Applied and auto-saved 12 Weeks (Max) preset to Firebase!');
                      }
                    }}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    12 Wks (Max)
                  </button>
                </div>

                {/* Auto-save Switch */}
                <label className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Auto-save to Firebase on edit</span>
                </label>
              </div>

              {/* Term Configurations with dedicated Save Buttons */}
              <div className="space-y-4">
                {(
                  [
                    { id: 'term-1' as const, name: '1st Academic Term', color: 'blue' },
                    { id: 'term-2' as const, name: '2nd Academic Term', color: 'indigo' },
                    { id: 'term-3' as const, name: '3rd Academic Term', color: 'purple' },
                  ]
                ).map((term) => {
                  const weeks = tempWeeksConfig[term.id] || 11;
                  const isSavingThisTerm = isSavingSingleTerm === term.id;
                  const isSavedThisTerm = savedTermSuccess[term.id];

                  return (
                    <div
                      key={term.id}
                      className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-slate-100 text-sm font-sans flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                          <span>{term.name}</span>
                          {isSavedThisTerm && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 animate-fadeIn border border-emerald-500/40">
                              <Check className="w-3 h-3" />
                              <span>Saved to Firebase</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Checkboxes: <strong className="text-blue-400 font-bold">W1 to W{weeks}</strong> ({weeks} instructional weeks)
                        </div>
                      </div>

                      {/* Stepper, Number Selection & Dedicated Save Button */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Stepper */}
                        <div className="flex items-center space-x-1 bg-[#0d1524] border border-[#24334b] p-1 rounded-xl shadow-2xs">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickChangeTermWeeks(
                                term.id,
                                Math.max(MIN_TERM_WEEKS, (tempWeeksConfig[term.id] || 11) - 1)
                              )
                            }
                            disabled={weeks <= MIN_TERM_WEEKS}
                            className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a2638] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                            title="Decrease weeks"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <div className="w-10 text-center font-mono font-extrabold text-slate-100 text-base">
                            {weeks}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleQuickChangeTermWeeks(
                                term.id,
                                Math.min(MAX_TERM_WEEKS, (tempWeeksConfig[term.id] || 11) + 1)
                              )
                            }
                            disabled={weeks >= MAX_TERM_WEEKS}
                            className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a2638] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                            title="Increase weeks"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quick Number Pills (1 to 12) */}
                        <select
                          value={weeks}
                          onChange={(e) =>
                            handleQuickChangeTermWeeks(
                              term.id,
                              Number(e.target.value)
                            )
                          }
                          aria-label={`Select weeks for ${term.name}`}
                          className="bg-[#0d1524] border border-[#24334b] text-slate-100 text-xs font-mono font-bold rounded-xl px-2.5 py-2 shadow-2xs cursor-pointer focus:outline-hidden"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                            <option key={w} value={w} className="bg-[#0d1524] text-slate-100">
                              {w} {w === 1 ? 'Week' : 'Weeks'}
                            </option>
                          ))}
                        </select>

                        {/* SAVE BUTTON PLACED RIGHT AFTER SETTING WEEKS FOR THIS TERM */}
                        <button
                          type="button"
                          onClick={() => handleSaveSingleTermWeeks(term.id, weeks)}
                          disabled={isSavingThisTerm}
                          className={`px-3.5 py-2 text-xs font-mono font-bold rounded-xl transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer active:scale-95 border ${
                            isSavedThisTerm
                              ? 'bg-emerald-600 border-emerald-400 text-white'
                              : 'bg-blue-600 hover:bg-blue-500 border-blue-400/40 text-white'
                          }`}
                          title={`Save ${term.name} (${weeks} weeks) permanently to Firebase`}
                        >
                          {isSavingThisTerm ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isSavedThisTerm ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isSavingThisTerm
                              ? 'Saving...'
                              : isSavedThisTerm
                              ? 'Saved ✓'
                              : `Save ${term.id === 'term-1' ? 'T1' : term.id === 'term-2' ? 'T2' : 'T3'}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Notice */}
              <div className="bg-[#0d1524] border border-blue-500/30 rounded-2xl p-3.5 text-xs text-blue-200 font-mono flex items-start space-x-2.5">
                <FileCheck2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Synchronized Dynamic Directory:</strong> Changing and saving the number of weeks automatically updates all DLL checkboxes, matrix tables, progress visualizers, and weekly trend graphs in real-time across both Admin and Faculty portals.
                </div>
              </div>
            </div>

            {/* Modal Footer (Always visible & docked) */}
            <div className="p-4 sm:p-5 bg-[#0f1725] border-t border-[#24334b] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span>
                  {lastSavedTimestamp
                    ? `Last synced with Firebase at ${lastSavedTimestamp}`
                    : 'Changes are synced live to Firebase Firestore'}
                </span>
              </div>

              <div className="flex flex-wrap items-center space-x-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsSettingWeeksModalOpen(false)}
                  className="px-4 py-2.5 bg-[#1c273a] hover:bg-[#25344d] border border-[#2d3e57] text-slate-200 rounded-2xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-2xs"
                  title="Exit weeks configuration and return to Faculty Submission Report"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                  <span>Exit & Return to Page</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveWeeksConfiguration}
                  disabled={isSavingWeeksConfig}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer active:scale-95 border border-blue-400/40"
                >
                  {isSavingWeeksConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving All to Firebase...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save All Weeks to Firebase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN STATUS REVIEW MODAL (Checked vs With Comments vs Incomplete) */}
      {canEditDllTosTq && activeCellAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-[#0f1725] border-b border-[#24334b] flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-2xl ${currentCategory.activeBg} text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0`}>
                  {currentCategory.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 rounded-md">
                      {activeCellAction.colLabel}
                    </span>
                    <span className="text-xs font-mono text-slate-400 font-bold">
                      {currentCategory.name} Review
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 font-sans mt-0.5">
                    {activeCellAction.facultySurname}, {activeCellAction.facultyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {activeCellAction.facultyEmail} • {activeCellAction.department || 'SHS Dept.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCellAction(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#1c273a] transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 bg-[#141c2c]">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Select Submission Review Status:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Option 1: Checked (No Comments) */}
                  <button
                    type="button"
                    onClick={() => setSelectedActionType('checked')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      selectedActionType === 'checked'
                        ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'bg-[#0f1725] border-[#24334b] hover:border-slate-500 hover:bg-[#1a2638]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-emerald-300 flex items-center space-x-1.5">
                        <span className="w-4 h-4 rounded-md bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                        <span>Checked</span>
                      </span>
                      {selectedActionType === 'checked' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono leading-tight">
                      No comments or corrections. Clean compliance.
                    </p>
                  </button>

                  {/* Option 2: With Comments */}
                  <button
                    type="button"
                    onClick={() => setSelectedActionType('with-comments')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      selectedActionType === 'with-comments'
                        ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                        : 'bg-[#0f1725] border-[#24334b] hover:border-slate-500 hover:bg-[#1a2638]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-300 flex items-center space-x-1.5">
                        <span className="w-4 h-4 rounded-md bg-amber-500 text-white flex items-center justify-center text-[10px]">💬</span>
                        <span>With Comments</span>
                      </span>
                      {selectedActionType === 'with-comments' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono leading-tight">
                      Deliverable has corrections or notes for teacher.
                    </p>
                  </button>

                  {/* Option 3: Incomplete */}
                  <button
                    type="button"
                    onClick={() => setSelectedActionType('incomplete')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      selectedActionType === 'incomplete'
                        ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30 shadow-xs'
                        : 'bg-[#0f1725] border-[#24334b] hover:border-slate-500 hover:bg-[#1a2638]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-rose-300 flex items-center space-x-1.5">
                        <span className="w-4 h-4 rounded-md bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>
                        <span>Incomplete</span>
                      </span>
                      {selectedActionType === 'incomplete' && (
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono leading-tight">
                      Submission has lacking components or missing attachments.
                    </p>
                  </button>

                  {/* Option 4: Late */}
                  <button
                    type="button"
                    onClick={() => setSelectedActionType('late')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      selectedActionType === 'late'
                        ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30 shadow-xs'
                        : 'bg-[#0f1725] border-[#24334b] hover:border-slate-500 hover:bg-[#1a2638]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-orange-300 flex items-center space-x-1.5">
                        <span className="w-4 h-4 rounded-md bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">⏰</span>
                        <span>Late</span>
                      </span>
                      {selectedActionType === 'late' && (
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono leading-tight">
                      Submitted past deadline or late delivery deliverable.
                    </p>
                  </button>
                </div>

                {/* Option: Reset / Pending */}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedActionType('unchecked')}
                    className={`text-xs font-mono font-medium underline-offset-2 transition-all cursor-pointer ${
                      selectedActionType === 'unchecked'
                        ? 'text-blue-400 font-bold underline'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {selectedActionType === 'unchecked' ? '● Set as Pending / Unchecked' : 'Set as Pending / Unchecked'}
                  </button>
                </div>
              </div>

              {/* Comments / Notes Input (Shows when With Comments, Incomplete, or Late is selected) */}
              {(selectedActionType === 'with-comments' || selectedActionType === 'incomplete' || selectedActionType === 'late') && (
                <div className="space-y-2 pt-1 border-t border-[#24334b]">
                  <div className="flex items-center justify-between">
                    <label className={`block text-xs font-mono font-bold ${
                      selectedActionType === 'incomplete'
                        ? 'text-rose-300'
                        : selectedActionType === 'late'
                        ? 'text-orange-300'
                        : 'text-amber-300'
                    }`}>
                      {selectedActionType === 'incomplete'
                        ? 'Notes on Lacking Components / Missing Parts:'
                        : selectedActionType === 'late'
                        ? 'Remarks on Late Submission (Optional):'
                        : 'Corrections / Feedback for Teacher:'}
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      Visible in faculty submission report
                    </span>
                  </div>
                  <textarea
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={
                      selectedActionType === 'incomplete'
                        ? 'e.g. Missing Week 3 attachment; lacking required competencies; missing rubrics/TOS item distribution...'
                        : selectedActionType === 'late'
                        ? 'e.g. Submitted past deadline on [Date]; received late with remarks...'
                        : 'e.g. Please revise learning competencies; missing supervisor signature; incomplete items...'
                    }
                    rows={3}
                    className={`w-full p-3 bg-[#0d1524] border rounded-2xl text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 resize-none shadow-2xs ${
                      selectedActionType === 'incomplete'
                        ? 'border-rose-500/50 focus:ring-rose-500'
                        : selectedActionType === 'late'
                        ? 'border-orange-500/50 focus:ring-orange-500'
                        : 'border-amber-500/50 focus:ring-amber-500'
                    }`}
                  />

                  {/* Quick comment suggestion chips */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Quick Suggestions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedActionType === 'incomplete'
                        ? [
                            'Missing file attachment or link in faculty folder.',
                            'Lacking learning competencies or objectives.',
                            'Missing Table of Specifications (TOS) breakdown.',
                            'Incomplete test questions / answer key missing.',
                            'Missing Department Head / Supervisor signature.',
                            'Please upload the lacking materials to your folder.',
                          ]
                        : selectedActionType === 'late'
                        ? [
                            'Submitted past deadline.',
                            'Late submission - received after scheduled cut-off date.',
                            'Accepted with late compliance remarks.',
                            'Submitted late due to excused school activity.',
                            'Deliverable received late; approved with note.',
                            'Please ensure future deliverables are submitted on time.',
                          ]
                        : [
                            'Please attach complete learning objectives & competencies.',
                            'Missing signature or date.',
                            'Ensure TOS alignment matches DepEd guidelines.',
                            'Formatting / rubric adjustments needed.',
                            'Please upload revised file to your faculty folder.',
                          ]
                      ).map((tip) => (
                        <button
                          key={tip}
                          type="button"
                          onClick={() => setCommentInput(tip)}
                          className={`text-[10px] font-mono px-2 py-1 rounded-lg transition-all cursor-pointer border ${
                            selectedActionType === 'incomplete'
                              ? 'bg-[#0d1524] hover:bg-rose-500/20 hover:text-rose-200 text-slate-300 border-[#24334b]'
                              : selectedActionType === 'late'
                              ? 'bg-[#0d1524] hover:bg-orange-500/20 hover:text-orange-200 text-slate-300 border-[#24334b]'
                              : 'bg-[#0d1524] hover:bg-amber-500/20 hover:text-amber-200 text-slate-300 border-[#24334b]'
                          }`}
                        >
                          + {tip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Status summary preview */}
              <div className="bg-[#0f1725] border border-[#24334b] rounded-2xl p-3 text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Resulting Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${
                  selectedActionType === 'checked'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : selectedActionType === 'with-comments'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : selectedActionType === 'incomplete'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : selectedActionType === 'late'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-[#0d1524] text-slate-400 border border-[#24334b]'
                }`}>
                  {selectedActionType === 'checked'
                    ? '✓ Checked (No Comments)'
                    : selectedActionType === 'with-comments'
                    ? '💬 With Comments'
                    : selectedActionType === 'incomplete'
                    ? '⚠️ Incomplete (Lacking)'
                    : selectedActionType === 'late'
                    ? '⏰ Late (Submitted Late)'
                    : '⚪ Pending (Unchecked)'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-[#0f1725] border-t border-[#24334b] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveCellAction(null)}
                className="px-4 py-2 bg-[#1c273a] hover:bg-[#25344d] border border-[#2d3e57] text-slate-200 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveCellStatus(
                    activeCellAction.facultyEmail,
                    activeCellAction.itemIndex,
                    selectedActionType,
                    commentInput
                  );
                  setActiveCellAction(null);
                }}
                className={`px-5 py-2 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95 ${
                  selectedActionType === 'checked'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : selectedActionType === 'with-comments'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : selectedActionType === 'incomplete'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : selectedActionType === 'late'
                    ? 'bg-orange-600 hover:bg-orange-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Save Status & Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FACULTY VIEW FEEDBACK DETAIL MODAL (With Comments or Incomplete) */}
      {facultyDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-100">
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              facultyDetailModal.status === 'incomplete'
                ? 'bg-rose-500/15 border-rose-500/30'
                : facultyDetailModal.status === 'late'
                ? 'bg-orange-500/15 border-orange-500/30'
                : 'bg-amber-500/15 border-amber-500/30'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${
                  facultyDetailModal.status === 'incomplete'
                    ? 'bg-rose-600'
                    : facultyDetailModal.status === 'late'
                    ? 'bg-orange-600'
                    : 'bg-amber-600'
                }`}>
                  {facultyDetailModal.status === 'incomplete' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : facultyDetailModal.status === 'late' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <MessageSquare className="w-5 h-5 fill-current" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-sans">
                    {facultyDetailModal.status === 'incomplete'
                      ? 'Incomplete Deliverable Details'
                      : facultyDetailModal.status === 'late'
                      ? 'Late Submission Remarks'
                      : 'Administrator Feedback & Corrections'}
                  </h3>
                  <p className={`text-xs font-mono font-bold ${
                    facultyDetailModal.status === 'incomplete'
                      ? 'text-rose-300'
                      : facultyDetailModal.status === 'late'
                      ? 'text-orange-300'
                      : 'text-amber-300'
                  }`}>
                    {facultyDetailModal.colLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFacultyDetailModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#1c273a] transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 font-mono">
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                  facultyDetailModal.status === 'incomplete'
                    ? 'text-rose-200 bg-rose-500/25 border-rose-500/40'
                    : facultyDetailModal.status === 'late'
                    ? 'text-orange-200 bg-orange-500/25 border-orange-500/40'
                    : 'text-amber-200 bg-amber-500/25 border-amber-500/40'
                }`}>
                  Status: {facultyDetailModal.status === 'incomplete'
                    ? 'Incomplete (Lacking Requirements)'
                    : facultyDetailModal.status === 'late'
                    ? 'Late (Submitted Late)'
                    : 'With Comments (Corrections)'}
                </span>
                <span className="text-xs text-slate-400">
                  {facultyDetailModal.status === 'incomplete'
                    ? 'Action needed to complete deliverable'
                    : facultyDetailModal.status === 'late'
                    ? 'Submission received past deadline'
                    : 'Action required by teacher'}
                </span>
              </div>

              <div className={`p-4 rounded-r-xl border-l-4 ${
                facultyDetailModal.status === 'incomplete'
                  ? 'bg-rose-500/10 border-rose-500'
                  : facultyDetailModal.status === 'late'
                  ? 'bg-orange-500/10 border-orange-500'
                  : 'bg-amber-500/10 border-amber-500'
              }`}>
                <p className="text-xs text-slate-200 leading-relaxed italic">
                  "{facultyDetailModal.comment}"
                </p>
              </div>

              <div className="bg-[#0d1524] border border-[#24334b] rounded-xl p-3 text-xs text-slate-300 space-y-1">
                <p className="font-bold flex items-center space-x-1.5 text-blue-400">
                  <span>💡</span>
                  <span>How to resolve:</span>
                </p>
                <p className="text-[11px] text-slate-300">
                  {facultyDetailModal.status === 'incomplete'
                    ? 'Please provide the missing parts, attachments, or competencies and upload the complete file into your personal Faculty Folder. Once updated, the administrator will verify and mark it clean.'
                    : facultyDetailModal.status === 'late'
                    ? 'Your submission has been received and logged as late. For succeeding submissions, please ensure your DLL, TOS, or TQ files are submitted on or before the designated deadline schedule.'
                    : 'Please make the necessary revisions to your deliverable and upload the updated document into your personal Faculty Folder. Once submitted, the administrator will review and mark it clean.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#0f1725] border-t border-[#24334b] text-right">
              <button
                type="button"
                onClick={() => setFacultyDetailModal(null)}
                className="px-4 py-2 bg-[#1c273a] hover:bg-[#25344d] text-slate-200 border border-[#2d3e57] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Close Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
