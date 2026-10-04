import React, { useState, useEffect } from 'react';
import { UserProfile, GalleryPhoto } from '../types';
import {
  FacultyDoc,
  AdminDoc,
  RegistrationReqDoc,
  subscribeFaculty,
  subscribeAdmins,
  subscribeFacultyRequests,
  subscribeAdminRequests,
  subscribeUserPasswords,
  subscribeSettings,
  saveFacultyRequestsToFirestore,
  saveAdminRequestsToFirestore,
  seedInitialAdminIfEmpty,
  PasswordResetReqDoc,
  savePasswordResetRequestToFirestore,
  subscribePasswordResetRequests,
  subscribeGalleryPhotos,
  getStoredGalleryPhotos,
  seedInitialGalleryPhotosIfEmpty,
} from '../lib/firebase';
import { AutoSwipingGallery } from './AutoSwipingGallery';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  School,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Key,
  UserPlus,
  BookOpen,
  User,
  Clock,
  Send,
  Bell,
  Quote,
  Info
} from 'lucide-react';
import svnhsLogo from '../assets/images/svnhs_school_logo_1784856263175.jpg';
import principalPortrait from '../assets/images/svnhs_principal_portrait_1785327799633.png';
import buildingBg from '../assets/images/svnhs_shs_building_1785313106378.jpg';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [loginMode, setLoginMode] = useState<'faculty' | 'admin'>('faculty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Live Firestore State
  const [facultyList, setFacultyList] = useState<FacultyDoc[]>([]);
  const [adminList, setAdminList] = useState<AdminDoc[]>([
    {
      id: 'admin-master',
      name: 'John Vic Garnica (Admin)',
      email: 'johnvic.garnica@deped.gov.ph',
      designation: 'Web Developer',
    },
    {
      id: 'admin-norma',
      name: 'Norma Jabagat',
      email: 'norma.jabagat@deped.gov.ph',
      designation: 'Master Teacher',
    },
  ]);
  const [facultyRequests, setFacultyRequests] = useState<RegistrationReqDoc[]>([]);
  const [adminRequests, setAdminRequests] = useState<RegistrationReqDoc[]>([]);
  const [facultyPasswords, setFacultyPasswords] = useState<Record<string, string>>({});
  const [adminPasswords, setAdminPasswords] = useState<Record<string, string>>({});
  const [masterFacultyPassword, setMasterFacultyPassword] = useState<string>('shs304868');
  const [masterAdminPassword, setMasterAdminPassword] = useState<string>('garjohn@1995');
  const [masterAdminEmail, setMasterAdminEmail] = useState<string>('johnvic.garnica@deped.gov.ph');

  // Forgot Password / Temporary Password ("changepass") Dialog State
  const TEMPORARY_PASSWORD = 'changepass';
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [forgotPortalMode, setForgotPortalMode] = useState<'Faculty' | 'Admin'>('Faculty');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotTempPass, setForgotTempPass] = useState('');
  const [showForgotTempPass, setShowForgotTempPass] = useState(false);
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [isTempVerified, setIsTempVerified] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotUserFound, setForgotUserFound] = useState<{
    name: string;
    email: string;
    role: 'Faculty' | 'Admin';
    department?: string;
  } | null>(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetReqDoc[]>([]);

  // Load auto-swiping gallery photos
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>(() => {
    return getStoredGalleryPhotos();
  });

  useEffect(() => {
    // Seed initial admin account and default gallery photos into Firestore if needed
    seedInitialAdminIfEmpty();
    seedInitialGalleryPhotosIfEmpty();

    // 1. Subscribe to Gallery Photos
    const unsubGallery = subscribeGalleryPhotos((photos) => {
      setGalleryPhotos(photos || []);
    });

    // 2. Subscribe to Faculty Directory
    const unsubFaculty = subscribeFaculty((list) => {
      setFacultyList(list || []);
    });

    // 3. Subscribe to Admins Directory
    const unsubAdmins = subscribeAdmins((list) => {
      setAdminList(list || []);
    });

    // 4. Subscribe to Faculty Registration Requests
    const unsubFacultyReq = subscribeFacultyRequests((requests) => {
      setFacultyRequests(requests || []);
    });

    // 5. Subscribe to Admin Registration Requests
    const unsubAdminReq = subscribeAdminRequests((requests) => {
      setAdminRequests(requests || []);
    });

    // 6. Subscribe to User Passwords
    const unsubPasswords = subscribeUserPasswords(({ facultyMap, adminMap }) => {
      setFacultyPasswords(facultyMap || {});
      setAdminPasswords(adminMap || {});
    });

    // 7. Subscribe to Settings
    const unsubSettings = subscribeSettings((settings) => {
      if (settings.svnhs_faculty_password) {
        setMasterFacultyPassword(settings.svnhs_faculty_password);
      }
      if (settings.svnhs_admin_password) {
        setMasterAdminPassword(settings.svnhs_admin_password);
      }
      if (settings.svnhs_admin_email) {
        setMasterAdminEmail(settings.svnhs_admin_email);
      }
    });

    // 8. Subscribe to Password Reset Requests
    const unsubPasswordResets = subscribePasswordResetRequests((reqs) => {
      setPasswordResetRequests(reqs || []);
    });

    return () => {
      unsubGallery();
      unsubFaculty();
      unsubAdmins();
      unsubFacultyReq();
      unsubAdminReq();
      unsubPasswords();
      unsubSettings();
      unsubPasswordResets();
    };
  }, []);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState<'Junior High School Department' | 'Senior High School Department'>('Senior High School Department');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<boolean>(false);

  // Admin Registration Modal State
  const [isAdminRegisterOpen, setIsAdminRegisterOpen] = useState(false);
  const [adminRegName, setAdminRegName] = useState('');
  const [adminRegEmail, setAdminRegEmail] = useState('');
  const [adminRegDesignation, setAdminRegDesignation] = useState<'School Principal' | 'Master Teacher' | 'Coordinator'>('School Principal');
  const [adminRegPassword, setAdminRegPassword] = useState('');
  const [showAdminRegPassword, setShowAdminRegPassword] = useState(false);
  const [adminRegError, setAdminRegError] = useState<string | null>(null);
  const [adminRegSuccess, setAdminRegSuccess] = useState<boolean>(false);

  const switchAdminMode = () => {
    setLoginMode('admin');
    setEmail('');
    setPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const switchFacultyMode = () => {
    setLoginMode('faculty');
    setEmail('');
    setPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Open Forgot Password Dialog
  const handleOpenForgotPassword = (initialEmail?: string) => {
    const targetEmail = (initialEmail || email || '').trim();
    const targetMode = loginMode === 'admin' ? 'Admin' : 'Faculty';
    setForgotPortalMode(targetMode);
    setForgotEmail(targetEmail);
    // User must always enter the key first before changing password
    setForgotTempPass('');
    setIsTempVerified(false);
    setForgotNewPass('');
    setForgotConfirmPass('');
    setForgotError(null);
    setForgotSuccess(false);

    if (targetEmail) {
      const cleanTarget = targetEmail.toLowerCase();
      if (targetMode === 'Admin') {
        const adminMatch = adminList.find((a) => a.email.toLowerCase() === cleanTarget);
        const isMaster = cleanTarget === masterAdminEmail.toLowerCase() || cleanTarget === 'johnvic.garnica@deped.gov.ph';
        if (isMaster || adminMatch) {
          setForgotUserFound({
            name: adminMatch ? adminMatch.name : (isMaster ? 'Master Admin (John Vic Garnica)' : 'Administrator'),
            email: cleanTarget,
            role: 'Admin',
            department: adminMatch?.designation || 'Administration',
          });
        } else {
          setForgotUserFound(null);
        }
      } else {
        const facultyMatch = facultyList.find((f) => f.email.toLowerCase() === cleanTarget);
        if (facultyMatch) {
          setForgotUserFound({
            name: facultyMatch.name,
            email: cleanTarget,
            role: 'Faculty',
            department: facultyMatch.department,
          });
        } else {
          setForgotUserFound(null);
        }
      }
    } else {
      setForgotUserFound(null);
    }

    setIsForgotPassOpen(true);
  };

  // Step 1: Verify the Temporary Key & Account before allowing password change
  const handleVerifyKey = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    let cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setForgotError(`Please enter your official DepEd ${forgotPortalMode} email address.`);
      return;
    }
    if (!cleanEmail.endsWith('@deped.gov.ph')) {
      cleanEmail += '@deped.gov.ph';
    }

    // Role-specific verification: Faculty Portal vs Admin Portal
    if (forgotPortalMode === 'Admin') {
      const adminMatch = adminList.find((a) => a.email.toLowerCase() === cleanEmail);
      const isMaster = cleanEmail === masterAdminEmail.toLowerCase() || cleanEmail === 'johnvic.garnica@deped.gov.ph';

      if (!isMaster && !adminMatch) {
        const isFaculty = facultyList.some((f) => f.email.toLowerCase() === cleanEmail);
        if (isFaculty) {
          setForgotError('Faculty Account Detected: This email is registered as a Faculty member. Please switch to the Faculty Portal (tab above) to request a faculty password change.');
        } else {
          setForgotError('Administrator Account Not Found: This email is not registered in the Admin Directory. Please verify your credentials or submit an admin registration request.');
        }
        return;
      }
      setForgotUserFound({
        name: adminMatch ? adminMatch.name : (isMaster ? 'Master Admin (John Vic Garnica)' : 'Administrator'),
        email: cleanEmail,
        role: 'Admin',
        department: adminMatch?.designation || 'Administration',
      });
    } else {
      // Faculty Portal check
      const facultyMatch = facultyList.find((f) => f.email.toLowerCase() === cleanEmail);

      if (!facultyMatch) {
        const isAdmin = adminList.some((a) => a.email.toLowerCase() === cleanEmail) ||
          cleanEmail === masterAdminEmail.toLowerCase() ||
          cleanEmail === 'johnvic.garnica@deped.gov.ph';

        if (isAdmin) {
          setForgotError('Administrator Account Detected: This email is registered as an Administrator. Please switch to the Admin Portal (tab above) to request an admin password change.');
        } else {
          setForgotError('Faculty Account Not Found: This email is not registered in the Faculty Directory. Please verify your email or click "Create Faculty Account".');
        }
        return;
      }
      setForgotUserFound({
        name: facultyMatch.name,
        email: cleanEmail,
        role: 'Faculty',
        department: facultyMatch.department,
      });
    }

    const cleanTemp = forgotTempPass.trim();
    if (!cleanTemp) {
      setForgotError('Please enter the authorization key to proceed.');
      return;
    }
    if (cleanTemp !== TEMPORARY_PASSWORD) {
      setForgotError('Invalid Authorization Key. Please enter the correct authorization key before changing your password.');
      return;
    }

    // Key is verified! Allow user to proceed to Step 2
    setForgotEmail(cleanEmail);
    setIsTempVerified(true);
    setForgotError(null);
  };

  // Step 2: Submit Password Change Request for Master Admin Approval
  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!isTempVerified) {
      setForgotError('Please enter and verify the authorization key first.');
      return;
    }

    let cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setForgotError(`Please enter your official DepEd ${forgotPortalMode} email address.`);
      return;
    }
    if (!cleanEmail.endsWith('@deped.gov.ph')) {
      cleanEmail += '@deped.gov.ph';
    }

    let resolvedName = cleanEmail.split('@')[0];

    // Role-specific verification: Faculty Portal vs Admin Portal
    if (forgotPortalMode === 'Admin') {
      const adminMatch = adminList.find((a) => a.email.toLowerCase() === cleanEmail);
      const isMaster = cleanEmail === masterAdminEmail.toLowerCase() || cleanEmail === 'johnvic.garnica@deped.gov.ph';

      if (!isMaster && !adminMatch) {
        const isFaculty = facultyList.some((f) => f.email.toLowerCase() === cleanEmail);
        if (isFaculty) {
          setForgotError('Faculty Account Detected: This email is registered as a Faculty member. Please switch to the Faculty Portal (tab above) to request a faculty password change.');
        } else {
          setForgotError('Administrator Account Not Found: This email is not registered in the Admin Directory. Please verify your credentials or submit an admin registration request.');
        }
        return;
      }
      resolvedName = adminMatch ? adminMatch.name : (isMaster ? 'Master Admin (John Vic Garnica)' : 'Administrator');
    } else {
      // Faculty Portal check
      const facultyMatch = facultyList.find((f) => f.email.toLowerCase() === cleanEmail);

      if (!facultyMatch) {
        const isAdmin = adminList.some((a) => a.email.toLowerCase() === cleanEmail) ||
          cleanEmail === masterAdminEmail.toLowerCase() ||
          cleanEmail === 'johnvic.garnica@deped.gov.ph';

        if (isAdmin) {
          setForgotError('Administrator Account Detected: This email is registered as an Administrator. Please switch to the Admin Portal (tab above) to request an admin password change.');
        } else {
          setForgotError('Faculty Account Not Found: This email is not registered in the Faculty Directory. Please verify your email or click "Create Faculty Account".');
        }
        return;
      }
      resolvedName = facultyMatch.name;
    }

    const cleanTemp = forgotTempPass.trim();
    if (cleanTemp !== TEMPORARY_PASSWORD) {
      setForgotError('Invalid Authorization Key. Please verify your key before requesting a password change.');
      setIsTempVerified(false);
      return;
    }

    const cleanNew = forgotNewPass.trim();
    const cleanConfirm = forgotConfirmPass.trim();

    if (!cleanNew) {
      setForgotError('Please enter your new password.');
      return;
    }
    if (cleanNew.length < 4) {
      setForgotError('Password must be at least 4 characters long.');
      return;
    }
    if (cleanNew === TEMPORARY_PASSWORD) {
      setForgotError('New password cannot match the temporary authorization key. Please choose a personalized password.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setForgotError('New password and confirm password do not match.');
      return;
    }

    const reqDoc: PasswordResetReqDoc = {
      id: `reset-${Date.now()}`,
      email: cleanEmail,
      name: resolvedName,
      role: forgotPortalMode,
      requestedNewPassword: cleanNew,
      requestedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'pending',
    };

    try {
      await savePasswordResetRequestToFirestore(reqDoc);
      setForgotEmail(cleanEmail);
      setForgotSuccess(true);
      setSuccessMsg(`✅ Password change request submitted for ${forgotPortalMode} account "${cleanEmail}"! Master Admin (John Vic Garnica) has been notified to accept your new password.`);
    } catch {
      setForgotError('Failed to submit password reset request. Please check network connection.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Please enter both email and password to sign in.');
      return;
    }

    // Email domain validation for DepEd
    if (!cleanEmail.endsWith('@deped.gov.ph')) {
      setErrorMsg('Access Denied: Only official DepEd email addresses (@deped.gov.ph) are authorized.');
      return;
    }

    // INTERCEPTION: If user entered the temporary password "changepass", prompt the role-specific Change Password dialog
    if (cleanPassword === TEMPORARY_PASSWORD) {
      if (loginMode === 'admin') {
        const registeredAdmin = adminList.find((a) => a.email.toLowerCase() === cleanEmail);
        const isMaster = cleanEmail === masterAdminEmail.toLowerCase() || cleanEmail === 'johnvic.garnica@deped.gov.ph';

        if (!isMaster && !registeredAdmin) {
          setErrorMsg('Account Not Registered as Admin: Only registered administrators can request an admin password change from the Admin Portal.');
          return;
        }

        setForgotPortalMode('Admin');
        setForgotEmail(cleanEmail);
        setForgotTempPass(TEMPORARY_PASSWORD);
        setIsTempVerified(true);
        setForgotNewPass('');
        setForgotConfirmPass('');
        setForgotUserFound({
          name: registeredAdmin ? registeredAdmin.name : (isMaster ? 'Master Admin (John Vic Garnica)' : 'Administrator'),
          email: cleanEmail,
          role: 'Admin',
          department: registeredAdmin?.designation || 'Administration',
        });
        setForgotError(null);
        setForgotSuccess(false);
        setIsForgotPassOpen(true);
        return;
      } else {
        const registeredFaculty = facultyList.find((f) => f.email.toLowerCase() === cleanEmail);
        if (!registeredFaculty) {
          setErrorMsg('Account Not Registered as Faculty: Only registered faculty members can request a faculty password change from the Faculty Portal.');
          return;
        }

        setForgotPortalMode('Faculty');
        setForgotEmail(cleanEmail);
        setForgotTempPass(TEMPORARY_PASSWORD);
        setIsTempVerified(true);
        setForgotNewPass('');
        setForgotConfirmPass('');
        setForgotUserFound({
          name: registeredFaculty.name,
          email: cleanEmail,
          role: 'Faculty',
          department: registeredFaculty.department,
        });
        setForgotError(null);
        setForgotSuccess(false);
        setIsForgotPassOpen(true);
        return;
      }
    }

    let role: 'Faculty' | 'Student' | 'Admin' = 'Faculty';
    let name = 'Faculty Member';
    let userDepartment = 'Senior High School Department';
    let userDesignation: string | undefined = undefined;
    let userAdvisoryRole: 'Class Adviser' | 'Non-Adviser' | undefined = undefined;

    if (loginMode === 'admin') {
      const cleanMasterEmail = masterAdminEmail.toLowerCase();
      // Check for Master Admin
      if (cleanEmail === cleanMasterEmail) {
        if (cleanPassword !== masterAdminPassword) {
          setErrorMsg('Invalid Admin Password. Access denied.');
          return;
        }
        role = 'Admin';
        name = 'John Vic Garnica (Admin)';
        userDesignation = 'Web Developer';
      } else {
        // Check registered Admin Directory
        const registeredAdmin = adminList.find(
          (a) => a.email.toLowerCase() === cleanEmail
        );

        if (!registeredAdmin) {
          // Check if pending in admin requests
          const isPending = adminRequests.some((r) => r.email.toLowerCase() === cleanEmail);

          if (isPending) {
            setErrorMsg('Admin Application Pending Approval: Your request is currently pending review by the registered Admin.');
          } else {
            setErrorMsg('Account Not Registered as Admin: You are not a registered administrator. Click "Apply as Admin" below to submit a registration request.');
          }
          return;
        }

        // Validate Password
        const requiredPass = adminPasswords[cleanEmail] || masterAdminPassword;

        if (cleanPassword !== requiredPass) {
          const pendingReset = passwordResetRequests.find(
            (r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending'
          );
          if (pendingReset) {
            setErrorMsg(`Password Change Pending: A password reset request for "${cleanEmail}" is awaiting Master Admin acceptance. Once Master Admin accepts, your new password will be activated.`);
            return;
          }
          setErrorMsg('Invalid Admin Password. Access denied.');
          return;
        }

        role = 'Admin';
        name = registeredAdmin.name;
        if (cleanEmail.includes('norma') || cleanEmail.includes('jabagat')) {
          userDesignation = registeredAdmin.designation || 'Master Teacher';
        } else if (cleanEmail.includes('coordinator') || registeredAdmin.designation === 'Coordinator') {
          userDesignation = 'Coordinator';
        } else {
          userDesignation = registeredAdmin.designation || 'School Administrator';
        }
      }
    } else {
      // 1. STRICT FACULTY CHECK: Read faculty directory from Firebase state
      const registeredFaculty = facultyList.find(
        (f) => f.email.toLowerCase() === cleanEmail
      );

      // Check if account is not registered in the faculty list
      if (!registeredFaculty) {
        // Check if there is a pending registration request
        const isPending = facultyRequests.some((r) => r.email.toLowerCase() === cleanEmail);

        if (isPending) {
          setErrorMsg('Account Pending Admin Approval: Your registration request has been submitted to the Admin. Please wait for approval before logging in.');
        } else {
          setErrorMsg('Account Not Registered: Only registered faculty members can log in. Click "Create Faculty Account" below to submit a registration request.');
        }
        return;
      }

      // 2. Validate Password against Custom Passwords or Master Password
      const requiredPassword = facultyPasswords[cleanEmail] || masterFacultyPassword;

      if (cleanPassword !== requiredPassword) {
        const pendingReset = passwordResetRequests.find(
          (r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending'
        );
        if (pendingReset) {
          setErrorMsg(`Password Change Pending: A password reset request for "${cleanEmail}" is awaiting Master Admin acceptance. Once Master Admin accepts, your new password will be activated.`);
          return;
        }
        setErrorMsg('Invalid Faculty Password. Please re-enter or click "Forgot password?" to reset your password.');
        return;
      }

      name = registeredFaculty.name;
      userDepartment = registeredFaculty.department || 'Senior High School Department';
      userAdvisoryRole = registeredFaculty.advisoryRole || 'Non-Adviser';
    }

    setIsLoading(true);

    setTimeout(() => {
      const user: UserProfile = {
        id: `usr-${Date.now()}`,
        name: name,
        email: cleanEmail,
        role: role,
        department: userDepartment,
        designation: userDesignation,
        advisoryRole: userAdvisoryRole,
      };

      if (rememberMe) {
        localStorage.setItem('svnhs_user_session', JSON.stringify(user));
      }

      setIsLoading(false);
      onLogin(user);
    }, 600);
  };

  // Submit Self Registration Request
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const cleanName = regName.trim();
    let cleanEmail = regEmail.trim().toLowerCase();
    const cleanPass = regPassword.trim();

    if (!cleanName || !cleanEmail || !cleanPass) {
      setRegError('Please complete all required fields.');
      return;
    }

    if (!cleanEmail.endsWith('@deped.gov.ph')) {
      cleanEmail += '@deped.gov.ph';
    }

    if (cleanPass.length < 4) {
      setRegError('Password must be at least 4 characters long.');
      return;
    }

    // Check if already registered in directory
    if (facultyList.some((f) => f.email.toLowerCase() === cleanEmail)) {
      setRegError(`Account "${cleanEmail}" is ALREADY registered. You can log in directly using the Faculty Portal.`);
      return;
    }

    // Check if already pending in requests
    if (facultyRequests.some((r) => r.email.toLowerCase() === cleanEmail)) {
      setRegError(`A registration request for "${cleanEmail}" is ALREADY pending Admin approval.`);
      return;
    }

    const newRequest = {
      id: `req-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      department: regDepartment,
      requestedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'pending',
    };

    const updatedPending = [newRequest, ...facultyRequests];
    saveFacultyRequestsToFirestore(updatedPending);

    setRegSuccess(true);
    setSuccessMsg(`✅ Account request submitted for "${cleanEmail}" (${regDepartment})! It has been notified to the Admin Dashboard for approval.`);

    setTimeout(() => {
      setIsRegisterOpen(false);
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegDepartment('Senior High School Department');
      setRegSuccess(false);
    }, 2500);
  };

  // Submit Admin Registration Request
  const handleAdminRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminRegError(null);

    const cleanName = adminRegName.trim();
    let cleanEmail = adminRegEmail.trim().toLowerCase();
    const cleanPass = adminRegPassword.trim();
    const cleanDesignation = adminRegDesignation.trim() || 'School Administrator';

    if (!cleanName || !cleanEmail || !cleanPass) {
      setAdminRegError('Please complete all required fields.');
      return;
    }

    if (!cleanEmail.endsWith('@deped.gov.ph')) {
      cleanEmail += '@deped.gov.ph';
    }

    if (cleanPass.length < 4) {
      setAdminRegError('Password must be at least 4 characters long.');
      return;
    }

    const cleanMasterEmail = masterAdminEmail.toLowerCase();
    // Check if already registered in admin directory or master admin
    if (cleanEmail === cleanMasterEmail || adminList.some((a) => a.email.toLowerCase() === cleanEmail)) {
      setAdminRegError(`Account "${cleanEmail}" is ALREADY registered as an Admin. You can log in directly using the Admin Portal.`);
      return;
    }

    // Check if already pending in admin requests
    if (adminRequests.some((r) => r.email.toLowerCase() === cleanEmail)) {
      setAdminRegError(`An admin application request for "${cleanEmail}" is ALREADY pending review.`);
      return;
    }

    const newRequest = {
      id: `admin-req-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      designation: cleanDesignation,
      requestedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'pending',
    };

    const updatedPending = [newRequest, ...adminRequests];
    saveAdminRequestsToFirestore(updatedPending);

    setAdminRegSuccess(true);
    setSuccessMsg(`✅ Admin application submitted for "${cleanEmail}"! The registered Admin will review and accept your request.`);

    setTimeout(() => {
      setIsAdminRegisterOpen(false);
      setAdminRegName('');
      setAdminRegEmail('');
      setAdminRegPassword('');
      setAdminRegDesignation('School Principal');
      setAdminRegSuccess(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#0b111e] text-slate-100 flex flex-col justify-center items-center px-2 sm:px-6 py-4 sm:py-6 relative overflow-hidden font-sans">
      {/* Background Image Layer with Controlled Opacity */}
      <div 
        className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat bg-fixed z-0 opacity-15 mix-blend-luminosity"
        style={{ backgroundImage: `url(${buildingBg})` }}
      />
      {/* Moderate Dark Backdrop Tint */}
      <div className="fixed inset-0 pointer-events-none bg-[#0b111e]/90 backdrop-blur-[1px] z-0" />

      {/* Background Decorative Grids & Soft Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* TOP SECTION: Auto-Swiping Gallery of Pictures (Only pictures uploaded by Master Admin) */}
      {galleryPhotos && galleryPhotos.length > 0 && (
        <div className="w-full max-w-6xl relative z-10 mb-6 sm:mb-8 animate-fadeIn">
          <AutoSwipingGallery photos={galleryPhotos} />
        </div>
      )}

      {/* Main Grid Wrapper (Left: Intro + Message, Right: Login Card) */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch relative z-10 my-auto">
        
        {/* LEFT SECTION: SVNHS Introduction & Principal Message & Announcements */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-6 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-sm animate-fadeIn text-slate-800">
          {/* School Header & Badges */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                CARAGA Region • Division of Bislig City
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shadow-2xs">
                DepEd Official School
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <div className="w-12 h-12 rounded-full bg-white p-0.5 border-2 border-emerald-500/60 shadow-md shrink-0">
                <img
                  src={svnhsLogo}
                  alt="San Vicente National High School Seal"
                  className="w-full h-full object-contain rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  San Vicente National High School
                </h1>
                <p className="text-xs text-emerald-700 font-mono font-bold">
                  Repository Portal
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans pt-1">
              Welcome to the official Repository System of San Vicente National High School. Dedicated to empowering DepEd educators and students in Bislig City, Surigao del Sur with secure, centralized access to learning modules, research datasets, and academic records.
            </p>
          </div>

          {/* School Principal's Message Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 relative overflow-hidden flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs font-mono">
                <Quote className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold">School Principal's Message</span>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-emerald-800 px-2.5 py-1 rounded-md border border-emerald-900 shadow-xs tracking-wider uppercase inline-flex items-center">
                OFFICIAL MESSAGE
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pt-1 flex-1">
              {/* Principal Photo */}
              <div className="shrink-0 flex flex-col items-center space-y-1.5">
                <div className="relative group">
                  <img
                    src={principalPortrait}
                    alt="Marivic R. Villaluz, School Principal I"
                    className="w-28 h-36 sm:w-32 sm:h-40 object-cover object-top rounded-xl border-2 border-amber-500/60 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-400/30 pointer-events-none" />
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 flex flex-col justify-between space-y-2.5 text-center sm:text-left h-full">
                <div className="space-y-2 text-xs sm:text-[13px] text-slate-800 leading-relaxed font-sans italic">
                  <p>
                    "It is with immense pride that San Vicente National High School recognizes and showcases the excellence of its highly competent and dedicated teachers in both the Junior High School and Senior High School Departments. Their professionalism, expertise, and steadfast commitment to quality education serve as the foundation of our school’s success. Through their passion for teaching and genuine dedication to learner development, they continue to cultivate an environment where every student is guided to achieve their full potential.
                  </p>
                  <p>
                    Our Senior High School Department further exemplifies our commitment to responsive and relevant education through its Academic and TechPro – Manual Metal Arc Welding (MMAW) offerings. These programs provide learners with diverse opportunities to pursue higher education, gain industry-relevant competencies, and prepare for meaningful careers and productive livelihoods. With our highly qualified teachers and dynamic educational programs, San Vicente National High School remains committed to developing competent, confident, and future-ready learners who will contribute meaningfully to their communities and society."
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex flex-col items-center sm:items-end text-center sm:text-right mt-auto">
                  <p className="text-xs sm:text-sm font-bold font-serif text-slate-900 tracking-wide">
                    Marivic R. Villaluz, School Principal I
                  </p>
                  <p className="text-[11px] font-mono text-emerald-900 font-bold">
                    San Vicente National High School • DepEd CARAGA Region
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* End of Left Section */}
        </div>

        {/* RIGHT SECTION: Main Login Portal Card */}
        <div className="lg:col-span-5 w-full flex flex-col justify-between h-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-md relative z-10 space-y-6 animate-fadeIn text-slate-800">
          
          {/* School Logo & Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 p-1 shadow-md border-2 border-emerald-500/50 flex items-center justify-center transition-transform hover:scale-105">
              <img
                src={svnhsLogo}
                alt="San Vicente National High School Logo"
                className="w-full h-full object-contain rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <div className="flex items-center justify-center space-x-2">
                <School className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-800">
                  CARAGA Region • Division of Bislig City
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                Portal Authentication
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Sign in with official DepEd credentials
              </p>
            </div>
          </div>

        {/* Mode Selector Tab */}
        <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 grid grid-cols-2 gap-1 font-mono text-xs">
          <button
            type="button"
            onClick={switchFacultyMode}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              loginMode === 'faculty'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Faculty Portal</span>
          </button>

          <button
            type="button"
            onClick={switchAdminMode}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              loginMode === 'admin'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </button>
        </div>

        {/* Security Advisory Badge */}
        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-center space-x-2 text-xs font-mono text-emerald-900">
          <Key className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-semibold">
            {loginMode === 'admin' ? 'Administrator Authentication Active' : 'DepEd Official Faculty Access'}
          </span>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs font-mono flex items-start space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-xl text-xs font-mono space-y-2 animate-shake">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="font-bold">{errorMsg}</span>
            </div>
            {errorMsg.includes('Account Not Registered: Only registered faculty') && (
              <div className="pt-1 border-t border-rose-200">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setIsRegisterOpen(true);
                  }}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 text-white" />
                  <span>Click Here to Create Faculty Account</span>
                </button>
              </div>
            )}
            {errorMsg.includes('Account Not Registered as Admin') && (
              <div className="pt-1 border-t border-rose-200">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setIsAdminRegisterOpen(true);
                  }}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>Click Here to Apply as Admin</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email / Username Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-700 font-bold flex items-center justify-between">
              <span>{loginMode === 'admin' ? 'Admin Email' : 'Faculty DepEd Email'}</span>
              <span className="text-[10px] text-emerald-700 font-mono font-bold">@deped.gov.ph</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@deped.gov.ph"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono transition-all font-medium"
              />
              {email && (
                <button
                  type="button"
                  onClick={() => setEmail('')}
                  title="Clear email"
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-all p-0.5 rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-700 font-bold">
                Password
              </label>
              <button
                type="button"
                className="text-[11px] font-mono text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer font-bold flex items-center space-x-1"
                onClick={() => handleOpenForgotPassword(email)}
              >
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>Forgot password?</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-16 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono transition-all font-medium"
              />
              <div className="absolute right-3 top-2.5 flex items-center space-x-1">
                {password && (
                  <button
                    type="button"
                    onClick={() => setPassword('')}
                    title="Clear password"
                    className="text-slate-400 hover:text-slate-700 transition-all p-0.5 rounded-md hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
              <span>Official DepEd Portal</span>
              <button
                type="button"
                onClick={() => handleOpenForgotPassword(email)}
                className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
              >
                Reset Password
              </button>
            </div>
          </div>

          {/* Remember Me & Terms */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Remember session</span>
            </label>
            <span className="text-emerald-700 flex items-center space-x-1 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>DepEd Verified</span>
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 font-mono font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer border ${
              loginMode === 'admin'
                ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-amber-900/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-900/40'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating DepEd Portal...</span>
              </div>
            ) : (
              <>
                {loginMode === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                <span>{loginMode === 'admin' ? 'Sign In as Administrator' : 'Sign In as Faculty'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Option to Create Faculty Account or Apply as Admin */}
        {loginMode === 'faculty' && (
          <div className="pt-2 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsRegisterOpen(true);
              }}
              className="w-full py-2.5 bg-amber-50 hover:bg-amber-100/80 text-amber-900 font-mono text-xs font-bold rounded-xl border border-amber-300 transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
            >
              <UserPlus className="w-4 h-4 text-amber-700" />
              <span>Create / Request Faculty Account</span>
            </button>
            <p className="text-[10px] font-mono text-slate-500 mt-1.5">
              New to SVNHS? Register your DepEd account to request Admin approval.
            </p>
          </div>
        )}

        {loginMode === 'admin' && (
          <div className="pt-2 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsAdminRegisterOpen(true);
              }}
              className="w-full py-2.5 bg-amber-50 hover:bg-amber-100/80 text-amber-900 font-mono text-xs font-bold rounded-xl border border-amber-300 transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Apply as Admin / Request Administrator Access</span>
            </button>
            <p className="text-[10px] font-mono text-slate-500 mt-1.5">
              Request administrative privileges for your official DepEd account. Registered Master Admin will review & accept.
            </p>
          </div>
        )}

        {/* INSTITUTIONAL SECURITY & VERIFICATION NOTICE */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 text-left space-y-1.5 shadow-2xs">
            <div className="flex items-center space-x-1.5 text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-mono font-bold text-slate-900">
                Official Academic Internal Platform
              </span>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-relaxed font-sans">
              This system is an authorized internal curriculum and file repository for <strong>San Vicente National High School</strong> (School ID: <strong>304868</strong>, Division of Bislig City, CARAGA Region). It is operated strictly for teacher Daily Lesson Logs (DLL), Table of Specifications (TOS), and classroom instructional materials.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-slate-200/70 text-[9.5px] font-mono text-slate-500">
              <span className="flex items-center space-x-1 text-emerald-800 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>RA 10173 (Data Privacy Act) Compliant</span>
              </span>
              <span className="text-slate-500 font-bold">School ID: 304868</span>
            </div>
          </div>
        </div>

      </div>
    </div>

      {/* INSTITUTIONAL & SECURITY FOOTER */}
      <footer className="w-full max-w-6xl mt-6 pt-4 pb-2 border-t border-[#24334b] text-center relative z-10 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono font-semibold text-slate-300">
          <span>Republic of the Philippines</span>
          <span className="text-slate-500">•</span>
          <span>Department of Education</span>
          <span className="text-slate-500">•</span>
          <span>Region XIII (CARAGA)</span>
          <span className="text-slate-500">•</span>
          <span>Division of Bislig City</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400 font-bold">San Vicente NHS (School ID: 304868)</span>
        </div>
        <p className="text-[10px] text-slate-400 max-w-3xl mx-auto leading-relaxed font-sans">
          <strong className="text-slate-300">Institutional Privacy & Security Notice:</strong> This web portal is an internal academic repository engineered exclusively for authorized faculty and administrative staff of San Vicente National High School. All submitted records, Daily Lesson Logs, and user credentials are encrypted and protected under Republic Act No. 10173 (Data Privacy Act of 2012). This application does not collect financial details or commercial consumer information.
        </p>
      </footer>

      {/* MODAL: FACULTY ACCOUNT SELF-REGISTRATION REQUEST */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center min-h-screen animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto my-auto p-6 shadow-2xl space-y-5 font-mono relative text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5 text-amber-800">
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                  <UserPlus className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Faculty Account</h3>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Submit registration to Admin Dashboard for approval
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess ? (
              <div className="p-6 bg-emerald-50 border border-emerald-300 text-emerald-900 text-center rounded-2xl space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-bold text-sm text-slate-900">Registration Submitted!</h4>
                <p className="text-xs text-emerald-800">
                  Your registration request for <span className="font-bold text-amber-800">{regEmail}</span> has been sent to the Admin Dashboard.
                </p>
                <div className="text-[11px] text-emerald-700 pt-2 border-t border-emerald-200 font-medium">
                  Once accepted by the Admin, you will be able to log in using your created password immediately.
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Maria Clara Santos"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    <span>Official DepEd Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. santos.mariaclara@deped.gov.ph"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <School className="w-3.5 h-3.5 text-amber-600" />
                      <span>Select School Department</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Choose Level</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegDepartment('Junior High School Department')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        regDepartment === 'Junior High School Department'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30 text-blue-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          regDepartment === 'Junior High School Department'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          JHS Dept.
                        </span>
                        {regDepartment === 'Junior High School Department' && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs leading-tight">Junior High School</div>
                        <div className="text-[10px] opacity-75 leading-tight font-sans">Grades 7 to 10 Faculty</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegDepartment('Senior High School Department')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        regDepartment === 'Senior High School Department'
                          ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/30 text-amber-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          regDepartment === 'Senior High School Department'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          SHS Dept.
                        </span>
                        {regDepartment === 'Senior High School Department' && (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs leading-tight">Senior High School</div>
                        <div className="text-[10px] opacity-75 leading-tight font-sans">Grades 11 & 12 Faculty</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>User-Created Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create your password..."
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1">
                  <div className="flex items-center space-x-1 font-bold text-amber-800">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Approval Process:</span>
                  </div>
                  <p>
                    Your request will be placed in the Admin Dashboard pending review. Once the Admin accepts your request, you can log in immediately with your password.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>Submit Account Request</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADMIN APPLICATION REGISTRATION REQUEST */}
      {isAdminRegisterOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center min-h-screen animate-fadeIn">
          <div className="bg-white border-2 border-amber-400 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto my-auto p-6 shadow-2xl space-y-5 font-mono relative text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5 text-amber-800">
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Apply as Administrator</h3>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Request Admin Account & Credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminRegisterOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminRegError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{adminRegError}</span>
              </div>
            )}

            {adminRegSuccess ? (
              <div className="p-6 bg-emerald-50 border border-emerald-300 text-emerald-900 text-center rounded-2xl space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-bold text-sm text-slate-900">Admin Application Submitted!</h4>
                <p className="text-xs text-emerald-800">
                  Your administrator application request for <span className="font-bold text-amber-800">{adminRegEmail}</span> has been sent to the Admin Portal.
                </p>
                <div className="text-[11px] text-emerald-700 pt-2 border-t border-emerald-200 font-medium">
                  The registered Master Admin will review and accept your application. Once accepted, you can log in directly using your created password.
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminRegisterSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    value={adminRegName}
                    onChange={(e) => setAdminRegName(e.target.value)}
                    placeholder="e.g. Dr. Juan dela Cruz"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    <span>Official DepEd Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={adminRegEmail}
                    onChange={(e) => setAdminRegEmail(e.target.value)}
                    placeholder="e.g. juan.delacruz@deped.gov.ph"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Admin Title / Designation</span>
                  </label>
                  <select
                    value={adminRegDesignation}
                    onChange={(e) => setAdminRegDesignation(e.target.value as 'School Principal' | 'Master Teacher' | 'Coordinator')}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium cursor-pointer"
                  >
                    <option value="School Principal">School Principal</option>
                    <option value="Master Teacher">Master Teacher</option>
                    <option value="Coordinator">Coordinator</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>User-Created Admin Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminRegPassword ? 'text' : 'password'}
                      value={adminRegPassword}
                      onChange={(e) => setAdminRegPassword(e.target.value)}
                      placeholder="Create your admin password..."
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-mono font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminRegPassword(!showAdminRegPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                    >
                      {showAdminRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1">
                  <div className="flex items-center space-x-1 font-bold text-amber-800">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Admin Review Protocol:</span>
                  </div>
                  <p>
                    Your request will be submitted to the Admin Control Panel for approval. The registered Master Admin will review and accept or deny your application.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAdminRegisterOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>Submit Admin Application</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: FORGOT PASSWORD & CHANGE REQUEST DIALOG */}
      {isForgotPassOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center min-h-screen animate-fadeIn">
          <div className={`bg-white border-2 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl font-mono relative text-slate-800 my-auto ${
            forgotPortalMode === 'Admin' ? 'border-amber-400' : 'border-emerald-500'
          }`}>
            {/* Header - Fixed & Pinned */}
            <div className="flex items-center justify-between border-b border-slate-200 p-5 sm:p-6 pb-4 shrink-0 bg-white">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl border ${
                  forgotPortalMode === 'Admin'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  {forgotPortalMode === 'Admin' ? (
                    <ShieldCheck className="w-5 h-5 text-amber-700" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {forgotPortalMode === 'Admin' ? 'Admin Password Reset' : 'Faculty Password Reset'}
                    </h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                      forgotPortalMode === 'Admin'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {forgotPortalMode} Portal
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                    {forgotSuccess 
                      ? 'Request submitted successfully' 
                      : isTempVerified 
                        ? 'Step 2: Enter new password for Master Admin approval' 
                        : 'Step 1: Enter temporary authorization key first'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPassOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 min-h-0 overscroll-contain max-h-[calc(92vh-110px)]">
              {/* Portal Switcher Tab */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl font-mono text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPortalMode('Faculty');
                    setForgotError(null);
                    setIsTempVerified(false);
                  }}
                  className={`py-1.5 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    forgotPortalMode === 'Faculty'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Faculty Portal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPortalMode('Admin');
                    setForgotError(null);
                    setIsTempVerified(false);
                  }}
                  className={`py-1.5 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    forgotPortalMode === 'Admin'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Portal</span>
                </button>
              </div>

              {/* Step Progression Indicator */}
              {!forgotSuccess && (
                <div className="flex items-center justify-between px-1 py-1 text-xs">
                  <div className={`flex items-center space-x-1.5 font-bold ${
                    !isTempVerified 
                      ? (forgotPortalMode === 'Admin' ? 'text-amber-800' : 'text-emerald-800')
                      : 'text-slate-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      !isTempVerified 
                        ? (forgotPortalMode === 'Admin' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white')
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {isTempVerified ? '✓' : '1'}
                    </span>
                    <span className="text-[11px]">1. Enter Key</span>
                  </div>
                  <div className="flex-1 mx-3 h-0.5 bg-slate-200" />
                  <div className={`flex items-center space-x-1.5 font-bold ${
                    isTempVerified 
                      ? (forgotPortalMode === 'Admin' ? 'text-amber-800' : 'text-emerald-800')
                      : 'text-slate-400'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isTempVerified 
                        ? (forgotPortalMode === 'Admin' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white')
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      2
                    </span>
                    <span className="text-[11px]">2. Change Password</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {forgotError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded-xl flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Success View */}
              {forgotSuccess ? (
                <div className={`p-6 border rounded-2xl text-center space-y-3 ${
                  forgotPortalMode === 'Admin'
                    ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}>
                  <CheckCircle2 className={`w-10 h-10 mx-auto animate-bounce ${
                    forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                  <h4 className="font-bold text-sm text-slate-900">
                    {forgotPortalMode} Password Change Request Submitted!
                  </h4>
                  <p className="text-xs leading-relaxed font-sans text-slate-700">
                    Your request to update the password for {forgotPortalMode} account <span className="font-bold text-slate-900 font-mono">{forgotEmail}</span> has been forwarded to Master Admin (<strong>John Vic Garnica</strong>).
                  </p>
                  <div className={`text-[11px] pt-2 border-t font-medium font-sans ${
                    forgotPortalMode === 'Admin' ? 'border-amber-200 text-amber-800' : 'border-emerald-200 text-emerald-700'
                  }`}>
                    The Master Admin will verify and accept your request in the Admin Dashboard. Once accepted, you can log in immediately to the {forgotPortalMode} Portal!
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassOpen(false);
                      setPassword('');
                    }}
                    className={`w-full mt-3 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer ${
                      forgotPortalMode === 'Admin'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    Return to {forgotPortalMode} Login
                  </button>
                </div>
              ) : !isTempVerified ? (
                /* STEP 1: MUST ENTER KEY FIRST */
                <form onSubmit={handleVerifyKey} className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-sans text-slate-600 space-y-1">
                    <div className="flex items-center space-x-1 font-bold text-slate-800 font-mono text-[11px]">
                      <Key className={`w-3.5 h-3.5 ${forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'}`} />
                      <span>Authorization Key Required:</span>
                    </div>
                    <p>
                      You must enter your registered <strong>{forgotPortalMode}</strong> DepEd email and the authorized security key first before changing your password.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Mail className={`w-3.5 h-3.5 ${
                        forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                      <span>{forgotPortalMode} Official DepEd Email</span>
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@deped.gov.ph"
                      required
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white font-mono font-medium ${
                        forgotPortalMode === 'Admin' ? 'focus:border-amber-500' : 'focus:border-emerald-600'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <Key className={`w-3.5 h-3.5 ${
                          forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'
                        }`} />
                        <span>Authorization Key</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotTempPass ? 'text' : 'password'}
                        value={forgotTempPass}
                        onChange={(e) => setForgotTempPass(e.target.value)}
                        placeholder="Enter authorization key..."
                        required
                        autoFocus
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white font-mono font-medium ${
                          forgotPortalMode === 'Admin' ? 'focus:border-amber-500' : 'focus:border-emerald-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotTempPass(!showForgotTempPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showForgotTempPass ? 'Hide key' : 'Show key'}
                      >
                        {showForgotTempPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans">
                      Enter the security authorization key provided by school administration to unlock the password change form.
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-5 py-2 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center space-x-1.5 ${
                        forgotPortalMode === 'Admin'
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5 text-white" />
                      <span>Verify Key & Proceed</span>
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: KEY VERIFIED - USER CAN NOW CHANGE PASSWORD */
                <form onSubmit={handleSubmitNewPassword} className="space-y-4">
                  {/* Verified Key Banner */}
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-900">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Authorization Key Verified</span>
                        <p className="text-[10px] text-emerald-700 font-sans">
                          {forgotUserFound?.name || forgotEmail} ({forgotPortalMode})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTempVerified(false);
                        setForgotError(null);
                      }}
                      className="text-[10px] underline text-emerald-800 hover:text-emerald-950 cursor-pointer font-bold"
                    >
                      Re-enter Key
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Lock className={`w-3.5 h-3.5 ${
                        forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                      <span>New {forgotPortalMode} Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotNewPass ? 'text' : 'password'}
                        value={forgotNewPass}
                        onChange={(e) => setForgotNewPass(e.target.value)}
                        placeholder="Enter new password (min. 4 characters)..."
                        required
                        autoFocus
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white font-mono font-medium ${
                          forgotPortalMode === 'Admin' ? 'focus:border-amber-500' : 'focus:border-emerald-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showForgotNewPass ? 'Hide password' : 'Show password'}
                      >
                        {showForgotNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Lock className={`w-3.5 h-3.5 ${
                        forgotPortalMode === 'Admin' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                      <span>Confirm New Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotConfirmPass ? 'text' : 'password'}
                        value={forgotConfirmPass}
                        onChange={(e) => setForgotConfirmPass(e.target.value)}
                        placeholder="Confirm new password..."
                        required
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white font-mono font-medium ${
                          forgotPortalMode === 'Admin' ? 'focus:border-amber-500' : 'focus:border-emerald-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showForgotConfirmPass ? 'Hide password' : 'Show password'}
                      >
                        {showForgotConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Master Admin Approval Notice */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10.5px] text-slate-600 space-y-1 font-sans">
                    <div className="flex items-center space-x-1 font-bold text-amber-800 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Master Admin Approval Required:</span>
                    </div>
                    <p>
                      When you submit this request, it will be placed in the Master Admin Control Panel as a <strong>{forgotPortalMode} Account Password Request</strong>. <strong>Master Admin (John Vic Garnica)</strong> will review and accept your password change. Once accepted, your new password is immediately active.
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTempVerified(false);
                        setForgotError(null);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className={`px-5 py-2 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center space-x-1.5 ${
                        forgotPortalMode === 'Admin'
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>Submit {forgotPortalMode} Request</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <div className="mt-8 px-6 py-3.5 bg-[#141c2c]/90 backdrop-blur-md border border-[#24334b] rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-1 z-10 relative">
        <div className="font-mono text-[11px] text-slate-300 font-medium space-y-0.5">
          <p>Department of Education • CARAGA Region • Division of Bislig City</p>
          <p className="text-slate-100 font-bold">San Vicente National High School</p>
        </div>
        <div className="font-mono text-[11px] text-emerald-400 font-bold pt-1 border-t border-[#24334b]">
          <p>Powered by: GARJOHN</p>
        </div>
      </div>
    </div>
  );
};


