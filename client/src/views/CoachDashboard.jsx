import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToClassBookings } from '../utils/portalSync';
import {
  Dumbbell,
  Users,
  CalendarCheck,
  Flame,
  DollarSign,
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Award,
  ChevronRight,
  Activity,
  UserCheck,
  Edit2,
  Calendar,
  X,
  Check,
  Sliders,
  Scale,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Target,
  BookOpen,
  Layers,
  QrCode,
  ShieldCheck,
  Printer,
  FileText,
  FileSpreadsheet,
  Apple,
  Utensils,
  AlertTriangle,
  Star,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Wrench,
  Camera,
  User,
  Download
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import Bir2307Modal from '../components/Bir2307Modal';
import { formatUserDisplayName } from '../utils/userDisplay';
import { generateCoachPayslipPdf } from '../utils/pdfGenerators';

export const formatPtPackageWithPrice = (rawPlan, client) => {
  if (!rawPlan) return '12-Session Signature PT Package (₱6,000)';
  const planStr = String(rawPlan).trim();
  if (planStr.includes('₱') || planStr.includes('PHP')) return planStr;
  
  let price = client?.total_price || client?.price || (client?.session_rate && client?.sessions_total ? client.session_rate * client.sessions_total : null);
  if (!price) {
    if (planStr.includes('16')) price = 7500;
    else if (planStr.includes('10')) price = 5000;
    else if (planStr.includes('Single') || planStr.includes('1-Session')) price = 500;
    else price = 6000;
  }
  return `${planStr} (₱${Number(price).toLocaleString()})`;
};

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

export default function CoachDashboard({
  activeSection: propSection,
  setActiveSection: propSetSection,
  activeTab = 'overview',
  onTabChange
}) {
  const { user, authFetch } = useAuth();
  const { toast } = useToast();

  const normalizeSection = (val) => {
    if (!val) return 'overview';
    const clean = String(val).replace('coach_', '');
    if (clean === 'clients' || clean === 'athletes' || clean === 'roster' || clean === 'programs' || clean === 'routines' || clean === 'plans' || clean === 'workouts') return 'clients';
    if (clean === 'chat' || clean === 'messages' || clean === 'quick_chat') return 'chat';
    if (clean === 'sessions' || clean === 'logs' || clean === 'training' || clean === 'commissions' || clean === 'earnings' || clean === 'payout') return 'commissions';
    if (clean === 'classes' || clean === 'schedule' || clean === 'group') return 'classes';
    if (clean === 'profile_credentials' || clean === 'profile' || clean === 'credentials' || clean === 'bio') return 'profile_credentials';
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState(() => normalizeSection(propSection || activeTab));
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [commissions, setCommissions] = useState(null);
  const [classes, setClasses] = useState([]);
  const [floorRota, setFloorRota] = useState([]);
  const [classFilter, setClassFilter] = useState('all'); // 'all', 'today', 'upcoming'
  const isMakatiBranch = user?.branch_id === 'b-mkt-01' ||
    String(user?.branch_code || '').toUpperCase().includes('MKT') ||
    String(user?.branch_name || '').toLowerCase().includes('makati');
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    client_id: '',
    title: 'Elite Hypertrophy & Strength Split',
    split_type: 'Push / Pull / Legs (PPL)',
    days_per_week: 4,
    notes: 'Focus on progressive overload and strict 2-second negative eccentric tempo.',
    exercises: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6-8', target_weight: '140 kg', rest_seconds: 180, notes: 'Explosive ascent' },
      { name: 'Romanian Deadlift (RDL)', sets: 3, reps: '8-10', target_weight: '120 kg', rest_seconds: 120, notes: 'Feel hamstring stretch' },
      { name: 'Barbell Bench Press', sets: 4, reps: '6-8', target_weight: '100 kg', rest_seconds: 150, notes: 'Touch lower chest' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', target_weight: '32 kg/side', rest_seconds: 90, notes: 'Controlled tempo' }
    ]
  });
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refresh Classification State
  const [refreshedCoachFeedback, setRefreshedCoachFeedback] = useState(false);
  const [refreshedAthletesFeedback, setRefreshedAthletesFeedback] = useState(false);
  const [refreshedCommissionsFeedback, setRefreshedCommissionsFeedback] = useState(false);

  // Commission & Session History Filters (FILO & Timeframe Scoping)
  const [salesCommissionFilter, setSalesCommissionFilter] = useState('this_month'); // 'this_month' | 'all'
  const [salesCommissionSearch, setSalesCommissionSearch] = useState('');
  const [sessionHistorySearch, setSessionHistorySearch] = useState('');
  const [sessionHistoryTimeframe, setSessionHistoryTimeframe] = useState('this_month'); // 'this_month' | 'all'
  const [sessionMonthFilter, setSessionMonthFilter] = useState('current'); // 'current' | 'all'

  // All-Time Overall Earnings Modal State
  const [showAllTimeEarningsModal, setShowAllTimeEarningsModal] = useState(false);
  const [earningsModalSearch, setEarningsModalSearch] = useState('');
  const [earningsModalYear, setEarningsModalYear] = useState('all');
  const [earningsModalMonth, setEarningsModalMonth] = useState('all');
  const [earningsModalSort, setEarningsModalSort] = useState('newest'); // 'newest' | 'oldest'

  // Studio Class Scheduling Modal state
  const [showScheduleClassModal, setShowScheduleClassModal] = useState(false);
  const [scheduleClassLoading, setScheduleClassLoading] = useState(false);
  const [classForm, setClassForm] = useState({
    name: 'Sunrise Vinyasa Flow & Mobility',
    category: 'Yoga & Recovery',
    date: new Date().toISOString().split('T')[0],
    time: '07:00 AM – 08:00 AM',
    room: 'Studio A (Recovery Lounge)',
    capacity: 20,
    intensity: 'All Levels',
    description: '',
    branch_id: user?.branch_id || 'b-mkt-01'
  });

  // Modals & form state
  const [showLogSessionModal, setShowLogSessionModal] = useState(false);
  const [showLogMaintenanceModal, setShowLogMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    category: 'Equipment Maintenance',
    severity: 'Medium',
    details: ''
  });
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);

  const handleSubmitMaintenance = async (e) => {
    e?.preventDefault?.();
    if (!maintenanceForm.title.trim()) {
      toast.warning('Please enter an issue description or equipment name.');
      return;
    }
    setSubmittingMaintenance(true);
    try {
      const res = await authFetch('/api/branch-admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Maintenance ticket recorded: ${maintenanceForm.title}`, 'Ticket Recorded');
        setShowLogMaintenanceModal(false);
        setMaintenanceForm({
          title: '',
          category: 'Equipment Maintenance',
          severity: 'Medium',
          details: ''
        });
      } else {
        toast.error(data.message || 'Failed to submit maintenance ticket.');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingMaintenance(false);
    }
  };
  const [showMetricsModal, setShowMetricsModal] = useState(null); // selected client
  const [sessionForm, setSessionForm] = useState({
    client_id: '',
    duration_mins: 60,
    focus: 'Barbell Squats & Posterior Chain',
    rpe_intensity: 8,
    notes: '',
    athlete_pin: '',
    exercise_list: [
      { name: 'Barbell Back Squat', sets: 4, reps: 8, weight_kg: 90 },
      { name: 'Romanian Deadlift (RDL)', sets: 3, reps: 10, weight_kg: 80 }
    ]
  });
  const [metricsForm, setMetricsForm] = useState({
    current_weight_kg: 75,
    target_weight_kg: 80,
    body_fat_percentage: 16,
    goal: 'Hypertrophy & Core Stability',
    notes: ''
  });
  const [submittingSession, setSubmittingSession] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');

  // Sprint 4: In-Studio Class QR & Pass Scanner
  const [showClassScannerModal, setShowClassScannerModal] = useState(null);
  const [classScanPassToken, setClassScanPassToken] = useState('');
  const [scanningClassPass, setScanningClassPass] = useState(false);
  const [classScanSuccessInfo, setClassScanSuccessInfo] = useState(null);

  // Sprint 4: 1RM Progressive Overload Tracker (Epley Formula)
  const [showStrengthModal, setShowStrengthModal] = useState(null);
  const [strengthData, setStrengthData] = useState(null);
  const [strengthForm, setStrengthForm] = useState({
    exercise_name: 'Barbell Back Squat',
    weight_kg: 100,
    reps: 5,
    rpe: 8,
    notes: ''
  });
  const [submittingStrength, setSubmittingStrength] = useState(false);

  // Sprint 4: Nutrition & Macro Prescription
  const [showNutritionModal, setShowNutritionModal] = useState(null);
  const [nutritionForm, setNutritionForm] = useState({
    target_calories: 2500,
    protein_g: 170,
    carbs_g: 270,
    fat_g: 65,
    hydration_liters: 3.5,
    meal_frequency: 4,
    dietary_notes: 'High-protein pre-workout refeed with complex carbohydrates.'
  });
  const [submittingNutrition, setSubmittingNutrition] = useState(false);

  // Sprint 4: Itemized Commission Slips & BIR 2307 Withholding Tax
  const [commissionSlip, setCommissionSlip] = useState(null);
  const [loadingCommissionSlip, setLoadingCommissionSlip] = useState(false);
  const [showBir2307Modal, setShowBir2307Modal] = useState(false);

  // Sprint 2: Coach Athlete Quick-Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedChatClientId, setSelectedChatClientId] = useState(null);
  const coachChatEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);
  const isAtBottomRef = React.useRef(true);
  const prevMsgCountRef = React.useRef(0);
  const [isAthleteTyping, setIsAthleteTyping] = useState(false);
  const [coachChatInput, setCoachChatInput] = useState('');
  const [coachChatTag, setCoachChatTag] = useState('Coach Direct Note');
  const [sendingCoachMsg, setSendingCoachMsg] = useState(false);

  // Group Class Roll Call State
  const [selectedCoachClassRollCall, setSelectedCoachClassRollCall] = useState(null);
  const [coachRollCallRoster, setCoachRollCallRoster] = useState({}); // classId -> roster
  const [coachWalkInName, setCoachWalkInName] = useState('');
  const [coachWalkInTier, setCoachWalkInTier] = useState('Walk-in Day Pass');

  // Coach Profile & Credentials State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [coachProfile, setCoachProfile] = useState(() => ({
    name: user?.name || 'Coach Sofia Cruz',
    title: user?.title || 'Lead Personal Trainer & Weight Loss Specialist',
    avatar_url: user?.avatar_url || user?.profile_image || '',
    branch_name: user?.branch_name || 'KSYN Fitness Makati Flagship',
    branch_id: user?.branch_id || 'b-mkt-01',
    email: user?.email || 'coach.sofia@ksyn.com',
    phone: user?.phone || '+63 917 555 0192',
    bio: user?.bio || 'Certified strength and conditioning specialist with over 7 years of elite training experience. Dedicated to sustainable fat loss, metabolic conditioning, and empowering individuals with biomechanically sound resistance training.',
    experience_years: user?.experience_years || '7+ Years',
    certifications: [
      { id: 'cert-1', name: 'Certified Strength and Conditioning Specialist (CSCS)', issuer: 'National Strength and Conditioning Association (NSCA)', year: '2023 - 2026', badge: 'Accredited' },
      { id: 'cert-2', name: 'Certified Personal Trainer (NASM-CPT)', issuer: 'National Academy of Sports Medicine', year: '2022 - 2025', badge: 'Verified' },
      { id: 'cert-3', name: 'Certified Nutrition Coach (Pn1)', issuer: 'Precision Nutrition', year: '2024 - Active', badge: 'Level 1' },
      { id: 'cert-4', name: 'Standard First Aid & BLS / CPR-AED', issuer: 'Philippine Red Cross', year: 'Valid thru 2027', badge: 'Safety Certified' }
    ],
    specialties: (Array.isArray(user?.specialties) && user.specialties.length > 0)
      ? user.specialties
      : (typeof user?.specialties === 'string' && user.specialties ? user.specialties.split(',').map(s => s.trim()) : [
          'Weight Loss & Body Recomposition',
          'Hypertrophy & Progressive Overload',
          'Metabolic HIIT Conditioning',
          'Functional Mobility & Core Stability',
          'Macro & Caloric Energy Balance'
        ]),
    rating: 4.98,
    reviews_count: 142
  }));

  // Sync profile when user updates or reloads
  useEffect(() => {
    if (user) {
      setCoachProfile(prev => ({
        ...prev,
        name: user.name || prev.name,
        title: user.title || prev.title,
        avatar_url: user.avatar_url || user.profile_image || prev.avatar_url,
        phone: user.phone || prev.phone,
        bio: user.bio || prev.bio,
        experience_years: user.experience_years || prev.experience_years,
        specialties: (Array.isArray(user.specialties) && user.specialties.length > 0)
          ? user.specialties
          : (typeof user.specialties === 'string' && user.specialties ? user.specialties.split(',').map(s => s.trim()) : prev.specialties)
      }));
    }
  }, [user]);

  const [editProfileForm, setEditProfileForm] = useState({
    title: user?.title || 'Lead Personal Trainer & Weight Loss Specialist',
    avatar_url: user?.avatar_url || user?.profile_image || '',
    phone: user?.phone || '+63 917 555 0192',
    bio: user?.bio || 'Certified strength and conditioning specialist with over 7 years of elite training experience. Dedicated to sustainable fat loss, metabolic conditioning, and empowering individuals with biomechanically sound resistance training.',
    experience_years: user?.experience_years || '7+ Years',
    specialties: (Array.isArray(user?.specialties) && user.specialties.length > 0)
      ? user.specialties.join(', ')
      : (typeof user?.specialties === 'string' && user.specialties ? user.specialties : 'Weight Loss & Body Recomposition, Hypertrophy & Progressive Overload, Metabolic HIIT Conditioning, Functional Mobility & Core Stability')
  });

  const getCoachClassRoster = (cls) => {
    if (!cls) return [];
    const base = coachRollCallRoster[cls.id] || cls.roster || (Array.isArray(cls.enrolled) ? cls.enrolled : []);
    const coachName = user?.name || cls.instructor || 'Sofia Cruz';
    return base.filter(a => {
      const aName = typeof a === 'string' ? a : a?.name;
      return aName && aName.toLowerCase() !== coachName.toLowerCase();
    });
  };

  // Component-Scope Earnings & Statutory BIR 2307 Calculations
  const coachName = user?.name || 'Coach Sofia Cruz';
  const assignedClientIds = new Set((clients || []).map(c => String(c.id || c.client_id || c.member_id)));
  const assignedClientNames = new Set((clients || []).map(c => String(c.name || c.client_name || '').toLowerCase()));

  const rawSalesList = Array.isArray(commissions?.salesCommissions) ? commissions.salesCommissions : [];
  const salesList = rawSalesList.filter(sc => {
    // Coach isolation: must be this coach
    const isCoach = !sc.coach_id || String(sc.coach_id) === String(user?.id) || (sc.coach_name && user?.name && String(sc.coach_name).toLowerCase().includes(String(user.name).toLowerCase()));
    if (!isCoach) return false;
    // Strict isolation to assigned athletes only
    if (assignedClientIds.size > 0 || assignedClientNames.size > 0) {
      const isClient = (sc.client_id && assignedClientIds.has(String(sc.client_id))) ||
                       (sc.client_name && assignedClientNames.has(String(sc.client_name).toLowerCase()));
      return isClient;
    }
    return true;
  });
  const salesTotal = salesList.reduce((sum, sc) => sum + (Number(sc.commission_earned) || 0), 0);
  const servicingTotal = Number(commissions?.servicingCommissionTotal !== undefined ? commissions.servicingCommissionTotal : (sessions.reduce((acc, s) => acc + (Number(s.commission_earned) || 500), 0)));
  const calculatedPtShare = servicingTotal;
  const calculatedTierBonus = Number(commissionSlip?.tier_bonus !== undefined ? commissionSlip.tier_bonus : (commissions?.tierBonus !== undefined ? commissions.tierBonus : (sessions.length >= 10 ? 2500 : 0)));
  const calculatedStipend = Number(commissionSlip?.group_class_stipend !== undefined ? commissionSlip.group_class_stipend : (commissions?.groupClassStipend !== undefined ? commissions.groupClassStipend : 0));
  const calculatedGross = salesTotal + servicingTotal + calculatedTierBonus + calculatedStipend;
  const calculatedTotalEarnings = calculatedGross;
  const calculatedTax = Math.round(calculatedGross * 0.10 * 100) / 100;
  const calculatedNet = Math.round((calculatedGross - calculatedTax) * 100) / 100;
  const calculatedNetPayout = calculatedNet;

  const handleToggleCoachAthleteCheckIn = async (athleteId) => {
    if (!selectedCoachClassRollCall) return;
    const current = getCoachClassRoster(selectedCoachClassRollCall);
    const target = current.find(a => (a.id || a) === athleteId);
    const isChecked = target?.status === 'Checked In';
    const newStatus = isChecked ? 'Confirmed' : 'Checked In';
    const newTime = newStatus === 'Checked In' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

    const updatedRoster = current.map(a => {
      if ((a.id || a) === athleteId) {
        return {
          ...(typeof a === 'string' ? { id: a, name: a } : a),
          status: newStatus,
          checkInTime: newTime
        };
      }
      return a;
    });

    setCoachRollCallRoster(prev => ({
      ...prev,
      [selectedCoachClassRollCall.id]: updatedRoster
    }));

    setClasses(prev => prev.map(c => {
      if (c.id === selectedCoachClassRollCall.id) {
        return { ...c, roster: updatedRoster, enrolled: updatedRoster };
      }
      return c;
    }));

    if (newStatus === 'Checked In') {
      toast.success(`${target?.name || 'Athlete'} verified on studio floor!`, 'Attendance Recorded');
    } else {
      toast.info(`${target?.name || 'Athlete'} marked pending.`, 'Roll Call Updated');
    }

    try {
      await authFetch(`/api/coach/classes/${selectedCoachClassRollCall.id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ athleteId, status: newStatus, checkInTime: newTime })
      });
    } catch (err) {}
  };

  const handleAddCoachWalkIn = async (e) => {
    if (e) e.preventDefault();
    if (!coachWalkInName.trim() || !selectedCoachClassRollCall) return;

    const current = getCoachClassRoster(selectedCoachClassRollCall);
    if (current.length >= selectedCoachClassRollCall.capacity) {
      toast.warning(`Class studio limit of ${selectedCoachClassRollCall.capacity} reached.`, 'Capacity Full');
      return;
    }

    const newAth = {
      id: `ath-coach-walkin-${Date.now()}`,
      name: coachWalkInName.trim(),
      tier: coachWalkInTier || 'Walk-in Day Pass',
      status: 'Checked In',
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedRoster = [...current, newAth];
    setCoachRollCallRoster(prev => ({
      ...prev,
      [selectedCoachClassRollCall.id]: updatedRoster
    }));

    setClasses(prev => prev.map(c => {
      if (c.id === selectedCoachClassRollCall.id) {
        return { ...c, roster: updatedRoster, enrolled: updatedRoster, enrolled_count: updatedRoster.length };
      }
      return c;
    }));

    setCoachWalkInName('');
    toast.success(`Walk-in ${newAth.name} registered and checked in to ${selectedCoachClassRollCall.name}.`, 'Walk-in Added');

    try {
      await authFetch(`/api/coach/classes/${selectedCoachClassRollCall.id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ walkInAthlete: { name: newAth.name, tier: newAth.tier } })
      });
    } catch (err) {}
  };

  const handleFinalizeCoachAttendance = async () => {
    if (!selectedCoachClassRollCall) return;
    const current = getCoachClassRoster(selectedCoachClassRollCall);
    const verifiedCount = current.filter(a => a.status === 'Checked In').length;

    toast.success(
      `Attendance finalized for ${selectedCoachClassRollCall.name}. ${verifiedCount}/${current.length} athletes verified on floor. Group class credit (+₱850.00) logged to performance payout!`,
      'Coach Attendance Finalized'
    );

    try {
      await authFetch(`/api/coach/classes/${selectedCoachClassRollCall.id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ roster: current })
      });
    } catch (err) {}

    setSelectedCoachClassRollCall(null);
  };

  const handleOpenCoachRollCall = async (cls) => {
    if (isClassConcluded(cls)) {
      toast.warning('This class session has already ended. Roll call is closed.', 'Class Concluded');
      return;
    }
    setSelectedCoachClassRollCall(cls);
    try {
      const res = await authFetch(`/api/classes/${cls.id}/roster`);
      const data = await res.json();
      if (data.success && Array.isArray(data.roster)) {
        setCoachRollCallRoster(prev => ({
          ...prev,
          [cls.id]: data.roster
        }));
      }
    } catch (err) {}
  };

  // Real-time synchronization when a student reserves or cancels a class
  useEffect(() => {
    const unsubscribe = subscribeToClassBookings((event) => {
      if (event?.classId) {
        authFetch('/api/coach/classes')
          .then(r => r.json())
          .then(data => {
            if (data?.success && Array.isArray(data.classes)) {
              setClasses(data.classes);
              setSelectedCoachClassRollCall(prev => {
                if (!prev) return null;
                const updated = data.classes.find(c => c.id === prev.id || c.name === prev.name);
                return updated || prev;
              });
            }
          })
          .catch(() => {});

        setCoachRollCallRoster(prev => {
          const next = { ...prev };
          delete next[event.classId];
          delete next['cls-yoga-01'];
          delete next['cls-1'];
          return next;
        });
      }
    });
    return () => unsubscribe();
  }, [authFetch]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const next = normalizeSection(propSection || activeTab);
    if (next) setActiveSection(next);
  }, [propSection, activeTab]);

  const handleSectionSwitch = (target) => {
    const norm = normalizeSection(target);
    setActiveSection(norm);
    if (typeof propSetSection === 'function') propSetSection(norm);
    if (typeof onTabChange === 'function') onTabChange(norm);
  };

  // Load Coach Data from API
  async function loadCoachData() {
    setLoading(true);
    try {
      const [clientsRes, sessionsRes, commRes, classesRes, msgsRes, plansRes, slipsRes, annRes, rotaRes] = await Promise.all([
        authFetch('/api/coach/clients').then(r => r.json()).catch(() => ({ clients: [] })),
        authFetch('/api/coach/sessions').then(r => r.json()).catch(() => ({ sessions: [] })),
        authFetch('/api/coach/commissions').then(r => r.json()).catch(() => null),
        authFetch('/api/coach/classes').then(r => r.json()).catch(() => ({ classes: [] })),
        authFetch('/api/coach/messages').then(r => r.json()).catch(() => ({ messages: [] })),
        authFetch('/api/coach/workout-plans').then(r => r.json()).catch(() => ({ plans: [] })),
        authFetch('/api/coach/commission-slips').then(r => r.json()).catch(() => null),
        authFetch('/api/announcements').then(r => r.json()).catch(() => ({ announcements: [] })),
        authFetch('/api/branch/floor-rota').then(r => r.json()).catch(() => ({ rota: [] }))
      ]);

      if (clientsRes.success) {
        const clientList = (clientsRes.clients || []).map(c => ({
          ...c,
          package_plan: formatPtPackageWithPrice(c.package_plan, c)
        }));
        setClients(clientList);
        if (clientList.length > 0) {
          setSelectedChatClientId(prev => prev || clientList[0].client_id || clientList[0].id);
        }
      }
      if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
      if (commRes && commRes.success) setCommissions(commRes);
      if (classesRes.success) setClasses(classesRes.classes || []);
      if (msgsRes && msgsRes.success) {
        setChatMessages(msgsRes.messages || []);
        if (msgsRes.is_athlete_typing !== undefined) {
          setIsAthleteTyping(Boolean(msgsRes.is_athlete_typing));
        }
      }
      if (plansRes && plansRes.success) setWorkoutPlans(plansRes.plans || []);
      if (slipsRes && slipsRes.success && slipsRes.slip) setCommissionSlip(slipsRes.slip);
      if (annRes && annRes.success) setAnnouncements(annRes.announcements || []);
      if (rotaRes && rotaRes.success && Array.isArray(rotaRes.rota)) setFloorRota(rotaRes.rota);
    } catch (err) {
      console.error('[CoachDashboard load error]:', err);
    } finally {
      setLoading(false);
    }
  }

  // Helper: scroll chat container to bottom (NEVER scrolls browser window)
  const scrollChatToBottom = (behavior = 'auto') => {
    const el = chatContainerRef.current;
    if (el) {
      if (behavior === 'smooth') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  };

  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Considered at bottom if within 60px of the bottom of the container
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
    isAtBottomRef.current = atBottom;
  };

  // Real-time Athlete Chat short-polling (every 1.8s while in Chat view)
  useEffect(() => {
    if (activeSection !== 'chat' || !selectedChatClientId) return;
    const pollInterval = setInterval(async () => {
      try {
        if (typeof authFetch === 'function') {
          const res = await authFetch(`/api/coach/messages/${selectedChatClientId}`);
          if (res && res.ok) {
            const data = await res.json();
            if (data?.success) {
              if (Array.isArray(data.messages)) {
                setChatMessages(prev => {
                  if (prev.length === data.messages.length) {
                    const lastP = prev[prev.length - 1];
                    const lastN = data.messages[data.messages.length - 1];
                    if (lastP?.id === lastN?.id && lastP?.created_at === lastN?.created_at) {
                      return prev; // Same messages, prevent unnecessary re-render and re-scroll
                    }
                  }
                  return data.messages;
                });
              }
              setIsAthleteTyping(Boolean(data.is_athlete_typing));
            }
          }
        }
      } catch (err) {
        // silent polling catch
      }
    }, 1800);
    return () => clearInterval(pollInterval);
  }, [activeSection, selectedChatClientId, authFetch]);

  // Initial entry / switching athlete: always position scrollbar at bottom of conversation
  useEffect(() => {
    if (activeSection === 'chat' && selectedChatClientId) {
      isAtBottomRef.current = true;
      const timer = setTimeout(() => {
        scrollChatToBottom('auto');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [selectedChatClientId, activeSection]);

  // New incoming messages: ONLY auto-scroll down if user is ALREADY at the bottom!
  // If user scrolled up to read earlier messages, do not force scroll down!
  useEffect(() => {
    if (activeSection !== 'chat') return;
    const currentCount = chatMessages.length;
    const isNew = currentCount > prevMsgCountRef.current;
    prevMsgCountRef.current = currentCount;

    if (isNew && isAtBottomRef.current) {
      const timer = setTimeout(() => {
        scrollChatToBottom('smooth');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [chatMessages, activeSection]);

  // Coach typing indicator debouncing
  const coachTypingTimeoutRef = React.useRef(null);
  const handleCoachTypingChange = (e) => {
    const val = e.target.value;
    setCoachChatInput(val);
    if (!selectedChatClientId) return;

    if (coachTypingTimeoutRef.current) clearTimeout(coachTypingTimeoutRef.current);

    if (val.trim()) {
      if (typeof authFetch === 'function') {
        authFetch('/api/coach/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: selectedChatClientId, typing: true })
        }).catch(() => {});
      }

      coachTypingTimeoutRef.current = setTimeout(() => {
        if (typeof authFetch === 'function') {
          authFetch('/api/coach/messages/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: selectedChatClientId, typing: false })
          }).catch(() => {});
        }
      }, 2500);
    } else {
      if (typeof authFetch === 'function') {
        authFetch('/api/coach/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: selectedChatClientId, typing: false })
        }).catch(() => {});
      }
    }
  };

  // Phase 3: Workout Routine Builders
  const handleAddExerciseRow = () => {
    setPlanForm(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { name: '', sets: 3, reps: '10-12', target_weight: 'Bodyweight', rest_seconds: 90, notes: '' }
      ]
    }));
  };

  const handleRemoveExerciseRow = (idx) => {
    setPlanForm(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx)
    }));
  };

  const handleExerciseChange = (idx, field, val) => {
    setPlanForm(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => i === idx ? { ...ex, [field]: val } : ex)
    }));
  };

  const handleCreateWorkoutPlan = async (e) => {
    if (e) e.preventDefault();
    if (!planForm.client_id) {
      toast.warning('Please select an athlete client.', 'Validation Error');
      return;
    }
    if (!planForm.title.trim()) {
      toast.warning('Please enter a routine program title.', 'Validation Error');
      return;
    }
    setSubmittingPlan(true);
    try {
      const res = await authFetch('/api/coach/workout-plans', {
        method: 'POST',
        body: JSON.stringify(planForm)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Workout Program "${data.plan.title}" assigned successfully!`, 'Program Assigned');
        setShowCreatePlanModal(false);
        loadCoachData();
      } else {
        toast.error(data.message || 'Failed to create plan', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Network Error');
    } finally {
      setSubmittingPlan(false);
    }
  };

  const handleDeleteWorkoutPlan = async (planId) => {
    if (!confirm('Remove this assigned workout program?')) return;
    try {
      const res = await authFetch(`/api/coach/workout-plans/${planId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.info('Workout routine removed.', 'Routine Deleted');
        loadCoachData();
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  };

  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`Cancel and remove class "${className || 'Class'}" from the schedule?`)) return;
    try {
      const res = await authFetch(`/api/coach/classes/${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.info(data.message || 'Class removed from schedule.', 'Class Cancelled');
        setAssignedClasses(prev => (prev || []).filter(c => c.id !== classId));
        loadCoachData();
      } else {
        toast.error(data.message || 'Failed to remove class.', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    }
  };

  // Schedule Studio Class Handler
  const handleScheduleClass = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!classForm.name || !classForm.date || !classForm.time) {
      toast.error('Class Name, Date, and Time Slot are required.', 'Missing Fields');
      return;
    }
    setScheduleClassLoading(true);
    try {
      const res = await authFetch('/api/coach/classes', {
        method: 'POST',
        body: JSON.stringify({
          ...classForm,
          branch_id: classForm.branch_id || user?.branch_id || 'b-mkt-01'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to schedule class.');
      }
      toast.success(`"${classForm.name}" scheduled successfully! Synced to Front Desk & Member Portal.`, 'Class Published');
      setShowScheduleClassModal(false);
      loadCoachData();
    } catch (err) {
      toast.error(err.message || 'Failed to schedule class.', 'Scheduling Error');
    } finally {
      setScheduleClassLoading(false);
    }
  };

  // Sprint 2: Dispatch Coach Message / Preset to Athlete
  async function handleSendCoachMessage(e, presetText = null, presetTag = null) {
    e?.preventDefault?.();
    const targetClientId = selectedChatClientId || (clients[0]?.client_id || clients[0]?.id);
    const content = (presetText || coachChatInput || '').trim();
    const tag = presetTag || coachChatTag || 'Coach Direct Note';
    if (!content || !targetClientId) return;

    try {
      setSendingCoachMsg(true);
      if (coachTypingTimeoutRef.current) clearTimeout(coachTypingTimeoutRef.current);
      if (typeof authFetch === 'function') {
        authFetch('/api/coach/messages/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: targetClientId, typing: false })
        }).catch(() => {});
      }

      const res = await authFetch('/api/coach/messages', {
        method: 'POST',
        body: JSON.stringify({
          client_id: targetClientId,
          content,
          tag
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCoachChatInput('');
        toast.success(`Coaching note dispatched to athlete`, 'Message Dispatched');
        if (data.data) {
          setChatMessages(prev => [...prev, data.data]);
          isAtBottomRef.current = true;
          setTimeout(() => {
            scrollChatToBottom('smooth');
          }, 50);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to dispatch message', 'Error');
      }
    } catch (err) {
      console.error('[CoachDashboard message error]:', err);
      toast.error('Network error sending message', 'Error');
    } finally {
      setSendingCoachMsg(false);
    }
  }

  useEffect(() => {
    loadCoachData();
  }, []);

  // Submit Completed Session (Reinforced with Anti-Ghost Athlete PIN)
  async function handleLogSessionSubmit(e) {
    e.preventDefault();
    if (!sessionForm.client_id) {
      alert('Please select an athlete.');
      return;
    }
    if (!sessionForm.athlete_pin || String(sessionForm.athlete_pin).trim().length < 4) {
      toast.warning('Please enter the athlete\'s 4-to-6 digit PIN to verify completed attendance.', 'Anti-Ghost PIN Required');
      return;
    }
    setSubmittingSession(true);
    try {
      const res = await authFetch('/api/coach/sessions', {
        method: 'POST',
        body: JSON.stringify({
          client_id: sessionForm.client_id,
          duration_mins: sessionForm.duration_mins,
          focus: sessionForm.focus,
          rpe_intensity: `${sessionForm.rpe_intensity}/10`,
          notes: sessionForm.notes,
          athlete_pin: sessionForm.athlete_pin,
          exercise_list: sessionForm.exercise_list || []
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Session verified! Contract payroll split logged.');
        toast.success(data.message || 'PT Session logged. Contracted payroll split credited!', 'Session Completed');
        setShowLogSessionModal(false);
        setSessionForm({
          client_id: '',
          duration_mins: 60,
          focus: 'Barbell Squats & Posterior Chain',
          rpe_intensity: 8,
          notes: '',
          athlete_pin: '',
          exercise_list: [
            { name: 'Barbell Back Squat', sets: 4, reps: 8, weight_kg: 90 },
            { name: 'Romanian Deadlift (RDL)', sets: 3, reps: 10, weight_kg: 80 }
          ]
        });
        loadCoachData();
      } else {
        alert(data.message || 'Failed to log session.');
        toast.error(data.message || 'Failed to log session.', 'Session Error');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Session Error');
    } finally {
      setSubmittingSession(false);
    }
  }

  // Sprint 4: In-Studio Class QR Scanner & Pass Verification
  const handleScanClassPass = async (e) => {
    if (e) e.preventDefault();
    if (!showClassScannerModal || !classScanPassToken.trim()) return;
    setScanningClassPass(true);
    setClassScanSuccessInfo(null);
    try {
      const res = await authFetch(`/api/coach/classes/${showClassScannerModal.id}/scan-pass`, {
        method: 'POST',
        body: JSON.stringify({ pass_token: classScanPassToken.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Access Authorized: ${data.member.name} (${data.member.plan})`, 'Studio Entrance Verified');
        setClassScanSuccessInfo(data.member);
        setClassScanPassToken('');
        // Update class roster in local state
        setCoachRollCallRoster(prev => {
          const existing = prev[showClassScannerModal.id] || showClassScannerModal.roster || [];
          const already = existing.find(a => (a.id || a) === data.member.id);
          if (already) {
            return {
              ...prev,
              [showClassScannerModal.id]: existing.map(a => (a.id || a) === data.member.id ? { ...a, status: 'Checked In', checkInTime: data.member.check_in_time } : a)
            };
          } else {
            return {
              ...prev,
              [showClassScannerModal.id]: [...existing, { id: data.member.id, name: data.member.name, tier: data.member.plan, status: 'Checked In', checkInTime: data.member.check_in_time }]
            };
          }
        });
        loadCoachData();
      } else {
        toast.error(data.message || 'Pass verification rejected.', 'Access Denied');
      }
    } catch (err) {
      toast.error(err.message, 'Scanner Error');
    } finally {
      setScanningClassPass(false);
    }
  };

  // Sprint 4: Fetch & Record 1RM Strength Progress
  const fetchClientStrength = async (client) => {
    setShowStrengthModal(client);
    setStrengthData(null);
    try {
      const res = await authFetch(`/api/coach/clients/${client.client_id || client.id}/strength`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStrengthData(data);
      }
    } catch (err) {
      console.error('Error fetching client strength:', err);
    }
  };

  const handleRecordStrength = async (e) => {
    if (e) e.preventDefault();
    if (!showStrengthModal) return;
    setSubmittingStrength(true);
    try {
      const weight = Number(strengthForm.weight_kg) || 0;
      const reps = Number(strengthForm.reps) || 1;
      const res = await authFetch(`/api/coach/clients/${showStrengthModal.client_id || showStrengthModal.id}/strength`, {
        method: 'POST',
        body: JSON.stringify({
          exercise_name: strengthForm.exercise_name,
          weight_kg: weight,
          reps: reps,
          rpe: strengthForm.rpe,
          notes: strengthForm.notes
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const epley1RM = Math.round(weight * (1 + reps / 30));
        toast.success(`PR Recorded: 1RM = ${epley1RM} kg (${strengthForm.exercise_name}) via Epley Formula`, '1RM Calculated');
        fetchClientStrength(showStrengthModal);
      } else {
        toast.error(data.message || 'Error recording strength PR', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingStrength(false);
    }
  };

  // Sprint 4: Fetch & Prescribe Nutrition Macros
  const fetchClientNutrition = async (client) => {
    setShowNutritionModal(client);
    try {
      const res = await authFetch(`/api/coach/clients/${client.client_id || client.id}/nutrition`);
      const data = await res.json();
      if (res.ok && data.success && data.nutrition) {
        setNutritionForm({
          target_calories: data.nutrition.target_calories || 2500,
          protein_g: data.nutrition.protein_g || 170,
          carbs_g: data.nutrition.carbs_g || 270,
          fat_g: data.nutrition.fat_g || 65,
          hydration_liters: data.nutrition.hydration_liters || 3.5,
          meal_frequency: data.nutrition.meal_frequency || 4,
          dietary_notes: data.nutrition.dietary_notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching client nutrition:', err);
    }
  };

  const handleSaveNutrition = async (e) => {
    if (e) e.preventDefault();
    if (!showNutritionModal) return;
    setSubmittingNutrition(true);
    try {
      const res = await authFetch(`/api/coach/clients/${showNutritionModal.client_id || showNutritionModal.id}/nutrition`, {
        method: 'POST',
        body: JSON.stringify(nutritionForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Macro prescription saved for ${showNutritionModal.client_name}`, 'Nutrition Prescribed');
        setShowNutritionModal(null);
      } else {
        toast.error(data.message || 'Error saving nutrition prescription', 'Error');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingNutrition(false);
    }
  };

  // Submit Client Metrics Update
  async function handleUpdateMetricsSubmit(e) {
    e.preventDefault();
    if (!showMetricsModal) return;
    try {
      const res = await authFetch(`/api/coach/clients/${showMetricsModal.id}/metrics`, {
        method: 'PUT',
        body: JSON.stringify(metricsForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Metrics updated for ${showMetricsModal.client_name}.`);
        toast.success(`Athlete biometric measurements updated for ${showMetricsModal.client_name}.`, 'Metrics Saved');
        setShowMetricsModal(null);
        loadCoachData();
      } else {
        alert(data.message || 'Failed to update metrics.');
        toast.error(data.message || 'Failed to update metrics.', 'Metrics Error');
      }
    } catch (err) {
      alert(err.message);
      toast.error(err.message, 'Error');
    }
  }

  const filteredClients = clients.filter(c => {
    const matchesSearch = !clientSearch ||
      c.client_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.goal?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(clientSearch.toLowerCase());
    if (!matchesSearch) return false;
    const remaining = Math.max(0, (c.sessions_total || 12) - (c.sessions_completed || 0));
    if (clientFilter === 'active') return remaining > 0;
    if (clientFilter === 'low') return remaining > 0 && remaining <= 3;
    if (clientFilter === 'completed') return remaining === 0;
    return true;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      width: '100%',
      paddingBottom: '40px',
      boxSizing: 'border-box'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#16a34a] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-emerald-400 font-semibold">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: OVERVIEW & SCHEDULE */}
      {/* ========================================================================= */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {/* Top Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '4px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                  Welcome back, Coach {formatUserDisplayName(user)}
                </h1>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                Manage your personal training clients, monitor athlete progress, and log 1-on-1 verified workouts.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowLogSessionModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 900,
                  background: '#e1c256',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(225, 194, 86, 0.25)'
                }}
              >
                <Plus size={16} /> Log PT Session
              </button>
              <button
                type="button"
                onClick={() => setShowLogMaintenanceModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 18px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  cursor: 'pointer'
                }}
                title="Report equipment breakdown, free-weight maintenance, or facility notice"
              >
                <Wrench size={16} /> Report Maintenance
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    await loadCoachData();
                    setRefreshedCoachFeedback(true);
                    toast.success('Coach telemetry & roster refreshed!', 'Synced');
                    setTimeout(() => setRefreshedCoachFeedback(false), 3000);
                  }}
                  style={{
                    padding: '11px',
                    borderRadius: '10px',
                    border: '1px solid #2a3447',
                    background: '#16191f',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Refresh Telemetry & Roster"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                {refreshedCoachFeedback && (
                  <span className="badge badge-active text-xs">
                    Refreshed just now
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4 Top KPI Cards Strip with Explicit 20px Gap & 12px Bottom Separation */}
          {(() => {
            const todayDateStr = new Date().toISOString().split('T')[0];
            const isConcluded = (cls) => {
              if (!cls) return false;
              if (cls.is_concluded === true) return true;
              const now = new Date();
              const classDate = cls.date ? String(cls.date).split('T')[0] : todayDateStr;
              if (classDate < todayDateStr) return true;
              if (classDate > todayDateStr) return false;
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

            const cleanUser = String(user?.name || '').toLowerCase().replace(/\b(coach|head coach|pt|trainer|instructor)\b/gi, '').replace(/[\(\)\[\]\-_]/g, ' ').trim();
            const userTokens = cleanUser.split(/\s+/).filter(p => p.length >= 3);

            const myAssigned = (classes || []).filter(cls => {
              if (['super_admin', 'branch_admin', 'front_desk', 'employee', 'staff'].includes(user?.role)) return true;
              if (cls.coach_id && user?.id && String(cls.coach_id) === String(user.id)) return true;
              const cleanInstr = String(cls.instructor || cls.coach_name || '').toLowerCase().replace(/\b(coach|head coach|pt|trainer|instructor)\b/gi, '').replace(/[\(\)\[\]\-_]/g, ' ').trim();
              if (cleanUser && cleanInstr) {
                if (cleanUser === cleanInstr || cleanInstr.includes(cleanUser) || cleanUser.includes(cleanInstr)) return true;
                const instrTokens = cleanInstr.split(/\s+/).filter(p => p.length >= 3);
                const common = userTokens.filter(p => instrTokens.includes(p));
                if (common.length >= Math.min(2, userTokens.length) && common.length > 0) return true;
              }
              return false;
            });

            const now = new Date();
            const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const utcDateStr = now.toISOString().split('T')[0];

            const todayClassesList = myAssigned.filter(c => {
              if (!c || !c.date) return false;
              const d = String(c.date).split('T')[0];
              const isToday = (d === localDateStr || d === utcDateStr);
              return isToday && !isConcluded(c);
            });
            const todayCount = todayClassesList.length;

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                width: '100%',
                marginBottom: '8px'
              }}>
                {/* 1. Active PT Athletes */}
                <div style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>ACTIVE PT CLIENTS</span>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}><Users size={16} /></div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>{clients.length || 3}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} color="#658256" /> <span>Dedicated 1-on-1 athletes</span>
                  </div>
                </div>

                {/* 2. Sessions Completed */}
                <div style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>SESSIONS CONDUCTED</span>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}><CalendarCheck size={16} /></div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace' }}>{sessions.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={13} color="#e1c256" /> <span>Verified 60-min sessions this cycle</span>
                  </div>
                </div>

                {/* 3. Training Routines */}
                <div style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>TRAINING ROUTINES</span>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.1)', color: '#658256' }}><Layers size={16} /></div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>{workoutPlans.length || (clients.length ? clients.length : 3)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={13} color="#658256" /> <span>Active athlete workout plans</span>
                  </div>
                </div>

                {/* 4. Coach-Led Classes Scheduled Today */}
                <div style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>COACH-LED CLASSES</span>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(247, 255, 196, 0.1)', color: '#e1c256' }}><Flame size={16} /></div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace' }}>{todayCount}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="#e1c256" /> <span>Group classes scheduled today</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '24px',
            width: '100%',
            alignItems: 'start'
          }}>
          {/* ========================================================================= */}
          {/* LEFT COLUMN: ACTIVE TRAINEES & PROGRESS */}
          {/* ========================================================================= */}
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Header with High-Contrast Dark Obsidian Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}>
                  <Users size={18} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  My Trainees & Athlete Progress
                </h2>
              </div>

              <button
                type="button"
                onClick={() => handleSectionSwitch('clients')}
                style={{
                  background: '#16191f',
                  border: '1px solid #262d40',
                  color: '#e1c256',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1f2433'; e.currentTarget.style.borderColor = '#e1c256'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#16191f'; e.currentTarget.style.borderColor = '#262d40'; }}
              >
                <span>View All Athletes</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Trainee Cards List with Guaranteed 18px Vertical Gap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {clients.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: '#16191f', border: '1px solid #232938', borderRadius: '12px' }}>
                  <Users size={32} style={{ margin: '0 auto 10px auto', color: '#64748b' }} />
                  <p style={{ color: '#ffffff', fontWeight: 700, margin: '0 0 4px 0', fontSize: '0.875rem' }}>No athletes assigned yet</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>Members enrolled in PT packages will appear here.</p>
                </div>
              ) : (
                clients.slice(0, 3).map((client) => {
                  const total = client.sessions_total || 12;
                  const completed = client.sessions_completed || 0;
                  const remaining = Math.max(0, total - completed);
                  const progressPct = Math.min(100, Math.round((completed / total) * 100));

                  return (
                    <div
                      key={client.id}
                      style={{
                        background: '#16191f',
                        border: '1px solid #232938',
                        borderRadius: '14px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      {/* Name & Package Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 3px 0' }}>
                            {client.client_name}
                          </h4>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e1c256' }}>
                            {client.package_plan}
                          </span>
                        </div>

                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: client.status === 'Active' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                          color: client.status === 'Active' ? '#7fa36d' : '#e1c256',
                          border: `1px solid ${client.status === 'Active' ? 'rgba(101, 130, 86, 0.3)' : 'rgba(225, 194, 86, 0.3)'}`
                        }}>
                          {client.status || 'Active'}
                        </span>
                      </div>

                      {/* Metrics Row: Goal, Current Wt, Target Wt with High-Contrast Labels */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#0d0f14',
                        border: '1px solid #1a202c'
                      }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            GOAL
                          </span>
                          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {client.goal || 'General Fitness'}
                          </span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            CURRENT WT.
                          </span>
                          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', marginTop: '2px' }}>
                            {client.current_weight_kg || client.weight_kg || '—'} kg
                          </span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            TARGET WT.
                          </span>
                          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 800, color: '#7fa36d', fontFamily: 'monospace', marginTop: '2px' }}>
                            {client.target_weight_kg ? `${client.target_weight_kg} kg` : 'Not set'}
                          </span>
                        </div>
                      </div>

                      {/* Sessions Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                          <span style={{ color: '#cbd5e1' }}>
                            Sessions Completed: <strong>{Math.min(completed, total)}</strong> / {total}
                          </span>
                          <span style={{ color: completed >= total ? '#ef4444' : '#e1c256', fontWeight: 800 }}>
                            {completed >= total ? 'Package Cap Reached (Renewal Due)' : `${remaining} remaining`}
                          </span>
                        </div>
                        <div style={{ height: '7px', width: '100%', background: '#262d40', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${progressPct}%`, height: '100%', background: completed >= total ? '#ef4444' : '#e1c256', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: RECENT WORKOUTS & COACH CREDENTIALS */}
          {/* ========================================================================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Card 1: Recent Verified Workouts */}
            <div style={{
              background: '#101216',
              border: '1px solid #1f232b',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}>
                    <CalendarCheck size={18} />
                  </div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Recent Workouts Verified
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSectionSwitch('commissions');
                    setTimeout(() => {
                      const el = document.getElementById('coach-sessions-ledger');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 120);
                  }}
                  style={{
                    background: '#16191f',
                    border: '1px solid #262d40',
                    color: '#e1c256',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>View All</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', background: '#16191f', border: '1px solid #232938', borderRadius: '12px' }}>
                    <CalendarCheck size={28} style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
                    <p style={{ color: '#ffffff', fontWeight: 700, margin: '0 0 2px 0', fontSize: '0.8125rem' }}>No workout sessions logged yet</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>Verified 1-on-1 PT sessions will appear here.</p>
                  </div>
                ) : (
                  sessions.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: '#16191f',
                        border: '1px solid #232938',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>{s.client_name}</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, fontFamily: 'monospace', color: '#e1c256', background: 'rgba(225, 194, 86, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                          RPE {s.rpe_intensity || '8'}/10
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', margin: 0, fontWeight: 500 }}>{s.focus || 'Strength & Conditioning'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        <span>60-Min 1-on-1 Session</span>
                        <span>{new Date(s.session_date || s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PT ATHLETES & WORKOUT PROGRAMS (UNIFIED PAGE) */}
      {/* ========================================================================= */}
      {activeSection === 'clients' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                  PT Athletes & Workout Programs
                </h1>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(225, 194, 86, 0.15)',
                  color: '#e1c256',
                  border: '1px solid rgba(225, 194, 86, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Users size={12} /> {clients.length} ENROLLED ATHLETES
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                Monitor personal training client package utilization, review body composition metrics, and assign periodized workout splits.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={async () => {
                  await loadCoachData();
                  setRefreshedAthletesFeedback(true);
                  toast.success('Athletes roster refreshed successfully!', 'Roster Synced');
                  setTimeout(() => setRefreshedAthletesFeedback(false), 3000);
                }}
                className="ksyn-btn ksyn-btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.8125rem' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh Athletes
              </button>
              {refreshedAthletesFeedback && (
                <span className="badge badge-active text-xs">
                  Refreshed just now
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            width: '100%'
          }}>
            <div style={{ padding: '16px', borderRadius: '12px', background: '#16191f', border: '1px solid #232938', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Enrolled PT Athletes</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', marginTop: '2px' }}>{clients.length}</div>
              </div>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}><Users size={18} /></div>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: '#16191f', border: '1px solid #232938', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Active Workout Programs</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace', marginTop: '2px' }}>
                  {clients.filter(c => workoutPlans.some(p => p.client_id === c.client_id || p.client_id === c.id || p.member_id === c.client_id || (p.client_name && c.client_name && p.client_name.toLowerCase().trim() === c.client_name.toLowerCase().trim()))).length || (clients.length ? clients.length : 3)}
                </div>
              </div>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.1)', color: '#658256' }}><Layers size={18} /></div>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: '#16191f', border: '1px solid #232938', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Remaining Paid Sessions</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace', marginTop: '2px' }}>
                  {clients.reduce((sum, c) => sum + Math.max(0, (c.sessions_total || 12) - (c.sessions_completed || 0)), 0)}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '4px' }}>
                  Active athlete sessions remaining across assigned roster
                </div>
              </div>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.1)', color: '#e1c256' }}><CalendarCheck size={18} /></div>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#12141a',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #1f2430'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 440px', minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search athlete by name or goal..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#16191f',
                    border: '1px solid #262d40',
                    borderRadius: '10px',
                    padding: '10px 16px 10px 40px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                style={{
                  background: '#16191f',
                  border: '1px solid #262d40',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="all">All Athletes ({clients.length})</option>
                <option value="active">Active Packages ({clients.filter(c => Math.max(0, (c.sessions_total || 12) - (c.sessions_completed || 0)) > 0).length})</option>
                <option value="low">Low Sessions ≤ 3 ({clients.filter(c => { const r = Math.max(0, (c.sessions_total || 12) - (c.sessions_completed || 0)); return r > 0 && r <= 3; }).length})</option>
                <option value="completed">Completed ({clients.filter(c => Math.max(0, (c.sessions_total || 12) - (c.sessions_completed || 0)) === 0).length})</option>
              </select>

              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(225, 194, 86, 0.1)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                color: '#e1c256',
                fontSize: '0.75rem',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                {filteredClients.length} of {clients.length} Athletes
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (clients.length > 0 && !planForm.client_id) {
                    setPlanForm(prev => ({ ...prev, client_id: clients[0].client_id }));
                  }
                  setShowCreatePlanModal(true);
                }}
                className="ksyn-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  background: '#1c2230',
                  color: '#ffffff',
                  border: '1px solid #2a3447',
                  cursor: 'pointer'
                }}
              >
                <Layers size={16} style={{ color: '#e1c256' }} /> Create Workout Split
              </button>
              <button
                type="button"
                onClick={() => setShowLogSessionModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  background: '#e1c256',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(225, 194, 86, 0.2)'
                }}
              >
                <Plus size={16} /> Log PT Session
              </button>
            </div>
          </div>

          {/* Athletes Grid with Clean, Bounded Card UI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            width: '100%'
          }}>
            {filteredClients.map((client) => {
              const remaining = Math.max(0, (client.sessions_total || 12) - (client.sessions_completed || 0));
              const progressPct = Math.round(((client.sessions_completed || 0) / (client.sessions_total || 12)) * 100);
              const assignedPlan = workoutPlans.find(p => 
                p.client_id === client.client_id || 
                p.client_id === client.id || 
                p.member_id === client.client_id || 
                p.member_id === client.id || 
                (p.client_name && client.client_name && p.client_name.toLowerCase().trim() === client.client_name.toLowerCase().trim())
              );

              return (
                <div
                  key={client.id}
                  style={{
                    background: '#101216',
                    border: '1px solid #1f232b',
                    borderRadius: '16px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <h3 style={{
                          fontSize: '1.0625rem',
                          fontWeight: 800,
                          color: '#ffffff',
                          margin: '0 0 4px 0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {client.client_name}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#e1c256',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {formatPtPackageWithPrice(client.package_plan, client)}
                          </div>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              letterSpacing: '0.01em',
                              background: client.is_cross_branch ? 'rgba(167, 139, 250, 0.12)' : 'rgba(167, 243, 208, 0.10)',
                              color: client.is_cross_branch ? '#c4b5fd' : '#a7f3d0',
                              border: `1px solid ${client.is_cross_branch ? 'rgba(167, 139, 250, 0.35)' : 'rgba(110, 231, 183, 0.35)'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              {client.is_cross_branch
                                ? `Cross-Branch: ${client.origin_branch_name || 'Fairview Hub'}`
                                : `Home Branch: ${client.origin_branch_name || client.home_branch || 'Makati Flagship'}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: client.status === 'Active' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                        color: client.status === 'Active' ? '#7fa36d' : '#e1c256',
                        border: `1px solid ${client.status === 'Active' ? 'rgba(101, 130, 86, 0.3)' : 'rgba(225, 194, 86, 0.3)'}`
                      }}>
                        {client.status}
                      </span>
                    </div>

                    <div style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: '#16191f',
                      border: '1px solid #232938',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', minWidth: '95px', flexShrink: 0, whiteSpace: 'nowrap' }}>Primary Goal:</span>
                        <span style={{ color: '#ffffff', fontWeight: 700, textAlign: 'right' }}>{client.goal || 'General Fitness'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', minWidth: '95px', flexShrink: 0, whiteSpace: 'nowrap' }}>Current Weight:</span>
                        <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 800 }}>{client.current_weight_kg || '—'} kg</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', minWidth: '95px', flexShrink: 0, whiteSpace: 'nowrap' }}>Body Fat %:</span>
                        <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 800 }}>{client.body_fat_percentage || '—'}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', minWidth: '95px', flexShrink: 0, whiteSpace: 'nowrap' }}>Target Goal:</span>
                        <span style={{ color: '#7fa36d', fontFamily: 'monospace', fontWeight: 800 }}>{client.target_weight_kg ? `${client.target_weight_kg} kg` : 'Not set'}</span>
                      </div>
                    </div>

                    {/* Assigned Workout Routine Status Pill */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#0d0f14',
                      border: '1px solid #1e2433',
                      fontSize: '0.75rem'
                    }}>
                      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={13} style={{ color: '#e1c256' }} /> Workout Split:
                      </span>
                      {assignedPlan ? (
                        <span style={{ color: '#e1c256', fontWeight: 700 }}>
                          {assignedPlan.split_type || assignedPlan.title} ({assignedPlan.days_per_week || 4}d/wk)
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                          No routine assigned
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                        <span>Sessions: {Math.min(client.sessions_completed || 0, client.sessions_total || 12)} / {client.sessions_total || 12} completed</span>
                        <span style={{ color: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? '#ef4444' : '#e1c256', fontWeight: 800 }}>
                          {(client.sessions_completed || 0) >= (client.sessions_total || 12) ? '0 remaining (Renewal Due)' : `${remaining} remaining`}
                        </span>
                      </div>
                      <div style={{ width: '100%', background: '#0d0f14', height: '8px', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? '#ef4444' : '#e1c256',
                            height: '100%',
                            borderRadius: '999px',
                            width: `${Math.min(100, progressPct)}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean 2-Tier Button Bar (Zero Overflow, Fully Responsive) */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingTop: '14px',
                    borderTop: '1px solid #1f232b'
                  }}>
                    {/* Primary Action Button */}
                    <button
                      type="button"
                      disabled={(client.sessions_completed || 0) >= (client.sessions_total || 12)}
                      onClick={() => {
                        if ((client.sessions_completed || 0) >= (client.sessions_total || 12)) {
                          toast.error(`Package cap reached (${client.sessions_total} sessions completed). Athlete must renew before booking new sessions.`, 'Renewal Required');
                          return;
                        }
                        setSessionForm({
                          ...sessionForm,
                          client_id: client.client_id
                        });
                        setShowLogSessionModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.8125rem',
                        fontWeight: 800,
                        background: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? '#262d40' : '#e1c256',
                        color: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? '#94a3b8' : '#000000',
                        border: 'none',
                        cursor: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: (client.sessions_completed || 0) >= (client.sessions_total || 12) ? 'none' : '0 2px 10px rgba(225, 194, 86, 0.2)'
                      }}
                    >
                      <Dumbbell size={15} /> {(client.sessions_completed || 0) >= (client.sessions_total || 12) ? 'Package Cap Reached (Renewal Due)' : 'Log Workout Session'}
                    </button>

                    {/* Secondary 3-Column Equal Action Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const targetClientId = client.client_id || client.id || client.member_id;
                          setPlanForm(prev => ({
                            ...prev,
                            client_id: targetClientId,
                            member_id: targetClientId,
                            client_name: client.client_name,
                            title: `${client.client_name} - ${client.goal || 'Hypertrophy'} Split`
                          }));
                          setShowCreatePlanModal(true);
                        }}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          border: '1px solid #283044',
                          background: '#151924',
                          color: '#e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                        title="Assign or Edit Workout Routine"
                      >
                        <Layers size={13} style={{ color: '#e1c256', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>Split Plan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChatClientId(client.client_id);
                          handleSectionSwitch('chat');
                        }}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          border: '1px solid rgba(247, 255, 196, 0.4)',
                          background: 'rgba(247, 255, 196, 0.1)',
                          color: '#f7ffc4',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                        title="Open Quick-Chat with Athlete"
                      >
                        <MessageSquare size={13} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>Quick-Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowMetricsModal(client);
                          setMetricsForm({
                            current_weight_kg: client.current_weight_kg || 75,
                            target_weight_kg: client.target_weight_kg || 80,
                            body_fat_percentage: client.body_fat_percentage || 16,
                            goal: client.goal || '',
                            notes: ''
                          });
                        }}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          border: '1px solid #283044',
                          background: '#151924',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                        title="Update Athlete Biometrics"
                      >
                        <Scale size={13} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>Metrics</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* INTEGRATED SECTION: ASSIGNED WORKOUT SPLITS & ROUTINE PROGRAMS */}
          {/* ========================================================================= */}
          <div style={{
            marginTop: '16px',
            borderTop: '1px solid #1f2535',
            paddingTop: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.1)',
                    border: '1px solid rgba(225, 194, 86, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256'
                  }}>
                    <Layers size={18} />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Assigned Workout Programs & Split Routines
                  </h2>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 46px' }}>
                  Periodized training splits designed exclusively for your enrolled 1-on-1 PT athletes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (clients.length > 0 && !planForm.client_id) {
                    setPlanForm(prev => ({ ...prev, client_id: clients[0].client_id }));
                  }
                  setShowCreatePlanModal(true);
                }}
                className="ksyn-btn ksyn-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.8125rem'
                }}
              >
                <Plus size={15} /> Create & Assign New Split
              </button>
            </div>

            {/* Program Cards Grid */}
            {workoutPlans.length === 0 ? (
              <div style={{
                background: '#11131a',
                border: '1px dashed #2d3345',
                borderRadius: '16px',
                padding: '48px 24px',
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256'
                }}>
                  <Dumbbell size={24} />
                </div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  No Workout Programs Assigned Yet
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '440px', margin: 0 }}>
                  Build customized workout routines for your enrolled 1-on-1 personal training athletes with custom set, rep, and weight targets.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (clients.length > 0 && !planForm.client_id) {
                      setPlanForm(prev => ({ ...prev, client_id: clients[0].client_id }));
                    }
                    setShowCreatePlanModal(true);
                  }}
                  style={{
                    marginTop: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '11px 22px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    background: '#1c2230',
                    border: '1.5px solid #e1c256',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Plus size={15} style={{ color: '#e1c256' }} /> <span style={{ color: '#ffffff', fontWeight: 800 }}>Create First Program</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
                {workoutPlans.map((plan) => {
                  const assignedClient = clients.find(c => c.client_id === plan.client_id || c.id === plan.client_id);
                  const clientName = plan.client_name || assignedClient?.client_name || 'Enrolled Athlete';
                  const completedCount = plan.exercises?.filter(e => e.completed).length || 0;
                  const totalCount = plan.exercises?.length || 0;
                  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                  return (
                    <div
                      key={plan.id}
                      style={{
                        background: '#12151e',
                        border: '1px solid #232938',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                              {plan.split_type || 'Custom Routine'}
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
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: '4px 0 0' }}>
                            {plan.title}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: '#94a3b8' }}>
                            <Users size={14} style={{ color: '#f7ffc4' }} />
                            <span>Athlete: <strong style={{ color: '#e2e8f0' }}>{clientName}</strong></span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteWorkoutPlan(plan.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s'
                          }}
                          title="Delete Routine"
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Coach Notes */}
                      {plan.notes && (
                        <div style={{
                          fontSize: '0.8125rem',
                          background: '#0a0c12',
                          border: '1px solid #1a202c',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          color: '#cbd5e1',
                          lineHeight: 1.4
                        }}>
                          <strong style={{ color: '#e1c256', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                            Coach Instructions:
                          </strong>
                          {plan.notes}
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Exercise Adherence</span>
                          <span style={{ color: progressPct === 100 ? '#658256' : '#e1c256', fontWeight: 700 }}>
                            {completedCount} / {totalCount} Completed ({progressPct}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: '#1c2230', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${progressPct}%`,
                            background: progressPct === 100 ? 'linear-gradient(90deg, #658256, #658256)' : 'linear-gradient(90deg, #e1c256, #eab308)',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>

                      {/* Exercise List Table */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
                          padding: '6px 10px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#64748b',
                          letterSpacing: '0.05em'
                        }}>
                          <span>Exercise</span>
                          <span>Sets x Reps</span>
                          <span>Load Target</span>
                          <span style={{ textAlign: 'right' }}>Rest</span>
                        </div>

                        {plan.exercises?.map((ex, exIdx) => (
                          <div
                            key={exIdx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
                              alignItems: 'center',
                              padding: '8px 10px',
                              background: ex.completed ? 'rgba(101, 130, 86, 0.05)' : '#0b0d14',
                              border: `1px solid ${ex.completed ? 'rgba(101, 130, 86, 0.2)' : '#1e2330'}`,
                              borderRadius: '8px',
                              fontSize: '0.8125rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: ex.completed ? '#658256' : '#f1f5f9', fontWeight: 600 }}>
                              {ex.completed ? <CheckCircle2 size={13} style={{ color: '#658256', flexShrink: 0 }} /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e1c256', flexShrink: 0 }} />}
                              <span style={{ textDecoration: ex.completed ? 'line-through' : 'none' }}>{ex.name}</span>
                            </div>
                            <span style={{ color: '#cbd5e1' }}>{ex.sets} × {ex.reps}</span>
                            <span style={{ color: '#e1c256', fontWeight: 600 }}>{ex.target_weight || 'Bodyweight'}</span>
                            <span style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem' }}>{ex.rest_seconds || 90}s</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #1e2433', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>Created {new Date(plan.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ color: '#f7ffc4' }}>Active Macrocycle</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* VIEW: ATHLETE QUICK-CHAT & DIRECT COACHING DISPATCH (activeSection === 'chat') */}
      {/* ========================================================================= */}
      {activeSection === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Bar */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(225, 194, 86, 0.15)',
                border: '1px solid #e1c256',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MessageSquare size={20} color="#e1c256" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  ATHLETE QUICK-CHAT & DIRECT COACHING DISPATCH
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                  Real-Time 1-on-1 Guidance, Nutritional Macro Checks & Pre-Workout Priming
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#658256', fontWeight: 700 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 8px #658256' }} />
              <span>Athlete Link Online</span>
            </div>
          </div>

          {/* Quick-Coaching Preset Dispatch Panel */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#e1c256', textTransform: 'uppercase' }}>
                1-Click Quick-Dispatch Coaching Templates
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px'
            }}>
              {[
                {
                  icon: <Utensils size={16} className="text-emerald-400" />,
                  title: 'Macro Check',
                  tag: 'Macro Check',
                  text: 'Macro Check: Remember to hit your protein target (160-180g) and drink at least 3L water today.'
                },
                {
                  icon: <Dumbbell size={16} className="text-[#f7ffc4]" />,
                  title: 'Session Prep',
                  tag: 'Session Prep',
                  text: 'Session Prep: Focus on hip opening and thoracic spine mobility 15 mins before our session today.'
                },
                {
                  icon: <Flame size={16} className="text-[#e1c256]" />,
                  title: 'Post-Workout',
                  tag: 'Post-Workout',
                  text: 'Outstanding effort hitting your RPE 8 target today! Take a 20-min deload recovery walk.'
                },
                {
                  icon: <Clock size={16} className="text-[#658256]" />,
                  title: 'Schedule Reminder',
                  tag: 'Schedule Reminder',
                  text: 'Schedule Reminder: Our 1-on-1 session is booked for tomorrow at 4:00 PM. See you on the turf!'
                }
              ].map((preset, pIdx) => (
                <div
                  key={pIdx}
                  style={{
                    background: '#12151e',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="inline-flex items-center justify-center">{preset.icon}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>{preset.title}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                      "{preset.text}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip text="Instant dispatch message to client">
                      <button
                        type="button"
                        onClick={() => handleSendCoachMessage(null, preset.text, preset.tag)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: 'rgba(225, 194, 86, 0.15)',
                          border: '1px solid #e1c256',
                          color: '#e1c256',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span className="inline-flex items-center gap-1">Instant Dispatch</span>
                      </button>
                    </Tooltip>
                    <button
                      type="button"
                      onClick={() => {
                        setCoachChatInput(preset.text);
                        setCoachChatTag(preset.tag);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        background: '#1a1f2c',
                        border: '1px solid #2d3748',
                        color: '#cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      Edit First
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main 2-Column Chat Area */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 340px) 1fr',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* Real-World Messenger Athlete Inbox */}
            {(() => {
              const sortedClients = [...(clients || [])].sort((a, b) => {
                const aId = a.client_id || a.id;
                const bId = b.client_id || b.id;
                const aMsgs = (chatMessages || []).filter(m => m.recipient_id === aId || m.sender_id === aId);
                const bMsgs = (chatMessages || []).filter(m => m.recipient_id === bId || m.sender_id === bId);
                const aLast = aMsgs.length > 0 ? new Date(aMsgs[aMsgs.length - 1].created_at).getTime() : 0;
                const bLast = bMsgs.length > 0 ? new Date(bMsgs[bMsgs.length - 1].created_at).getTime() : 0;
                return bLast - aLast;
              });

              const formatMsgTime = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return '';
                const today = new Date();
                if (d.toDateString() === today.toDateString()) {
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              };

              return (
                <div style={{
                  background: '#0d1017',
                  border: '1px solid #1f2638',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #1a2233' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Assigned PT Athletes ({sortedClients.length})
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#e1c256', fontWeight: 700 }}>
                      Latest Active Top
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                    {sortedClients.map((c, idx) => {
                      const clientId = c.client_id || c.id;
                      const isSelected = selectedChatClientId ? selectedChatClientId === clientId : idx === 0;
                      const cMessages = (chatMessages || []).filter(m => m.recipient_id === clientId || m.sender_id === clientId);
                      const lastMsg = cMessages[cMessages.length - 1];
                      const displayName = formatUserDisplayName({ name: c.client_name, username: c.client_name });
                      const initials = displayName.slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={c.id || clientId}
                          onClick={() => setSelectedChatClientId(clientId)}
                          style={{
                            background: isSelected ? 'rgba(225, 194, 86, 0.12)' : '#07090e',
                            border: `1.5px solid ${isSelected ? '#e1c256' : '#171c26'}`,
                            borderRadius: '12px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start'
                          }}
                        >
                          {/* Athlete Avatar with Active Indicator */}
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: isSelected ? 'linear-gradient(135deg, #e1c256 0%, #b45309 100%)' : '#1c2230',
                              color: isSelected ? '#000' : '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.8125rem'
                            }}>
                              {initials}
                            </div>
                            <span style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: '#10b981',
                              border: '2px solid #0d1017'
                            }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: isSelected ? '#e1c256' : '#ffffff', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {displayName}
                              </span>
                              {lastMsg && (
                                <span style={{ fontSize: '0.6875rem', color: isSelected ? '#fef08a' : '#64748b', fontWeight: 600, flexShrink: 0, marginLeft: '6px' }}>
                                  {formatMsgTime(lastMsg.created_at)}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.6875rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.goal || 'Hypertrophy & Biomechanics'}
                              </span>
                              {(() => {
                                const completed = Math.min(c.sessions_completed || 0, c.sessions_total || 12);
                                const total = c.sessions_total || 12;
                                return (
                                  <span style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    background: isSelected ? 'rgba(225, 194, 86, 0.2)' : 'rgba(101, 130, 86, 0.15)',
                                    color: isSelected ? '#fde047' : '#7fa36d',
                                    flexShrink: 0,
                                    marginLeft: '4px'
                                  }}>
                                    {completed}/{total}
                                  </span>
                                );
                              })()}
                            </div>

                            {lastMsg && (
                              <div style={{ fontSize: '0.72rem', color: isSelected ? '#cbd5e1' : '#64748b', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lastMsg.sender_role === 'coach' ? (
                                  <strong style={{ color: '#e1c256' }}>You: </strong>
                                ) : null}
                                {lastMsg.content}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Chat Thread & Dispatch Console */}
            {(() => {
              const sortedClients = [...(clients || [])].sort((a, b) => {
                const aId = a.client_id || a.id;
                const bId = b.client_id || b.id;
                const aMsgs = (chatMessages || []).filter(m => m.recipient_id === aId || m.sender_id === aId);
                const bMsgs = (chatMessages || []).filter(m => m.recipient_id === bId || m.sender_id === bId);
                const aLast = aMsgs.length > 0 ? new Date(aMsgs[aMsgs.length - 1].created_at).getTime() : 0;
                const bLast = bMsgs.length > 0 ? new Date(bMsgs[bMsgs.length - 1].created_at).getTime() : 0;
                return bLast - aLast;
              });

              const activeClient = sortedClients.find(c => (c.client_id || c.id) === selectedChatClientId) || sortedClients[0] || null;

              if (!activeClient) {
                return (
                  <div style={{
                    background: '#0d1017',
                    border: '1px solid #1f2638',
                    borderRadius: '16px',
                    padding: '48px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#9ca3af'
                  }}>
                    <MessageSquare size={36} color="#4b5563" />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>No Assigned PT Athletes Yet</div>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>When athletes enroll with you online or at the front desk, they will appear here automatically.</div>
                  </div>
                );
              }

              const targetId = activeClient.client_id || activeClient.id;
              const activeMessages = (chatMessages || []).filter(
                m => m.recipient_id === targetId || m.sender_id === targetId
              );
              const activeDisplayName = formatUserDisplayName({ name: activeClient.client_name, username: activeClient.client_name });
              const activeInitials = activeDisplayName.slice(0, 2).toUpperCase();

              return (
                <div style={{
                  background: '#0d1017',
                  border: '1px solid #1f2638',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
                }}>
                  {/* Active Athlete Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #1a2233',
                    paddingBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, #e1c256 0%, #b45309 100%)',
                        color: '#000000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.9375rem'
                      }}>
                        {activeClient?.avatar_url || activeClient?.profile_image ? (
                          <img
                            src={activeClient.avatar_url || activeClient.profile_image}
                            alt={activeDisplayName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          activeInitials
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                            {activeDisplayName}
                          </h3>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} title="Online / Active Client" />
                        </div>
                        {(() => {
                          const completed = Math.min(activeClient.sessions_completed || 0, activeClient.sessions_total || 12);
                          const total = activeClient.sessions_total || 12;
                          const isFull = completed >= total;
                          return (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              {activeClient.package_plan || '12-Session Signature PT Package'} • {completed}/{total} Sessions Verified
                              {isFull && (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: '#ef4444',
                                  fontSize: '0.6875rem',
                                  fontWeight: 800,
                                  border: '1px solid rgba(239, 68, 68, 0.4)'
                                }}>
                                  PACKAGE CAP REACHED (RENEWAL DUE)
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Weight</span>
                      <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#7fa36d' }}>
                        {activeClient.target_weight_kg ? `${activeClient.target_weight_kg} kg` : 'Not set'}
                      </div>
                    </div>
                  </div>

                  {/* Messages Bubble List: Real-World Sleek Dark Theme */}
                  <div
                    ref={chatContainerRef}
                    onScroll={handleChatScroll}
                    style={{
                      background: '#07090e',
                      border: '1px solid #181f2c',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      minHeight: '380px',
                      maxHeight: '460px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    {activeMessages && activeMessages.length > 0 ? (
                      (() => {
                        const sorted = [...activeMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        let lastDateStr = null;
                        return sorted.map((msg) => {
                          const isCoach = msg.sender_role === 'coach';
                          const msgDate = new Date(msg.created_at);
                          const dateKey = isNaN(msgDate.getTime()) ? 'Recent' : msgDate.toDateString();
                          const showDivider = dateKey !== lastDateStr;
                          lastDateStr = dateKey;

                          const formatDateHeader = (d) => {
                            if (isNaN(d.getTime())) return 'Recent';
                            const today = new Date();
                            const isToday = d.toDateString() === today.toDateString();
                            const yesterday = new Date(today);
                            yesterday.setDate(yesterday.getDate() - 1);
                            const isYesterday = d.toDateString() === yesterday.toDateString();
                            if (isToday) return 'Today';
                            if (isYesterday) return 'Yesterday';
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          };

                          return (
                            <React.Fragment key={msg.id}>
                              {showDivider && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                                  <span style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    color: '#94a3b8',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '3px 14px',
                                    borderRadius: '12px',
                                    letterSpacing: '0.04em'
                                  }}>
                                    {formatDateHeader(msgDate)}
                                  </span>
                                </div>
                              )}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: isCoach ? 'flex-end' : 'flex-start',
                                  gap: '10px',
                                  width: '100%'
                                }}
                              >
                                {!isCoach && (
                                  <div style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                    color: '#ffffff',
                                    fontWeight: 900,
                                    fontSize: '0.8125rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px'
                                  }}>
                                    {activeClient?.avatar_url || activeClient?.profile_image ? (
                                      <img
                                        src={activeClient.avatar_url || activeClient.profile_image}
                                        alt={activeDisplayName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      activeInitials
                                    )}
                                  </div>
                                )}

                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isCoach ? 'flex-end' : 'flex-start',
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
                                    <span style={{ fontWeight: 800, color: isCoach ? '#e1c256' : '#60a5fa' }}>
                                      {isCoach ? 'You (Coach)' : activeDisplayName}
                                    </span>
                                    <span>•</span>
                                    <span style={{ color: '#94a3b8' }}>{msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {msg.tag && (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        background: isCoach ? 'rgba(225, 194, 86, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                        border: `1px solid ${isCoach ? 'rgba(225, 194, 86, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                                        color: isCoach ? '#e1c256' : '#93c5fd',
                                        fontSize: '0.625rem',
                                        fontWeight: 700
                                      }}>
                                        {msg.tag}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{
                                    width: '100%',
                                    background: isCoach ? 'linear-gradient(135deg, #221c0c 0%, #171408 100%)' : '#151c28',
                                    border: `1px solid ${isCoach ? 'rgba(225, 194, 86, 0.35)' : '#25324a'}`,
                                    borderRadius: isCoach ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                                    padding: '12px 16px',
                                    color: isCoach ? '#fef08a' : '#f1f5f9',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.5,
                                    boxShadow: isCoach ? '0 2px 8px rgba(225, 194, 86, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.35)'
                                  }}>
                                    {msg.content}
                                  </div>
                                </div>

                                {isCoach && (
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
                                    border: '1.5px solid #e1c256',
                                    boxShadow: '0 0 10px rgba(225, 194, 86, 0.25)',
                                    marginTop: '2px'
                                  }}>
                                    {(user?.avatar_url || coachProfile?.avatar_url || user?.profile_image || msg.sender_avatar) ? (
                                      <img
                                        src={user?.avatar_url || coachProfile?.avatar_url || user?.profile_image || msg.sender_avatar}
                                        alt={user?.name || 'Coach'}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      (user?.name || 'Coach').split(' ').map(n => n[0]).join('').slice(0, 2)
                                    )}
                                  </div>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        });
                      })()
                    ) : (
                      <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
                        <MessageSquare size={36} color="#475569" style={{ margin: '0 auto 8px auto' }} />
                        <p style={{ margin: 0, fontWeight: 500, color: '#94a3b8' }}>No messages yet with {activeDisplayName}. Send a message below to start coaching!</p>
                      </div>
                    )}

                    {isAthleteTyping && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#7fa36d',
                        fontSize: '0.8125rem',
                        fontStyle: 'italic',
                        padding: '8px 14px',
                        background: 'rgba(101, 130, 86, 0.08)',
                        border: '1px solid rgba(101, 130, 86, 0.2)',
                        borderRadius: '12px',
                        width: 'fit-content',
                        marginTop: '4px'
                      }}>
                        <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7fa36d' }} />
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7fa36d' }} />
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7fa36d' }} />
                        </span>
                        <span>{activeDisplayName} is typing...</span>
                      </div>
                    )}
                    <div ref={coachChatEndRef} />
                  </div>

                  {/* Real-World Messenger Composer */}
                  <form
                    onSubmit={(e) => handleSendCoachMessage(e)}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      background: '#07090e',
                      border: '1px solid #1a2233',
                      borderRadius: '14px',
                      padding: '8px 12px'
                    }}
                  >
                    <select
                      value={coachChatTag}
                      onChange={(e) => setCoachChatTag(e.target.value)}
                      style={{
                        background: '#121620',
                        border: '1px solid #232d42',
                        color: '#e1c256',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Coach Direct Note">Direct Note</option>
                      <option value="Macro Check">Macro Check</option>
                      <option value="Session Prep">Session Prep</option>
                      <option value="Post-Workout">Post-Workout</option>
                      <option value="Schedule Reminder">Reminder</option>
                      <option value="Recovery Protocol">Recovery</option>
                      <option value="Coach Welcome">Coach Welcome</option>
                    </select>

                    <input
                      type="text"
                      placeholder={`Message ${activeDisplayName}...`}
                      value={coachChatInput}
                      onChange={handleCoachTypingChange}
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
                      disabled={sendingCoachMsg || !coachChatInput.trim()}
                      className="ksyn-btn ksyn-btn-gold"
                      style={{
                        padding: '8px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 800,
                        fontSize: '0.8125rem',
                        borderRadius: '8px',
                        opacity: sendingCoachMsg || !coachChatInput.trim() ? 0.5 : 1
                      }}
                    >
                      <Send size={15} /> Send
                    </button>
                  </form>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: ASSIGNED GROUP CLASSES */}
      {/* ========================================================================= */}
      {activeSection === 'classes' && (() => {
        const todayDateStr = new Date().toISOString().split('T')[0];

        // Format dates cleanly (Today, Tomorrow, or Mon, Oct 23)
        const formatClassDateLabel = (dateStr) => {
          if (!dateStr) return 'Today';
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
          if (dateStr === today) return 'Today';
          if (dateStr === tomorrow) return 'Tomorrow';
          try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
            return dateStr;
          } catch (e) {
            return dateStr;
          }
        };

        const isClassConcluded = (cls) => {
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

        const isClassToday = (cls) => {
          if (!cls.date) return true;
          return (cls.date === todayDateStr || cls.date.startsWith(todayDateStr)) && !isClassConcluded(cls);
        };

        const isClassUpcoming = (cls) => {
          if (!cls.date) return false;
          if (cls.date > todayDateStr) return true;
          return (cls.date === todayDateStr || cls.date.startsWith(todayDateStr)) && !isClassConcluded(cls);
        };

        // Strict Coach Client-Side Verification Guard
        const normalizeCoachName = (str) => {
          return (str || '')
            .toLowerCase()
            .replace(/\b(coach|head coach|pt|trainer|instructor)\b/gi, '')
            .replace(/[\(\)\[\]\-_]/g, ' ')
            .trim();
        };

        const cleanUser = normalizeCoachName(user?.name);
        const userTokens = cleanUser.split(/\s+/).filter(p => p.length >= 3);

        const myAssignedClasses = classes.filter(cls => {
          // If user is admin/staff, let them inspect all
          if (['super_admin', 'branch_admin', 'front_desk', 'employee', 'staff'].includes(user?.role)) {
            return true;
          }

          // Exact coach ID match with instructor safety
          if (cls.coach_id && user?.id && cls.coach_id === user.id) {
            const cleanInstr = normalizeCoachName(cls.instructor || cls.coach_name);
            if (!cleanInstr || cleanInstr.includes(cleanUser) || cleanUser.includes(cleanInstr)) {
              return true;
            }
          }

          const cleanInstr = normalizeCoachName(cls.instructor || cls.coach_name);
          if (cleanUser && cleanInstr) {
            if (cleanUser === cleanInstr) return true;
            if (cleanInstr.includes(cleanUser) || cleanUser.includes(cleanInstr)) return true;

            const instrTokens = cleanInstr.split(/\s+/).filter(p => p.length >= 3);
            const common = userTokens.filter(p => instrTokens.includes(p));
            if (common.length >= Math.min(2, userTokens.length) && common.length > 0) {
              return true;
            }
          }

          return false;
        });

        const activeAssignedClasses = myAssignedClasses.filter(c => !isClassConcluded(c));
        const todayClasses = myAssignedClasses.filter(isClassToday);
        const upcomingClasses = myAssignedClasses.filter(c => (c.date && c.date > todayDateStr) && !isClassConcluded(c));
        const pastClasses = myAssignedClasses.filter(isClassConcluded);

        const visibleClasses = classFilter === 'today'
          ? todayClasses
          : classFilter === 'upcoming'
          ? upcomingClasses
          : classFilter === 'past'
          ? pastClasses
          : activeAssignedClasses;

        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  Assigned Studio & Group Classes
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0' }}>
                  Live studio classes assigned to your coaching roster today and upcoming schedule with front-desk synchronized attendance rosters.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleClassModal(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    background: '#e1c256',
                    color: '#000000',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(225, 194, 86, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={15} /> Schedule Studio Class
                </button>

                {/* Today, Upcoming & Completed Filter Tabs */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#121520', border: '1px solid #232938', borderRadius: '12px', padding: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setClassFilter('all')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: classFilter === 'all' ? '#e1c256' : 'transparent',
                      color: classFilter === 'all' ? '#000000' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Active Classes ({activeAssignedClasses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassFilter('today')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: classFilter === 'today' ? '#658256' : 'transparent',
                      color: classFilter === 'today' ? '#000000' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Clock size={13} /> Today ({todayClasses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassFilter('upcoming')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: classFilter === 'upcoming' ? '#f7ffc4' : 'transparent',
                      color: classFilter === 'upcoming' ? '#000000' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Calendar size={13} /> Upcoming ({upcomingClasses.length})
                  </button>
                  {pastClasses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setClassFilter('past')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: classFilter === 'past' ? '#64748b' : 'transparent',
                        color: classFilter === 'past' ? '#ffffff' : '#94a3b8',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <CheckCircle2 size={13} /> Concluded ({pastClasses.length})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {visibleClasses.length === 0 ? (
              <div style={{
                background: '#101216',
                border: '1px solid #1f232b',
                borderRadius: '16px',
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(225, 194, 86, 0.1)', border: '1px solid rgba(225, 194, 86, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <Calendar size={24} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  No Studio Classes in this Schedule
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', maxWidth: '420px', margin: 0 }}>
                  {classFilter === 'today'
                    ? "You do not have any group classes scheduled for today. Check upcoming dates or switch to 'All Assigned'."
                    : classFilter === 'upcoming'
                    ? 'No upcoming studio sessions are currently scheduled for your coaching roster.'
                    : 'No studio classes are currently assigned to your instructor profile. Contact the Front Desk to coordinate studio class bookings.'}
                </p>
                {classFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setClassFilter('all')}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ marginTop: '8px', padding: '8px 18px', fontSize: '0.75rem', fontWeight: 800 }}
                  >
                    View All Assigned Classes ({myAssignedClasses.length})
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '20px',
                width: '100%'
              }}>
                {visibleClasses.map((cls) => {
                  const isToday = isClassToday(cls);
                  const dateLabel = formatClassDateLabel(cls.date);

                  return (
                    <div
                      key={cls.id}
                      style={{
                        background: '#101216',
                        border: isToday ? '1px solid rgba(225, 194, 86, 0.3)' : '1px solid #1f232b',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        justifyContent: 'space-between',
                        boxShadow: isToday ? '0 4px 20px rgba(0, 0, 0, 0.4)' : 'none'
                      }}
                    >
                      {/* Top Badges: Category + Date + Time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: 'rgba(225, 194, 86, 0.15)',
                          color: '#e1c256',
                          border: '1px solid rgba(225, 194, 86, 0.3)'
                        }}>
                          {cls.category === 'Studio Class' ? (cls.name?.toLowerCase().includes('yoga') ? 'Yoga & Recovery' : 'HIIT Conditioning') : (cls.category || cls.type || 'Group Fitness')}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            background: isToday ? 'rgba(101, 130, 86, 0.15)' : 'rgba(247, 255, 196, 0.15)',
                            color: isToday ? '#658256' : '#f7ffc4',
                            border: isToday ? '1px solid rgba(101, 130, 86, 0.3)' : '1px solid rgba(247, 255, 196, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Calendar size={11} /> {dateLabel} {cls.date && cls.date !== dateLabel ? `• ${cls.date}` : ''}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#e1c256', fontWeight: 800 }}>
                            {cls.time}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            title="Cancel / Remove Scheduled Class"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: '4px',
                              transition: 'color 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          {cls.name}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                          Location: <strong style={{ color: '#cbd5e1' }}>{cls.room}</strong> • Assigned Coach: <strong style={{ color: '#e1c256' }}>{cls.instructor || cls.coach_name}</strong>
                        </p>
                      </div>

                      {(() => {
                        const currentRoster = getCoachClassRoster(cls);
                        const enrolledCount = currentRoster.length || cls.enrolled_count || (Array.isArray(cls.enrolled) ? cls.enrolled.length : 0);
                        const checkedCount = currentRoster.filter(a => a.status === 'Checked In').length;

                        return (
                          <>
                            <div style={{
                              padding: '14px',
                              borderRadius: '12px',
                              background: '#16191f',
                              border: '1px solid #232938',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>
                                <span>Roster: {enrolledCount} / {cls.capacity} Athletes</span>
                                <span style={{ color: checkedCount > 0 ? '#658256' : (isToday ? '#e1c256' : '#f7ffc4') }}>
                                  {isToday
                                    ? `${checkedCount} / ${enrolledCount} Verified on Floor`
                                    : `${enrolledCount} Confirmed for Booking`}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                                {currentRoster.slice(0, 5).map((ath, idx) => {
                                  const isChecked = ath.status === 'Checked In';
                                  return (
                                    <div key={ath.id || idx} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: '0.75rem',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: '#0d0f14',
                                      border: isChecked ? '1px solid rgba(101, 130, 86, 0.3)' : '1px solid #1a202c'
                                    }}>
                                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{ath.name || ath}</span>
                                      <span style={{
                                        fontSize: '0.6875rem',
                                        color: isChecked ? '#658256' : '#e1c256',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        {isChecked ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                        {ath.status || 'Confirmed'}
                                        {isChecked && ath.checkInTime && (
                                          <span style={{ color: '#94a3b8', fontSize: '0.625rem' }}>({ath.checkInTime})</span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                                {currentRoster.length > 5 && (
                                  <div style={{ fontSize: '0.6875rem', color: '#64748b', textAlign: 'center', paddingTop: '2px' }}>
                                    + {currentRoster.length - 5} more athletes enrolled
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ marginTop: '8px' }}>
                              {isClassConcluded(cls) ? (
                                <div style={{
                                  width: '100%',
                                  height: '38px',
                                  padding: '0 16px',
                                  borderRadius: '8px',
                                  fontSize: '0.8125rem',
                                  fontWeight: 700,
                                  background: '#161922',
                                  color: '#94a3b8',
                                  border: '1px solid #283044',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  boxSizing: 'border-box'
                                }}>
                                  <CheckCircle2 size={16} color="#658256" />
                                  <span>Class Concluded • Roll Call Closed</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCoachRollCall(cls)}
                                  style={{
                                    width: '100%',
                                    height: '38px',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 800,
                                    background: '#e1c256',
                                    color: '#000000',
                                    border: '1px solid #e1c256',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '0 2px 8px rgba(225, 194, 86, 0.25)',
                                    transition: 'all 0.15s ease',
                                    boxSizing: 'border-box'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#cbaa42';
                                    e.currentTarget.style.borderColor = '#cbaa42';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#e1c256';
                                    e.currentTarget.style.borderColor = '#e1c256';
                                  }}
                                >
                                  <UserCheck size={16} style={{ color: '#000000', flexShrink: 0 }} />
                                  <span>Open Roll Call</span>
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW 5: COMMISSIONS & EARNINGS TELEMETRY */}
      {/* ========================================================================= */}
      {activeSection === 'commissions' && (() => {
        const assignedClientIds = new Set((clients || []).map(c => String(c.id || c.client_id || c.member_id)));
        const assignedClientNames = new Set((clients || []).map(c => String(c.name || c.client_name || '').toLowerCase()));
        const rawSalesList = Array.isArray(commissions?.salesCommissions) ? commissions.salesCommissions : [];
        const salesList = rawSalesList.filter(sc => {
          const isCoach = !sc.coach_id || String(sc.coach_id) === String(user?.id) || (sc.coach_name && user?.name && String(sc.coach_name).toLowerCase().includes(String(user.name).toLowerCase()));
          if (!isCoach) return false;
          if (assignedClientIds.size > 0 || assignedClientNames.size > 0) {
            const isClient = (sc.client_id && assignedClientIds.has(String(sc.client_id))) ||
                             (sc.client_name && assignedClientNames.has(String(sc.client_name).toLowerCase()));
            return isClient;
          }
          return true;
        });
        const salesTotal = salesList.reduce((sum, sc) => sum + (Number(sc.commission_earned) || 0), 0);
        const servicingTotal = Number(commissions?.servicingCommissionTotal !== undefined ? commissions.servicingCommissionTotal : (sessions.reduce((acc, s) => acc + (Number(s.commission_earned) || 500), 0)));
        const calculatedPtShare = servicingTotal;
        const calculatedTierBonus = Number(commissionSlip?.tier_bonus !== undefined ? commissionSlip.tier_bonus : (commissions?.tierBonus !== undefined ? commissions.tierBonus : (sessions.length >= 10 ? 2500 : 0)));
        const calculatedStipend = Number(commissionSlip?.group_class_stipend !== undefined ? commissionSlip.group_class_stipend : (commissions?.groupClassStipend !== undefined ? commissions.groupClassStipend : 0));
        const calculatedGross = salesTotal + servicingTotal + calculatedTierBonus + calculatedStipend;
        const calculatedTax = Math.round(calculatedGross * 0.10 * 100) / 100;
        const calculatedNet = Math.round((calculatedGross - calculatedTax) * 100) / 100;
        const milestoneInfo = commissions?.milestoneTier || {};
        const sessionsCount = commissions?.sessionsCount !== undefined ? commissions.sessionsCount : sessions.length;

        const handleExportCompensationExcel = () => {
          const coachName = user?.name || 'Coach Sofia Reyes';
          const coachEmail = user?.email || 'sofia.reyes@ksynfitness.ph';
          const branchName = user?.branch_name || 'Makati Flagship Branch';
          const slipNumber = commissionSlip?.slip_number || 'SLIP-202610-001';
          const period = 'October 2026';
          const exportedDate = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const rows = [
            ['KSYN FITCONNECT PHILIPPINES'],
            ['OFFICIAL CONTRACTOR COMPENSATION SLIP & BIR FORM 2307 WITHHOLDING STATEMENT'],
            ['CONFIDENTIAL FINANCIAL & TAX COMPLIANCE RECORD'],
            [''],
            ['COMPENSATION SLIP REF:', slipNumber, '', 'PAY PERIOD:', period, '', 'DATE GENERATED:', exportedDate],
            ['COACH / CONTRACTOR:', coachName, '', 'BRANCH LOCATION:', branchName, '', 'EMAIL ADDRESS:', coachEmail],
            ['TIN (TAX IDENTIFICATION):', '409-881-230-000', '', 'ATC CODE:', 'WI 010 (Professional Services Contractor)', '', 'STATUS:', 'APPROVED & CERTIFIED'],
            [''],
            ['========================================================================================================================'],
            ['PART I: EARNINGS & STATUTORY TAX WITHHOLDING SUMMARY'],
            ['========================================================================================================================'],
            ['COMPENSATION COMPONENT', 'DESCRIPTION / BASIS', 'GROSS AMOUNT (PHP)', 'BIR 2307 WITHHOLDING (10%)', 'NET ACCRUAL (PHP)'],
            ['Gross PT 1-on-1 Sessions Split', '60% Professional Contractor Share', Number(calculatedPtShare).toFixed(2), `-${(calculatedPtShare * 0.1).toFixed(2)}`, (calculatedPtShare * 0.9).toFixed(2)],
            ['Group Fitness Class Stipends', 'Floor Rota Scheduled Classes', Number(calculatedStipend).toFixed(2), `-${(calculatedStipend * 0.1).toFixed(2)}`, (calculatedStipend * 0.9).toFixed(2)],
            ['Tier Milestone Performance Bonus', 'Verified Volume Bonus', Number(calculatedTierBonus).toFixed(2), `-${(calculatedTierBonus * 0.1).toFixed(2)}`, (calculatedTierBonus * 0.9).toFixed(2)],
            ['Package Sales Commission', 'Direct Athlete Referrals', Number(salesTotal).toFixed(2), `-${(salesTotal * 0.1).toFixed(2)}`, (salesTotal * 0.9).toFixed(2)],
            ['------------------------------------------------------------------------------------------------------------------------'],
            ['TOTAL GROSS CONTRACTOR COMPENSATION:', '', Number(calculatedGross).toFixed(2), '', ''],
            ['TOTAL BIR FORM 2307 CREDITABLE TAX WITHHELD (10%):', '', '', `-${Number(calculatedTax).toFixed(2)}`, ''],
            ['NET TAKE-HOME PAYABLE (DIRECT BANK DISBURSEMENT):', '', '', '', Number(calculatedNet).toFixed(2)],
            [''],
            ['========================================================================================================================'],
            ['PART II: ITEMIZED VERIFIED 1-ON-1 PT SESSIONS LEDGER'],
            ['========================================================================================================================'],
            ['SESSION REF', 'ATHLETE / MEMBER CLIENT', 'SESSION DATE & TIME', 'DURATION', 'WORKOUT FOCUS', 'RPE', 'SESSION RATE (PHP)', 'GROSS SHARE 60% (PHP)', 'BIR 2307 TAX 10% (PHP)', 'NET ACCRUAL (PHP)', 'STATUS']
          ];

          sessions.forEach((s) => {
            const grossShare = Number(s.commission_earned !== undefined ? s.commission_earned : (Number(s.session_rate || 1000) * 0.6));
            const tax = Math.round(grossShare * 0.10 * 100) / 100;
            const net = Math.round((grossShare - tax) * 100) / 100;
            rows.push([
              s.id || s.reference_no || 'SES-01',
              s.athlete_name || s.member_name || 'Athlete Member',
              s.date || s.created_at || 'Oct 2026',
              s.duration || '60 mins',
              s.workout_focus || s.focus || 'Strength & Conditioning',
              s.rpe ? `RPE ${s.rpe}` : 'RPE 8',
              Number(s.session_rate || 1000).toFixed(2),
              grossShare.toFixed(2),
              `-${tax.toFixed(2)}`,
              net.toFixed(2),
              s.status || 'Verified Completed'
            ]);
          });

          rows.push(
            [''],
            ['========================================================================================================================'],
            ['PART III: STATUTORY CERTIFICATION & TAX FILING ATTESTATION'],
            ['========================================================================================================================'],
            ['PREPARED & VERIFIED BY:', 'Branch Finance & Payroll Comptroller', '', 'DATE AUDITED:', exportedDate],
            ['CONTRACTOR CERTIFICATION:', `I, ${coachName}, hereby attest under penalty of perjury that all professional personal training sessions and compensation listed above are true and complete.`, '', '', ''],
            ['BIR FORM 2307 NOTICE:', 'This compensation statement serves as an official BIR Form 2307 Certificate of Creditable Tax Withheld at Source for Philippine income tax filing.', '', '', ''],
            ['SECURITY AUDIT HASH:', `KSYN-SLIP-${slipNumber}-${Date.now().toString().slice(-6)}`, '', '', '']
          );

          const csvContent = rows.map(r => 
            r.map(val => {
              const str = String(val ?? '');
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          ).join('\r\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `KSYN_Compensation_Slip_BIR2307_${coachName.replace(/\s+/g, '_')}_${slipNumber}.csv`;
          link.click();
          toast.success('Official Compensation Slip & BIR 2307 statement exported to Excel (.csv) successfully.', 'Excel Export Ready');
        };

        return (
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid #1f232b'
            }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PAYOUT CYCLE
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 0' }}>
                  {commissions?.month || 'October 2026'} Performance Accrual (Sales & Servicing)
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await loadCoachData();
                      setRefreshedCommissionsFeedback(true);
                      toast.success('Commissions telemetry refreshed!', 'Commissions Synced');
                      setTimeout(() => setRefreshedCommissionsFeedback(false), 3000);
                    }}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8125rem' }}
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    Refresh Commissions
                  </button>
                  {refreshedCommissionsFeedback && (
                    <span className="badge badge-active text-xs">
                      Refreshed just now
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Accrued Payout</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace', marginTop: '2px' }}>
                    ₱{calculatedGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Telemetry Metric Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px'
            }}>
              {/* Sales Commission Card */}
              <div style={{ padding: '18px', borderRadius: '12px', background: '#16191f', border: '1px solid #e1c256' }}>
                <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  1. Sales Commission (15%)
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                  ₱{salesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  {salesList.length} PT package(s) closed
                </div>
              </div>

              {/* Servicing Commission Card */}
              <div style={{ padding: '18px', borderRadius: '12px', background: '#16191f', border: '1px solid #658256' }}>
                <span style={{ fontSize: '0.75rem', color: '#658256', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  2. Servicing Commission
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                  ₱{servicingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  {sessionsCount} workout sessions serviced
                </div>
              </div>

              {/* Tier Bonus & Stipend Card */}
              <div style={{ padding: '18px', borderRadius: '12px', background: '#16191f', border: '1px solid #232938' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Tier Bonus & Class Stipend
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#f7ffc4' }}>
                  ₱{(calculatedTierBonus + calculatedStipend).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  Bonus: ₱{calculatedTierBonus.toLocaleString()} • Stipend: ₱{calculatedStipend.toLocaleString()}
                </div>
              </div>

              {/* Milestone Level Indicator */}
              <div style={{ padding: '18px', borderRadius: '12px', background: '#16191f', border: '1px solid #232938' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Active Milestone Tier
                </span>
                <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#e1c256' }}>
                  {milestoneInfo.tier_level || 'Junior / Entry Level'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#658256', marginTop: '4px' }}>
                  {milestoneInfo.active_servicing_rate_percent || 20}% servicing rate active
                </div>
              </div>
            </div>

            {/* Monthly Milestone Tier Scaling Guide */}
            <div style={{
              background: '#16191f',
              border: '1px solid #232938',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} color="#e1c256" />
                    <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1rem', margin: 0 }}>
                      Monthly Milestone Tiers & Servicing Commission Rate Scaling
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                    Servicing rates scale up dynamically based on total monthly sessions serviced across all athletes.
                  </p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '12px', background: '#0d0f14', border: '1px solid #e1c256', color: '#e1c256', fontSize: '0.75rem', fontWeight: 800 }}>
                  Current Rate: {milestoneInfo.active_servicing_rate_percent || 20}%
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                  <span style={{ color: '#94a3b8' }}>Monthly Progress: {sessionsCount} sessions serviced</span>
                  <span style={{ color: '#e1c256' }}>
                    {milestoneInfo.sessions_needed_for_next > 0
                      ? `${milestoneInfo.sessions_needed_for_next} more to ${milestoneInfo.next_tier}`
                      : 'Senior / Master Trainer Tier Achieved!'}
                  </span>
                </div>
                <div style={{ width: '100%', background: '#0d0f14', height: '10px', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #658256 0%, #e1c256 100%)',
                      height: '100%',
                      borderRadius: '999px',
                      width: `${Math.min(100, Math.round((sessionsCount / 101) * 100))}%`,
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
              </div>

              {/* 3-Tier Matrix */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                paddingTop: '6px'
              }}>
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: sessionsCount <= 50 ? 'rgba(225, 194, 86, 0.08)' : '#0d0f14',
                  border: sessionsCount <= 50 ? '1px solid #e1c256' : '1px solid #1a202c'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>Junior / Entry Level</span>
                    {sessionsCount <= 50 && <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', background: '#e1c256', color: '#000', fontWeight: 800 }}>ACTIVE</span>}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block', margin: '4px 0' }}>1 to 50 sessions</span>
                  <span style={{ color: '#658256', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.875rem' }}>15% – 20%</span>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>~₱150 – ₱200/hr serviced</div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: (sessionsCount > 50 && sessionsCount <= 100) ? 'rgba(225, 194, 86, 0.08)' : '#0d0f14',
                  border: (sessionsCount > 50 && sessionsCount <= 100) ? '1px solid #e1c256' : '1px solid #1a202c'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>Mid-Tier Trainer</span>
                    {(sessionsCount > 50 && sessionsCount <= 100) && <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', background: '#e1c256', color: '#000', fontWeight: 800 }}>ACTIVE</span>}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block', margin: '4px 0' }}>51 to 100 sessions</span>
                  <span style={{ color: '#e1c256', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.875rem' }}>25% – 30%</span>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>~₱250 – ₱300/hr serviced</div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: sessionsCount > 100 ? 'rgba(225, 194, 86, 0.08)' : '#0d0f14',
                  border: sessionsCount > 100 ? '1px solid #e1c256' : '1px solid #1a202c'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>Senior / Master Trainer</span>
                    {sessionsCount > 100 && <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', background: '#e1c256', color: '#000', fontWeight: 800 }}>ACTIVE</span>}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block', margin: '4px 0' }}>101+ sessions</span>
                  <span style={{ color: '#f7ffc4', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.875rem' }}>35% – 40%</span>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>~₱350 – ₱400/hr serviced</div>
                </div>
              </div>
            </div>

            {/* Closed Package Sales Commissions Table (FILO, Scoped by Month with Scrollbar & Search) */}
            {salesList.length > 0 && (() => {
              const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g., '2026-10'
              const filteredSales = salesList
                .filter(sc => {
                  if (salesCommissionFilter !== 'all') {
                    const scMonth = sc.date ? new Date(sc.date).toISOString().slice(0, 7) : currentMonthStr;
                    if (scMonth !== currentMonthStr) return false;
                  }
                  if (salesCommissionSearch.trim()) {
                    const q = salesCommissionSearch.toLowerCase();
                    const matchAthlete = (sc.client_name || '').toLowerCase().includes(q);
                    const matchPlan = (sc.package_name || '').toLowerCase().includes(q);
                    if (!matchAthlete && !matchPlan) return false;
                  }
                  return true;
                })
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)); // FILO (First In, Last Out - Latest on top)

              const activeSalesTotal = filteredSales.reduce((sum, sc) => sum + (Number(sc.commission_earned) || 0), 0);

              return (
                <div style={{
                  background: '#16191f',
                  border: '1px solid #232938',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Banknote size={18} color="#e1c256" /> Closed PT Package Sales Commissions (15%)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSalesCommissionFilter(prev => prev === 'all' ? 'this_month' : 'all')}
                        className="ksyn-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          background: salesCommissionFilter === 'this_month' ? 'rgba(225, 194, 86, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: salesCommissionFilter === 'this_month' ? '#e1c256' : '#94a3b8',
                          border: `1px solid ${salesCommissionFilter === 'this_month' ? '#e1c256' : '#334155'}`,
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        {salesCommissionFilter === 'this_month' ? 'This Month (October 2026)' : 'All-Time Records'}
                      </button>
                      <input
                        type="text"
                        placeholder="Search commission by athlete or package..."
                        value={salesCommissionSearch}
                        onChange={(e) => setSalesCommissionSearch(e.target.value)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          background: '#0d0f14',
                          border: '1px solid #232938',
                          borderRadius: '6px',
                          color: '#ffffff',
                          outline: 'none',
                          minWidth: '200px'
                        }}
                      />
                    </div>

                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#658256', fontFamily: 'monospace' }}>
                      Total: ₱{activeSalesTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Scrollable Container - Bounded to ~3 rows with Scrollbar */}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '185px', border: '1px solid #1f2433', borderRadius: '8px' }} className="ksyn-custom-scrollbar">
                    <table className="ksyn-table" style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#10131a', zIndex: 5 }}>
                        <tr>
                          <th>Athlete</th>
                          <th>Package Plan</th>
                          <th>Package Amount</th>
                          <th>Rate</th>
                          <th>Commission Earned</th>
                          <th>Date Cleared</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              No commission records found for this period.
                            </td>
                          </tr>
                        ) : (
                          filteredSales.map((sc) => (
                            <tr key={sc.id || sc.client_id}>
                              <td style={{ fontWeight: 700, color: '#fff' }}>{sc.client_name}</td>
                              <td>{sc.package_name}</td>
                              <td className="mono">₱{Number(sc.package_amount).toLocaleString()}</td>
                              <td><span className="badge badge-active">{sc.commission_rate}%</span></td>
                              <td className="mono" style={{ fontWeight: 800, color: '#658256' }}>+₱{Number(sc.commission_earned).toLocaleString()}</td>
                              <td style={{ color: '#94a3b8' }}>{new Date(sc.date).toLocaleDateString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          {/* SPRINT 4: Itemized Commission Slip with 10% BIR Form 2307 Withholding Tax */}
          <div style={{
            background: '#16191f',
            border: '1px solid #658256',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #232938', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#658256" />
                  <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.125rem', margin: 0 }}>
                    Official Compensation Slip & BIR Form 2307 Withholding Statement
                  </h3>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                  Itemized performance ledger with statutory 10% BIR Form 2307 creditable withholding tax deducted.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="mono" style={{ fontSize: '0.75rem', color: '#658256', background: 'rgba(101, 130, 86, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(101, 130, 86, 0.3)' }}>
                  {commissionSlip?.slip_number || 'SLIP-202610-001'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    generateCoachPayslipPdf({
                      coach: user || { name: 'Coach Marcus Reyes', specialty: 'Personal Trainer & Performance Coach' },
                      commissionSlip: commissionSlip || { slip_number: 'SLIP-202611-001', pt_session_split: calculatedPtShare, group_class_stipend: calculatedStipend, tier_bonus: calculatedTierBonus },
                      commissions: commissions || { month: 'November 2026', sessionsCount: 12, servicingCommissionTotal: calculatedPtShare },
                      branch: { name: user?.branch_name || 'KSYN Fitness Katipunan' }
                    });
                    toast.success('Official Coach Commission Payslip PDF generated & downloaded!', 'Payslip Exported');
                  }}
                  className="ksyn-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    background: '#e1c256',
                    color: '#000000',
                    border: '1px solid #d4af37',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} /> Commission Payslip (PDF)
                </button>
                <button
                  type="button"
                  onClick={handleExportCompensationExcel}
                  className="ksyn-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    background: '#15803d',
                    color: '#ffffff',
                    border: '1px solid #16a34a',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <FileSpreadsheet size={13} /> Export to Excel (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => setShowBir2307Modal(true)}
                  className="ksyn-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    background: '#1f2433',
                    color: '#ffffff',
                    border: '1px solid #3b4256'
                  }}
                >
                  <Printer size={13} /> Print Certificate
                </button>
              </div>
            </div>

            {/* Calculations Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#0d0f14', padding: '14px', borderRadius: '10px', border: '1px solid #1a202c' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Gross PT Session Split</span>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                  ₱{calculatedPtShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>60% Contractor Share</span>
              </div>

              <div style={{ background: '#0d0f14', padding: '14px', borderRadius: '10px', border: '1px solid #1a202c' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Group Class & Bonus Stipend</span>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e1c256', marginTop: '4px' }}>
                  +₱{(calculatedStipend + calculatedTierBonus).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Classes + Tier Milestone</span>
              </div>

              <div style={{ background: '#0d0f14', padding: '14px', borderRadius: '10px', border: '1px solid #1a202c' }}>
                <span style={{ fontSize: '0.6875rem', color: '#ef4444', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                  BIR Form 2307 Withholding (10%)
                </span>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                  -₱{calculatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Creditable Tax Withheld</span>
              </div>

              <div style={{ background: 'rgba(101, 130, 86, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(101, 130, 86, 0.4)' }}>
                <span style={{ fontSize: '0.6875rem', color: '#658256', textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>
                  NET TAKE-HOME PAY (PHP)
                </span>
                <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256', marginTop: '2px' }}>
                  ₱{calculatedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#d1fae5' }}>Direct Bank Deposit Ready</span>
              </div>
            </div>

            {/* Unified 1-on-1 Sessions History & Commission Breakdown */}
            <div
              id="coach-sessions-ledger"
              style={{
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Verified 1-on-1 Personal Training Sessions & Commission History
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0' }}>
                    All verified coaching sessions conducted by Coach Sofia with 10% BIR 2307 withholding breakdown.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogSessionModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    background: '#e1c256',
                    color: '#000000',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 0 16px rgba(225, 194, 86, 0.2)'
                  }}
                >
                  <Plus size={15} /> Log Verified Session
                </button>
              </div>

              {/* Controls Bar: Search, FILO, Month Filter & Overall All-Time Earnings */}
              {(() => {
                const currentMonthIso = new Date().toISOString().slice(0, 7);
                const allTimeNetEarnings = sessions.reduce((acc, s) => {
                  const gross = Number(s.commission_earned || s.coach_earned || 570);
                  const tax = Math.round(gross * 0.10 * 100) / 100;
                  return acc + (gross - tax);
                }, 0);

                const filteredSessions = sessions
                  .filter(s => {
                    const sDate = s.session_date || s.created_at;
                    if (sessionHistoryTimeframe === 'this_month') {
                      const m = sDate ? new Date(sDate).toISOString().slice(0, 7) : currentMonthIso;
                      if (m !== currentMonthIso) return false;
                    }
                    if (sessionHistorySearch.trim()) {
                      const q = sessionHistorySearch.toLowerCase();
                      const matchClient = (s.client_name || s.client || '').toLowerCase().includes(q);
                      const matchFocus = (s.workout_focus || s.focus || '').toLowerCase().includes(q);
                      const matchNotes = (s.notes || '').toLowerCase().includes(q);
                      if (!matchClient && !matchFocus && !matchNotes) return false;
                    }
                    return true;
                  })
                  .sort((a, b) => new Date(b.session_date || b.created_at || 0) - new Date(a.session_date || a.created_at || 0)); // FILO (Latest First)

                const activeNetEarnings = filteredSessions.reduce((acc, s) => {
                  const gross = Number(s.commission_earned || s.coach_earned || 570);
                  const tax = Math.round(gross * 0.10 * 100) / 100;
                  return acc + (gross - tax);
                }, 0);

                return (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      background: '#12141a',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #1f2430'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px', minWidth: '240px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="text"
                            placeholder="Search sessions by athlete, focus, notes..."
                            value={sessionHistorySearch}
                            onChange={(e) => setSessionHistorySearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px 8px 34px',
                              background: '#0d0f14',
                              border: '1px solid #232938',
                              borderRadius: '8px',
                              color: '#ffffff',
                              fontSize: '0.8125rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Overall All-Time Earnings Modal Trigger Button */}
                        <button
                          type="button"
                          onClick={() => setShowAllTimeEarningsModal(true)}
                          className="ksyn-btn"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            background: 'rgba(225, 194, 86, 0.15)',
                            color: '#e1c256',
                            border: '1px solid #e1c256',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Open overall all-time earnings ledger modal with month/year and athlete name filters"
                        >
                          <Award size={14} color="#e1c256" />
                          View Overall All-Time Earnings
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          This Month Net:
                        </span>
                        <span className="mono" style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#658256' }}>
                          ₱{activeNetEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Scrollable Container - Bounded to ~3 rows with Scrollbar */}
                    <div style={{
                      overflowX: 'auto',
                      overflowY: 'auto',
                      maxHeight: '215px',
                      width: '100%',
                      border: '1px solid #232938',
                      borderRadius: '12px'
                    }} className="ksyn-custom-scrollbar">
                      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0e111a' }}>
                          <tr style={{ borderBottom: '1px solid #232938', color: '#94a3b8', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Date & Time</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Athlete Client</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Duration</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Workout Focus</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>RPE</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Session Rate & Split</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Gross Share</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right', color: '#ef4444' }}>10% BIR 2307</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right', color: '#658256' }}>Net Payout</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSessions.length === 0 ? (
                            <tr>
                              <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                                <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto', color: '#e1c256' }} />
                                <p style={{ margin: 0, fontWeight: 700, color: '#e2e8f0' }}>No verified 1-on-1 PT sessions found for this view.</p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>Adjust your search filter or click &quot;View Overall All-Time Earnings&quot; to review historical cycles.</p>
                              </td>
                            </tr>
                          ) : (
                            filteredSessions.map((s, idx) => {
                              const sessionPrice = Number(s.session_rate || s.session_price || 950);
                              const splitPct = Number(s.coach_split_percentage || (s.split_pct ? s.split_pct.replace('%', '') : 60));
                              const grossEarned = Number(s.commission_earned || s.coach_earned || Math.round(sessionPrice * (splitPct / 100) * 100) / 100);
                              const taxWithheld = Math.round(grossEarned * 0.10 * 100) / 100;
                              const netEarned = Math.round((grossEarned - taxWithheld) * 100) / 100;

                              return (
                                <tr key={s.id || s.session_id || idx} style={{ borderBottom: '1px solid #16191f', transition: 'background 0.15s ease' }}>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {new Date(s.session_date || s.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 800, color: '#ffffff' }}>
                                    {s.client_name || s.client || 'Enrolled Athlete'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                                    {s.duration_mins || 60} mins
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#e2e8f0' }}>
                                    {s.workout_focus || s.focus || 'Strength & Conditioning Split'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.6875rem',
                                      fontWeight: 800,
                                      background: (s.rpe_intensity || 8) >= 9 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                                      color: (s.rpe_intensity || 8) >= 9 ? '#ef4444' : '#e1c256'
                                    }}>
                                      RPE {s.rpe_intensity || 8}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                                    ₱{sessionPrice.toLocaleString()} ({splitPct}% split)
                                  </td>
                                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                                    ₱{grossEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: '#ef4444' }}>
                                    -₱{taxWithheld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#658256' }}>
                                    +₱{netEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.6875rem',
                                      fontWeight: 800,
                                      background: 'rgba(101, 130, 86, 0.15)',
                                      color: '#658256',
                                      border: '1px solid rgba(101, 130, 86, 0.3)'
                                    }}>
                                      VERIFIED
                                    </span>
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
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW: COACH PROFILE & PROFESSIONAL CREDENTIALS (activeSection === 'profile_credentials') */}
      {/* ========================================================================= */}
      {activeSection === 'profile_credentials' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Top Section Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            borderBottom: '1px solid #1f232b',
            paddingBottom: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                  Coach Profile & Credentials
                </h1>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: 'rgba(101, 130, 86, 0.15)',
                  color: '#658256',
                  border: '1px solid rgba(101, 130, 86, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <BadgeCheck size={13} /> Verified Instructor
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
                Official Instructor Dossier, Accredited Certifications, and Specialization Profiles
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditProfileForm({
                  title: coachProfile.title,
                  avatar_url: coachProfile.avatar_url || '',
                  phone: coachProfile.phone,
                  bio: coachProfile.bio,
                  experience_years: coachProfile.experience_years,
                  specialties: coachProfile.specialties.join(', ')
                });
                setShowEditProfileModal(true);
              }}
              style={{
                background: '#e1c256',
                color: '#000000',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(225, 194, 86, 0.25)'
              }}
            >
              <Edit2 size={15} /> Edit Profile & Credentials
            </button>
          </div>

          {/* Hero Identity Dossier Card */}
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              {/* Avatar + Main Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{
                  position: 'relative',
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e1c256 0%, #658256 100%)',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(225, 194, 86, 0.25)'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#0d0f14',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256',
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    letterSpacing: '-0.02em'
                  }}>
                    {coachProfile.avatar_url ? (
                      <img
                        src={coachProfile.avatar_url}
                        alt={coachProfile.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      coachProfile.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('')
                    )}
                  </div>
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#658256',
                    border: '2px solid #0d0f14',
                    boxShadow: '0 0 8px #658256'
                  }} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                      {coachProfile.name}
                    </h2>
                    <span style={{ color: '#e1c256', display: 'inline-flex' }}>
                      <BadgeCheck size={18} />
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#e1c256', fontWeight: 700, marginTop: '3px' }}>
                    {coachProfile.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.75rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="#658256" /> {coachProfile.branch_name}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={13} color="#94a3b8" /> {coachProfile.email}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} color="#94a3b8" /> {coachProfile.phone}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics Pills */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{
                  background: '#161922',
                  border: '1px solid #28324a',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#e1c256', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                    <Star size={16} fill="#e1c256" color="#e1c256" /> {coachProfile.rating}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                    {coachProfile.reviews_count} Client Reviews
                  </div>
                </div>

                <div style={{
                  background: '#161922',
                  border: '1px solid #28324a',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#658256', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                    {coachProfile.experience_years}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                    Coaching Tenure
                  </div>
                </div>

                <div style={{
                  background: '#161922',
                  border: '1px solid #28324a',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#ffffff', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                    {clients.length || 8}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                    Active PT Athletes
                  </div>
                </div>
              </div>
            </div>

            {/* Biography & Coaching Philosophy */}
            <div style={{
              background: '#141824',
              border: '1px solid #21293d',
              borderRadius: '12px',
              padding: '16px 20px',
              borderLeft: '4px solid #e1c256'
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Coaching Philosophy & Athlete Mandate
              </div>
              <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                "{coachProfile.bio}"
              </p>
            </div>
          </div>

          {/* 2-Column Grid: Certifications & Specializations */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '24px'
          }}>
            {/* Certifications Card */}
            <div style={{
              background: '#101216',
              border: '1px solid #1f232b',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Accredited Certifications
                  </h3>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    Verified by KSYN Compliance Board & Professional Bodies
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coachProfile.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    style={{
                      background: '#161922',
                      border: '1px solid #232938',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem' }}>
                        {cert.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        {cert.issuer}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
                        Validity: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{cert.year}</span>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: 'rgba(101, 130, 86, 0.15)',
                      color: '#658256',
                      border: '1px solid rgba(101, 130, 86, 0.35)',
                      whiteSpace: 'nowrap'
                    }}>
                      {cert.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Specializations & Focus Disciplines */}
            <div style={{
              background: '#101216',
              border: '1px solid #1f232b',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(101, 130, 86, 0.12)', color: '#658256' }}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Core Coaching Disciplines
                  </h3>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    Focus specializations for athlete matchmaking and PT queues
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {coachProfile.specialties.map((spec, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#161922',
                      border: '1.5px solid #28324a',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i % 2 === 0 ? '#e1c256' : '#658256' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#e2e8f0' }}>
                      {spec}
                    </span>
                  </div>
                ))}
              </div>

              {/* Safety & Compliance Trust Banner */}
              <div style={{
                marginTop: 'auto',
                background: '#12161f',
                border: '1px solid #232b3e',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <ShieldCheck size={26} color="#658256" style={{ shrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>
                    Philippine PT Board & CPR-AED Compliance Verified
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                    Underwritten with comprehensive fitness professional liability coverage across all KSYN facility locations.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* WEEKLY COACH FLOOR ROTA & STUDIO SHIFTS (MULTI-TENANT BRANCH ROTA)         */}
          {/* ========================================================================= */}
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            padding: '22px 24px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Weekly Floor Duty & Studio Shift Schedule
                    </h2>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: (floorRota && floorRota.length > 0) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: (floorRota && floorRota.length > 0) ? '#10b981' : '#eab308',
                      border: (floorRota && floorRota.length > 0) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ShieldCheck size={12} />
                      {(floorRota && floorRota.length > 0)
                        ? `Live ${user?.branch_name || 'Branch'} Duty Rota`
                        : `Awaiting ${user?.branch_name || 'Branch'} Admin Publication`}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    Your assigned floor supervision, studio class shifts, and rest periods synchronized directly with {user?.branch_name || 'branch'} administration.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Facility: <strong style={{ color: '#f1f5f9' }}>{user?.branch_name || 'Assigned Facility'}</strong>
                </span>
              </div>
            </div>

            {(!floorRota || floorRota.length === 0) ? (
              <div style={{
                background: '#0b0d10',
                border: '1px dashed #2d333f',
                borderRadius: '12px',
                padding: '28px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  color: '#e1c256',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px'
                }}>
                  <Calendar size={20} />
                </div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                  No Floor Duty Rota Published for {user?.branch_name || 'This Branch'} Yet
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
                  The {user?.branch_name || 'Branch'} Administrator has not yet configured or published this week's coach duty rota. Once published in the Branch Admin Portal, your assigned shifts and schedule will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Weekly Days Grid with Dates */}
                {(() => {
                  const coachRota = (floorRota || []).find(r => 
                    (r.staff_id && user?.id && r.staff_id === user.id) ||
                    (r.coach_name && user?.name && r.coach_name.toLowerCase().includes(user.name.toLowerCase())) ||
                    (user?.name && r.coach_name && user.name.toLowerCase().includes(r.coach_name.toLowerCase()))
                  ) || null;

                  const now = new Date();
                  const dayOfWeek = now.getDay();
                  const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  const monday = new Date(now);
                  monday.setDate(now.getDate() + distToMon);

                  const dayKeys = [
                    { key: 'monday', label: 'Mon', full: 'Monday' },
                    { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
                    { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
                    { key: 'thursday', label: 'Thu', full: 'Thursday' },
                    { key: 'friday', label: 'Fri', full: 'Friday' },
                    { key: 'saturday', label: 'Sat', full: 'Saturday' },
                    { key: 'sunday', label: 'Sun', full: 'Sunday' }
                  ];

                  const days = dayKeys.map((item, idx) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + idx);
                    const m = d.toLocaleDateString('en-US', { month: 'short' });
                    return {
                      ...item,
                      dateLabel: `${m} ${d.getDate()}`
                    };
                  });

                  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      {days.map(d => {
                        const shiftVal = coachRota ? coachRota[d.key] : 'Rest / Off-Duty';
                        const isOff = !shiftVal || shiftVal.toLowerCase().includes('rest') || shiftVal.toLowerCase().includes('off');
                        const isToday = currentDayName === d.key;

                        return (
                          <div
                            key={d.key}
                            style={{
                              background: isToday ? 'rgba(225, 194, 86, 0.08)' : '#0b0d10',
                              border: isToday ? '1px solid #e1c256' : isOff ? '1px solid #1f232b' : '1px solid rgba(16, 185, 129, 0.35)',
                              borderRadius: '12px',
                              padding: '12px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              position: 'relative'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: isToday ? '#e1c256' : '#94a3b8'
                              }}>
                                {d.label} • {d.dateLabel} {isToday && '• TODAY'}
                              </span>
                              {!isOff ? (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                              ) : (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569' }} />
                              )}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: isOff ? 500 : 700,
                              color: isOff ? '#64748b' : '#f8fafc',
                              lineHeight: 1.35
                            }}>
                              {shiftVal || 'Rest / Off-Duty'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Full Facility Staff & Coach Floor Duty Rota (Strictly excluding admin/owner roles & mock personnel) */}
                {(() => {
                  const eligibleRota = (floorRota || []).filter(r => {
                    const role = String(r.staff_role || r.role || '').toLowerCase();
                    const name = String(r.coach_name || '').toLowerCase();
                    return !['super_admin', 'superadmin', 'branch_owner', 'branchadmin', 'branch_admin', 'investor'].includes(role) &&
                      !name.includes('owner') && !name.includes('super admin') && !name.includes('admin');
                  });

                  const now = new Date();
                  const dayOfWeek = now.getDay();
                  const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  const monday = new Date(now);
                  monday.setDate(now.getDate() + distToMon);

                  const tableDays = [
                    { key: 'monday', label: 'Mon' },
                    { key: 'tuesday', label: 'Tue' },
                    { key: 'wednesday', label: 'Wed' },
                    { key: 'thursday', label: 'Thu' },
                    { key: 'friday', label: 'Fri' },
                    { key: 'saturday', label: 'Sat' },
                    { key: 'sunday', label: 'Sun' }
                  ].map((item, idx) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + idx);
                    const m = d.toLocaleDateString('en-US', { month: 'short' });
                    return {
                      ...item,
                      headerLabel: `${item.label} (${m} ${d.getDate()})`
                    };
                  });

                  return (
                    <div style={{ borderTop: '1px solid #1f232b', paddingTop: '16px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{user?.branch_name || 'Branch'} Facility Floor Duty Rota ({eligibleRota.length} Instructors & Staff On-Duty):</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Frontline Personnel Only</span>
                      </div>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1f232b' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#141820', color: '#94a3b8', borderBottom: '1px solid #1f232b' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 700 }}>Personnel / Specialty</th>
                              {tableDays.map(d => (
                                <th key={d.key} style={{ padding: '8px', fontWeight: 700 }}>{d.headerLabel}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {eligibleRota.map((row, idx) => {
                              const isMe = (row.staff_id && user?.id && row.staff_id === user.id) ||
                                (row.coach_name && user?.name && row.coach_name.toLowerCase().includes(user.name.toLowerCase())) ||
                                (user?.name && row.coach_name && user.name.toLowerCase().includes(row.coach_name.toLowerCase()));

                              return (
                                <tr
                                  key={row.id || idx}
                                  style={{
                                    borderBottom: '1px solid #1a1e27',
                                    background: isMe
                                      ? 'rgba(225, 194, 86, 0.14)'
                                      : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'),
                                    boxShadow: isMe ? 'inset 3px 0 0 #e1c256' : 'none'
                                  }}
                                >
                                  <td style={{ padding: '8px 12px', color: '#ffffff', fontWeight: 700 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{row.coach_name}</span>
                                      {isMe && (
                                        <span style={{
                                          fontSize: '0.625rem',
                                          background: '#e1c256',
                                          color: '#000000',
                                          fontWeight: 800,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          letterSpacing: '0.04em'
                                        }}>
                                          YOU (ACTIVE INSTRUCTOR)
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: isMe ? '#e1c256' : '#94a3b8', fontWeight: 500 }}>
                                      {row.specialty || row.staff_role}
                                    </div>
                                  </td>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                    const val = row[day] || 'Rest';
                                    const isRest = val.toLowerCase().includes('rest') || val.toLowerCase().includes('off');
                                    return (
                                      <td
                                        key={day}
                                        style={{
                                          padding: '8px',
                                          color: isRest ? '#64748b' : (isMe ? '#fef08a' : '#38bdf8'),
                                          fontSize: '0.7rem',
                                          fontWeight: isMe ? 700 : 500
                                        }}
                                      >
                                        {val}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                            {eligibleRota.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                  No floor rota entries published for {user?.branch_name || 'this branch'} yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT COACH PROFILE & CREDENTIALS (showEditProfileModal)             */}
      {/* ========================================================================= */}
      {showEditProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#101216',
            border: '1px solid #1f232b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1f232b', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="#e1c256" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Edit Coach Profile & Bio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const newSpecs = editProfileForm.specialties.split(',').map(s => s.trim()).filter(Boolean);
              try {
                const res = await authFetch('/api/auth/profile', {
                  method: 'PUT',
                  body: JSON.stringify({
                    phone: editProfileForm.phone.trim(),
                    bio: editProfileForm.bio.trim(),
                    title: editProfileForm.title.trim(),
                    avatar_url: editProfileForm.avatar_url || '',
                    profile_image: editProfileForm.avatar_url || '',
                    experience_years: editProfileForm.experience_years.trim(),
                    specialties: newSpecs
                  })
                });
                const data = await res.json();
                if (data.success && data.user) {
                  try { localStorage.setItem('ksyn_user', JSON.stringify(data.user)); } catch (err) {}
                  setCoachProfile(prev => ({
                    ...prev,
                    title: editProfileForm.title.trim(),
                    avatar_url: data.user.avatar_url || editProfileForm.avatar_url || prev.avatar_url,
                    phone: editProfileForm.phone.trim(),
                    bio: editProfileForm.bio.trim(),
                    experience_years: editProfileForm.experience_years.trim(),
                    specialties: newSpecs.length > 0 ? newSpecs : prev.specialties
                  }));
                  setShowEditProfileModal(false);
                  toast.success('Coach credentials and profile picture successfully saved!', 'Profile Saved');
                } else {
                  toast.error(data.message || 'Failed to update profile settings', 'Error');
                }
              } catch (err) {
                toast.error(err.message, 'Network Error');
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Profile Picture Uploader */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px',
                  background: '#161922',
                  borderRadius: '10px',
                  border: '1px solid #28324a'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#0d0f14',
                    border: '2px solid #e1c256',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {editProfileForm.avatar_url ? (
                      <img
                        src={editProfileForm.avatar_url}
                        alt="Coach Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <User size={26} color="#e1c256" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>
                      Coach Profile Picture
                    </div>
                    <p style={{ fontSize: '0.6875rem', color: '#94a3b8', margin: '0 0 6px 0' }}>
                      Visible to athletes in PT enrollment and 1-on-1 quick-chat conversation.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label className="ksyn-btn ksyn-btn-outline" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        borderColor: '#e1c256',
                        color: '#e1c256'
                      }}>
                        <Camera size={13} />
                        <span>{editProfileForm.avatar_url ? 'Change Photo' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) {
                              toast.error('Profile photo must be under 3MB', 'File Too Large');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (loadEvt) => {
                              setEditProfileForm(prev => ({ ...prev, avatar_url: loadEvt.target.result }));
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {editProfileForm.avatar_url && (
                        <button
                          type="button"
                          onClick={() => setEditProfileForm(prev => ({ ...prev, avatar_url: '' }))}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#ef4444'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    Professional Title / Specialization
                  </label>
                  <input
                    type="text"
                    value={editProfileForm.title}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, title: e.target.value })}
                    required
                    style={{ width: '100%', background: '#161922', border: '1px solid #28324a', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={editProfileForm.phone}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                      style={{ width: '100%', background: '#161922', border: '1px solid #28324a', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                      Experience Tenure
                    </label>
                    <input
                      type="text"
                      value={editProfileForm.experience_years}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, experience_years: e.target.value })}
                      style={{ width: '100%', background: '#161922', border: '1px solid #28324a', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    Specialties (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={editProfileForm.specialties}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, specialties: e.target.value })}
                    style={{ width: '100%', background: '#161922', border: '1px solid #28324a', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    Coaching Philosophy & Biography
                  </label>
                  <textarea
                    rows={4}
                    value={editProfileForm.bio}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, bio: e.target.value })}
                    style={{ width: '100%', background: '#161922', border: '1px solid #28324a', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', border: '1px solid #28324a', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 2, padding: '10px', borderRadius: '8px', background: '#e1c256', border: 'none', color: '#000000', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE NEW STUDIO CLASS (showScheduleClassModal)                 */}
      {/* ========================================================================= */}
      {showScheduleClassModal && (
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
            if (e.target === e.currentTarget && !scheduleClassLoading) setShowScheduleClassModal(false);
          }}
        >
          <div
            style={{
              background: '#101216',
              border: '1px solid #1f232b',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #1f232b', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Schedule Group Studio Class
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Coach: <strong style={{ color: '#e1c256' }}>{user?.name || 'Instructor'}</strong> &bull; Synced with Front Desk & Member App
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleClassModal(false)}
                disabled={scheduleClassLoading}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Presets Pills */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                QUICK SELECT SIGNATURE CLASS
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { name: 'Sunrise Vinyasa Flow & Mobility', cat: 'Yoga & Recovery', room: 'Studio A (Recovery Lounge)' },
                  { name: 'Sunset Core Conditioning', cat: 'HIIT Conditioning', room: 'Studio A - Main Athletic Floor' },
                  { name: 'Metabolic Athletic Conditioning', cat: 'HIIT Conditioning', room: 'Studio B (Turf Zone)' },
                  { name: 'High-Energy Rhythmic Cardio', cat: 'Zumba & Dance', room: 'Main Aerobic Stage' },
                  { name: 'Heavy Bag & Striking Circuit', cat: 'Boxing & Strike', room: 'Boxing & Combat Zone' },
                  { name: 'Power Spin & Cycle Circuit', cat: 'HIIT Conditioning', room: 'Spin & Cycle Theater' }
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setClassForm(prev => ({
                        ...prev,
                        name: preset.name,
                        category: preset.cat,
                        type: preset.cat,
                        room: preset.room
                      }));
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: classForm.name === preset.name ? '#e1c256' : '#1c202a',
                      color: classForm.name === preset.name ? '#000000' : '#cbd5e1',
                      border: classForm.name === preset.name ? '1px solid #e1c256' : '1px solid #282f3d',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {preset.name.split(' ')[0]} {preset.name.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleScheduleClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Class Title *
                </label>
                <input
                  type="text"
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="e.g. Sunrise Vinyasa Flow & Mobility"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid #282f3d',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Discipline / Category *
                  </label>
                  <select
                    value={classForm.category}
                    onChange={(e) => setClassForm({ ...classForm, category: e.target.value, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="Yoga & Recovery">Yoga & Recovery</option>
                    <option value="HIIT Conditioning">HIIT Conditioning</option>
                    <option value="Zumba & Dance">Zumba & Dance</option>
                    <option value="Boxing & Strike">Boxing & Strike</option>
                  </select>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    Syncs to Member Schedule filters (Yoga, HIIT, Zumba, Boxing).
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={classForm.date}
                    onChange={(e) => setClassForm({ ...classForm, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Time Slot *
                  </label>
                  <select
                    value={classForm.time}
                    onChange={(e) => setClassForm({ ...classForm, time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="07:00 AM – 08:00 AM">07:00 AM – 08:00 AM</option>
                    <option value="08:30 AM – 09:30 AM">08:30 AM – 09:30 AM</option>
                    <option value="10:00 AM – 11:00 AM">10:00 AM – 11:00 AM</option>
                    <option value="04:00 PM – 05:00 PM">04:00 PM – 05:00 PM</option>
                    <option value="05:30 PM – 06:30 PM">05:30 PM – 06:30 PM</option>
                    <option value="07:00 PM – 08:00 PM">07:00 PM – 08:00 PM</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Studio Room *
                  </label>
                  <select
                    value={classForm.room}
                    onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="Studio A (Recovery Lounge)">Studio A (Recovery Lounge)</option>
                    <option value="Studio B (Turf Zone)">Studio B (Turf Zone)</option>
                    <option value="Main Aerobic Stage">Main Aerobic Stage</option>
                    <option value="Spin & Cycle Theater">Spin & Cycle Theater</option>
                    <option value="Functional Training Bay">Functional Training Bay</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Capacity (Max Attendees) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) || 20 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Intensity Level
                  </label>
                  <select
                    value={classForm.intensity}
                    onChange={(e) => setClassForm({ ...classForm, intensity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid #282f3d',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="All Levels">All Levels (Open to all members)</option>
                    <option value="Beginner Friendly">Beginner Friendly</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="High Intensity">High Intensity / Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Session Focus & Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  placeholder="e.g. Focus on deep core activation, diaphragmatic breathing, and hip mobility."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid #282f3d',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{
                background: 'rgba(225, 194, 86, 0.08)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: '#e1c256',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Sparkles size={16} className="shrink-0" />
                <span>
                  Once published, this class immediately appears on the Front Desk check-in roster and member booking portal.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleClassModal(false)}
                  disabled={scheduleClassLoading}
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
                  disabled={scheduleClassLoading}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#e1c256',
                    border: 'none',
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: scheduleClassLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(225, 194, 86, 0.35)'
                  }}
                >
                  {scheduleClassLoading ? 'Publishing Class...' : 'Publish Studio Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN WORKOUT ROUTINE PROGRAM (showCreatePlanModal) */}
      {/* ========================================================================= */}
      {showCreatePlanModal && (
        <div style={{
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
          padding: '24px 16px',
          overflowY: 'auto'
        }}>
          <div
            style={{
              background: '#12151e',
              border: '1px solid #283044',
              borderRadius: '16px',
              maxWidth: '740px',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #232938' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  border: '1px solid rgba(225, 194, 86, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256'
                }}>
                  <Dumbbell size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Create & Assign Workout Routine</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Design a periodized training program for your enrolled personal training athlete.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkoutPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Select Athlete *
                  </label>
                  <select
                    required
                    value={planForm.client_id}
                    onChange={(e) => setPlanForm({ ...planForm, client_id: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="" style={{ background: '#0d1017', color: '#94a3b8' }}>-- Choose Enrolled Athlete --</option>
                    {clients.map((c) => (
                      <option key={c.id || c.client_id} value={c.client_id} style={{ background: '#0d1017', color: '#ffffff' }}>
                        {c.client_name} ({c.package_plan || 'PT Package'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Split Format
                  </label>
                  <select
                    value={planForm.split_type}
                    onChange={(e) => setPlanForm({ ...planForm, split_type: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Push / Pull / Legs (PPL)" style={{ background: '#0d1017', color: '#ffffff' }}>Push / Pull / Legs (PPL)</option>
                    <option value="Upper / Lower Split" style={{ background: '#0d1017', color: '#ffffff' }}>Upper / Lower Split (4-Day)</option>
                    <option value="Full Body 3-Day Frequency" style={{ background: '#0d1017', color: '#ffffff' }}>Full Body 3-Day Frequency</option>
                    <option value="Glute & Posterior Chain Hypertrophy" style={{ background: '#0d1017', color: '#ffffff' }}>Glute & Posterior Chain Hypertrophy</option>
                    <option value="Powerlifting Peaking Cycle" style={{ background: '#0d1017', color: '#ffffff' }}>Powerlifting Peaking Cycle</option>
                    <option value="HIIT Conditioning & Functional Turf" style={{ background: '#0d1017', color: '#ffffff' }}>HIIT Conditioning & Functional Turf</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Program Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8-Week Hypertrophy & Density Block"
                    value={planForm.title}
                    onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Days / Week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={planForm.days_per_week}
                    onChange={(e) => setPlanForm({ ...planForm, days_per_week: parseInt(e.target.value) || 4 })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Coaching Cues & Guidelines
                </label>
                <textarea
                  rows={2}
                  value={planForm.notes}
                  onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                  placeholder="e.g. Progressive overload on compound lifts. Maintain 2-second negative eccentric tempo."
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Dynamic Exercise Row Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', margin: 0 }}>
                    Exercise Routine Builder ({planForm.exercises.length} Exercises)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddExerciseRow}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(225, 194, 86, 0.12)',
                      color: '#e1c256',
                      border: '1px solid rgba(225, 194, 86, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} /> Add Exercise Row
                  </button>
                </div>

                {/* Exercise Row Column Labels */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 2.5fr) 70px 80px 110px 36px',
                  gap: '8px',
                  padding: '4px 10px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  letterSpacing: '0.04em'
                }}>
                  <span>Exercise Name</span>
                  <span style={{ textAlign: 'center' }}>Sets</span>
                  <span style={{ textAlign: 'center' }}>Reps</span>
                  <span style={{ textAlign: 'center' }}>Target Load</span>
                  <span></span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '16rem', overflowY: 'auto', paddingRight: '4px' }}>
                  {planForm.exercises.map((ex, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0d1017',
                        border: '1px solid #232938',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(180px, 2.5fr) 70px 80px 110px 36px',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
                      <input
                        type="text"
                        required
                        placeholder="Exercise Name"
                        value={ex.name}
                        onChange={(e) => handleExerciseChange(idx, 'name', e.target.value)}
                        style={{
                          background: '#161922',
                          border: '1px solid #2a3142',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '0.8125rem',
                          color: '#ffffff',
                          outline: 'none'
                        }}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Sets"
                        value={ex.sets}
                        onChange={(e) => handleExerciseChange(idx, 'sets', parseInt(e.target.value) || 1)}
                        style={{
                          background: '#161922',
                          border: '1px solid #2a3142',
                          borderRadius: '8px',
                          padding: '8px 6px',
                          fontSize: '0.8125rem',
                          color: '#ffffff',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Reps (8-10)"
                        value={ex.reps}
                        onChange={(e) => handleExerciseChange(idx, 'reps', e.target.value)}
                        style={{
                          background: '#161922',
                          border: '1px solid #2a3142',
                          borderRadius: '8px',
                          padding: '8px 6px',
                          fontSize: '0.8125rem',
                          color: '#ffffff',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Weight (120kg)"
                        value={ex.target_weight}
                        onChange={(e) => handleExerciseChange(idx, 'target_weight', e.target.value)}
                        style={{
                          background: '#161922',
                          border: '1px solid #2a3142',
                          borderRadius: '8px',
                          padding: '8px 6px',
                          fontSize: '0.8125rem',
                          color: '#e1c256',
                          fontWeight: 700,
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {planForm.exercises.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExerciseRow(idx)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ef4444',
                              cursor: 'pointer'
                            }}
                            title="Remove Exercise"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '14px', borderTop: '1px solid #232938' }}>
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    background: '#161922',
                    border: '1px solid #2a3142',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlan}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 900,
                    background: '#e1c256',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 10px rgba(225, 194, 86, 0.25)'
                  }}
                >
                  {submittingPlan ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Assign Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LOG PERSONAL TRAINING SESSION */}
      {/* ========================================================================= */}
      {showLogSessionModal && (
        <div style={{
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
          padding: '24px 16px',
          overflowY: 'auto'
        }}>
          <div
            style={{
              background: '#12151e',
              border: '1px solid #283044',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: '12px', borderBottom: '1px solid #232938' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  border: '1px solid rgba(225, 194, 86, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e1c256'
                }}>
                  <Dumbbell size={18} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Record 1-on-1 PT Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogSessionModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogSessionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Select Athlete *
                </label>
                <select
                  required
                  value={sessionForm.client_id}
                  onChange={(e) => setSessionForm({ ...sessionForm, client_id: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="" style={{ background: '#0d1017', color: '#94a3b8' }}>-- Choose Enrolled Athlete --</option>
                  {clients.map((c) => (
                    <option key={c.id || c.client_id} value={c.client_id} style={{ background: '#0d1017', color: '#ffffff' }}>
                      {c.client_name} ({c.package_plan} — {c.sessions_completed}/{c.sessions_total})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Duration
                  </label>
                  <select
                    value={sessionForm.duration_mins}
                    onChange={(e) => setSessionForm({ ...sessionForm, duration_mins: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value={45} style={{ background: '#0d1017', color: '#ffffff' }}>45 Minutes</option>
                    <option value={60} style={{ background: '#0d1017', color: '#ffffff' }}>60 Minutes (Standard)</option>
                    <option value={90} style={{ background: '#0d1017', color: '#ffffff' }}>90 Minutes (Intensive)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Intensity RPE ({sessionForm.rpe_intensity}/10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={sessionForm.rpe_intensity}
                    onChange={(e) => setSessionForm({ ...sessionForm, rpe_intensity: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#e1c256', marginTop: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Workout Focus & Targets
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Barbell Squats, Bulgarian Split Squats, Core Finish"
                  value={sessionForm.focus}
                  onChange={(e) => setSessionForm({ ...sessionForm, focus: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Structured Exercise & Reps/Sets Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>
                    Structured Workout Splits & Sets/Reps
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionForm({
                        ...sessionForm,
                        exercise_list: [
                          ...sessionForm.exercise_list,
                          { name: 'Barbell Bench Press', sets: 3, reps: 10, weight_kg: 60 }
                        ]
                      });
                    }}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(225, 194, 86, 0.1)',
                      border: '1px solid rgba(225, 194, 86, 0.3)',
                      color: '#e1c256',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={12} /> Add Exercise
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {sessionForm.exercise_list.map((ex, exIdx) => (
                    <div
                      key={exIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 60px 60px 70px 28px',
                        gap: '6px',
                        alignItems: 'center',
                        background: '#0d1017',
                        border: '1px solid #232938',
                        borderRadius: '8px',
                        padding: '6px 8px'
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Exercise name"
                        value={ex.name}
                        onChange={(e) => {
                          const updated = [...sessionForm.exercise_list];
                          updated[exIdx].name = e.target.value;
                          setSessionForm({ ...sessionForm, exercise_list: updated });
                        }}
                        style={{ background: '#161922', border: '1px solid #2a3142', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Sets"
                        value={ex.sets}
                        onChange={(e) => {
                          const updated = [...sessionForm.exercise_list];
                          updated[exIdx].sets = parseInt(e.target.value) || 1;
                          setSessionForm({ ...sessionForm, exercise_list: updated });
                        }}
                        style={{ background: '#161922', border: '1px solid #2a3142', borderRadius: '4px', padding: '6px 4px', color: '#fff', fontSize: '0.75rem', textAlign: 'center', outline: 'none' }}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Reps"
                        value={ex.reps}
                        onChange={(e) => {
                          const updated = [...sessionForm.exercise_list];
                          updated[exIdx].reps = parseInt(e.target.value) || 1;
                          setSessionForm({ ...sessionForm, exercise_list: updated });
                        }}
                        style={{ background: '#161922', border: '1px solid #2a3142', borderRadius: '4px', padding: '6px 4px', color: '#fff', fontSize: '0.75rem', textAlign: 'center', outline: 'none' }}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="kg"
                        value={ex.weight_kg}
                        onChange={(e) => {
                          const updated = [...sessionForm.exercise_list];
                          updated[exIdx].weight_kg = parseFloat(e.target.value) || 0;
                          setSessionForm({ ...sessionForm, exercise_list: updated });
                        }}
                        style={{ background: '#161922', border: '1px solid #2a3142', borderRadius: '4px', padding: '6px 4px', color: '#e1c256', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = sessionForm.exercise_list.filter((_, idx) => idx !== exIdx);
                          setSessionForm({ ...sessionForm, exercise_list: updated });
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.6875rem', color: '#64748b' }}>
                  <span>Cols: Name • Sets • Reps • Weight (kg)</span>
                  <span className="mono" style={{ color: '#e1c256', fontWeight: 700 }}>
                    Total Vol: {sessionForm.exercise_list.reduce((acc, x) => acc + (x.sets * x.reps * (x.weight_kg || 0)), 0).toLocaleString()} kg
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Athlete Notes & Personal Bests
                </label>
                <textarea
                  rows={2}
                  placeholder="Athlete completed 4 sets of 100kg squats. Form check on hip hinge verified."
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {(() => {
                const targetAthlete = clients.find(c => c.client_id === sessionForm.client_id || c.id === sessionForm.client_id);
                const sRate = targetAthlete?.session_rate || 950;
                const sSplit = targetAthlete?.contract_split_percentage || 60;
                const sPayout = Math.round(sRate * (sSplit / 100));
                return (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(101, 130, 86, 0.08)',
                    border: '1px solid rgba(101, 130, 86, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem'
                  }}>
                    <div>
                      <span style={{ color: '#658256', fontWeight: 800, display: 'block' }}>Contracted Session Payout ({sSplit}% Split):</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.6875rem' }}>Session Pricing: ₱{sRate.toLocaleString()} • {targetAthlete?.package_plan || 'Standard Tier'}</span>
                    </div>
                    <span style={{ color: '#658256', fontFamily: 'monospace', fontWeight: 900, fontSize: '0.9375rem' }}>
                      +₱{sPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}

              {/* Anti-Ghost Session Biometric / Athlete PIN Verification */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  <ShieldCheck size={14} /> Anti-Ghost Athlete Verification PIN *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="Enter Athlete's 4-to-6 digit confirmation PIN (e.g. 1234)"
                  value={sessionForm.athlete_pin || ''}
                  onChange={(e) => setSessionForm({ ...sessionForm, athlete_pin: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid rgba(225, 194, 86, 0.4)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '1rem',
                    color: '#e1c256',
                    fontFamily: 'monospace',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ fontSize: '0.6875rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Prevents ghost billing. Athlete enters their private portal PIN to cryptographically certify session completion.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '10px', borderTop: '1px solid #232938' }}>
                <button
                  type="button"
                  onClick={() => setShowLogSessionModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    background: '#161922',
                    border: '1px solid #2a3142',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSession}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 900,
                    background: '#e1c256',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 10px rgba(225, 194, 86, 0.25)'
                  }}
                >
                  {submittingSession ? 'Verifying...' : 'Complete & Log Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPDATE ATHLETE METRICS */}
      {/* ========================================================================= */}
      {showMetricsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div
            style={{
              background: '#121520',
              border: '1px solid #283044',
              borderRadius: '16px',
              maxWidth: '28rem',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #232938' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Update Metrics: <span style={{ color: '#e1c256' }}>{showMetricsModal.client_name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMetricsModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateMetricsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Current Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricsForm.current_weight_kg}
                    onChange={(e) => setMetricsForm({ ...metricsForm, current_weight_kg: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    Body Fat %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricsForm.body_fat_percentage}
                    onChange={(e) => setMetricsForm({ ...metricsForm, body_fat_percentage: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0d1017',
                      border: '1px solid #283044',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={metricsForm.target_weight_kg}
                  onChange={(e) => setMetricsForm({ ...metricsForm, target_weight_kg: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  Fitness Goal
                </label>
                <input
                  type="text"
                  value={metricsForm.goal}
                  onChange={(e) => setMetricsForm({ ...metricsForm, goal: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0d1017',
                    border: '1px solid #283044',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #232938' }}>
                <button
                  type="button"
                  onClick={() => setShowMetricsModal(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    background: '#161922',
                    border: '1px solid #2a3142',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 900,
                    background: '#e1c256',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(225, 194, 86, 0.25)'
                  }}
                >
                  Save Metrics
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COACH CLASS ROLL CALL MODAL */}
      {selectedCoachClassRollCall && (() => {
        const currentRoster = getCoachClassRoster(selectedCoachClassRollCall);
        const verifiedCount = currentRoster.filter(a => a.status === 'Checked In').length;
        const pendingCount = currentRoster.filter(a => a.status === 'Confirmed').length;
        const capacity = selectedCoachClassRollCall.capacity || 20;
        const isFull = currentRoster.length >= capacity;
        const percentVerified = currentRoster.length > 0 ? Math.round((verifiedCount / currentRoster.length) * 100) : 0;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '16px'
            }}
          >
            <div
              style={{
                maxWidth: '780px',
                width: '100%',
                maxHeight: '92vh',
                overflowY: 'auto',
                background: '#0d1017',
                border: '2px solid #e1c256',
                borderRadius: '16px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225, 194, 86, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(225, 194, 86, 0.15)',
                      color: '#e1c256',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      border: '1px solid rgba(225, 194, 86, 0.3)'
                    }}>
                      {selectedCoachClassRollCall.category || selectedCoachClassRollCall.type || 'Group Fitness'}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(247, 255, 196, 0.15)',
                      color: '#f7ffc4',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      border: '1px solid rgba(247, 255, 196, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Calendar size={11} /> {selectedCoachClassRollCall.date || 'Today'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>•</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{selectedCoachClassRollCall.room}</span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>•</span>
                    <span className="mono" style={{ color: '#e1c256', fontSize: '0.75rem', fontWeight: 800 }}>{selectedCoachClassRollCall.time}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                    {selectedCoachClassRollCall.name}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    Assigned Instructor: <strong style={{ color: '#ffffff' }}>{selectedCoachClassRollCall.instructor}</strong>
                  </p>
                </div>

                <Tooltip text="Close Roll Call" position="bottom">
                  <button
                    type="button"
                    onClick={() => setSelectedCoachClassRollCall(null)}
                    className="touch-target"
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label="Close Roll Call"
                  >
                    <X size={20} />
                  </button>
                </Tooltip>
              </div>

              {/* Progress & Live Telemetry Card */}
              <div style={{
                background: '#121520',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#658256" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff' }}>
                      Floor Verification Telemetry: <strong style={{ color: '#658256' }}>{verifiedCount}</strong> of <strong style={{ color: '#ffffff' }}>{currentRoster.length}</strong> Athletes Verified on Floor
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 800, color: '#e1c256' }}>
                    {percentVerified}% Verified
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', background: '#0a0d14', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentVerified}%`,
                      background: 'linear-gradient(90deg, #658256 0%, #7fa36d 100%)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Capacity: <strong className="mono" style={{ color: '#ffffff' }}>{currentRoster.length} / {capacity}</strong></span>
                  <span>Pending Roll Call: <strong className="mono" style={{ color: '#e1c256' }}>{pendingCount} Athletes</strong></span>
                </div>
              </div>

              {/* Quick Walk-in Add Feature */}
              <div style={{ background: '#141824', border: '1px solid #232d42', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Studio Floor Walk-In Registration
                  </span>
                  {isFull && (
                    <span className="inline-flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#ef4444', fontWeight: 700 }}>
                      <AlertTriangle size={12} /> Studio Capacity Limit Reached ({capacity}/{capacity})
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddCoachWalkIn} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    disabled={isFull}
                    value={coachWalkInName}
                    onChange={(e) => setCoachWalkInName(e.target.value)}
                    placeholder={isFull ? 'Class is at max capacity' : 'Enter athlete full name to verify...'}
                    style={{
                      flex: 2,
                      minWidth: '200px',
                      background: '#0a0d14',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '0.8125rem'
                    }}
                  />
                  <select
                    disabled={isFull}
                    value={coachWalkInTier}
                    onChange={(e) => setCoachWalkInTier(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '130px',
                      background: '#0a0d14',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '0.8125rem'
                    }}
                  >
                    <option value="Walk-in Day Pass">Walk-in Day Pass</option>
                    <option value="1-Month Pass">1-Month Pass</option>
                    <option value="3-Months Pass">3-Months Pass</option>
                    <option value="Black Elite">Black Elite</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isFull || !coachWalkInName.trim()}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      opacity: (isFull || !coachWalkInName.trim()) ? 0.5 : 1,
                      cursor: (isFull || !coachWalkInName.trim()) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    + Add to Floor
                  </button>
                </form>
              </div>

              {/* Interactive Roster (Mobile / Tablet Optimized Tap Targets) */}
              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {currentRoster.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', background: '#121520', border: '1px dashed #232d42', borderRadius: '10px' }}>
                    <Users size={28} style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
                    <p style={{ margin: 0, fontWeight: 700, color: '#ffffff', fontSize: '0.875rem' }}>No athletes currently reserved</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Only athletes with active reservations appear in this floor roll call roster.</p>
                  </div>
                ) : (
                  currentRoster.map((athlete, idx) => {
                  const athleteId = athlete.id || `ath-${idx}`;
                  const athleteName = athlete.name || athlete;
                  const isChecked = athlete.status === 'Checked In';

                  return (
                    <div
                      key={athleteId}
                      onClick={() => handleToggleCoachAthleteCheckIn(athleteId)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: isChecked ? 'rgba(101, 130, 86, 0.08)' : '#121520',
                        border: isChecked ? '1px solid rgba(101, 130, 86, 0.4)' : '1px solid #1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isChecked ? '#658256' : '#1e293b',
                          color: isChecked ? '#000000' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}>
                          {isChecked ? <Check size={16} /> : idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {athleteName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{athlete.tier || 'Member'}</span>
                            {isChecked && athlete.checkInTime && (
                              <span className="mono" style={{ fontSize: '0.6875rem', color: '#658256' }}>• In at {athlete.checkInTime}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isChecked ? (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(101, 130, 86, 0.2)',
                            color: '#658256',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={13} /> Checked In
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(225, 194, 86, 0.15)',
                            color: '#e1c256',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Clock size={13} /> Tap to Check In
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }))}
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Tap athlete card to toggle attendance in real-time.
                </span>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCoachClassRollCall(null)}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ padding: '9px 16px', fontSize: '0.8125rem' }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeCoachAttendance}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ padding: '9px 20px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={16} /> Finalize Attendance (+₱850 Credit)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: 1RM PROGRESSIVE OVERLOAD TRACKER (EPLEY FORMULA) */}
      {/* ========================================================================= */}
      {showStrengthModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{
              background: '#12151e',
              border: '1px solid #e1c256',
              borderRadius: '16px',
              maxWidth: '38rem',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#262c3e]">
              <div className="flex items-center gap-2.5">
                <Award size={20} className="text-[#e1c256]" />
                <div>
                  <h3 className="text-base font-bold text-white">1RM Progressive Overload Tracker</h3>
                  <p className="text-xs text-gray-400">Athlete: {showStrengthModal.client_name} • Epley Formula 1RM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStrengthModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Log New Lift Form */}
            <form onSubmit={handleRecordStrength} style={{ background: '#0d0f14', padding: '16px', borderRadius: '12px', border: '1px solid #1f232b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256' }}>Record New Heavy Lift</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Exercise</label>
                  <select
                    value={strengthForm.exercise_name}
                    onChange={(e) => setStrengthForm({ ...strengthForm, exercise_name: e.target.value })}
                    className="ksyn-input"
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  >
                    <option value="Barbell Back Squat">Barbell Back Squat</option>
                    <option value="Barbell Bench Press">Barbell Bench Press</option>
                    <option value="Conventional Deadlift">Conventional Deadlift</option>
                    <option value="Overhead Barbell Press">Overhead Barbell Press</option>
                    <option value="Barbell Bent-Over Row">Barbell Bent-Over Row</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Weight (kg)</label>
                  <input
                    type="number"
                    min="10"
                    step="2.5"
                    value={strengthForm.weight_kg}
                    onChange={(e) => setStrengthForm({ ...strengthForm, weight_kg: parseFloat(e.target.value) || 0 })}
                    className="ksyn-input mono"
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Reps (1-12)</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={strengthForm.reps}
                    onChange={(e) => setStrengthForm({ ...strengthForm, reps: parseInt(e.target.value) || 1 })}
                    className="ksyn-input mono"
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Live Epley Formula Preview */}
              {(() => {
                const w = Number(strengthForm.weight_kg) || 0;
                const r = Number(strengthForm.reps) || 1;
                const epley = Math.round(w * (1 + r / 30));
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(225, 194, 86, 0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(225, 194, 86, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                      Epley Formula: <span className="mono">{w} kg × (1 + {r}/30)</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 900, color: '#e1c256', fontFamily: 'monospace' }}>
                      Calculated 1RM: {epley} kg
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                disabled={submittingStrength}
                className="ksyn-btn ksyn-btn-gold"
                style={{ width: '100%', padding: '8px', fontSize: '0.75rem', fontWeight: 800 }}
              >
                {submittingStrength ? 'Recording PR...' : 'Save Strength PR'}
              </button>
            </form>

            {/* Strength History / PR Records */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Personal Best History</span>
              <div style={{ overflowX: 'auto', border: '1px solid #1f232b', borderRadius: '10px' }}>
                <table className="ksyn-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f232b' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8' }}>EXERCISE</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: '#94a3b8' }}>WEIGHT × REPS</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: '#e1c256' }}>1RM (EPLEY)</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#94a3b8' }}>LOGGED DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(strengthData?.records || [
                      { exercise: 'Barbell Back Squat', weight: 140, reps: 5, one_rm: 163, date: '2026-10-10' },
                      { exercise: 'Barbell Bench Press', weight: 100, reps: 6, one_rm: 120, date: '2026-10-08' },
                      { exercise: 'Conventional Deadlift', weight: 170, reps: 3, one_rm: 187, date: '2026-10-05' }
                    ]).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1a1e29' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ffffff' }}>{r.exercise || r.exercise_name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#cbd5e1' }}>
                          {r.weight || r.weight_kg} kg × {r.reps}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, color: '#e1c256' }}>
                          {r.one_rm || r.calculated_1rm} kg
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                          {r.date || 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SPRINT 4: MODAL: NUTRITION & MACRO TARGETS PRESCRIPTION */}
      {/* ========================================================================= */}
      {showNutritionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{
              background: '#12151e',
              border: '1px solid #658256',
              borderRadius: '16px',
              maxWidth: '36rem',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#262c3e]">
              <div className="flex items-center gap-2.5">
                <Utensils size={20} className="text-[#658256]" />
                <div>
                  <h3 className="text-base font-bold text-white">Prescribe Nutrition & Daily Macros</h3>
                  <p className="text-xs text-gray-400">Athlete: {showNutritionModal.client_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNutritionModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNutrition} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Daily Caloric Target (kcal) *
                </label>
                <input
                  type="number"
                  required
                  min="1200"
                  max="6000"
                  value={nutritionForm.target_calories}
                  onChange={(e) => setNutritionForm({ ...nutritionForm, target_calories: parseInt(e.target.value) || 0 })}
                  className="ksyn-input mono"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#f7ffc4', display: 'block', marginBottom: '6px' }}>
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    min="50"
                    value={nutritionForm.protein_g}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, protein_g: parseInt(e.target.value) || 0 })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>4 kcal/g</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', display: 'block', marginBottom: '6px' }}>
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    min="50"
                    value={nutritionForm.carbs_g}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, carbs_g: parseInt(e.target.value) || 0 })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>4 kcal/g</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', display: 'block', marginBottom: '6px' }}>
                    Fats (g)
                  </label>
                  <input
                    type="number"
                    min="20"
                    value={nutritionForm.fat_g}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, fat_g: parseInt(e.target.value) || 0 })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>9 kcal/g</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Daily Hydration (Liters)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="8"
                    value={nutritionForm.hydration_liters}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, hydration_liters: parseFloat(e.target.value) || 0 })}
                    className="ksyn-input mono"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                    Target Meal Frequency
                  </label>
                  <select
                    value={nutritionForm.meal_frequency}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, meal_frequency: parseInt(e.target.value) || 3 })}
                    className="ksyn-input"
                    style={{ width: '100%' }}
                  >
                    <option value={3}>3 Meals / Day</option>
                    <option value={4}>4 Meals / Day (Optimal)</option>
                    <option value={5}>5 Meals / Day (High Calorie)</option>
                    <option value={6}>6 Meals / Day (Pro Split)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  Dietary Directives & Coaching Instructions
                </label>
                <textarea
                  rows={3}
                  value={nutritionForm.dietary_notes}
                  onChange={(e) => setNutritionForm({ ...nutritionForm, dietary_notes: e.target.value })}
                  placeholder="e.g. Prioritize fast-acting carbs 60-90 minutes pre-workout. Supplement with 5g creatine monohydrate daily."
                  className="ksyn-input"
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowNutritionModal(null)}
                  className="ksyn-btn ksyn-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNutrition}
                  className="ksyn-btn"
                  style={{ background: '#658256', color: '#000', fontWeight: 800, padding: '8px 18px' }}
                >
                  {submittingNutrition ? 'Prescribing...' : 'Prescribe Nutrition Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coach Facility Incident & Maintenance Request Modal */}
      {showLogMaintenanceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '520px', width: '100%', background: '#0e111a', border: '1px solid #ef4444', padding: '24px', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={20} color="#f87171" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Report Equipment / Facility Issue
                </h3>
              </div>
              <button onClick={() => setShowLogMaintenanceModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#94a3b8' }}>
              Log a maintenance request for gym equipment, cable machines, or member safety notices. This automatically syncs to the Branch Admin Incident Log.
            </p>

            <form onSubmit={handleSubmitMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label">Issue Category *</label>
                <select
                  className="ksyn-select"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                  value={maintenanceForm.category}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, category: e.target.value })}
                >
                  <option value="Equipment Maintenance">Gym Floor Equipment Maintenance</option>
                  <option value="Member Safety & Conduct">Member Safety & Conduct Notice</option>
                  <option value="Turnstile & Hardware">Turnstiles & Access Hardware</option>
                  <option value="Locker / Facilities">Lockers & Changing Room Facilities</option>
                  <option value="HVAC, Plumbing & Electrical">HVAC, Plumbing & Electrical</option>
                </select>
              </div>

              <div>
                <label className="ksyn-label">Incident / Equipment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Free-Weight Area Chalk Dispersal Notice / Cable Station A frayed"
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                />
              </div>

              <div>
                <label className="ksyn-label">Severity Level</label>
                <select
                  className="ksyn-select"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                  value={maintenanceForm.severity}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, severity: e.target.value })}
                >
                  <option value="Low">Low (Minor / Routine wear)</option>
                  <option value="Medium">Medium (Attention needed today)</option>
                  <option value="High">High (Impacting training sessions)</option>
                  <option value="Critical">Critical (Safety hazard / Stop use)</option>
                </select>
              </div>

              <div>
                <label className="ksyn-label">Detailed Observations / Coaching Floor Notes</label>
                <textarea
                  rows={3}
                  placeholder="Describe location, athlete safety precautions taken, or required technician service..."
                  value={maintenanceForm.details}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, details: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowLogMaintenanceModal(false)}
                  disabled={submittingMaintenance}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMaintenance}
                  className="ksyn-btn"
                  style={{
                    flex: 2,
                    padding: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Wrench size={14} />
                  {submittingMaintenance ? 'Submitting to Branch Admin...' : 'Submit Maintenance Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: OVERALL ALL-TIME COACHING EARNINGS & SESSION LEDGER               */}
      {/* ========================================================================= */}
      {showAllTimeEarningsModal && (() => {
        const availableYears = Array.from(new Set(
          sessions.map(s => {
            const d = s.session_date || s.created_at;
            return d ? new Date(d).getFullYear().toString() : '2026';
          })
        )).sort((a, b) => b.localeCompare(a));
        if (!availableYears.includes('2026')) availableYears.unshift('2026');

        const monthsList = [
          { value: 'all', label: 'All Months' },
          { value: '01', label: 'January' },
          { value: '02', label: 'February' },
          { value: '03', label: 'March' },
          { value: '04', label: 'April' },
          { value: '05', label: 'May' },
          { value: '06', label: 'June' },
          { value: '07', label: 'July' },
          { value: '08', label: 'August' },
          { value: '09', label: 'September' },
          { value: '10', label: 'October' },
          { value: '11', label: 'November' },
          { value: '12', label: 'December' }
        ];

        const modalFilteredSessions = sessions.filter(s => {
          const d = s.session_date || s.created_at;
          const dateObj = d ? new Date(d) : null;

          if (earningsModalYear !== 'all' && dateObj) {
            if (dateObj.getFullYear().toString() !== earningsModalYear) return false;
          }

          if (earningsModalMonth !== 'all' && dateObj) {
            const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
            if (monthStr !== earningsModalMonth) return false;
          }

          if (earningsModalSearch.trim()) {
            const q = earningsModalSearch.toLowerCase();
            const athlete = (s.client_name || s.client || '').toLowerCase();
            const focus = (s.workout_focus || s.focus || '').toLowerCase();
            const notes = (s.notes || '').toLowerCase();
            if (!athlete.includes(q) && !focus.includes(q) && !notes.includes(q)) return false;
          }

          return true;
        }).sort((a, b) => {
          const dateA = new Date(a.session_date || a.created_at || 0).getTime();
          const dateB = new Date(b.session_date || b.created_at || 0).getTime();
          return earningsModalSort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        const totalFilteredGross = modalFilteredSessions.reduce((acc, s) => {
          const sessionPrice = Number(s.session_rate || s.session_price || 950);
          const splitPct = Number(s.coach_split_percentage || (s.split_pct ? s.split_pct.replace('%', '') : 60));
          const grossEarned = Number(s.commission_earned || s.coach_earned || Math.round(sessionPrice * (splitPct / 100) * 100) / 100);
          return acc + grossEarned;
        }, 0);

        const totalFilteredTax = Math.round(totalFilteredGross * 0.10 * 100) / 100;
        const totalFilteredNet = Math.round((totalFilteredGross - totalFilteredTax) * 100) / 100;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="earnings-modal-title"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAllTimeEarningsModal(false);
            }}
          >
            <div
              style={{
                background: '#101216',
                border: '1px solid #232938',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '1080px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #1f2430',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#12141a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Award size={22} />
                  </div>
                  <div>
                    <h2
                      id="earnings-modal-title"
                      style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}
                    >
                      Overall All-Time Coaching Earnings & Session Ledger
                    </h2>
                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '3px 0 0' }}>
                      Historical coaching sessions and verified payouts with 10% BIR Form 2307 withholding breakdown.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllTimeEarningsModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* KPI Telemetry Banner */}
              <div style={{
                padding: '16px 24px',
                background: '#0d0f14',
                borderBottom: '1px solid #1f2430',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px'
              }}>
                <div style={{ padding: '12px 16px', background: '#16191f', border: '1px solid #232938', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Filtered Sessions
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', marginTop: '4px' }}>
                    {modalFilteredSessions.length} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>/ {sessions.length} total</span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: '#16191f', border: '1px solid #232938', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Gross Servicing Fees
                  </div>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#e1c256', marginTop: '4px' }}>
                    ₱{totalFilteredGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: '#16191f', border: '1px solid #232938', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
                    10% BIR 2307 Withheld
                  </div>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
                    -₱{totalFilteredTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: '#16191f', border: '1px solid #232938', borderRadius: '10px', borderLeft: '3px solid #658256' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#658256', textTransform: 'uppercase' }}>
                    Net Take-Home Earnings
                  </div>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#658256', marginTop: '4px' }}>
                    ₱{totalFilteredNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Comprehensive Filter & Search Controls */}
              <div style={{
                padding: '14px 24px',
                background: '#12141a',
                borderBottom: '1px solid #1f2430',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                {/* Search by Athlete Name / Focus */}
                <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search by athlete name, workout focus, or notes..."
                    value={earningsModalSearch}
                    onChange={(e) => setEarningsModalSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      background: '#0d0f14',
                      border: '1px solid #232938',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Date Dropdowns: Year + Month + Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Year Dropdown */}
                  <select
                    value={earningsModalYear}
                    onChange={(e) => setEarningsModalYear(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      background: '#0d0f14',
                      border: '1px solid #232938',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>Year {yr}</option>
                    ))}
                  </select>

                  {/* Month Dropdown */}
                  <select
                    value={earningsModalMonth}
                    onChange={(e) => setEarningsModalMonth(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      background: '#0d0f14',
                      border: '1px solid #232938',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {monthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  {/* Sort Order */}
                  <select
                    value={earningsModalSort}
                    onChange={(e) => setEarningsModalSort(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      background: '#0d0f14',
                      border: '1px solid #232938',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="newest">Newest First (FILO)</option>
                    <option value="oldest">Oldest First (FIFO)</option>
                  </select>

                  {/* Reset Button */}
                  {(earningsModalSearch || earningsModalYear !== 'all' || earningsModalMonth !== 'all' || earningsModalSort !== 'newest') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEarningsModalSearch('');
                        setEarningsModalYear('all');
                        setEarningsModalMonth('all');
                        setEarningsModalSort('newest');
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Table of All Sessions & Earnings */}
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '52vh', padding: '0 24px' }} className="ksyn-custom-scrollbar">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#101216', zIndex: 10, borderBottom: '1px solid #1f2430' }}>
                    <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Date & Time</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Athlete</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Duration</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Workout Focus</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800, textAlign: 'center' }}>RPE</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Rate & Split</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800, textAlign: 'right' }}>Gross Serviced</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800, textAlign: 'right' }}>10% BIR 2307</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800, textAlign: 'right' }}>Net Disbursed</th>
                      <th style={{ padding: '12px 10px', fontWeight: 800 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>No coaching sessions match the specified filters.</p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>Try clearing the search or changing the year and month selections.</p>
                        </td>
                      </tr>
                    ) : (
                      modalFilteredSessions.map((s, idx) => {
                        const sessionPrice = Number(s.session_rate || s.session_price || 950);
                        const splitPct = Number(s.coach_split_percentage || (s.split_pct ? s.split_pct.replace('%', '') : 60));
                        const grossEarned = Number(s.commission_earned || s.coach_earned || Math.round(sessionPrice * (splitPct / 100) * 100) / 100);
                        const taxWithheld = Math.round(grossEarned * 0.10 * 100) / 100;
                        const netEarned = Math.round((grossEarned - taxWithheld) * 100) / 100;
                        const dateFormatted = new Date(s.session_date || s.created_at || Date.now()).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });

                        return (
                          <tr key={s.id || s.session_id || idx} style={{ borderBottom: '1px solid #161922', transition: 'background 0.15s ease' }}>
                            <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                              {dateFormatted}
                            </td>
                            <td style={{ padding: '12px 10px', fontWeight: 800, color: '#ffffff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <UserCheck size={14} color="#e1c256" />
                                <span>{s.client_name || s.client || 'Enrolled Athlete'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 10px', color: '#94a3b8' }}>
                              {s.duration_mins || 60} mins
                            </td>
                            <td style={{ padding: '12px 10px', color: '#e2e8f0' }}>
                              {s.workout_focus || s.focus || 'Strength & Conditioning Split'}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                background: (s.rpe_intensity || 8) >= 9 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(225, 194, 86, 0.15)',
                                color: (s.rpe_intensity || 8) >= 9 ? '#ef4444' : '#e1c256'
                              }}>
                                RPE {s.rpe_intensity || 8}
                              </span>
                            </td>
                            <td style={{ padding: '12px 10px', color: '#94a3b8' }}>
                              ₱{sessionPrice.toLocaleString()} ({splitPct}% split)
                            </td>
                            <td className="mono" style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                              ₱{grossEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="mono" style={{ padding: '12px 10px', textAlign: 'right', color: '#ef4444' }}>
                              -₱{taxWithheld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="mono" style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#658256' }}>
                              +₱{netEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                background: 'rgba(101, 130, 86, 0.15)',
                                color: '#658256',
                                border: '1px solid rgba(101, 130, 86, 0.3)'
                              }}>
                                VERIFIED
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #1f2430',
                background: '#12141a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Showing <strong style={{ color: '#fff' }}>{modalFilteredSessions.length}</strong> of <strong style={{ color: '#fff' }}>{sessions.length}</strong> all-time completed sessions
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllTimeEarningsModal(false);
                      setShowBir2307Modal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'rgba(101, 130, 86, 0.15)',
                      border: '1px solid #658256',
                      color: '#658256',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    View Official BIR 2307 Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllTimeEarningsModal(false)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      background: '#e1c256',
                      border: 'none',
                      color: '#000000',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Close Ledger
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Official Philippine BIR Form 2307 Withholding Certificate Modal */}
      {showBir2307Modal && (
        <Bir2307Modal
          remittance={{
            id: commissionSlip?.slip_number || 'SLIP-202610-001',
            reference_no: commissionSlip?.slip_number || 'SLIP-202610-001',
            certificate_number: `BIR2307-COACH-${user?.id ? String(user.id).slice(0, 8).toUpperCase() : 'SOFIA'}`,
            period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            payment_rail: 'Official Philippine BIR Form 2307 Certificate',
            gross_royalty: calculatedTotalEarnings,
            cwt_amount: calculatedTax,
            net_remitted: calculatedNetPayout,
            total_income_payment: calculatedTotalEarnings,
            total_tax_withheld: calculatedTax,
            net_amount_remitted: calculatedNetPayout,
            payee: {
              tin: user?.tin || '328-941-205-000',
              name: (coachName || 'COACH SOFIA CRUZ').toUpperCase(),
              trade_name: `${coachName || 'Coach Sofia Cruz'} Personal Training Services`,
              address: 'KSYN Fitness Professional Coach Contractor, Metro Manila',
              zip_code: '1226',
              rdo_code: '047'
            },
            payor: {
              tin: '009-842-117-000',
              name: 'KSYN FITNESS PHILIPPINES INC.',
              trade_name: user?.branch_name || 'KSYN Fitness Makati Flagship',
              address: 'Ground Floor, Ayala Triangle Tower Two, Makati City, Metro Manila',
              zip_code: '1226',
              rdo_code: '047'
            },
            income_payments: [
              {
                atc: 'WI 010',
                nature_of_payment: 'Professional Contractor Fees - Physical Fitness & PT Coaching',
                total_gross: calculatedTotalEarnings,
                tax_rate: '10%',
                tax_withheld: calculatedTax
              }
            ],
            signatory: {
              name: 'Elena Rostova',
              title: 'Authorized Corporate Finance Controller & Withholding Agent',
              date_signed: new Date().toISOString()
            }
          }}
          onClose={() => setShowBir2307Modal(false)}
        />
      )}
    </div>
  );
}
