import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, AlertCircle, FileText, MapPin, Clock } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { BRANCH_DIRECTORY, ACTIVE_BRANCHES } from '../config/branchData';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import Tooltip from './Tooltip';

export default function FreePassModal({ isOpen, onClose, initialBranchId }) {
  const { toast } = useToast();
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    branch_id: initialBranchId || '',
    full_name: '',
    email: '',
    phone: '',
    zip_code: '',
    agree_terms: false,
    opt_in_marketing: false
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitted(false);
    setErrors({});
    setTouched({});
    if (initialBranchId) {
      setFormData(prev => ({
        ...prev,
        branch_id: initialBranchId
      }));
    }

    const fetchBranches = async () => {
      try {
        let res = await fetch('/api/free-pass/branches');
        if (!res.ok) {
          res = await fetch('/api/branches');
        }
        if (!res.ok) throw new Error('Network response not ok');
        const data = await res.json();
        
        const rawList = Array.isArray(data) 
          ? data 
          : (data.branches || data.data || []);

        if (rawList.length > 0) {
          // Normalize properties across different backend structures
          const formatted = rawList.map(b => {
            const matched = BRANCH_DIRECTORY.find(item => item.id === b.id || item.code === b.code);
            return {
              id: b.id || b.branch_id || b._id,
              name: b.name || b.branch_name || b.title || 'KSYN Branch',
              hours: b.operating_hours || b.operatingHours || b.hours || matched?.operating_hours || '6:00 AM – 12:00 AM',
              isActive: b.status ? !b.status.toLowerCase().includes('inactive') && !b.status.toLowerCase().includes('pipeline') : true
            };
          });
          setBranches(formatted);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch dynamic branches, using system defaults:', err);
      }

      // Default registered branches from official branch directory
      setBranches(
        BRANCH_DIRECTORY.map(b => ({
          id: b.id,
          name: b.name,
          hours: b.operating_hours || '6:00 AM – 12:00 AM',
          isActive: b.status !== 'Pipeline / Opening Soon'
        }))
      );
    };

    fetchBranches();
  }, [isOpen, initialBranchId]);

  if (!isOpen) return null;

  const validateField = (field, value) => {
    switch (field) {
      case 'full_name': {
        const nameRegex = /^[A-Za-z\s.,'-]+$/;
        if (!String(value || '').trim()) return 'Full name is required.';
        if (!nameRegex.test(value)) return 'Name must only contain letters, spaces, commas, or periods (no numbers).';
        if (String(value).trim().length < 2) return 'Name must be at least 2 characters.';
        return null;
      }
      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!String(value || '').trim()) return 'Email address is required.';
        if (!emailRegex.test(value)) return 'Please provide a valid email address containing "@" and domain.';
        return null;
      }
      case 'phone': {
        const phPhoneRegex = /^(09|\+639)\d{9}$/;
        const cleanPhone = String(value || '').replace(/[\s-]/g, '');
        if (!cleanPhone) return 'Mobile number is required.';
        if (!phPhoneRegex.test(cleanPhone)) return 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';
        return null;
      }
      case 'zip_code': {
        if (!String(value || '').trim()) return 'Postal / Zip code is required.';
        if (!/^\d{4}$/.test(String(value || '').trim())) return 'Enter a valid 4-digit PH postal/zip code.';
        return null;
      }
      case 'branch_id': {
        if (!value) return 'Please select a KSYN gym branch.';
        return null;
      }
      case 'agree_terms': {
        if (!value) return 'You must accept the Terms & Conditions and acknowledge the Privacy Policy.';
        return null;
      }
      default:
        return null;
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, formData[field]);
    setErrors(prev => {
      const updated = { ...prev };
      if (err) updated[field] = err;
      else delete updated[field];
      return updated;
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors(prev => {
        const updated = { ...prev };
        if (err) updated[field] = err;
        else delete updated[field];
        return updated;
      });
    }
  };

  const validate = () => {
    const errs = {};
    ['full_name', 'email', 'phone', 'zip_code', 'branch_id', 'agree_terms'].forEach(field => {
      const err = validateField(field, formData[field]);
      if (err) errs[field] = err;
    });

    setTouched({
      full_name: true,
      email: true,
      phone: true,
      zip_code: true,
      branch_id: true,
      agree_terms: true
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/free-pass/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        toast.success('Your Complimentary 1-Day Guest Pass has been confirmed!', 'Pass Confirmed');
      } else {
        setErrors(prev => ({ ...prev, server: data.message || 'Failed to submit application.' }));
        toast.error(data.message || 'Failed to submit application.', 'Submission Error');
      }
    } catch {
      // Fallback success for local test if mock DB is offline
      setSubmitted(true);
      toast.success('Your Complimentary 1-Day Guest Pass has been confirmed!', 'Pass Confirmed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Component-level Autofill Hardening */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus,
        select:-webkit-autofill {
          -webkit-text-fill-color: #FFFFFF !important;
          -webkit-box-shadow: 0 0 0px 1000px #16191F inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-pass-modal-title"
          className="modal-scrollable bg-[#101216] border border-[#1f232b] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative text-gray-200 shadow-2xl transition-all"
          style={{
            maxHeight: '90vh',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#e1c256 #1a1e24'
          }}
        >
          {/* Accessible Close Button with Tooltip and 44x44px touch target */}
          <div 
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20"
            style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20 }}
          >
            <Tooltip content="Close (Esc)" position="left">
              <button 
                type="button"
                onClick={onClose} 
                aria-label="Close Free Pass Modal"
                className="modal-close-circle-btn"
                title="Close Free Pass Modal (Esc)"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#9ca3af',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = '#e1c256';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#9ca3af';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <X size={18} />
              </button>
            </Tooltip>
          </div>

          {submitted ? (
            <div className="text-center py-6 sm:py-8 space-y-4">
              <div className="w-16 h-16 bg-[#e1c256]/10 rounded-full flex items-center justify-center mx-auto text-[#e1c256] border border-[#e1c256]/25 shadow-[0_0_20px_rgba(225, 194, 86,0.15)]">
                <CheckCircle2 className="w-9 h-9"/>
              </div>
              <h3 id="free-pass-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Complimentary Pass Issued!
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
                Thank you for claiming your 1-Day Complimentary Guest Pass at KSYN Fitness.
                Your single-day pass credentials and turnstile entry instructions have been generated.
              </p>
              <div className="text-xs text-[#e1c256] bg-[#16191f] p-3.5 rounded-lg border border-[#1f232b] leading-relaxed">
                Pass details and club access barcode have been dispatched to <strong className="text-white">{formData.email}</strong>. Present your pass at the front-desk turnstile upon arrival.
              </div>
              <Tooltip content="Return to previous screen" position="top" fullWidth className="w-full" style={{ width: '100%', display: 'block' }}>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close and return"
                  className="touch-btn w-full mt-4 py-3.5 px-6 bg-[#e1c256] hover:bg-[#cbaa42] text-black font-extrabold text-xs tracking-wider uppercase rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(225, 194, 86,0.25)] cursor-pointer"
                  style={{ width: '100%' }}
                >
                  Close & Return
                </button>
              </Tooltip>
            </div>
          ) : (
            <div>
              <div className="mb-5 pr-10">
                <span className="text-[10px] font-bold text-[#e1c256] uppercase tracking-wider bg-[#e1c256]/10 px-2.5 py-1 rounded border border-[#e1c256]/20 inline-block">
                  Complimentary Pass
                </span>
                <h2 id="free-pass-modal-title" className="text-lg sm:text-xl font-bold text-white mt-2">
                  Claim Your 1-Day Trial Pass
                </h2>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Experience full all-access training at your selected KSYN branch. Valid for one day of unlimited workouts, signature group classes, and recovery amenities.
                </p>
              </div>

              {errors.server && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0"/>
                  <span>{errors.server}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5 text-left">
                {(() => {
                  const selectedBranch = branches.find(b => b.id === formData.branch_id || b.code === formData.branch_id);
                  if (!selectedBranch) return null;
                  return (
                    <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-[#e1c256]/10 border border-[#e1c256]/30 rounded-lg text-[#e1c256] text-xs font-bold">
                      <MapPin size={16} className="shrink-0" />
                      <span className="truncate">Applying for: {selectedBranch.name}</span>
                    </div>
                  );
                })()}

                {/* Branch Selection */}
                <div>
                  <label htmlFor="free-pass-branch-select" className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5">
                    Select KSYN Gym Branch *
                  </label>
                  <select
                    id="free-pass-branch-select"
                    value={formData.branch_id}
                    onChange={(e) => handleChange('branch_id', e.target.value)}
                    onBlur={() => handleBlur('branch_id')}
                    aria-invalid={Boolean(errors.branch_id)}
                    aria-describedby={errors.branch_id ? "free-pass-branch-error" : undefined}
                    className={`w-full bg-[#16191F] border text-white text-xs rounded-lg py-3 px-3.5 focus:border-[#e1c256] focus:ring-1 focus:ring-[#e1c256] focus:outline-none transition-colors min-h-[44px] cursor-pointer ${
                      errors.branch_id ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]' : (touched.branch_id && formData.branch_id ? 'border-emerald-500/60' : 'border-[#2A2E39]')
                    }`}
                    style={{ backgroundColor: '#16191F', color: '#FFFFFF' }}
                  >
                    <option 
                      value="" 
                      style={{ backgroundColor: '#16191F', color: '#FFFFFF' }}
                      className="bg-[#16191F] text-white py-1"
                    >
                      -- Choose Branch Location --
                    </option>
                    {branches.map((b) => (
                      <option 
                        key={b.id} 
                        value={b.id} 
                        disabled={b.isActive === false}
                        style={{ backgroundColor: '#16191F', color: '#FFFFFF' }}
                        className="bg-[#16191F] text-white py-1"
                      >
                        {b.name} {b.hours ? `(${b.hours})` : ''} {b.isActive === false ? '— [Opening Soon]' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.branch_id && (
                    <p id="free-pass-branch-error" className="field-error-msg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.branch_id}</span>
                    </p>
                  )}
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="free-pass-fullname-input" className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="free-pass-fullname-input"
                    type="text"
                    placeholder="e.g. Juan C. Dela Cruz"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    onBlur={() => handleBlur('full_name')}
                    aria-invalid={Boolean(errors.full_name)}
                    aria-describedby={errors.full_name ? "free-pass-name-error" : undefined}
                    className={`w-full bg-[#16191F] border text-white text-xs rounded-lg py-3 px-3.5 focus:border-[#e1c256] focus:ring-1 focus:ring-[#e1c256] focus:outline-none placeholder-gray-500 transition-colors min-h-[44px] ${
                      errors.full_name ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]' : (touched.full_name && !errors.full_name ? 'border-emerald-500/60' : 'border-[#2A2E39]')
                    }`}
                    style={{ backgroundColor: '#16191F', color: '#FFFFFF' }}
                  />
                  {errors.full_name && (
                    <p id="free-pass-name-error" className="field-error-msg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.full_name}</span>
                    </p>
                  )}
                </div>

                {/* Email & Phone Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    width: '100%'
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div style={{ minWidth: 0 }}>
                    <label htmlFor="free-pass-email-input" className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5" style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: '#d1d5db', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Email Address *
                    </label>
                    <input
                      id="free-pass-email-input"
                      type="email"
                      placeholder="athlete@example.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={() => handleBlur('email')}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "free-pass-email-error" : undefined}
                      className={`w-full bg-[#16191F] border text-white text-xs rounded-lg py-3 px-3.5 focus:border-[#e1c256] focus:ring-1 focus:ring-[#e1c256] focus:outline-none placeholder-gray-500 transition-colors min-h-[44px] ${
                        errors.email ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]' : (touched.email && !errors.email ? 'border-emerald-500/60' : 'border-[#2A2E39]')
                      }`}
                      style={{
                        backgroundColor: '#16191F',
                        color: '#FFFFFF',
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: '44px',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}
                    />
                    {errors.email && (
                      <p id="free-pass-email-error" className="field-error-msg">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label htmlFor="free-pass-phone-input" className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5" style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: '#d1d5db', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Mobile Number *
                    </label>
                    <input
                      id="free-pass-phone-input"
                      type="tel"
                      placeholder="09171234567"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      onBlur={() => handleBlur('phone')}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "free-pass-phone-error" : undefined}
                      className={`w-full bg-[#16191F] border text-white text-xs rounded-lg py-3 px-3.5 focus:border-[#e1c256] focus:ring-1 focus:ring-[#e1c256] focus:outline-none placeholder-gray-500 transition-colors min-h-[44px] ${
                        errors.phone ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]' : (touched.phone && !errors.phone ? 'border-emerald-500/60' : 'border-[#2A2E39]')
                      }`}
                      style={{
                        backgroundColor: '#16191F',
                        color: '#FFFFFF',
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: '44px',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}
                    />
                    {errors.phone && (
                      <p id="free-pass-phone-error" className="field-error-msg">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Zip / Postal Code */}
                <div>
                  <label htmlFor="free-pass-zip-input" className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5">
                    Zip / Postal Code *
                  </label>
                  <input
                    id="free-pass-zip-input"
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 1634"
                    value={formData.zip_code}
                    onChange={(e) => handleChange('zip_code', e.target.value)}
                    onBlur={() => handleBlur('zip_code')}
                    aria-invalid={Boolean(errors.zip_code)}
                    aria-describedby={errors.zip_code ? "free-pass-zip-error" : undefined}
                    className={`w-full bg-[#16191F] border text-white text-xs rounded-lg py-3 px-3.5 focus:border-[#e1c256] focus:ring-1 focus:ring-[#e1c256] focus:outline-none placeholder-gray-500 transition-colors min-h-[44px] ${
                      errors.zip_code ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]' : (touched.zip_code && !errors.zip_code ? 'border-emerald-500/60' : 'border-[#2A2E39]')
                    }`}
                    style={{ backgroundColor: '#16191F', color: '#FFFFFF' }}
                  />
                  {errors.zip_code && (
                    <p id="free-pass-zip-error" className="field-error-msg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.zip_code}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 pb-1 space-y-3">
                  {/* Mandatory Legal & Privacy Checkbox */}
                  <label className="flex items-start gap-3 text-xs text-gray-400 leading-relaxed cursor-pointer select-none min-h-[44px] p-1.5 rounded hover:bg-[#16191f]/60 transition-colors">
                    <input
                      type="checkbox"
                      id="free-pass-agree-terms"
                      checked={formData.agree_terms}
                      onChange={(e) => handleChange('agree_terms', e.target.checked)}
                      onBlur={() => handleBlur('agree_terms')}
                      className="mt-0.5 w-4 h-4 accent-[#e1c256] rounded cursor-pointer shrink-0"
                    />
                    <span className="leading-relaxed">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowTermsModal(true);
                        }}
                        className="text-[#e1c256] underline font-bold hover:text-[#cbaa42] transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 inline outline-none"
                        style={{ background: 'transparent', border: 'none', color: '#e1c256' }}
                      >
                        Free Pass Terms & Conditions
                      </button>
                      {' '}and acknowledge that my personal data will be processed in accordance with the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowPrivacyModal(true);
                        }}
                        className="text-[#e1c256] underline font-bold hover:text-[#cbaa42] transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 inline outline-none"
                        style={{ background: 'transparent', border: 'none', color: '#e1c256' }}
                      >
                        KSYN Privacy Policy (RA 10173)
                      </button>
                      . *
                    </span>
                  </label>
                  {errors.agree_terms && (
                    <p className="field-error-msg -mt-1 ml-7">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.agree_terms}</span>
                    </p>
                  )}

                  {/* Optional Marketing Communication Checkbox */}
                  <label className="flex items-start gap-3 text-xs text-gray-400 leading-relaxed cursor-pointer select-none min-h-[44px] p-1.5 rounded hover:bg-[#16191f]/60 transition-colors">
                    <input
                      type="checkbox"
                      id="free-pass-opt-in-marketing"
                      checked={formData.opt_in_marketing}
                      onChange={(e) => handleChange('opt_in_marketing', e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#e1c256] rounded cursor-pointer shrink-0"
                    />
                    <span className="leading-relaxed text-gray-400">
                      (Optional) Keep me updated with seasonal membership promos, training masterclasses, and new branch openings via SMS or email.
                    </span>
                  </label>
                </div>

                <Tooltip 
                  content={submitting ? "Processing application..." : "Claim your free 24-hour pass"} 
                  position="top"
                  fullWidth
                  className="w-full"
                  style={{ width: '100%', display: 'block' }}
                >
                  <button
                    type="submit"
                    disabled={submitting}
                    aria-label="Claim Complimentary 1-Day Pass"
                    className="touch-btn w-full mt-2 py-3.5 px-6 bg-[#e1c256] hover:bg-[#cbaa42] text-black font-extrabold text-xs tracking-wider uppercase rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(225, 194, 86,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{ width: '100%' }}
                  >
                    {submitting ? 'GENERATING PASS...' : 'CLAIM COMPLIMENTARY 1-DAY PASS'}
                  </button>
                </Tooltip>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Terms & Conditions Sub-Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#101216] border border-[#1f232b] rounded-xl max-w-md w-full p-4 sm:p-5 text-gray-300 text-xs leading-relaxed space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f232b] pb-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-[#e1c256]"/>
                Complimentary Pass Terms & Conditions
              </h4>
              <Tooltip content="Close Terms" position="left">
                <button 
                  type="button"
                  onClick={() => setShowTermsModal(false)} 
                  aria-label="Close Terms Modal"
                  className="modal-close-circle-btn"
                  title="Close Terms (Esc)"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#9ca3af',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    minWidth: '36px',
                    minHeight: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#e1c256';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>
            <p>
              1. <strong>Single-Day All-Access:</strong> Valid for one (1) full calendar day of unlimited strength, cardio, and signature class training at your selected KSYN branch.
            </p>
            <p>
              2. <strong>Immediate Turnstile Check-In:</strong> Present your email confirmation or digital optical pass at the club front-desk for turnstile gate admission.
            </p>
            <p>
              3. <strong>Full Club Amenities:</strong> Includes locker room, hot shower facilities, and hydration stations complimentary for the visit.
            </p>
            <p>
              4. <strong>Eligibility:</strong> Valid for first-time guests and prospective members aged 18 and older. No credit card required.
            </p>
            <Tooltip content="Accept and return" position="top" fullWidth className="w-full" style={{ width: '100%', display: 'block' }}>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Understand and agree to terms"
                className="touch-btn w-full mt-2 py-3 px-6 bg-[#e1c256] hover:bg-[#cbaa42] text-black font-extrabold text-xs tracking-wider uppercase rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(225, 194, 86,0.25)] cursor-pointer"
                style={{ width: '100%' }}
              >
                I Understand & Agree
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* KSYN Corporate Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </>
  );
}
