import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  Building2,
  Dumbbell,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  MapPin,
  Clock
} from 'lucide-react';
import Tooltip from './Tooltip';
import GoogleOnboardingModal from './GoogleOnboardingModal';
import { saveVerifiedGoogleAccount } from '../utils/googleAccounts';

import { MEMBERSHIP_PLANS, getPlanDetails } from '../config/membershipRates';
import { BRANCH_DIRECTORY } from '../config/branchData';
import TermsModal from './TermsModal';
import EulaModal from './EulaModal';

const BRANCH_OPTIONS = BRANCH_DIRECTORY.map((b) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  location: b.location,
  operating_hours: b.operating_hours,
  status: b.status,
  is_active: b.is_active,
  label: `${b.name} (${b.location})`
}));

export default function AuthModal({ isOpen, initialTab = 'login', onClose, onLoginSuccess }) {
  const { login, loginWithGoogle, completeGoogleRegistration } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || 'login');

  // -------------------------------------------------------------
  // Login State
  // -------------------------------------------------------------
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Rate Limiting & Account Lockout State (Max 5 attempts, 15-min lockout)
  const [loginRemainingAttempts, setLoginRemainingAttempts] = useState(null);
  const [loginLockoutCountdown, setLoginLockoutCountdown] = useState(0);

  // Google Direct Sign-In & Onboarding State
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState(null);

  // Backend Health & Auto-Reconnect State
  const [backendOffline, setBackendOffline] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [pollCountdown, setPollCountdown] = useState(3);

  // -------------------------------------------------------------
  // Registration State
  // -------------------------------------------------------------
  // Section A: Personal & Residential Address
  const [regFullName, setRegFullName] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Section B: Password & Security
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Section C: Gym Hub & Membership Rates
  const [regBranchId, setRegBranchId] = useState(BRANCH_OPTIONS[0].id);
  const [selectedPlanId, setSelectedPlanId] = useState('12_months');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showEulaModal, setShowEulaModal] = useState(false);

  // Registration Feedback
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccessBanner, setRegSuccessBanner] = useState(null);

  // Step & 6-Digit Email OTP Verification State
  const [regStep, setRegStep] = useState(1);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendNotice, setResendNotice] = useState(null);
  const [regDevOtp, setRegDevOtp] = useState(null);
  const otpInputsRef = useRef([]);

  // -------------------------------------------------------------
  // Password Recovery / Forgot Password State
  // -------------------------------------------------------------
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('request'); // 'request' | 'verify'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtpValues, setRecoveryOtpValues] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [recoveryDevOtp, setRecoveryDevOtp] = useState(null);
  const [recoveryResendCountdown, setRecoveryResendCountdown] = useState(0);
  const [recoveryResendNotice, setRecoveryResendNotice] = useState(null);
  const recoveryOtpInputsRef = useRef([]);

  // Countdown timer effect for registration
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Countdown timer effect for recovery
  useEffect(() => {
    let interval;
    if (recoveryResendCountdown > 0) {
      interval = setInterval(() => {
        setRecoveryResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recoveryResendCountdown]);

  // Login lockout countdown timer effect (15-min lockout)
  useEffect(() => {
    let interval;
    if (loginLockoutCountdown > 0) {
      interval = setInterval(() => {
        setLoginLockoutCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginLockoutCountdown]);

  // -------------------------------------------------------------
  // Backend Health Ping & Auto-Reconnect
  // -------------------------------------------------------------
  const checkBackendHealth = async () => {
    setHealthChecking(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'healthy') {
          setBackendOffline(false);
          setPollCountdown(3);
          setLoginError(null);
          return true;
        }
      }
      setBackendOffline(true);
      return false;
    } catch {
      setBackendOffline(true);
      return false;
    } finally {
      setHealthChecking(false);
    }
  };

  // Automated Health Check on Modal Open
  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
    }
  }, [isOpen]);

  // Auto-polling countdown when backend is offline
  useEffect(() => {
    let interval;
    if (isOpen && backendOffline) {
      interval = setInterval(() => {
        setPollCountdown((prev) => {
          if (prev <= 1) {
            checkBackendHealth();
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, backendOffline]);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
      setActiveTab(initialTab || 'login');
      setLoginError(null);
      setRegError(null);
      setOtpError(null);
      setRegStep(1);
      setOtpValues(['', '', '', '', '', '']);
      setResendNotice(null);
      // Reset recovery state
      setIsRecovering(false);
      setRecoveryStep('request');
      setRecoveryEmail('');
      setRecoveryOtpValues(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setRecoveryError(null);
      setRecoveryResendCountdown(0);
      setRecoveryResendNotice(null);
    }
  }, [isOpen, initialTab]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // -------------------------------------------------------------
  // Dynamic Fee Computations
  // -------------------------------------------------------------
  const selectedPlan = useMemo(() => {
    return getPlanDetails(selectedPlanId);
  }, [selectedPlanId]);

  const feeBreakdown = useMemo(() => {
    return {
      planFee: selectedPlan.planFee,
      accessFee: selectedPlan.accessFee,
      annualFee: selectedPlan.annualFee,
      totalDue: selectedPlan.totalDue,
      isAnnualWaived: selectedPlan.annualFee === 0
    };
  }, [selectedPlan]);

  // -------------------------------------------------------------
  // Client-Side Registration Validations
  // -------------------------------------------------------------
  // 1. Full Name: letters, spaces, periods, commas, apostrophes, hyphens only
  const isNameValid = useMemo(() => {
    return regFullName.trim().length >= 2 && /^[A-Za-z\s.,'-]+$/.test(regFullName.trim());
  }, [regFullName]);

  // 2. Date of Birth: Must be >= 16 years old
  const { age, isAgeValid, ageError } = useMemo(() => {
    if (!regDob) return { age: null, isAgeValid: false, ageError: null };
    const birthDate = new Date(regDob);
    if (isNaN(birthDate.getTime())) {
      return { age: null, isAgeValid: false, ageError: 'Invalid birth date' };
    }
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    if (calculatedAge < 16) {
      return {
        age: calculatedAge,
        isAgeValid: false,
        ageError: `Must be at least 16 years old (current: ${calculatedAge} yrs)`
      };
    }
    return { age: calculatedAge, isAgeValid: true, ageError: null };
  }, [regDob]);

  // 3. Username: Alphanumeric handle 4-20 chars (optional)
  const isUsernameValid = useMemo(() => {
    if (!regUsername) return true;
    return /^[a-zA-Z0-9_]{4,20}$/.test(regUsername.trim());
  }, [regUsername]);

  // 4. Email format
  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
  }, [regEmail]);

  // 5. Philippine Phone format (09XXXXXXXXX or +639XXXXXXXXX)
  const isPhoneValid = useMemo(() => {
    const cleanPhone = regPhone.replace(/[\s-]/g, '');
    return /^(09|\+639)\d{9}$/.test(cleanPhone);
  }, [regPhone]);

  // 6. Address: required non-empty
  const isAddressValid = useMemo(() => {
    return regAddress.trim().length >= 5;
  }, [regAddress]);

  // 7. Password Checklist
  const passwordChecks = useMemo(() => {
    return {
      length: regPassword.length >= 8,
      upper: /[A-Z]/.test(regPassword),
      lower: /[a-z]/.test(regPassword),
      number: /[0-9]/.test(regPassword),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword)
    };
  }, [regPassword]);

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordChecks).every(Boolean);
  }, [passwordChecks]);

  // 8. Confirm Password Match
  const isPasswordMatch = useMemo(() => {
    if (!regConfirmPassword) return false;
    return regPassword === regConfirmPassword;
  }, [regPassword, regConfirmPassword]);

  // 9. Emergency Phone (optional or valid format)
  const isEmergencyValid = useMemo(() => {
    if (!emergencyPhone) return true;
    const clean = emergencyPhone.replace(/[\s-]/g, '');
    return /^(09|\+639)\d{9}$/.test(clean);
  }, [emergencyPhone]);

  // Global Form Validity
  const isRegFormValid = useMemo(() => {
    return (
      isNameValid &&
      isAgeValid &&
      isAddressValid &&
      isEmailValid &&
      isPhoneValid &&
      isPasswordValid &&
      isPasswordMatch &&
      isUsernameValid &&
      isEmergencyValid &&
      waiverAccepted
    );
  }, [
    isNameValid,
    isAgeValid,
    isAddressValid,
    isEmailValid,
    isPhoneValid,
    isPasswordValid,
    isPasswordMatch,
    isUsernameValid,
    isEmergencyValid,
    waiverAccepted
  ]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------

  // Handle Login Submit
  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (loginLockoutCountdown > 0) {
      toast.error(`Account is temporarily locked. Please wait ${Math.ceil(loginLockoutCountdown / 60)} minute(s).`, 'Account Locked');
      return;
    }
    if (backendOffline) {
      checkBackendHealth();
      return;
    }
    setLoginError(null);
    setLoginLoading(true);

    try {
      const user = await login(loginEmail.trim(), loginPassword);
      setLoginRemainingAttempts(null);
      setLoginLockoutCountdown(0);

      // Determine destination route
      let destination = '/dashboard/member';
      if (user.role === 'super_admin') destination = '/dashboard/super-admin';
      else if (user.role === 'branch_admin') destination = '/dashboard/branch-admin';
      else if (user.role === 'employee') destination = '/dashboard/employee';

      if (user?.email) {
        saveVerifiedGoogleAccount({
          email: user.email,
          name: user.name,
          status: 'Signed in'
        });
      }

      toast.success(`Welcome back, ${user.name || 'Member'}!`, 'Authentication Verified');
      onClose();

      if (onLoginSuccess) {
        onLoginSuccess(user, destination);
      } else {
        window.history.pushState(null, '', destination);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.includes('5080') ||
        msg.includes('offline') ||
        msg.includes('BACKEND_OFFLINE') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError')
      ) {
        setBackendOffline(true);
        setPollCountdown(3);
      } else if (err.error === 'ACCOUNT_LOCKED' || err.status === 423 || (err.remaining_seconds && err.remaining_seconds > 0)) {
        const secs = err.remaining_seconds || 900;
        setLoginLockoutCountdown(secs);
        setLoginRemainingAttempts(0);
        setLoginError(msg || 'Account locked: 5 consecutive failed login attempts. Please wait 15 minutes or click Forgot Password to reset.');
        toast.error(msg || 'Account locked for 15 minutes.', 'Security Lockout');
      } else if (typeof err.remaining_attempts === 'number') {
        setLoginRemainingAttempts(err.remaining_attempts);
        setLoginError(msg || `Invalid credentials. ${err.remaining_attempts} attempt(s) remaining.`);
        toast.error(msg || `Invalid credentials. ${err.remaining_attempts} attempt(s) remaining.`, 'Sign In Failed');
      } else {
        setLoginError(msg || 'Authentication failed. Please verify email and password.');
        toast.error(msg || 'Authentication failed. Please verify email and password.', 'Sign In Failed');
      }
    } finally {
      setLoginLoading(false);
    }
  }

  // Direct Google Sign In Trigger (Real OAuth GIS One-Tap / Popup)
  const handleGoogleSignIn = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google?.accounts?.id && googleClientId && googleClientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      try {
        setGoogleLoading(true);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              const res = await loginWithGoogle({ credential: response.credential });
              if (res?.is_new_user) {
                // Automatically switch to Sign Up modal with email and name pre-filled
                setShowOnboardingModal(false);
                setPendingGoogleProfile(null);
                const targetEmail = res.google_profile?.email || '';
                const targetName = res.google_profile?.name || '';
                if (targetEmail) {
                  setRegEmail(targetEmail);
                  setRegUsername(targetEmail.split('@')[0]);
                }
                if (targetName) setRegFullName(targetName);
                setRegStep(1);
                setActiveTab('register');
                toast.info('Account not yet registered. Please complete registration and email OTP verification.', 'Athlete Sign Up');
              } else {
                toast.success(`Welcome back, ${res.name || 'Athlete'}!`, 'Signed In with Google');
                let destination = '/dashboard/member';
                if (res.role === 'super_admin') destination = '/dashboard/super-admin';
                else if (res.role === 'branch_admin' || res.role === 'branch_owner') destination = '/dashboard/branch-admin';
                else if (res.role === 'coach' || res.role === 'trainer') destination = '/dashboard/coach';
                else if (res.role === 'employee' || res.role === 'staff') destination = '/dashboard/employee';
                onClose();
                if (onLoginSuccess) {
                  onLoginSuccess(res, destination);
                } else {
                  window.history.pushState(null, '', destination);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }
            } catch (err) {
              setLoginError(err.message || 'Google sign-in failed.');
              toast.error(err.message || 'Google sign-in failed.', 'Authentication Error');
            } finally {
              setGoogleLoading(false);
            }
          }
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setPendingGoogleProfile(null);
            setShowOnboardingModal(true);
            setGoogleLoading(false);
          }
        });
      } catch (err) {
        setPendingGoogleProfile(null);
        setShowOnboardingModal(true);
        setGoogleLoading(false);
      }
    } else {
      // Direct athlete onboarding modal for real Google email + gym system requirements
      setPendingGoogleProfile(null);
      setShowOnboardingModal(true);
    }
  };

  // Check Google Account: Direct Sign-In if already registered, or open onboarding if new
  const handleCheckGoogleAccount = async (inputEmail, inputName) => {
    setGoogleLoading(true);
    setLoginError(null);
    try {
      const res = await loginWithGoogle({ email: inputEmail, name: inputName });
      if (res?.is_new_user) {
        // Automatically save candidate account in 1-click Google accounts list
        const targetEmail = res.google_profile?.email || inputEmail;
        const targetName = res.google_profile?.name || inputName || '';
        saveVerifiedGoogleAccount({
          email: targetEmail,
          name: targetName,
          status: 'Signed in'
        });

        // Automatically close Google modal and direct to Sign Up modal with pre-filled details
        setShowOnboardingModal(false);
        setPendingGoogleProfile(null);
        if (targetEmail) {
          setRegEmail(targetEmail);
          setRegUsername(targetEmail.split('@')[0]);
        }
        if (targetName) setRegFullName(targetName);
        setRegStep(1);
        setActiveTab('register');
        toast.info('Account not yet registered. Please complete registration and email OTP verification.', 'Athlete Sign Up');
      } else {
        // Already signed up -> DIRECT 1-CLICK SIGN IN!
        saveVerifiedGoogleAccount({
          email: res.email || inputEmail,
          name: res.name || inputName,
          status: 'Signed in'
        });
        setShowOnboardingModal(false);
        setPendingGoogleProfile(null);
        toast.success(`Welcome back, ${res.name || 'Athlete'}!`, 'Signed In with Google');
        let destination = '/dashboard/member';
        if (res.role === 'super_admin') destination = '/dashboard/super-admin';
        else if (res.role === 'branch_admin' || res.role === 'branch_owner') destination = '/dashboard/branch-admin';
        else if (res.role === 'coach' || res.role === 'trainer') destination = '/dashboard/coach';
        else if (res.role === 'employee' || res.role === 'staff') destination = '/dashboard/employee';
        onClose();
        if (onLoginSuccess) {
          onLoginSuccess(res, destination);
        } else {
          window.history.pushState(null, '', destination);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    } catch (err) {
      setLoginError(err.message || 'Google sign-in failed.');
      toast.error(err.message || 'Google sign-in failed.', 'Authentication Error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Complete Google Registration with Gym System Requirements
  const handleCompleteGoogleRegistration = async (formData) => {
    setGoogleLoading(true);
    setLoginError(null);
    try {
      const newUser = await completeGoogleRegistration(formData);
      saveVerifiedGoogleAccount({
        email: newUser.email,
        name: newUser.name,
        status: 'Signed in'
      });
      setShowOnboardingModal(false);
      toast.success(`Welcome to KSYN Fitness, ${newUser.name || 'Athlete'}!`, 'Profile Activated');
      let destination = '/dashboard/member';
      if (newUser.role === 'super_admin') destination = '/dashboard/super-admin';
      else if (newUser.role === 'branch_admin' || newUser.role === 'branch_owner') destination = '/dashboard/branch-admin';
      else if (newUser.role === 'coach' || newUser.role === 'trainer') destination = '/dashboard/coach';
      else if (newUser.role === 'employee' || newUser.role === 'staff') destination = '/dashboard/employee';
      if (newUser?.email) {
        saveVerifiedGoogleAccount({
          email: newUser.email,
          name: newUser.name,
          status: 'Signed in'
        });
      }

      onClose();
      if (onLoginSuccess) {
        onLoginSuccess(newUser, destination);
      } else {
        window.history.pushState(null, '', destination);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      setLoginError(err.message || 'Registration failed.');
      toast.error(err.message || 'Registration failed.', 'Registration Error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Step 1 -> Step 2: Request Registration OTP
  async function handleProceedToOtp(e) {
    e.preventDefault();
    if (!isRegFormValid) {
      setRegError('Please complete all required fields correctly before proceeding.');
      toast.warning('Please complete all required fields correctly.', 'Incomplete Form');
      return;
    }

    setOtpSending(true);
    setRegError(null);
    setOtpError(null);

    try {
      const res = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          username: regUsername.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch verification code.');
      }

      setRegStep(2);
      setResendCountdown(60);
      setOtpValues(['', '', '', '', '', '']);
      sessionStorage.setItem('ksyn_reg_prefill', JSON.stringify({
        email: regEmail.trim().toLowerCase(),
        name: regFullName.trim(),
        phone: regPhone.trim(),
        dob: regDob,
        address: regAddress.trim(),
        branch_id: regBranchId,
        username: regUsername.trim()
      }));
      setOtpValues(['', '', '', '', '', '']);
      setRegDevOtp(null);
      setOtpError(null);
      const msg = `Verification code sent to ${regEmail.trim()}. Please check your email inbox and spam folder.`;
      toast.info(msg, 'Email Dispatched');
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err) {
      setRegError(err.message || 'Failed to send verification code. Please check your email.');
      toast.error(err.message || 'Failed to send verification code.', 'OTP Dispatch Error');
    } finally {
      setOtpSending(false);
    }
  }

  // OTP Input event handlers
  const handleOtpChange = (index, val) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      const updated = [...otpValues];
      updated[index] = '';
      setOtpValues(updated);
      return;
    }
    const updated = [...otpValues];
    updated[index] = digits[digits.length - 1];
    setOtpValues(updated);
    setOtpError(null);

    // Auto-focus next input
    if (index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpValues[index] && index > 0) {
        const updated = [...otpValues];
        updated[index - 1] = '';
        setOtpValues(updated);
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const updated = [...otpValues];
      for (let i = 0; i < 6; i++) {
        updated[i] = pasted[i] || '';
      }
      setOtpValues(updated);
      setOtpError(null);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
    }
  };

  // Resend OTP Code handler
  async function handleResendOtp() {
    if (resendCountdown > 0 || otpSending) return;

    setOtpSending(true);
    setOtpError(null);
    setResendNotice(null);

    try {
      const res = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          username: regUsername.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend verification code.');
      }

      setResendCountdown(60);
      setOtpValues(['', '', '', '', '', '']);
      setRegDevOtp(null);
      const msg = `Fresh verification code sent to ${regEmail.trim()}. Please check your email inbox and spam folder.`;
      setResendNotice(msg);
      toast.info(msg, 'Code Resent');
      setTimeout(() => setResendNotice(null), 5000);
    } catch (err) {
      setOtpError(err.message || 'Failed to resend code.');
      toast.error(err.message || 'Failed to resend code.', 'Resend Error');
    } finally {
      setOtpSending(false);
    }
  }

  // Handle Step 2 Final Submit: Verify & Complete Registration
  async function handleVerifyAndRegister(e) {
    e.preventDefault();
    const otpCode = otpValues.join('');
    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code.');
      toast.warning('Please enter all 6 digits of the verification code.', 'Incomplete Code');
      return;
    }

    setRegSubmitting(true);
    setOtpError(null);

    try {
      const payload = {
        name: regFullName.trim(),
        dob: regDob,
        address: regAddress.trim(),
        username: regUsername.trim() || undefined,
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        password: regPassword,
        branch_id: regBranchId,
        membership_plan: selectedPlanId,
        tier: selectedPlanId === '12_months' ? 'elite' : selectedPlanId === '6_months' ? 'pro' : 'standard',
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        waiver_accepted: waiverAccepted,
        role: 'member',
        otpCode
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration verification failed.');
      }

      // Automatically save verified account for 1-click Google account chooser
      sessionStorage.setItem('ksyn_reg_prefill', JSON.stringify({
        email: regEmail.trim().toLowerCase(),
        name: regFullName.trim(),
        phone: regPhone.trim(),
        dob: regDob,
        address: regAddress.trim(),
        branch_id: regBranchId,
        username: regUsername.trim()
      }));
      saveVerifiedGoogleAccount({
        email: regEmail.trim().toLowerCase(),
        name: regFullName.trim() || regUsername.trim(),
        status: 'Signed out'
      });

      // Success Banner & Switch to Member Login tab with email prefilled
      setRegSuccessBanner('Membership account verified and activated! Please sign in with your password.');
      toast.success('Membership account verified and activated! Please sign in.', 'Registration Complete');
      setLoginEmail(regEmail.trim().toLowerCase());
      setLoginPassword('');
      setRegStep(1);

      setTimeout(() => {
        setActiveTab('login');
        setRegSuccessBanner(null);
      }, 2000);
    } catch (err) {
      setOtpError(err.message || 'Verification failed. Please check the code and try again.');
      toast.error(err.message || 'Verification failed. Please check the code and try again.', 'Registration Error');
    } finally {
      setRegSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // Password Recovery Handlers
  // -------------------------------------------------------------
  const handleOpenRecovery = () => {
    setIsRecovering(true);
    setRecoveryStep('request');
    setRecoveryEmail(loginEmail || '');
    setRecoveryOtpValues(['', '', '', '', '', '']);
    setRecoveryDevOtp(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setRecoveryError(null);
    setRecoveryResendNotice(null);
    setLoginError(null);
  };

  const handleBackToSignIn = () => {
    setIsRecovering(false);
    setRecoveryStep('request');
    setRecoveryDevOtp(null);
    setRecoveryError(null);
    setRecoveryResendNotice(null);
  };

  const handleRequestResetOtp = async (e) => {
    if (e) e.preventDefault();
    if (!recoveryEmail || !recoveryEmail.trim()) {
      setRecoveryError('Please enter the email associated with your account.');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryResendNotice(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim().toLowerCase() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No account found with this email address.');
      }

      setRecoveryStep('verify');
      setRecoveryResendCountdown(60);
      setRecoveryDevOtp(null);
      setRecoveryOtpValues(['', '', '', '', '', '']);
      const msg = `Password reset code sent to ${recoveryEmail.trim()}. Please check your email inbox and spam folder.`;
      setRecoveryResendNotice(msg);
      toast.info(msg, 'Password Reset OTP Sent');
      setTimeout(() => setRecoveryResendNotice(null), 6000);
      setTimeout(() => recoveryOtpInputsRef.current[0]?.focus(), 100);
    } catch (err) {
      setRecoveryError(err.message || 'Failed to send reset code.');
      toast.error(err.message || 'Failed to send reset code.', 'Reset Request Error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (recoveryResendCountdown > 0 || recoveryLoading) return;
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryResendNotice(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim().toLowerCase() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend reset code.');
      }

      setRecoveryResendCountdown(60);
      setRecoveryDevOtp(null);
      setRecoveryOtpValues(['', '', '', '', '', '']);
      const msg = `Fresh password reset code sent to ${recoveryEmail.trim()}. Please check your email inbox and spam folder.`;
      setRecoveryResendNotice(msg);
      toast.info(msg, 'Code Resent');
      setTimeout(() => setRecoveryResendNotice(null), 6000);
    } catch (err) {
      setRecoveryError(err.message || 'Failed to resend reset code.');
      toast.error(err.message || 'Failed to resend reset code.', 'Resend Error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryOtpChange = (index, val) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      const updated = [...recoveryOtpValues];
      updated[index] = '';
      setRecoveryOtpValues(updated);
      return;
    }
    const updated = [...recoveryOtpValues];
    updated[index] = digits[digits.length - 1];
    setRecoveryOtpValues(updated);
    setRecoveryError(null);

    if (index < 5) {
      recoveryOtpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleRecoveryOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!recoveryOtpValues[index] && index > 0) {
        const updated = [...recoveryOtpValues];
        updated[index - 1] = '';
        setRecoveryOtpValues(updated);
        recoveryOtpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      recoveryOtpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      recoveryOtpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleRecoveryOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const updated = [...recoveryOtpValues];
      for (let i = 0; i < 6; i++) {
        updated[i] = pasted[i] || '';
      }
      setRecoveryOtpValues(updated);
      setRecoveryError(null);
      const nextFocus = Math.min(pasted.length, 5);
      recoveryOtpInputsRef.current[nextFocus]?.focus();
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const otpCode = recoveryOtpValues.join('');
    if (otpCode.length !== 6) {
      setRecoveryError('Please enter all 6 digits of the reset code.');
      return;
    }

    if (!newPassword) {
      setRecoveryError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setRecoveryError('Password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
          otpCode,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update password.');
      }

      // Success steps:
      // 1. Show green checkmark toast/banner: "Password successfully updated! You can now sign in."
      setRegSuccessBanner('Password successfully updated! You can now sign in.');
      toast.success('Password successfully updated! You can now sign in.', 'Password Reset Successful');
      setTimeout(() => setRegSuccessBanner(null), 8000);

      // 2. Reset all recovery states and redirect directly back to the Sign In view
      setIsRecovering(false);
      setRecoveryStep('request');
      setRecoveryOtpValues(['', '', '', '', '', '']);
      setRecoveryDevOtp(null);
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryError(null);

      // 3. Prefill the email field with recoveryEmail and leave password blank for immediate entry with the new credentials
      setLoginEmail(recoveryEmail.trim().toLowerCase());
      setLoginPassword('');
      setActiveTab('login');
    } catch (err) {
      setRecoveryError(err.message || 'Failed to reset password.');
      toast.error(err.message || 'Failed to reset password.', 'Reset Error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Window */}
      <div
        className="modal-scrollable bg-[#121212] border border-[#262626] rounded-2xl max-w-xl w-full max-h-[88vh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl text-gray-200"
        style={{
          background: '#121212',
          border: '1px solid #262626',
          borderRadius: '16px',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#e1c256 #1a1e24',
          padding: '28px 24px 32px 24px',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          color: '#e5e7eb'
        }}
      >
        {/* Close Button with Tooltip & 44px Touch Target */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <Tooltip content="Close modal (Esc)" position="left">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Modal"
              style={{
                background: '#1c1c1c',
                border: '1px solid #333333',
                color: '#9ca3af',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#e1c256';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.borderColor = '#333333';
              }}
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Modal Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <img
            src="/ksyn-logo.png"
            alt="KSYN Gym Logo"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '10px',
              objectFit: 'contain',
              marginBottom: '10px',
              filter: 'drop-shadow(0 0 20px rgba(225, 194, 86, 0.4))'
            }}
          />
          <h2 style={{ fontSize: '1.375rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
            KSYN <span style={{ color: '#e1c256' }}>FITCONNECT</span>
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '4px' }}>
            Commercial Franchise & Turnstile Access Network
          </p>
        </div>

        {/* Segmented Header Control (Two Tabs) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#0a0a0a',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #262626',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            id="modal-tab-login-btn"
            onClick={() => {
              setActiveTab('login');
              setIsRecovering(false);
            }}
            className={activeTab === 'login' ? 'bg-[#e1c256] text-black font-bold' : 'text-gray-400'}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'login' ? 800 : 600,
              background: activeTab === 'login' ? '#e1c256' : 'transparent',
              color: activeTab === 'login' ? '#000000' : '#9ca3af',
              transition: 'all 0.15s ease'
            }}
          >
            Member Login
          </button>
          <button
            type="button"
            id="modal-tab-register-btn"
            onClick={() => {
              setActiveTab('register');
              setIsRecovering(false);
            }}
            className={activeTab === 'register' ? 'bg-[#e1c256] text-black font-bold' : 'text-gray-400'}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'register' ? 800 : 600,
              background: activeTab === 'register' ? '#e1c256' : 'transparent',
              color: activeTab === 'register' ? '#000000' : '#9ca3af',
              transition: 'all 0.15s ease'
            }}
          >
            Join / Sign Up
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: MEMBER LOGIN CONTENT & PASSWORD RECOVERY */}
        {/* ===================================================================== */}
        {activeTab === 'login' && (
          <div>
            {!isRecovering ? (
              <div>
                {/* Feedback Banners */}
                {regSuccessBanner && (
                  <div style={{
                    background: 'rgba(101, 130, 86, 0.15)',
                    border: '1px solid #658256',
                    color: '#658256',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>{regSuccessBanner}</span>
                  </div>
                )}

                {backendOffline ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(225, 194, 86, 0.08)',
                    border: '1px solid rgba(225, 194, 86, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    fontSize: '0.8125rem',
                    color: '#e1c256'
                  }}>
                    <span>
                      {healthChecking
                        ? 'Connecting to KSYN Core API (Port 5080)...'
                        : `Backend server is starting up on port 5080. Retrying connection (${pollCountdown}s)...`}
                    </span>
                    <button
                      type="button"
                      onClick={checkBackendHealth}
                      disabled={healthChecking}
                      style={{
                        backgroundColor: '#e1c256',
                        color: '#000000',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: healthChecking ? 'default' : 'pointer'
                      }}
                    >
                      {healthChecking ? 'Checking...' : 'Retry'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Temporary Lockout Warning Card (5 Failed Attempts) */}
                    {loginLockoutCountdown > 0 && (
                      <div role="alert" style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1.5px solid #ef4444',
                        color: '#fca5a5',
                        padding: '16px',
                        borderRadius: '10px',
                        marginBottom: '18px',
                        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <ShieldCheck size={22} color="#ef4444" className="shrink-0" />
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#ef4444' }}>
                              Account Temporarily Locked
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                              Exceeded maximum 5 failed password attempts
                            </span>
                          </div>
                        </div>
                        <p style={{ margin: '8px 0', fontSize: '0.8125rem', lineHeight: '1.4', color: '#fecaca' }}>
                          For security purposes, access to this account is suspended for 15 minutes. Please wait for the cooldown timer or reset your password.
                        </p>
                        <div style={{
                          marginTop: '10px',
                          padding: '8px 12px',
                          background: 'rgba(0, 0, 0, 0.45)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: '#e1c256',
                          fontWeight: 800,
                          border: '1px solid rgba(225, 194, 86, 0.25)'
                        }}>
                          <span>Security Cooldown:</span>
                          <span>
                            {Math.floor(loginLockoutCountdown / 60).toString().padStart(2, '0')}:
                            {(loginLockoutCountdown % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#9ca3af' }}>
                          Need immediate access?{' '}
                          <button
                            type="button"
                            onClick={handleOpenRecovery}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#e1c256',
                              textDecoration: 'underline',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            Reset password via email
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Password Attempts Remaining Warning (Yellow Banner) */}
                    {loginRemainingAttempts !== null && loginRemainingAttempts < 5 && loginLockoutCountdown === 0 && (
                      <div role="alert" style={{
                        background: 'rgba(225, 194, 86, 0.12)',
                        border: '1px solid rgba(225, 194, 86, 0.45)',
                        color: '#fef08a',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        marginBottom: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <AlertTriangle size={18} color="#e1c256" className="shrink-0" />
                        <div>
                          <span style={{ fontWeight: 800, color: '#e1c256' }}>Security Warning: </span>
                          <span>{loginRemainingAttempts} attempt{loginRemainingAttempts === 1 ? '' : 's'} remaining before temporary 15-minute account lockout.</span>
                        </div>
                      </div>
                    )}

                    {/* General Error Banner */}
                    {loginError && loginLockoutCountdown === 0 && loginRemainingAttempts === null && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#ef4444',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        marginBottom: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertTriangle size={18} />
                        <span>{loginError}</span>
                      </div>
                    )}
                  </>
                )}

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Email Field */}
                  <div>
                    <label className="ksyn-label">Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-login-email-input"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        autoComplete="username"
                        placeholder="e.g. athlete@ksyn.com"
                        className="ksyn-input"
                        style={{ paddingLeft: '38px' }}
                      />
                      <Mail size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Password Field with Eye Toggle */}
                  <div>
                    <label className="ksyn-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-login-password-input"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Enter password"
                        className="ksyn-input"
                        style={{ paddingLeft: '38px', paddingRight: '42px' }}
                      />
                      <Lock size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content={showLoginPassword ? 'Hide password' : 'Show password'} position="top">
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: showLoginPassword ? '#e1c256' : '#6b7280',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '44px',
                              height: '44px',
                              padding: 0
                            }}
                          >
                            {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Forgot Password Clickable Link */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="button"
                        id="modal-forgot-password-link"
                        onClick={handleOpenRecovery}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#e1c256',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#e1c256')}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    id="modal-login-submit-btn"
                    disabled={loginLoading || backendOffline || healthChecking || loginLockoutCountdown > 0}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontWeight: 900,
                      fontSize: '0.9375rem',
                      marginTop: '6px',
                      opacity: (backendOffline || healthChecking || loginLockoutCountdown > 0) ? 0.6 : 1,
                      cursor: (backendOffline || healthChecking || loginLockoutCountdown > 0) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loginLockoutCountdown > 0
                      ? `Account Locked (${Math.floor(loginLockoutCountdown / 60)}:${(loginLockoutCountdown % 60).toString().padStart(2, '0')})`
                      : loginLoading
                      ? 'Authenticating...'
                      : backendOffline
                      ? 'Waiting for Connection...'
                      : 'Sign In to Portal'}{' '}
                    <ArrowRight size={16} />
                  </button>
                </form>

                {/* Divider */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '18px 0 14px 0',
                  color: '#6b7280',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#262626' }} />
                  <span style={{ padding: '0 12px' }}>Or continue with</span>
                  <div style={{ flex: 1, height: '1px', background: '#262626' }} />
                </div>

                {/* Direct Google Sign In Button */}
                <Tooltip
                  content="Direct one-click sign in using your Google account"
                  position="top"
                  fullWidth
                  style={{ width: '100%', display: 'block' }}
                >
                  <button
                    id="modal-login-google-btn"
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loginLoading || backendOffline}
                    aria-label="Sign in with Google"
                    className="touch-btn"
                    style={{
                      width: '100%',
                      minHeight: '46px',
                      padding: '12px 16px',
                      background: '#161922',
                      color: '#ffffff',
                      border: '1px solid #2e364a',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      cursor: (googleLoading || loginLoading || backendOffline) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}
                    onMouseEnter={(e) => {
                      if (!googleLoading && !loginLoading && !backendOffline) {
                        e.currentTarget.style.background = '#1e2330';
                        e.currentTarget.style.borderColor = '#4285F4';
                        e.currentTarget.style.boxShadow = '0 0 12px rgba(66, 133, 244, 0.25)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!googleLoading && !loginLoading && !backendOffline) {
                        e.currentTarget.style.background = '#161922';
                        e.currentTarget.style.borderColor = '#2e364a';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                      }
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span>{googleLoading ? 'Signing in with Google...' : 'Sign in with Google'}</span>
                  </button>
                </Tooltip>

                {/* Switcher Link */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '22px',
                  paddingTop: '16px',
                  borderTop: '1px solid #1f1f1f',
                  fontSize: '0.875rem',
                  color: '#9ca3af'
                }}>
                  New athlete?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setIsRecovering(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e1c256',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Create an account / Join as Member &rarr;
                  </button>
                </div>
              </div>
            ) : (
              // ==============================================================
              // PASSWORD RECOVERY VIEW (2-STEP FLOW)
              // ==============================================================
              <div>
                {/* Feedback Banners */}
                {recoveryError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={18} />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {recoveryResendNotice && (
                  <div style={{
                    background: 'rgba(101, 130, 86, 0.15)',
                    border: '1px solid #658256',
                    color: '#658256',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>{recoveryResendNotice}</span>
                  </div>
                )}

                {/* Step 1: Request Reset Code */}
                {recoveryStep === 'request' && (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                        Reset Your Password
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                        Enter the email associated with your KSYN account to receive a reset code.
                      </p>
                    </div>

                    <form onSubmit={handleRequestResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label className="ksyn-label">Account Email Address</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="modal-recovery-email-input"
                            type="email"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            required
                            placeholder="e.g. athlete@ksyn.com"
                            className="ksyn-input"
                            style={{ paddingLeft: '38px' }}
                          />
                          <Mail size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                      </div>

                      <button
                        type="submit"
                        id="modal-recovery-send-btn"
                        disabled={recoveryLoading}
                        className="ksyn-btn ksyn-btn-gold"
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontWeight: 900,
                          fontSize: '0.9375rem',
                          marginTop: '6px'
                        }}
                      >
                        {recoveryLoading ? 'Sending Reset Code...' : 'Send Reset Code →'}
                      </button>

                      <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <button
                          type="button"
                          id="modal-recovery-back-btn"
                          onClick={handleBackToSignIn}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 600,
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e1c256')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          ← Back to Sign In
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Step 2: Enter OTP & Create New Password */}
                {recoveryStep === 'verify' && (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                        Set New Password
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                        Enter the 6-digit code sent to <span className="text-[#e1c256]" style={{ color: '#e1c256', fontWeight: 700 }}>{recoveryEmail}</span>
                      </p>
                    </div>

                    <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {/* Monospace 6-Digit OTP Inputs */}
                      <div>
                        <label className="ksyn-label" style={{ textAlign: 'center', display: 'block', marginBottom: '8px' }}>
                          6-Digit Verification Code
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                          {recoveryOtpValues.map((val, idx) => (
                            <input
                              key={idx}
                              ref={(el) => (recoveryOtpInputsRef.current[idx] = el)}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={1}
                              value={val}
                              onChange={(e) => handleRecoveryOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleRecoveryOtpKeyDown(idx, e)}
                              onPaste={handleRecoveryOtpPaste}
                              className="ksyn-input"
                              style={{
                                width: '44px',
                                height: '50px',
                                textAlign: 'center',
                                fontSize: '1.375rem',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                padding: 0,
                                borderRadius: '8px',
                                borderColor: val ? '#e1c256' : '#262626',
                                color: '#e1c256',
                                background: '#0a0a0a'
                              }}
                            />
                          ))}
                        </div>

                        {/* Cooldown Timer / Resend Code */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                          {recoveryResendCountdown > 0 ? (
                            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                              Resend code in <strong style={{ color: '#e1c256' }}>{recoveryResendCountdown}s</strong>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendResetOtp}
                              disabled={recoveryLoading}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#e1c256',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                                textDecoration: 'underline'
                              }}
                            >
                              Resend Code
                            </button>
                          )}
                        </div>
                      </div>

                      {/* New Password Field with Eye Toggle */}
                      <div>
                        <label className="ksyn-label">New Password</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="modal-recovery-new-password"
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="Min. 8 characters (letters & numbers)"
                            className="ksyn-input"
                            style={{ paddingLeft: '38px', paddingRight: '42px' }}
                          />
                          <Lock size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                          <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                            <Tooltip content={showNewPassword ? 'Hide password' : 'Show password'} position="top">
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: showNewPassword ? '#e1c256' : '#6b7280',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '44px',
                                  height: '44px',
                                  padding: 0
                                }}
                              >
                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>

                      {/* Confirm New Password Field with Eye Toggle */}
                      <div>
                        <label className="ksyn-label">Confirm New Password</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="modal-recovery-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Re-enter new password"
                            className="ksyn-input"
                            style={{ paddingLeft: '38px', paddingRight: '42px' }}
                          />
                          <Lock size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                          <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                            <Tooltip content={showConfirmPassword ? 'Hide password' : 'Show password'} position="top">
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: showConfirmPassword ? '#e1c256' : '#6b7280',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '44px',
                                  height: '44px',
                                  padding: 0
                                }}
                              >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        id="modal-recovery-submit-btn"
                        disabled={recoveryLoading}
                        className="ksyn-btn ksyn-btn-gold"
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontWeight: 900,
                          fontSize: '0.9375rem',
                          marginTop: '6px'
                        }}
                      >
                        {recoveryLoading ? 'Updating Password...' : 'Confirm & Update Password'}
                      </button>

                      <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={handleBackToSignIn}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 600,
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e1c256')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          ← Back to Sign In
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: NEW MEMBER REGISTRATION CONTENT (2-STEP WIZARD) */}
        {/* ===================================================================== */}
        {activeTab === 'register' && (
          <div>
            {regStep === 1 ? (
              <div>
                {regError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={18} />
                    <span>{regError}</span>
                  </div>
                )}

                <form onSubmit={handleProceedToOtp} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* ------------------------------------------------------------- */}
              {/* SECTION A: Personal Information & Residential Address */}
              {/* ------------------------------------------------------------- */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  A. Personal Information & Residential Address
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Full Name */}
                  <div>
                    <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Full Legal Name *</span>
                      {regFullName && (
                        <span style={{ fontSize: '0.6875rem', color: isNameValid ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {isNameValid ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-400" />
                              <span>Valid</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} className="text-red-400" />
                              <span>Letters, spaces, commas only (no numbers)</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-reg-fullname"
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        required
                        placeholder="e.g. Maria Santos"
                        className="ksyn-input"
                        style={{
                          paddingLeft: '38px',
                          borderColor: regFullName ? (isNameValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                      <User size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Date of Birth (Min 16 Years) *</span>
                      {regDob && (
                        <span style={{ fontSize: '0.6875rem', color: isAgeValid ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {isAgeValid ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-400" />
                              <span>Age verified: {age} yrs</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} className="text-red-400" />
                              <span>{ageError}</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    <div>
                      <input
                        id="modal-reg-dob"
                        type="date"
                        value={regDob}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setRegDob(e.target.value)}
                        required
                        className="ksyn-input"
                        style={{
                          colorScheme: 'dark',
                          cursor: 'pointer',
                          borderColor: regDob ? (isAgeValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                    </div>
                  </div>

                  {/* Residential Address */}
                  <div>
                    <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Residential Address (Street / Barangay / City / Postal) *</span>
                      {regAddress && (
                        <span style={{ fontSize: '0.6875rem', color: isAddressValid ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {isAddressValid ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-400" />
                              <span>Valid</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} className="text-red-400" />
                              <span>Please provide complete address</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-reg-address"
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        required
                        placeholder="e.g. Unit 12B, Two Serendra, Bonifacio Global City, Taguig 1634"
                        className="ksyn-input"
                        style={{
                          paddingLeft: '38px',
                          borderColor: regAddress ? (isAddressValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                      <MapPin size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Username & Email row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div>
                      <label className="ksyn-label">Username (Optional)</label>
                      <input
                        id="modal-reg-username"
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="e.g. mariasantos"
                        className="ksyn-input"
                        style={{
                          borderColor: regUsername ? (isUsernameValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                    </div>
                    <div>
                      <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Email Address *</span>
                        {regEmail && (
                          <span style={{ fontSize: '0.6875rem', color: isEmailValid ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {isEmailValid ? (
                              <>
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                <span>Valid</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={11} className="text-red-400" />
                                <span>Invalid format</span>
                              </>
                            )}
                          </span>
                        )}
                      </label>
                      <input
                        id="modal-reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        placeholder="maria@example.com"
                        className="ksyn-input"
                        style={{
                          borderColor: regEmail ? (isEmailValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Philippine Mobile (+63 9XX XXX XXXX or 09XXXXXXXXX) *</span>
                      {regPhone && (
                        <span style={{ fontSize: '0.6875rem', color: isPhoneValid ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {isPhoneValid ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-400" />
                              <span>Valid PH Mobile</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} className="text-red-400" />
                              <span>Invalid format</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-reg-phone"
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        required
                        placeholder="0917 123 4567 or +63 917 123 4567"
                        className="ksyn-input"
                        style={{
                          paddingLeft: '38px',
                          borderColor: regPhone ? (isPhoneValid ? '#658256' : '#ef4444') : '#333'
                        }}
                      />
                      <Phone size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION B: Password & Security Checklist */}
              {/* ------------------------------------------------------------- */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  B. Password & Security Checklist
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  {/* Password */}
                  <div>
                    <label className="ksyn-label">Create Password *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Strong password"
                        className="ksyn-input"
                        style={{ paddingRight: '40px' }}
                      />
                      <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content={showRegPassword ? 'Hide password' : 'Show password'} position="top">
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: showRegPassword ? '#e1c256' : '#6b7280',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '44px',
                              height: '44px',
                              padding: 0
                            }}
                          >
                            {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="ksyn-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Confirm Password *</span>
                      {regConfirmPassword && (
                        <span style={{ fontSize: '0.6875rem', color: isPasswordMatch ? '#658256' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {isPasswordMatch ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-400" />
                              <span>Matched</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} className="text-red-400" />
                              <span>Mismatch</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-reg-confirm-password"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        className="ksyn-input"
                        style={{ paddingRight: '40px' }}
                      />
                      <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content={showRegConfirmPassword ? 'Hide password' : 'Show password'} position="top">
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: showRegConfirmPassword ? '#e1c256' : '#6b7280',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '44px',
                              height: '44px',
                              padding: 0
                            }}
                          >
                            {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist indicators */}
                <div style={{
                  background: '#141414',
                  border: '1px solid #1f1f1f',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '6px',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordChecks.length ? '#658256' : '#6b7280' }}>
                    {passwordChecks.length ? <CheckCircle2 size={13} color="#658256" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />}
                    <span>8+ characters</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordChecks.upper ? '#658256' : '#6b7280' }}>
                    {passwordChecks.upper ? <CheckCircle2 size={13} color="#658256" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />}
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordChecks.lower ? '#658256' : '#6b7280' }}>
                    {passwordChecks.lower ? <CheckCircle2 size={13} color="#658256" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />}
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordChecks.number ? '#658256' : '#6b7280' }}>
                    {passwordChecks.number ? <CheckCircle2 size={13} color="#658256" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />}
                    <span>Number (0-9)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordChecks.special ? '#658256' : '#6b7280' }}>
                    {passwordChecks.special ? <CheckCircle2 size={13} color="#658256" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />}
                    <span>Special (!@#$%)</span>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION C: Gym Hub & Membership Rates with Dynamic Fee Summary */}
              {/* ------------------------------------------------------------- */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  C. Gym Hub & Membership Rates
                </div>

                {/* Home Branch */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="ksyn-label">Home Branch Dropdown *</label>
                  <select
                    id="modal-reg-branch"
                    value={regBranchId}
                    onChange={(e) => setRegBranchId(e.target.value)}
                    className="ksyn-input"
                    style={{ background: '#141414', cursor: 'pointer' }}
                  >
                    {BRANCH_OPTIONS.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>

                  {/* Branch Address & Operating Hours Preview Card */}
                  {(() => {
                    const selectedBranch = BRANCH_DIRECTORY.find((b) => b.id === regBranchId) || BRANCH_DIRECTORY[0];
                    if (!selectedBranch) return null;
                    return (
                      <div className="mt-2.5 p-2.5 rounded border border-[#1f232b] bg-[#101216] text-[12px] flex items-start gap-2.5 text-left">
                        <MapPin size={14} className="text-[#e1c256] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white text-[12px] truncate">{selectedBranch.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e1c256]/10 text-[#e1c256] font-bold border border-[#e1c256]/25">
                              {selectedBranch.code}
                            </span>
                          </div>
                          <p className="text-gray-300 text-[11px] mt-0.5 leading-snug">{selectedBranch.location}</p>
                          <div className="flex items-center gap-2 text-gray-400 text-[11px] mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-gray-200">
                              <Clock size={11} className="text-[#e1c256]" />
                              {selectedBranch.operating_hours}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className={`font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded border ${
                              selectedBranch.is_active
                                ? 'text-[#658256] border-[#658256]/30 bg-[#658256]/10'
                                : 'text-gray-400 border-gray-700 bg-gray-800/40'
                            }`}>
                              {selectedBranch.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Membership Plan Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="ksyn-label">Membership Plan Selector *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {MEMBERSHIP_PLANS.map(plan => {
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          id={`modal-plan-${plan.id}`}
                          onClick={() => setSelectedPlanId(plan.id)}
                          style={{
                            background: isSelected ? 'rgba(225, 194, 86, 0.12)' : '#141414',
                            border: `2px solid ${isSelected ? '#e1c256' : '#262626'}`,
                            borderRadius: '10px',
                            padding: '16px 12px 12px 12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'center',
                            position: 'relative'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: '-9px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: isSelected ? '#e1c256' : '#262626',
                            color: isSelected ? '#000000' : '#e5e7eb',
                            fontSize: '0.59rem',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            whiteSpace: 'nowrap',
                            border: isSelected ? '1px solid #cbaa42' : '1px solid #383838'
                          }}>
                            {plan.tag}
                          </div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: isSelected ? '#e1c256' : '#ffffff', marginTop: '4px' }}>
                            {plan.name}
                          </div>
                          <div style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                            ₱{plan.planFee.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#9ca3af', lineHeight: 1.25 }}>
                            {plan.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Fee Breakdown Card */}
                <div style={{
                  background: 'linear-gradient(145deg, #151515 0%, #0e0e0e 100%)',
                  border: '1px solid rgba(225, 194, 86, 0.3)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e1c256', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>
                    <CreditCard size={15} /> Dynamic Fee Breakdown Summary
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Base Plan ({selectedPlan.name}):</span>
                      <strong style={{ color: '#ffffff' }}>₱{feeBreakdown.planFee.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Access Card Fee:</span>
                      {feeBreakdown.accessFee === 0 ? (
                        <span style={{ color: '#658256', fontWeight: 700 }}>₱0 (Waived)</span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>₱{feeBreakdown.accessFee.toLocaleString()}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Annual Membership Fee:</span>
                      {feeBreakdown.isAnnualWaived ? (
                        <span style={{ color: '#658256', fontWeight: 700 }}>
                          ₱0 <span style={{ fontSize: '0.6875rem', background: 'rgba(101, 130, 86, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>WAIVED</span>
                        </span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>₱{feeBreakdown.annualFee.toLocaleString()}</span>
                      )}
                    </div>

                    <div style={{
                      borderTop: '1px solid #262626',
                      marginTop: '6px',
                      paddingTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline'
                    }}>
                      <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9375rem' }}>Total Due:</span>
                      <span style={{ color: '#e1c256', fontWeight: 900, fontSize: '1.25rem' }}>
                        ₱{feeBreakdown.totalDue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label className="ksyn-label">Emergency Contact Name</label>
                    <input
                      id="modal-reg-emergency-name"
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="e.g. Carlos Santos"
                      className="ksyn-input"
                    />
                  </div>
                  <div>
                    <label className="ksyn-label">Emergency Contact Phone</label>
                    <input
                      id="modal-reg-emergency-phone"
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="0917 111 2222"
                      className="ksyn-input"
                    />
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <label
                  className="flex items-start gap-3 cursor-pointer text-xs text-gray-300"
                  style={{
                    background: '#141414',
                    border: `1px solid ${waiverAccepted ? '#e1c256' : '#262626'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: '#d1d5db',
                    lineHeight: 1.4
                  }}
                >
                  <input
                    id="modal-reg-waiver"
                    type="checkbox"
                    checked={waiverAccepted}
                    onChange={(e) => setWaiverAccepted(e.target.checked)}
                    className="mt-0.5 accent-[#e1c256] rounded cursor-pointer"
                    style={{ width: '16px', height: '16px', accentColor: '#e1c256', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      className="text-[#e1c256] underline hover:text-[#cbaa42] font-semibold transition-colors"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#e1c256',
                        textDecoration: 'underline',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit'
                      }}
                    >
                      KSYN Terms of Service
                    </button>
                    ,{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowEulaModal(true);
                      }}
                      className="text-[#e1c256] underline hover:text-[#cbaa42] font-semibold transition-colors"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#e1c256',
                        textDecoration: 'underline',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit'
                      }}
                    >
                      Software EULA
                    </button>
                    , Gym House Rules, and Physical Liability Waiver.
                  </span>
                </label>
              </div>

              {/* Step 1 Primary CTA Button */}
              <div style={{
                position: 'sticky',
                bottom: '-24px',
                background: 'linear-gradient(to top, #121212 92%, rgba(18, 18, 18, 0.85) 100%)',
                paddingTop: '16px',
                paddingBottom: '8px',
                zIndex: 10,
                marginTop: '12px'
              }}>
                <button
                  type="submit"
                  id="modal-register-continue-btn"
                  disabled={!isRegFormValid || otpSending}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: 900,
                    opacity: isRegFormValid && !otpSending ? 1 : 0.5,
                    cursor: isRegFormValid && !otpSending ? 'pointer' : 'not-allowed',
                    boxShadow: isRegFormValid ? '0 0 25px rgba(225, 194, 86, 0.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {otpSending ? 'Sending Verification Code...' : 'Continue to Verification →'}
                </button>

                {!isRegFormValid && (
                  <p style={{ fontSize: '0.6875rem', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
                    Please fill out all required fields, verify age 16+, satisfy password rules, and accept the waiver.
                  </p>
                )}
              </div>
            </form>
          </div>
        ) : (
          /* STEP 2: OTP VERIFICATION SCREEN */
          <div style={{ padding: '8px 4px 16px 4px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'rgba(225, 194, 86, 0.12)',
                border: '1px solid rgba(225, 194, 86, 0.3)',
                color: '#e1c256',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <Mail size={28} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Verify Your Email
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: '420px', margin: '0 auto' }}>
                We sent a 6-digit verification code to <span style={{ color: '#e1c256', fontWeight: 700 }}>{regEmail}</span>
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '6px' }}>
                This code will expire in 10 minutes.
              </p>
            </div>

            {otpError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={18} />
                <span>{otpError}</span>
              </div>
            )}

            {resendNotice && (
              <div style={{
                background: 'rgba(101, 130, 86, 0.12)',
                border: '1px solid #658256',
                color: '#658256',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                <span>{resendNotice}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAndRegister}>
              {/* 6 Individual Digit Inputs */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '24px 0 28px 0' }}>
                {otpValues.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputsRef.current[index] = el)}
                    id={`modal-otp-input-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className="bg-[#1A1A1A] border border-[#333] text-center text-2xl font-mono text-[#e1c256] focus:border-[#e1c256]"
                    style={{
                      width: '48px',
                      height: '58px',
                      background: '#1A1A1A',
                      border: digit ? '2px solid #e1c256' : '1px solid #333333',
                      borderRadius: '10px',
                      textAlign: 'center',
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: '#e1c256',
                      outline: 'none',
                      boxShadow: digit ? '0 0 12px rgba(225, 194, 86, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>



              {/* Primary Button */}
              <button
                type="submit"
                id="modal-verify-submit-btn"
                disabled={otpValues.join('').length !== 6 || regSubmitting}
                className="bg-[#e1c256] text-black font-bold py-3 rounded-lg w-full"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#e1c256',
                  color: '#000000',
                  fontWeight: 900,
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: otpValues.join('').length === 6 && !regSubmitting ? 'pointer' : 'not-allowed',
                  opacity: otpValues.join('').length === 6 && !regSubmitting ? 1 : 0.5,
                  boxShadow: otpValues.join('').length === 6 ? '0 0 25px rgba(225, 194, 86, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                {regSubmitting ? (
                  'Verifying & Creating Membership...'
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Verify & Complete Registration
                  </>
                )}
              </button>

              {/* Resend Code Link */}
              <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.8125rem', color: '#9ca3af' }}>
                Didn't receive the code?{' '}
                {resendCountdown > 0 ? (
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>
                    Resend code in {resendCountdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpSending}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e1c256',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    {otpSending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>

              {/* Back to Edit Details */}
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegStep(1);
                    setOtpError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                >
                  &larr; Back to Edit Details
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )}
      </div>

      {/* KSYN Terms of Service & Liability Waiver Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setWaiverAccepted(true);
          setShowTermsModal(false);
        }}
      />

      {/* KSYN End User License Agreement (EULA) Modal */}
      <EulaModal
        isOpen={showEulaModal}
        onClose={() => setShowEulaModal(false)}
        onAccept={() => {
          setShowEulaModal(false);
        }}
      />

      {/* Real-World Google Athlete Profile Onboarding Modal */}
      <GoogleOnboardingModal
        isOpen={showOnboardingModal}
        googleProfile={pendingGoogleProfile}
        onClose={() => {
          setShowOnboardingModal(false);
          setPendingGoogleProfile(null);
        }}
        onBackToAccountList={() => setPendingGoogleProfile(null)}
        onNavigateRegister={() => {
          setShowOnboardingModal(false);
          setPendingGoogleProfile(null);
          setActiveTab('register');
        }}
        onCheckGoogleAccount={handleCheckGoogleAccount}
        onSubmit={handleCompleteGoogleRegistration}
        loading={googleLoading}
      />
    </div>
  );
}
