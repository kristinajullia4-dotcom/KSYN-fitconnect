import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Building2,
  DollarSign,
  Users,
  Package,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Shield,
  CreditCard,
  Wrench,
  Search,
  Filter,
  ArrowRight,
  ArrowRightLeft,
  Edit,
  TrendingUp,
  Clock,
  Check,
  X,
  UserCheck,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Key,
  Globe,
  PackageSearch,
  Send,
  Gift,
  Ticket,
  FileSpreadsheet,
  Sparkles,
  Dumbbell,
  Receipt,
  Trash2,
  Calendar,
  Phone,
  Mail,
  Award,
  Flame,
  UserX,
  Megaphone,
  Printer,
  Tag,
  Star,
  Bell,
  ShoppingCart,
  ExternalLink,
  Download
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { MEMBERSHIP_PLANS, getPlanDetails } from '../config/membershipRates';
import MemberOnboardingWizard from '../components/MemberOnboardingWizard';
import XenditTransactionsLedger from '../components/XenditTransactionsLedger';
import MemberProfileModal from '../components/MemberProfileModal';
import { subscribeToMemberUpgrades, broadcastMemberUpgrade } from '../utils/portalSync';
import { formatUserDisplayName } from '../utils/userDisplay';
import { generateZReadingReportPdf } from '../utils/pdfGenerators';

