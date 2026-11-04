import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  DollarSign,
  User,
  Users,
  Dumbbell,
  Building2,
  Calendar,
  Receipt,
  ExternalLink,
  RefreshCw,
  Printer
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PT_PACKAGES = [
  {
    id: 'pt-12',
    name: '12-Session Signature PT Package',
    sessions: 12,
    price: 6000,
    coachCutPct: 15,
    coachCutAmount: 900,
    gymRetainedAmount: 5100,
    description: '12 customized 1-on-1 coaching sessions with biomechanics assessment.'
  },
  {
    id: 'pt-16',
    name: '16-Session Elite Transformation PT Package',
    sessions: 16,
    price: 8000,
    coachCutPct: 15,
    coachCutAmount: 1200,
    gymRetainedAmount: 6800,
    description: '16 periodized strength and hypertrophy sessions + nutritional programming.'
  },
  {
    id: 'pt-10',
    name: '10-Session Jumpstart PT Package',
    sessions: 10,
    price: 5000,
    coachCutPct: 15,
    coachCutAmount: 750,
    gymRetainedAmount: 4250,
    description: '10 fundamental conditioning and technique correction sessions.'
  },
  {
    id: 'pt-single',
    name: 'Single 1-on-1 Assessment Session',
    sessions: 1,
    price: 500,
    coachCutPct: 15,
    coachCutAmount: 75,
    gymRetainedAmount: 425,
    description: '1 single baseline movement screening and technique evaluation.'
  }
];

const BRANCH_OPTIONS = [
  { id: 'b-mkt-01', code: 'MKT', name: 'Makati Flagship' },
  { id: 'b-frv-02', code: 'FRV', name: 'Fairview Hub' },
  { id: 'b-ktp-03', code: 'KAT', name: 'Katipunan Branch' },
  { id: 'b-alb-04', code: 'ALB', name: 'Alabang Branch' }
];

