import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Phone,
  Building2,
  Dumbbell,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  UserPlus,
  MinusCircle,
  HeartHandshake
} from 'lucide-react';
import Tooltip from './Tooltip';
import TermsModal from './TermsModal';
import EulaModal from './EulaModal';
import { BRANCH_DIRECTORY } from '../config/branchData';
import { MEMBERSHIP_PLANS } from '../config/membershipRates';
import {
  getSavedGoogleAccounts,
  saveVerifiedGoogleAccount,
  removeSavedGoogleAccount
} from '../utils/googleAccounts';

export default function GoogleOnboardingModal({
  isOpen,
  googleProfile,
  onClose,
  onBackToAccountList,
  onNavigateRegister,
  onCheckGoogleAccount,
  onSubmit,
  loading
}) {
  // Step 1 State: Account Selection or Custom Input
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [inputEmail, setInputEmail] = useState('');

  // Gmail OTP Verification State for New Google Users
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpTargetName, setOtpTargetName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [otpMessage, setOtpMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [checkingAccount, setCheckingAccount] = useState(false);

  // Step 2 State: Google Profile details
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [picture, setPicture] = useState('');
  const [googleId, setGoogleId] = useState('');

  // Required Gym Fields (not provided by Google)
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [branchId, setBranchId] = useState('b-mkt-01');
  const [selectedPlanId, setSelectedPlanId] = useState('12_months');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showEulaModal, setShowEulaModal] = useState(false);

  // Validation feedback
  const [formError, setFormError] = useState(null);

  // Synchronized persistent Google accounts for 1-click login
  const [googleAccounts, setGoogleAccounts] = useState(() => getSavedGoogleAccounts());

  useEffect(() => {
    setGoogleAccounts(getSavedGoogleAccounts());
    const handleAccountsUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setGoogleAccounts(e.detail);
      } else {
        setGoogleAccounts(getSavedGoogleAccounts());
      }
    };
    window.addEventListener('ksyn_google_accounts_updated', handleAccountsUpdate);
    return () => window.removeEventListener('ksyn_google_accounts_updated', handleAccountsUpdate);
  }, [isOpen]);

  useEffect(() => {
    if (googleProfile && googleProfile.email) {
      setEmail(googleProfile.email);
      setName(googleProfile.name || googleProfile.email.split('@')[0]);
      setPicture(googleProfile.picture || '');
      setGoogleId(googleProfile.google_id || '');
    } else {
      setEmail('');
      setName('');
      setPicture('');
      setGoogleId('');
      setInputEmail('');
      setShowCustomInput(false);
      setIsOtpMode(false);
      setOtpCode('');
      setOtpTargetEmail('');
    }
    setFormError(null);
  }, [googleProfile, isOpen]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (isOtpMode && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpMode, otpCountdown]);

  // Determine current step:
  // Step 1: Google Account Chooser (Image 2)
  // Step 2: Athlete Profile Requirements (for new unregistered accounts)
  const isStep2 = Boolean(googleProfile && googleProfile.email);

  // Age calculation and validation (Must be >= 16)
  const { age, isAgeValid, ageError } = useMemo(() => {
    if (!dob) return { age: null, isAgeValid: false, ageError: null };
    const birthDate = new Date(dob);
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
      return { age: calculatedAge, isAgeValid: false, ageError: `Athlete must be at least 16 years old (current: ${calculatedAge})` };
    }
    return { age: calculatedAge, isAgeValid: true, ageError: null };
  }, [dob]);

  // Phone validation (Philippine numbers)
  const isPhoneValid = useMemo(() => {
    const clean = phone.replace(/[\s-]/g, '');
    return /^(09|\+639)\d{9}$/.test(clean);
  }, [phone]);

  if (!isOpen) return null;

  // Unified Account Checking: Logs in immediately if registered, or dispatches Gmail OTP if new
  const initiateAccountCheck = async (targetEmail, targetName) => {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid Google email address.');
      return;
    }
    setFormError(null);
    setCheckingAccount(true);

    try {
      // 1. Check if user already exists
      const checkRes = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: targetName || cleanEmail.split('@')[0] })
      });
      const checkData = await checkRes.json();

      if (checkData.success && !checkData.is_new_user) {
        // Existing registered user -> 1-click Sign In directly
        saveVerifiedGoogleAccount({
          email: cleanEmail,
          name: checkData.name || targetName || cleanEmail.split('@')[0],
          status: 'Signed in'
        });
        if (onCheckGoogleAccount) {
          onCheckGoogleAccount(cleanEmail, targetName);
        }
        return;
      }

      // 2. New user -> Trigger OTP to Gmail and require verification BEFORE proceeding to sign up
      const otpRes = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const otpData = await otpRes.json();

      setOtpTargetEmail(cleanEmail);
      setOtpTargetName(targetName || cleanEmail.split('@')[0]);
      setOtpCode('');
      setOtpCountdown(60);
      setDevOtp('');
      setOtpMessage(otpData.message || `Verification code sent to ${cleanEmail}`);
      setIsOtpMode(true);
    } catch (err) {
      setFormError(err.message || 'Unable to verify Google account. Please try again.');
    } finally {
      setCheckingAccount(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (otpCountdown > 0 || !otpTargetEmail) return;
    setFormError(null);
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpTargetEmail })
      });
      const data = await res.json();
      setOtpCountdown(60);
      setDevOtp('');
      setOtpMessage(data.message || `New code dispatched to ${otpTargetEmail}`);
    } catch (err) {
      setFormError(err.message || 'Failed to resend verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Submit and verify OTP
  const handleVerifyGoogleOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError(null);
    const cleanCode = (otpCode || '').trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setFormError('Please enter the 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpTargetEmail, otpCode: cleanCode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid 6-digit verification code.');
      }

      // Automatically save verified Gmail candidate for 1-click chooser
      saveVerifiedGoogleAccount({
        email: otpTargetEmail,
        name: otpTargetName,
        status: 'Signed in'
      });

      // Save prefill with verified status
      sessionStorage.setItem('ksyn_reg_prefill', JSON.stringify({
        email: otpTargetEmail,
        name: otpTargetName,
        isGoogleVerified: true,
        verifiedOtp: cleanCode
      }));
      sessionStorage.setItem('ksyn_verified_email', otpTargetEmail);

      // Close modal and navigate to registration wizard
      if (onClose) onClose();
      if (onNavigateRegister) {
        onNavigateRegister();
      } else {
        window.history.pushState(null, '', '/register');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      setFormError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle 1-Click Account Choice from Image 2
  const handleSelectAccount = (selectedAcc) => {
    initiateAccountCheck(selectedAcc.email, selectedAcc.name);
  };

  // Handle Custom Email Submit
  const handleCustomEmailSubmit = (e) => {
    e.preventDefault();
    initiateAccountCheck(inputEmail, inputEmail.split('@')[0]);
  };

  // Handle Step 2: Submit gym requirements for new athlete
  const handleOnboardingSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    const activeEmail = (email || inputEmail.trim()).toLowerCase();
    if (!activeEmail || !activeEmail.includes('@')) {
      setFormError('A valid Google email address is required.');
      return;
    }
    if (!name.trim()) {
      setFormError('Your full name is required.');
      return;
    }
    if (!dob || !isAgeValid) {
      setFormError(ageError || 'Please provide a valid date of birth (minimum 16 years of age).');
      return;
    }
    if (!phone || !isPhoneValid) {
      setFormError('Please enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).');
      return;
    }
    if (!waiverAccepted) {
      setFormError('You must accept the KSYN Gym Safety Waiver & Terms of Service.');
      return;
    }

    // Automatically save verified athlete profile into 1-click Google accounts list
    saveVerifiedGoogleAccount({
      email: activeEmail,
      name: name.trim(),
      status: 'Signed in'
    });

    const tier = selectedPlanId === '12_months' ? 'elite' : selectedPlanId === '6_months' ? 'pro' : 'standard';

    onSubmit({
      google_profile: {
        email: activeEmail,
        name: name.trim(),
        picture,
        google_id: googleId
      },
      phone: phone.trim(),
      dob,
      branch_id: branchId,
      membership_plan: selectedPlanId,
      tier,
      emergency_contact_name: emergencyName.trim(),
      emergency_contact_phone: emergencyPhone.trim(),
      waiver_accepted: true
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-modal-title"
        style={{
          width: '100%',
          maxWidth: isStep2 ? '560px' : '480px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#131314', // Exact Google Dark Mode Background
          border: '1px solid #3c4043', // Google Dialog Border
          borderRadius: '24px', // Google Material 3 rounded corners
          padding: '28px 24px 20px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 25px rgba(66, 133, 244, 0.15)',
          color: '#e8eaed',
          position: 'relative',
          transition: 'all 0.2s ease',
          fontFamily: "'Google Sans', Roboto, Arial, sans-serif"
        }}
      >
        {/* Close Button */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <Tooltip content="Close (Esc)" position="left">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
              style={{
                background: '#202124',
                border: '1px solid #3c4043',
                color: '#9aa0a6',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#4285f4';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = '#9aa0a6';
                  e.currentTarget.style.borderColor = '#3c4043';
                }
              }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* =================================================================== */}
        {/* STEP 1: Official Google Account Chooser & Gmail OTP Verification    */}
        {/* =================================================================== */}
        {!isStep2 ? (
          isOtpMode ? (
            <div>
              {/* Google Logo & "Verify your Gmail" Title */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <h1 id="google-modal-title" style={{ fontSize: '1.45rem', fontWeight: 600, margin: 0, color: '#ffffff' }}>
                  Verify your Gmail
                </h1>
                <p style={{ fontSize: '0.8125rem', color: '#9aa0a6', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                  Google sent a 6-digit verification code to <span style={{ color: '#ffffff', fontWeight: 600 }}>{otpTargetEmail}</span>. Enter the code to verify your identity before signing up.
                </p>
              </div>

              {/* Status Message */}
              {otpMessage && !formError && (
                <div style={{
                  background: 'rgba(52, 168, 83, 0.12)',
                  border: '1px solid rgba(52, 168, 83, 0.35)',
                  color: '#81c995',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{otpMessage}</span>
                </div>
              )}

              {/* Error Banner */}
              {formError && (
                <div
                  role="alert"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Verification Form */}
              <form onSubmit={handleVerifyGoogleOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9aa0a6', marginBottom: '6px', letterSpacing: '0.05em' }}>
                    ENTER 6-DIGIT GMAIL OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#202124',
                      border: '1px solid #4285f4',
                      color: '#ffffff',
                      fontSize: '1.5rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.35em',
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Resend Row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9aa0a6' }}>
                    {otpCountdown > 0 ? (
                      <span>Resend in {otpCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8ab4f8',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                          fontSize: '0.75rem',
                          textDecoration: 'underline'
                        }}
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpMode(false);
                      setFormError(null);
                    }}
                    disabled={otpLoading}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: '1px solid #3c4043',
                      color: '#9aa0a6',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.trim().length !== 6}
                    style={{
                      flex: 2,
                      padding: '11px',
                      borderRadius: '8px',
                      backgroundColor: otpCode.trim().length === 6 ? '#4285f4' : '#282a2d',
                      border: 'none',
                      color: otpCode.trim().length === 6 ? '#ffffff' : '#5f6368',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: (otpLoading || otpCode.trim().length !== 6) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </div>
              </form>

              {/* Footer row */}
              <div
                style={{
                  marginTop: '22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: '#9aa0a6'
                }}
              >
                <span>English (United States)</span>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ cursor: 'pointer' }}>Help</span>
                  <span style={{ cursor: 'pointer' }}>Privacy</span>
                  <span style={{ cursor: 'pointer' }}>Terms</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Google Logo & "Choose an account" Title */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <h1 id="google-modal-title" style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: '#ffffff' }}>
                  Choose an account
                </h1>
                <p style={{ fontSize: '0.8125rem', color: '#9aa0a6', margin: '4px 0 0 0' }}>
                  to continue to <span style={{ color: '#ffffff', fontWeight: 600 }}>KSYN FitConnect</span>
                </p>
              </div>

            {formError && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Account List (One-Click Selection) */}
            <div style={{ borderTop: '1px solid #3c4043', borderBottom: '1px solid #3c4043', margin: '0 -24px' }}>
              {googleAccounts.map((acc, idx) => (
                <div
                  key={acc.email || idx}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid #282a2d',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#202124';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectAccount(acc)}
                    style={{
                      flex: 1,
                      padding: '14px 16px 14px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      background: 'transparent',
                      border: 'none',
                      color: '#e8eaed',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                      {/* User Avatar */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: acc.avatarBg || '#e1c256',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          color: '#ffffff',
                          flexShrink: 0
                        }}
                      >
                        {acc.avatarText || (acc.name || acc.email || 'G')[0].toUpperCase()}
                      </div>
                      {/* Name & Email */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.name}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.email}
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <span style={{
                      fontSize: '0.75rem',
                      color: acc.status === 'Signed in' ? '#81c995' : '#9aa0a6',
                      fontWeight: acc.status === 'Signed in' ? 600 : 400,
                      flexShrink: 0,
                      paddingLeft: '8px'
                    }}>
                      {acc.status}
                    </span>
                  </button>

                  {/* Remove Account from Device Button */}
                  <div style={{ paddingRight: '14px' }}>
                    <Tooltip content={`Remove ${acc.email} from list`} position="left">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedGoogleAccount(acc.email);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#5f6368',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.color = '#5f6368';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        aria-label="Remove account"
                      >
                        <X size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}

              {/* "Use another account" Action (Matches Image 2) */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowCustomInput(!showCustomInput)}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: 'transparent',
                  border: 'none',
                  color: '#e8eaed',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#202124';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#202124',
                    border: '1px solid #3c4043',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9aa0a6',
                    flexShrink: 0
                  }}
                >
                  <UserPlus size={18} />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e8eaed' }}>
                  Use another account
                </div>
              </button>
            </div>

            {/* Custom Google Email Form if toggled */}
            {showCustomInput && (
              <form onSubmit={handleCustomEmailSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#9aa0a6' }}>
                  Enter any Google email address. If already registered, you will sign in directly. If not yet registered, you will proceed directly to sign up using this verified Gmail.
                </p>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="Enter Google email (e.g. user@gmail.com)"
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 36px',
                      borderRadius: '8px',
                      backgroundColor: '#202124',
                      border: '1px solid #4285f4',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                  <Mail size={16} color="#9aa0a6" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <button
                  type="submit"
                  disabled={loading || checkingAccount}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    backgroundColor: (loading || checkingAccount) ? '#282a2d' : '#4285f4',
                    border: 'none',
                    color: (loading || checkingAccount) ? '#9aa0a6' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: (loading || checkingAccount) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {checkingAccount ? 'Verifying Gmail...' : loading ? 'Checking Account...' : 'Continue with this Google Account'}
                </button>
              </form>
            )}

            {/* Footer row (Matches Image 2 exactly) */}
            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: '#9aa0a6'
              }}
            >
              <span>English (United States)</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ cursor: 'pointer' }}>Help</span>
                <span style={{ cursor: 'pointer' }}>Privacy</span>
                <span style={{ cursor: 'pointer' }}>Terms</span>
              </div>
            </div>
          </div>
        )
      ) : (
          /* =================================================================== */
          /* STEP 2: Athlete Profile Completion (Only for Unregistered Accounts) */
          /* =================================================================== */
          <div>
            {/* Back to Account Chooser Button */}
            {onBackToAccountList && (
              <div style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={onBackToAccountList}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8ab4f8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: '4px 0',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8ab4f8')}
                >
                  <ArrowLeft size={16} /> Choose another account
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#161b26', border: '1px solid #2b3548', marginBottom: '10px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </div>
              <h2 id="google-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Complete Athlete Registration
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                Your Google Account is authenticated! Please complete your athlete details below to activate your KSYN membership.
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Google Identity Verification Box */}
              <div
                style={{
                  background: 'rgba(66, 133, 244, 0.08)',
                  border: '1px solid rgba(66, 133, 244, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {picture ? (
                    <img
                      src={picture}
                      alt={name}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#4285f4',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.875rem'
                      }}
                    >
                      {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff' }}>{name || email.split('@')[0]}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{email}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(101, 130, 86, 0.15)',
                    color: '#658256',
                    border: '1px solid rgba(101, 130, 86, 0.3)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>Verified by Google</span>
                </div>
              </div>

              {/* Athlete Name & Verified Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                    Full Athlete Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Juan dela Cruz"
                    className="ksyn-input"
                    style={{ padding: '9px 12px', fontSize: '0.8125rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                    Google Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="ksyn-input"
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.8125rem',
                      backgroundColor: '#161922',
                      color: '#94a3b8',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              {/* Phone & Date of Birth */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>
                      Mobile Phone <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {phone && (
                      <span style={{ fontSize: '0.6875rem', color: isPhoneValid ? '#658256' : '#ef4444' }}>
                        {isPhoneValid ? 'Valid' : 'Format: 09XX'}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0917 123 4567"
                      required
                      className="ksyn-input"
                      style={{
                        padding: '9px 12px 9px 34px',
                        fontSize: '0.8125rem',
                        borderColor: phone ? (isPhoneValid ? '#658256' : '#ef4444') : undefined
                      }}
                    />
                    <Phone size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>
                      Date of Birth <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {dob && (
                      <span style={{ fontSize: '0.6875rem', color: isAgeValid ? '#658256' : '#ef4444' }}>
                        {isAgeValid ? `Age: ${age} (Verified)` : ageError}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      value={dob}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDob(e.target.value)}
                      required
                      className="ksyn-input"
                      style={{
                        padding: '9px 12px 9px 34px',
                        fontSize: '0.8125rem',
                        borderColor: dob ? (isAgeValid ? '#658256' : '#ef4444') : undefined
                      }}
                    />
                    <Calendar size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>
              </div>

              {/* Branch & Membership Plan Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                    Home Gym Branch <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="ksyn-input"
                      style={{ padding: '9px 12px 9px 34px', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      {BRANCH_DIRECTORY.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                    <Building2 size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                    Membership Tier & Plan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="ksyn-input"
                      style={{ padding: '9px 12px 9px 34px', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      {MEMBERSHIP_PLANS.filter(p => p.id !== '1_day').map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — ₱{plan.planFee.toLocaleString()}/term ({plan.tier.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <Dumbbell size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div style={{ background: '#12151e', border: '1px solid #232938', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e1c256', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartHandshake size={14} /> Emergency Contact Details (Gym Safety Policy)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Contact person name"
                      className="ksyn-input"
                      style={{ padding: '8px 10px', fontSize: '0.75rem' }}
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="Emergency phone number"
                      className="ksyn-input"
                      style={{ padding: '8px 10px', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Waiver Acceptance */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: waiverAccepted ? 'rgba(225, 194, 86, 0.08)' : '#161922',
                  border: `1px solid ${waiverAccepted ? '#e1c256' : '#283144'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer'
                }}
                onClick={() => setWaiverAccepted(!waiverAccepted)}
              >
                <input
                  type="checkbox"
                  id="google-waiver-checkbox"
                  checked={waiverAccepted}
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: '#e1c256', cursor: 'pointer' }}
                />
                <label htmlFor="google-waiver-checkbox" style={{ fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer', lineHeight: 1.4 }}>
                  I agree to the KSYN Fitness Member Agreement, Physical Activity Readiness (PAR-Q), and Liability Waiver.{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTermsModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.75rem'
                    }}
                  >
                    View Terms
                  </button>
                  {' '}&bull;{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEulaModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.75rem'
                    }}
                  >
                    View EULA
                  </button>
                </label>
              </div>

              {/* Submit Registration Button */}
              <button
                type="submit"
                disabled={loading || !waiverAccepted}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '8px',
                  background: waiverAccepted ? '#e1c256' : '#333a4d',
                  border: 'none',
                  color: waiverAccepted ? '#000000' : '#8892b0',
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  cursor: loading || !waiverAccepted ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                  transition: 'all 0.15s ease',
                  boxShadow: waiverAccepted ? '0 0 20px rgba(225, 194, 86, 0.3)' : 'none'
                }}
              >
                {loading ? 'Activating Athlete Profile...' : 'Complete Registration & Enter Portal'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setWaiverAccepted(true);
          setShowTermsModal(false);
        }}
      />

      <EulaModal
        isOpen={showEulaModal}
        onClose={() => setShowEulaModal(false)}
        onAccept={() => {
          setShowEulaModal(false);
        }}
      />
    </div>
  );
}
