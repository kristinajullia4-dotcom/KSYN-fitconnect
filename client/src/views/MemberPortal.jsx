import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import QRCode from 'qrcode';
import {
  QrCode,
  ShieldCheck,
  Clock,
  RefreshCw,
  Globe,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Award,
  CreditCard,
  Building2,
  Flame,
  MapPin,
  Users,
  User,
  UserCheck,
  Filter,
  Check,
  X,
  CalendarCheck,
  Dumbbell,
  Heart,
  Music,
  Target,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingUp,
  Scale,
  History,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Send,
  Sparkles,
  Calculator,
  CheckCheck,
  Eye,
  EyeOff,
  XCircle,
  AlertTriangle,
  Info,
  Radio,
  Copy,
  Star,
  Lightbulb,
  Utensils,
  Moon,
  ArrowRight,
  Shield,
  Tag,
  Receipt,
  DollarSign,
  Smartphone,
  Bell
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { MEMBERSHIP_PLANS, getPlanDetails, PT_PACKAGES, PROMO_CODES, calculatePlanPricing, getAvailablePromosForBranch } from '../config/membershipRates';
import MemberOnboardingWizard from '../components/MemberOnboardingWizard';
import SubscriptionBillingCard from '../components/SubscriptionBillingCard';
import { broadcastMemberUpgrade, broadcastClassBooking } from '../utils/portalSync';
import { saveVerifiedGoogleAccount } from '../utils/googleAccounts';
import { formatUserDisplayName } from '../utils/userDisplay';

export const isClassConcluded = (cls) => {
  if (!cls) return false;
  if (cls.is_concluded === true) return true;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const classDate = cls.date ? String(cls.date).split('T')[0] : todayStr;

  if (classDate < todayStr) return true;
  if (classDate > todayStr) return false;

  // If date is today, check end time
  const timeStr = cls.time || '';
  const parts = timeStr.split(/[\u2013\u2014-]/).map(s => s.trim());
  const endTimeStr = parts.length >= 2 ? parts[1] : parts[0];
  if (!endTimeStr) return false;

  const match = endTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return now >= endDateTime;
};

// Canonical Category & Discipline Normalization Engine
export const getCanonicalDiscipline = (cls) => {
  if (!cls) return { category: 'HIIT Conditioning', discipline: 'HIIT', color: '#ef4444' };
  const raw = `${cls.category || ''} ${cls.type || ''} ${cls.name || ''}`.toLowerCase();

  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('vinyasa') || raw.includes('sound bath') || raw.includes('stretch') || raw.includes('recovery')) {
    return { category: 'Yoga & Recovery', discipline: 'Yoga', color: '#658256' };
  }
  if (raw.includes('zumba') || raw.includes('dance') || raw.includes('rhythm')) {
    return { category: 'Zumba & Dance', discipline: 'Zumba', color: '#e1c256' };
  }
  if (raw.includes('boxing') || raw.includes('strike') || raw.includes('heavy bag') || raw.includes('combat') || raw.includes('punch') || raw.includes('kickbox')) {
    return { category: 'Boxing & Strike', discipline: 'Boxing', color: '#f97316' };
  }
  // Default for HIIT, Core Conditioning, Athletic Circuit, Spin, or generic Studio Class
  return { category: 'HIIT Conditioning', discipline: 'HIIT', color: '#ef4444' };
};

// 4 Signature Group Fitness Classes across branches
const INITIAL_CLASSES = [
  {
    id: 'cls-1',
    date: '2026-10-21',
    displayDate: 'Wed, Oct 21, 2026',
    dayOfWeek: 'Today (Wed)',
    time: '07:00 AM – 08:00 AM',
    type: 'Yoga',
    category: 'Yoga & Recovery',
    name: 'Sunrise Vinyasa Flow & Mobility',
    instructor: 'Coach Sofia Cruz',
    branch: 'KSYN Fitness Makati',
    branch_code: 'MKT-01',
    totalSlots: 20,
    availableSlots: 16,
    duration: '60 mins',
    room: 'Studio Alpha (Mind & Body)',
    intensity: 'All Levels'
  },
  {
    id: 'cls-2',
    date: '2026-10-21',
    displayDate: 'Wed, Oct 21, 2026',
    dayOfWeek: 'Today (Wed)',
    time: '08:30 AM – 09:20 AM',
    type: 'HIIT',
    category: 'HIIT Conditioning',
    name: 'Metcon Blast: Kettlebell & Turf Sprint',
    instructor: 'Coach Marco Ramos',
    branch: 'KSYN Fitness Katipunan',
    branch_code: 'KAT-02',
    totalSlots: 16,
    availableSlots: 9,
    duration: '50 mins',
    room: 'Functional Arena',
    intensity: 'High Intensity'
  },
  {
    id: 'cls-3',
    date: '2026-10-21',
    displayDate: 'Wed, Oct 21, 2026',
    dayOfWeek: 'Today (Wed)',
    time: '10:00 AM – 11:00 AM',
    type: 'Zumba',
    category: 'Zumba & Dance Cardio',
    name: 'Rhythm & Burn Cardio Fiesta',
    instructor: 'Coach Chloe Tan',
    branch: 'KSYN Fitness Makati',
    branch_code: 'MKT-01',
    totalSlots: 25,
    availableSlots: 19,
    duration: '60 mins',
    room: 'Studio Beta',
    intensity: 'Moderate to High'
  },
  {
    id: 'cls-4',
    date: '2026-10-22',
    displayDate: 'Thu, Oct 22, 2026',
    dayOfWeek: 'Tomorrow (Thu)',
    time: '12:00 PM – 12:50 PM',
    type: 'Yoga',
    category: 'Yoga & Recovery',
    name: 'Spinal Decompression & Core Recovery',
    instructor: 'Coach Sofia Cruz',
    branch: 'KSYN Fitness Alabang',
    branch_code: 'ALB-03',
    totalSlots: 20,
    availableSlots: 12,
    duration: '50 mins',
    room: 'Mind & Body Studio',
    intensity: 'All Levels'
  },
  {
    id: 'cls-5',
    date: '2026-10-22',
    displayDate: 'Thu, Oct 22, 2026',
    dayOfWeek: 'Tomorrow (Thu)',
    time: '05:30 PM – 06:30 PM',
    type: 'Boxing',
    category: 'Boxing & Strike',
    name: 'Heavy-Bag Power Combos & Footwork',
    instructor: 'Coach Brandon "The Bull" Reyes',
    branch: 'KSYN Fitness Makati',
    branch_code: 'MKT-01',
    totalSlots: 14,
    availableSlots: 4,
    duration: '60 mins',
    room: 'Combat Zone',
    intensity: 'High Intensity'
  },
  {
    id: 'cls-6',
    date: '2026-10-22',
    displayDate: 'Thu, Oct 22, 2026',
    dayOfWeek: 'Tomorrow (Thu)',
    time: '06:45 PM – 07:35 PM',
    type: 'HIIT',
    category: 'HIIT Conditioning',
    name: 'After-Burn: Anaerobic Capacity Protocol',
    instructor: 'Coach Marco Ramos',
    branch: 'KSYN Fitness Makati',
    branch_code: 'MKT-01',
    totalSlots: 16,
    availableSlots: 7,
    duration: '50 mins',
    room: 'Functional Arena',
    intensity: 'High Intensity'
  },
  {
    id: 'cls-7',
    date: '2026-10-23',
    displayDate: 'Fri, Oct 23, 2026',
    dayOfWeek: 'Friday',
    time: '07:00 PM – 08:00 PM',
    type: 'Yoga',
    category: 'Yoga & Recovery',
    name: 'Candlelight Restorative Stretch & Sound',
    instructor: 'Coach Maya Santos',
    branch: 'KSYN Fitness Kapitolyo',
    branch_code: 'KAP-04',
    totalSlots: 20,
    availableSlots: 14,
    duration: '60 mins',
    room: 'Mind & Body Studio',
    intensity: 'Gentle Recovery'
  },
  {
    id: 'cls-8',
    date: '2026-10-23',
    displayDate: 'Fri, Oct 23, 2026',
    dayOfWeek: 'Friday',
    time: '07:45 PM – 08:45 PM',
    type: 'Boxing',
    category: 'Boxing & Strike',
    name: 'Kickboxing Strike & Core Circuit',
    instructor: 'Coach Brandon Reyes',
    branch: 'KSYN Fitness Fairview',
    branch_code: 'FRV-05',
    totalSlots: 12,
    availableSlots: 3,
    duration: '60 mins',
    room: 'Combat Zone',
    intensity: 'High Intensity'
  }
];

