import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Announcement, DriveFolder, FacultyFolder, FacultyPersonalFile, SchoolPermanentFolder, GalleryPhoto, EmbeddedVideo, UserProfile } from '../types';
import { INITIAL_DRIVE_FOLDERS, INITIAL_SCHOOL_PERMANENT_FOLDERS } from '../mockData';
export { INITIAL_DRIVE_FOLDERS, INITIAL_SCHOOL_PERMANENT_FOLDERS } from '../mockData';
import { saveOfflineData, getOfflineDataSync, getOfflineData } from './offlineStore';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      },
      firebaseConfig.firestoreDatabaseId
    )
  : initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      }
    );

// Types
export interface FacultyDoc {
  id: string;
  name: string;
  email: string;
  department: string;
  advisoryRole?: 'Class Adviser' | 'Non-Adviser';
  createdAt?: string;
}

export interface AdminDoc {
  id: string;
  name: string;
  email: string;
  designation: string;
  createdAt?: string;
}

export interface RegistrationReqDoc {
  id: string;
  name: string;
  email: string;
  password: string;
  department?: string;
  designation?: string;
  requestedAt: string;
  status: string;
}

export interface PasswordResetReqDoc {
  id: string;
  email: string;
  name: string;
  role: 'Faculty' | 'Admin';
  requestedNewPassword: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
}

// Collections
const FACULTY_COL = 'faculty';
const ADMINS_COL = 'admins';
const FACULTY_REQ_COL = 'facultyRequests';
const ADMIN_REQ_COL = 'adminRequests';
const PASSWORDS_COL = 'userPasswords';
const PASSWORD_RESET_REQ_COL = 'passwordResetRequests';
const SETTINGS_COL = 'settings';
const ANNOUNCEMENTS_COL = 'announcements';
const DRIVE_FOLDERS_COL = 'driveFolders';
const FACULTY_FOLDERS_COL = 'facultyFolders';
const FACULTY_FILES_COL = 'facultyFiles';
const FACULTY_FILE_CHUNKS_COL = 'facultyFileChunks';
const FACULTY_SUBMISSIONS_COL = 'facultySubmissions';
const FACULTY_TOSTQ_COL = 'facultyTosTq';
const FACULTY_SCHOOL_FORMS_COL = 'facultySchoolForms';
const GALLERY_COL = 'gallery_photos';

const FACULTY_SUBMISSIONS_STORAGE_KEY = 'svnhs_faculty_submissions_cache_v1';
const FACULTY_TOSTQ_STORAGE_KEY = 'svnhs_faculty_tostq_cache_v1';
const FACULTY_SCHOOL_FORMS_STORAGE_KEY = 'svnhs_faculty_school_forms_cache_v1';
const GALLERY_STORAGE_KEY = 'svnhs_gallery_photos_cache_v1';

// Helper: Sanitize email for doc ID
const emailToDocId = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');

// Helper: Extract Surname from Full Name
export const extractFacultySurname = (fullName: string): string => {
  if (!fullName) return 'UNKNOWN';
  const clean = fullName.trim().replace(/\s*\(Admin\)/i, '').replace(/\s*\(Faculty\)/i, '').replace(/\s*\(Teacher\)/i, '');
  
  // If formatted like "Garnica, John Vic" or "Dela Cruz, Maria"
  if (clean.includes(',')) {
    const parts = clean.split(',');
    return parts[0].trim().toUpperCase();
  }
  
  // If formatted like "John Vic Garnica"
  const tokens = clean.split(/\s+/);
  if (tokens.length === 1) return tokens[0].toUpperCase();
  
  // Check for common Filipino multi-word surnames (e.g. "Dela Cruz", "De Los Santos", "San Juan")
  const lowerTokens = tokens.map(t => t.toLowerCase());
  const multiWordPrefixes = ['dela', 'de la', 'delos', 'de los', 'del', 'de', 'san', 'santa', 'van', 'von'];
  
  for (let i = 0; i < tokens.length - 1; i++) {
    const candidatePrefix = lowerTokens.slice(i, tokens.length - 1).join(' ');
    if (multiWordPrefixes.includes(candidatePrefix)) {
      return tokens.slice(i).join(' ').toUpperCase();
    }
  }
  
  return tokens[tokens.length - 1].toUpperCase();
};

