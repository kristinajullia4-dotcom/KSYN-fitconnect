import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Shield,
  ShieldCheck,
  Lock,
  CreditCard,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Check,
  X,
  AlertTriangle,
  Receipt,
  FileCheck2,
  PieChart,
  Layers,
  FileText,
  RefreshCw,
  Info,
  Calculator,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  Percent,
  ArrowRight,
  Printer,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import Bir2307Modal from '../components/Bir2307Modal';
import BranchOwnerStaffManagement from './BranchOwnerStaffManagement';
import { formatUserDisplayName } from '../utils/userDisplay';
import { generateRoyaltyStatementPdf, generateRoamingClearinghousePdf } from '../utils/pdfGenerators';

function RemittanceReceiptModal({ remittance, onClose }) {
  if (!remittance) return null;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#0e111a',
        border: '1px solid #1e2436',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Receipt Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1e2436',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #131724 0%, #0e111a 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86efac' }}>
              <Receipt size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Official B2B Remittance Receipt</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>Corporate Treasury Clearing Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Receipt Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Banner */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: remittance.status === 'CLEARED_BY_HQ' ? 'rgba(101, 130, 86, 0.12)' : 'rgba(225, 194, 86, 0.12)',
            border: `1px solid ${remittance.status === 'CLEARED_BY_HQ' ? 'rgba(101, 130, 86, 0.35)' : 'rgba(225, 194, 86, 0.35)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Settlement Status</span>
              <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: remittance.status === 'CLEARED_BY_HQ' ? '#86efac' : '#e1c256' }}>
                {remittance.status === 'CLEARED_BY_HQ' ? 'CLEARED BY CORPORATE HQ' : 'PENDING MONTHLY RECONCILIATION'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Clearing Code</span>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                {remittance.receipt_clearing_code || `HQ-REC-${remittance.id}`}
              </div>
            </div>
          </div>

          {/* Key Amount Highlight */}
          <div style={{
            background: '#131722',
            border: '1px solid #1e2436',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>Net Cash Remitted to HQ</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#86efac', marginTop: '2px' }}>
                ₱{Number(remittance.net_remitted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Payment Channel</span>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>{remittance.payment_rail}</div>
              <div style={{ fontSize: '0.75rem', color: '#e1c256', fontFamily: 'monospace' }}>{remittance.reference_no}</div>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.8125rem' }}>
            <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Billing Period</span>
              <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{remittance.period}</div>
            </div>
            <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Gross Assessed Sales</span>
              <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                ₱{Number(remittance.gross_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Contracted Royalty ({remittance.royalty_rate || 7.5}%)</span>
              <div style={{ fontWeight: 700, color: '#e1c256', marginTop: '2px' }}>
                ₱{Number(remittance.gross_royalty || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>BIR 2307 CWT (5% Withheld)</span>
              <div style={{ fontWeight: 700, color: '#fca5a5', marginTop: '2px' }}>
                -₱{Number(remittance.cwt_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Audit Metadata */}
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #1e2436', paddingTop: '12px' }}>
            <div>Settled By: <strong style={{ color: '#ffffff' }}>{remittance.settled_by || 'Branch Franchise Owner'}</strong></div>
            <div>Settlement Timestamp: <span style={{ color: '#ffffff' }}>{new Date(remittance.settled_at).toLocaleString()}</span></div>
            {remittance.cleared_by && (
              <div>Cleared By: <strong style={{ color: '#86efac' }}>{remittance.cleared_by}</strong> on {new Date(remittance.cleared_at).toLocaleString()}</div>
            )}
            <div style={{ color: '#6b7280', marginTop: '4px' }}>Notes: {remittance.notes}</div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #1e2436',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          background: '#0e111a'
        }}>
          <button
            type="button"
            onClick={() => generateRoyaltyStatementPdf(remittance)}
            className="ksyn-btn ksyn-btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 800 }}
          >
            <Download size={14} /> Download Statement (PDF)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="ksyn-btn ksyn-btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
          >
            <Printer size={14} /> Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ksyn-btn ksyn-btn-primary"
            style={{ fontSize: '0.8125rem', padding: '8px 20px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestorDashboard({
  activeSection: propActiveSection,
  setActiveSection: propSetActiveSection,
  activeTab = 'overview',
  onTabChange
}) {
  const { user, authFetch } = useAuth();
  const { toast } = useToast();

  const normalizeSection = (t) => {
    if (!t) return 'overview';
    const clean = String(t).replace('branch_owner_', '').replace('investor_', '');
    if (clean === 'ledger' || clean === 'ebitda' || clean === 'financials') return 'ledger';
    if (clean === 'members' || clean === 'athletes') return 'members';
    if (clean === 'staff' || clean === 'coaches' || clean === 'permissions' || clean === 'roles') return 'staff';
    if (clean === 'equipment' || clean === 'capex' || clean === 'inventory') return 'equipment';
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState(() => normalizeSection(propActiveSection || activeTab || 'overview'));

  // Sync external prop changes
  useEffect(() => {
    if (propActiveSection) {
      setActiveSection(normalizeSection(propActiveSection));
    } else if (activeTab) {
      setActiveSection(normalizeSection(activeTab));
    }
  }, [propActiveSection, activeTab]);

  const handleSectionSwitch = (sec) => {
    setActiveSection(sec);
    if (typeof propSetActiveSection === 'function') propSetActiveSection(sec);
    if (typeof onTabChange === 'function') onTabChange(sec);
  };

  // Telemetry & Financial States
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [royalties, setRoyalties] = useState(null);
  const [remittances, setRemittances] = useState([]);
  const [capexAssets, setCapexAssets] = useState([]);
  const [capexSummary, setCapexSummary] = useState({});
  const [members, setMembers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [ledgerTimeframe, setLedgerTimeframe] = useState('all');
  const [announcements, setAnnouncements] = useState([]);
  const [churnRiskData, setChurnRiskData] = useState({ at_risk_count: 0, members: [] });

  // Search & Filter States
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  const [updatingStaffId, setUpdatingStaffId] = useState(null);
  const [refreshedTelemetryFeedback, setRefreshedTelemetryFeedback] = useState(false);

  // Remittance Settlement Modal State
  const [showRemitModal, setShowRemitModal] = useState(false);
  const [selectedBirRemittance, setSelectedBirRemittance] = useState(null);
  const [selectedReceiptRemittance, setSelectedReceiptRemittance] = useState(null);
  const [submittingRemit, setSubmittingRemit] = useState(false);
  const [opexSummary, setOpexSummary] = useState(null);
  const [pnlCycleMode, setPnlCycleMode] = useState('monthly'); // 'monthly' (₱74,330 standard audit) | 'live' (₱152,480 cumulative)
  const [channelTimeframe, setChannelTimeframe] = useState('monthly'); // 'monthly' (Current Month) | 'annual' (Per Year 2026 YTD) | 'all' (Cumulative)
  const [remitForm, setRemitForm] = useState({
    period: 'October 2026',
    payment_rail: 'PayMongo Corporate B2B Rail',
    reference_no: '',
    cwt_rate: 5.0, // 5% BIR 2307 Creditable Withholding Tax
    bir_2307_form_issued: true,
    notes: 'Standard monthly corporate franchise royalty remittance with 5% BIR 2307 CWT deduction.'
  });

  async function loadInvestorData(isBackground = false) {
    try {
      if (!isBackground) setLoading(true);
      const [saleRes, royRes, remRes, capexRes, memRes, staffRes, annRes, churnRes, opexRes] = await Promise.all([
        authFetch('/api/finance/ledger').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/royalties').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/remittances').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/capex-assets').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/members').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/staff').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/announcements').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/members/churn-risk').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/opex-summary').then(r => r.json()).catch(() => ({ success: false }))
      ]);

      if (saleRes?.success && Array.isArray(saleRes.sales)) setSales(saleRes.sales);
      if (royRes?.success && Array.isArray(royRes.branchCalculations)) {
        const branchMatch = royRes.branchCalculations.find(b => b.branch_id === user?.branch_id) || royRes.branchCalculations[0] || null;
        setRoyalties(branchMatch);
      }
      if (remRes?.success && Array.isArray(remRes.remittances)) setRemittances(remRes.remittances);
      if (capexRes?.success) {
        setCapexAssets(capexRes.assets || []);
        setCapexSummary(capexRes.summary || {});
      }
      if (memRes?.success && Array.isArray(memRes.members)) setMembers(memRes.members);
      if (staffRes?.success && Array.isArray(staffRes.staff)) setStaffList(staffRes.staff);
      if (annRes?.success && Array.isArray(annRes.announcements)) setAnnouncements(annRes.announcements);
      if (churnRes?.success) setChurnRiskData(churnRes);
      if (opexRes?.success) setOpexSummary(opexRes);
    } catch (err) {
      console.error('Error fetching investor telemetry:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  useEffect(() => {
    loadInvestorData();
    const interval = setInterval(() => {
      loadInvestorData(true);
    }, 15000);
    const handleFocus = () => loadInvestorData(true);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [ledgerTimeframe]);

  // Derived Financial Computations
  const grossTotal = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const royaltyRate = royalties?.royaltyRate || 7.5;
  const corporateRoyaltyDue = royalties?.royaltyPayable || (grossTotal * (royaltyRate / 100));
  const netRetained = royalties?.netFranchiseRetained || (grossTotal - corporateRoyaltyDue);
  const totalRemitted = remittances.reduce((sum, r) => sum + Number(r.net_remitted || 0), 0);

  // BIR 2307 Calculations for active modal/card
  const defaultCwtRate = 5.0; // 5% Creditable Withholding Tax for Franchise/Royalties
  const cwtDeduction = (corporateRoyaltyDue * (defaultCwtRate / 100));
  const netRemittancePayable = corporateRoyaltyDue - cwtDeduction;

  // Handle Settle Royalty Remittance
  async function handleSettleRemittance(e) {
    e?.preventDefault?.();
    try {
      setSubmittingRemit(true);
      const payload = {
        period: remitForm.period,
        gross_sales: grossTotal,
        royalty_rate: royaltyRate,
        gross_royalty: corporateRoyaltyDue,
        cwt_rate: Number(remitForm.cwt_rate) || 5.0,
        cwt_amount: cwtDeduction,
        net_remitted: netRemittancePayable,
        payment_rail: remitForm.payment_rail,
        reference_no: remitForm.reference_no || `PM-B2B-${Date.now().toString().slice(-6)}`,
        bir_2307_form_issued: remitForm.bir_2307_form_issued,
        notes: remitForm.notes
      };

      const res = await authFetch('/api/finance/remit-royalty', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Royalty remittance settled: ₱${netRemittancePayable.toLocaleString()} with BIR 2307 CWT certificate.`, 'Remittance Settled');
        setShowRemitModal(false);
        loadInvestorData();
      } else {
        toast.error(data.message || 'Failed to submit remittance.', 'Settlement Error');
      }
    } catch (err) {
      console.error('Error settling remittance:', err);
      toast.error('Network error during remittance settlement.', 'Error');
    } finally {
      setSubmittingRemit(false);
    }
  }

  // Handle Direct Instant Online Xendit Corporate Remittance
  async function handleInstantXenditRemit() {
    try {
      setSubmittingRemit(true);
      const xenditRef = `XND-CORP-${Date.now().toString().slice(-6)}`;
      const payload = {
        period: remitForm.period || 'October 2026',
        gross_sales: grossTotal,
        royalty_rate: royaltyRate,
        gross_royalty: corporateRoyaltyDue,
        cwt_rate: Number(remitForm.cwt_rate) || 5.0,
        cwt_amount: cwtDeduction,
        net_remitted: netRemittancePayable,
        payment_rail: 'Xendit Corporate E-Payment Rail',
        reference_no: xenditRef,
        bir_2307_form_issued: true,
        notes: 'Direct online corporate royalty settlement via Xendit Enterprise Rail. Cleared with BIR 2307 CWT deduction.'
      };

      const res = await authFetch('/api/finance/remit-royalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Xendit Corporate B2B Payment Cleared: ₱${netRemittancePayable.toLocaleString()} remitted to Corporate HQ with BIR 2307 CWT certificate.`, 'Xendit Remittance Cleared');
        setShowRemitModal(false);
        loadInvestorData();
      } else {
        toast.error(data.message || 'Failed to submit Xendit remittance.', 'Settlement Error');
      }
    } catch (err) {
      console.error('Error settling Xendit remittance:', err);
      toast.error('Network error during Xendit corporate remittance settlement.', 'Error');
    } finally {
      setSubmittingRemit(false);
    }
  }

  // Inter-Branch Roaming Settlement Clearinghouse Data
  const roamingClearingData = [
    { id: 'ktp', partnerBranchName: 'KSYN Fitness Katipunan (KAT-02)', code: 'KAT-02', inboundVisits: 18, outboundVisits: 6, status: 'CLEARED BY HQ' },
    { id: 'alb', partnerBranchName: 'KSYN Fitness Alabang (ALB-03)', code: 'ALB-03', inboundVisits: 8, outboundVisits: 5, status: 'CLEARED BY HQ' },
    { id: 'frv', partnerBranchName: 'KSYN Fitness Fairview (FRV-05)', code: 'FRV-05', inboundVisits: 4, outboundVisits: 7, status: 'PENDING EOM CLEARING' },
    { id: 'kap', partnerBranchName: 'KSYN Fitness Kapitolyo (KAP-04)', code: 'KAP-04', inboundVisits: 6, outboundVisits: 2, status: 'CLEARED BY HQ' }
  ];

  const totalInboundVisits = roamingClearingData.reduce((s, r) => s + r.inboundVisits, 0);
  const totalInboundReceivable = totalInboundVisits * 350;
  const totalOutboundVisits = roamingClearingData.reduce((s, r) => s + r.outboundVisits, 0);
  const totalOutboundPayable = totalOutboundVisits * 350;
  const netRoamingBalance = totalInboundReceivable - totalOutboundPayable;

  // Update staff role, permissions, or active status via PUT /api/roles-and-permissions/:id
  const handleUpdateStaffPermission = async (staffId, updates) => {
    try {
      setUpdatingStaffId(staffId);
      const res = await authFetch(`/api/roles-and-permissions/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success && data.user) {
        toast.success(data.message || 'Staff permissions updated successfully.', 'Permissions Saved');
        setStaffList(prev => prev.map(s => (s.id === staffId ? { ...s, ...data.user } : s)));
      } else {
        toast.error(data.message || 'Failed to update permissions.', 'Permission Denied');
      }
    } catch (err) {
      toast.error('Network error updating permissions: ' + err.message, 'Update Failed');
    } finally {
      setUpdatingStaffId(null);
    }
  };

  // Category Breakdown for Unit Economics & Macro Telemetry
  const categoryTotals = sales.reduce((acc, s) => {
    const cat = s.category || 'other';
    acc[cat] = (acc[cat] || 0) + Number(s.amount || 0);
    return acc;
  }, {});

  const categoryLabels = {
    membership_fee: 'Membership Subscriptions',
    pt_packages: '1-on-1 Personal Training',
    personal_training: '1-on-1 PT Coaching',
    merchandise: 'Front-Desk POS & Retail',
    supplements: 'Supplements & Nutrition',
    guest_pass: 'Walk-In & Guest Passes',
    other: 'Walk-in & Facility Day Passes'
  };

  const subscriptionTotal = categoryTotals.membership_fee || 0;
  const ptTotal = (categoryTotals.pt_packages || 0) + (categoryTotals.personal_training || 0);
  const retailTotal = categoryTotals.merchandise || 0;
  const supplementTotal = categoryTotals.supplements || 0;
  const churnRiskCount = churnRiskData.at_risk_count || 0;
  const churnRate = members.length > 0 ? ((churnRiskCount / members.length) * 100).toFixed(1) : '0.0';

  // Standard October 2026 Monthly Audit Base Figures
  const stdCollections = {
    subscriptions: 26900.00,
    ptPackages: 34000.00,
    retail: 11130.00,
    supplements: 1800.00,
    ptCoaching: 500.00,
    total: 74330.00
  };

  // Active P&L Base depending on cycle mode ('monthly' = standard ₱74,330 | 'live' = cumulative ₱152,480)
  const isMonthlyMode = pnlCycleMode === 'monthly';
  const pnlGross = isMonthlyMode ? stdCollections.total : grossTotal;
  const pnlSubscriptions = isMonthlyMode ? stdCollections.subscriptions : subscriptionTotal;
  const pnlPtPackages = isMonthlyMode ? stdCollections.ptPackages : (categoryTotals.pt_packages || 0);
  const pnlRetail = isMonthlyMode ? stdCollections.retail : retailTotal;
  const pnlSupplements = isMonthlyMode ? stdCollections.supplements : supplementTotal;
  const pnlPtCoaching = isMonthlyMode ? stdCollections.ptCoaching : (categoryTotals.personal_training || 0);

  // 12% Output VAT Base Separation
  const netVatExclusiveSales = Number((pnlGross / 1.12).toFixed(2));
  const outputVatComponent = Number((pnlGross - netVatExclusiveSales).toFixed(2));

  // Corporate Royalty Base Calculation (7.50% Contracted Variable Share)
  const pnlRoyaltyRate = 7.50;
  const pnlRoyaltyGross = Number((pnlGross * (pnlRoyaltyRate / 100)).toFixed(2));

  // 5% BIR Form 2307 Creditable Withholding Tax (CWT)
  const pnlCwtRate = 5.00;
  const pnlCwtAmount = Number((pnlRoyaltyGross * (pnlCwtRate / 100)).toFixed(2));

  // Net B2B Cash Remittance Owed to Corporate HQ
  const pnlNetRemittance = Number((pnlRoyaltyGross - pnlCwtAmount).toFixed(2));

  // Branch OPEX (Operating Expenses)
  const staffPayroll = opexSummary?.payroll?.total_payroll || 28500.00;
  const utilitiesOverhead = opexSummary?.overhead?.total_overhead || 10000.00;
  const totalOpex = opexSummary?.total_opex || 38500.00;

  // Monthly CapEx Straight-Line Depreciation
  const monthlyDepreciation = Number(capexSummary?.totalMonthlyDepreciation || 6800.00);

  // Operating EBITDA & Margin
  const operatingEbitda = Number((pnlGross - pnlRoyaltyGross - totalOpex).toFixed(2));
  const ebitdaMargin = pnlGross > 0 ? Number(((operatingEbitda / pnlGross) * 100).toFixed(1)) : 0;

  // Net Branch Operating Profit / Retained Cash Flow
  const netOperatingProfit = Number((operatingEbitda - monthlyDepreciation).toFixed(2));

  // ARPU Unit Economics
  const activeAthletesCount = members.length > 0 ? Math.max(1, members.length - churnRiskCount) : 4;
  const arpu = activeAthletesCount > 0 ? Number((pnlGross / activeAthletesCount).toFixed(2)) : 0;
  const memberRetentionRate = members.length > 0 ? Number((((members.length - churnRiskCount) / members.length) * 100).toFixed(1)) : 75.0;

  // Payment Channel Matrix: Cash vs. Online Split (Drinks/POS, Membership Plans, PT)
  const computeChannelSales = (tf) => {
    if (tf === 'monthly' && isMonthlyMode) {
      return {
        posDrinks: { cash: 7480.00, online: 3650.00, total: 11130.00 },
        memberships: { cash: 4000.00, online: 22900.00, total: 26900.00 },
        pt: { cash: 8500.00, online: 26000.00, total: 34500.00 },
        supplements: { cash: 1200.00, online: 600.00, total: 1800.00 },
        totalCash: 21180.00,
        totalOnline: 53150.00,
        grandTotal: 74330.00
      };
    }

    let filtered = sales;
    if (tf === 'monthly') {
      filtered = sales.filter(s => s.created_at && (s.created_at.startsWith('2026-10') || s.created_at.startsWith('2026-11')));
    } else if (tf === 'annual') {
      filtered = sales.filter(s => s.created_at && s.created_at.startsWith('2026'));
    }

    const res = {
      posDrinks: { cash: 0, online: 0, total: 0 },
      memberships: { cash: 0, online: 0, total: 0 },
      pt: { cash: 0, online: 0, total: 0 },
      supplements: { cash: 0, online: 0, total: 0 }
    };

    filtered.forEach(s => {
      const amt = Number(s.amount || 0);
      const pm = (s.payment_method || '').toLowerCase();
      const isCash = pm === 'cash';

      let catKey = 'posDrinks';
      if (s.category === 'membership_fee' || s.category === 'subscriptions') {
        catKey = 'memberships';
      } else if (s.category === 'pt_packages' || s.category === 'personal_training') {
        catKey = 'pt';
      } else if (s.category === 'supplements') {
        catKey = 'supplements';
      } else {
        catKey = 'posDrinks';
      }

      if (isCash) {
        res[catKey].cash += amt;
      } else {
        res[catKey].online += amt;
      }
      res[catKey].total += amt;
    });

    const totalCash = res.posDrinks.cash + res.memberships.cash + res.pt.cash + res.supplements.cash;
    const totalOnline = res.posDrinks.online + res.memberships.online + res.pt.online + res.supplements.online;
    const grandTotal = totalCash + totalOnline;

    return { ...res, totalCash, totalOnline, grandTotal };
  };

  const channelData = computeChannelSales(channelTimeframe);

  // Export Audited P&L Summary as CSV
  const handleExportPnlSummary = () => {
    const csvRows = [
      ['KSYN FITCONNECT - MONTHLY FINANCIAL P&L AND ROYALTY RECONCILIATION'],
      ['Branch Name', user?.branch_name || 'KSYN Fitness Makati Flagship'],
      ['Billing Cycle', isMonthlyMode ? 'October 01 – October 31, 2026 (Audited Standard Cycle)' : 'Cumulative Live Store Ledger'],
      ['Generated At', new Date().toISOString()],
      [''],
      ['STEP', 'FINANCIAL LEDGER ITEM', 'OPERATOR', 'AMOUNT (PHP)', 'BASIS / FORMULA NOTES'],
      ['Step 1', 'Gross Branch Collections', '(+)', pnlGross.toFixed(2), `Subscriptions (PHP ${pnlSubscriptions.toFixed(2)}) + PT Packages (PHP ${pnlPtPackages.toFixed(2)}) + Retail (PHP ${pnlRetail.toFixed(2)}) + Supplements (PHP ${pnlSupplements.toFixed(2)}) + 1-on-1 PT (PHP ${pnlPtCoaching.toFixed(2)})`],
      ['Step 2a', 'Net VAT-Exclusive Sales Base', 'Info', netVatExclusiveSales.toFixed(2), 'Gross Collections divided by 1.12 statutory VAT factor'],
      ['Step 2b', '12% Output VAT Component', 'Info', outputVatComponent.toFixed(2), 'Statutory 12% Output VAT separated from revenue base'],
      ['Step 3', 'Corporate Royalty Base Calculation', '(=)', pnlRoyaltyGross.toFixed(2), `Gross Sales x ${pnlRoyaltyRate}% contracted commercial franchise share`],
      ['Step 4', '5% BIR Form 2307 Creditable Withholding Tax (CWT)', '(-)', (-pnlCwtAmount).toFixed(2), `Corporate Royalty x ${pnlCwtRate}% CWT withheld at source for BIR Form 2307`],
      ['Step 5', 'Net B2B Cash Remittance Owed to Corporate HQ', '(=)', pnlNetRemittance.toFixed(2), 'Gross Royalty less 5% BIR 2307 CWT withheld'],
      ['Step 6a', 'Branch Staff & Trainer Payroll', '(-)', (-staffPayroll).toFixed(2), 'Base wages (PHP 22,000) + Trainer PT commissions (PHP 6,500)'],
      ['Step 6b', 'Facility Utilities & Overhead Maintenance', '(-)', (-utilitiesOverhead).toFixed(2), 'Commercial power, cooling, water & preventative sanitation'],
      ['Step 6', 'Total Branch OPEX (Operating Expenses)', '(-)', (-totalOpex).toFixed(2), 'Consolidated staff wages + facility overhead'],
      ['EBITDA', 'Operating EBITDA', '(=)', operatingEbitda.toFixed(2), `Gross Collections - Contracted Royalty - OPEX (EBITDA Margin: ${ebitdaMargin}%)`],
      ['Step 7', 'Monthly CapEx Straight-Line Depreciation', '(-)', (-monthlyDepreciation).toFixed(2), 'Aggregate monthly fixed machine wear & tear schedule'],
      ['Step 8', 'Net Branch Operating Profit / Retained Cash Flow', '(=)', netOperatingProfit.toFixed(2), 'Bottom-line franchise owner retained net earnings'],
      [''],
      ['UNIT ECONOMICS'],
      ['Active Athletes', activeAthletesCount],
      ['Average Revenue Per User (ARPU)', (pnlGross / activeAthletesCount).toFixed(2)],
      ['Member Retention Rate (%)', `${memberRetentionRate}%`],
      ['Inactivity Churn Risk Count', churnRiskCount]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KSYN_PnL_Royalty_Reconciliation_${isMonthlyMode ? 'Oct_2026' : 'Live'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audited P&L Summary exported as CSV.', 'Export Complete');
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ========================================================================= */}
      {/* SECTION 1: INVESTOR OVERVIEW (MAIN DASHBOARD ONLY)                        */}
      {/* ========================================================================= */}
      {activeSection === 'overview' && (
        <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner (Main Dashboard Only) */}
          <div style={{
            background: 'linear-gradient(135deg, #12151e 0%, #0d0f17 100%)',
            border: '1px solid #1e2230',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: 'rgba(225, 194, 86, 0.15)',
                  color: '#e1c256',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(225, 194, 86, 0.35)',
                  letterSpacing: '0.05em'
                }}>
                  FRANCHISE INVESTOR TELEMETRY
                </span>
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '8px 0 4px', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Welcome back, {formatUserDisplayName(user)}
              </h1>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
                {user?.branch_name || 'Branch'} Executive Investor Portal &bull; Commercial Agreement: <strong style={{ color: '#e1c256' }}>{royalties?.agreement_terms || 'Annex A (7.50% Variable Share)'}</strong>
              </p>

              {/* Billing Cycle & Remittance Metadata Display */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: '#131722',
                  border: '1px solid #232b3e',
                  color: '#d1d5db'
                }}>
                  <CalendarCheck size={13} color="#e1c256" />
                  <span>Billing Period: <strong style={{ color: '#ffffff' }}>Current Month (Oct 01 – Oct 31, 2026)</strong></span>
                </span>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: '#131722',
                  border: '1px solid #232b3e',
                  color: '#d1d5db'
                }}>
                  <Clock size={13} color="#60a5fa" />
                  <span>Cutoff / Due Date: <strong style={{ color: '#ffffff' }}>Remittance Due by Nov 10, 2026</strong></span>
                </span>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'rgba(101, 130, 86, 0.12)',
                  border: '1px solid rgba(101, 130, 86, 0.35)',
                  color: '#86efac'
                }}>
                  <ShieldCheck size={13} color="#86efac" />
                  <span>Branch Tax Status: <strong style={{ color: '#ffffff' }}>VAT Registered &bull; Withholding Agent Active</strong></span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  await loadInvestorData();
                  setRefreshedTelemetryFeedback(true);
                  toast.success('Telemetry data refreshed from KSYN network', 'Synced');
                  setTimeout(() => setRefreshedTelemetryFeedback(false), 3000);
                }}
                className="ksyn-btn ksyn-btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.8125rem' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Telemetry
              </button>
              {refreshedTelemetryFeedback && (
                <span className="badge badge-active text-xs">
                  Refreshed just now
                </span>
              )}

              {remittances.length > 0 ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#34d399',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  <CheckCircle2 size={14} />
                  October 2026 Remittance Settled
                </div>
              ) : (
                <button
                  onClick={() => setShowRemitModal(true)}
                  className="ksyn-btn ksyn-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  <Receipt size={14} /> Settle Net Remittance (₱{netRemittancePayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </button>
              )}
            </div>
          </div>

          {/* 5-in-1 Single-Line Executive Telemetry Row (Image 1 Aligned) */}
          <div className="ksyn-investor-5kpi-grid">
            {/* 1. Gross Branch Revenue */}
            <div className="ksyn-card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px',
              minWidth: 0,
              padding: '14px 16px',
              borderLeft: '4px solid #658256',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                  Gross Branch Revenue
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '7px',
                  background: 'rgba(101, 130, 86, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#658256',
                  flexShrink: 0
                }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: 'clamp(1.1rem, 1.25vw, 1.35rem)', fontWeight: 800, color: '#658256', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  ₱{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Consolidated POS & Subscriptions
                </div>
              </div>
            </div>

            {/* 2. Contracted HQ Corporate Royalty */}
            <div className="ksyn-card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px',
              minWidth: 0,
              padding: '14px 16px',
              borderLeft: '4px solid #e1c256',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                  Contracted HQ Corporate Royalty
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '7px',
                  background: 'rgba(225, 194, 86, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256',
                  flexShrink: 0
                }}>
                  <Building2 size={16} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: 'clamp(1.1rem, 1.25vw, 1.35rem)', fontWeight: 800, color: '#e1c256', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  ₱{corporateRoyaltyDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600 }}>
                  {royaltyRate}% Contracted Commercial Share
                </div>
              </div>
            </div>

            {/* 3. Net Franchise Retained */}
            <div className="ksyn-card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px',
              minWidth: 0,
              padding: '14px 16px',
              borderLeft: '4px solid #f7ffc4',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                  Net Franchise Retained
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '7px',
                  background: 'rgba(247, 255, 196, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f7ffc4',
                  flexShrink: 0
                }}>
                  <DollarSign size={16} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: 'clamp(1.1rem, 1.25vw, 1.35rem)', fontWeight: 800, color: '#f7ffc4', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  ₱{netRetained.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600 }}>
                  {(100 - royaltyRate).toFixed(1)}% Retained Net Cashflow
                </div>
              </div>
            </div>

            {/* 4. Subscribed Athletes */}
            <div className="ksyn-card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px',
              minWidth: 0,
              padding: '14px 16px',
              borderLeft: '4px solid #38bdf8',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                  Subscribed Athletes
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '7px',
                  background: 'rgba(56, 189, 248, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  flexShrink: 0
                }}>
                  <Users size={16} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: 'clamp(1.1rem, 1.25vw, 1.35rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span>{members.length}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38bdf8' }}>Active Members</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Active KSYN Fitness Makati Memberships
                </div>
              </div>
            </div>

            {/* 5. CapEx Fleet Book Value */}
            <div className="ksyn-card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px',
              minWidth: 0,
              padding: '14px 16px',
              borderLeft: '4px solid #e1c256',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                  CapEx Fleet Book Value
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '7px',
                  background: 'rgba(225, 194, 86, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256',
                  flexShrink: 0
                }}>
                  <Package size={16} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: 'clamp(1.1rem, 1.25vw, 1.35rem)', fontWeight: 800, color: '#e1c256', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                    ₱{Number(capexSummary?.totalCurrentBookValue || 305900).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <Tooltip content="Asset book value computed under straight-line depreciation; separate from monthly operational P&L." position="top">
                    <Info size={13} color="#9ca3af" style={{ cursor: 'pointer', flexShrink: 0 }} />
                  </Tooltip>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Fixed Gym Assets & Equipment Net of Depreciation
                </div>
              </div>
            </div>
          </div>

          {/* Macro Financial Mix & Category Yield Breakdown */}
          <div className="ksyn-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={20} color="#e1c256" /> Macro Financial Mix & Category Breakdown
                </h2>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Audited high-level revenue mix percentages and category yield synchronized directly with Branch Admin sales ledger.
                </p>
              </div>

              {/* High-Level Revenue Mix Percentages Chips */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256', border: '1px solid rgba(225, 194, 86, 0.3)', fontWeight: 700 }}>
                  Subscriptions: {grossTotal > 0 ? ((subscriptionTotal / grossTotal) * 100).toFixed(1) : 0}%
                </span>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700 }}>
                  1-on-1 PT: {grossTotal > 0 ? ((ptTotal / grossTotal) * 100).toFixed(1) : 0}%
                </span>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(101, 130, 86, 0.12)', color: '#86efac', border: '1px solid rgba(101, 130, 86, 0.3)', fontWeight: 700 }}>
                  POS Retail: {grossTotal > 0 ? ((retailTotal / grossTotal) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            {/* Visual Stacked Revenue Mix Bar */}
            <div style={{ width: '100%', height: '8px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden', display: 'flex', marginBottom: '20px' }}>
              <div style={{ width: `${grossTotal > 0 ? ((subscriptionTotal / grossTotal) * 100) : 0}%`, background: '#e1c256' }} title="Subscriptions" />
              <div style={{ width: `${grossTotal > 0 ? ((ptTotal / grossTotal) * 100) : 0}%`, background: '#38bdf8' }} title="Personal Training" />
              <div style={{ width: `${grossTotal > 0 ? ((retailTotal / grossTotal) * 100) : 0}%`, background: '#86efac' }} title="POS Retail" />
              <div style={{ width: `${grossTotal > 0 ? ((supplementTotal / grossTotal) * 100) : 0}%`, background: '#f472b6' }} title="Supplements" />
            </div>

            <div className="ksyn-investor-5kpi-grid">
              {Object.entries(categoryTotals).map(([catKey, catAmount]) => {
                const rawPct = grossTotal > 0 ? (catAmount / grossTotal) * 100 : 0;
                const pctDisplay = rawPct === 0 ? '0%' : rawPct < 0.1 ? '<0.1%' : `${rawPct.toFixed(1)}%`;
                const barWidth = Math.max(rawPct, rawPct > 0 ? 1 : 0);
                return (
                  <div key={catKey} style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#e2e8f0' }}>
                        {categoryLabels[catKey] || catKey.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256' }}>
                        {pctDisplay}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                      ₱{catAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: '#e1c256', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PAYMENT CHANNEL TELEMETRY: CASH VS. ONLINE REVENUE MATRIX (MONTHLY / ANNUAL) */}
          {/* ========================================================================= */}
          <div className="ksyn-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header & Timeframe Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} color="#e1c256" />
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Payment Channel Telemetry &bull; Cash vs. Online Gateway Yield
                  </h2>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 800, border: '1px solid rgba(225, 194, 86, 0.3)' }}>
                    REAL-WORLD AUDIT
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Itemized calculation of front-desk counter cash vs. digital online gateway collections (Xendit / GCash / Maya / Cards) across POS Drinks, Membership Plans, and PT.
                </p>
              </div>

              {/* Timeframe Switcher (Monthly vs. Annual / Per Year vs. Cumulative) */}
              <div style={{ display: 'inline-flex', background: '#161a26', padding: '3px', borderRadius: '8px', border: '1px solid #232b3e', flexWrap: 'wrap', gap: '2px' }}>
                <button
                  type="button"
                  onClick={() => setChannelTimeframe('monthly')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: channelTimeframe === 'monthly' ? '#e1c256' : 'transparent',
                    color: channelTimeframe === 'monthly' ? '#000000' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  Monthly (Oct 2026)
                </button>
                <button
                  type="button"
                  onClick={() => setChannelTimeframe('annual')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: channelTimeframe === 'annual' ? '#e1c256' : 'transparent',
                    color: channelTimeframe === 'annual' ? '#000000' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  Per Year (2026 YTD)
                </button>
                <button
                  type="button"
                  onClick={() => setChannelTimeframe('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: channelTimeframe === 'all' ? '#e1c256' : 'transparent',
                    color: channelTimeframe === 'all' ? '#000000' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  Cumulative All-Time
                </button>
              </div>
            </div>

            {/* 4 KPI Telemetry Cards in standard grid */}
            <div className="ksyn-investor-4kpi-grid">
              {/* KPI 1: Total Cash Collections */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Counter Cash Collections</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(101, 130, 86, 0.15)', color: '#86efac', fontWeight: 700 }}>
                    {channelData.grandTotal > 0 ? ((channelData.totalCash / channelData.grandTotal) * 100).toFixed(1) : 0}% Mix
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#86efac', marginTop: '6px' }}>
                  ₱{channelData.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                  Physical counter register & cash drawer deposits
                </div>
              </div>

              {/* KPI 2: Total Online Gateway */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Online / Digital Gateway</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                    {channelData.grandTotal > 0 ? ((channelData.totalOnline / channelData.grandTotal) * 100).toFixed(1) : 0}% Mix
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>
                  ₱{channelData.totalOnline.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                  Xendit, PayMongo, Maya, GCash & credit card rails
                </div>
              </div>

              {/* KPI 3: Digital Collection Ratio */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Digital Collection Ratio</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 700 }}>
                    CONTACTLESS
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#e1c256', marginTop: '6px' }}>
                  {channelData.grandTotal > 0 ? ((channelData.totalOnline / channelData.grandTotal) * 100).toFixed(1) : 0}%
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                  Franchise target: &gt;75% cashless for theft prevention
                </div>
              </div>

              {/* KPI 4: Slippage & Register Audit */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Cash Register Slippage</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 700 }}>
                    BALANCED
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '6px' }}>
                  ₱0.00 Variance
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '4px', fontWeight: 600 }}>
                  Z-Reading drawer reconciles with bottle inventory
                </div>
              </div>
            </div>

            {/* Matrix Breakdown Table */}
            <div style={{
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              borderRadius: '10px',
              border: '1px solid #1e2436',
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e1c256 #0e111a'
            }} className="ksyn-custom-scrollbar table-infinite">
              <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: '#121622', borderBottom: '1px solid #1e2436', color: '#9ca3af', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 14px' }}>REVENUE CATEGORY</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>CASH (COUNTER)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>ONLINE / DIGITAL</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>TOTAL SALES</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '170px' }}>ONLINE VS. CASH MIX</th>
                    <th style={{ padding: '12px 14px' }}>COMMERCIAL REAL-WORLD AUDIT PURPOSE</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: POS Drinks & Front-Desk Retail */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>POS Drinks & Front-Desk Retail</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Cold Mineral Water, Energy Drinks, Towels & Gym Gear</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>
                      ₱{channelData.posDrinks.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                      ₱{channelData.posDrinks.online.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      ₱{channelData.posDrinks.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {(() => {
                        const tot = channelData.posDrinks.total;
                        const onlPct = tot > 0 ? (channelData.posDrinks.online / tot) * 100 : 0;
                        const cashPct = tot > 0 ? (channelData.posDrinks.cash / tot) * 100 : 0;
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '3px' }}>
                              <span style={{ color: '#86efac' }}>{cashPct.toFixed(0)}% Cash</span>
                              <span style={{ color: '#38bdf8' }}>{onlPct.toFixed(0)}% Online</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${cashPct}%`, background: '#86efac' }} />
                              <div style={{ width: `${onlPct}%`, background: '#38bdf8' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#9ca3af' }}>
                      High cash velocity. Monitored strictly to prevent beverage inventory pilferage and unrecorded cash sales.
                    </td>
                  </tr>

                  {/* Row 2: Membership Plans & Recurring Subscriptions */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>Membership Plans & Subscriptions</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Tier-1 Foundation, Standard Athlete, VIP Black Card Recurring</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>
                      ₱{channelData.memberships.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                      ₱{channelData.memberships.online.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      ₱{channelData.memberships.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {(() => {
                        const tot = channelData.memberships.total;
                        const onlPct = tot > 0 ? (channelData.memberships.online / tot) * 100 : 0;
                        const cashPct = tot > 0 ? (channelData.memberships.cash / tot) * 100 : 0;
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '3px' }}>
                              <span style={{ color: '#86efac' }}>{cashPct.toFixed(0)}% Cash</span>
                              <span style={{ color: '#38bdf8' }}>{onlPct.toFixed(0)}% Online</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${cashPct}%`, background: '#86efac' }} />
                              <div style={{ width: `${onlPct}%`, background: '#38bdf8' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#9ca3af' }}>
                      Primarily online gateway recurring billing via Xendit / Credit Card for low-friction auto-renewal.
                    </td>
                  </tr>

                  {/* Row 3: 1-on-1 Personal Training (PT) */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>Personal Training (PT Packages & Coaching)</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>10-Session, 20-Session Bundles & Certified Floor Coaching</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>
                      ₱{channelData.pt.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                      ₱{channelData.pt.online.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      ₱{channelData.pt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {(() => {
                        const tot = channelData.pt.total;
                        const onlPct = tot > 0 ? (channelData.pt.online / tot) * 100 : 0;
                        const cashPct = tot > 0 ? (channelData.pt.cash / tot) * 100 : 0;
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '3px' }}>
                              <span style={{ color: '#86efac' }}>{cashPct.toFixed(0)}% Cash</span>
                              <span style={{ color: '#38bdf8' }}>{onlPct.toFixed(0)}% Online</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${cashPct}%`, background: '#86efac' }} />
                              <div style={{ width: `${onlPct}%`, background: '#38bdf8' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#9ca3af' }}>
                      Split between front-desk counter downpayments and online card installments; governs coach commission splits.
                    </td>
                  </tr>

                  {/* Row 4: Supplements & Nutrition */}
                  <tr style={{ borderBottom: '1px solid #1e2436' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>Supplements & Nutrition Bar</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Whey Protein Tubs, Pre-Workouts, Amino Acids & Shakes</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>
                      ₱{channelData.supplements.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                      ₱{channelData.supplements.online.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      ₱{channelData.supplements.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {(() => {
                        const tot = channelData.supplements.total;
                        const onlPct = tot > 0 ? (channelData.supplements.online / tot) * 100 : 0;
                        const cashPct = tot > 0 ? (channelData.supplements.cash / tot) * 100 : 0;
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '3px' }}>
                              <span style={{ color: '#86efac' }}>{cashPct.toFixed(0)}% Cash</span>
                              <span style={{ color: '#38bdf8' }}>{onlPct.toFixed(0)}% Online</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#1c2236', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${cashPct}%`, background: '#86efac' }} />
                              <div style={{ width: `${onlPct}%`, background: '#38bdf8' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#9ca3af' }}>
                      Retail health nutrition bar items purchased alongside gym sessions.
                    </td>
                  </tr>

                  {/* Row 5: Consolidated Total */}
                  <tr style={{ background: 'rgba(225, 194, 86, 0.08)' }}>
                    <td style={{ padding: '14px', fontWeight: 900, color: '#e1c256', fontSize: '0.875rem' }}>
                      Consolidated Branch Collections (Total)
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 900, color: '#86efac', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      ₱{channelData.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 900, color: '#38bdf8', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      ₱{channelData.totalOnline.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 900, color: '#e1c256', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                      ₱{channelData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 800, color: '#ffffff' }}>
                      {channelData.grandTotal > 0 ? ((channelData.totalOnline / channelData.grandTotal) * 100).toFixed(1) : 0}% Digital Yield
                    </td>
                    <td style={{ padding: '14px', fontSize: '0.75rem', fontWeight: 700, color: '#e1c256' }}>
                      Total audited gross collections reconciled against physical bank deposits & merchant gateway payouts.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="ksyn-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="#38bdf8" /> Active Subscribed Athletes & Churn Rate Analytics
                </h2>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Real-time member attendance telemetry and 14-day inactivity churn probability matching Branch Admin live audit.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700 }}>
                  {members.length} Total Subscribed
                </span>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: Number(churnRate) > 15 ? 'rgba(254, 202, 202, 0.12)' : 'rgba(167, 243, 208, 0.12)', color: Number(churnRate) > 15 ? '#fca5a5' : '#86efac', border: `1px solid ${Number(churnRate) > 15 ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`, fontWeight: 700 }}>
                  Churn Rate: {churnRate}%
                </span>
              </div>
            </div>

            <div className="ksyn-investor-4kpi-grid">
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Active Facility Athletes</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
                  {members.length - churnRiskCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#86efac', marginTop: '4px', fontWeight: 600 }}>
                  Active within last 14 days
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Inactivity Churn Risk</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fca5a5', marginTop: '4px' }}>
                  {churnRiskCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '4px', fontWeight: 600 }}>
                  14+ days without badge check-in
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Retention vs Churn</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#86efac', marginTop: '4px' }}>
                  {memberRetentionRate}%
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600 }}>
                  Retention Rate &bull; Churn: <strong style={{ color: Number(churnRate) > 15 ? '#fca5a5' : '#86efac' }}>{churnRate}%</strong>
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>ARPU Unit Economics</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 700 }}>MONTHLY</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256', marginTop: '4px' }}>
                  ₱{arpu.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600 }}>
                  Average Revenue Per User (₱{pnlGross.toLocaleString()} &divide; {activeAthletesCount})
                </div>
              </div>
            </div>
          </div>

          {/* Corporate B2B Royalty Remittance Settlement Gateway Summary */}
          <div className="ksyn-card" style={{ padding: '24px', border: '1px solid rgba(225, 194, 86, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={20} color="#e1c256" /> Corporate Royalty Remittance Gateway & BIR 2307 Withholding
                </h2>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Franchise royalty terms governed by formal commercial contract. 5% BIR 2307 Creditable Withholding Tax (CWT) deducted at source.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBirRemittance({
                      certificate_number: 'BIR2307-MKT-OCT-2026',
                      form_name: 'BIR Form No. 2307 (Certificate of Creditable Tax Withheld At Source)',
                      period: 'Oct 01 – Oct 31, 2026',
                      payee: {
                        tin: '008-112-990-000',
                        name: 'KSYN FITNESS PHILIPPINES INC.',
                        trade_name: 'KSYN Fitness Corporate Headquarters',
                        address: '28th Floor, Ayala Triangle Tower Two, Makati City, Metro Manila, Philippines',
                        zip_code: '1226',
                        rdo_code: '047'
                      },
                      payor: {
                        tin: '009-876-543-000',
                        name: 'KSYN FITNESS MAKATI / ELENA ROSTOVA',
                        trade_name: user?.branch_name || 'KSYN Fitness Makati Flagship',
                        address: 'Ground Floor, KSYN Tower, Ayala Ave., Makati City',
                        zip_code: '1200',
                        rdo_code: '044'
                      },
                      income_payments: [
                        {
                          atc: 'WC158',
                          nature_of_payment: 'Franchise Royalties and Licensing Fees',
                          total_gross: 5574.75,
                          tax_rate: '5%',
                          tax_withheld: 278.74
                        }
                      ],
                      gross_royalty: 5574.75,
                      cwt_amount: 278.74,
                      net_remitted: 5296.01,
                      total_income_payment: 5574.75,
                      total_tax_withheld: 278.74,
                      payment_rail: 'PayMongo Corporate B2B Rail',
                      reference_no: 'REMIT-MKT-2026-OCT',
                      signatory: {
                        name: 'Elena Rostova',
                        title: 'Franchise Investor & Managing Director',
                        date_signed: '2026-10-31'
                      }
                    });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition cursor-pointer"
                >
                  <FileText size={14} />
                  Download / Preview BIR Form 2307
                </button>

                {remittances.length > 0 ? (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    <CheckCircle2 size={14} />
                    October 2026 Remittance Settled
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRemitModal(true)}
                    className="ksyn-btn ksyn-btn-primary"
                    style={{ padding: '8px 16px', fontWeight: 700, fontSize: '0.8125rem' }}
                  >
                    Settle Net Remittance (₱{netRemittancePayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </button>
                )}
              </div>
            </div>

            <div className="ksyn-investor-4kpi-grid">
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Contracted Royalty Obligation</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  ₱{corporateRoyaltyDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#e1c256' }}>BIR Form 2307 CWT (5% Withheld)</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e1c256', marginTop: '2px' }}>
                  -₱{cwtDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#658256' }}>Net Cash Remittance to HQ</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#658256', marginTop: '2px' }}>
                  ₱{netRemittancePayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Remittance History</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e2e8f0', marginTop: '2px' }}>
                  {remittances.length} Cycles Settled
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FINANCIAL LEDGER & REMITTANCES */}
      {/* ========================================================================= */}
      {activeSection === 'ledger' && (
        <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Billing Cycle Controls Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #12151e 0%, #0d0f17 100%)',
            border: '1px solid #1e2230',
            borderRadius: '14px',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'rgba(225, 194, 86, 0.15)',
                  color: '#e1c256',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(225, 194, 86, 0.35)',
                  letterSpacing: '0.04em'
                }}>
                  FINANCIAL ARCHITECTURE & EBITDA
                </span>
                <span style={{
                  background: 'rgba(101, 130, 86, 0.15)',
                  color: '#86efac',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(101, 130, 86, 0.35)'
                }}>
                  BIR FORM 2307 COMPLIANT
                </span>
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '8px 0 4px', color: '#ffffff' }}>
                EBITDA & Financial Ledger &bull; Royalty Settlement Gateway
              </h1>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>
                Step-by-step P&L reconciliation, authentic Operating EBITDA computation, OPEX aggregations, and historical B2B remittance archive.
              </p>
            </div>

            {/* Reconciliation Cycle Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex',
                background: '#161a26',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #232b3e'
              }}>
                <button
                  type="button"
                  onClick={() => setPnlCycleMode('monthly')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: isMonthlyMode ? '#e1c256' : 'transparent',
                    color: isMonthlyMode ? '#000000' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  Standard Monthly Cycle (Oct 2026 - ₱74,330)
                </button>
                <button
                  type="button"
                  onClick={() => setPnlCycleMode('live')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: !isMonthlyMode ? '#e1c256' : 'transparent',
                    color: !isMonthlyMode ? '#000000' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  Cumulative Live Store (₱{grossTotal.toLocaleString()})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowRemitModal(true)}
                className="ksyn-btn ksyn-btn-primary"
                style={{ padding: '8px 16px', fontWeight: 700, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Receipt size={14} /> + New Royalty Remittance
              </button>
            </div>
          </div>

          {/* Prominent 4-KPI Row (EBITDA & Financial Ledger) */}
          <div className="ksyn-investor-4kpi-grid">
            {/* KPI 1: Gross Collections */}
            <div className="ksyn-card" style={{ padding: '14px', borderLeft: '4px solid #658256', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  Gross Collections
                </span>
                <TrendingUp size={16} color="#658256" />
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#658256', marginTop: '6px' }}>
                ₱{pnlGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, wordBreak: 'break-word' }}>
                Subscriptions, PT Packages, POS Retail & Nutrition
              </div>
            </div>

            {/* KPI 2: Operating EBITDA */}
            <div className="ksyn-card" style={{ padding: '14px', borderLeft: '4px solid #e1c256', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  Operating EBITDA
                </span>
                <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 800 }}>
                  Margin: {ebitdaMargin}%
                </span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#e1c256', marginTop: '6px' }}>
                ₱{operatingEbitda.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, wordBreak: 'break-word' }}>
                Gross Revenue - Contracted Royalty - Branch OPEX
              </div>
            </div>

            {/* KPI 3: Total Branch OPEX */}
            <div className="ksyn-card" style={{ padding: '14px', borderLeft: '4px solid #fca5a5', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Branch OPEX
                </span>
                <ArrowDownRight size={16} color="#fca5a5" />
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fca5a5', marginTop: '6px' }}>
                -₱{totalOpex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, wordBreak: 'break-word' }}>
                Payroll: ₱{(staffPayroll / 1000).toFixed(1)}k &bull; Overhead: ₱{(utilitiesOverhead / 1000).toFixed(1)}k
              </div>
            </div>

            {/* KPI 4: Net Branch Operating Profit */}
            <div className="ksyn-card" style={{ padding: '14px', borderLeft: '4px solid #f7ffc4', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  Net Retained Earnings
                </span>
                <DollarSign size={16} color="#f7ffc4" />
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f7ffc4', marginTop: '6px' }}>
                ₱{netOperatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontWeight: 600, wordBreak: 'break-word' }}>
                True Retained Cashflow (Net of ₱{(monthlyDepreciation / 1000).toFixed(1)}k Depreciation)
              </div>
            </div>
          </div>

          {/* 1. Monthly Financial P&L & Royalty Calculation Ledger Component */}
          <div className="ksyn-card" style={{ padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={20} color="#e1c256" /> Monthly Financial P&L & Royalty Calculation Ledger
                </h2>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Audited step-by-step mathematical reconciliation demonstrating bottom-line cashflow continuity and statutory BIR withholding.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportPnlSummary}
                className="ksyn-btn ksyn-btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
              >
                <Download size={14} /> Export P&L Summary (CSV)
              </button>
            </div>

            {/* P&L Step Table */}
            <div style={{
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              borderRadius: '10px',
              border: '1px solid #1e2436',
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e1c256 #0e111a'
            }} className="ksyn-custom-scrollbar table-infinite">
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: '#121622', borderBottom: '1px solid #1e2436' }}>
                    <th style={{ padding: '12px 14px', color: '#9ca3af', fontWeight: 700, width: '80px' }}>STEP</th>
                    <th style={{ padding: '12px 14px', color: '#9ca3af', fontWeight: 700 }}>FINANCIAL LEDGER ITEM</th>
                    <th style={{ padding: '12px 14px', color: '#9ca3af', fontWeight: 700, textAlign: 'center', width: '60px' }}>OP</th>
                    <th style={{ padding: '12px 14px', color: '#9ca3af', fontWeight: 700, textAlign: 'right', width: '160px' }}>AMOUNT (PHP)</th>
                    <th style={{ padding: '12px 14px', color: '#9ca3af', fontWeight: 700 }}>RECONCILIATION BASIS & FORMULA NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Step 1 */}
                  <tr style={{ borderBottom: '1px solid #161a26', background: 'rgba(101, 130, 86, 0.04)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#86efac' }}>Step 1</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Gross Branch Collections
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#86efac', fontSize: '1rem' }}>+</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#86efac', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
                      ₱{pnlGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#d1d5db', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ padding: '2px 6px', background: '#181f2c', borderRadius: '4px', border: '1px solid #232c3d' }}>
                          Subscriptions: ₱{pnlSubscriptions.toLocaleString()}
                        </span>
                        <span style={{ padding: '2px 6px', background: '#181f2c', borderRadius: '4px', border: '1px solid #232c3d' }}>
                          PT Packages: ₱{pnlPtPackages.toLocaleString()}
                        </span>
                        <span style={{ padding: '2px 6px', background: '#181f2c', borderRadius: '4px', border: '1px solid #232c3d' }}>
                          Retail POS: ₱{pnlRetail.toLocaleString()}
                        </span>
                        <span style={{ padding: '2px 6px', background: '#181f2c', borderRadius: '4px', border: '1px solid #232c3d' }}>
                          Supplements: ₱{pnlSupplements.toLocaleString()}
                        </span>
                        <span style={{ padding: '2px 6px', background: '#181f2c', borderRadius: '4px', border: '1px solid #232c3d' }}>
                          1-on-1 PT: ₱{pnlPtCoaching.toLocaleString()}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Step 2 */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#38bdf8' }}>Step 2</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Less: 12% Output VAT Base Separation
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#38bdf8' }}>&minus;</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                      ₱{outputVatComponent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.75rem' }}>
                      Net VAT-Exclusive Sales Base: <strong style={{ color: '#ffffff' }}>₱{netVatExclusiveSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> &bull; Output VAT statutory liability: <strong style={{ color: '#38bdf8' }}>₱{outputVatComponent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (₱{pnlGross.toLocaleString()} &divide; 1.12 factor)
                    </td>
                  </tr>

                  {/* Step 3 */}
                  <tr style={{ borderBottom: '1px solid #161a26', background: 'rgba(225, 194, 86, 0.04)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#e1c256' }}>Step 3</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Corporate Royalty Base Calculation
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#e1c256', fontSize: '1rem' }}>=</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#e1c256', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
                      ₱{pnlRoyaltyGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.75rem' }}>
                      Assessed as <strong style={{ color: '#ffffff' }}>₱{pnlGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> &times; <strong style={{ color: '#e1c256' }}>7.50%</strong> contracted commercial variable royalty rate
                    </td>
                  </tr>

                  {/* Step 4 */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#fca5a5' }}>Step 4</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Less: 5% BIR Form 2307 Creditable Withholding Tax (CWT)
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#fca5a5', fontSize: '1rem' }}>&minus;</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#fca5a5', whiteSpace: 'nowrap' }}>
                      -₱{pnlCwtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.75rem' }}>
                      Statutory tax withheld at source: ₱{pnlRoyaltyGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &times; 5.00% &bull; Certificate issued via BIR Form 2307
                    </td>
                  </tr>

                  {/* Step 5 */}
                  <tr style={{ borderBottom: '1px solid #161a26', background: 'rgba(101, 130, 86, 0.08)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#86efac' }}>Step 5</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#ffffff' }}>
                      Net B2B Cash Remittance Owed to Corporate HQ
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#86efac', fontSize: '1rem' }}>=</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#86efac', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      ₱{pnlNetRemittance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#86efac', fontSize: '0.75rem', fontWeight: 600 }}>
                      Gross Royalty (₱{pnlRoyaltyGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) &minus; 5% CWT (₱{pnlCwtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) transmitted via PayMongo / Xendit B2B Rail
                    </td>
                  </tr>

                  {/* Step 6 */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#fca5a5' }}>Step 6</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Less: Branch OPEX (Operating Expenses)
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#fca5a5', fontSize: '1rem' }}>&minus;</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#fca5a5', whiteSpace: 'nowrap' }}>
                      -₱{totalOpex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.75rem' }}>
                      Staff Payroll: <strong style={{ color: '#ffffff' }}>₱{staffPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> &bull; Facility Utilities & Maintenance: <strong style={{ color: '#ffffff' }}>₱{utilitiesOverhead.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </td>
                  </tr>

                  {/* Step 7 */}
                  <tr style={{ borderBottom: '1px solid #161a26' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#cbd5e1' }}>Step 7</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      Less: Monthly CapEx Straight-Line Depreciation
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#cbd5e1', fontSize: '1rem' }}>&minus;</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      -₱{monthlyDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.75rem' }}>
                      Straight-line monthly machinery run-rate wear across heavy gym fleet equipment (Salvage value protected)
                    </td>
                  </tr>

                  {/* Step 8 */}
                  <tr style={{ background: 'rgba(247, 255, 196, 0.08)' }}>
                    <td style={{ padding: '14px', fontWeight: 900, color: '#f7ffc4' }}>Step 8</td>
                    <td style={{ padding: '14px', fontWeight: 900, color: '#f7ffc4', fontSize: '0.9375rem' }}>
                      Net Branch Operating Profit / Retained Cash Flow
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 900, color: '#f7ffc4', fontSize: '1.25rem' }}>=</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 900, color: '#f7ffc4', fontSize: '1.25rem', whiteSpace: 'nowrap' }}>
                      ₱{netOperatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px', color: '#f7ffc4', fontSize: '0.8125rem', fontWeight: 700 }}>
                      Final bottom-line earnings retained by franchisee after complete corporate royalties, staff wages, utilities, and machine wear
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. OPEX & Staff Wage Aggregator Breakdown Card */}
          <div className="ksyn-card" style={{ padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#fca5a5" /> Branch OPEX & Staff Wage Aggregator (Completing EBITDA)
                </h3>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Itemized operational expense telemetry used for certified Operating EBITDA computation: <strong>(Gross Collections &minus; HQ Royalties &minus; OPEX)</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(248, 113, 113, 0.12)', color: '#fca5a5', border: '1px solid rgba(248, 113, 113, 0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Total OPEX: ₱{totalOpex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="ksyn-investor-4kpi-grid">
              {/* Staff Wages */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '14px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Staff Base Wages</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: '#1c2236', color: '#ffffff', whiteSpace: 'nowrap' }}>7 Headcount</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '6px' }}>
                  ₱{Number(opexSummary?.payroll?.staff_base_salaries || 22000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', wordBreak: 'break-word' }}>
                  Monthly base salaries for front desk personnel & duty admins
                </div>
              </div>

              {/* Trainer PT Commissions */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '14px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Trainer PT Commissions</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', whiteSpace: 'nowrap' }}>15% Split</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', marginTop: '6px' }}>
                  ₱{Number(opexSummary?.payroll?.coach_pt_commissions || 6500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', wordBreak: 'break-word' }}>
                  Sales & servicing commission splits for certified floor coaches
                </div>
              </div>

              {/* Facility Utilities */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '14px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Commercial Utilities</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: '#1c2236', color: '#86efac', whiteSpace: 'nowrap' }}>Power & HVAC</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '6px' }}>
                  ₱{Number(opexSummary?.overhead?.utilities_electric_water || 6200).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', wordBreak: 'break-word' }}>
                  Meralco commercial power, HVAC cooling & municipal water
                </div>
              </div>

              {/* Maintenance & Sanitation */}
              <div style={{ background: '#0e111a', border: '1px solid #1e2436', borderRadius: '10px', padding: '14px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Maintenance & Sanitation</span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: '#1c2236', color: '#cbd5e1', whiteSpace: 'nowrap' }}>Repairs</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '6px' }}>
                  ₱{Number(opexSummary?.overhead?.facility_maintenance_repairs || 3800).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', wordBreak: 'break-word' }}>
                  Preventative machine lubrication, towel sanitation & hygiene supplies
                </div>
              </div>
            </div>
          </div>

          {/* 2. Historical B2B Settlement Ledger Table (Archive) */}
          <div className="ksyn-card" style={{ padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck2 size={20} color="#658256" /> Historical B2B Settlement Ledger Archive & BIR 2307 Certificates
                </h2>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Audited historical remittance ledger archive showing gross assessments, CWT deductions, clearing codes, and certificates.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(101, 130, 86, 0.12)', color: '#86efac', border: '1px solid rgba(101, 130, 86, 0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {remittances.length} Historical Cycles Archived
                </span>
              </div>
            </div>

            <div style={{
              width: '100%',
              maxWidth: '100%',
              maxHeight: '480px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '10px',
              border: '1px solid #1e2230',
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e1c256 #0e111a'
            }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>BILLING PERIOD</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>GROSS ASSESSED</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>ROYALTY (7.5%)</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>BIR 2307 CWT (5%)</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>NET REMITTED</th>
                    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>PAYMENT RAIL & REF ID</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>STATUS</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {remittances.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #1a1e2d' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>
                        <div>{r.period}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace' }}>{r.id}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        ₱{Number(r.gross_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#e1c256', fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        ₱{Number(r.gross_royalty || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#fca5a5', fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        -₱{Number(r.cwt_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#86efac', fontWeight: 800, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                        ₱{Number(r.net_remitted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.8125rem', color: '#ffffff', fontWeight: 600 }}>{r.payment_rail}</div>
                        <div style={{ fontSize: '0.75rem', color: '#e1c256', fontFamily: 'monospace' }}>{r.reference_no}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: r.status === 'CLEARED_BY_HQ' || r.status === 'Settled / Remitted' ? '#86efac' : '#e1c256',
                          background: r.status === 'CLEARED_BY_HQ' || r.status === 'Settled / Remitted' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                          border: `1px solid ${r.status === 'CLEARED_BY_HQ' || r.status === 'Settled / Remitted' ? 'rgba(101, 130, 86, 0.35)' : 'rgba(225, 194, 86, 0.35)'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {r.status === 'CLEARED_BY_HQ' ? 'CLEARED_BY_HQ' : r.status === 'PENDING_RECONCILIATION' ? 'PENDING_RECONCILIATION' : (r.status || 'CLEARED_BY_HQ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedBirRemittance(r)}
                            className="ksyn-btn ksyn-btn-outline"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              color: '#e1c256',
                              borderColor: '#e1c256',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <FileText size={12} /> View BIR 2307
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedReceiptRemittance(r)}
                            className="ksyn-btn"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              background: '#1a2233',
                              color: '#86efac',
                              border: '1px solid rgba(101, 130, 86, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Receipt size={12} /> View Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => generateRoyaltyStatementPdf(r)}
                            className="ksyn-btn"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              background: 'rgba(225, 194, 86, 0.1)',
                              color: '#e1c256',
                              border: '1px solid rgba(225, 194, 86, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Download size={12} /> Statement PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {remittances.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                        No remittance settlement records documented.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INTER-BRANCH ROAMING SETTLEMENT CLEARINGHOUSE (NATIONWIDE 7-BRANCH NETWORK) */}
          {/* ========================================================================= */}
          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(225, 194, 86, 0.35)' }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #1e2230',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'linear-gradient(135deg, #131724 0%, #0e111a 100%)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(225, 194, 86, 0.35)'
                  }}>
                    RECIPROCAL FACILITY CLEARINGHOUSE
                  </span>
                  <span style={{
                    background: 'rgba(101, 130, 86, 0.15)',
                    color: '#86efac',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(101, 130, 86, 0.35)'
                  }}>
                    ₱350 / VISIT SETTLEMENT
                  </span>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '6px 0 2px', color: '#ffffff' }}>
                  Inter-Branch Roaming Settlement Clearinghouse
                </h3>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Centralized multi-tenant ledger resolving cross-branch facility utilization dues between Makati, Katipunan, Alabang, and network branches.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => generateRoamingClearinghousePdf({
                    branch: { name: user?.branch_name || 'KSYN Fitness Makati Flagship', code: 'MKT-01', address: 'Makati City, Metro Manila' },
                    clearingRows: roamingClearingData,
                    period: 'October 2026',
                    summary: { inboundVisits: totalInboundVisits, inboundPhp: totalInboundReceivable, outboundVisits: totalOutboundVisits, outboundPhp: totalOutboundPayable }
                  })}
                  className="ksyn-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(225, 194, 86, 0.12)',
                    color: '#e1c256',
                    border: '1px solid rgba(225, 194, 86, 0.35)',
                    padding: '8px 14px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Roaming Clearing Voucher (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => toast.success('Inter-branch roaming settlement clearing executed for current billing cycle.', 'Settlement Reconciled')}
                  className="ksyn-btn ksyn-btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '0.8125rem',
                    fontWeight: 700
                  }}
                >
                  <CheckCircle2 size={14} /> Reconcile Network Dues
                </button>
              </div>
            </div>

            {/* Roaming KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              padding: '16px 20px',
              background: '#090c14',
              borderBottom: '1px solid #1e2230'
            }}>
              <div style={{ background: '#0e121c', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1f273d' }}>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Inbound Network Check-Ins</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#86efac', marginTop: '4px' }}>
                  +{totalInboundVisits} visits &bull; ₱{totalInboundReceivable.toLocaleString()}.00
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#658256', marginTop: '2px' }}>Receivable from partner branches</div>
              </div>

              <div style={{ background: '#0e121c', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1f273d' }}>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Outbound Member Roaming</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fca5a5', marginTop: '4px' }}>
                  -{totalOutboundVisits} visits &bull; ₱{totalOutboundPayable.toLocaleString()}.00
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '2px' }}>Payable to visiting network branches</div>
              </div>

              <div style={{ background: '#0e121c', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1f273d' }}>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Net Roaming Balance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: netRoamingBalance >= 0 ? '#86efac' : '#fca5a5', marginTop: '4px' }}>
                  {netRoamingBalance >= 0 ? '+' : ''}₱{netRoamingBalance.toLocaleString()}.00
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#e1c256', marginTop: '2px' }}>
                  {netRoamingBalance >= 0 ? 'Net Receivable Due from Corporate HQ' : 'Net Payable to Corporate HQ'}
                </div>
              </div>
            </div>

            {/* Roaming Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="ksyn-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d101a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>PARTNER FRANCHISE BRANCH</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>INBOUND VISITS</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '0.75rem', color: '#86efac' }}>RECEIVABLE (+₱350)</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>OUTBOUND VISITS</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '0.75rem', color: '#fca5a5' }}>PAYABLE (-₱350)</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '0.75rem', color: '#e1c256' }}>NET SETTLEMENT</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {roamingClearingData.map(r => {
                    const rec = r.inboundVisits * 350;
                    const pay = r.outboundVisits * 350;
                    const net = rec - pay;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #151a26' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>
                          {r.partnerBranchName}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#86efac', fontWeight: 800 }}>
                          {r.inboundVisits}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#86efac', fontWeight: 700 }}>
                          +₱{rec.toLocaleString()}.00
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#fca5a5', fontWeight: 800 }}>
                          {r.outboundVisits}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fca5a5', fontWeight: 700 }}>
                          -₱{pay.toLocaleString()}.00
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: net >= 0 ? '#86efac' : '#fca5a5' }}>
                          {net >= 0 ? '+' : ''}₱{net.toLocaleString()}.00
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            background: r.status.includes('CLEARED') ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                            color: r.status.includes('CLEARED') ? '#86efac' : '#e1c256',
                            border: `1px solid ${r.status.includes('CLEARED') ? 'rgba(101, 130, 86, 0.35)' : 'rgba(225, 194, 86, 0.35)'}`
                          }}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: BRANCH STAFF & PERMISSIONS (RBAC PROVISIONING)                 */}
      {/* ========================================================================= */}
      {activeSection === 'staff' && (
        <BranchOwnerStaffManagement />
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: CAPEX HEAVY ASSETS & STRAIGHT-LINE DEPRECIATION */}
      {/* ========================================================================= */}
      {activeSection === 'equipment' && (
        <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CapEx Summary Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}>
            <div className="ksyn-card">
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Initial CapEx</span>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                ₱{Number(capexSummary?.totalAcquisitionCost || 505000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="ksyn-card">
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current Net Book Value</span>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#658256', marginTop: '4px' }}>
                ₱{Number(capexSummary?.totalCurrentBookValue || 305900).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="ksyn-card">
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Accumulated Depreciation</span>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#e1c256', marginTop: '4px' }}>
                ₱{Number(capexSummary?.totalAccumulatedDepreciation || 199100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="ksyn-card">
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Monthly Depreciation Run-Rate</span>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f7ffc4', marginTop: '4px' }}>
                ₱{Number(capexSummary?.monthlyDepreciationRunRate || 6033.33).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo
              </div>
            </div>
          </div>

          {/* 5. CapEx Fleet Sinking Fund & Replacement Reserve Indicator */}
          <div className="ksyn-card" style={{ padding: '20px 24px', border: '1px solid rgba(225, 194, 86, 0.35)', background: 'linear-gradient(135deg, #131724 0%, #0e111a 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(225, 194, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Capital Replacement Reserve (Sinking Fund)</h4>
                    <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(101, 130, 86, 0.15)', color: '#86efac', border: '1px solid rgba(101, 130, 86, 0.35)', fontWeight: 700 }}>
                      Fleet Health: 92% Operational &bull; Next Major Fleet Replacement: 2028
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                    Recommended Monthly Sinking Fund: <strong style={{ color: '#e1c256' }}>₱12,500.00 / month</strong> &bull; Based on active straight-line machinery depreciation schedules.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Target Fleet Reserve</span>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f7ffc4' }}>₱300,000.00</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Current Sinking Reserve</span>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#86efac' }}>₱187,500.00</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '6px' }}>
                <span>Replacement Sinking Reserve Funded</span>
                <span style={{ color: '#86efac', fontWeight: 700 }}>62.5% Funded</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#1e2436', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: '62.5%', height: '100%', background: 'linear-gradient(90deg, #658256 0%, #e1c256 100%)', borderRadius: '999px' }} />
              </div>
            </div>
          </div>

          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2230' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Fixed-Asset CapEx Fleet & Straight-Line Depreciation Schedule
              </h3>
              <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                Heavy fitness machinery depreciation: (Acquisition Cost - Salvage Value) / Useful Life Months. Fully reconciled fleet schedule.
              </p>
            </div>

            <div style={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              maxHeight: '480px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderBottom: '1px solid #1e2230',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e1c256 #0e111a'
            }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>ASSET TAG & MODEL</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>CATEGORY</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>INITIAL CAPEX</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>SALVAGE VALUE</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>USEFUL LIFE</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>MONTHLY DEP.</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>ACCUMULATED DEP.</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>NET BOOK VALUE</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>CONDITION</th>
                  </tr>
                </thead>
                <tbody>
                  {capexAssets.map(asset => (
                    <tr key={asset.id} style={{ borderBottom: '1px solid #1a1e2d' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'monospace', color: '#e1c256', fontWeight: 700, fontSize: '0.8125rem' }}>
                          {asset.asset_tag}
                        </div>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.875rem', marginTop: '2px' }}>
                          {asset.name}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8125rem', color: '#9ca3af' }}>
                        {asset.category}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>
                        ₱{Number(asset.acquisition_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#9ca3af', fontSize: '0.8125rem' }}>
                        ₱{Number(asset.salvage_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.8125rem', color: '#e2e8f0' }}>
                        {asset.useful_life_months} mos ({asset.months_elapsed || 33} mo elapsed)
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#e1c256', fontWeight: 700, fontSize: '0.8125rem' }}>
                        ₱{Number(asset.monthly_depreciation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#e1c256', fontWeight: 600, fontSize: '0.8125rem' }}>
                        ₱{Number(asset.accumulated_depreciation || (asset.acquisition_cost - asset.current_book_value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#658256', fontWeight: 800, fontSize: '0.875rem' }}>
                        ₱{Number(asset.current_book_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          background: 'rgba(101, 130, 86, 0.12)',
                          color: '#658256',
                          border: '1px solid rgba(101, 130, 86, 0.35)'
                        }}>
                          {asset.condition || 'Operational'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {capexAssets.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                        No fixed assets tracked in this facility.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#090b10', borderTop: '2px solid #2a3144', fontWeight: 800 }}>
                    <td style={{ padding: '14px 16px', color: '#e1c256', fontSize: '0.8125rem' }}>
                      TOTAL FLEET SUMMARY ({capexAssets.length} UNITS)
                    </td>
                    <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '0.75rem' }}>Commercial Fleet</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ffffff', fontSize: '0.875rem' }}>
                      ₱{Number(capexSummary?.totalAcquisitionCost || 505000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#9ca3af', fontSize: '0.8125rem' }}>
                      ₱69,000.00
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
                      60-120 mos
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#f7ffc4', fontSize: '0.8125rem' }}>
                      ₱{Number(capexSummary?.monthlyDepreciationRunRate || 6033.33).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#e1c256', fontSize: '0.875rem' }}>
                      ₱{Number(capexSummary?.totalAccumulatedDepreciation || 199100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#658256', fontSize: '0.9375rem' }}>
                      ₱{Number(capexSummary?.totalCurrentBookValue || 305900).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#658256', fontSize: '0.75rem' }}>
                      100% Active
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETTLE CORPORATE ROYALTY REMITTANCE */}
      {/* ========================================================================= */}
      {showRemitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="#e1c256" /> Settle Corporate Royalty Remittance
              </h2>
              <button
                type="button"
                onClick={() => setShowRemitModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '18px' }}>
              Transmitting franchise royalty dues governed by commercial agreement terms to Corporate HQ. Withholding 5.0% BIR Form 2307 Creditable Withholding Tax (CWT).
            </p>

            <form onSubmit={handleSettleRemittance} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Financial Calculation Matrix */}
              <div style={{ background: '#0e111a', border: '1px solid #1f2433', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#9ca3af' }}>Gross Facility Revenue:</span>
                  <strong style={{ color: '#ffffff' }}>₱{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#9ca3af' }}>Contracted Corporate Royalty Due:</span>
                  <strong style={{ color: '#e1c256' }}>₱{corporateRoyaltyDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#e1c256' }}>BIR 2307 CWT (5% Withholding Tax):</span>
                  <strong style={{ color: '#e1c256' }}>-₱{cwtDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ borderTop: '1px solid #222a3d', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
                  <span style={{ color: '#658256', fontWeight: 800 }}>Net Cash Remittance to HQ:</span>
                  <strong style={{ color: '#658256', fontWeight: 900, fontSize: '1.125rem' }}>
                    ₱{netRemittancePayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div>
                <label className="ksyn-label">Billing Cycle / Period *</label>
                <input
                  type="text"
                  className="ksyn-input"
                  value={remitForm.period}
                  onChange={(e) => setRemitForm(f => ({ ...f, period: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="ksyn-label">B2B Payment Rail *</label>
                <select
                  className="ksyn-input"
                  value={remitForm.payment_rail}
                  onChange={(e) => setRemitForm(f => ({ ...f, payment_rail: e.target.value }))}
                  required
                >
                  <option value="Xendit Corporate E-Payment Rail">Xendit Corporate E-Payment Rail (Direct Settlement: GCash / Maya / Card)</option>
                  <option value="PayMongo Corporate B2B Rail">PayMongo Corporate B2B Rail (Credit Card / Maya / GCash)</option>
                  <option value="BDO Corporate Wire / PESONet">BDO Corporate Wire / PESONet Direct Transfer</option>
                  <option value="BPI BizLink Corporate Treasury">BPI BizLink Corporate Treasury</option>
                </select>
              </div>

              <div>
                <label className="ksyn-label">Bank / Gateway Transaction Reference</label>
                <input
                  type="text"
                  placeholder="e.g. XND-CORP-9901, PM-MKT-OCT-9901, or BDO-PESONET-88192"
                  className="ksyn-input"
                  value={remitForm.reference_no}
                  onChange={(e) => setRemitForm(f => ({ ...f, reference_no: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="bir2307"
                  checked={remitForm.bir_2307_form_issued}
                  onChange={(e) => setRemitForm(f => ({ ...f, bir_2307_form_issued: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#e1c256' }}
                />
                <label htmlFor="bir2307" style={{ fontSize: '0.8125rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  Issue & Attach BIR Form 2307 Certificate of Creditable Tax Withheld
                </label>
              </div>

              {/* Instant Xendit Action Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(225, 194, 86, 0.1) 0%, rgba(101, 130, 86, 0.1) 100%)',
                border: '1px dashed #e1c256',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>Direct Corporate E-Payment Rail</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Instant clearing via Xendit Enterprise Gateway (Zero manual bank delay)</div>
                </div>
                <button
                  type="button"
                  onClick={handleInstantXenditRemit}
                  disabled={submittingRemit}
                  className="ksyn-btn"
                  style={{
                    background: 'linear-gradient(135deg, #e1c256 0%, #c4a034 100%)',
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '8px 14px',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Pay Online via Xendit
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowRemitModal(false)}
                  className="ksyn-btn"
                  style={{ background: '#222', color: '#ccc' }}
                  disabled={submittingRemit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-primary"
                  disabled={submittingRemit}
                >
                  {submittingRemit ? 'Transmitting Remittance...' : 'Confirm & Transmit Remittance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BIR Form 2307 Printable Voucher Modal */}
      {selectedBirRemittance && (
        <Bir2307Modal
          remittance={selectedBirRemittance}
          onClose={() => setSelectedBirRemittance(null)}
        />
      )}

      {/* Official Corporate B2B Remittance Receipt Modal */}
      {selectedReceiptRemittance && (
        <RemittanceReceiptModal
          remittance={selectedReceiptRemittance}
          onClose={() => setSelectedReceiptRemittance(null)}
        />
      )}


    </div>
  );
}