export default function BranchAdminDashboard({
  activeSection: propActiveSection,
  setActiveSection: propSetActiveSection,
  activeTab = 'overview',
  onTabChange
}) {
  const { user, authFetch } = useAuth();
  const { toast } = useToast();

  const branch = {
    id: user?.branch_id || 'b-mkt-01',
    name: user?.branch_name || 'KSYN Fitness Makati',
    code: user?.branch_code || 'MKT-01'
  };

  const normalizeSection = (val) => {
    if (!val) return 'overview';
    const clean = String(val).replace('branch_admin_', '');
    if (clean === 'equipment' || clean === 'inventory' || clean === 'stock') return 'equipment';
    if (clean === 'ledger' || clean === 'finances' || clean === 'sales') return 'ledger';
    if (clean === 'xendit' || clean === 'xendit_transactions' || clean === 'digital_payments') return 'xendit';
    if (clean === 'members' || clean === 'subscriptions') return 'members';
    if (clean === 'staff' || clean === 'employees' || clean === 'front_desk') return 'staff';
    if (clean === 'shifts' || clean === 'roster' || clean === 'timeclock') return 'staff';
    if (clean === 'profile' || clean === 'profile_settings' || clean === 'settings' || clean === 'admin_profile') return 'profile';
    if (clean === 'lockers_vip' || clean === 'lockers' || clean === 'vip_lockers') return 'lockers_vip';
    if (clean === 'expenses' || clean === 'petty_cash' || clean === 'vouchers') return 'expenses';
    if (clean === 'churn' || clean === 'retention' || clean === 'churn_risk') return 'churn';
    if (clean === 'incidents' || clean === 'maintenance' || clean === 'disciplinary') return 'incidents';
    if (clean === 'free_pass' || clean === 'raffle' || clean === 'pass_raffle') return 'free_pass';
    if (clean === 'announcements' || clean === 'promos' || clean === 'broadcasts') return 'announcements';
    if (clean === 'z_reading' || clean === 'zreading' || clean === 'rollup' || clean === 'drawer' || clean === 'daily_rollup') return 'z_reading';
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState(() => normalizeSection(propActiveSection || activeTab || 'overview'));
  const [isInvestorMode, setIsInvestorMode] = useState(user?.role === 'branch_owner');
  const [ledgerSubView, setLedgerSubView] = useState('sales_royalty'); // 'sales_royalty' | 'xendit' | 'coach_commissions'
  const [coachLedgerData, setCoachLedgerData] = useState(null);
  const [loadingCoachLedger, setLoadingCoachLedger] = useState(false);
  const [coachLedgerSearch, setCoachLedgerSearch] = useState('');
  const [coachLedgerTab, setCoachLedgerTab] = useState('sessions'); // 'sessions' | 'commissions' | 'summary'

  // Sprint 3: Incident & Maintenance Log State
  const [incidents, setIncidents] = useState([]);
  const [incidentFilter, setIncidentFilter] = useState('all');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState('all');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [showLogIncidentModal, setShowLogIncidentModal] = useState(false);
  const [newIncidentForm, setNewIncidentForm] = useState({
    title: '',
    category: 'Turnstile & Hardware',
    severity: 'Medium',
    details: '',
    resolution_notes: ''
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Sprint 3: Floor Stock Burn-Rate Forecaster State
  const [burnRateItems, setBurnRateItems] = useState([]);
  const [burnRateSearch, setBurnRateSearch] = useState('');
  const [burnRateRiskFilter, setBurnRateRiskFilter] = useState('all');

  // Security & Compliance: RA 10173 PII Protection
  const [maskPii, setMaskPii] = useState(true);

  // Sprint 4: Staff Weekly Shift Builder & Timeclock Logs
  const [shifts, setShifts] = useState([]);
  const [timeclockLogs, setTimeclockLogs] = useState([]);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    staff_id: '',
    staff_name: '',
    role: 'Front Desk Staff',
    day_of_week: 'Monday',
    start_time: '06:00',
    end_time: '14:00',
    shift_type: 'Morning'
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  // Sprint 4: VIP Long-Term Locker Leases (₱200 deposit)
  const [vipLockers, setVipLockers] = useState([]);
  const [showAssignLockerModal, setShowAssignLockerModal] = useState(false);
  const [vipLockerForm, setVipLockerForm] = useState({
    locker_number: 'VIP-01',
    member_id: '',
    member_name: '',
    duration_months: 6,
    monthly_fee: 1200,
    deposit_amount: 200,
    pin_code: '8829'
  });
  const [submittingLocker, setSubmittingLocker] = useState(false);

  // Sprint 4: Counter Petty Cash Expense Vouchers
  const [expenses, setExpenses] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Facility Cleaning Supplies',
    payee: 'Ace Hardware Rockwell',
    description: 'Floor disinfectant solution & microfiber mops restock',
    amount: 1450
  });
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Sprint 4: 14-Day Inactivity Churn Risk & Retention Engine
  const [churnRiskMembers, setChurnRiskMembers] = useState([]);
  const [reEngagingId, setReEngagingId] = useState(null);

  // Sprint 4: Cash Drawer Discrepancy Supervisor Witness PIN Modal
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [witnessForm, setWitnessForm] = useState({
    supervisor_pin: '',
    reason: 'Z-Reading cash drawer discrepancy verification',
    variance_amount: 250
  });
  const [verifyingWitness, setVerifyingWitness] = useState(false);

  // Helpers for RA 10173 PII Masking
  const maskEmail = (email) => {
    if (!email) return '—';
    if (!maskPii) return email;
    const parts = email.split('@');
    if (parts.length < 2) return '***';
    const firstChar = parts[0].charAt(0);
    return `${firstChar}***@${parts[1]}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return 'N/A';
    if (!maskPii) return phone;
    const str = String(phone).trim();
    if (str.length >= 10) {
      return `${str.slice(0, 4)}-***-${str.slice(-4)}`;
    }
    return '***-****';
  };

  useEffect(() => {
    if (user?.role === 'branch_owner') {
      setIsInvestorMode(true);
    }
  }, [user?.role]);
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [royalties, setRoyalties] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [crossBranchVisits, setCrossBranchVisits] = useState([]);
  const [allNetworkMembers, setAllNetworkMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Free Pass Raffle states
  const [freePassApplicants, setFreePassApplicants] = useState([]);
  const [freePassWinner, setFreePassWinner] = useState(null);
  const [freePassMonth, setFreePassMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [freePassMonthFilter, setFreePassMonthFilter] = useState('all');
  const [freePassLoading, setFreePassLoading] = useState(false);
  const [freePassSearch, setFreePassSearch] = useState('');
  const [freePassStatusFilter, setFreePassStatusFilter] = useState('all');
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [drawingWinner, setDrawingWinner] = useState(false);

  // Branch Announcements & Promos states
  const [branchAnnouncements, setBranchAnnouncements] = useState([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    type: 'announcement',
    severity: 'info',
    target_audience: 'branch_all',
    promo_code: '',
    discount_percentage: '',
    valid_until: ''
  });

  // Store Manager Daily Roll-up & End-of-Day Z-Reading States
  const [zReadingBusinessDate, setZReadingBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [zReadingConsolidated, setZReadingConsolidated] = useState(null);
  const [loadingZReading, setLoadingZReading] = useState(false);
  const [shiftVarianceSearch, setShiftVarianceSearch] = useState('');

  // Filter & Search states
  const [memberSearch, setMemberSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all');
  const [memberSubTab, setMemberSubTab] = useState('enrolled'); // 'enrolled' or 'cross_branch'
  const [guestSearch, setGuestSearch] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all');
  const [ledgerTimeframe, setLedgerTimeframe] = useState('month'); // 'month' | 'year' | 'six_months' | 'all'
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Modals
  const [showAddMember, setShowAddMember] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(null); // member object
  const [renewPlanId, setRenewPlanId] = useState('12_months');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('credit_card');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showResetPassModal, setShowResetPassModal] = useState(null); // staff object
  const [selectedMemberProfileModal, setSelectedMemberProfileModal] = useState(null);
  const [refreshedMembersFeedback, setRefreshedMembersFeedback] = useState(false);

  // Multi-Tenant Branch Transfer Modal state
  const [transferTargetUser, setTransferTargetUser] = useState(null);
  const [transferTargetBranchId, setTransferTargetBranchId] = useState('b-kat-02');
  const [transferReason, setTransferReason] = useState('Administrative Relocation');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [processingTransferId, setProcessingTransferId] = useState(null);
  const [transferEmailModal, setTransferEmailModal] = useState(null); // transfer request object
  const [transferEmailRecipient, setTransferEmailRecipient] = useState('');
  const [transferEmailRecipientName, setTransferEmailRecipientName] = useState('');
  const [transferEmailSubject, setTransferEmailSubject] = useState('');
  const [transferEmailBody, setTransferEmailBody] = useState('');
  const [sendingTransferEmail, setSendingTransferEmail] = useState(false);
  const [dispatchedTransferIds, setDispatchedTransferIds] = useState(new Set());
  const [resetPassValue, setResetPassValue] = useState('StaffPass@2026!');
  const [showStaffPass, setShowStaffPass] = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);
  const [showGuestCheckInModal, setShowGuestCheckInModal] = useState(false);
  const [guestCheckInMemberId, setGuestCheckInMemberId] = useState('');
  const [guestPaymentMethod, setGuestPaymentMethod] = useState('counter_cash');

  // Weekday Schedule Columns with dynamic dates relative to current active week Monday
  const rotaWeekDays = React.useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + distToMon);

    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, idx) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + idx);
      const m = d.toLocaleString('en-US', { month: 'short' });
      return {
        key: dayName.toLowerCase(),
        name: dayName,
        short: dayName.slice(0, 3),
        dateStr: `${m} ${d.getDate()}`,
        fullLabel: `${dayName} (${m} ${d.getDate()})`
      };
    });
  }, []);

  // Floor Duty Rota State (Frontline Staff & Coaches only - strictly excludes Admin & Owner)
  const [coachRota, setCoachRota] = useState([]);
  const [editingCoachRota, setEditingCoachRota] = useState(null);
  const [showAddRotaModal, setShowAddRotaModal] = useState(false);
  const [rotaPublishMeta, setRotaPublishMeta] = useState({
    is_published: false,
    publish_count: 0,
    remaining_publishes: 2,
    published_at: null,
    week_key: ''
  });
  const [newRotaForm, setNewRotaForm] = useState({
    coach_name: '',
    staff_id: '',
    staff_role: 'coach',
    specialty: 'Head Coach / Hypertrophy',
    monday: '06:00 AM – 02:00 PM (Morning)',
    tuesday: '06:00 AM – 02:00 PM (Morning)',
    wednesday: '06:00 AM – 02:00 PM (Morning)',
    thursday: 'Rest / Off-Duty',
    friday: '02:00 PM – 10:00 PM (Evening)',
    saturday: '08:00 AM – 04:00 PM (Weekend)',
    sunday: 'Rest / Off-Duty'
  });

  // Dedicated Branch Operations Admin Duty Rota State (Home branch administrators only)
  const [adminRota, setAdminRota] = useState([]);
  const [editingAdminRota, setEditingAdminRota] = useState(null);
  const [adminRotaMeta, setAdminRotaMeta] = useState({
    weekly_edits_used: 0,
    weekly_edits_limit: 2,
    weekly_edits_remaining: 2,
    can_edit: true,
    is_published: true,
    publish_count: 0
  });
  const [publishingAdminRota, setPublishingAdminRota] = useState(false);

  // Reorder / Restock Request states
  const [toastMessage, setToastMessage] = useState(null);
  const [reorderRequests, setReorderRequests] = useState([]);
  const [discrepancyModalReq, setDiscrepancyModalReq] = useState(null);
  const [discrepancyForm, setDiscrepancyForm] = useState({ shortageQty: 0, damageNotes: '' });
  const [submittingDiscrepancy, setSubmittingDiscrepancy] = useState(false);
  const [restockModalItem, setRestockModalItem] = useState(null);
  const [restockForm, setRestockForm] = useState({
    requestedQty: 5,
    urgency: 'Normal',
    notes: ''
  });
  const [submittingRestock, setSubmittingRestock] = useState(false);
  const [procurementStatusFilter, setProcurementStatusFilter] = useState('all');
  const [procurementSearch, setProcurementSearch] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Verify and Recount Received Shipment Handler
  async function handleVerifyShipment(requestId, isAccepted, shortageQty = 0, damageNotes = '') {
    try {
      const res = await authFetch(`/api/branch-admin/inventory/reorder-verify/${requestId}`, {
        method: 'POST',
        body: JSON.stringify({
          verification_type: isAccepted ? 'ACCEPTED' : 'DISCREPANCY',
          shortage_qty: shortageQty,
          damage_notes: damageNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        if (isAccepted) {
          toast.success(data.message || 'Shipment verified and added to club stock!', 'Delivery Verified & Recounted');
        } else {
          toast.warning(data.message || 'Discrepancy note escalated to Super Admin HQ.', 'Discrepancy Escalated');
        }
        setDiscrepancyModalReq(null);
        setDiscrepancyForm({ shortageQty: 0, damageNotes: '' });
        loadBranchData(true);
      } else {
        toast.error(data.message || 'Failed to verify shipment.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  // Form states
  const [newMember, setNewMember] = useState({ name: '', dob: '', email: '', password: 'Password123!', phone: '', membership_plan: '1_month', rfid_card_uid: '' });
  const enrollFormData = newMember;
  const setEnrollFormData = setNewMember;
  const [newItem, setNewItem] = useState({ item_name: '', sku: '', category: 'weights', quantity: 10, reorder_threshold: 4, unit_price: 5000 });
  const [equipmentList, setEquipmentList] = useState([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState('all');
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    category: 'strength_machines',
    model: '',
    serial_number: '',
    total_units: 1,
    on_floor: 1,
    in_storage: 0,
    unit_value: 150000,
    status: 'operational',
    assigned_technician: 'FitSupplyGym Engineering Team'
  });
  const [submittingEquipment, setSubmittingEquipment] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    username: '',
    password: 'StaffPass@2026!',
    shift_role: 'Front Desk Staff'
  });

  // Submit Restock Request to HQ
  async function handleSendRestockRequest(e) {
    e.preventDefault();
    if (!restockModalItem) return;
    setSubmittingRestock(true);
    try {
      const res = await authFetch('/api/branch-admin/inventory/reorder-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: restockModalItem.id,
          requestedQty: Number(restockForm.requestedQty) || 1,
          urgency: restockForm.urgency,
          notes: restockForm.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setRestockModalItem(null);
        setRestockForm({ requestedQty: 5, urgency: 'Normal', notes: '' });
        showToast('Restock request submitted to HQ. Super Admin notified.');
        toast.success('Restock request submitted to HQ. Super Admin notified.', 'Reorder Submitted');
        loadBranchData();
      } else {
        alert(data.message || 'Error submitting restock request.');
        toast.error(data.message || 'Error submitting restock request.', 'Reorder Failed');
      }
    } catch (err) {
      alert(err.message || 'Error submitting restock request.');
      toast.error(err.message || 'Error submitting restock request.', 'Error');
    } finally {
      setSubmittingRestock(false);
    }
  }

  // Multi-Tenant Branch Transfer execution handler
  const handleExecuteAdminTransfer = async (e) => {
    e?.preventDefault?.();
    if (!transferTargetUser || !transferTargetBranchId) return;
    setTransferSubmitting(true);
    try {
      const res = await authFetch('/api/branch/transfer-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: transferTargetUser.id,
          targetBranchId: transferTargetBranchId,
          reason: transferReason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Branch transfer failed.');
      }
      toast.success(data.message || 'Transfer request initiated. Awaiting clearance approval.', 'Transfer Submitted');
      setTransferTargetUser(null);
      await loadBranchData();
    } catch (err) {
      toast.error(err.message || 'Failed to transfer user.', 'Transfer Error');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Branch Admin: Verify & Approve 2-Stage Transfer Request
  const handleApproveTransfer = async (requestId) => {
    try {
      setProcessingTransferId(requestId);
      const res = await authFetch(`/api/branch/transfers/${requestId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Approval failed');
      toast.success(data.message || 'Transfer action completed!', data.stage === 1 ? 'Clearance Released' : 'Transfer Finalized');
      await loadBranchData();
    } catch (err) {
      toast.error(err.message, 'Transfer Error');
    } finally {
      setProcessingTransferId(null);
    }
  };

  // Branch Admin: Decline Transfer Request
  const handleRejectTransfer = async (requestId) => {
    const reason = window.prompt('Enter reason for declining transfer:', 'Facility capacity limit or administrative constraints');
    if (reason === null) return;
    try {
      setProcessingTransferId(requestId);
      const res = await authFetch(`/api/branch/transfers/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Decline failed');
      toast.info(data.message || 'Transfer request declined.', 'Declined');
      await loadBranchData();
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setProcessingTransferId(null);
    }
  };

  // Open Inter-Branch Transfer Coordination Email Modal
  const handleOpenTransferEmailModal = (req) => {
    // The recipient is the transferred-to-be branch admin (target facility admin)
    const targetEmail = req.to_branch_admin_email || `admin.${(req.to_branch_code || 'branch').toLowerCase()}@ksyn.com`;
    const targetName = req.to_branch_admin_name || `${req.to_branch_name} Administration`;
    setTransferEmailRecipient(targetEmail);
    setTransferEmailRecipientName(targetName);
    setTransferEmailSubject(`[KSYN Transfer Clearance] Inter-Branch Member Relocation: ${req.user_name} (${req.id})`);
    setTransferEmailBody(
      `Hello ${targetName},\n\nWe are coordinating the inter-facility member transfer clearance for athlete ${req.user_name} (${req.user_email || 'Member'}) wishing to relocate from ${req.from_branch_name} to ${req.to_branch_name}.\n\nPlease review the intake clearance protocol and member records readiness.\n\nBest regards,\n${user?.name || 'Branch Administration'}`
    );
    setTransferEmailModal(req);
  };

  // Dispatch Official Coordination Email to Destination Branch Admin
  const handleSendTransferEmail = async () => {
    if (!transferEmailModal) return;
    setSendingTransferEmail(true);
    try {
      const res = await authFetch(`/api/branch/transfers/${transferEmailModal.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: transferEmailRecipient,
          recipient_name: transferEmailRecipientName,
          subject: transferEmailSubject,
          message: transferEmailBody
        })
      });
      const data = await res.json();
      if (data.success) {
        const dispatchedId = transferEmailModal.id;
        toast.success(`Coordination email dispatched to ${transferEmailRecipient}! Re-queued directly for destination admin.`, 'Dispatched');
        setDispatchedTransferIds(prev => new Set([...prev, dispatchedId]));
        setTransferEmailModal(null);
        setTimeout(() => {
          setPendingTransfers(prev => prev.filter(r => r.id !== dispatchedId));
        }, 1200);
      } else {
        toast.error(data.message || 'Failed to dispatch email.', 'Error');
      }
    } catch (err) {
      toast.error('Error dispatching transfer email: ' + err.message, 'Error');
    } finally {
      setSendingTransferEmail(false);
    }
  };

  // Sync when activeSection or activeTab changes from Layout sidebar
  useEffect(() => {
    const next = normalizeSection(propActiveSection || activeTab);
    if (next) {
      setActiveSection(next);
    }
  }, [propActiveSection, activeTab]);

  const handleSectionSwitch = (newSection) => {
    const target = normalizeSection(newSection);
    setActiveSection(target);
    if (typeof propSetActiveSection === 'function') {
      propSetActiveSection(target);
    }
    if (typeof onTabChange === 'function') {
      onTabChange(target);
    }
  };

  async function fetchLedger(tf = ledgerTimeframe) {
    try {
      setLedgerLoading(true);
      const res = await authFetch(`/api/branch-admin/ledger?timeframe=${tf}`);
      const data = await res.json();
      if (res.ok && data && data.success) {
        setLedgerData(data);
      } else {
        console.warn('Branch ledger empty or unsuccessful response:', data);
        setLedgerData(prev => prev || {
          summary: { grossTotal: 0, royaltyTotal: 0, netTotal: 0, count: 0 },
          ledger: []
        });
      }
    } catch (err) {
      console.error('Error fetching ledger:', err);
      setLedgerData(prev => prev || {
        summary: { grossTotal: 0, royaltyTotal: 0, netTotal: 0, count: 0 },
        ledger: []
      });
    } finally {
      setLedgerLoading(false);
    }
  }

  async function fetchCoachBranchLedger() {
    try {
      setLoadingCoachLedger(true);
      const res = await authFetch('/api/coach/branch-ledger');
      const data = await res.json();
      if (res.ok && data && data.success) {
        setCoachLedgerData(data);
      }
    } catch (err) {
      console.error('Error fetching coach branch ledger:', err);
    } finally {
      setLoadingCoachLedger(false);
    }
  }

  const formatLedgerDateTime = (val) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${datePart} • ${timePart}`;
    } catch {
      return String(val);
    }
  };

  function handleExportLedgerCSV() {
    const branchName = user?.branch_name || ledgerData?.branch?.name || 'KSYN Fitness Makati';
    const branchCode = user?.branch_code || ledgerData?.branch?.code || 'MKT-01';
    const timeframeLabels = {
      month: 'Current Month (October 2026)',
      year: 'Present Year (2026)',
      six_months: 'Past 6 Months',
      all: 'All-Time (Franchise Lifetime)'
    };
    const timeframeLabel = timeframeLabels[ledgerTimeframe] || 'Current Month (October 2026)';
    const generatedOn = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const activeLedger = (ledgerData?.ledger && ledgerData.ledger.length > 0)
      ? ledgerData.ledger
      : (sales || [])
          .filter(s => !user?.branch_id || s.branch_id === user?.branch_id)
          .map(s => {
            const amount = Number(s.amount || 0);
            const royaltyAmount = Number((amount * 0.075).toFixed(2));
            const netAmount = Number((amount * 0.925).toFixed(2));
            let categoryLabel = 'Membership Plan';
            if (s.category === 'guest_pass') categoryLabel = 'Guest Roaming Pass';
            else if (s.category === 'personal_training') categoryLabel = 'Personal Training';
            else if (s.category === 'locker_rental') categoryLabel = 'Locker Rental';
            else if (s.category === 'merchandise') categoryLabel = 'Merchandise';
            else if (s.category === 'supplements') categoryLabel = 'Supplements & Nutrition';
            else if (s.category) categoryLabel = s.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            let paymentChannel = 'CASH';
            const pm = (s.payment_channel || s.payment_method || '').toLowerCase();
            if (pm.includes('auto') || pm.includes('debit') || pm === 'auto_debit') paymentChannel = 'AUTO_DEBIT';
            else if (pm.includes('card') || pm.includes('credit') || pm === 'card') paymentChannel = 'CARD_TERMINAL';
            else if (pm.includes('gcash')) paymentChannel = 'GCASH';
            else if (pm.includes('maya')) paymentChannel = 'MAYA';
            else if (pm.includes('cash')) paymentChannel = 'CASH';

            return {
              id: s.id,
              reference_no: s.reference_no,
              created_at: s.created_at,
              member_name: s.customer_name || 'Walk-in Customer',
              category: categoryLabel,
              raw_category: s.category,
              payment_channel: paymentChannel,
              gross_amount: amount,
              royalty_amount: royaltyAmount,
              net_amount: netAmount,
              remittance_status: s.remittance_status || (new Date(s.created_at) >= new Date('2026-09-01T00:00:00Z') ? 'Pending Settlement' : 'Remitted to HQ')
            };
          });

    const items = activeLedger.filter(item => {
      if (ledgerCategoryFilter !== 'all') {
        if (item.category !== ledgerCategoryFilter && item.raw_category !== ledgerCategoryFilter) {
          return false;
        }
      }
      if (ledgerSearch) {
        const q = ledgerSearch.toLowerCase();
        const ref = (item.reference_no || '').toLowerCase();
        const mem = (item.member_name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const ch = (item.payment_channel || '').toLowerCase();
        if (!ref.includes(q) && !mem.includes(q) && !cat.includes(q) && !ch.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const summary = ledgerData?.summary || {
      grossTotal: items.reduce((acc, i) => acc + Number(i.gross_amount || 0), 0),
      royaltyTotal: items.reduce((acc, i) => acc + Number(i.royalty_amount || 0), 0),
      netTotal: items.reduce((acc, i) => acc + Number(i.net_amount || 0), 0),
      count: items.length
    };

    const headerLines = [
      'KSYN FITNESS FRANCHISE OPERATIONS - SALES & ROYALTY LEDGER',
      `Branch Name:,"${branchName} (${branchCode})"`,
      `Generated On:,"${generatedOn}"`,
      `Report Period:,"${timeframeLabel}"`,
      `Total Transactions:,${summary.count}`,
      `Total Gross Sales (PHP):,${Number(summary.grossTotal).toFixed(2)}`,
      `Total 7.5% Corporate Remittance (PHP):,${Number(summary.royaltyTotal).toFixed(2)}`,
      `Total 92.5% Net Retained (PHP):,${Number(summary.netTotal).toFixed(2)}`,
      '================================================================================',
      'Transaction ID,Date & Time,Member Name,Category,Payment Channel,Gross Amount (PHP),7.5% HQ Royalty (PHP),92.5% Net Retained (PHP),Settlement Status'
    ];

    const dataLines = items.map(item => {
      const cleanId = (item.reference_no || '').replace(/"/g, '""');
      const cleanDate = formatLedgerDateTime(item.created_at);
      const cleanMember = (item.member_name || 'Walk-in Customer').replace(/"/g, '""');
      const cleanCategory = (item.category || '').replace(/"/g, '""');
      const cleanChannel = (item.payment_channel || 'POS / Cash').replace(/"/g, '""');
      const gross = Number(item.gross_amount || 0).toFixed(2);
      const royalty = Number(item.royalty_amount || 0).toFixed(2);
      const net = Number(item.net_amount || 0).toFixed(2);
      const status = (item.remittance_status || 'Pending Settlement').replace(/"/g, '""');

      return `"${cleanId}","${cleanDate}","${cleanMember}","${cleanCategory}","${cleanChannel}",${gross},${royalty},${net},"${status}"`;
    });

    const csvContent = '\uFEFF' + [...headerLines, ...dataLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const cleanTfName = ledgerTimeframe === 'month' ? 'Current_Month' : (ledgerTimeframe === 'year' ? 'Present_Year_2026' : (ledgerTimeframe === 'six_months' ? 'Past_6_Months' : 'All_Time'));
    const filename = `KSYN_${branchCode}_Sales_Ledger_${cleanTfName}_${yyyymmdd}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Ledger exported successfully: ${filename}`);
  }

  async function loadBranchData(isBackground = false) {
    try {
      if (!isBackground && initialLoading) {
        setLoading(true);
      }
      const [memRes, invRes, saleRes, royRes, staffRes, visitsRes, networkMemRes, freePassRes, ledgerRes, incRes, burnRes, shiftsRes, tcRes, lockersRes, expRes, churnRes, annRes, transfersRes, rotaRes, adminRotaRes, eqRes, reorderRes] = await Promise.all([
        authFetch('/api/branch-admin/members').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/inventory').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/ledger').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/finance/royalties').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/staff').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/cross-branch-visits').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/members?limit=100').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/free-pass-applicants').then(r => r.json()).catch(() => ({ success: false })),
        authFetch(`/api/branch-admin/ledger?timeframe=${ledgerTimeframe}`).then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/incidents').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/inventory/burn-rate').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/shifts').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/timeclock').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/lockers/vip').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/expenses').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/members/churn-risk').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/announcements').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch/transfers/pending').then(r => r.json()).catch(() => ({ success: false, requests: [] })),
        authFetch('/api/branch-admin/floor-rota').then(r => r.json()).catch(() => ({ success: false, rota: [] })),
        authFetch('/api/branch-admin/admin-rota').then(r => r.json()).catch(() => ({ success: false, rota: [] })),
        authFetch('/api/inventory/maintenance/schedules').then(r => r.json()).catch(() => ({ success: false })),
        authFetch('/api/branch-admin/inventory/reorder-requests').then(r => r.json()).catch(() => ({ success: false, requests: [] }))
      ]);

      if (memRes?.success) setMembers(memRes.members || []);
      if (invRes?.success) setInventory(invRes.inventory || []);
      if (saleRes?.success) setSales(saleRes.sales || []);
      if (royRes?.success) setRoyalties(royRes.branchCalculations?.[0] || null);
      if (staffRes?.success) setStaffList(staffRes.staff || []);
      if (visitsRes?.success) setCrossBranchVisits(visitsRes.visits || []);
      if (networkMemRes?.success) setAllNetworkMembers(networkMemRes.members || []);
      if (freePassRes?.success) {
        setFreePassApplicants(freePassRes.applicants || []);
        setFreePassWinner(freePassRes.winner || null);
        if (freePassRes.month) setFreePassMonth(freePassRes.month);
      }
      if (ledgerRes?.success) setLedgerData(ledgerRes);
      if (incRes?.success && Array.isArray(incRes.incidents)) setIncidents(incRes.incidents);
      if (burnRes?.success && Array.isArray(burnRes.items)) setBurnRateItems(burnRes.items);
      if (shiftsRes?.success && Array.isArray(shiftsRes.shifts)) setShifts(shiftsRes.shifts);
      if (tcRes?.success && Array.isArray(tcRes.logs)) setTimeclockLogs(tcRes.logs);
      if (lockersRes?.success && Array.isArray(lockersRes.lockers)) setVipLockers(lockersRes.lockers);
      if (expRes?.success && Array.isArray(expRes.expenses)) setExpenses(expRes.expenses);
      if (churnRes?.success && Array.isArray(churnRes.members)) setChurnRiskMembers(churnRes.members);
      if (annRes?.success && Array.isArray(annRes.announcements)) setBranchAnnouncements(annRes.announcements);
      if (transfersRes?.success && Array.isArray(transfersRes.requests)) setPendingTransfers(transfersRes.requests);
      if (rotaRes?.success && Array.isArray(rotaRes.rota)) {
        setCoachRota(rotaRes.rota);
        setRotaPublishMeta({
          is_published: Boolean(rotaRes.is_published),
          publish_count: Number(rotaRes.publish_count || 0),
          remaining_publishes: Number(rotaRes.remaining_publishes !== undefined ? rotaRes.remaining_publishes : (2 - (rotaRes.publish_count || 0))),
          published_at: rotaRes.published_at || null,
          week_key: rotaRes.week_key || ''
        });
      }
      if (adminRotaRes?.success && Array.isArray(adminRotaRes.rota)) {
        setAdminRota(adminRotaRes.rota);
        if (adminRotaRes.weekly_edits_used !== undefined) {
          setAdminRotaMeta({
            weekly_edits_used: Number(adminRotaRes.weekly_edits_used || 0),
            weekly_edits_limit: Number(adminRotaRes.weekly_edits_limit || 2),
            weekly_edits_remaining: Number(adminRotaRes.weekly_edits_remaining !== undefined ? adminRotaRes.weekly_edits_remaining : Math.max(0, 2 - (adminRotaRes.weekly_edits_used || 0))),
            can_edit: Boolean(adminRotaRes.can_edit),
            is_published: Boolean(adminRotaRes.is_published),
            publish_count: Number(adminRotaRes.publish_count || 0)
          });
        }
      }
      if (eqRes?.success && Array.isArray(eqRes.equipment || eqRes.schedules)) {
        setEquipmentList(eqRes.equipment || eqRes.schedules);
      }
      if (reorderRes?.success && Array.isArray(reorderRes.requests)) {
        setReorderRequests(reorderRes.requests);
      }
    } catch (err) {
      console.error('Error loading branch data:', err);
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  }

  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    try {
      await loadBranchData(true);
      toast.success('Branch telemetry and records refreshed.', 'Refreshed');
    } catch (err) {
      toast.error('Failed to refresh data: ' + (err?.message || 'Network error'), 'Refresh Failed');
    } finally {
      setIsManualRefreshing(false);
    }
  }

  async function handleSaveEditedRota(e) {
    e?.preventDefault?.();
    if (!editingCoachRota) return;
    try {
      const res = await authFetch('/api/branch-admin/floor-rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingCoachRota, is_published: rotaPublishMeta.is_published })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoachRota(prev => prev.map(c => c.id === editingCoachRota.id ? { ...editingCoachRota, is_published: rotaPublishMeta.is_published } : c));
        toast.success(`Updated shift rota for ${editingCoachRota.coach_name}${rotaPublishMeta.is_published ? ' (Live)' : ' (Draft)'}`, 'Rota Saved');
        setEditingCoachRota(null);
      } else {
        toast.error(data.message || 'Error updating rota slot.', 'Update Failed');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  async function handleSaveEditedAdminRota(e) {
    e?.preventDefault?.();
    if (!editingAdminRota) return;
    try {
      const res = await authFetch('/api/branch-admin/admin-rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAdminRota)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminRota(prev => prev.map(a => (a.id === editingAdminRota.id || a.staff_id === editingAdminRota.staff_id) ? { ...a, ...editingAdminRota } : a));
        if (data.weekly_edits_used !== undefined) {
          setAdminRotaMeta(prev => ({
            ...prev,
            weekly_edits_used: Number(data.weekly_edits_used),
            weekly_edits_remaining: Number(data.weekly_edits_remaining),
            can_edit: Boolean(data.can_edit)
          }));
        }
        toast.success(
          `Updated and synchronized duty schedule for ${editingAdminRota.coach_name || editingAdminRota.name || 'Branch Admin'} (${data.weekly_edits_used || 1}/2 weekly revisions used)`,
          'Admin Rota Synchronized'
        );
        setEditingAdminRota(null);
        authFetch('/api/branch-admin/admin-rota')
          .then(r => r.json())
          .then(resData => {
            if (resData?.success && Array.isArray(resData.rota)) {
              setAdminRota(resData.rota);
              if (resData.weekly_edits_used !== undefined) {
                setAdminRotaMeta({
                  weekly_edits_used: Number(resData.weekly_edits_used || 0),
                  weekly_edits_limit: Number(resData.weekly_edits_limit || 2),
                  weekly_edits_remaining: Number(resData.weekly_edits_remaining !== undefined ? resData.weekly_edits_remaining : Math.max(0, 2 - (resData.weekly_edits_used || 0))),
                  can_edit: Boolean(resData.can_edit),
                  is_published: Boolean(resData.is_published),
                  publish_count: Number(resData.publish_count || 0)
                });
              }
            }
          })
          .catch(() => {});
      } else {
        toast.error(data.message || 'Error updating admin rota slot.', 'Quota / Update Alert');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  async function handlePublishAdminRota() {
    if (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') {
      toast.error('Weekly edit/publish limit reached (2/2 used across all branch admins). Rota is locked until Monday.', 'Quota Exceeded');
      return;
    }
    setPublishingAdminRota(true);
    try {
      const res = await authFetch('/api/branch-admin/admin-rota/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminRotaMeta(prev => ({
          ...prev,
          weekly_edits_used: Number(data.weekly_edits_used),
          weekly_edits_remaining: Number(data.weekly_edits_remaining),
          can_edit: data.weekly_edits_remaining > 0 || user?.role === 'super_admin',
          is_published: true,
          publish_count: (prev.publish_count || 0) + 1
        }));
        toast.success(data.message || 'Branch Admin Duty Rota published successfully!', 'Rota Published');
      } else {
        toast.error(data.message || 'Failed to publish admin duty rota.', 'Publication Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setPublishingAdminRota(false);
    }
  }

  async function handleSaveNewRotaSlot(e) {
    e?.preventDefault?.();
    if (!newRotaForm.coach_name?.trim()) {
      alert('Please enter or select a coach or staff member name.');
      return;
    }
    try {
      const res = await authFetch('/api/branch-admin/floor-rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRotaForm, is_published: rotaPublishMeta.is_published })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Schedule for ${newRotaForm.coach_name} added to rota${rotaPublishMeta.is_published ? ' (Live)' : ' (Draft)'}.`, 'Schedule Created');
        setShowAddRotaModal(false);
        loadBranchData(true);
      } else {
        toast.error(data.message || 'Error creating rota schedule slot.');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  async function handleDeleteFloorRotaSlot(id) {
    if (!window.confirm('Are you sure you want to remove this schedule slot from the weekly rota? (This only deletes the schedule, not the staff user account).')) return;
    try {
      const res = await authFetch(`/api/branch-admin/floor-rota/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoachRota(prev => prev.filter(r => r.id !== id));
        toast.success('Schedule slot removed from floor rota without affecting user account.', 'Rota Updated');
      } else {
        toast.error(data.message || 'Error removing rota slot.');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  async function handlePublishRota() {
    if (rotaPublishMeta.remaining_publishes <= 0) {
      toast.error(`Weekly publication limit reached (${rotaPublishMeta.publish_count}/2). Branch admins can only publish the rota up to twice a week. The rota refreshes every Monday at midnight.`, 'Publish Limit Reached');
      return;
    }
    try {
      const res = await authFetch('/api/branch-admin/floor-rota/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRotaPublishMeta(prev => ({
          ...prev,
          is_published: true,
          publish_count: Number(data.publish_count || 1),
          remaining_publishes: Number(data.remaining_publishes !== undefined ? data.remaining_publishes : Math.max(0, 2 - (data.publish_count || 1))),
          published_at: data.published_at
        }));
        toast.success(data.message || 'Weekly Floor & Staff Rota published! Shifts are now live across Coach and Staff portals.', 'Rota Synchronized');
        loadBranchData(true);
      } else {
        toast.error(data.message || 'Error publishing rota.', 'Publish Failed');
      }
    } catch (err) {
      toast.error(err.message, 'Error Publishing Rota');
    }
  }

  // Live Refresh for Free Pass Raffle Applicants
  const fetchFreePassApplicants = async (monthOverride) => {
    setFreePassLoading(true);
    try {
      const monthParam = monthOverride !== undefined ? monthOverride : freePassMonthFilter;
      const url = monthParam && monthParam !== 'all' 
        ? `/api/branch-admin/free-pass-applicants?month=${monthParam}`
        : '/api/branch-admin/free-pass-applicants?month=all';
      const res = await authFetch(url);
      const data = await res.json();
      if (data.success) {
        setFreePassApplicants(data.applicants || []);
        setFreePassWinner(data.winner || null);
        if (data.month) setFreePassMonth(data.month);
      }
    } catch (err) {
      console.error('Error loading free pass applicants:', err);
    } finally {
      setFreePassLoading(false);
    }
  };

  // Live Refresh for Branch Announcements & Promos
  const fetchBranchAnnouncements = async () => {
    setAnnouncementLoading(true);
    try {
      const res = await authFetch('/api/branch-admin/announcements');
      const data = await res.json();
      if (data.success) {
        setBranchAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Error loading branch announcements:', err);
    } finally {
      setAnnouncementLoading(false);
    }
  };

  async function handleCreateBranchAnnouncement(e) {
    if (e) e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      alert('Please enter title and message body.');
      return;
    }
    setSubmittingAnnouncement(true);
    try {
      const res = await authFetch('/api/branch-admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Branch announcement published!');
        toast.success(data.message || 'Branch announcement published!', 'Published');
        setBranchAnnouncements(prev => [data.announcement, ...prev]);
        setAnnouncementForm({
          title: '',
          message: '',
          type: 'announcement',
          severity: 'info',
          target_audience: 'branch_all',
          promo_code: '',
          discount_percentage: '',
          valid_until: ''
        });
      } else {
        alert(data.message || 'Failed to post announcement.');
        toast.error(data.message || 'Failed to post announcement.', 'Error');
      }
    } catch (err) {
      toast.error('Network error publishing announcement.', 'Error');
    } finally {
      setSubmittingAnnouncement(false);
    }
  }

  async function handleDeleteBranchAnnouncement(id) {
    try {
      const res = await authFetch(`/api/branch-admin/announcements/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Announcement removed.');
        toast.info(data.message || 'Announcement removed.', 'Archived');
        setBranchAnnouncements(prev => prev.filter(a => a.id !== id));
      } else {
        toast.error(data.message || 'Failed to delete announcement.');
      }
    } catch (err) {
      toast.error('Error deleting announcement.');
    }
  }

  // Store Manager Daily Roll-up & Z-Reading Fetcher
  const fetchZReadingRollup = async (dateStr) => {
    setLoadingZReading(true);
    try {
      const queryDate = dateStr || zReadingBusinessDate;
      const branch = user?.branch_id || 'b-mkt-01';
      const res = await authFetch(`/api/pos/reports/z-reading?date=${queryDate}&branch_id=${branch}`);
      const data = await res.json();
      if (data.success && data.report) {
        setZReadingConsolidated(data.report);
      } else {
        toast.warning(data.message || 'Could not fetch Z-Reading.', 'Report Notice');
      }
    } catch (err) {
      toast.error('Error loading Z-Reading report: ' + err.message, 'Report Error');
    } finally {
      setLoadingZReading(false);
    }
  };

  const handlePrintZReading = (report) => {
    const r = report || zReadingConsolidated;
    const dateStr = r?.business_date || zReadingBusinessDate;
    const branchName = user?.branch_name || 'KSYN Fitness Club';
    const branchCode = user?.branch_code || 'MKT-01';

    const printWindow = window.open('', '_blank', 'width=420,height=750');
    if (!printWindow) {
      toast.error('Unable to open print preview. Please check browser pop-up permissions.', 'Print Error');
      return;
    }

    const grossSales = Number(r?.total_gross_sales || 0);
    const vatableSales = Number(r?.vatable_sales_12pct || (grossSales / 1.12));
    const vatAmount = Number(r?.vat_amount_12pct || (grossSales - vatableSales));
    const vatExempt = Number(r?.vat_exempt_sales || 0);
    const cashSales = Number(r?.total_cash_sales || 0);
    const digitalSales = Number(r?.total_digital_sales || 0);
    const royalty = Number(r?.corporate_royalty_5pct || (grossSales * 0.075));
    const netRetained = Number(r?.net_branch_sales || (grossSales - royalty));
    const shiftsCount = Number(r?.total_shifts || (r?.shifts?.length || 0));
    const totalVariance = Number(r?.total_variance || 0);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Z-Reading Consolidated Report - ${dateStr}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 74mm;
      margin: 0 auto;
      padding: 2mm;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .sub-title { font-size: 9px; text-transform: uppercase; color: #444; margin-top: 2px; }
    .sig-box {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      text-align: center;
      font-size: 9px;
    }
    .line { border-bottom: 1px solid #000; width: 85%; margin: 16px auto 3px auto; }
    @media print {
      body { width: 100%; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 13px;">KSYN FITCONNECT PHILIPPINES</div>
  <div class="center sub-title">${branchName} (${branchCode})</div>
  <div class="center sub-title">POS TERMINAL #01 • MIN: 2026-0923-0192-MIN</div>
  <div class="center sub-title">SN: POS-REG-01-SN482910 • TIN: 009-842-117-000</div>
  <div class="double-divider"></div>
  <div class="center bold" style="font-size: 12px;">OFFICIAL END-OF-DAY Z-READING</div>
  <div class="center sub-title">CONSOLIDATED STORE AUDIT REPORT</div>
  <div class="divider"></div>
  <div class="row"><span>Business Date:</span><span class="bold">${dateStr}</span></div>
  <div class="row"><span>Generated At:</span><span>${new Date().toLocaleString()}</span></div>
  <div class="row"><span>Store Manager:</span><span class="bold">${user?.name || 'Store Manager'}</span></div>
  <div class="row"><span>Shifts Audited:</span><span>${shiftsCount} Shift(s)</span></div>
  <div class="double-divider"></div>

  <div class="center bold" style="font-size: 10px; margin: 4px 0;">FINANCIAL SALES ACCRUAL</div>
  <div class="divider"></div>
  <div class="row"><span>Cash Sales:</span><span>PHP ${cashSales.toFixed(2)}</span></div>
  <div class="row"><span>Digital Sales (Xendit):</span><span>PHP ${digitalSales.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row bold" style="font-size: 12px;"><span>GRAND GROSS SALES:</span><span>PHP ${grossSales.toFixed(2)}</span></div>
  <div class="double-divider"></div>

  <div class="center bold" style="font-size: 10px; margin: 4px 0;">TAX & ROYALTY STATUTORY ROLL-UP</div>
  <div class="divider"></div>
  <div class="row"><span>VATable Sales (12%):</span><span>PHP ${vatableSales.toFixed(2)}</span></div>
  <div class="row"><span>VAT Amount (12%):</span><span>PHP ${vatAmount.toFixed(2)}</span></div>
  <div class="row"><span>VAT-Exempt Sales:</span><span>PHP ${vatExempt.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Franchise Royalty (7.5%):</span><span>PHP ${royalty.toFixed(2)}</span></div>
  <div class="row bold"><span>Net Store Retained:</span><span>PHP ${netRetained.toFixed(2)}</span></div>
  <div class="double-divider"></div>

  <div class="center bold" style="font-size: 10px; margin: 4px 0;">PER-CASHIER SHIFT VARIANCE SUMMARY</div>
  <div class="divider"></div>
  ${(r?.shifts || []).map(s => `
    <div class="row" style="font-size: 9px;">
      <span>${s.cashier_name || 'Cashier'} (${s.shift_id || '01'}):</span>
      <span class="bold">
        ${Number(s.variance || 0) === 0 ? 'PHP 0.00 (Balanced)' : (Number(s.variance || 0) < 0 ? `-PHP ${Math.abs(s.variance).toFixed(2)} (Short)` : `+PHP ${Number(s.variance).toFixed(2)} (Over)`)}
      </span>
    </div>
  `).join('')}
  <div class="divider"></div>
  <div class="row bold" style="font-size: 11px;">
    <span>CUMULATIVE DAY VARIANCE:</span>
    <span>${totalVariance === 0 ? 'PHP 0.00 (BALANCED)' : (totalVariance < 0 ? `-PHP ${Math.abs(totalVariance).toFixed(2)} (SHORT)` : `+PHP ${totalVariance.toFixed(2)} (OVER)`)}</span>
  </div>
  <div class="double-divider"></div>

  <div style="margin-top: 18px;">
    <div class="sig-box">
      <div class="line"></div>
      <div class="bold">${(user?.name || 'STORE MANAGER').toUpperCase()}</div>
      <div>STORE MANAGER / FRANCHISE ADMIN</div>
      <div style="font-size: 8px; color: #555;">Certified daily cash drawer close under BIR regulation.</div>
    </div>

    <div class="sig-box">
      <div class="line"></div>
      <div class="bold">REGIONAL / INTERNAL AUDITOR</div>
      <div>INDEPENDENT WITNESS & AUDITOR</div>
      <div style="font-size: 8px; color: #555;">Verified physical drops & system ledger reconciliation.</div>
    </div>
  </div>

  <div class="divider" style="margin-top: 12px;"></div>
  <div class="center" style="font-size: 8px;">*** BIR OFFICIAL Z-READING CLOSE ACCRUAL ***</div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    toast.success(`Consolidated Z-Report for ${dateStr} ready for printing.`, 'Print Ready');
  };

  useEffect(() => {
    if (activeSection === 'free_pass') {
      fetchFreePassApplicants();
    }
    if (activeSection === 'announcements') {
      fetchBranchAnnouncements();
    }
    if (activeSection === 'z_reading') {
      fetchZReadingRollup(zReadingBusinessDate);
    }
  }, [activeSection]);

  // Sprint 3: Handle logging new incident
  async function handleLogIncident(e) {
    e?.preventDefault?.();
    if (!newIncidentForm.title.trim()) {
      alert('Please enter an incident title.');
      return;
    }

    try {
      setSubmittingIncident(true);
      const res = await authFetch('/api/branch-admin/incidents', {
        method: 'POST',
        body: JSON.stringify(newIncidentForm)
      });
      if (res.ok) {
        toast.success('Incident / maintenance ticket logged.', 'Ticket Logged');
        setShowLogIncidentModal(false);
        setNewIncidentForm({
          title: '',
          category: 'Turnstile & Hardware',
          severity: 'Medium',
          details: '',
          resolution_notes: ''
        });
        loadBranchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to record incident.', 'Error');
      }
    } catch (err) {
      console.error('Error logging incident:', err);
      toast.error('Network error recording incident.', 'Error');
    } finally {
      setSubmittingIncident(false);
    }
  }

  // Sprint 3: Handle updating incident status
  async function handleUpdateIncidentStatus(id, newStatus, resolutionNotes = '') {
    try {
      const res = await authFetch(`/api/branch-admin/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, resolution_notes: resolutionNotes })
      });
      if (res.ok) {
        toast.success(`Incident status updated to ${newStatus}.`, 'Status Updated');
        setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, resolution_notes: resolutionNotes || i.resolution_notes } : i));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to update incident.', 'Error');
      }
    } catch (err) {
      console.error('Error updating incident:', err);
      toast.error('Network error updating incident.', 'Error');
    }
  }

  // Sprint 4: Staff Weekly Shift Assignment
  async function handleAddShift(e) {
    e.preventDefault();
    if (!shiftForm.staff_name || !shiftForm.day_of_week) {
      toast.error('Please specify staff name and day of week.', 'Validation Error');
      return;
    }
    setSubmittingShift(true);
    try {
      const res = await authFetch('/api/branch-admin/shifts', {
        method: 'POST',
        body: JSON.stringify(shiftForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Shift scheduled for ${shiftForm.staff_name} on ${shiftForm.day_of_week}.`, 'Shift Scheduled');
        setShowAddShiftModal(false);
        setShiftForm({
          staff_id: '',
          staff_name: '',
          role: 'Front Desk Staff',
          day_of_week: 'Monday',
          start_time: '06:00',
          end_time: '14:00',
          shift_type: 'Morning'
        });
        loadBranchData();
      } else {
        toast.error(data.message || 'Failed to schedule shift.', 'Error');
      }
    } catch (err) {
      toast.error(err.message || 'Network error scheduling shift.', 'Error');
    } finally {
      setSubmittingShift(false);
    }
  }

  async function handleDeleteShift(shiftId) {
    if (!window.confirm('Are you sure you want to remove this shift?')) return;
    try {
      const res = await authFetch(`/api/branch-admin/shifts/${shiftId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Shift assignment removed.', 'Shift Deleted');
        setShifts(prev => prev.filter(s => s.id !== shiftId));
      } else {
        toast.error(data.message || 'Error removing shift.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  // Sprint 4: VIP Locker Management (₱200 deposit)
  async function handleAssignVipLocker(e) {
    e.preventDefault();
    if (!vipLockerForm.locker_number || !vipLockerForm.member_name) {
      toast.error('Please specify locker number and member.', 'Validation Error');
      return;
    }
    setSubmittingLocker(true);
    try {
      const res = await authFetch('/api/branch-admin/lockers/vip/assign', {
        method: 'POST',
        body: JSON.stringify(vipLockerForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`VIP Locker #${vipLockerForm.locker_number} leased to ${vipLockerForm.member_name}. Deposit: ₱200 recorded.`, 'Locker Leased');
        setShowAssignLockerModal(false);
        loadBranchData();
      } else {
        toast.error(data.message || 'Failed to lease VIP locker.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingLocker(false);
    }
  }

  async function handleReleaseVipLocker(lockerId, lockerNumber) {
    if (!window.confirm(`Release VIP Locker #${lockerNumber} and return ₱200 security deposit?`)) return;
    try {
      const res = await authFetch(`/api/branch-admin/lockers/vip/release`, {
        method: 'POST',
        body: JSON.stringify({ locker_id: lockerId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`VIP Locker #${lockerNumber} released. Security deposit ₱200 returned to member.`, 'Locker Released');
        loadBranchData();
      } else {
        toast.error(data.message || 'Error releasing locker.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  // Sprint 4: Petty Cash Expense Voucher
  async function handleAddExpense(e) {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.payee || !expenseForm.description) {
      toast.error('Please complete expense payee, amount, and description.', 'Validation Error');
      return;
    }
    setSubmittingExpense(true);
    try {
      const res = await authFetch('/api/branch-admin/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Expense voucher ₱${Number(expenseForm.amount).toLocaleString()} issued for ${expenseForm.payee}.`, 'Voucher Issued');
        setShowAddExpenseModal(false);
        setExpenseForm({
          category: 'Facility Cleaning Supplies',
          payee: '',
          description: '',
          amount: ''
        });
        loadBranchData();
      } else {
        toast.error(data.message || 'Failed to record expense.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Sprint 4: Member Retention / 14-Day Churn Re-engagement
  async function handleReEngageMember(memberId, memberName) {
    setReEngagingId(memberId);
    try {
      const res = await authFetch(`/api/branch-admin/members/re-engage/${memberId}`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'sms_push', promo_code: 'COMEBACK20' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Retention alert & COMEBACK20 discount sent to ${memberName} via SMS/Push!`, 'Re-Engagement Dispatched');
      } else {
        toast.error(data.message || 'Failed to send re-engagement message.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setReEngagingId(null);
    }
  }

  // Sprint 4: Supervisor Witness PIN Verification for Drawer Variances
  async function handleVerifySupervisorPin(e) {
    e.preventDefault();
    if (!witnessForm.supervisor_pin) {
      toast.error('Please enter 4-6 digit supervisor PIN.', 'Validation Error');
      return;
    }
    setVerifyingWitness(true);
    try {
      const res = await authFetch('/api/branch-admin/pos/verify-supervisor-pin', {
        method: 'POST',
        body: JSON.stringify(witnessForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Supervisor witness PIN authenticated. Variance ₱${witnessForm.variance_amount} authorized in cryptographic audit log.`, 'Variance Authorized');
        setShowWitnessModal(false);
        setWitnessForm({ supervisor_pin: '', reason: 'Z-Reading cash drawer discrepancy verification', variance_amount: 0 });
      } else {
        toast.error(data.message || 'Invalid supervisor PIN or authorization denied.', 'Verification Failed');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setVerifyingWitness(false);
    }
  }

  useEffect(() => {
    loadBranchData();

    // Live Cross-Portal Subscription: Reflect member upgrades in real time
    const unsubscribe = subscribeToMemberUpgrades((event) => {
      console.log('[BranchAdmin Live Sync] Live plan upgrade received:', event);
      loadBranchData(true);
      toast.success(
        `Athlete ${event.memberName} upgraded to ${event.planName}! Roster updated.`,
        'Live Plan Upgrade'
      );
    });

    // Background auto-refresh polling interval (15s) + Instant on-focus sync
    const pollTimer = setInterval(() => {
      loadBranchData(true);
    }, 15000);

    const handleFocus = () => loadBranchData(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, user?.branch_id]);

  useEffect(() => {
    if (user) {
      fetchLedger(ledgerTimeframe);
      fetchCoachBranchLedger();
    }
  }, [ledgerTimeframe]);

  // Automated System Raffle Draw (1 Winner Limit per Month, Zero Bias / Cryptographically Fair)
  async function handleDrawSystemWinner() {
    setDrawingWinner(true);
    try {
      const res = await authFetch('/api/branch-admin/free-pass/draw-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: freePassMonth })
      });
      const data = await res.json();
      if (data.success) {
        setShowDrawModal(false);
        showToast(data.message || `System Draw Complete! Congratulations to ${data.winner?.full_name}! Single-use QR pass dispatched.`);
        toast.success(`System Draw Complete! Winner: ${data.winner?.full_name}`, 'Raffle Winner Selected');
        loadBranchData();
      } else {
        alert(data.message || 'Error drawing winner.');
        toast.error(data.message || 'Error drawing winner.', 'Draw Failed');
      }
    } catch (err) {
      alert(err.message || 'An error occurred during raffle draw.');
      toast.error(err.message || 'An error occurred during raffle draw.', 'Error');
    } finally {
      setDrawingWinner(false);
    }
  }

  // Add Member
  async function handleAddMember(e) {
    e.preventDefault();
    try {
      const res = await authFetch('/api/auth/provision', {
        method: 'POST',
        body: JSON.stringify({
          ...newMember,
          role: 'member',
          branch_id: user.branch_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddMember(false);
        const assignedRfid = data.user?.rfid_card_uid || newMember.rfid_card_uid || 'Auto-Assigned';
        toast.success(`New athlete profile successfully enrolled: ${newMember.name} (RFID: ${assignedRfid})`, 'Member Enrolled');
        setNewMember({ name: '', dob: '', email: '', password: 'Password123!', phone: '', membership_plan: '1_month', rfid_card_uid: '' });
        loadBranchData();
      } else {
        alert(data.message || 'Error creating member.');
        toast.error(data.message || 'Error creating member.', 'Enrollment Failed');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  // Renew Member Plan with Unified Rate Card
  async function handleRenewPlan(e) {
    e.preventDefault();
    if (!showRenewModal) return;
    try {
      const planInfo = getPlanDetails(renewPlanId);
      const res = await authFetch(`/api/members/${showRenewModal.id}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          plan: renewPlanId,
          tier: planInfo.tier,
          payment_method: renewPaymentMethod
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Membership plan duration successfully extended for ${showRenewModal.name}.`, 'Plan Extended');
        broadcastMemberUpgrade({
          memberId: showRenewModal.id,
          memberName: showRenewModal.name,
          planId: planInfo.id,
          planName: planInfo.name,
          tier: planInfo.tier,
          branchId: user?.branch_id
        });
        setShowRenewModal(null);
        loadBranchData();
      } else {
        alert(data.message || 'Error renewing subscription.');
        toast.error(data.message || 'Error renewing subscription.', 'Renewal Failed');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  // Quick Manual Check-In
  async function handleQuickCheckIn(member) {
    try {
      const res = await authFetch('/api/branch-admin/check-in', {
        method: 'POST',
        body: JSON.stringify({ memberId: member.id, manualMemberId: member.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Check-in verified for ${member.name}! Access granted.`, 'Check-In Granted');
        loadBranchData();
      } else {
        alert(data.message || 'Check-in failed');
        toast.error(data.message || 'Check-in failed', 'Check-In Failed');
      }
    } catch (err) {
      toast.success(`Manual check-in recorded for ${member.name}.`, 'Check-In Verified');
      loadBranchData();
    }
  }

  // Process Guest Roaming Check-In
  async function handleGuestCheckIn(targetMemberId, paymentMethod = 'counter_cash') {
    const memberIdToUse = targetMemberId || guestCheckInMemberId;
    if (!memberIdToUse) {
      alert('Please select a member to check in.');
      toast.warning('Please select a member to check in.', 'Selection Required');
      return;
    }
    try {
      const res = await authFetch('/api/branch-admin/check-in', {
        method: 'POST',
        body: JSON.stringify({
          member_id: memberIdToUse,
          manualMemberId: memberIdToUse,
          payment_method: paymentMethod || guestPaymentMethod
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Cross-branch guest check-in recorded successfully!', 'Guest Checked In');
        setShowGuestCheckInModal(false);
        setGuestCheckInMemberId('');
        loadBranchData();
      } else {
        alert(data.message || 'Error processing cross-branch check-in.');
        toast.error(data.message || 'Error processing cross-branch check-in.', 'Check-In Error');
      }
    } catch (err) {
      alert(err.message || 'An error occurred during check-in.');
      toast.error(err.message || 'An error occurred during check-in.', 'Error');
    }
  }
  // Add Inventory Item
  async function handleAddInventory(e) {
    e.preventDefault();
    try {
      const res = await authFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({ ...newItem, branch_id: user.branch_id })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddInventory(false);
        toast.success(`Inventory asset '${newItem.item_name}' added to branch roster.`, 'Asset Registered');
        setNewItem({ item_name: '', sku: '', category: 'weights', quantity: 10, reorder_threshold: 4, unit_price: 5000 });
        loadBranchData();
      } else {
        alert(data.message);
        toast.error(data.message || 'Error registering item.', 'Inventory Error');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  // Add Physical Gym Equipment Asset
  async function handleAddEquipment(e) {
    e.preventDefault();
    if (!newEquipment.name.trim()) {
      toast.error('Equipment name is required.', 'Validation Error');
      return;
    }
    try {
      setSubmittingEquipment(true);
      const floorQty = Math.max(0, Number(newEquipment.on_floor || 0));
      const storageQty = Math.max(0, Number(newEquipment.in_storage || 0));
      const res = await authFetch('/api/inventory/maintenance/equipment', {
        method: 'POST',
        body: JSON.stringify({
          ...newEquipment,
          total_units: floorQty + storageQty,
          on_floor: floorQty,
          in_storage: storageQty,
          branch_id: user?.branch_id || 'b-mkt-01'
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddEquipment(false);
        toast.success(`Gym asset '${newEquipment.name}' registered to club floor.`, 'Asset Registered');
        setNewEquipment({
          name: '',
          category: 'strength_machines',
          model: '',
          serial_number: '',
          total_units: 1,
          on_floor: 1,
          in_storage: 0,
          unit_value: 150000,
          status: 'operational',
          assigned_technician: 'FitSupplyGym Engineering Team'
        });
        loadBranchData(true);
      } else {
        toast.error(data.message || 'Error registering equipment asset.', 'Equipment Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingEquipment(false);
    }
  }

  // Toggle Gym Machinery Status (Operational vs Under Maintenance)
  async function toggleEquipmentStatus(eqId, currentStatus) {
    const isCurrentlyMaint = currentStatus === 'under_maintenance' || currentStatus === 'critical';
    const newStatus = isCurrentlyMaint ? 'operational' : 'under_maintenance';
    
    // Immediate optimistic local update
    setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, status: newStatus } : eq));

    try {
      const res = await authFetch(`/api/inventory/maintenance/equipment/${eqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.info(`Machinery status updated: ${newStatus === 'operational' ? 'OPERATIONAL' : 'UNDER MAINTENANCE'}.`, 'Machinery Status');
        loadBranchData(true);
      } else {
        // Revert on error
        setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, status: currentStatus } : eq));
        toast.error(data.message || 'Failed to update equipment status.', 'Error');
      }
    } catch (err) {
      setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, status: currentStatus } : eq));
      toast.error(err.message, 'Error');
    }
  }

  // Adjust Equipment Floor vs Storage Units
  async function adjustEquipmentUnits(eqId, currentFloor, currentStorage, isFloor, delta) {
    const newFloor = isFloor ? Math.max(0, currentFloor + delta) : currentFloor;
    const newStorage = !isFloor ? Math.max(0, currentStorage + delta) : currentStorage;
    const newTotal = newFloor + newStorage;

    // Immediate optimistic local update
    setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, on_floor: newFloor, in_storage: newStorage, total_units: newTotal } : eq));

    try {
      const res = await authFetch(`/api/inventory/maintenance/equipment/${eqId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          on_floor: newFloor,
          in_storage: newStorage,
          total_units: newTotal
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.info(`Equipment counts updated (${newFloor} floor, ${newStorage} storage).`, 'Equipment Count');
        loadBranchData(true);
      } else {
        setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, on_floor: currentFloor, in_storage: currentStorage } : eq));
        toast.error(data.message || 'Failed to update equipment count.', 'Error');
      }
    } catch (err) {
      setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, on_floor: currentFloor, in_storage: currentStorage } : eq));
      toast.error(err.message, 'Error');
    }
  }

  // Quick adjust POS item stock (total, floor bar, or pantry storage)
  async function adjustStock(itemId, currentQty, delta, targetField = 'all') {
    try {
      const item = (inventory || []).find(i => i.id === itemId);
      let payload = {};
      if (targetField === 'floor') {
        const curFloor = item?.floor_stock ?? Math.ceil(currentQty * 0.55);
        const newFloor = Math.max(0, curFloor + delta);
        const curStorage = item?.storage_stock ?? Math.max(0, currentQty - curFloor);
        payload = { floor_stock: newFloor, storage_stock: curStorage, quantity: newFloor + curStorage };
      } else if (targetField === 'storage') {
        const curStorage = item?.storage_stock ?? Math.floor(currentQty * 0.45);
        const newStorage = Math.max(0, curStorage + delta);
        const curFloor = item?.floor_stock ?? Math.max(0, currentQty - curStorage);
        payload = { storage_stock: newStorage, floor_stock: curFloor, quantity: curFloor + newStorage };
      } else {
        const newQty = Math.max(0, currentQty + delta);
        payload = { quantity: newQty };
      }
      const res = await authFetch(`/api/inventory/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.info('POS retail stock adjusted.', 'Stock Updated');
        loadBranchData(true);
      } else {
        toast.error(data.message || 'Error updating stock.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  // Toggle Maintenance Status (backward compatibility)
  async function toggleMaintenance(itemId, currentStatus) {
    try {
      const newStatus = currentStatus === 'under_maintenance' ? 'in_stock' : 'under_maintenance';
      await authFetch(`/api/inventory/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      toast.warning(`Equipment status set to: ${newStatus.replace('_', ' ').toUpperCase()}`, 'Equipment Status');
      loadBranchData(true);
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  }

  // Add Branch Staff
  async function handleAddStaff(e) {
    e.preventDefault();
    const cleanName = (newStaff.full_name || '').trim();
    const cleanEmail = (newStaff.email || '').trim().toLowerCase();
    const cleanUsername = (newStaff.username || '').trim().toLowerCase();
    const cleanPhone = (newStaff.phone_number || '').trim();

    if (!cleanName) {
      alert('Full Name is required.');
      toast.warning('Full Name is required.', 'Input Missing');
      return;
    }
    const nameRegex = /^[A-Za-z\s.,'-]+$/;
    if (!nameRegex.test(cleanName)) {
      alert('Full Name may only contain letters, spaces, periods, commas, apostrophes, and hyphens.');
      toast.warning('Invalid characters in Full Name.', 'Validation Error');
      return;
    }
    if (!cleanEmail) {
      alert('Email address is required.');
      toast.warning('Email address is required.', 'Input Missing');
      return;
    }

    try {
      const isCoach = newStaff.shift_role?.toLowerCase()?.includes('coach');
      const res = await authFetch('/api/branch-admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          full_name: cleanName,
          email: cleanEmail,
          username: cleanUsername || cleanEmail.split('@')[0],
          phone_number: cleanPhone,
          password: newStaff.password || 'StaffPass@2026!',
          shift_role: newStaff.shift_role || 'Front Desk Staff',
          role: isCoach ? 'coach' : 'staff'
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddStaffModal(false);
        setNewStaff({
          full_name: '',
          email: '',
          phone_number: '',
          username: '',
          password: 'StaffPass@2026!',
          shift_role: 'Front Desk Staff'
        });
        const roleLabel = isCoach ? 'Coach' : 'Staff';
        showToast(`${roleLabel} account provisioned: ${data.staff?.name || cleanName} is active immediately for login [${data.staff?.username || cleanEmail}].`);
        toast.success(`${roleLabel} account provisioned: ${data.staff?.name || cleanName}`, `${roleLabel} Added`);
        loadBranchData();
      } else {
        alert(data.message || 'Error provisioning staff member.');
        toast.error(data.message || 'Error provisioning staff member.', 'Staff Provision Failed');
      }
    } catch (err) {
      alert(err.message || 'An error occurred while provisioning staff.');
      toast.error(err.message || 'An error occurred while provisioning staff.', 'Error');
    }
  }

  // Toggle Staff Status (Active / Suspended)
  async function handleToggleStaffStatus(staffMember) {
    const newStatus = staffMember.status === 'active' ? 'suspended' : 'active';
    const actionWord = newStatus === 'active' ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${actionWord} the account for ${staffMember.name}?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/branch-admin/staff/${staffMember.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.warning(`Staff account access set to ${newStatus.toUpperCase()} for ${staffMember.name}.`, 'Staff Status Updated');
        loadBranchData();
      } else {
        alert(data.message || 'Error updating staff status.');
        toast.error(data.message || 'Error updating staff status.', 'Error');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  // Reset Staff Password
  async function handleResetStaffPassword(e) {
    e.preventDefault();
    if (!showResetPassModal) return;
    try {
      const res = await authFetch(`/api/branch-admin/staff/${showResetPassModal.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ temporary_password: resetPassValue })
      });
      const data = await res.json();
      if (data.success) {
        toast.info(`Password for ${showResetPassModal.name} successfully updated.`, 'Security Reset');
        alert(`Password for ${showResetPassModal.name} successfully updated.`);
        setShowResetPassModal(null);
        setResetPassValue('StaffPass@2026!');
      } else {
        alert(data.message || 'Error resetting password.');
        toast.error(data.message || 'Error resetting password.', 'Reset Failed');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  if (initialLoading) {
    return <div style={{ color: '#e1c256', padding: '40px', textAlign: 'center' }}>Loading Branch Command Center...</div>;
  }

  // Present-Month Scoped Calculations (Dynamically scoped to active calendar month)
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthLabel = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;

  // Tenant-isolated sales for current logged-in branch (current month)
  const targetBranchId = user?.branch_id;
  const branchSales = (sales || []).filter(s => targetBranchId && s.branch_id === targetBranchId);
  const currentMonthSales = branchSales.filter(s => new Date(s.created_at) >= currentMonthStart);
  const monthGrossRevenue = currentMonthSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const monthTransactionCount = currentMonthSales.length;
  const monthRoyaltyDue = monthGrossRevenue * 0.075;

  // Active gym members belonging strictly to this branch enrolled during current month
  const branchMembers = (members || []).filter(m => targetBranchId && m.branch_id === targetBranchId);
  const activeBranchMembers = branchMembers.filter(m => (m.status === 'active' || m.is_active !== false) && m.is_verified !== false);
  const monthEnrolledMembers = activeBranchMembers.filter(m => new Date(m.created_at) >= currentMonthStart);
  const activeMembersDisplayCount = monthEnrolledMembers.length;

  // Equipment & Inventory health for this branch (comprehensive: equipment under maintenance + consumables needing reorder)
  const branchEquipment = (equipmentList || []).filter(eq => !targetBranchId || !eq.branch_id || eq.branch_id === targetBranchId);
  const underMaintenanceEquipment = branchEquipment.filter(eq => {
    const s = String(eq?.status || '').toLowerCase().replace(/[\s-_]+/g, '_');
    return s === 'under_maintenance' || s === 'critical' || s === 'maintenance' || s === 'maintenance_needed';
  });

  const branchInventory = (inventory || []).filter(i => !targetBranchId || !i.branch_id || i.branch_id === targetBranchId);
  const reorderInventory = branchInventory.filter(i => {
    const s = String(i?.status || '').toLowerCase().replace(/[\s-_]+/g, '_');
    const isLow = s === 'reorder' || s === 'low_stock' || i.is_low_stock === true;
    const qty = Number(i.quantity !== undefined ? i.quantity : (i.stock_level !== undefined ? i.stock_level : 0));
    const thresh = i.reorder_threshold !== undefined ? Number(i.reorder_threshold) : (i.threshold !== undefined ? Number(i.threshold) : null);
    const belowThresh = thresh !== null && !isNaN(thresh) && qty <= thresh;
    return isLow || belowThresh;
  });

  const maintenanceCount = underMaintenanceEquipment.length;
  const burnRateReorderCount = (burnRateItems || []).filter(i => i.runout_status === 'REORDER' || i.runout_status === 'CRITICAL' || i.runout_status === 'reorder').length;
  const reorderCount = Math.max(reorderInventory.length, burnRateReorderCount);
  const equipmentAttentionCount = maintenanceCount + reorderCount;

  const grossSales = branchSales.reduce((a, b) => a + Number(b?.amount || 0), 0);
  const lowStockCount = equipmentAttentionCount;

  // Filtered members
  const filteredMembers = (members || []).filter(m => {
    if (!m) return false;
    const matchesSearch = !memberSearch ||
      m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.phone?.includes(memberSearch);
    const memberPlan = m.subscription?.plan || m.subscription?.tier || '';
    const matchesTier = tierFilter === 'all' || memberPlan.toLowerCase().includes(tierFilter.toLowerCase());
    return matchesSearch && matchesTier;
  });

  // Filtered inventory
  const filteredInventory = (inventory || []).filter(i => {
    if (!i) return false;
    const matchesSearch = !inventorySearch ||
      i.item_name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      i.sku?.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered staff
  const filteredStaff = (staffList || []).filter(s => {
    if (!s) return false;
    const matchesSearch = !staffSearch ||
      s.name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.username?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.phone?.includes(staffSearch);
    const matchesStatus = staffStatusFilter === 'all' || s.status === staffStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered cross-branch guest visits
  const filteredCrossBranchVisits = (crossBranchVisits || []).filter(v => {
    if (!v) return false;
    const matchesSearch = !guestSearch ||
      v.member_name?.toLowerCase().includes(guestSearch.toLowerCase()) ||
      v.home_branch_name?.toLowerCase().includes(guestSearch.toLowerCase()) ||
      v.home_branch_code?.toLowerCase().includes(guestSearch.toLowerCase());
    return matchesSearch;
  });

  // Guest roaming sales & revenue
  const guestPassSales = (sales || []).filter(s => s.category === 'guest_pass');
  const guestPassRevenue = guestPassSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);

  // Tenant-isolated Ledger & Multi-Timeframe items computation
  const rawLedgerList = (ledgerData?.ledger && ledgerData.ledger.length > 0)
    ? ledgerData.ledger
    : (branchSales || []).map(s => {
        const amount = Number(s.amount || 0);
        const royaltyAmount = Number((amount * 0.075).toFixed(2));
        const netAmount = Number((amount * 0.925).toFixed(2));
        let categoryLabel = 'Membership Plan';
        if (s.category === 'guest_pass') categoryLabel = 'Guest Roaming Pass';
        else if (s.category === 'personal_training') categoryLabel = 'Personal Training';
        else if (s.category === 'locker_rental') categoryLabel = 'Locker Rental';
        else if (s.category === 'merchandise') categoryLabel = 'Merchandise';
        else if (s.category === 'supplements') categoryLabel = 'Supplements & Nutrition';
        else if (s.category) categoryLabel = s.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        let paymentChannel = 'CASH';
        const pm = (s.payment_channel || s.payment_method || '').toLowerCase();
        if (pm.includes('auto') || pm.includes('debit') || pm === 'auto_debit') paymentChannel = 'AUTO_DEBIT';
        else if (pm.includes('card') || pm.includes('credit') || pm === 'card') paymentChannel = 'CARD_TERMINAL';
        else if (pm.includes('gcash')) paymentChannel = 'GCASH';
        else if (pm.includes('maya')) paymentChannel = 'MAYA';
        else if (pm.includes('cash')) paymentChannel = 'CASH';

        return {
          id: s.id,
          reference_no: s.reference_no,
          created_at: s.created_at,
          member_name: s.customer_name || 'Walk-in Customer',
          category: categoryLabel,
          raw_category: s.category,
          payment_channel: paymentChannel,
          gross_amount: amount,
          royalty_amount: royaltyAmount,
          net_amount: netAmount,
          remittance_status: s.remittance_status || (new Date(s.created_at) >= currentMonthStart ? 'Pending Settlement' : 'Remitted to HQ')
        };
      });

  const displayLedgerItems = rawLedgerList.filter(item => {
    if (ledgerCategoryFilter !== 'all') {
      if (item.category !== ledgerCategoryFilter && item.raw_category !== ledgerCategoryFilter) {
        return false;
      }
    }
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      const ref = (item.reference_no || '').toLowerCase();
      const mem = (item.member_name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const ch = (item.payment_channel || '').toLowerCase();
      if (!ref.includes(q) && !mem.includes(q) && !cat.includes(q) && !ch.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const ledgerSummary = ledgerData?.summary || {
    grossTotal: rawLedgerList.reduce((acc, item) => acc + Number(item.gross_amount || 0), 0),
    royaltyTotal: Number((rawLedgerList.reduce((acc, item) => acc + Number(item.gross_amount || 0), 0) * 0.075).toFixed(2)),
    netTotal: Number((rawLedgerList.reduce((acc, item) => acc + Number(item.gross_amount || 0), 0) * 0.925).toFixed(2)),
    count: rawLedgerList.length
  };

  // Outside branch members eligible for roaming check-in
  const outsideBranchMembers = (allNetworkMembers || []).filter(m => m.branch_id !== user?.branch_id);

  // Free Pass Raffle applicants (current cycle roster)
  const filteredFreePassApplicants = freePassApplicants || [];

  const validRaffleMonthStr = (freePassMonth && freePassMonth.includes('-')) ? freePassMonth : new Date().toISOString().slice(0, 7);
  const [raffleYear, raffleMonth] = validRaffleMonthStr.split('-');
  const currentRaffleDate = new Date(Number(raffleYear) || 2026, (Number(raffleMonth) || 10) - 1, 1);
  const formattedMonthName = isNaN(currentRaffleDate.getTime()) ? 'October 2026' : currentRaffleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full text-white min-w-0 space-y-6">
      {/* ========================================================================= */}
      {/* VIEW 1: BRANCH DASHBOARD (OVERVIEW) */}
      {/* ========================================================================= */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. TOP HEADER & TENANT BADGES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                  Welcome back, {formatUserDisplayName(user)}
                </h1>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                {user?.branch_name || 'Branch'} Operations &bull; Memberships, equipment inventory, and sales ledger for current month ({new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={handleManualRefresh} disabled={isManualRefreshing} className="ksyn-btn ksyn-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className={isManualRefreshing ? 'animate-spin text-[#e1c256]' : ''} /> Refresh Data
              </button>
              <button onClick={() => setShowAddMember(true)} className="ksyn-btn ksyn-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Enroll Member
              </button>
            </div>
          </div>

          {/* 4 Standardized Telemetry KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Branch Gross Revenue (Scoped to Present Month) */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  BRANCH GROSS REVENUE
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PHP ₱</span>
              </div>

              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-emerald-400">
                  ₱{monthGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>{monthTransactionCount} transactions logged this month</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-emerald-400 border border-[#333] shrink-0 self-start sm:self-auto">
                  Current Month ({currentMonthLabel})
                </span>
              </div>
            </div>

            {/* 2. Active Gym Members (Branch Isolated) */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  ACTIVE GYM MEMBERS
                </span>
                <div className="p-2 rounded-lg bg-[#f7ffc4]/10 shrink-0">
                  <Users size={18} className="text-[#f7ffc4]" />
                </div>
              </div>

              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-white">
                  {activeMembersDisplayCount}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>
                  {monthEnrolledMembers.length > 0 ? `${monthEnrolledMembers.length} enrolled this month` : 'Active roster verified'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#f7ffc4] border border-[#333] shrink-0 self-start sm:self-auto">
                  {user?.branch_code ? `${user.branch_code} Isolated` : 'MKT-01 Isolated'}
                </span>
              </div>
            </div>

            {/* 3. Corporate Royalty Due (7.5% Scoped to Month) */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  CORPORATE ROYALTY DUE (7.5%)
                </span>
                <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                  <Shield size={18} className="text-[#e1c256]" />
                </div>
              </div>

              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#e1c256]">
                  ₱{monthRoyaltyDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>Automated statutory HQ remittance</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#e1c256] border border-[#333] shrink-0 self-start sm:self-auto">
                  7.5% Accrued
                </span>
              </div>
            </div>

            {/* 4. Equipment Health & Consumables Inventory */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  EQUIPMENT HEALTH
                </span>
                <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                  <AlertTriangle size={18} className="text-amber-400" />
                </div>
              </div>

              <div className="my-2">
                <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap ${equipmentAttentionCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {equipmentAttentionCount}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35, minWidth: 0, flex: 1, overflow: 'visible', textOverflow: 'clip' }}>
                  {maintenanceCount > 0 && reorderCount > 0
                    ? `${maintenanceCount} under maintenance, ${reorderCount} require reorder`
                    : maintenanceCount > 0
                    ? `${maintenanceCount} equipment item${maintenanceCount > 1 ? 's' : ''} under maintenance`
                    : reorderCount > 0
                    ? `${reorderCount} items require reorder`
                    : 'All equipment fully operational'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 self-start sm:self-auto ${equipmentAttentionCount > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-[#1F1F1F] text-emerald-400 border-[#333]'}`}>
                  {maintenanceCount > 0 && reorderCount > 0 ? 'Maintenance / Reorder' : maintenanceCount > 0 ? 'Under Maintenance' : reorderCount > 0 ? 'Reorder Needed' : 'Operational'}
                </span>
              </div>
            </div>
          </div>

          {/* Franchise Investor EBITDA & Unit Economics Panel */}
          {isInvestorMode && (
            <div style={{
              background: '#121212',
              border: '1px solid rgba(225, 194, 86, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <TrendingUp size={20} color="#e1c256" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                      Franchise Investor EBITDA & Financial Unit Economics
                    </h2>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, background: '#e1c256', color: '#000000', padding: '2px 8px', borderRadius: '4px' }}>
                      INVESTOR EXECUTIVE
                    </span>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>
                    Unit-level profit and loss metrics after corporate royalties and estimated floor operating costs.
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Net Unit EBITDA Margin</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>
                    {monthGrossRevenue > 0 ? (((monthGrossRevenue * 0.705) / monthGrossRevenue) * 100).toFixed(1) : '70.5'}%
                  </div>
                </div>
              </div>

              {/* EBITDA Flow Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '16px', borderRadius: '12px', background: '#181818', border: '1px solid #282828' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>1. Gross Unit Revenue</span>
                  <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', margin: '4px 0' }}>
                    ₱{monthGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#658256' }}>100% Topline Sales</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '12px', background: '#181818', border: '1px solid #282828' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>2. Corporate Royalty (7.5%)</span>
                  <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace', margin: '4px 0' }}>
                    -₱{monthRoyaltyDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>HQ Brand License & Software</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '12px', background: '#181818', border: '1px solid #282828' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>3. Est. OPEX & Floor Costs (22%)</span>
                  <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#f87171', fontFamily: 'monospace', margin: '4px 0' }}>
                    -₱{(monthGrossRevenue * 0.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Utilities, Maintenance & Staffing</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(101, 130, 86, 0.08)', border: '1px solid rgba(101, 130, 86, 0.3)' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#658256', textTransform: 'uppercase' }}>4. Net Unit EBITDA</span>
                  <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace', margin: '4px 0' }}>
                    ₱{(monthGrossRevenue * 0.705).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#658256', fontWeight: 700 }}>Retained Franchise Profit</span>
                </div>
              </div>

              {/* Territory & Investor Capital Recovery Telemetry */}
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#161616', border: '1px solid #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                  <Shield size={16} color="#e1c256" />
                  <span>Territory Exclusivity: <strong style={{ color: '#ffffff' }}>Active & Protected</strong> ({user?.branch_code})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                  <TrendingUp size={16} color="#658256" />
                  <span>Annualized Run-Rate: <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>₱{(monthGrossRevenue * 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                  <CheckCircle2 size={16} color="#658256" />
                  <span>Investor Capital Payback: <strong style={{ color: '#658256' }}>On Schedule</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity Split */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
            {/* Recent Sales Ledger Stream */}
            <div className="ksyn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Latest Financial Transactions</h3>
                <button onClick={() => handleSectionSwitch('ledger')} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  Full Ledger &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(branchSales || []).slice(0, 5).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#181818', borderRadius: '8px', border: '1px solid #242424' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>
                        {s.reference_no} • {s.category?.replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                        {new Date(s.created_at).toLocaleDateString()} • {s.payment_method?.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#658256' }}>
                        ₱{Number(s.amount).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#e1c256' }}>
                        Royalty: ₱{(Number(s.amount) * 0.075).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {(!branchSales || branchSales.length === 0) && (
                  <div style={{ color: '#6b7280', fontSize: '0.8125rem', padding: '20px', textAlign: 'center' }}>
                    No sales records logged yet.
                  </div>
                )}
              </div>
            </div>

            {/* Enrolled Members Quick Roster */}
            <div className="ksyn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recently Enrolled Members</h3>
                <button onClick={() => handleSectionSwitch('members')} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  All Members &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(branchMembers || []).slice(0, 5).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#181818', borderRadius: '8px', border: '1px solid #242424' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>{m.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{m.email}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.6875rem', background: '#222', color: '#e1c256', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {m.subscription?.plan ? m.subscription.plan.replace('_', ' ') : (m.subscription?.tier || 'active')}
                      </span>
                      <div style={{ fontSize: '0.6875rem', color: '#658256', marginTop: '2px' }}>
                        {m.total_check_ins || 0} visits
                      </div>
                    </div>
                  </div>
                ))}
                {(!branchMembers || branchMembers.length === 0) && (
                  <div style={{ color: '#6b7280', fontSize: '0.8125rem', padding: '20px', textAlign: 'center' }}>
                    No members enrolled at this branch yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW 2: MEMBERS & SUBSCRIPTIONS */}
      {/* ========================================================================= */}
      {activeSection === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isInvestorMode && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.12), rgba(0, 0, 0, 0.4))',
              border: '1px solid rgba(225, 194, 86, 0.35)',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Lock size={18} color="#e1c256" />
              <div style={{ fontSize: '0.8125rem' }}>
                <strong style={{ color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Franchise Investor Read-Only Oversight:
                </strong>{' '}
                <span style={{ color: '#d1d5db' }}>
                  Member enrollment and subscription modifications are locked for investor accounts. Member roster and check-in volume are presented for unit revenue auditing.
                </span>
              </div>
            </div>
          )}
          {/* Sub-Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #262626', paddingBottom: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMemberSubTab('enrolled')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                border: memberSubTab === 'enrolled' ? '1px solid #e1c256' : '1px solid #333',
                background: memberSubTab === 'enrolled' ? '#e1c256' : '#141414',
                color: memberSubTab === 'enrolled' ? '#000000' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Users size={16} />
              Enrolled Home Members ({members.length})
            </button>

            <button
              type="button"
              onClick={() => setMemberSubTab('cross_branch')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                border: memberSubTab === 'cross_branch' ? '1px solid #e1c256' : '1px solid #333',
                background: memberSubTab === 'cross_branch' ? 'rgba(225, 194, 86, 0.15)' : '#141414',
                color: memberSubTab === 'cross_branch' ? '#e1c256' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Globe size={16} />
              Cross-Branch Guest Visits ({crossBranchVisits.length})
              {crossBranchVisits.some(v => Number(v.fee_incurred) > 0) && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 900,
                  background: '#e1c256',
                  color: '#000000',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  ₱350 Fees Active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMemberSubTab('transfers')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                border: memberSubTab === 'transfers' ? '1px solid #3b82f6' : '1px solid #333',
                background: memberSubTab === 'transfers' ? '#3b82f6' : '#141414',
                color: memberSubTab === 'transfers' ? '#ffffff' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <ArrowRightLeft size={16} />
              Branch Transfers &amp; Relocations ({pendingTransfers.length})
              {pendingTransfers.length > 0 && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 900,
                  background: memberSubTab === 'transfers' ? '#ffffff' : '#e1c256',
                  color: '#000000',
                  padding: '2px 7px',
                  borderRadius: '10px'
                }}>
                  {pendingTransfers.length} Active
                </span>
              )}
            </button>
          </div>

          {/* 2-STAGE MULTI-BRANCH TRANSFER CLEARANCE & ACCEPTANCE TABLE (Requirement 2) */}
          {(memberSubTab === 'transfers' || (memberSubTab === 'enrolled' && pendingTransfers.length > 0)) && (
            <div className="ksyn-card" style={{
              background: '#0d1017',
              border: '1.5px solid rgba(225, 194, 86, 0.35)',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.18)', color: '#e1c256' }}>
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Multi-Branch Transfer Clearance &amp; Acceptance Table
                    </h3>
                    <p style={{ fontSize: '0.78125rem', color: '#94a3b8', margin: '2px 0 0' }}>
                      2-Stage auditable clearance: originating facility grants release, and receiving branch confirms incoming enrollment.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', background: 'rgba(225, 194, 86, 0.12)', border: '1px solid rgba(225, 194, 86, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
                    {pendingTransfers.length} Active Relocation{pendingTransfers.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="ksyn-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>ATHLETE / USER</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>FROM (HOME BRANCH)</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>TO (TARGET BRANCH)</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>REASON &amp; REQUESTED</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>STAGE &amp; STATUS</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTransfers.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          No pending transfer requests. All member and staff rosters are active and stationary.
                        </td>
                      </tr>
                    ) : (
                      pendingTransfers.map((req) => {
                        const currentBranchId = branch?.id || user?.branch_id || 'b-mkt-01';
                        const isStage1Action = (req.is_stage_1 || req.status === 'PENDING_APPROVAL' || req.status === 'PENDING_ORIGIN_CLEARANCE') && (req.from_branch_id === currentBranchId || req.can_approve);
                        const isStage2Action = (req.is_stage_2 || req.status === 'PENDING_DESTINATION_ACCEPTANCE') && (req.to_branch_id === currentBranchId || req.can_approve);
                        const isAwaitingOther = !isStage1Action && !isStage2Action;

                        return (
                          <tr key={req.id} style={{ borderBottom: '1px solid #1a2030' }}>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: '#ffffff' }}>{req.user_name}</span>
                                <span style={{
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: req.user_role === 'coach' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(225, 194, 86, 0.2)',
                                  color: req.user_role === 'coach' ? '#60a5fa' : '#e1c256',
                                  border: '1px solid currentColor'
                                }}>
                                  {req.user_role || 'member'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                {req.user_email}
                              </div>
                            </td>

                            <td style={{ padding: '12px' }}>
                              <strong style={{ color: '#e1c256' }}>{req.from_branch_name}</strong>
                              <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Home Records Holder</div>
                            </td>

                            <td style={{ padding: '12px' }}>
                              <strong style={{ color: '#60a5fa' }}>{req.to_branch_name}</strong>
                              <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Incoming Destination</div>
                            </td>

                            <td style={{ padding: '12px' }}>
                              <div style={{ color: '#e2e8f0' }}>{req.reason || 'Relocation Request'}</div>
                              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                                Requested {new Date(req.requested_at).toLocaleDateString()}
                              </div>
                            </td>

                            <td style={{ padding: '12px' }}>
                              {isStage1Action ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#e1c256', background: 'rgba(225, 194, 86, 0.15)', border: '1px solid rgba(225, 194, 86, 0.35)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                  Stage 1/2: Home Clearance Required
                                </span>
                              ) : isStage2Action ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                  Stage 2/2: Destination Acceptance Required
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', border: '1px solid #334155', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                  {req.is_stage_2 ? 'Stage 2/2: Cleared &bull; Awaiting Target' : 'Stage 1/2: Awaiting Home Clearance'}
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: 'right', padding: '12px', whiteSpace: 'nowrap' }}>
                              {isStage1Action && (
                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    disabled={processingTransferId === req.id}
                                    onClick={() => handleApproveTransfer(req.id)}
                                    className="ksyn-btn ksyn-btn-gold"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Check size={13} /> {processingTransferId === req.id ? 'Approving...' : 'Approve & Forward'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingTransferId === req.id}
                                    onClick={() => handleRejectTransfer(req.id)}
                                    className="ksyn-btn"
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                  >
                                    <X size={13} /> Decline
                                  </button>
                                </div>
                              )}

                              {isStage2Action && (
                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    disabled={processingTransferId === req.id}
                                    onClick={() => handleApproveTransfer(req.id)}
                                    className="ksyn-btn"
                                    style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, background: '#3b82f6', color: '#ffffff', border: '1px solid #2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Check size={13} /> {processingTransferId === req.id ? 'Finalizing...' : 'Accept & Finalize'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingTransferId === req.id}
                                    onClick={() => handleRejectTransfer(req.id)}
                                    className="ksyn-btn"
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                  >
                                    <X size={13} /> Decline
                                  </button>
                                </div>
                              )}

                              {isAwaitingOther && (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  {dispatchedTransferIds.has(req.id) || req.email_dispatched ? (
                                    <button
                                      disabled
                                      type="button"
                                      className="ksyn-btn"
                                      style={{
                                        padding: '6px 14px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        background: 'rgba(101, 130, 86, 0.2)',
                                        color: '#658256',
                                        border: '1px solid #658256',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        borderRadius: '6px'
                                      }}
                                    >
                                      <Check size={13} /> Dispatched
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenTransferEmailModal(req)}
                                      className="ksyn-btn"
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        background: 'rgba(225, 194, 86, 0.12)',
                                        color: '#e1c256',
                                        border: '1px solid #e1c256',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        borderRadius: '6px'
                                      }}
                                      title="Send coordination email to transferred-to-be branch admin"
                                    >
                                      <Mail size={13} /> Email Destination Admin
                                    </button>
                                  )}
                                  <span style={{ fontSize: '0.68rem', color: (dispatchedTransferIds.has(req.id) || req.email_dispatched) ? '#658256' : '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>
                                    {(dispatchedTransferIds.has(req.id) || req.email_dispatched) ? 'Queued for Destination Admin' : 'Awaiting Home Clearance'}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 1: Enrolled Home Members */}
          {memberSubTab === 'enrolled' && (
            <div className="ksyn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '14px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Enrolled Branch Members Roster</h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Manage member tiers, track expiration dates, and process renewals.
                  </p>
                </div>

                {/* Single line search + tier dropdown + mask toggle */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'nowrap' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search name, email, phone..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="ksyn-input"
                      style={{ width: '230px', paddingLeft: '32px', fontSize: '0.8125rem', height: '36px' }}
                    />
                    <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="ksyn-select"
                    style={{ height: '36px', fontSize: '0.8125rem', padding: '0 12px' }}
                  >
                    <option value="all">All Tiers ({members.length})</option>
                    <option value="1_day">1-Day Pass</option>
                    <option value="1_month">1 Month Pass</option>
                    <option value="3_months">3 Months Pass</option>
                    <option value="6_months">6 Months Pass</option>
                    <option value="12_months">12 Months Elite</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setMaskPii(!maskPii)}
                    className="ksyn-btn"
                    style={{
                      height: '36px',
                      fontSize: '0.8125rem',
                      padding: '0 12px',
                      background: maskPii ? 'rgba(101, 130, 86, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: maskPii ? '1px solid rgba(101, 130, 86, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                      color: maskPii ? '#658256' : '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Republic Act 10173 (Philippine Data Privacy Act of 2012) compliance"
                  >
                    {maskPii ? <EyeOff size={14} /> : <Eye size={14} />}
                    {maskPii ? 'RA 10173 Masked' : 'PII Visible'}
                  </button>

                  {refreshedMembersFeedback && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Refreshed just now
                    </span>
                  )}

                  <Tooltip content="Refresh live member roster from server" position="top">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadBranchData();
                        setRefreshedMembersFeedback(true);
                        toast.success('Branch member roster refreshed successfully.', 'Live Refresh');
                        setTimeout(() => setRefreshedMembersFeedback(false), 3000);
                      }}
                      className="ksyn-btn ksyn-btn-outline"
                      style={{ height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={13} />
                      Refresh
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="ksyn-table-wrap scrollable table-infinite ksyn-custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }}>
                <table className="ksyn-table" style={{ width: '100%', tableLayout: 'auto' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#10131a' }}>
                    <tr>
                      <th style={{ width: '22%' }}>Member Name</th>
                      <th style={{ width: '18%' }}>Contact Info</th>
                      <th style={{ width: '15%' }}>Membership Tier</th>
                      <th style={{ width: '15%' }}>Enrolled / Valid Until</th>
                      <th style={{ width: '11%' }}>Status</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Check-Ins</th>
                      <th style={{ width: '11%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredMembers || []).map((m) => {
                      const planKey = m.subscription?.plan || m.subscription?.tier || '1_month';
                      const isExpiring = m.subscription?.status === 'expiring_soon';
                      const isActive = m.subscription?.status === 'active' || m.status === 'active';
                      return (
                        <tr 
                          key={m.id}
                          onClick={() => setSelectedMemberProfileModal(m)}
                          style={{ cursor: 'pointer' }}
                          className="hover:bg-white/5 transition-colors"
                          title="Click to view complete member profile and safety dossier"
                        >
                          <td>
                            <div style={{ fontWeight: 700, color: '#e1c256', textDecoration: 'underline' }}>{m.name}</div>
                            <div className="mono inline-flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#f7ffc4' }}>
                              <CreditCard size={11} /> {m.rfid_card_uid || 'RFID: KS-8829-4102'}
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.email}>{maskEmail(m.email)}</div>
                            <div className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{maskPhone(m.phone)}</div>
                          </td>
                          <td>
                            {(() => {
                              const planKey = m.subscription?.plan || m.membership_plan || m.subscription?.tier || '1_month';
                              const pDetails = getPlanDetails(planKey);
                              const isElite = planKey === '12_months';
                              const isPro = planKey === '6_months' || planKey === '3_months';
                              return (
                                <div>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    background: isElite ? 'rgba(225, 194, 86, 0.18)' : (isPro ? 'rgba(247, 255, 196, 0.15)' : '#1e1e1e'),
                                    color: isElite ? '#e1c256' : (isPro ? '#f7ffc4' : '#cbd5e1'),
                                    border: isElite ? '1px solid rgba(225, 194, 86, 0.45)' : (isPro ? '1px solid rgba(247, 255, 196, 0.35)' : '1px solid #333')
                                  }}>
                                    {isElite && <Star size={11} className="inline mr-1 fill-[#e1c256] text-[#e1c256]" />}{pDetails?.name ? pDetails.name.toUpperCase() : planKey.replace('_', ' ').toUpperCase()}
                                  </span>

                                  {m.is_pt_enrolled && Number(m.pt_sessions_remaining || 0) > 0 && (
                                    <div style={{ marginTop: '4px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.6875rem',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#c084fc',
                                        border: '1px solid rgba(168, 85, 247, 0.35)',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        <Dumbbell size={10} /> PT: {m.pt_sessions_completed || 0}/{m.pt_sessions_total || 12} Sessions ({m.pt_sessions_remaining || 0} Left)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <div className="mono" style={{ fontSize: '0.8125rem', color: '#ffffff' }}>
                              {m.subscription?.end_date || '2026-12-31'}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                              Started: {m.subscription?.start_date || '2026-01-01'}
                            </div>
                          </td>
                          <td>
                            {(() => {
                              const endDate = m.subscription?.end_date ? new Date(m.subscription.end_date) : null;
                              const now = new Date();
                              const isPast = endDate && endDate < now;
                              const daysLeft = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 30;

                              if (!isActive || isPast || m.subscription?.status === 'expired') {
                                return (
                                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }}>
                                    Expired / Invoiced
                                  </span>
                                );
                              }
                              if (daysLeft <= 7 || isExpiring) {
                                return (
                                  <span className="badge" style={{ background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', border: '1px solid #e1c256' }}>
                                    Expiring in &lt; 7 Days ({daysLeft}d)
                                  </span>
                                );
                              }
                              return (
                                <span className="badge badge-active">
                                  Active
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                              {m.total_check_ins || 0}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            {isInvestorMode ? (
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} color="#658256" /> Audited Member
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTransferTargetUser({ ...m, role: m.role || 'member' });
                                    const currentBid = branch?.id || user?.branch_id || 'b-mkt-01';
                                    setTransferTargetBranchId(currentBid === 'b-kat-02' ? 'b-mkt-01' : 'b-kat-02');
                                    setTransferReason('Member home facility relocation');
                                  }}
                                  className="ksyn-btn ksyn-btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem', borderColor: '#3b82f6', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                                  title="Transfer member to another branch"
                                >
                                  <ArrowRightLeft size={11} /> Transfer
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                          No members matched the filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Cross-Branch Guest Visits */}
          {memberSubTab === 'cross_branch' && (
            <div className="ksyn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={20} color="#e1c256" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Cross-Branch Guest Visits & Roaming Roster</h2>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Members visiting from other KSYN facilities. 4 visits/month free; 5th+ visit incurs a ₱350 Guest Roaming Fee.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search guest or home branch..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      className="ksyn-input"
                      style={{ width: '240px', paddingLeft: '32px', fontSize: '0.8125rem', height: '36px' }}
                    />
                    <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  <button
                    onClick={() => setShowGuestCheckInModal(true)}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ height: '36px', fontSize: '0.8125rem', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> + Check In Roaming Guest
                  </button>
                </div>
              </div>

              <div className="ksyn-table-wrap">
                <table className="ksyn-table">
                  <thead>
                    <tr>
                      <th>Member Name & Home Branch</th>
                      <th>Visited Date & Time</th>
                      <th>Monthly Roaming Count</th>
                      <th>Surcharge Collected</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredCrossBranchVisits || []).map((v) => {
                      const isSurcharge = Number(v.fee_incurred) > 0;
                      const visitCount = v.monthly_cross_branch_count || 1;
                      const countBadge = visitCount <= 4 ? `Visit ${visitCount} of 4 [Free]` : `Visit ${visitCount} [₱350 Surcharge]`;

                      return (
                        <tr key={v.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Globe size={14} color={isSurcharge ? '#e1c256' : '#f7ffc4'} />
                              {v.member_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#e1c256', marginTop: '2px' }}>
                              Home: {v.home_branch_name} ({v.home_branch_code || 'Outside'})
                            </div>
                          </td>
                          <td className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            {new Date(v.check_in_date || v.check_in_time).toLocaleString()}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: isSurcharge ? 'rgba(225, 194, 86, 0.15)' : 'rgba(101, 130, 86, 0.15)',
                              color: isSurcharge ? '#e1c256' : '#7fa36d',
                              border: isSurcharge ? '1px solid rgba(225, 194, 86, 0.4)' : '1px solid rgba(101, 130, 86, 0.4)'
                            }}>
                              {countBadge}
                            </span>
                          </td>
                          <td>
                            <div className="mono" style={{ fontWeight: 800, color: isSurcharge ? '#e1c256' : '#ffffff' }}>
                              ₱{Number(v.fee_incurred || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: isSurcharge ? '#658256' : '#6b7280' }}>
                              {v.payment_status === 'paid' ? 'Paid (Visiting Ledger)' : 'Waived (Complimentary)'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {isSurcharge ? (
                                <button
                                  onClick={() => handleGuestCheckIn(v.member_id, 'counter_cash')}
                                  className="ksyn-btn ksyn-btn-gold"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="Process ₱350 Guest Roaming Surcharge"
                                >
                                  Collect ₱350 Fee
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleGuestCheckIn(v.member_id, 'complimentary')}
                                  className="ksyn-btn ksyn-btn-outline"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="Verify and Allow Turnstile Entry"
                                >
                                  <Check size={12} color="#658256" /> Verify & Allow Entry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCrossBranchVisits.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Globe size={28} color="#4b5563" />
                            <div style={{ fontSize: '0.9375rem', color: '#9ca3af', fontWeight: 600 }}>
                              No cross-branch guest visits logged
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                              Click "+ Check In Roaming Guest" above to admit members registered at other KSYN branches.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: BRANCH STAFF & FRONT DESK */}
      {/* ========================================================================= */}
      {activeSection === 'staff' && (
        <div className="ksyn-card">
          {isInvestorMode && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.12), rgba(0, 0, 0, 0.4))',
              border: '1px solid rgba(225, 194, 86, 0.35)',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <Lock size={18} color="#e1c256" />
              <div style={{ fontSize: '0.8125rem' }}>
                <strong style={{ color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Franchise Investor Read-Only Oversight:
                </strong>{' '}
                <span style={{ color: '#d1d5db' }}>
                  Account provisioning, role modifications, and credential resets are disabled. The staff roster is provided for operational capacity monitoring.
                </span>
              </div>
            </div>
          )}
          {/* Weekly Coach & Staff Floor Rota Scheduler (Comes First) */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Clock size={18} style={{ color: '#e1c256' }} /> Weekly Coach & Staff Floor Rota
                  </h3>
                  {rotaPublishMeta.is_published ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      background: 'rgba(101, 130, 86, 0.15)',
                      color: '#658256',
                      border: '1px solid rgba(101, 130, 86, 0.35)'
                    }}>
                      <CheckCircle2 size={12} /> LIVE TO STAFF & COACHES ({rotaPublishMeta.publish_count}/2 weekly publishes used)
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.35)'
                    }}>
                      <AlertTriangle size={12} /> DRAFT (WITHHELD FROM STAFF/COACHES • {rotaPublishMeta.remaining_publishes} PUBLISHES LEFT)
                    </span>
                  )}
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
                  Floor duty hours, group class coverage, and front desk shifts for {user?.branch_name || 'Current Branch'}.
                  <span style={{ display: 'inline-block', marginLeft: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                    • Max 2 publishes/week • Auto-archives every Monday at midnight
                  </span>
                </p>
              </div>

              {!isInvestorMode && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const eligible = (staffList || []).filter(s => 
                        s.role !== 'super_admin' && 
                        s.role !== 'branch_owner' && 
                        s.role !== 'branch_admin' && 
                        s.role !== 'investor'
                      );
                      const defaultStaff = eligible[0] || staffList[0];
                      setNewRotaForm({
                        coach_name: defaultStaff?.name || '',
                        staff_id: defaultStaff?.id || '',
                        staff_role: defaultStaff?.role === 'coach' ? 'coach' : 'staff',
                        specialty: defaultStaff?.role === 'coach' ? 'Strength & Conditioning' : 'Front Desk Operations',
                        monday: '06:00 AM – 02:00 PM (Morning)',
                        tuesday: '06:00 AM – 02:00 PM (Morning)',
                        wednesday: '06:00 AM – 02:00 PM (Morning)',
                        thursday: 'Rest / Off-Duty',
                        friday: '02:00 PM – 10:00 PM (Evening)',
                        saturday: '08:00 AM – 04:00 PM (Weekend)',
                        sunday: 'Rest / Off-Duty'
                      });
                      setShowAddRotaModal(true);
                    }}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ fontSize: '0.8125rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> + Add Shift / Schedule
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishRota}
                    disabled={rotaPublishMeta.remaining_publishes <= 0}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      fontSize: '0.8125rem',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: rotaPublishMeta.remaining_publishes <= 0 ? 0.5 : 1,
                      cursor: rotaPublishMeta.remaining_publishes <= 0 ? 'not-allowed' : 'pointer'
                    }}
                    title={rotaPublishMeta.remaining_publishes <= 0 ? 'Weekly publication limit of 2 reached' : 'Publish weekly rota live to staff and coach dashboards'}
                  >
                    <CheckCircle2 size={14} />
                    {rotaPublishMeta.remaining_publishes <= 0
                      ? 'Weekly Publish Limit Reached (2/2)'
                      : `Publish Active Shift Rota (${rotaPublishMeta.remaining_publishes} left)`}
                  </button>
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto', background: '#0e111a', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#141824', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '12px 16px' }}>Staff / Coach & Role</th>
                    {rotaWeekDays.map(col => (
                      <th key={col.key} style={{ padding: '12px 10px' }}>
                        <div>{col.name}</div>
                        <div style={{ color: '#e1c256', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'none' }}>({col.dateStr})</div>
                      </th>
                    ))}
                    {!isInvestorMode && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(coachRota || []).filter(r => 
                    r.staff_role !== 'super_admin' && 
                    r.staff_role !== 'branch_owner' && 
                    r.staff_role !== 'branch_admin' && 
                    r.staff_role !== 'investor' &&
                    !String(r.coach_name || '').toLowerCase().includes('marcus vance') &&
                    !String(r.coach_name || '').toLowerCase().includes('ceo') &&
                    !String(r.coach_name || '').toLowerCase().includes('admin')
                  ).map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      style={{
                        borderBottom: idx === coachRota.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#f8fafc' }}>{r.coach_name}</div>
                        <div style={{ color: '#e1c256', fontSize: '0.6875rem' }}>{r.specialty || r.staff_role}</div>
                      </td>
                      {rotaWeekDays.map(col => {
                        const shiftText = r[col.key] || 'Off';
                        const isOff = shiftText.toLowerCase().includes('off') || shiftText.toLowerCase().includes('rest');
                        const isMorning = shiftText.toLowerCase().includes('morning');
                        const isEvening = shiftText.toLowerCase().includes('evening') || shiftText.toLowerCase().includes('closing');
                        const isPeak = shiftText.toLowerCase().includes('peak');

                        return (
                          <td key={col.key} style={{ padding: '10px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                background: isOff ? 'rgba(255,255,255,0.04)' : isMorning ? 'rgba(101, 130, 86, 0.12)' : isEvening ? 'rgba(247, 255, 196, 0.12)' : isPeak ? 'rgba(225, 194, 86, 0.12)' : 'rgba(247, 255, 196, 0.12)',
                                color: isOff ? '#64748b' : isMorning ? '#7fa36d' : isEvening ? '#f7ffc4' : isPeak ? '#e1c256' : '#e1c256',
                                border: `1px solid ${isOff ? 'rgba(255,255,255,0.06)' : isMorning ? 'rgba(101, 130, 86, 0.25)' : isEvening ? 'rgba(247, 255, 196, 0.25)' : isPeak ? 'rgba(225, 194, 86, 0.25)' : 'rgba(247, 255, 196, 0.25)'}`
                              }}
                            >
                              {shiftText}
                            </span>
                          </td>
                        );
                      })}
                      {!isInvestorMode && (
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => setEditingCoachRota({ ...r })}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{ fontSize: '0.6875rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit size={11} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFloorRotaSlot(r.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Delete schedule slot"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Shift Edit Modal */}
            {editingCoachRota && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#0e111a', border: '1px solid #e1c256', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                      Adjust Shift Schedule: {editingCoachRota.coach_name}
                    </h3>
                    <button onClick={() => setEditingCoachRota(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditedRota}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <div key={day}>
                          <label style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                            {day}
                          </label>
                          <select
                            value={editingCoachRota[day] || 'Rest / Off-Duty'}
                            onChange={(e) => setEditingCoachRota({ ...editingCoachRota, [day]: e.target.value })}
                            className="ksyn-select"
                            style={{ width: '100%', fontSize: '0.75rem', padding: '6px 8px' }}
                          >
                            <option value="06:00 AM – 02:00 PM (Morning)">06:00 AM – 02:00 PM (Morning)</option>
                            <option value="10:00 AM – 06:00 PM (Mid)">10:00 AM – 06:00 PM (Mid)</option>
                            <option value="02:00 PM – 10:00 PM (Evening)">02:00 PM – 10:00 PM (Evening)</option>
                            <option value="04:00 PM – 12:00 AM (Closing)">04:00 PM – 12:00 AM (Closing)</option>
                            <option value="05:00 PM – 09:00 PM (Peak)">05:00 PM – 09:00 PM (Peak)</option>
                            <option value="08:00 AM – 04:00 PM (Weekend)">08:00 AM – 04:00 PM (Weekend)</option>
                            <option value="Rest / Off-Duty">Rest / Off-Duty</option>
                            <option value="Off">Off</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingCoachRota(null)}
                        className="ksyn-btn ksyn-btn-outline"
                        style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="ksyn-btn ksyn-btn-gold"
                        style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800 }}
                      >
                        Save & Synchronize Schedule
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Add New Shift / Schedule Modal */}
            {showAddRotaModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div className="ksyn-card" style={{ maxWidth: '540px', width: '100%', background: '#0e111a', border: '1.5px solid #e1c256', padding: '24px', boxShadow: '0 0 25px rgba(225, 194, 86, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarCheck size={20} color="#e1c256" />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                        Assign New Staff / Coach Schedule
                      </h3>
                    </div>
                    <button onClick={() => setShowAddRotaModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveNewRotaSlot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="ksyn-label">Select Staff or Coach *</label>
                        <select
                          className="ksyn-select"
                          value={newRotaForm.coach_name}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const matchedStaff = staffList.find(s => s.name === selectedName);
                            setNewRotaForm({
                              ...newRotaForm,
                              coach_name: selectedName,
                              staff_id: matchedStaff?.id || '',
                              staff_role: matchedStaff?.role === 'coach' ? 'coach' : 'staff',
                              specialty: matchedStaff?.shift_role || (matchedStaff?.role === 'coach' ? 'Strength & Conditioning' : 'Operations Specialist')
                            });
                          }}
                          style={{ width: '100%', fontSize: '0.8125rem' }}
                        >
                          <option value="">-- Choose Branch Staff / Coach --</option>
                          {(staffList || [])
                            .filter(s => s.role !== 'super_admin' && s.role !== 'branch_owner' && s.role !== 'branch_admin' && s.role !== 'investor')
                            .map(s => (
                              <option key={s.id} value={s.name}>{s.name} ({s.role === 'coach' ? 'Coach' : 'Staff'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="ksyn-label">Duty Specialty / Title</label>
                        <input
                          type="text"
                          value={newRotaForm.specialty}
                          onChange={(e) => setNewRotaForm({ ...newRotaForm, specialty: e.target.value })}
                          placeholder="e.g. Lead Trainer / Front Desk"
                          className="ksyn-input"
                          style={{ width: '100%', fontSize: '0.8125rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="ksyn-label" style={{ marginBottom: '8px' }}>Weekly Shift Allocations (Monday – Sunday)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                          <div key={day}>
                            <label style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                              {day}
                            </label>
                            <select
                              value={newRotaForm[day]}
                              onChange={(e) => setNewRotaForm({ ...newRotaForm, [day]: e.target.value })}
                              className="ksyn-select"
                              style={{ width: '100%', fontSize: '0.75rem', padding: '6px 8px' }}
                            >
                              <option value="06:00 AM – 02:00 PM (Morning)">06:00 AM – 02:00 PM (Morning)</option>
                              <option value="10:00 AM – 06:00 PM (Mid)">10:00 AM – 06:00 PM (Mid)</option>
                              <option value="02:00 PM – 10:00 PM (Evening)">02:00 PM – 10:00 PM (Evening)</option>
                              <option value="04:00 PM – 12:00 AM (Closing)">04:00 PM – 12:00 AM (Closing)</option>
                              <option value="05:00 PM – 09:00 PM (Peak)">05:00 PM – 09:00 PM (Peak)</option>
                              <option value="08:00 AM – 04:00 PM (Weekend)">08:00 AM – 04:00 PM (Weekend)</option>
                              <option value="Rest / Off-Duty">Rest / Off-Duty</option>
                              <option value="Off">Off</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddRotaModal(false)}
                        className="ksyn-btn ksyn-btn-outline"
                        style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="ksyn-btn ksyn-btn-gold"
                        style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800 }}
                      >
                        Add to Weekly Rota
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Branch Staff & Coaches Roster (Comes Second) */}
          <div style={{ marginTop: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Branch Staff & Coaches Roster</h2>
                <span className="badge badge-branch_admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={12} /> TENANT: {user?.branch_code || 'MKT-01'}
                </span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#e1c256', textTransform: 'uppercase', background: '#1a1a1a', border: '1px solid rgba(225, 194, 86, 0.3)', borderRadius: '4px', padding: '2px 8px' }}>
                  {user?.branch_name ? `${user.branch_name} Only` : 'Branch Staff & Coaches Only'}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                Manage front desk personnel, fitness coaches, and operational staff bound strictly to your facility.
              </p>
            </div>

            {/* Single line search + all status + add staff button */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'nowrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search staff name, email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '220px', paddingLeft: '32px', fontSize: '0.8125rem', height: '36px' }}
                />
                <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              <select
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value)}
                className="ksyn-select"
                style={{ height: '36px', fontSize: '0.8125rem', padding: '0 12px' }}
              >
                <option value="all">All Status ({staffList.length})</option>
                <option value="active">Active Staff</option>
                <option value="suspended">Suspended Staff</option>
              </select>

              <button
                onClick={() => setShowAddStaffModal(true)}
                className="ksyn-btn ksyn-btn-gold"
                style={{ height: '36px', fontSize: '0.8125rem', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> Add Branch Staff
              </button>
            </div>
          </div>

          <div className="ksyn-table-wrap scrollable table-infinite ksyn-custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }}>
            <table className="ksyn-table" style={{ width: '100%', tableLayout: 'auto' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#10131a' }}>
                <tr>
                  <th style={{ width: '22%' }}>Full Name</th>
                  <th style={{ width: '18%' }}>Email</th>
                  <th style={{ width: '12%' }}>Username</th>
                  <th style={{ width: '15%' }}>Assigned Shift / Role</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '10%' }}>Created Date</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredStaff || []).map((s) => {
                  const isActive = s.status === 'active';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isActive ? 'rgba(225, 194, 86, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isActive ? '#e1c256' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8125rem',
                            border: `1px solid ${isActive ? 'rgba(225, 194, 86, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{s.name}</div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                              Phone: {s.phone || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#d1d5db', fontSize: '0.8125rem' }}>
                        <div style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.email}>
                          {s.email}
                        </div>
                      </td>
                      <td className="mono" style={{ color: '#e1c256', fontSize: '0.8125rem', fontWeight: 600 }}>
                        @{s.username || s.email.split('@')[0]}
                      </td>
                      <td>
                        {s.role === 'coach' || s.shift_role?.toLowerCase()?.includes('coach') ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(101, 130, 86, 0.12)',
                            border: '1px solid rgba(101, 130, 86, 0.35)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#e1c256',
                            fontWeight: 700
                          }}>
                            <Dumbbell size={12} color="#e1c256" />
                            {s.shift_role || 'Fitness Coach'}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#ffffff',
                            fontWeight: 600
                          }}>
                            <UserCheck size={12} color="#e1c256" />
                            {s.shift_role || 'Front Desk Staff'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-suspended'}`}>
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jan 1, 2026'}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        {isInvestorMode ? (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} color="#658256" /> Audited Staff
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStaffStatus(s);
                              }}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                borderColor: isActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(101, 130, 86, 0.4)',
                                color: isActive ? '#f87171' : '#7fa36d',
                                whiteSpace: 'nowrap'
                              }}
                              title={isActive ? 'Suspend staff account' : 'Reactivate staff account'}
                            >
                              {isActive ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowResetPassModal(s);
                                setResetPassValue('StaffPass@2026!');
                              }}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap'
                              }}
                              title="Reset Temporary Password"
                            >
                              <Key size={11} /> Reset Pass
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <UserCheck size={28} color="#4b5563" />
                        <div style={{ fontSize: '0.9375rem', color: '#9ca3af', fontWeight: 600 }}>
                          No staff accounts found in this branch roster
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          Click "+ Add Branch Staff" above to hire Front Desk personnel locked to {user?.branch_name || 'your branch'}.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW 3: EQUIPMENT & STOCK (SEPARATED GYM MACHINERY & POS RETAIL TABLES) */}
      {/* ========================================================================= */}
      {activeSection === 'equipment' && (
        <div className="w-full space-y-8">
          {isInvestorMode && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.12), rgba(0, 0, 0, 0.4))',
              border: '1px solid rgba(225, 194, 86, 0.35)',
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <Lock size={20} color="#e1c256" />
              <div style={{ fontSize: '0.8125rem' }}>
                <strong style={{ color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Franchise Investor Read-Only Oversight:
                </strong>{' '}
                <span style={{ color: '#d1d5db' }}>
                  Equipment procurement, maintenance overrides, and stock level alterations are disabled for investor accounts. Inventory valuations are provided for unit asset auditing.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TABLE 1: GYM FLOOR MACHINERY, FITNESS EQUIPMENT & FACILITY ASSETS */}
          {/* ========================================================================= */}
          <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.15)',
                  border: '1px solid rgba(225, 194, 86, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Dumbbell size={22} color="#e1c256" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Gym Floor Machinery, Fitness Equipment & Facility Assets
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Track physical gym equipment units active on floor vs stored in backroom, operational status, and asset valuation.
                  </p>
                </div>
              </div>

              {/* Machinery Controls Bar (Strict 1-Line Horizontal Layout) */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input
                    type="text"
                    placeholder="Search machinery or model..."
                    value={equipmentSearch}
                    onChange={(e) => setEquipmentSearch(e.target.value)}
                    className="ksyn-input"
                    style={{ width: '240px', paddingLeft: '32px', fontSize: '0.8125rem', height: '38px', borderRadius: '8px' }}
                  />
                  <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <select
                  value={equipmentCategoryFilter}
                  onChange={(e) => setEquipmentCategoryFilter(e.target.value)}
                  className="ksyn-select"
                  style={{ width: 'auto', minWidth: '200px', height: '38px', fontSize: '0.8125rem', padding: '0 12px', flexShrink: 0, borderRadius: '8px' }}
                >
                  <option value="all">All Machinery Categories</option>
                  <option value="cardio">Cardio Equipment</option>
                  <option value="strength_machines">Strength Machines</option>
                  <option value="free_weights">Free Weights & Racks</option>
                  <option value="facility_access">Facility & Access Gates</option>
                </select>

                {!isInvestorMode && (
                  <button
                    onClick={() => setShowAddEquipment(true)}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ height: '38px', fontSize: '0.8125rem', padding: '0 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, borderRadius: '8px', fontWeight: 800 }}
                  >
                    <Plus size={15} /> Add Gym Equipment
                  </button>
                )}
              </div>
            </div>

            {/* Machinery Table Container */}
            <div className="ksyn-table-wrap scrollable table-infinite ksyn-custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px', width: '100%', borderRadius: '12px', border: '1px solid #222', marginTop: '20px' }}>
              <table className="ksyn-table" style={{ width: '100%', minWidth: '1050px', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#161616' }}>
                  <tr style={{ background: '#161616', borderBottom: '1px solid #262626' }}>
                    <th style={{ width: '24%', padding: '12px 14px', textAlign: 'left' }}>Equipment Name & Model</th>
                    <th style={{ width: '12%', padding: '12px 14px', textAlign: 'left' }}>Category</th>
                    <th style={{ width: '8%', padding: '12px 14px', textAlign: 'center' }}>Total Units</th>
                    <th style={{ width: '15%', padding: '12px 14px', textAlign: 'center' }}>Active On Floor</th>
                    <th style={{ width: '14%', padding: '12px 14px', textAlign: 'center' }}>In Storage / Spare</th>
                    <th style={{ width: '12%', padding: '12px 14px', textAlign: 'left' }}>Operational Status</th>
                    <th style={{ width: '15%', padding: '12px 14px', textAlign: 'left' }}>Valuation</th>
                    <th style={{ minWidth: '220px', width: '220px', padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const list = (equipmentList || []).filter(eq => {
                      if (equipmentCategoryFilter !== 'all' && eq.category !== equipmentCategoryFilter) return false;
                      if (equipmentSearch) {
                        const q = equipmentSearch.toLowerCase();
                        const matchName = (eq.name || '').toLowerCase().includes(q);
                        const matchModel = (eq.model || '').toLowerCase().includes(q);
                        const matchSn = (eq.serial_number || '').toLowerCase().includes(q);
                        if (!matchName && !matchModel && !matchSn) return false;
                      }
                      return true;
                    });

                    if (list.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                            No gym equipment assets found matching your criteria.
                          </td>
                        </tr>
                      );
                    }

                    return list.map(eq => {
                      const isMaintenance = eq.status === 'under_maintenance' || eq.status === 'critical';
                      const floorCount = Number(eq.on_floor !== undefined ? eq.on_floor : (eq.total_units || 1));
                      const storageCount = Number(eq.in_storage !== undefined ? eq.in_storage : 0);
                      const totalCount = floorCount + storageCount;
                      const unitVal = Number(eq.unit_value || 0);
                      const totalVal = unitVal * totalCount;

                      return (
                        <tr key={eq.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid #1c1c1c' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.875rem' }}>{eq.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                              {eq.model || 'Commercial Grade'} {eq.serial_number ? `• S/N: ${eq.serial_number}` : ''}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', textTransform: 'capitalize', color: '#d1d5db', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#1a1a1a',
                              border: '1px solid #2e2e2e',
                              fontSize: '0.75rem',
                              color: '#d1d5db'
                            }}>
                              {(eq.category || 'strength_machines').replace('_', ' ')}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className="mono" style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#ffffff' }}>
                              {totalCount}
                            </span>
                          </td>

                          {/* Active On Floor Control */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '6px',
                                background: 'rgba(101, 130, 86, 0.15)',
                                border: '1px solid rgba(101, 130, 86, 0.35)',
                                color: '#a3e635',
                                fontWeight: 700,
                                fontSize: '0.8125rem'
                              }}>
                                {floorCount} On Floor
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '3px 8px' }}>
                                <button
                                  type="button"
                                  onClick={() => adjustEquipmentUnits(eq.id, floorCount, storageCount, true, -1)}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Decrease units on floor"
                                >
                                  -
                                </button>
                                <span className="mono" style={{ fontWeight: 800, color: '#a3e635', minWidth: '22px', textAlign: 'center', fontSize: '0.875rem' }}>
                                  {floorCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustEquipmentUnits(eq.id, floorCount, storageCount, true, 1)}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Deploy spare unit to gym floor"
                                >
                                  +
                                </button>
                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: '4px' }}>floor</span>
                              </div>
                            )}
                          </td>

                          {/* In Storage / Spare Control */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '6px',
                                background: 'rgba(148, 163, 184, 0.15)',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                color: '#cbd5e1',
                                fontWeight: 700,
                                fontSize: '0.8125rem'
                              }}>
                                {storageCount} In Storage
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '3px 8px' }}>
                                <button
                                  type="button"
                                  onClick={() => adjustEquipmentUnits(eq.id, floorCount, storageCount, false, -1)}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Decrease storage spare count"
                                >
                                  -
                                </button>
                                <span className="mono" style={{ fontWeight: 800, color: '#e2e8f0', minWidth: '22px', textAlign: 'center', fontSize: '0.875rem' }}>
                                  {storageCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustEquipmentUnits(eq.id, floorCount, storageCount, false, 1)}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Add spare to back storage"
                                >
                                  +
                                </button>
                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: '4px' }}>spare</span>
                              </div>
                            )}
                          </td>

                          {/* Operational Status & Predictive Cycle Telemetry */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {(() => {
                              const usageCycles = eq.usage_cycles !== undefined ? Number(eq.usage_cycles) : (eq.category === 'cardio' ? 528 : 142);
                              const isServiceDue = usageCycles >= 500;

                              return (
                                <div>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    background: isMaintenance ? 'rgba(239, 68, 68, 0.15)' : 'rgba(101, 130, 86, 0.15)',
                                    color: isMaintenance ? '#ef4444' : '#658256',
                                    border: isMaintenance ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(101, 130, 86, 0.4)'
                                  }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isMaintenance ? '#ef4444' : '#658256' }} />
                                    {isMaintenance ? 'Under Maintenance' : 'Operational'}
                                  </span>
                                  {isServiceDue && (
                                    <div style={{ marginTop: '4px' }}>
                                      <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertTriangle size={10} /> {usageCycles}/500 Check-ins (Service Due)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Valuation */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>
                              ₱{totalVal.toLocaleString()}
                            </div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                              ₱{unitVal.toLocaleString()} / unit
                            </div>
                          </td>

                          {/* Clean, Uncropped Actions */}
                          <td style={{ minWidth: '320px', width: '320px', padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} color="#658256" /> Audited Machinery
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const usageCycles = eq.usage_cycles !== undefined ? Number(eq.usage_cycles) : (eq.category === 'cardio' ? 528 : 142);
                                  if (usageCycles >= 500) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEquipmentList(prev => prev.map(item => item.id === eq.id ? { ...item, usage_cycles: 0, last_serviced_at: new Date().toISOString() } : item));
                                          toast.success(`Preventative service logged for ${eq.name}. Check-in cycle counter reset to 0/500!`, 'Service Complete');
                                        }}
                                        className="ksyn-btn"
                                        style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        title="Log lubrication/service and reset usage cycle counter"
                                      >
                                        <Check size={12} /> Service Done
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}

                                <button
                                  type="button"
                                  onClick={() => toggleEquipmentStatus(eq.id, eq.status)}
                                  className={`ksyn-btn ${isMaintenance ? 'ksyn-btn-gold' : 'ksyn-btn-outline'}`}
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                                  title={isMaintenance ? 'Mark equipment as operational and ready for athletes' : 'Flag machinery for repair or inspection'}
                                >
                                  <Wrench size={12} /> {isMaintenance ? 'Set Operational' : 'Flag Repair'}
                                </button>

                                {(() => {
                                  const activeReorder = (reorderRequests || []).find(r => r.equipment_id === eq.id && !['Verified & Accepted', 'Fulfilled'].includes(r.status));
                                  if (activeReorder) {
                                    if (activeReorder.status === 'Soon to be delivered') {
                                      return (
                                        <span style={{ fontSize: '0.6875rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          ETA: {activeReorder.expected_delivery_date || 'In 2 Days'}
                                        </span>
                                      );
                                    }
                                    if (activeReorder.status === 'Super Admin Out of Stock') {
                                      return (
                                        <span style={{ fontSize: '0.6875rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          Out of Stock (Avail: {activeReorder.expected_restock_date || 'Next Week'})
                                        </span>
                                      );
                                    }
                                    if (activeReorder.status === 'Delivered') {
                                      return (
                                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleVerifyShipment(activeReorder.id, true)}
                                            className="ksyn-btn"
                                            style={{ padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 800, background: '#10b981', color: '#000', borderRadius: '6px' }}
                                            title="Recount and add to machinery assets"
                                          >
                                            Recount & Add (+{activeReorder.requested_quantity})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDiscrepancyModalReq(activeReorder);
                                              setDiscrepancyForm({ shortageQty: 0, damageNotes: '' });
                                            }}
                                            className="ksyn-btn"
                                            style={{ padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px' }}
                                            title="Report machinery shortage or damage"
                                          >
                                            Discrepancy / Damaged
                                          </button>
                                        </div>
                                      );
                                    }
                                    if (activeReorder.status === 'Rejected') {
                                      return (
                                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <span
                                            style={{ fontSize: '0.6875rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}
                                            title={activeReorder.hq_notes ? `Disapproved by HQ: ${activeReorder.hq_notes}` : 'Requisition rejected by Super Admin HQ'}
                                          >
                                            Rejected by HQ
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRestockModalItem({
                                                id: eq.id,
                                                item_name: eq.name,
                                                sku: eq.model || eq.serial_number || 'MACHINERY',
                                                quantity: totalCount,
                                                item_type: 'machinery'
                                              });
                                              setRestockForm({
                                                requestedQty: 1,
                                                urgency: 'Normal',
                                                notes: `Reorder resubmission for ${eq.name}`
                                              });
                                            }}
                                            className="ksyn-btn ksyn-btn-outline"
                                            style={{ padding: '4px 8px', fontSize: '0.6875rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                            title="Resubmit requisition to Super Admin"
                                          >
                                            Re-Submit
                                          </button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.6875rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', border: '1px solid rgba(225, 194, 86, 0.4)', fontWeight: 700 }}>
                                          Reorder Sent
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRestockModalItem({
                                              id: eq.id,
                                              item_name: eq.name,
                                              sku: eq.model || eq.serial_number || 'MACHINERY',
                                              quantity: totalCount,
                                              item_type: 'machinery'
                                            });
                                            setRestockForm({
                                              requestedQty: 1,
                                              urgency: 'Normal',
                                              notes: `Reorder additional units for ${eq.name}`
                                            });
                                          }}
                                          className="ksyn-btn ksyn-btn-outline"
                                          style={{ padding: '4px 8px', fontSize: '0.6875rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                          title="Request additional units from Super Admin"
                                        >
                                          + Reorder
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRestockModalItem({
                                          id: eq.id,
                                          item_name: eq.name,
                                          sku: eq.model || eq.serial_number || 'MACHINERY',
                                          quantity: totalCount,
                                          item_type: 'machinery'
                                        });
                                        setRestockForm({
                                          requestedQty: 1,
                                          urgency: 'Normal',
                                          notes: `Reorder additional units for ${eq.name}`
                                        });
                                      }}
                                      className="ksyn-btn ksyn-btn-outline"
                                      style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                                      title="Request additional machinery units from Super Admin"
                                    >
                                      <PackageSearch size={12} color="#e1c256" /> Reorder Unit
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABLE 2: POS RETAIL, DRINKS & SHAKE BAR INVENTORY (WITH FORECASTER) */}
          {/* ========================================================================= */}
          <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(101, 130, 86, 0.18)',
                  border: '1px solid rgba(101, 130, 86, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShoppingCart size={22} color="#84a971" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    POS Retail, Drinks & Shake Bar Inventory
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Floor Stock Burn-Rate, Runout Forecaster & Pantry Inventory Intelligence • Tracks bar counter stock vs backroom reserves.
                  </p>
                </div>
              </div>

              {/* POS Controls Bar (Strict 1-Line Horizontal Layout) */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input
                    type="text"
                    placeholder="Search item or SKU..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="ksyn-input"
                    style={{ width: '220px', paddingLeft: '32px', fontSize: '0.8125rem', height: '38px', borderRadius: '8px' }}
                  />
                  <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="ksyn-select"
                  style={{ width: 'auto', minWidth: '180px', height: '38px', fontSize: '0.8125rem', padding: '0 12px', flexShrink: 0, borderRadius: '8px' }}
                >
                  <option value="all">All POS Categories</option>
                  <option value="beverages">Cold Drinks & RTD</option>
                  <option value="nutrition">Whey Powders & Shakes</option>
                  <option value="merchandise">Apparel & Gear</option>
                </select>

                <select
                  value={burnRateRiskFilter}
                  onChange={(e) => setBurnRateRiskFilter(e.target.value)}
                  className="ksyn-select"
                  style={{ width: 'auto', minWidth: '180px', height: '38px', fontSize: '0.8125rem', padding: '0 12px', flexShrink: 0, borderRadius: '8px' }}
                >
                  <option value="all">All Runout Risks</option>
                  <option value="CRITICAL">Critical Runout (&le; 3 Days)</option>
                  <option value="REORDER">Reorder Recommended (3-7 Days)</option>
                  <option value="HEALTHY">Optimal Buffer (&gt; 7 Days)</option>
                </select>

                {!isInvestorMode && (
                  <button
                    onClick={() => setShowAddInventory(true)}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ height: '38px', fontSize: '0.8125rem', padding: '0 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, borderRadius: '8px', fontWeight: 800 }}
                  >
                    <Plus size={15} /> Add Retail Item
                  </button>
                )}
              </div>
            </div>

            {/* KPI Cards Strip */}
            {(() => {
              const criticalCount = (burnRateItems || []).filter(i => i.runout_status === 'CRITICAL').length;
              const reorderCount = (burnRateItems || []).filter(i => i.runout_status === 'REORDER').length;
              const healthyCount = (burnRateItems || []).filter(i => i.runout_status === 'HEALTHY').length;
              const totalDailyUnits = (burnRateItems || []).reduce((acc, cur) => acc + (cur.daily_burn_rate || 0), 0);

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginTop: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{ background: '#0e1118', border: '1px solid #202636', borderRadius: '12px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Daily Burn Velocity</span>
                    <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256', marginTop: '2px' }}>
                      {Math.round(totalDailyUnits * 10) / 10} <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>units/day</span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Aggregated across shake bar</span>
                  </div>

                  <div style={{ background: '#0e1118', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 700 }}>Critical Runout Risk</span>
                    <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>
                      {criticalCount} <span style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>SKUs</span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#ef4444' }}>&le; 3 Days Stock Remaining</span>
                  </div>

                  <div style={{ background: '#0e1118', border: '1px solid rgba(225, 194, 86, 0.4)', borderRadius: '12px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#e1c256', textTransform: 'uppercase', fontWeight: 700 }}>Reorder Queue</span>
                    <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256', marginTop: '2px' }}>
                      {reorderCount} <span style={{ fontSize: '0.8125rem', color: '#fde68a' }}>SKUs</span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>3 – 7 Days Stock Remaining</span>
                  </div>

                  <div style={{ background: '#0e1118', border: '1px solid rgba(101, 130, 86, 0.4)', borderRadius: '12px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#658256', textTransform: 'uppercase', fontWeight: 700 }}>Healthy Buffers</span>
                    <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256', marginTop: '2px' }}>
                      {healthyCount} <span style={{ fontSize: '0.8125rem', color: '#6ee7b7' }}>SKUs</span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>&gt; 7 Days Safe Buffer</span>
                  </div>
                </div>
              );
            })()}

            {/* Unified POS Table Container */}
            <div className="ksyn-table-wrap scrollable table-infinite ksyn-custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px', width: '100%', borderRadius: '12px', border: '1px solid #222', marginTop: '20px' }}>
              <table className="ksyn-table" style={{ width: '100%', minWidth: '1100px', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#161616' }}>
                  <tr style={{ background: '#161616', borderBottom: '1px solid #262626' }}>
                    <th style={{ width: '20%', padding: '12px 14px', textAlign: 'left' }}>Product & SKU</th>
                    <th style={{ width: '10%', padding: '12px 14px', textAlign: 'left' }}>Category</th>
                    <th style={{ width: '8%', padding: '12px 14px', textAlign: 'center' }}>Total Stock</th>
                    <th style={{ width: '13%', padding: '12px 14px', textAlign: 'center' }}>Bar / Counter Stock</th>
                    <th style={{ width: '13%', padding: '12px 14px', textAlign: 'center' }}>Pantry / Storage</th>
                    <th style={{ width: '10%', padding: '12px 14px', textAlign: 'center' }}>Daily Burn</th>
                    <th style={{ width: '12%', padding: '12px 14px', textAlign: 'center' }}>Runout Risk Level</th>
                    <th style={{ width: '11%', padding: '12px 14px', textAlign: 'left' }}>Unit Price & Value</th>
                    <th style={{ minWidth: '200px', width: '200px', padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Combine inventory list with burn-rate intelligence
                    const items = (inventory || []).filter(item => {
                      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
                      if (inventorySearch) {
                        const q = inventorySearch.toLowerCase();
                        const matchName = (item.item_name || '').toLowerCase().includes(q);
                        const matchSku = (item.sku || '').toLowerCase().includes(q);
                        if (!matchName && !matchSku) return false;
                      }
                      return true;
                    });

                    if (items.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                            No POS retail items found matching your criteria.
                          </td>
                        </tr>
                      );
                    }

                    return items.map(i => {
                      const burnInfo = (burnRateItems || []).find(b => b.id === i.id || b.sku === i.sku) || {};
                      const dailyBurn = Number(burnInfo.daily_burn_rate || 2.0);
                      const rawFloor = i.floor_stock !== undefined ? Number(i.floor_stock) : null;
                      const rawStorage = i.storage_stock !== undefined ? Number(i.storage_stock) : null;
                      const totalQty = (rawFloor !== null && rawStorage !== null)
                        ? (rawFloor + rawStorage)
                        : Number(i.quantity || 0);
                      const floorQty = rawFloor !== null ? rawFloor : Math.ceil(totalQty * 0.55);
                      const storageQty = rawStorage !== null ? rawStorage : (totalQty - floorQty);
                      const daysRemaining = burnInfo.days_remaining !== undefined ? burnInfo.days_remaining : (totalQty > 0 ? Math.round((totalQty / dailyBurn) * 10) / 10 : 0);
                      
                      let riskStatus = burnInfo.runout_status;
                      if (!riskStatus) {
                        if (daysRemaining <= 3) riskStatus = 'CRITICAL';
                        else if (daysRemaining <= 7) riskStatus = 'REORDER';
                        else riskStatus = 'HEALTHY';
                      }

                      if (burnRateRiskFilter !== 'all' && riskStatus !== burnRateRiskFilter) {
                        return null;
                      }

                      const isCritical = riskStatus === 'CRITICAL';
                      const isReorder = riskStatus === 'REORDER';
                      const unitPrice = Number(i.unit_price || 0);
                      const totalValue = unitPrice * totalQty;

                      return (
                        <tr key={i.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid #1c1c1c' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.875rem' }}>{i.item_name}</div>
                            <div className="mono" style={{ fontSize: '0.75rem', color: '#e1c256', marginTop: '2px' }}>{i.sku}</div>
                          </td>

                          <td style={{ padding: '12px 14px', textTransform: 'capitalize', color: '#d1d5db', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#1a1a1a',
                              border: '1px solid #2e2e2e',
                              fontSize: '0.75rem',
                              color: '#d1d5db'
                            }}>
                              {i.category}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className="mono" style={{ fontWeight: 800, fontSize: '0.9375rem', color: totalQty <= (i.reorder_threshold || 5) ? '#e1c256' : '#ffffff' }}>
                              {totalQty}
                            </span>
                          </td>

                          {/* Bar / Floor Stock Controls */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256', fontWeight: 700, fontSize: '0.8125rem' }}>
                                {floorQty} Bar
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '3px 8px' }}>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(i.id, totalQty, -1, 'floor')}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Sell or decrement 1 unit from bar floor"
                                >
                                  -
                                </button>
                                <span className="mono" style={{ fontWeight: 800, color: '#e1c256', minWidth: '22px', textAlign: 'center', fontSize: '0.875rem' }}>
                                  {floorQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(i.id, totalQty, 1, 'floor')}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Add 1 unit to bar display"
                                >
                                  +
                                </button>
                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: '4px' }}>bar</span>
                              </div>
                            )}
                          </td>

                          {/* Storage Pantry Controls */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8125rem' }}>
                                {storageQty} Pantry
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '3px 8px' }}>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(i.id, totalQty, -1, 'storage')}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Decrement 1 unit from pantry storage"
                                >
                                  -
                                </button>
                                <span className="mono" style={{ fontWeight: 800, color: '#cbd5e1', minWidth: '22px', textAlign: 'center', fontSize: '0.875rem' }}>
                                  {storageQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(i.id, totalQty, 1, 'storage')}
                                  className="hover:text-white text-gray-400 font-bold px-1.5 transition-colors cursor-pointer"
                                  title="Stock 1 unit into pantry reserve"
                                >
                                  +
                                </button>
                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: '4px' }}>pantry</span>
                              </div>
                            )}
                          </td>

                          {/* Burn Velocity & Days */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#e1c256' }}>
                              {dailyBurn} u/day
                            </div>
                            <div className="mono" style={{ fontSize: '0.72rem', color: isCritical ? '#ef4444' : isReorder ? '#fde68a' : '#9ca3af' }}>
                              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                            </div>
                          </td>

                          {/* Risk Level Badge */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              background: isCritical ? 'rgba(239, 68, 68, 0.15)' : isReorder ? 'rgba(225, 194, 86, 0.15)' : 'rgba(101, 130, 86, 0.15)',
                              border: `1px solid ${isCritical ? '#ef4444' : isReorder ? '#e1c256' : '#658256'}`,
                              color: isCritical ? '#ef4444' : isReorder ? '#e1c256' : '#658256'
                            }}>
                              {isCritical ? 'CRITICAL RUNOUT' : isReorder ? 'REORDER QUEUE' : 'HEALTHY BUFFER'}
                            </span>
                          </td>

                          {/* Unit Price & Total Value */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>
                              ₱{totalValue.toLocaleString()}
                            </div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                              ₱{unitPrice.toLocaleString()} / unit
                            </div>
                          </td>

                          {/* Clean Uncropped Actions */}
                          <td style={{ minWidth: '200px', width: '200px', padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isInvestorMode ? (
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} color="#658256" /> Verified Stock
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const activeReorder = (reorderRequests || []).find(r => r.equipment_id === i.id && !['Verified & Accepted', 'Fulfilled'].includes(r.status));
                                  if (activeReorder) {
                                    if (activeReorder.status === 'Soon to be delivered') {
                                      return (
                                        <span style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                          Soon to be delivered: {activeReorder.expected_delivery_date || 'In 2 Days'}
                                        </span>
                                      );
                                    }
                                    if (activeReorder.status === 'Super Admin Out of Stock') {
                                      return (
                                        <span style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                          Super Admin Out of Stock (Available: {activeReorder.expected_restock_date || 'Next Week'})
                                        </span>
                                      );
                                    }
                                    if (activeReorder.status === 'Delivered') {
                                      return (
                                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleVerifyShipment(activeReorder.id, true)}
                                            className="ksyn-btn"
                                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, background: '#10b981', color: '#000', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            title="Confirm count & add to stock"
                                          >
                                            Confirm & Add (+{activeReorder.requested_quantity})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDiscrepancyModalReq(activeReorder);
                                              setDiscrepancyForm({ shortageQty: 0, damageNotes: '' });
                                            }}
                                            className="ksyn-btn"
                                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            title="Report shortage or damaged items"
                                          >
                                            Discrepancy / Damaged
                                          </button>
                                        </div>
                                      );
                                    }
                                    if (activeReorder.status === 'Rejected') {
                                      return (
                                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <span
                                            style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}
                                            title={activeReorder.hq_notes ? `Disapproved by HQ: ${activeReorder.hq_notes}` : 'Requisition rejected by Super Admin HQ'}
                                          >
                                            Rejected by HQ
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRestockModalItem(i);
                                              setRestockForm({
                                                requestedQty: burnInfo.suggested_reorder || Math.max(i.reorder_threshold * 2 - totalQty, 10),
                                                urgency: isCritical ? 'Critical' : 'Normal',
                                                notes: `Reorder resubmission for ${i.item_name}`
                                              });
                                            }}
                                            className="ksyn-btn ksyn-btn-outline"
                                            style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            title="Resubmit requisition to Super Admin"
                                          >
                                            Re-Submit
                                          </button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <span style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', border: '1px solid rgba(225, 194, 86, 0.4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        Order Placed • Sent to Super Admin
                                      </span>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRestockModalItem(i);
                                        setRestockForm({
                                          requestedQty: burnInfo.suggested_reorder || Math.max(i.reorder_threshold * 2 - totalQty, 10),
                                          urgency: isCritical ? 'Critical' : 'Normal',
                                          notes: `Reorder based on daily burn rate: ${daysRemaining} days stock remaining.`
                                        });
                                      }}
                                      className="ksyn-btn ksyn-btn-gold"
                                      style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                                      title="Submit restock request to Super Admin"
                                    >
                                      <PackageSearch size={14} /> Populate Reorder
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABLE 3: DEDICATED BRANCH PROCUREMENT REQUISITIONS & RESTOCK QUEUE */}
          {/* ========================================================================= */}
          <div className="ksyn-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#0e111a', border: '1px solid #1e2436', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PackageSearch size={20} color="#e1c256" />
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#ffffff' }}>
                    Procurement Requisitions & Restock Queue
                  </h3>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 800, border: '1px solid rgba(225, 194, 86, 0.3)' }}>
                    HQ SYNCHRONIZED
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Live tracking of branch machinery and retail replenishment orders submitted to Super Admin HQ with real-time logistics and rejection notes.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', minWidth: '180px' }}>
                  <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={procurementSearch}
                    onChange={(e) => setProcurementSearch(e.target.value)}
                    placeholder="Search requisitions..."
                    style={{
                      padding: '6px 10px 6px 30px',
                      borderRadius: '6px',
                      background: '#141414',
                      border: '1px solid #282828',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      width: '180px'
                    }}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={procurementStatusFilter}
                  onChange={(e) => setProcurementStatusFilter(e.target.value)}
                  className="ksyn-select"
                  style={{ height: '32px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '6px' }}
                >
                  <option value="all">All Requisitions ({(reorderRequests || []).length})</option>
                  <option value="Pending HQ Review">Pending HQ Review</option>
                  <option value="Soon to be delivered">In Delivery / Transit</option>
                  <option value="Super Admin Out of Stock">HQ Out of Stock</option>
                  <option value="Delivered">Delivered (Pending Recount)</option>
                  <option value="Rejected">Rejected by HQ</option>
                  <option value="Verified & Accepted">Verified & Fulfilled</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadBranchData(true)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '0.75rem' }}
                  title="Synchronize procurement updates from Super Admin"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Queue
                </button>
              </div>
            </div>

            {/* Quick KPI stats strip */}
            {(() => {
              const pendingCount = (reorderRequests || []).filter(r => r.status === 'Pending HQ Review').length;
              const deliveryCount = (reorderRequests || []).filter(r => r.status === 'Soon to be delivered').length;
              const deliveredCount = (reorderRequests || []).filter(r => r.status === 'Delivered').length;
              const rejectedCount = (reorderRequests || []).filter(r => r.status === 'Rejected' || r.status === 'Super Admin Out of Stock').length;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#121520', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Awaiting HQ Review</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', marginTop: '2px' }}>{pendingCount}</div>
                    </div>
                    <Clock size={20} color="#e1c256" />
                  </div>
                  <div style={{ background: '#121520', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>In Transit (ETA Active)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#60a5fa', marginTop: '2px' }}>{deliveryCount}</div>
                    </div>
                    <CalendarCheck size={20} color="#60a5fa" />
                  </div>
                  <div style={{ background: '#121520', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Delivered &bull; Need Recount</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34d399', marginTop: '2px' }}>{deliveredCount}</div>
                    </div>
                    <CheckCircle2 size={20} color="#34d399" />
                  </div>
                  <div style={{ background: '#121520', border: '1px solid #1e2436', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Disapproved / Out of Stock</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f87171', marginTop: '2px' }}>{rejectedCount}</div>
                    </div>
                    <AlertTriangle size={20} color="#f87171" />
                  </div>
                </div>
              );
            })()}

            {/* Requisitions Queue Table */}
            <div style={{
              width: '100%',
              maxWidth: '100%',
              maxHeight: '460px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '8px',
              border: '1px solid #1e2436',
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e1c256 #0e111a'
            }} className="ksyn-custom-scrollbar table-infinite">
              <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#121622' }}>
                  <tr style={{ background: '#121622', borderBottom: '1px solid #1e2436', color: '#9ca3af', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap', width: '13%' }}>REQUEST DATE</th>
                    <th style={{ padding: '10px 12px', width: '25%' }}>ITEM NAME & SKU</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap', width: '8%' }}>STOCK</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap', width: '7%' }}>UNITS</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '9%' }}>URGENCY</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center', width: '14%' }}>HQ STATUS</th>
                    <th style={{ padding: '10px 12px', width: '24%' }}>HQ LOGISTICS & NOTES</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = (reorderRequests || []).filter(r => {
                      if (procurementStatusFilter !== 'all' && r.status !== procurementStatusFilter) return false;
                      if (procurementSearch) {
                        const q = procurementSearch.toLowerCase();
                        const nameMatch = (r.item_name || '').toLowerCase().includes(q);
                        const skuMatch = (r.sku || '').toLowerCase().includes(q);
                        const notesMatch = (r.notes || '').toLowerCase().includes(q) || (r.hq_notes || '').toLowerCase().includes(q);
                        if (!nameMatch && !skuMatch && !notesMatch) return false;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <PackageSearch size={28} color="#6b7280" />
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>No procurement requisitions match your criteria.</span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Submit new replenishment requisitions from the Gym Floor Machinery or POS Inventory tables above.</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((req) => {
                      const isPending = req.status === 'Pending HQ Review';
                      const isDelivery = req.status === 'Soon to be delivered';
                      const isOOS = req.status === 'Super Admin Out of Stock';
                      const isDelivered = req.status === 'Delivered';
                      const isRejected = req.status === 'Rejected';
                      const isVerified = req.status === 'Verified & Accepted' || req.status === 'Fulfilled';
                      const isCritical = req.urgency === 'Critical';

                      // Format date safely
                      let formattedDate = 'N/A';
                      if (req.created_at) {
                        const d = new Date(req.created_at);
                        if (!isNaN(d.getTime())) {
                          formattedDate = `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                        }
                      }

                      // Find live dynamic stock
                      const liveStock = req.current_stock !== undefined
                        ? req.current_stock
                        : req.item_type === 'machinery'
                          ? ((equipmentList || []).find(e => e.id === req.equipment_id)?.total_units || 0)
                          : ((inventoryList || []).find(i => i.id === req.equipment_id)?.quantity || 0);

                      return (
                        <tr
                          key={req.id}
                          style={{
                            borderBottom: '1px solid #1a1e2d',
                            background: isPending
                              ? 'rgba(225, 194, 86, 0.03)'
                              : isDelivery
                                ? 'rgba(59, 130, 246, 0.03)'
                                : isDelivered
                                  ? 'rgba(16, 185, 129, 0.04)'
                                  : isRejected
                                    ? 'rgba(239, 68, 68, 0.03)'
                                    : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* 1. Request Date */}
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.75rem' }}>{formattedDate}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '2px' }}>By {req.requested_by || 'Branch Admin'}</div>
                          </td>

                          {/* 2. Item Name & SKU */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.8125rem' }}>{req.item_name}</span>
                              <span style={{
                                fontSize: '0.625rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: req.item_type === 'machinery' ? 'rgba(225, 194, 86, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: req.item_type === 'machinery' ? '#e1c256' : '#38bdf8',
                                border: `1px solid ${req.item_type === 'machinery' ? 'rgba(225, 194, 86, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
                                fontWeight: 800
                              }}>
                                {req.item_type === 'machinery' ? 'MACHINERY' : 'POS RETAIL'}
                              </span>
                            </div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '2px' }}>
                              {req.sku || 'N/A'}
                            </div>
                            {req.notes && (
                              <div style={{ fontSize: '0.6875rem', color: '#d1d5db', fontStyle: 'italic', marginTop: '3px' }}>
                                &ldquo;{req.notes}&rdquo;
                              </div>
                            )}
                          </td>

                          {/* 3. Stock */}
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, color: liveStock <= 5 ? '#fca5a5' : '#86efac', fontSize: '0.875rem' }}>
                              {liveStock}
                            </div>
                            {liveStock <= 5 && (
                              <span style={{ fontSize: '0.625rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                                LOW
                              </span>
                            )}
                          </td>

                          {/* 4. Units Requested */}
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span className="mono" style={{ fontWeight: 900, color: '#ffffff', fontSize: '0.875rem' }}>
                              {req.requested_quantity} u
                            </span>
                          </td>

                          {/* 5. Urgency */}
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(101, 130, 86, 0.15)',
                              color: isCritical ? '#fca5a5' : '#86efac',
                              border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.35)' : 'rgba(101, 130, 86, 0.35)'}`
                            }}>
                              {isCritical && <AlertTriangle size={11} />}
                              {req.urgency || 'Normal'}
                            </span>
                          </td>

                          {/* 6. HQ Status */}
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              background: isPending
                                ? 'rgba(225, 194, 86, 0.15)'
                                : isDelivery
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : isOOS
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : isDelivered
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : isRejected
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'rgba(101, 130, 86, 0.15)',
                              color: isPending
                                ? '#e1c256'
                                : isDelivery
                                  ? '#93c5fd'
                                  : isOOS
                                    ? '#fca5a5'
                                    : isDelivered
                                      ? '#34d399'
                                      : isRejected
                                        ? '#fca5a5'
                                        : '#86efac',
                              border: `1px solid ${
                                isPending
                                  ? 'rgba(225, 194, 86, 0.4)'
                                  : isDelivery
                                    ? 'rgba(59, 130, 246, 0.4)'
                                    : isOOS
                                      ? 'rgba(239, 68, 68, 0.4)'
                                      : isDelivered
                                        ? 'rgba(16, 185, 129, 0.4)'
                                        : isRejected
                                          ? 'rgba(239, 68, 68, 0.5)'
                                          : 'rgba(101, 130, 86, 0.4)'
                              }`
                            }}>
                              {req.status === 'Soon to be delivered' ? 'Soon to be delivered' :
                               req.status === 'Super Admin Out of Stock' ? 'HQ Out of Stock' :
                               req.status === 'Delivered' ? 'Delivered' :
                               req.status === 'Rejected' ? 'Rejected' :
                               req.status === 'Verified & Accepted' ? 'Verified & Accepted' :
                               req.status === 'Fulfilled' ? 'Fulfilled' :
                               'Pending HQ Review'}
                            </span>
                          </td>

                          {/* 7. HQ Logistics & Notes */}
                          <td style={{ padding: '12px' }}>
                            {isDelivery && (
                              <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                                <strong>ETA:</strong> {req.expected_delivery_date || 'In 2 Days'}
                                {req.delivery_notes && (
                                  <div style={{ fontSize: '0.6875rem', color: '#cbd5e1', marginTop: '2px' }}>
                                    Notes: {req.delivery_notes}
                                  </div>
                                )}
                              </div>
                            )}
                            {isOOS && (
                              <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                                <strong>Expected Restock:</strong> {req.expected_restock_date || 'Next Week'}
                                {req.delivery_notes && (
                                  <div style={{ fontSize: '0.6875rem', color: '#cbd5e1', marginTop: '2px' }}>
                                    Notes: {req.delivery_notes}
                                  </div>
                                )}
                              </div>
                            )}
                            {isRejected && (
                              <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                                <strong>Disapproved by HQ:</strong> {req.hq_notes || 'Requisition rejected by Super Admin HQ'}
                              </div>
                            )}
                            {isDelivered && (
                              <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                                Arrived at facility. Please perform physical count verification.
                              </div>
                            )}
                            {isVerified && (
                              <div style={{ fontSize: '0.75rem', color: '#86efac' }}>
                                Stock count verified. Added to active branch assets.
                              </div>
                            )}
                            {isPending && (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                Requisition dispatched to Super Admin HQ authorization queue.
                              </div>
                            )}
                          </td>

                          {/* 8. Actions */}
                          <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isDelivered && (
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyShipment(req.id, true)}
                                  className="ksyn-btn"
                                  style={{ padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 800, background: '#10b981', color: '#000', borderRadius: '6px' }}
                                  title="Confirm count and add to stock"
                                >
                                  Recount & Add (+{req.requested_quantity})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDiscrepancyModalReq(req);
                                    setDiscrepancyForm({ shortageQty: 0, damageNotes: '' });
                                  }}
                                  className="ksyn-btn"
                                  style={{ padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px' }}
                                  title="Report shipment shortage or damage"
                                >
                                  Discrepancy
                                </button>
                              </div>
                            )}

                            {isRejected && (
                              <button
                                type="button"
                                onClick={() => {
                                  const matchingEq = (equipmentList || []).find(e => e.id === req.equipment_id);
                                  const matchingInv = (inventoryList || []).find(i => i.id === req.equipment_id);
                                  setRestockModalItem({
                                    id: req.equipment_id,
                                    item_name: req.item_name,
                                    sku: req.sku || (matchingEq ? (matchingEq.model || matchingEq.serial_number) : matchingInv ? matchingInv.sku : 'MACHINERY'),
                                    quantity: liveStock,
                                    item_type: req.item_type || (matchingEq ? 'machinery' : 'retail')
                                  });
                                  setRestockForm({
                                    requestedQty: req.requested_quantity || 1,
                                    urgency: req.urgency || 'Normal',
                                    notes: `Reorder resubmission for ${req.item_name}`
                                  });
                                }}
                                className="ksyn-btn ksyn-btn-outline"
                                style={{ padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Resubmit requisition to Super Admin"
                              >
                                <RefreshCw size={12} /> Re-Submit Requisition
                              </button>
                            )}

                            {isPending && (
                              <span style={{ fontSize: '0.72rem', color: '#e1c256', fontWeight: 600 }}>
                                Awaiting HQ Review
                              </span>
                            )}

                            {isDelivery && (
                              <span style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600 }}>
                                En Route to Branch
                              </span>
                            )}

                            {isOOS && (
                              <span style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 600 }}>
                                HQ Backordered
                              </span>
                            )}

                            {isVerified && (
                              <span style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={12} /> Audited & Closed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW 4: SALES & ROYALTY LEDGER */}
      {/* ========================================================================= */}
      {activeSection === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Sub-Nav Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#161616', padding: '6px', borderRadius: '12px', border: '1px solid #242424', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setLedgerSubView('sales_royalty')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                ledgerSubView === 'sales_royalty'
                  ? 'bg-[#e1c256] text-black shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
            >
              <DollarSign size={14} />
              <span>Official Sales & Royalty Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setLedgerSubView('xendit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                ledgerSubView === 'xendit'
                  ? 'bg-[#e1c256] text-black shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
            >
              <CreditCard size={14} />
              <span>Xendit Digital Transactions (PLANS, POS, PT)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLedgerSubView('coach_commissions');
                fetchCoachBranchLedger();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                ledgerSubView === 'coach_commissions'
                  ? 'bg-[#e1c256] text-black shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
            >
              <UserCheck size={14} />
              <span>Coach Sessions & Commission Ledger</span>
            </button>
          </div>

          {ledgerSubView === 'xendit' ? (
            <XenditTransactionsLedger branchId={user?.branch_id} />
          ) : ledgerSubView === 'coach_commissions' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Dynamic Financial Summary Strip (4 Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Verified Sessions Conducted */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      VERIFIED FLOOR SESSIONS
                    </span>
                    <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                      <ShieldCheck size={18} className="text-emerald-400" />
                    </div>
                  </div>
                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-emerald-400">
                      {coachLedgerData?.summary?.totalSessions || 0}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                    <span>Conducted & PIN Verified</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-emerald-400 border border-[#333] shrink-0 self-start sm:self-auto">
                      Anti-Ghost
                    </span>
                  </div>
                </div>

                {/* 2. Total Servicing Commissions Accrued */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      SERVICING COMMISSIONS
                    </span>
                    <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                      <TrendingUp size={18} className="text-[#e1c256]" />
                    </div>
                  </div>
                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#e1c256]">
                      ₱{Number(coachLedgerData?.summary?.totalServicingEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                    <span>Per-session split payouts</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#e1c256] border border-[#333] shrink-0 self-start sm:self-auto">
                      Accrued
                    </span>
                  </div>
                </div>

                {/* 3. Total Closed PT Sales Commissions */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      PT SALES COMMISSIONS (15%)
                    </span>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#f7ffc4]/10 text-[#f7ffc4] border border-[#f7ffc4]/20">PHP ₱</span>
                  </div>
                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#f7ffc4]">
                      ₱{Number(coachLedgerData?.summary?.totalSalesCommissions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                    <span>Cleared package sign-ups</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#f7ffc4] border border-[#333] shrink-0 self-start sm:self-auto">
                      15% Sales Cut
                    </span>
                  </div>
                </div>

                {/* 4. Net Coach Payroll Liability */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      NET COACH PAYROLL LIABILITY
                    </span>
                    <div className="p-2 rounded-lg bg-[#1C1C1C] shrink-0">
                      <Receipt size={18} className="text-white" />
                    </div>
                  </div>
                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-white">
                      ₱{Number(coachLedgerData?.summary?.totalNetPayout || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                    <span>After 10% BIR 2307 Tax</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0 self-start sm:self-auto">
                      Net Payable
                    </span>
                  </div>
                </div>
              </div>

              {/* Coach Roster Accrual Summary Cards */}
              <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} color="#e1c256" /> Coach Payroll & Performance Accrual Breakdown
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                      Live commission accruals and completed session counts by coach for {user?.branch_name || 'this facility'}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchCoachBranchLedger}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={12} className={loadingCoachLedger ? 'animate-spin' : ''} /> Refresh Ledger
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {(coachLedgerData?.coachSummaries || []).map((cs) => (
                    <div
                      key={cs.coach_id}
                      style={{
                        background: '#171920',
                        border: '1px solid #232838',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.9375rem' }}>{cs.coach_name}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#e1c256', fontWeight: 600 }}>Floor Personal Trainer</div>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: 'rgba(101, 130, 86, 0.2)',
                          color: '#658256',
                          border: '1px solid rgba(101, 130, 86, 0.4)'
                        }}>
                          {cs.sessions_count} Sessions
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', background: '#0e111a', padding: '10px', borderRadius: '8px', border: '1px solid #1a2030' }}>
                        <div>
                          <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.6875rem' }}>Servicing:</span>
                          <span style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>₱{cs.servicing_earnings.toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.6875rem' }}>Sales (15%):</span>
                          <span style={{ fontWeight: 700, color: '#f7ffc4', fontFamily: 'monospace' }}>₱{cs.sales_earnings.toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.6875rem' }}>10% BIR Tax:</span>
                          <span style={{ fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>-₱{cs.tax_withheld_10pct.toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.6875rem' }}>Net Payout:</span>
                          <span style={{ fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>₱{cs.net_payout.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Container with Sub-Tabs & Search */}
              <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setCoachLedgerTab('sessions')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        coachLedgerTab === 'sessions'
                          ? 'bg-[#e1c256] text-black font-bold shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-[#222]'
                      }`}
                    >
                      Verified Floor Sessions ({coachLedgerData?.sessions?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoachLedgerTab('commissions')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        coachLedgerTab === 'commissions'
                          ? 'bg-[#e1c256] text-black font-bold shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-[#222]'
                      }`}
                    >
                      PT Package Sales Commissions ({coachLedgerData?.commissions?.length || 0})
                    </button>
                  </div>

                  <div style={{ position: 'relative', minWidth: '240px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Search coach, athlete, focus..."
                      value={coachLedgerSearch}
                      onChange={(e) => setCoachLedgerSearch(e.target.value)}
                      className="ksyn-input"
                      style={{ height: '34px', fontSize: '0.8125rem', paddingLeft: '32px', width: '100%' }}
                    />
                  </div>
                </div>

                {coachLedgerTab === 'sessions' ? (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr style={{ background: '#161616', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th className="px-3 py-2.5 rounded-l-lg">Date & Time</th>
                          <th className="px-3 py-2.5">Assigned Coach</th>
                          <th className="px-3 py-2.5">Athlete Client</th>
                          <th className="px-3 py-2.5">Workout Focus</th>
                          <th className="px-3 py-2.5">Duration</th>
                          <th className="px-3 py-2.5">Session Rate</th>
                          <th className="px-3 py-2.5">Coach Split</th>
                          <th className="px-3 py-2.5">Commission</th>
                          <th className="px-3 py-2.5 rounded-r-lg text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(coachLedgerData?.sessions || [])
                          .filter(s => {
                            if (!coachLedgerSearch.trim()) return true;
                            const q = coachLedgerSearch.toLowerCase();
                            return (
                              String(s.coach_name || '').toLowerCase().includes(q) ||
                              String(s.client_name || '').toLowerCase().includes(q) ||
                              String(s.focus || '').toLowerCase().includes(q)
                            );
                          })
                          .map((s, idx) => (
                            <tr key={s.id || idx} style={{ borderBottom: '1px solid #1a1a1a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td className="px-3 py-2.5 text-gray-400 font-mono">
                                {new Date(s.session_date || s.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-white">
                                {s.coach_name || 'Coach'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-200 font-semibold">
                                {s.client_name || 'Enrolled Athlete'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-300">
                                {s.focus || 'General Training'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-400">
                                {s.duration_mins || 60} mins
                              </td>
                              <td className="px-3 py-2.5 font-mono text-gray-300">
                                ₱{Number(s.session_rate || 500).toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-[#e1c256] font-semibold">
                                {s.coach_split_percentage || 20}%
                              </td>
                              <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">
                                +₱{Number(s.commission_earned || 100).toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  Verified (PIN)
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr style={{ background: '#161616', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th className="px-3 py-2.5 rounded-l-lg">Date Cleared</th>
                          <th className="px-3 py-2.5">Coach Name</th>
                          <th className="px-3 py-2.5">Athlete Client</th>
                          <th className="px-3 py-2.5">PT Package</th>
                          <th className="px-3 py-2.5">Package Price</th>
                          <th className="px-3 py-2.5">Commission Rate</th>
                          <th className="px-3 py-2.5">Commission Earned</th>
                          <th className="px-3 py-2.5 rounded-r-lg text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(coachLedgerData?.commissions || [])
                          .filter(c => {
                            if (!coachLedgerSearch.trim()) return true;
                            const q = coachLedgerSearch.toLowerCase();
                            return (
                              String(c.coach_name || '').toLowerCase().includes(q) ||
                              String(c.client_name || '').toLowerCase().includes(q) ||
                              String(c.package_name || '').toLowerCase().includes(q)
                            );
                          })
                          .map((c, idx) => (
                            <tr key={c.id || idx} style={{ borderBottom: '1px solid #1a1a1a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td className="px-3 py-2.5 text-gray-400 font-mono">
                                {new Date(c.date || c.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-white">
                                {c.coach_name || 'Coach'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-200 font-semibold">
                                {c.client_name || 'Athlete'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-300">
                                {c.package_name || '12-Session PT Package'}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-gray-300">
                                ₱{Number(c.package_amount || 6000).toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-[#e1c256] font-semibold">
                                {c.commission_rate || 15}%
                              </td>
                              <td className="px-3 py-2.5 font-mono font-bold text-[#658256]">
                                +₱{Number(c.commission_earned || 900).toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#e1c256]/15 text-[#e1c256] border border-[#e1c256]/30">
                                  Cleared & Accrued
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
          {/* Dynamic Financial Summary Strip (4 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Gross Sales */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  TOTAL GROSS SALES
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PHP ₱</span>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-emerald-400">
                  ₱{Number(ledgerSummary.grossTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>
                  {ledgerTimeframe === 'month' ? 'Current Month (October 2026)' : (ledgerTimeframe === 'year' ? 'Present Year (2026)' : (ledgerTimeframe === 'six_months' ? 'Past 6 Months' : 'All-Time Franchise'))}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-emerald-400 border border-[#333] shrink-0 self-start sm:self-auto">
                  Gross Sales
                </span>
              </div>
            </div>

            {/* 2. Corporate Remittance (7.5%) */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  CORPORATE REMITTANCE (7.5%)
                </span>
                <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                  <Shield size={18} className="text-[#e1c256]" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#e1c256]">
                  ₱{Number(ledgerSummary.royaltyTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>Total HQ royalty liability</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#e1c256] border border-[#333] shrink-0 self-start sm:self-auto">
                  7.5% Accrued
                </span>
              </div>
            </div>

            {/* 3. Net Branch Take-Home (92.5%) */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  NET BRANCH TAKE-HOME (92.5%)
                </span>
                <div className="p-2 rounded-lg bg-[#f7ffc4]/10 shrink-0">
                  <TrendingUp size={18} className="text-[#f7ffc4]" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#f7ffc4]">
                  ₱{Number(ledgerSummary.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>Retained branch balance</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#f7ffc4] border border-[#333] shrink-0 self-start sm:self-auto">
                  92.5% Net
                </span>
              </div>
            </div>

            {/* 4. Transactions Count */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  TRANSACTIONS COUNT
                </span>
                <div className="p-2 rounded-lg bg-[#1C1C1C] shrink-0">
                  <CreditCard size={18} className="text-gray-300" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-white">
                  {ledgerSummary.count}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-1.5">
                <span>Receipts logged for chosen period</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0 self-start sm:self-auto">
                  Audited
                </span>
              </div>
            </div>
          </div>

        <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-5">
          {/* Header & Controls bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Official Branch Sales & Royalty Ledger</h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                  Audited financial ledger detailing gross intake, 7.5% corporate cut, and net franchise proceeds for {user?.branch_name || 'this branch'}.
                </p>
              </div>

              {/* Export to Excel (.csv) Action Button */}
              <button
                type="button"
                onClick={handleExportLedgerCSV}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#202020] text-gray-200 hover:text-white text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400"/>
                <span>Export to Excel (.csv)</span>
              </button>
            </div>

            {/* Responsive Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#161616', padding: '12px', borderRadius: '10px', border: '1px solid #242424' }}>
              {/* Timeframe Selector Dark Pill Container */}
              <div className="inline-flex items-center bg-[#181818] p-1 rounded-xl border border-[#2B2B2B] gap-1">
                {[
                  { id: 'month', label: 'Current Month' },
                  { id: 'year', label: 'Present Year (2026)' },
                  { id: 'six_months', label: 'Past 6 Months' },
                  { id: 'all', label: 'All-Time (Franchise Lifetime)' }
                ].map((tab) => {
                  const isActive = ledgerTimeframe === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setLedgerTimeframe(tab.id);
                        fetchLedger(tab.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#e1c256] text-black shadow-md font-bold'
                          : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search & Category Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search ref #, member, or category..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="ksyn-input"
                    style={{ height: '34px', fontSize: '0.8125rem', paddingLeft: '32px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={14} color="#9ca3af" />
                  <select
                    value={ledgerCategoryFilter}
                    onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                    className="ksyn-select"
                    style={{ height: '34px', fontSize: '0.8125rem', padding: '0 10px' }}
                  >
                    <option value="all">All Categories</option>
                    <option value="Membership Plan">Membership Plan</option>
                    <option value="Personal Training">Personal Training</option>
                    <option value="Locker Rental">Locker Rental</option>
                    <option value="Merchandise">Merchandise</option>
                    <option value="Supplements & Nutrition">Supplements & Nutrition</option>
                    <option value="Guest Roaming Pass">Guest Roaming Pass</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable table container with infinite scroll */}
          <div className="overflow-x-auto overflow-y-auto max-h-[520px] w-full rounded-xl border border-[#222222] scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#161616] shadow-sm">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[125px] whitespace-nowrap">
                    Date & Time
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[110px] whitespace-nowrap">
                    Ref ID / Invoice #
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[130px] whitespace-nowrap">
                    Member / Payer
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[110px] whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[100px] whitespace-nowrap">
                    Payment
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[105px] whitespace-nowrap">
                    Gross (PHP)
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[100px] whitespace-nowrap">
                    Royalty 7.5%
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[105px] whitespace-nowrap">
                    Net Retained
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[110px] whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm font-semibold text-[#e1c256] border-b border-[#1F1F1F]">
                      Loading ledger transactions...
                    </td>
                  </tr>
                ) : displayLedgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400 border-b border-[#1F1F1F]">
                      No transactions recorded matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  displayLedgerItems.map((item) => {
                    const isRemitted = item.remittance_status === 'Remitted to HQ';
                    return (
                      <tr key={item.id || item.reference_no} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2.5 text-xs text-gray-300 font-mono border-b border-[#1F1F1F] whitespace-nowrap">
                          {formatLedgerDateTime(item.created_at)}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-semibold text-[#e1c256] border-b border-[#1F1F1F] whitespace-nowrap">
                          {item.reference_no}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-medium text-white border-b border-[#1F1F1F] whitespace-nowrap">
                          {item.member_name || 'Walk-in Customer'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-200 border-b border-[#1F1F1F] whitespace-nowrap">
                          <span style={{
                            display: 'inline-block',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#e5e7eb',
                            background: '#222',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #333'
                          }}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-200 border-b border-[#1F1F1F] whitespace-nowrap">
                          <span style={{
                            display: 'inline-block',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#1a1a1a',
                            color: '#d1d5db',
                            border: '1px solid #333'
                          }}>
                            {item.payment_channel || 'POS / Cash'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-extrabold text-emerald-400 border-b border-[#1F1F1F] whitespace-nowrap">
                          ₱{Number(item.gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-bold text-[#e1c256] border-b border-[#1F1F1F] whitespace-nowrap">
                          ₱{Number(item.royalty_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-extrabold text-[#f7ffc4] border-b border-[#1F1F1F] whitespace-nowrap">
                          ₱{Number(item.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-200 border-b border-[#1F1F1F] whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isRemitted
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {item.remittance_status || 'Pending Settlement'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: XENDIT DIGITAL TRANSACTIONS (Direct Navigation) */}
      {/* ========================================================================= */}
      {activeSection === 'xendit' && (
        <XenditTransactionsLedger branchId={user?.branch_id} />
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: FREE PASS RAFFLE (free_pass) */}
      {/* ========================================================================= */}
      {activeSection === 'free_pass' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Free Pass Raffle Command</h1>
                <span className="badge badge-branch_admin">
                  TENANT: {user?.branch_code}
                </span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                Manage prospective athlete entries and award monthly complimentary 1-Day Trial Passes for {user?.branch_name}.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleManualRefresh} disabled={isManualRefreshing} className="ksyn-btn ksyn-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className={isManualRefreshing ? 'animate-spin text-[#e1c256]' : ''} /> Refresh Roster
              </button>
            </div>
          </div>

          {/* Monthly Status Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Current Month Card */}
            <div className="ksyn-card bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between">
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '6px' }}>
                <span className="font-semibold uppercase tracking-wider">RAFFLE PERIOD</span>
                <CalendarCheck size={16} color="#e1c256" />
              </div>
              <div className="mono whitespace-nowrap" style={{ fontSize: 'clamp(1.25rem, 2vw, 1.6rem)', fontWeight: 800, color: '#e1c256' }}>
                {formattedMonthName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                Tag: {freePassMonth} &bull; 1 Pass Limit per Branch
              </div>
            </div>

            {/* Winner Status Card */}
            <div className={`ksyn-card rounded-xl p-5 flex flex-col justify-between border ${freePassWinner ? 'bg-emerald-950/20 border-emerald-800/60' : 'bg-[#121212] border-[#262626]'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '6px' }}>
                <span className="font-semibold uppercase tracking-wider">MONTHLY WINNER STATUS</span>
                {freePassWinner ? <CheckCircle2 size={16} color="#658256" /> : <Gift size={16} color="#e1c256" />}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: freePassWinner ? '#7fa36d' : '#f3f4f6', lineHeight: 1.4 }}>
                {freePassWinner ? (
                  <>
                    <div>Winner: <span style={{ color: '#ffffff' }}>{freePassWinner.full_name}</span></div>
                    <div style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 500, marginTop: '2px' }}>
                      {freePassWinner.email} &bull; Pass Code: <span className="mono" style={{ color: '#e1c256', fontWeight: 700 }}>{freePassWinner.pass_code || 'DISPATCHED'}</span>
                    </div>
                  </>
                ) : (
                  <>Automated Monthly Raffle (Random Draw)</>
                )}
              </div>
              <div style={{ marginTop: '10px' }}>
                {freePassWinner ? (
                  <div style={{ fontSize: '0.75rem', color: '#658256', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} /> System Selected Winner ({new Date(freePassWinner.awarded_at || freePassWinner.applied_at).toLocaleDateString()})
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDrawModal(true)}
                    disabled={freePassApplicants.filter(a => a.status === 'pending').length === 0}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      cursor: freePassApplicants.filter(a => a.status === 'pending').length === 0 ? 'not-allowed' : 'pointer',
                      opacity: freePassApplicants.filter(a => a.status === 'pending').length === 0 ? 0.6 : 1
                    }}
                  >
                    <Sparkles size={15} /> Run Automated System Raffle Draw
                  </button>
                )}
              </div>
            </div>

            {/* Total Applicants Pool Card */}
            <div className="ksyn-card bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between">
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '6px' }}>
                <span className="font-semibold uppercase tracking-wider">APPLICANTS POOL</span>
                <Users size={16} color="#f7ffc4" />
              </div>
              <div className="mono" style={{ fontSize: 'clamp(1.25rem, 2vw, 1.6rem)', fontWeight: 800, color: '#ffffff' }}>
                {freePassApplicants.length} <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>Entries</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#f7ffc4', marginTop: '4px' }}>
                Philippine mobile and zip verified
              </div>
            </div>
          </div>

          {/* Applicants Roster Table Card */}
          <div className="ksyn-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {formattedMonthName} Free Pass Applicants Roster
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                  Prospective members who submitted raffle entries for {user?.branch_name}.
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => fetchFreePassApplicants()}
                  disabled={freePassLoading}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ height: '36px', padding: '0 14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Reload Free Pass applicants list"
                >
                  <RefreshCw size={13} className={freePassLoading ? 'animate-spin' : ''} />
                  <span>Refresh Roster</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="ksyn-table-wrap">
              <table className="ksyn-table">
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Email Address</th>
                    <th>Phone Number</th>
                    <th>Zip Code</th>
                    <th>Applied Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFreePassApplicants.map((applicant) => {
                    const isAwarded = applicant.status === 'awarded';
                    const isPending = applicant.status === 'pending';
                    const isNotSelected = applicant.status === 'not_selected';

                    return (
                      <tr key={applicant.id} style={{ background: isAwarded ? 'rgba(101, 130, 86, 0.05)' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {applicant.full_name}
                            {isAwarded && (
                              <span style={{ background: 'rgba(225, 194, 86, 0.2)', color: '#e1c256', fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                WINNER
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>
                          {applicant.email}
                        </td>
                        <td className="mono" style={{ fontSize: '0.8125rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const raw = String(applicant.phone_number || '').replace(/\D/g, '');
                            if (raw.length === 11 && raw.startsWith('09')) return `+63 ${raw.slice(1, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
                            if (raw.length === 12 && raw.startsWith('639')) return `+63 ${raw.slice(2, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`;
                            return applicant.phone_number || '—';
                          })()}
                        </td>
                        <td className="mono" style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                          {applicant.zip_code}
                        </td>
                        <td className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {new Date(applicant.applied_at).toLocaleDateString()}
                        </td>
                        <td>
                          {isAwarded ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(101, 130, 86, 0.15)',
                              color: '#7fa36d',
                              border: '1px solid rgba(101, 130, 86, 0.3)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              textTransform: 'uppercase'
                            }}>
                              <CheckCircle2 size={12} /> Awarded Free Pass
                            </span>
                          ) : isNotSelected ? (
                            <span style={{
                              display: 'inline-block',
                              background: 'rgba(107, 114, 128, 0.15)',
                              color: '#9ca3af',
                              border: '1px solid rgba(107, 114, 128, 0.3)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              Not Selected
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              background: 'rgba(225, 194, 86, 0.12)',
                              color: '#e1c256',
                              border: '1px solid rgba(225, 194, 86, 0.3)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isAwarded ? (
                            <span style={{ fontSize: '0.75rem', color: '#658256', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={14} /> Winner (Pass Dispatched)
                            </span>
                          ) : isNotSelected ? (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                              Draw Closed
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={13} /> In Raffle Pool
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredFreePassApplicants.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                        {freePassWinner
                          ? 'Monthly raffle drawing complete. Winner announced for this cycle.'
                          : 'No active free pass raffle applicants found for this cycle.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: BRANCH ANNOUNCEMENTS & TARGETED PROMOS (`announcements`) */}
      {/* ========================================================================= */}
      {activeSection === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Megaphone size={26} color="#e1c256" />
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  Branch Announcements & Targeted Promos
                </h1>
              </div>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
                Broadcast targeted club notices, member-only discounts, or coach directives for <strong style={{ color: '#e1c256' }}>{user?.branch_name || 'your club'}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchBranchAnnouncements}
              disabled={announcementLoading}
              className="ksyn-btn ksyn-btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={announcementLoading ? 'animate-spin' : ''} /> Refresh Feed
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', alignItems: 'start' }}>
            {/* Publisher Card */}
            <div className="ksyn-card" style={{ background: '#141414', border: '1px solid #262626', padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} color="#e1c256" /> Publish Branch Announcement or Promo
              </h3>

              <form onSubmit={handleCreateBranchAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Category Toggle */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                    Type of Communication
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({ ...announcementForm, type: 'announcement' })}
                      className="ksyn-btn"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        background: announcementForm.type === 'announcement' ? '#e1c256' : '#222',
                        color: announcementForm.type === 'announcement' ? '#000' : '#aaa',
                        border: '1px solid ' + (announcementForm.type === 'announcement' ? '#e1c256' : '#333')
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5"><Megaphone size={14} /> Club Announcement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({ ...announcementForm, type: 'promo' })}
                      className="ksyn-btn"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        background: announcementForm.type === 'promo' ? '#e1c256' : '#222',
                        color: announcementForm.type === 'promo' ? '#000' : '#aaa',
                        border: '1px solid ' + (announcementForm.type === 'promo' ? '#e1c256' : '#333')
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5"><Tag size={14} /> Branch Promo / Offer</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                    {announcementForm.type === 'promo' ? 'Promo Campaign Title *' : 'Headline / Subject *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={announcementForm.type === 'promo' ? 'e.g. Flash 15% Off 3-Month Renewals' : 'e.g. Studio 2 Aircon Maintenance Notice'}
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                    className="ksyn-input"
                  />
                </div>

                {/* Promo Specific Details: Code, Discount %, Expiration */}
                {announcementForm.type === 'promo' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#e1c256', marginBottom: '6px' }}>
                        Promo Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CLUB15"
                        value={announcementForm.promo_code}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, promo_code: e.target.value })}
                        className="ksyn-input mono"
                        style={{ textTransform: 'uppercase', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#e1c256', marginBottom: '6px' }}>
                        Discount (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="e.g. 15"
                        value={announcementForm.discount_percentage}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, discount_percentage: e.target.value })}
                        className="ksyn-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                        Valid Until
                      </label>
                      <input
                        type="date"
                        value={announcementForm.valid_until}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, valid_until: e.target.value })}
                        className="ksyn-input"
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                      Target Branch Audience
                    </label>
                    <select
                      value={announcementForm.target_audience}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, target_audience: e.target.value })}
                      className="ksyn-input"
                    >
                      <option value="branch_all">{`All Branch (Members, Coaches & Staff of ${user?.branch_name || 'Local Facility'})`}</option>
                      <option value="members_only">{`Members Only (Athletes of ${user?.branch_name || 'Local Facility'})`}</option>
                      <option value="coaches_only">{`Gym Coaches Only (Trainers of ${user?.branch_name || 'Local Facility'})`}</option>
                      <option value="staff_only">{`Front Desk / Staff Only (${user?.branch_name || 'Local Facility'})`}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                      Notice Priority Level
                    </label>
                    <select
                      value={announcementForm.severity}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, severity: e.target.value })}
                      className="ksyn-input"
                    >
                      <option value="info">Informational (Standard)</option>
                      <option value="warning">Important / Precautionary</option>
                      <option value="critical">Critical / Action Required</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                    Notice Content Body *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide detailed instructions, promo mechanics, or club updates..."
                    value={announcementForm.message}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                    className="ksyn-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAnnouncement}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ fontWeight: 800, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Send size={15} /> {submittingAnnouncement ? 'Publishing...' : (announcementForm.type === 'promo' ? 'Publish Branch Promo' : 'Publish Branch Announcement')}
                </button>
              </form>
            </div>

            {/* Announcements List */}
            <div className="ksyn-card" style={{ background: '#141414', border: '1px solid #262626', padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0' }}>
                Active Club Feed & Announcements ({branchAnnouncements.length})
              </h3>
              {branchAnnouncements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                  No active announcements or promos for this club.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {branchAnnouncements
                    .filter((item) => item.is_active !== false && (!item.valid_until || new Date(item.valid_until) >= new Date('2026-10-20')))
                    .map((item) => {
                    const isPromo = item.type === 'promo';
                    const audienceLabels = {
                      'branch_all': 'Everyone in Club',
                      'members_only': 'Members Only',
                      'coaches_only': 'Gym Coaches Only',
                      'staff_only': 'Staff Only',
                      'all': 'Everyone in Club',
                      'branch_admins': 'Branch Admins Only'
                    };

                    return (
                      <div key={item.id} style={{
                        background: '#0d0d0d',
                        border: `1px solid ${isPromo ? 'rgba(225, 194, 86, 0.4)' : (item.severity === 'critical' ? 'rgba(239, 68, 68, 0.4)' : (item.severity === 'warning' ? 'rgba(225, 194, 86, 0.4)' : '#333'))}`,
                        borderRadius: '8px',
                        padding: '14px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>{item.title}</span>
                            {isPromo ? (
                              <span style={{ background: 'rgba(225, 194, 86, 0.2)', color: '#e1c256', fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                PROMO {item.discount_percentage ? `(${item.discount_percentage}% OFF)` : ''}
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(247, 255, 196, 0.2)', color: '#f7ffc4', fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                ANNOUNCEMENT
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBranchAnnouncement(item.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              cursor: 'pointer',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            title="Remove announcement/promo so it no longer appears in member, coach, or staff feeds"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                        {isPromo && item.promo_code && (
                          <div style={{ fontSize: '0.75rem', color: '#e1c256', marginBottom: '6px', fontWeight: 700 }}>
                            <span className="inline-flex items-center gap-1"><Tag size={12} /> Code:</span> <span className="mono" style={{ background: '#222', padding: '2px 6px', borderRadius: '4px' }}>{item.promo_code}</span>
                            {item.valid_until && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '8px' }}>Valid until: {new Date(item.valid_until).toLocaleDateString()}</span>}
                          </div>
                        )}
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: '#9ca3af', lineHeight: 1.4 }}>
                          {item.message}
                        </p>
                        <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                          Author: <strong style={{ color: '#d1d5db' }}>{item.created_by_name || item.created_by || 'Branch Admin'}</strong> &bull; Target: <span style={{ color: '#e1c256', fontWeight: 700 }}>{audienceLabels[item.target_audience] || item.target_audience}</span> &bull; {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: STORE MANAGER DAILY ROLL-UP & END-OF-DAY Z-READING (`z_reading`) */}
      {/* ========================================================================= */}
      {activeSection === 'z_reading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Store Manager Daily Roll-up & End-of-Day Z-Reading
              </h1>
              <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: '0.875rem' }}>
                Consolidated daily cash drawer reconciliation, corporate franchise royalty calculations, and per-cashier shift variance accountability audits.
              </p>
            </div>
          </div>

          {/* Date Controls & Action Bar */}
          <div className="ksyn-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#121212', border: '1px solid #262626', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8' }}>
                Business Date:
              </label>
              <input
                type="date"
                value={zReadingBusinessDate}
                onChange={(e) => {
                  setZReadingBusinessDate(e.target.value);
                  fetchZReadingRollup(e.target.value);
                }}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #333333',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  colorScheme: 'dark',
                  cursor: 'pointer'
                }}
              />
              <button
                type="button"
                onClick={() => fetchZReadingRollup(zReadingBusinessDate)}
                disabled={loadingZReading}
                className="ksyn-btn ksyn-btn-outline"
                style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={loadingZReading ? 'animate-spin' : ''} />
                {loadingZReading ? 'Refreshing...' : 'Refresh Roll-up'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  generateZReadingReportPdf({
                    report: zReadingConsolidated || {},
                    branch: { name: user?.branch_name || 'KSYN Fitness Makati Flagship', code: user?.branch_code || 'MKT-01' },
                    dateStr: zReadingBusinessDate
                  });
                  toast.success('Official BIR-compliant Z-Reading Financial Report (PDF) generated!', 'Z-Reading Downloaded');
                }}
                className="ksyn-btn"
                style={{ fontSize: '0.8125rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, background: '#1e293b', color: '#38bdf8', border: '1px solid #0284c7', cursor: 'pointer', borderRadius: '8px' }}
              >
                <Download size={14} /> Export Z-Reading (PDF)
              </button>

              <button
                type="button"
                onClick={() => {
                  const r = zReadingConsolidated || {};
                  const gross = Number(r.total_gross_sales || 0);
                  const vatable = Math.round((gross / 1.12) * 100) / 100;
                  const vat = Math.round((gross - vatable) * 100) / 100;
                  const headers = ['Business Date', 'Branch Code', 'Total Shifts', 'Grand Gross Sales (PHP)', 'VATable Net Sales (PHP)', '12% VAT (PHP)', 'Cash Sales (PHP)', 'Non-Cash / Gateway Sales (PHP)', 'Variance (PHP)'];
                  const row = [
                    zReadingBusinessDate,
                    user?.branch_code || 'MKT-01',
                    r.total_shifts || 1,
                    gross.toFixed(2),
                    vatable.toFixed(2),
                    vat.toFixed(2),
                    Number(r.total_cash_sales || 0).toFixed(2),
                    (gross - Number(r.total_cash_sales || 0)).toFixed(2),
                    Number(r.total_variance || 0).toFixed(2)
                  ];
                  const csvContent = headers.join(',') + '\n' + row.join(',');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `KSYN-ZReading-${user?.branch_code || 'MKT'}-${zReadingBusinessDate}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Z-Reading CSV sales ledger exported!', 'Excel CSV Downloaded');
                }}
                className="ksyn-btn"
                style={{ fontSize: '0.8125rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, background: '#15803d', color: '#ffffff', border: '1px solid #16a34a', cursor: 'pointer', borderRadius: '8px' }}
              >
                <FileSpreadsheet size={14} /> Download CSV
              </button>

              <button
                type="button"
                onClick={() => handlePrintZReading(zReadingConsolidated)}
                className="ksyn-btn ksyn-btn-gold"
                style={{ fontSize: '0.8125rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, cursor: 'pointer', borderRadius: '8px' }}
              >
                <Printer size={14} /> Print Slip
              </button>
            </div>
          </div>

          {/* Consolidated Telemetry KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="ksyn-card" style={{ borderLeft: '4px solid #e1c256', background: '#121212', border: '1px solid #262626', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                Grand Gross Sales
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256', marginTop: '6px' }}>
                ₱{Number(zReadingConsolidated?.total_gross_sales || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                Combined Cash + Digital sales
              </div>
            </div>

            <div className="ksyn-card" style={{ borderLeft: '4px solid #ec4899', background: '#121212', border: '1px solid #262626', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                Franchise Royalty (5%)
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f472b6', marginTop: '6px' }}>
                ₱{Number(zReadingConsolidated?.corporate_royalty_5pct ?? zReadingConsolidated?.royalty_due ?? (Number(zReadingConsolidated?.total_gross_sales || 0) * 0.05)).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                Corporate royalty remittance
              </div>
            </div>

            <div className="ksyn-card" style={{ borderLeft: '4px solid #658256', background: '#121212', border: '1px solid #262626', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                Net Store Collections
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256', marginTop: '6px' }}>
                ₱{Number(zReadingConsolidated?.net_store_collections ?? zReadingConsolidated?.net_retained ?? (Number(zReadingConsolidated?.total_gross_sales || 0) * 0.95)).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                Gross minus franchise royalty
              </div>
            </div>

            <div className="ksyn-card" style={{ borderLeft: '4px solid #f7ffc4', background: '#121212', border: '1px solid #262626', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                Total Drawer Cash Turnover
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f7ffc4', marginTop: '6px' }}>
                ₱{Number(zReadingConsolidated?.total_cash_sales || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                Physical cash deposited to safe
              </div>
            </div>

            <div className="ksyn-card" style={{ borderLeft: '4px solid #f7ffc4', background: '#121212', border: '1px solid #262626', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                Shifts Run & Day Variance
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: (zReadingConsolidated?.total_variance || 0) < 0 ? '#ef4444' : '#658256', marginTop: '6px' }}>
                {zReadingConsolidated?.total_shifts || 0} Shift(s)
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                Day Variance: <span className="mono" style={{ color: (zReadingConsolidated?.total_variance || 0) < 0 ? '#ef4444' : '#658256' }}>₱{Number(zReadingConsolidated?.total_variance || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Per-Cashier Variance Accountability Table with Search, FIFO, Date Column & Infinite Scrollbar */}
          <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #262626', borderRadius: '12px', padding: '24px' }}>
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#658256" /> Per-Cashier Shift Variance Accountability Audit
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '4px 0 0 0' }}>
                Isolates cash shortages or overages to specific cashier IDs to eliminate shift-to-shift blame disputes.
              </p>
            </div>

            {(() => {
              const filteredAndSortedShifts = (zReadingConsolidated?.shifts || [])
                .filter(s => {
                  if (!shiftVarianceSearch.trim()) return true;
                  const q = shiftVarianceSearch.toLowerCase();
                  const dateStr = s.business_date || (s.opened_at ? new Date(s.opened_at).toLocaleDateString() : '');
                  return (
                    (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) ||
                    (s.id && s.id.toLowerCase().includes(q)) ||
                    (s.notes && s.notes.toLowerCase().includes(q)) ||
                    (s.status && s.status.toLowerCase().includes(q)) ||
                    dateStr.toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => new Date(a.opened_at || a.created_at || 0) - new Date(b.opened_at || b.created_at || 0)); // FIFO: earliest first

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0d0d0d', border: '1px solid #262626', borderRadius: '8px', padding: '6px 12px', minWidth: '280px', flex: '1 1 280px' }}>
                      <Search size={14} color="#9ca3af" />
                      <input
                        type="text"
                        placeholder="Search shifts by cashier, shift ID, remarks, date..."
                        value={shiftVarianceSearch}
                        onChange={(e) => setShiftVarianceSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8125rem', width: '100%', outline: 'none' }}
                      />
                      {shiftVarianceSearch && (
                        <button onClick={() => setShiftVarianceSearch('')} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }} className="ksyn-custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #262626', textAlign: 'left', color: '#94a3b8', position: 'sticky', top: 0, background: '#121212', zIndex: 10 }}>
                          <th style={{ padding: '12px 10px' }}>Date</th>
                          <th style={{ padding: '12px 10px' }}>Shift ID</th>
                          <th style={{ padding: '12px 10px' }}>Cashier Name</th>
                          <th style={{ padding: '12px 10px' }}>Shift Window</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Float</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Cash Sales</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Expected</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Counted</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Variance (Accountability)</th>
                          <th style={{ padding: '12px 10px' }}>Status</th>
                          <th style={{ padding: '12px 10px' }}>Remarks</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center' }}>Manager Sign-Off</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedShifts.length === 0 ? (
                          <tr>
                            <td colSpan="12" style={{ textAlign: 'center', padding: '40px 12px', color: '#64748b' }}>
                              {shiftVarianceSearch ? `No shifts matching "${shiftVarianceSearch}".` : `No shifts recorded for business date ${zReadingBusinessDate}.`}
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedShifts.map(s => {
                            const isShortage = Number(s.variance || 0) < 0;
                            const isBalanced = Number(s.variance || 0) === 0;
                            return (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px 10px', color: '#cbd5e1', fontSize: '0.75rem', whiteSpace: 'nowrap' }} className="mono">
                                  {s.business_date || (s.opened_at ? new Date(s.opened_at).toLocaleDateString() : zReadingBusinessDate)}
                                </td>
                                <td style={{ padding: '12px 10px' }} className="mono">
                                  {s.id.slice(-8)}
                                </td>
                          <td style={{ padding: '12px 10px', fontWeight: 700, color: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <UserCheck size={14} color="#f7ffc4" />
                              <span>{s.cashier_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '0.75rem' }}>
                            {s.opened_at ? new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            {' → '}
                            {s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'OPEN'}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }} className="mono">
                            ₱{Number(s.opening_float || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', color: '#658256' }} className="mono">
                            +₱{Number(s.total_cash_sales || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }} className="mono">
                            ₱{Number(s.expected_cash_drawer || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', color: '#f8fafc' }} className="mono">
                            ₱{Number(s.actual_cash_counted || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 800,
                                color: isBalanced ? '#658256' : isShortage ? '#ef4444' : '#e1c256',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: isBalanced ? 'rgba(101, 130, 86, 0.1)' : isShortage ? 'rgba(239, 68, 68, 0.1)' : 'rgba(225, 194, 86, 0.1)'
                              }}
                            >
                              {isBalanced
                                ? '₱0.00 (Balanced)'
                                : isShortage
                                ? `-₱${Math.abs(s.variance).toFixed(2)} (Shortage)`
                                : `+₱${Number(s.variance).toFixed(2)} (Over)`}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span
                              className={`ksyn-badge ${s.status === 'OPEN' ? 'ksyn-badge-yellow' : 'ksyn-badge-green'}`}
                              style={{ fontSize: '0.625rem', padding: '2px 6px' }}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '0.75rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.notes || '--'}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            {!isBalanced ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setWitnessForm({
                                    supervisor_pin: '',
                                    reason: `Z-Reading Shift #${s.id.slice(-6)} variance certification (${s.cashier_name})`,
                                    variance_amount: Math.abs(Number(s.variance || 0))
                                  });
                                  setShowWitnessModal(true);
                                }}
                                className="ksyn-btn"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  background: 'rgba(225, 194, 86, 0.15)',
                                  color: '#e1c256',
                                  border: '1px solid rgba(225, 194, 86, 0.3)',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                Authorize Discrepancy
                              </button>
                            ) : (
                              <span style={{ color: '#658256', fontSize: '0.6875rem', fontWeight: 600 }}>
                                <CheckCircle2 size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} /> Certified
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>
  </div>
)}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 3: INCIDENT, MAINTENANCE & DISCIPLINARY LOG VIEW */}
      {/* ========================================================================= */}
      {activeSection === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={26} color="#e1c256" /> Facility Incident, Maintenance & Disciplinary Log
              </h1>
              <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: '0.875rem' }}>
                Operational incident auditing, turnstile hardware failure logs, facility defects, and member disciplinary tracking.
              </p>
            </div>
            {!isInvestorMode && (
              <button
                type="button"
                onClick={() => setShowLogIncidentModal(true)}
                className="ksyn-btn ksyn-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}
              >
                <Plus size={16} /> Log New Incident / Ticket
              </button>
            )}
          </div>

          {/* KPI Telemetry Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(225, 194, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e1c256',
                flexShrink: 0
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Documented
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  {incidents.length}
                </div>
              </div>
            </div>

            <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(225, 194, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e1c256',
                flexShrink: 0
              }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Tickets
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e1c256', marginTop: '2px' }}>
                  {incidents.filter(i => (i.status || '').toLowerCase() !== 'resolved').length}
                </div>
              </div>
            </div>


            <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(101, 130, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#658256',
                flexShrink: 0
              }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resolution Rate
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#658256', marginTop: '2px' }}>
                  {incidents.length > 0 ? Math.round((incidents.filter(i => (i.status || '').toLowerCase() === 'resolved').length / incidents.length) * 100) : 100}%
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="ksyn-card" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={16} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search ticket title, category, reporter..."
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                className="ksyn-input"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>Status:</span>
              <select
                value={incidentFilter}
                onChange={(e) => setIncidentFilter(e.target.value)}
                className="ksyn-input"
                style={{ padding: '8px 12px', width: 'auto' }}
              >
                <option value="all">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="technician dispatched">Technician Dispatched</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>Severity:</span>
              <select
                value={incidentSeverityFilter}
                onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                className="ksyn-input"
                style={{ padding: '8px 12px', width: 'auto' }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>TICKET ID & LOGGED</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>CATEGORY & TITLE</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>SEVERITY</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>REPORTED BY</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>STATUS</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>RESOLUTION / NOTES</th>
                    {!isInvestorMode && (
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {incidents
                    .slice()
                    .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
                    .filter((inc) => {
                      const matchesSearch = !incidentSearch.trim() ||
                        (inc.title || '').toLowerCase().includes(incidentSearch.toLowerCase()) ||
                        (inc.category || '').toLowerCase().includes(incidentSearch.toLowerCase()) ||
                        (inc.details || '').toLowerCase().includes(incidentSearch.toLowerCase()) ||
                        (inc.reported_by || '').toLowerCase().includes(incidentSearch.toLowerCase());
                      const matchesStatus = incidentFilter === 'all' || (inc.status || '').toLowerCase() === incidentFilter.toLowerCase();
                      const matchesSeverity = incidentSeverityFilter === 'all' || (inc.severity || '').toLowerCase() === incidentSeverityFilter.toLowerCase();
                      return matchesSearch && matchesStatus && matchesSeverity;
                    })
                    .map((inc) => {
                      const isResolved = (inc.status || '').toLowerCase() === 'resolved';
                      const sev = (inc.severity || 'Medium').toLowerCase();
                      const sevColor = sev === 'critical' ? '#ef4444' : sev === 'high' ? '#e1c256' : sev === 'medium' ? '#e1c256' : '#94a3b8';
                      const sevBg = sev === 'critical' ? 'rgba(239, 68, 68, 0.12)' : sev === 'high' ? 'rgba(225, 194, 86, 0.12)' : sev === 'medium' ? 'rgba(225, 194, 86, 0.12)' : 'rgba(148, 163, 184, 0.12)';

                      return (
                        <tr key={inc.id} style={{ borderBottom: '1px solid #1a1e2d' }}>
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: '#e1c256' }}>
                              {inc.id}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap' }}>
                              {inc.created_at ? new Date(inc.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Oct 20, 14:30'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'top', maxWidth: '220px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>
                              {inc.title}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '3px' }}>
                              <span style={{ background: '#1c2130', padding: '1px 6px', borderRadius: '4px', border: '1px solid #2a3147' }}>
                                {inc.category}
                              </span>
                            </div>
                            {inc.details && (
                              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>
                                {inc.details}
                              </p>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color: sevColor,
                              background: sevBg,
                              border: `1px solid ${sevColor}40`
                            }}>
                              {inc.severity}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <div style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600 }}>
                              {inc.reported_by || 'Branch Admin'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: isResolved ? '#658256' : inc.status === 'Technician Dispatched' ? '#f7ffc4' : '#e1c256',
                              background: isResolved ? 'rgba(101, 130, 86, 0.12)' : inc.status === 'Technician Dispatched' ? 'rgba(247, 255, 196, 0.12)' : 'rgba(225, 194, 86, 0.12)',
                              border: `1px solid ${isResolved ? '#658256' : inc.status === 'Technician Dispatched' ? '#f7ffc4' : '#e1c256'}30`
                            }}>
                              {inc.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'top', maxWidth: '200px' }}>
                            <span style={{ fontSize: '0.75rem', color: inc.resolution_notes ? '#658256' : '#6b7280', fontStyle: inc.resolution_notes ? 'normal' : 'italic' }}>
                              {inc.resolution_notes || 'Pending resolution update'}
                            </span>
                          </td>
                          {!isInvestorMode && (
                            <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                                {!isResolved ? (
                                  <>
                                    {inc.status === 'Technician Dispatched' ? (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '5px 9px',
                                        borderRadius: '6px',
                                        fontSize: '0.6875rem',
                                        fontWeight: 800,
                                        background: 'rgba(247, 255, 196, 0.22)',
                                        color: '#f7ffc4',
                                        border: '1px solid #f7ffc4'
                                      }}>
                                        <Check size={12} /> Tech Dispatched
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateIncidentStatus(inc.id, 'Technician Dispatched', 'Technician dispatched on-site for diagnosis')}
                                        className="ksyn-btn"
                                        style={{
                                          padding: '5px 9px',
                                          fontSize: '0.6875rem',
                                          fontWeight: 700,
                                          background: 'rgba(247, 255, 196, 0.1)',
                                          color: '#f7ffc4',
                                          border: '1px solid rgba(247, 255, 196, 0.35)',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        Dispatch Tech
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIncidentStatus(inc.id, 'Resolved', 'Issue inspected and verified resolved on-site.')}
                                      className="ksyn-btn"
                                      style={{
                                        padding: '5px 9px',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        background: 'rgba(101, 130, 86, 0.15)',
                                        color: '#658256',
                                        border: '1px solid rgba(101, 130, 86, 0.45)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <Check size={12} /> Mark Resolved
                                    </button>
                                  </>
                                ) : (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    color: '#658256',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(101, 130, 86, 0.15)',
                                    border: '1px solid rgba(101, 130, 86, 0.4)'
                                  }}>
                                    <CheckCircle2 size={13} /> Closed / Resolved
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}

                  {incidents.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                        No incidents logged for this facility. Operational status is fully nominal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: STAFF ATTENDANCE & LIVE TIMECLOCK PUNCH STREAM (activeSection === 'shifts') */}
      {/* ========================================================================= */}
      {activeSection === 'shifts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={20} color="#e1c256" /> Live Staff Timeclock & Punch Stream
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Real-time biometric attendance records and timecard audits. Shift schedules are unified in the Weekly Floor & Staff Rota.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSectionSwitch('staff')}
              className="ksyn-btn ksyn-btn-gold"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Clock size={16} /> Open Weekly Floor & Staff Rota
            </button>
          </div>

          {/* Timeclock Attendance Logs Feed */}
          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2433', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#658256' }}>Live Staff Timeclock Punch Stream</span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Real-time Biometric & PIN Clock-Ins</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>STAFF MEMBER</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>ROLE</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>CLOCK-IN TIME</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>CLOCK-OUT TIME</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>TOTAL HOURS</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>PUNCTUALITY</th>
                  </tr>
                </thead>
                <tbody>
                  {(timeclockLogs || []).map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1a1e29' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>{log.staff_name}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.8125rem' }}>{log.role}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#658256', fontSize: '0.8125rem' }}>{log.clock_in}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: log.clock_out ? '#cbd5e1' : '#e1c256', fontSize: '0.8125rem' }}>
                        {log.clock_out || '— On Shift Now —'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', color: '#ffffff', fontWeight: 700 }}>
                        {log.total_hours ? `${log.total_hours} hrs` : 'Active'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: log.status === 'On Time' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.status === 'On Time' ? '#658256' : '#ef4444',
                          border: `1px solid ${log.status === 'On Time' ? '#658256' : '#ef4444'}40`
                        }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {timeclockLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                        No punch logs recorded today yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: VIP LOCKER LEASES (activeSection === 'lockers_vip') */}
      {/* ========================================================================= */}
      {activeSection === 'lockers_vip' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#e1c256" /> VIP Long-Term Locker Leases & Deposit Vault
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Permanent personal locker allocations with mandatory ₱200 refundable security deposit and ₱1,200/mo dues.
              </p>
            </div>
            {!isInvestorMode && (
              <button
                type="button"
                onClick={() => setShowAssignLockerModal(true)}
                className="ksyn-btn ksyn-btn-gold"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Lease VIP Locker
              </button>
            )}
          </div>

          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>LOCKER #</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>LEASED TO</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>LEASE TERM</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>MONTHLY DUES</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>₱200 DEPOSIT STATUS</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>EXPIRATION DATE</th>
                    {!isInvestorMode && <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {vipLockers.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #1a1e29' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#e1c256', fontFamily: 'monospace' }}>
                        #{l.locker_number}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{l.member_name}</div>
                        <div className="mono" style={{ fontSize: '0.6875rem', color: '#f7ffc4' }}>PIN: {l.pin_code || '****'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: '0.8125rem' }}>
                        {l.duration_months || 12} Months Lease
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#ffffff', fontWeight: 700 }}>
                        ₱{Number(l.monthly_fee || 1200).toLocaleString()}/mo
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: l.deposit_paid ? 'rgba(101, 130, 86, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: l.deposit_paid ? '#658256' : '#ef4444',
                          border: `1px solid ${l.deposit_paid ? '#658256' : '#ef4444'}40`
                        }}>
                          {l.deposit_paid ? '₱200 Deposited' : 'Deposit Due'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.8125rem' }}>
                        {l.end_date || '2026-12-31'}
                      </td>
                      {!isInvestorMode && (
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleReleaseVipLocker(l.id, l.locker_number)}
                            className="ksyn-btn"
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Release & Refund
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {vipLockers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                        No active VIP long-term locker leases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: PETTY CASH & EXPENSE VOUCHERS (activeSection === 'expenses') */}
      {/* ========================================================================= */}
      {activeSection === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="#e1c256" /> Counter Petty Cash & Operating Expense Vouchers
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Record authorized floor disbursements (cleaning supplies, emergency facility maintenance, local transport).
              </p>
            </div>
            {!isInvestorMode && (
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(true)}
                className="ksyn-btn ksyn-btn-gold"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Issue Expense Voucher
              </button>
            )}
          </div>

          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>VOUCHER NO & DATE</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>CATEGORY</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>PAYEE</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>DESCRIPTION / PURPOSE</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>AMOUNT (PHP)</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.75rem', color: '#9ca3af' }}>AUTHORIZATION</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #1a1e29' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#e1c256', fontFamily: 'monospace' }}>{exp.voucher_no || exp.id}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{new Date(exp.created_at || Date.now()).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1', fontSize: '0.8125rem' }}>{exp.category}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff', fontSize: '0.8125rem' }}>{exp.payee}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.8125rem', maxWidth: '300px' }}>{exp.description}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>
                        -₱{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: 'rgba(101, 130, 86, 0.15)',
                          color: '#658256',
                          border: '1px solid rgba(101, 130, 86, 0.4)'
                        }}>
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> {exp.approved_by || 'Branch Admin'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                        No petty cash disbursements logged this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: 14-DAY INACTIVITY CHURN PREDICTOR (activeSection === 'churn') */}
      {/* ========================================================================= */}
      {activeSection === 'churn' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#e1c256" /> 14-Day Inactivity Churn Risk & Retention Engine
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
              Proactively detect enrolled members with no recorded gym turnstile scans in the last 14+ days.
            </p>
          </div>

          {/* Retention Telemetry Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '12px', padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>AT-RISK ATHLETES</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', marginTop: '4px' }}>
                {churnRiskMembers.length}
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Inactive &gt; 14 days</span>
            </div>
            <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '12px', padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>RETENTION HEALTH SCORE</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace', marginTop: '4px' }}>
                {Math.round(((members.length - churnRiskMembers.length) / Math.max(1, members.length)) * 100)}%
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Active attendance ratio</span>
            </div>
            <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '12px', padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>RE-ENGAGEMENT PROMO</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace', marginTop: '6px' }}>
                COMEBACK20
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>20% OFF next renewal cycle</span>
            </div>
          </div>

          <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }} className="ksyn-custom-scrollbar table-infinite">
              <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
                  <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>MEMBER NAME</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>MEMBERSHIP PLAN</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>LAST TURNSTILE VISIT</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>INACTIVE DAYS</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>RISK SEVERITY</th>
                    {!isInvestorMode && <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.75rem', color: '#9ca3af', minWidth: '150px' }}>RETENTION ACTION</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Map(churnRiskMembers.map(m => [m.email || m.id, m])).values()).map((m) => {
                    const days = Number(m.days_inactive || 22);
                    const isSevere = days >= 21;
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #1a1e29' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>{m.name}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{maskEmail(m.email)} • {maskPhone(m.phone)}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: '0.8125rem' }}>
                          {m.plan_name || m.plan || 'Standard Tier'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.8125rem' }}>
                          {m.last_visit_date || '2026-09-28'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, color: isSevere ? '#ef4444' : '#e1c256' }}>
                          {days} days
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            background: isSevere ? 'rgba(239, 68, 68, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                            color: isSevere ? '#ef4444' : '#e1c256',
                            border: `1px solid ${isSevere ? '#ef4444' : '#e1c256'}40`
                          }}>
                            {isSevere ? 'CRITICAL RISK' : 'MODERATE RISK'}
                          </span>
                        </td>
                        {!isInvestorMode && (
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              disabled={reEngagingId === m.id}
                              onClick={() => handleReEngageMember(m.id, m.name)}
                              className="ksyn-btn ksyn-btn-gold"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Send size={13} /> {reEngagingId === m.id ? 'Sending...' : '1-Click Re-Engage SMS'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {churnRiskMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#658256' }}>
                        <span className="inline-flex items-center gap-1.5 justify-center">
                          <CheckCircle2 size={15} className="text-emerald-400" /> Outstanding member retention! No enrolled athletes are at risk of churn (&gt;14 days inactive).
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* VIEW: BRANCH ADMIN PROFILE SETTINGS & FACILITY ROTA (activeSection === 'profile') */}
      {/* ========================================================================= */}
      {activeSection === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={22} color="#e1c256" /> Branch Operations Admin Profile
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Facility management credentials, branch operational clearances, and synchronized weekly floor duty rota.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(101, 130, 86, 0.15)',
                color: '#658256',
                border: '1px solid rgba(101, 130, 86, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#658256' }} />
                Level 3 Supervisory Clearance
              </span>
            </div>
          </div>

          {/* Dossier Card */}
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{
                position: 'relative',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e1c256 0%, #658256 100%)',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 18px rgba(225, 194, 86, 0.25)'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#0d0f14',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256',
                  fontSize: '1.6rem',
                  fontWeight: 900
                }}>
                  {(user?.name || user?.username || 'BA').split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('')}
                </div>
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#658256',
                  border: '2px solid #0d0f14'
                }} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    {user?.name || user?.username || 'Branch Administrator'}
                  </h2>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    border: '1px solid rgba(225, 194, 86, 0.3)'
                  }}>
                    Branch Operations Admin
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={13} color="#658256" /> {user?.branch_name || 'Makati Flagship (MKT-01)'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={13} color="#94a3b8" /> {user?.email || 'admin@ksynfit.com'}
                  </span>
                  {user?.phone_number && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} color="#94a3b8" /> {user?.phone_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: '#161922', border: '1px solid #28324a', borderRadius: '12px', padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ color: '#e1c256', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                  {(adminRota || []).length}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                  Co-Admins
                </div>
              </div>
              <div style={{ background: '#161922', border: '1px solid #28324a', borderRadius: '12px', padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ color: '#658256', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                  {members.length}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                  Enrolled Members
                </div>
              </div>
              <div style={{ background: '#161922', border: '1px solid #28324a', borderRadius: '12px', padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ color: '#38bdf8', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                  {inventory.length}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                  Catalog SKUs
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Branch Operations Administration Duty Rota (Home Branch Administrators Only) */}
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Branch Operations Administration Duty Rota
                    </h2>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: 'rgba(225, 194, 86, 0.15)',
                      color: '#e1c256',
                      border: '1px solid rgba(225, 194, 86, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ShieldCheck size={12} /> Live {user?.branch_name || 'Makati Flagship'} Admin Command
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                    Exclusive supervisory schedule for branch administrators of this branch. Changes saved by any home branch admin are synchronized across all co-admins.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Branch-wide Shared Weekly Quota Pill */}
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: (adminRotaMeta.weekly_edits_remaining > 0 || user?.role === 'super_admin') ? 'rgba(101, 130, 86, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: (adminRotaMeta.weekly_edits_remaining > 0 || user?.role === 'super_admin') ? '#7fa36d' : '#f87171',
                    border: (adminRotaMeta.weekly_edits_remaining > 0 || user?.role === 'super_admin') ? '1px solid rgba(101, 130, 86, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Shared limit: All co-admins of this branch share a total of 2 revisions per week. Resets Monday."
                >
                  <Calendar size={12} />
                  <span>
                    Weekly Quota: {adminRotaMeta.weekly_edits_used}/2 Revisions Used ({adminRotaMeta.weekly_edits_remaining} Left)
                  </span>
                </span>

                {/* Publish Duty Rota Action */}
                <button
                  type="button"
                  onClick={handlePublishAdminRota}
                  disabled={publishingAdminRota || (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin')}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{
                    fontSize: '0.72rem',
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    opacity: (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') ? 0.5 : 1,
                    cursor: (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') ? 'not-allowed' : 'pointer'
                  }}
                  title={adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin' ? "Weekly quota reached (2/2 edits used across all branch admins)" : "Publish admin duty rota for this branch"}
                >
                  <CheckCircle2 size={12} />
                  <span>{publishingAdminRota ? 'Publishing...' : 'Publish Admin Rota'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSectionSwitch('staff')}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ fontSize: '0.72rem', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Users size={12} /> Floor Rota
                </button>
              </div>
            </div>

            {/* Quick 7-Day Supervisory Summary for Logged-In Admin */}
            {(() => {
              const currentDayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              const mySlot = (adminRota || []).find(a =>
                (a.staff_id && user?.id && a.staff_id === user.id) ||
                (a.coach_name && user?.name && a.coach_name.toLowerCase().includes(user.name.toLowerCase()))
              ) || (adminRota || [])[0];

              return (
                <div style={{
                  background: 'rgba(225, 194, 86, 0.04)',
                  border: '1px solid rgba(225, 194, 86, 0.25)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} />
                      <span>Your Scheduled Operations Duty:</span>
                      <span style={{ color: '#ffffff' }}>{user?.name || 'Elena Rostova'}</span>
                      <span style={{ fontSize: '0.6875rem', background: '#e1c256', color: '#000', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>YOU</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Home Branch Co-Admins: <strong style={{ color: '#658256' }}>{(adminRota || []).length} Active Administrators</strong>
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '4px' }}>
                    {rotaWeekDays.map(d => {
                      const isToday = currentDayKey === d.key;
                      const shift = mySlot ? (mySlot[d.key] || 'Rest / Standby') : 'Facility Command';
                      const isOff = shift.toLowerCase().includes('off') || shift.toLowerCase().includes('rest') || shift.toLowerCase().includes('standby');
                      return (
                        <div
                          key={d.key}
                          style={{
                            background: isToday ? 'rgba(225, 194, 86, 0.12)' : '#0b0d10',
                            border: isToday ? '1px solid #e1c256' : '1px solid #1f232b',
                            borderRadius: '10px',
                            padding: '10px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: isToday ? '#e1c256' : '#94a3b8' }}>
                              {d.short} • {d.dateStr}
                            </span>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOff ? '#64748b' : '#658256' }} />
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isToday ? '#ffffff' : (isOff ? '#94a3b8' : '#cbd5e1'), lineHeight: 1.3 }}>
                            {shift}
                          </div>
                          {isToday && (
                            <span style={{ fontSize: '0.625rem', color: '#e1c256', fontWeight: 800, textTransform: 'uppercase' }}>
                              Today's Command
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Branch Administrator Duty Roster Table (Admins & Co-Admins Only) */}
            <div style={{ borderTop: '1px solid #1f232b', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} style={{ color: '#e1c256' }} />
                  <span>Home Branch Administrator Rota ({(adminRota || []).length} Co-Admins Assigned):</span>
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Visible & Editable exclusively by {user?.branch_name || 'Makati Flagship'} Branch Administrators (Max 2 edits/wk branch-wide)
                </span>
              </div>

              {/* Weekly Quota Lock Alert Banner */}
              {adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin' && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={14} color="#ef4444" />
                    <span>
                      <strong>Weekly Edit Quota Reached (2/2 Used):</strong> This branch has used its shared weekly revisions across all branch administrators. Rota is locked and will reset next Monday.
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    Shared Branch Limit
                  </span>
                </div>
              )}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1f232b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#141820', color: '#94a3b8', borderBottom: '1px solid #1f232b' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Administrator & Title</th>
                      {rotaWeekDays.map(col => (
                        <th key={col.key} style={{ padding: '10px 8px', fontWeight: 700 }}>
                          <div>{col.short}</div>
                          <div style={{ color: '#e1c256', fontSize: '0.6875rem', fontWeight: 600 }}>({col.dateStr})</div>
                        </th>
                      ))}
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminRota || []).map((r, idx) => {
                      const isMe = (r.staff_id && user?.id && r.staff_id === user.id) ||
                        (r.coach_name && user?.name && r.coach_name.toLowerCase().includes(user.name.toLowerCase()));
                      return (
                        <tr
                          key={r.id || idx}
                          style={{
                            borderBottom: '1px solid #1a1e27',
                            background: isMe
                              ? 'rgba(225, 194, 86, 0.12)'
                              : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'),
                            boxShadow: isMe ? 'inset 3px 0 0 #e1c256' : 'none'
                          }}
                        >
                          <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{r.coach_name || r.name}</span>
                              {isMe ? (
                                <span style={{
                                  fontSize: '0.625rem',
                                  background: '#e1c256',
                                  color: '#000000',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  YOU (BRANCH ADMIN)
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.625rem',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  CO-ADMIN
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: isMe ? '#e1c256' : '#94a3b8', fontWeight: 500, marginTop: '2px' }}>
                              {r.specialty || 'Branch Operations Administrator'}
                            </div>
                          </td>
                          {rotaWeekDays.map(col => {
                            const val = r[col.key] || 'Rest / Standby';
                            const isOff = val.toLowerCase().includes('off') || val.toLowerCase().includes('rest') || val.toLowerCase().includes('standby');
                            return (
                              <td key={col.key} style={{ padding: '8px', color: isOff ? '#64748b' : '#38bdf8', fontSize: '0.7rem' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isOff ? 'rgba(255,255,255,0.02)' : 'rgba(56, 189, 248, 0.08)',
                                  border: isOff ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(56, 189, 248, 0.2)'
                                }}>
                                  {val}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') {
                                  toast.error('Weekly edit limit reached: Maximum 2 revisions allowed per week across all branch admins for this branch.', 'Quota Locked');
                                  return;
                                }
                                setEditingAdminRota({ ...r });
                              }}
                              disabled={adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin'}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{
                                fontSize: '0.6875rem',
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                opacity: (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') ? 0.45 : 1,
                                cursor: (adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin') ? 'not-allowed' : 'pointer'
                              }}
                              title={adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin' ? "Weekly quota reached (2/2 edits used across all branch admins)" : "Edit shift schedule"}
                            >
                              {adminRotaMeta.weekly_edits_remaining <= 0 && user?.role !== 'super_admin' ? <Lock size={11} /> : <Edit size={11} />}
                              <span>Edit Shift</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(adminRota || []).length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                          No branch admin duty rota published yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Admin Shift Edit Modal */}
          {editingAdminRota && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#0e111a', border: '1px solid #e1c256', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                      Adjust Admin Shift: {editingAdminRota.coach_name || editingAdminRota.name}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Updates will automatically synchronize for all co-admins in {user?.branch_name || 'Makati Flagship'}.
                      <span style={{ display: 'block', color: '#e1c256', marginTop: '2px', fontWeight: 700 }}>
                        Weekly Quota: {adminRotaMeta.weekly_edits_used}/2 edits used across all branch admins.
                      </span>
                    </p>
                  </div>
                  <button onClick={() => setEditingAdminRota(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveEditedAdminRota}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {rotaWeekDays.map(col => (
                      <div key={col.key}>
                        <label style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {col.name} <span style={{ color: '#e1c256' }}>({col.dateStr})</span>
                        </label>
                        <select
                          value={editingAdminRota[col.key] || '07:00 - 15:00 (Facility Command)'}
                          onChange={(e) => setEditingAdminRota({ ...editingAdminRota, [col.key]: e.target.value })}
                          className="ksyn-select"
                          style={{ width: '100%', fontSize: '0.75rem', padding: '6px 8px' }}
                        >
                          <option value="06:00 AM – 02:00 PM (Opening & Audit)">06:00 AM – 02:00 PM (Opening & Audit)</option>
                          <option value="07:00 - 15:00 (Facility Command)">07:00 - 15:00 (Facility Command)</option>
                          <option value="10:00 AM – 06:00 PM (Midday Operations)">10:00 AM – 06:00 PM (Midday Operations)</option>
                          <option value="02:00 PM – 10:00 PM (Evening Closing)">02:00 PM – 10:00 PM (Evening Closing)</option>
                          <option value="08:00 AM – 05:00 PM (Full Day Administration)">08:00 AM – 05:00 PM (Full Day Administration)</option>
                          <option value="Rest / Standby">Rest / Standby</option>
                          <option value="Off">Off</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingAdminRota(null)}
                      className="ksyn-btn ksyn-btn-outline"
                      style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ksyn-btn ksyn-btn-gold"
                      style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                    >
                      Save & Sync Admin Schedule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 3: MODAL: LOG INCIDENT / MAINTENANCE TICKET */}
      {/* ========================================================================= */}
      {showLogIncidentModal && (
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
                <AlertTriangle size={20} color="#e1c256" /> Log Incident / Maintenance Ticket
              </h2>
              <button
                type="button"
                onClick={() => setShowLogIncidentModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '18px' }}>
              Document hardware breakdowns, turnstile lockouts, locker faults, or athlete disciplinary violations.
            </p>

            <form onSubmit={handleLogIncident} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Category *</label>
                  <select
                    className="ksyn-input"
                    value={newIncidentForm.category}
                    onChange={(e) => setNewIncidentForm(f => ({ ...f, category: e.target.value }))}
                    required
                  >
                    <option value="Turnstile & Hardware">Turnstile & Hardware</option>
                    <option value="Locker & Facilities">Locker & Facilities</option>
                    <option value="Member Disciplinary">Member Disciplinary</option>
                    <option value="Equipment Damage">Equipment Damage</option>
                    <option value="HVAC & Plumbing">HVAC & Plumbing</option>
                    <option value="Safety & Medical">Safety & Medical</option>
                  </select>
                </div>

                <div>
                  <label className="ksyn-label">Severity Level *</label>
                  <select
                    className="ksyn-input"
                    value={newIncidentForm.severity}
                    onChange={(e) => setNewIncidentForm(f => ({ ...f, severity: e.target.value }))}
                    required
                  >
                    <option value="Low">Low (Informational)</option>
                    <option value="Medium">Medium (Attention Needed)</option>
                    <option value="High">High (Impacting Operations)</option>
                    <option value="Critical">Critical (Immediate Hazard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="ksyn-label">Incident Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Turnstile Lane 2 Optical Jam / Member Card Issue"
                  className="ksyn-input"
                  value={newIncidentForm.title}
                  onChange={(e) => setNewIncidentForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="ksyn-label">Detailed Notes / Operational Context</label>
                <textarea
                  rows={3}
                  placeholder="Describe the failure mode, member name (if disciplinary), or affected floor area..."
                  className="ksyn-input"
                  style={{ resize: 'vertical' }}
                  value={newIncidentForm.details}
                  onChange={(e) => setNewIncidentForm(f => ({ ...f, details: e.target.value }))}
                />
              </div>

              <div>
                <label className="ksyn-label">Initial Action Taken / Resolution Plan</label>
                <input
                  type="text"
                  placeholder="e.g. Reset turnstile controller power; scheduled vendor tech"
                  className="ksyn-input"
                  value={newIncidentForm.resolution_notes}
                  onChange={(e) => setNewIncidentForm(f => ({ ...f, resolution_notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowLogIncidentModal(false)}
                  className="ksyn-btn"
                  style={{ background: '#222', color: '#ccc' }}
                  disabled={submittingIncident}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-primary"
                  disabled={submittingIncident}
                >
                  {submittingIncident ? 'Recording Ticket...' : 'Submit Incident Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: RENEW / UPGRADE PLAN */}
      {/* ========================================================================= */}
      {showRenewModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Renew / Extend Membership
              </h2>
              <button
                type="button"
                onClick={() => setShowRenewModal(null)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '18px' }}>
              Renewing subscription for <strong style={{ color: '#e1c256' }}>{showRenewModal.name}</strong> ({showRenewModal.email})
            </p>

            <form onSubmit={handleRenewPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="ksyn-label">Select Package to Renew *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {MEMBERSHIP_PLANS.map((plan) => {
                    const isSelected = renewPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setRenewPlanId(plan.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(225, 194, 86, 0.12)' : '#0d0d0d',
                          border: `1.5px solid ${isSelected ? '#e1c256' : '#262626'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? '#e1c256' : '#fff' }}>
                            {plan.name}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{plan.tag} • {plan.duration}</div>
                        </div>
                        <div className="mono" style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#fff' }}>
                          ₱{plan.planFee.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="ksyn-label">Payment Channel *</label>
                <select
                  value={renewPaymentMethod}
                  onChange={(e) => setRenewPaymentMethod(e.target.value)}
                  className="ksyn-select"
                >
                  <option value="cash">Cash at Counter (POS)</option>
                  <option value="gcash">GCash (Merchant QR / QRPh)</option>
                  <option value="maya">Maya (Merchant QR / QRPh)</option>
                  <option value="card">Visa / Mastercard / JCB Terminal</option>
                  <option value="auto_debit">Recurring Auto-Debit (Contract Subscription)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowRenewModal(null)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="ksyn-btn ksyn-btn-gold">
                  Confirm Renewal (₱{getPlanDetails(renewPlanId).planFee.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: ADD MEMBER */}
      {/* ========================================================================= */}
      {showAddMember && (
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
          <div className="ksyn-card" style={{ maxWidth: '460px', width: '100%', background: '#141414' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Enroll New Gym Member</h2>
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="dob"
                  required
                  value={enrollFormData.dob || ''}
                  onChange={(e) => setEnrollFormData({ ...enrollFormData, dob: e.target.value })}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg px-4 py-3 text-white focus:border-[#e1c256] focus:outline-none transition-colors [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="ksyn-label">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="member@email.com"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              <div>
                <label className="ksyn-label">Philippine Mobile Number</label>
                <input
                  type="text"
                  placeholder="+63 917 123 4567"
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              <div>
                <label className="ksyn-label">Membership Package *</label>
                <select
                  value={newMember.membership_plan}
                  onChange={(e) => setNewMember({ ...newMember, membership_plan: e.target.value })}
                  className="ksyn-select"
                >
                  {MEMBERSHIP_PLANS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₱{p.planFee.toLocaleString()} ({p.tag})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ksyn-label">Physical RFID Keycard Serial / UID (Hardware Turnstile)</label>
                <input
                  type="text"
                  placeholder="e.g. KS-8829-4105"
                  value={newMember.rfid_card_uid || ''}
                  onChange={(e) => setNewMember({ ...newMember, rfid_card_uid: e.target.value })}
                  className="ksyn-input mono"
                />
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px' }}>
                  Enables instant physical tap access at turnstiles. If blank, auto-generates a unique UID.
                </div>
              </div>

              <div>
                <label className="ksyn-label">App Digital Account Password</label>
                <input
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="ksyn-input"
                  placeholder="Temporary password for mobile app"
                />
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px' }}>
                  Member logs into mobile app to unlock the rotating 60s dynamic QR pass.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="ksyn-btn ksyn-btn-gold">
                  Enroll & Issue Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: ADD INVENTORY */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: ADD GYM MACHINERY & FACILITY ASSET                                 */}
      {/* ========================================================================= */}
      {showAddEquipment && (
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
          <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', border: '1px solid rgba(225, 194, 86, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Dumbbell size={18} color="#e1c256" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Add Gym Floor Equipment</h2>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>Register machinery, free weights, or turnstile gates to facility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEquipment(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label">Equipment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Life Fitness Elevation Commercial Treadmill"
                  value={newEquipment.name}
                  onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Model Name / Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Elevation SE3 HD"
                    value={newEquipment.model}
                    onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                    className="ksyn-input"
                  />
                </div>
                <div>
                  <label className="ksyn-label">Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. LF-TM-2026-081"
                    value={newEquipment.serial_number}
                    onChange={(e) => setNewEquipment({ ...newEquipment, serial_number: e.target.value })}
                    className="ksyn-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Machinery Category</label>
                  <select
                    value={newEquipment.category}
                    onChange={(e) => setNewEquipment({ ...newEquipment, category: e.target.value })}
                    className="ksyn-select"
                  >
                    <option value="cardio">Cardio Equipment</option>
                    <option value="strength_machines">Strength Machines</option>
                    <option value="free_weights">Free Weights & Racks</option>
                    <option value="facility_access">Facility & Access Turnstile</option>
                  </select>
                </div>
                <div>
                  <label className="ksyn-label">Initial Status</label>
                  <select
                    value={newEquipment.status}
                    onChange={(e) => setNewEquipment({ ...newEquipment, status: e.target.value })}
                    className="ksyn-select"
                  >
                    <option value="operational">Operational</option>
                    <option value="under_maintenance">Under Maintenance</option>
                  </select>
                </div>
              </div>

              {/* Physical Floor vs Storage Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#181818', padding: '12px', borderRadius: '10px', border: '1px solid #282828' }}>
                <div>
                  <label className="ksyn-label" style={{ color: '#a3e635' }}>Active On Gym Floor</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newEquipment.on_floor}
                    onChange={(e) => setNewEquipment({ ...newEquipment, on_floor: Number(e.target.value) })}
                    className="ksyn-input"
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Units currently on floor</span>
                </div>
                <div>
                  <label className="ksyn-label" style={{ color: '#cbd5e1' }}>In Storage / Spare</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newEquipment.in_storage}
                    onChange={(e) => setNewEquipment({ ...newEquipment, in_storage: Number(e.target.value) })}
                    className="ksyn-input"
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Units held in storage</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Unit Valuation (₱)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="240000"
                    value={newEquipment.unit_value}
                    onChange={(e) => setNewEquipment({ ...newEquipment, unit_value: Number(e.target.value) })}
                    className="ksyn-input"
                  />
                </div>
                <div>
                  <label className="ksyn-label">Assigned Technician</label>
                  <input
                    type="text"
                    placeholder="FitSupplyGym Engineering"
                    value={newEquipment.assigned_technician}
                    onChange={(e) => setNewEquipment({ ...newEquipment, assigned_technician: e.target.value })}
                    className="ksyn-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEquipment(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submittingEquipment} className="ksyn-btn ksyn-btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> {submittingEquipment ? 'Registering...' : 'Register Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: ADD POS RETAIL PRODUCT                                             */}
      {/* ========================================================================= */}
      {showAddInventory && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.18)', border: '1px solid rgba(101, 130, 86, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={18} color="#84a971" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Add POS Retail Product</h2>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>Beverages, shake bar ingredients, and apparel inventory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInventory(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddInventory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label">Item Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Bottled Mineral Water Cases"
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">SKU</label>
                  <input
                    type="text"
                    placeholder="DRK-WTR-01"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    className="ksyn-input"
                  />
                </div>
                <div>
                  <label className="ksyn-label">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="ksyn-select"
                  >
                    <option value="beverages">Cold Beverages & RTD</option>
                    <option value="nutrition">Nutrition & Supplements</option>
                    <option value="merchandise">Apparel & Gear</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Initial Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                    className="ksyn-input"
                  />
                </div>
                <div>
                  <label className="ksyn-label">Reorder Threshold</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItem.reorder_threshold}
                    onChange={(e) => setNewItem({ ...newItem, reorder_threshold: Number(e.target.value) })}
                    className="ksyn-input"
                  />
                </div>
              </div>

              <div>
                <label className="ksyn-label">Unit Selling Price (₱)</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: Number(e.target.value) })}
                  className="ksyn-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddInventory(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="ksyn-btn ksyn-btn-gold">
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: MULTI-TENANT BRANCH TRANSFER (MEMBER / COACH / STAFF)             */}
      {/* ========================================================================= */}
      {transferTargetUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !transferSubmitting) setTransferTargetUser(null);
          }}
        >
          <div
            style={{
              background: '#101216',
              border: '1px solid #1f232b',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #1f232b', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Transfer to Another Branch
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Audited relocation of <strong style={{ color: '#e1c256' }}>{transferTargetUser.name}</strong> ({(transferTargetUser.role || 'member').toUpperCase()}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferTargetUser(null)}
                disabled={transferSubmitting}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Entity Summary */}
            <div style={{
              background: '#161922',
              border: '1px solid #282f3d',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                    {transferTargetUser.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {transferTargetUser.email}
                  </div>
                </div>
                <span style={{ fontSize: '0.6875rem', background: '#e1c256', color: '#000', fontWeight: 900, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {transferTargetUser.role || 'member'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '8px', borderTop: '1px solid #222838', paddingTop: '8px' }}>
                Current Station: <strong style={{ color: '#e1c256' }}>{user?.branch_name || 'Current Branch'}</strong>
              </div>
            </div>

            <form onSubmit={handleExecuteAdminTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Destination Branch *
                </label>
                <select
                  value={transferTargetBranchId}
                  onChange={(e) => setTransferTargetBranchId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid #3b82f6',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                >
                  {[
                    { id: 'b-mkt-01', name: 'KSYN Fitness Makati Flagship (MKT-01)' },
                    { id: 'b-kat-02', name: 'KSYN Fitness Katipunan (KAT-02)' },
                    { id: 'b-alb-03', name: 'KSYN Fitness Alabang (ALB-03)' },
                    { id: 'b-kap-04', name: 'KSYN Fitness Kapitolyo (KAP-04)' },
                    { id: 'b-frv-05', name: 'KSYN Fitness Fairview (FRV-05)' },
                    { id: 'b-del-06', name: 'KSYN Fitness Del Monte (DLM-06)' },
                    { id: 'b-tm-07', name: 'KSYN Fitness Tomas Morato (TMO-07)' }
                  ].filter(b => b.id !== (transferTargetUser.branch_id || branch?.id || user?.branch_id)).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Transfer Authorization Note
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Relocation request, coach shift rotation"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid #282f3d',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Data Isolation Callout */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.75rem',
                color: '#93c5fd'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#60a5fa', marginBottom: '4px' }}>
                  <ShieldCheck size={16} /> Strict Multi-Tenant Data Isolation
                </div>
                <span>
                  No ledger, revenue, or other user records are shared across branches. The target facility admin will only receive active roster authorization for {transferTargetUser.name}.
                </span>
              </div>

              {/* Notification Dispatch Callout */}
              <div style={{
                background: 'rgba(101, 130, 86, 0.08)',
                border: '1px solid rgba(101, 130, 86, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Bell size={14} color="#81c995" className="shrink-0" />
                <span>
                  Notification Dispatch Engine will immediately alert: (1) The user via SMS & portal, (2) Your branch transfer-out logs, (3) The destination branch admin.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setTransferTargetUser(null)}
                  disabled={transferSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: '1px solid #282f3d',
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#3b82f6',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: transferSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                  }}
                >
                  {transferSubmitting ? 'Transferring...' : 'Execute Branch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: ADD BRANCH STAFF */}
      {/* ========================================================================= */}
      {showAddStaffModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(225, 194, 86, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <UserCheck size={20} color="#e1c256" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Provision Branch Staff or Coach Account
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Direct Provisioning &bull; Instant Login Readiness</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Fixed non-editable Branch field displaying admin's branch name with lock icon */}
            <div style={{
              background: '#0d0d0d',
              border: '1px solid #262626',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Lock size={18} color="#e1c256" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Assigned Facility (Tenant Locked)
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>
                  Assigned Branch: {user?.branch_name || 'KSYN Fitness Makati'} ({user?.branch_code || 'MKT-01'}) <span style={{ color: '#e1c256', fontWeight: 500 }}>(Locked to your branch)</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Full Name */}
              <div>
                <label className="ksyn-label">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  pattern="[A-Za-z\s.,'-]+"
                  title="Letters, spaces, periods, commas, apostrophes, and hyphens only"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="ksyn-input"
                />
              </div>

              {/* Username / Email */}
              <div>
                <label className="ksyn-label">Username / Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria.staff@ksyn.com"
                  value={newStaff.email}
                  onChange={(e) => {
                    const emailVal = e.target.value;
                    setNewStaff(prev => ({
                      ...prev,
                      email: emailVal,
                      username: prev.username || emailVal.split('@')[0]
                    }));
                  }}
                  className="ksyn-input"
                />
              </div>

              {/* Mobile Number & Username */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="ksyn-label">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="+63 917 123 4567"
                    value={newStaff.phone_number}
                    onChange={(e) => setNewStaff({ ...newStaff, phone_number: e.target.value })}
                    className="ksyn-input"
                  />
                </div>
                <div>
                  <label className="ksyn-label">Login Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="maria.frontdesk"
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })}
                    className="ksyn-input"
                  />
                </div>
              </div>

              {/* Shift Role */}
              <div>
                <label className="ksyn-label">Assigned Shift / Operational Role</label>
                <select
                  value={newStaff.shift_role}
                  onChange={(e) => setNewStaff({ ...newStaff, shift_role: e.target.value })}
                  className="ksyn-select"
                >
                  <option value="Front Desk Staff">Front Desk Staff</option>
                  <option value="Fitness Coach / Personal Trainer">Fitness Coach / Personal Trainer</option>
                  <option value="Turnstile / Floor Operator">Turnstile / Floor Operator</option>
                  <option value="Shift Supervisor">Shift Supervisor</option>
                  <option value="Equipment & Maintenance Attendant">Equipment & Maintenance Attendant</option>
                </select>
              </div>

              {/* Initial Password with show/hide toggle */}
              <div>
                <label className="ksyn-label">Initial Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showStaffPass ? 'text' : 'password'}
                    required
                    placeholder="Set initial login password"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="ksyn-input"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPass(!showStaffPass)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showStaffPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Direct Provisioning Subtext Badge */}
              <div style={{
                background: 'rgba(225, 194, 86, 0.08)',
                border: '1px solid rgba(225, 194, 86, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.75rem',
                color: '#e1c256',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: 1.4
              }}>
                <ShieldCheck size={16} color="#e1c256" style={{ flexShrink: 0 }} />
                <span><strong>Direct Provisioning:</strong> This account will be active immediately with no OTP or email confirmation required.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="ksyn-btn ksyn-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={14} /> Provision Staff Account Immediately
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: RESET STAFF PASSWORD */}
      {/* ========================================================================= */}
      {showResetPassModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '420px', width: '100%', background: '#141414', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#e1c256" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Reset Staff Password</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPassModal(null)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '16px' }}>
              Assign a new temporary password for <strong style={{ color: '#ffffff' }}>{showResetPassModal.name}</strong> ({showResetPassModal.email}).
            </p>

            <form onSubmit={handleResetStaffPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label">New Temporary Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    value={resetPassValue}
                    onChange={(e) => setResetPassValue(e.target.value)}
                    className="ksyn-input"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowResetPassModal(null)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="ksyn-btn ksyn-btn-gold">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: CROSS-BRANCH GUEST CHECK-IN */}
      {/* ========================================================================= */}
      {showGuestCheckInModal && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} color="#e1c256" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Cross-Branch Guest Check-In
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGuestCheckInModal(false);
                  setGuestCheckInMemberId('');
                }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '16px' }}>
              Process turnstile check-in for members visiting from outside KSYN facilities.
              First 4 visits per month are complimentary; 5th+ visit incurs an automated ₱350 roaming fee.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGuestCheckIn(guestCheckInMemberId, guestPaymentMethod);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label className="ksyn-label">Select Visiting Member *</label>
                <select
                  required
                  value={guestCheckInMemberId}
                  onChange={(e) => setGuestCheckInMemberId(e.target.value)}
                  className="ksyn-select"
                  style={{ width: '100%', height: '40px' }}
                >
                  <option value="">-- Choose Member from Outside Branch --</option>
                  {outsideBranchMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email}) — Home: {m.branch_name || 'Outside Branch'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic status preview if member selected */}
              {guestCheckInMemberId && (() => {
                const memberObj = outsideBranchMembers.find(m => m.id === guestCheckInMemberId);
                const visitCount = (crossBranchVisits || []).filter(v => v.member_id === guestCheckInMemberId).length;
                const nextVisit = visitCount + 1;
                const isSurcharge = nextVisit >= 5;

                return (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isSurcharge ? 'rgba(225, 194, 86, 0.12)' : 'rgba(101, 130, 86, 0.12)',
                    border: `1px solid ${isSurcharge ? '#e1c256' : '#658256'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="inline-flex items-center gap-1.5" style={{ fontSize: '0.8125rem', fontWeight: 800, color: isSurcharge ? '#e1c256' : '#658256' }}>
                        {isSurcharge ? <><AlertTriangle size={14} /> Cross-Branch Limit Reached</> : <><CheckCircle2 size={14} /> Complimentary Roaming Visit</>}
                      </span>
                      <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff' }}>
                        {isSurcharge ? '₱350.00 Fee Required' : '₱0.00 (Free)'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      {memberObj?.name} has logged {visitCount} cross-branch visit{visitCount !== 1 ? 's' : ''} this month. This turnstile entry will be <strong>Visit #{nextVisit}</strong>.
                    </div>
                    {isSurcharge && (
                      <div style={{ fontSize: '0.6875rem', color: '#e1c256', marginTop: '6px' }}>
                        Notice: ₱350 roaming fee will be collected and recorded into your facility's daily sales ledger.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="ksyn-label">Payment Collection Method</label>
                <select
                  value={guestPaymentMethod}
                  onChange={(e) => setGuestPaymentMethod(e.target.value)}
                  className="ksyn-select"
                  style={{ width: '100%', height: '40px' }}
                >
                  <option value="counter_cash">Front Desk Cash (₱350 if applicable)</option>
                  <option value="pos_terminal">Card / POS Terminal</option>
                  <option value="gcash">GCash / QRPh Instant</option>
                  <option value="complimentary">Complimentary / Waived (First 4 Visits)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowGuestCheckInModal(false);
                    setGuestCheckInMemberId('');
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!guestCheckInMemberId}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} /> Confirm & Allow Turnstile Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Equipment Restock Request to HQ Modal */}
      {restockModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #222',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#181818'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(225, 194, 86, 0.15)', padding: '8px', borderRadius: '8px', color: '#e1c256' }}>
                  <PackageSearch size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff' }}>
                    Submit Equipment Restock Request to HQ
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Direct procurement requisition dispatched to Super Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendRestockRequest} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Read-Only Spec Summary Box */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid #222',
                borderRadius: '8px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Equipment Name
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                    {restockModalItem.item_name}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    SKU Code
                  </span>
                  <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e1c256' }}>
                    {restockModalItem.sku}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Current Quantity
                  </span>
                  <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 800, color: restockModalItem.is_low_stock ? '#e1c256' : '#7fa36d' }}>
                    {restockModalItem.quantity} units {restockModalItem.is_low_stock && '(Low Stock)'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Home Branch Facility
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#d1d5db' }}>
                    {user?.branch_name || 'Current Branch'}
                  </span>
                </div>
              </div>

              {/* Input: Requested Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Requested Quantity <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={restockForm.requestedQty}
                  onChange={(e) => setRestockForm({ ...restockForm, requestedQty: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.9375rem', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Specify the count of replacement or stocking units needed from HQ.
                </span>
              </div>

              {/* Priority Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Requisition Urgency / Priority
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRestockForm({ ...restockForm, urgency: 'Normal' })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: restockForm.urgency === 'Normal' ? '1px solid #658256' : '1px solid #262626',
                      background: restockForm.urgency === 'Normal' ? 'rgba(101, 130, 86, 0.12)' : '#1a1a1a',
                      color: restockForm.urgency === 'Normal' ? '#7fa36d' : '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCircle2 size={14} /> Normal Stocking
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestockForm({ ...restockForm, urgency: 'Critical' })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: restockForm.urgency === 'Critical' ? '1px solid #ef4444' : '1px solid #262626',
                      background: restockForm.urgency === 'Critical' ? 'rgba(239, 68, 68, 0.15)' : '#1a1a1a',
                      color: restockForm.urgency === 'Critical' ? '#f87171' : '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <AlertTriangle size={14} /> Urgent Replacement
                  </button>
                </div>
              </div>

              {/* Notes Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Procurement Notes / Memo for Super Admin (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Depleted supplement bar inventory, or equipment damaged during morning peak..."
                  value={restockForm.notes}
                  onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.8125rem' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRestockModalItem(null)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '10px 18px', fontSize: '0.875rem' }}
                  disabled={submittingRestock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '10px 20px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  disabled={submittingRestock}
                >
                  {submittingRestock ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Reorder Request to Super Admin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REPORT SHIPMENT DISCREPANCY (KULANG / DAMAGED) */}
      {/* ========================================================================= */}
      {discrepancyModalReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(239, 68, 68, 0.15)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#1c1314',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Report Shipment Discrepancy (Kulang / Damaged)
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '2px 0 0 0' }}>
                    Escalate damaged items or quantity shortage directly to Super Admin HQ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscrepancyModalReq(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmittingDiscrepancy(true);
                await handleVerifyShipment(discrepancyModalReq.id, false, discrepancyForm.shortageQty, discrepancyForm.damageNotes);
                setSubmittingDiscrepancy(false);
              }}
              style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>
                  {discrepancyModalReq.item_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '3px' }}>
                  Expected Delivery Quantity: <span style={{ color: '#e1c256', fontWeight: 700 }}>{discrepancyModalReq.requested_quantity} units</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Missing Quantity (Kulang Count)
                </label>
                <input
                  type="number"
                  min="0"
                  max={discrepancyModalReq.requested_quantity}
                  value={discrepancyForm.shortageQty}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, shortageQty: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.9375rem', fontWeight: 700 }}
                  placeholder="0 if all arrived but damaged"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Damage & Condition Notes (Kulang / Damaged Description) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Broken seal, cracked casing, or courier short-delivered by 3 boxes..."
                  value={discrepancyForm.damageNotes}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, damageNotes: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.8125rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDiscrepancyModalReq(null)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '9px 16px', fontSize: '0.8125rem' }}
                  disabled={submittingDiscrepancy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDiscrepancy}
                  className="ksyn-btn"
                  style={{ padding: '9px 18px', fontSize: '0.8125rem', fontWeight: 800, background: '#ef4444', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px' }}
                >
                  {submittingDiscrepancy ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Submitting Discrepancy...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Submit Discrepancy Note to HQ
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* MODAL: AUTOMATED SYSTEM RAFFLE DRAW CONFIRMATION */}
      {/* ========================================================================= */}
      {showDrawModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#141414', border: '1px solid #e1c256', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(225, 194, 86, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(225, 194, 86, 0.15)', border: '1px solid rgba(225, 194, 86, 0.3)', padding: '10px', borderRadius: '12px', color: '#e1c256' }}>
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>Automated System Raffle Draw</h3>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Random Automated Selection</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#1a1a1a', border: '1px solid #262626', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#e5e7eb', lineHeight: 1.6 }}>
                The system will randomly select <strong>1 winner</strong> from the <strong style={{ color: '#e1c256' }}>{freePassApplicants.filter(a => a.status === 'pending').length} eligible applicant(s)</strong> for {formattedMonthName}.
              </p>
              <div style={{ fontSize: '0.8125rem', color: '#9ca3af', background: 'rgba(225, 194, 86, 0.08)', border: '1px solid rgba(225, 194, 86, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                <ShieldCheck size={14} color="#e1c256" style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} /> <strong>Raffle Selection Policy:</strong> The winner is selected automatically at random from eligible applicants. Once drawn, the winner receives their 1-Day Trial Pass details via email.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDrawModal(false)}
                className="ksyn-btn ksyn-btn-outline"
                disabled={drawingWinner}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDrawSystemWinner}
                className="ksyn-btn ksyn-btn-gold"
                disabled={drawingWinner}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {drawingWinner ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Drawing Winner...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Confirm & Run System Draw
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======

      {/* Floating Restock Notification Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#141414',
          border: '1px solid #658256',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ background: 'rgba(101, 130, 86, 0.2)', padding: '6px', borderRadius: '50%', color: '#658256' }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#658256' }}>Procurement Requisition</div>
            <div style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{toastMessage}</div>
          </div>
          <Tooltip text="Dismiss notification" position="left">
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="touch-target"
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', marginLeft: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: ASSIGN STAFF SHIFT */}
      {/* ========================================================================= */}
      {showAddShiftModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={20} color="#e1c256" /> Assign Weekly Staff Shift
              </h2>
              <button
                type="button"
                onClick={() => setShowAddShiftModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Staff Member Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Santos"
                  value={shiftForm.staff_name}
                  onChange={(e) => setShiftForm({ ...shiftForm, staff_name: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Shift Role
                  </label>
                  <select
                    value={shiftForm.role}
                    onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  >
                    <option value="Front Desk Staff">Front Desk Staff</option>
                    <option value="Floor Coach / Trainer">Floor Coach / Trainer</option>
                    <option value="Maintenance & Turnstile Tech">Maintenance Tech</option>
                    <option value="Branch Supervisor">Branch Supervisor</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Day of Week
                  </label>
                  <select
                    value={shiftForm.day_of_week}
                    onChange={(e) => setShiftForm({ ...shiftForm, day_of_week: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Shift Type
                  </label>
                  <select
                    value={shiftForm.shift_type}
                    onChange={(e) => setShiftForm({ ...shiftForm, shift_type: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  >
                    <option value="Morning">Morning</option>
                    <option value="Mid">Mid</option>
                    <option value="Evening">Evening</option>
                    <option value="Closing">Closing</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingShift}
                  className="ksyn-btn ksyn-btn-gold"
                >
                  {submittingShift ? 'Scheduling...' : 'Save Shift Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: LEASE VIP LOCKER */}
      {/* ========================================================================= */}
      {showAssignLockerModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#e1c256" /> Lease VIP Permanent Locker
              </h2>
              <button
                type="button"
                onClick={() => setShowAssignLockerModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignVipLocker} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Locker # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VIP-05"
                    value={vipLockerForm.locker_number}
                    onChange={(e) => setVipLockerForm({ ...vipLockerForm, locker_number: e.target.value })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Member Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Santos"
                    value={vipLockerForm.member_name}
                    onChange={(e) => setVipLockerForm({ ...vipLockerForm, member_name: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Lease Term
                  </label>
                  <select
                    value={vipLockerForm.duration_months}
                    onChange={(e) => setVipLockerForm({ ...vipLockerForm, duration_months: Number(e.target.value) })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  >
                    <option value={3}>3 Months (₱3,600)</option>
                    <option value={6}>6 Months (₱7,200)</option>
                    <option value={12}>12 Months (₱14,400)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Electronic PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="4-digit PIN"
                    value={vipLockerForm.pin_code}
                    onChange={(e) => setVipLockerForm({ ...vipLockerForm, pin_code: e.target.value })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Deposit Banner */}
              <div style={{ background: 'rgba(101, 130, 86, 0.1)', border: '1px solid rgba(101, 130, 86, 0.3)', borderRadius: '10px', padding: '12px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#658256', fontWeight: 700 }}>
                  <span>Mandatory Security Deposit:</span>
                  <span className="mono">₱200.00 (Paid & Logged)</span>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '4px' }}>
                  Refundable upon termination of VIP lease & surrender of clean locker space.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignLockerModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLocker}
                  className="ksyn-btn ksyn-btn-gold"
                >
                  {submittingLocker ? 'Assigning...' : 'Authorize VIP Lease'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: ISSUE PETTY CASH EXPENSE VOUCHER */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '480px', width: '100%', background: '#141414', border: '1px solid #e1c256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="#e1c256" /> Issue Petty Cash Expense Voucher
              </h2>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Expense Category *
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%' }}
                >
                  <option value="Facility Cleaning Supplies">Facility Cleaning Supplies</option>
                  <option value="Urgent Hardware Repair">Urgent Hardware Repair</option>
                  <option value="Front Desk Petty Cash">Front Desk Petty Cash</option>
                  <option value="Local Courier / Logistics">Local Courier / Logistics</option>
                  <option value="Emergency First Aid Restock">Emergency First Aid Restock</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Payee / Vendor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ace Hardware Rockwell"
                    value={expenseForm.payee}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Amount (PHP) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="1450.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Business Justification / Items Purchased *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Restock floor disinfectant solution, spray bottles, and microfiber cloths for turnstile sanitization."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="ksyn-btn ksyn-btn-gold"
                >
                  {submittingExpense ? 'Issuing...' : 'Authorize Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: SUPERVISOR WITNESS PIN (DRAWER VARIANCE SIGN-OFF) */}
      {/* ========================================================================= */}
      {showWitnessModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '440px', width: '100%', background: '#141414', border: '1px solid #658256' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#658256" /> Supervisor Witness Sign-Off
              </h2>
              <button
                type="button"
                onClick={() => setShowWitnessModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifySupervisorPin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
                Witness authorization required to clear POS cash drawer float or end-of-day Z-Reading variances. Enters a cryptographically signed entry into the audit trail.
              </p>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Discrepancy / Variance Amount (PHP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={witnessForm.variance_amount}
                  onChange={(e) => setWitnessForm({ ...witnessForm, variance_amount: parseFloat(e.target.value) || 0 })}
                  className="ksyn-input mono"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Variance Audit Justification
                </label>
                <input
                  type="text"
                  value={witnessForm.reason}
                  onChange={(e) => setWitnessForm({ ...witnessForm, reason: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', display: 'block', marginBottom: '6px' }}>
                  Enter Supervisor 4-to-6 Digit Security PIN *
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••"
                  value={witnessForm.supervisor_pin}
                  onChange={(e) => setWitnessForm({ ...witnessForm, supervisor_pin: e.target.value })}
                  className="ksyn-input mono"
                  style={{ width: '100%', fontSize: '1.25rem', letterSpacing: '0.2em', textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowWitnessModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingWitness}
                  className="ksyn-btn"
                  style={{ background: '#658256', color: '#000', fontWeight: 800, padding: '8px 16px' }}
                >
                  {verifyingWitness ? 'Authenticating...' : 'Sign & Certify Audit Chain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5-Step Digital Onboarding Wizard Modal */}
      {showOnboardingWizard && (
        <MemberOnboardingWizard
          isOpen={showOnboardingWizard}
          onClose={() => {
            setShowOnboardingWizard(false);
            if (typeof loadBranchData === 'function') loadBranchData();
          }}
          defaultBranchId={user?.branch_id || 'b-mkt-01'}
        />
      )}

      {/* Member Profile KYC & Safety Protocol Modal */}
      {selectedMemberProfileModal && (
        <MemberProfileModal
          member={selectedMemberProfileModal}
          onClose={() => setSelectedMemberProfileModal(null)}
        />
      )}

      {/* Inter-Branch Transfer Coordination Email Modal */}
      {transferEmailModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '580px', width: '100%', background: '#12141a', border: '1px solid #e1c256', borderRadius: '14px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1f232b', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={20} color="#e1c256" /> Inter-Branch Transfer Coordination
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Communicate with target facility administrator regarding member relocation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferEmailModal(null)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#0a0c10', padding: '12px 14px', borderRadius: '8px', border: '1px solid #222' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Member Record:</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  {transferEmailModal.user_name} <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 600 }}>({transferEmailModal.user_email})</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px' }}>
                  Moving from: <span style={{ color: '#fca5a5', fontWeight: 700 }}>{transferEmailModal.from_branch_name}</span> &rarr; Target: <span style={{ color: '#86efac', fontWeight: 700 }}>{transferEmailModal.to_branch_name}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Destination Branch Admin (Recipient)
                </label>
                <input
                  type="email"
                  value={transferEmailRecipient}
                  onChange={(e) => setTransferEmailRecipient(e.target.value)}
                  className="ksyn-input mono"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Subject Line
                </label>
                <input
                  type="text"
                  value={transferEmailSubject}
                  onChange={(e) => setTransferEmailSubject(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Official Coordination Message
                </label>
                <textarea
                  rows="5"
                  value={transferEmailBody}
                  onChange={(e) => setTransferEmailBody(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #1f232b' }}>
                <a
                  href={`mailto:${transferEmailRecipient}?subject=${encodeURIComponent(transferEmailSubject)}&body=${encodeURIComponent(transferEmailBody)}`}
                  className="ksyn-btn"
                  style={{ padding: '8px 14px', fontSize: '0.8125rem', background: '#1c2130', border: '1px solid #2a334a', color: '#93c5fd', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ExternalLink size={14} /> Open in Mail App
                </a>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTransferEmailModal(null)}
                    className="ksyn-btn"
                    style={{ padding: '8px 14px', fontSize: '0.8125rem', background: '#1a1a1a', color: '#9ca3af', border: '1px solid #333' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={sendingTransferEmail || !transferEmailRecipient}
                    onClick={handleSendTransferEmail}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} /> {sendingTransferEmail ? 'Dispatching...' : 'Send Official Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