export default function PosPtEnrollmentModal({
  isOpen,
  onClose,
  cashierUser,
  currentBranchId,
  currentShift,
  members = [],
  ptEnrollments = [],
  onSuccess
}) {
  const { authFetch } = useAuth();
  const { toast } = useToast();

  // Step 1: Member State
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  // Step 2: Branch & Coach State
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranchId || 'b-mkt-01');
  const [coaches, setCoaches] = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState('');

  // Target Session Schedule (Preferred Slot)
  const todayStr = new Date().toISOString().split('T')[0];
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('09:00 AM – 10:00 AM (Morning Peak)');

  // Step 3: Package State
  const [selectedPackageId, setSelectedPackageId] = useState('pt-12');

  // Step 4: Payment Method State
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'XENDIT'
  const [cashTendered, setCashTendered] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Xendit Live Invoice State
  const [xenditInvoiceData, setXenditInvoiceData] = useState(null);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Step 5: Completed Receipt State
  const [completedEnrollment, setCompletedEnrollment] = useState(null);

  const selectedPackage = PT_PACKAGES.find(p => p.id === selectedPackageId) || PT_PACKAGES[0];
  const selectedCoach = coaches.find(c => c.id === selectedCoachId);
  const selectedBranch = BRANCH_OPTIONS.find(b => b.id === selectedBranchId) || BRANCH_OPTIONS[0];

  // Fetch coaches whenever selected branch changes
  useEffect(() => {
    let active = true;
    async function loadBranchCoaches() {
      setLoadingCoaches(true);
      try {
        const res = await authFetch(`/api/pos/coaches?branch_id=${selectedBranchId}`);
        const data = await res.json();
        if (active && data.success && Array.isArray(data.coaches)) {
          setCoaches(data.coaches);
          if (data.coaches.length > 0) {
            setSelectedCoachId(data.coaches[0].id);
          } else {
            setSelectedCoachId('');
          }
        }
      } catch (err) {
        console.error('Failed to load coaches for POS:', err);
      } finally {
        if (active) setLoadingCoaches(false);
      }
    }
    loadBranchCoaches();
    return () => { active = false; };
  }, [selectedBranchId]);

  // Polling for Xendit invoice settlement
  useEffect(() => {
    if (!xenditInvoiceData?.invoiceId || completedEnrollment) return;
    let timer = null;
    let isSubscribed = true;

    async function checkInvoiceStatus() {
      try {
        const res = await authFetch(`/api/pos/xendit/status/${xenditInvoiceData.invoiceId}`);
        const data = await res.json();
        if (isSubscribed && (data.status === 'PAID' || data.status === 'SETTLED' || data.settled)) {
          toast.success('Xendit invoice successfully settled!', 'Payment Verified');
          setCompletedEnrollment({
            ...xenditInvoiceData.enrollment,
            status: 'CLEARED_ACTIVE',
            payment_status: 'PAID'
          });
          setXenditInvoiceData(null);
          if (typeof onSuccess === 'function') onSuccess();
        }
      } catch (e) {
        // Continue polling
      }
    }

    setPollingStatus(true);
    timer = setInterval(checkInvoiceStatus, 2500);

    return () => {
      isSubscribed = false;
      if (timer) clearInterval(timer);
      setPollingStatus(false);
    };
  }, [xenditInvoiceData, completedEnrollment]);

  if (!isOpen) return null;

  const filteredMembers = members.filter(m => {
    // 1. Must belong to the selected branch / cashier branch
    const matchBranch = !m.branch_id || m.branch_id === selectedBranchId || m.branch_id === currentBranchId;
    if (!matchBranch) return false;

    // 2. Must currently have an active membership plan
    const hasActivePlan = Boolean(
      (m.membership_plan && m.membership_plan !== 'none') ||
      (m.subscription && m.subscription.status === 'active') ||
      (m.status === 'active' || !m.status)
    );
    if (!hasActivePlan) return false;

    // 3. Must not currently be enrolled in any PT across any branch
    const isEnrolledInPt = Boolean(
      m.has_active_pt ||
      m.assigned_coach_id ||
      (Array.isArray(ptEnrollments) && ptEnrollments.some(e => {
        const matchesMember = e.member_id === m.id || e.user_id === m.id || 
          (e.member_email && m.email && e.member_email.toLowerCase() === m.email.toLowerCase()) ||
          (e.client_name && m.name && e.client_name.toLowerCase() === (m.name || '').toLowerCase());
        const isConcluded = e.enrollment_status === 'CONCLUDED' || e.is_concluded || (e.sessions_completed !== undefined && e.sessions_total !== undefined && e.sessions_completed >= e.sessions_total);
        return matchesMember && !isConcluded;
      }))
    );
    if (isEnrolledInPt) return false;

    if (!memberSearch.trim()) return false;
    const q = memberSearch.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.id && String(m.id).toLowerCase().includes(q)) ||
      (m.rfid_card_uid && m.rfid_card_uid.toLowerCase().includes(q))
    );
  }).slice(0, 5);

  const numCashTendered = Number(cashTendered) || 0;
  const cashChangeDue = Math.max(0, numCashTendered - selectedPackage.price);

  const handleSubmitCash = async (e) => {
    e.preventDefault();
    if (!selectedMember) {
      toast.warning('Please select an athlete member.', 'Member Required');
      return;
    }
    if (!selectedCoachId) {
      toast.warning('Please select an active trainer/coach.', 'Coach Required');
      return;
    }
    if (numCashTendered < selectedPackage.price) {
      toast.warning(`Cash tendered (₱${numCashTendered.toLocaleString()}) is less than the package price (₱${selectedPackage.price.toLocaleString()}).`, 'Insufficient Cash');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/pos/pt-enrollment', {
        method: 'POST',
        body: JSON.stringify({
          memberId: selectedMember.id,
          coachId: selectedCoachId,
          packageId: selectedPackage.id,
          branchCode: selectedBranch.code,
          paymentMethod: 'CASH',
          cashierId: cashierUser?.id,
          sessionDate: preferredDate,
          sessionTimeSlot: preferredTimeSlot,
          notes: `Front Desk Cash Counter: Tendered ₱${numCashTendered.toLocaleString()} (Change: ₱${cashChangeDue.toLocaleString()})`
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'PT Package activated successfully!', 'Enrollment Cleared');
        setCompletedEnrollment(data.enrollment);
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        toast.error(data.message || 'Failed to process counter cash enrollment', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitXendit = async (e) => {
    e.preventDefault();
    if (!selectedMember) {
      toast.warning('Please select an athlete member.', 'Member Required');
      return;
    }
    if (!selectedCoachId) {
      toast.warning('Please select an active trainer/coach.', 'Coach Required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/pos/pt-enrollment', {
        method: 'POST',
        body: JSON.stringify({
          memberId: selectedMember.id,
          coachId: selectedCoachId,
          packageId: selectedPackage.id,
          branchCode: selectedBranch.code,
          paymentMethod: 'XENDIT',
          cashierId: cashierUser?.id,
          sessionDate: preferredDate,
          sessionTimeSlot: preferredTimeSlot,
          notes: 'Front Desk Counter Xendit Invoice Enrollment'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.info('Xendit hosted invoice created. Present link or QR to athlete.', 'Invoice Ready');
        setXenditInvoiceData({
          invoiceId: data.invoiceId,
          invoiceUrl: data.invoiceUrl,
          externalId: data.externalId,
          enrollment: data.enrollment
        });
      } else {
        toast.error(data.message || 'Failed to generate Xendit invoice', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateXenditPaid = async () => {
    if (!xenditInvoiceData?.invoiceId) return;
    setSimulating(true);
    try {
      const res = await authFetch(`/api/pos/xendit/simulate-paid/${xenditInvoiceData.invoiceId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sandbox settlement verified! Enrollment cleared.', 'Settlement Complete');
        setCompletedEnrollment({
          ...xenditInvoiceData.enrollment,
          status: 'CLEARED_ACTIVE',
          payment_status: 'PAID'
        });
        setXenditInvoiceData(null);
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        toast.error(data.message || 'Simulation failed', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Network Error');
    } finally {
      setSimulating(false);
    }
  };

  const handleResetForNext = () => {
    setSelectedMember(null);
    setMemberSearch('');
    setCashTendered('');
    setXenditInvoiceData(null);
    setCompletedEnrollment(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        className="ksyn-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#101217',
          border: '1px solid #232938',
          borderRadius: '16px',
          padding: '24px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2536', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-gold" style={{ fontSize: '0.6875rem' }}>
                FRONT DESK POS
              </span>
              <span className="badge badge-outline" style={{ fontSize: '0.6875rem', fontFamily: 'monospace' }}>
                STREAM: PT-POS
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '6px 0 2px 0' }}>
              Personal Trainer (PT) Package Counter Enrollment
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
              Process over-the-counter PT enrollment with origin-channel reference prefixing and shift drawer logging.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* VIEW A: COMPLETED SUCCESS RECEIPT */}
        {completedEnrollment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <CheckCircle2 size={40} className="text-emerald-400" style={{ margin: '0 auto 8px auto' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                PT Package Cleared & Active
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
                Reference: <strong className="mono" style={{ color: '#e1c256' }}>{completedEnrollment.payment_reference || completedEnrollment.xendit_external_id}</strong>
              </p>
            </div>

            {/* Receipt Dossier Card */}
            <div style={{ background: '#0e1015', border: '1px solid #1f2536', borderRadius: '12px', padding: '18px', fontSize: '0.8125rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Athlete Member</span>
                  <strong style={{ color: '#ffffff' }}>{completedEnrollment.member_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Assigned Coach</span>
                  <strong style={{ color: '#e1c256' }}>{completedEnrollment.coach_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Package Plan</span>
                  <strong style={{ color: '#ffffff' }}>{completedEnrollment.package_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Total Sessions</span>
                  <strong style={{ color: '#658256' }}>{completedEnrollment.sessions_total} Sessions (0 used)</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Payment Method</span>
                  <strong style={{ color: '#ffffff' }}>{completedEnrollment.payment_channel} ({completedEnrollment.origin_channel || 'POS'})</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Gross Total Paid</span>
                  <strong style={{ color: '#e1c256', fontFamily: 'monospace' }}>₱{Number(completedEnrollment.gross_amount || completedEnrollment.total_price).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Coach Commission (15%)</span>
                  <strong style={{ color: '#658256', fontFamily: 'monospace' }}>+₱{Number(completedEnrollment.coach_payout_amount || 0).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem' }}>Cashier Staff</span>
                  <strong style={{ color: '#ffffff' }}>{completedEnrollment.cashier_name || cashierUser?.name}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="ksyn-btn ksyn-btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button
                type="button"
                onClick={handleResetForNext}
                className="ksyn-btn ksyn-btn-outline"
                style={{ fontSize: '0.8125rem' }}
              >
                Enroll Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ksyn-btn ksyn-btn-gold"
                style={{ fontSize: '0.8125rem', fontWeight: 800 }}
              >
                Done
              </button>
            </div>
          </div>
        ) : xenditInvoiceData ? (
          /* VIEW B: XENDIT INVOICE & QR PH DISPLAY WITH LIVE POLLING */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              background: '#0c0e14',
              border: '1px solid #1f2536',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <span className="badge badge-warning" style={{ fontSize: '0.6875rem', marginBottom: '8px' }}>
                AWAITING CUSTOMER PAYMENT
              </span>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: '4px 0 6px 0' }}>
                Xendit Hosted Invoice Generated
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 16px 0' }}>
                External ID: <strong className="mono" style={{ color: '#e1c256' }}>{xenditInvoiceData.externalId}</strong>
              </p>

              <div style={{
                background: '#161922',
                borderRadius: '10px',
                padding: '16px',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid #28324a'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Amount Due</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace' }}>
                  ₱{selectedPackage.price.toLocaleString()}
                </span>
                <a
                  href={xenditInvoiceData.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 800, padding: '8px 18px', textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> Open Customer Payment Page
                </a>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.75rem', color: '#658256' }}>
                <RefreshCw size={13} className="animate-spin" />
                <span>Listening for real-time Xendit invoice settlement...</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setXenditInvoiceData(null)}
                className="ksyn-btn ksyn-btn-outline"
                style={{ fontSize: '0.8125rem' }}
              >
                Cancel / Re-select Payment
              </button>
            </div>
          </div>
        ) : (
          /* VIEW C: ENROLLMENT FORM CONTROLS */
          <form onSubmit={paymentMethod === 'CASH' ? handleSubmitCash : handleSubmitXendit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Step 1: Member Lookup */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                1. Select Athlete Member *
              </label>
              {selectedMember ? (
                <div style={{
                  background: '#161922',
                  border: '1px solid #28324a',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e1c256', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {selectedMember.name?.slice(0, 2).toUpperCase() || 'MB'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>{selectedMember.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{selectedMember.email} • {selectedMember.membership_plan || 'Active Member'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    style={{ background: 'transparent', border: '1px solid #3b455b', color: '#cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search member by name, email, or RFID keycard..."
                    className="ksyn-input"
                    style={{ paddingLeft: '36px', width: '100%', fontSize: '0.8125rem' }}
                  />

                  {filteredMembers.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#161922',
                      border: '1px solid #2e384d',
                      borderRadius: '8px',
                      marginTop: '4px',
                      zIndex: 50,
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {filteredMembers.map(m => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMember(m);
                            setMemberSearch('');
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #232a3b',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          className="hover:bg-[#1f2433]"
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>{m.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{m.email}</div>
                          </div>
                          <span className="badge badge-active text-xs">Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Branch & Coach Selection Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '6px' }}>
                  2. Servicing Branch
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                >
                  {BRANCH_OPTIONS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '6px' }}>
                  3. Assigned Coach / Trainer *
                </label>
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                  required
                >
                  {coaches.length === 0 ? (
                    <option value="">No active trainers in this branch</option>
                  ) : (
                    coaches.map(c => {
                      const cleanName = (c.name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
                      const specialty = c.specialty || c.shift_role || 'Personal Trainer';
                      return (
                        <option key={c.id} value={c.id}>
                          {cleanName} — {specialty}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            {/* Step 3: Package Tier Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '8px' }}>
                4. Select PT Package Tier
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {PT_PACKAGES.map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: selectedPackageId === pkg.id ? '2px solid #e1c256' : '1px solid #232938',
                      background: selectedPackageId === pkg.id ? 'rgba(225, 194, 86, 0.08)' : '#0e1015',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.8125rem', color: selectedPackageId === pkg.id ? '#e1c256' : '#ffffff' }}>
                        {pkg.name}
                      </strong>
                      <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 900, color: '#ffffff' }}>
                        ₱{pkg.price.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      {pkg.sessions} Sessions • Coach Cut (15%): <strong style={{ color: '#658256' }}>₱{pkg.coachCutAmount}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Session Schedule (Preferred Slot) - Matching Image 4 */}
            <div style={{
              background: '#12151e',
              border: '1px solid #28324a',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#e1c256" />
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>
                  Target Session Schedule (Preferred Slot):
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>
                    PREFERRED DATE:
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="ksyn-input"
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>
                    PREFERRED TIME SLOT:
                  </label>
                  <select
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value)}
                    className="ksyn-input"
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  >
                    <option value="06:00 AM – 07:00 AM (Early Dawn)">06:00 AM – 07:00 AM (Early Dawn)</option>
                    <option value="07:00 AM – 08:00 AM (Morning Peak)">07:00 AM – 08:00 AM (Morning Peak)</option>
                    <option value="08:00 AM – 09:00 AM (Morning Peak)">08:00 AM – 09:00 AM (Morning Peak)</option>
                    <option value="09:00 AM – 10:00 AM (Mid Morning)">09:00 AM – 10:00 AM (Mid Morning)</option>
                    <option value="10:00 AM – 11:00 AM (Late Morning)">10:00 AM – 11:00 AM (Late Morning)</option>
                    <option value="02:00 PM – 03:00 PM (Early Afternoon)">02:00 PM – 03:00 PM (Early Afternoon)</option>
                    <option value="03:00 PM – 04:00 PM (Mid Afternoon)">03:00 PM – 04:00 PM (Mid Afternoon)</option>
                    <option value="04:00 PM – 05:00 PM (Late Afternoon)">04:00 PM – 05:00 PM (Late Afternoon)</option>
                    <option value="05:00 PM – 06:00 PM (Evening Prime)">05:00 PM – 06:00 PM (Evening Prime)</option>
                    <option value="06:00 PM – 07:00 PM (Evening Prime)">06:00 PM – 07:00 PM (Evening Prime)</option>
                    <option value="07:00 PM – 08:00 PM (Evening Peak)">07:00 PM – 08:00 PM (Evening Peak)</option>
                  </select>
                </div>
              </div>

              {/* Classification: Coach Availability Status */}
              <div style={{
                padding: '8px 12px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: 600 }}>
                  {selectedCoach?.name ? `${selectedCoach.name.replace(/\s*\(.*?\)\s*/g, '').trim()} is confirmed available for sessions on this schedule.` : 'Trainer schedule confirmed available.'}
                </span>
              </div>

              {/* Reception & Coach Coordination Notice (Matching Image 4) */}
              <div style={{
                padding: '10px 12px',
                background: 'rgba(225, 194, 86, 0.06)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#d1d5db',
                lineHeight: 1.4
              }}>
                <strong style={{ color: '#e1c256' }}>Reception & Coach Coordination:</strong> For this session booking, the Front Desk will coordinate and verify this requested date/time slot directly with <strong style={{ color: '#ffffff' }}>{selectedCoach?.name ? selectedCoach.name.replace(/\s*\(.*?\)\s*/g, '').trim() : 'the trainer'}</strong> upon physical check-in.
              </div>
            </div>

            {/* Financial Commission Cut Breakdown */}
            <div style={{
              background: '#0d0f15',
              border: '1px solid #1e2434',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem'
            }}>
              <div>
                <span style={{ color: '#9ca3af' }}>Gross Counter Price:</span>{' '}
                <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>₱{selectedPackage.price.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Coach 15% Share:</span>{' '}
                <strong style={{ color: '#658256', fontFamily: 'monospace' }}>+₱{selectedPackage.coachCutAmount.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Gym Net Retained (85%):</span>{' '}
                <strong style={{ color: '#e1c256', fontFamily: 'monospace' }}>₱{selectedPackage.gymRetainedAmount.toLocaleString()}</strong>
              </div>
            </div>

            {/* Step 4: Payment Method Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '8px' }}>
                5. Payment Method & Channel Segregation
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'CASH' ? '2px solid #e1c256' : '1px solid #232938',
                    background: paymentMethod === 'CASH' ? 'rgba(225, 194, 86, 0.12)' : '#161922',
                    color: paymentMethod === 'CASH' ? '#e1c256' : '#9ca3af',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <DollarSign size={16} /> Cash (Physical Drawer)
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('XENDIT')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'XENDIT' ? '2px solid #e1c256' : '1px solid #232938',
                    background: paymentMethod === 'XENDIT' ? 'rgba(225, 194, 86, 0.12)' : '#161922',
                    color: paymentMethod === 'XENDIT' ? '#e1c256' : '#9ca3af',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <CreditCard size={16} /> Xendit (Invoice / QR Ph)
                </button>
              </div>

              {/* Cash Sub-Form */}
              {paymentMethod === 'CASH' && (
                <div style={{ marginTop: '14px', background: '#161922', border: '1px solid #28324a', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>
                        Cash Tendered (PHP) *
                      </label>
                      <input
                        type="number"
                        min={selectedPackage.price}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={`Min: ₱${selectedPackage.price}`}
                        className="ksyn-input"
                        style={{ width: '100%', fontSize: '0.875rem', fontFamily: 'monospace' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>
                        Change Due
                      </label>
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: '#0c0e14',
                        border: '1px solid #232938',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        color: cashChangeDue > 0 ? '#658256' : '#9ca3af',
                        fontFamily: 'monospace'
                      }}>
                        ₱{cashChangeDue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#9ca3af' }}>
                    Active shift drawer balance will increment by <strong style={{ color: '#ffffff' }}>₱{selectedPackage.price.toLocaleString()}</strong>.
                  </div>
                </div>
              )}

              {/* Xendit Sub-Form Details */}
              {paymentMethod === 'XENDIT' && (
                <div style={{ marginTop: '14px', background: '#161922', border: '1px solid #28324a', borderRadius: '10px', padding: '14px', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Will generate a hosted checkout invoice with external ID format: <strong className="mono" style={{ color: '#e1c256' }}>PT-POS-{selectedBranch.code}-[TIMESTAMP]-[HASH]</strong>. Cash drawer balance will remain unchanged.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1f2536', paddingTop: '16px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                className="ksyn-btn ksyn-btn-outline"
                style={{ fontSize: '0.8125rem' }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedMember || !selectedCoachId}
                className="ksyn-btn ksyn-btn-gold"
                style={{ fontSize: '0.8125rem', fontWeight: 800, padding: '10px 22px' }}
              >
                {submitting ? 'Processing...' : paymentMethod === 'CASH' ? `Collect ₱${selectedPackage.price.toLocaleString()} Cash & Activate` : `Generate Xendit POS Invoice`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
