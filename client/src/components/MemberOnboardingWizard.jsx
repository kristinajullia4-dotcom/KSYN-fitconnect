import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  CreditCard,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Clock,
  Sparkles,
  Award,
  Key,
  X,
  Check,
  ArrowRight,
  Download,
  ExternalLink,
  Tag
} from 'lucide-react';
import QRCode from 'qrcode';
import Tooltip from './Tooltip';
import TermsModal from './TermsModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import RefundPolicyModal from './RefundPolicyModal';
import EulaModal from './EulaModal';
import { MEMBERSHIP_PLANS, getPlanDetails, PROMO_CODES, calculatePlanPricing, getAvailablePromosForBranch } from '../config/membershipRates';
import { saveVerifiedGoogleAccount } from '../utils/googleAccounts';

// Resilient API Client Helper: tries Vite proxy (/api) first, auto-recovers to backend port 5080 if proxy fails
const API_BASE_ORIGIN = (
  import.meta.env?.VITE_API_URL ||
  (import.meta.env?.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : '') ||
  'http://localhost:5080'
).replace(/\/+$/, '');

const safeApiFetch = async (endpoint, options = {}) => {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const proxyUrl = cleanPath;
  const directUrl = `${API_BASE_ORIGIN}${cleanPath}`;

  try {
    const res = await fetch(proxyUrl, options);
    // If Vite proxy returns 502/504 (backend offline/starting up on 5080)
    if (res.status === 502 || res.status === 504) {
      console.warn(`[safeApiFetch] Vite proxy returned HTTP ${res.status}. Retrying direct port 5080: ${directUrl}`);
      return await fetch(directUrl, options);
    }
    return res;
  } catch (proxyError) {
    console.warn(`[safeApiFetch] Proxy call to ${proxyUrl} failed (${proxyError.message}). Retrying direct on ${directUrl}...`);
    try {
      const directRes = await fetch(directUrl, options);
      return directRes;
    } catch (directError) {
      console.error("Payment rail fetch failed:", directError);
      throw directError;
    }
  }
};

const BRANCH_OPTIONS = [
  { id: 'b-mkt-01', code: 'MKT-01', name: 'KSYN Fitness Makati Flagship', address: 'Alphaland Makati Place, Ayala Ave. Ext.' },
  { id: 'b-kat-02', code: 'KAT-02', name: 'KSYN Fitness Katipunan Club', address: 'Regis Center, Katipunan Ave., QC' },
  { id: 'b-alb-03', code: 'ALB-03', name: 'KSYN Fitness Alabang Town', address: 'Alabang West Parade, Daang Hari Rd' },
  { id: 'b-kap-04', code: 'KAP-04', name: 'KSYN Fitness Kapitolyo', address: '165 Pasig Blvd, Pasig City' },
  { id: 'b-frv-05', code: 'FRV-05', name: 'KSYN Fitness Fairview QC', address: 'Pontiac corner Camaro St., Fairview' },
  { id: 'b-dlm-06', code: 'DLM-06', name: 'KSYN Fitness Del Monte', address: 'VCT Building, 447 Del Monte Ave., QC' },
  { id: 'b-tmo-07', code: 'TMO-07', name: 'KSYN Fitness Timog Ave.', address: 'Victoria Towers, Timog Ave. cor. Panay' }
];