// Error Boundary Component to protect DOM from runtime unhandled crashes
class PortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[KSYN MemberPortal ErrorBoundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          background: '#141414',
          border: '1px solid #333333',
          borderRadius: '16px',
          color: '#f9fafb',
          textAlign: 'center',
          maxWidth: '640px',
          margin: '40px auto'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(225, 194, 86, 0.15)',
            border: '2px solid #e1c256',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <ShieldCheck size={28} color="#e1c256" />
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '8px' }}>
            Member Dashboard Safety Active
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Your account session is secure. We detected a temporary rendering fault and recovered your workspace safely.
          </p>
          {this.state.error && (
            <div style={{ textAlign: 'left', background: '#0a0d14', border: '1px solid #ef444455', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.75rem', color: '#ef4444', overflow: 'auto', maxHeight: '180px' }}>
              <div style={{ fontWeight: 800, marginBottom: '4px' }}>{this.state.error.name}: {this.state.error.message}</div>
              <pre className="mono" style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
            </div>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="ksyn-btn ksyn-btn-gold"
            style={{ padding: '10px 24px', fontSize: '0.875rem', fontWeight: 800 }}
          >
            <RefreshCw size={15} /> Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fallback DataTable helper in case of reference failure
const SafeDataTable = ({ columns = [], data = [], title = '', emptyMessage = 'No records found.' }) => {
  if (DataTable) {
    return <DataTable columns={columns} data={data} title={title} emptyMessage={emptyMessage} />;
  }
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
      {title && <h3 style={{ color: '#e1c256', fontSize: '14px', textTransform: 'uppercase', marginBottom: '12px' }}>{title}</h3>}
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: '#e5e7eb', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #262626', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>
            {columns?.map((c, i) => (
              <th key={i} style={{ padding: '8px 12px' }}>{c?.header || c?.name || c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            (data || []).map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: '1px solid #1f1f1f' }}>
                {columns?.map((col, cIdx) => (
                  <td key={cIdx} style={{ padding: '10px 12px' }}>
                    {typeof col?.accessor === 'function' ? col.accessor(row) : row?.[col?.accessor || col?.field || col] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns?.length || 1} style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

function MemberPortalContent({
  activeSection: propActiveSection,
  setActiveSection: propSetActiveSection,
  activeTab = 'pass',
  onTabChange
}) {
  const { user, setUser, refreshUser, authFetch, setToken } = useAuth();
  const { toast } = useToast();

  const normalizeSection = (t) => {
    if (!t) return 'pass';
    const clean = String(t).replace('member_', '');
    if (clean === 'pass' || clean === 'qr' || clean === 'overview') return 'pass';
    if (
      clean === 'activity_progress' ||
      clean === 'progress' ||
      clean === 'attendance' ||
      clean === 'checkins' ||
      clean === 'history' ||
      clean === 'programs' ||
      clean === 'routines' ||
      clean === 'workout_plan' ||
      clean === 'workout_plans' ||
      clean === 'workouts' ||
      clean === 'fitness' ||
      clean === 'weight' ||
      clean === 'routine'
    ) return 'activity_progress';
    if (clean === 'classes' || clean === 'bookings' || clean === 'schedule') return 'classes';
    if (clean === 'chat' || clean === 'messages' || clean === 'coach_chat') return 'chat';
    if (clean === 'plan' || clean === 'subscription' || clean === 'membership' || clean === 'receipts' || clean === 'billing' || clean === 'renew') return 'plan';
    if (clean === 'profile' || clean === 'settings') return 'profile';
    return 'pass';
  };

  const [activeSection, setActiveSection] = useState(() => {
    const saved = localStorage.getItem('ksyn_member_subtab') || localStorage.getItem('ksyn_active_view_member');
    if (saved) return normalizeSection(saved);
    return normalizeSection(propActiveSection || activeTab || 'pass');
  });
  const [passData, setPassData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [subscription, setSubscription] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [attendanceViewMode, setAttendanceViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [autoDebitEnabled, setAutoDebitEnabled] = useState(() => {
    try {
      const cached = localStorage.getItem('ksyn_auto_debit_contract');
      if (cached !== null) return cached === 'true';
    } catch (e) {}
    return true;
  });
  const [showSandboxDrawer, setShowSandboxDrawer] = useState(false);
  const [showLinkMethodModal, setShowLinkMethodModal] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [showOnboardingPaywall, setShowOnboardingPaywall] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showRfidUid, setShowRfidUid] = useState(false);
  const [testScanResult, setTestScanResult] = useState(null);
  const [testScanning, setTestScanning] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showDevDiagnostics, setShowDevDiagnostics] = useState(false);

  // Phase 3: Gym Floor Density & Workout Program States
  const [floorDensity, setFloorDensity] = useState({
    current_occupancy: 48,
    max_capacity: 120,
    occupancy_pct: 40,
    status: 'OPTIMAL_FLOW',
    status_label: 'Moderate Flow (Standard Gym Activity)',
    badge_color: '#e1c256',
    branch_name: 'Makati Flagship (MKT-01)',
    hourly_forecast: [
      { hour: '06:00 AM', density: 'Low', pct: 25 },
      { hour: '08:00 AM', density: 'Moderate', pct: 55 },
      { hour: '12:00 PM', density: 'Moderate', pct: 50 },
      { hour: '03:00 PM', density: 'Low', pct: 30 },
      { hour: '05:30 PM', density: 'Peak', pct: 85 },
      { hour: '07:30 PM', density: 'Peak', pct: 80 },
      { hour: '09:00 PM', density: 'Moderate', pct: 45 }
    ]
  });
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [togglingExercise, setTogglingExercise] = useState(false);

  // Fitness & Weight Progress State
  const [progressData, setProgressData] = useState([]);
  const [baselineMetrics, setBaselineMetrics] = useState(null);
  const [showLogWeightModal, setShowLogWeightModal] = useState(false);
  const [weightModalDate, setWeightModalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newWeightInput, setNewWeightInput] = useState('');
  const [weightNotesInput, setWeightNotesInput] = useState('');
  const [weightModalError, setWeightModalError] = useState(null);
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [progressToast, setProgressToast] = useState(null);
  const [showTargetWeightModal, setShowTargetWeightModal] = useState(false);
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [savingTargetWeight, setSavingTargetWeight] = useState(false);
  const [targetWeightModalError, setTargetWeightModalError] = useState(null);

  // Group fitness class booking state
  const [classList, setClassList] = useState(INITIAL_CLASSES);
  const [bookedClassIds, setBookedClassIds] = useState([]);
  const [branchFilter, setBranchFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [bookingToast, setBookingToast] = useState(null);

  // Profile Settings Form State
  const [profileSavedToast, setProfileSavedToast] = useState(null);
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileEmergencyName, setProfileEmergencyName] = useState(user?.emergency_contact_name || user?.emergency_contact || '');
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState(user?.emergency_contact_phone || user?.emergency_phone || '');
  const [profileGoal, setProfileGoal] = useState(user?.fitness_goal || user?.goal || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.address || user.residential_address) setProfileAddress(user.address || user.residential_address);
      if (user.phone) setProfilePhone(user.phone);
      if (user.emergency_contact_name || user.emergency_contact) setProfileEmergencyName(user.emergency_contact_name || user.emergency_contact);
      if (user.emergency_contact_phone || user.emergency_phone) setProfileEmergencyPhone(user.emergency_contact_phone || user.emergency_phone);
      if (user.fitness_goal || user.primary_fitness_goal) setProfileGoal(user.fitness_goal || user.primary_fitness_goal);
    }
  }, [user]);

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          phone: profilePhone,
          address: profileAddress,
          residential_address: profileAddress,
          emergency_contact_name: profileEmergencyName,
          emergency_contact: profileEmergencyName,
          emergency_contact_phone: profileEmergencyPhone,
          emergency_phone: profileEmergencyPhone,
          fitness_goal: profileGoal,
          primary_fitness_goal: profileGoal
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        try { localStorage.setItem('ksyn_user', JSON.stringify(data.user)); } catch (err) {}
        try { broadcastMemberUpgrade({ memberId: data.user.id, updatedFields: data.user }); } catch (err) {}
        setProfileSavedToast(`Profile synchronized across KSYN network (${data.user.profile_completion_percentage}% completed).`);
        toast.success(`Profile saved successfully! Completion: ${data.user.profile_completion_percentage}%`, 'Profile Updated');
        setTimeout(() => setProfileSavedToast(null), 4000);
      } else {
        toast.error(data.message || 'Failed to update profile settings', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Network Error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Sprint 2: Coach Quick-Chat & Directory State
  const [coachMessages, setCoachMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const memberChatContainerRef = useRef(null);
  const isMemberAtBottomRef = useRef(true);
  const prevMemberMsgCountRef = useRef(0);
  const [assignedCoach, setAssignedCoach] = useState(null);
  const [availableCoaches, setAvailableCoaches] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState(null);
  const [allowCrossBranchBooking, setAllowCrossBranchBooking] = useState(false);
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatTag, setChatTag] = useState('Athlete Check-In');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [enrollingCoach, setEnrollingCoach] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('pt-12');
  const [preferredPtDate, setPreferredPtDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  });
  const [preferredPtTimeSlot, setPreferredPtTimeSlot] = useState('09:00 AM – 10:00 AM');
  const [ptGoal, setPtGoal] = useState('Weight Loss & Fat Reduction');
  const [selectedRenewalPlan, setSelectedRenewalPlan] = useState(() => subscription?.plan || user?.membership_plan || '1_day');
  const [coachBranchFilter, setCoachBranchFilter] = useState('home'); // 'home' (strictly focus on member's branch) | 'all'
  const [floorRota, setFloorRota] = useState([]);

  // Branch Relocation & Multi-Tenant Transfer state
  const [showBranchTransferModal, setShowBranchTransferModal] = useState(false);
  const [targetTransferBranchId, setTargetTransferBranchId] = useState('b-kat-02');
  const [transferReason, setTransferReason] = useState('Relocation / Closer to Home');
  const [transferLoading, setTransferLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showPromoCollapse, setShowPromoCollapse] = useState(false);
  const [showBiometricLedger, setShowBiometricLedger] = useState(false);
  const [showAssignedRoutine, setShowAssignedRoutine] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [activePromoCode, setActivePromoCode] = useState(() => {
    const bName = user?.branch_name || '';
    return bName.toLowerCase().includes('makati') ? 'MKT25' : null;
  });
  const [promoVerificationData, setPromoVerificationData] = useState({
    schoolName: '',
    studentId: '',
    partnerName: '',
    partnerEmail: '',
    companyName: '',
    corporateEmail: '',
    pnpId: ''
  });
  const [promoFeedback, setPromoFeedback] = useState(null);

  // Safe user fields with guaranteed fallbacks (memoized to prevent render cycle disruptions)
  const safeUser = useMemo(() => ({
    name: user?.name || 'Valued Member',
    email: user?.email || '',
    phone: user?.phone || profilePhone || '',
    address: user?.address || profileAddress || '',
    dob: user?.dob || '',
    branch_name: user?.branch_name || 'KSYN Fitness Makati',
    branch_code: user?.branch_code || 'MKT-01',
    branch_id: user?.branch_id || 'b-mkt-01',
    role: user?.role || 'member',
    id: user?.id || '',
    status: user?.status || 'active',
    membership_status: user?.membership_status || user?.status || 'active',
    membership_plan: user?.membership_plan || subscription?.plan || '',
    rfid_card_uid: user?.rfid_card_uid || null,
    auto_renew: user?.auto_renew ?? true
  }), [
    user?.name,
    user?.email,
    user?.phone,
    user?.address,
    user?.dob,
    profilePhone,
    profileAddress,
    user?.branch_name,
    user?.branch_code,
    user?.branch_id,
    user?.role,
    user?.id,
    user?.status,
    user?.membership_status,
    user?.membership_plan,
    user?.rfid_card_uid,
    user?.auto_renew,
    subscription?.plan
  ]);

  // Helper: scroll member chat container to bottom (NEVER scrolls browser window)
  const scrollMemberChatToBottom = (behavior = 'auto') => {
    const el = memberChatContainerRef.current;
    if (el) {
      if (behavior === 'smooth') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  };

  const handleMemberChatScroll = () => {
    const el = memberChatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
    isMemberAtBottomRef.current = atBottom;
  };

  // Initial entry into chat view: position scrollbar at bottom of conversation
  useEffect(() => {
    if (activeSection === 'chat' && assignedCoach) {
      isMemberAtBottomRef.current = true;
      const timer = setTimeout(() => {
        scrollMemberChatToBottom('auto');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeSection, assignedCoach]);

  // Auto-scroll ONLY when user is ALREADY at the bottom when a new message arrives
  useEffect(() => {
    if (activeSection !== 'chat') return;
    const currentCount = coachMessages.length;
    const isNew = currentCount > prevMemberMsgCountRef.current;
    prevMemberMsgCountRef.current = currentCount;

    if (isNew && isMemberAtBottomRef.current) {
      const timer = setTimeout(() => {
        scrollMemberChatToBottom('smooth');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [coachMessages, activeSection]);

  // Synchronize active member credentials to Google Accounts manager for 1-click chooser
  useEffect(() => {
    if (safeUser?.email && safeUser.email.includes('@')) {
      saveVerifiedGoogleAccount({
        email: safeUser.email,
        name: safeUser.name,
        status: 'Signed in'
      });
    }
  }, [safeUser?.email, safeUser?.name]);

  // PT Enrollment Payment Routing & Front Desk Clearance State
  const [showPtPaymentModal, setShowPtPaymentModal] = useState(false);
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState('online_xendit'); // 'online_xendit' | 'counter_cash'
  const [selectedOnlineSubmethod, setSelectedOnlineSubmethod] = useState('gcash'); // 'gcash', 'card', 'qr_ph'
  const [pendingPtEnrollment, setPendingPtEnrollment] = useState(null);
  const [loadingPtStatus, setLoadingPtStatus] = useState(false);
  const [isRedirectingXendit, setIsRedirectingXendit] = useState(false);

  // Helper: Settle and immediately update state and dashboard
  const handleSettleXenditSuccess = async (externalId, targetPlanTier, amount, explicitUserId) => {
    try {
      const savedCheckoutStr = localStorage.getItem('ksyn_pending_checkout');
      const savedCheckout = savedCheckoutStr ? JSON.parse(savedCheckoutStr) : null;
      const cachedUser = JSON.parse(localStorage.getItem('ksyn_user') || '{}');
      const targetUserId = explicitUserId || safeUser?.id || user?.id || savedCheckout?.userId || cachedUser?.id;
      const currentToken = localStorage.getItem('ksyn_token');

      const res = await fetch('/api/payments/xendit/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
        },
        body: JSON.stringify({
          external_id: externalId || savedCheckout?.externalId,
          planTier: targetPlanTier || savedCheckout?.planTier || selectedRenewalPlan || '1_month',
          userId: targetUserId,
          amount: amount || savedCheckout?.amount
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          localStorage.setItem('ksyn_token', data.token);
          if (typeof setToken === 'function') setToken(data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('ksyn_refresh_token', data.refreshToken);
        }
        if (data.user) setUser(data.user);
        if (data.subscription) {
          setSubscription(data.subscription);
          setSelectedRenewalPlan(data.subscription.plan);
        }
        try {
          const storedUser = JSON.parse(localStorage.getItem('ksyn_user') || '{}');
          localStorage.setItem('ksyn_user', JSON.stringify({
            ...storedUser,
            ...(data.user || {}),
            membership_plan: data.subscription?.plan || data.user?.membership_plan || targetPlanTier,
            membership_status: data.subscription?.status || 'active',
            subscription: data.subscription
          }));
        } catch (e) {}

        if (typeof loadMemberData === 'function') await loadMemberData();
        if (typeof refreshUser === 'function') await refreshUser();
        if (typeof generatePass === 'function') {
          try { await generatePass(true); } catch (e) {}
        }
        setShowOnboardingPaywall(false);
        setShowPtPaymentModal(false);
        localStorage.removeItem('ksyn_pending_checkout');
        const planName = getPlanDetails(data.subscription?.plan || targetPlanTier)?.name || 'Membership';
        toast.success(`Payment confirmed via Xendit! Your ${planName} plan is active.`, 'Plan Updated');
        return true;
      }
    } catch (err) {
      console.error('Error confirming Xendit settlement:', err);
    }
    return false;
  };

  // Handle Xendit Unified Hosted Checkout Redirection on the SAME TAB
  const handleProceedToXenditCheckout = async (planTier, amount, planName) => {
    setIsRedirectingXendit(true);
    try {
      const fetchFn = typeof authFetch === 'function' ? authFetch : fetch;
      const targetPlanTier = planTier || selectedRenewalPlan || '1_month';
      const targetAmount = amount || 500;
      const extId = `inv_ksyn_${Date.now()}`;

      // Persist pending checkout in localStorage before navigating
      localStorage.setItem('ksyn_pending_checkout', JSON.stringify({
        externalId: extId,
        planTier: targetPlanTier,
        amount: targetAmount,
        userId: safeUser?.id
      }));

      // Return URL points directly to Member Dashboard on the same tab
      const returnUrl = `${window.location.origin}/dashboard/member?payment_status=success&external_id=${extId}&plan_tier=${targetPlanTier}`;
      const failUrl = `${window.location.origin}/dashboard/member?payment_status=failed`;

      const res = await fetchFn('/api/payments/xendit/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: extId,
          planTier: targetPlanTier,
          amount: targetAmount,
          planName: planName || 'KSYN Fitness Membership',
          customerName: safeUser?.name || 'Valued Athlete',
          email: safeUser?.email || 'member@ksynfitness.com',
          phone: safeUser?.phone || '+639171234567',
          branchId: safeUser?.branch_id || 'b-mkt-01',
          userId: safeUser?.id || null,
          successRedirectUrl: returnUrl,
          failureRedirectUrl: failUrl
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.invoice_url) {
        throw new Error(data.message || 'Xendit Invoice generation failed.');
      }

      toast.info('Redirecting to official Xendit Hosted Checkout...', 'Xendit Gateway');
      // Navigate directly in the SAME TAB so no duplicate tab is created
      window.location.href = data.invoice_url;
    } catch (err) {
      console.error('[XENDIT] Checkout Error:', err);
      toast.error(err.message || 'Failed to initialize Xendit Checkout', 'Checkout Error');
      setIsRedirectingXendit(false);
    }
  };

  // Check URL query parameters and local storage for Xendit return status
  useEffect(() => {
    const handleCheckReturnStatus = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pStatus = params.get('payment_status') || params.get('status');
        const extId = params.get('external_id');
        const urlPlanTier = params.get('plan_tier');
        const enrollmentType = params.get('enrollment_type');

        const savedCheckoutStr = localStorage.getItem('ksyn_pending_checkout');
        const savedCheckout = savedCheckoutStr ? JSON.parse(savedCheckoutStr) : null;
        const savedPtCheckoutStr = localStorage.getItem('ksyn_pending_pt_checkout');
        const savedPtCheckout = savedPtCheckoutStr ? JSON.parse(savedPtCheckoutStr) : null;
        const cachedUser = JSON.parse(localStorage.getItem('ksyn_user') || '{}');

        const effectiveExtId = extId || savedCheckout?.externalId;
        const effectivePlanTier = urlPlanTier || savedCheckout?.planTier || selectedRenewalPlan || '1_month';
        const effectiveAmount = savedCheckout?.amount;
        const effectiveUserId = savedCheckout?.userId || safeUser?.id || user?.id || cachedUser?.id;

        const isPtReturn = enrollmentType === 'pt' || 
                           (extId && String(extId).startsWith('PT-')) ||
                           (savedPtCheckout && (extId === savedPtCheckout.externalId || !extId));

        if (pStatus === 'success' || pStatus === 'paid') {
          // Check if this was a PT Enrollment return
          if (isPtReturn) {
            const effectivePtExtId = extId || savedPtCheckout?.externalId;
            const effectivePtInvId = params.get('invoice_id') || savedPtCheckout?.invoiceId;
            const currentToken = localStorage.getItem('ksyn_token');
            const ptRes = await fetch('/api/members/pt-enrollments/confirm-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
              },
              body: JSON.stringify({
                external_id: effectivePtExtId,
                invoice_id: effectivePtInvId
              })
            });
            const ptData = await ptRes.json();
            if (ptData.success) {
              localStorage.removeItem('ksyn_pending_pt_checkout');
              window.history.replaceState({}, document.title, window.location.pathname);
              if (typeof loadMemberData === 'function') await loadMemberData();
              if (typeof refreshUser === 'function') await refreshUser();
              toast.success(`Payment confirmed via Xendit! 1-on-1 Personal Training with ${ptData.coach?.name || savedPtCheckout?.coachName || 'your coach'} is now active. Direct quick-chat is unlocked!`, 'PT Enrollment Active');
              return;
            }
          }

          // If this window is a child popup opened by main portal
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage({
                type: 'KSYN_PAYMENT_SUCCESS',
                external_id: effectiveExtId,
                plan_tier: effectivePlanTier
              }, '*');
              window.close();
              return;
            } catch (e) {}
          }

          // Main window: Confirm settlement and update plan immediately
          await handleSettleXenditSuccess(effectiveExtId, effectivePlanTier, effectiveAmount, effectiveUserId);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (pStatus === 'failed') {
          if (isPtReturn) {
            toast.error('PT enrollment payment was canceled or declined. You may retry checkout anytime.', 'Payment Incomplete');
            localStorage.removeItem('ksyn_pending_pt_checkout');
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            toast.error('The payment was canceled or declined. You may retry checkout.', 'Payment Incomplete');
            localStorage.removeItem('ksyn_pending_checkout');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.error('Error handling Xendit return status:', err);
      }
    };

    handleCheckReturnStatus();
  }, []);

  // Listen to cross-window message from checkout popup
  useEffect(() => {
    const handlePopupMessage = async (e) => {
      if (e.data?.type === 'KSYN_PAYMENT_SUCCESS') {
        const { external_id, plan_tier } = e.data;
        await handleSettleXenditSuccess(external_id, plan_tier);
      }
    };
    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [safeUser?.id]);

  useEffect(() => {
    if (subscription?.plan) {
      setSelectedRenewalPlan(subscription.plan);
    }
  }, [subscription?.plan]);

  const formatCoachName = (name) => {
    if (!name) return 'Personal Trainer';
    const clean = name.replace(/^Coach\s+/i, '').replace(/\([^)]*\)/g, '').trim();
    return `Coach ${clean}`;
  };

  const getCleanCoachName = (name) => {
    return formatCoachName(name);
  };

  const getCoachInitials = (name) => {
    if (!name) return 'PT';
    const clean = name.replace(/^Coach\s+/i, '').replace(/\([^)]*\)/g, '').trim();
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  // Filter coaches to strictly focus on member's home/planned branch by default (Image 1 & Image 2)
  const homeBranchName = safeUser?.branch_name || 'KSYN Fitness Makati';
  const homeBranchCode = safeUser?.branch_code || 'MKT-01';
  const homeBranchId = safeUser?.branch_id || 'b-mkt-01';

  const branchCoaches = useMemo(() => {
    if (!availableCoaches || availableCoaches.length === 0) return [];
    if (coachBranchFilter === 'all') return availableCoaches;

    const homeBranch = (homeBranchName || '').toLowerCase();

    return availableCoaches.filter(c => {
      if (!c) return false;
      const bIdMatch = c.branch_id && (
        c.branch_id === homeBranchId || 
        (homeBranchCode && c.branch_id.toLowerCase().includes(homeBranchCode.toLowerCase().replace(/[^a-z0-9]/g, '')))
      );
      const coachBranch = (c.branch_name || '').toLowerCase();
      const bNameMatch = (
        (homeBranch.includes('fairview') && coachBranch.includes('fairview')) ||
        (homeBranch.includes('makati') && coachBranch.includes('makati')) ||
        (homeBranch.includes('katipunan') && coachBranch.includes('katipunan')) ||
        (homeBranch.includes('alabang') && coachBranch.includes('alabang')) ||
        (homeBranch.includes('kapitolyo') && coachBranch.includes('kapitolyo')) ||
        (homeBranch.includes('del monte') && coachBranch.includes('del monte')) ||
        (homeBranch.includes('morato') && coachBranch.includes('morato')) ||
        (homeBranch.includes('timog') && coachBranch.includes('timog'))
      );
      return bIdMatch || bNameMatch;
    });
  }, [availableCoaches, coachBranchFilter, homeBranchName, homeBranchCode, homeBranchId]);

  const selectedCoach = useMemo(() => {
    if (!branchCoaches || branchCoaches.length === 0) {
      if (coachBranchFilter === 'all' && availableCoaches?.length > 0) {
        return availableCoaches.find(c => c.id === selectedCoachId) || availableCoaches[0];
      }
      return null;
    }
    return branchCoaches.find(c => c.id === selectedCoachId) || branchCoaches[0];
  }, [branchCoaches, selectedCoachId, coachBranchFilter, availableCoaches]);

  const isCoachInHomeBranch = useMemo(() => {
    if (!selectedCoach) return true;
    const cBranchId = selectedCoach.branch_id;
    const cBranch = (selectedCoach.branch_name || '').toLowerCase();
    const homeBranch = (homeBranchName || '').toLowerCase();
    
    if (cBranchId && homeBranchId && cBranchId === homeBranchId) return true;
    if (
      (homeBranch.includes('fairview') && cBranch.includes('fairview')) ||
      (homeBranch.includes('makati') && cBranch.includes('makati')) ||
      (homeBranch.includes('katipunan') && cBranch.includes('katipunan')) ||
      (homeBranch.includes('alabang') && cBranch.includes('alabang')) ||
      (homeBranch.includes('kapitolyo') && cBranch.includes('kapitolyo'))
    ) return true;
    return false;
  }, [selectedCoach, homeBranchId, homeBranchName]);

  // If subscription exists and is active, member is fully settled and unlocked
  const isPaymentPending = subscription 
    ? (subscription.status === 'pending_payment' || subscription.status === 'unpaid')
    : (user?.status === 'pending_payment');
  const isExpired = Boolean(
    (subscription && (subscription.status === 'expired' || subscription.status === 'cancelled')) ||
    passError?.code === 'MEMBERSHIP_PAYMENT_REQUIRED' ||
    (subscription?.end_date && new Date(subscription.end_date).getTime() < Date.now() && subscription?.plan !== '1_day')
  );
  const hasActivePlan = Boolean(
    subscription &&
    subscription.plan &&
    subscription.plan !== 'none' &&
    subscription.status === 'active' &&
    !isPaymentPending &&
    !isExpired
  );
  const isOneDayPass = hasActivePlan && (subscription?.plan === '1_day');
  const planEndDate = subscription?.end_date ? new Date(subscription.end_date) : null;
  const daysLeft = !hasActivePlan
    ? 0
    : isOneDayPass
      ? 1
      : (planEndDate ? Math.max(0, Math.ceil((planEndDate - new Date()) / (1000 * 60 * 60 * 24))) : 0);

  useEffect(() => {
    if (propActiveSection || activeTab) {
      const candidate = propActiveSection || activeTab;
      const saved = localStorage.getItem('ksyn_member_subtab') || localStorage.getItem('ksyn_active_view_member');
      if (candidate === 'overview' && saved && saved !== 'overview' && saved !== 'pass') {
        const target = normalizeSection(saved);
        setActiveSection(target);
        return;
      }
      const next = normalizeSection(candidate);
      setActiveSection(next);
      localStorage.setItem('ksyn_member_subtab', next);
      localStorage.setItem('ksyn_active_view_member', next);
    }
  }, [propActiveSection, activeTab]);

  const handleSectionSwitch = (sectionId) => {
    const target = normalizeSection(sectionId);
    setActiveSection(target);
    localStorage.setItem('ksyn_member_subtab', target);
    localStorage.setItem('ksyn_active_view_member', target);
    if (typeof propSetActiveSection === 'function') {
      propSetActiveSection(target);
    }
    if (typeof onTabChange === 'function') {
      onTabChange(target);
    }
  };

  const handleSectionChange = handleSectionSwitch;

  const handleTestScanFrontDesk = async () => {
    if (!passData?.token) {
      toast.warning('No active pass token to scan. Please generate a pass first.', 'Pass Required');
      return;
    }
    setTestScanning(true);
    try {
      const res = await authFetch('/api/turnstile/verify', {
        method: 'POST',
        body: JSON.stringify({ token: passData.token, reset_apb: true })
      });
      const data = await res.json();
      setTestScanResult(data);
      if (data.valid) {
        toast.success(`Access Granted for ${data.member?.name || safeUser.name}! Hardware Turnstile Unlocked.`, 'Front-Desk Scanner Verified');
        loadMemberData();
      } else {
        toast.error(data.message || 'Pass validation denied.', data.reason || 'Verification Failed');
      }
    } catch (err) {
      toast.error(err.message || 'Verification network request failed.', 'Scan Error');
    } finally {
      setTestScanning(false);
    }
  };

  // Generate dynamic rotating pass with local zero-latency QR encoding & offline failover
  async function generatePass(isManual = false) {
    try {
      setPassLoading(true);

      if (typeof authFetch !== 'function') {
        const demoToken = `DEMO.${safeUser.id || 'MBR-01'}.${Date.now()}`;
        const url = await QRCode.toDataURL(demoToken, {
          width: 220,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setPassData({ token: demoToken, ttl: 60 });
        setQrDataUrl(url);
        setPassError(null);
        setSecondsRemaining(60);
        setPassLoading(false);
        return;
      }

      const res = await authFetch('/api/qr/generate-pass');
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const errMsg = data?.message || (res.status === 403
          ? 'Active membership subscription required. Settle dues to unlock turnstile pass.'
          : 'Unable to generate dynamic turnstile pass.');
        setPassError({
          status: res.status,
          code: data?.error || 'PASS_LOCKED',
          message: errMsg
        });
        if (isManual) {
          toast.warning(errMsg, 'Turnstile Pass Notice');
        }
        setPassLoading(false);
        return;
      }

      // High-speed local QR generation (<3ms) with zero reliance on 3rd party APIs
      const url = await QRCode.toDataURL(data.token, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });

      setPassData(data);
      setQrDataUrl(url);
      setPassError(null);
      setSecondsRemaining(60);

      try {
        localStorage.setItem('ksyn_offline_turnstile_pass', JSON.stringify({
          token: data.token,
          dataUrl: url,
          cachedAt: Date.now()
        }));
      } catch (e) {}

      if (isManual) {
        toast.success('Dynamic 60-second cryptographic pass generated instantly.', 'QR Active');
      }
    } catch (err) {
      console.warn('[MemberPortal] Pass generation error:', err);
      try {
        const cachedStr = localStorage.getItem('ksyn_offline_turnstile_pass');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached?.token && cached?.dataUrl) {
            setPassData({ token: cached.token, ttl: 60, offline: true });
            setQrDataUrl(cached.dataUrl);
            setPassError({
              status: 'offline',
              code: 'OFFLINE_PASS',
              message: 'Using offline cached pass token. Turnstile scanner will verify HMAC signature.'
            });
            return;
          }
        }
      } catch (e) {}

      setPassError({
        status: 500,
        code: 'NETWORK_ERROR',
        message: 'Pass sync failed. Please check connection or show Member ID to Front Desk.'
      });
      if (isManual) {
        toast.error('Pass generation failed. Please retry.', 'QR Error');
      }
    } finally {
      setPassLoading(false);
    }
  }

  // Load Member Profile & History with defensive fallbacks
  async function loadMemberData() {
    try {
      setLoading(true);
      setFetchError(null);

      if (typeof authFetch !== 'function') {
        // Fallback demo state if authFetch is unavailable
        setSubscription({
          plan: '12_months',
          tier: 'elite',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          price: 15000,
          auto_renew: true
        });
        setAttendance([]);
        setLoading(false);
        return;
      }

      const [profileRes, attRes, progRes, chatRes, densityRes, plansRes, annRes, classesRes, coachesRes, ptStatusRes, floorRotaRes] = await Promise.all([
        authFetch('/api/auth/profile')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Profile fetch handled:', err);
            return null;
          }),
        authFetch('/api/qr/attendance-logs')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Attendance logs fetch handled:', err);
            return null;
          }),
        authFetch('/api/member/progress')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Fitness progress fetch handled:', err);
            return null;
          }),
        authFetch('/api/members/messages')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Coach messages fetch handled:', err);
            return null;
          }),
        authFetch('/api/members/floor-density')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Floor density fetch handled:', err);
            return null;
          }),
        authFetch('/api/members/workout-plans')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Workout plans fetch handled:', err);
            return null;
          }),
        authFetch('/api/announcements')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        authFetch('/api/classes')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        authFetch('/api/members/available-coaches')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('Available coaches fetch handled:', err);
            return null;
          }),
        authFetch('/api/members/pt-enrollments/status')
          .then(r => r.ok ? r.json() : null)
          .catch(err => {
            console.warn('PT enrollment status fetch handled:', err);
            return null;
          }),
        authFetch('/api/branch/floor-rota')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ]);

      if (ptStatusRes?.success) {
        if (ptStatusRes.has_active_contract && ptStatusRes.coach) {
          setAssignedCoach(ptStatusRes.coach);
          setPendingPtEnrollment(null);
        } else if (ptStatusRes.has_pending_enrollment) {
          setPendingPtEnrollment(ptStatusRes.pending_enrollment);
          setAssignedCoach(null);
        } else {
          setPendingPtEnrollment(null);
        }
      }

      if (floorRotaRes?.success && Array.isArray(floorRotaRes.rota)) {
        setFloorRota(floorRotaRes.rota);
      }

      if (annRes?.success && Array.isArray(annRes.announcements)) {
        setAnnouncements(annRes.announcements);
      }

      if (classesRes?.success && Array.isArray(classesRes.classes)) {
        const currentUserId = user?.id || profileRes?.user?.id;
        const currentEmail = user?.email || profileRes?.user?.email;
        const currentName = user?.name || profileRes?.user?.name;

        const matchesUser = (e) => {
          if (!e) return false;
          const eId = String(e.user_id || e.id || '');
          if (currentUserId && eId === String(currentUserId)) return true;
          if (e.email && currentEmail && e.email.toLowerCase().trim() === currentEmail.toLowerCase().trim()) return true;
          if (e.name && currentName && e.name.toLowerCase().trim() === currentName.toLowerCase().trim()) return true;
          return false;
        };

        const bookedIds = [];
        const mappedClasses = classesRes.classes.map(c => {
          const isEnrolled = c.my_booking || (Array.isArray(c.enrolled) && c.enrolled.some(matchesUser));
          if (isEnrolled) {
            bookedIds.push(c.id);
            if (c.id === 'cls-yoga-01') bookedIds.push('cls-1');
            if (c.id === 'cls-hiit-02') bookedIds.push('cls-2');
            if (c.id === 'cls-zumba-03') bookedIds.push('cls-3');
            if (c.id === 'cls-box-04') bookedIds.push('cls-4');
          }
          const canon = getCanonicalDiscipline(c);
          return {
            id: c.id,
            date: c.date,
            displayDate: c.date,
            time: c.time,
            type: canon.category,
            category: canon.category,
            discipline: canon.discipline,
            name: c.name,
            instructor: c.instructor || c.coach_name,
            branch: c.branch || c.branch_name || 'KSYN Fitness Makati',
            branch_id: c.branch_id,
            branch_code: c.branch_code || 'MKT-01',
            room: c.room,
            totalSlots: c.capacity || 20,
            availableSlots: c.available_slots !== undefined ? c.available_slots : Math.max(0, (c.capacity || 20) - (c.enrolled?.length || 0)),
            is_concluded: c.is_concluded
          };
        });
        if (mappedClasses.length > 0) {
          setClassList(mappedClasses);
        }
        setBookedClassIds(bookedIds);
      }

      if (profileRes?.success && profileRes?.user) {
        setUser(profileRes.user);
        try { localStorage.setItem('ksyn_user', JSON.stringify(profileRes.user)); } catch (e) {}
        if (profileRes.user.address || profileRes.user.residential_address) {
          setProfileAddress(profileRes.user.address || profileRes.user.residential_address);
        }
        if (profileRes.user.phone) {
          setProfilePhone(profileRes.user.phone);
        }
        if (profileRes.user.emergency_contact_name || profileRes.user.emergency_contact) {
          setProfileEmergencyName(profileRes.user.emergency_contact_name || profileRes.user.emergency_contact);
        }
        if (profileRes.user.emergency_contact_phone || profileRes.user.emergency_phone) {
          setProfileEmergencyPhone(profileRes.user.emergency_contact_phone || profileRes.user.emergency_phone);
        }
        if (profileRes.user.fitness_goal || profileRes.user.primary_fitness_goal) {
          setProfileGoal(profileRes.user.fitness_goal || profileRes.user.primary_fitness_goal);
        }
        if (profileRes.user.auto_renew !== undefined) {
          const isEnabled = Boolean(profileRes.user.auto_renew);
          setAutoDebitEnabled(isEnabled);
          try { localStorage.setItem('ksyn_auto_debit_contract', String(isEnabled)); } catch (e) {}
        }
      }

      if (profileRes?.success && profileRes?.subscription) {
        setSubscription(profileRes.subscription);
        if (profileRes.subscription.auto_renew !== undefined) {
          const isEnabled = Boolean(profileRes.subscription.auto_renew);
          setAutoDebitEnabled(isEnabled);
          try { localStorage.setItem('ksyn_auto_debit_contract', String(isEnabled)); } catch (e) {}
        }
        if (profileRes.subscription.status === 'pending_payment' || profileRes.subscription.status === 'unpaid') {
          setShowOnboardingPaywall(true);
        }
      } else if (profileRes?.user?.status === 'pending_payment') {
        const uPlan = profileRes.user.membership_plan;
        const resolved = getPlanDetails(uPlan);
        setSubscription({
          plan: resolved.id || uPlan || '',
          tier: resolved.tier || 'basic',
          status: 'pending_payment',
          price: resolved.totalDue || resolved.planFee || 0,
          total_paid: 0
        });
        setShowOnboardingPaywall(true);
      } else {
        const uPlan = profileRes?.user?.membership_plan;
        const userStatus = profileRes?.user?.status || user?.status;
        if (uPlan && userStatus === 'active') {
          const resolved = getPlanDetails(uPlan);
          setSubscription({
            plan: resolved.id || '',
            tier: resolved.tier || 'basic',
            status: 'active',
            start_date: '2026-10-01',
            end_date: '2026-11-01',
            price: resolved.totalDue || resolved.planFee || 0,
            auto_renew: resolved.id !== '1_day'
          });
        } else {
          setSubscription(null);
        }
      }

      const effectiveUserId = profileRes?.user?.id || safeUser?.id;
      if (effectiveUserId) {
        authFetch(`/api/payments/methods/${effectiveUserId}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const list = data?.payment_methods || data?.methods;
            if (data?.success && Array.isArray(list)) {
              setPaymentMethods(list);
            }
          })
          .catch(err => console.warn('Payment methods fetch handled:', err));
      }

      if (attRes?.success && Array.isArray(attRes?.logs)) {
        setAttendance(attRes.logs);
      } else {
        setAttendance([]);
      }

      if (progRes?.success) {
        if (Array.isArray(progRes.progress) && progRes.progress.length > 0) {
          setProgressData(progRes.progress);
        }
        if (progRes.baseline) {
          setBaselineMetrics(progRes.baseline);
        }
      }

      if (chatRes?.success) {
        if (Array.isArray(chatRes.messages)) {
          setCoachMessages(chatRes.messages);
        }
        if (chatRes.is_coach_typing !== undefined) {
          setIsCoachTyping(Boolean(chatRes.is_coach_typing));
        }
        if (chatRes.coach) {
          setAssignedCoach(prev => ({
            ...(prev || {}),
            ...chatRes.coach,
            avatar_url: chatRes.coach.avatar_url || prev?.avatar_url || null,
            profile_image: chatRes.coach.profile_image || prev?.profile_image || null
          }));
        }
      }

      if (densityRes?.success) {
        setFloorDensity(densityRes);
      }

      if (plansRes?.success && Array.isArray(plansRes.plans)) {
        setWorkoutPlans(plansRes.plans);
        if (plansRes.plans.length > 0 && plansRes.plans[0].coach_name) {
          setAssignedCoach(prev => prev || {
            id: plansRes.plans[0].coach_id,
            name: plansRes.plans[0].coach_name,
            specialty: 'Personal Trainer'
          });
        }
      } else {
        setWorkoutPlans([]);
      }

      if (coachesRes?.success && Array.isArray(coachesRes.coaches)) {
        setAvailableCoaches(coachesRes.coaches);
        if (coachesRes.coaches.length > 0) {
          setSelectedCoachId(prev => prev || coachesRes.coaches[0].id);
        }
      }

      // Fetch multi-tenant notifications (e.g. branch transfer confirmation)
      authFetch('/api/notifications')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.notifications) setNotifications(d.notifications); })
        .catch(() => null);

      generatePass();
    } catch (err) {
      console.warn('Non-fatal loadMemberData error:', err);
      setFetchError('Failed to synchronize data from server. Running in offline fallback mode.');
    } finally {
      setLoading(false);
    }
  }

  // Dismiss notification handler
  const handleDismissNotification = async (notifId) => {
    try {
      await authFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    } catch (e) {}
  };

  // Branch Transfer execution handler
  const handleExecuteBranchTransfer = async (e) => {
    e?.preventDefault?.();
    if (!targetTransferBranchId) return;
    setTransferLoading(true);
    try {
      const res = await authFetch('/api/branch/transfer-user', {
        method: 'POST',
        body: JSON.stringify({
          targetBranchId: targetTransferBranchId,
          reason: transferReason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Branch transfer failed.');
      }
      if (data.pendingApproval) {
        toast.info(data.message || 'Transfer request submitted! Awaiting destination Branch Admin verification and acceptance.', 'Request Submitted');
      } else {
        toast.success(data.message || 'Branch transfer completed with strict tenant data isolation.', 'Transfer Confirmed');
      }
      setShowBranchTransferModal(false);
      if (typeof refreshUser === 'function') await refreshUser();
      await loadMemberData();
    } catch (err) {
      toast.error(err.message || 'Failed to execute transfer.', 'Transfer Error');
    } finally {
      setTransferLoading(false);
    }
  };

  // Real-time Coach Quick-Chat short-polling (every 1.8s while in Chat view)
  useEffect(() => {
    if (activeSection !== 'chat' || !assignedCoach) return;
    const pollInterval = setInterval(async () => {
      try {
        if (typeof authFetch === 'function') {
          const res = await authFetch('/api/members/messages');
          if (res && res.ok) {
            const data = await res.json();
            if (data?.success) {
              if (Array.isArray(data.messages)) {
                setCoachMessages(prev => {
                  if (prev.length === data.messages.length) {
                    const lastP = prev[prev.length - 1];
                    const lastN = data.messages[data.messages.length - 1];
                    if (lastP?.id === lastN?.id && lastP?.created_at === lastN?.created_at) {
                      return prev;
                    }
                  }
                  return data.messages;
                });
              }
              setIsCoachTyping(Boolean(data.is_coach_typing));
            }
          }
        }
      } catch (err) {
        // silent polling catch
      }
    }, 1800);
    return () => clearInterval(pollInterval);
  }, [activeSection, assignedCoach, authFetch]);

  // Member typing indicator debouncing
  const memberTypingTimeoutRef = React.useRef(null);
  const handleMemberTypingChange = (e) => {
    const val = e.target.value;
    setChatInput(val);
    if (!assignedCoach) return;

    if (memberTypingTimeoutRef.current) {
      clearTimeout(memberTypingTimeoutRef.current);
    }

    if (val.trim()) {
      if (typeof authFetch === 'function') {
        authFetch('/api/members/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typing: true })
        }).catch(() => {});
      }

      memberTypingTimeoutRef.current = setTimeout(() => {
        if (typeof authFetch === 'function') {
          authFetch('/api/members/messages/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ typing: false })
          }).catch(() => {});
        }
      }, 2500);
    } else {
      if (typeof authFetch === 'function') {
        authFetch('/api/members/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typing: false })
        }).catch(() => {});
      }
    }
  };

  // Phase 3: Toggle Completed Exercise on Member Workout Routine
  const handleToggleExerciseComplete = async (planId, exerciseIdx) => {
    try {
      setTogglingExercise(true);
      const res = await authFetch(`/api/members/workout-plans/${planId}/complete-exercise`, {
        method: 'POST',
        body: JSON.stringify({ exerciseIndex: exerciseIdx })
      });
      const data = await res.json();
      if (data.success && data.plan) {
        setWorkoutPlans(prev => prev.map(p => p.id === planId ? data.plan : p));
        const updatedEx = data.plan.exercises?.[exerciseIdx];
        if (updatedEx?.completed) {
          toast.success(`Completed "${updatedEx.name}"! Great work!`, 'Exercise Checked Off');
        } else {
          toast.info(`Marked "${updatedEx?.name || 'Exercise'}" as incomplete.`, 'Progress Updated');
        }
      }
    } catch (err) {
      toast.error(err.message, 'Update Failed');
    } finally {
      setTogglingExercise(false);
    }
  };

  // Handle logging a new weight measurement
  async function handleLogWeight(e) {
    e?.preventDefault?.();
    setWeightModalError(null);

    const val = parseFloat(newWeightInput);
    if (isNaN(val) || val < 30.0 || val > 250.0) {
      setWeightModalError('Weight entry must be a valid number between 30.0 kg and 250.0 kg.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const chosenDate = weightModalDate || todayStr;
    if (chosenDate > todayStr) {
      setWeightModalError('Future dates are not allowed. Please select today or a past date.');
      return;
    }

    try {
      setLoggingWeight(true);
      if (typeof authFetch === 'function') {
        const payload = {
          weight_kg: val,
          logged_at: chosenDate,
          notes: (weightNotesInput || '').trim()
        };
        if (targetWeightInput && !isNaN(parseFloat(targetWeightInput))) {
          payload.target_weight_kg = parseFloat(targetWeightInput);
        }
        const res = await authFetch('/api/member/progress', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          setShowLogWeightModal(false);
          setNewWeightInput('');
          setWeightNotesInput('');
          setWeightModalError(null);
          setSelectedCalendarDate(chosenDate);
          setProgressToast(`Weigh-in of ${val.toFixed(1)} kg logged successfully!`);
          toast.success(`Weigh-in of ${val.toFixed(1)} kg logged successfully!`, 'Metrics Saved');
          setTimeout(() => setProgressToast(null), 4000);

          // Refresh progress data immediately
          const refRes = await authFetch('/api/member/progress');
          if (refRes.ok) {
            const refData = await refRes.json();
            if (refData?.success) {
              if (Array.isArray(refData.progress)) setProgressData(refData.progress);
              if (refData.baseline) setBaselineMetrics(refData.baseline);
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || 'Failed to record weight entry.';
          setWeightModalError(errMsg);
          toast.error(errMsg, 'Entry Error');
        }
      }
    } catch (err) {
      console.error('[MemberPortal] Error logging weight:', err);
      setWeightModalError('Network error while logging weight. Please try again.');
      toast.error('Network error while logging weight.', 'Error');
    } finally {
      setLoggingWeight(false);
    }
  }

  // Handle Member Target / Goal Weight Update
  async function handleSaveTargetWeight(e) {
    e?.preventDefault?.();
    const val = parseFloat(targetWeightInput);
    if (isNaN(val) || val < 30 || val > 250) {
      setTargetWeightModalError('Target weight must be between 30.0 kg and 250.0 kg.');
      return;
    }
    setSavingTargetWeight(true);
    setTargetWeightModalError(null);
    try {
      const res = await authFetch('/api/member/target-weight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_weight_kg: val })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Target goal weight set to ${val.toFixed(1)} kg!`, 'Goal Updated');
        setBaselineMetrics(prev => ({ ...(prev || {}), target_weight: val }));
        setShowTargetWeightModal(false);
        setTargetWeightInput('');
        const refRes = await authFetch('/api/member/progress');
        if (refRes.ok) {
          const refData = await refRes.json();
          if (refData?.success && refData.baseline) setBaselineMetrics(refData.baseline);
        }
      } else {
        setTargetWeightModalError(data.message || 'Failed to update target weight.');
        toast.error(data.message || 'Failed to update target weight.', 'Error');
      }
    } catch (err) {
      setTargetWeightModalError(err.message || 'Network error updating target weight.');
      toast.error('Network error updating target weight.', 'Error');
    } finally {
      setSavingTargetWeight(false);
    }
  }

  // Sprint 2: Handle Sending Message to Coach
  async function handleSendMemberMessage(e, presetText = null) {
    e?.preventDefault?.();
    const content = (presetText || chatInput || '').trim();
    if (!content) return;

    if (!assignedCoach) {
      toast.warning('No personal coach assigned. Avail a PT package to message a trainer.', 'Coach Required');
      return;
    }

    try {
      setSendingMsg(true);
      if (memberTypingTimeoutRef.current) clearTimeout(memberTypingTimeoutRef.current);
      if (typeof authFetch === 'function') {
        authFetch('/api/members/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typing: false })
        }).catch(() => {});

        const res = await authFetch('/api/members/messages', {
          method: 'POST',
          body: JSON.stringify({
            content,
            tag: chatTag || 'Athlete Check-In'
          })
        });

        if (res.ok) {
          const data = await res.json();
          setChatInput('');
          toast.success(`Message sent to ${assignedCoach?.name || 'Coach'}`, 'Coach Message Sent');
          if (data.data) {
            setCoachMessages(prev => [...prev, data.data]);
            isMemberAtBottomRef.current = true;
            setTimeout(() => {
              scrollMemberChatToBottom('smooth');
            }, 50);
          } else {
            const refRes = await authFetch('/api/members/messages');
            if (refRes.ok) {
              const refData = await refRes.json();
              if (refData.success && Array.isArray(refData.messages)) setCoachMessages(refData.messages);
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.message || 'Failed to deliver message.', 'Error');
        }
      }
    } catch (err) {
      console.error('[MemberPortal] Error sending message:', err);
      toast.error('Network error sending message.', 'Error');
    } finally {
      setSendingMsg(false);
    }
  }

  // Handle Member 1-on-1 PT Coach Enrollment - Opens Payment Channel Routing Modal
  function handleEnrollCoach() {
    const bookingCoach = selectedCoach || branchCoaches[0] || (availableCoaches || []).find(c => c.id === selectedCoachId) || availableCoaches[0];
    const dayNamesList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const pickedDateDay = dayNamesList[new Date(preferredPtDate).getDay()];
    const coachRotaRecord = (floorRota || []).find(r => 
      (r.staff_id && bookingCoach && r.staff_id === bookingCoach.id) || 
      (r.coach_name && bookingCoach?.name && (
        r.coach_name.toLowerCase().includes(bookingCoach.name.toLowerCase()) || 
        bookingCoach.name.toLowerCase().includes(r.coach_name.toLowerCase())
      ))
    );
    const scheduledCoachShift = coachRotaRecord ? coachRotaRecord[pickedDateDay] : null;
    const hasPublishedRota = Boolean(coachRotaRecord && scheduledCoachShift && scheduledCoachShift.trim() !== '');
    const isCoachOffDutyOnDate = hasPublishedRota && (scheduledCoachShift.toLowerCase().includes('off') || scheduledCoachShift.toLowerCase().includes('rest'));

    const todayIsoStr = new Date().toISOString().split('T')[0];
    const maxBookingDateStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (preferredPtDate && preferredPtDate < todayIsoStr) {
      toast.error('Session date cannot be in the past. Please select a current or upcoming date.', 'Invalid Date');
      return;
    }

    if (preferredPtDate && preferredPtDate > maxBookingDateStr) {
      toast.error('Personal training sessions can only be booked within 2 weeks of the chosen date. Please select an earlier date.', 'Booking Window Limit');
      return;
    }

    if (!hasPublishedRota) {
      toast.error(`The floor rota for ${getCleanCoachName(bookingCoach?.name)} has not been published yet for ${pickedDateDay.charAt(0).toUpperCase() + pickedDateDay.slice(1)}. Enrollment is unavailable until shifts are posted.`, 'Rota Not Published');
      return;
    }

    if (isCoachOffDutyOnDate) {
      toast.error(`${getCleanCoachName(bookingCoach?.name)} is off-duty on ${pickedDateDay}s (${scheduledCoachShift}). Please pick an available date.`, 'Trainer Unavailable');
      return;
    }

    setShowPtPaymentModal(true);
  }

  // Submit PT Enrollment with Selected Payment Channel (Online via Xendit or OTC Cash at Front Desk)
  async function handleInitiatePtEnrollment() {
    try {
      const targetCoach = selectedCoach || branchCoaches[0] || (availableCoaches || []).find(c => c.id === selectedCoachId) || availableCoaches[0];
      const targetCoachId = targetCoach?.id || selectedCoachId || 'u1000000-0000-0000-0000-000000000005';
      const selectedPkg = PT_PACKAGES.find(p => p.id === selectedPackageId) || PT_PACKAGES[1];

      if (!isCoachInHomeBranch && !allowCrossBranchBooking) {
        toast.warning('Cross-branch authorization is required to book a trainer stationed at another branch.', 'Home Branch Policy');
        return;
      }

      setEnrollingCoach(true);
      const res = await authFetch('/api/members/pt-enrollments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: targetCoachId,
          package_id: selectedPkg.id,
          package_plan: selectedPkg.name,
          sessions_total: selectedPkg.sessions,
          goal: ptGoal,
          preferred_date: preferredPtDate,
          preferred_time_slot: preferredPtTimeSlot,
          payment_channel: selectedPaymentChannel,
          payment_method_detail: selectedPaymentChannel === 'online_xendit' ? 'xendit_hosted' : 'cash',
          is_cross_branch: !isCoachInHomeBranch
        })
      });
      const data = await res.json();
      if (data.success && data.enrollment) {
        setPendingPtEnrollment(data.enrollment);
        setShowPtPaymentModal(false);

        if (selectedPaymentChannel === 'online_xendit') {
          if (data.invoice_url) {
            // Persist pending PT checkout before redirecting to Xendit Hosted Checkout
            localStorage.setItem('ksyn_pending_pt_checkout', JSON.stringify({
              externalId: data.external_id || data.enrollment.payment_reference,
              invoiceId: data.invoice_id || data.enrollment.invoice_id,
              enrollmentId: data.enrollment.id,
              coachName: data.enrollment.coach_name || targetCoach?.name,
              packageName: data.enrollment.package_name,
              amount: data.enrollment.total_price,
              userId: safeUser?.id
            }));
            toast.info('Redirecting to official Xendit Hosted Checkout...', 'Xendit Gateway');
            // Navigate directly in the SAME TAB so member pays via official Xendit hosted checkout
            window.location.href = data.invoice_url;
            return;
          } else {
            toast.success(`Online payment confirmed (${data.enrollment.payment_reference})! Queued for Front Desk verification.`, 'Payment Processed');
          }
        } else {
          toast.success(`Enrollment created! Please present Ref: ${data.enrollment.payment_reference} to Front Desk to complete payment of ₱${Number(data.enrollment.total_price).toLocaleString()}.`, 'Over-the-Counter Order Queued');
        }
      } else {
        toast.error(data.message || 'Failed to initiate PT enrollment.', 'Enrollment Error');
      }
    } catch (err) {
      console.error('[MemberPortal] Coach enrollment error:', err);
      toast.error('Network error during coach enrollment.', 'Error');
    } finally {
      setEnrollingCoach(false);
    }
  }

  useEffect(() => {
    // 1. Immediately render cached pass if present for 0ms cold-start display
    try {
      const cachedStr = localStorage.getItem('ksyn_offline_turnstile_pass');
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached?.dataUrl && cached?.token) {
          setPassData({ token: cached.token, ttl: 60 });
          setQrDataUrl(cached.dataUrl);
        }
      }
    } catch (e) {}

    // 2. Fetch fresh pass and profile data in parallel
    generatePass();
    loadMemberData();
  }, []);

  // 60-Second Countdown & Auto-Rotation (Syncs only when active pass exists)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (passData?.token && !passError) {
          if (prev <= 1) {
            generatePass();
            return 60;
          }
          return prev - 1;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [passData?.token, passError]);

  // 1-Click Renew Subscription Simulation across Standardized Channels (Smart Early Renewal)
  async function handleQuickRenew(planId = selectedRenewalPlan || '1_day', paymentChannel = 'gcash') {
    try {
      setRenewing(true);
      const planInfo = getPlanDetails(planId);
      if (typeof authFetch === 'function') {
        const res = await authFetch(`/api/members/${safeUser.id}/renew`, {
          method: 'POST',
          body: JSON.stringify({
            plan: planId,
            tier: planInfo.tier,
            payment_channel: paymentChannel,
            payment_method: paymentChannel
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.subscription) {
            setSubscription(data.subscription);
          }
        }
      }

      // Smart Early Renewal & Expiration Extension: Math.max(now, current_expiration_date) + selectedPlanDays
      const now = Date.now();
      const currentExpiryMs = (subscription?.end_date && new Date(subscription.end_date).getTime() > now)
        ? new Date(subscription.end_date).getTime()
        : now;
      const newEndMs = currentExpiryMs + (planInfo.durationDays * 24 * 3600 * 1000);
      const newEndDate = new Date(newEndMs).toISOString().split('T')[0];

      setSubscription(prev => ({
        ...prev,
        tier: planInfo.tier,
        plan: planInfo.id,
        price: planInfo.planFee,
        status: 'active',
        end_date: newEndDate
      }));

      setUser(prev => ({
        ...prev,
        membership_tier: planInfo.tier,
        membership_plan: planInfo.id,
        status: 'active'
      }));

      if (refreshUser) {
        refreshUser();
      }

      // Broadcast upgraded plan to Branch Admin and Front Desk in real time
      broadcastMemberUpgrade({
        memberId: safeUser.id,
        memberName: safeUser.name,
        planId: planInfo.id,
        planName: planInfo.name,
        tier: planInfo.tier,
        branchId: safeUser.branch_id
      });

      const channelLabels = {
        cash: 'Cash at Counter',
        gcash: 'GCash (Merchant QR)',
        maya: 'Maya (Merchant QR)',
        card: 'Card Terminal (Visa/MC/JCB)',
        auto_debit: 'Recurring Auto-Debit'
      };
      toast.success(`Membership upgraded & renewed via ${channelLabels[paymentChannel] || paymentChannel.toUpperCase()} for ${planInfo.name}! Reflected on Branch Admin & Front Desk.`, 'Plan Upgraded');
      generatePass();
    } catch (err) {
      console.warn('Handled renew simulation error:', err);
      toast.error('Failed to extend subscription.', 'Renewal Error');
    } finally {
      setRenewing(false);
    }
  }

  // Interactive Class Booking Handlers
  const handleBookSlot = async (cls) => {
    if (!cls) return;
    if (isClassConcluded(cls)) {
      toast.warning('This class session has already ended and cannot be booked.', 'Class Concluded');
      return;
    }
    if (bookedClassIds?.includes(cls.id)) return;
    if (cls.availableSlots <= 0) {
      toast.warning('This class is currently at maximum capacity.', 'Class Full');
      return;
    }

    try {
      if (typeof authFetch === 'function') {
        await authFetch(`/api/classes/${cls.id}/book`, { method: 'POST' });
      }
    } catch (err) {
      console.warn('API book slot error (fallback to local state):', err);
    }

    broadcastClassBooking({
      type: 'CLASS_BOOKING_CONFIRMED',
      classId: cls.id,
      className: cls.name,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    });

    // Decrement capacity
    setClassList(prev => (prev || []).map(item => {
      if (item.id === cls.id) {
        return { ...item, availableSlots: Math.max(0, item.availableSlots - 1) };
      }
      return item;
    }));

    // Add to booked list
    setBookedClassIds(prev => [...(prev || []), cls.id]);

    // Toast feedback
    const classDate = cls.displayDate || 'Wed, Oct 21, 2026';
    setBookingToast(`Confirmed! You are booked for ${cls.name} on ${classDate} (${cls.time}) with ${cls.instructor}.`);
    toast.success(`Spot reserved for ${cls.name} on ${classDate} (${cls.time})!`, 'Class Booked');
    setTimeout(() => setBookingToast(null), 5000);
  };

  const handleCancelBooking = async (cls) => {
    if (!cls) return;
    try {
      if (typeof authFetch === 'function') {
        await authFetch(`/api/classes/${cls.id}/cancel`, { method: 'POST' });
      }
    } catch (err) {
      console.warn('API cancel booking error (fallback to local state):', err);
    }

    broadcastClassBooking({
      type: 'CLASS_BOOKING_CANCELLED',
      classId: cls.id,
      className: cls.name,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    });

    // Restore capacity
    setClassList(prev => (prev || []).map(item => {
      if (item.id === cls.id) {
        return { ...item, availableSlots: Math.min(item.totalSlots, item.availableSlots + 1) };
      }
      return item;
    }));

    // Remove from booked list (including common aliases)
    setBookedClassIds(prev => (prev || []).filter(id => {
      if (id === cls.id) return false;
      if (cls.id === 'cls-yoga-01' && id === 'cls-1') return false;
      if (cls.id === 'cls-1' && id === 'cls-yoga-01') return false;
      return true;
    }));

    const classDate = cls.displayDate || 'Wed, Oct 21, 2026';
    setBookingToast(`Booking for ${cls.name} on ${classDate} has been cancelled.`);
    toast.info(`Booking for ${cls.name} on ${classDate} has been cancelled.`, 'Class Cancelled');
    setTimeout(() => setBookingToast(null), 4000);
  };

  // Filter classes safely (Strictly exclude concluded/past classes from active booking schedule)
  const safeClassList = Array.isArray(classList) ? classList : INITIAL_CLASSES;
  const filteredClasses = safeClassList.filter(cls => {
    if (!cls) return false;
    if (isClassConcluded(cls)) return false;
    const matchBranch = branchFilter === 'All' || (cls.branch && cls.branch.includes(branchFilter));
    const canon = getCanonicalDiscipline(cls);
    const matchType = typeFilter === 'All' ||
      canon.discipline.toLowerCase() === typeFilter.toLowerCase() ||
      canon.category.toLowerCase().includes(typeFilter.toLowerCase()) ||
      (cls.type && cls.type.toLowerCase().includes(typeFilter.toLowerCase())) ||
      (cls.category && cls.category.toLowerCase().includes(typeFilter.toLowerCase()));
    return matchBranch && matchType;
  });

  const safeBookedIds = Array.isArray(bookedClassIds) ? bookedClassIds : [];
  const bookedClassesData = safeClassList.filter(cls => cls && safeBookedIds.includes(cls.id));
  const activeBookedClasses = bookedClassesData.filter(cls => !isClassConcluded(cls));

  // Attendance & Check-In History Calculations
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const totalLifetimeCheckIns = safeAttendance.length;

  const currentMonthVisits = safeAttendance.filter(item => {
    if (!item.check_in_time) return false;
    const d = new Date(item.check_in_time);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyVisitsCount = currentMonthVisits.length;

  const crossBranchMonthCount = currentMonthVisits.filter(item => item.is_cross_branch).length;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Group turnstile attendance logs by local date string YYYY-MM-DD
  const attendanceByDate = useMemo(() => {
    const map = {};
    safeAttendance.forEach(item => {
      const raw = item.check_in_time || item.check_in_date || item.created_at;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [safeAttendance]);

  // Group biometric weigh-in logs by local date string YYYY-MM-DD
  const weighInsByDate = useMemo(() => {
    const map = {};
    (Array.isArray(progressData) ? progressData : []).forEach(item => {
      const raw = item.logged_at || item.created_at || item.date;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [progressData]);

  // Retrieve assigned workouts or scheduled split for a given date YYYY-MM-DD
  const getWorkoutsForDate = (dateKey) => {
    if (!dateKey || !Array.isArray(workoutPlans) || workoutPlans.length === 0) return [];
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3) return [];
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeekName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    return workoutPlans.filter(plan => {
      if (plan.target_date && plan.target_date.startsWith(dateKey)) return true;
      if (plan.date && plan.date.startsWith(dateKey)) return true;

      if (Array.isArray(plan.days)) {
        return plan.days.some(dayObj => (dayObj.day || '').toLowerCase().includes(dayOfWeekName));
      }
      if (Array.isArray(plan.schedule_days)) {
        return plan.schedule_days.some(sd => sd.toLowerCase().includes(dayOfWeekName));
      }
      if (plan.title && plan.title.toLowerCase().includes(dayOfWeekName)) return true;

      const isWeekdayWorkout = [1, 3, 5].includes(d.getDay());
      return isWeekdayWorkout && Array.isArray(plan.exercises) && plan.exercises.length > 0;
    });
  };

  // Compute all day cells for the current calendar month view
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const days = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const key = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNum,
        month: prevMonth,
        year: prevYear,
        key,
        isCurrentMonth: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const key = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        month: calendarMonth,
        year: calendarYear,
        key,
        isCurrentMonth: true
      });
    }

    // Trailing days to fill the last row
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const key = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        month: nextMonth,
        year: nextYear,
        key,
        isCurrentMonth: false
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  // Scans for whichever date the user has clicked
  const selectedDateLogs = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return attendanceByDate[selectedCalendarDate] || [];
  }, [selectedCalendarDate, attendanceByDate]);

  // Formatter for selected date header
  const formatCalendarDisplayDate = (dateKey) => {
    if (!dateKey) return '';
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3) return dateKey;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handlePrevCalendarMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextCalendarMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleJumpToTodayCalendar = () => {
    const today = new Date();
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedCalendarDate(todayKey);
  };

  const currentMonthCheckedDays = useMemo(() => {
    let count = 0;
    Object.keys(attendanceByDate).forEach(key => {
      const parts = key.split('-').map(Number);
      if (parts[0] === calendarYear && parts[1] === calendarMonth + 1) {
        count++;
      }
    });
    return count;
  }, [attendanceByDate, calendarYear, calendarMonth]);

  const enrolledDateRaw = baselineMetrics?.member_since || subscription?.start_date || safeUser.created_at || user?.created_at || new Date().toISOString();
  const enrolledDateFormatted = new Date(enrolledDateRaw).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const attendanceColumns = [
    {
      key: 'check_in_time',
      header: 'Date & Time',
      title: 'Date & Time',
      name: 'Date & Time',
      accessor: (row) => (
        <span className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {row?.check_in_time ? new Date(row.check_in_time).toLocaleString() : 'Recent Visit'}
        </span>
      )
    },
    {
      key: 'branch_name',
      header: 'Branch Visited',
      title: 'Branch Visited',
      name: 'Branch Visited',
      accessor: (row) => (
        <span style={{ fontWeight: 600 }}>
          {row?.branch_name || 'KSYN Fitness Makati'} <span className="mono" style={{ fontSize: '0.75rem', color: '#e1c256' }}>({row?.branch_code || 'MKT-01'})</span>
        </span>
      )
    },
    {
      key: 'verification_method',
      header: 'Method',
      title: 'Method',
      name: 'Method',
      accessor: (row) => {
        const isRfid = (row?.verification_method || '').includes('rfid');
        return (
          <span className="mono" style={{
            fontSize: '0.75rem',
            background: isRfid ? 'rgba(225, 194, 86, 0.15)' : 'rgba(247, 255, 196, 0.15)',
            color: isRfid ? '#e1c256' : '#f7ffc4',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 700
          }}>
            {isRfid ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CreditCard size={12} /> RFID Turnstile
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <QrCode size={12} /> QR Turnstile
              </span>
            )}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      title: 'Status',
      name: 'Status',
      accessor: (row) => (
        <span className={`badge badge-${row?.status || 'granted'}`}>
          {row?.status || 'granted'}
        </span>
      )
    },
    {
      key: 'notes',
      header: 'Turnstile Notes',
      title: 'Turnstile Notes',
      name: 'Turnstile Notes',
      accessor: (row) => (
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {row?.notes || 'Turnstile Verified (Lane A1)'}
        </span>
      )
    }
  ];

  // Rich Scan Log Columns for Attendance Section
  const detailedAttendanceColumns = [
    {
      key: 'check_in_time',
      header: 'Date & Time',
      title: 'Date & Time',
      name: 'Date & Time',
      accessor: (row) => (
        <span className="mono" style={{ fontSize: '0.8125rem', color: '#f3f4f6', fontWeight: 600 }}>
          {row?.check_in_time ? new Date(row.check_in_time).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Recent Visit'}
        </span>
      )
    },
    {
      key: 'branch_name',
      header: 'Branch & Entry Point',
      title: 'Branch & Entry Point',
      name: 'Branch & Entry Point',
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={14} color="#e1c256" />
            <span>{row?.branch_name || 'KSYN Fitness Makati'}</span>
          </div>
          <span className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
            Entry: Turnstile Lane A1 • Code: {row?.branch_code || 'MKT-01'}
          </span>
        </div>
      )
    },
    {
      key: 'verification_method',
      header: 'Access Method',
      title: 'Access Method',
      name: 'Access Method',
      accessor: (row) => {
        const isRfid = (row?.verification_method || '').includes('rfid');
        return (
          <span className="mono" style={{
            fontSize: '0.75rem',
            background: isRfid ? 'rgba(225, 194, 86, 0.15)' : 'rgba(247, 255, 196, 0.15)',
            color: isRfid ? '#e1c256' : '#f7ffc4',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 700
          }}>
            {isRfid ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CreditCard size={12} /> RFID Turnstile
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <QrCode size={12} /> QR Turnstile
              </span>
            )}
          </span>
        );
      }
    },
    {
      key: 'is_cross_branch',
      header: 'Type Badge',
      title: 'Type Badge',
      name: 'Type Badge',
      accessor: (row) => row?.is_cross_branch ? (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(225, 194, 86, 0.15)',
          color: '#e1c256',
          border: '1px solid rgba(225, 194, 86, 0.35)',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 800
        }}>
          <Globe size={12} /> Cross-Branch Guest
        </span>
      ) : (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(101, 130, 86, 0.15)',
          color: '#7fa36d',
          border: '1px solid rgba(101, 130, 86, 0.35)',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 800
        }}>
          <Check size={12} /> Home Branch
        </span>
      )
    },
    {
      key: 'status',
      header: 'Turnstile Status',
      title: 'Turnstile Status',
      name: 'Turnstile Status',
      accessor: (row) => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(101, 130, 86, 0.15)',
          color: '#658256',
          border: '1px solid rgba(101, 130, 86, 0.3)',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 800
        }}>
          <CheckCircle2 size={13} /> Access Granted
        </span>
      )
    },
    {
      key: 'notes',
      header: 'Access Protocol / Notes',
      title: 'Access Protocol / Notes',
      name: 'Access Protocol / Notes',
      accessor: (row) => (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          <span>{row?.notes || 'Dual-Credential Turnstile Verified'}</span>
        </div>
      )
    }
  ];

  // Timeline Columns for Fitness & Weight Progress
  const progressColumns = [
    {
      key: 'logged_at',
      header: 'Date & Time',
      title: 'Date & Time',
      name: 'Date & Time',
      accessor: (row) => (
        <span className="mono" style={{ fontSize: '0.8125rem', color: '#f3f4f6', fontWeight: 600 }}>
          {row?.logged_at ? new Date(row.logged_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Initial Weigh-In'}
        </span>
      )
    },
    {
      key: 'weight_kg',
      header: 'Weight',
      title: 'Weight',
      name: 'Weight',
      accessor: (row) => (
        <span style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#e1c256' }}>
          {parseFloat(row?.weight_kg || 0).toFixed(1)} <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>kg</span>
        </span>
      )
    },
    {
      key: 'delta',
      header: 'Change Since Last',
      title: 'Change Since Last',
      name: 'Change Since Last',
      accessor: (row) => {
        const delta = parseFloat(row?.delta || 0);
        if (delta < 0) {
          return (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#7fa36d',
              fontWeight: 800,
              fontSize: '0.8125rem'
            }}>
              <ArrowDownRight size={15} /> {delta.toFixed(1)} kg
            </span>
          );
        }
        if (delta > 0) {
          return (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#f7ffc4',
              fontWeight: 800,
              fontSize: '0.8125rem'
            }}>
              <ArrowUpRight size={15} /> +{delta.toFixed(1)} kg
            </span>
          );
        }
        return (
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontStyle: 'italic' }}>
            Baseline Origin
          </span>
        );
      }
    },
    {
      key: 'notes',
      header: 'Workout & Milestone Notes',
      title: 'Workout & Milestone Notes',
      name: 'Workout & Milestone Notes',
      accessor: (row) => (
        <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>
          {row?.notes || 'Routine weigh-in'}
        </span>
      )
    }
  ];

  // Elegant dark loading skeleton (Placed AFTER all hooks to strictly adhere to React Rules of Hooks)
  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#e1c256' }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '3px solid rgba(225, 194, 86, 0.2)',
          borderTopColor: '#e1c256',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px auto'
        }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
          INITIALIZING KSYN MEMBER PORTAL
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '6px' }}>
          Generating rotating turnstile token and syncing club schedule...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. HEADER WITH TAB SWITCHER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Welcome back, {formatUserDisplayName(safeUser)}</h1>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
            Manage your digital turnstile pass, book group classes, and view your workout activity history.
          </p>
        </div>

        {/* Right Header Status / Refresh */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={loadMemberData} disabled={loading} className="ksyn-btn ksyn-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#e1c256]' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* 1.0 MULTI-TENANT NOTIFICATION ALERT BANNER */}
      {notifications.filter(n => !n.read).length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={18} color="#60a5fa" className="shrink-0" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#ffffff' }}>
                {notifications.filter(n => !n.read)[0].title}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>
                {notifications.filter(n => !n.read)[0].message}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDismissNotification(notifications.filter(n => !n.read)[0].id)}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            Mark as Read
          </button>
        </div>
      )}

      {/* 1.1 PAYMENT REQUIRED ACTION GATE BANNER (IF PENDING) */}
      {isPaymentPending && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.16) 0%, rgba(220, 38, 38, 0.12) 100%)',
          border: '1px solid #e1c256',
          borderRadius: '12px',
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 0 30px rgba(225, 194, 86, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#e1c256',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900
            }}>
              <CreditCard size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#e1c256', letterSpacing: '0.02em' }}>
                  MEMBERSHIP PAYMENT REQUIRED TO UNLOCK ACCESS
                </h4>
                <span style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  UNPAID
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                Your account credentials are valid, but dynamic turnstile passes, coach messaging, and class bookings are locked until your membership plan fee is settled.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowOnboardingPaywall(true)}
            className="ksyn-btn ksyn-btn-gold"
            style={{
              padding: '12px 22px',
              fontWeight: 900,
              fontSize: '0.875rem',
              borderRadius: '8px',
              boxShadow: '0 0 20px rgba(225, 194, 86, 0.4)'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Complete Payment & Activate Pass <ArrowRight size={15} />
            </span>
          </button>
        </div>
      )}

      {/* Booking Toast Alert */}
      {bookingToast && (
        <div style={{
          background: 'rgba(101, 130, 86, 0.15)',
          border: '1px solid #658256',
          color: '#658256',
          padding: '12px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{bookingToast}</span>
          </div>
          <button
            onClick={() => setBookingToast(null)}
            style={{ background: 'none', border: 'none', color: '#658256', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Fitness Progress Toast Alert */}
      {progressToast && (
        <div style={{
          background: 'rgba(101, 130, 86, 0.15)',
          border: '1px solid #658256',
          color: '#658256',
          padding: '12px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{progressToast}</span>
          </div>
          <button
            onClick={() => setProgressToast(null)}
            style={{ background: 'none', border: 'none', color: '#658256', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Non-fatal notification banner if API is in fallback mode */}
      {fetchError && (
        <div style={{
          background: 'rgba(225, 194, 86, 0.08)',
          border: '1px solid rgba(225, 194, 86, 0.25)',
          color: '#e1c256',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={14} /> Local offline profile active. Full class enrollment and turnstile pass are functional.
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: BOOK A CLASS TAB */}
      {/* ========================================================================= */}
      {activeSection === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick HUD Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            <div className="ksyn-card" style={{ padding: '20px', borderColor: 'rgba(225, 194, 86, 0.3)', background: '#121212' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e1c256', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                <Award size={14} /> Membership Perk
              </div>
              <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                Unlimited Classes
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                Included with your {subscription?.tier?.toUpperCase() || 'BLACK ELITE'} plan
              </div>
            </div>

            <div className="ksyn-card" style={{ padding: '20px', background: '#121212' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f7ffc4', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                <CalendarCheck size={14} /> Confirmed Upcoming
              </div>
              <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#f7ffc4', margin: '4px 0' }}>
                {activeBookedClasses.length} Booked
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                {activeBookedClasses.length > 0 ? 'See below for upcoming class schedule' : 'No upcoming bookings reserved yet'}
              </div>
            </div>

            <div className="ksyn-card" style={{ padding: '20px', background: '#121212' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7fa36d', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                <Building2 size={14} /> Cross-Branch Access
              </div>
              <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#7fa36d', margin: '4px 0' }}>
                7 Commercial Hubs
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                Makati Flagship, Katipunan, Alabang, Kapitolyo, Fairview, Del Monte
              </div>
            </div>
          </div>

          {/* HIGHLIGHTED: My Confirmed Class Bookings Box (Under HUD Banner) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(101, 130, 86, 0.14) 0%, #111714 45%, #0e1310 100%)',
            border: '2px solid rgba(101, 130, 86, 0.55)',
            borderRadius: '14px',
            padding: '22px 24px',
            boxShadow: '0 0 25px rgba(101, 130, 86, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(101, 130, 86, 0.2)', padding: '7px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} color="#7fa36d" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.02em' }}>
                    My Confirmed Class Bookings ({activeBookedClasses.length})
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Real-time reserved slots linked to your turnstile access pass.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.75rem',
                  background: 'rgba(101, 130, 86, 0.2)',
                  border: '1px solid rgba(101, 130, 86, 0.45)',
                  color: '#7fa36d',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontWeight: 800
                }}>
                  {activeBookedClasses.length > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Active & Confirmed
                    </span>
                  ) : (
                    'No Active Bookings'
                  )}
                </span>
              </div>
            </div>

            {activeBookedClasses.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '14px' }}>
                {activeBookedClasses.map(cls => (
                  <div key={cls.id} style={{
                    background: '#19221d',
                    border: '1px solid rgba(101, 130, 86, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    <div>
                      {/* Prominent Date & Time Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.75rem',
                          background: 'rgba(225, 194, 86, 0.15)',
                          border: '1px solid rgba(225, 194, 86, 0.35)',
                          color: '#e1c256',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontWeight: 800
                        }}>
                          <Calendar size={13} color="#e1c256" />
                          {cls.displayDate || 'Wed, Oct 21, 2026'}
                        </span>
                        <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f7ffc4' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {cls.time}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
                        {cls.name}
                      </h4>
                      <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', margin: '0 0 8px 0' }}>
                        Instructor: <strong style={{ color: '#ffffff' }}>{cls.instructor}</strong> • {cls.room}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <MapPin size={13} color="#e1c256" /> {cls.branch}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelBooking(cls)}
                      style={{
                        marginTop: '16px',
                        background: 'transparent',
                        border: '1px solid #3d4a41',
                        color: '#9ca3af',
                        padding: '7px 14px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => { e.target.style.color = '#ef4444'; e.target.style.borderColor = '#ef4444'; }}
                      onMouseLeave={(e) => { e.target.style.color = '#9ca3af'; e.target.style.borderColor = '#3d4a41'; }}
                    >
                      Cancel Reservation
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '10px',
                border: '1px dashed rgba(101, 130, 86, 0.3)'
              }}>
                <Calendar size={32} color="#7fa36d" style={{ margin: '0 auto 10px auto', opacity: 0.8 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  No Class Bookings Reserved Yet
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                  Browse the Live Group Fitness Schedule below and click "Book Class" to reserve your date and slot!
                </div>
              </div>
            )}
          </div>

          {/* 4 Signature Discipline Feature Cards */}
          {(() => {
            const yogaClassesCount = safeClassList.filter(c => !isClassConcluded(c) && getCanonicalDiscipline(c).discipline === 'Yoga').length;
            const hiitClassesCount = safeClassList.filter(c => !isClassConcluded(c) && getCanonicalDiscipline(c).discipline === 'HIIT').length;
            const zumbaClassesCount = safeClassList.filter(c => !isClassConcluded(c) && getCanonicalDiscipline(c).discipline === 'Zumba').length;
            const boxingClassesCount = safeClassList.filter(c => !isClassConcluded(c) && getCanonicalDiscipline(c).discipline === 'Boxing').length;

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px'
              }}>
                <div
                  onClick={() => setTypeFilter(prev => prev === 'Yoga' ? 'All' : 'Yoga')}
                  style={{
                    background: typeFilter === 'Yoga' ? 'rgba(101, 130, 86, 0.22)' : '#141414',
                    border: `1.5px solid ${typeFilter === 'Yoga' ? '#658256' : '#262626'}`,
                    boxShadow: typeFilter === 'Yoga' ? '0 0 14px rgba(101, 130, 86, 0.35)' : 'none',
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#658256', fontWeight: 800, fontSize: '0.8125rem' }}>
                      <Heart size={16} /> YOGA & RECOVERY
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Vinyasa flow, core mobility, and guided relaxation.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#658256', marginTop: '6px', fontWeight: 700 }}>
                    {yogaClassesCount} Scheduled {yogaClassesCount === 1 ? 'Class' : 'Classes'}
                  </div>
                </div>

                <div
                  onClick={() => setTypeFilter(prev => prev === 'HIIT' ? 'All' : 'HIIT')}
                  style={{
                    background: typeFilter === 'HIIT' ? 'rgba(239, 68, 68, 0.22)' : '#141414',
                    border: `1.5px solid ${typeFilter === 'HIIT' ? '#ef4444' : '#262626'}`,
                    boxShadow: typeFilter === 'HIIT' ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 800, fontSize: '0.8125rem' }}>
                      <Flame size={16} /> HIIT CONDITIONING
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Kettlebell circuits, sprint intervals, and high EPOC burn.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '6px', fontWeight: 700 }}>
                    {hiitClassesCount} Scheduled {hiitClassesCount === 1 ? 'Class' : 'Classes'}
                  </div>
                </div>

                <div
                  onClick={() => setTypeFilter(prev => prev === 'Zumba' ? 'All' : 'Zumba')}
                  style={{
                    background: typeFilter === 'Zumba' ? 'rgba(225, 194, 86, 0.22)' : '#141414',
                    border: `1.5px solid ${typeFilter === 'Zumba' ? '#e1c256' : '#262626'}`,
                    boxShadow: typeFilter === 'Zumba' ? '0 0 14px rgba(225, 194, 86, 0.35)' : 'none',
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem' }}>
                      <Music size={16} /> ZUMBA & DANCE
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Rhythmic dance cardio, choreography, and full-body tone.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#e1c256', marginTop: '6px', fontWeight: 700 }}>
                    {zumbaClassesCount} Scheduled {zumbaClassesCount === 1 ? 'Class' : 'Classes'}
                  </div>
                </div>

                <div
                  onClick={() => setTypeFilter(prev => prev === 'Boxing' ? 'All' : 'Boxing')}
                  style={{
                    background: typeFilter === 'Boxing' ? 'rgba(249, 115, 22, 0.22)' : '#141414',
                    border: `1.5px solid ${typeFilter === 'Boxing' ? '#f97316' : '#262626'}`,
                    boxShadow: typeFilter === 'Boxing' ? '0 0 14px rgba(249, 115, 22, 0.35)' : 'none',
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316', fontWeight: 800, fontSize: '0.8125rem' }}>
                      <Target size={16} /> BOXING & STRIKE
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Heavy-bag combos, pad work, and rotational power.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#f97316', marginTop: '6px', fontWeight: 700 }}>
                    {boxingClassesCount} Scheduled {boxingClassesCount === 1 ? 'Class' : 'Classes'}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Schedule Filter & Grid Card */}
          <div className="ksyn-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Live Group Fitness Schedule</h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                  Reserve your workout slot. Capacity updates in real-time across all club turnstiles.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Branch:</span>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    style={{
                      background: '#0a0a0a',
                      border: '1px solid #333',
                      color: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="All">All Hubs</option>
                    <option value="Makati">KSYN Fitness Makati</option>
                    <option value="Katipunan">KSYN Fitness Katipunan</option>
                    <option value="Alabang">KSYN Fitness Alabang</option>
                    <option value="Kapitolyo">KSYN Fitness Kapitolyo</option>
                    <option value="Fairview">KSYN Fitness Fairview</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Class:</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{
                      background: '#0a0a0a',
                      border: '1px solid #333',
                      color: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="All">All Disciplines</option>
                    <option value="Yoga">Yoga & Recovery</option>
                    <option value="HIIT">HIIT Conditioning</option>
                    <option value="Zumba">Zumba & Dance</option>
                    <option value="Boxing">Boxing & Strike</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Schedule Grid Table */}
            <div
              className="ksyn-custom-scrollbar table-infinite"
              style={{ width: '100%', overflowX: 'auto', maxHeight: '460px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#e1c256 #121212' }}
            >
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: '#e5e7eb', fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#121212' }}>
                  <tr style={{ borderBottom: '1px solid #262626', color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px', position: 'sticky', top: 0, background: '#121212' }}>Date & Schedule</th>
                    <th style={{ padding: '12px 14px', position: 'sticky', top: 0, background: '#121212' }}>Class Name & Type</th>
                    <th style={{ padding: '12px 14px', position: 'sticky', top: 0, background: '#121212' }}>Instructor</th>
                    <th style={{ padding: '12px 14px', position: 'sticky', top: 0, background: '#121212' }}>Branch & Room</th>
                    <th style={{ padding: '12px 14px', position: 'sticky', top: 0, background: '#121212' }}>Available Slots</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', position: 'sticky', top: 0, background: '#121212' }}>Booking Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses && filteredClasses.length > 0 ? (
                    (filteredClasses || []).map((cls) => {
                      const isBooked = safeBookedIds.includes(cls.id);
                      const isFull = (cls.availableSlots ?? 0) <= 0;
                      const capacityPercent = Math.round(((cls.availableSlots ?? 0) / (cls.totalSlots || 20)) * 100);

                      return (
                        <tr key={cls.id} style={{
                          borderBottom: '1px solid #1f1f1f',
                          background: isBooked ? 'rgba(101, 130, 86, 0.05)' : 'transparent',
                          transition: 'background 0.15s'
                        }}>
                          {/* Date & Time */}
                          <td style={{ padding: '14px' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: '#f7ffc4',
                              background: 'rgba(247, 255, 196, 0.12)',
                              border: '1px solid rgba(247, 255, 196, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginBottom: '6px'
                            }}>
                              <Calendar size={12} color="#f7ffc4" />
                              {cls.displayDate || 'Wed, Oct 21, 2026'}
                            </div>
                            <div className="mono" style={{ fontWeight: 700, color: '#e1c256' }}>
                              {cls.time}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {cls.duration}
                            </div>
                          </td>

                          {/* Class Name & Type */}
                          <td style={{ padding: '14px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                              {cls.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {(() => {
                                const canon = getCanonicalDiscipline(cls);
                                return (
                                  <span style={{
                                    fontSize: '0.6875rem',
                                    background: `${canon.color}18`,
                                    border: `1px solid ${canon.color}50`,
                                    color: canon.color,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {canon.category}
                                  </span>
                                );
                              })()}
                              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                                • {cls.intensity || 'All Levels'}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: isFull ? '#ef4444' : '#658256', fontWeight: 700 }}>
                                • {isFull ? 'Waitlist' : 'Open'}
                              </span>
                            </div>
                          </td>

                          {/* Instructor */}
                          <td style={{ padding: '14px' }}>
                            <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                              {cls.instructor}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              Certified Specialist
                            </div>
                          </td>

                          {/* Branch & Room */}
                          <td style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <MapPin size={14} style={{ color: '#e1c256', flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: '0.875rem' }}>
                                {cls.branch || cls.branch_name || 'KSYN Fitness Makati'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', paddingLeft: '20px' }}>
                              {cls.room}
                            </div>
                          </td>

                          {/* Capacity Slots */}
                          <td style={{ padding: '14px', minWidth: '140px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                color: isFull ? '#ef4444' : (cls.availableSlots ?? 0) <= 4 ? '#e1c256' : '#7fa36d'
                              }}>
                                {isFull ? 'Class Full' : `${cls.availableSlots ?? 0} / ${cls.totalSlots || 20} left`}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                                {capacityPercent}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: '#262626', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${capacityPercent}%`,
                                height: '100%',
                                background: isFull ? '#ef4444' : (cls.availableSlots ?? 0) <= 4 ? '#e1c256' : '#7fa36d',
                                transition: 'width 0.3s'
                              }} />
                            </div>
                          </td>

                          {/* Booking Action */}
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            {isBooked ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(101, 130, 86, 0.15)',
                                  color: '#7fa36d',
                                  border: '1px solid rgba(101, 130, 86, 0.3)',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800
                                }}>
                                  <Check size={13} /> RESERVED
                                </span>
                              </div>
                            ) : isFull ? (
                              <button
                                disabled
                                className="ksyn-btn"
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: '#1a1d26',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  cursor: 'not-allowed'
                                }}
                              >
                                Class Full
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleBookSlot(cls)}
                                className="ksyn-btn ksyn-btn-gold"
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Book Class →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: '#6b7280' }}>
                        No classes found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DYNAMIC QR PASS (DEFAULT) */}
      {/* ========================================================================= */}
      {activeSection === 'pass' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '28px' }}>
            {/* ROTATING 60-SECOND QR CODE CARD (OR LOCKED IF UNPAID) */}
            {isPaymentPending ? (
              <div className="ksyn-card" style={{ textAlign: 'center', padding: '36px 24px', borderColor: 'rgba(225, 194, 86, 0.4)', background: '#12151e' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#e1c256', fontSize: '0.8125rem', fontWeight: 800, marginBottom: '16px' }}>
                  <ShieldCheck size={16} /> TURNSTILE PASS LOCKED • PAYMENT REQUIRED
                </div>

                <div style={{
                  width: '200px',
                  height: '200px',
                  margin: '0 auto 20px auto',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '2px dashed rgba(225, 194, 86, 0.35)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: '#e1c256'
                }}>
                  <CreditCard size={48} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>
                    UNPAID MEMBERSHIP
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginBottom: '6px' }}>
                  Settle Membership Plan to Unlock Pass
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '20px', lineHeight: 1.4 }}>
                  Turnstile barrier entry requires an active paid subscription. Settle your plan via Card (3DS OTP), GCash/Maya Auto-Debit, or Dynamic QR Ph to generate your live entry QR pass.
                </p>

                <button
                  type="button"
                  onClick={() => setShowOnboardingPaywall(true)}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ width: '100%', padding: '14px', fontWeight: 900, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  Pay Now & Activate Turnstile Pass
                </button>
              </div>
            ) : (
              <div className="ksyn-card ksyn-card-gold" style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#e1c256', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '16px' }}>
                  <ShieldCheck size={16} /> 60-SECOND ROTATING MEMBER PASS
                </div>

                {/* Real Scannable Dynamic Cryptographic QR Pass */}
                <div style={{
                  position: 'relative',
                  width: '240px',
                  height: '240px',
                  margin: '0 auto 16px auto',
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 0 35px rgba(225, 194, 86, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {passError ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '10px',
                      color: '#1f2937',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={32} color="#cbaa42" />
                      <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#111827' }}>
                        {passError.code === 'MEMBERSHIP_PAYMENT_REQUIRED' ? 'Turnstile Pass Locked' : 'Turnstile Pass Notice'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#4b5563', lineHeight: 1.3 }}>
                        {passError.message}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleSectionSwitch('plan')}
                          style={{
                            background: '#e1c256',
                            border: 'none',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '0.6875rem',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Renew
                        </button>
                        <button
                          type="button"
                          onClick={() => generatePass(true)}
                          style={{
                            background: '#e5e7eb',
                            border: '1px solid #d1d5db',
                            color: '#374151',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : qrDataUrl ? (
                    <div style={{ position: 'relative', width: '208px', height: '208px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={qrDataUrl}
                        alt="Cryptographic Turnstile Pass"
                        style={{
                          width: '200px',
                          height: '200px',
                          borderRadius: '8px',
                          objectFit: 'contain'
                        }}
                      />
                      {passLoading && (
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(0,0,0,0.75)',
                          borderRadius: '20px',
                          padding: '2px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.625rem',
                          color: '#e1c256',
                          fontWeight: 700
                        }}>
                          <div style={{ width: '8px', height: '8px', border: '2px solid #e1c256', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          Syncing
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '200px',
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      gap: '8px'
                    }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid #e1c256', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Generating Local Cryptographic Pass...
                    </div>
                  )}
                </div>

                {/* Countdown Timer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <Clock size={16} color={secondsRemaining <= 10 ? '#ef4444' : '#e1c256'} />
                  <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Rotating in:</span>
                  <span className="mono" style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: secondsRemaining <= 10 ? '#ef4444' : '#e1c256'
                  }}>
                    {passError ? 'Paused' : `${secondsRemaining}s`}
                  </span>
                </div>

                <div style={{
                  height: '4px',
                  background: '#222',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    height: '100%',
                    width: passError ? '0%' : `${(secondsRemaining / 60) * 100}%`,
                    background: secondsRemaining <= 10 ? '#ef4444' : '#e1c256',
                    transition: 'width 1s linear'
                  }} />
                </div>

                <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '14px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Shield size={13} className="text-[#e1c256]" /> Scan this screen directly at any club turnstile.
                  </span><br />
                  Self-refreshes locally every 60 seconds with offline token cache.
                </div>

                <Tooltip content="Instantly generate a fresh 60-second QR cryptographic token" position="top">
                  <button
                    type="button"
                    onClick={() => generatePass(true)}
                    disabled={passLoading}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ padding: '8px 14px', minHeight: '44px', fontSize: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} className={passLoading ? 'animate-spin' : ''} /> Regenerate Pass Now
                  </button>
                </Tooltip>

                {/* Developer / Engineering Diagnostics (Tucked away from primary member view) */}
                <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowDevDiagnostics(prev => !prev)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px'
                    }}
                    title="Toggle Engineering & Turnstile Diagnostics"
                  >
                    <span>{showDevDiagnostics ? 'Hide Turnstile Diagnostics' : 'Turnstile Diagnostics (Developer Mode)'}</span>
                    {showDevDiagnostics ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showDevDiagnostics && (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      background: '#0a0d14',
                      border: '1px solid #1e2535',
                      borderRadius: '8px',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginBottom: '8px', lineHeight: 1.3 }}>
                        <strong style={{ color: '#e1c256', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> Staff & Developer Diagnostics:
                        </strong> Simulate front-desk optical scanners or test relay pulses. (Gym members should present the dynamic QR code directly to the gate scanner.)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <Tooltip content="Copy full cryptographic token to clipboard" position="top">
                          <button
                            type="button"
                            onClick={() => {
                              if (passData?.token) {
                                navigator.clipboard.writeText(passData.token);
                                toast.success('Cryptographic pass token copied to clipboard! Paste into Front-Desk Scanner.', 'Pass Token Copied');
                              } else {
                                toast.warning('No pass token active to copy.', 'Pass Required');
                              }
                            }}
                            className="ksyn-btn ksyn-btn-outline"
                            style={{ fontSize: '0.6875rem', padding: '8px 8px', minHeight: '44px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            <Copy size={13} /> Copy Pass Token
                          </button>
                        </Tooltip>

                        <Tooltip content="Simulate immediate optical gate relay pulse" position="top">
                          <button
                            type="button"
                            disabled={testScanning || !passData?.token}
                            onClick={handleTestScanFrontDesk}
                            className="ksyn-btn ksyn-btn-gold"
                            style={{ fontSize: '0.6875rem', padding: '8px 8px', minHeight: '44px', width: '100%', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            Test Turnstile Pulse
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RIGHT: MEMBERSHIP CARD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1c1c1c 0%, #121212 100%)',
                border: '1px solid #333333',
                borderRadius: '16px',
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }}>
                <div style={{
                  position: 'absolute',
                  right: '-20px',
                  bottom: '-30px',
                  fontSize: '8rem',
                  fontWeight: 900,
                  color: 'rgba(225, 194, 86, 0.05)',
                  pointerEvents: 'none'
                }}>
                  KSYN
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                      src="/ksyn-logo.png"
                      alt="KSYN Gym Logo"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        boxShadow: '0 0 12px rgba(225, 194, 86, 0.3)'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
                        MEMBERSHIP CARD
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
                        KSYN FITCONNECT
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: hasActivePlan ? '#e1c256' : '#262626',
                    color: hasActivePlan ? '#000000' : '#9ca3af',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Star size={12} className={hasActivePlan ? "fill-black text-black" : "text-gray-400"} /> {hasActivePlan ? (subscription?.tier?.toUpperCase() || 'STANDARD') : 'NO PLAN'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>MEMBER NAME</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f9fafb' }}>{safeUser.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>HOME BRANCH</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f9fafb' }}>{safeUser.branch_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ACTIVE PLAN</div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: hasActivePlan ? '#e1c256' : '#9ca3af' }}>
                      {hasActivePlan && subscription?.plan ? getPlanDetails(subscription.plan).name : 'None'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>GATE PASS TODAY</div>
                    <span className={hasActivePlan && !passError ? "badge badge-active" : "badge badge-danger"} style={{ marginTop: '2px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {hasActivePlan && !passError ? (
                        <>
                          <CheckCircle2 size={12} /> GRANTED (ELIGIBLE TODAY)
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> BLOCKED
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>VALID UNTIL</div>
                    <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 600, color: hasActivePlan ? '#e1c256' : '#ef4444' }}>
                      {hasActivePlan
                        ? (subscription?.end_date || '—')
                        : (subscription?.end_date ? `${subscription.end_date} (Expired)` : 'N/A')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ACCOUNT STATUS</div>
                    <span className={`badge ${hasActivePlan ? 'badge-active' : (isPaymentPending ? 'badge-gold' : 'badge-danger')}`} style={{ marginTop: '2px' }}>
                      {hasActivePlan ? (safeUser.membership_status?.toUpperCase() || 'ACTIVE') : (isPaymentPending ? 'PAYMENT REQUIRED' : 'EXPIRED')}
                    </span>
                  </div>
                </div>

                {/* Physical RFID Keycard Link Badge */}
                <div style={{
                  margin: '16px 0',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: (!hasActivePlan || isOneDayPass)
                    ? 'rgba(148, 163, 184, 0.08)'
                    : isPaymentPending
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'rgba(247, 255, 196, 0.1)',
                  border: (!hasActivePlan || isOneDayPass)
                    ? '1px solid rgba(148, 163, 184, 0.2)'
                    : isPaymentPending
                      ? '1px solid rgba(239, 68, 68, 0.25)'
                      : '1px solid rgba(247, 255, 196, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={15} color={(!hasActivePlan || isOneDayPass) ? '#94a3b8' : (isPaymentPending ? '#ef4444' : '#f7ffc4')} />
                    <span style={{ fontSize: '0.8125rem', color: '#e5e7eb', fontWeight: 600 }}>
                      Physical RFID Keycard:{' '}
                      {!hasActivePlan || isOneDayPass ? (
                        <strong style={{ color: '#94a3b8' }}>N/A</strong>
                      ) : isPaymentPending ? (
                        <strong style={{ color: '#ef4444' }}>N/A</strong>
                      ) : safeUser.rfid_card_uid ? (
                        <strong style={{ color: '#658256' }}>ACTIVE</strong>
                      ) : (
                        <strong style={{ color: '#e1c256' }}>AWAITING FRONT DESK ISSUANCE</strong>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="mono" style={{ fontSize: '0.8125rem', color: (!hasActivePlan || isOneDayPass || isPaymentPending) ? '#94a3b8' : '#f7ffc4', fontWeight: 700 }}>
                      {!hasActivePlan || isOneDayPass || isPaymentPending
                        ? 'UID: N/A'
                        : safeUser.rfid_card_uid
                          ? `UID: ${showRfidUid ? safeUser.rfid_card_uid : String(safeUser.rfid_card_uid).replace(/^(KS-)(.*)(-.{4})$/, '$1••••$3')}`
                          : 'UID: Pending Issuance'}
                    </span>

                    {user?.rfid_card_uid && hasActivePlan && !isOneDayPass && !isPaymentPending && (
                      <button
                        type="button"
                        onClick={() => setShowRfidUid(!showRfidUid)}
                        title={showRfidUid ? "Hide RFID UID" : "Reveal RFID UID"}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = '#e1c256'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; }}
                      >
                        {showRfidUid ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid #262626',
                  fontSize: '0.75rem',
                  color: '#9ca3af'
                }}>
                  <span>Network Access: <strong>All KSYN Branches</strong></span>
                  <span className="mono">ID: {safeUser.id ? safeUser.id.slice(0, 8) : 'MBR'}...</span>
                </div>
              </div>

              {/* Consolidated Group Fitness Classes Card */}
              <div className="ksyn-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 14px rgba(225, 194, 86, 0.25)',
                    flexShrink: 0
                  }}>
                    <Flame size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                      Group Fitness Classes
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      {activeBookedClasses.length > 0 ? (
                        <>You have <strong style={{ color: '#e1c256' }}>{activeBookedClasses.length} confirmed upcoming {activeBookedClasses.length === 1 ? 'class booking' : 'class bookings'}</strong> scheduled.</>
                      ) : (
                        <>Signature Yoga, HIIT, Zumba & Boxing available across Makati Flagship, Katipunan & Alabang.</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleSectionSwitch('classes')}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '9px 18px', fontSize: '0.8125rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                >
                  {activeBookedClasses.length > 0 ? 'Manage Classes →' : 'Explore & Book a Class →'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: MEMBERSHIP & RENEWAL TAB */}
      {/* ========================================================================= */}
      {activeSection === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Branch-Aware Promo Discount Banner */}
          {(() => {
            const bName = (safeUser?.branch_name || '').toLowerCase();
            let bannerPromo = {
              code: 'MKT25',
              title: 'Makati Re-Opening Special: 25% Off All Annual Pass Upgrades',
              detail: 'Valid exclusively for KSYN Fitness Makati members until October 31, 2026.'
            };
            if (bName.includes('katipunan')) {
              bannerPromo = {
                code: 'KATIPUNAN833',
                title: 'Katipunan Pre-Selling Promo: ₱833/mo 1-Year Annual Pass (₱9,996 total)',
                detail: 'Valid exclusively for KSYN Katipunan athletes with 1 free PT session + 4 multi-branch visits/mo.'
              };
            } else if (bName.includes('fairview')) {
              bannerPromo = {
                code: 'STUDENT',
                title: 'West Fairview Student & Flex Rate: ₱1,700/mo Flex or ₱1,920/mo Student Promo',
                detail: '50% off joining fees with complimentary baseline movement assessment.'
              };
            } else if (bName.includes('alabang')) {
              bannerPromo = {
                code: 'DUO60',
                title: 'Alabang Duo / Pair Promo: ₱1,200 Off per person + Waived Joining Fees',
                detail: 'Valid for couples and workout buddies training together at KSYN Alabang.'
              };
            }

            return (
              <div style={{
                background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.12) 0%, rgba(20, 20, 20, 0.95) 100%)',
                border: '1px solid rgba(225, 194, 86, 0.45)',
                borderRadius: '10px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                gap: '12px',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 900, background: '#e1c256', color: '#000', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.05em' }}>
                    BRANCH SPECIAL
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', flexShrink: 0 }}>
                      {bannerPromo.title}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>•</span>
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Use promo code <strong style={{ color: '#e1c256', fontFamily: 'monospace' }}>{bannerPromo.code}</strong> at checkout ({bannerPromo.detail})
                    </span>
                  </div>
                </div>
                <div style={{
                  background: '#1c1c1c',
                  border: '1px solid #333',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '0.625rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>PROMO VOUCHER:</span>
                  <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 900, color: '#e1c256' }}>{bannerPromo.code}</span>
                </div>
              </div>
            );
          })()}

          {/* Expiration Countdown & Pass Validity & Today's Clearance Banner */}
          {(() => {
            const isOneDay = (subscription?.plan === '1_day') || (user?.membership_plan === '1_day');
            const now = new Date();
            const rawEndDate = subscription?.end_date;
            const parsedEndDate = rawEndDate ? new Date(rawEndDate) : null;
            const validEndDate = (parsedEndDate && !isNaN(parsedEndDate.getTime())) ? parsedEndDate : new Date('2026-12-31');
            const calcDays = Math.ceil((validEndDate - now) / (1000 * 60 * 60 * 24));
            const bannerDaysLeft = isOneDay ? 1 : (isNaN(calcDays) ? 0 : Math.max(0, calcDays));
            const isUrgent = isOneDay || bannerDaysLeft <= 7;
            const currentPlanKey = subscription?.plan || user?.membership_plan || '12_months';
            const planInfo = getPlanDetails(currentPlanKey) || { name: 'Membership Plan' };
            const planNameFormatted = planInfo?.name || (currentPlanKey === '12_months' ? '12 Months Annual Elite' : '1 Month Pass');
            const isPaidActive = !isPaymentPending && (subscription?.status === 'active' || user?.membership_status === 'active' || !user?.status || user?.status === 'active') && bannerDaysLeft > 0;
            const todayFormatted = (() => {
              try {
                return new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(now);
              } catch (e) {
                return now.toDateString();
              }
            })();

            return (
              <div style={{
                background: isPaidActive
                  ? 'linear-gradient(135deg, rgba(101, 130, 86, 0.08) 0%, rgba(20, 24, 33, 0.95) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 20, 0.95) 100%)',
                border: `1.5px solid ${isPaidActive ? '#658256' : '#ef4444'}`,
                borderRadius: '14px',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: isPaidActive ? '0 4px 20px rgba(101, 130, 86, 0.12)' : '0 4px 20px rgba(239, 68, 68, 0.12)'
              }}>
                {/* Top Row: Turnstile Access Today Clearance */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: isPaidActive ? 'rgba(101, 130, 86, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isPaidActive ? '#658256' : '#ef4444'
                    }}>
                      {isPaidActive ? <CheckCircle size={26} /> : <AlertTriangle size={26} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isPaidActive ? '#658256' : '#ef4444',
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          {isPaidActive ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>TURNSTILE PASS ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              <span>TURNSTILE ACCESS BLOCKED</span>
                            </>
                          )}
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                          Today: <strong style={{ color: '#ffffff' }}>{todayFormatted}</strong>
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 0 0' }}>
                        {isPaidActive
                          ? 'Turnstile Gate Entry Granted (Cleared for Access Today)'
                          : 'Turnstile Gate Entry Blocked (Payment / Renewal Required)'}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="mono" style={{
                      fontSize: '0.8125rem',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: '#10141d',
                      border: `1px solid ${isPaidActive ? '#65825655' : '#ef444455'}`,
                      color: isPaidActive ? '#658256' : '#ef4444',
                      fontWeight: 800
                    }}>
                      CLEARANCE TODAY: {isPaidActive ? 'GRANTED' : 'BLOCKED'}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Plan Details & Validity Breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px',
                  background: '#0e121a',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: '1px solid #1f2737'
                }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Active Membership Plan</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#e1c256', marginTop: '2px' }}>
                      {planNameFormatted}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Status: <strong style={{ color: isPaidActive ? '#658256' : '#ef4444' }}>{isPaidActive ? 'Paid & Verified' : 'Payment Required'}</strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Pass Validity & Expiration</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isUrgent ? '#ef4444' : '#658256', marginTop: '2px' }}>
                      {isOneDay ? '24-Hour Access Active' : `${bannerDaysLeft} Days Remaining`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Valid until: {subscription?.end_date || '2026-12-31'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Gate Access Privilege</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isPaidActive ? '#658256' : '#ef4444', marginTop: '2px' }}>
                      {isPaidActive ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Optical Gates Open All Branches</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <XCircle size={13} className="text-red-400" />
                          <span>Payment Required</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {isPaidActive ? 'Makati Flagship, Katipunan, Alabang, Fairview' : 'Settle plan to activate dynamic QR pass'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Real-World Industry Standard Auto-Debit & Recurring Billing Card */}
          <SubscriptionBillingCard
            subscription={subscription}
            user={safeUser}
            paymentMethods={paymentMethods}
            onUpdateSubscription={(enabled) => {
              setAutoDebitEnabled(enabled);
              try { localStorage.setItem('ksyn_auto_debit_contract', String(enabled)); } catch (e) {}
              setUser(prev => ({ ...prev, auto_renew: enabled }));
              setSubscription(prev => prev ? ({ ...prev, auto_renew: enabled }) : null);
            }}
            onOpenSetupModal={() => setShowLinkMethodModal(true)}
          />

          {/* Itemized Renewal Invoice & Payment Gateway Rails with Real Promo Engine */}
          {(() => {
            const pricing = calculatePlanPricing(selectedRenewalPlan, activePromoCode, safeUser?.branch_name, promoVerificationData, announcements);
            const activePlanDetails = pricing.plan;
            const is1Day = selectedRenewalPlan === '1_day';
            const safePlanFee = pricing.basePlanFee;
            const effectivePlanFee = pricing.effectivePlanFee;
            const discountAmount = pricing.discountAmount;
            const totalDue = pricing.totalDue;
            const safeDurationDays = typeof activePlanDetails?.durationDays === 'number' ? activePlanDetails.durationDays : 30;
            const safeDuration = activePlanDetails?.duration || '1 Month';
            const effectiveDaysLeft = typeof daysLeft === 'number' && !isNaN(daysLeft) ? daysLeft : 0;

            const handleApplyManualPromo = () => {
              if (!promoCodeInput.trim()) {
                setActivePromoCode(null);
                setPromoFeedback({ type: 'info', msg: 'Promo cleared. Standard pricing restored.' });
                return;
              }
              const clean = promoCodeInput.trim().toUpperCase();
              setActivePromoCode(clean);
              const testPricing = calculatePlanPricing(selectedRenewalPlan, clean, safeUser?.branch_name, promoVerificationData, announcements);
              if (testPricing.promoError) {
                setPromoFeedback({ type: testPricing.verificationRequired ? 'info' : 'error', msg: testPricing.promoError });
              } else if (testPricing.promoApplied) {
                setPromoFeedback({
                  type: 'success',
                  msg: `Promo "${testPricing.promoApplied.code}" Applied! ${testPricing.promoApplied.title} (-₱${testPricing.discountAmount.toLocaleString()})`
                });
              }
            };

            const handleQuickSelectPromo = (code) => {
              setPromoCodeInput(code);
              setActivePromoCode(code);
              const testPricing = calculatePlanPricing(selectedRenewalPlan, code, safeUser?.branch_name, promoVerificationData, announcements);
              if (testPricing.promoError) {
                setPromoFeedback({ type: testPricing.verificationRequired ? 'info' : 'error', msg: testPricing.promoError });
              } else {
                setPromoFeedback({
                  type: 'success',
                  msg: `Promo "${code}" Active! Saved ₱${testPricing.discountAmount.toLocaleString()} on ${testPricing.plan.name}`
                });
              }
            };

            return (
              <div style={{ background: '#141414', border: '1px solid #333', borderRadius: '14px', padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #222', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Itemized Renewal / Upgrade Invoice #INV-2026-{safeUser?.id ? String(safeUser.id).slice(0, 6).toUpperCase() : 'MBR01'}
                    </h4>
                    {Boolean(effectiveDaysLeft > 0) && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(101, 130, 86, 0.15)',
                        border: '1px solid rgba(101, 130, 86, 0.3)',
                        color: '#658256',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        <Sparkles size={13} />
                        Early Renewal / Term Extension (+{safeDurationDays} Days added to {subscription?.end_date || 'current term'})
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Select Plan:</span>
                      <select
                        value={selectedRenewalPlan || '1_month'}
                        onChange={(e) => {
                          setSelectedRenewalPlan(e.target.value);
                          setPromoFeedback(null);
                        }}
                        style={{
                          background: '#1e2230',
                          color: '#e1c256',
                          border: '1px solid rgba(225, 194, 86, 0.4)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="1_day">1-Day Pass — ₱500.00 (24-Hour Access)</option>
                        <option value="1_month">1 Month Pass — ₱2,400.00 (West Fairview ₱1,700)</option>
                        <option value="3_months">3 Months Pass — ₱4,500.00 (~₱1,500/mo)</option>
                        <option value="6_months">6 Months Pass — ₱8,400.00 (~₱1,400/mo)</option>
                        <option value="12_months">12 Months Annual Elite — ₱15,000.00 (~₱1,250/mo, Fee Waived)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {pricing.promoApplied ? 'Discounted Total Due' : 'Total Amount Due'}
                    </div>
                    <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 900, color: pricing.promoApplied ? '#e1c256' : '#658256' }}>
                      ₱{totalDue.toLocaleString()}.00
                    </span>
                    {pricing.promoApplied && (
                      <div style={{ fontSize: '0.7rem', color: '#658256', fontWeight: 700, marginTop: '2px' }}>
                        Saved ₱{discountAmount.toLocaleString()}.00 with {pricing.promoApplied.code}
                      </div>
                    )}
                  </div>
                </div>

                {/* Promo Voucher / Code Application Input Box */}
                <div style={{
                  background: '#0d1017',
                  border: '1px solid #232a3d',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px'
                }}>
                  <div
                    onClick={() => setShowPromoCollapse(prev => !prev)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: showPromoCollapse ? '12px' : '0',
                      cursor: 'pointer',
                      userSelect: 'none',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tag size={14} /> Have a Promo Code or Reception Voucher?
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activePromoCode && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', fontWeight: 800, border: '1px solid #e1c256' }}>
                          Applied: {activePromoCode}
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                        {showPromoCollapse ? 'Standard joining fee is ₱1,000–₱1,500; apply codes below to waive or discount.' : 'Click to enter promo code'}
                      </span>
                      <button
                        type="button"
                        aria-label="Toggle promo code entry"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPromoCollapse(prev => !prev);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#e1c256',
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {showPromoCollapse ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {showPromoCollapse && (
                    <>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="e.g. MKT25, DUO60, CORP40, STUDENT, KATIPUNAN833"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                          className="mono"
                          style={{
                            flex: 1,
                            minWidth: '200px',
                            maxWidth: '320px',
                            background: '#161b26',
                            border: '1px solid #2d3748',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualPromo}
                          className="ksyn-btn ksyn-btn-gold"
                          style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 800 }}
                        >
                          Apply Code
                        </button>
                        {activePromoCode && (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePromoCode(null);
                              setPromoCodeInput('');
                              setPromoFeedback({ type: 'info', msg: 'Promo cleared.' });
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #4a5568',
                              color: '#9ca3af',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Quick-Apply Promo Buttons Tailored to Member Branch */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Quick Apply (Branch Validated):</span>
                        {getAvailablePromosForBranch(safeUser?.branch_name, announcements).map(promo => {
                          const isSelected = activePromoCode === promo.code;
                          return (
                            <button
                              key={promo.code}
                              type="button"
                              onClick={() => handleQuickSelectPromo(promo.code)}
                              style={{
                                background: isSelected ? 'rgba(225, 194, 86, 0.25)' : '#161b26',
                                border: `1px solid ${isSelected ? '#e1c256' : '#2d3748'}`,
                                color: isSelected ? '#e1c256' : '#cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title={promo.description}
                            >
                              {promo.code} ({promo.badge || promo.title})
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Promo Validation Feedback Message */}
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

                  {/* Verification Input Card */}
                  {pricing.verificationRequired && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: '#121620',
                      border: '1px solid rgba(225, 194, 86, 0.35)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} /> Verification Required for {activePromoCode}
                      </div>

                      {pricing.verificationRequired === 'student' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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

                {/* Itemized Fee Breakdown List */}
                <div style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base Membership Fee ({safeDuration}):</span>
                    <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>₱{safePlanFee.toLocaleString()}.00</span>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e1c256' }}>
                      <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={13} /> Promo Discount ({pricing.promoApplied?.code || activePromoCode}):
                      </span>
                      <span className="mono" style={{ fontWeight: 800 }}>-₱{discountAmount.toLocaleString()}.00</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Annual Membership / Joining Fee (Standard ₱1,000–₱1,500):</span>
                    <span className="mono" style={{ color: pricing.annualFee === 0 ? '#658256' : '#fff', fontWeight: 700 }}>
                      {pricing.annualFee === 0 ? '₱0 (WAIVED VIA PROMO / ANNUAL PASS)' : `₱${pricing.annualFee.toLocaleString()}.00`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>RFID Keycard Access & Turnstile Integration:</span>
                    <span className="mono" style={{ color: is1Day ? '#94a3b8' : (pricing.accessFee === 0 ? '#658256' : '#fff') }}>
                      {is1Day ? 'NONE (Pure Optical QR Pass)' : (pricing.accessFee === 0 ? '₱0 (WAIVED)' : '₱1,000.00 (INCLUDED)')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>National All-Branch Access:</span>
                    <span className="mono" style={{ color: is1Day ? '#94a3b8' : '#658256' }}>
                      {is1Day ? 'Home Club Only' : 'INCLUDED (7 Metro Manila Clubs)'}
                    </span>
                  </div>
                </div>

                {/* Primary Real Gateway Action */}
                <div style={{ background: 'rgba(225, 194, 86, 0.06)', border: '1px solid rgba(225, 194, 86, 0.25)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#e1c256' }}>
                      Official Xendit Payment Gateway (Hosted Checkout)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                      {pricing.promoApplied
                        ? `Checking out with promo code "${pricing.promoApplied.code}" — final total: ₱${totalDue.toLocaleString()}.00.`
                        : 'Launches official Xendit hosted checkout with QR Ph, GCash, Maya, cards, and direct debit.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pricing.promoError) {
                        toast.error(pricing.promoError, 'Promo Verification Required');
                        return;
                      }
                      let notes = '';
                      if (activePromoCode === 'STUDENT' && promoVerificationData.studentId) {
                        notes = ` (Student: ${promoVerificationData.schoolName} - ${promoVerificationData.studentId})`;
                      } else if (activePromoCode === 'DUO60' && promoVerificationData.partnerName) {
                        notes = ` (Duo Partner: ${promoVerificationData.partnerName})`;
                      } else if (activePromoCode === 'CORP40' && promoVerificationData.companyName) {
                        notes = ` (Corporate: ${promoVerificationData.companyName})`;
                      } else if (activePromoCode === 'PNP20' && promoVerificationData.pnpId) {
                        notes = ` (PNP Badge: ${promoVerificationData.pnpId})`;
                      }
                      handleProceedToXenditCheckout(selectedRenewalPlan, totalDue, `${activePlanDetails?.name || 'Membership Plan'}${notes}`);
                    }}
                    disabled={isRedirectingXendit}
                    className="ksyn-btn ksyn-btn-gold"
                    title="Proceed to official Xendit secure hosted checkout page"
                    style={{ padding: '10px 22px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: isRedirectingXendit ? 'not-allowed' : 'pointer' }}
                  >
                    {isRedirectingXendit ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Connecting to Xendit...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Xendit Checkout (₱{totalDue.toLocaleString()}) →</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {(() => {
            const currentPlanId = subscription?.plan || safeUser?.membership_plan || '1_day';
            const planInfo = getPlanDetails(currentPlanId) || { name: 'Membership Plan' };
            const safePlanName = planInfo?.name || 'Membership Plan';
            const is12Mo = currentPlanId === '12_months';
            const is6Mo = currentPlanId === '6_months';
            const is3Mo = currentPlanId === '3_months';
            const is1Mo = currentPlanId === '1_month';
            const isDayPass = currentPlanId === '1_day';

            return (
              <div className="ksyn-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                      Membership Plan & Entitlements
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Your active plan is <strong style={{ color: '#e1c256' }}>{safePlanName}</strong> • Facility: <strong style={{ color: '#e2e8f0' }}>{safeUser?.branch_name || 'KSYN Fitness Makati Flagship'}</strong>
                    </p>
                  </div>
                  <span className={`badge ${subscription?.status === 'active' ? 'badge-active' : 'badge-gold'}`} style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {subscription?.status === 'active' ? 'Active Entitlement' : 'Pending Payment'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  {/* Card 1: Floor Access */}
                  <div style={{ background: '#181818', padding: '18px', borderRadius: '10px', border: '1px solid #282828' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>
                      {isDayPass ? 'Pass Duration' : 'Gym Floor Access'}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7fa36d', margin: '4px 0' }}>
                      {isDayPass ? '24-Hour Access' : 'Unlimited Daily'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {isDayPass ? 'Valid until 24 hrs from purchase' : 'Full strength, cardio & functional zones'}
                    </div>
                  </div>

                  {/* Card 2: Group Classes */}
                  <div style={{ background: '#181818', padding: '18px', borderRadius: '10px', border: '1px solid #282828' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Group Classes</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: is12Mo ? '#7fa36d' : (is6Mo || is3Mo || is1Mo ? '#f7ffc4' : '#9ca3af'), margin: '4px 0' }}>
                      {is12Mo ? 'Unlimited' : (is6Mo || is3Mo ? 'Scheduled Classes' : (is1Mo ? '1 Included Class' : 'Drop-in at Desk'))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {is12Mo ? 'Yoga, HIIT, Zumba, Boxing included' : (isDayPass ? 'Drop-in fee required per class' : 'Subject to class schedule & booking')}
                    </div>
                  </div>

                  {/* Card 3: Guest Passes */}
                  <div style={{ background: '#181818', padding: '18px', borderRadius: '10px', border: '1px solid #282828' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Guest Passes</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: is12Mo || is6Mo ? '#e1c256' : '#6b7280', margin: '4px 0' }}>
                      {is12Mo ? 'Unlimited Free' : (is6Mo ? '2 Passes / Mo' : (is3Mo ? '1 Pass Total' : 'None Included'))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {is12Mo || is6Mo ? 'Renews monthly with active status' : 'Available on 6-month & annual plans'}
                    </div>
                  </div>

                  {/* Card 4: Network Roaming */}
                  <div style={{ background: '#181818', padding: '18px', borderRadius: '10px', border: '1px solid #282828' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Network Roaming</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: is12Mo ? '#e1c256' : '#f7ffc4', margin: '4px 0' }}>
                      {is12Mo ? 'All 7 Branches' : (is6Mo ? '4 Visits / Mo' : 'Home Branch Only')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {is12Mo ? 'Nationwide network privileges' : 'Makati Flagship club access'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: RECENT PASS CHECK-INS PREVIEW (activeSection === 'pass') */}
      {/* ========================================================================= */}
      {activeSection === 'pass' && (
        <div className="ksyn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Recent Turnstile Entries</h2>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                Latest verified club entries. Visit Check-In History & Stats for full lifetime breakdown.
              </p>
            </div>
            <button
              onClick={() => {
                setAttendanceViewMode('calendar');
                handleSectionSwitch('activity_progress');
              }}
              className="ksyn-btn ksyn-btn-outline"
              style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Activity size={14} /> View Activity & Progress Calendar &rarr;
            </button>
          </div>

          <SafeDataTable
            columns={attendanceColumns}
            data={safeAttendance.slice(0, 3)}
            emptyMessage="No recent gym check-in records found yet. Scan your dynamic pass at any turnstile."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: ACTIVITY & PROGRESS (activeSection === 'activity_progress') */}
      {/* ========================================================================= */}
      {(activeSection === 'activity_progress' || activeSection === 'progress' || activeSection === 'attendance') && (() => {
        const currentPlanId = subscription?.plan || safeUser?.membership_plan || '1_day';
        const isElite = currentPlanId === '12_months';
        const isPro = currentPlanId === '6_months';
        const inspectorDateKey = selectedCalendarDate || todayStr;
        const checkInsForInspector = attendanceByDate[inspectorDateKey] || [];
        const weighInsForInspector = weighInsByDate[inspectorDateKey] || [];
        const workoutsForInspector = getWorkoutsForDate(inspectorDateKey);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={22} color="#e1c256" /> Activity & Progress
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  Unified facility check-in audit, biometric weight tracking, and coach-assigned workout splits in one dashboard.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSectionSwitch('pass')}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <QrCode size={15} /> Show My Digital Pass
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeightModalDate(selectedCalendarDate || todayStr);
                    setWeightModalError(null);
                    setShowLogWeightModal(true);
                  }}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Log New Weight
                </button>
              </div>
            </div>

            {/* Top Metrics Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {/* Metric 1: Starting Weight */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Starting Weight
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scale size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: baselineMetrics?.starting_weight ? '#ffffff' : '#9ca3af', lineHeight: 1.1 }}>
                  {baselineMetrics?.starting_weight ? `${parseFloat(baselineMetrics.starting_weight).toFixed(1)} kg` : '-- kg'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  Initial recorded baseline
                </div>
              </div>

              {/* Metric 2: Current Weight */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Current Weight
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.2)', color: '#e1c256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#e1c256', lineHeight: 1.1 }}>
                  {baselineMetrics?.current_weight ? `${parseFloat(baselineMetrics.current_weight).toFixed(1)} kg` : '-- kg'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  Most recent logged weigh-in
                </div>
              </div>

              {/* Metric: Target Goal Weight */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Target Goal Weight
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(147, 197, 253, 0.15)', color: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: baselineMetrics?.target_weight ? '#93c5fd' : '#9ca3af', lineHeight: 1.1 }}>
                  {baselineMetrics?.target_weight ? `${parseFloat(baselineMetrics.target_weight).toFixed(1)} kg` : 'Not set'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{baselineMetrics?.target_weight ? 'Goal weight' : 'No goal entered'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetWeightInput(baselineMetrics?.target_weight ? String(baselineMetrics.target_weight) : '');
                      setShowTargetWeightModal(true);
                    }}
                    style={{
                      background: 'rgba(225, 194, 86, 0.15)',
                      color: '#e1c256',
                      border: '1px solid rgba(225, 194, 86, 0.35)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {baselineMetrics?.target_weight ? 'Edit Goal' : 'Fill Target Weight'}
                  </button>
                </div>
              </div>

              {/* Metric 3: Net Progress / Delta */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Net Progress / Delta
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.15)', color: '#658256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {baselineMetrics?.overall_change !== null && baselineMetrics?.overall_change !== undefined ? (
                    Number(baselineMetrics.overall_change) < 0 ? (
                      <span style={{ color: '#658256', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <ArrowDownRight size={20} /> {parseFloat(baselineMetrics.overall_change).toFixed(1)} kg
                      </span>
                    ) : Number(baselineMetrics.overall_change) > 0 ? (
                      <span style={{ color: '#e1c256', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <ArrowUpRight size={20} /> +{parseFloat(baselineMetrics.overall_change).toFixed(1)} kg
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>0.0 kg</span>
                    )
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-- kg</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  Cumulative difference since baseline
                </div>
              </div>

              {/* Metric 4: Monthly Facility Visits */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Monthly Facility Visits
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.15)', color: '#658256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarCheck size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#658256', lineHeight: 1.1 }}>
                  {monthlyVisitsCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  Logged in {monthNames[now.getMonth()]} {now.getFullYear()}
                </div>
              </div>

              {/* Metric 5: Lifetime Scans & Roaming Privileges */}
              <div className="ksyn-card" style={{ padding: '20px', background: '#121212', border: '1px solid #262626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lifetime Visits & Roaming
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <History size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                  {totalLifetimeCheckIns} <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>Total Check-Ins</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  {isElite ? 'Unlimited access across all 7 KSYN Clubs' : (isPro ? `${crossBranchMonthCount} of 4 roaming visits used this month` : `Home: ${safeUser.branch_name}`)}
                </div>
              </div>
            </div>

            {/* Interactive Calendar Matrix & Mode Switcher */}
            <div className="ksyn-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} color="#e1c256" /> Turnstile Access & Gym Attendance Calendar
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Click any calendar date to inspect turnstile entry scans, biometric weigh-in records, and scheduled workout routines.
                  </p>
                </div>

                {/* View Switcher Pill */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#0a0d14', border: '1px solid #232938', borderRadius: '10px', padding: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setAttendanceViewMode('calendar')}
                    style={{
                      background: attendanceViewMode === 'calendar' ? 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)' : 'transparent',
                      color: attendanceViewMode === 'calendar' ? '#000000' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Calendar size={14} /> Calendar Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceViewMode('table')}
                    style={{
                      background: attendanceViewMode === 'table' ? 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)' : 'transparent',
                      color: attendanceViewMode === 'table' ? '#000000' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <History size={14} /> Turnstile Logs ({safeAttendance.length})
                  </button>
                </div>
              </div>

              {attendanceViewMode === 'calendar' ? (
                <>
                  {/* Month Navigation & Summary Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#0d1017',
                    border: '1px solid #1f2536',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    {/* Left: Prev / Month / Next */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={handlePrevCalendarMonth}
                        style={{
                          background: '#151924',
                          border: '1px solid #28324a',
                          color: '#cbd5e1',
                          borderRadius: '8px',
                          width: '34px',
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Previous Month"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', margin: 0, minWidth: '150px', textAlign: 'center' }}>
                        {monthNames[calendarMonth]} {calendarYear}
                      </h4>

                      <button
                        type="button"
                        onClick={handleNextCalendarMonth}
                        style={{
                          background: '#151924',
                          border: '1px solid #28324a',
                          color: '#cbd5e1',
                          borderRadius: '8px',
                          width: '34px',
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Next Month"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Right: Monthly Workout Classification Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: 'rgba(101, 130, 86, 0.12)',
                        border: '1px solid rgba(101, 130, 86, 0.35)',
                        color: '#658256',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <CheckCircle2 size={13} /> {currentMonthCheckedDays} {currentMonthCheckedDays === 1 ? 'Session' : 'Sessions'} in {monthNames[calendarMonth]}
                      </span>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    gap: '8px',
                    marginBottom: '14px'
                  }}>
                    {/* Day-of-week headers */}
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dname, idx) => (
                      <div key={idx} style={{
                        textAlign: 'center',
                        padding: '8px 4px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: idx === 0 || idx === 6 ? '#e1c256' : '#94a3b8',
                        letterSpacing: '0.05em'
                      }}>
                        {dname}
                      </div>
                    ))}

                    {/* Day cells */}
                    {calendarDays.map((cell) => {
                      const scans = attendanceByDate[cell.key] || [];
                      const weighIns = weighInsByDate[cell.key] || [];
                      const workouts = getWorkoutsForDate(cell.key);
                      const hasCheckIn = scans.length > 0;
                      const hasWeighIn = weighIns.length > 0;
                      const hasWorkout = workouts.length > 0;
                      const isSelected = selectedCalendarDate === cell.key;
                      const isToday = cell.key === todayStr;
                      const isPastOrToday = cell.key <= todayStr;

                      return (
                        <div
                          key={cell.key}
                          onClick={() => setSelectedCalendarDate(cell.key)}
                          style={{
                            minHeight: '84px',
                            padding: '8px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.16s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            opacity: cell.isCurrentMonth ? 1 : 0.35,
                            background: isSelected
                              ? 'rgba(225, 194, 86, 0.14)'
                              : hasCheckIn
                                ? 'rgba(101, 130, 86, 0.08)'
                                : '#0d1017',
                            border: isSelected
                              ? '2px solid #e1c256'
                              : hasCheckIn
                                ? '1.5px solid rgba(101, 130, 86, 0.5)'
                                : isToday
                                  ? '1.5px solid rgba(225, 194, 86, 0.4)'
                                  : '1px solid #1f2536',
                            boxShadow: isSelected
                              ? '0 0 16px rgba(225, 194, 86, 0.35)'
                              : hasCheckIn
                                ? '0 0 10px rgba(101, 130, 86, 0.12)'
                                : 'none'
                          }}
                        >
                          {/* Top row: day number + today indicator */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: isSelected || hasCheckIn || isToday ? 900 : 600,
                              color: isSelected ? '#e1c256' : hasCheckIn ? '#ffffff' : cell.isCurrentMonth ? '#cbd5e1' : '#64748b'
                            }}>
                              {cell.dayNum}
                            </span>
                            {isToday && (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 900,
                                color: '#000000',
                                background: '#e1c256',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                letterSpacing: '0.02em'
                              }}>
                                TODAY
                              </span>
                            )}
                          </div>

                          {/* Multi-Indicator Badges */}
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {hasCheckIn && (
                              <span style={{
                                background: 'rgba(101, 130, 86, 0.22)',
                                border: '1px solid #658256',
                                color: '#7fa36d',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                lineHeight: 1.1
                              }}>
                                <CheckCircle2 size={9} /> Visited ({scans.length})
                              </span>
                            )}
                            {hasWeighIn && (
                              <span style={{
                                background: 'rgba(225, 194, 86, 0.2)',
                                border: '1px solid #e1c256',
                                color: '#e1c256',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                lineHeight: 1.1
                              }}>
                                <Scale size={9} /> {parseFloat(weighIns[0].weight_kg).toFixed(1)}kg
                              </span>
                            )}
                            {hasWorkout && (
                              <span style={{
                                background: 'rgba(168, 85, 247, 0.18)',
                                border: '1px solid #a855f7',
                                color: '#c084fc',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                lineHeight: 1.1
                              }}>
                                <Dumbbell size={9} /> Routine
                              </span>
                            )}
                            {!hasCheckIn && !hasWeighIn && !hasWorkout && isPastOrToday && cell.isCurrentMonth && (
                              <div style={{ textAlign: 'right', marginTop: 'auto' }}>
                                <span style={{ fontSize: '0.625rem', color: '#475569', fontWeight: 500 }}>
                                  Rest
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Calendar Classification Legend */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    fontSize: '0.75rem',
                    color: '#9ca3af',
                    padding: '10px 14px',
                    background: '#090b10',
                    borderRadius: '8px',
                    border: '1px solid #1c2230',
                    marginBottom: '20px'
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 6px rgba(101, 130, 86, 0.5)' }} />
                      <strong style={{ color: '#ffffff' }}>Check-In</strong> (Turnstile Scanned)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e1c256', boxShadow: '0 0 6px rgba(225, 194, 86, 0.5)' }} />
                      <strong style={{ color: '#e1c256' }}>Weigh-In</strong> (Biometric Log)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px rgba(168, 85, 247, 0.5)' }} />
                      <strong style={{ color: '#c084fc' }}>Workout Routine</strong> (Split Prescribed)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#334155' }} />
                      <strong style={{ color: '#94a3b8' }}>Rest Day</strong> (Recovery)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '12px', border: '2px solid #e1c256', borderRadius: '3px', background: 'rgba(225, 194, 86, 0.2)' }} />
                      <strong style={{ color: '#e1c256' }}>Selected Date</strong>
                    </span>
                  </div>

                  {/* Dynamic Selected Date Detail Inspector */}
                  <div style={{
                    marginTop: '20px',
                    borderTop: '1px solid #232a3d',
                    paddingTop: '20px',
                    animation: 'fadeIn 0.2s ease-in'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CalendarCheck size={18} color="#e1c256" /> Activity & Audit Breakdown: {formatCalendarDisplayDate(inspectorDateKey)}
                        </h4>
                        {checkInsForInspector.length > 0 && (
                          <span style={{
                            background: 'rgba(101, 130, 86, 0.15)',
                            color: '#658256',
                            border: '1px solid rgba(101, 130, 86, 0.35)',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <CheckCircle2 size={13} /> {checkInsForInspector.length} Turnstile Scan{checkInsForInspector.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {weighInsForInspector.length > 0 && (
                          <span style={{
                            background: 'rgba(225, 194, 86, 0.15)',
                            color: '#e1c256',
                            border: '1px solid rgba(225, 194, 86, 0.35)',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <Scale size={13} /> {parseFloat(weighInsForInspector[0].weight_kg).toFixed(1)} kg Logged
                          </span>
                        )}
                      </div>

                      {weighInsForInspector.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setWeightModalDate(inspectorDateKey);
                            setWeightModalError(null);
                            setShowLogWeightModal(true);
                          }}
                          className="ksyn-btn ksyn-btn-gold"
                          style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Plus size={13} /> Log Weigh-In for This Day
                        </button>
                      )}
                    </div>

                    {/* 3 Distinct Panels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                      {/* Panel 1: Facility Entry Audit */}
                      <div style={{ background: '#0e111a', border: '1px solid #1f2536', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #1a1f2c', paddingBottom: '10px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#658256', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={16} color="#658256" /> Facility Entry Audit
                          </span>
                          <span className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                            {checkInsForInspector.length} Recorded
                          </span>
                        </div>

                        {checkInsForInspector.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {checkInsForInspector.map((scan, sIdx) => {
                              const scanTime = scan.check_in_time || scan.created_at;
                              const timeStr = scanTime ? new Date(scanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Verified';
                              return (
                                <div key={sIdx} style={{ background: '#121622', border: '1px solid #232c40', borderRadius: '8px', padding: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff' }}>
                                      {scan.branch_name || safeUser.branch_name || 'KSYN Club'}
                                    </span>
                                    <span className="badge badge-active" style={{ fontSize: '0.6875rem' }}>
                                      <CheckCircle2 size={11} /> Turnstile Granted
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div>Time: <strong style={{ color: '#cbd5e1' }}>{timeStr}</strong></div>
                                    <div>Gate: <strong style={{ color: '#cbd5e1' }}>Turnstile Gate #{scan.turnstile_id || '01'}</strong></div>
                                    <div>Verification: <span style={{ color: '#658256', fontWeight: 600 }}>Dynamic QR Rotating Pass</span></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ background: '#0a0d14', border: '1px dashed #202738', borderRadius: '8px', padding: '24px 16px', textAlign: 'center' }}>
                            <ShieldCheck size={26} color="#475569" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1' }}>No Facility Check-In Recorded</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                              No turnstile scans were registered for your profile on this date.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Panel 2: Biometric Record */}
                      <div style={{ background: '#0e111a', border: '1px solid #1f2536', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #1a1f2c', paddingBottom: '10px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Scale size={16} color="#e1c256" /> Biometric Weigh-In
                          </span>
                          <span className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                            {weighInsForInspector.length} Logged
                          </span>
                        </div>

                        {weighInsForInspector.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {weighInsForInspector.map((log, wIdx) => (
                              <div key={wIdx} style={{ background: '#121622', border: '1px solid #232c40', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256' }}>
                                    {parseFloat(log.weight_kg).toFixed(1)} <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>kg</span>
                                  </span>
                                  {log.delta !== undefined && log.delta !== null && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                      color: Number(log.delta) < 0 ? '#658256' : Number(log.delta) > 0 ? '#e1c256' : '#9ca3af',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}>
                                      {Number(log.delta) < 0 ? <ArrowDownRight size={14} /> : Number(log.delta) > 0 ? <ArrowUpRight size={14} /> : null}
                                      {Number(log.delta) !== 0 ? `${Number(log.delta) > 0 ? '+' : ''}${parseFloat(log.delta).toFixed(1)} kg` : 'Baseline'}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                                  <strong style={{ color: '#9ca3af' }}>Notes:</strong> {log.notes || 'Routine weigh-in logged'}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ background: '#0a0d14', border: '1px dashed #202738', borderRadius: '8px', padding: '24px 16px', textAlign: 'center' }}>
                            <Scale size={26} color="#475569" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1' }}>No Weigh-In Recorded</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', marginBottom: '12px' }}>
                              No body weight metrics were saved on this date.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setWeightModalDate(inspectorDateKey);
                                setWeightModalError(null);
                                setShowLogWeightModal(true);
                              }}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, margin: '0 auto' }}
                            >
                              <Plus size={13} /> Log Weight for this Day
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Panel 3: Assigned Workout / Split */}
                      <div style={{ background: '#0e111a', border: '1px solid #1f2536', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #1a1f2c', paddingBottom: '10px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Dumbbell size={16} color="#c084fc" /> Assigned Workout / Split
                          </span>
                          <span className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                            {workoutsForInspector.length} Routine{workoutsForInspector.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {workoutsForInspector.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {workoutsForInspector.map((plan, pIdx) => (
                              <div key={pIdx} style={{ background: '#121622', border: '1px solid #232c40', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                                  {plan.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px' }}>
                                  Split: <strong style={{ color: '#e1c256' }}>{plan.split_type || 'Custom Periodized'}</strong>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {plan.exercises?.slice(0, 3).map((ex, exIdx) => (
                                    <div
                                      key={exIdx}
                                      onClick={() => handleToggleExerciseComplete(plan.id, exIdx)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        color: ex.completed ? '#658256' : '#cbd5e1'
                                      }}
                                    >
                                      <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '4px',
                                        background: ex.completed ? '#658256' : '#1e2433',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#000',
                                        fontSize: '0.625rem'
                                      }}>
                                        {ex.completed && <Check size={11} />}
                                      </div>
                                      <span style={{ textDecoration: ex.completed ? 'line-through' : 'none' }}>
                                        {ex.name} ({ex.sets} × {ex.reps})
                                      </span>
                                    </div>
                                  ))}
                                  {plan.exercises?.length > 3 && (
                                    <span style={{ fontSize: '0.6875rem', color: '#64748b', fontStyle: 'italic' }}>
                                      +{plan.exercises.length - 3} more exercises in full routine below
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ background: '#0a0d14', border: '1px dashed #202738', borderRadius: '8px', padding: '24px 16px', textAlign: 'center' }}>
                            <Dumbbell size={26} color="#475569" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1' }}>No Workout Scheduled</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                              {assignedCoach
                                ? `Message ${assignedCoach.name || 'your coach'} in Quick-Chat to assign a routine.`
                                : 'Enroll in a Personal Training package to receive a custom workout split.'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Turnstile All Logs Table View */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                      Sequential audit records of all lifetime facility scans across all KSYN clubs.
                    </span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#141414', border: '1px solid #262626', padding: '4px 10px', borderRadius: '6px' }}>
                      Total Records: <strong>{safeAttendance.length}</strong>
                    </span>
                  </div>
                  <SafeDataTable
                    columns={detailedAttendanceColumns}
                    data={safeAttendance}
                    emptyMessage="No gym check-in records found yet. Scan your dynamic QR pass at any club turnstile to log attendance."
                  />
                </div>
              )}
            </div>

            {/* Quick Toggle Controls: Biometric History Ledger & Workout Routine */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: '#0d1017',
              border: '1px solid #1e2535',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Athlete Records:
              </span>
              <button
                type="button"
                onClick={() => setShowBiometricLedger(prev => !prev)}
                className="ksyn-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  background: showBiometricLedger ? 'rgba(225, 194, 86, 0.15)' : '#161b26',
                  color: showBiometricLedger ? '#e1c256' : '#cbd5e1',
                  border: `1px solid ${showBiometricLedger ? '#e1c256' : '#2d3748'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <TrendingUp size={15} color={showBiometricLedger ? '#e1c256' : '#94a3b8'} />
                <span>Biometric History Ledger ({progressData?.length || 0})</span>
                {showBiometricLedger ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setShowAssignedRoutine(prev => !prev)}
                className="ksyn-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  background: showAssignedRoutine ? 'rgba(225, 194, 86, 0.15)' : '#161b26',
                  color: showAssignedRoutine ? '#e1c256' : '#cbd5e1',
                  border: `1px solid ${showAssignedRoutine ? '#e1c256' : '#2d3748'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Dumbbell size={15} color={showAssignedRoutine ? '#e1c256' : '#94a3b8'} />
                <span>My Assigned Workout Routine ({workoutPlans.length})</span>
                {showAssignedRoutine ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Conditionally Expanded Biometric History Ledger */}
            {showBiometricLedger && (
              <div className="ksyn-card" style={{ marginTop: '0px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={16} color="#e1c256" /> Biometric History Ledger & Audit Trail
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Descending chronological audit table of body composition weigh-ins, deltas since previous logs, and milestone notes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWeightModalDate(todayStr);
                      setWeightModalError(null);
                      setShowLogWeightModal(true);
                    }}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ padding: '7px 14px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> Log New Weight
                  </button>
                </div>

                {progressData && progressData.length > 0 ? (
                  <SafeDataTable
                    columns={progressColumns}
                    data={progressData}
                    emptyMessage="No progress weigh-ins logged yet."
                  />
                ) : (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: '#0d1017',
                    border: '1px dashed #283044',
                    borderRadius: '10px'
                  }}>
                    <Scale size={24} style={{ color: '#e1c256', margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', fontSize: '0.875rem' }}>No Recorded Weigh-Ins Found</p>
                    <p style={{ margin: '4px 0 12px 0', fontSize: '0.75rem', color: '#9ca3af' }}>No biometric weigh-in records exist in your account. Record your baseline or current weigh-in.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setWeightModalDate(todayStr);
                        setWeightModalError(null);
                        setShowLogWeightModal(true);
                      }}
                      className="ksyn-btn ksyn-btn-gold"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={13} /> Log Initial Weigh-In
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Coach-Assigned Workout Routine Overview */}
            {showAssignedRoutine && (
              <div className="ksyn-card" style={{ background: '#12151e', border: '1px solid #232938', marginTop: '0px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.12)',
                    border: '1px solid rgba(225, 194, 86, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256'
                  }}>
                    <Dumbbell size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                      My Assigned Workout Routine
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Periodized training split prescribed by your dedicated Personal Trainer. Check off exercises as you train.
                    </p>
                  </div>
                </div>

                {assignedCoach && (
                  <button
                    type="button"
                    onClick={() => handleSectionSwitch('chat')}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                  >
                    <MessageSquare size={14} /> Message Coach {assignedCoach.name?.split(' ')?.[0] || 'Coach'}
                  </button>
                )}
              </div>

              {!assignedCoach ? (
                <div style={{
                  background: '#0d1017',
                  border: '1px dashed #283044',
                  borderRadius: '12px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: 'rgba(225, 194, 86, 0.08)',
                    border: '1px solid rgba(225, 194, 86, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256'
                  }}>
                    <Users size={26} />
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                    No Dedicated Coach Assigned
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
                    You currently do not have a dedicated personal trainer assigned. Enroll in a 1-on-1 Personal Training package to unlock custom workout routines and periodized training splits.
                  </p>
                </div>
              ) : workoutPlans.length === 0 ? (
                <div style={{
                  background: '#0d1017',
                  border: '1px dashed #283044',
                  borderRadius: '12px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: 'rgba(225, 194, 86, 0.08)',
                    border: '1px solid rgba(225, 194, 86, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256'
                  }}>
                    <Dumbbell size={26} />
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                    No Active Workout Routine Published Yet
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
                    Your assigned coach ({assignedCoach.name || 'Personal Trainer'}) has not published a routine for you yet. Send them a message in Coach Quick-Chat to request your periodized split.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSectionSwitch('chat')}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      marginTop: '8px',
                      padding: '10px 22px',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 800,
                      background: '#e1c256',
                      color: '#000000',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(225, 194, 86, 0.35)'
                    }}
                  >
                    <MessageSquare size={16} /> <span style={{ color: '#000000', fontWeight: 800 }}>Open Coach Quick-Chat</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
                  {workoutPlans.map((plan) => {
                    const completedCount = plan.exercises?.filter(e => e.completed).length || 0;
                    const totalCount = plan.exercises?.length || 0;
                    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <div
                        key={plan.id}
                        style={{
                          background: '#0e111a',
                          border: '1px solid #1f2536',
                          borderRadius: '14px',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}
                      >
                        {/* Plan Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: 'rgba(225, 194, 86, 0.12)',
                                color: '#e1c256',
                                border: '1px solid rgba(225, 194, 86, 0.25)'
                              }}>
                                {plan.split_type || 'Custom Split'}
                              </span>
                              <span style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#1a1f2c',
                                color: '#94a3b8'
                              }}>
                                {plan.days_per_week || 4} days / week
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: '4px 0 2px' }}>
                              {plan.title}
                            </h4>
                            <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                              Prescribed by {plan.coach_name || assignedCoach?.name || 'Coach'}
                            </span>
                          </div>

                          <div style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: progressPct === 100 ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                            border: `1px solid ${progressPct === 100 ? '#658256' : '#e1c256'}`,
                            color: progressPct === 100 ? '#658256' : '#e1c256',
                            fontWeight: 800,
                            fontSize: '0.8125rem'
                          }}>
                            {progressPct}% Done
                          </div>
                        </div>

                        {/* Coach Notes */}
                        {plan.notes && (
                          <div style={{
                            background: '#090b11',
                            border: '1px solid #191f2c',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.8125rem',
                            color: '#cbd5e1',
                            lineHeight: 1.4
                          }}>
                            <strong style={{ color: '#e1c256', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                              Coach Cue:
                            </strong>
                            {plan.notes}
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                            <span style={{ color: '#94a3b8' }}>Routine Progress</span>
                            <span style={{ color: progressPct === 100 ? '#658256' : '#e1c256', fontWeight: 700 }}>
                              {completedCount} of {totalCount} Completed
                            </span>
                          </div>
                          <div style={{ height: '6px', background: '#1a1f2c', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${progressPct}%`,
                              background: progressPct === 100 ? 'linear-gradient(90deg, #658256, #658256)' : 'linear-gradient(90deg, #e1c256, #eab308)',
                              transition: 'width 0.3s'
                            }} />
                          </div>
                        </div>

                        {/* Interactive Exercise Targets */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                            Target Exercises (Click to Check Off)
                          </span>

                          {plan.exercises?.map((ex, exIdx) => (
                            <div
                              key={exIdx}
                              onClick={() => handleToggleExerciseComplete(plan.id, exIdx)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                background: ex.completed ? 'rgba(101, 130, 86, 0.08)' : '#07090f',
                                border: `1px solid ${ex.completed ? 'rgba(101, 130, 86, 0.35)' : '#1a1f2c'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '6px',
                                  background: ex.completed ? '#658256' : '#1e2433',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: ex.completed ? '#000' : 'transparent',
                                  transition: 'all 0.15s'
                                }}>
                                  <Check size={14} style={{ strokeWidth: 3 }} />
                                </div>
                                <div>
                                  <div style={{
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    color: ex.completed ? '#658256' : '#f1f5f9',
                                    textDecoration: ex.completed ? 'line-through' : 'none'
                                  }}>
                                    {ex.name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {ex.sets} Sets × {ex.reps} Reps {ex.target_weight ? `• ${ex.target_weight}` : ''} {ex.rest_seconds ? `• ${ex.rest_seconds}s rest` : ''}
                                  </div>
                                </div>
                              </div>

                              {ex.completed ? (
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(101, 130, 86, 0.2)',
                                  color: '#658256'
                                }}>
                                  Done
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  color: '#64748b'
                                }}>
                                  Pending
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW 5: PROFILE SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeSection === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {profileSavedToast && (
            <div style={{
              background: 'rgba(101, 130, 86, 0.15)',
              border: '1px solid #658256',
              color: '#658256',
              padding: '14px 20px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '0.875rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} />
                <span>{profileSavedToast}</span>
              </div>
              <button
                onClick={() => setProfileSavedToast(null)}
                style={{ background: 'none', border: 'none', color: '#658256', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="ksyn-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Member Profile & Account Settings</h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  Manage personal contact details, emergency notifications, and club credentials.
                </p>
              </div>
              <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                <ShieldCheck size={12} /> KYC Verified
              </span>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Completion Classification & Progress Indicator */}
              {(() => {
                const reqs = [
                  { label: 'Name', ok: Boolean(safeUser?.name && safeUser.name.trim()) },
                  { label: 'Email', ok: Boolean(safeUser?.email && safeUser.email.trim()) },
                  { label: 'Mobile Phone', ok: Boolean(profilePhone && profilePhone.trim()) },
                  { label: 'Residential Address', ok: Boolean(profileAddress && profileAddress.trim()) },
                  { label: 'Emergency Contact Name', ok: Boolean(profileEmergencyName && profileEmergencyName.trim()) },
                  { label: 'Emergency Mobile Phone', ok: Boolean(profileEmergencyPhone && profileEmergencyPhone.trim()) },
                  { label: 'Primary Fitness Goal', ok: Boolean(profileGoal && profileGoal.trim()) }
                ];
                const filledCount = reqs.filter(r => r.ok).length;
                const pct = Math.round((filledCount / reqs.length) * 100);
                const isComplete = pct === 100;

                // Completely hide banner once all required information is filled up
                if (isComplete) return null;

                return (
                  <div style={{
                    background: 'rgba(254, 243, 199, 0.05)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'rgba(251, 191, 36, 0.18)',
                          color: '#fef08a',
                          border: '1px solid rgba(251, 191, 36, 0.35)'
                        }}>
                          {pct}% Required Information Completed
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: '#fde047', fontWeight: 700 }}>
                          Incomplete: Please complete address and emergency contact details
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: '#20242f', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #fde68a 0%, #fbbf24 100%)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>

                    {/* Checklist pills */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {reqs.map((r, i) => (
                        <span key={i} style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: r.ok ? 'rgba(167, 243, 208, 0.12)' : 'rgba(254, 202, 202, 0.14)',
                          color: r.ok ? '#a7f3d0' : '#fca5a5',
                          border: r.ok ? '1px solid rgba(110, 231, 183, 0.35)' : '1px solid rgba(248, 113, 113, 0.4)'
                        }}>
                          {r.ok ? 'Completed:' : 'Missing:'} {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Profile Card Header */}
              <div style={{
                background: '#161616',
                border: '1px solid #282828',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#e1c256',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {safeUser.name?.charAt(0) || 'M'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    {(safeUser.name || '').replace(/\s*\([^\)]*\)\s*/g, '').trim() || safeUser.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>{safeUser.email} • {safeUser.branch_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    border: '1px solid rgba(225, 194, 86, 0.4)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Star size={11} className="fill-[#e1c256] text-[#e1c256]" /> {hasActivePlan && subscription?.plan ? getPlanDetails(subscription.plan).name : 'No Active Plan'}
                  </span>
                </div>
              </div>

              {/* Home Facility & Branch Relocation Card */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#60a5fa'
                  }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#93c5fd', letterSpacing: '0.05em' }}>
                      Home Facility Location
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                      {safeUser.branch_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Primary station for gym access, locker assignments, and PT scheduling.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBranchTransferModal(true)}
                  className="ksyn-btn"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <ArrowRight size={14} /> Transfer Branch Facility
                </button>
              </div>

              {/* Personal Details Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div>
                  <label className="ksyn-label">Full Legal Name</label>
                  <input
                    type="text"
                    disabled
                    value={(safeUser.name || '').replace(/\s*\([^\)]*\)\s*/g, '').trim() || safeUser.name}
                    className="ksyn-input"
                    style={{ background: '#111', cursor: 'not-allowed', color: '#d1d5db' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Verified against government ID</span>
                </div>

                <div>
                  <label className="ksyn-label">Email Address (Login Handle)</label>
                  <input
                    type="email"
                    disabled
                    value={safeUser.email}
                    className="ksyn-input"
                    style={{ background: '#111', cursor: 'not-allowed', color: '#d1d5db' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Contact front desk to update email</span>
                </div>

                <div>
                  <label className="ksyn-label">Philippine Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="ksyn-input"
                    placeholder={profilePhone && profilePhone.trim() ? '' : 'Required - e.g. 09123456789'}
                    style={{
                      background: profilePhone && profilePhone.trim() ? '#10141d' : 'rgba(254, 202, 202, 0.14)',
                      border: profilePhone && profilePhone.trim() ? '1px solid #334155' : '1.5px solid rgba(248, 113, 113, 0.6)',
                      boxShadow: profilePhone && profilePhone.trim() ? 'none' : '0 0 0 1px rgba(248, 113, 113, 0.25)',
                      color: '#ffffff',
                      transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Used for turnstile SMS security alerts</span>
                </div>

                <div>
                  <label className="ksyn-label">Home Franchise Club</label>
                  <input
                    type="text"
                    disabled
                    value={safeUser.branch_name}
                    className="ksyn-input"
                    style={{ background: '#111', cursor: 'not-allowed', color: '#d1d5db' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Primary locker & trainer allocation</span>
                </div>
              </div>

              {/* Residential Address */}
              <div>
                <label className="ksyn-label">Residential Address (Metro Manila / Provincial) *</label>
                <input
                  type="text"
                  required
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  className="ksyn-input"
                  placeholder={profileAddress && profileAddress.trim() ? '' : 'Required - enter residential address (e.g. 742 Evergreen St, Makati City)'}
                  style={{
                    background: profileAddress && profileAddress.trim() ? '#10141d' : 'rgba(254, 202, 202, 0.14)',
                    border: profileAddress && profileAddress.trim() ? '1px solid #334155' : '1.5px solid rgba(248, 113, 113, 0.6)',
                    boxShadow: profileAddress && profileAddress.trim() ? 'none' : '0 0 0 1px rgba(248, 113, 113, 0.25)',
                    color: '#ffffff',
                    transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                />
              </div>

              {/* Emergency Contact Information */}
              <div style={{
                background: '#0e0e0e',
                border: '1px solid #222222',
                borderRadius: '10px',
                padding: '18px'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.05em' }}>
                  Emergency Contact & Safety Protocols
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <div>
                    <label className="ksyn-label">Emergency Contact Name & Relationship *</label>
                    <input
                      type="text"
                      required
                      value={profileEmergencyName}
                      onChange={(e) => setProfileEmergencyName(e.target.value)}
                      className="ksyn-input"
                      placeholder={profileEmergencyName && profileEmergencyName.trim() ? '' : 'Required - e.g. Roberto Marquez (Father)'}
                      style={{
                        background: profileEmergencyName && profileEmergencyName.trim() ? '#10141d' : 'rgba(254, 202, 202, 0.14)',
                        border: profileEmergencyName && profileEmergencyName.trim() ? '1px solid #334155' : '1.5px solid rgba(248, 113, 113, 0.6)',
                        boxShadow: profileEmergencyName && profileEmergencyName.trim() ? 'none' : '0 0 0 1px rgba(248, 113, 113, 0.25)',
                        color: '#ffffff',
                        transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label className="ksyn-label">Emergency Contact Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      value={profileEmergencyPhone}
                      onChange={(e) => setProfileEmergencyPhone(e.target.value)}
                      className="ksyn-input"
                      placeholder={profileEmergencyPhone && profileEmergencyPhone.trim() ? '' : 'Required - e.g. 09171234567'}
                      style={{
                        background: profileEmergencyPhone && profileEmergencyPhone.trim() ? '#10141d' : 'rgba(254, 202, 202, 0.14)',
                        border: profileEmergencyPhone && profileEmergencyPhone.trim() ? '1px solid #334155' : '1.5px solid rgba(248, 113, 113, 0.6)',
                        boxShadow: profileEmergencyPhone && profileEmergencyPhone.trim() ? 'none' : '0 0 0 1px rgba(248, 113, 113, 0.25)',
                        color: '#ffffff',
                        transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label className="ksyn-label">Primary Fitness Goal</label>
                    <select
                      value={profileGoal}
                      onChange={(e) => setProfileGoal(e.target.value)}
                      className="ksyn-select"
                    >
                      <option value="Athletic Conditioning & Hypertrophy">Athletic Conditioning & Hypertrophy</option>
                      <option value="Weight Loss & Metabolic Endurance">Weight Loss & Metabolic Endurance</option>
                      <option value="Powerlifting & Maximal Strength">Powerlifting & Maximal Strength</option>
                      <option value="Mobility, Core & Functional Health">Mobility, Core & Functional Health</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Hardware Pass Nonce & Security */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid #1f1f1f',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>
                    <ShieldCheck size={16} color="#658256" />
                    <span>Dynamic QR Anti-Replay Security Nonce</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                    Hardware turnstiles authenticate your device with 60-second rotating cryptographic tokens.
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '10px 24px', fontWeight: 800 }}
                >
                  {savingProfile ? 'Saving Settings...' : 'Save Profile Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: IN-APP COACH ATHLETE QUICK-CHAT (activeSection === 'chat') */}
      {/* ========================================================================= */}
      {activeSection === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pending PT Enrollment Clearance Banner */}
          {pendingPtEnrollment && !assignedCoach && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(225, 194, 86, 0.12) 0%, rgba(101, 130, 86, 0.12) 100%)',
              border: '1px solid #e1c256',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 0 20px rgba(225, 194, 86, 0.12)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={22} color="#e1c256" />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f7ffc4', margin: 0 }}>
                    Incoming PT Enrollment: {safeUser?.name} → {pendingPtEnrollment.coach_name}
                  </h3>
                </div>
                <span className="mono" style={{ fontSize: '0.8125rem', padding: '4px 10px', borderRadius: '8px', background: '#1c1f26', color: '#e1c256', border: '1px solid #e1c256', fontWeight: 800 }}>
                  Ref: {pendingPtEnrollment.payment_reference}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#0d0f14', padding: '14px', borderRadius: '10px', border: '1px solid #1a202c' }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Selected Coach</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff' }}>{pendingPtEnrollment.coach_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Package Plan</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff' }}>{pendingPtEnrollment.package_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Payment Route & Status</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: pendingPtEnrollment.payment_channel === 'online_xendit' ? '#658256' : '#e1c256' }}>
                    {pendingPtEnrollment.payment_channel === 'online_xendit' ? 'Xendit (PAID)' : `OTC Cash (COLLECT ₱${Number(pendingPtEnrollment.total_price).toLocaleString()})`}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Front Desk Queue Status</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f7ffc4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Awaiting Staff Clearance
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                {pendingPtEnrollment.payment_channel === 'online_xendit'
                  ? 'Your payment was confirmed via Xendit. Front desk staff will verify and clear your enrollment at the counter. Once confirmed, this chat will unlock and Coach ' + pendingPtEnrollment.coach_name + ' will receive your roster assignment.'
                  : 'Please present Reference Code (' + pendingPtEnrollment.payment_reference + ') at the Front Desk reception to pay ₱' + Number(pendingPtEnrollment.total_price).toLocaleString() + ' in cash. Once staff collects payment and clicks Clear, your 1-on-1 coaching portal and direct messaging will unlock immediately.'
                }
              </p>
            </div>
          )}

          {!assignedCoach ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Coach Directory & Enrollment Card */}
              <div className="ksyn-card" style={{ background: '#10131d', border: '1px solid #21283b', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                      Certified Branch Coaches Directory
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Choose any certified personal trainer across KSYN branches to enroll in 1-on-1 coaching, custom workout programming, and direct messaging.
                    </p>
                  </div>
                  <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                    <ShieldCheck size={12} /> Facility Verified PTs
                  </span>
                </div>

                {/* Branch Focus Bar & Coach Filter (Image 2 - Member Focus on Current/Planned Branch) */}
                <div style={{
                  marginBottom: '18px',
                  background: 'linear-gradient(135deg, rgba(225, 194, 86, 0.08) 0%, rgba(20, 24, 33, 0.6) 100%)',
                  border: '1px solid rgba(225, 194, 86, 0.25)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#e1c256',
                      color: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900
                    }}>
                      <MapPin size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#e1c256' }}>{homeBranchName}</span>
                        <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(101, 130, 86, 0.2)', border: '1px solid #658256', color: '#f7ffc4', fontWeight: 700 }}>
                          PLANNED HOME CLUB
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                        Showing verified personal trainers stationed at your planned branch. Single sessions start around ₱500 with package bundles at ₱6,000–₱7,500.
                      </p>
                    </div>
                  </div>

                  {/* Branch Scope Switcher (Home Branch Only vs All Branches) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#0a0d14',
                    border: '1px solid #232a3d',
                    padding: '4px',
                    borderRadius: '8px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setCoachBranchFilter('home')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: coachBranchFilter === 'home' ? '#e1c256' : 'transparent',
                        color: coachBranchFilter === 'home' ? '#000000' : '#9ca3af',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <MapPin size={13} /> {homeBranchName.replace(/KSYN Fitness\s*/i, '')} Coaches ({branchCoaches.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoachBranchFilter('all')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: coachBranchFilter === 'all' ? '#e1c256' : 'transparent',
                        color: coachBranchFilter === 'all' ? '#000000' : '#9ca3af',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All Branches ({availableCoaches.length})
                    </button>
                  </div>
                </div>

                {/* Available Coaches Grid Selector */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="ksyn-label" style={{ marginBottom: '10px', display: 'block', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Select Your Personal Trainer ({coachBranchFilter === 'home' ? `${homeBranchName} Staff` : 'All Branches'}):
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '14px'
                  }}>
                    {branchCoaches && branchCoaches.length > 0 ? (
                      branchCoaches.map((coach) => {
                        const isSelected = selectedCoach?.id === coach.id;
                        const initials = getCoachInitials(coach.name);
                        const cleanName = getCleanCoachName(coach.name);
                        const isWeightLoss = coach.specialties?.some(s => s.toLowerCase().includes('weight loss')) || coach.name.toLowerCase().includes('weight loss');
                        const isClinicalHealth = coach.specialties?.some(s => s.toLowerCase().includes('medical') || s.toLowerCase().includes('health')) || coach.name.toLowerCase().includes('clinical') || coach.name.toLowerCase().includes('health');
                        const isCombat = coach.specialties?.some(s => s.toLowerCase().includes('combat') || s.toLowerCase().includes('box'));
                        const isMetcon = coach.specialties?.some(s => s.toLowerCase().includes('metcon') || s.toLowerCase().includes('athletic') || s.toLowerCase().includes('conditioning'));
                        return (
                          <div
                            key={coach.id}
                            onClick={() => {
                              setSelectedCoachId(coach.id);
                              if (isWeightLoss) {
                                setPtGoal('Weight Loss & Fat Reduction');
                              } else if (isClinicalHealth) {
                                setPtGoal('Medical Exercise & Chronic Health Care');
                              } else if (isCombat) {
                                setPtGoal('Combat Boxing & Striking');
                              } else if (isMetcon) {
                                setPtGoal('Metabolic Conditioning & HIIT');
                              }
                            }}
                            style={{
                              background: isSelected ? 'rgba(225, 194, 86, 0.08)' : '#0d1017',
                              border: isSelected ? '2px solid #e1c256' : '1px solid #232a3d',
                              borderRadius: '12px',
                              padding: '16px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              transition: 'all 0.18s ease',
                              boxShadow: isSelected ? '0 0 16px rgba(225, 194, 86, 0.18)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: isSelected
                                  ? 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)'
                                  : 'linear-gradient(135deg, #1f293d 0%, #111827 100%)',
                                color: isSelected ? '#000000' : '#e1c256',
                                fontWeight: 900,
                                fontSize: '1.1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {coach.avatar_url || coach.profile_image ? (
                                  <img
                                    src={coach.avatar_url || coach.profile_image}
                                    alt={cleanName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                  fontSize: '0.9375rem',
                                  fontWeight: 800,
                                  color: '#ffffff',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {cleanName}
                                </div>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#9ca3af',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  marginTop: '2px'
                                }}>
                                  <MapPin size={11} style={{ color: '#e1c256', flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {coach.branch_name || homeBranchName}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                  {isWeightLoss ? (
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                                      Weight Loss & Fat Reduction Lead
                                    </span>
                                  ) : isClinicalHealth ? (
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                                      Medical & Health Conditions Specialist
                                    </span>
                                  ) : isCombat ? (
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(234, 88, 12, 0.15)', color: '#fb923c', border: '1px solid rgba(234, 88, 12, 0.35)' }}>
                                      Combat Boxing & Striking
                                    </span>
                                  ) : isMetcon ? (
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', border: '1px solid rgba(225, 194, 86, 0.35)' }}>
                                      Metabolic Conditioning
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256', border: '1px solid rgba(225, 194, 86, 0.25)' }}>
                                      {coach.specialties?.[0] || '1-on-1 Fitness Specialist'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <p style={{
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                              margin: 0,
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {coach.bio || `${coach.experience_years || 5}+ Years Experience • 1-on-1 Specialist`}
                            </p>

                            <div style={{
                              marginTop: 'auto',
                              paddingTop: '10px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{
                                fontSize: '0.6875rem',
                                color: isSelected ? '#e1c256' : '#64748b',
                                fontWeight: 800
                              }}>
                                {isSelected ? 'Selected Trainer' : 'Click to Select'}
                              </span>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '8px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(101, 130, 86, 0.12)',
                                border: '1px solid rgba(101, 130, 86, 0.4)',
                                color: '#658256'
                              }}>
                                Starts ₱500 / Session
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{
                        gridColumn: '1 / -1',
                        background: '#0a0d14',
                        border: '1px dashed #232a3d',
                        borderRadius: '12px',
                        padding: '36px 20px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <MapPin size={32} color="#e1c256" />
                        <div>
                          <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 800, margin: '0 0 6px 0' }}>
                            No verified personal trainers currently stationed at {homeBranchName}
                          </h4>
                          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: 0, maxWidth: '460px', lineHeight: 1.5 }}>
                            We are actively expanding coaching staff at this branch. You can browse and enroll with verified trainers across our gym network:
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCoachBranchFilter('all')}
                          className="ksyn-btn ksyn-btn-outline"
                          style={{ padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 700, color: '#e1c256', borderColor: '#e1c256' }}
                        >
                          Browse All Network Coaches ({availableCoaches.length})
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Coach Detailed Profile & Enrollment Form */}
                {selectedCoach && (
                  <div style={{
                    background: '#0a0d14',
                    border: '1px solid #232a3d',
                    borderRadius: '14px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)',
                          color: '#000',
                          fontWeight: 900,
                          fontSize: '1.35rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 16px rgba(225, 194, 86, 0.3)',
                          flexShrink: 0
                        }}>
                          {getCoachInitials(selectedCoach.name)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                              {getCleanCoachName(selectedCoach.name)}
                            </h4>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: 'rgba(101, 130, 86, 0.15)',
                              border: '1px solid #658256',
                              color: '#658256'
                            }}>
                              Accepting Athletes
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: 'rgba(225, 194, 86, 0.12)',
                              border: '1px solid rgba(225, 194, 86, 0.3)',
                              color: '#e1c256'
                            }}>
                              {selectedCoach.branch_name || 'KSYN Flagship'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0' }}>
                            {selectedCoach.bio || `${selectedCoach.role || 'Personal Trainer'} • ${selectedCoach.experience_years || 5}+ Years Experience`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Badges / Specialties */}
                    {Array.isArray(selectedCoach.specialties) && selectedCoach.specialties.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {selectedCoach.specialties.map((tag, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: '#141824',
                            border: '1px solid #232c40',
                            color: '#cbd5e1',
                            fontWeight: 600
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Package Selector */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <label className="ksyn-label" style={{ margin: 0 }}>
                          Select Personal Training Package:
                        </label>
                        <span style={{ fontSize: '0.72rem', color: '#e1c256', fontWeight: 700 }}>
                          Rates start ~₱500/session • Bundle packages lower costs to ₱469–₱500/session
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                        {/* Option 1: Single Session (₱500) */}
                        <div
                          onClick={() => setSelectedPackageId('pt-1')}
                          style={{
                            background: selectedPackageId === 'pt-1' ? 'rgba(225, 194, 86, 0.08)' : '#0d1017',
                            border: `2px solid ${selectedPackageId === 'pt-1' ? '#e1c256' : '#232a3d'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#ffffff' }}>
                              Single Session / Trial
                            </span>
                            <span className="mono" style={{ fontWeight: 900, color: '#e1c256', fontSize: '1.125rem' }}>
                              ₱500
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '6px 0 0' }}>
                            1-on-1 kinetic assessment, baseline form screening, and guided single workout (~₱500 to ₱1,100 per tier).
                          </p>
                        </div>

                        {/* Option 2: 12 Sessions (₱6,000) */}
                        <div
                          onClick={() => setSelectedPackageId('pt-12')}
                          style={{
                            background: selectedPackageId === 'pt-12' ? 'rgba(225, 194, 86, 0.08)' : '#0d1017',
                            border: `2px solid ${selectedPackageId === 'pt-12' ? '#e1c256' : '#232a3d'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#ffffff' }}>
                              12 Sessions Package
                            </span>
                            <span className="mono" style={{ fontWeight: 900, color: '#e1c256', fontSize: '1.125rem' }}>
                              ₱6,000
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '6px 0 0' }}>
                            ₱500 / session (Standard Bundle) • Custom periodized split, direct quick-chat, and weekly check-ins.
                          </p>
                        </div>

                        {/* Option 3: 16 Sessions (₱7,500) */}
                        <div
                          onClick={() => setSelectedPackageId('pt-16')}
                          style={{
                            background: selectedPackageId === 'pt-16' ? 'rgba(225, 194, 86, 0.08)' : '#0d1017',
                            border: `2px solid ${selectedPackageId === 'pt-16' ? '#658256' : '#232a3d'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#ffffff' }}>
                              16 Sessions Package
                            </span>
                            <span className="mono" style={{ fontWeight: 900, color: '#658256', fontSize: '1.125rem' }}>
                              ₱7,500
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '6px 0 0' }}>
                            ~₱470 / session (Best Value Bundle) • High-frequency transformation, progressive overload & macros.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Date & Time Slot Selector (Specifically required for Single-Day PT & Package Bookings) */}
                    <div style={{
                      background: '#0d1017',
                      border: selectedPackageId === 'pt-1' ? '1px solid #e1c256' : '1px solid #1f2533',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={18} color="#e1c256" />
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#ffffff' }}>
                            Target Session Schedule (Preferred Slot):
                          </span>
                        </div>
                        {selectedPackageId === 'pt-1' && (
                          <span style={{
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(225, 194, 86, 0.15)',
                            border: '1px solid #e1c256',
                            color: '#e1c256'
                          }}>
                            Single Session Scheduling Required
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                        <div>
                          <label className="ksyn-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                            Preferred Date:
                          </label>
                          <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            value={preferredPtDate}
                            onChange={(e) => setPreferredPtDate(e.target.value)}
                            className="ksyn-input"
                            style={{ width: '100%', height: '40px', fontSize: '0.875rem', colorScheme: 'dark' }}
                          />
                          <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                            Advance booking window: up to 14 days (2 weeks). Past dates are disabled.
                          </span>
                        </div>

                        <div>
                          <label className="ksyn-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                            Preferred Time Slot:
                          </label>
                          <select
                            value={preferredPtTimeSlot}
                            onChange={(e) => setPreferredPtTimeSlot(e.target.value)}
                            className="ksyn-select"
                            style={{ width: '100%', height: '40px', fontSize: '0.875rem' }}
                          >
                            <option value="07:00 AM – 08:00 AM">07:00 AM – 08:00 AM (Early Morning)</option>
                            <option value="08:30 AM – 09:30 AM">08:30 AM – 09:30 AM (Morning Peak)</option>
                            <option value="10:00 AM – 11:00 AM">10:00 AM – 11:00 AM (Mid-Morning)</option>
                            <option value="01:00 PM – 02:00 PM">01:00 PM – 02:00 PM (Early Afternoon)</option>
                            <option value="03:00 PM – 04:00 PM">03:00 PM – 04:00 PM (Mid Afternoon)</option>
                            <option value="05:30 PM – 06:30 PM">05:30 PM – 06:30 PM (Evening Primetime)</option>
                            <option value="07:00 PM – 08:00 PM">07:00 PM – 08:00 PM (Night Conditioning)</option>
                          </select>
                        </div>
                      </div>

                      {/* Advisory Notice */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(225, 194, 86, 0.05)',
                        border: '1px dashed rgba(225, 194, 86, 0.3)',
                        fontSize: '0.75rem',
                        color: '#cbd5e1'
                      }}>
                        <Info size={16} color="#e1c256" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>Reception & Coach Coordination:</strong> For your session booking, the Front Desk will verify and confirm this requested date/time slot directly with <strong style={{ color: '#f7ffc4' }}>{getCleanCoachName(selectedCoach?.name)}</strong> to ensure the coach is free on the floor before clearing your pass.
                        </span>
                      </div>
                    </div>

                    {/* Goal Dropdown */}
                    <div>
                      <label className="ksyn-label">Training Focus / Primary Goal:</label>
                      <select
                        value={ptGoal}
                        onChange={(e) => setPtGoal(e.target.value)}
                        className="ksyn-select"
                        style={{ maxWidth: '440px' }}
                      >
                        <option value="Weight Loss & Fat Reduction">Weight Loss & Fat Reduction (Specialized Weight Loss Lead)</option>
                        <option value="Medical Exercise & Chronic Health Care">Medical Exercise, Chronic Health Conditions & Rehab (Clinical Exercise Lead)</option>
                        <option value="Hypertrophy & Biomechanics">Hypertrophy & Muscle Building</option>
                        <option value="Combat Boxing & Striking">Combat Boxing & Striking (Coach Diego Lead)</option>
                        <option value="Metabolic Conditioning & HIIT">Metabolic Conditioning & Turf Athletics (Coach Marcus Lead)</option>
                        <option value="Posture & Kinetic Assessment">Posture, Mobility & Kinetic Chain Screening</option>
                      </select>
                    </div>

                    {/* Cross-Branch Limitation Notice & Override */}
                    {!isCoachInHomeBranch && (
                      <div style={{
                        background: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '12px',
                        padding: '14px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e1c256', fontWeight: 800, fontSize: '0.875rem' }}>
                          <MapPin size={16} />
                          <span>Cross-Branch Facility Notice</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          <strong style={{ color: '#ffffff' }}>{getCleanCoachName(selectedCoach.name)}</strong> is stationed at <strong style={{ color: '#e1c256' }}>{selectedCoach.branch_name || 'a different branch facility'}</strong>, whereas your home membership facility is <strong style={{ color: '#e1c256' }}>{homeBranchName}</strong>. By default, members are limited to booking personal trainers stationed at their home branch.
                        </p>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '4px', fontSize: '0.8125rem', color: '#ffffff', fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={allowCrossBranchBooking}
                            onChange={(e) => setAllowCrossBranchBooking(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#e1c256', cursor: 'pointer' }}
                          />
                          <span>Authorize Cross-Branch PT Sessions (I will attend sessions at {selectedCoach.branch_name || 'the coach’s branch'})</span>
                        </label>
                      </div>
                    )}

                    {/* Dynamic Enroll Button with ROTA Guard & 2-Week Window */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid #1a2030' }}>
                      {(() => {
                        const dayNamesList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const pickedDateDay = dayNamesList[new Date(preferredPtDate).getDay()];
                        const bookingCoach = selectedCoach || branchCoaches[0] || (availableCoaches || []).find(c => c.id === selectedCoachId) || availableCoaches[0];
                        const coachRotaRecord = (floorRota || []).find(r => 
                          (r.staff_id && bookingCoach && r.staff_id === bookingCoach.id) || 
                          (r.coach_name && bookingCoach?.name && (
                            r.coach_name.toLowerCase().includes(bookingCoach.name.toLowerCase()) || 
                            bookingCoach.name.toLowerCase().includes(r.coach_name.toLowerCase())
                          ))
                        );
                        const scheduledCoachShift = coachRotaRecord ? coachRotaRecord[pickedDateDay] : null;
                        const hasPublishedRota = Boolean(coachRotaRecord && scheduledCoachShift && scheduledCoachShift.trim() !== '');
                        const isCoachOffDutyOnDate = hasPublishedRota && (scheduledCoachShift.toLowerCase().includes('off') || scheduledCoachShift.toLowerCase().includes('rest'));
                        const todayIsoStr = new Date().toISOString().split('T')[0];
                        const maxBookingDateStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        const isDatePassed = preferredPtDate < todayIsoStr;
                        const isDateTooFar = preferredPtDate > maxBookingDateStr;

                        if (isDatePassed) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.8125rem', padding: '4px 0' }}>
                              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }}></span>
                              <span>Session date has already passed. Please select a current or upcoming date.</span>
                            </div>
                          );
                        }

                        if (isDateTooFar) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.8125rem', padding: '4px 0' }}>
                              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }}></span>
                              <span>Bookings are restricted to within 2 weeks (14 days) from today.</span>
                            </div>
                          );
                        }

                        if (!hasPublishedRota) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.8125rem', padding: '4px 0' }}>
                              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24', flexShrink: 0 }}></span>
                              <span>Rota Not Published: Shift schedule for {getCleanCoachName(bookingCoach?.name)} on {pickedDateDay.charAt(0).toUpperCase() + pickedDateDay.slice(1)} has not been published yet. Booking is currently unavailable.</span>
                            </div>
                          );
                        }

                        if (isCoachOffDutyOnDate) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.8125rem', padding: '4px 0' }}>
                              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }}></span>
                              <span>Coach unavailable on {pickedDateDay.charAt(0).toUpperCase() + pickedDateDay.slice(1)} ({scheduledCoachShift || 'Off-Duty'}). Please choose another date.</span>
                            </div>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#86efac', fontSize: '0.8125rem', padding: '4px 0' }}>
                            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }}></span>
                            <span>Coach available on {pickedDateDay.charAt(0).toUpperCase() + pickedDateDay.slice(1)} ({scheduledCoachShift})</span>
                          </div>
                        );
                      })()}

                      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        {(() => {
                          const dayNamesList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          const pickedDateDay = dayNamesList[new Date(preferredPtDate).getDay()];
                          const bookingCoach = selectedCoach || branchCoaches[0] || (availableCoaches || []).find(c => c.id === selectedCoachId) || availableCoaches[0];
                          const coachRotaRecord = (floorRota || []).find(r => 
                            (r.staff_id && bookingCoach && r.staff_id === bookingCoach.id) || 
                            (r.coach_name && bookingCoach?.name && (
                              r.coach_name.toLowerCase().includes(bookingCoach.name.toLowerCase()) || 
                              bookingCoach.name.toLowerCase().includes(r.coach_name.toLowerCase())
                            ))
                          );
                          const scheduledCoachShift = coachRotaRecord ? coachRotaRecord[pickedDateDay] : null;
                          const hasPublishedRota = Boolean(coachRotaRecord && scheduledCoachShift && scheduledCoachShift.trim() !== '');
                          const isCoachOffDutyOnDate = hasPublishedRota && (scheduledCoachShift.toLowerCase().includes('off') || scheduledCoachShift.toLowerCase().includes('rest'));
                          const todayIsoStr = new Date().toISOString().split('T')[0];
                          const maxBookingDateStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          const isDatePassed = preferredPtDate < todayIsoStr;
                          const isDateTooFar = preferredPtDate > maxBookingDateStr;
                          const isCrossBranchBlocked = !isCoachInHomeBranch && !allowCrossBranchBooking;
                          const isDisabled = enrollingCoach || isCrossBranchBlocked || isCoachOffDutyOnDate || !hasPublishedRota || isDatePassed || isDateTooFar;

                          return (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={handleEnrollCoach}
                              className={`ksyn-btn ${isDisabled ? '' : 'ksyn-btn-gold'}`}
                              style={{
                                padding: '12px 28px',
                                fontSize: '0.9375rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: isDisabled ? '#1a1f2b' : undefined,
                                color: isDisabled ? '#64748b' : undefined,
                                border: isDisabled ? '1px solid #2d3748' : undefined,
                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <UserCheck size={18} /> {
                                enrollingCoach 
                                  ? 'Confirming Enrollment...' 
                                  : isDatePassed
                                    ? 'Date Has Passed'
                                    : isDateTooFar
                                      ? 'Date Exceeds 2-Week Window'
                                      : !hasPublishedRota
                                        ? 'Rota Not Published (Unavailable)'
                                        : isCoachOffDutyOnDate
                                          ? `Unavailable on ROTA (${pickedDateDay.toUpperCase()} Off-Duty)`
                                          : isCrossBranchBlocked
                                            ? 'Home Branch Only (Authorize Cross-Branch Above)'
                                            : (!isCoachInHomeBranch)
                                              ? `Enroll in Cross-Branch PT with ${getCleanCoachName(selectedCoach.name)}`
                                              : `Enroll in 1-on-1 PT with ${getCleanCoachName(selectedCoach.name)}`
                              }
                            </button>
                          );
                        })()}
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Enrolling links your profile with {getCleanCoachName(selectedCoach.name)}, unlocks direct quick-chat, and generates your customized workout split.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Coach Contact Header */}
              <div style={{
                background: 'linear-gradient(135deg, #141722 0%, #0d0f17 100%)',
                border: '1px solid #262626',
                borderRadius: '16px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)',
                    color: '#000000',
                    fontWeight: 900,
                    fontSize: '1.125rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(225, 194, 86, 0.3)'
                  }}>
                    {assignedCoach.avatar_url || assignedCoach.profile_image ? (
                      <img
                        src={assignedCoach.avatar_url || assignedCoach.profile_image}
                        alt={assignedCoach.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (assignedCoach.name || 'Coach').split(' ').map(n => n[0]).join('').slice(0, 2)
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {assignedCoach.name}
                      </h2>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        background: 'rgba(101, 130, 86, 0.15)',
                        border: '1px solid #658256',
                        color: '#658256'
                      }}>
                        Assigned Trainer
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{assignedCoach.role || 'Personal Trainer'}</span>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#658256', fontWeight: 700 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 8px #658256' }} />
                  <span>Direct Link Active</span>
                </div>
              </div>

              {/* Quick Reply Suggestions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Athlete Updates:</span>
                {[
                  { text: 'Ready for today\'s session!', tag: 'Athlete Check-In', icon: Flame },
                  { text: 'Hit 180g protein & 3L water today!', tag: 'Nutrition / Macros', icon: Utensils },
                  { text: '8 hours sleep, fully recovered.', tag: 'Recovery Update', icon: Moon },
                  { text: 'Hamstrings tight, need extra warmup.', tag: 'Form Question', icon: AlertTriangle }
                ].map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  const messageText = `${chip.tag}: ${chip.text}`;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMemberMessage(null, messageText)}
                      style={{
                        background: '#141824',
                        border: '1px solid #283046',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ChipIcon size={12} className="text-[#e1c256]" />
                      <span>{chip.tag}: {chip.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Real-World Dark Mode Chat Thread */}
              <div
                ref={memberChatContainerRef}
                onScroll={handleMemberChatScroll}
                style={{
                  background: '#080b11',
                  border: '1px solid #1a2233',
                  borderRadius: '16px',
                  padding: '20px',
                  minHeight: '420px',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.5)'
                }}
              >
                {coachMessages && coachMessages.length > 0 ? (
                  coachMessages.map((msg) => {
                    const isFromCoach = msg.sender_role === 'coach';
                    const coachAvatarSrc = assignedCoach?.avatar_url || assignedCoach?.profile_image || msg.sender_avatar;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: isFromCoach ? 'flex-start' : 'flex-end',
                          gap: '10px',
                          width: '100%'
                        }}
                      >
                        {isFromCoach && (
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'linear-gradient(135deg, #e1c256 0%, #b45309 100%)',
                            color: '#000000',
                            fontWeight: 900,
                            fontSize: '0.8125rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 0 10px rgba(225, 194, 86, 0.25)',
                            border: '1.5px solid #e1c256',
                            marginTop: '2px'
                          }}>
                            {coachAvatarSrc ? (
                              <img
                                src={coachAvatarSrc}
                                alt={assignedCoach?.name || 'Coach'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (assignedCoach?.name || 'Coach').split(' ').map(n => n[0]).join('').slice(0, 2)
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isFromCoach ? 'flex-start' : 'flex-end',
                            gap: '4px',
                            maxWidth: '75%'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.6875rem',
                            color: '#64748b'
                          }}>
                            <span style={{ fontWeight: 800, color: isFromCoach ? '#e1c256' : '#60a5fa' }}>
                              {isFromCoach ? msg.sender_name : 'You (Athlete)'}
                            </span>
                            <span>•</span>
                            <span style={{ color: '#94a3b8' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.tag && (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: isFromCoach ? 'rgba(225, 194, 86, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                border: `1px solid ${isFromCoach ? 'rgba(225, 194, 86, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                                color: isFromCoach ? '#e1c256' : '#93c5fd',
                                fontSize: '0.625rem',
                                fontWeight: 700
                              }}>
                                {msg.tag}
                              </span>
                            )}
                          </div>

                          <div style={{
                            width: '100%',
                            background: isFromCoach ? 'linear-gradient(135deg, #221c0c 0%, #171408 100%)' : '#151c28',
                            border: `1px solid ${isFromCoach ? 'rgba(225, 194, 86, 0.35)' : '#25324a'}`,
                            borderRadius: isFromCoach ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                            padding: '12px 16px',
                            color: isFromCoach ? '#fef08a' : '#f1f5f9',
                            fontSize: '0.875rem',
                            lineHeight: 1.5,
                            boxShadow: isFromCoach ? '0 2px 8px rgba(225, 194, 86, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.3)'
                          }}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b', margin: 'auto' }}>
                    <MessageSquare size={36} color="#475569" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontWeight: 500, color: '#94a3b8' }}>No messages yet. Send a note to {assignedCoach?.name || 'your coach'} to begin!</p>
                  </div>
                )}

                {isCoachTyping && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#e1c256',
                    fontSize: '0.8125rem',
                    fontStyle: 'italic',
                    padding: '8px 14px',
                    background: 'rgba(225, 194, 86, 0.08)',
                    border: '1px solid rgba(225, 194, 86, 0.25)',
                    borderRadius: '12px',
                    width: 'fit-content',
                    marginTop: '4px'
                  }}>
                    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e1c256' }} />
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e1c256' }} />
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e1c256' }} />
                    </span>
                    <span>{assignedCoach?.name || 'Coach'} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer Input */}
              <form
                onSubmit={(e) => handleSendMemberMessage(e)}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  background: '#12151e',
                  border: '1px solid #262626',
                  borderRadius: '14px',
                  padding: '8px 12px'
                }}
              >
                <select
                  value={chatTag}
                  onChange={(e) => setChatTag(e.target.value)}
                  style={{
                    background: '#0d1017',
                    border: '1px solid #262626',
                    color: '#e1c256',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Athlete Check-In">Check-In</option>
                  <option value="Nutrition / Macros">Macros</option>
                  <option value="Recovery Update">Recovery</option>
                  <option value="Form Question">Form Question</option>
                </select>

                <input
                  type="text"
                  placeholder={`Message ${assignedCoach?.name || 'Coach'}...`}
                  value={chatInput}
                  onChange={handleMemberTypingChange}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    padding: '8px 4px'
                  }}
                />

                <button
                  type="submit"
                  disabled={sendingMsg || !chatInput.trim()}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 800,
                    opacity: sendingMsg || !chatInput.trim() ? 0.5 : 1
                  }}
                >
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LOG NEW WEIGHT */}
      {/* ========================================================================= */}
      {showLogWeightModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid rgba(225, 194, 86, 0.4)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#e1c256', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scale size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Log New Weight</h3>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Record your latest weigh-in and milestone notes</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogWeightModal(false)}
                className="modal-close-circle-btn"
                title="Close modal (Esc)"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogWeight} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {weightModalError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ef4444',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>{weightModalError}</span>
                </div>
              )}

              <div>
                <label className="ksyn-label">
                  Weigh-In Date *
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  required
                  value={weightModalDate}
                  onChange={(e) => {
                    setWeightModalDate(e.target.value);
                    setWeightModalError(null);
                  }}
                  className="ksyn-input"
                  style={{ fontSize: '1rem', fontWeight: 600 }}
                />
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                  Biometric weigh-ins cannot be logged for future dates.
                </span>
              </div>

              <div>
                <label className="ksyn-label">
                  Current Weight (kg) * (Range: 30.0 - 250.0 kg)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    required
                    placeholder="e.g. 74.5"
                    value={newWeightInput}
                    onChange={(e) => {
                      setNewWeightInput(e.target.value);
                      setWeightModalError(null);
                    }}
                    className="ksyn-input"
                    style={{ fontSize: '1.125rem', fontWeight: 700, paddingRight: '48px' }}
                    autoFocus
                  />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 700, fontSize: '0.875rem' }}>
                    kg
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '6px', display: 'block' }}>
                  Current active record: <strong style={{ color: '#e1c256' }}>{baselineMetrics?.current_weight ? `${parseFloat(baselineMetrics.current_weight).toFixed(1)} kg` : 'None logged yet (-- kg)'}</strong>
                </span>
              </div>

              <div>
                <label className="ksyn-label">
                  Goal / Target Weight (kg) (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    placeholder={baselineMetrics?.target_weight ? `Current target: ${parseFloat(baselineMetrics.target_weight).toFixed(1)} kg` : "e.g. 70.0"}
                    value={targetWeightInput}
                    onChange={(e) => setTargetWeightInput(e.target.value)}
                    className="ksyn-input"
                    style={{ fontSize: '1.125rem', fontWeight: 700, paddingRight: '48px' }}
                  />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 700, fontSize: '0.875rem' }}>
                    kg
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '6px', display: 'block' }}>
                  Target synchronizes with your coach's dashboard and athlete progress tracking.
                </span>
              </div>

              <div>
                <label className="ksyn-label">
                  Workout / Milestone Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Hit PR on deadlift today! Completed 45 mins HIIT session."
                  value={weightNotesInput}
                  onChange={(e) => setWeightNotesInput(e.target.value)}
                  className="ksyn-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '12px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#e1c256', fontWeight: 700 }}><Lightbulb size={13} /> Tip:</span> Logging consistent weigh-ins under similar conditions (e.g. mornings before breakfast) produces the most accurate progress logs.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowLogWeightModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '10px 18px', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingWeight}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '10px 22px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {loggingWeight ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} /> Save Weigh-In
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SET / UPDATE GOAL TARGET WEIGHT                                    */}
      {/* ========================================================================= */}
      {showTargetWeightModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="ksyn-card" style={{
            background: '#121212',
            border: '1px solid #e1c256',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Target Goal Weight</h3>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Set your desired athlete weight target</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetWeightModal(false)}
                className="modal-close-circle-btn"
                title="Close modal (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTargetWeight} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {targetWeightModalError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ef4444',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={15} />
                  <span>{targetWeightModalError}</span>
                </div>
              )}

              <div>
                <label className="ksyn-label">
                  Target Weight (kg) * (Range: 30.0 - 250.0 kg)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    required
                    placeholder="e.g. 70.0"
                    value={targetWeightInput}
                    onChange={(e) => {
                      setTargetWeightInput(e.target.value);
                      setTargetWeightModalError(null);
                    }}
                    className="ksyn-input"
                    style={{ fontSize: '1.125rem', fontWeight: 700, paddingRight: '48px' }}
                    autoFocus
                  />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 700, fontSize: '0.875rem' }}>
                    kg
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '6px', display: 'block' }}>
                  This target synchronizes directly with your coach's athlete roster and your progress delta telemetry.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTargetWeightModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTargetWeight}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {savingTargetWeight ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Target Weight
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BRANCH RELOCATION & MULTI-TENANT PLAN TRANSFER                     */}
      {/* ========================================================================= */}
      {showBranchTransferModal && (
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
            if (e.target === e.currentTarget && !transferLoading) setShowBranchTransferModal(false);
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
                  Transfer Home Branch Facility
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Relocate your active membership and turnstile privileges to another gym branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchTransferModal(false)}
                disabled={transferLoading}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Branch Box */}
            <div style={{
              background: '#161922',
              border: '1px solid #282f3d',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Current Home Facility
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                  {safeUser.branch_name || 'KSYN Fitness Makati (MKT-01)'}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#e1c256', color: '#000', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                ACTIVE
              </span>
            </div>

            <form onSubmit={handleExecuteBranchTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Select Destination Branch *
                </label>
                <select
                  value={targetTransferBranchId}
                  onChange={(e) => setTargetTransferBranchId(e.target.value)}
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
                  <option value="b-mkt-01">KSYN Fitness Makati Flagship (MKT-01)</option>
                  <option value="b-kat-02">KSYN Fitness Katipunan (KAT-02)</option>
                  <option value="b-alb-03">KSYN Fitness Alabang (ALB-03)</option>
                  <option value="b-kap-04">KSYN Fitness Kapitolyo (KAP-04)</option>
                  <option value="b-frv-05">KSYN Fitness Fairview (FRV-05)</option>
                  <option value="b-del-06">KSYN Fitness Del Monte (DLM-06)</option>
                  <option value="b-tm-07">KSYN Fitness Tomas Morato (TMO-07)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Reason for Transfer (Optional)
                </label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid #282f3d',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="Relocation / Closer to Home">Relocation / Closer to Home</option>
                  <option value="Work / Office Location Change">Work / Office Location Change</option>
                  <option value="Preferred Studio Amenities">Preferred Studio Amenities</option>
                  <option value="Training with specific Coach">Training with specific Coach</option>
                </select>
              </div>

              {/* Data Isolation & Privacy Guarantee Callout */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.75rem',
                color: '#93c5fd',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#60a5fa' }}>
                  <ShieldCheck size={16} /> Multi-Tenant Data Isolation Guarantee
                </div>
                <span>
                  Your personal workout history, weigh-in biometric logs, and health metrics remain 100% private to your account. Neither other branch members nor unassigned staff will ever be able to snoop into your private data.
                </span>
              </div>

              {/* Notification Dispatch Notice */}
              <div style={{
                background: 'rgba(225, 194, 86, 0.08)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldCheck size={14} color="#e1c256" className="shrink-0" />
                <span>
                  Admin Verification: Your transfer request will be sent to the destination Branch Admin for capacity confirmation before activating your digital turnstile pass.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBranchTransferModal(false)}
                  disabled={transferLoading}
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
                  disabled={transferLoading}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: transferLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  {transferLoading ? 'Submitting Transfer...' : 'Submit Transfer Request for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5-STEP DIGITAL ONBOARDING & PAYMENT PAYWALL MODAL */}
      {showOnboardingPaywall && (
        <MemberOnboardingWizard
          isOpen={showOnboardingPaywall}
          onClose={() => setShowOnboardingPaywall(false)}
          existingUser={safeUser}
          initialPlanTier={selectedRenewalPlan || '1_month'}
          initialPromoCode={activePromoCode || ''}
          onComplete={async (data) => {
            setShowOnboardingPaywall(false);
            if (data?.subscription) {
              setSubscription(data.subscription);
            }
            if (refreshUser) {
              await refreshUser();
            }
            await loadMemberData();
            if (typeof generatePass === 'function') {
              try { await generatePass(false); } catch (e) {}
            }
            if (data?.planTier || safeUser?.membership_plan) {
              const pInfo = getPlanDetails(data?.planTier || safeUser?.membership_plan);
              broadcastMemberUpgrade({
                memberId: safeUser.id,
                memberName: safeUser.name,
                planId: pInfo.id,
                planName: pInfo.name,
                tier: pInfo.tier,
                branchId: safeUser.branch_id
              });
            }
          }}
        />
      )}

      {/* Front-Desk Scanner Verification Dialog */}
      {testScanResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101216] border border-[#262626] rounded-xl max-w-md w-full p-6 relative text-gray-200 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setTestScanResult(null)}
              className="modal-close-circle-btn absolute top-4 right-4 text-gray-400 hover:text-white"
              title="Close notification"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-2">
              <div className={`w-14 h-14 ${testScanResult.valid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} rounded-full flex items-center justify-center mx-auto border`}>
                {testScanResult.valid ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight uppercase">
                {testScanResult.valid ? 'Front Desk Access Granted' : 'Turnstile Access Denied'}
              </h3>
              <p className="text-xs text-gray-400">
                {testScanResult.message || (testScanResult.valid ? 'Turnstile solenoid relay pulsed successfully.' : 'Pass validation failed.')}
              </p>
            </div>

            <div className="bg-[#141414] border border-[#222] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Athlete Name:</span>
                <strong className="text-white">{testScanResult.member?.name || safeUser.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Credential Type:</span>
                <span className="text-[#f7ffc4] font-bold">Dynamic QR Pass (TTL 60s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Branch Authorization:</span>
                <strong className="text-white">{testScanResult.member?.homeBranch || safeUser.branch_name} (Authorized)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Subscription Status:</span>
                <span className="text-emerald-400 font-extrabold uppercase">
                  {testScanResult.member?.subStatus || 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hardware Turnstile:</span>
                <span className="text-[#e1c256] font-bold">
                  {testScanResult.valid ? 'Unlocked (Solenoid Relay Pulsed)' : 'Locked'}
                </span>
              </div>
              {testScanResult.reason && (
                <div className="flex justify-between text-red-400 border-t border-[#222] pt-2">
                  <span>Security Alert:</span>
                  <strong>{testScanResult.reason}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setTestScanResult(null)}
              className="w-full py-3 px-6 bg-[#e1c256] hover:bg-[#cbaa42] text-black font-extrabold text-xs tracking-wider uppercase rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(225, 194, 86,0.25)] cursor-pointer"
            >
              Close & Return
            </button>
          </div>
        </div>
      )}

      {/* Link Auto-Debit Payment Method Modal */}
      {showLinkMethodModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#12151e',
            border: '1px solid #282f3f',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                <CreditCard size={20} color="#e1c256" />
                Link Recurring Auto-Debit Rail
              </div>
              <button
                type="button"
                onClick={() => setShowLinkMethodModal(false)}
                className="modal-close-circle-btn"
                title="Close modal (Esc)"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '18px' }}>
              Enabling Recurring Auto-Debit requires a tokenized Philippine payment rail on file. Choose your preferred rail to establish an automated billing agreement via Xendit:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={async () => {
                  const newMethod = {
                    id: 'pm_' + Date.now(),
                    type: 'credit_card',
                    brand_or_provider: 'Visa',
                    masked_identifier: '•••• 4242',
                    gateway_token: 'tok_card_visa_' + Date.now(),
                    is_default: true
                  };
                  setPaymentMethods([newMethod]);
                  setShowLinkMethodModal(false);
                  setAutoDebitEnabled(true);
                  setUser(prev => ({ ...prev, auto_renew: true }));
                  setSubscription(prev => prev ? ({ ...prev, auto_renew: true }) : null);
                  try {
                    await authFetch('/api/members/subscription/toggle-auto-renew', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ autoRenew: true })
                    });
                  } catch (e) {}
                  toast.success('Visa Card linked & Zero-PAN tokenized! Recurring Auto-Debit activated.', 'Payment Rail Linked');
                }}
                className="ksyn-btn ksyn-btn-outline"
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={18} color="#f7ffc4" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Visa / Mastercard</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Zero-PAN Tokenization (3D-Secure Authenticated)</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 700 }}>Link Card →</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const newMethod = {
                    id: 'pm_' + Date.now(),
                    type: 'ewallet',
                    brand_or_provider: 'GCash',
                    masked_identifier: '•••• 9882',
                    gateway_token: 'agr_gcash_' + Date.now(),
                    is_default: true
                  };
                  setPaymentMethods([newMethod]);
                  setShowLinkMethodModal(false);
                  setAutoDebitEnabled(true);
                  setUser(prev => ({ ...prev, auto_renew: true }));
                  setSubscription(prev => prev ? ({ ...prev, auto_renew: true }) : null);
                  try {
                    await authFetch('/api/members/subscription/toggle-auto-renew', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ autoRenew: true })
                    });
                  } catch (e) {}
                  toast.success('GCash Recurring Auto-Debit agreement linked via Xendit!', 'E-Wallet Agreement');
                }}
                className="ksyn-btn ksyn-btn-outline"
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', borderColor: 'rgba(0,125,254,0.4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={18} color="#007dfe" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>GCash Auto-Debit</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>BSP Direct Debit Recurring Agreement</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#f7ffc4', fontWeight: 700 }}>Link GCash →</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const newMethod = {
                    id: 'pm_' + Date.now(),
                    type: 'ewallet',
                    brand_or_provider: 'Maya',
                    masked_identifier: '•••• 7711',
                    gateway_token: 'agr_maya_' + Date.now(),
                    is_default: true
                  };
                  setPaymentMethods([newMethod]);
                  setShowLinkMethodModal(false);
                  setAutoDebitEnabled(true);
                  setUser(prev => ({ ...prev, auto_renew: true }));
                  setSubscription(prev => prev ? ({ ...prev, auto_renew: true }) : null);
                  try {
                    await authFetch('/api/members/subscription/toggle-auto-renew', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ autoRenew: true })
                    });
                  } catch (e) {}
                  toast.success('Maya Recurring Auto-Debit agreement linked via Xendit!', 'E-Wallet Agreement');
                }}
                className="ksyn-btn ksyn-btn-outline"
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', borderColor: 'rgba(101, 130, 86,0.4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={18} color="#658256" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Maya Auto-Debit</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Pre-approved Monthly Pull Agreement</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#658256', fontWeight: 700 }}>Link Maya →</span>
              </button>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowLinkMethodModal(false)}
                className="ksyn-btn ksyn-btn-outline"
                style={{ padding: '6px 16px', fontSize: '0.75rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PT ENROLLMENT PAYMENT CHANNEL ROUTING MODAL */}
      {showPtPaymentModal && (() => {
        const targetCoach = selectedCoach || branchCoaches[0] || (availableCoaches || []).find(c => c.id === selectedCoachId) || availableCoaches[0] || { name: 'Personal Trainer', specialty: 'Strength & Biomechanics' };
        const selectedPkg = PT_PACKAGES.find(p => p.id === selectedPackageId) || PT_PACKAGES[1];

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div className="ksyn-card" style={{
              background: '#121212',
              border: '1px solid #e1c256',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 0 32px rgba(225, 194, 86, 0.2)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    STEP 2: PAYMENT CHANNEL ROUTING
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 0' }}>
                    PT Package Checkout & Front Desk Clearance
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPtPaymentModal(false)}
                  className="modal-close-circle-btn"
                  title="Close modal (Esc)"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    width: '36px',
                    height: '36px',
                    minWidth: '36px',
                    minHeight: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Package Summary Box */}
              <div style={{
                background: '#0d0f14',
                border: '1px solid #1f2533',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Selected Coach</span>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#f7ffc4' }}>
                      {formatCoachName(targetCoach.name)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#e1c256', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={11} />
                      <span>{targetCoach.branch_name || homeBranchName}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Total Amount</span>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256' }}>
                      ₱{selectedPkg.total_price.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1a202c', paddingTop: '8px', fontSize: '0.75rem', color: '#9ca3af', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Package: <strong style={{ color: '#fff' }}>{selectedPkg.name}</strong> ({selectedPkg.sessions} Sessions)</span>
                  <span>Requested Slot: <strong style={{ color: '#e1c256' }}>{preferredPtDate} • {preferredPtTimeSlot}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Goal: <strong style={{ color: '#fff' }}>{ptGoal}</strong></span>
                  <span style={{ fontSize: '0.6875rem', color: '#f59e0b', fontWeight: 700 }}>
                    Floor Slot Pending Staff & Coach Confirmation
                  </span>
                </div>
                {selectedPkg.sessions === 1 && (
                  <div style={{ fontSize: '0.72rem', color: '#f7ffc4', background: 'rgba(225, 194, 86, 0.08)', border: '1px solid rgba(225, 194, 86, 0.25)', borderRadius: '6px', padding: '6px 10px', marginTop: '2px' }}>
                    <strong>Single-Day Trial Session:</strong> The Front Desk verifies {formatCoachName(targetCoach.name)} floor availability on <strong>{preferredPtDate} ({preferredPtTimeSlot})</strong> before clearing turnstile access.
                  </div>
                )}
              </div>

              {/* Payment Channel Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="ksyn-label" style={{ marginBottom: '2px' }}>Choose Payment Method:</label>

                {/* Option A: Online via Xendit */}
                <div
                  onClick={() => setSelectedPaymentChannel('online_xendit')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: selectedPaymentChannel === 'online_xendit' ? '2px solid #658256' : '1px solid #222',
                    background: selectedPaymentChannel === 'online_xendit' ? 'rgba(101, 130, 86, 0.12)' : '#161922',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Smartphone size={20} color={selectedPaymentChannel === 'online_xendit' ? '#658256' : '#9ca3af'} />
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                          Option A: Online via Xendit
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                          GCash • Maya • Credit / Debit Card • Dynamic QR Ph
                        </span>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      background: selectedPaymentChannel === 'online_xendit' ? '#658256' : '#222',
                      color: '#ffffff'
                    }}>
                      Instant Digital
                    </span>
                  </div>
                </div>

                {/* Option B: Over-the-Counter Cash */}
                <div
                  onClick={() => setSelectedPaymentChannel('counter_cash')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: selectedPaymentChannel === 'counter_cash' ? '2px solid #e1c256' : '1px solid #222',
                    background: selectedPaymentChannel === 'counter_cash' ? 'rgba(225, 194, 86, 0.12)' : '#161922',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Receipt size={20} color={selectedPaymentChannel === 'counter_cash' ? '#e1c256' : '#9ca3af'} />
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                          Option B: Over-the-Counter (OTC) Cash at Front Desk
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                          Pay physical cash at reception counter (₱{selectedPkg.total_price.toLocaleString()})
                        </span>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      background: selectedPaymentChannel === 'counter_cash' ? '#e1c256' : '#222',
                      color: selectedPaymentChannel === 'counter_cash' ? '#000000' : '#ffffff'
                    }}>
                      Cash at Reception
                    </span>
                  </div>
                  <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: '4px 0 0' }}>
                    Generates an OTC voucher reference. Front desk staff collects cash and activates your coach assignment.
                  </p>
                </div>
              </div>

              {/* Informative Step Note */}
              <div style={{ background: '#0d0f14', border: '1px dashed #222', borderRadius: '10px', padding: '12px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                <strong style={{ color: '#f7ffc4' }}>Front Desk Verification Policy:</strong> Inbound enrollments route directly to the <strong style={{ color: '#e1c256' }}>{targetCoach.branch_name || homeBranchName}</strong> Front Desk POS dashboard. Once cleared by reception staff, <strong style={{ color: '#f7ffc4' }}>{formatCoachName(targetCoach.name)}</strong> will be assigned, direct quick-chat unlocked, and periodized training splits generated.
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #1a202c' }}>
                <button
                  type="button"
                  onClick={() => setShowPtPaymentModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '10px 18px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={enrollingCoach}
                  onClick={handleInitiatePtEnrollment}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '10px 24px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={16} />
                  {enrollingCoach ? 'Submitting to Queue...' : selectedPaymentChannel === 'online_xendit' ? `Pay ₱${selectedPkg.total_price.toLocaleString()} via Xendit` : `Submit OTC Cash Order (₱${selectedPkg.total_price.toLocaleString()})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Export default with safety boundary wrapper
export default function MemberPortal(props) {
  return (
    <PortalErrorBoundary>
      <MemberPortalContent {...props} />
    </PortalErrorBoundary>
  );
}
