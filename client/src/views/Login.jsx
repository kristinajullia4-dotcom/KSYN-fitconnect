import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  Shield,
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import GoogleOnboardingModal from '../components/GoogleOnboardingModal';
import { saveVerifiedGoogleAccount } from '../utils/googleAccounts';

export default function Login({ onLoginSuccess, onNavigateHome, onNavigateRegister }) {
  const { login, loginWithGoogle, completeGoogleRegistration, verifyMfa, error: authError } = useAuth();
  const { toast } = useToast();
  // Strictly unpopulated input fields: NO auto-fill on mount or click
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Rate Limiting & Account Lockout State (Max 5 attempts, 15-min lockout)
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Google Direct Sign-In & Onboarding State
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState(null);

  // Form Validation State
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});

  // 2FA TOTP State
  const [mfaData, setMfaData] = useState(null);
  const [totpValues, setTotpValues] = useState(['', '', '', '', '', '']);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState(null);
  const totpInputsRef = useRef([]);

  // Recovery State
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('request'); // 'request' | 'verify'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtpValues, setRecoveryOtpValues] = useState(['', '', '', '', '', '']);
  const [recoveryDevOtp, setRecoveryDevOtp] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [recoverySuccessBanner, setRecoverySuccessBanner] = useState(null);
  const [recoveryResendCountdown, setRecoveryResendCountdown] = useState(0);
  const [recoveryResendNotice, setRecoveryResendNotice] = useState(null);
  const [recoveryFormErrors, setRecoveryFormErrors] = useState({});
  const [recoveryTouched, setRecoveryTouched] = useState({});
  const recoveryOtpInputsRef = useRef([]);

  useEffect(() => {
    let interval;
    if (recoveryResendCountdown > 0) {
      interval = setInterval(() => {
        setRecoveryResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recoveryResendCountdown]);

  // Account lockout countdown timer
  useEffect(() => {
    let interval;
    if (lockoutCountdown > 0) {
      interval = setInterval(() => {
        setLockoutCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutCountdown]);

  // Validation functions
  const validateField = (name, value) => {
    switch (name) {
      case 'email': {
        const val = String(value || '').trim();
        if (!val) return 'Email address or username is required.';
        if (val.includes('@')) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) return 'Please enter a valid email address (e.g. user@ksyn.com).';
        } else if (val.length < 3) {
          return 'Username must be at least 3 characters long.';
        }
        return null;
      }
      case 'password': {
        const val = String(value || '');
        if (!val) return 'Password is required.';
        if (val.length < 6) return 'Password must be at least 6 characters.';
        return null;
      }
      case 'recoveryEmail': {
        const val = String(value || '').trim();
        if (!val) return 'Account email address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) return 'Please enter a valid email address.';
        return null;
      }
      case 'newPassword': {
        const val = String(value || '');
        if (!val) return 'New password is required.';
        if (val.length < 8 || !/[A-Za-z]/.test(val) || !/\d/.test(val)) {
          return 'Password must be at least 8 characters with letters & numbers.';
        }
        return null;
      }
      case 'confirmPassword': {
        const val = String(value || '');
        if (!val) return 'Please re-enter your new password.';
        if (val !== newPassword) return 'Passwords do not match.';
        return null;
      }
      default:
        return null;
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, field === 'email' ? email : password);
    setFormErrors(prev => {
      const updated = { ...prev };
      if (err) updated[field] = err;
      else delete updated[field];
      return updated;
    });
  };

  const handleRecoveryBlur = (field) => {
    setRecoveryTouched(prev => ({ ...prev, [field]: true }));
    let val = '';
    if (field === 'recoveryEmail') val = recoveryEmail;
    else if (field === 'newPassword') val = newPassword;
    else if (field === 'confirmPassword') val = confirmPassword;

    const err = validateField(field, val);
    setRecoveryFormErrors(prev => {
      const updated = { ...prev };
      if (err) updated[field] = err;
      else delete updated[field];
      return updated;
    });
  };

  const handleOpenRecovery = () => {
    setIsRecovering(true);
    setRecoveryStep('request');
    setRecoveryEmail(email || '');
    setRecoveryOtpValues(['', '', '', '', '', '']);
    setRecoveryDevOtp(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setRecoveryError(null);
    setRecoveryResendNotice(null);
    setLocalError(null);
    setRecoveryFormErrors({});
    setRecoveryTouched({});
  };

  const handleBackToSignIn = () => {
    setIsRecovering(false);
    setRecoveryStep('request');
    setRecoveryDevOtp(null);
    setRecoveryError(null);
    setRecoveryResendNotice(null);
    setRecoveryFormErrors({});
    setRecoveryTouched({});
  };

  const handleRequestResetOtp = async (e) => {
    if (e) e.preventDefault();
    const emailErr = validateField('recoveryEmail', recoveryEmail);
    if (emailErr) {
      setRecoveryTouched(prev => ({ ...prev, recoveryEmail: true }));
      setRecoveryFormErrors(prev => ({ ...prev, recoveryEmail: emailErr }));
      setRecoveryError(emailErr);
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
      const msg = `A 6-digit password reset code was sent to ${recoveryEmail.trim()}. Please check your email inbox and spam folder.`;
      setRecoveryResendNotice(msg);
      toast.info(msg, 'Code Sent');
      setTimeout(() => setRecoveryResendNotice(null), 6000);
      setTimeout(() => recoveryOtpInputsRef.current[0]?.focus(), 100);
    } catch (err) {
      setRecoveryError(err.message || 'Failed to send reset code.');
      toast.error(err.message || 'Failed to send reset code.', 'Request Failed');
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
      const msg = `A fresh 6-digit code has been sent to ${recoveryEmail.trim()}. Please check your email inbox and spam folder.`;
      setRecoveryResendNotice(msg);
      toast.info(msg, 'Code Resent');
      setTimeout(() => setRecoveryResendNotice(null), 6000);
    } catch (err) {
      setRecoveryError(err.message || 'Failed to resend reset code.');
      toast.error(err.message || 'Failed to resend reset code.', 'Resend Failed');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryOtpChange = (index, val) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      const next = [...recoveryOtpValues];
      next[index] = '';
      setRecoveryOtpValues(next);
      return;
    }

    const char = digits[digits.length - 1];
    const next = [...recoveryOtpValues];
    next[index] = char;
    setRecoveryOtpValues(next);

    if (index < 5) {
      recoveryOtpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleRecoveryOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !recoveryOtpValues[index] && index > 0) {
      recoveryOtpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleRecoveryOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...recoveryOtpValues];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setRecoveryOtpValues(next);
    const nextFocus = Math.min(pasted.length, 5);
    recoveryOtpInputsRef.current[nextFocus]?.focus();
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const otpCode = recoveryOtpValues.join('');
    if (otpCode.length !== 6) {
      setRecoveryError('Please enter all 6 digits of the reset code.');
      return;
    }

    const passErr = validateField('newPassword', newPassword);
    const confirmErr = validateField('confirmPassword', confirmPassword);
    if (passErr || confirmErr) {
      setRecoveryTouched({ newPassword: true, confirmPassword: true });
      setRecoveryFormErrors({
        ...(passErr && { newPassword: passErr }),
        ...(confirmErr && { confirmPassword: confirmErr })
      });
      setRecoveryError(passErr || confirmErr);
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

      setRecoverySuccessBanner('Password successfully updated! You can now sign in.');
      toast.success('Your password has been successfully updated.', 'Password Reset');
      setTimeout(() => setRecoverySuccessBanner(null), 8000);

      setIsRecovering(false);
      setRecoveryStep('request');
      setRecoveryOtpValues(['', '', '', '', '', '']);
      setRecoveryDevOtp(null);
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryError(null);

      setEmail(recoveryEmail.trim().toLowerCase());
      setPassword('');
    } catch (err) {
      setRecoveryError(err.message || 'Failed to reset password.');
      toast.error(err.message || 'Failed to reset password.', 'Reset Failed');
    } finally {
      setRecoveryLoading(false);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (lockoutCountdown > 0) {
      toast.error(`Account is temporarily locked. Please wait ${Math.ceil(lockoutCountdown / 60)} minute(s).`, 'Account Locked');
      return;
    }

    // Client-side validation guardrails
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    setTouched({ email: true, password: true });
    if (emailErr || passErr) {
      setFormErrors({
        ...(emailErr && { email: emailErr }),
        ...(passErr && { password: passErr })
      });
      setLocalError(emailErr || passErr);
      return;
    }

    setFormErrors({});
    setLocalError(null);
    setLoading(true);

    try {
      // Send { email, password } to backend POST /api/auth/login
      const result = await login(email.trim(), password);

      const loggedInUser = result;
      setRemainingAttempts(null);
      setLockoutCountdown(0);
      toast.success(`Welcome back, ${loggedInUser.name || 'User'}!`, 'Signed In');
      handleAuthRedirect(loggedInUser);
    } catch (err) {
      if (err.error === 'ACCOUNT_LOCKED' || err.status === 423 || (err.remaining_seconds && err.remaining_seconds > 0)) {
        const secs = err.remaining_seconds || 900;
        setLockoutCountdown(secs);
        setRemainingAttempts(0);
        setLocalError(err.message || 'Account locked: 5 consecutive failed login attempts. Please wait 15 minutes or reset your password.');
        toast.error(err.message || 'Account locked for 15 minutes.', 'Security Lockout');
      } else if (typeof err.remaining_attempts === 'number') {
        setRemainingAttempts(err.remaining_attempts);
        setLocalError(err.message || `Invalid password. ${err.remaining_attempts} attempt(s) remaining.`);
        toast.error(err.message || `Invalid password. ${err.remaining_attempts} attempt(s) remaining.`, 'Sign In Failed');
      } else {
        setLocalError(err.message || 'Authentication failed. Please verify credentials.');
        toast.error(err.message || 'Authentication failed. Please verify credentials.', 'Sign In Failed');
      }
    } finally {
      setLoading(false);
    }
  }

  // Common redirect dispatcher based on RBAC role
  const handleAuthRedirect = (loggedInUser) => {
    if (loggedInUser?.email) {
      saveVerifiedGoogleAccount({
        email: loggedInUser.email,
        name: loggedInUser.name,
        status: 'Signed in'
      });
    }

    let targetPath = '/dashboard/member';
    if (loggedInUser.role === 'super_admin') {
      targetPath = '/dashboard/super-admin';
    } else if (loggedInUser.role === 'branch_admin' || loggedInUser.role === 'branch_owner') {
      targetPath = '/dashboard/branch-admin';
    } else if (loggedInUser.role === 'coach' || loggedInUser.role === 'trainer') {
      targetPath = '/dashboard/coach';
    } else if (loggedInUser.role === 'employee' || loggedInUser.role === 'staff') {
      targetPath = '/dashboard/employee';
    }

    if (onLoginSuccess) {
      onLoginSuccess(loggedInUser, targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

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
                // Automatically direct to sign up with pre-filled email and name
                setShowOnboardingModal(false);
                setPendingGoogleProfile(null);
                const targetEmail = res.google_profile?.email || '';
                const targetName = res.google_profile?.name || '';
                sessionStorage.setItem('ksyn_reg_prefill', JSON.stringify({ email: targetEmail, name: targetName }));
                toast.info('Account not yet registered. Redirecting to Sign Up...', 'Athlete Registration');
                if (onNavigateRegister) {
                  onNavigateRegister();
                } else {
                  window.history.pushState(null, '', '/register');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              } else {
                toast.success(`Welcome back, ${res.name || 'Athlete'}!`, 'Signed In with Google');
                handleAuthRedirect(res);
              }
            } catch (err) {
              setLocalError(err.message || 'Google sign-in failed.');
              toast.error(err.message || 'Google sign-in failed.', 'Authentication Error');
            } finally {
              setGoogleLoading(false);
            }
          }
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If GIS prompt is suppressed, open onboarding modal to complete gym requirements
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
    setLocalError(null);
    try {
      const res = await loginWithGoogle({ email: inputEmail, name: inputName });
      if (res?.is_new_user) {
        // Automatically save verified Gmail candidate for 1-click chooser
        const targetEmail = res.google_profile?.email || inputEmail;
        const targetName = res.google_profile?.name || inputName || '';
        saveVerifiedGoogleAccount({
          email: targetEmail,
          name: targetName,
          status: 'Signed in'
        });

        // Automatically direct to sign up with pre-filled email and name
        setShowOnboardingModal(false);
        setPendingGoogleProfile(null);
        sessionStorage.setItem('ksyn_reg_prefill', JSON.stringify({ email: targetEmail, name: targetName }));
        toast.info('Account not yet registered. Redirecting to Sign Up...', 'Athlete Registration');
        if (onNavigateRegister) {
          onNavigateRegister();
        } else {
          window.history.pushState(null, '', '/register');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
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
        handleAuthRedirect(res);
      }
    } catch (err) {
      setLocalError(err.message || 'Google sign-in failed.');
      toast.error(err.message || 'Google sign-in failed.', 'Authentication Error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Complete Google Registration with Gym System Requirements
  const handleCompleteGoogleRegistration = async (formData) => {
    setGoogleLoading(true);
    setLocalError(null);
    try {
      const newUser = await completeGoogleRegistration(formData);
      saveVerifiedGoogleAccount({
        email: newUser.email,
        name: newUser.name,
        status: 'Signed in'
      });
      setShowOnboardingModal(false);
      toast.success(`Welcome to KSYN Fitness, ${newUser.name || 'Athlete'}!`, 'Profile Activated');
      handleAuthRedirect(newUser);
    } catch (err) {
      setLocalError(err.message || 'Registration failed.');
      toast.error(err.message || 'Registration failed.', 'Registration Error');
    } finally {
      setGoogleLoading(false);
    }
  };

  async function handleMfaSubmit(e) {
    if (e) e.preventDefault();
    const totpCode = totpValues.join('');
    if (totpCode.length !== 6) {
      setMfaError('Please enter all 6 digits of the authenticator code.');
      return;
    }

    setMfaLoading(true);
    setMfaError(null);

    try {
      const loggedInUser = await verifyMfa(mfaData.mfa_ticket, totpCode);
      toast.success(`Identity verified. Welcome back, ${loggedInUser.name || 'Admin'}!`, '2FA Authenticated');
      handleAuthRedirect(loggedInUser);
    } catch (err) {
      setMfaError(err.message || 'Verification failed. Please check the code.');
      toast.error(err.message || 'Verification failed.', '2FA Denied');
    } finally {
      setMfaLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #1a1816 0%, #0a0a0a 75%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 12px',
      color: '#f9fafb',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Top Header Navigation */}
      <div style={{ width: '100%', maxWidth: '460px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tooltip content="Return to Public Landing Page" position="right">
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else {
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            aria-label="Back to Public Landing Page"
            className="touch-btn ksyn-btn ksyn-btn-outline"
            style={{ padding: '8px 14px', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ChevronLeft size={16} /> Back to Landing
          </button>
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
          <span>Dual-Token Security</span>
          <span>&bull;</span>
          <span style={{ color: '#658256', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Shield size={12} /> RBAC Guarded
          </span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '460px' }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/ksyn-logo.png"
            alt="KSYN Gym Logo"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              marginBottom: '12px',
              filter: 'drop-shadow(0 4px 16px rgba(225, 194, 86, 0.35))'
            }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '6px' }}>
            KSYN <span style={{ color: '#e1c256' }}>FITCONNECT</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
            Enterprise Franchise Management Platform &bull; Secure Authentication
          </p>
        </div>

        {/* 1. Login Card */}
        <div className="ksyn-card responsive-card" style={{
          padding: '24px 20px',
          maxWidth: '520px',
          margin: '0 auto 24px auto',
          borderRadius: '14px',
          border: '1px solid #1f232b',
          backgroundColor: '#101216'
        }}>
          {!isRecovering ? (
            mfaData ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.15)',
                    border: '1px solid rgba(225, 194, 86, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256'
                  }}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Two-Factor Authentication</h2>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>KSYN Enterprise MFA Shield for Admin & Investor Tiers</p>
                  </div>
                </div>

                <div style={{ background: '#12151e', border: '1px solid #262c3e', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Verified Administrator</span>
                    <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 700, textTransform: 'uppercase' }}>
                      {mfaData.role?.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff' }}>{mfaData.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Account: {mfaData.masked_email}</div>
                </div>

                {mfaError && (
                  <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{mfaError}</span>
                  </div>
                )}

                <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase', textAlign: 'center' }}>
                      Enter 6-Digit Authenticator Code (TOTP)
                    </label>
                    <div style={{ display: 'flex', gap: '6px', smGap: '8px', justifyContent: 'center' }}>
                      {totpValues.map((val, idx) => (
                        <input
                          key={idx}
                          ref={el => totpInputsRef.current[idx] = el}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={val}
                          onChange={(e) => {
                            const char = e.target.value.replace(/\D/g, '');
                            const next = [...totpValues];
                            next[idx] = char;
                            setTotpValues(next);
                            if (char && idx < 5) {
                              totpInputsRef.current[idx + 1]?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !totpValues[idx] && idx > 0) {
                              totpInputsRef.current[idx - 1]?.focus();
                            }
                          }}
                          aria-label={`Digit ${idx + 1}`}
                          className="touch-target"
                          style={{
                            width: '42px',
                            height: '50px',
                            textAlign: 'center',
                            fontSize: '1.25rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            background: '#0e1017',
                            border: val ? '1.5px solid #e1c256' : '1.5px solid #262c3e',
                            borderRadius: '8px',
                            color: '#e1c256',
                            outline: 'none',
                            transition: 'border-color 0.15s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <Tooltip content="Verify code and open dashboard" position="top">
                    <button
                      type="submit"
                      disabled={mfaLoading || totpValues.join('').length !== 6}
                      aria-label="Verify 2FA Token"
                      className="touch-btn ksyn-btn ksyn-btn-gold"
                      style={{ width: '100%', padding: '12px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {mfaLoading ? 'Verifying 2FA Token...' : 'Verify & Continue to Dashboard'} <ArrowRight size={16} />
                    </button>
                  </Tooltip>

                  <Tooltip content="Cancel and return to username & password sign in" position="bottom">
                    <button
                      type="button"
                      onClick={() => {
                        setMfaData(null);
                        setTotpValues(['', '', '', '', '', '']);
                        setMfaError(null);
                      }}
                      className="touch-target"
                      style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center', marginTop: '4px', width: '100%' }}
                    >
                      Cancel & Return to Standard Login
                    </button>
                  </Tooltip>
                </form>
              </div>
            ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Lock size={18} color="#e1c256" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Account Sign In</h2>
              </div>

              {recoverySuccessBanner && (
                <div style={{
                  background: 'rgba(101, 130, 86, 0.15)',
                  border: '1px solid #658256',
                  color: '#658256',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{recoverySuccessBanner}</span>
                </div>
              )}

              {/* Temporary Lockout Warning Card (5 Failed Attempts) */}
              {lockoutCountdown > 0 && (
                <div role="alert" style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1.5px solid #ef4444',
                  color: '#fca5a5',
                  padding: '16px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Shield size={22} color="#ef4444" className="shrink-0" />
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
                    For security purposes, access to this account is suspended for 15 minutes. Please wait for the cooldown timer to expire or reset your password.
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
                      {Math.floor(lockoutCountdown / 60).toString().padStart(2, '0')}:
                      {(lockoutCountdown % 60).toString().padStart(2, '0')}
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
                      Reset password via verified email
                    </button>
                  </div>
                </div>
              )}

              {/* Password Attempts Remaining Warning (Yellow Banner) */}
              {remainingAttempts !== null && remainingAttempts < 5 && lockoutCountdown === 0 && (
                <div role="alert" style={{
                  background: 'rgba(225, 194, 86, 0.12)',
                  border: '1px solid rgba(225, 194, 86, 0.45)',
                  color: '#f7ffc4',
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
                    <span>{remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before your account is temporarily locked for 15 minutes.</span>
                  </div>
                </div>
              )}

              {/* General Error (if not already handled by lockout or warning banner) */}
              {(localError || authError) && lockoutCountdown === 0 && remainingAttempts === null && (
                <div role="alert" style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{localError || authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Email / Username field with real-time validation */}
                <div>
                  <label htmlFor="login-email-input" className="ksyn-label">
                    Email Address or Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-email-input"
                      type="text"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (touched.email) {
                          const err = validateField('email', e.target.value);
                          setFormErrors(prev => ({ ...prev, email: err }));
                        }
                      }}
                      onBlur={() => handleBlur('email')}
                      required
                      autoComplete="username"
                      placeholder="e.g. username or user@ksyn.com"
                      aria-invalid={Boolean(formErrors.email)}
                      aria-describedby={formErrors.email ? "login-email-error" : undefined}
                      className={`ksyn-input min-h-[44px] ${
                        formErrors.email ? 'input-invalid' : (touched.email && email ? 'input-valid' : '')
                      }`}
                      style={{
                        paddingLeft: '38px',
                        paddingRight: '38px',
                        borderColor: formErrors.email ? '#ef4444' : (touched.email && email ? '#658256' : undefined)
                      }}
                    />
                    <Mail size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    {touched.email && !formErrors.email && email && (
                      <CheckCircle2 size={16} color="#658256" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    )}
                  </div>
                  {formErrors.email && (
                    <p id="login-email-error" className="field-error-msg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.email}</span>
                    </p>
                  )}
                </div>

                {/* Password field with 44x44px toggle button and tooltip */}
                <div>
                  <label htmlFor="login-password-input" className="ksyn-label">
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (touched.password) {
                          const err = validateField('password', e.target.value);
                          setFormErrors(prev => ({ ...prev, password: err }));
                        }
                      }}
                      onBlur={() => handleBlur('password')}
                      required
                      autoComplete="current-password"
                      placeholder="Enter password"
                      aria-invalid={Boolean(formErrors.password)}
                      aria-describedby={formErrors.password ? "login-password-error" : undefined}
                      className={`ksyn-input min-h-[44px] ${
                        formErrors.password ? 'input-invalid' : (touched.password && password ? 'input-valid' : '')
                      }`}
                      style={{
                        paddingLeft: '38px',
                        paddingRight: '48px',
                        borderColor: formErrors.password ? '#ef4444' : (touched.password && password ? '#658256' : undefined)
                      }}
                    />
                    <KeyRound size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <Tooltip content={showPassword ? 'Hide password' : 'Show password'} position="left">
                      <button
                        type="button"
                        id="login-password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="touch-target"
                        style={{
                          position: 'absolute',
                          right: '2px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '42px',
                          height: '42px',
                          background: 'none',
                          border: 'none',
                          color: showPassword ? '#e1c256' : '#9ca3af',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </Tooltip>
                  </div>
                  {formErrors.password && (
                    <p id="login-password-error" className="field-error-msg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.password}</span>
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <Tooltip content="Reset your password via verified email" position="top">
                      <button
                        type="button"
                        id="login-forgot-password-link"
                        onClick={handleOpenRecovery}
                        className="touch-target"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#e1c256',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          textDecoration: 'underline',
                          transition: 'color 0.15s ease',
                          minHeight: '36px'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#e1c256')}
                      >
                        Forgot Password?
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <Tooltip content={lockoutCountdown > 0 ? "Account temporarily locked" : loading ? "Authenticating session..." : "Sign in to your KSYN account"} position="top">
                  <button
                    id="login-submit-btn"
                    type="submit"
                    disabled={loading || lockoutCountdown > 0}
                    aria-label="Sign In to Portal"
                    className="touch-btn ksyn-btn ksyn-btn-gold"
                    style={{
                      width: '100%',
                      padding: '13px',
                      marginTop: '6px',
                      fontWeight: 800,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: lockoutCountdown > 0 ? 0.6 : 1,
                      cursor: lockoutCountdown > 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {lockoutCountdown > 0
                      ? `Account Locked (${Math.floor(lockoutCountdown / 60)}:${(lockoutCountdown % 60).toString().padStart(2, '0')})`
                      : loading
                      ? 'Verifying Credentials...'
                      : 'Sign In to Portal'}{' '}
                    <ArrowRight size={16} />
                  </button>
                </Tooltip>
              </form>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '20px 0 16px 0',
                color: '#6b7280',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#262c3e' }} />
                <span style={{ padding: '0 12px' }}>Or continue with</span>
                <div style={{ flex: 1, height: '1px', background: '#262c3e' }} />
              </div>

              {/* Direct Sign in with Google Button */}
              <Tooltip
                content="Sign in directly using your Google account"
                position="top"
                fullWidth
                style={{ width: '100%', display: 'block' }}
              >
                <button
                  id="login-google-btn"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
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
                    cursor: googleLoading || loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (!googleLoading && !loading) {
                      e.currentTarget.style.background = '#1e2330';
                      e.currentTarget.style.borderColor = '#4285F4';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(66, 133, 244, 0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!googleLoading && !loading) {
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
            </div>
           )
          ) : (
            <div>
              {/* Recovery Feedback Banners */}
              {recoveryError && (
                <div role="alert" style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={18} className="shrink-0" />
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
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{recoveryResendNotice}</span>
                </div>
              )}

              {recoveryStep === 'request' ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                      Reset Your Password
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                      Enter the email associated with your KSYN account to receive a reset code.
                    </p>
                  </div>

                  <form onSubmit={handleRequestResetOtp} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label htmlFor="login-recovery-email-input" className="ksyn-label">
                        Account Email Address
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="login-recovery-email-input"
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => {
                            setRecoveryEmail(e.target.value);
                            if (recoveryTouched.recoveryEmail) {
                              const err = validateField('recoveryEmail', e.target.value);
                              setRecoveryFormErrors(prev => ({ ...prev, recoveryEmail: err }));
                            }
                          }}
                          onBlur={() => handleRecoveryBlur('recoveryEmail')}
                          required
                          placeholder="e.g. athlete@ksyn.com"
                          aria-invalid={Boolean(recoveryFormErrors.recoveryEmail)}
                          aria-describedby={recoveryFormErrors.recoveryEmail ? "recovery-email-error" : undefined}
                          className={`ksyn-input min-h-[44px] ${
                            recoveryFormErrors.recoveryEmail ? 'input-invalid' : (recoveryTouched.recoveryEmail && recoveryEmail ? 'input-valid' : '')
                          }`}
                          style={{
                            paddingLeft: '38px',
                            borderColor: recoveryFormErrors.recoveryEmail ? '#ef4444' : undefined
                          }}
                        />
                        <Mail size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      </div>
                      {recoveryFormErrors.recoveryEmail && (
                        <p id="recovery-email-error" className="field-error-msg">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{recoveryFormErrors.recoveryEmail}</span>
                        </p>
                      )}
                    </div>

                    <Tooltip content="Send password reset code to your email" position="top">
                      <button
                        type="submit"
                        id="login-recovery-send-btn"
                        disabled={recoveryLoading}
                        aria-label="Send Reset Code"
                        className="touch-btn ksyn-btn ksyn-btn-gold"
                        style={{ width: '100%', padding: '13px', marginTop: '6px', fontWeight: 800, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        {recoveryLoading ? 'Sending Reset Code...' : 'Send Reset Code'} <ArrowRight size={16} />
                      </button>
                    </Tooltip>

                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <Tooltip content="Return to primary login form" position="bottom">
                        <button
                          type="button"
                          id="login-recovery-back-btn"
                          onClick={handleBackToSignIn}
                          aria-label="Back to Sign In"
                          className="touch-target"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            fontWeight: 600,
                            transition: 'color 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e1c256')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          <ChevronLeft size={16} /> Back to Sign In
                        </button>
                      </Tooltip>
                    </div>
                  </form>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                      Set New Password
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                      Enter the 6-digit code sent to <span className="text-[#e1c256]" style={{ color: '#e1c256', fontWeight: 700 }}>{recoveryEmail}</span>
                    </p>
                  </div>

                  <form onSubmit={handleResetPasswordSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label style={{ textAlign: 'center', display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                        6-Digit Verification Code
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', smGap: '8px', marginBottom: '8px' }}>
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
                            aria-label={`Recovery code digit ${idx + 1}`}
                            className="ksyn-input touch-target"
                            style={{
                              width: '42px',
                              height: '50px',
                              textAlign: 'center',
                              fontSize: '1.25rem',
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

                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                        {recoveryResendCountdown > 0 ? (
                          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                            Resend code in <strong style={{ color: '#e1c256' }}>{recoveryResendCountdown}s</strong>
                          </span>
                        ) : (
                          <Tooltip content="Request a new 6-digit verification code" position="top">
                            <button
                              type="button"
                              onClick={handleResendResetOtp}
                              disabled={recoveryLoading}
                              aria-label="Resend Code"
                              className="touch-target"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#e1c256',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '6px 10px',
                                textDecoration: 'underline'
                              }}
                            >
                              Resend Code
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label htmlFor="login-recovery-new-password" className="ksyn-label">New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="login-recovery-new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (recoveryTouched.newPassword) {
                              const err = validateField('newPassword', e.target.value);
                              setRecoveryFormErrors(prev => ({ ...prev, newPassword: err }));
                            }
                          }}
                          onBlur={() => handleRecoveryBlur('newPassword')}
                          required
                          placeholder="Min. 8 characters (letters & numbers)"
                          aria-invalid={Boolean(recoveryFormErrors.newPassword)}
                          aria-describedby={recoveryFormErrors.newPassword ? "recovery-newpass-error" : undefined}
                          className={`ksyn-input min-h-[44px] ${
                            recoveryFormErrors.newPassword ? 'input-invalid' : (recoveryTouched.newPassword && newPassword ? 'input-valid' : '')
                          }`}
                          style={{ paddingLeft: '38px', paddingRight: '48px' }}
                        />
                        <Lock size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Tooltip content={showNewPassword ? 'Hide password' : 'Show password'} position="left">
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            className="touch-target"
                            style={{
                              position: 'absolute',
                              right: '2px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '42px',
                              height: '42px',
                              background: 'none',
                              border: 'none',
                              color: showNewPassword ? '#e1c256' : '#9ca3af',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px'
                            }}
                          >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </Tooltip>
                      </div>
                      {recoveryFormErrors.newPassword && (
                        <p id="recovery-newpass-error" className="field-error-msg">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{recoveryFormErrors.newPassword}</span>
                        </p>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label htmlFor="login-recovery-confirm-password" className="ksyn-label">Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="login-recovery-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (recoveryTouched.confirmPassword) {
                              const err = validateField('confirmPassword', e.target.value);
                              setRecoveryFormErrors(prev => ({ ...prev, confirmPassword: err }));
                            }
                          }}
                          onBlur={() => handleRecoveryBlur('confirmPassword')}
                          required
                          placeholder="Re-enter new password"
                          aria-invalid={Boolean(recoveryFormErrors.confirmPassword)}
                          aria-describedby={recoveryFormErrors.confirmPassword ? "recovery-confirmpass-error" : undefined}
                          className={`ksyn-input min-h-[44px] ${
                            recoveryFormErrors.confirmPassword ? 'input-invalid' : (recoveryTouched.confirmPassword && confirmPassword && confirmPassword === newPassword ? 'input-valid' : '')
                          }`}
                          style={{ paddingLeft: '38px', paddingRight: '48px' }}
                        />
                        <Lock size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Tooltip content={showConfirmPassword ? 'Hide password' : 'Show password'} position="left">
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            className="touch-target"
                            style={{
                              position: 'absolute',
                              right: '2px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '42px',
                              height: '42px',
                              background: 'none',
                              border: 'none',
                              color: showConfirmPassword ? '#e1c256' : '#9ca3af',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px'
                            }}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </Tooltip>
                      </div>
                      {recoveryFormErrors.confirmPassword && (
                        <p id="recovery-confirmpass-error" className="field-error-msg">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{recoveryFormErrors.confirmPassword}</span>
                        </p>
                      )}
                    </div>

                    <Tooltip content="Apply new credentials and sign in" position="top">
                      <button
                        type="submit"
                        id="login-recovery-submit-btn"
                        disabled={recoveryLoading}
                        aria-label="Confirm & Update Password"
                        className="touch-btn ksyn-btn ksyn-btn-gold"
                        style={{ width: '100%', padding: '13px', marginTop: '6px', fontWeight: 800, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        {recoveryLoading ? 'Updating Password...' : 'Confirm & Update Password'} <ArrowRight size={16} />
                      </button>
                    </Tooltip>

                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <Tooltip content="Cancel reset and return to login" position="bottom">
                        <button
                          type="button"
                          onClick={handleBackToSignIn}
                          aria-label="Back to Sign In"
                          className="touch-target"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            fontWeight: 600,
                            transition: 'color 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e1c256')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          <ChevronLeft size={16} /> Back to Sign In
                        </button>
                      </Tooltip>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Security Features: Replaced all emojis with SVG icons */}
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #1f1f1f',
            fontSize: '0.75rem',
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#e1c256" className="shrink-0" /> Bcrypt-Hashed Verification
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} color="#e1c256" className="shrink-0" /> RBAC Guarded Access
            </span>
          </div>
        </div>

        {/* 2. New Athlete / Franchise Guest Registration Prompt */}
        <div style={{
          textAlign: 'center',
          marginBottom: '28px',
          background: 'rgba(225, 194, 86, 0.04)',
          border: '1px solid #222222',
          borderRadius: '10px',
          padding: '14px 20px',
          fontSize: '0.875rem'
        }}>
          <span style={{ color: '#9ca3af' }}>New athlete or franchise guest? </span>
          <Tooltip content="Join KSYN Fitness as a new athlete" position="top">
            <button
              id="login-to-register-btn"
              onClick={() => {
                if (onNavigateRegister) onNavigateRegister();
                else {
                  window.history.pushState(null, '', '/register');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              aria-label="Create an account / Join as Member"
              className="touch-target"
              style={{
                background: 'none',
                border: 'none',
                color: '#e1c256',
                fontWeight: 800,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px'
              }}
            >
              Create an account / Join as Member <ArrowRight size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

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
          if (onNavigateRegister) onNavigateRegister();
        }}
        onCheckGoogleAccount={handleCheckGoogleAccount}
        onSubmit={handleCompleteGoogleRegistration}
        loading={googleLoading}
      />
    </div>
  );
}