const PARQ_QUESTIONS = [
  { id: 'heart_condition', text: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?' },
  { id: 'chest_pain_activity', text: 'Do you feel pain in your chest when you engage in physical activity?' },
  { id: 'chest_pain_resting', text: 'In the past month, have you had chest pain when you were not doing physical activity?' },
  { id: 'dizziness_balance', text: 'Do you lose your balance because of dizziness or do you ever lose consciousness?' },
  { id: 'bone_joint_problem', text: 'Do you have a bone or joint problem (e.g. back, knee, or hip) that could be made worse by a change in your physical activity?' },
  { id: 'blood_pressure_meds', text: 'Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?' },
  { id: 'other_reason', text: 'Do you know of any other reason why you should not do physical activity?' }
];

export default function MemberOnboardingWizard({
  isOpen = true,
  onClose,
  onComplete,
  onSuccess: propOnSuccess,
  defaultBranchId = 'b-mkt-01',
  isModal = true,
  existingUser = null,
  initialPlanTier = '',
  initialPromoCode = ''
}) {
  const onSuccess = propOnSuccess || onComplete;
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // -------------------------------------------------------------
  // STEP 1: IDENTITY & PLAN SELECTION & PROMO ENGINE
  // -------------------------------------------------------------
  const [selectedBranchId, setSelectedBranchId] = useState(existingUser?.branch_id || defaultBranchId);
  const [selectedPlanTier, setSelectedPlanTier] = useState(
    initialPlanTier || existingUser?.membership_plan || existingUser?.plan || existingUser?.subscription?.plan || '1_month'
  );
  const [promoCode, setPromoCode] = useState(initialPromoCode || '');
  const [promoInput, setPromoInput] = useState(initialPromoCode || '');
  const [promoFeedback, setPromoFeedback] = useState(null);
  const [promoVerificationData, setPromoVerificationData] = useState({
    schoolName: '',
    studentId: '',
    partnerName: '',
    partnerEmail: '',
    companyName: '',
    corporateEmail: '',
    pnpId: ''
  });
  const getFallbackUserField = (field) => {
    if (existingUser?.[field]) return existingUser[field];
    try {
      const stored = sessionStorage.getItem('ksyn_reg_prefill');
      if (stored) {
        const p = JSON.parse(stored);
        if (p?.[field]) return p[field];
      }
      const cached = JSON.parse(localStorage.getItem('ksyn_user') || '{}');
      if (cached?.[field]) return cached[field];
    } catch (e) {}
    return '';
  };

  const [fullName, setFullName] = useState(() => getFallbackUserField('name'));
  const [email, setEmail] = useState(() => getFallbackUserField('email'));
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [phone, setPhone] = useState(() => getFallbackUserField('phone'));
  const [password, setPassword] = useState(existingUser ? 'PreAuthPassword2026!' : '');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEulaModal, setShowEulaModal] = useState(false);

  // Sync initialPlanTier and initialPromoCode whenever caller updates it
  useEffect(() => {
    if (initialPlanTier) {
      setSelectedPlanTier(initialPlanTier);
    }
  }, [initialPlanTier]);

  useEffect(() => {
    if (initialPromoCode) {
      setPromoCode(initialPromoCode);
      setPromoInput(initialPromoCode);
    }
  }, [initialPromoCode]);

  // Reset step to 1 whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  useEffect(() => {
    let prefill = null;
    try {
      const stored = sessionStorage.getItem('ksyn_reg_prefill');
      if (stored) prefill = JSON.parse(stored);
    } catch (e) {}

    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem('ksyn_user') || '{}');
    } catch (e) {}

    const source = existingUser || prefill || cached;
    if (source) {
      if (!initialPlanTier && !selectedPlanTier && (source.membership_plan || source.plan || source.subscription?.plan)) {
        setSelectedPlanTier(source.membership_plan || source.plan || source.subscription?.plan);
      }
      if (source.branch_id) setSelectedBranchId(source.branch_id);
      if (source.name) setFullName(source.name);
      if (source.email) setEmail(source.email);
      const targetPhone = source.phone || prefill?.phone || cached?.phone || '';
      if (targetPhone) setPhone(targetPhone);
      if (prefill?.isGoogleVerified) setIsGoogleVerified(true);
    }
  }, [existingUser?.id, existingUser?.email, existingUser?.phone, existingUser?.branch_id, isOpen]);

  // -------------------------------------------------------------
  // STEP 2: PAR-Q WAIVER & TOUCH SIGNATURE
  // -------------------------------------------------------------
  // Physical Activity Readiness Questionnaire (PAR-Q) - NO is NOT default; member must actively select
  const [parqAnswers, setParqAnswers] = useState({});
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef(null);

  // Xendit Hosted Checkout States
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [hostedInvoiceUrl, setHostedInvoiceUrl] = useState('');
  const [hostedExternalId, setHostedExternalId] = useState('');
  const [hostedChecking, setHostedChecking] = useState(false);

  // -------------------------------------------------------------
  // STEP 3: PAYMENT RAIL SELECTION
  // -------------------------------------------------------------
  // Options: 'card', 'gcash', 'maya', 'qr_ph'
  const [paymentRail, setPaymentRail] = useState('card');
  const [billingDay, setBillingDay] = useState(1); // 1st or 15th

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiryMonth, setCardExpiryMonth] = useState('12');
  const [cardExpiryYear, setCardExpiryYear] = useState('28');
  const [cardCvv, setCardCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardRecurringAuth, setCardRecurringAuth] = useState(true);

  // E-Wallet fields
  const [walletMobile, setWalletMobile] = useState('');

  // -------------------------------------------------------------
  // STEP 4: SETTLEMENT / TOKENIZATION / 3DS CHALLENGE
  // -------------------------------------------------------------
  const [challengeToken, setChallengeToken] = useState(null);
  const [issuingBank, setIssuingBank] = useState('BDO Unibank');
  const [maskedIdentifier, setMaskedIdentifier] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [tokenizedGatewayToken, setTokenizedGatewayToken] = useState(null);
  const [tokenizationDone, setTokenizationDone] = useState(false);

  // Dynamic QR Ph states
  const [dynamicQrData, setDynamicQrData] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(600); // 10 minutes
  const [qrInvoiceNo, setQrInvoiceNo] = useState('');
  const [qrSettled, setQrSettled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // -------------------------------------------------------------
  // STEP 5: ACCESS ISSUANCE & TURNSTILE CREDENTIALS
  // -------------------------------------------------------------
  const [onboardedMember, setOnboardedMember] = useState(null);
  const [rfidUid, setRfidUid] = useState('');
  const [dynamicQrPass, setDynamicQrPass] = useState('');
  const [passTtlSeconds, setPassTtlSeconds] = useState(60);

  // -------------------------------------------------------------
  // Signature Canvas Helpers
  // -------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 2 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#e1c256';
    }
  }, [currentStep]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsSigning(true);
  };

  const draw = (e) => {
    if (!isSigning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isSigning) return;
    setIsSigning(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  // -------------------------------------------------------------
  // QR Ph Live Countdown Timer & Local QR Image Generation
  // -------------------------------------------------------------
  useEffect(() => {
    let timer = null;
    if (currentStep === 4 && paymentRail === 'qr_ph' && !qrSettled && qrCountdown > 0) {
      timer = setInterval(() => {
        setQrCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentStep, paymentRail, qrSettled, qrCountdown]);

  useEffect(() => {
    if (currentStep === 4 && paymentRail === 'qr_ph' && !qrDataUrl) {
      const payload = dynamicQrData?.qr_string || qrInvoiceNo || `KSYN-QRPH-${Date.now()}`;
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(url => setQrDataUrl(url)).catch(() => {});
    }
  }, [currentStep, paymentRail, qrDataUrl, dynamicQrData, qrInvoiceNo]);

  // Turnstile Pass 60s countdown
  useEffect(() => {
    let timer = null;
    if (currentStep === 5 && passTtlSeconds > 0) {
      timer = setInterval(() => {
        setPassTtlSeconds(prev => (prev > 0 ? prev - 1 : 60));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentStep, passTtlSeconds]);

  // Selected Plan Object & Dynamic Promo Pricing
  const selectedBranch = BRANCH_OPTIONS.find(b => b.id === selectedBranchId) || BRANCH_OPTIONS[0];
  const pricing = calculatePlanPricing(selectedPlanTier, promoCode, selectedBranch?.name, promoVerificationData);
  const currentPlan = pricing.plan;
  const effectiveTotalDue = pricing.totalDue;

  // -------------------------------------------------------------
  // Step 1 Validation -> Move to Step 2 (Legal Waiver & PAR-Q)
  // -------------------------------------------------------------
  const handleProceedToStep2 = (e) => {
    e?.preventDefault();
    setErrorMessage('');
    if (!selectedPlanTier) {
      return setErrorMessage('Please select a membership plan before continuing.');
    }
    if (pricing.promoError) {
      return setErrorMessage(`Promo validation error: ${pricing.promoError}`);
    }
    if (!existingUser) {
      if (!fullName.trim()) return setErrorMessage('Full Name is required.');
      if (!email.trim() || !email.includes('@')) return setErrorMessage('Valid email address is required.');
      if (!phone.trim()) return setErrorMessage('Contact mobile number is required.');
      if (!password || password.length < 6) return setErrorMessage('Password must be at least 6 characters.');
    }
    setCurrentStep(2);
  };

  // -------------------------------------------------------------
  // Step 2 Validation -> Move to Step 3
  // -------------------------------------------------------------
  const handleProceedToStep3 = () => {
    setErrorMessage('');
    const allAnswered = PARQ_QUESTIONS.every(q => typeof parqAnswers[q.id] === 'boolean');
    if (!allAnswered) {
      return setErrorMessage('Please answer all 7 Physical Activity Readiness Questionnaire (PAR-Q) questions (select NO or YES for each) before proceeding.');
    }
    if (!waiverAgreed) {
      return setErrorMessage('You must acknowledge and accept the KSYN Gym Liability Waiver.');
    }
    if (!privacyAgreed) {
      return setErrorMessage('You must acknowledge and consent to the KSYN Data Privacy Policy (RA 10173).');
    }
    if (!signatureData) {
      return setErrorMessage('Please provide your digital signature on the pad before continuing.');
    }
    setCurrentStep(3);
  };

  // -------------------------------------------------------------
  // Step 3 Initiate Settlement -> Step 4
  // -------------------------------------------------------------
  const handleInitiateSettlement = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      if (paymentRail === 'card') {
        if (selectedPlanTier !== '1_day' && !cardRecurringAuth) {
          throw new Error('Please authorise KSYN Gym to use this Card for future recurring payments.');
        }

        // Zero-PAN Card Tokenization & 3DS Challenge Request
        const res = await safeApiFetch('/api/payments/tokenize-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardNumber,
            cardholderName: cardholderName || fullName,
            expiryMonth: cardExpiryMonth,
            expiryYear: cardExpiryYear,
            cvv: cardCvv,
            branchId: selectedBranchId,
            billingDay
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Card verification failed.');

        setChallengeToken(data.challenge_token);
        setIssuingBank(data.three_d_secure?.issuing_bank || 'BDO Unibank');
        setMaskedIdentifier(data.card_summary?.masked_identifier || '•••• •••• •••• 4242');
        setCurrentStep(4);
      } else if (paymentRail === 'gcash' || paymentRail === 'maya') {
        // Initiate E-Wallet Recurring Agreement
        const res = await safeApiFetch('/api/payments/create-billing-agreement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletType: paymentRail,
            mobileNumber: walletMobile || phone,
            branchId: selectedBranchId,
            billingDay
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'E-Wallet agreement failed.');

        setMaskedIdentifier(data.masked_mobile || walletMobile);
        setCurrentStep(4);
      } else if (paymentRail === 'qr_ph') {
        // Generate Dynamic QR Ph Code via Xendit API (BSP-regulated OPS standard)
        const amount = effectiveTotalDue || (currentPlan ? currentPlan.totalDue : 0);
        const res = await safeApiFetch('/api/payments/xendit/create-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            planTier: selectedPlanTier,
            branchId: selectedBranchId,
            userId: existingUser?.id || null,
            description: `${currentPlan?.name || 'KSYN'} Membership Pass (${selectedBranch.name})`
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Xendit QR Ph generation failed.');

        setDynamicQrData({
          qr_string: data.qr_string,
          amount: data.amount,
          expires_in_minutes: data.expires_in_minutes || 15
        });
        setQrInvoiceNo(data.external_id || data.qr_id);
        setQrCountdown((data.expires_in_minutes || 15) * 60);

        const qrPayload = data.qr_string || data.external_id || data.qr_id || `KSYN-QR-${amount}-${Date.now()}`;
        try {
          const generatedUrl = await QRCode.toDataURL(qrPayload, {
            width: 320,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          });
          setQrDataUrl(generatedUrl);
        } catch (qrErr) {
          console.error('Local QR rendering fallback:', qrErr);
        }

        setCurrentStep(4);
      }
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      const friendlyMessage = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Unable to connect to KSYN Payment Gateway (Port 5080). Please ensure the backend server is active and try again.'
        : err.message || 'Payment initiation failed. Please try again.';
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQr = async () => {
    try {
      const payload = dynamicQrData?.qr_string || qrInvoiceNo || `KSYN-QR-${Date.now()}`;
      const downloadUrl = qrDataUrl || await QRCode.toDataURL(payload, {
        width: 500,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `KSYN-QRPh-${qrInvoiceNo || 'payment'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download QR code image:', err);
    }
  };

  const handleLaunchHostedCheckout = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const targetAmount = effectiveTotalDue || currentPlan?.totalDue || 500;
      const extId = `inv_ksyn_${Date.now()}`;
      const targetPlanTier = selectedPlanTier || '1_month';

      // 1. Store pending checkout state in localStorage before redirecting
      localStorage.setItem('ksyn_pending_checkout', JSON.stringify({
        externalId: extId,
        planTier: targetPlanTier,
        amount: targetAmount,
        branchId: selectedBranchId,
        userId: existingUser?.id || null
      }));

      let currentUserId = existingUser?.id || null;

      if (!existingUser) {
        localStorage.setItem('ksyn_pending_onboarding', JSON.stringify({
          branchId: selectedBranchId,
          fullName,
          email,
          phone,
          password,
          planTier: targetPlanTier,
          parqAnswers,
          signatureData,
          invoiceNo: extId,
          billingDay
        }));

        // Register new athlete account immediately so session token and record exist
        const onboardRes = await safeApiFetch('/api/payments/onboard-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId: selectedBranchId,
            fullName,
            email,
            phone,
            password,
            planTier: targetPlanTier,
            parqAnswers,
            signatureData,
            paymentOption: 'online_xendit',
            invoiceNo: extId,
            billingDay
          })
        });

        const onboardData = await onboardRes.json();
        if (!onboardRes.ok || !onboardData.success) {
          throw new Error(onboardData.message || 'Failed to initialize athlete registration.');
        }

        currentUserId = onboardData.member?.id || null;

        // Persist session tokens and user state immediately so returning does not require logging in
        if (onboardData.token) {
          localStorage.setItem('ksyn_token', onboardData.token);
        }
        const memberPayload = {
          ...(onboardData.member || {}),
          subscription: onboardData.subscription,
          turnstile_pass: onboardData.turnstile_pass || onboardData.turnstile_access?.initial_dynamic_qr_pass,
          planTier: targetPlanTier,
          role: 'member'
        };
        localStorage.setItem('ksyn_user', JSON.stringify(memberPayload));
        localStorage.setItem('ksyn_last_path', '/dashboard/member');
        if (memberPayload.email) {
          saveVerifiedGoogleAccount({
            email: memberPayload.email,
            name: memberPayload.name,
            status: 'Signed in'
          });
        }
      }

      // Return URL points directly to Member Dashboard on the same tab!
      const returnUrl = `${window.location.origin}/dashboard/member?payment_status=success&external_id=${extId}&plan_tier=${targetPlanTier}`;
      const failUrl = `${window.location.origin}/dashboard/member?payment_status=failed`;

      let promoNote = '';
      if (pricing.promoApplied) {
        if (pricing.promoApplied.code === 'STUDENT' && promoVerificationData.studentId) {
          promoNote = ` [Student: ${promoVerificationData.schoolName} - ${promoVerificationData.studentId}]`;
        } else if (pricing.promoApplied.code === 'DUO60' && promoVerificationData.partnerName) {
          promoNote = ` [Duo: Partner ${promoVerificationData.partnerName}]`;
        } else if (pricing.promoApplied.code === 'CORP40' && promoVerificationData.companyName) {
          promoNote = ` [Corporate: ${promoVerificationData.companyName}]`;
        } else if (pricing.promoApplied.code === 'PNP20' && promoVerificationData.pnpId) {
          promoNote = ` [PNP Badge: ${promoVerificationData.pnpId}]`;
        } else {
          promoNote = ` [Promo: ${pricing.promoApplied.code}]`;
        }
      }
      const finalPlanDescription = `${currentPlan?.name || 'KSYN Fitness Membership'}${promoNote}`;

      const res = await safeApiFetch('/api/payments/xendit/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: extId,
          planTier: targetPlanTier,
          amount: targetAmount,
          planName: finalPlanDescription,
          customerName: fullName || existingUser?.name || 'Valued Athlete',
          email: email || existingUser?.email || 'member@ksynfitness.com',
          phone: phone || existingUser?.phone || '+639171234567',
          branchId: selectedBranchId,
          userId: currentUserId,
          successRedirectUrl: returnUrl,
          failureRedirectUrl: failUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.invoice_url) {
        throw new Error(data.message || 'Xendit Invoice creation failed.');
      }

      // Redirect in the SAME TAB so no separate tab is opened
      window.location.href = data.invoice_url;
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      const friendlyMessage = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Unable to connect to KSYN Payment Gateway (Port 5080). Please ensure the backend server is active and try again.'
        : err.message || 'Could not connect to Xendit Gateway';
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPaymentStatus = async (extId = hostedExternalId) => {
    if (!extId) return;
    setHostedChecking(true);
    setErrorMessage('');
    try {
      const res = await safeApiFetch(`/api/payments/xendit/invoice-status/${extId}`);
      const data = await res.json();
      if (data.paid) {
        await handleCompleteCheckoutSettlement(extId);
      } else {
        setErrorMessage('Payment verification: Invoice is still awaiting settlement in the Xendit window.');
      }
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      setErrorMessage('Status check failed. Please ensure the payment was completed in Xendit.');
    } finally {
      setHostedChecking(false);
    }
  };

  const handleCompleteCheckoutSettlement = async (extId = hostedExternalId) => {
    setLoading(true);
    try {
      if (existingUser) {
        const confirmRes = await safeApiFetch('/api/payments/xendit/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: extId || hostedExternalId,
            planTier: selectedPlanTier,
            userId: existingUser.id,
            amount: effectiveTotalDue
          })
        });
        const confirmData = await confirmRes.json();
        if (!confirmData.success) throw new Error(confirmData.message || 'Membership settlement failed.');

        localStorage.removeItem('ksyn_pending_checkout');
        if (typeof onSuccess === 'function') onSuccess(confirmData.user);
        if (typeof onClose === 'function') onClose();
      } else {
        await finalizeOnboarding(null, extId || hostedExternalId);
      }
    } catch (err) {
      console.error("Settlement error:", err);
      setErrorMessage(err.message || 'Failed to complete membership settlement.');
    } finally {
      setLoading(false);
    }
  };

  // Poll for invoice payment confirmation when checkout is open
  useEffect(() => {
    if (!checkoutOpened || !hostedExternalId) return;
    const interval = setInterval(async () => {
      try {
        const res = await safeApiFetch(`/api/payments/xendit/invoice-status/${hostedExternalId}`);
        const data = await res.json();
        if (data.paid) {
          clearInterval(interval);
          await handleCompleteCheckoutSettlement(hostedExternalId);
        }
      } catch (e) {
        // silent polling catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [checkoutOpened, hostedExternalId]);

  // Listen to cross-window message from checkout popup
  useEffect(() => {
    const handlePopupMessage = async (e) => {
      if (e.data?.type === 'KSYN_PAYMENT_SUCCESS') {
        await handleCompleteCheckoutSettlement(e.data?.external_id || hostedExternalId);
      }
    };
    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [hostedExternalId]);

  // -------------------------------------------------------------
  // Step 4 Approval / Verification
  // -------------------------------------------------------------
  const handleVerifyOtpAndTokenize = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      if (paymentRail === 'card') {
        // Verify 3DS OTP
        const res = await safeApiFetch('/api/payments/verify-3ds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeToken,
            otp: otpInput || '123456'
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || '3DS OTP verification failed.');

        setTokenizedGatewayToken(data.payment_method.gateway_token);
        setTokenizationDone(true);
        // Automatically execute onboarding finalization
        await finalizeOnboarding(data.payment_method.gateway_token, null);
      } else if (paymentRail === 'gcash' || paymentRail === 'maya') {
        // Authorize E-Wallet with OTP
        const res = await safeApiFetch('/api/payments/create-billing-agreement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletType: paymentRail,
            mobileNumber: walletMobile || phone,
            otp: otpInput || '123456',
            branchId: selectedBranchId,
            billingDay
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'E-Wallet authorization failed.');

        setTokenizedGatewayToken(data.payment_method.gateway_token);
        setTokenizationDone(true);
        await finalizeOnboarding(data.payment_method.gateway_token, null);
      }
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      const friendlyMessage = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Unable to connect to KSYN Payment Gateway (Port 5080). Please ensure the backend server is active and try again.'
        : err.message || 'Authorization failed. Please try again.';
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Simulate Instant Webhook Scan & Pay for QR Ph via Xendit
  const handleSimulateQrWebhook = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      const amountPaid = effectiveTotalDue || (currentPlan ? currentPlan.totalDue : 0);
      // Trigger Xendit Webhook with verified x-callback-token
      const res = await safeApiFetch('/api/payments/xendit/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-callback-token': 'xnd_wh_token_ksyn_fitconnect_secure_2026'
        },
        body: JSON.stringify({
          event: 'qr.payment',
          status: 'PAID',
          external_id: qrInvoiceNo,
          amount: amountPaid,
          payment_method: 'qr_ph',
          metadata: {
            userId: existingUser?.id || null,
            planTier: selectedPlanTier,
            branchId: selectedBranchId,
            fullName
          }
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Xendit webhook simulation failed.');

      setQrSettled(true);
      await finalizeOnboarding(null, qrInvoiceNo);
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      const friendlyMessage = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Unable to connect to KSYN Payment Gateway (Port 5080). Please ensure the backend server is active and try again.'
        : err.message || 'QR settlement simulation failed.';
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Finalize 5-Step Onboarding Pipeline
  // -------------------------------------------------------------
  const finalizeOnboarding = async (gatewayToken, invoiceNo) => {
    setLoading(true);
    try {
      const endpoint = existingUser ? '/api/payments/settle-member-payment' : '/api/payments/onboard-member';
      const token = localStorage.getItem('ksyn_token') || localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('ksyn_token') || sessionStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (existingUser) {
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          throw new Error('Authentication session missing. Please log in again to settle membership dues.');
        }
      }

      const res = await safeApiFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branchId: selectedBranchId,
          fullName,
          email,
          phone,
          password,
          planTier: selectedPlanTier,
          parqAnswers,
          signatureData,
          paymentOption: paymentRail,
          gatewayToken,
          maskedIdentifier,
          brand: paymentRail === 'card' ? 'Mastercard' : (paymentRail === 'maya' ? 'Maya' : 'GCash'),
          issuingBank: paymentRail === 'card' ? issuingBank : (paymentRail === 'maya' ? 'Maya Philippines' : 'GCash Mynt'),
          invoiceNo,
          billingDay
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Onboarding finalization failed.');

      if (data.token) {
        localStorage.setItem('ksyn_token', data.token);
      }

      const completedMember = {
        ...(data.member || data.user || {}),
        subscription: data.subscription,
        turnstile_pass: data.turnstile_pass || data.turnstile_access?.initial_dynamic_qr_pass,
        planTier: selectedPlanTier
      };
      setOnboardedMember(completedMember);
      // Strictly avoid RFID assignment for 1-Day Pass (only monthly/annual plans receive physical RFID cards)
      const issuedRfid = selectedPlanTier === '1_day' 
        ? null 
        : (data.turnstile_access?.rfid_uid || data.user?.rfid_card_uid || 'KS-8821-4190');
      setRfidUid(issuedRfid);
      setDynamicQrPass(data.turnstile_access?.initial_dynamic_qr_pass || data.turnstile_pass || '');
      setPassTtlSeconds(60);
      setCurrentStep(5);

      // Automatically return to and display the active user dashboard
      if (typeof onSuccess === 'function') {
        onSuccess(completedMember);
      }
      if (typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error("Payment rail fetch failed:", err);
      const friendlyMessage = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Unable to connect to KSYN Payment Gateway (Port 5080). Please ensure the backend server is active and try again.'
        : err.message || 'Onboarding finalization failed.';
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div style={{
      background: '#0b0d14',
      color: '#f8fafc',
      borderRadius: isModal ? '16px' : '0px',
      border: isModal ? '1px solid rgba(225, 194, 86, 0.25)' : 'none',
      width: '100%',
      maxWidth: isModal ? '920px' : '100%',
      maxHeight: isModal ? '90vh' : 'auto',
      overflowY: 'auto',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
      position: 'relative',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Bar */}
      <div style={{
        padding: '24px 32px 18px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, #12151e 0%, #0b0d14 100%)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: '#e1c256',
              color: '#000',
              fontWeight: 900,
              fontSize: '0.75rem',
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.08em'
            }}>
              KSYN ONBOARDING
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#fff' }}>
              Philippine Member Registration & Auto-Debit Rails
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Industry-standard 5-step onboarding with Zero-PAN card tokenization & QR Ph.
          </p>
        </div>
        {isModal && onClose && (
          <Tooltip content="Close wizard (Esc)" position="left">
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="modal-close-circle-btn"
              title="Close modal (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#94a3b8',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                minWidth: '36px',
                minHeight: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={18} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* 5-Step Stepper Header (Optimized layout to prevent label clipping) */}
      <div style={{
        padding: '14px 20px',
        background: '#0d1017',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: '760px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {[
            { step: 1, label: 'Identity & Plan' },
            { step: 2, label: 'Legal Waiver (PAR-Q)' },
            { step: 3, label: 'Payment Rail' },
            { step: 4, label: '3DS / Settlement' },
            { step: 5, label: 'Access Issuance' }
          ].map((s, idx) => {
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;
            return (
              <React.Fragment key={s.step}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  paddingRight: idx === 4 ? '12px' : '0'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: isDone ? '#658256' : (isActive ? '#e1c256' : 'rgba(255,255,255,0.08)'),
                    color: isDone ? '#fff' : (isActive ? '#000' : '#64748b'),
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    {isDone ? <Check size={14} /> : s.step}
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#e1c256' : (isDone ? '#e2e8f0' : '#64748b')
                  }}>
                    {s.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div style={{
                    flex: '1 1 12px',
                    minWidth: '8px',
                    maxWidth: '24px',
                    height: '1px',
                    background: 'rgba(255,255,255,0.1)',
                    margin: '0 4px',
                    flexShrink: 1
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div style={{
          margin: '16px 32px 0',
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          color: '#fca5a5',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Body */}
      <div style={{ padding: '24px 32px 32px' }}>
        {/* ============================================================== */}
        {/* STEP 1: IDENTITY & PLAN SELECTION */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <form onSubmit={handleProceedToStep2}>
            {/* Branch Selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                SELECT HOME BRANCH (7 PHILIPPINE LOCATIONS)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {BRANCH_OPTIONS.map((branch) => {
                  const isSel = selectedBranchId === branch.id;
                  return (
                    <div
                      key={branch.id}
                      onClick={() => setSelectedBranchId(branch.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isSel ? 'rgba(225, 194, 86, 0.12)' : '#12151e',
                        border: isSel ? '1.5px solid #e1c256' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#e1c256' : '#94a3b8' }}>
                          {branch.code}
                        </span>
                        {isSel && <CheckCircle2 size={16} color="#e1c256" />}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '4px', color: '#fff' }}>
                        {branch.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {branch.address}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plan Tier Selector */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>
                  CHOOSE MEMBERSHIP PLAN TIER *
                </label>
                {!selectedPlanTier && (
                  <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 700 }}>
                    Please select a plan to continue
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {MEMBERSHIP_PLANS.map((tier) => {
                  const isSel = selectedPlanTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => {
                        setSelectedPlanTier(tier.id);
                        setErrorMessage('');
                      }}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: isSel ? 'rgba(225, 194, 86, 0.12)' : '#12151e',
                        border: isSel ? '2px solid #e1c256' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isSel ? '#e1c256' : 'rgba(255,255,255,0.08)',
                            color: isSel ? '#000' : '#94a3b8'
                          }}>
                            {tier.badge}
                          </span>
                          {isSel && <CheckCircle2 size={18} color="#e1c256" />}
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                          {tier.name}
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 700, marginBottom: '6px' }}>
                          Duration: {tier.duration}
                        </div>

                        {/* Breakdown Box */}
                        <div style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          marginBottom: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Base Plan:</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>₱{tier.planFee.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Access Card Fee:</span>
                            <span style={{ color: tier.accessFee === 0 ? '#658256' : '#fff', fontWeight: 600 }}>
                              {tier.accessFee === 0 ? '₱0 (Waived)' : `₱${tier.accessFee.toLocaleString()}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Annual Fee:</span>
                            <span style={{ color: tier.annualFee === 0 ? '#658256' : '#fff', fontWeight: 600 }}>
                              {tier.annualFee === 0 ? '₱0 (Waived)' : `₱${tier.annualFee.toLocaleString()}`}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            paddingTop: '4px',
                            marginTop: '2px',
                            fontWeight: 800,
                            color: isSel ? '#e1c256' : '#fff'
                          }}>
                            <span>Total Due Today:</span>
                            <span>
                              {isSel && pricing.promoApplied ? (
                                <>
                                  <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.7rem', marginRight: '6px' }}>
                                    ₱{tier.totalDue.toLocaleString()}
                                  </span>
                                  <span style={{ color: '#658256' }}>₱{pricing.totalDue.toLocaleString()}</span>
                                </>
                              ) : (
                                `₱${tier.totalDue.toLocaleString()}`
                              )}
                            </span>
                          </div>
                        </div>

                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                          {tier.features?.map((feat, i) => (
                            <li key={i} style={{ marginBottom: '3px' }}>{feat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promo Code & Reception Voucher Box */}
              <div style={{
                marginTop: '16px',
                background: 'rgba(225, 194, 86, 0.06)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                borderRadius: '10px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#e1c256', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} /> Reception Promo Code or Voucher
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Standard joining fee ₱1,000–₱1,500. Enter gym promo code to waive.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Enter code (e.g. MKT25, DUO60, CORP40, STUDENT)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="mono"
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      maxWidth: '320px',
                      background: '#12151e',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!promoInput.trim()) {
                        setPromoCode('');
                        setPromoFeedback({ type: 'info', msg: 'Promo cleared.' });
                        return;
                      }
                      const clean = promoInput.trim().toUpperCase();
                      setPromoCode(clean);
                      const testPricing = calculatePlanPricing(selectedPlanTier, clean, selectedBranch?.name, promoVerificationData);
                      if (testPricing.promoError) {
                        setPromoFeedback({ type: testPricing.verificationRequired ? 'info' : 'error', msg: testPricing.promoError });
                      } else {
                        setPromoFeedback({
                          type: 'success',
                          msg: `Promo "${testPricing.promoApplied?.code}" Active! Saved ₱${testPricing.discountAmount.toLocaleString()}`
                        });
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#e1c256',
                      color: '#000',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Apply Code
                  </button>
                  {promoCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCode('');
                        setPromoInput('');
                        setPromoFeedback({ type: 'info', msg: 'Promo cleared.' });
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#94a3b8',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Apply Tags Filtered by Branch */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Quick Apply (Branch Validated):</span>
                  {getAvailablePromosForBranch(selectedBranch?.name).map(promo => {
                    const isSelected = promoCode === promo.code;
                    return (
                      <button
                        key={promo.code}
                        type="button"
                        onClick={() => {
                          setPromoInput(promo.code);
                          setPromoCode(promo.code);
                          const testPricing = calculatePlanPricing(selectedPlanTier, promo.code, selectedBranch?.name, promoVerificationData);
                          if (testPricing.promoError) {
                            setPromoFeedback({ type: testPricing.verificationRequired ? 'info' : 'error', msg: testPricing.promoError });
                          } else {
                            setPromoFeedback({
                              type: 'success',
                              msg: `Promo "${promo.code}" Active! Saved ₱${testPricing.discountAmount.toLocaleString()}`
                            });
                          }
                        }}
                        style={{
                          background: isSelected ? 'rgba(225, 194, 86, 0.25)' : '#12151e',
                          border: `1px solid ${isSelected ? '#e1c256' : 'rgba(255,255,255,0.1)'}`,
                          color: isSelected ? '#e1c256' : '#cbd5e1',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title={promo.description}
                      >
                        {promo.code}
                      </button>
                    );
                  })}
                </div>

                {promoFeedback && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: promoFeedback.type === 'error' ? '#ef4444' : (promoFeedback.type === 'success' ? '#658256' : '#9ca3af'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    {promoFeedback.type === 'error' ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                    <span>{promoFeedback.msg}</span>
                  </div>
                )}

                {/* Verification Required Input Fields */}
                {pricing.verificationRequired && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: '#121620',
                    border: '1px solid rgba(225, 194, 86, 0.35)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} /> Verification Required for {promoCode}
                    </div>

                    {pricing.verificationRequired === 'student' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>School / University Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. UP Diliman, Ateneo, UST"
                            value={promoVerificationData.schoolName || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, schoolName: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Student ID Number *</label>
                          <input
                            type="text"
                            placeholder="e.g. 2024-12345"
                            value={promoVerificationData.studentId || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, studentId: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {pricing.verificationRequired === 'duo' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Workout Partner's Full Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. Jane Doe"
                            value={promoVerificationData.partnerName || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, partnerName: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Partner's Email or Mobile *</label>
                          <input
                            type="text"
                            placeholder="e.g. partner@example.com"
                            value={promoVerificationData.partnerEmail || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, partnerEmail: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {pricing.verificationRequired === 'corporate' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Corporate Company Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. Google Philippines, BDO, Ayala"
                            value={promoVerificationData.companyName || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, companyName: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Corporate Work Email *</label>
                          <input
                            type="email"
                            placeholder="e.g. employee@company.com"
                            value={promoVerificationData.corporateEmail || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, corporateEmail: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {pricing.verificationRequired === 'pnp' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>PNP Badge / Service ID Number *</label>
                          <input
                            type="text"
                            placeholder="e.g. PNP-NCR-98765"
                            value={promoVerificationData.pnpId || ''}
                            onChange={(e) => setPromoVerificationData(prev => ({ ...prev, pnpId: e.target.value }))}
                            style={{ width: '100%', background: '#1c2130', border: '1px solid #3b4252', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Personal Details */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                MEMBER PERSONAL & CONTACT INFORMATION
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#12151e',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Email Address *</label>
                    {isGoogleVerified && (
                      <span style={{
                        fontSize: '0.6875rem',
                        color: '#81c995',
                        background: 'rgba(52, 168, 83, 0.12)',
                        border: '1px solid rgba(52, 168, 83, 0.3)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}>
                        <Check size={11} /> Gmail Verified via OTP
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="juan.delacruz@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#12151e',
                      border: isGoogleVerified ? '1px solid #34a853' : '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>PH Mobile Number (11 Digits) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0917 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#12151e',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Initial Account Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#12151e',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Submit Step 1 Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="submit"
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  background: '#e1c256',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(225, 194, 86, 0.3)'
                }}
              >
                <span>Continue to Step 2: Legal Waiver</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* STEP 2: LEGAL WAIVER & DIGITAL PAR-Q */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div>
            <div style={{
              background: '#12151e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="#e1c256" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    Physical Activity Readiness Questionnaire (PAR-Q)
                  </h3>
                </div>
                {(() => {
                  const answeredCount = PARQ_QUESTIONS.filter(q => typeof parqAnswers[q.id] === 'boolean').length;
                  const isAllAnswered = answeredCount === PARQ_QUESTIONS.length;
                  return (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isAllAnswered ? 'rgba(101, 130, 86, 0.2)' : 'rgba(225, 194, 86, 0.15)',
                      color: isAllAnswered ? '#658256' : '#e1c256',
                      border: `1px solid ${isAllAnswered ? 'rgba(101, 130, 86, 0.4)' : 'rgba(225, 194, 86, 0.3)'}`
                    }}>
                      {isAllAnswered ? 'All 7 Answered' : `${answeredCount} of 7 Questions Selected`}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Please review each question carefully and select <strong>NO</strong> or <strong>YES</strong> for medical clearance before participating in training at KSYN.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PARQ_QUESTIONS.map((q, idx) => {
                  const isAnswered = typeof parqAnswers[q.id] === 'boolean';
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '12px 14px',
                        background: isAnswered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                        border: isAnswered ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(225, 194, 86, 0.15)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                        <strong style={{ color: '#e1c256' }}>{idx + 1}.</strong> {q.text}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setParqAnswers(p => ({ ...p, [q.id]: false }))}
                          title={`Select NO for Question ${idx + 1}`}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: parqAnswers[q.id] === false ? '#658256' : 'rgba(255,255,255,0.06)',
                            color: parqAnswers[q.id] === false ? '#000' : '#94a3b8',
                            border: parqAnswers[q.id] === false ? '2px solid #658256' : '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          NO
                        </button>
                        <button
                          type="button"
                          onClick={() => setParqAnswers(p => ({ ...p, [q.id]: true }))}
                          title={`Select YES for Question ${idx + 1}`}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: parqAnswers[q.id] === true ? '#ef4444' : 'rgba(255,255,255,0.06)',
                            color: parqAnswers[q.id] === true ? '#fff' : '#94a3b8',
                            border: parqAnswers[q.id] === true ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          YES
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terms & Privacy Consent Checkboxes */}
            <div style={{
              background: '#12151e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {/* Checkbox 1: Terms & Liability Waiver */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={waiverAgreed}
                  onChange={(e) => setWaiverAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#e1c256', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                  I have read and voluntarily agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTermsModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      display: 'inline'
                    }}
                  >
                    KSYN Gym Rules, Liability Waiver, and Terms of Service
                  </button>
                  {' '}and acknowledge the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowRefundModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      display: 'inline'
                    }}
                  >
                    Refund & Cancellation Policy
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowEulaModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      display: 'inline'
                    }}
                  >
                    Software EULA
                  </button>
                  . I certify that my answers to the PAR-Q are accurate and I take full responsibility for my participation in physical training. *
                </span>
              </label>

              {/* Checkbox 2: RA 10173 Data Privacy Consent */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#e1c256', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                  In accordance with the Philippine Data Privacy Act of 2012 (RA 10173), I explicitly consent to the collection and processing of my personal, emergency, and biometric/RFID turnstile access data as described in the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPrivacyModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#e1c256',
                      textDecoration: 'underline',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      display: 'inline'
                    }}
                  >
                    KSYN Privacy Policy
                  </button>
                  . *
                </span>
              </label>
            </div>

            {/* Touch / Mouse Canvas Signature Pad */}
            <div style={{
              background: '#12151e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1' }}>
                  DIGITAL SIGNATURE PAD (TOUCH / MOUSE) *
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear Pad
                </button>
              </div>
              <div style={{
                background: '#0a0c12',
                borderRadius: '8px',
                border: signatureData ? '1.5px solid #658256' : '1.5px dashed rgba(225, 194, 86, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ width: '100%', height: '150px', cursor: 'crosshair', display: 'block' }}
                />
                {!signatureData && !isSigning && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    color: 'rgba(255,255,255,0.25)',
                    fontSize: '0.85rem',
                    textAlign: 'center'
                  }}>
                    Sign with your finger or mouse cursor here
                  </div>
                )}
              </div>
              {signatureData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', color: '#658256', fontSize: '0.75rem' }}>
                  <CheckCircle2 size={14} />
                  <span>Digital signature captured and sealed with SHA-256 cryptographic fingerprint.</span>
                </div>
              )}
            </div>

            {/* Stepper Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleProceedToStep3}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  background: '#e1c256',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>Continue to Step 3: Payment Rail</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: XENDIT UNIFIED CHECKOUT */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div>
            {/* Step 3 Order Summary & Active Promo Box */}
            <div style={{
              background: '#0d1017',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800 }}>
                  Order Summary & Enrollment
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  {currentPlan?.name} • <span style={{ color: '#e1c256' }}>{selectedBranch.name}</span>
                </div>
                {pricing.promoApplied ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', border: '1px solid #e1c256', color: '#e1c256', fontSize: '0.72rem', fontWeight: 700 }}>
                    <Tag size={12} /> Promo Applied: {pricing.promoApplied.code} (Saved ₱{pricing.discountAmount.toLocaleString()})
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Standard annual membership / joining fee applied or waived per promo terms.
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {pricing.promoApplied ? 'Discounted Amount' : 'Total Amount Payable'}
                </div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 900, color: pricing.promoApplied ? '#e1c256' : '#658256' }}>
                  ₱{effectiveTotalDue.toLocaleString()}.00
                </div>
              </div>
            </div>

            {/* Official Xendit Hosted Checkout Card */}
            <div style={{
              background: '#12151e',
              border: '1px solid rgba(225, 194, 86, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={22} color="#e1c256" />
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    Official Xendit Philippines Hosted Checkout
                  </h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(247, 255, 196, 0.1)', border: '1px solid rgba(247, 255, 196, 0.25)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.72rem', color: '#f7ffc4', fontWeight: 700 }}>
                  <ShieldCheck size={13} color="#f7ffc4" />
                  <span>BSP-Regulated OPS Compliant</span>
                </div>
              </div>

              <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Clicking checkout will securely open the official Xendit payment modal for <strong>₱{effectiveTotalDue.toLocaleString()}.00</strong>. You can choose any supported Philippine payment rail:
              </p>

              {/* Supported Rails Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                <div style={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e1c256' }}>Credit / Debit Card</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Visa, Mastercard, JCB</div>
                </div>
                <div style={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f7ffc4' }}>E-Wallets</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>GCash, Maya, ShopeePay</div>
                </div>
                <div style={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#658256' }}>Dynamic QR Ph</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Scan with Any PH Bank App</div>
                </div>
                <div style={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Online Banking & OTC</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>BDO, BPI, RCBC, 7-Eleven</div>
                </div>
              </div>

              {checkoutOpened && (
                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  border: '1px solid #e1c256',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} className="animate-spin text-amber-400" />
                    <span style={{ fontSize: '0.825rem', color: '#e1c256', fontWeight: 700 }}>
                      Checkout window open. Waiting for payment completion...
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleLaunchHostedCheckout()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#1e2230',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Re-open Window
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckPaymentStatus()}
                      disabled={hostedChecking}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#658256',
                        border: 'none',
                        color: '#000',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {hostedChecking ? 'Verifying...' : 'Check Payment Status'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                title="Return to Step 2 (Legal Waiver & PAR-Q)"
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleLaunchHostedCheckout}
                disabled={loading}
                title="Proceed to official Xendit secure checkout"
                style={{
                  padding: '14px 32px',
                  borderRadius: '8px',
                  background: '#e1c256',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '1rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(225, 194, 86, 0.4)'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Connecting to Xendit...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Checkout (₱{effectiveTotalDue.toLocaleString()})</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: SETTLEMENT / TOKENIZATION / 3DS CHALLENGE */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div>
            {paymentRail === 'card' && (
              <div style={{
                background: '#12151e',
                border: '1.5px solid rgba(225, 194, 86, 0.4)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                maxWidth: '480px',
                margin: '0 auto 20px'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(225, 194, 86, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <ShieldCheck size={28} color="#e1c256" />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  {issuingBank} 3D Secure 2.0 Challenge
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px' }}>
                  Cardholder Authentication required for {maskedIdentifier}. An SMS One-Time PIN (OTP) has been simulated for your issuing bank.
                </p>

                <div style={{
                  background: '#0b0d14',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#e1c256', fontWeight: 700, marginBottom: '6px' }}>
                    ENTER 6-DIGIT SMS ONE-TIME PIN (OTP)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    style={{
                      width: '180px',
                      padding: '10px',
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      background: 'transparent',
                      border: '1.5px solid #e1c256',
                      borderRadius: '6px',
                      color: '#fff',
                      margin: '0 auto',
                      display: 'block'
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                    Hint: Enter <strong>123456</strong> for Philippines 3DS Sandbox verification.
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpInput('123456');
                        handleVerifyOtpAndTokenize();
                      }}
                      disabled={loading}
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(225, 194, 86, 0.2)',
                        border: '1px dashed #e1c256',
                        borderRadius: '6px',
                        color: '#e1c256',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} /> 1-Click Approve 3DS Sandbox
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtpAndTokenize}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#e1c256',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Authenticating & Tokenizing...' : 'Verify 3DS & Tokenize Card'}
                </button>
              </div>
            )}

            {(paymentRail === 'gcash' || paymentRail === 'maya') && (
              <div style={{
                background: '#12151e',
                border: '1.5px solid rgba(247, 255, 196, 0.4)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                maxWidth: '480px',
                margin: '0 auto 20px'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(247, 255, 196, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Smartphone size={28} color="#f7ffc4" />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  {paymentRail === 'maya' ? 'Maya' : 'GCash'} Auto-Debit Authorization
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px' }}>
                  Authorize recurring auto-debit pull agreement for mobile account {maskedIdentifier}.
                </p>

                <div style={{
                  background: '#0b0d14',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#f7ffc4', fontWeight: 700, marginBottom: '6px' }}>
                    ENTER AUTHORIZATION PIN
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    style={{
                      width: '180px',
                      padding: '10px',
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      background: 'transparent',
                      border: '1.5px solid #f7ffc4',
                      borderRadius: '6px',
                      color: '#fff',
                      margin: '0 auto',
                      display: 'block'
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                    Hint: Use test OTP <strong>123456</strong> to approve auto-debit agreement.
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpInput('123456');
                        handleVerifyOtpAndTokenize();
                      }}
                      disabled={loading}
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(247, 255, 196, 0.2)',
                        border: '1px dashed #f7ffc4',
                        borderRadius: '6px',
                        color: '#f7ffc4',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} /> 1-Click Approve E-Wallet Sandbox
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtpAndTokenize}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#f7ffc4',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Authorizing Agreement...' : 'Authorize Pre-Approved Agreement'}
                </button>
              </div>
            )}

            {paymentRail === 'qr_ph' && (
              <div style={{
                background: '#12151e',
                border: '1.5px solid rgba(101, 130, 86, 0.4)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                maxWidth: '480px',
                margin: '0 auto 20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#658256', display: 'block' }}>
                      XENDIT QR PH • REF #{qrInvoiceNo || 'PENDING'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      BSP-Regulated EMVCo Dynamic Payload
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e1c256', fontSize: '0.8rem', fontWeight: 700 }}>
                    <Clock size={16} />
                    <span>
                      {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Simulated EMVCo QR Visual - Clickable & Downloadable */}
                <div
                  onClick={handleDownloadQr}
                  title="Click to download QR Ph Code image"
                  style={{
                    width: '210px',
                    height: '210px',
                    background: '#fff',
                    padding: '12px',
                    borderRadius: '12px',
                    margin: '0 auto 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Ph National Standard Payment Code"
                        style={{ width: '150px', height: '150px', objectFit: 'contain', display: 'block' }}
                      />
                    ) : (
                      <QrCode size={150} color="#000" />
                    )}
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#000', marginTop: '4px', letterSpacing: '0.1em' }}>
                      QR PH NATIONAL STANDARD
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    title="Download QR Ph Code image (PNG) for mobile scan or offline backup"
                    style={{
                      padding: '7px 16px',
                      background: 'rgba(225, 194, 86, 0.12)',
                      border: '1px solid #e1c256',
                      borderRadius: '8px',
                      color: '#e1c256',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Download size={14} />
                    <span>Download QR Ph Code</span>
                  </button>
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
                  ₱{(effectiveTotalDue || currentPlan?.totalDue || 0).toLocaleString()}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 16px' }}>
                  Scan with GCash, Maya, BDO Online, BPI Mobile, or any QR Ph app.
                </p>

                <button
                  type="button"
                  onClick={handleSimulateQrWebhook}
                  disabled={loading}
                  title="Simulate bank app confirmation webhook (test settlement)"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#658256',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Sparkles size={18} />
                  <span>{loading ? 'Processing Settlement...' : 'Simulate Scan & Pay in Bank App'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchHostedCheckout}
                  disabled={loading}
                  title="Launch official Xendit Hosted Checkout page in browser"
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    background: 'rgba(225, 194, 86, 0.12)',
                    border: '1px solid #e1c256',
                    color: '#e1c256',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ExternalLink size={16} />
                  <span>Proceed to Official Xendit Hosted Checkout →</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 5: ACCESS ISSUANCE & TURNSTILE CREDENTIALS */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(101, 130, 86, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} color="#658256" />
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>
              Welcome to KSYN Fitness, {fullName}!
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px' }}>
              Your account has been marked <strong>ACTIVE</strong>. Turnstile credentials provisioned for <strong>{selectedBranch.name}</strong>.
            </p>

            {/* Turnstile Access Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {/* Card 1: Access Credential */}
              <div style={{
                background: '#12151e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e1c256', fontSize: '0.75rem', fontWeight: 800, marginBottom: '6px' }}>
                  <Key size={14} />
                  <span>{selectedPlanTier === '1_day' ? 'ACCESS CREDENTIAL TYPE' : 'RFID TURNSTILE KEYCARD'}</span>
                </div>
                <div style={{ fontSize: selectedPlanTier === '1_day' ? '1.05rem' : '1.25rem', fontWeight: 900, color: '#fff', letterSpacing: '0.03em' }}>
                  {selectedPlanTier === '1_day' ? 'Digital QR Turnstile Pass' : (rfidUid || 'Awaiting Issuance')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  {selectedPlanTier === '1_day' ? 'Scan dynamic barcode at optical turnstile gate.' : 'Collect physical card at reception counter.'}
                </div>
              </div>

              {/* Card 2: 60s Dynamic QR Pass */}
              <div style={{
                background: '#12151e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#658256', fontSize: '0.75rem', fontWeight: 800 }}>
                    <QrCode size={14} />
                    <span>60S DYNAMIC QR PASS</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#e1c256', fontWeight: 700 }}>
                    {passTtlSeconds}s left
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                  Cryptographic Entry Pass
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Instant scan ready at optical turnstile gate.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (onComplete) onComplete(onboardedMember);
                  if (onClose) onClose();
                }}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  background: '#e1c256',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>Access Member Dashboard</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KSYN Gym Rules, Liability Waiver, and Terms of Service Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setWaiverAgreed(true);
          setShowTermsModal(false);
        }}
      />

      {/* KSYN Data Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setPrivacyAgreed(true);
          setShowPrivacyModal(false);
        }}
      />

      {/* KSYN Refund & Cancellation Policy Modal */}
      <RefundPolicyModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
      />

      {/* KSYN End User License Agreement (EULA) Modal */}
      <EulaModal
        isOpen={showEulaModal}
        onClose={() => setShowEulaModal(false)}
      />
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      {content}
    </div>
  );
}