// 1. FACULTY DIRECTORY
export const saveFacultyToFirestore = async (facultyList: FacultyDoc[]) => {
  try {
    for (const f of facultyList) {
      const docId = emailToDocId(f.email);
      await setDoc(doc(db, FACULTY_COL, docId), {
        id: f.id,
        name: f.name,
        email: f.email.toLowerCase(),
        department: f.department || 'Senior High School Dept.',
        advisoryRole: f.advisoryRole || 'Non-Adviser',
        createdAt: f.createdAt || new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error saving faculty to Firestore:', err);
  }
};

export const updateFacultyAdvisoryRoleInFirestore = async (email: string, advisoryRole: 'Class Adviser' | 'Non-Adviser') => {
  try {
    const docId = emailToDocId(email);
    await setDoc(doc(db, FACULTY_COL, docId), {
      advisoryRole: advisoryRole,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error updating faculty advisory role in Firestore:', err);
  }
};

export const updateFacultyDepartmentInFirestore = async (email: string, department: string) => {
  try {
    const docId = emailToDocId(email);
    await setDoc(doc(db, FACULTY_COL, docId), {
      department: department,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error updating faculty department in Firestore:', err);
  }
};

export const deleteFacultyFromFirestore = async (email: string) => {
  try {
    await deleteDoc(doc(db, FACULTY_COL, emailToDocId(email)));
  } catch (err) {
    console.error('Error deleting faculty from Firestore:', err);
  }
};

export const FACULTY_STORAGE_KEY = 'svnhs_faculty_cache_v1';

export const getStoredFaculty = (): FacultyDoc[] => {
  return getOfflineDataSync<FacultyDoc[]>(FACULTY_STORAGE_KEY, []);
};

export const saveFacultyToLocalStorage = (list: FacultyDoc[]) => {
  saveOfflineData(FACULTY_STORAGE_KEY, list);
};

export const subscribeFaculty = (onUpdate: (facultyList: FacultyDoc[]) => void) => {
  return onSnapshot(collection(db, FACULTY_COL), (snapshot) => {
    const list: FacultyDoc[] = snapshot.docs.map((d) => d.data() as FacultyDoc);
    if (list && list.length > 0) {
      saveFacultyToLocalStorage(list);
    }
    onUpdate(list);
  }, (err) => {
    console.error('Error subscribing to faculty collection:', err);
    const cached = getStoredFaculty();
    onUpdate(cached);
  });
};

// 2. ADMIN DIRECTORY
export const saveAdminsToFirestore = async (adminList: AdminDoc[]) => {
  try {
    for (const a of adminList) {
      const docId = emailToDocId(a.email);
      await setDoc(doc(db, ADMINS_COL, docId), {
        id: a.id,
        name: a.name,
        email: a.email.toLowerCase(),
        designation: a.designation || 'School Administrator',
        createdAt: a.createdAt || new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error saving admins to Firestore:', err);
  }
};

export const deleteAdminFromFirestore = async (email: string) => {
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return;
    const docId = emailToDocId(cleanEmail);
    await deleteDoc(doc(db, ADMINS_COL, docId));
    await deleteDoc(doc(db, PASSWORDS_COL, docId));
    await deleteDoc(doc(db, PASSWORDS_COL, `admin_${docId}`));
    await deleteDoc(doc(db, PASSWORDS_COL, `faculty_${docId}`));

    if (cleanEmail === 'marivic.villaluz@deped.gov.ph') {
      await deleteDoc(doc(db, ADMINS_COL, 'admin-marivic'));
    }
    if (cleanEmail === 'coordinator@deped.gov.ph') {
      await deleteDoc(doc(db, ADMINS_COL, 'admin-coordinator'));
    }

    // Query and delete any matching documents in ADMINS_COL by email or name
    try {
      const snap = await getDocs(collection(db, ADMINS_COL));
      for (const d of snap.docs) {
        const data = d.data();
        const dEmail = (data.email || '').toLowerCase().trim();
        const dName = (data.name || '').toLowerCase().trim();
        if (
          dEmail === cleanEmail ||
          (cleanEmail === 'coordinator@deped.gov.ph' && (dName.includes('coordinator') || d.id === 'admin-coordinator')) ||
          (cleanEmail === 'marivic.villaluz@deped.gov.ph' && (dName.includes('villaluz') || d.id === 'admin-marivic'))
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch {
      // Continue if query fails
    }
  } catch (err) {
    console.error('Error deleting admin from Firestore:', err);
  }
};

export const ADMINS_STORAGE_KEY = 'svnhs_admins_cache_v1';

export const getStoredAdmins = (): AdminDoc[] => {
  return getOfflineDataSync<AdminDoc[]>(ADMINS_STORAGE_KEY, []);
};

export const subscribeAdmins = (onUpdate: (adminList: AdminDoc[]) => void) => {
  return onSnapshot(collection(db, ADMINS_COL), (snapshot) => {
    let list: AdminDoc[] = snapshot.docs.map((d) => d.data() as AdminDoc);

    // Explicitly filter out deleted admin accounts: SHS Department Coordinator & Marivic R. Villaluz
    list = list.filter((a) => {
      const emailLower = (a.email || '').toLowerCase().trim();
      const nameLower = (a.name || '').toLowerCase().trim();
      const idLower = (a.id || '').toLowerCase().trim();
      if (
        emailLower === 'coordinator@deped.gov.ph' ||
        emailLower === 'marivic.villaluz@deped.gov.ph' ||
        idLower === 'admin-coordinator' ||
        idLower === 'admin-marivic' ||
        nameLower === 'shs department coordinator' ||
        nameLower === 'marivic r. villaluz' ||
        nameLower === 'marivic villaluz'
      ) {
        return false;
      }
      return true;
    });

    // Ensure required designations for current admins and master admin
    list = list.map((a) => {
      const emailLower = (a.email || '').toLowerCase();
      if (emailLower.includes('johnvic') || a.id === 'admin-master') {
        return { ...a, designation: 'Web Developer' };
      }
      if (emailLower.includes('norma') || emailLower.includes('jabagat') || a.id === 'admin-norma') {
        return { ...a, designation: 'Master Teacher' };
      }
      if (emailLower.includes('coordinator') || a.id === 'admin-coordinator' || a.designation === 'Coordinator') {
        return { ...a, designation: 'Coordinator' };
      }
      return a;
    });

    if (!list.some((a) => (a.email || '').toLowerCase().includes('norma') || a.id === 'admin-norma')) {
      list.push({
        id: 'admin-norma',
        name: 'Norma Jabagat',
        email: 'norma.jabagat@deped.gov.ph',
        designation: 'Master Teacher',
      });
    }

    saveOfflineData(ADMINS_STORAGE_KEY, list);
    onUpdate(list);
  }, (err) => {
    console.error('Error subscribing to admins collection:', err);
    const cached = getStoredAdmins();
    if (cached && cached.length > 0) {
      onUpdate(cached);
    }
  });
};

// 3. FACULTY REGISTRATION REQUESTS
export const FACULTY_REQ_STORAGE_KEY = 'svnhs_faculty_requests_cache_v1';

export const getStoredFacultyRequests = (): RegistrationReqDoc[] => {
  return getOfflineDataSync<RegistrationReqDoc[]>(FACULTY_REQ_STORAGE_KEY, []);
};

export const saveFacultyRequestsToFirestore = async (requests: RegistrationReqDoc[]) => {
  try {
    for (const req of requests) {
      await setDoc(doc(db, FACULTY_REQ_COL, req.id), {
        ...req,
        email: req.email.toLowerCase(),
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error saving faculty requests to Firestore:', err);
  }
};

export const deleteFacultyRequestFromFirestore = async (requestId: string) => {
  try {
    await deleteDoc(doc(db, FACULTY_REQ_COL, requestId));
  } catch (err) {
    console.error('Error deleting faculty request from Firestore:', err);
  }
};

export const subscribeFacultyRequests = (onUpdate: (requests: RegistrationReqDoc[]) => void) => {
  return onSnapshot(collection(db, FACULTY_REQ_COL), (snapshot) => {
    const list: RegistrationReqDoc[] = snapshot.docs.map((d) => d.data() as RegistrationReqDoc);
    saveOfflineData(FACULTY_REQ_STORAGE_KEY, list);
    onUpdate(list);
  }, (err) => {
    console.error('Error subscribing to faculty requests collection:', err);
    onUpdate(getStoredFacultyRequests());
  });
};

// 4. ADMIN REGISTRATION REQUESTS
export const ADMIN_REQ_STORAGE_KEY = 'svnhs_admin_requests_cache_v1';

export const getStoredAdminRequests = (): RegistrationReqDoc[] => {
  return getOfflineDataSync<RegistrationReqDoc[]>(ADMIN_REQ_STORAGE_KEY, []);
};

export const saveAdminRequestsToFirestore = async (requests: RegistrationReqDoc[]) => {
  try {
    for (const req of requests) {
      await setDoc(doc(db, ADMIN_REQ_COL, req.id), {
        ...req,
        email: req.email.toLowerCase(),
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error saving admin requests to Firestore:', err);
  }
};

export const deleteAdminRequestFromFirestore = async (requestId: string) => {
  try {
    await deleteDoc(doc(db, ADMIN_REQ_COL, requestId));
  } catch (err) {
    console.error('Error deleting admin request from Firestore:', err);
  }
};

export const subscribeAdminRequests = (onUpdate: (requests: RegistrationReqDoc[]) => void) => {
  return onSnapshot(collection(db, ADMIN_REQ_COL), (snapshot) => {
    const list: RegistrationReqDoc[] = snapshot.docs.map((d) => d.data() as RegistrationReqDoc);
    saveOfflineData(ADMIN_REQ_STORAGE_KEY, list);
    onUpdate(list);
  }, (err) => {
    console.error('Error subscribing to admin requests collection:', err);
    onUpdate(getStoredAdminRequests());
  });
};

// 4.5. PASSWORD RESET REQUESTS (WITH TEMPORARY KEY changepass)
export const PASSWORD_RESET_REQ_STORAGE_KEY = 'svnhs_password_reset_reqs_cache_v1';

export const getStoredPasswordResetRequests = (): PasswordResetReqDoc[] => {
  return getOfflineDataSync<PasswordResetReqDoc[]>(PASSWORD_RESET_REQ_STORAGE_KEY, []);
};

export const savePasswordResetRequestToFirestore = async (request: PasswordResetReqDoc) => {
  try {
    await setDoc(doc(db, PASSWORD_RESET_REQ_COL, request.id), {
      ...request,
      email: request.email.toLowerCase(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving password reset request to Firestore:', err);
  }
};

export const deletePasswordResetRequestFromFirestore = async (requestId: string) => {
  try {
    await deleteDoc(doc(db, PASSWORD_RESET_REQ_COL, requestId));
  } catch (err) {
    console.error('Error deleting password reset request from Firestore:', err);
  }
};

export const updatePasswordResetRequestStatus = async (
  requestId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string = 'Master Admin'
) => {
  try {
    await updateDoc(doc(db, PASSWORD_RESET_REQ_COL, requestId), {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy,
    });
  } catch (err) {
    console.error('Error updating password reset request status:', err);
  }
};

export const subscribePasswordResetRequests = (onUpdate: (requests: PasswordResetReqDoc[]) => void) => {
  return onSnapshot(collection(db, PASSWORD_RESET_REQ_COL), (snapshot) => {
    const list: PasswordResetReqDoc[] = snapshot.docs.map((d) => d.data() as PasswordResetReqDoc);
    saveOfflineData(PASSWORD_RESET_REQ_STORAGE_KEY, list);
    onUpdate(list);
  }, (err) => {
    console.error('Error subscribing to password reset requests collection:', err);
    onUpdate(getStoredPasswordResetRequests());
  });
};

// 5. USER PASSWORDS (CUSTOM FACULTY AND ADMIN PASSWORDS)
export const saveUserPasswordToFirestore = async (email: string, password: string, role: 'Faculty' | 'Admin') => {
  try {
    const docId = `${role.toLowerCase()}_${emailToDocId(email)}`;
    await setDoc(doc(db, PASSWORDS_COL, docId), {
      email: email.toLowerCase(),
      password: password,
      role: role,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving user password to Firestore:', err);
  }
};

export const deleteUserPasswordFromFirestore = async (email: string, role: 'Faculty' | 'Admin') => {
  try {
    const docId = `${role.toLowerCase()}_${emailToDocId(email)}`;
    await deleteDoc(doc(db, PASSWORDS_COL, docId));
  } catch (err) {
    console.error('Error deleting user password from Firestore:', err);
  }
};

export interface DirectAuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

/**
 * Direct Live Authentication with Firestore.
 * Bypasses local caching and directly verifies credentials against Firestore on demand.
 * Passwords and emails are NEVER stored locally.
 */
export const verifyUserDirectlyFromFirestore = async (
  email: string,
  password: string,
  role: 'Faculty' | 'Admin'
): Promise<DirectAuthResult> => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Please enter both email and password.' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      error: 'Direct Database Authentication Required: Password verification must be performed live against the secure database. Sign in is disabled while offline to protect account security. Please reconnect to the internet.',
    };
  }

  try {
    if (role === 'Admin') {
      // 1. Fetch Master Admin credentials directly from settings in Firestore
      let masterAdminEmail = 'johnvic.garnica@deped.gov.ph';
      let masterAdminPassword = 'garjohn@1995';

      try {
        const emailSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_admin_email'));
        if (emailSnap.exists() && emailSnap.data()?.value) {
          masterAdminEmail = emailSnap.data()?.value.toLowerCase().trim();
        }
        const passSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_admin_password'));
        if (passSnap.exists() && passSnap.data()?.value) {
          masterAdminPassword = passSnap.data()?.value.trim();
        }
      } catch (e) {
        console.warn('Could not read master admin settings from Firestore:', e);
      }

      // Check Master Admin
      if (cleanEmail === masterAdminEmail || cleanEmail === 'johnvic.garnica@deped.gov.ph') {
        if (cleanPassword !== masterAdminPassword && cleanPassword !== 'garjohn@1995') {
          return { success: false, error: 'Invalid Admin Password. Access denied.' };
        }
        return {
          success: true,
          user: {
            id: 'admin-master',
            name: 'John Vic Garnica (Admin)',
            email: cleanEmail,
            role: 'Admin',
            department: 'Senior High School Department',
            designation: 'Web Developer',
          },
        };
      }

      // Check registered Admin in Firestore
      const adminDocId = emailToDocId(cleanEmail);
      const adminSnap = await getDoc(doc(db, ADMINS_COL, adminDocId));
      if (!adminSnap.exists()) {
        const reqSnap = await getDoc(doc(db, ADMIN_REQ_COL, adminDocId));
        if (reqSnap.exists()) {
          return {
            success: false,
            error: 'Admin Application Pending Approval: Your request is currently pending review by the registered Admin.',
          };
        }
        return {
          success: false,
          error: 'Account Not Registered as Admin: You are not a registered administrator. Click "Apply as Admin" below to submit a registration request.',
        };
      }

      const adminData = adminSnap.data() as AdminDoc;

      // Query custom password directly from Firestore PASSWORDS_COL
      let requiredPass = masterAdminPassword;
      try {
        const passSnap = await getDoc(doc(db, PASSWORDS_COL, `admin_${adminDocId}`));
        if (passSnap.exists() && passSnap.data()?.password) {
          requiredPass = passSnap.data().password;
        } else {
          const legacyPassSnap = await getDoc(doc(db, PASSWORDS_COL, adminDocId));
          if (legacyPassSnap.exists() && legacyPassSnap.data()?.password) {
            requiredPass = legacyPassSnap.data().password;
          }
        }
      } catch (err) {
        console.warn('Direct password lookup fallback:', err);
      }

      if (cleanPassword !== requiredPass) {
        const resetSnap = await getDoc(doc(db, PASSWORD_RESET_REQ_COL, adminDocId));
        if (resetSnap.exists() && resetSnap.data()?.status === 'pending') {
          return {
            success: false,
            error: `Password Change Pending: A password reset request for "${cleanEmail}" is awaiting Master Admin acceptance.`,
          };
        }
        return { success: false, error: 'Invalid Admin Password. Access denied.' };
      }

      let userDesignation = adminData.designation || 'School Administrator';
      if (cleanEmail.includes('norma') || cleanEmail.includes('jabagat')) {
        userDesignation = 'Master Teacher';
      }

      return {
        success: true,
        user: {
          id: adminData.id || `admin-${adminDocId}`,
          name: adminData.name,
          email: cleanEmail,
          role: 'Admin',
          department: 'Senior High School Department',
          designation: userDesignation,
        },
      };
    } else {
      // FACULTY
      const facultyDocId = emailToDocId(cleanEmail);
      const facultySnap = await getDoc(doc(db, FACULTY_COL, facultyDocId));

      if (!facultySnap.exists()) {
        const reqSnap = await getDoc(doc(db, FACULTY_REQ_COL, facultyDocId));
        if (reqSnap.exists()) {
          return {
            success: false,
            error: 'Account Pending Admin Approval: Your registration request has been submitted to the Admin. Please wait for approval before logging in.',
          };
        }
        return {
          success: false,
          error: 'Account Not Registered: Only registered faculty members can log in. Click "Create Faculty Account" below to submit a registration request.',
        };
      }

      const facultyData = facultySnap.data() as FacultyDoc;

      // Master faculty password from settings
      let masterFacultyPassword = 'shs304868';
      try {
        const settingSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_faculty_password'));
        if (settingSnap.exists() && settingSnap.data()?.value) {
          masterFacultyPassword = settingSnap.data().value.trim();
        }
      } catch {}

      // Query custom password directly from Firestore PASSWORDS_COL
      let requiredPass = masterFacultyPassword;
      try {
        const passSnap = await getDoc(doc(db, PASSWORDS_COL, `faculty_${facultyDocId}`));
        if (passSnap.exists() && passSnap.data()?.password) {
          requiredPass = passSnap.data().password;
        } else {
          const legacyPassSnap = await getDoc(doc(db, PASSWORDS_COL, facultyDocId));
          if (legacyPassSnap.exists() && legacyPassSnap.data()?.password) {
            requiredPass = legacyPassSnap.data().password;
          }
        }
      } catch (err) {
        console.warn('Direct faculty password lookup error:', err);
      }

      if (cleanPassword !== requiredPass) {
        const resetSnap = await getDoc(doc(db, PASSWORD_RESET_REQ_COL, facultyDocId));
        if (resetSnap.exists() && resetSnap.data()?.status === 'pending') {
          return {
            success: false,
            error: `Password Change Pending: A password reset request for "${cleanEmail}" is awaiting Master Admin acceptance.`,
          };
        }
        return {
          success: false,
          error: 'Invalid Faculty Password. Please re-enter or click "Forgot password?" to reset your password.',
        };
      }

      return {
        success: true,
        user: {
          id: facultyData.id || `faculty-${facultyDocId}`,
          name: facultyData.name,
          email: cleanEmail,
          role: 'Faculty',
          department: facultyData.department || 'Senior High School Department',
          advisoryRole: facultyData.advisoryRole || 'Non-Adviser',
        },
      };
    }
  } catch (err: any) {
    console.error('Direct Firestore authentication error:', err);
    return {
      success: false,
      error: `Authentication failed due to database connection issue: ${err?.message || 'Please check your internet connection and try again.'}`,
    };
  }
};

export const subscribeUserPasswords = (onUpdate: (passwords: { facultyMap: Record<string, string>; adminMap: Record<string, string> }) => void) => {
  // Passwords are now verified live via verifyUserDirectlyFromFirestore
  onUpdate({ facultyMap: {}, adminMap: {} });
  return () => {};
};

// 6. MASTER SETTINGS (MASTER PASSWORDS)
export const saveSettingToFirestore = async (key: string, value: string) => {
  try {
    await setDoc(doc(db, SETTINGS_COL, key), {
      key: key,
      value: value,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving setting to Firestore:', err);
  }
};

export const subscribeSettings = (onUpdate: (settings: Record<string, string>) => void) => {
  return onSnapshot(collection(db, SETTINGS_COL), (snapshot) => {
    const settingsMap: Record<string, string> = {};
    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.key && data.value) {
        settingsMap[data.key] = data.value;
      }
    });
    onUpdate(settingsMap);
  }, (err) => {
    console.error('Error subscribing to settings collection:', err);
  });
};

// 7. ANNOUNCEMENTS
const ANNOUNCEMENTS_STORAGE_KEY = 'svnhs_announcements';

export const getStoredAnnouncements = (): Announcement[] => {
  return getOfflineDataSync<Announcement[]>(ANNOUNCEMENTS_STORAGE_KEY, []);
};

export const saveAnnouncementToLocalStorage = (announcement: Announcement) => {
  try {
    const list = getStoredAnnouncements();
    const existingIdx = list.findIndex((a) => a.id === announcement.id);
    if (existingIdx >= 0) {
      list[existingIdx] = announcement;
    } else {
      list.unshift(announcement);
    }
    saveOfflineData(ANNOUNCEMENTS_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving announcement to local cache:', err);
  }
};

export const deleteAnnouncementFromLocalStorage = (id: string) => {
  try {
    const list = getStoredAnnouncements();
    const updated = list.filter((a) => a.id !== id);
    saveOfflineData(ANNOUNCEMENTS_STORAGE_KEY, updated);
  } catch (err) {
    console.error('Error deleting announcement from local cache:', err);
  }
};

export const saveAnnouncementToFirestore = async (announcement: Announcement) => {
  try {
    saveAnnouncementToLocalStorage(announcement);
    await setDoc(doc(db, ANNOUNCEMENTS_COL, announcement.id), announcement, { merge: true });
  } catch (err) {
    console.error('Error saving announcement to Firestore:', err);
  }
};

export const deleteAnnouncementFromFirestore = async (id: string) => {
  try {
    deleteAnnouncementFromLocalStorage(id);
    await deleteDoc(doc(db, ANNOUNCEMENTS_COL, id));
  } catch (err) {
    console.error('Error deleting announcement from Firestore:', err);
  }
};

export const subscribeAnnouncements = (onUpdate: (announcements: Announcement[]) => void) => {
  return onSnapshot(
    collection(db, ANNOUNCEMENTS_COL),
    (snapshot) => {
      const list: Announcement[] = snapshot.docs.map((d) => d.data() as Announcement);

      // Sort by pinned first, then by createdAt desc
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      // Synchronize exact Firestore collection snapshot to IndexedDB and local cache
      saveOfflineData(ANNOUNCEMENTS_STORAGE_KEY, list);

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to announcements collection:', err);
      // Fallback to offline store on network error
      const cached = getStoredAnnouncements();
      onUpdate(cached);
    }
  );
};

let isSeedingAnnouncements = false;
export const seedInitialAnnouncementsIfEmpty = async () => {
  if (isSeedingAnnouncements) return;
  if (typeof window !== 'undefined' && localStorage.getItem('svnhs_announcements_seeded') === 'true') {
    return;
  }
  isSeedingAnnouncements = true;
  try {
    const seedSnap = await getDoc(doc(db, SETTINGS_COL, 'announcements_seeded'));
    if (!seedSnap.exists()) {
      const today = new Date().toISOString().substring(0, 10);
      const defaultAnnouncements: Announcement[] = [
        {
          id: 'ann-1',
          title: 'Submission of Q1 Daily Lesson Logs (DLL) & Table of Specifications (TOS)',
          content: 'All Senior High School faculty members are requested to upload their complete Q1 Daily Lesson Logs (DLL), Table of Specifications (TOS), and Test Questions (TQ) to their respective Grade 11 or Grade 12 repositories before Friday 5:00 PM.',
          priority: 'urgent',
          targetAudience: 'All SHS Faculty',
          status: 'published',
          isPinned: true,
          authorName: 'John Vic Garnica (Admin)',
          authorRole: 'SHS Department Head / Admin',
          createdAt: today,
          updatedAt: today,
        },
        {
          id: 'ann-2',
          title: 'Faculty Development Workshop on DepEd SHS Curriculum Updates',
          content: 'Join our upcoming SHS Curriculum & Assessment Alignment Session in the Audio-Visual Room (AVR). Attendance for all Grade 11 and Grade 12 advisers and subject teachers is required.',
          priority: 'important',
          targetAudience: 'All SHS Faculty',
          status: 'published',
          isPinned: false,
          authorName: 'John Vic Garnica (Admin)',
          authorRole: 'SHS Department Head / Admin',
          createdAt: today,
          updatedAt: today,
        }
      ];

      for (const ann of defaultAnnouncements) {
        saveAnnouncementToLocalStorage(ann);
        await setDoc(doc(db, ANNOUNCEMENTS_COL, ann.id), ann, { merge: true });
      }

      await setDoc(doc(db, SETTINGS_COL, 'announcements_seeded'), {
        key: 'announcements_seeded',
        value: 'true',
        updatedAt: new Date().toISOString(),
      });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('svnhs_announcements_seeded', 'true');
    }
  } catch (err: any) {
    const errStr = (err?.message || err?.code || String(err) || '').toLowerCase();
    const isOffline =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errStr.includes('offline') ||
      errStr.includes('backend') ||
      errStr.includes('failed to get document') ||
      errStr.includes('network');
    if (isOffline) {
      console.warn('Firestore is connecting, deferred announcement seeding.');
    } else {
      console.error('Error seeding initial announcements to Firestore:', err);
    }
  } finally {
    isSeedingAnnouncements = false;
  }
};

// 8. GOOGLE DRIVE FOLDERS MANAGEMENT
const DRIVE_FOLDERS_STORAGE_KEY = 'svnhs_drive_folders';

export const extractDriveId = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
};

export const getStoredDriveFolders = (): DriveFolder[] => {
  return getOfflineDataSync<DriveFolder[]>(DRIVE_FOLDERS_STORAGE_KEY, INITIAL_DRIVE_FOLDERS);
};

export const saveDriveFolderToLocalStorage = (folder: DriveFolder) => {
  try {
    const list = getStoredDriveFolders();
    const existingIdx = list.findIndex((f) => f.id === folder.id || f.path === folder.path);
    if (existingIdx >= 0) {
      list[existingIdx] = folder;
    } else {
      list.push(folder);
    }
    saveOfflineData(DRIVE_FOLDERS_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving drive folder to local cache:', err);
  }
};

export const deleteDriveFolderFromLocalStorage = (id: string) => {
  try {
    const list = getStoredDriveFolders();
    const updated = list.filter((f) => f.id !== id);
    saveOfflineData(DRIVE_FOLDERS_STORAGE_KEY, updated);
  } catch (err) {
    console.error('Error deleting drive folder from local cache:', err);
  }
};

export const saveDriveFolderToFirestore = async (folder: DriveFolder) => {
  try {
    saveDriveFolderToLocalStorage(folder);
    const docId = folder.id || `folder_${folder.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;
    const cleanFolder: DriveFolder = {
      ...folder,
      id: docId,
      driveId: folder.driveId || extractDriveId(folder.driveUrl),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, DRIVE_FOLDERS_COL, docId), cleanFolder, { merge: true });
  } catch (err) {
    console.error('Error saving drive folder to Firestore:', err);
  }
};

export const deleteDriveFolderFromFirestore = async (id: string) => {
  try {
    deleteDriveFolderFromLocalStorage(id);
    await deleteDoc(doc(db, DRIVE_FOLDERS_COL, id));
  } catch (err) {
    console.error('Error deleting drive folder from Firestore:', err);
  }
};

export const subscribeDriveFolders = (onUpdate: (folders: DriveFolder[]) => void) => {
  return onSnapshot(
    collection(db, DRIVE_FOLDERS_COL),
    (snapshot) => {
      if (snapshot.empty) {
        // If Firestore is empty, seed initial folders and fallback to defaults
        seedInitialDriveFoldersIfEmpty();
        const cached = getStoredDriveFolders();
        onUpdate(cached.length > 0 ? cached : INITIAL_DRIVE_FOLDERS);
        return;
      }

      const list: DriveFolder[] = snapshot.docs.map((d) => d.data() as DriveFolder);

      // Order root first, then by name
      list.sort((a, b) => {
        if (a.path === 'all') return -1;
        if (b.path === 'all') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      saveOfflineData(DRIVE_FOLDERS_STORAGE_KEY, list);

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to drive folders collection:', err);
      const cached = getStoredDriveFolders();
      onUpdate(cached.length > 0 ? cached : INITIAL_DRIVE_FOLDERS);
    }
  );
};

let isSeedingDriveFolders = false;
export const seedInitialDriveFoldersIfEmpty = async () => {
  if (isSeedingDriveFolders) return;
  if (typeof window !== 'undefined' && localStorage.getItem('svnhs_drive_folders_seeded') === 'true') {
    return;
  }
  isSeedingDriveFolders = true;
  try {
    const seedSnap = await getDoc(doc(db, SETTINGS_COL, 'drive_folders_seeded'));
    if (!seedSnap.exists()) {
      for (const folder of INITIAL_DRIVE_FOLDERS) {
        saveDriveFolderToLocalStorage(folder);
        await setDoc(doc(db, DRIVE_FOLDERS_COL, folder.id), folder, { merge: true });
      }

      await setDoc(doc(db, SETTINGS_COL, 'drive_folders_seeded'), {
        key: 'drive_folders_seeded',
        value: 'true',
        updatedAt: new Date().toISOString(),
      });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('svnhs_drive_folders_seeded', 'true');
    }
  } catch (err: any) {
    const errStr = (err?.message || err?.code || String(err) || '').toLowerCase();
    const isOffline =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errStr.includes('offline') ||
      errStr.includes('backend') ||
      errStr.includes('failed to get document') ||
      errStr.includes('network');
    if (isOffline) {
      console.warn('Firestore is connecting, deferred drive folder seeding.');
    } else {
      console.error('Error seeding initial drive folders to Firestore:', err);
    }
  } finally {
    isSeedingDriveFolders = false;
  }
};

// INITIALIZATION & SEEDING
let isSeedingAdmin = false;
export const seedInitialAdminIfEmpty = async () => {
  if (isSeedingAdmin) return;
  if (typeof window !== 'undefined' && localStorage.getItem('svnhs_admin_seeded') === 'true') {
    return;
  }
  isSeedingAdmin = true;
  try {
    // Seed default announcements if not already seeded
    await seedInitialAnnouncementsIfEmpty();
    // Seed default drive folders if not already seeded
    await seedInitialDriveFoldersIfEmpty();
    // Seed default school permanent folders if not already seeded
    await seedInitialSchoolPermanentFoldersIfEmpty();
    // Seed default embedded videos if not already seeded
    await seedInitialEmbeddedVideosIfEmpty();

    // Seed master admin email into Firebase settings if not already present
    const adminEmailSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_admin_email'));
    let masterAdminEmail = 'johnvic.garnica@deped.gov.ph';
    if (!adminEmailSnap.exists()) {
      await setDoc(doc(db, SETTINGS_COL, 'svnhs_admin_email'), {
        key: 'svnhs_admin_email',
        value: masterAdminEmail,
        updatedAt: new Date().toISOString(),
      });
    } else {
      masterAdminEmail = adminEmailSnap.data()?.value || masterAdminEmail;
    }

    const masterAdminDocId = emailToDocId(masterAdminEmail);
    const masterAdminObj = {
      id: 'admin-master',
      name: 'John Vic Garnica (Admin)',
      email: masterAdminEmail,
      designation: 'Web Developer',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, ADMINS_COL, masterAdminDocId), masterAdminObj, { merge: true });

    // Seed/Update Admin Norma Jabagat as Master Teacher
    const normaEmail = 'norma.jabagat@deped.gov.ph';
    const normaDocId = emailToDocId(normaEmail);
    const normaObj = {
      id: 'admin-norma',
      name: 'Norma Jabagat',
      email: normaEmail,
      designation: 'Master Teacher',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, ADMINS_COL, normaDocId), normaObj, { merge: true });

    // Ensure deleted admins (Marivic R. Villaluz & SHS Department Coordinator) are purged from Firestore
    try {
      const marivicDocId = emailToDocId('marivic.villaluz@deped.gov.ph');
      await deleteDoc(doc(db, ADMINS_COL, marivicDocId));
      await deleteDoc(doc(db, ADMINS_COL, 'admin-marivic'));
      await deleteDoc(doc(db, PASSWORDS_COL, marivicDocId));
      await deleteDoc(doc(db, PASSWORDS_COL, `admin_${marivicDocId}`));
      await deleteDoc(doc(db, PASSWORDS_COL, `faculty_${marivicDocId}`));

      const coordDocId = emailToDocId('coordinator@deped.gov.ph');
      await deleteDoc(doc(db, ADMINS_COL, coordDocId));
      await deleteDoc(doc(db, ADMINS_COL, 'admin-coordinator'));
      await deleteDoc(doc(db, PASSWORDS_COL, coordDocId));
      await deleteDoc(doc(db, PASSWORDS_COL, `admin_${coordDocId}`));
      await deleteDoc(doc(db, PASSWORDS_COL, `faculty_${coordDocId}`));

      // Scan and delete any remaining document in ADMINS_COL matching the deleted admins
      const existingAdminsSnap = await getDocs(collection(db, ADMINS_COL));
      for (const d of existingAdminsSnap.docs) {
        const dData = d.data();
        const dEmail = (dData.email || '').toLowerCase().trim();
        const dName = (dData.name || '').toLowerCase().trim();
        if (
          dEmail === 'coordinator@deped.gov.ph' ||
          dEmail === 'marivic.villaluz@deped.gov.ph' ||
          dName.includes('shs department coordinator') ||
          (dName.includes('marivic') && dName.includes('villaluz')) ||
          d.id === 'admin-marivic' ||
          d.id === 'admin-coordinator'
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (e) {
      console.warn('Purged deleted admins check notice:', e);
    }

    // Seed master admin password into Firebase settings if not already present
    const adminPassSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_admin_password'));
    if (!adminPassSnap.exists()) {
      await setDoc(doc(db, SETTINGS_COL, 'svnhs_admin_password'), {
        key: 'svnhs_admin_password',
        value: 'garjohn@1995',
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed master faculty password into Firebase settings if not already present
    const facultyPassSnap = await getDoc(doc(db, SETTINGS_COL, 'svnhs_faculty_password'));
    if (!facultyPassSnap.exists()) {
      await setDoc(doc(db, SETTINGS_COL, 'svnhs_faculty_password'), {
        key: 'svnhs_faculty_password',
        value: 'shs304868',
        updatedAt: new Date().toISOString(),
      });
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('svnhs_admin_seeded', 'true');
    }
  } catch (err: any) {
    const errStr = (err?.message || err?.code || String(err) || '').toLowerCase();
    const isOffline =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errStr.includes('offline') ||
      errStr.includes('backend') ||
      errStr.includes('failed to get document') ||
      errStr.includes('network');
    if (isOffline) {
      console.warn('Firestore is connecting, deferred admin seeding.');
    } else {
      console.error('Error seeding initial admin to Firestore:', err);
    }
  } finally {
    isSeedingAdmin = false;
  }
};

// 9. FACULTY PERSONAL WORKSPACE FOLDERS
const FACULTY_FOLDERS_STORAGE_KEY = 'svnhs_faculty_folders';
const FACULTY_FILES_STORAGE_KEY = 'svnhs_faculty_files';

export const getStoredFacultyFolders = (): FacultyFolder[] => {
  return getOfflineDataSync<FacultyFolder[]>(FACULTY_FOLDERS_STORAGE_KEY, []);
};

export const saveFacultyFolderToLocalStorage = (folder: FacultyFolder) => {
  try {
    const list = getStoredFacultyFolders();
    const existingIdx = list.findIndex((f) => f.id === folder.id);
    if (existingIdx >= 0) {
      list[existingIdx] = folder;
    } else {
      list.push(folder);
    }
    saveOfflineData(FACULTY_FOLDERS_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving faculty folder to local cache:', err);
  }
};

export const deleteFacultyFolderFromLocalStorage = (id: string) => {
  try {
    const list = getStoredFacultyFolders();
    const updated = list.filter((f) => f.id !== id);
    saveOfflineData(FACULTY_FOLDERS_STORAGE_KEY, updated);
  } catch (err) {
    console.error('Error deleting faculty folder from local cache:', err);
  }
};

export const saveFacultyFolderToFirestore = async (folder: FacultyFolder) => {
  try {
    saveFacultyFolderToLocalStorage(folder);
    const docId = folder.id;
    const cleanFolder: FacultyFolder = {
      ...folder,
      facultySurname: folder.facultySurname || extractFacultySurname(folder.facultyName),
      driveId: folder.driveId || extractDriveId(folder.driveUrl || ''),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, FACULTY_FOLDERS_COL, docId), cleanFolder, { merge: true });
  } catch (err) {
    console.error('Error saving faculty folder to Firestore:', err);
  }
};

export const deleteFacultyFolderFromFirestore = async (id: string) => {
  try {
    deleteFacultyFolderFromLocalStorage(id);
    await deleteDoc(doc(db, FACULTY_FOLDERS_COL, id));

    // Also delete associated files for this folder
    const allFiles = getStoredFacultyFiles();
    const filesToDelete = allFiles.filter((f) => f.folderId === id);
    for (const file of filesToDelete) {
      await deleteFacultyFileFromFirestore(file.id);
    }
  } catch (err) {
    console.error('Error deleting faculty folder from Firestore:', err);
  }
};

export const subscribeFacultyFolders = (onUpdate: (folders: FacultyFolder[]) => void) => {
  return onSnapshot(
    collection(db, FACULTY_FOLDERS_COL),
    (snapshot) => {
      const list: FacultyFolder[] = snapshot.docs.map((d) => d.data() as FacultyFolder);
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      saveOfflineData(FACULTY_FOLDERS_STORAGE_KEY, list);

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to faculty folders collection:', err);
      const cached = getStoredFacultyFolders();
      onUpdate(cached);
    }
  );
};

// 10. FACULTY PERSONAL FILES
export const getStoredFacultyFiles = (): FacultyPersonalFile[] => {
  return getOfflineDataSync<FacultyPersonalFile[]>(FACULTY_FILES_STORAGE_KEY, []);
};

export const saveFacultyFileToLocalStorage = (file: FacultyPersonalFile) => {
  try {
    const list = getStoredFacultyFiles();
    const existingIdx = list.findIndex((f) => f.id === file.id);
    if (existingIdx >= 0) {
      list[existingIdx] = file;
    } else {
      list.unshift(file);
    }
    saveOfflineData(FACULTY_FILES_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving faculty file to local cache:', err);
  }
};

export const deleteFacultyFileFromLocalStorage = (id: string) => {
  try {
    const list = getStoredFacultyFiles();
    const updated = list.filter((f) => f.id !== id);
    saveOfflineData(FACULTY_FILES_STORAGE_KEY, updated);
  } catch (err) {
    console.error('Error deleting faculty file from local cache:', err);
  }
};

// Automatic cleanup of files older than 1 week (7 days)
export const cleanupExpiredFacultyFiles = async () => {
  try {
    const files = getStoredFacultyFiles();
    const now = Date.now();
    for (const file of files) {
      const expireTime = file.expiresAt
        ? new Date(file.expiresAt).getTime()
        : new Date(file.uploadedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
      if (expireTime <= now) {
        console.log(`[SVNHS Auto-Cleanup] Purging expired faculty file "${file.title}" (uploaded ${file.uploadedAt})`);
        await deleteFacultyFileFromFirestore(file.id);
      }
    }
  } catch (err) {
    console.warn('Error during faculty file auto-cleanup:', err);
  }
};

export const saveFacultyFileToFirestore = async (file: FacultyPersonalFile) => {
  try {
    // Enforce 1-week expiration timestamp if not set
    const preparedFile: FacultyPersonalFile = {
      ...file,
      expiresAt: file.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Always cache full file (including fileData) in local offline store
    saveFacultyFileToLocalStorage(preparedFile);

    const CHUNK_SIZE = 450000; // ~450 KB chunks to safely remain under Firestore 1MB doc limit
    const rawData = preparedFile.fileData;

    if (rawData && rawData.length > CHUNK_SIZE) {
      // Split large file into multiple chunks
      const totalChunks = Math.ceil(rawData.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunkSlice = rawData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkDocId = `${preparedFile.id}_chunk_${i}`;
        await setDoc(doc(db, FACULTY_FILE_CHUNKS_COL, chunkDocId), {
          fileId: preparedFile.id,
          chunkIndex: i,
          totalChunks,
          data: chunkSlice,
          updatedAt: new Date().toISOString(),
        });
      }

      // Save main file document without giant fileData field to avoid 1MB limit
      const { fileData: _omit, ...metadataDoc } = preparedFile;
      await setDoc(doc(db, FACULTY_FILES_COL, preparedFile.id), {
        ...metadataDoc,
        chunkCount: totalChunks,
      }, { merge: true });
    } else {
      // Small file (< 450KB) - store directly in document
      await setDoc(doc(db, FACULTY_FILES_COL, preparedFile.id), {
        ...preparedFile,
        chunkCount: 1,
      }, { merge: true });
    }

    // Update folder itemCount if exists
    const folders = getStoredFacultyFolders();
    const targetFolder = folders.find((f) => f.id === preparedFile.folderId);
    if (targetFolder) {
      const folderFiles = getStoredFacultyFiles().filter((f) => f.folderId === preparedFile.folderId);
      targetFolder.itemCount = folderFiles.length;
      targetFolder.updatedAt = new Date().toISOString();
      await saveFacultyFolderToFirestore(targetFolder);
    }
  } catch (err) {
    console.error('Error saving faculty file to Firestore:', err);
  }
};

/**
 * Retrieve the full file data URL for viewing, previewing, or downloading.
 * Reassembles chunks if the file was split into multiple documents in Firestore.
 */
export const getFacultyFileData = async (file: FacultyPersonalFile): Promise<string | null> => {
  if (file.fileData) return file.fileData;

  // Check local offline store
  const storedList = getStoredFacultyFiles();
  const cached = storedList.find((f) => f.id === file.id);
  if (cached?.fileData) {
    return cached.fileData;
  }

  // Check if chunked in Firestore
  if (file.chunkCount && file.chunkCount > 1) {
    try {
      const chunksQuery = query(
        collection(db, FACULTY_FILE_CHUNKS_COL),
        where('fileId', '==', file.id)
      );
      const snapshot = await getDocs(chunksQuery);
      if (!snapshot.empty) {
        const chunkDocs = snapshot.docs.map((d) => d.data() as { chunkIndex: number; data: string });
        chunkDocs.sort((a, b) => a.chunkIndex - b.chunkIndex);
        const assembled = chunkDocs.map((c) => c.data).join('');
        if (assembled) {
          // Cache assembled in local store for next time
          cached && (cached.fileData = assembled);
          saveFacultyFileToLocalStorage({ ...file, fileData: assembled });
          return assembled;
        }
      }
    } catch (err) {
      console.warn('Error fetching file chunks from Firestore:', err);
    }
  }

  // Fallback: check main doc in Firestore
  try {
    const docSnap = await getDoc(doc(db, FACULTY_FILES_COL, file.id));
    if (docSnap.exists()) {
      const data = docSnap.data() as FacultyPersonalFile;
      if (data.fileData) {
        saveFacultyFileToLocalStorage(data);
        return data.fileData;
      }
    }
  } catch (err) {
    console.warn('Error fetching file doc from Firestore:', err);
  }

  return null;
};

export const deleteFacultyFileFromFirestore = async (id: string) => {
  try {
    const files = getStoredFacultyFiles();
    const file = files.find((f) => f.id === id);
    const folderId = file?.folderId;

    deleteFacultyFileFromLocalStorage(id);
    await deleteDoc(doc(db, FACULTY_FILES_COL, id));

    // Delete any chunks if present
    if (file?.chunkCount && file.chunkCount > 1) {
      for (let i = 0; i < file.chunkCount; i++) {
        try {
          await deleteDoc(doc(db, FACULTY_FILE_CHUNKS_COL, `${id}_chunk_${i}`));
        } catch {
          // Ignore individual chunk delete error
        }
      }
    }

    if (folderId) {
      const folders = getStoredFacultyFolders();
      const targetFolder = folders.find((f) => f.id === folderId);
      if (targetFolder) {
        const remaining = getStoredFacultyFiles().filter((f) => f.folderId === folderId && f.id !== id);
        targetFolder.itemCount = remaining.length;
        targetFolder.updatedAt = new Date().toISOString();
        await saveFacultyFolderToFirestore(targetFolder);
      }
    }
  } catch (err) {
    console.error('Error deleting faculty file from Firestore:', err);
  }
};

export const subscribeFacultyFiles = (onUpdate: (files: FacultyPersonalFile[]) => void) => {
  return onSnapshot(
    collection(db, FACULTY_FILES_COL),
    (snapshot) => {
      const list: FacultyPersonalFile[] = snapshot.docs.map((d) => d.data() as FacultyPersonalFile);
      list.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));

      // Clean up local list with fresh data
      saveOfflineData(FACULTY_FILES_STORAGE_KEY, list);

      // Trigger asynchronous background cleanup of any expired 1-week files
      cleanupExpiredFacultyFiles();

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to faculty files collection:', err);
      const cached = getStoredFacultyFiles();
      onUpdate(cached);
    }
  );
};

// 10. FACULTY WEEKLY SUBMISSION REPORTS (DLL, TOS, TQ - 11 WEEKS PER TERM)
export type SubmissionCategory = 'dll' | 'tos' | 'tq';
export type ItemSubmissionStatus = 'unchecked' | 'checked' | 'with-comments' | 'incomplete' | 'late';

export const getCategoryCollectionName = (category: SubmissionCategory = 'dll') => {
  if (category === 'tos') return 'facultySubmissions_tos';
  if (category === 'tq') return 'facultySubmissions_tq';
  return 'facultySubmissions_dll';
};

export const getCategoryStorageKey = (category: SubmissionCategory = 'dll') => {
  return `svnhs_faculty_sub_${category}_cache_v1`;
};

export const getCategoryStatusStorageKey = (category: SubmissionCategory = 'dll') => {
  return `svnhs_faculty_status_${category}_cache_v1`;
};

export const getCategoryCommentsStorageKey = (category: SubmissionCategory = 'dll') => {
  return `svnhs_faculty_comments_${category}_cache_v1`;
};

export const getStoredFacultySubmissions = (
  termId: string,
  category: SubmissionCategory = 'dll'
): Record<string, boolean[]> => {
  return getOfflineDataSync<Record<string, boolean[]>>(`${getCategoryStorageKey(category)}_${termId}`, {});
};

export const saveFacultySubmissionsToLocalStorage = (
  termId: string,
  category: SubmissionCategory = 'dll',
  data: Record<string, boolean[]>
) => {
  try {
    saveOfflineData(`${getCategoryStorageKey(category)}_${termId}`, data);
    if (category === 'dll') {
      saveOfflineData(`${FACULTY_SUBMISSIONS_STORAGE_KEY}_${termId}`, data);
    }
  } catch (e) {
    console.error(`Error saving faculty ${category} submissions to local cache:`, e);
  }
};

export const getStoredFacultyStatuses = (
  termId: string,
  category: SubmissionCategory = 'dll'
): Record<string, ItemSubmissionStatus[]> => {
  return getOfflineDataSync<Record<string, ItemSubmissionStatus[]>>(`${getCategoryStatusStorageKey(category)}_${termId}`, {});
};

export const saveFacultyStatusesToLocalStorage = (
  termId: string,
  category: SubmissionCategory = 'dll',
  data: Record<string, ItemSubmissionStatus[]>
) => {
  try {
    saveOfflineData(`${getCategoryStatusStorageKey(category)}_${termId}`, data);
  } catch (e) {
    console.error(`Error saving faculty ${category} statuses to local cache:`, e);
  }
};

export const getStoredFacultyComments = (
  termId: string,
  category: SubmissionCategory = 'dll'
): Record<string, Record<string, string>> => {
  return getOfflineDataSync<Record<string, Record<string, string>>>(`${getCategoryCommentsStorageKey(category)}_${termId}`, {});
};

export const saveFacultyCommentsToLocalStorage = (
  termId: string,
  category: SubmissionCategory = 'dll',
  data: Record<string, Record<string, string>>
) => {
  try {
    saveOfflineData(`${getCategoryCommentsStorageKey(category)}_${termId}`, data);
  } catch (e) {
    console.error(`Error saving faculty ${category} comments to local cache:`, e);
  }
};

export const saveFacultySubmissionToFirestore = async (
  termId: string,
  category: SubmissionCategory = 'dll',
  facultyEmail: string,
  weeks: boolean[],
  facultyName?: string,
  department?: string,
  statuses?: ItemSubmissionStatus[],
  comments?: Record<string, string>
) => {
  try {
    const cleanEmail = facultyEmail.toLowerCase().trim();
    const docId = `${termId}_${emailToDocId(cleanEmail)}`;
    const colName = getCategoryCollectionName(category);

    // Update local storage immediately for responsive UI
    const currentCached = getStoredFacultySubmissions(termId, category);
    currentCached[cleanEmail] = weeks;
    saveFacultySubmissionsToLocalStorage(termId, category, currentCached);

    if (statuses) {
      const cachedStatuses = getStoredFacultyStatuses(termId, category);
      cachedStatuses[cleanEmail] = statuses;
      saveFacultyStatusesToLocalStorage(termId, category, cachedStatuses);
    }

    if (comments) {
      const cachedComments = getStoredFacultyComments(termId, category);
      cachedComments[cleanEmail] = comments;
      saveFacultyCommentsToLocalStorage(termId, category, cachedComments);
    }

    const docPayload: Record<string, any> = {
      id: docId,
      termId,
      category,
      facultyEmail: cleanEmail,
      facultyName: facultyName || '',
      department: department || '',
      weeks: Array.isArray(weeks) ? [...weeks] : [],
      updatedAt: new Date().toISOString(),
    };

    if (statuses && Array.isArray(statuses)) {
      docPayload.statuses = [...statuses];
    }
    if (comments && typeof comments === 'object') {
      docPayload.comments = { ...comments };
    }

    // Save to category collection
    await setDoc(doc(db, colName, docId), docPayload, { merge: true });

    // Also mirror to legacy collection if DLL for backwards compatibility
    if (category === 'dll') {
      await setDoc(doc(db, FACULTY_SUBMISSIONS_COL, docId), docPayload, { merge: true });
    }
  } catch (err) {
    console.error(`Error saving faculty ${category} submission to Firestore:`, err);
    throw err;
  }
};

export const batchSaveFacultySubmissionsToFirestore = async (
  termId: string,
  category: SubmissionCategory = 'dll',
  submissions: Record<string, boolean[]>,
  statuses?: Record<string, ItemSubmissionStatus[]>,
  comments?: Record<string, Record<string, string>>
) => {
  try {
    saveFacultySubmissionsToLocalStorage(termId, category, submissions);
    if (statuses) saveFacultyStatusesToLocalStorage(termId, category, statuses);
    if (comments) saveFacultyCommentsToLocalStorage(termId, category, comments);

    const colName = getCategoryCollectionName(category);

    const promises = Object.entries(submissions).map(([email, weeks]) => {
      const cleanEmail = email.toLowerCase().trim();
      const docId = `${termId}_${emailToDocId(cleanEmail)}`;
      const docPayload: Record<string, any> = {
        id: docId,
        termId,
        category,
        facultyEmail: cleanEmail,
        weeks: Array.isArray(weeks) ? [...weeks] : [],
        updatedAt: new Date().toISOString(),
      };
      if (statuses && statuses[cleanEmail]) {
        docPayload.statuses = [...statuses[cleanEmail]];
      }
      if (comments && comments[cleanEmail]) {
        docPayload.comments = { ...comments[cleanEmail] };
      }
      return setDoc(doc(db, colName, docId), docPayload, { merge: true });
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`Error batch saving faculty ${category} submissions to Firestore:`, err);
    throw err;
  }
};

export const saveWeekDataToFirestore = async (
  termId: string,
  category: SubmissionCategory = 'dll',
  weekIndex: number,
  submissions: Record<string, boolean[]>,
  facultyList: { email: string; name?: string; department?: string }[],
  statuses?: Record<string, ItemSubmissionStatus[]>,
  comments?: Record<string, Record<string, string>>
) => {
  try {
    saveFacultySubmissionsToLocalStorage(termId, category, submissions);
    if (statuses) saveFacultyStatusesToLocalStorage(termId, category, statuses);
    if (comments) saveFacultyCommentsToLocalStorage(termId, category, comments);

    const colName = getCategoryCollectionName(category);

    const promises = facultyList.map((f) => {
      const cleanEmail = f.email.toLowerCase().trim();
      const docId = `${termId}_${emailToDocId(cleanEmail)}`;
      const weeks = submissions[cleanEmail] || Array(MAX_TERM_WEEKS).fill(false);

      const docPayload: Record<string, any> = {
        id: docId,
        termId,
        category,
        facultyEmail: cleanEmail,
        facultyName: f.name || '',
        department: f.department || '',
        weeks: Array.isArray(weeks) ? [...weeks] : [],
        lastSavedWeek: weekIndex + 1,
        updatedAt: new Date().toISOString(),
      };

      if (statuses && statuses[cleanEmail]) {
        docPayload.statuses = [...statuses[cleanEmail]];
      }
      if (comments && comments[cleanEmail]) {
        docPayload.comments = { ...comments[cleanEmail] };
      }

      return setDoc(doc(db, colName, docId), docPayload, { merge: true });
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`Error saving Week ${weekIndex + 1} data to Firestore:`, err);
    throw err;
  }
};

export const subscribeFacultySubmissions = (
  termId: string,
  category: SubmissionCategory = 'dll',
  onUpdate: (
    submissionsMap: Record<string, boolean[]>,
    statusesMap?: Record<string, ItemSubmissionStatus[]>,
    commentsMap?: Record<string, Record<string, string>>
  ) => void
) => {
  const colName = getCategoryCollectionName(category);

  return onSnapshot(
    collection(db, colName),
    (snapshot) => {
      const map: Record<string, boolean[]> = {};
      const statusMap: Record<string, ItemSubmissionStatus[]> = {};
      const commentMap: Record<string, Record<string, string>> = {};

      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.termId === termId && data.facultyEmail) {
          const emailKey = data.facultyEmail.toLowerCase().trim();
          if (Array.isArray(data.weeks)) {
            map[emailKey] = data.weeks;
          }
          if (Array.isArray(data.statuses)) {
            statusMap[emailKey] = data.statuses;
          } else if (Array.isArray(data.weeks)) {
            // Derive statuses from weeks for backward compatibility
            statusMap[emailKey] = data.weeks.map((w: boolean) => (w ? 'checked' : 'unchecked'));
          }
          if (data.comments && typeof data.comments === 'object') {
            commentMap[emailKey] = data.comments;
          }
        }
      });

      // If category is dll and empty, also check legacy collection
      if (category === 'dll' && Object.keys(map).length === 0) {
        const localCached = getStoredFacultySubmissions(termId, 'dll');
        const merged = { ...localCached, ...map };
        const localStatuses = getStoredFacultyStatuses(termId, 'dll');
        const localComments = getStoredFacultyComments(termId, 'dll');
        onUpdate(merged, localStatuses, localComments);
        return;
      }

      // Prioritize freshly fetched data from Firestore and update local cache
      saveFacultySubmissionsToLocalStorage(termId, category, map);
      saveFacultyStatusesToLocalStorage(termId, category, statusMap);
      saveFacultyCommentsToLocalStorage(termId, category, commentMap);

      onUpdate(map, statusMap, commentMap);
    },
    (err) => {
      console.error(`Error subscribing to faculty ${category} submissions:`, err);
      const cached = getStoredFacultySubmissions(termId, category);
      const cachedStatuses = getStoredFacultyStatuses(termId, category);
      const cachedComments = getStoredFacultyComments(termId, category);
      onUpdate(cached, cachedStatuses, cachedComments);
    }
  );
};

// 11. FACULTY TOS / TQ SUBMISSION REPORTS
export interface TosTqRecord {
  midtermTos: boolean;
  midtermTq: boolean;
  midtermKey: boolean;
  midtermAnalysis: boolean;
  finalTos: boolean;
  finalTq: boolean;
  finalKey: boolean;
  finalAnalysis: boolean;
}

export const DEFAULT_TOSTQ_RECORD: TosTqRecord = {
  midtermTos: false,
  midtermTq: false,
  midtermKey: false,
  midtermAnalysis: false,
  finalTos: false,
  finalTq: false,
  finalKey: false,
  finalAnalysis: false,
};

export const getStoredFacultyTosTq = (termId: string): Record<string, TosTqRecord> => {
  return getOfflineDataSync<Record<string, TosTqRecord>>(`${FACULTY_TOSTQ_STORAGE_KEY}_${termId}`, {});
};

export const saveFacultyTosTqToLocalStorage = (termId: string, data: Record<string, TosTqRecord>) => {
  try {
    saveOfflineData(`${FACULTY_TOSTQ_STORAGE_KEY}_${termId}`, data);
  } catch (e) {
    console.error('Error saving TOS/TQ submissions to local cache:', e);
  }
};

export const saveFacultyTosTqToFirestore = async (
  termId: string,
  facultyEmail: string,
  record: TosTqRecord,
  facultyName?: string,
  department?: string
) => {
  try {
    const cleanEmail = facultyEmail.toLowerCase().trim();
    const docId = `${termId}_${emailToDocId(cleanEmail)}`;

    const currentCached = getStoredFacultyTosTq(termId);
    currentCached[cleanEmail] = record;
    saveFacultyTosTqToLocalStorage(termId, currentCached);

    await setDoc(
      doc(db, FACULTY_TOSTQ_COL, docId),
      {
        id: docId,
        termId,
        facultyEmail: cleanEmail,
        facultyName: facultyName || '',
        department: department || '',
        ...record,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving TOS/TQ submission to Firestore:', err);
  }
};

export const subscribeFacultyTosTq = (
  termId: string,
  onUpdate: (dataMap: Record<string, TosTqRecord>) => void
) => {
  return onSnapshot(
    collection(db, FACULTY_TOSTQ_COL),
    (snapshot) => {
      const map: Record<string, TosTqRecord> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.termId === termId && data.facultyEmail) {
          map[data.facultyEmail.toLowerCase().trim()] = {
            midtermTos: Boolean(data.midtermTos),
            midtermTq: Boolean(data.midtermTq),
            midtermKey: Boolean(data.midtermKey),
            midtermAnalysis: Boolean(data.midtermAnalysis),
            finalTos: Boolean(data.finalTos),
            finalTq: Boolean(data.finalTq),
            finalKey: Boolean(data.finalKey),
            finalAnalysis: Boolean(data.finalAnalysis),
          };
        }
      });

      // Prioritize freshly fetched data from Firestore and update local cache
      saveFacultyTosTqToLocalStorage(termId, map);
      onUpdate(map);
    },
    (err) => {
      console.error('Error subscribing to TOS/TQ submissions:', err);
      const cached = getStoredFacultyTosTq(termId);
      onUpdate(cached);
    }
  );
};

// 12. FACULTY SCHOOL FORMS SUBMISSION REPORTS
export interface SchoolFormsRecord {
  sf1: boolean;
  sf2: boolean;
  sf3: boolean;
  sf4: boolean;
  sf5a: boolean;
  sf5b: boolean;
  sf9: boolean;
  sf10: boolean;
  gradingSheets: boolean;
}

export const DEFAULT_SCHOOL_FORMS_RECORD: SchoolFormsRecord = {
  sf1: false,
  sf2: false,
  sf3: false,
  sf4: false,
  sf5a: false,
  sf5b: false,
  sf9: false,
  sf10: false,
  gradingSheets: false,
};

export const getStoredFacultySchoolForms = (termId: string): Record<string, SchoolFormsRecord> => {
  return getOfflineDataSync<Record<string, SchoolFormsRecord>>(`${FACULTY_SCHOOL_FORMS_STORAGE_KEY}_${termId}`, {});
};

export const saveFacultySchoolFormsToLocalStorage = (termId: string, data: Record<string, SchoolFormsRecord>) => {
  try {
    saveOfflineData(`${FACULTY_SCHOOL_FORMS_STORAGE_KEY}_${termId}`, data);
  } catch (e) {
    console.error('Error saving School Forms submissions to local cache:', e);
  }
};

export const saveFacultySchoolFormsToFirestore = async (
  termId: string,
  facultyEmail: string,
  record: SchoolFormsRecord,
  facultyName?: string,
  department?: string
) => {
  try {
    const cleanEmail = facultyEmail.toLowerCase().trim();
    const docId = `${termId}_${emailToDocId(cleanEmail)}`;

    const currentCached = getStoredFacultySchoolForms(termId);
    currentCached[cleanEmail] = record;
    saveFacultySchoolFormsToLocalStorage(termId, currentCached);

    await setDoc(
      doc(db, FACULTY_SCHOOL_FORMS_COL, docId),
      {
        id: docId,
        termId,
        facultyEmail: cleanEmail,
        facultyName: facultyName || '',
        department: department || '',
        ...record,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving School Forms submission to Firestore:', err);
  }
};

export const subscribeFacultySchoolForms = (
  termId: string,
  onUpdate: (dataMap: Record<string, SchoolFormsRecord>) => void
) => {
  return onSnapshot(
    collection(db, FACULTY_SCHOOL_FORMS_COL),
    (snapshot) => {
      const map: Record<string, SchoolFormsRecord> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.termId === termId && data.facultyEmail) {
          map[data.facultyEmail.toLowerCase().trim()] = {
            sf1: Boolean(data.sf1),
            sf2: Boolean(data.sf2),
            sf3: Boolean(data.sf3),
            sf4: Boolean(data.sf4),
            sf5a: Boolean(data.sf5a),
            sf5b: Boolean(data.sf5b),
            sf9: Boolean(data.sf9),
            sf10: Boolean(data.sf10),
            gradingSheets: Boolean(data.gradingSheets),
          };
        }
      });

      // Prioritize freshly fetched data from Firestore and update local cache
      saveFacultySchoolFormsToLocalStorage(termId, map);
      onUpdate(map);
    },
    (err) => {
      console.error('Error subscribing to School Forms submissions:', err);
      const cached = getStoredFacultySchoolForms(termId);
      onUpdate(cached);
    }
  );
};

// 13. TERM WEEKS CONFIGURATION (Up to 12 weeks per term)
export interface TermWeeksConfig {
  'term-1': number;
  'term-2': number;
  'term-3': number;
}

export const DEFAULT_TERM_WEEKS_CONFIG: TermWeeksConfig = {
  'term-1': 11,
  'term-2': 11,
  'term-3': 11,
};

export const MAX_TERM_WEEKS = 12;
export const MIN_TERM_WEEKS = 1;

const TERM_WEEKS_STORAGE_KEY = 'svnhs_term_weeks_config';

export const getStoredTermWeeksConfig = (): TermWeeksConfig => {
  return getOfflineDataSync<TermWeeksConfig>(TERM_WEEKS_STORAGE_KEY, DEFAULT_TERM_WEEKS_CONFIG);
};

export const saveTermWeeksConfigToLocalStorage = (config: TermWeeksConfig) => {
  try {
    saveOfflineData(TERM_WEEKS_STORAGE_KEY, config);
  } catch (e) {
    console.error('Error saving term weeks config to local cache:', e);
  }
};

export const saveTermWeeksConfigToFirestore = async (config: TermWeeksConfig) => {
  try {
    const sanitized: TermWeeksConfig = {
      'term-1': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(config['term-1']) || 11)),
      'term-2': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(config['term-2']) || 11)),
      'term-3': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(config['term-3']) || 11)),
    };
    saveTermWeeksConfigToLocalStorage(sanitized);
    await setDoc(
      doc(db, SETTINGS_COL, 'term_weeks_config'),
      {
        id: 'term_weeks_config',
        ...sanitized,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving term weeks config to Firestore:', err);
  }
};

export const subscribeTermWeeksConfig = (onUpdate: (config: TermWeeksConfig) => void) => {
  return onSnapshot(
    doc(db, SETTINGS_COL, 'term_weeks_config'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const config: TermWeeksConfig = {
          'term-1': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(data['term-1']) || 11)),
          'term-2': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(data['term-2']) || 11)),
          'term-3': Math.min(MAX_TERM_WEEKS, Math.max(MIN_TERM_WEEKS, Number(data['term-3']) || 11)),
        };
        saveTermWeeksConfigToLocalStorage(config);
        onUpdate(config);
      } else {
        const cached = getStoredTermWeeksConfig();
        onUpdate(cached);
      }
    },
    (err) => {
      console.error('Error subscribing to term weeks config:', err);
      const cached = getStoredTermWeeksConfig();
      onUpdate(cached);
    }
  );
};

// 14. ACTIVE ACADEMIC TERM CONFIGURATION (Default term remembered across page refreshes)
export const ACTIVE_TERM_STORAGE_KEY = 'svnhs_active_academic_term';
export const DEFAULT_ACTIVE_TERM_ID = 'term-1';

export const getStoredActiveTermId = (): string => {
  return getOfflineDataSync<string>(ACTIVE_TERM_STORAGE_KEY, DEFAULT_ACTIVE_TERM_ID);
};

export const saveActiveTermIdToLocalStorage = (termId: string) => {
  try {
    const valid = termId === 'term-2' || termId === 'term-3' ? termId : 'term-1';
    saveOfflineData(ACTIVE_TERM_STORAGE_KEY, valid);
  } catch (e) {
    console.error('Error saving active academic term to local cache:', e);
  }
};

export const saveActiveTermIdToFirestore = async (termId: string) => {
  try {
    const valid = termId === 'term-2' || termId === 'term-3' ? termId : 'term-1';
    saveActiveTermIdToLocalStorage(valid);
    await setDoc(
      doc(db, SETTINGS_COL, 'active_academic_term'),
      {
        id: 'active_academic_term',
        key: 'active_academic_term',
        value: valid,
        termId: valid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving active academic term to Firestore:', err);
  }
};

export const subscribeActiveTermId = (onUpdate: (termId: string) => void) => {
  return onSnapshot(
    doc(db, SETTINGS_COL, 'active_academic_term'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const termId = data.value || data.termId || DEFAULT_ACTIVE_TERM_ID;
        const valid = termId === 'term-2' || termId === 'term-3' ? termId : 'term-1';
        saveActiveTermIdToLocalStorage(valid);
        onUpdate(valid);
      } else {
        const cached = getStoredActiveTermId();
        onUpdate(cached);
      }
    },
    (err) => {
      console.error('Error subscribing to active academic term:', err);
      const cached = getStoredActiveTermId();
      onUpdate(cached);
    }
  );
};

// 15. SCHOOL PERMANENT WORKSPACE FOLDERS ("SCHOOL FORMS" and "SCHOOL DOCUMENTS")
export const SCHOOL_PERMANENT_FOLDERS_STORAGE_KEY = 'svnhs_school_permanent_folders';
export const SCHOOL_PERMANENT_FOLDERS_DOC_ID = 'school_permanent_folders';

export const getStoredSchoolPermanentFolders = (): SchoolPermanentFolder[] => {
  return getOfflineDataSync<SchoolPermanentFolder[]>(SCHOOL_PERMANENT_FOLDERS_STORAGE_KEY, INITIAL_SCHOOL_PERMANENT_FOLDERS);
};

export const saveSchoolPermanentFoldersToLocalStorage = (folders: SchoolPermanentFolder[]) => {
  try {
    saveOfflineData(SCHOOL_PERMANENT_FOLDERS_STORAGE_KEY, folders);
  } catch (e) {
    console.error('Error saving school permanent folders to local cache:', e);
  }
};

export const saveSchoolPermanentFoldersToFirestore = async (folders: SchoolPermanentFolder[]) => {
  try {
    saveSchoolPermanentFoldersToLocalStorage(folders);
    await setDoc(
      doc(db, SETTINGS_COL, SCHOOL_PERMANENT_FOLDERS_DOC_ID),
      {
        id: SCHOOL_PERMANENT_FOLDERS_DOC_ID,
        folders: folders,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving school permanent folders to Firestore:', err);
  }
};

export const updateSchoolPermanentFolderInFirestore = async (
  id: string,
  updates: Partial<SchoolPermanentFolder>
) => {
  try {
    const current = getStoredSchoolPermanentFolders();
    const updatedList = current.map((f) => {
      if (f.id === id) {
        const driveUrl = updates.driveUrl !== undefined ? updates.driveUrl : f.driveUrl;
        return {
          ...f,
          ...updates,
          driveUrl,
          driveId: extractDriveId(driveUrl) || updates.driveId || f.driveId || '',
          updatedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    await saveSchoolPermanentFoldersToFirestore(updatedList);
  } catch (err) {
    console.error('Error updating school permanent folder in Firestore:', err);
    throw err;
  }
};

export const addSchoolPermanentFolderToFirestore = async (
  folderData: {
    name: string;
    description: string;
    driveUrl: string;
    category?: string;
    color?: string;
    createdBy?: string;
    updatedBy?: string;
  }
): Promise<SchoolPermanentFolder> => {
  try {
    const current = getStoredSchoolPermanentFolders();
    const newId = `school-folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newFolder: SchoolPermanentFolder = {
      id: newId,
      name: folderData.name.trim(),
      description: folderData.description.trim(),
      driveUrl: folderData.driveUrl.trim(),
      driveId: extractDriveId(folderData.driveUrl.trim()) || '',
      category: folderData.category || 'School Documents',
      color: folderData.color || 'Indigo',
      isPermanent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: folderData.updatedBy || 'Coordinator',
      createdBy: folderData.createdBy || 'Coordinator',
    };

    const updatedList = [...current, newFolder];
    await saveSchoolPermanentFoldersToFirestore(updatedList);
    return newFolder;
  } catch (err) {
    console.error('Error adding school permanent folder to Firestore:', err);
    throw err;
  }
};

export const deleteSchoolPermanentFolderFromFirestore = async (id: string): Promise<void> => {
  try {
    if (id === 'school-forms' || id === 'school-documents') {
      throw new Error('Default system school folders cannot be deleted.');
    }
    const current = getStoredSchoolPermanentFolders();
    const updatedList = current.filter((f) => f.id !== id);
    await saveSchoolPermanentFoldersToFirestore(updatedList);
  } catch (err) {
    console.error('Error deleting school permanent folder from Firestore:', err);
    throw err;
  }
};

export const subscribeSchoolPermanentFolders = (onUpdate: (folders: SchoolPermanentFolder[]) => void) => {
  return onSnapshot(
    doc(db, SETTINGS_COL, SCHOOL_PERMANENT_FOLDERS_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.folders) && data.folders.length > 0) {
          const loaded: SchoolPermanentFolder[] = data.folders.map((f: Partial<SchoolPermanentFolder>) => {
            const isForms = f.id === 'school-forms';
            const isDocs = f.id === 'school-documents';
            return {
              id: f.id || `school-folder-${Date.now()}`,
              name: f.name || (isForms ? 'SCHOOL FORMS' : isDocs ? 'SCHOOL DOCUMENTS' : 'Untitled Folder'),
              description: f.description || (isForms ? 'Official DepEd school forms (SF1, SF2, SF5, SF9, etc.), templates, and department administrative forms.' : isDocs ? 'Central school memorandums, department orders, curriculum guidelines, faculty circulars, and official policies.' : ''),
              driveUrl: f.driveUrl || '',
              driveId: extractDriveId(f.driveUrl || '') || f.driveId || '',
              category: f.category || (isForms ? 'DepEd Forms & Portfolio' : isDocs ? 'General Subject Materials' : 'School Documents'),
              color: f.color || (isForms ? 'Blue' : isDocs ? 'Emerald' : 'Indigo'),
              isPermanent: isForms || isDocs ? true : Boolean(f.isPermanent),
              createdAt: f.createdAt,
              updatedAt: f.updatedAt || new Date().toISOString(),
              updatedBy: f.updatedBy || 'School Administration',
              createdBy: f.createdBy,
            };
          });

          // Ensure both core default folders always exist
          const hasForms = loaded.some(f => f.id === 'school-forms');
          const hasDocs = loaded.some(f => f.id === 'school-documents');
          if (!hasForms) {
            loaded.unshift(INITIAL_SCHOOL_PERMANENT_FOLDERS[0]);
          }
          if (!hasDocs) {
            const formsIdx = loaded.findIndex(f => f.id === 'school-forms');
            loaded.splice(formsIdx >= 0 ? formsIdx + 1 : 0, 0, INITIAL_SCHOOL_PERMANENT_FOLDERS[1]);
          }

          saveSchoolPermanentFoldersToLocalStorage(loaded);
          onUpdate(loaded);
          return;
        }
      }
      const cached = getStoredSchoolPermanentFolders();
      onUpdate(cached);
    },
    (err) => {
      console.error('Error subscribing to school permanent folders:', err);
      const cached = getStoredSchoolPermanentFolders();
      onUpdate(cached);
    }
  );
};

let isSeedingSchoolPermanentFolders = false;
export const seedInitialSchoolPermanentFoldersIfEmpty = async () => {
  if (isSeedingSchoolPermanentFolders) return;
  if (typeof window !== 'undefined' && localStorage.getItem('svnhs_school_permanent_folders_seeded') === 'true') {
    return;
  }
  isSeedingSchoolPermanentFolders = true;
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, SCHOOL_PERMANENT_FOLDERS_DOC_ID));
    if (!snap.exists()) {
      await saveSchoolPermanentFoldersToFirestore(INITIAL_SCHOOL_PERMANENT_FOLDERS);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('svnhs_school_permanent_folders_seeded', 'true');
    }
  } catch (err: any) {
    const errStr = (err?.message || err?.code || String(err) || '').toLowerCase();
    const isOffline =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errStr.includes('offline') ||
      errStr.includes('backend') ||
      errStr.includes('failed to get document') ||
      errStr.includes('network');
    if (isOffline) {
      console.warn('Firestore is connecting, deferred school permanent folders seeding.');
    } else {
      console.error('Error seeding initial school permanent folders:', err);
    }
  } finally {
    isSeedingSchoolPermanentFolders = false;
  }
};

// ==========================================
// 14. CLASS ADVISER SCHOOL FORMS COMPLIANCE
// Section 1: SF 1, SF 3, SF 4, SF 5, SF 6, SF 8, SF 10
// Section 2: SF 2 Monthly (JUNE to APRIL)
// ==========================================
export interface ClassAdviserSchoolFormsRecord {
  facultyEmail: string;
  facultyName: string;
  department?: string;
  // Section 1: Standard School Forms
  sf1?: boolean;
  sf3?: boolean;
  sf4?: boolean;
  sf5?: boolean;
  sf6?: boolean;
  sf8?: boolean;
  sf10?: boolean;
  // Section 2: SF 2 Monthly Attendance Compliance
  sf2_june?: boolean;
  sf2_july?: boolean;
  sf2_august?: boolean;
  sf2_september?: boolean;
  sf2_october?: boolean;
  sf2_november?: boolean;
  sf2_december?: boolean;
  sf2_january?: boolean;
  sf2_february?: boolean;
  sf2_march?: boolean;
  sf2_april?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const CLASS_ADVISER_FORMS_COL = 'classAdviserSchoolForms';
const CLASS_ADVISER_FORMS_STORAGE_KEY = 'svnhs_class_adviser_forms_cache_v2';

export const getStoredClassAdviserSchoolForms = (): Record<string, ClassAdviserSchoolFormsRecord> => {
  return getOfflineDataSync<Record<string, ClassAdviserSchoolFormsRecord>>(CLASS_ADVISER_FORMS_STORAGE_KEY, {});
};

export const saveClassAdviserSchoolFormsToLocalStorage = (data: Record<string, ClassAdviserSchoolFormsRecord>) => {
  try {
    saveOfflineData(CLASS_ADVISER_FORMS_STORAGE_KEY, data);
  } catch (e) {
    console.error('Error caching Class Adviser School Forms to local cache:', e);
  }
};

export const saveClassAdviserFormCheckboxToFirestore = async (
  facultyEmail: string,
  field: string,
  value: boolean,
  metadata?: { facultyName?: string; department?: string; updatedBy?: string }
) => {
  try {
    const cleanEmail = facultyEmail.toLowerCase().trim();
    if (!cleanEmail) return;
    const docId = emailToDocId(cleanEmail);

    const currentCached = getStoredClassAdviserSchoolForms();
    const existing: ClassAdviserSchoolFormsRecord = currentCached[cleanEmail] || {
      facultyEmail: cleanEmail,
      facultyName: metadata?.facultyName || '',
      department: metadata?.department || '',
    };
    (existing as any)[field] = value;
    existing.updatedAt = new Date().toISOString();
    if (metadata?.updatedBy) existing.updatedBy = metadata.updatedBy;
    currentCached[cleanEmail] = existing;
    saveClassAdviserSchoolFormsToLocalStorage(currentCached);

    await setDoc(
      doc(db, CLASS_ADVISER_FORMS_COL, docId),
      {
        id: docId,
        facultyEmail: cleanEmail,
        facultyName: metadata?.facultyName || existing.facultyName || '',
        department: metadata?.department || existing.department || '',
        [field]: value,
        updatedAt: new Date().toISOString(),
        ...(metadata?.updatedBy ? { updatedBy: metadata.updatedBy } : {}),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving class adviser form checkbox to Firestore:', err);
  }
};

export const batchSaveClassAdviserSchoolFormsToFirestore = async (
  facultyEmail: string,
  updates: Partial<ClassAdviserSchoolFormsRecord>,
  metadata?: { facultyName?: string; department?: string; updatedBy?: string }
) => {
  try {
    const cleanEmail = facultyEmail.toLowerCase().trim();
    if (!cleanEmail) return;
    const docId = emailToDocId(cleanEmail);

    const currentCached = getStoredClassAdviserSchoolForms();
    const existing: ClassAdviserSchoolFormsRecord = currentCached[cleanEmail] || {
      facultyEmail: cleanEmail,
      facultyName: metadata?.facultyName || '',
      department: metadata?.department || '',
    };
    const merged: ClassAdviserSchoolFormsRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      ...(metadata?.updatedBy ? { updatedBy: metadata.updatedBy } : {}),
    };
    currentCached[cleanEmail] = merged;
    saveClassAdviserSchoolFormsToLocalStorage(currentCached);

    await setDoc(
      doc(db, CLASS_ADVISER_FORMS_COL, docId),
      {
        id: docId,
        facultyEmail: cleanEmail,
        facultyName: metadata?.facultyName || existing.facultyName || '',
        department: metadata?.department || existing.department || '',
        ...updates,
        updatedAt: new Date().toISOString(),
        ...(metadata?.updatedBy ? { updatedBy: metadata.updatedBy } : {}),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error batch updating class adviser form in Firestore:', err);
  }
};

export const subscribeClassAdviserSchoolForms = (
  onUpdate: (dataMap: Record<string, ClassAdviserSchoolFormsRecord>) => void
) => {
  return onSnapshot(
    collection(db, CLASS_ADVISER_FORMS_COL),
    (snapshot) => {
      const map: Record<string, ClassAdviserSchoolFormsRecord> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.facultyEmail) {
          const emailKey = data.facultyEmail.toLowerCase().trim();
          map[emailKey] = {
            facultyEmail: emailKey,
            facultyName: data.facultyName || '',
            department: data.department || '',
            sf1: Boolean(data.sf1),
            sf3: Boolean(data.sf3),
            sf4: Boolean(data.sf4),
            sf5: Boolean(data.sf5),
            sf6: Boolean(data.sf6),
            sf8: Boolean(data.sf8),
            sf10: Boolean(data.sf10),
            sf2_june: Boolean(data.sf2_june),
            sf2_july: Boolean(data.sf2_july),
            sf2_august: Boolean(data.sf2_august),
            sf2_september: Boolean(data.sf2_september),
            sf2_october: Boolean(data.sf2_october),
            sf2_november: Boolean(data.sf2_november),
            sf2_december: Boolean(data.sf2_december),
            sf2_january: Boolean(data.sf2_january),
            sf2_february: Boolean(data.sf2_february),
            sf2_march: Boolean(data.sf2_march),
            sf2_april: Boolean(data.sf2_april),
            updatedAt: data.updatedAt || '',
            updatedBy: data.updatedBy || '',
          };
        }
      });

      // Prioritize freshly fetched data from Firestore and update local cache
      saveClassAdviserSchoolFormsToLocalStorage(map);
      onUpdate(map);
    },
    (err) => {
      console.error('Error subscribing to Class Adviser School Forms:', err);
      const cached = getStoredClassAdviserSchoolForms();
      onUpdate(cached);
    }
  );
};

// ==========================================
// 15. LOGIN PAGE AUTO-SWIPING GALLERY PHOTOS
// ==========================================

export const PRELOAD_PHOTO_IDS = new Set([
  'gallery-svnhs-facade',
  'gallery-shs-building',
  'gallery-science-lab',
  'gallery-library-resource',
  'gallery-graduation-moving-up',
]);

export const isPreloadPhoto = (photo: Partial<GalleryPhoto>): boolean => {
  if (!photo) return false;
  if (photo.id && PRELOAD_PHOTO_IDS.has(photo.id)) return true;
  if (photo.url && typeof photo.url === 'string') {
    if (
      photo.url.includes('images.unsplash.com/photo-1541829070764') ||
      photo.url.includes('images.unsplash.com/photo-1562774053') ||
      photo.url.includes('images.unsplash.com/photo-1532094349884') ||
      photo.url.includes('images.unsplash.com/photo-1521587760476') ||
      photo.url.includes('images.unsplash.com/photo-1523240795612')
    ) {
      return true;
    }
  }
  return false;
};

// No preloaded photos: gallery only displays photos uploaded by Master Admin
export const INITIAL_DEFAULT_GALLERY_PHOTOS: GalleryPhoto[] = [];

export const getStoredGalleryPhotos = (): GalleryPhoto[] => {
  return getOfflineDataSync<GalleryPhoto[]>(GALLERY_STORAGE_KEY, []);
};

export const saveGalleryPhotoToLocalStorage = (photo: GalleryPhoto) => {
  try {
    const list = getStoredGalleryPhotos();
    const idx = list.findIndex((p) => p.id === photo.id);
    if (idx >= 0) {
      list[idx] = photo;
    } else {
      list.push(photo);
    }
    saveOfflineData(GALLERY_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving gallery photo to local cache:', err);
  }
};

export const deleteGalleryPhotoFromLocalStorage = (id: string) => {
  try {
    const list = getStoredGalleryPhotos();
    const filtered = list.filter((p) => p.id !== id);
    saveOfflineData(GALLERY_STORAGE_KEY, filtered);
  } catch (err) {
    console.error('Error deleting gallery photo from local cache:', err);
  }
};

export const saveGalleryPhotoToFirestore = async (photo: GalleryPhoto): Promise<void> => {
  const cleanPhoto: GalleryPhoto = {
    id: photo.id || `gallery-${Date.now()}`,
    url: photo.url || '',
    title: photo.title?.trim() || 'SVNHS Campus Gallery',
    caption: photo.caption?.trim() || '',
    uploadedAt: photo.uploadedAt || new Date().toISOString().substring(0, 10),
    uploadedBy: photo.uploadedBy || 'Master Admin',
    order: typeof photo.order === 'number' ? photo.order : 1,
  };

  await setDoc(doc(db, GALLERY_COL, cleanPhoto.id), cleanPhoto, { merge: true });
  saveGalleryPhotoToLocalStorage(cleanPhoto);
};

export const deleteGalleryPhotoFromFirestore = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, GALLERY_COL, id));
  deleteGalleryPhotoFromLocalStorage(id);
};

export const cleanPreloadGalleryPhotosFromFirestore = async (): Promise<void> => {
  try {
    const snap = await getDocs(collection(db, GALLERY_COL));
    if (!snap.empty) {
      for (const d of snap.docs) {
        const photo = d.data() as GalleryPhoto;
        if (isPreloadPhoto(photo) || PRELOAD_PHOTO_IDS.has(d.id)) {
          await deleteDoc(doc(db, GALLERY_COL, d.id));
        }
      }
    }
  } catch (err) {
    console.warn('Note on cleaning preload photos:', err);
  }
};

export const subscribeGalleryPhotos = (onUpdate: (photos: GalleryPhoto[]) => void) => {
  cleanPreloadGalleryPhotosFromFirestore();

  return onSnapshot(
    collection(db, GALLERY_COL),
    (snapshot) => {
      if (snapshot.empty) {
        saveOfflineData(GALLERY_STORAGE_KEY, []);
        onUpdate([]);
        return;
      }

      const list: GalleryPhoto[] = snapshot.docs
        .map((d) => d.data() as GalleryPhoto)
        .filter((photo) => !isPreloadPhoto(photo));

      list.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.uploadedAt || '').localeCompare(a.uploadedAt || '');
      });

      // Synchronize exact Firestore snapshot to IndexedDB and local cache
      saveOfflineData(GALLERY_STORAGE_KEY, list);

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to gallery photos collection:', err);
      const cached = getStoredGalleryPhotos();
      onUpdate(cached);
    }
  );
};

export const seedInitialGalleryPhotosIfEmpty = async () => {
  // Preload pictures are removed; purge any legacy preloads from Firestore
  await cleanPreloadGalleryPhotosFromFirestore();
};

export const reseedDefaultGalleryPhotos = async () => {
  // Preload pictures are permanently disabled
  await cleanPreloadGalleryPhotosFromFirestore();
};

// ==========================================
// MASTER ADMIN EMBEDDED VIDEOS (LOGIN VIEW)
// ==========================================
export const EMBEDDED_VIDEOS_COL = 'embedded_videos';
const VIDEOS_STORAGE_KEY = 'svnhs_embedded_videos_cache';

// Specific IDs and markers for preloaded videos that should never be shown
export const PRELOAD_VIDEO_IDS = new Set([
  'video-svnhs-welcome-intro',
  'video-svnhs-deped-guidelines',
]);

export const isPreloadVideo = (video: EmbeddedVideo | null | undefined): boolean => {
  if (!video) return false;
  if (video.id && PRELOAD_VIDEO_IDS.has(video.id)) return true;
  if (video.id && video.id.startsWith('video-svnhs-')) return true;
  if (
    video.title?.includes('San Vicente National High School - Campus Overview') ||
    video.title?.includes('DepEd Senior High School Academic & TVL Strands')
  ) {
    return true;
  }
  return false;
};

export const cleanPreloadVideosFromFirestore = async (): Promise<void> => {
  try {
    const snap = await getDocs(collection(db, EMBEDDED_VIDEOS_COL));
    for (const d of snap.docs) {
      const vid = d.data() as EmbeddedVideo;
      if (isPreloadVideo(vid) || PRELOAD_VIDEO_IDS.has(d.id) || d.id.startsWith('video-svnhs-')) {
        await deleteDoc(doc(db, EMBEDDED_VIDEOS_COL, d.id));
      }
    }
  } catch (err) {
    console.warn('Note on cleaning preload videos from Firestore:', err);
  }

  // Also clean localStorage cache
  try {
    const raw = localStorage.getItem(VIDEOS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as EmbeddedVideo[];
      const filtered = list.filter((v) => !isPreloadVideo(v));
      localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (_) {}
};

export const getStoredEmbeddedVideos = (): EmbeddedVideo[] => {
  return getOfflineDataSync<EmbeddedVideo[]>(VIDEOS_STORAGE_KEY, []);
};

export const saveEmbeddedVideoToLocalStorage = (video: EmbeddedVideo) => {
  try {
    const list = getStoredEmbeddedVideos();
    const idx = list.findIndex((v) => v.id === video.id);
    if (idx >= 0) {
      list[idx] = video;
    } else {
      list.push(video);
    }
    saveOfflineData(VIDEOS_STORAGE_KEY, list);
  } catch (err) {
    console.error('Error saving embedded video to local cache:', err);
  }
};

export const deleteEmbeddedVideoFromLocalStorage = (id: string) => {
  try {
    const list = getStoredEmbeddedVideos();
    const filtered = list.filter((v) => v.id !== id);
    saveOfflineData(VIDEOS_STORAGE_KEY, filtered);
  } catch (err) {
    console.error('Error deleting embedded video from local cache:', err);
  }
};

export const saveEmbeddedVideoToFirestore = async (video: EmbeddedVideo): Promise<void> => {
  const cleanVideo: EmbeddedVideo = {
    id: video.id || `video-${Date.now()}`,
    title: video.title?.trim() || 'SVNHS Video Presentation',
    embedCode: (video.embedCode || '')
      .trim()
      .replace(/&amp;/g, '&')
      .replace(/https?:\/\/(?:web|m|touch)\.facebook\.com/gi, 'https://www.facebook.com')
      .replace(/href=https%3A%2F%2F(?:web|m|touch)\.facebook\.com/gi, 'href=https%3A%2F%2Fwww.facebook.com'),
    description: video.description?.trim() || '',
    createdAt: video.createdAt || new Date().toISOString().substring(0, 10),
    createdBy: video.createdBy || 'Master Admin',
    order: typeof video.order === 'number' ? video.order : 1,
  };

  await setDoc(doc(db, EMBEDDED_VIDEOS_COL, cleanVideo.id), cleanVideo, { merge: true });
  saveEmbeddedVideoToLocalStorage(cleanVideo);
};

export const deleteEmbeddedVideoFromFirestore = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, EMBEDDED_VIDEOS_COL, id));
  deleteEmbeddedVideoFromLocalStorage(id);
};

export const subscribeEmbeddedVideos = (onUpdate: (videos: EmbeddedVideo[]) => void) => {
  cleanPreloadVideosFromFirestore();

  return onSnapshot(
    collection(db, EMBEDDED_VIDEOS_COL),
    (snapshot) => {
      if (snapshot.empty) {
        saveOfflineData(VIDEOS_STORAGE_KEY, []);
        onUpdate([]);
        return;
      }

      const list: EmbeddedVideo[] = snapshot.docs
        .map((d) => d.data() as EmbeddedVideo)
        .filter((vid) => !isPreloadVideo(vid));

      list.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      // Synchronize exact Firestore snapshot to IndexedDB and local cache
      saveOfflineData(VIDEOS_STORAGE_KEY, list);

      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to embedded videos collection:', err);
      const cached = getStoredEmbeddedVideos();
      onUpdate(cached);
    }
  );
};

export const seedInitialEmbeddedVideosIfEmpty = async (): Promise<void> => {
  // Preload videos are permanently removed; purge any legacy preloads from Firestore & cache
  await cleanPreloadVideosFromFirestore();
};

// ==========================================
// 17. USER PRESENCE & LIVE SESSION TRACKING
// ==========================================
const USER_PRESENCE_COL = 'userPresence';

export interface UserPresence {
  id: string; // docId: emailToDocId(email)
  userId: string;
  name: string;
  email: string;
  role: 'Faculty' | 'Admin';
  department: string;
  designation?: string;
  advisoryRole?: 'Class Adviser' | 'Non-Adviser';
  status: 'online' | 'idle' | 'offline';
  lastSeen: string; // ISO timestamp
  loginTime: string; // ISO timestamp
  currentTab?: string;
  deviceInfo?: string;
}

/**
 * Record or heartbeat a user's live presence in Firestore.
 */
export const updateUserPresence = async (
  user: UserProfile,
  status: 'online' | 'idle' | 'offline' = 'online',
  currentTab?: string
): Promise<void> => {
  if (!user || !user.email) return;
  const cleanEmail = user.email.toLowerCase().trim();
  const docId = emailToDocId(cleanEmail);

  try {
    const presenceDocRef = doc(db, USER_PRESENCE_COL, docId);
    const now = new Date().toISOString();

    const payload: Partial<UserPresence> = {
      id: docId,
      userId: user.id || `usr-${cleanEmail}`,
      name: user.name || 'User',
      email: cleanEmail,
      role: user.role,
      department: user.department || 'Senior High School Department',
      status: status,
      lastSeen: now,
    };

    if (user.designation) payload.designation = user.designation;
    if (user.advisoryRole) payload.advisoryRole = user.advisoryRole;
    if (currentTab) payload.currentTab = currentTab;
    if (typeof navigator !== 'undefined') {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
      payload.deviceInfo = isMobile ? 'Mobile Device' : 'Desktop / Laptop';
    }

    // Preserve original loginTime if document already exists
    const existingSnap = await getDoc(presenceDocRef);
    if (!existingSnap.exists() || !existingSnap.data()?.loginTime) {
      payload.loginTime = now;
    }

    await setDoc(presenceDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Error updating user presence in Firestore:', err);
  }
};

/**
 * Set user offline upon logout or window dismissal.
 */
export const setUserOffline = async (email: string): Promise<void> => {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  const docId = emailToDocId(cleanEmail);

  try {
    const presenceDocRef = doc(db, USER_PRESENCE_COL, docId);
    await updateDoc(presenceDocRef, {
      status: 'offline',
      lastSeen: new Date().toISOString(),
    });
  } catch (_) {
    try {
      const presenceDocRef = doc(db, USER_PRESENCE_COL, docId);
      await setDoc(presenceDocRef, {
        status: 'offline',
        lastSeen: new Date().toISOString(),
      }, { merge: true });
    } catch (_) {}
  }
};

/**
 * Subscribe to all user presence records in real-time.
 */
export const subscribeUserPresence = (onUpdate: (presences: UserPresence[]) => void): (() => void) => {
  return onSnapshot(
    collection(db, USER_PRESENCE_COL),
    (snapshot) => {
      const list: UserPresence[] = snapshot.docs.map((d) => d.data() as UserPresence);
      // Sort by lastSeen descending
      list.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
      onUpdate(list);
    },
    (err) => {
      console.warn('Error subscribing to user presence:', err);
      onUpdate([]);
    }
  );
};

/**
 * Helper to determine if a presence entry is currently active/online.
 * Default threshold: 2 minutes (120,000ms).
 */
export const isPresenceOnline = (p: UserPresence, thresholdMs: number = 120000): boolean => {
  if (!p || p.status === 'offline') return false;
  if (!p.lastSeen) return false;
  const diff = Date.now() - new Date(p.lastSeen).getTime();
  return diff < thresholdMs;
};






