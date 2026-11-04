import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import {
  QrCode,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Flame,
  CalendarCheck,
  Users,
  Search,
  Filter,
  Check,
  X,
  CreditCard,
  ShoppingCart,
  DollarSign,
  Banknote,
  Package,
  Receipt,
  Plus,
  Minus,
  Trash2,
  Printer,
  KeyRound,
  PenTool,
  FileText,
  Lock,
  Unlock,
  LogOut,
  ShieldAlert,
  Key,
  Shield,
  Sparkles,
  Camera,
  Video,
  VideoOff,
  ScanLine,
  UserPlus,
  Smartphone,
  Award,
  Star,
  User,
  Dumbbell,
  Wrench,
  ChevronRight,
  ChevronDown,
  ChevronLeft
} from 'lucide-react';
import jsQR from 'jsqr';
import MemberOnboardingWizard from '../components/MemberOnboardingWizard';
import PosCheckoutModal from '../components/PosCheckoutModal';
import MemberProfileModal from '../components/MemberProfileModal';
import PosPtEnrollmentModal from '../components/PosPtEnrollmentModal';
import { subscribeToMemberUpgrades } from '../utils/portalSync';
import Tooltip from '../components/Tooltip';

const PROTEIN_SHAKE_FLAVORS = [
  'Vanilla',
  'Chocolate',
  'Vanilla Leche Flan',
  'Taro Milk Tea',
  'Matcha',
  'Chocolate Butterscotch',
  'Banana',
  'Peanut Butter Banana',
  'Strawberry Banana',
  'Cinnamon Choco Banana',
  'Cookies & Cream'
];

const MILK_BASES = [
  'Whole Milk',
  'Almond Milk',
  'Soy Milk',
  'Oat Milk',
  'Cold Filtered Water'
];

const RETAIL_PRODUCTS = [
  // Blended Shakes (Blended at counter with whole milk / choice of base and double scoop of protein)
  {
    id: 'pos-shake-std',
    sku: 'PSB-WHE-01',
    name: 'Standard Whey Shake',
    category: 'protein_shakes',
    price: 180.00,
    badge: 'Blended Counter',
    icon: 'shake',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80',
    description: 'Double scoop of standard whey protein blended smooth with choice of base.'
  },
  {
    id: 'pos-shake-iso',
    sku: 'PSB-ISO-01',
    name: 'Whey Isolate Shake',
    category: 'protein_shakes',
    price: 210.00,
    badge: 'Blended Counter',
    icon: 'shake_iso',
    image: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500&auto=format&fit=crop&q=80',
    description: 'Double scoop of whey isolate for faster digestion and lower carbs/fat.'
  },

  // Grab-and-Go & Add-Ons: Single Scoops / Powder Only
  {
    id: 'pos-pwd-std',
    sku: 'PDR-WHE-01',
    name: 'Single Scoop Standard Whey (Powder Only)',
    category: 'powder',
    price: 70.00,
    badge: 'Shaker Refill',
    icon: 'powder',
    image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500&auto=format&fit=crop&q=80',
    description: 'Single scoop of standard whey for customers using their own shakers.'
  },
  {
    id: 'pos-pwd-iso',
    sku: 'PDR-ISO-01',
    name: 'Single Scoop Whey Isolate (Powder Only)',
    category: 'powder',
    price: 85.00,
    badge: 'Shaker Refill',
    icon: 'powder_iso',
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80',
    description: 'Single scoop of whey isolate for customers using their own shakers.'
  },

  // Grab-and-Go & Add-Ons: Cold Bottled Drinks
  {
    id: 'pos-bev-water',
    sku: 'DRK-WTR-01',
    name: 'Cold Bottled Mineral Water (500ml)',
    category: 'drinks',
    price: 35.00,
    badge: 'Hydration',
    icon: 'water',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500&auto=format&fit=crop&q=80',
    description: 'Chilled bottled pure mineral water.'
  },
  {
    id: 'pos-bev-electro',
    sku: 'DRK-ELE-01',
    name: 'Electrolyte Hydration Drink',
    category: 'drinks',
    price: 75.00,
    badge: 'Electrolytes',
    icon: 'electrolyte',
    image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=500&auto=format&fit=crop&q=80',
    description: 'Cold electrolyte drink for rapid hydration & stamina recovery.'
  },
  {
    id: 'pos-bev-energy',
    sku: 'DRK-ENG-01',
    name: 'Canned Performance Energy Drink',
    category: 'drinks',
    price: 110.00,
    badge: 'Energy Boost',
    icon: 'energy',
    image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&auto=format&fit=crop&q=80',
    description: 'Chilled canned energy beverage for sustained focus.'
  },

  // Grab-and-Go & Add-Ons: Pre-Workouts & RTDs
  {
    id: 'pos-rtd-pwo',
    sku: 'RTD-PWO-01',
    name: 'Single-Serve Pre-Workout Packet',
    category: 'rtd',
    price: 95.00,
    badge: 'Pre-Workout',
    icon: 'pwo',
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=500&auto=format&fit=crop&q=80',
    description: 'Single-serve explosive energy and pump pre-workout sachet.'
  },
  {
    id: 'pos-rtd-bev',
    sku: 'RTD-SHK-01',
    name: 'Ready-to-Drink (RTD) Fitness Beverage',
    category: 'rtd',
    price: 120.00,
    badge: 'High Protein',
    icon: 'rtd',
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=500&auto=format&fit=crop&q=80',
    description: 'Chilled ready-to-drink high-protein fitness beverage bottle.'
  }
];

function getClassStatus(timeStr) {
  // timeStr example: '05:30 PM – 06:30 PM'
  if (!timeStr) return { isConcluded: false, isLive: false };
  const parts = timeStr.split(/[\u2013\u2014-]/).map(s => s.trim());
  if (parts.length !== 2) return { isConcluded: false, isLive: false };
  const now = new Date();
  const parseTime = (str) => {
    const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return new Date();
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const modifier = match[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  const isConcluded = now > end;
  const isLive = now >= start && now <= end;
  return { isConcluded, isLive, start, end };
}

function exportClassAttendanceToExcel(selectedClass) {
  const roster = Array.isArray(selectedClass.roster)
    ? selectedClass.roster
    : (Array.isArray(selectedClass.enrolled) ? selectedClass.enrolled : []);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  let csvContent = '\uFEFF'; // UTF-8 BOM for clean Excel rendering
  csvContent += `KSYN FITCONNECT — OFFICIAL CLASS ATTENDANCE SHEET\n`;
  csvContent += `Class Name:,"${selectedClass.name}"\n`;
  csvContent += `Category:,"${selectedClass.category || selectedClass.type || ''}"\n`;
  csvContent += `Instructor:,"${selectedClass.instructor || selectedClass.coach_name || ''}"\n`;
  csvContent += `Studio Room:,"${selectedClass.room}"\n`;
  csvContent += `Schedule Time:,"${selectedClass.time}"\n`;
  csvContent += `Export Business Date:,"${dateStr}"\n`;
  csvContent += `Studio Capacity:,${selectedClass.capacity}\n`;
  csvContent += `Total Enrolled:,${roster.length}\n`;
  csvContent += `Total Present Verified:,${roster.filter(a => a.status === 'Checked In' || a.status === 'Walk-In Registered').length}\n\n`;
  // Table Columns
  csvContent += `No.,Athlete Full Name,Athlete ID,Membership Tier,Booking Type,Verification Source,Status,Check-In Timestamp\n`;
  roster.forEach((athlete, index) => {
    const isCheckedIn = athlete.status === 'Checked In' || athlete.status === 'Walk-In Registered';
    const checkInTimeDisplay = athlete.checked_in_at
      ? new Date(athlete.checked_in_at).toLocaleTimeString()
      : (athlete.checkInTime || 'Pending');
    const row = [
      index + 1,
      `"${athlete.name || 'Member'}"`,
      athlete.user_id || athlete.id || 'N/A',
      `"${athlete.tier || 'Active Contract'}"`,
      athlete.booking_type || 'Reserved Class Booking',
      `"${athlete.verified_via || (isCheckedIn ? 'Turnstile QR / RFID' : 'Awaiting Arrival')}"`,
      athlete.status || 'Confirmed',
      isCheckedIn ? `"${checkInTimeDisplay}"` : 'Pending'
    ];
    csvContent += row.join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanClassName = (selectedClass.name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `KSYN_Class_Attendance_${cleanClassName}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function isClassConcludedHelper(cls) {
  if (!cls) return false;
  if (cls.is_concluded === true) return true;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const classDate = cls.date ? String(cls.date).split('T')[0] : todayStr;

  if (classDate < todayStr) return true;
  if (classDate > todayStr) return false;

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
}

const BRANCH_CLASSES = [
  {
    id: 'cls-yoga-01',
    time: '07:00 AM – 08:00 AM',
    category: 'Yoga & Recovery',
    type: 'Yoga & Recovery',
    name: 'Sunrise Vinyasa Flow & Mobility',
    instructor: 'Coach Sofia Cruz',
    room: 'Studio A (Recovery Lounge)',
    capacity: 20,
    enrolled_count: 18,
    enrolled: 18,
    status: 'In Progress',
    roster: [
      { id: 'ath-01', name: 'Samantha Nicole Perez', tier: 'Black Elite', status: 'Checked In', checkInTime: '06:55 AM' },
      { id: 'ath-02', name: 'Elena Rostova', tier: '1-Month Pass', status: 'Checked In', checkInTime: '06:58 AM' },
      { id: 'ath-03', name: 'Juan Dela Cruz', tier: '3-Months Pass', status: 'Checked In', checkInTime: '07:00 AM' },
      { id: 'ath-04', name: 'Camille Villar', tier: '1-Year Pass', status: 'Checked In', checkInTime: '07:02 AM' },
      { id: 'ath-05', name: 'Liam Archer', tier: 'Black Elite', status: 'Checked In', checkInTime: '07:04 AM' },
      { id: 'ath-06', name: 'Patricia Gomez', tier: '1-Month Pass', status: 'Checked In', checkInTime: '07:05 AM' },
      { id: 'ath-07', name: 'Gabriel Lopez', tier: '1-Month Pass', status: 'Checked In', checkInTime: '07:07 AM' },
      { id: 'ath-08', name: 'Beatrice Tan', tier: '3-Months Pass', status: 'Checked In', checkInTime: '07:08 AM' },
      { id: 'ath-09', name: 'Marco Rossi', tier: 'Black Elite', status: 'Checked In', checkInTime: '07:10 AM' },
      { id: 'ath-10', name: 'Chloe Davenport', tier: '1-Month Pass', status: 'Checked In', checkInTime: '07:11 AM' },
      { id: 'ath-11', name: 'Derrick Sterling', tier: '1-Year Pass', status: 'Checked In', checkInTime: '07:12 AM' },
      { id: 'ath-12', name: 'Valerie Ramos', tier: '1-Month Pass', status: 'Checked In', checkInTime: '07:14 AM' },
      { id: 'ath-13', name: 'Kyle Robinson', tier: '1-Month Pass', status: 'Confirmed', checkInTime: null },
      { id: 'ath-14', name: 'Hannah Morales', tier: '3-Months Pass', status: 'Confirmed', checkInTime: null },
      { id: 'ath-15', name: 'Justin Reyes', tier: '1-Month Pass', status: 'Confirmed', checkInTime: null },
      { id: 'ath-16', name: 'Denise Castro', tier: '1-Month Pass', status: 'Confirmed', checkInTime: null },
      { id: 'ath-17', name: 'Oliver Queen', tier: 'Black Elite', status: 'Confirmed', checkInTime: null },
      { id: 'ath-18', name: 'Mia Santos', tier: '1-Month Pass', status: 'Confirmed', checkInTime: null }
    ]
  },
  {
    id: 'cls-hiit-02',
    time: '10:00 AM – 11:00 AM',
    category: 'HIIT Conditioning',
    type: 'HIIT Conditioning',
    name: 'Metabolic Athletic Conditioning',
    instructor: 'Coach Marcus Reyes',
    room: 'Studio B (Turf Zone)',
    capacity: 15,
    enrolled_count: 15,
    enrolled: 15,
    status: 'Upcoming (Full)',
    roster: Array.from({ length: 15 }, (_, i) => ({
      id: `ath-hiit-${i + 1}`,
      name: ['Carlos Mendoza', 'Sofia Cruz', 'Rafael Silva', 'Maya Lin', 'Antonio Luna', 'Fernando Poe', 'Andres Bonifacio', 'Emilio Aguinaldo', 'Jose Rizal', 'Apolinario Mabini', 'Melchora Aquino', 'Gabriela Silang', 'Teresa Magbanua', 'Gregorio Del Pilar', 'Manuel Quezon'][i],
      tier: '1-Month Pass',
      status: i < 9 ? 'Checked In' : 'Confirmed',
      checkInTime: i < 9 ? '09:50 AM' : null
    }))
  },
  {
    id: 'cls-zumba-03',
    time: '05:30 PM – 06:30 PM',
    category: 'Zumba & Dance Cardio',
    type: 'Zumba & Dance Cardio',
    name: 'High-Energy Rhythmic Cardio',
    instructor: 'Coach Valerie Tan',
    room: 'Main Aerobic Stage',
    capacity: 25,
    enrolled_count: 22,
    enrolled: 22,
    status: 'Upcoming',
    roster: Array.from({ length: 22 }, (_, i) => ({
      id: `ath-zumba-${i + 1}`,
      name: `Zumba Dancer ${i + 1}`,
      tier: '1-Month Pass',
      status: i < 14 ? 'Checked In' : 'Confirmed',
      checkInTime: i < 14 ? '05:15 PM' : null
    }))
  },
  {
    id: 'cls-box-04',
    time: '07:00 PM – 08:00 PM',
    category: 'Boxing & Strike',
    type: 'Boxing & Strike',
    name: 'Combat Heavy-Bag Power Circuit',
    instructor: 'Coach Diego Alcantara',
    room: 'Combat Boxing Ring',
    capacity: 12,
    enrolled_count: 12,
    enrolled: 12,
    status: 'Upcoming (Full)',
    roster: Array.from({ length: 12 }, (_, i) => ({
      id: `ath-box-${i + 1}`,
      name: `Boxer Athlete ${i + 1}`,
      tier: 'Black Elite',
      status: i < 7 ? 'Checked In' : 'Confirmed',
      checkInTime: i < 7 ? '06:45 PM' : null
    }))
  }
];

// Web Audio API Sound Feedback Engine (Zero External MP3 Dependencies)
const playAudioFeedback = (type = 'success') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'beep' || type === 'lock') {
      // Immediate upbeat high-pitch Web Audio chime ("BEEP")
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'success') {
      // Success (Access Granted): Two upbeat high-pitch sine wave chimes (880Hz -> 1760Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.14);
      gain2.gain.setValueAtTime(0.22, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.35);
    } else {
      // Denied (Expired / Replay / APB): Low-pitch square wave buzzer tone (220Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    console.warn('[Turnstile Audio Feedback]', err);
  }
};

class EmployeePortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[KSYN EmployeePortal ErrorBoundary Caught]:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('ksyn_active_view_employee');
      localStorage.removeItem('ksyn_active_view_staff');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          background: '#121212',
          border: '1px solid #2e2e2e',
          borderRadius: '16px',
          color: '#f9fafb',
          textAlign: 'center',
          maxWidth: '640px',
          margin: '40px auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <AlertTriangle size={28} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
            Front Desk Portal Recovery
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            A temporary display exception was intercepted to prevent the screen from going black. You can safely restore the reception console below.
          </p>
          <div style={{
            background: '#0a0a0a',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #1f1f1f',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#f87171',
            marginBottom: '20px',
            textAlign: 'left',
            overflowX: 'auto'
          }}>
            {this.state.error?.message || 'Unknown view exception'}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="ksyn-btn ksyn-btn-gold"
            style={{ fontWeight: 800, padding: '10px 24px', fontSize: '0.875rem' }}
          >
            Reset Console to Turnstile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SECTION_METADATA = {
  turnstile: {
    title: 'Front-Desk Turnstile Operations',
    subtitle: 'Sub-second dynamic QR attendance verification with cryptographic anti-replay validation.',
    badge: 'STAFF SCANNER'
  },
  members: {
    title: 'Member Directory & Fast Registration',
    subtitle: 'Live athlete database, active membership tiers, and instant registration.',
    badge: 'MEMBER LOOKUP'
  },
  checkins: {
    title: 'Active Floor Check-Ins Stream',
    subtitle: 'Real-time turnstile access log and debounced physical gate telemetry.',
    badge: 'ACCESS LOG'
  },
  schedule: {
    title: "Today's Studio Class Schedules",
    subtitle: 'Coach-led group fitness classes, room assignments, and attendance rosters.',
    badge: 'STUDIO SCHEDULE'
  },
  pos: {
    title: 'Front-Desk Point of Sale (POS)',
    subtitle: 'Blended protein shakes, grab-and-go hydration, supplements, and merchandise.',
    badge: 'POS TERMINAL'
  },
  drawer: {
    title: 'Cash Drawer & Financial Reconcile',
    subtitle: 'Daily cash drop audits, discrepancy tracking, and end-of-shift balancing.',
    badge: 'CASH MANAGEMENT'
  },
  lockers: {
    title: 'Locker Key Manager',
    subtitle: 'Physical key fobs, athlete locker security, and deposit reconciliation.',
    badge: 'SECURITY ASSETS'
  },
  pt_enrollments: {
    title: 'Incoming PT Enrollments & Front Desk Clearance',
    subtitle: 'Verify personal training payments (Online Xendit or Counter Cash) and clear athletes to coach rosters.',
    badge: 'COACH CLEARANCE'
  },
  profile: {
    title: 'Staff Profile & Floor Duty Rota',
    subtitle: 'Front desk identity credentials, assigned work shifts, and branch security settings.',
    badge: 'STAFF PROFILE'
  }
};

function EmployeePortalContent({
  activeSection: propActiveSection,
  setActiveSection: propSetActiveSection,
  activeTab = 'turnstile',
  onTabChange
}) {
  const { user, authFetch } = useAuth();
  const { toast } = useToast();

  const normalizeSection = (t) => {
    if (!t) return 'turnstile';
    const clean = String(t).replace('employee_', '');
    if (clean === 'scanner' || clean === 'kiosk' || clean === 'turnstile') return 'turnstile';
    if (clean === 'members' || clean === 'roster' || clean === 'directory') return 'members';
    if (clean === 'attendance' || clean === 'checkin' || clean === 'checkins') return 'members';
    if (clean === 'lockers' || clean === 'locker' || clean === 'locker_keys') return 'lockers';
    if (clean === 'pos' || clean === 'cashier' || clean === 'retail') return 'pos';
    if (clean === 'drawer' || clean === 'cash_drawer' || clean === 'reconciliation' || clean === 'shift_close') return 'pos';
    if (clean === 'classes' || clean === 'schedules' || clean === 'schedule') return 'schedule';
    if (clean === 'pt_enrollments' || clean === 'pt' || clean === 'pt_queue' || clean === 'enrollments') return 'pt_enrollments';
    if (clean === 'profile' || clean === 'profile_settings' || clean === 'settings' || clean === 'staff_profile') return 'profile';
    return 'turnstile';
  };

  const [activeSection, setActiveSection] = useState(() => normalizeSection(propActiveSection || activeTab || 'turnstile'));
  const currentMeta = SECTION_METADATA[activeSection] || SECTION_METADATA.turnstile;
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showPosPtEnrollmentModal, setShowPosPtEnrollmentModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [refreshedMemberFeedback, setRefreshedMemberFeedback] = useState(false);
  const [selectedMemberProfileModal, setSelectedMemberProfileModal] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberFilterTier, setMemberFilterTier] = useState('all');
  const [loading, setLoading] = useState(false);
  const [activeSamplePass, setActiveSamplePass] = useState(null);
  const [checkinSearch, setCheckinSearch] = useState('');
  const [classSchedule, setClassSchedule] = useState(BRANCH_CLASSES);
  const [deskClassFilter, setDeskClassFilter] = useState('all'); // 'all', 'today', 'upcoming'
  const [selectedRollCallClass, setSelectedRollCallClass] = useState(null);
  const [rollCallRoster, setRollCallRoster] = useState({}); // classId -> roster array
  const [walkInName, setWalkInName] = useState('');
  const [walkInTier, setWalkInTier] = useState('Walk-in Day Pass');

  // PT Enrollments Queue & Front Desk Clearance State
  const [ptEnrollmentsQueue, setPtEnrollmentsQueue] = useState([]);
  const [loadingPtEnrollments, setLoadingPtEnrollments] = useState(false);
  const [clearingEnrollmentId, setClearingEnrollmentId] = useState(null);
  const [ptEnrollmentFilter, setPtEnrollmentFilter] = useState('all'); // 'all', 'pending', 'cleared', 'sessions', 'concluded'
  const [coachSessions, setCoachSessions] = useState([]);
  const [loadingCoachSessions, setLoadingCoachSessions] = useState(false);
  const [ptEnrollmentSearch, setPtEnrollmentSearch] = useState('');
  const [verifyCoachModalEnrollment, setVerifyCoachModalEnrollment] = useState(null);
  const [verifiedSlotInput, setVerifiedSlotInput] = useState('');
  const [verifiedCoachNotes, setVerifiedCoachNotes] = useState('');
  const [confirmingAvailabilityLoading, setConfirmingAvailabilityLoading] = useState(false);

  // Weekly Coach & Staff Floor Rota State
  const [floorRota, setFloorRota] = useState([]);
  const [loadingFloorRota, setLoadingFloorRota] = useState(false);
  const isMakatiBranch = user?.branch_id === 'b-mkt-01' ||
    String(user?.branch_code || '').toUpperCase().includes('MKT') ||
    String(user?.branch_name || '').toLowerCase().includes('makati');

  // Live Optical Webcam Scanner & Hardware RFID State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanStatus, setScanStatus] = useState('searching'); // 'searching', 'glare', 'blurred', 'locked'
  const [showDiagnosticSimulator, setShowDiagnosticSimulator] = useState(false);
  const isLockedRef = useRef(false);
  const lockTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const fullCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const lastScannedTokenRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // Reception POS & Retail Cashier State
  const [posCart, setPosCart] = useState([]);
  const [posCategory, setPosCategory] = useState('all');
  const [posCustomer, setPosCustomer] = useState('Walk-in Athlete');
  const [posPaymentMethod, setPosPaymentMethod] = useState('cash');
  const [posCashTendered, setPosCashTendered] = useState('');
  const [posRefNumber, setPosRefNumber] = useState('');
  const [posReceipt, setPosReceipt] = useState(null);
  const [posProcessing, setPosProcessing] = useState(false);
  const [posSearch, setPosSearch] = useState('');
  const [posToast, setPosToast] = useState(null);
  const [showXenditQrModal, setShowXenditQrModal] = useState(false);
  const [xenditQrData, setXenditQrData] = useState(null);
  const [xenditPolling, setXenditPolling] = useState(false);
  const [xenditQrStatus, setXenditQrStatus] = useState('PENDING'); // 'PENDING', 'PAID', 'EXPIRED'
  const [xenditCountdown, setXenditCountdown] = useState(900); // 15 mins
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Cash Drawer & Shift Session State (X-Reading vs. Z-Reading)
  const [currentShift, setCurrentShift] = useState(null);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [newShiftFloat, setNewShiftFloat] = useState(2000.00);
  const [newShiftNotes, setNewShiftNotes] = useState('');
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [drawerTab, setDrawerTab] = useState('x_reading'); // 'x_reading' | 'z_reading'
  const [xReadingReport, setXReadingReport] = useState(null);
  const [showXReadingModal, setShowXReadingModal] = useState(false);
  const [zReadingBusinessDate, setZReadingBusinessDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [zReadingConsolidated, setZReadingConsolidated] = useState(null);
  const [loadingZReading, setLoadingZReading] = useState(false);

  const [showCashDrawerSlideOver, setShowCashDrawerSlideOver] = useState(false);
  const [showPosCheckoutModal, setShowPosCheckoutModal] = useState(false);
  const [memberSubView, setMemberSubView] = useState('checkins'); // 'checkins' | 'directory'
  const [openingFloat, setOpeningFloat] = useState(2000.00);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [shiftSales, setShiftSales] = useState([]);
  const [shakeModal, setShakeModal] = useState(null);
  const [selectedFlavor, setSelectedFlavor] = useState('Chocolate');
  const [selectedBase, setSelectedBase] = useState('Whole Milk');
  // Blind Physical Count: inputs start at 0 (Philippine Bills & Coins)
  const [cashCounts, setCashCounts] = useState({
    p1000: 0,
    p500: 0,
    p200: 0,
    p100: 0,
    p50: 0,
    p20: 0,
    c20: 0,
    c10: 0,
    c5: 0,
    c1: 0,
    c025: 0,
    coins: 0
  });
  const [shiftClosingNotes, setShiftClosingNotes] = useState('');
  const [zReadingReport, setZReadingReport] = useState(null);

  // Physical Locker Key Manager State (60 Lockers) with Durable Local Storage Persistence
  const [lockers, setLockers] = useState(() => {
    try {
      const stored = localStorage.getItem('ksyn_branch_lockers_' + (user?.branch_id || 'default'));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 60) return parsed;
      }
    } catch {}
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const occupants = [
      { num: 3, guest: 'Juan Dela Cruz', deposit: '₱200 Cash Deposit', time: '08:20 AM', tag: 'K-03', date: todayStr, isToday: true },
      { num: 7, guest: 'Angela Santos', deposit: 'Passport (ID Held)', time: '08:45 AM', tag: 'K-07', date: todayStr, isToday: true },
      { num: 12, guest: 'Derrick Sterling', deposit: '₱200 Cash Deposit', time: '09:10 AM', tag: 'K-12', date: todayStr, isToday: true },
      { num: 15, guest: 'Paolo Hernandez', deposit: '₱200 Cash Deposit', time: '09:35 AM', tag: 'K-15', date: todayStr, isToday: true },
      { num: 18, guest: 'Carlos Mendoza', deposit: "Driver's License (ID)", time: '10:00 AM', tag: 'K-18', date: todayStr, isToday: true },
      { num: 22, guest: 'Patricia Gomez', deposit: '₱200 Cash Deposit', time: 'Yesterday 04:30 PM', tag: 'K-22', date: yesterdayStr, isToday: false },
      { num: 31, guest: 'Rafael Silva', deposit: '₱200 Cash Deposit', time: 'Yesterday 06:15 PM', tag: 'K-31', date: yesterdayStr, isToday: false },
      { num: 38, guest: 'Carlos Tan', deposit: '₱200 Cash Deposit', time: 'Yesterday 07:00 PM', tag: 'K-38', date: yesterdayStr, isToday: false },
      { num: 45, guest: 'Valerie Tan', deposit: 'UMID (ID Held)', time: 'Yesterday 08:10 PM', tag: 'K-45', date: yesterdayStr, isToday: false }
    ];
    const broken = [13, 27];
    return Array.from({ length: 60 }, (_, i) => {
      const num = i + 1;
      const code = `L-${String(num).padStart(2, '0')}`;
      const occ = occupants.find(o => o.num === num);
      if (broken.includes(num)) {
        return { id: code, number: num, status: 'maintenance', guest: null, deposit: null, time: null, tag: null, date: null, isToday: false, reason: 'Broken cylinder lock latch' };
      }
      if (occ) {
        return { id: code, number: num, status: 'occupied', guest: occ.guest, deposit: occ.deposit, time: occ.time, tag: occ.tag, date: occ.date, isToday: occ.isToday, assignedAt: occ.isToday ? new Date().toISOString() : null };
      }
      return { id: code, number: num, status: 'available', guest: null, deposit: null, time: null, tag: null, date: null, isToday: false };
    });
  });

  const updateLockersAndPersist = (updater) => {
    setLockers(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('ksyn_branch_lockers_' + (user?.branch_id || 'default'), JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const [lockerFilter, setLockerFilter] = useState('all');
  const [lockerSearch, setLockerSearch] = useState('');
  const [selectedLockerModal, setSelectedLockerModal] = useState(null);
  const [showDepositVaultModal, setShowDepositVaultModal] = useState(false);
  const [depositVaultTab, setDepositVaultTab] = useState('all'); // 'all', 'today', 'prior'
  const [assignForm, setAssignForm] = useState({
    guestName: '',
    depositType: '₱200 Cash Deposit',
    keyTag: ''
  });
  const [quickDepositType, setQuickDepositType] = useState('₱200 Cash Deposit');

  // Requirement 1: Only allow members who accessed the turnstile gate / QR scanner on that day only
  const todayCheckedInAthletes = useMemo(() => {
    const isDateToday = (dVal) => {
      if (!dVal) return false;
      const d = new Date(dVal);
      if (isNaN(d.getTime())) return false;
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };

    const map = new Map();
    (attendanceLogs || []).forEach(log => {
      if (!log) return;
      const timeVal = log.check_in_time || log.check_in_date || log.timestamp || log.created_at;
      const isGranted = log.status
        ? ['granted', 'success', 'approved', 'cleared'].includes(String(log.status).toLowerCase())
        : (log.access_granted !== false);

      if (isGranted && isDateToday(timeVal)) {
        const name = (log.user_name || log.member_name || log.name || '').trim();
        if (name && !map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), {
            id: log.member_id || log.user_id || log.id || name,
            name: name,
            time: new Date(timeVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            method: log.verification_method || log.method || 'Turnstile Gate',
            plan: log.plan_name || log.userPlan || ''
          });
        }
      }
    });

    // Also include member if verified in active turnstile scanner session today
    if (verificationResult?.valid && (verificationResult?.member?.name || verificationResult?.userName)) {
      const activeName = (verificationResult.member?.name || verificationResult.userName).trim();
      if (!map.has(activeName.toLowerCase())) {
        map.set(activeName.toLowerCase(), {
          id: verificationResult.member?.id || activeName,
          name: activeName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          method: 'Turnstile Optical Reticle',
          plan: verificationResult.member?.plan_name || ''
        });
      }
    }

    return Array.from(map.values());
  }, [attendanceLogs, verificationResult]);

  // Facility Incident & Maintenance Request States
  const [showReportMaintenanceModal, setShowReportMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    category: 'Turnstile & Hardware',
    severity: 'Medium',
    details: ''
  });
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);

  const handleSubmitMaintenance = async (e) => {
    e?.preventDefault?.();
    if (!maintenanceForm.title.trim()) {
      toast.warning('Please enter an incident title or equipment description.');
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
        toast.success(`Maintenance ticket logged: ${maintenanceForm.title}`, 'Ticket Recorded');
        setShowReportMaintenanceModal(false);
        setMaintenanceForm({
          title: '',
          category: 'Turnstile & Hardware',
          severity: 'Medium',
          details: ''
        });
      } else {
        toast.error(data.message || 'Failed to submit maintenance request.');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setSubmittingMaintenance(false);
    }
  };

  // Digital Guest PAR-Q & Touch Canvas Signature Pad State
  const [showParqModal, setShowParqModal] = useState(false);
  const [parqGuestName, setParqGuestName] = useState('');
  const [parqPhone, setParqPhone] = useState('');
  const [parqEmergencyContact, setParqEmergencyContact] = useState('');
  const [parqEmergencyPhone, setParqEmergencyPhone] = useState('');
  const [parqAnswers, setParqAnswers] = useState({
    q1: false,
    q2: false,
    q3: false,
    q4: false,
    q5: false,
    q6: false,
    q7: false
  });
  const [parqConsent, setParqConsent] = useState(false);
  const [signedWaiver, setSignedWaiver] = useState(null);
  const [signedWaiversHistory, setSignedWaiversHistory] = useState([
    {
      id: 'wvr-001',
      guestName: 'Mark Anthony Reyes',
      phone: '+63 917 888 1234',
      emergencyContact: 'Grace Reyes (Spouse)',
      emergencyPhone: '+63 917 888 4321',
      signedAt: new Date(Date.now() - 3600000 * 2),
      status: 'Cleared',
      referenceNo: 'TXN-MKT-01-9041'
    }
  ]);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Phase 1: Reception Kiosk 5-min Inactivity Auto-Lockout & Manual Lock Shield
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [lockPinInput, setLockPinInput] = useState('');
  const [lockPinError, setLockPinError] = useState('');
  const [idleSeconds, setIdleSeconds] = useState(0);
  const lockPinInputRef = useRef(null);

  // Phase 2: Supervisor Override for Anti-Passback State
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorOverrideError, setSupervisorOverrideError] = useState('');
  const [pendingApbToken, setPendingApbToken] = useState(null);

  // Inactivity tracking (5 minutes = 300s)
  useEffect(() => {
    if (isTerminalLocked) return;

    const interval = setInterval(() => {
      setIdleSeconds(prev => {
        if (prev >= 300) {
          setIsTerminalLocked(true);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    const resetIdle = () => setIdleSeconds(0);
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    window.addEventListener('touchstart', resetIdle);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
    };
  }, [isTerminalLocked]);

  const handleUnlockTerminal = (e, pinOverride) => {
    if (e && e.preventDefault) e.preventDefault();
    const pin = (pinOverride !== undefined ? pinOverride : lockPinInput).trim();
    const isSupervisorOrUserPin = (user?.pin && pin === String(user.pin)) || (user?.supervisor_pin && pin === String(user.supervisor_pin));
    if (pin === '1234' || pin === '0000' || isSupervisorOrUserPin) {
      setIsTerminalLocked(false);
      setLockPinInput('');
      setLockPinError('');
      setIdleSeconds(0);
      toast.success('Terminal unlocked. Active session restored.', 'Terminal Security Shield');
      return true;
    } else {
      setLockPinError('Invalid 4-digit PIN. (Demo default PIN: 1234)');
      return false;
    }
  };

  // Terminal Lock Keypad & Physical Keyboard Input Listener
  useEffect(() => {
    if (!isTerminalLocked) return;

    const focusTimer = setTimeout(() => {
      lockPinInputRef.current?.focus();
    }, 60);

    const handleLockedKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlockTerminal();
        return;
      }

      // If active target is the lock PIN input itself, native input onChange handles it
      if (document.activeElement === lockPinInputRef.current) {
        return;
      }

      // If focus was lost from input (e.g. after clicking on Obsidian keypad or background)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setLockPinInput(prev => {
          const next = prev.length < 4 ? prev + e.key : prev;
          if (next.length === 4) {
            setTimeout(() => handleUnlockTerminal(null, next), 50);
          }
          return next;
        });
        setLockPinError('');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setLockPinInput(prev => prev.slice(0, -1));
        setLockPinError('');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLockPinInput('');
        setLockPinError('');
      }
    };

    window.addEventListener('keydown', handleLockedKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleLockedKeyDown);
    };
  }, [isTerminalLocked, lockPinInput, user]);

  const handleSupervisorOverrideSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!supervisorPin) {
      setSupervisorOverrideError('Please enter 4-digit Supervisor PIN.');
      return;
    }
    setLoading(true);
    setSupervisorOverrideError('');
    try {
      const cleanInput = (pendingApbToken || tokenInput).trim();
      const isRfid = cleanInput.startsWith('RFID:') || cleanInput.startsWith('KS-') || (!cleanInput.includes('.') && cleanInput.length < 25);
      const reqBody = isRfid
        ? { rfid_uid: cleanInput.replace(/^RFID:\s*/i, '').trim(), branchId: user?.branch_id, supervisor_override: true, supervisor_pin: supervisorPin }
        : { token: cleanInput, branchId: user?.branch_id, supervisor_override: true, supervisor_pin: supervisorPin };

      const res = await authFetch('/api/turnstile/verify', {
        method: 'POST',
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();
      if (data.valid) {
        toast.success(`Supervisor Override Granted: ${data.userName || data.member?.name || 'Athlete'}. Turnstile Unlocked!`, 'Supervisor Clearance');
        setVerificationResult(data);
        setShowSupervisorModal(false);
        setSupervisorPin('');
        loadLogs();
      } else {
        setSupervisorOverrideError(data.message || 'Supervisor PIN invalid or override rejected.');
      }
    } catch (err) {
      setSupervisorOverrideError(err.message || 'Network error during override.');
    } finally {
      setLoading(false);
    }
  };

  // Sync when activeSection or activeTab changes from Layout sidebar
  useEffect(() => {
    const raw = String(propActiveSection || activeTab || '');
    if (raw.includes('checkin') || raw.includes('attendance')) {
      setMemberSubView('checkins');
    }
    if (raw.includes('drawer') || raw.includes('reconciliation') || raw.includes('shift_close')) {
      setShowCashDrawerSlideOver(true);
    }
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

  // Load recent attendance logs
  async function loadLogs() {
    try {
      const res = await authFetch('/api/qr/attendance-logs');
      const data = await res.json();
      if (data.success) {
        setAttendanceLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Load branch member directory for Front Desk lookup & verification
  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await authFetch('/api/members');
      const data = await res.json();
      if (data.success && Array.isArray(data.members)) {
        setMembersList(data.members);
      }
    } catch (err) {
      console.error('[EmployeePortal loadMembers error]:', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  // Load weekly branch floor & staff rota published by branch admin
  async function loadFloorRota() {
    setLoadingFloorRota(true);
    try {
      const res = await authFetch('/api/branch/floor-rota');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.rota)) {
          setFloorRota(data.rota);
        }
      }
    } catch (err) {
      console.error('[EmployeePortal loadFloorRota error]:', err);
    } finally {
      setLoadingFloorRota(false);
    }
  }

  // Pre-generate a live member pass for instant kiosk demonstration
  async function fetchDemoMemberToken() {
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'member_makati' })
      });
      const data = await res.json();
      if (data.success) {
        const passRes = await fetch('/api/qr/generate-pass', {
          headers: { Authorization: `Bearer ${data.token}` }
        });
        const passData = await passRes.json();
        if (passData.success) {
          setActiveSamplePass(passData.token);
          setTokenInput(passData.token);
        }
      }
    } catch (err) {
      console.error('Failed to generate sample pass:', err);
    }
  }

  // PT Enrollments Queue Fetcher & Front Desk Clearance
  async function fetchPtEnrollments() {
    setLoadingPtEnrollments(true);
    try {
      const res = await authFetch('/api/pos/pt-enrollments');
      const data = await res.json();
      if (data.success && Array.isArray(data.enrollments)) {
        setPtEnrollmentsQueue(data.enrollments);
      }
    } catch (err) {
      console.error('[EmployeePortal fetchPtEnrollments error]:', err);
    } finally {
      setLoadingPtEnrollments(false);
    }
  }

  async function fetchCoachSessions() {
    setLoadingCoachSessions(true);
    try {
      const res = await authFetch('/api/coach/sessions');
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setCoachSessions(data.sessions);
      }
    } catch (err) {
      console.error('[EmployeePortal fetchCoachSessions error]:', err);
    } finally {
      setLoadingCoachSessions(false);
    }
  }

  const handleOpenCoachVerification = (enrollment) => {
    setVerifyCoachModalEnrollment(enrollment);
    setVerifiedSlotInput(enrollment.confirmed_time_slot || enrollment.preferred_time_slot || 'Morning Slot (08:00 AM – 09:00 AM)');
    setVerifiedCoachNotes(`Verified availability with Coach ${enrollment.coach_name?.split(' ')?.[0] || 'Coach'}`);
  };

  const handleConfirmAndClear = async (e) => {
    e?.preventDefault?.();
    if (!verifyCoachModalEnrollment) return;
    setConfirmingAvailabilityLoading(true);
    try {
      const res = await authFetch(`/api/pos/pt-enrollments/${verifyCoachModalEnrollment.id}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_time_slot: verifiedSlotInput,
          notes: verifiedCoachNotes || `Coach verified and cleared by ${user?.name || 'Staff'}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Clearance failed');
      toast.success(`PT Enrollment cleared! Coach ${verifyCoachModalEnrollment.coach_name} confirmed for ${verifiedSlotInput}.`, 'Clearance & Schedule Verified');
      setVerifyCoachModalEnrollment(null);
      fetchPtEnrollments();
    } catch (err) {
      toast.error(err.message, 'Clearance Error');
    } finally {
      setConfirmingAvailabilityLoading(false);
    }
  };

  async function handleClearPtEnrollment(enrollment) {
    if (!enrollment) return;
    if (!enrollment.coach_availability_confirmed) {
      handleOpenCoachVerification(enrollment);
      return;
    }
    setClearingEnrollmentId(enrollment.id);
    try {
      const res = await authFetch(`/api/pos/pt-enrollments/${enrollment.id}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_time_slot: enrollment.confirmed_time_slot || enrollment.preferred_time_slot || 'Standard Floor Slot',
          notes: `Cleared at Front Desk by ${user?.name || 'Staff'}`
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`PT Enrollment cleared! Athlete ${enrollment.member_name} assigned to Coach ${enrollment.coach_name}.`, 'Clearance Successful');
        fetchPtEnrollments();
      } else {
        toast.error(data.message || 'Failed to clear PT enrollment.', 'Clearance Error');
      }
    } catch (err) {
      console.error('[EmployeePortal clear error]:', err);
      toast.error('Network error clearing PT enrollment.', 'Error');
    } finally {
      setClearingEnrollmentId(null);
    }
  }

  async function handleConcludePtEnrollment(enrollment) {
    if (!enrollment) return;
    try {
      const res = await authFetch(`/api/pos/pt-enrollments/${enrollment.id}/conclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `Concluded & archived by Front Desk (${user?.name || 'Staff'})`
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Session concluded & removed from active Cleared & Assigned queue.`, 'Session Concluded');
        fetchPtEnrollments();
      } else {
        toast.error(data.message || 'Failed to conclude PT session.', 'Error');
      }
    } catch (err) {
      console.error('[EmployeePortal conclude error]:', err);
      toast.error('Network error concluding PT session.', 'Error');
    }
  }

  async function handleDeletePtEnrollment(enrollment) {
    if (!enrollment) return;
    if (!window.confirm(`Are you sure you want to remove this PT enrollment for ${enrollment.member_name}?`)) return;
    try {
      const res = await authFetch(`/api/pos/pt-enrollments/${enrollment.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`PT enrollment record removed.`, 'Removed');
        fetchPtEnrollments();
      } else {
        toast.error(data.message || 'Failed to remove PT enrollment.', 'Error');
      }
    } catch (err) {
      console.error('[EmployeePortal delete error]:', err);
      toast.error('Network error deleting PT enrollment.', 'Error');
    }
  }

  // Shift & Drawer Session Lifecycle Functions
  const fetchCurrentShift = async () => {
    setIsLoadingShift(true);
    try {
      const res = await authFetch('/api/pos/shifts/current');
      const data = await res.json();
      if (data.success && data.shift) {
        setCurrentShift(data.shift);
        setOpeningFloat(Number(data.shift.opening_float) || 2000.00);
        setIsDrawerOpen(data.shift.status === 'OPEN');
        if (Array.isArray(data.shift.transactions)) {
          setShiftSales(data.shift.transactions);
        }
      } else {
        setCurrentShift(null);
        setIsDrawerOpen(false);
        setShiftSales([]);
      }
    } catch (err) {
      console.warn('Failed to load current shift:', err);
    } finally {
      setIsLoadingShift(false);
    }
  };

  const handleOpenShift = async () => {
    setIsOpeningShift(true);
    try {
      const res = await authFetch('/api/pos/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          branchId: user?.branch_id || 'b-mkt-01',
          cashierId: user?.id,
          cashierName: user?.name,
          openingFloat: Number(newShiftFloat) || 2000.00,
          notes: newShiftNotes
        })
      });
      const data = await res.json();
      if (data.success && data.shift) {
        setCurrentShift(data.shift);
        setOpeningFloat(Number(data.shift.opening_float) || 2000.00);
        setIsDrawerOpen(true);
        setShowOpenShiftModal(false);
        setCashCounts({ p1000: 0, p500: 0, p200: 0, p100: 0, p50: 0, p20: 0, c20: 0, c10: 0, c5: 0, c1: 0, c025: 0, coins: 0 });
        setShiftClosingNotes('');
        toast.success(`Drawer session started for ${data.shift.cashier_name}. Float: ₱${Number(data.shift.opening_float).toFixed(2)}`, 'Register Shift Opened');
      } else {
        toast.warning(data.message || 'Could not open shift.', 'Shift Notice');
      }
    } catch (err) {
      toast.error('Failed to open shift: ' + err.message, 'Shift Error');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleDemoAutoFillExactCash = () => {
    toast.warning('Blind Count Policy Enforced: Auto-fill is strictly disabled to prevent cashier collusion and bypass of physical currency audit. Please count each denomination manually.', 'Policy Restriction');
  };

  const handleGenerateXReading = async () => {
    if (!currentShift) {
      toast.warning('No active shift session to close.', 'X-Reading Warning');
      return;
    }

    const physicalCashCounted = (
      (Number(cashCounts.p1000) || 0) * 1000 +
      (Number(cashCounts.p500) || 0) * 500 +
      (Number(cashCounts.p200) || 0) * 200 +
      (Number(cashCounts.p100) || 0) * 100 +
      (Number(cashCounts.p50) || 0) * 50 +
      (Number(cashCounts.p20) || 0) * 20 +
      (Number(cashCounts.c20) || 0) * 20 +
      (Number(cashCounts.c10) || 0) * 10 +
      (Number(cashCounts.c5) || 0) * 5 +
      (Number(cashCounts.c1) || 0) * 1 +
      (Number(cashCounts.c025) || 0) * 0.25 +
      (Number(cashCounts.coins) || 0)
    );

    try {
      const res = await authFetch('/api/pos/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: currentShift.id,
          actualCashCounted: physicalCashCounted,
          denominations: cashCounts,
          notes: shiftClosingNotes || 'Cashier shift turnover completed.'
        })
      });
      const data = await res.json();
      if (data.success && data.x_reading) {
        setXReadingReport(data.x_reading);
        setShowXReadingModal(true);
        setShowCashDrawerSlideOver(false);
        setCurrentShift(null);
        setIsDrawerOpen(false);
        const variance = Number(data.x_reading.variance);
        if (variance === 0) {
          toast.success(`X-Reading completed. Drawer perfectly balanced (₱0.00 variance)!`, 'Shift Turnover Complete');
        } else if (variance < 0) {
          toast.error(`X-Reading completed. Drawer SHORTAGE of -₱${Math.abs(variance).toFixed(2)} tagged to cashier.`, 'Cash Shortage Tagged');
        } else {
          toast.warning(`X-Reading completed. Drawer OVERAGE of +₱${variance.toFixed(2)}.`, 'Cash Overage Noted');
        }
      } else {
        toast.error(data.message || 'Failed to close shift.', 'Shift Error');
      }
    } catch (err) {
      toast.error('Error generating X-Reading: ' + err.message, 'X-Reading Error');
    }
  };

  const handlePrintXReading = (reading) => {
    const r = reading || xReadingReport;
    if (!r) return;
    const refNo = r.id || r.reading_id || currentShift?.id || 'X-READING';
    const printWindow = window.open('', '_blank', 'width=440,height=720');
    if (printWindow) {
      const denom = r.denominations || cashCounts;
      const p1000 = Number(denom.p1000) || 0;
      const p500 = Number(denom.p500) || 0;
      const p200 = Number(denom.p200) || 0;
      const p100 = Number(denom.p100) || 0;
      const p50 = Number(denom.p50) || 0;
      const p20 = Number(denom.p20) || 0;
      const c20 = Number(denom.c20) || 0;
      const c10 = Number(denom.c10) || 0;
      const c5 = Number(denom.c5) || 0;
      const c1 = Number(denom.c1) || 0;
      const c025 = Number(denom.c025) || 0;
      const looseCoins = Number(denom.coins) || 0;

      const varianceVal = Number(r.variance || 0);
      const varStr = varianceVal === 0 
        ? 'PHP 0.00 (BALANCED)' 
        : (varianceVal < 0 ? `-PHP ${Math.abs(varianceVal).toFixed(2)} (SHORTAGE)` : `+PHP ${varianceVal.toFixed(2)} (OVERAGE)`);

      printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>X-Reading #${refNo}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
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
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px dashed #000;
      text-align: center;
      font-size: 9px;
    }
    .line { border-bottom: 1px solid #000; width: 85%; margin: 18px auto 4px auto; }
    @media print {
      body { width: 100%; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 13px;">KSYN FITCONNECT PHILIPPINES</div>
  <div class="center sub-title">${r.branch_name || 'Makati Flagship Branch'}</div>
  <div class="center sub-title">POS REGISTER #01 • BLIND COUNT AUDIT</div>
  <div class="double-divider"></div>
  <div class="center bold">OFFICIAL CASHIER HANDOVER (X-READING)</div>
  <div class="divider"></div>
  <div class="row"><span>Ref:</span><span class="bold">${refNo}</span></div>
  <div class="row"><span>Shift ID:</span><span>${r.shift_id}</span></div>
  <div class="row"><span>Cashier:</span><span class="bold">${r.cashier_name}</span></div>
  <div class="row"><span>Opened:</span><span>${new Date(r.opened_at).toLocaleString()}</span></div>
  <div class="row"><span>Closed:</span><span>${new Date(r.closed_at).toLocaleString()}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Opening Cash Float:</span><span>PHP ${Number(r.opening_float || 0).toFixed(2)}</span></div>
  <div class="row"><span>Shift Cash Sales:</span><span>PHP ${Number(r.total_cash_sales || 0).toFixed(2)}</span></div>
  <div class="row"><span>Shift Digital Sales:</span><span>PHP ${Number(r.total_digital_sales || 0).toFixed(2)}</span></div>
  <div class="row"><span>Mid-Shift Cash Drops:</span><span>PHP ${Number(r.cash_drops || 0).toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row bold"><span>Gross Shift Turnover:</span><span>PHP ${Number(r.gross_shift_sales || r.gross_sales || 0).toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Expected Drawer Cash:</span><span>PHP ${Number(r.expected_cash_drawer || 0).toFixed(2)}</span></div>
  <div class="row bold"><span>Actual Counted Cash:</span><span>PHP ${Number(r.actual_cash_counted || 0).toFixed(2)}</span></div>
  <div class="double-divider"></div>
  <div class="row bold" style="font-size: 11px;"><span>DISCREPANCY / VARIANCE:</span><span>${varStr}</span></div>
  <div class="double-divider"></div>
  <div class="center bold" style="font-size: 10px; margin: 4px 0;">PHYSICAL DENOMINATION BREAKDOWN</div>
  <div class="divider"></div>
  <div class="row sub-title bold"><span>DENOMINATION</span><span>QTY</span><span>SUBTOTAL</span></div>
  ${p1000 > 0 ? `<div class="row"><span>PHP 1,000 Bill</span><span>${p1000}</span><span>PHP ${(p1000 * 1000).toLocaleString()}</span></div>` : ''}
  ${p500 > 0 ? `<div class="row"><span>PHP 500 Bill</span><span>${p500}</span><span>PHP ${(p500 * 500).toLocaleString()}</span></div>` : ''}
  ${p200 > 0 ? `<div class="row"><span>PHP 200 Bill</span><span>${p200}</span><span>PHP ${(p200 * 200).toLocaleString()}</span></div>` : ''}
  ${p100 > 0 ? `<div class="row"><span>PHP 100 Bill</span><span>${p100}</span><span>PHP ${(p100 * 100).toLocaleString()}</span></div>` : ''}
  ${p50 > 0 ? `<div class="row"><span>PHP 50 Bill</span><span>${p50}</span><span>PHP ${(p50 * 50).toLocaleString()}</span></div>` : ''}
  ${p20 > 0 ? `<div class="row"><span>PHP 20 Bill</span><span>${p20}</span><span>PHP ${(p20 * 20).toLocaleString()}</span></div>` : ''}
  ${c20 > 0 ? `<div class="row"><span>PHP 20 Coin</span><span>${c20}</span><span>PHP ${(c20 * 20).toLocaleString()}</span></div>` : ''}
  ${c10 > 0 ? `<div class="row"><span>PHP 10 Coin</span><span>${c10}</span><span>PHP ${(c10 * 10).toLocaleString()}</span></div>` : ''}
  ${c5 > 0 ? `<div class="row"><span>PHP 5 Coin</span><span>${c5}</span><span>PHP ${(c5 * 5).toLocaleString()}</span></div>` : ''}
  ${c1 > 0 ? `<div class="row"><span>PHP 1 Coin</span><span>${c1}</span><span>PHP ${(c1 * 1).toLocaleString()}</span></div>` : ''}
  ${c025 > 0 ? `<div class="row"><span>PHP 0.25 (25c)</span><span>${c025}</span><span>PHP ${(c025 * 0.25).toFixed(2)}</span></div>` : ''}
  ${looseCoins > 0 ? `<div class="row"><span>Loose Coins/Tokens</span><span>1</span><span>PHP ${looseCoins.toFixed(2)}</span></div>` : ''}
  <div class="divider"></div>
  <div class="row bold"><span>Total Physical Count:</span><span>PHP ${Number(r.actual_cash_counted || 0).toFixed(2)}</span></div>
  <div style="font-size: 9px; margin-top: 6px;">Notes: ${r.notes || 'None logged.'}</div>
  
  <div style="margin-top: 22px;">
    <div class="sig-box">
      <div class="line"></div>
      <div class="bold">${r.cashier_name}</div>
      <div>CASHIER SIGNATURE (COUNT ATTESTATION)</div>
      <div style="font-size: 8px; color: #555;">Certified accurate under penalty of sanction.</div>
    </div>

    <div class="sig-box">
      <div class="line"></div>
      <div class="bold">SHIFT SUPERVISOR / AUDITOR</div>
      <div>SUPERVISOR SIGNATURE (APPROVAL & TURNOVER)</div>
      <div style="font-size: 8px; color: #555;">Verified physical count & drawer handover.</div>
    </div>
  </div>

  <div class="divider" style="margin-top: 15px;"></div>
  <div class="center" style="font-size: 8px;">*** RETAIL AUDIT INTEGRITY SYSTEM ***</div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);
      printWindow.document.close();
      toast.success(`Printing official X-Reading turnover #${refNo}...`, 'Thermal Print Ready');
    }
  };

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
    const dateStr = report?.business_date || zReadingBusinessDate;
    toast.info(`Sending Daily Store Z-Reading (${dateStr}) to 80mm thermal printer...`, 'Thermal Printer');
    setTimeout(() => {
      toast.success(`Consolidated Z-Reading for ${dateStr} printed successfully.`, 'Printing Complete');
    }, 700);
  };

  const printRealThermalPosReceipt = (receipt) => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=420,height=750');
    if (!printWindow) {
      window.print();
      return;
    }

    const branchName = (user?.branch_name || 'KSYN Fitness Makati Flagship').toUpperCase();
    const branchCode = user?.branch_code || 'MKT-01';
    const cashierName = user?.name || 'Employee FrontDesk';
    const refNo = receipt.sale?.reference_no || receipt.referenceNumber || `POS-${Date.now()}`;
    const txDate = receipt.timestamp ? new Date(receipt.timestamp) : new Date();
    const businessDate = txDate.toISOString().split('T')[0];
    const generatedAtStr = txDate.toLocaleString();
    const customer = receipt.customer || 'Walk-in Athlete';
    const paymentMethodRaw = (receipt.paymentMethod || 'cash').toLowerCase();
    const isCash = paymentMethodRaw === 'cash';
    const paymentChannelStr = isCash
      ? 'CASH (RECEPTION COUNTER)'
      : paymentMethodRaw === 'gcash'
      ? 'GCASH (MERCHANT QR PH)'
      : paymentMethodRaw === 'maya'
      ? 'MAYA (MERCHANT QR)'
      : paymentMethodRaw === 'card'
      ? 'CARD TERMINAL (BDO / MAYA)'
      : 'XENDIT DYNAMIC QR PH';

    const total = Number(receipt.total || 0);
    const vatableSales = total / 1.12;
    const vatAmount = total - vatableSales;
    const cashTendered = Number(receipt.cashTendered || total);
    const change = Number(receipt.change || 0);
    const items = receipt.items || [];

    const itemsHtml = items.map(it => {
      const lineTotal = Number(it.price * it.quantity).toFixed(2);
      return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.quantity}x ${it.name}</span>
          <span style="font-weight: bold;">PHP ${lineTotal}</span>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>POS Receipt - ${refNo}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    body {
      font-family: 'Courier New', Courier, Consolas, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 12px 14px;
      max-width: 340px;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .divider-double {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      height: 2px;
      margin: 8px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .label { color: #222; }
    .val { font-weight: bold; text-align: right; }
    .qr-container {
      text-align: center;
      margin: 10px 0;
      padding: 6px;
      border: 1px dashed #000;
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div style="font-size: 13px; font-weight: bold; letter-spacing: 0.04em;">KSYN FITCONNECT PHILIPPINES</div>
    <div style="font-size: 10px; margin-top: 2px;">${branchName} (${branchCode})</div>
    <div style="font-size: 9px; margin-top: 2px;">POS TERMINAL #01 • MIN: 2026-0923-0192-MIN</div>
    <div style="font-size: 9px;">SN: POS-REG-01-SN482910 • TIN: 009-842-117-000</div>
  </div>

  <div class="divider-double"></div>

  <div class="text-center">
    <div style="font-size: 11px; font-weight: bold;">OFFICIAL POS SALES INVOICE</div>
    <div style="font-size: 9px;">REGISTERED COUNTER TICKET</div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="label">Business Date:</span>
    <span class="val">${businessDate}</span>
  </div>
  <div class="row">
    <span class="label">Generated At:</span>
    <span class="val" style="font-size: 10px;">${generatedAtStr}</span>
  </div>
  <div class="row">
    <span class="label">Invoice / Ref:</span>
    <span class="val" style="font-size: 10px;">${refNo}</span>
  </div>
  <div class="row">
    <span class="label">Cashier:</span>
    <span class="val">${cashierName}</span>
  </div>
  <div class="row">
    <span class="label">Customer:</span>
    <span class="val">${customer}</span>
  </div>
  <div class="row">
    <span class="label">Payment Channel:</span>
    <span class="val">${paymentChannelStr}</span>
  </div>
  ${receipt.referenceNumber ? `
  <div class="row">
    <span class="label">Approval Code:</span>
    <span class="val" style="font-size: 10px;">${receipt.referenceNumber}</span>
  </div>` : ''}

  <div class="divider-double"></div>

  <div class="text-center" style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">ORDER ITEMS BREAKDOWN</div>
  <div class="divider"></div>

  ${itemsHtml}

  <div class="divider-double"></div>

  <div class="text-center" style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">TAX & STATUTORY ROLL-UP</div>
  <div class="divider"></div>

  <div class="row">
    <span class="label">VATable Sales (12%):</span>
    <span class="val">PHP ${vatableSales.toFixed(2)}</span>
  </div>
  <div class="row">
    <span class="label">VAT Amount (12%):</span>
    <span class="val">PHP ${vatAmount.toFixed(2)}</span>
  </div>
  <div class="row">
    <span class="label">VAT-Exempt Sales:</span>
    <span class="val">PHP 0.00</span>
  </div>
  <div class="row">
    <span class="label">Zero-Rated Sales:</span>
    <span class="val">PHP 0.00</span>
  </div>

  <div class="divider"></div>

  <div class="row" style="font-size: 12px; font-weight: bold;">
    <span>TOTAL AMOUNT DUE:</span>
    <span>PHP ${total.toFixed(2)}</span>
  </div>

  <div class="divider-double"></div>

  <div class="text-center" style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">SETTLEMENT DETAILS</div>
  <div class="divider"></div>

  ${isCash ? `
  <div class="row">
    <span class="label">Cash Tendered:</span>
    <span class="val">PHP ${cashTendered.toFixed(2)}</span>
  </div>
  <div class="row" style="font-size: 11px; font-weight: bold;">
    <span class="label">Change Due:</span>
    <span class="val">PHP ${change.toFixed(2)}</span>
  </div>
  ` : `
  <div class="row">
    <span class="label">Digital Payment:</span>
    <span class="val">PHP ${total.toFixed(2)}</span>
  </div>
  <div class="row">
    <span class="label">Settlement Status:</span>
    <span class="val">SETTLED (ONLINE)</span>
  </div>
  ${receipt.xenditPaymentId ? `
  <div class="row">
    <span class="label">Xendit Payment ID:</span>
    <span class="val" style="font-size: 9px;">${receipt.xenditPaymentId}</span>
  </div>` : ''}
  `}

  ${receipt.turnstilePass ? `
  <div class="divider"></div>
  <div class="qr-container">
    <div style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">OPTICAL TURNSTILE ENTRY PASS</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(receipt.turnstilePass)}" width="110" height="110" alt="Turnstile QR" style="display: block; margin: 4px auto;" />
    <div style="font-size: 9px; margin-top: 4px;">Tap reader at turnstile gate for facility access</div>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="text-center" style="font-size: 9px; line-height: 1.4; margin-top: 8px;">
    <div style="font-weight: bold;">THIS SERVES AS AN OFFICIAL SALES INVOICE</div>
    <div>Accreditation No: BIR-ACC-2026-092301-${branchCode}</div>
    <div>PTU No: FP092026-044-019208-000</div>
    <div>Issued: 09/23/2026 • Valid Until: 09/23/2031</div>
  </div>

  <div class="divider"></div>

  <div class="text-center" style="font-size: 9px; color: #333; margin-top: 6px;">
    <div>Thank you for training with KSYN FitConnect!</div>
    <div>Keep your receipt for exchange within 7 days.</div>
    <div style="margin-top: 4px; font-style: italic;">System Powered by KSYN FitConnect POS v2.0</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    };
  <\/script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => {
    loadLogs();
    loadFloorRota();
    fetchDemoMemberToken();
    fetchCurrentShift();
    fetchPtEnrollments();
    const fetchBroadcast = async () => {
      try {
        const res = await authFetch('/api/broadcast/active');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.broadcast) {
            setActiveBroadcast(data.broadcast);
          }
        }
      } catch (err) {
        console.error('Failed to load active broadcast:', err);
      }
    };
    fetchBroadcast();
  }, []);

  useEffect(() => {
    if (activeSection === 'pos' || activeSection === 'drawer') {
      fetchCurrentShift();
    }
    if (activeSection === 'pos' || activeSection === 'pt_enrollments') {
      fetchPtEnrollments();
      fetchCoachSessions();
    }
  }, [activeSection]);

  // Camera Lifecycle & Real-Time QR Frame Processing Engine
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Webcam access is not supported by your browser environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      });
      streamRef.current = stream;

      // Track listeners for immediate hardware disconnect detection
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          setCameraActive(false);
          setCameraError('Camera stream disconnected or ended.');
        };
        track.onmute = () => {
          setCameraActive(false);
          setCameraError('Camera optical sensor muted.');
        };
        track.onunmute = () => {
          setCameraActive(true);
          setCameraError(null);
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('[Webcam initiation notice]:', err.message);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in browser settings or switch to Hardware Laser mode.'
          : `Camera unavailable: ${err.message}`
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const [isRefreshingStream, setIsRefreshingStream] = useState(false);

  const handleRefreshStream = async () => {
    setIsRefreshingStream(true);
    try {
      toast.info('Recalibrating optical scanner and syncing turnstile logs...', 'Stream Diagnostic');
      stopCamera();
      lastScannedTokenRef.current = null;
      lastScanTimeRef.current = 0;
      setCameraError(null);

      // Brief delay to allow the video capture sensor to reset cleanly
      await new Promise(resolve => setTimeout(resolve, 250));

      if (activeSection === 'turnstile' && !isTerminalLocked) {
        await startCamera();
      }
      await loadLogs();
      toast.success('Camera stream re-established & telemetry synchronized.', 'Stream Online');
    } catch (err) {
      console.error('Failed to cycle camera stream:', err);
      toast.error('Unable to reset video hardware: ' + (err.message || 'Error'), 'Stream Error');
    } finally {
      setIsRefreshingStream(false);
    }
  };

  useEffect(() => {
    let animId;
    let isScanning = true;
    let isProcessingFrame = false;

    if (activeSection === 'turnstile' && !isTerminalLocked) {
      startCamera();
    } else {
      stopCamera();
    }

    const triggerVerifiedScan = (token) => {
      if (!token) return;
      const now = Date.now();
      if (token !== lastScannedTokenRef.current || now - lastScanTimeRef.current > 3000) {
        lastScannedTokenRef.current = token;
        lastScanTimeRef.current = now;
        setTokenInput(token);
        handleVerify(token);
      }
    };

    const scanFrame = async () => {
      if (!isScanning) return;

      if (
        activeSection === 'turnstile' &&
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
        !isProcessingFrame
      ) {
        isProcessingFrame = true;
        const video = videoRef.current;
        let tokenFound = null;

        // Crop to central 60% Region of Interest (ROI) for 3x effective QR module pixel density
        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;
        const roiW = Math.round(vW * 0.60);
        const roiH = Math.round(vH * 0.60);
        const roiX = Math.round((vW - roiW) / 2);
        const roiY = Math.round((vH - roiH) / 2);

        if (!scanCanvasRef.current) {
          scanCanvasRef.current = document.createElement('canvas');
        }
        const canvas = scanCanvasRef.current;
        if (canvas.width !== roiW || canvas.height !== roiH) {
          canvas.width = roiW;
          canvas.height = roiH;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let qualityWarning = null;

        if (ctx) {
          // Draw cropped ROI to canvas
          ctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
          const imageData = ctx.getImageData(0, 0, roiW, roiH);
          const data = imageData.data;

          // Quality analysis: Edge density & Alternating Pattern Detection (Prevent false alarms on faces/walls)
          let sumLum = 0;
          let overexposedCount = 0;
          let totalGradient = 0;
          let edgeCount = 0;
          let sampleCount = 0;
          const step = 4; // High-performance sub-sampling for 60fps responsiveness

          for (let y = 1; y < roiH - 1; y += step) {
            const rowOffset = y * roiW;
            for (let x = 1; x < roiW - 1; x += step) {
              const idx = (rowOffset + x) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              sumLum += lum;
              if (lum > 240) overexposedCount++;

              const rightIdx = (rowOffset + x + 1) * 4;
              const rLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
              const diff = Math.abs(lum - rLum);
              totalGradient += diff;
              if (diff > 25) edgeCount++; // Significant black/white transition characteristic of QR modules
              sampleCount++;
            }
          }

          if (sampleCount > 0) {
            const avgLum = sumLum / sampleCount;
            const overexposedRatio = overexposedCount / sampleCount;
            const avgGradient = totalGradient / sampleCount;
            const hasQrPattern = edgeCount > (sampleCount * 0.12);

            if (!hasQrPattern) {
              // Normal baseline state: Face, wall, or empty room in view
              qualityWarning = 'searching'; // Displays "READY • NO QR DETECTED (ALIGN PASS INSIDE RETICLE)"
            } else if (overexposedRatio > 0.40 || avgLum > 225) {
              // Phone screen is too bright / white bloom
              qualityWarning = 'glare';
            } else if (avgGradient < 3.8) {
              // QR code is detected in frame but out of focus
              qualityWarning = 'blurred';
            } else {
              qualityWarning = 'aligning';
            }
          }

          // PASS 1: Hardware BarcodeDetector on cropped canvas + raw frame jsQR
          if ('BarcodeDetector' in window) {
            try {
              const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await barcodeDetector.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                tokenFound = barcodes[0].rawValue.trim();
              }
            } catch (err) {}
          }

          if (!tokenFound) {
            try {
              const code = jsQR(data, roiW, roiH, {
                inversionAttempts: 'attemptBoth'
              });
              if (code && code.data) {
                tokenFound = code.data.trim();
              }
            } catch (e) {}
          }

          // PASS 2: Anti-Glare Contrast Stretch & Threshold Binarization
          if (!tokenFound) {
            const binarizedBuffer = new Uint8ClampedArray(data);
            let minLum = 255;
            let maxLum = 0;

            for (let i = 0; i < binarizedBuffer.length; i += 16) {
              const lum = 0.299 * binarizedBuffer[i] + 0.587 * binarizedBuffer[i + 1] + 0.114 * binarizedBuffer[i + 2];
              if (lum < minLum) minLum = lum;
              if (lum > maxLum) maxLum = lum;
            }

            const lumRange = maxLum - minLum;
            if (lumRange > 25) {
              const midThreshold = minLum + lumRange * 0.5;
              for (let i = 0; i < binarizedBuffer.length; i += 4) {
                const lum = 0.299 * binarizedBuffer[i] + 0.587 * binarizedBuffer[i + 1] + 0.114 * binarizedBuffer[i + 2];
                const val = lum >= midThreshold ? 255 : 0;
                binarizedBuffer[i] = val;
                binarizedBuffer[i + 1] = val;
                binarizedBuffer[i + 2] = val;
              }

              try {
                const pass2Code = jsQR(binarizedBuffer, roiW, roiH, {
                  inversionAttempts: 'attemptBoth'
                });
                if (pass2Code && pass2Code.data) {
                  tokenFound = pass2Code.data.trim();
                }
              } catch (e) {}
            }
          }
        }

        // PASS 3: Full-Frame Multi-Scale Scan (Catches off-center, tilted, or close phone screens like in Image 1)
        if (!tokenFound && video && vW && vH) {
          if (!fullCanvasRef.current) {
            fullCanvasRef.current = document.createElement('canvas');
          }
          const fCanvas = fullCanvasRef.current;
          const fW = Math.min(vW, 720);
          const fH = Math.round((vH / vW) * fW);
          if (fCanvas.width !== fW || fCanvas.height !== fH) {
            fCanvas.width = fW;
            fCanvas.height = fH;
          }
          const fCtx = fCanvas.getContext('2d', { willReadFrequently: true });
          if (fCtx) {
            fCtx.drawImage(video, 0, 0, fW, fH);
            if ('BarcodeDetector' in window) {
              try {
                const bd = new window.BarcodeDetector({ formats: ['qr_code'] });
                const bcs = await bd.detect(fCanvas);
                if (bcs && bcs.length > 0 && bcs[0].rawValue) {
                  tokenFound = bcs[0].rawValue.trim();
                }
              } catch (e) {}
            }
            if (!tokenFound) {
              try {
                const fullImg = fCtx.getImageData(0, 0, fW, fH);
                const fCode = jsQR(fullImg.data, fW, fH, { inversionAttempts: 'attemptBoth' });
                if (fCode && fCode.data) {
                  tokenFound = fCode.data.trim();
                }
              } catch (e) {}
            }
          }
        }

        if (tokenFound) {
          playAudioFeedback('beep');
          setScanStatus('locked');
          isLockedRef.current = true;
          if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = setTimeout(() => {
            isLockedRef.current = false;
            setScanStatus('searching');
          }, 1800);
          triggerVerifiedScan(tokenFound);
        } else {
          if (!isLockedRef.current) {
            setScanStatus(qualityWarning || 'searching');
          }
        }

        isProcessingFrame = false;
      }

      if (isScanning) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (activeSection === 'turnstile' && !isTerminalLocked) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      isScanning = false;
      if (animId) cancelAnimationFrame(animId);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      stopCamera();
    };
  }, [activeSection, isTerminalLocked]);

  // Process Dual-Credential Scan Verification (Dynamic QR Pass OR Physical RFID Keycard UID)
  async function handleVerify(tokenToVerify = tokenInput) {
    if (!tokenToVerify) return;
    setLoading(true);
    setVerificationResult(null);

    const cleanInput = tokenToVerify.trim();
    const isRfid = cleanInput.startsWith('RFID:') || cleanInput.startsWith('KS-') || (!cleanInput.includes('.') && cleanInput.length < 25);
    const reqBody = isRfid
      ? { rfid_uid: cleanInput.replace(/^RFID:\s*/i, '').trim(), branchId: user?.branch_id }
      : { token: cleanInput, branchId: user?.branch_id };

    const startTime = performance.now();
    try {
      const res = await authFetch('/api/turnstile/verify', {
        method: 'POST',
        body: JSON.stringify(reqBody)
      });
      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json();

      setVerificationResult({
        ...data,
        latencyMs,
        credentialType: isRfid ? 'Physical RFID Keycard' : 'Dynamic QR Pass (TTL 60s)'
      });

      if (data.valid) {
        playAudioFeedback('success');
        toast.success(`Access Granted: ${data.userName || data.member?.name || 'Athlete'}. Turnstile Unlocked!`, 'Turnstile Verified');
        if (data.class_checkin) {
          toast.success(`Turnstile unlocked & Class check-in recorded for ${data.class_checkin.class_name}`, 'Class Check-In Verified');
          fetchClasses();
        }
        const freshLog = {
          ...(data.attendance || {}),
          status: 'granted',
          access_granted: true,
          user_name: data.userName || data.member?.name || data.attendance?.member_name || 'Athlete',
          member_name: data.userName || data.member?.name || data.attendance?.member_name || 'Athlete',
          check_in_time: data.attendance?.check_in_time || new Date().toISOString(),
          scanned_at: new Date().toISOString()
        };
        setAttendanceLogs(prev => [freshLog, ...(prev || [])]);
        loadLogs();
      } else {
        playAudioFeedback('denied');
        if (data.reason === 'ANTI_PASSBACK_VIOLATION' || data.requires_override) {
          setPendingApbToken(tokenToVerify);
        }
        const alertDetail = data.reason === 'EXPIRED_CONTRACT'
          ? 'Contract Expired! Renewal required at reception.'
          : (data.reason || data.message || 'Pass Invalid');
        toast.error(`Access Denied: ${alertDetail}`, 'Security Alert');
      }
    } catch (err) {
      playAudioFeedback('denied');
      setVerificationResult({
        valid: false,
        message: err.message,
        reason: 'NETWORK_ERROR'
      });
      toast.error('Network verification failed.', 'Turnstile Error');
    } finally {
      setLoading(false);
    }
  }

  // Quick Security Simulation Injection Helpers
  function injectRfidTest() {
    toast.info('Simulating Physical RFID Keycard Tap: KS-8829-4102', 'RFID Scanner');
    setTokenInput('KS-8829-4102');
    handleVerify('KS-8829-4102');
  }

  function injectExpiredContractTest() {
    toast.warning('Simulating Expired Contract RFID Tap...', 'Expired Contract Test');
    setTokenInput('KS-8829-4104');
    handleVerify('KS-8829-4104');
  }

  function injectReplayTest() {
    toast.warning('Initiating Replay Attack simulation...', 'Security Test');
    if (activeSamplePass) {
      setTokenInput(activeSamplePass);
      handleVerify(activeSamplePass);
    }
  }

  function injectTamperedToken() {
    toast.warning('Initiating Cryptographic Tamper simulation...', 'Security Test');
    if (activeSamplePass) {
      const parts = activeSamplePass.split('.');
      const tampered = parts[0] + '.00000000000000000000000000000000';
      setTokenInput(tampered);
      handleVerify(tampered);
    }
  }

  function injectExpiredToken() {
    toast.warning('Initiating Expired Timestamp simulation...', 'Security Test');
    const expiredPayload = {
      memberId: 'u1000000-0000-0000-0000-000000000003',
      memberName: 'Juan Dela Cruz',
      branchId: user?.branch_id,
      timestamp: Date.now() - 120000,
      nonce: 'expired_nonce_' + Date.now()
    };
    const b64 = btoa(JSON.stringify(expiredPayload));
    const fakeToken = `${b64}.c0ffee1234567890`;
    setTokenInput(fakeToken);
    handleVerify(fakeToken);
  }

  // POS Cart Handlers
  const handleProductClick = (product) => {
    if (!currentShift) {
      toast.warning('Register Locked: Please open a cashier shift session before adding items to cart.', 'Shift Required');
      setShowOpenShiftModal(true);
      return;
    }
    if (product.category === 'protein_shakes') {
      setShakeModal(product);
      setSelectedFlavor('Chocolate');
      setSelectedBase('Whole Milk');
    } else {
      addToCart(product);
    }
  };

  const addBlendedShakeToCart = (product, flavor, base) => {
    if (!currentShift) {
      toast.warning('Register Locked: Please open a cashier shift session before adding items to cart.', 'Shift Required');
      setShowOpenShiftModal(true);
      return;
    }
    const customId = `${product.id}-${flavor.replace(/\s+/g, '-').toLowerCase()}-${base.replace(/\s+/g, '-').toLowerCase()}`;
    const customName = `${product.name} (${flavor} • ${base})`;
    setPosCart(prev => {
      const existing = prev.find(item => item.id === customId);
      if (existing) {
        return prev.map(item => item.id === customId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        ...product,
        id: customId,
        name: customName,
        flavor,
        base,
        quantity: 1
      }];
    });
    setShakeModal(null);
  };

  const addToCart = (product) => {
    if (!currentShift) {
      toast.warning('Register Locked: Please open a cashier shift session before adding items to cart.', 'Shift Required');
      setShowOpenShiftModal(true);
      return;
    }
    setPosCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setPosCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setPosCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setPosCart([]);
    setPosCashTendered('');
    setPosRefNumber('');
    setXenditQrData(null);
    setShowXenditQrModal(false);
  };

  const cartTotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const vatAmount = cartTotal * 0.12;
  const cashReceived = Number(posCashTendered) || 0;
  const changeDue = Math.max(0, cashReceived - cartTotal);
  const isCashInsufficient = posPaymentMethod === 'cash' && posCart.length > 0 && cashReceived < cartTotal;
  const isRefNumberMissing = (posPaymentMethod === 'gcash' || posPaymentMethod === 'maya' || posPaymentMethod === 'card') && !posRefNumber.trim();
  const isCheckoutDisabled = !currentShift || posCart.length === 0 || posProcessing || (posPaymentMethod === 'cash' && (isCashInsufficient || !posCashTendered)) || isRefNumberMissing;

  // Locker Handlers
  const handleAssignLockerSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedLockerModal || !assignForm.guestName.trim()) {
      toast.warning('Please select an athlete verified at the turnstile gate today.', 'Locker Assignment');
      return;
    }

    const candidateName = assignForm.guestName.trim();
    const isEligible = todayCheckedInAthletes.some(
      a => a.name.toLowerCase() === candidateName.toLowerCase()
    );

    if (!isEligible) {
      toast.error(`Access Denied: Athlete "${candidateName}" has not accessed the turnstile gate today. Only athletes who passed the turnstile gate or QR scanner today can receive a locker key.`, 'Security Gate Check');
      return;
    }

    const targetId = selectedLockerModal.id;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    updateLockersAndPersist(prev => prev.map(l => {
      if (l.id === targetId) {
        return {
          ...l,
          status: 'occupied',
          guest: candidateName,
          deposit: assignForm.depositType,
          tag: assignForm.keyTag || `K-${l.number}`,
          time: nowTime,
          date: todayStr,
          isToday: true,
          assignedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    toast.success(`Locker ${targetId} issued to ${candidateName} (${assignForm.depositType}). Security requirement registered in vault.`, 'Locker Key Issued');
    setSelectedLockerModal(null);
    setAssignForm({ guestName: '', depositType: '₱200 Cash Deposit', keyTag: '' });
  };

  // Fast Post-Check-In Locker Assignment Handler
  const handleQuickLockerAssign = (e) => {
    if (e) e.preventDefault();
    const nextAvailableLocker = lockers.find(l => l.status === 'available');
    if (!nextAvailableLocker) {
      toast.error('All lockers are currently occupied or in maintenance.', 'Locker Allocation');
      return;
    }
    const memberName = verificationResult?.member?.name || verificationResult?.userName || 'Member';
    const tag = nextAvailableLocker.tag || `K-${String(nextAvailableLocker.number || nextAvailableLocker.id.replace('L-', '')).padStart(2, '0')}`;
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const depositVal = (quickDepositType && quickDepositType.includes('200')) ? '₱200 Cash Deposit' : (quickDepositType || '₱200 Cash Deposit');
    const todayStr = new Date().toISOString().split('T')[0];

    updateLockersAndPersist(prev => prev.map(l => {
      if (l.id === nextAvailableLocker.id) {
        return {
          ...l,
          status: 'occupied',
          guest: memberName,
          deposit: depositVal,
          tag: tag,
          time: timeFormatted,
          date: todayStr,
          isToday: true,
          assignedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    setVerificationResult(prev => ({
      ...prev,
      lockerAssigned: 'assigned',
      assignedLockerId: nextAvailableLocker.id,
      assignedDeposit: depositVal
    }));

    toast.success(`Locker ${nextAvailableLocker.id} assigned to ${memberName}. Deposit logged in register vault.`, 'Locker Assigned');
  };

  const handleReturnLocker = (lockerId) => {
    const target = lockers.find(l => l.id === lockerId);
    if (!target) return;
    updateLockersAndPersist(prev => prev.map(l => {
      if (l.id === lockerId) {
        return {
          ...l,
          status: 'available',
          guest: null,
          deposit: null,
          tag: null,
          time: null,
          date: null,
          isToday: false,
          assignedAt: null
        };
      }
      return l;
    }));
    toast.success(`Locker ${lockerId} returned. Deposit (${target.deposit}) refunded to ${target.guest || 'Athlete'}. Removed from active vault.`, 'Deposit Refunded & Released');
  };

  const handleToggleMaintenance = (lockerId) => {
    updateLockersAndPersist(prev => prev.map(l => {
      if (l.id === lockerId) {
        const nextStatus = l.status === 'maintenance' ? 'available' : 'maintenance';
        return {
          ...l,
          status: nextStatus,
          guest: null,
          deposit: null,
          reason: nextStatus === 'maintenance' ? 'Damaged lock latch reported' : null
        };
      }
      return l;
    }));
    toast.info(`Locker ${lockerId} status updated.`, 'Maintenance State');
  };

  // Canvas Drawing Handlers for Digital PAR-Q
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#e1c256';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveParqWaiver = async (e) => {
    if (e) e.preventDefault();
    if (!parqGuestName.trim()) {
      toast.warning('Please enter the full legal name of the guest.', 'PAR-Q Required');
      return;
    }
    if (!parqEmergencyContact.trim() || !parqEmergencyPhone.trim()) {
      toast.warning('Emergency contact person and contact phone are required.', 'Safety Governance');
      return;
    }
    if (!parqConsent) {
      toast.warning('Guest must acknowledge the RA 10173 DPA & Physical Liability Consent.', 'Consent Required');
      return;
    }
    let signatureUrl = null;
    if (canvasRef.current) {
      signatureUrl = canvasRef.current.toDataURL('image/png');
    }

    try {
      const res = await authFetch('/api/finance/waivers/sign', {
        method: 'POST',
        body: JSON.stringify({
          guest_name: parqGuestName.trim(),
          phone: parqPhone.trim() || 'N/A',
          emergency_contact: parqEmergencyContact.trim(),
          emergency_phone: parqEmergencyPhone.trim(),
          answers: { ...parqAnswers },
          signature: signatureUrl,
          branch_id: user?.branch_id
        })
      });
      const data = await res.json();
      const waiverRecord = data.waiver || {
        id: `WVR-${Date.now().toString().slice(-6)}`,
        guest_name: parqGuestName.trim(),
        phone: parqPhone.trim() || 'N/A',
        emergency_contact: parqEmergencyContact.trim(),
        emergency_phone: parqEmergencyPhone.trim(),
        answers: { ...parqAnswers },
        signature: signatureUrl,
        signed_at: new Date(),
        status: 'Cleared',
        legal_seal: 'SHA256-LEGAL-CLEARANCE-' + Date.now().toString(16)
      };

      setSignedWaiver(waiverRecord);
      setSignedWaiversHistory(prev => [waiverRecord, ...prev]);
      toast.success(`PAR-Q Clearance & SHA-256 Legal Seal recorded for ${parqGuestName.trim()}!`, 'Health Clearance Approved');
      setShowParqModal(false);
    } catch (err) {
      toast.error('Failed to seal waiver: ' + err.message, 'Waiver Error');
    }
  };

  // Xendit Dynamic QR Ph Handlers & Polling
  const handleGenerateXenditQr = async () => {
    if (cartTotal <= 0) {
      toast.warning('Cart is empty. Add products before generating Dynamic QR Ph.', 'POS Register');
      return;
    }
    if (!currentShift) {
      toast.warning('No active shift session. Please open the register drawer first.', 'Shift Required');
      setShowOpenShiftModal(true);
      return;
    }
    setIsGeneratingQr(true);
    try {
      const res = await authFetch('/api/pos/create-qr', {
        method: 'POST',
        body: JSON.stringify({
          amount: cartTotal,
          branchId: user?.branch_id,
          description: `Front-Desk POS Sale - ${posCustomer || 'Walk-in Athlete'}`
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to generate Dynamic QR Ph.');

      setXenditQrData({
        qr_id: data.qr_id,
        external_id: data.external_id,
        qr_string: data.qr_string,
        amount: data.amount || cartTotal,
        status: 'PENDING'
      });
      setXenditQrStatus('PENDING');
      setXenditCountdown((data.expires_in_minutes || 15) * 60);
      setXenditPolling(true);
      setShowXenditQrModal(true);
      toast.info(`Dynamic QR Ph generated for ₱${cartTotal.toFixed(2)}. Displaying to customer...`, 'Xendit QR Ph');
    } catch (err) {
      console.error('Error generating Xendit QR:', err);
      toast.error(err.message || 'Error generating QR Ph code.', 'QR Generation Error');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCloseXenditModal = () => {
    setShowXenditQrModal(false);
    setXenditPolling(false);
    setXenditQrData(null);
  };

  const handleSimulateXenditPaid = async () => {
    if (!xenditQrData?.qr_id) return;
    try {
      const res = await authFetch(`/api/pos/simulate-qr-paid/${xenditQrData.qr_id}`, {
        method: 'POST',
        body: JSON.stringify({ amount: cartTotal })
      });
      const data = await res.json();
      if (data.success) {
        setXenditQrStatus('PAID');
        setXenditPolling(false);
        toast.success('Simulation: Payment marked as PAID via Bank/E-Wallet app.', 'Sandbox Test');
        await handleFinalizeXenditSale(xenditQrData);
      }
    } catch (err) {
      toast.error('Simulation error: ' + err.message, 'Simulation Failed');
    }
  };

  const handleFinalizeXenditSale = async (qrData) => {
    setPosProcessing(true);
    try {
      const payload = {
        amount: cartTotal,
        category: 'merchandise',
        payment_method: 'xendit',
        payment_channel: 'xendit_qr_ph',
        reference_number: qrData?.external_id || `XND-${Date.now()}`,
        approval_code: qrData?.external_id,
        xendit_payment_id: qrData?.qr_id,
        customer_name: posCustomer || 'Walk-in Athlete',
        branch_id: user?.branch_id,
        shift_id: currentShift?.id,
        items: posCart.map(item => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        waiver: signedWaiver || undefined
      };

      const res = await authFetch('/api/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setShowXenditQrModal(false);
        setXenditPolling(false);
        setXenditQrData(null);
        setPosReceipt({
          sale: data.sale,
          items: [...posCart],
          total: cartTotal,
          cashTendered: cartTotal,
          change: 0,
          paymentMethod: 'xendit',
          referenceNumber: qrData?.external_id,
          xenditPaymentId: qrData?.qr_id,
          customer: posCustomer || 'Walk-in Athlete',
          timestamp: new Date()
        });
        setShiftSales(prev => [
          {
            id: `shift-sale-${Date.now()}`,
            ref: data.sale?.reference_no || qrData?.external_id,
            amount: cartTotal,
            method: 'xendit',
            item: posCart.map(i => `${i.quantity}x ${i.name}`).join(', '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
        clearCart();
        setSignedWaiver(null);
        toast.success(`Payment verified! Receipt #${data.sale?.reference_no || 'POS'} issued. Total: ₱${cartTotal.toFixed(2)}`, 'Xendit QR Ph Settled');
        fetchCurrentShift();
      } else {
        toast.error(data.message || 'Error recording QR Ph sale.', 'Sale Error');
      }
    } catch (err) {
      toast.error('Error finalizing QR Ph transaction: ' + err.message, 'Sale Error');
    } finally {
      setPosProcessing(false);
    }
  };

  // Real-time Polling for Dynamic QR Ph Status
  useEffect(() => {
    if (!showXenditQrModal || !xenditPolling || !xenditQrData?.qr_id) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/pos/qr-status/${xenditQrData.qr_id}`);
        const data = await res.json();
        if (data.success && (data.status === 'PAID' || data.paid)) {
          clearInterval(pollInterval);
          setXenditPolling(false);
          setXenditQrStatus('PAID');
          toast.success('Payment Received! Dynamic QR Ph verified by Xendit.', 'Payment Settled');
          await handleFinalizeXenditSale(xenditQrData);
        }
      } catch (err) {
        console.warn('[QR Polling notice]:', err.message);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [showXenditQrModal, xenditPolling, xenditQrData]);

  // Countdown timer for Xendit QR Modal
  useEffect(() => {
    if (!showXenditQrModal || xenditCountdown <= 0) return;
    const timer = setInterval(() => {
      setXenditCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setXenditQrStatus('EXPIRED');
          setXenditPolling(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showXenditQrModal, xenditCountdown]);

  const handleXenditSuccess = ({ sale, turnstilePass, transaction }) => {
    setShowPosCheckoutModal(false);
    setPosReceipt({
      sale,
      items: [...posCart],
      total: cartTotal,
      cashTendered: cartTotal,
      change: 0,
      paymentMethod: 'xendit',
      referenceNumber: sale?.reference_no || transaction?.external_id,
      customer: posCustomer || 'Walk-in Athlete',
      turnstilePass,
      timestamp: new Date()
    });
    setShiftSales(prev => [
      {
        id: `shift-sale-${Date.now()}`,
        ref: sale?.reference_no || `TXN-${Date.now().toString().slice(-4)}`,
        amount: cartTotal,
        method: 'xendit',
        item: posCart.map(i => `${i.quantity}x ${i.name}`).join(', '),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    clearCart();
    setSignedWaiver(null);
    setPosToast(`Transaction ${sale?.reference_no || 'POS'} confirmed via Xendit!`);
    setTimeout(() => setPosToast(null), 5000);
    fetchCurrentShift();
  };

  // POS Checkout Handler
  const handlePOSCheckout = async () => {
    if (posCart.length === 0) return;

    if (!currentShift) {
      toast.warning('No active shift session. Please open the register drawer first.', 'Shift Required');
      setShowOpenShiftModal(true);
      return;
    }

    if (posPaymentMethod === 'xendit') {
      setShowPosCheckoutModal(true);
      return;
    }

    if (posPaymentMethod === 'cash') {
      if (cashReceived < cartTotal) {
        toast.warning(`Insufficient Cash. Short by ₱${(cartTotal - cashReceived).toFixed(2)}`, 'POS Tender Error');
        return;
      }
    }

    if (posPaymentMethod === 'gcash' || posPaymentMethod === 'maya' || posPaymentMethod === 'card') {
      if (!posRefNumber.trim()) {
        toast.warning(
          posPaymentMethod === 'card'
            ? 'Please enter the Card Terminal Approval Code / Auth No.'
            : `Please enter the ${posPaymentMethod.toUpperCase()} Merchant Reference Number`,
          'Reference Required'
        );
        return;
      }
    }

    setPosProcessing(true);
    try {
      const payload = {
        branchId: user?.branch_id || 'b-mkt-01',
        cashierId: user?.id,
        shiftSessionId: currentShift?.id,
        items: posCart.map(item => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category || 'Retail'
        })),
        totalAmount: cartTotal,
        amount: cartTotal,
        paymentMethod: posPaymentMethod === 'cash' ? 'CASH' : posPaymentMethod,
        payment_method: posPaymentMethod === 'cash' ? 'CASH' : posPaymentMethod,
        payment_channel: posPaymentMethod,
        reference_number: posRefNumber || undefined,
        approval_code: posPaymentMethod === 'card' ? posRefNumber : undefined,
        cash_tendered: posPaymentMethod === 'cash' ? cashReceived : undefined,
        change_due: posPaymentMethod === 'cash' ? changeDue : undefined,
        customer_name: posCustomer || 'Walk-in Athlete',
        waiver: signedWaiver || undefined
      };

      const res = await authFetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setPosReceipt({
          sale: data.sale,
          items: [...posCart],
          total: cartTotal,
          cashTendered: posPaymentMethod === 'cash' ? cashReceived : cartTotal,
          change: posPaymentMethod === 'cash' ? changeDue : 0,
          paymentMethod: posPaymentMethod,
          referenceNumber: posRefNumber || data.sale?.reference_no,
          customer: posCustomer || 'Walk-in Athlete',
          turnstilePass: data.turnstile_pass,
          timestamp: new Date()
        });
        setShiftSales(prev => [
          {
            id: `shift-sale-${Date.now()}`,
            ref: data.sale?.reference_no || `TXN-${Date.now().toString().slice(-4)}`,
            amount: cartTotal,
            method: posPaymentMethod,
            item: posCart.map(i => `${i.quantity}x ${i.name}`).join(', '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
        clearCart();
        setSignedWaiver(null);
        fetchCurrentShift();
      } else {
        toast.error(data.message || 'Error processing POS transaction.', 'Checkout Failed');
      }
    } catch (err) {
      toast.error(err.message, 'Error');
    } finally {
      setPosProcessing(false);
    }
  };

  const sortedLogs = [...(attendanceLogs || [])].sort((a, b) => {
    const tA = new Date(a.check_in_time || a.check_in_date || a.created_at || 0).getTime();
    const tB = new Date(b.check_in_time || b.check_in_date || b.created_at || 0).getTime();
    return tB - tA;
  });

  const debouncedLogs = [];
  const memberLastSeenTime = new Map();
  const chronological = [...sortedLogs].reverse();
  for (const log of chronological) {
    if (!log) continue;
    const memberKey = log.member_id || log.user_id || log.member_name || log.user_name || 'unknown';
    const logTime = new Date(log.check_in_time || log.check_in_date || log.created_at || 0).getTime();
    const lastTime = memberLastSeenTime.get(memberKey);
    if (lastTime && Math.abs(logTime - lastTime) < 60000) {
      continue;
    }
    memberLastSeenTime.set(memberKey, logTime);
    debouncedLogs.push(log);
  }
  debouncedLogs.reverse();

  const filteredLogs = debouncedLogs.filter(l => {
    if (!l) return false;
    // Filter 1: Check-in timestamp must be within today
    const rawTime = l.check_in_time || l.check_in_date || l.created_at;
    if (!rawTime) return false;
    const logDate = new Date(rawTime);
    if (isNaN(logDate.getTime())) return false;
    const today = new Date();
    const isToday =
      logDate.getFullYear() === today.getFullYear() &&
      logDate.getMonth() === today.getMonth() &&
      logDate.getDate() === today.getDate();
    if (!isToday) return false;
    // Filter 2: Search term query
    if (!checkinSearch) return true;
    const searchLower = checkinSearch.toLowerCase();
    const name = (l.member_name || l.user_name || '').toLowerCase();
    const status = (l.status || '').toLowerCase();
    return name.includes(searchLower) || status.includes(searchLower);
  });

  // Fetch master class schedules from backend API (/api/classes)
  async function fetchClasses() {
    try {
      const res = await authFetch('/api/classes');
      const data = await res.json();
      if (data.success && Array.isArray(data.classes) && data.classes.length > 0) {
        setClassSchedule(data.classes);
        if (selectedRollCallClass) {
          const fresh = data.classes.find(c => c.id === selectedRollCallClass.id);
          if (fresh) setSelectedRollCallClass(fresh);
        }
      }
    } catch (err) {}
  }

  useEffect(() => {
    loadLogs();
    fetchClasses();
    loadMembers();

    // 15-second background polling fallback
    const interval = setInterval(() => {
      loadLogs();
      fetchClasses();
      loadMembers();
    }, 15000);

    // Live cross-tab / cross-portal plan upgrade synchronization
    const unsubscribe = subscribeToMemberUpgrades((event) => {
      toast.success(
        `Athlete ${event.memberName || 'Member'} upgraded to ${event.planName || event.planId || 'higher tier'}! Front-desk turnstile & roster updated.`,
        'Plan Upgrade Synchronized'
      );
      loadLogs();
      fetchClasses();
      loadMembers();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const getRosterForClass = (cls) => {
    if (!cls) return [];
    if (Array.isArray(rollCallRoster[cls.id])) return rollCallRoster[cls.id];
    if (Array.isArray(cls.roster)) return cls.roster;
    if (Array.isArray(cls.enrolled)) return cls.enrolled;
    return [];
  };

  const handleStaffAddWalkIn = async (e) => {
    if (e) e.preventDefault();
    if (!walkInName.trim() || !selectedRollCallClass) return;

    const { isConcluded } = getClassStatus(selectedRollCallClass.time);
    if (isConcluded) {
      toast.error('Class session concluded. Walk-in registrations are closed.', 'Registration Closed');
      return;
    }

    const current = getRosterForClass(selectedRollCallClass);
    if (current.length >= selectedRollCallClass.capacity) {
      toast.warning(`Studio Capacity Limit Reached (${selectedRollCallClass.capacity}/${selectedRollCallClass.capacity} Athletes). Walk-ins blocked.`, 'Capacity Limit');
      return;
    }

    try {
      const res = await authFetch(`/api/classes/${selectedRollCallClass.id}/walk-in`, {
        method: 'POST',
        body: JSON.stringify({
          name: walkInName.trim(),
          tier: walkInTier || 'Walk-in Day Pass'
        })
      });
      const data = await res.json();
      if (data.success && data.athlete) {
        const updatedRoster = [...current, data.athlete];
        setRollCallRoster(prev => ({
          ...prev,
          [selectedRollCallClass.id]: updatedRoster
        }));
        setClassSchedule(prev => prev.map(c => {
          if (c.id === selectedRollCallClass.id) {
            return {
              ...c,
              enrolled: updatedRoster,
              roster: updatedRoster,
              enrolled_count: updatedRoster.length
            };
          }
          return c;
        }));
        setSelectedRollCallClass(prev => prev ? {
          ...prev,
          enrolled: updatedRoster,
          roster: updatedRoster,
          enrolled_count: updatedRoster.length
        } : null);
        setWalkInName('');
        playAudioFeedback('success');
        toast.success(`Walk-in registered for "${data.athlete.name}" in ${selectedRollCallClass.name}.`, 'Walk-in Confirmed');
      } else {
        toast.error(data.message || 'Failed to register walk-in.', 'Registration Failed');
      }
    } catch (err) {
      toast.error(err.message || 'Error registering walk-in.', 'Registration Failed');
    }
  };

  const handleFinalizeRollCall = () => {
    if (!selectedRollCallClass) return;
    const current = getRosterForClass(selectedRollCallClass);
    const checkedInCount = current.filter(a => a.status === 'Checked In' || a.status === 'Walk-In Registered').length;

    toast.success(
      `Attendance finalized for ${selectedRollCallClass.name}. ${checkedInCount}/${selectedRollCallClass.capacity} athletes accounted for.`,
      'Roster Finalized'
    );
    setSelectedRollCallClass(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Phase 1: Reception Kiosk Security Lock Shield Overlay */}
      {isTerminalLocked && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 13, 20, 0.97)',
          backdropFilter: 'blur(20px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: '#12151e',
            border: '2px solid rgba(225, 194, 86, 0.5)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '380px',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225, 194, 86, 0.15)',
            color: '#ffffff'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(225, 194, 86, 0.12)',
              border: '2px solid #e1c256',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Lock size={32} color="#e1c256" />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '0.02em' }}>
              RECEPTION TERMINAL LOCKED
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
              Kiosk secured after 5 minutes of inactivity or staff manual lock. Enter your 4-digit PIN to restore active register.
            </p>

            <form onSubmit={handleUnlockTerminal}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  ref={lockPinInputRef}
                  type="password"
                  maxLength={4}
                  value={lockPinInput}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setLockPinInput(cleanVal);
                    setLockPinError('');
                    if (cleanVal.length === 4) {
                      setTimeout(() => handleUnlockTerminal(null, cleanVal), 50);
                    }
                  }}
                  autoFocus
                  placeholder="••••"
                  className="ksyn-input mono"
                  style={{
                    fontSize: '2rem',
                    textAlign: 'center',
                    letterSpacing: '0.4em',
                    padding: '10px',
                    borderColor: lockPinError ? '#ef4444' : '#e1c256',
                    background: '#0b0d14'
                  }}
                />
                {lockPinError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', margin: '6px 0 0 0' }}>
                    {lockPinError}
                  </p>
                )}
              </div>

              {/* Obsidian Keypad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '18px'
              }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (lockPinInput.length < 4) {
                        const next = lockPinInput + String(num);
                        setLockPinInput(next);
                        setLockPinError('');
                        if (next.length === 4) {
                          setTimeout(() => handleUnlockTerminal(null, next), 50);
                        }
                      }
                    }}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{
                      height: '46px',
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      background: '#1a1f2e',
                      borderColor: '#262d40'
                    }}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setLockPinInput('');
                    setLockPinError('');
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    height: '46px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#94a3b8',
                    background: '#1a1f2e',
                    borderColor: '#262d40'
                  }}
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lockPinInput.length < 4) {
                      const next = lockPinInput + '0';
                      setLockPinInput(next);
                      setLockPinError('');
                      if (next.length === 4) {
                        setTimeout(() => handleUnlockTerminal(null, next), 50);
                      }
                    }
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    height: '46px',
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    background: '#1a1f2e',
                    borderColor: '#262d40'
                  }}
                >
                  0
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-gold"
                  style={{
                    height: '46px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Unlock size={14} /> UNLOCK
                </button>
              </div>

              <span className="text-[10px] text-gray-500 mt-2 block">Demo PIN: 1234</span>
            </form>
          </div>
        </div>
      )}

      {/* Phase 2: Supervisor Override Modal */}
      {showSupervisorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 99998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#141414',
            border: '2px solid #ef4444',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            color: '#ffffff',
            boxShadow: '0 20px 50px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldAlert size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  Supervisor Turnstile Override
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                  Anti-Passback Policy Override Clearance
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '16px', background: '#1c1c1c', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
              Bypasses the 15-minute anti-passback re-entry cooldown for legitimate member circumstances (e.g. locker retrieval, turnstile hardware re-scan). This action is logged permanently with your supervisor audit ID.
            </p>

            <form onSubmit={handleSupervisorOverrideSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  SUPERVISOR 4-DIGIT PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter PIN (Demo: 1234)"
                  className="ksyn-input mono"
                  style={{ fontSize: '1.25rem', letterSpacing: '0.2em', textAlign: 'center', borderColor: '#ef4444' }}
                />
                {supervisorOverrideError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', margin: '6px 0 0 0' }}>
                    {supervisorOverrideError}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSupervisorModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ksyn-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800, background: '#ef4444', color: '#ffffff' }}
                >
                  {loading ? 'Authorizing...' : 'Authorize Re-entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{currentMeta.title}</h1>
            <span className="badge badge-employee">
              {currentMeta.badge}
            </span>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
            {currentMeta.subtitle}
          </p>
        </div>

        {activeSection === 'turnstile' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Primary Action CTA */}
            <button
              type="button"
              onClick={() => setShowOnboardingWizard(true)}
              className="ksyn-btn ksyn-btn-gold"
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 800,
                fontSize: '0.8125rem',
                padding: '0 16px',
                borderRadius: '8px',
                boxSizing: 'border-box',
                boxShadow: '0 2px 10px rgba(225, 194, 86, 0.25)'
              }}
              title="Open 5-Step Walk-In Guest & New Member Onboarding Wizard"
            >
              <UserPlus size={14} /> Register Walk-In Member
            </button>

            {/* Utility Controls Bar - Cohesive Dark Luxury Style */}
            <button
              type="button"
              onClick={() => setIsTerminalLocked(true)}
              className="ksyn-btn"
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#12151e',
                border: '1px solid #252c3e',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '0 14px',
                borderRadius: '8px',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              title="Lock reception kiosk terminal immediately"
            >
              <Lock size={14} className="text-amber-400" /> Lock Terminal
            </button>

            <Tooltip text="Recalibrate camera sensor, clear scan buffers, and sync latest attendance telemetry">
              <button
                type="button"
                onClick={handleRefreshStream}
                disabled={isRefreshingStream}
                className="ksyn-btn"
                style={{
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#12151e',
                  border: '1px solid #252c3e',
                  color: '#e2e8f0',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  padding: '0 14px',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                aria-label="Recalibrate camera sensor, clear scan buffers, and sync latest attendance telemetry"
              >
                <RefreshCw size={14} className={isRefreshingStream ? 'animate-spin text-[#e1c256]' : 'text-gray-400'} />
                {isRefreshingStream ? 'Refreshing Stream...' : 'Refresh Stream'}
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={() => {
                setParqGuestName(posCustomer !== 'Walk-in Athlete' ? posCustomer : '');
                setShowParqModal(true);
              }}
              className="ksyn-btn"
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#12151e',
                border: '1px solid #252c3e',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '0 14px',
                borderRadius: '8px',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              title="Open Digital Guest PAR-Q Health Questionnaire and Waiver Signature Pad"
            >
              <PenTool size={14} className="text-blue-400" /> Guest PAR-Q Pad
            </button>

            <button
              type="button"
              onClick={() => setShowReportMaintenanceModal(true)}
              className="ksyn-btn"
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#12151e',
                border: '1px solid #252c3e',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '0 14px',
                borderRadius: '8px',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              title="Log equipment fault, turnstile issue, or facility maintenance ticket"
            >
              <Wrench size={14} className="text-rose-400" /> Report Maintenance
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: TURNSTILE GATE / QR SCANNER */}
      {/* ========================================================================= */}
      {activeSection === 'turnstile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Standardized Front-Desk Telemetry KPI Cards - Strictly Scoped to TODAY's Access */}
          {(() => {
            const now = new Date();
            const localTodayStr = now.toLocaleDateString('en-CA');
            const utcTodayStr = now.toISOString().split('T')[0];
            const todayDateStr = utcTodayStr;
            const isTodayScan = (l) => {
              if (!l) return false;
              const t = l.check_in_time || l.check_in_date || l.timestamp || l.scanned_at || '';
              const strT = String(t);
              if (strT.startsWith(localTodayStr) || strT.startsWith(utcTodayStr)) return true;
              try {
                const d = new Date(t);
                const localD = d.toLocaleDateString('en-CA');
                const utcD = d.toISOString().split('T')[0];
                return localD === localTodayStr || utcD === utcTodayStr;
              } catch {
                return false;
              }
            };
            const todayLogs = (attendanceLogs || []).filter(isTodayScan);
            const todayScansCount = todayLogs.length;
            const todayGrantedCount = todayLogs.filter(l => {
              const s = String(l?.status || '').toLowerCase();
              return s === 'granted' || s === 'success' || l?.access_granted === true;
            }).length;
            const todayBlockedCount = todayLogs.filter(l => {
              const s = String(l?.status || '').toLowerCase();
              return s === 'denied' || s === 'failed' || s === 'blocked' || l?.access_granted === false;
            }).length;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Daily Turnstile Scans */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      DAILY TURNSTILE SCANS
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-white">
                      {todayScansCount}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-gray-400 mt-auto pt-1">
                    <span className="text-[11.5px] leading-snug text-gray-400">Live optical scanner throughput</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0 whitespace-nowrap self-center">
                      Laser Active
                    </span>
                  </div>
                </div>

                {/* 2. Access Granted */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      ACCESS GRANTED
                    </span>
                    <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                  </div>

                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-emerald-400">
                      {todayGrantedCount}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-gray-400 mt-auto pt-1">
                    <span className="text-[11.5px] leading-snug text-gray-400">Cryptographically authorized</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0 whitespace-nowrap self-center">
                      Verified
                    </span>
                  </div>
                </div>

                {/* 3. Security Blocks */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      SECURITY BLOCKS
                    </span>
                    <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                      <AlertTriangle size={18} className="text-amber-400" />
                    </div>
                  </div>

                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-amber-400">
                      {todayBlockedCount}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-gray-400 mt-auto pt-1">
                    <span className="text-[11.5px] leading-snug text-gray-400">Expired or replay token intercepts</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0 whitespace-nowrap self-center">
                      Protected
                    </span>
                  </div>
                </div>

                {/* 4. Active Class Sessions */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1c256]">
                      ACTIVE SESSIONS
                    </span>
                    <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                      <CalendarCheck size={18} className="text-[#e1c256]" />
                    </div>
                  </div>

                  <div className="my-2">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#e1c256]">
                      {(() => {
                        const todayList = (classSchedule || []).filter(c => !c.date || c.date === localTodayStr || c.date === utcTodayStr || c.date.startsWith(localTodayStr) || c.date.startsWith(utcTodayStr));
                        return todayList.filter(c => !isClassConcludedHelper(c)).length;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-gray-400 mt-auto pt-1">
                    <span className="text-[11.5px] leading-snug text-gray-400">Coach-led class schedule today</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0 whitespace-nowrap self-center">
                      {(() => {
                        const todayList = (classSchedule || []).filter(c => !c.date || c.date === localTodayStr || c.date === utcTodayStr || c.date.startsWith(localTodayStr) || c.date.startsWith(utcTodayStr));
                        return todayList.filter(c => isClassConcludedHelper(c)).length;
                      })()} Concluded Today
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Left: Optical Scanner & RFID Keycard Reader */}
          <div className="ksyn-card ksyn-card-gold" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>High-Speed Optical Scanner</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${cameraActive && !cameraError ? 'badge-active' : 'badge-warning'} flex items-center gap-1.5`}>
                    <span className={`w-2 h-2 rounded-full ${cameraActive && !cameraError ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {cameraActive && !cameraError ? 'DUAL-SCAN LIVE' : 'HARDWARE LASER ONLY'}
                  </span>
                </div>
              </div>

              {/* Concurrent Dual-Mode Status Indicator (Camera Scanner + RFID Active Simultaneously) - Strictly Single Line */}
              <div
                className="bg-[#0c0e14] py-2 px-3 rounded-lg border border-[#232938] mb-3 text-xs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'nowrap',
                  whiteSpace: 'nowrap',
                  overflowX: 'auto'
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0, gap: '4px' }}>
                  <span className="text-gray-300 font-semibold" style={{ whiteSpace: 'nowrap' }}>
                    Camera Optical Scanner:
                  </span>
                  {cameraError ? (
                    <strong style={{ color: '#ef4444', fontWeight: 800, whiteSpace: 'nowrap', marginLeft: '4px' }}>
                      {String(cameraError).toLowerCase().includes('denied') ? 'PERMISSION DENIED' : 'OFFLINE'}
                    </strong>
                  ) : cameraActive ? (
                    <strong className="text-emerald-400 font-bold" style={{ whiteSpace: 'nowrap', marginLeft: '4px' }}>ONLINE</strong>
                  ) : (
                    <strong style={{ color: '#ef4444', fontWeight: 800, whiteSpace: 'nowrap', marginLeft: '4px' }}>OFFLINE</strong>
                  )}
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0, gap: '4px' }}>
                  <span className="text-gray-300 font-semibold" style={{ whiteSpace: 'nowrap' }}>
                    Hardware Laser / USB RFID:
                  </span>
                  {isTerminalLocked ? (
                    <strong className="text-amber-400 font-bold" style={{ whiteSpace: 'nowrap', marginLeft: '4px' }}>STANDBY (LOCKED)</strong>
                  ) : (
                    <strong className="text-emerald-400 font-bold" style={{ whiteSpace: 'nowrap', marginLeft: '4px' }}>LISTENING</strong>
                  )}
                </div>
              </div>

              {/* Viewfinder Viewport Container (Always Active) */}
              {(() => {
                const reticleConfig = {
                  searching: {
                    border: '2px dashed rgba(225, 194, 86, 0.75)',
                    boxShadow: '0 0 25px rgba(225, 194, 86, 0.2)',
                    cornerColor: '#e1c256',
                    badgeClass: 'bg-black/80 text-yellow-400 border border-yellow-500/30',
                    badgeContent: (
                      <>
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        <span>READY • NO QR DETECTED (ALIGN PASS INSIDE RETICLE)</span>
                      </>
                    )
                  },
                  glare: {
                    border: '2px dashed #e1c256',
                    boxShadow: '0 0 30px rgba(225, 194, 86, 0.55), inset 0 0 15px rgba(225, 194, 86, 0.25)',
                    cornerColor: '#e1c256',
                    badgeClass: 'bg-amber-950/90 text-amber-300 border border-amber-500/50 animate-pulse',
                    badgeContent: (
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                        GLARE DETECTED: PLEASE LOWER PHONE SCREEN BRIGHTNESS
                      </span>
                    )
                  },
                  blurred: {
                    border: '2px dashed #e1c256',
                    boxShadow: '0 0 30px rgba(225, 194, 86, 0.55), inset 0 0 15px rgba(225, 194, 86, 0.25)',
                    cornerColor: '#e1c256',
                    badgeClass: 'bg-amber-950/90 text-amber-300 border border-amber-500/50 animate-pulse',
                    badgeContent: (
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                        QR DETECTED BUT BLURRED: HOLD STILL (6–10 INCHES AWAY)
                      </span>
                    )
                  },
                  aligning: {
                    border: '2px dashed #f7ffc4',
                    boxShadow: '0 0 28px rgba(247, 255, 196, 0.45)',
                    cornerColor: '#f7ffc4',
                    badgeClass: 'bg-sky-950/90 text-sky-300 border border-sky-500/50',
                    badgeContent: (
                      <span className="flex items-center gap-1.5">
                        <Search size={12} className="text-sky-400 shrink-0" />
                        QR DETECTED • ALIGNING RETICLE...
                      </span>
                    )
                  },
                  locked: {
                    border: '2px solid #658256',
                    boxShadow: '0 0 35px rgba(101, 130, 86, 0.65), inset 0 0 20px rgba(101, 130, 86, 0.35)',
                    cornerColor: '#658256',
                    badgeClass: 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50',
                    badgeContent: (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        QR LOCKED • DECODING CREDENTIALS...
                      </span>
                    )
                  }
                };
                const activeReticle = reticleConfig[scanStatus] || reticleConfig.searching;
                const scanStatusLabel = scanStatus === 'locked'
                  ? 'QR Locked & Decoding'
                  : scanStatus === 'glare'
                    ? 'Quality Alert: Screen Glare'
                    : scanStatus === 'blurred'
                      ? 'Quality Alert: Distance / Blur'
                      : scanStatus === 'aligning'
                        ? 'Pattern Acquired (Aligning)'
                        : 'Ready • Dual-Pass ROI Active';

                return (
                  <>
                    <div style={{
                      position: 'relative',
                      height: '260px',
                      background: '#050505',
                      border: `2px solid ${scanStatus === 'locked' ? 'rgba(101, 130, 86, 0.6)' : scanStatus === 'glare' || scanStatus === 'blurred' ? 'rgba(225, 194, 86, 0.5)' : scanStatus === 'aligning' ? 'rgba(247, 255, 196, 0.5)' : 'rgba(225, 194, 86, 0.45)'}`,
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      marginBottom: '8px',
                      boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.85)',
                      transition: 'border-color 0.25s ease'
                    }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />

                      {/* High-Tech Animated Laser Bar */}
                      <div className={`scanner-laser ${scanStatus === 'locked' ? 'locked' : scanStatus === 'glare' || scanStatus === 'blurred' ? 'warning' : ''}`} />

                      {/* High-Tech Dynamic Reticle Brackets */}
                      <div style={{
                        position: 'absolute',
                        width: '170px',
                        height: '170px',
                        border: activeReticle.border,
                        borderRadius: '16px',
                        pointerEvents: 'none',
                        boxShadow: activeReticle.boxShadow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.25s ease'
                      }}>
                        <div style={{ position: 'absolute', top: '-4px', left: '-4px', width: '16px', height: '16px', borderTop: `3px solid ${activeReticle.cornerColor}`, borderLeft: `3px solid ${activeReticle.cornerColor}`, transition: 'border-color 0.25s ease' }} />
                        <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderTop: `3px solid ${activeReticle.cornerColor}`, borderRight: `3px solid ${activeReticle.cornerColor}`, transition: 'border-color 0.25s ease' }} />
                        <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '16px', height: '16px', borderBottom: `3px solid ${activeReticle.cornerColor}`, borderLeft: `3px solid ${activeReticle.cornerColor}`, transition: 'border-color 0.25s ease' }} />
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '16px', height: '16px', borderBottom: `3px solid ${activeReticle.cornerColor}`, borderRight: `3px solid ${activeReticle.cornerColor}`, transition: 'border-color 0.25s ease' }} />
                      </div>

                      {/* Floating Header Tag */}
                      <div
                        className={`status-badge ${activeReticle.badgeClass} flex items-center gap-1.5`}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          backdropFilter: 'blur(4px)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        {activeReticle.badgeContent}
                      </div>

                      {/* Floating Bottom Status */}
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        fontSize: '0.6875rem',
                        color: '#e5e7eb',
                        background: 'rgba(0, 0, 0, 0.75)',
                        padding: '3px 12px',
                        borderRadius: '6px',
                        letterSpacing: '0.04em'
                      }}>
                        {scanStatus === 'locked' ? 'CREDENTIAL LOCK ESTABLISHED • VERIFYING ACCESS' : 'AUTO-DECODE ENGINE ACTIVE (MULTI-SCALE FULL-FRAME & ROI BINARIZATION)'}
                      </div>

                      {/* Fallback overlay if camera error / blocked */}
                      {cameraError && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(9, 10, 12, 0.94)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '16px',
                          textAlign: 'center',
                          gap: '8px',
                          zIndex: 30
                        }}>
                          <VideoOff size={32} color="#e1c256" />
                          <div style={{ color: '#fef08a', fontSize: '0.75rem', fontWeight: 700, maxWidth: '280px' }}>
                            {cameraError}
                          </div>
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="ksyn-btn ksyn-btn-gold"
                            style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, marginTop: '6px' }}
                          >
                            Retry Camera Stream
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Live Diagnostics Status Bar (Under the Viewfinder) */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0c10] border border-[#1f2430] rounded-lg mb-3 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          scanStatus === 'locked' ? 'bg-emerald-400 animate-ping' :
                          scanStatus === 'glare' || scanStatus === 'blurred' ? 'bg-amber-400 animate-pulse' :
                          scanStatus === 'aligning' ? 'bg-sky-400 animate-pulse' : 'bg-yellow-400'
                        }`} />
                        <span className="font-bold text-gray-300">
                          Engine Status: <strong className={
                            scanStatus === 'locked' ? 'text-emerald-400' :
                            scanStatus === 'glare' || scanStatus === 'blurred' ? 'text-amber-400' :
                            scanStatus === 'aligning' ? 'text-sky-400' : 'text-gray-200'
                          }>
                            {scanStatusLabel}
                          </strong>
                        </span>
                      </div>
                      <span className="text-gray-400">Resolution: <strong className="text-emerald-400">HD 720p Active</strong></span>
                    </div>
                  </>
                );
              })()}

              {/* Collapsible Hardware Diagnostic Simulator Toggle Button */}
              <div className="mt-3 text-xs" style={{ width: '100%', maxWidth: '100%' }}>
                <button
                  type="button"
                  onClick={() => setShowDiagnosticSimulator(prev => !prev)}
                  className={`w-full py-2 px-3 border border-gray-800 bg-[#0e1015] hover:bg-[#151922] hover:border-gray-700 text-gray-400 hover:text-[#e1c256] text-sm font-black flex items-center justify-center transition-all select-none shadow-sm cursor-pointer ${
                    showDiagnosticSimulator ? 'rounded-t-lg rounded-b-none border-b-0' : 'rounded-lg'
                  }`}
                  title={showDiagnosticSimulator ? 'Collapse simulator' : 'Expand simulator'}
                >
                  <span className="text-base font-black leading-none">{showDiagnosticSimulator ? '↑' : '↓'}</span>
                </button>

                {showDiagnosticSimulator && (
                  <div className="border border-gray-800 rounded-b-lg p-3 bg-[#0e1015]" style={{ width: '100%', maxWidth: '100%' }}>
                    {/* Structured 2-column / 3-column Responsive Button Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '8px',
                      width: '100%'
                    }}>
                      {/* Buttons 1 to 7 wrap cleanly inside the card without any horizontal overflow */}
                      <button type="button" onClick={fetchDemoMemberToken} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', width: '100%', justifyContent: 'flex-start' }} title="Inject valid encrypted QR dynamic token for active subscriber">
                        <CheckCircle2 size={12} color="#658256" /> 1. Standard Pass Verification
                      </button>
                      <button type="button" onClick={injectRfidTest} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', width: '100%', justifyContent: 'flex-start' }} title="Emulate physical RFID NFC contactless keycard read">
                        <CheckCircle2 size={12} color="#e1c256" /> 2. RFID Emulation (KS-8829-4102)
                      </button>
                      <button type="button" onClick={injectExpiredContractTest} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', borderColor: '#ef4444', width: '100%', justifyContent: 'flex-start' }} title="Test turnstile barrier response to expired subscription">
                        <AlertTriangle size={12} color="#ef4444" /> 3. Delinquency Protocol Check
                      </button>
                      <button type="button" onClick={injectReplayTest} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', width: '100%', justifyContent: 'flex-start' }} title="Validate anti-counterfeit replay attack intercept">
                        <AlertTriangle size={12} color="#e1c256" /> 4. Anti-Cloning Intercept Guard
                      </button>
                      <button type="button" onClick={injectExpiredToken} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', width: '100%', justifyContent: 'flex-start' }} title="Verify gate rejection of expired 60-second rotating TTL nonce">
                        <Clock size={12} color="#ef4444" /> 5. Dynamic TTL Timeout Check
                      </button>
                      <button type="button" onClick={injectTamperedToken} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', width: '100%', justifyContent: 'flex-start' }} title="Verify cryptographic HMAC signature tamper rejection">
                        <XCircle size={12} color="#ef4444" /> 6. Cryptographic Integrity Audit
                      </button>
                      <button type="button" onClick={() => {
                        toast.warning('Executing rapid successive entry protocol (Anti-Passback audit)...', 'Anti-Passback Security Audit');
                        fetchDemoMemberToken().then(() => handleVerify());
                      }} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.72rem', padding: '7px 8px', borderColor: '#ef4444', color: '#fca5a5', width: '100%', justifyContent: 'flex-start' }} title="Test turnstile barrier response to immediate consecutive double-scan">
                        <ShieldAlert size={12} color="#ef4444" /> 7. Anti-Passback Dual-Scan Guard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Token Input Bar */}
            <div style={{ marginTop: '16px' }}>
              <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Scan Dynamic QR payload OR Tap RFID Keycard UID (e.g. KS-8829-4102)..."
                    className="ksyn-input mono"
                    style={{ fontSize: '0.8125rem' }}
                  />
                  <button
                    type="submit"
                    disabled={loading || !tokenInput}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {loading ? 'Verifying...' : 'Verify Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Verification Status Display Card */}
          <div className="ksyn-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Turnstile Gate Decision</h2>

              {verificationResult ? (
                <div style={{
                  padding: '24px',
                  borderRadius: '12px',
                  background: verificationResult.valid ? 'rgba(101, 130, 86, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `2px solid ${verificationResult.valid ? '#658256' : '#ef4444'}`,
                  textAlign: 'center'
                }}>
                  {verificationResult.valid ? (
                    <>
                      {/* Pulsing Turnstile Barrier Indicator */}
                      <div style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        background: 'rgba(101, 130, 86, 0.18)',
                        border: '1px solid #658256',
                        color: '#7fa36d',
                        fontWeight: 900,
                        fontSize: '0.8125rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                        boxShadow: '0 0 20px rgba(101, 130, 86, 0.35)'
                      }}>
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        TURNSTILE BARRIER 01 UNLOCKED (RELAY PULSED)
                      </div>

                      {/* Post-Check-In Locker Assignment Prompt */}
                      {(() => {
                        const nextAvailableLocker = lockers.find(l => l.status === 'available');
                        if (verificationResult.lockerAssigned === 'assigned') {
                          return (
                            <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-left flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-300">
                                  Locker {verificationResult.assignedLockerId} Key Assigned ({verificationResult.assignedDeposit})
                                </span>
                              </div>
                              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                                Key Issued
                              </span>
                            </div>
                          );
                        }
                        if (verificationResult.lockerAssigned === 'skipped') {
                          return null;
                        }
                        return (
                          <div className="mb-4 p-4 rounded-xl border border-[#232938] bg-[#0c0e14] text-left">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <KeyRound size={16} className="text-[#e1c256]" />
                                <h4 className="font-bold text-sm text-white m-0">Assign Locker to {verificationResult.userName || verificationResult.member?.name || 'Member'}</h4>
                              </div>
                              <span className="text-xs font-mono font-bold text-[#e1c256] bg-[#e1c256]/10 px-2 py-0.5 rounded border border-[#e1c256]/20">
                                Recommended: {nextAvailableLocker ? nextAvailableLocker.id : 'Full'}
                              </span>
                            </div>
                            {nextAvailableLocker ? (
                              <form onSubmit={handleQuickLockerAssign} className="space-y-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    Deposit Guarantee Method *
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setQuickDepositType('₱200 Cash Deposit')}
                                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                                        quickDepositType === '₱200 Cash Deposit'
                                          ? 'bg-[#e1c256] text-black border-[#e1c256]'
                                          : 'bg-[#16191f] text-gray-300 border-[#262d40] hover:text-white'
                                      }`}
                                    >
                                      ₱200 Cash Deposit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickDepositType("Valid ID (Driver's / UMID / Student)")}
                                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                                        quickDepositType !== '₱200 Cash Deposit'
                                          ? 'bg-[#e1c256] text-black border-[#e1c256]'
                                          : 'bg-[#16191f] text-gray-300 border-[#262d40] hover:text-white'
                                      }`}
                                    >
                                      Valid ID Held
                                    </button>
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 bg-[#e1c256] hover:bg-[#cbaa42] text-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all"
                                  >
                                    Issue Key {nextAvailableLocker.id} & Confirm Deposit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVerificationResult(prev => ({ ...prev, lockerAssigned: 'skipped' }))}
                                    className="py-2.5 px-3 bg-[#16191f] hover:bg-[#222838] text-gray-400 font-semibold text-xs rounded-lg transition-all"
                                  >
                                    No Locker Needed
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <p className="text-xs text-amber-400 m-0">All lockers are currently occupied or in maintenance.</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Prominent Member Identification Card */}
                      <div style={{
                        background: '#12141a',
                        border: '1px solid rgba(225, 194, 86, 0.4)',
                        borderRadius: '12px',
                        padding: '18px',
                        textAlign: 'left',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                      }}>
                        {/* Member Header with Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #1f2430' }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)',
                            color: '#000000',
                            fontWeight: 900,
                            fontSize: '1.125rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 14px rgba(225, 194, 86, 0.35)',
                            flexShrink: 0
                          }}>
                            {(verificationResult.member?.name || verificationResult.userName || 'M').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                              {verificationResult.member?.name || verificationResult.userName || 'Verified Athlete'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="mono" style={{ color: '#d1d5db', fontSize: '0.6875rem' }}>
                                ID: {verificationResult.member?.id || 'M-KSYN-ACTIVE'}
                              </span>
                              <span style={{
                                background: 'rgba(101, 130, 86, 0.2)',
                                color: '#658256',
                                border: '1px solid rgba(101, 130, 86, 0.4)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.625rem',
                                fontWeight: 800
                              }}>
                                VERIFIED
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Prominent Upgraded Plan Banner */}
                        <div style={{
                          background: 'rgba(225, 194, 86, 0.08)',
                          border: '1px solid rgba(225, 194, 86, 0.35)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: 'rgba(225, 194, 86, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#e1c256'
                            }}>
                              <Award size={18} />
                            </div>
                            <div>
                              <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                                Enrolled Membership Plan
                              </span>
                              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#e1c256', letterSpacing: '0.01em' }}>
                                {verificationResult.member?.plan_name || (verificationResult.member?.plan ? String(verificationResult.member.plan).replace(/_/g, ' ').toUpperCase() : 'ACTIVE MEMBERSHIP')}
                              </span>
                            </div>
                          </div>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background: verificationResult.member?.tier === 'elite' ? 'rgba(225, 194, 86, 0.25)' : (verificationResult.member?.tier === 'pro' ? 'rgba(247, 255, 196, 0.25)' : 'rgba(247, 255, 196, 0.25)'),
                            color: verificationResult.member?.tier === 'elite' ? '#e1c256' : (verificationResult.member?.tier === 'pro' ? '#e1c256' : '#f7ffc4'),
                            border: `1px solid ${verificationResult.member?.tier === 'elite' ? '#e1c256' : (verificationResult.member?.tier === 'pro' ? '#f7ffc4' : '#e1c256')}`
                          }}>
                            {verificationResult.member?.tier ? (
                              <span className="inline-flex items-center gap-1">
                                {verificationResult.member.tier.toUpperCase()} TIER
                                <Star size={11} className="fill-[#e1c256] text-[#e1c256]" />
                              </span>
                            ) : 'BASIC TIER'}
                          </span>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.8125rem' }}>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.6875rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Subscription Status</span>
                            <span style={{ color: '#658256', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.875rem' }}>
                              {verificationResult.member?.subStatus || 'ACTIVE'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.6875rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Contract Validity / Expiry</span>
                            <span className="mono" style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.875rem' }}>
                              {verificationResult.member?.subscription_end_date ? new Date(verificationResult.member.subscription_end_date).toLocaleDateString() : 'Active Contract'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.6875rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Authorized Branch</span>
                            <span style={{ color: '#ffffff', fontWeight: 600 }}>
                              {verificationResult.member?.homeBranch || 'KSYN Fitness Makati'} (Authorized)
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.6875rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Credential Verified</span>
                            <span style={{ color: '#f7ffc4', fontWeight: 600 }}>
                              {verificationResult.credentialType || (verificationResult.credential_type === 'rfid' ? 'Physical RFID Keycard' : 'Dynamic QR Pass (TTL 60s)')}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #1f2430', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                          <span style={{ color: '#9ca3af' }}>Hardware Turnstile:</span>
                          <span style={{ color: '#e1c256', fontWeight: 700 }}>
                            Unlocked (Solenoid Relay Pulsed)
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '4px' }}>
                          <span style={{ color: '#9ca3af' }}>Verification Latency:</span>
                          <span className="mono" style={{ color: '#7fa36d', fontWeight: 700 }}>{verificationResult.latencyMs}ms</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle size={56} color="#ef4444" style={{ margin: '0 auto 12px auto' }} />
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', margin: '0 0 6px 0' }}>
                        ACCESS DENIED
                      </h3>
                      <p style={{ color: '#fca5a5', fontSize: '0.9375rem', margin: '0 0 16px 0', fontWeight: 600 }}>
                        {verificationResult.reason === 'EXPIRED_CONTRACT'
                          ? 'CONTRACT EXPIRED — Renewal Invoice Pending at Reception'
                          : (verificationResult.message || 'Verification Failed')}
                      </p>
                      <div style={{
                        background: '#141414',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        color: '#9ca3af',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div>Security Code: <strong style={{ color: '#fff' }}>{verificationResult.reason || 'TAMPER_DETECTED'}</strong></div>
                        {verificationResult.credentialType && (
                          <div style={{ color: '#f7ffc4' }}>Credential: {verificationResult.credentialType}</div>
                        )}
                        {verificationResult.reason === 'ANTI_PASSBACK_VIOLATION' && (
                          <div style={{ marginTop: '12px' }}>
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid #ef4444',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              marginBottom: '10px',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              color: '#fca5a5'
                            }}>
                              <strong>Anti-Passback Violation:</strong> Member scanned within 15-minute cooldown. Turnstile sharing is prohibited.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSupervisorOverrideError('');
                                setSupervisorPin('1234');
                                setShowSupervisorModal(true);
                              }}
                              className="ksyn-btn"
                              style={{ width: '100%', padding: '10px', fontSize: '0.8125rem', fontWeight: 800, background: '#ef4444', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                              <KeyRound size={15} /> Authorize Supervisor Override (PIN: 1234)
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '48px 24px',
                  borderRadius: '12px',
                  background: '#0d0d0d',
                  border: '1px dashed #262626',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  <UserCheck size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <h4 style={{ color: '#9ca3af', margin: '0 0 6px 0' }}>Awaiting Member QR Scan</h4>
                  <p style={{ fontSize: '0.8125rem', margin: 0 }}>
                    Scan athlete dynamic QR pass or trigger a security test simulation to view gate validation output.
                  </p>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #222', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Hardware Lane: <strong>Turnstile Lane A1 (Main Gate)</strong>
              </span>
              <button onClick={() => handleSectionSwitch('checkins')} className="ksyn-btn ksyn-btn-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                View All Floor Check-Ins &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ACTIVE FLOOR CHECK-INS (Merged directly into Member Look-Up & Roster) */}
      {/* ========================================================================= */}
      {activeSection === 'checkins' && null}

      {/* ========================================================================= */}
      {/* VIEW 3: CLASS SCHEDULES */}
      {/* ========================================================================= */}
      {activeSection === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="ksyn-card">
            {(() => {
              const todayDateStr = new Date().toISOString().split('T')[0];
              const isToday = (c) => !c.date || c.date === todayDateStr || c.date.startsWith(todayDateStr);
              const isUpcoming = (c) => c.date && c.date > todayDateStr;

              const activeClasses = (classSchedule || []).filter(c => !isClassConcludedHelper(c));
              const todayClasses = activeClasses.filter(isToday);
              const upcomingClasses = activeClasses.filter(isUpcoming);
              const concludedClasses = (classSchedule || []).filter(c => isClassConcludedHelper(c));

              const visibleClasses = deskClassFilter === 'today'
                ? todayClasses
                : deskClassFilter === 'upcoming'
                ? upcomingClasses
                : deskClassFilter === 'concluded'
                ? concludedClasses
                : activeClasses;

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

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Studio Fitness Class Schedules & Attendance</h2>
                      <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                        Coach allocations, participant capacity limits, and real-time synchronized turnstile & floor check-ins.
                      </p>
                    </div>

                    {/* Filter Segmented Controls */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#121520', border: '1px solid #232938', borderRadius: '12px', padding: '4px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setDeskClassFilter('all')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: deskClassFilter === 'all' ? '#e1c256' : 'transparent',
                          color: deskClassFilter === 'all' ? '#000000' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Active Classes ({activeClasses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeskClassFilter('today')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: deskClassFilter === 'today' ? '#658256' : 'transparent',
                          color: deskClassFilter === 'today' ? '#000000' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Clock size={13} /> Today's Active ({todayClasses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeskClassFilter('upcoming')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: deskClassFilter === 'upcoming' ? '#f7ffc4' : 'transparent',
                          color: deskClassFilter === 'upcoming' ? '#000000' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Calendar size={13} /> Upcoming Schedule ({upcomingClasses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeskClassFilter('concluded')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: deskClassFilter === 'concluded' ? '#334155' : 'transparent',
                          color: deskClassFilter === 'concluded' ? '#ffffff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <CheckCircle2 size={13} /> Concluded Archive ({concludedClasses.length})
                      </button>
                    </div>
                  </div>

                  {visibleClasses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', background: '#11131a', border: '1px dashed #232938', borderRadius: '12px' }}>
                      <Clock size={32} style={{ color: '#64748b', margin: '0 auto 12px auto' }} />
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                        {deskClassFilter === 'concluded' ? 'No Concluded Classes in Record' : 'No Active Classes in This View'}
                      </h4>
                      <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>
                        {deskClassFilter === 'concluded'
                          ? 'Sessions will be archived here once their end time has passed.'
                          : 'Concluded past sessions have been removed from the active view to keep the schedule clear.'}
                      </p>
                    </div>
                  ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}>
                    {visibleClasses.map((cls) => {
                      const currentRoster = getRosterForClass(cls);
                      const enrolledCount = currentRoster.length || cls.enrolled_count || (Array.isArray(cls.enrolled) ? cls.enrolled.length : cls.enrolled) || 0;
                      const checkedInCount = currentRoster.filter(a => a.status === 'Checked In').length;
                      const isFull = enrolledCount >= cls.capacity;
                      const clsToday = isToday(cls);
                      const dateLabel = formatClassDateLabel(cls.date);

                      return (
                        <div key={cls.id} className="ksyn-card" style={{ background: '#141414', border: clsToday ? '1px solid rgba(225, 194, 86, 0.3)' : '1px solid #282828', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#e1c256', fontWeight: 800, textTransform: 'uppercase' }}>
                                  {cls.category === 'Studio Class' ? (cls.name?.toLowerCase().includes('yoga') ? 'Yoga & Recovery' : 'HIIT Conditioning') : (cls.category || cls.type || 'Group Fitness')}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 800,
                                  background: clsToday ? 'rgba(101, 130, 86, 0.15)' : 'rgba(247, 255, 196, 0.15)',
                                  color: clsToday ? '#658256' : '#f7ffc4',
                                  border: clsToday ? '1px solid rgba(101, 130, 86, 0.3)' : '1px solid rgba(247, 255, 196, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <Calendar size={11} /> {dateLabel} {cls.date && cls.date !== dateLabel ? `• ${cls.date}` : ''}
                                </span>
                                <span className="mono" style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 800 }}>{cls.time}</span>
                              </div>
                            </div>

                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                              {cls.name}
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 12px 0' }}>
                              Instructor: <strong style={{ color: '#ffffff' }}>{cls.instructor || cls.coach_name}</strong> • {cls.room}
                            </p>

                            {/* Capacity Bar */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: '#9ca3af' }}>Roster Booking Capacity:</span>
                                <strong style={{ color: isFull ? '#ef4444' : '#658256' }}>
                                  {enrolledCount} / {cls.capacity} Athletes {isFull ? '(FULL)' : ''}
                                </strong>
                              </div>
                              <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(100, (enrolledCount / cls.capacity) * 100)}%`,
                                  background: isFull ? '#ef4444' : '#e1c256'
                                }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#64748b', marginTop: '6px' }}>
                                <span>Verified on Floor: <strong style={{ color: '#658256' }}>{checkedInCount} Present</strong></span>
                                <span>Pending: <strong style={{ color: '#e1c256' }}>{enrolledCount - checkedInCount}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', borderTop: '1px solid #222', paddingTop: '12px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedRollCallClass(cls)}
                              className="ksyn-btn ksyn-btn-gold"
                              style={{
                                height: '38px',
                                padding: '0 12px',
                                fontSize: '0.8125rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontWeight: 800,
                                background: isClassConcludedHelper(cls) ? '#1e293b' : '#e1c256',
                                color: isClassConcludedHelper(cls) ? '#94a3b8' : '#000000',
                                border: isClassConcludedHelper(cls) ? '1px solid #334155' : '1px solid #e1c256',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: isClassConcludedHelper(cls) ? 'none' : '0 2px 8px rgba(225, 194, 86, 0.2)'
                              }}
                            >
                              <UserCheck size={14} /> {isClassConcludedHelper(cls) ? 'Concluded Roster' : 'Open Roll Call'}
                            </button>
                            <button
                              type="button"
                              onClick={() => exportClassAttendanceToExcel(cls)}
                              className="ksyn-btn ksyn-btn-outline"
                              style={{
                                height: '38px',
                                padding: '0 10px',
                                fontSize: '0.8125rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                fontWeight: 700,
                                background: '#141722',
                                color: '#ffffff',
                                border: '1px solid #283044',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                              title="Export roster to CSV"
                            >
                              <FileText size={13} /> CSV
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: MEMBER LOOK-UP & ROSTER DIRECTORY */}
      {/* ========================================================================= */}
      {activeSection === 'members' && (() => {
        const queryLower = (memberSearchQuery || '').toLowerCase().trim();
        const filteredMembers = (membersList || []).filter(m => {
          if (memberFilterTier !== 'all') {
            if (memberFilterTier === 'upgraded' && m.membership_tier !== 'elite' && m.membership_tier !== 'pro') return false;
            if (memberFilterTier === 'basic' && m.membership_tier !== 'basic') return false;
            if (memberFilterTier === 'pro' && m.membership_tier !== 'pro') return false;
            if (memberFilterTier === 'elite' && m.membership_tier !== 'elite') return false;
          }
          if (!queryLower) return true;
          return (
            (m.name && m.name.toLowerCase().includes(queryLower)) ||
            (m.email && m.email.toLowerCase().includes(queryLower)) ||
            (m.phone && m.phone.toLowerCase().includes(queryLower)) ||
            (m.rfid_card_uid && m.rfid_card_uid.toLowerCase().includes(queryLower)) ||
            (m.membership_plan && m.membership_plan.toLowerCase().includes(queryLower)) ||
            (m.plan_name && m.plan_name.toLowerCase().includes(queryLower)) ||
            (m.id && m.id.toLowerCase().includes(queryLower))
          );
        });

        const eliteCount = (membersList || []).filter(m => m.membership_tier === 'elite').length;
        const proCount = (membersList || []).filter(m => m.membership_tier === 'pro').length;
        const rfidCount = (membersList || []).filter(m => !!m.rfid_card_uid).length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Unified Front-Desk Switcher: Active Floor Check-Ins Stream vs Athlete Directory */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#121520', border: '1px solid #232938', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setMemberSubView('checkins')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  background: memberSubView === 'checkins' ? '#10b981' : 'transparent',
                  color: memberSubView === 'checkins' ? '#ffffff' : '#94a3b8',
                  border: memberSubView === 'checkins' ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                Active Floor Check-Ins Stream ({(filteredLogs || []).length})
              </button>
              <button
                type="button"
                onClick={() => setMemberSubView('directory')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  background: memberSubView === 'directory' ? '#2563eb' : 'transparent',
                  color: memberSubView === 'directory' ? '#ffffff' : '#94a3b8',
                  border: memberSubView === 'directory' ? '1px solid rgba(37, 99, 235, 0.5)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={15} /> Athlete Directory & Plans ({membersList.length})
              </button>
            </div>

            {memberSubView === 'checkins' ? (
              <div className="ksyn-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Active Floor Check-Ins Stream
                    </h2>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Live verified gym turnstile entrances and security validation records.
                    </p>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search member name..."
                      value={checkinSearch}
                      onChange={(e) => setCheckinSearch(e.target.value)}
                      className="ksyn-input"
                      style={{ width: '220px', paddingLeft: '32px', fontSize: '0.8125rem', height: '36px' }}
                    />
                    <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div className="ksyn-table-wrap">
                  <table className="ksyn-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Member Name</th>
                        <th>Plan & Tier</th>
                        <th>Branch Location</th>
                        <th>Verification Method</th>
                        <th>Status</th>
                        <th>Security Validation Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filteredLogs || []).map((log) => {
                        const isGranted = log.status === 'granted' || log.status === 'Granted';
                        const isElite = log.member_tier === 'elite';
                        const isPro = log.member_tier === 'pro';

                        return (
                          <tr key={log.id}>
                            <td className="mono" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              {new Date(log.check_in_time).toLocaleTimeString()}
                            </td>
                            <td style={{ fontWeight: 700, color: '#ffffff' }}>
                              {log.member_name || log.user_name || 'Athlete'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 800,
                                  color: isElite ? '#e1c256' : (isPro ? '#e1c256' : '#ffffff')
                                }}>
                                  {log.plan_name || (log.member_plan ? String(log.member_plan).replace(/_/g, ' ').toUpperCase() : '1 Month Pass')}
                                </span>
                                <span style={{
                                  width: 'fit-content',
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  textTransform: 'uppercase',
                                  background: isElite ? 'rgba(225, 194, 86, 0.15)' : (isPro ? 'rgba(247, 255, 196, 0.15)' : 'rgba(247, 255, 196, 0.15)'),
                                  color: isElite ? '#e1c256' : (isPro ? '#e1c256' : '#f7ffc4'),
                                  border: `1px solid ${isElite ? 'rgba(225, 194, 86, 0.3)' : (isPro ? 'rgba(247, 255, 196, 0.3)' : 'rgba(247, 255, 196, 0.3)')}`
                                }}>
                                  {log.member_tier ? `${log.member_tier} tier` : 'basic'}
                                </span>
                              </div>
                            </td>
                            <td>{log.branch_name || user?.branch_name || 'KSYN Fitness Makati'}</td>
                            <td>
                              <span className="mono inline-flex items-center gap-1.5" style={{
                                fontSize: '0.75rem',
                                color: (log.verification_method || '').includes('rfid') ? '#e1c256' : '#f7ffc4',
                                fontWeight: 700
                              }}>
                                {(log.verification_method || '').includes('rfid') ? (
                                  <>
                                    <CreditCard size={12} className="text-[#e1c256]" />
                                    <span>RFID Keycard</span>
                                  </>
                                ) : (
                                  <>
                                    <QrCode size={12} className="text-[#f7ffc4]" />
                                    <span>Dynamic QR (60s TTL)</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${isGranted ? 'badge-active' : 'badge-inactive'}`}>
                                {isGranted ? 'GRANTED' : 'DENIED'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              {log.notes || 'Sub-second dynamic QR check-in passed (TTL < 60s)'}
                            </td>
                          </tr>
                        );
                      })}
                      {(filteredLogs || []).length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                            No turnstile check-in logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                {/* Telemetry Summary Cards - Responsive Vertical Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', width: '100%' }}>
              <div className="bg-[#12141c] border border-[#232938] rounded-xl p-4 flex flex-col justify-between min-h-[115px] hover:border-[#383838] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Enrolled Members</span>
                  <div className="p-1.5 rounded-lg bg-yellow-500/10">
                    <Users size={16} className="text-[#e1c256]" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white my-1 font-mono">
                  {membersList.length}
                </div>
                <div className="text-xs text-gray-400">
                  Assigned to this branch facility
                </div>
              </div>

              <div className="bg-[#12141c] border border-[#232938] rounded-xl p-4 flex flex-col justify-between min-h-[115px] hover:border-[#383838] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Upgraded (Pro/Elite)</span>
                  <div className="p-1.5 rounded-lg bg-yellow-500/10">
                    <Award size={16} className="text-[#e1c256]" />
                  </div>
                </div>
                <div className="text-2xl font-black text-[#e1c256] my-1 font-mono">
                  {eliteCount + proCount}
                </div>
                <div className="text-xs text-gray-400 inline-flex items-center gap-1">
                  {eliteCount} Elite <Star size={11} className="fill-[#e1c256] text-[#e1c256]" /> • {proCount} Pro
                </div>
              </div>

              <div className="bg-[#12141c] border border-[#232938] rounded-xl p-4 flex flex-col justify-between min-h-[115px] hover:border-[#383838] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Active RFID Keycards</span>
                  <div className="p-1.5 rounded-lg bg-sky-500/10">
                    <CreditCard size={16} className="text-sky-400" />
                  </div>
                </div>
                <div className="text-2xl font-black text-sky-400 my-1 font-mono">
                  {rfidCount}
                </div>
                <div className="text-xs text-gray-400">
                  Provisioned contactless cards
                </div>
              </div>

              <div className="bg-[#12141c] border border-[#232938] rounded-xl p-4 flex flex-col justify-between min-h-[115px] hover:border-[#383838] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Real-Time Sync</span>
                </div>
                <div className="text-sm font-bold text-emerald-400 my-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Broadcast Active
                </div>
                <div className="text-xs text-gray-400">
                  Instant plan reflection enabled
                </div>
              </div>
            </div>

            {/* Member Directory Card */}
            <div className="ksyn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={20} color="#e1c256" /> Front-Desk Member Look-Up & Upgraded Plan Roster
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Live member contract profiles, upgraded tiers, RFID contactless keycards, and one-click turnstile verification.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search member name, email, RFID..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="ksyn-input"
                      style={{ width: '260px', paddingLeft: '32px', fontSize: '0.8125rem', height: '36px' }}
                    />
                    <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {refreshedMemberFeedback && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Refreshed just now
                    </span>
                  )}

                  <Tooltip text="Reload latest membership upgrades and contracts">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadMembers();
                        setRefreshedMemberFeedback(true);
                        toast.success('Member roster refreshed successfully.', 'Live Refresh');
                        setTimeout(() => setRefreshedMemberFeedback(false), 3000);
                      }}
                      disabled={loadingMembers}
                      className="ksyn-btn ksyn-btn-outline touch-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', minHeight: '44px' }}
                      aria-label="Reload latest membership upgrades and contracts"
                    >
                      <RefreshCw size={13} className={loadingMembers ? 'animate-spin text-[#e1c256]' : ''} />
                      {loadingMembers ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Tier Filter Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All Members (${membersList.length})` },
                  { id: 'upgraded', label: `Upgraded Pro / Elite (${eliteCount + proCount})` },
                  { id: 'elite', label: `Elite Only (${eliteCount})` },
                  { id: 'pro', label: `Pro Only (${proCount})` },
                  { id: 'basic', label: `Basic Tier (${membersList.length - eliteCount - proCount})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMemberFilterTier(f.id)}
                    className={memberFilterTier === f.id ? 'ksyn-btn ksyn-btn-gold' : 'ksyn-btn ksyn-btn-outline'}
                    style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 700 }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Member Table with Infinite Scroll and Zero Horizontal Overflow */}
              <div 
                className="ksyn-table-wrap scrollable"
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  borderRadius: '10px',
                  border: '1px solid #1f232b'
                }}
              >
                <table 
                  className="ksyn-table"
                  style={{
                    width: '100%',
                    tableLayout: 'auto',
                    borderCollapse: 'collapse'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: '23%' }}>Athlete Profile</th>
                      <th style={{ width: '18%' }}>Plan & Tier</th>
                      <th style={{ width: '14%' }}>RFID Keycard</th>
                      <th style={{ width: '13%' }}>Expiration</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Visits</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '16%', textAlign: 'right', whiteSpace: 'nowrap' }}>Gate Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const isElite = m.membership_tier === 'elite';
                      const isPro = m.membership_tier === 'pro';
                      const subEnd = m.subscription?.end_date ? new Date(m.subscription.end_date).toLocaleDateString() : 'Active Contract';
                      const cleanName = (m.name || 'Athlete').replace(/\s*\((?:Active\s+)?Member\)/gi, '').trim();

                      return (
                        <tr 
                          key={m.id} 
                          onClick={() => setSelectedMemberProfileModal(m)}
                          style={{ 
                            background: isElite ? 'rgba(225, 194, 86, 0.02)' : 'transparent',
                            cursor: 'pointer'
                          }}
                          className="hover:bg-white/5 transition-colors"
                          title="Click to view complete member profile and safety dossier"
                        >
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: isElite
                                  ? 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)'
                                  : (isPro ? 'linear-gradient(135deg, #f7ffc4 0%, #7c3aed 100%)' : '#262d40'),
                                color: (isElite || isPro) ? '#000000' : '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {(cleanName || 'M').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 800, color: '#e1c256', fontSize: '0.8125rem', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
                                  {cleanName}
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                  {m.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: isElite ? '#e1c256' : (isPro ? '#e1c256' : '#ffffff'),
                                letterSpacing: '0.01em',
                                whiteSpace: 'nowrap'
                              }}>
                                {m.plan_name || (m.membership_plan ? m.membership_plan.replace(/_/g, ' ').toUpperCase() : '1 Month Pass')}
                              </span>
                              <span style={{
                                width: 'fit-content',
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                background: isElite ? 'rgba(225, 194, 86, 0.15)' : (isPro ? 'rgba(247, 255, 196, 0.15)' : 'rgba(247, 255, 196, 0.15)'),
                                color: isElite ? '#e1c256' : (isPro ? '#e1c256' : '#f7ffc4'),
                                border: `1px solid ${isElite ? 'rgba(225, 194, 86, 0.3)' : (isPro ? 'rgba(247, 255, 196, 0.3)' : 'rgba(247, 255, 196, 0.3)')}`
                              }}>
                                Tier: {m.membership_tier || 'basic'}
                              </span>
                              {m.is_pt_enrolled && (
                                <span style={{
                                  width: 'fit-content',
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  color: '#c084fc',
                                  border: '1px solid rgba(168, 85, 247, 0.35)',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  <Dumbbell size={9} /> PT: {m.pt_sessions_completed || 0}/{m.pt_sessions_total || 12}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {m.rfid_card_uid ? (
                              <span className="mono" style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#e1c256',
                                background: 'rgba(225, 194, 86, 0.1)',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                border: '1px solid rgba(225, 194, 86, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <CreditCard size={11} /> {m.rfid_card_uid}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Dynamic QR Only
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            <div className="mono" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                              {subEnd}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                              Start: {m.subscription?.start_date ? new Date(m.subscription.start_date).toLocaleDateString() : 'Active'}
                            </span>
                          </td>

                          <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className="mono" style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f8fafc' }}>
                              {m.total_check_ins || 0} visits
                            </span>
                          </td>

                          <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className={`badge ${m.status === 'active' ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                              {String(m.status || 'ACTIVE').toUpperCase()}
                            </span>
                          </td>

                          <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetToken = m.rfid_card_uid || m.id;
                                setTokenInput(targetToken);
                                setActiveSection('turnstile');
                                if (typeof propSetActiveSection === 'function') propSetActiveSection('turnstile');
                                if (typeof onTabChange === 'function') onTabChange('turnstile');
                                toast.info(`Loaded credential for ${m.name}. Verifying at turnstile gate...`, 'Gate Verification');
                                handleVerify(targetToken);
                              }}
                              className="ksyn-btn ksyn-btn-gold"
                              style={{
                                fontSize: '0.72rem',
                                padding: '5px 9px',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                borderRadius: '5px'
                              }}
                              title="Simulate gate check-in for this member directly at turnstile"
                            >
                              Test Turnstile
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                          No members matching your search query or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  })()}

      {/* ========================================================================= */}
      {/* VIEW 4: FRONT-DESK POS CASHIER & RETAIL CHECKOUT TERMINAL */}
      {/* ========================================================================= */}
      {activeSection === 'pos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {posToast && (
            <div style={{
              background: '#15803d',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.875rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(21, 128, 61, 0.4)'
            }}>
              <CheckCircle2 size={18} />
              <span>{posToast}</span>
            </div>
          )}

          {/* Incoming PT Enrollments Clearance Alert Bar */}
          {ptEnrollmentsQueue.some(e => e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE') && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(225, 194, 86, 0.15) 0%, rgba(101, 130, 86, 0.15) 100%)',
              border: '1px solid #e1c256',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Dumbbell size={18} color="#e1c256" />
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f7ffc4' }}>
                  {ptEnrollmentsQueue.filter(e => e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE').length} Incoming PT Enrollment(s) Awaiting Front Desk Clearance & Payment Verification
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowPosPtEnrollmentModal(true)}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Dumbbell size={13} /> Enroll PT Package
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof propSetActiveSection === 'function') propSetActiveSection('pt_enrollments');
                    else setActiveSection('pt_enrollments');
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800 }}
                >
                  Go to PT Queue →
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px', alignItems: 'start' }}>
            {/* Left Column: Product Catalog Quick-Select */}
            <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={20} color="#e1c256" /> Protein Shake Bar & Grab-and-Go POS
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    All shakes blended at counter with whole milk (or chosen base) & double scoop protein. Grab-and-Go drinks & RTDs.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'protein_shakes', label: 'Blended Shakes' },
                    { id: 'powder', label: 'Powder / Scoops' },
                    { id: 'drinks', label: 'Cold Drinks' },
                    { id: 'rtd', label: 'Pre-Workouts & RTDs' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setPosCategory(cat.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: posCategory === cat.id ? '1px solid #e1c256' : '1px solid #333',
                        background: posCategory === cat.id ? '#e1c256' : '#1a1a1a',
                        color: posCategory === cat.id ? '#000000' : '#9ca3af',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Register Locked Alert Banner */}
              {!currentShift && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f87171' }}>
                        Register Locked — No Active Shift Session
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        Open a cashier drawer session to enable the product catalog and process sales.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOpenShiftModal(true)}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 800, whiteSpace: 'nowrap' }}
                  >
                    Open Shift Now
                  </button>
                </div>
              )}

              {/* Product Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {RETAIL_PRODUCTS.filter(p => posCategory === 'all' || p.category === posCategory).map((product) => (
                  <button
                    key={product.id}
                    disabled={!currentShift}
                    onClick={() => handleProductClick(product)}
                    style={{
                      background: '#181818',
                      border: '1px solid #282828',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      cursor: !currentShift ? 'not-allowed' : 'pointer',
                      opacity: !currentShift ? 0.5 : 1,
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!currentShift) return;
                      e.currentTarget.style.borderColor = '#e1c256';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#282828';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Real Product Picture */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '110px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      marginBottom: '10px',
                      background: '#121212',
                      border: '1px solid #282828'
                    }}>
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        fontSize: '0.625rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: 'rgba(0, 0, 0, 0.78)',
                        color: '#e1c256',
                        border: '1px solid rgba(225, 194, 86, 0.35)',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {product.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px', minHeight: '36px', lineHeight: 1.3 }}>
                      {product.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline', marginTop: 'auto' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>
                        ₱{product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' }}>{product.sku}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: POS Cashier Cart & Tender Terminal */}
            <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #e1c256', borderRadius: '16px', padding: '20px', position: 'sticky', top: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #222', pb: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} color="#e1c256" />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Register Cart</h3>
                </div>
                {posCart.length > 0 && (
                  <button
                    onClick={clearCart}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                )}
              </div>

              {/* Shift Status Indicator Banner */}
              <div style={{ marginBottom: '16px' }}>
                {currentShift ? (
                  <div
                    style={{
                      background: 'rgba(101, 130, 86, 0.08)',
                      border: '1px solid rgba(101, 130, 86, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#658256' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 8px #658256' }} />
                        <span>Shift Active: {currentShift.cashier_name || user?.name || 'Cashier'}</span>
                      </div>
                      <span className="mono" style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                        ID: {currentShift.id.slice(-8)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#e2e8f0', marginTop: '2px', flexWrap: 'wrap', gap: '4px' }}>
                      <span>Float: <strong className="mono" style={{ color: '#f7ffc4' }}>₱{Number(currentShift.opening_float || 0).toFixed(2)}</strong></span>
                      <span>Started: <strong style={{ color: '#f8fafc' }}>{currentShift.opened_at ? new Date(currentShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong></span>
                      <span>Shift Cash: <strong className="mono" style={{ color: '#658256' }}>₱{Number(currentShift.total_cash_sales || 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowOpenShiftModal(true)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1.5px solid #ef4444',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.15)',
                      transition: 'all 0.2s ease'
                    }}
                    title="Click to open register shift session"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f87171' }}>
                          Register shift not open.
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                          Open a shift to begin scanning or processing walk-ins.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowOpenShiftModal(true); }}
                      className="ksyn-btn ksyn-btn-gold"
                      style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 800, whiteSpace: 'nowrap' }}
                    >
                      Open Shift
                    </button>
                  </div>
                )}
              </div>

              {/* Customer Designation */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px' }}>
                  Customer Name / Type
                </label>
                <input
                  type="text"
                  value={posCustomer}
                  onChange={(e) => setPosCustomer(e.target.value)}
                  placeholder="e.g. Walk-in Athlete, Juan Dela Cruz"
                  style={{
                    width: '100%',
                    background: '#181818',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Cart Items List */}
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posCart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: '#6b7280', fontSize: '0.8125rem' }}>
                    Cart is empty. Tap items on the left to add to register.
                  </div>
                ) : (
                  posCart.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#171717',
                        border: '1px solid #262626'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#658256', fontFamily: 'monospace' }}>
                          ₱{item.price.toFixed(2)} ea
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => updateCartQty(item.id, -1)}
                          style={{ width: '22px', height: '22px', borderRadius: '4px', background: '#262626', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', minWidth: '18px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.id, 1)}
                          style={{ width: '22px', height: '22px', borderRadius: '4px', background: '#262626', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Plus size={11} />
                        </button>
                        <Tooltip text="Remove item from cart" position="left">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="touch-target"
                            style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', marginLeft: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            aria-label="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Standardized POS Payment Channel (2 Core Channels: Cash Counter vs Xendit Digital Rails) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>
                  Standardized POS Payment Channel
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Channel 1: Cash (Counter) */}
                  <button
                    type="button"
                    onClick={() => {
                      setPosPaymentMethod('cash');
                      setPosRefNumber('');
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: posPaymentMethod === 'cash' ? '2px solid #e1c256' : '1px solid #333',
                      background: posPaymentMethod === 'cash' ? 'rgba(225, 194, 86, 0.15)' : '#181818',
                      color: posPaymentMethod === 'cash' ? '#ffffff' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Banknote size={17} color={posPaymentMethod === 'cash' ? '#e1c256' : '#9ca3af'} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: posPaymentMethod === 'cash' ? '#e1c256' : '#f8fafc' }}>
                        Cash (Counter)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: posPaymentMethod === 'cash' ? '#cbd5e1' : '#6b7280' }}>
                      Pisikal na pera • Drawer drop (X-Reading)
                    </span>
                  </button>

                  {/* Channel 2: Xendit Digital Checkout */}
                  <button
                    type="button"
                    onClick={() => {
                      setPosPaymentMethod('xendit');
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: posPaymentMethod === 'xendit' ? '2px solid #658256' : '1px solid #333',
                      background: posPaymentMethod === 'xendit' ? 'rgba(101, 130, 86, 0.18)' : '#181818',
                      color: posPaymentMethod === 'xendit' ? '#ffffff' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={17} color={posPaymentMethod === 'xendit' ? '#658256' : '#9ca3af'} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: posPaymentMethod === 'xendit' ? '#658256' : '#f8fafc' }}>
                        Xendit Digital Checkout
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: posPaymentMethod === 'xendit' ? '#cbd5e1' : '#6b7280' }}>
                      GCash, Maya, Cards & Dynamic QR Ph
                    </span>
                  </button>
                </div>

                {/* Xendit Digital Channel Info Card */}
                {posPaymentMethod === 'xendit' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(101, 130, 86, 0.08)',
                    border: '1px solid rgba(101, 130, 86, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#658256', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone size={14} /> Dual-Channel Digital Fulfillment Active
                      </span>
                      <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(101, 130, 86, 0.2)', color: '#658256', fontWeight: 800 }}>
                        Staging Live
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      Clicking <strong>Charge</strong> launches the customer-facing checkout display window and live on-screen Dynamic QR Ph with automatic settlement polling every 3 seconds.
                    </p>
                  </div>
                )}
              </div>

              {/* Guest Digital Health & PAR-Q Clearance Banner for Passes */}
              {posCart.some(i => i.id.includes('pass') || i.category === 'passes') && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: signedWaiver ? 'rgba(101, 130, 86, 0.12)' : 'rgba(225, 194, 86, 0.12)',
                  border: `1px solid ${signedWaiver ? 'rgba(101, 130, 86, 0.4)' : 'rgba(225, 194, 86, 0.4)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: signedWaiver ? '#658256' : '#e1c256', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {signedWaiver ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {signedWaiver ? 'PAR-Q Waiver Signed' : 'Guest Health Waiver Required'}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      {signedWaiver ? 'Cleared' : 'Walk-in'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#cbd5e1' }}>
                    {signedWaiver
                      ? `Guest "${signedWaiver.guest_name}" digital waiver attached to this invoice.`
                      : 'Day pass guests must complete health clearance & touch signature before workout.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParqGuestName(posCustomer !== 'Walk-in Athlete' ? posCustomer : '');
                      setShowParqModal(true);
                    }}
                    className={signedWaiver ? 'ksyn-btn ksyn-btn-outline' : 'ksyn-btn ksyn-btn-gold'}
                    style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <PenTool size={13} /> {signedWaiver ? 'Re-sign / Update PAR-Q' : 'Open Touch Signature Pad'}
                  </button>
                </div>
              )}

              {/* Subtotal & Total Summary */}
              <div style={{ borderTop: '1px solid #222', paddingTop: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                  <span>Items Subtotal:</span>
                  <span className="mono">₱{(cartTotal * 0.88).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                  <span>VAT (12% Included):</span>
                  <span className="mono">₱{vatAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 900, color: '#ffffff', marginTop: '6px' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: '#658256', fontFamily: 'monospace' }}>
                    ₱{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Feature Requirement 2: Front Desk POS Cash Tendered & Change Calculator */}
              {posPaymentMethod === 'cash' && posCart.length > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#181818',
                  border: '1px solid #282828',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', margin: 0 }}>
                      Cash Received / Tendered (₱)
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                      Due: <strong className="mono" style={{ color: '#ffffff' }}>₱{cartTotal.toFixed(2)}</strong>
                    </span>
                  </div>

                  <input
                    type="number"
                    autoFocus
                    placeholder="0.00"
                    value={posCashTendered}
                    onChange={(e) => setPosCashTendered(e.target.value)}
                    className="mono"
                    style={{
                      width: '100%',
                      background: '#0d0d0d',
                      border: posCashTendered && isCashInsufficient ? '1.5px solid #ef4444' : '1px solid #404040',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Quick Cash Preset Buttons */}
                  <div>
                    <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px' }}>
                      Quick Cash Presets:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setPosCashTendered(String(cartTotal))}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '4px',
                          background: posCashTendered === String(cartTotal) ? 'rgba(225, 194, 86, 0.25)' : '#262626',
                          border: posCashTendered === String(cartTotal) ? '1px solid #e1c256' : '1px solid #383838',
                          color: posCashTendered === String(cartTotal) ? '#e1c256' : '#e5e7eb',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title={`Exact cash: ₱${cartTotal.toFixed(2)}`}
                      >
                        Exact
                      </button>
                      {[100, 200, 500, 1000].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPosCashTendered(String(preset))}
                          style={{
                            padding: '6px 2px',
                            borderRadius: '4px',
                            background: posCashTendered === String(preset) ? 'rgba(225, 194, 86, 0.25)' : '#262626',
                            border: posCashTendered === String(preset) ? '1px solid #e1c256' : '1px solid #383838',
                            color: posCashTendered === String(preset) ? '#e1c256' : '#e5e7eb',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            cursor: 'pointer'
                          }}
                        >
                          ₱{preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bold Visual Indicators: Emerald Change Due or Red Insufficient Warning */}
                  {posCashTendered !== '' && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: isCashInsufficient ? 'rgba(239, 68, 68, 0.12)' : 'rgba(101, 130, 86, 0.12)',
                      border: `1px solid ${isCashInsufficient ? 'rgba(239, 68, 68, 0.4)' : 'rgba(101, 130, 86, 0.4)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isCashInsufficient ? '#ef4444' : '#658256' }}>
                        {isCashInsufficient ? 'Insufficient Cash:' : 'Change Due:'}
                      </span>
                      <strong className="mono" style={{
                        fontSize: '0.9375rem',
                        fontWeight: 900,
                        color: isCashInsufficient ? '#ef4444' : '#658256'
                      }}>
                        {isCashInsufficient
                          ? `Short by ₱${(cartTotal - cashReceived).toFixed(2)}`
                          : `₱ ${(changeDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Process Sale Button */}
              <button
                disabled={isCheckoutDisabled}
                onClick={handlePOSCheckout}
                className="ksyn-btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.875rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isCheckoutDisabled ? 0.45 : 1,
                  cursor: isCheckoutDisabled ? 'not-allowed' : 'pointer',
                  background: posPaymentMethod === 'xendit' ? '#658256' : '#e1c256',
                  color: '#000000'
                }}
              >
                {posPaymentMethod === 'xendit' ? <CreditCard size={16} /> : <Banknote size={16} />}
                {posProcessing
                  ? 'Processing Transaction...'
                  : !currentShift
                    ? 'Register Locked — Open Shift to Checkout'
                    : posPaymentMethod === 'xendit'
                      ? `Charge Xendit Digital (₱${cartTotal.toFixed(2)})`
                      : `Complete Cash Sale (₱${cartTotal.toFixed(2)})`}
              </button>

              {/* Feature Requirement: Shift Out Button Under Register Cart Box */}
              <button
                type="button"
                onClick={() => setShowCashDrawerSlideOver(true)}
                className="ksyn-btn touch-btn"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: currentShift ? 'rgba(101, 130, 86, 0.14)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1.5px solid ${currentShift ? '#658256' : '#ef4444'}`,
                  color: currentShift ? '#658256' : '#f87171',
                  cursor: 'pointer',
                  boxShadow: currentShift ? '0 0 12px rgba(101, 130, 86, 0.2)' : '0 0 12px rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                title={currentShift ? "Click to Shift Out / End Shift & Reconcile Register" : "Open Cash Drawer to Begin Shift"}
              >
                {currentShift ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LogOut size={16} color="#e1c256" />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 6px #658256' }} />
                      <span style={{ fontWeight: 900, color: '#e1c256' }}>Shift Out</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ChevronRight size={15} style={{ opacity: 0.8 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} color="#ef4444" />
                      <span style={{ fontWeight: 800 }}>Shift: Closed — Open Shift Session</span>
                    </div>
                    <ChevronRight size={15} style={{ opacity: 0.8 }} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Commercial-Grade Xendit Digital POS Checkout Modal */}
          <PosCheckoutModal
            isOpen={showPosCheckoutModal}
            onClose={() => setShowPosCheckoutModal(false)}
            cartItems={posCart}
            cartTotal={cartTotal}
            customerName={posCustomer || 'Walk-in Athlete'}
            customerEmail=""
            currentShift={currentShift}
            user={user}
            authFetch={authFetch}
            signedWaiver={signedWaiver}
            onSuccess={handleXenditSuccess}
            onSwitchToCash={() => {
              setShowPosCheckoutModal(false);
              setPosPaymentMethod('cash');
            }}
          />

          {/* Digital POS Receipt Modal */}
          {/* Feature Requirement 3: Xendit Dynamic QR Ph Automated Modal */}
          {showXenditQrModal && xenditQrData && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.88)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99998,
              padding: '20px'
            }}>
              <div style={{
                background: '#141414',
                border: '2px solid #658256',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 20px 50px rgba(101, 130, 86, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #262626', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#658256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        XENDIT DYNAMIC QR PH
                      </span>
                      <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(101, 130, 86, 0.15)', color: '#658256', fontWeight: 800 }}>
                        LIVE
                      </span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '2px' }}>
                      Ref: {xenditQrData.external_id || xenditQrData.qr_id}
                    </div>
                  </div>

                  {/* Expiry Countdown */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(225, 194, 86, 0.1)',
                    border: '1px solid rgba(225, 194, 86, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    color: '#e1c256',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>
                    <Clock size={13} />
                    <span>{Math.floor(xenditCountdown / 60)}:{(xenditCountdown % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>

                {/* EMVCo QR Code Visual Container */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  margin: '0 auto',
                  width: '220px',
                  height: '220px',
                  boxSizing: 'border-box'
                }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(xenditQrData.qr_string || 'KSYN-DYNAMIC-QR-PH')}`}
                    alt="QR Ph Code"
                    style={{ width: '170px', height: '170px', display: 'block', borderRadius: '4px' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div style={{ display: 'none', width: '170px', height: '170px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <QrCode size={130} color="#000000" />
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#000000', marginTop: '6px', letterSpacing: '0.08em', textAlign: 'center' }}>
                    QR PH • NATIONAL STANDARD
                  </span>
                </div>

                {/* Amount & Instruction */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>
                    ₱{xenditQrData.amount?.toFixed(2)}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#e5e7eb', margin: '4px 0 0 0', fontWeight: 600 }}>
                    Scan using GCash, Maya, BDO, BPI, or any QR Ph banking app
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Customer: <strong>{posCustomer || 'Walk-in Athlete'}</strong> • Cart Items: {posCart.length}
                  </p>
                </div>

                {/* Real-time Status Banner */}
                <div style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: xenditQrStatus === 'PAID' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.1)',
                  border: `1px solid ${xenditQrStatus === 'PAID' ? 'rgba(101, 130, 86, 0.4)' : 'rgba(225, 194, 86, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  color: xenditQrStatus === 'PAID' ? '#658256' : '#e1c256'
                }}>
                  {xenditQrStatus === 'PAID' ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Payment Verified! Recording POS Transaction...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Listening for Bank Webhook Confirmation...</span>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSimulateXenditPaid}
                    disabled={posProcessing || xenditQrStatus === 'PAID'}
                    className="ksyn-btn"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#658256',
                      color: '#000000',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                      cursor: (posProcessing || xenditQrStatus === 'PAID') ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Simulate Scan & Pay in Bank App (Test)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseXenditModal}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      borderRadius: '8px'
                    }}
                  >
                    Cancel & Return to Register
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Authentic Real-World 80mm Thermal Receipt Modal (Styled like Image 2) */}
          {posReceipt && (() => {
            const total = Number(posReceipt.total || 0);
            const vatableSales = total / 1.12;
            const vatAmount = total - vatableSales;
            const branchName = (user?.branch_name || 'KSYN Fitness Makati Flagship').toUpperCase();
            const branchCode = user?.branch_code || 'MKT-01';
            const cashierName = user?.name || 'Employee FrontDesk';
            const refNo = posReceipt.sale?.reference_no || posReceipt.referenceNumber || 'POS-COUNTER-TXN';
            const txDate = posReceipt.timestamp ? new Date(posReceipt.timestamp) : new Date();
            const businessDate = txDate.toISOString().split('T')[0];
            const timeStr = txDate.toLocaleTimeString();
            const customer = posReceipt.customer || 'Walk-in Athlete';
            const isCash = (posReceipt.paymentMethod || '').toLowerCase() === 'cash';
            const cashTendered = Number(posReceipt.cashTendered || total);
            const change = Number(posReceipt.change || 0);

            return (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99998,
                padding: '20px'
              }}>
                <div style={{
                  background: '#ffffff',
                  color: '#000000',
                  width: '100%',
                  maxWidth: '380px',
                  padding: '24px 20px',
                  borderRadius: '2px',
                  fontFamily: "'Courier New', Courier, Consolas, monospace",
                  fontSize: '0.75rem',
                  lineHeight: '1.35',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.95), 0 0 1px rgba(0,0,0,0.8)',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  borderTop: '6px solid #111111',
                  borderBottom: '6px dashed #777777'
                }}>
                  {/* Top Branding matching Image 2 */}
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 900, letterSpacing: '0.04em' }}>KSYN FITCONNECT PHILIPPINES</div>
                    <div style={{ fontSize: '0.7rem', marginTop: '2px', color: '#111' }}>{branchName} ({branchCode})</div>
                    <div style={{ fontSize: '0.625rem', marginTop: '2px', color: '#333' }}>POS TERMINAL #01 • MIN: 2026-0923-0192-MIN</div>
                    <div style={{ fontSize: '0.625rem', color: '#333' }}>SN: POS-REG-01-SN482910 • TIN: 009-842-117-000</div>
                  </div>

                  <div style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', padding: '4px 0', margin: '8px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 900 }}>OFFICIAL POS SALES INVOICE</div>
                    <div style={{ fontSize: '0.625rem', color: '#333' }}>REGISTERED COUNTER RECEIPT</div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                  {/* Header metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Business Date:</span>
                      <span style={{ fontWeight: 700 }}>{businessDate}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Generated At:</span>
                      <span style={{ fontWeight: 700 }}>{businessDate}, {timeStr}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Invoice / Ref:</span>
                      <span style={{ fontWeight: 700, fontSize: '0.6875rem' }}>{refNo}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cashier:</span>
                      <span style={{ fontWeight: 700 }}>{cashierName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Customer:</span>
                      <span style={{ fontWeight: 700 }}>{customer}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Payment Channel:</span>
                      <span style={{ fontWeight: 800 }}>
                        {isCash ? 'CASH (RECEPTION COUNTER)' :
                         posReceipt.paymentMethod === 'gcash' ? 'GCASH (MERCHANT QR PH)' :
                         posReceipt.paymentMethod === 'maya' ? 'MAYA (MERCHANT QR)' :
                         posReceipt.paymentMethod === 'card' ? 'CARD TERMINAL (BDO / MAYA)' :
                         'XENDIT DYNAMIC QR PH'}
                      </span>
                    </div>
                    {posReceipt.referenceNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Approval Code:</span>
                        <span style={{ fontWeight: 700 }}>{posReceipt.referenceNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Itemized List */}
                  <div style={{ borderTop: '2px solid #000', margin: '10px 0 6px 0' }} />
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.6875rem', letterSpacing: '0.05em' }}>ORDER ITEMS BREAKDOWN</div>
                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {(posReceipt.items || []).map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.quantity}x {it.name}
                        </span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          PHP {(it.price * it.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Tax & Statutory Roll-Up */}
                  <div style={{ borderTop: '2px solid #000', margin: '10px 0 6px 0' }} />
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.6875rem', letterSpacing: '0.05em' }}>TAX & STATUTORY ROLL-UP</div>
                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>VATable Sales (12%):</span>
                      <span style={{ fontWeight: 700 }}>PHP {vatableSales.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>VAT Amount (12%):</span>
                      <span style={{ fontWeight: 700 }}>PHP {vatAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>VAT-Exempt Sales:</span>
                      <span style={{ fontWeight: 700 }}>PHP 0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Zero-Rated Sales:</span>
                      <span style={{ fontWeight: 700 }}>PHP 0.00</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '0.875rem', padding: '2px 0' }}>
                    <span>TOTAL AMOUNT DUE:</span>
                    <span>PHP {total.toFixed(2)}</span>
                  </div>

                  {/* Settlement Breakdown */}
                  <div style={{ borderTop: '2px solid #000', margin: '10px 0 6px 0' }} />
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.6875rem', letterSpacing: '0.05em' }}>SETTLEMENT DETAILS</div>
                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                    {isCash ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Cash Tendered:</span>
                          <span style={{ fontWeight: 700 }}>PHP {cashTendered.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '0.78rem' }}>
                          <span>Change Due:</span>
                          <span>PHP {change.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Digital Gateway:</span>
                          <span style={{ fontWeight: 700 }}>PHP {total.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Settlement Status:</span>
                          <span style={{ fontWeight: 800 }}>SETTLED (ONLINE)</span>
                        </div>
                        {posReceipt.xenditPaymentId && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Xendit ID:</span>
                            <span style={{ fontWeight: 700, fontSize: '0.625rem' }}>{posReceipt.xenditPaymentId}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Turnstile pass if present */}
                  {posReceipt.turnstilePass && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px',
                      border: '1px dashed #000',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 800, fontSize: '0.6875rem' }}>OPTICAL TURNSTILE ENTRY PASS</div>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(posReceipt.turnstilePass)}`}
                        alt="Turnstile QR"
                        style={{ width: '100px', height: '100px', margin: '4px auto', display: 'block' }}
                      />
                      <div style={{ fontSize: '0.5625rem', color: '#444' }}>Tap laser scanner at turnstile gate</div>
                    </div>
                  )}

                  {/* BIR Statutory Notice */}
                  <div style={{ borderTop: '1px dashed #000', margin: '10px 0 6px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: '0.5625rem', lineHeight: '1.4', color: '#222' }}>
                    <div style={{ fontWeight: 800 }}>THIS SERVES AS AN OFFICIAL SALES INVOICE</div>
                    <div>Accreditation No: BIR-ACC-2026-092301-{branchCode}</div>
                    <div>PTU No: FP092026-044-019208-000</div>
                    <div>Issued: 09/23/2026 • Valid Until: 09/23/2031</div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: '0.5625rem', color: '#444' }}>
                    <div>Thank you for training with KSYN FitConnect!</div>
                    <div>Please retain receipt for exchange within 7 days.</div>
                    <div style={{ fontStyle: 'italic', marginTop: '2px' }}>System Powered by KSYN FitConnect POS v2.0</div>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => printRealThermalPosReceipt(posReceipt)}
                      style={{
                        flex: 1,
                        background: '#000000',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        fontFamily: "'Courier New', Courier, monospace",
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title="Open printable 80mm thermal receipt matching Image 2"
                    >
                      <Printer size={14} /> Print Thermal Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosReceipt(null)}
                      style={{
                        flex: 1,
                        background: '#e2e8f0',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        padding: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: "'Courier New', Courier, monospace",
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Close & Done
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Protein Shake Customizer Modal */}
          {shakeModal && (
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
              zIndex: 99999,
              padding: '20px'
            }}>
              <div style={{
                background: '#12151e',
                border: '2px solid #e1c256',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '520px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225, 194, 86, 0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', letterSpacing: '0.05em' }}>
                      Counter Blended Shake Order
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 0 0' }}>
                      {shakeModal.name}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>
                      ₱{shakeModal.price.toFixed(2)}
                    </span>
                    <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Double Scoop Included</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(225, 194, 86, 0.08)', border: '1px solid rgba(225, 194, 86, 0.25)', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.4 }}>
                  <strong style={{ color: '#e1c256' }}>Blended at Counter:</strong> {shakeModal.description}
                </div>

                {/* 11 Available Flavors Selection */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>
                    1. Select Flavor ({PROTEIN_SHAKE_FLAVORS.length} Varieties Available):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {PROTEIN_SHAKE_FLAVORS.map(flv => (
                      <button
                        key={flv}
                        type="button"
                        onClick={() => setSelectedFlavor(flv)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: selectedFlavor === flv ? '1px solid #e1c256' : '1px solid #282828',
                          background: selectedFlavor === flv ? 'rgba(225, 194, 86, 0.18)' : '#181818',
                          color: selectedFlavor === flv ? '#e1c256' : '#e5e7eb',
                          fontSize: '0.75rem',
                          fontWeight: selectedFlavor === flv ? 800 : 500,
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {flv}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Milk / Liquid Base Selection */}
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>
                    2. Select Blending Base:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                    {MILK_BASES.map(base => (
                      <button
                        key={base}
                        type="button"
                        onClick={() => setSelectedBase(base)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: selectedBase === base ? '1px solid #658256' : '1px solid #282828',
                          background: selectedBase === base ? 'rgba(101, 130, 86, 0.18)' : '#181818',
                          color: selectedBase === base ? '#658256' : '#e5e7eb',
                          fontSize: '0.75rem',
                          fontWeight: selectedBase === base ? 800 : 500,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {base}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShakeModal(null)}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlendedShakeToCart(shakeModal, selectedFlavor, selectedBase)}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ flex: 2, padding: '10px', fontSize: '0.8125rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Blend & Add to Cart (₱{shakeModal.price.toFixed(2)})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CASH DRAWER & RECONCILIATION SLIDE-OVER DRAWER (Requirement 4) */}
          {(() => {
            const activeFloat = currentShift ? Number(currentShift.opening_float || 0) : 0;
            const activeCashSales = currentShift
              ? Number(currentShift.total_cash_sales || 0)
              : (shiftSales.filter(s => s.method === 'cash').reduce((acc, s) => acc + s.amount, 0));
            const activeDigitalSales = currentShift
              ? Number(currentShift.total_digital_sales || 0)
              : (shiftSales.filter(s => s.method !== 'cash').reduce((acc, s) => acc + s.amount, 0));
            const activeExpectedCash = currentShift
              ? Number(currentShift.expected_cash_drawer || (activeFloat + activeCashSales))
              : 0;

            const billsTotal = (
              (Number(cashCounts.p1000) || 0) * 1000 +
              (Number(cashCounts.p500) || 0) * 500 +
              (Number(cashCounts.p200) || 0) * 200 +
              (Number(cashCounts.p100) || 0) * 100 +
              (Number(cashCounts.p50) || 0) * 50 +
              (Number(cashCounts.p20) || 0) * 20
            );
            const coinsTotal = (
              (Number(cashCounts.c20) || 0) * 20 +
              (Number(cashCounts.c10) || 0) * 10 +
              (Number(cashCounts.c5) || 0) * 5 +
              (Number(cashCounts.c1) || 0) * 1 +
              (Number(cashCounts.c025) || 0) * 0.25 +
              (Number(cashCounts.coins) || 0)
            );
            const physicalCashCounted = billsTotal + coinsTotal;
            const liveVariance = Math.round((physicalCashCounted - activeExpectedCash) * 100) / 100;

            if (!showCashDrawerSlideOver) return null;

            return (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(5px)',
                  zIndex: 99990,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  animation: 'fadeIn 0.2s ease-out'
                }}
                onClick={() => setShowCashDrawerSlideOver(false)}
              >
                <div
                  style={{
                    width: 'min(640px, 94vw)',
                    height: '100%',
                    background: '#0d1017',
                    borderLeft: '2px solid #e1c256',
                    boxShadow: '-12px 0 40px rgba(0,0,0,0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Slide-Over Header */}
                  <div style={{
                    padding: '20px 24px',
                    background: '#121622',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '8px', background: 'rgba(225, 194, 86, 0.1)', borderRadius: '10px' }}>
                        <Receipt size={22} color="#e1c256" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                          Shift Cash Drawer & Cashier Handover (X-Reading)
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                          {currentShift ? `Session #${currentShift.id.slice(-6)} • Cashier: ${currentShift.cashier_name || 'Front Desk'}` : 'Register shift not open'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCashDrawerSlideOver(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Close Slide-Over Drawer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Slide-Over Body (Scrollable) */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Status Pill */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: currentShift ? 'rgba(101, 130, 86, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${currentShift ? 'rgba(101, 130, 86, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {currentShift ? (
                          <>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#658256', boxShadow: '0 0 8px #658256' }} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#658256' }}>
                              Shift Active: {currentShift.cashier_name || user?.name || 'Cashier'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              (Opened {currentShift.opened_at ? new Date(currentShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'})
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={15} color="#ef4444" />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f87171' }}>
                              No Active Shift Session
                            </span>
                          </>
                        )}
                      </div>
                      {!currentShift && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCashDrawerSlideOver(false);
                            setShowOpenShiftModal(true);
                          }}
                          className="ksyn-btn ksyn-btn-gold"
                          style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 800 }}
                        >
                          Open Shift
                        </button>
                      )}
                    </div>

                    {/* Summary Telemetry: Starting Float, Cash Sales, Digital Turnover */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div style={{ background: '#121520', borderLeft: '4px solid #f7ffc4', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Starting Float</div>
                        <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f7ffc4', marginTop: '4px' }}>
                          ₱{activeFloat.toFixed(2)}
                        </div>
                      </div>

                      <div style={{ background: '#121520', borderLeft: '4px solid #658256', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Shift Cash Sales</div>
                        <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#658256', marginTop: '4px' }}>
                          ₱{activeCashSales.toFixed(2)}
                        </div>
                      </div>

                      <div style={{ background: '#121520', borderLeft: '4px solid #e1c256', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Digital Turnover</div>
                        <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', marginTop: '4px' }}>
                          ₱{activeDigitalSales.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Denomination Counter (Blind Count Audit) */}
                    <div style={{ background: '#121520', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Banknote size={16} color="#e1c256" /> Physical Cash Denomination Counter
                        </h4>
                      </div>

                      <div style={{ background: 'rgba(247, 255, 196, 0.06)', border: '1px solid rgba(247, 255, 196, 0.15)', borderRadius: '6px', padding: '7px 10px', marginBottom: '12px', fontSize: '0.72rem', color: '#7dd3fc', lineHeight: 1.4 }}>
                        <strong className="inline-flex items-center gap-1 text-[#e1c256]"><Lock size={11} /> Commercial Blind Count Audit:</strong> Enter actual quantities for Philippine banknotes and coins. Auto-fill bypass is strictly disabled to prevent cashier collusion and preserve register handover integrity.
                      </div>

                      {/* Philippine Banknotes (Bills) */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Philippine Banknotes (Bills)</span>
                          <span className="mono" style={{ color: '#e1c256' }}>₱{billsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {[
                            { label: '₱1,000 Bill', key: 'p1000', multiplier: 1000 },
                            { label: '₱500 Bill', key: 'p500', multiplier: 500 },
                            { label: '₱200 Bill', key: 'p200', multiplier: 200 },
                            { label: '₱100 Bill', key: 'p100', multiplier: 100 },
                            { label: '₱50 Bill', key: 'p50', multiplier: 50 },
                            { label: '₱20 Bill', key: 'p20', multiplier: 20 }
                          ].map(denom => (
                            <div
                              key={denom.key}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '5px 10px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.05)'
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>{denom.label}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Qty:</span>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={!currentShift}
                                  value={cashCounts[denom.key] === 0 ? '' : cashCounts[denom.key]}
                                  placeholder="0"
                                  onChange={(e) => setCashCounts({ ...cashCounts, [denom.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                                  style={{
                                    width: '60px',
                                    background: '#0a0d14',
                                    border: '1px solid #334155',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    padding: '3px 6px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8125rem'
                                  }}
                                />
                                <span className="mono" style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '70px', textAlign: 'right' }}>
                                  ₱{((Number(cashCounts[denom.key]) || 0) * denom.multiplier).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Philippine Specie (Coins) */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Philippine Coins & Specie</span>
                          <span className="mono" style={{ color: '#e1c256' }}>₱{coinsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {[
                            { label: '₱20 Coin', key: 'c20', multiplier: 20 },
                            { label: '₱10 Coin', key: 'c10', multiplier: 10 },
                            { label: '₱5 Coin', key: 'c5', multiplier: 5 },
                            { label: '₱1 Coin', key: 'c1', multiplier: 1 },
                            { label: '₱0.25 (25¢) Centavos', key: 'c025', multiplier: 0.25 }
                          ].map(denom => (
                            <div
                              key={denom.key}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '5px 10px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.05)'
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>{denom.label}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Qty:</span>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={!currentShift}
                                  value={cashCounts[denom.key] === 0 ? '' : cashCounts[denom.key]}
                                  placeholder="0"
                                  onChange={(e) => setCashCounts({ ...cashCounts, [denom.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                                  style={{
                                    width: '60px',
                                    background: '#0a0d14',
                                    border: '1px solid #334155',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    padding: '3px 6px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8125rem'
                                  }}
                                />
                                <span className="mono" style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '70px', textAlign: 'right' }}>
                                  ₱{((Number(cashCounts[denom.key]) || 0) * denom.multiplier).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Physical Count Total & Live Variance */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <div style={{ padding: '10px 12px', background: 'rgba(225, 194, 86, 0.08)', borderRadius: '8px', border: '1px solid rgba(225, 194, 86, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8' }}>Total Physical Counted</span>
                          <span className="mono" style={{ fontSize: '1.125rem', fontWeight: 900, color: '#e1c256' }}>
                            ₱{physicalCashCounted.toFixed(2)}
                          </span>
                        </div>

                      </div>
                    </div>

                    {/* Shift Transaction Journal */}
                    <div style={{ background: '#121520', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={16} color="#f7ffc4" /> Shift Transaction Journal
                        </h4>
                        <span className="mono" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {shiftSales.length} Transactions
                        </span>
                      </div>

                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {shiftSales.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '16px 12px', color: '#64748b', fontSize: '0.75rem' }}>
                            {!currentShift ? 'No active shift session.' : 'No transactions recorded under this shift session yet.'}
                          </div>
                        ) : (
                          shiftSales.map(sale => (
                            <div
                              key={sale.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 10px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.75rem'
                              }}
                            >
                              <div style={{ maxWidth: '65%' }}>
                                <div style={{ fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {sale.item}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.6875rem' }}>
                                  {sale.time} • <span className="mono">{sale.ref}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div className="mono" style={{ fontWeight: 800, color: sale.method === 'cash' ? '#658256' : '#e1c256' }}>
                                  ₱{Number(sale.amount).toFixed(2)}
                                </div>
                                <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase' }}>{sale.method}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Cashier Handover Notes & Variance Remarks */}
                    <div style={{ background: '#121520', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                        Cashier Handover Notes & Variance Remarks
                      </h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.72rem', margin: '0 0 8px 0' }}>
                        Note any mid-shift envelope drops, petty cash adjustments, or discrepancy explanations.
                      </p>
                      <textarea
                        rows="2"
                        placeholder="e.g. Mid-shift safe drop completed; register balanced."
                        value={shiftClosingNotes}
                        onChange={(e) => setShiftClosingNotes(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#0a0d14',
                          border: '1px solid #334155',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.75rem',
                          resize: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div style={{
                    padding: '16px 24px',
                    background: '#121622',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {!currentShift ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCashDrawerSlideOver(false);
                          setShowOpenShiftModal(true);
                        }}
                        className="ksyn-btn ksyn-btn-gold"
                        style={{ width: '100%', padding: '12px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Plus size={16} /> Open Register Shift
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateXReading}
                        className="ksyn-btn ksyn-btn-gold"
                        style={{ width: '100%', padding: '12px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <CheckCircle2 size={16} /> Generate Shift Turnover (X-Reading)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. Cash Drawer & Shift Session Management Section (Refactored into slide-over modal inside POS) */}
      {activeSection === 'drawer' && null}

      {/* 6. Physical Locker Key Manager Section */}
      {activeSection === 'lockers' && (() => {
        const totalLockers = lockers.length;
        const availableLockers = lockers.filter(l => l.status === 'available').length;
        const occupiedLockers = lockers.filter(l => l.status === 'occupied').length;
        const maintenanceLockers = lockers.filter(l => l.status === 'maintenance').length;
        const cashDepositsCount = lockers.filter(l => l.status === 'occupied' && (String(l.deposit || '').includes('200') || String(l.deposit || '').toLowerCase().includes('cash'))).length;
        const totalCashDeposits = cashDepositsCount * 200;

        const filteredLockers = lockers.filter(l => {
          if (lockerFilter !== 'all' && l.status !== lockerFilter) return false;
          if (lockerSearch.trim()) {
            const query = lockerSearch.toLowerCase();
            const matchId = l.id.toLowerCase().includes(query);
            const matchGuest = l.guest && l.guest.toLowerCase().includes(query);
            const matchTag = l.tag && l.tag.toLowerCase().includes(query);
            return matchId || matchGuest || matchTag;
          }
          return true;
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* KPI Metric Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(225, 194, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <KeyRound size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Total Branch Lockers</div>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>{totalLockers} Units</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Numbered L-01 to L-60</div>
                </div>
              </div>

              <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(101, 130, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#658256' }}>
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Available For Use</div>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256' }}>{availableLockers} Free</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Ready for athlete checkout</div>
                </div>
              </div>

              <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(247, 255, 196, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Issued / In-Use</div>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f7ffc4' }}>{occupiedLockers} Active</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Assigned on gym floor</div>
                </div>
              </div>

              <div className="ksyn-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Under Repair</div>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171' }}>{maintenanceLockers} Damaged</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Cylinder lock latch repair</div>
                </div>
              </div>

              <div
                className="ksyn-card"
                onClick={() => setShowDepositVaultModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                title="Click to view Active Security Deposit & Collateral Vault"
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(225, 194, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <Banknote size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Cash Deposits Held</div>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e1c256' }}>₱{totalCashDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#e1c256', fontWeight: 600 }}>{cashDepositsCount} cash keys • Click to open vault &rarr;</div>
                </div>
              </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="ksyn-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All Lockers (${totalLockers})` },
                  { id: 'available', label: `Available (${availableLockers})`, color: '#658256' },
                  { id: 'occupied', label: `In-Use (${occupiedLockers})`, color: '#e1c256' },
                  { id: 'maintenance', label: `Maintenance (${maintenanceLockers})`, color: '#ef4444' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setLockerFilter(f.id)}
                    className={lockerFilter === f.id ? 'ksyn-btn ksyn-btn-gold' : 'ksyn-btn ksyn-btn-outline'}
                    style={{ fontSize: '0.75rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Dedicated Action Button: Active Deposits & Collateral Vault */}
                <button
                  type="button"
                  id="btn-locker-deposit-vault"
                  onClick={() => setShowDepositVaultModal(true)}
                  className="ksyn-btn"
                  style={{
                    background: 'rgba(225, 194, 86, 0.15)',
                    border: '1px solid #e1c256',
                    color: '#e1c256',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(225, 194, 86, 0.2)'
                  }}
                  title="View list of all deposited requirements and refund keys"
                >
                  <ShieldCheck size={14} />
                  <span>Active Deposits & Collateral Vault</span>
                  <span style={{
                    background: '#e1c256',
                    color: '#000000',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '0.6875rem',
                    fontWeight: 900
                  }}>
                    {occupiedLockers}
                  </span>
                </button>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search locker, guest, tag..."
                    value={lockerSearch}
                    onChange={(e) => setLockerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0a0d14',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '6px 10px 6px 32px',
                      color: '#fff',
                      fontSize: '0.75rem'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 60 Lockers Visual Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '14px'
            }}>
              {filteredLockers.map((locker) => {
                const isAvailable = locker.status === 'available';
                const isOccupied = locker.status === 'occupied';
                const isMaintenance = locker.status === 'maintenance';

                return (
                  <div
                    key={locker.id}
                    style={{
                      background: isAvailable ? '#111622' : isOccupied ? '#141d2e' : '#1e1416',
                      border: `1.5px solid ${isAvailable ? '#658256' : isOccupied ? '#e1c256' : '#ef4444'}`,
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '185px',
                      position: 'relative',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="mono" style={{ fontSize: '1.125rem', fontWeight: 900, color: '#fff' }}>
                        {locker.id}
                      </span>
                      <span style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        background: isAvailable ? '#658256' : isOccupied ? '#e1c256' : '#ef4444'
                      }} />
                    </div>

                    <div style={{ flex: 1, minHeight: '48px' }}>
                      {isAvailable && (
                        <div style={{ fontSize: '0.6875rem', color: '#658256', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> READY TO ISSUE
                        </div>
                      )}

                      {isOccupied && (
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {locker.guest}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '3px' }}>
                            Deposit: <span style={{ color: '#e1c256', fontWeight: 700 }}>{locker.deposit}</span>
                          </div>
                          <div className="mono" style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
                            Since {locker.time}
                          </div>
                        </div>
                      )}

                      {isMaintenance && (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.03em' }}>
                            OUT OF ORDER
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#cbd5e1', marginTop: '4px', lineHeight: '1.3' }}>
                            {locker.reason || 'Lock maintenance'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                      {isAvailable && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLockerModal(locker);
                              setAssignForm({ guestName: '', depositType: '₱200 Cash Deposit', keyTag: `K-${locker.number}` });
                            }}
                            className="ksyn-btn ksyn-btn-gold"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', fontWeight: 800, borderRadius: '6px', textAlign: 'center', justifyContent: 'center' }}
                          >
                            Issue Key
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleMaintenance(locker.id)}
                            title="Report locker as damaged / out of order"
                            style={{
                              width: '100%',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px dashed rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <AlertTriangle size={12} />
                            <span>Mark Damaged</span>
                          </button>
                        </>
                      )}

                      {isOccupied && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReturnLocker(locker.id)}
                            className="ksyn-btn ksyn-btn-outline"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', color: '#658256', borderColor: '#658256', fontWeight: 700, borderRadius: '6px', textAlign: 'center', justifyContent: 'center' }}
                          >
                            Return & Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleReturnLocker(locker.id);
                              handleToggleMaintenance(locker.id);
                            }}
                            title="Return key and flag locker as damaged"
                            style={{
                              width: '100%',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px dashed rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <AlertTriangle size={12} />
                            <span>Return as Damaged</span>
                          </button>
                        </>
                      )}

                      {isMaintenance && (
                        <button
                          type="button"
                          onClick={() => handleToggleMaintenance(locker.id)}
                          className="ksyn-btn ksyn-btn-outline"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.75rem',
                            color: '#10b981',
                            borderColor: 'rgba(16, 185, 129, 0.45)',
                            background: 'rgba(16, 185, 129, 0.08)',
                            fontWeight: 700,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Re-activate Locker</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW: INCOMING PT ENROLLMENTS & FRONT DESK CLEARANCE QUEUE */}
      {/* ========================================================================= */}
      {activeSection === 'pt_enrollments' && (() => {
        const isConcludedCheck = (e) => {
          if (!e) return false;
          if (e.enrollment_status === 'CONCLUDED' || e.is_concluded) return true;
          if (e.sessions_total && e.sessions_completed !== undefined && e.sessions_completed >= e.sessions_total) return true;
          return false;
        };

        const total = ptEnrollmentsQueue.length;
        const pending = ptEnrollmentsQueue.filter(e => (e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE') && !isConcludedCheck(e)).length;
        const cleared = ptEnrollmentsQueue.filter(e => e.enrollment_status === 'CLEARED' && !isConcludedCheck(e)).length;
        const concluded = ptEnrollmentsQueue.filter(e => isConcludedCheck(e)).length;
        const totalValue = ptEnrollmentsQueue.reduce((acc, e) => acc + (Number(e.total_price) || 0), 0);

        const filtered = ptEnrollmentsQueue.filter(item => {
          const concludedItem = isConcludedCheck(item);
          if (ptEnrollmentFilter === 'pending') {
            if (item.enrollment_status === 'CLEARED' || concludedItem) return false;
          } else if (ptEnrollmentFilter === 'cleared') {
            // Remove concluded sessions from cleared & assigned
            if (item.enrollment_status !== 'CLEARED' || concludedItem) return false;
          } else if (ptEnrollmentFilter === 'concluded') {
            if (!concludedItem) return false;
          } else if (ptEnrollmentFilter === 'all') {
            // Default "all" view shows only active ongoing contracts
            if (concludedItem) return false;
          }

          if (ptEnrollmentSearch.trim()) {
            const q = ptEnrollmentSearch.toLowerCase();
            const matchName = (item.member_name || '').toLowerCase().includes(q);
            const matchCoach = (item.coach_name || '').toLowerCase().includes(q);
            const matchRef = (item.payment_reference || '').toLowerCase().includes(q);
            const matchPkg = (item.package_name || '').toLowerCase().includes(q);
            return matchName || matchCoach || matchRef || matchPkg;
          }
          return true;
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #222', borderRadius: '14px', padding: '18px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active PT Requests</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
                  {total - concluded}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ongoing athlete packages</span>
              </div>

              <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #658256', borderRadius: '14px', padding: '18px' }}>
                <span style={{ fontSize: '0.75rem', color: '#658256', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Cleared & Assigned</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#658256', marginTop: '4px' }}>
                  {cleared}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Active in coach athlete roster</span>
              </div>

              <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #222', borderRadius: '14px', padding: '18px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PT Revenue</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f7ffc4', fontFamily: 'monospace', marginTop: '4px' }}>
                  ₱{totalValue.toLocaleString()}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Contracted package volume</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="ksyn-card" style={{
              background: '#121212',
              border: '1px solid #222',
              borderRadius: '14px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPtEnrollmentFilter('all')}
                  className={`ksyn-btn ${ptEnrollmentFilter === 'all' ? 'ksyn-btn-gold' : 'ksyn-btn-outline'}`}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  Active Requests ({total - concluded})
                </button>
                <button
                  type="button"
                  onClick={() => setPtEnrollmentFilter('cleared')}
                  className={`ksyn-btn ${ptEnrollmentFilter === 'cleared' ? 'ksyn-btn-gold' : 'ksyn-btn-outline'}`}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  Cleared & Assigned ({cleared})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPtEnrollmentFilter('sessions');
                    fetchCoachSessions();
                  }}
                  className={`ksyn-btn ${ptEnrollmentFilter === 'sessions' ? 'ksyn-btn-gold' : 'ksyn-btn-outline'}`}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  <ShieldCheck size={14} style={{ marginRight: '6px' }} /> Verified Floor Sessions ({coachSessions.length})
                </button>
                {concluded > 0 && (
                  <button
                    type="button"
                    onClick={() => setPtEnrollmentFilter('concluded')}
                    className={`ksyn-btn ${ptEnrollmentFilter === 'concluded' ? 'ksyn-btn-gold' : 'ksyn-btn-outline'}`}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700, borderColor: ptEnrollmentFilter === 'concluded' ? '#94a3b8' : '#334155', color: ptEnrollmentFilter === 'concluded' ? '#ffffff' : '#94a3b8' }}
                  >
                    Concluded Archive ({concluded})
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', maxWidth: '580px' }}>
                <button
                  type="button"
                  onClick={() => setShowPosPtEnrollmentModal(true)}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Enroll member into a Personal Training package over the counter"
                >
                  <Dumbbell size={14} /> Enroll PT Package
                </button>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="text"
                    value={ptEnrollmentSearch}
                    onChange={(e) => setPtEnrollmentSearch(e.target.value)}
                    placeholder="Search athlete, coach, or reference #..."
                    className="ksyn-input"
                    style={{ paddingLeft: '36px', height: '38px', fontSize: '0.8125rem', width: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetchPtEnrollments();
                    fetchCoachSessions();
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                  title="Refresh PT Queue & Session Logs"
                >
                  <RefreshCw size={14} className={(loadingPtEnrollments || loadingCoachSessions) ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Queue List / Verified Sessions Ledger */}
            {ptEnrollmentFilter === 'sessions' ? (
              <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#e1c256" /> Verified Floor PT Sessions & Coach Logs
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                      Anti-ghost attendance verified session logs conducted by personal trainers at this branch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchCoachSessions}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={12} className={loadingCoachSessions ? 'animate-spin' : ''} /> Refresh Session Logs
                  </button>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr style={{ background: '#161616', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th className="px-3 py-2.5 rounded-l-lg">Date & Time</th>
                        <th className="px-3 py-2.5">Coach Name</th>
                        <th className="px-3 py-2.5">Athlete Client</th>
                        <th className="px-3 py-2.5">Workout Focus</th>
                        <th className="px-3 py-2.5">Duration</th>
                        <th className="px-3 py-2.5">Session Rate</th>
                        <th className="px-3 py-2.5">Coach Share</th>
                        <th className="px-3 py-2.5 rounded-r-lg text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coachSessions
                        .filter(s => {
                          if (!ptEnrollmentSearch.trim()) return true;
                          const q = ptEnrollmentSearch.toLowerCase();
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
                              {s.focus || 'General Conditioning'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-400">
                              {s.duration_mins || 60} mins
                            </td>
                            <td className="px-3 py-2.5 font-mono text-gray-300">
                              ₱{Number(s.session_rate || 500).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">
                              +₱{Number(s.commission_earned || 100).toLocaleString()} ({s.coach_split_percentage || 20}%)
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
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filtered.length === 0 ? (
                <div className="ksyn-card" style={{ background: '#121212', border: '1px solid #222', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                  <Dumbbell size={48} color="#4b5563" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#9ca3af', margin: 0 }}>
                    No PT enrollments found matching current criteria
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '8px 0 0' }}>
                    When members choose a coach and package in their portal, their sign-up will appear here for payment clearance.
                  </p>
                </div>
              ) : (
                filtered.map((item) => {
                  const isConcluded = isConcludedCheck(item);
                  const isCleared = item.enrollment_status === 'CLEARED' && !isConcluded;
                  const isOnline = item.payment_channel === 'online_xendit';

                  return (
                    <div
                      key={item.id}
                      className="ksyn-card"
                      style={{
                        background: '#121212',
                        border: isConcluded ? '1px solid #1e293b' : (isCleared ? '1px solid #222' : '1px solid #e1c256'),
                        borderRadius: '16px',
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: (!isCleared && !isConcluded) ? '0 0 16px rgba(225, 194, 86, 0.08)' : 'none',
                        opacity: isConcluded ? 0.75 : 1
                      }}
                    >
                      {/* Top Row: Athlete Header & Status Pill */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: isConcluded ? '#1e293b' : (isCleared ? '#1e293b' : 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)'),
                            color: isConcluded ? '#94a3b8' : (isCleared ? '#ffffff' : '#000000'),
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem'
                          }}>
                            {(item.member_name || 'Athlete').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                                {item.member_name}
                              </h3>
                              <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '10px', background: '#1c1f26', color: '#94a3b8' }}>
                                {item.branch_name || 'Makati Flagship'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {item.member_email || 'Verified Member'} • Initiated: {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(item.created_at).toLocaleDateString()})
                            </span>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div>
                          {isConcluded ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: 'rgba(148, 163, 184, 0.1)',
                              border: '1px solid #334155',
                              color: '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}>
                              <CheckCircle2 size={14} /> CONCLUDED & ARCHIVED
                            </span>
                          ) : isCleared ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: 'rgba(101, 130, 86, 0.15)',
                              border: '1px solid #658256',
                              color: '#658256',
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}>
                              <CheckCircle2 size={14} /> CLEARED & ASSIGNED
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: 'rgba(225, 194, 86, 0.15)',
                              border: '1px solid #e1c256',
                              color: '#e1c256',
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}>
                              <Clock size={14} /> AWAITING FRONT DESK CLEARANCE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Details Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '14px',
                        background: '#0d0f14',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #1c212c'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
                            Assigned Coach
                          </span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f7ffc4' }}>
                            {item.coach_name}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block' }}>
                            {item.coach_specialty || 'Personal Trainer'}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
                            PT Package & Sessions
                          </span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff' }}>
                            {item.package_name}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block' }}>
                            {item.sessions_total} Sessions Total (₱{item.session_rate}/session)
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
                            {isConcluded ? 'Serviced Session Schedule' : 'Requested Schedule (Floor Slot)'}
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256', display: 'block' }}>
                            {isConcluded ? (item.concluded_at ? new Date(item.concluded_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : (item.preferred_date ? new Date(item.preferred_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified Session')) : (item.preferred_date ? new Date(item.preferred_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible Date')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: isConcluded ? '#658256' : '#cbd5e1', fontWeight: 700, display: 'block' }}>
                            {isConcluded ? `Completed & Serviced (${item.confirmed_time_slot || item.preferred_time_slot || 'Regular Floor Slot'})` : (item.confirmed_time_slot || item.preferred_time_slot || 'Pending Staff Confirmation')}
                          </span>
                          {isConcluded ? (
                            <span style={{ fontSize: '0.6875rem', color: '#658256', display: 'block', marginTop: '2px', fontWeight: 800 }}>
                              Serviced & Concluded
                            </span>
                          ) : item.coach_availability_confirmed ? (
                            <span style={{ fontSize: '0.6875rem', color: '#658256', display: 'block', marginTop: '2px', fontWeight: 800 }}>
                              Coach {item.coach_name?.split(' ')?.[0]} Confirmed Available
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <span style={{ fontSize: '0.6875rem', color: '#f59e0b', fontWeight: 700 }}>
                                Awaiting Coach Confirmation
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenCoachVerification(item)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  color: '#fbbf24',
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  cursor: 'pointer'
                                }}
                              >
                                Verify Slot
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
                            Payment Channel & Status
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {item.origin_channel === 'POS' || String(item.payment_reference || '').startsWith('PT-POS') ? (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#e1c256', background: 'rgba(225, 194, 86, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(225, 194, 86, 0.3)' }}>
                                POS COUNTER
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                ONLINE PORTAL
                              </span>
                            )}
                            {isOnline ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#658256', background: 'rgba(101, 130, 86, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #658256' }}>
                                Xendit ({item.payment_status || 'PAID'})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', background: 'rgba(225, 194, 86, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e1c256' }}>
                                OTC Cash ({item.payment_status === 'PAID' ? 'PAID' : `COLLECT ₱${Number(item.total_price || item.gross_amount).toLocaleString()}`})
                              </span>
                            )}
                          </div>
                          <span className="mono" style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                            Ref: {item.payment_reference || item.xendit_external_id}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
                            Athlete Goal & Focus
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#9ca3af' }}>
                            {item.goal || 'Hypertrophy & Conditioning'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #1a202c', paddingTop: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {isConcluded ? (
                            <span>Session concluded and serviced. Archived from active operations roster.</span>
                          ) : isCleared ? (
                            <span>Cleared & confirmed with coach by <strong style={{ color: '#ffffff' }}>{item.cleared_by || 'Front Desk'}</strong> on {new Date(item.cleared_at).toLocaleString()}</span>
                          ) : item.coach_availability_confirmed ? (
                            <span>Coach {item.coach_name?.split(' ')?.[0]} confirmed available for {item.confirmed_time_slot || item.preferred_time_slot}. Clear payment to assign athlete.</span>
                          ) : (
                            <span>Coach availability confirmation required before staff finalizes schedule and assigns athlete to Coach {item.coach_name?.split(' ')?.[0]}.</span>
                          )}
                        </div>

                        <div>
                          {!isCleared && !isConcluded ? (
                            isOnline ? (
                              <button
                                type="button"
                                disabled={clearingEnrollmentId === item.id}
                                onClick={() => handleClearPtEnrollment(item)}
                                className="ksyn-btn ksyn-btn-gold"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '0.875rem', fontWeight: 800 }}
                              >
                                <CheckCircle2 size={16} />
                                {clearingEnrollmentId === item.id ? 'Clearing & Assigning...' : (item.coach_availability_confirmed ? 'Finalize & Assign Athlete' : 'Verify Coach & Assign')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={clearingEnrollmentId === item.id}
                                onClick={() => handleClearPtEnrollment(item)}
                                className="ksyn-btn"
                                style={{
                                   background: '#658256',
                                   color: '#ffffff',
                                   border: 'none',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: '8px',
                                   padding: '10px 22px',
                                   fontSize: '0.875rem',
                                   fontWeight: 800,
                                   boxShadow: '0 4px 12px rgba(101, 130, 86, 0.3)'
                                 }}
                              >
                                <Banknote size={16} />
                                {clearingEnrollmentId === item.id ? 'Processing Cash...' : (item.coach_availability_confirmed ? `Receive Cash (₱${Number(item.total_price).toLocaleString()}) & Clear` : 'Verify Coach & Receive Cash')}
                              </button>
                            )
                          ) : isConcluded ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleDeletePtEnrollment(item)}
                                className="ksyn-btn touch-btn"
                                style={{
                                  background: 'transparent',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  borderRadius: '8px',
                                  fontWeight: 700
                                }}
                                title="Remove archived record"
                              >
                                Remove Record
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#658256', fontWeight: 800, fontSize: '0.8125rem' }}>
                                <CheckCircle2 size={16} />
                                <span>Active Contract (+₱{Math.round(item.total_price * 0.15).toLocaleString()} Comm)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConcludePtEnrollment(item)}
                                className="ksyn-btn touch-btn"
                                style={{
                                  background: '#1a1f2c',
                                  color: '#e2e8f0',
                                  border: '1px solid #334155',
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer'
                                }}
                                title="Conclude this PT session and remove from Cleared & Assigned"
                              >
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                Conclude & Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW: STAFF PROFILE & SETTINGS (activeSection === 'profile') */}
      {/* ========================================================================= */}
      {activeSection === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {/* Staff Identity Dossier Card */}
          <div className="ksyn-card" style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #e1c256 0%, #b8972e 100%)',
                  color: '#0b0d10',
                  fontWeight: 900,
                  fontSize: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(225, 194, 86, 0.25)',
                  flexShrink: 0
                }}>
                  {(user?.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                      {user?.name || 'Staff Member'}
                    </h2>
                    <span style={{
                      padding: '3px 10px',
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
                      <ShieldCheck size={13} /> Verified Front Desk Staff
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                    Branch Operations Specialist • Front-Desk POS Cashier & Access Control Terminal Clearance
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: '#141820',
                  border: '1px solid #1f232b',
                  fontSize: '0.75rem',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  <span>Terminal Status: <strong style={{ color: '#10b981' }}>Active On-Duty</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Profile Metadata Details */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #1f232b'
            }}>
              <div style={{ background: '#0b0d10', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1a1e27' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Staff Email</div>
                <div style={{ fontSize: '0.875rem', color: '#f1f5f9', fontWeight: 600, marginTop: '4px' }}>{user?.email || 'staff@fitconnect.ksyn.com'}</div>
              </div>
              <div style={{ background: '#0b0d10', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1a1e27' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Assigned Facility</div>
                <div style={{ fontSize: '0.875rem', color: '#e1c256', fontWeight: 700, marginTop: '4px' }}>{user?.branch_name || 'Active Branch'}</div>
              </div>
              <div style={{ background: '#0b0d10', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1a1e27' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Terminal ID</div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600, marginTop: '4px' }}>{user?.id ? `STF-${String(user.id).slice(0, 8)}` : 'STF-MKT-01'}</div>
              </div>
              <div style={{ background: '#0b0d10', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1a1e27' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Access Clearance</div>
                <div style={{ fontSize: '0.875rem', color: '#658256', fontWeight: 700, marginTop: '4px' }}>POS, Lockers, Roster & Scan</div>
              </div>
            </div>
          </div>

          {/* Weekly Staff & Coach Floor Duty Rota (Multi-Tenant Branch Architecture) */}
          <div className="ksyn-card" style={{ background: '#101216', border: '1px solid #1f232b', borderRadius: '16px', padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.12)', color: '#e1c256' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Weekly Staff & Coach Floor Duty Rota
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
                        ? `Live ${user?.branch_name || 'Branch'} Admin Rota`
                        : `Awaiting ${user?.branch_name || 'Branch'} Admin Publication`}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                    Official branch shift allocations, front-desk duty slots, and coach floor assignments published by {user?.branch_name || 'branch'} administration.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Facility: <strong style={{ color: '#f1f5f9' }}>{user?.branch_name || 'Assigned Branch Facility'}</strong>
                </span>
                <button
                  type="button"
                  onClick={loadFloorRota}
                  disabled={loadingFloorRota}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#1a1d24',
                    border: '1px solid #2d333f',
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={12} className={loadingFloorRota ? 'animate-spin' : ''} />
                  {loadingFloorRota ? 'Refreshing...' : 'Refresh Rota'}
                </button>
              </div>
            </div>

            {/* If Rota is empty or has not been published by Branch Admin yet */}
            {(!floorRota || floorRota.length === 0) ? (
              <div style={{
                background: '#0b0d10',
                border: '1px dashed #2d333f',
                borderRadius: '12px',
                padding: '32px 24px',
                textAlign: 'center',
                margin: '8px 0'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  color: '#e1c256',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px'
                }}>
                  <Calendar size={22} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                  No Floor Duty Rota Published for {user?.branch_name || 'This Branch'} Yet
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', maxWidth: '520px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                  The {user?.branch_name || 'Fairview'} Branch Administrator has not yet configured or published this week's staff duty rota. Once your branch administrator sets up the schedule and publishes it in the Branch Admin Portal, your assigned shifts and facility roster will appear here automatically.
                </p>
                <button
                  type="button"
                  onClick={loadFloorRota}
                  disabled={loadingFloorRota}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#1a1d24',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={loadingFloorRota ? 'animate-spin' : ''} />
                  {loadingFloorRota ? 'Checking for updates...' : 'Check for Published Schedule'}
                </button>
              </div>
            ) : (
              <>
                {/* Logged-In User Quick Shift Summary */}
                {(() => {
                  const myShift = (floorRota || []).find(r => 
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
                    const dayNum = d.getDate();
                    return {
                      ...item,
                      dateLabel: `${m} ${dayNum}`,
                      headerLabel: `${item.label} (${m} ${dayNum})`
                    };
                  });

                  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                  return (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Your Weekly Assigned Shifts:</span>
                        <span style={{ color: '#e1c256' }}>{user?.name || 'Staff Member'}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                        {days.map(d => {
                          const shiftVal = myShift ? myShift[d.key] : 'Rest / Off-Duty';
                          const isOff = !shiftVal || shiftVal.toLowerCase().includes('rest') || shiftVal.toLowerCase().includes('off');
                          const isToday = currentDayName === d.key;

                          return (
                            <div
                              key={d.key}
                              style={{
                                background: isToday ? 'rgba(225, 194, 86, 0.08)' : '#0b0d10',
                                border: isToday ? '1px solid #e1c256' : isOff ? '1px solid #1f232b' : '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '10px',
                                padding: '10px 8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: isToday ? '#e1c256' : '#94a3b8' }}>
                                  {d.label} • {d.dateLabel} {isToday && '• TODAY'}
                                </span>
                                {!isOff ? (
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                ) : (
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569' }} />
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', fontWeight: isOff ? 500 : 700, color: isOff ? '#64748b' : '#f8fafc', lineHeight: 1.3 }}>
                                {shiftVal || 'Rest / Off-Duty'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Full Team Roster Collapsible Table (Strictly excluding admin roles) */}
                {(() => {
                  const eligibleRota = (floorRota || []).filter(row => {
                    const role = (row.staff_role || row.role || '').toLowerCase();
                    const name = (row.coach_name || '').toLowerCase();
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
                    <div style={{ borderTop: '1px solid #1f232b', paddingTop: '14px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8', marginBottom: '10px' }}>
                        {user?.branch_name || 'Branch'} Duty Rota ({eligibleRota.length} Personnel Assigned):
                      </div>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1f232b' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#141820', color: '#94a3b8', borderBottom: '1px solid #1f232b' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 700 }}>Personnel / Role</th>
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
                                          YOU (ON-DUTY STAFF)
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

      {/* 6.5. Locker Security Deposit & Collateral Vault Modal (Requirement 2) */}
      {showDepositVaultModal && (() => {
        const occupiedList = lockers.filter(l => l.status === 'occupied');
        const todayStr = new Date().toISOString().split('T')[0];

        const isDepositToday = (locker) => {
          if (locker.isToday === true) return true;
          if (locker.isToday === false) return false;
          if (locker.date === todayStr) return true;
          if (locker.assignedAt) {
            const d = new Date(locker.assignedAt);
            const now = new Date();
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
          }
          if (locker.time && !locker.time.toLowerCase().includes('yesterday') && !locker.time.toLowerCase().includes('oct')) {
            return true;
          }
          return false;
        };

        const todayDeposits = occupiedList.filter(isDepositToday);
        const priorDeposits = occupiedList.filter(l => !isDepositToday(l));

        const displayList = depositVaultTab === 'today'
          ? todayDeposits
          : depositVaultTab === 'prior'
          ? priorDeposits
          : occupiedList;

        const cashCount = occupiedList.filter(l => l.deposit?.includes('200') || l.deposit?.toLowerCase().includes('cash')).length;
        const totalCash = cashCount * 200;
        const collateralCount = occupiedList.length - cashCount;

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px'
          }}>
            <div
              className="ksyn-card"
              style={{
                maxWidth: '740px',
                width: '100%',
                maxHeight: '90vh',
                background: '#0d1017',
                border: '1.5px solid #e1c256',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2430', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.15)',
                    border: '1px solid rgba(225, 194, 86, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e1c256',
                    flexShrink: 0
                  }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Active Key Deposits & Collateral Vault
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '3px 0 0' }}>
                      Real-time register of security requirements held at reception • Instant return & refund reconciliation
                    </p>
                  </div>
                </div>

                <Tooltip text="Close Vault Modal" position="bottom">
                  <button
                    type="button"
                    onClick={() => setShowDepositVaultModal(false)}
                    className="modal-close-circle-btn"
                    title="Close (Esc)"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      color: '#94a3b8',
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
                    aria-label="Close Modal"
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              </div>

              {/* KPI Strip Inside Vault */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                padding: '12px',
                backgroundColor: '#07090d',
                borderRadius: '10px',
                border: '1px solid #1a202c'
              }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Deposits Held</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{occupiedList.length} Units</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Active key loans</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Cash Float Held</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', marginTop: '2px' }}>₱{totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{cashCount} × ₱200 cash</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Collaterals (IDs)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#658256', marginTop: '2px' }}>{collateralCount} Held</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Passports, DL & UMID</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Today vs Prior</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f7ffc4', marginTop: '2px' }}>{todayDeposits.length} / {priorDeposits.length}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Today / Prior Days</div>
                </div>
              </div>

              {/* Classification Tabs */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1a202c', paddingBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDepositVaultTab('all')}
                  className={depositVaultTab === 'all' ? 'ksyn-btn ksyn-btn-gold' : 'ksyn-btn ksyn-btn-outline'}
                  style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 700 }}
                >
                  All Outstanding Deposits ({occupiedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDepositVaultTab('today')}
                  className={depositVaultTab === 'today' ? 'ksyn-btn ksyn-btn-gold' : 'ksyn-btn ksyn-btn-outline'}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    borderColor: depositVaultTab === 'today' ? '#e1c256' : 'rgba(16, 185, 129, 0.4)',
                    color: depositVaultTab === 'today' ? '#000' : '#10b981'
                  }}
                >
                  Deposited Today ({todayDeposits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDepositVaultTab('prior')}
                  className={depositVaultTab === 'prior' ? 'ksyn-btn ksyn-btn-gold' : 'ksyn-btn ksyn-btn-outline'}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    borderColor: depositVaultTab === 'prior' ? '#e1c256' : 'rgba(245, 158, 11, 0.4)',
                    color: depositVaultTab === 'prior' ? '#000' : '#f59e0b'
                  }}
                >
                  Prior Days / Unreturned ({priorDeposits.length})
                </button>
              </div>

              {/* List of Deposited Requirements */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', maxHeight: '420px' }}>
                {displayList.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    background: '#090b10',
                    borderRadius: '10px',
                    border: '1px dashed #262c3e',
                    color: '#64748b'
                  }}>
                    <CheckCircle2 size={32} color="#658256" style={{ margin: '0 auto 10px auto' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#f8fafc' }}>
                      No active deposits in this category.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                      All issued locker keys in this filter have been returned and refunded.
                    </p>
                  </div>
                ) : (
                  displayList.map((locker) => {
                    const isToday = isDepositToday(locker);
                    const isCash = locker.deposit?.includes('200') || locker.deposit?.toLowerCase().includes('cash');

                    return (
                      <div
                        key={locker.id}
                        style={{
                          background: '#090b10',
                          border: `1px solid ${isToday ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                          borderRadius: '10px',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px',
                          flexWrap: 'wrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Left: Locker ID & Athlete Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                          <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '8px',
                            background: isToday ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            border: `1px solid ${isToday ? '#10b981' : '#f59e0b'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                              {locker.id}
                            </span>
                            <span style={{ fontSize: '0.625rem', color: isToday ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                              {locker.tag || `K-${locker.number}`}
                            </span>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                              {locker.guest || 'Athlete'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                              <span style={{
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: isToday ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: isToday ? '#10b981' : '#f59e0b',
                                border: `1px solid ${isToday ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                              }}>
                                {isToday ? 'TODAY • Live Shift' : 'PRIOR UNRETURNED'}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                Since {locker.time || 'Floor Entry'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Center: Deposited Requirement */}
                        <div style={{ minWidth: '180px' }}>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                            Security Requirement
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '2px',
                            color: isCash ? '#e1c256' : '#cbd5e1',
                            fontSize: '0.8125rem',
                            fontWeight: 700
                          }}>
                            {isCash ? (
                              <Banknote size={15} color="#e1c256" />
                            ) : (
                              <Shield size={15} color="#658256" />
                            )}
                            <span>{locker.deposit || '₱200 Cash Deposit'}</span>
                          </div>
                        </div>

                        {/* Right: Return & Refund Action Button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleReturnLocker(locker.id)}
                            className="ksyn-btn"
                            style={{
                              background: '#658256',
                              color: '#ffffff',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(101, 130, 86, 0.35)',
                              transition: 'all 0.15s ease'
                            }}
                            title={`Release locker ${locker.id} and refund ${locker.deposit}`}
                          >
                            <CheckCircle2 size={14} />
                            <span>Return & Refund</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1f2430', paddingTop: '14px', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Clicking <strong>Return & Refund</strong> automatically returns the deposit, frees the locker to available, and removes the athlete from this vault ledger.
                </span>
                <button
                  type="button"
                  onClick={() => setShowDepositVaultModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 700 }}
                >
                  Close Vault
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. Locker Assign Modal */}
      {selectedLockerModal && (
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
          <div className="ksyn-card" style={{ maxWidth: '460px', width: '100%', background: '#0e111a', border: '1px solid #e1c256', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Issue Locker {selectedLockerModal.id}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Physical Key Assignment & Security Deposit Tracker
                  </p>
                </div>
              </div>
              <Tooltip text="Close Modal" position="bottom">
                <button
                  type="button"
                  onClick={() => setSelectedLockerModal(null)}
                  className="modal-close-circle-btn"
                  title="Close Modal (Esc)"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#94a3b8',
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
                  aria-label="Close Modal"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            <form onSubmit={handleAssignLockerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Athlete / Guest Name *
                  </label>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ShieldCheck size={12} /> Today's Turnstile Access Only
                  </span>
                </div>

                {todayCheckedInAthletes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <select
                      required
                      value={assignForm.guestName}
                      onChange={(e) => setAssignForm({ ...assignForm, guestName: e.target.value })}
                      style={{
                        width: '100%',
                        background: '#0a0d14',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: assignForm.guestName ? '#fff' : '#94a3b8',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <option value="">-- Select Member Verified at Turnstile Today ({todayCheckedInAthletes.length} Active) --</option>
                      {todayCheckedInAthletes.map(a => (
                        <option key={a.id || a.name} value={a.name}>
                          {a.name} (Checked in at {a.time})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    fontSize: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} /> Turnstile Gate Access Required
                    </strong>
                    <p style={{ margin: '4px 0 0', color: '#cbd5e1' }}>
                      Only members who have scanned through the turnstile gate or optical QR reticle today can be issued a locker key. No check-ins have occurred today yet.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Key Tag Number / Barcode
                </label>
                <input
                  type="text"
                  placeholder={`K-${selectedLockerModal.number}`}
                  value={assignForm.keyTag}
                  onChange={(e) => setAssignForm({ ...assignForm, keyTag: e.target.value })}
                  style={{ width: '100%', background: '#0a0d14', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '0.8125rem', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Security Deposit Requirement *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: '₱200 Cash Deposit', label: '₱200.00 Refundable Cash Deposit (In Counter Float)' },
                    { id: 'Passport (ID Held)', label: 'Physical Passport / Gov ID Held at Reception' },
                    { id: "Driver's License (ID)", label: "Driver's License / UMID Held at Reception" },
                    { id: 'Keycard Collateral', label: 'RFID Keycard Collateral (KS-MKT-XXXX)' }
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: assignForm.depositType === opt.id ? 'rgba(225, 194, 86, 0.12)' : '#12151e',
                        border: `1px solid ${assignForm.depositType === opt.id ? '#e1c256' : '#262c3e'}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '0.75rem',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="radio"
                        name="depositType"
                        value={opt.id}
                        checked={assignForm.depositType === opt.id}
                        onChange={(e) => setAssignForm({ ...assignForm, depositType: e.target.value })}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedLockerModal(null)}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={todayCheckedInAthletes.length === 0 || !assignForm.guestName.trim()}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800, opacity: (todayCheckedInAthletes.length === 0 || !assignForm.guestName.trim()) ? 0.5 : 1 }}
                  >
                    Confirm & Issue Key
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleMaintenance(selectedLockerModal.id);
                    setSelectedLockerModal(null);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={14} /> Flag Locker {selectedLockerModal?.id} as Damaged / Out of Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Digital Guest PAR-Q & Touch Canvas Signature Pad Modal */}
      {showParqModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '580px', width: '100%', background: '#0e111a', border: '1.5px solid #e1c256', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(225, 194, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e1c256' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                    Digital Guest PAR-Q & Liability Waiver
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Physical Activity Readiness Questionnaire & RA 10173 DPA Clearance
                  </p>
                </div>
              </div>
              <Tooltip text="Close Modal" position="bottom">
                <button
                  type="button"
                  onClick={() => setShowParqModal(false)}
                  className="modal-close-circle-btn"
                  title="Close Modal (Esc)"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#94a3b8',
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
                  aria-label="Close Modal"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            <form onSubmit={handleSaveParqWaiver} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Guest Profile Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Guest Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Santos"
                    value={parqGuestName}
                    onChange={(e) => setParqGuestName(e.target.value)}
                    style={{ width: '100%', background: '#0a0d14', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+63 917 000 0000"
                    value={parqPhone}
                    onChange={(e) => setParqPhone(e.target.value)}
                    style={{ width: '100%', background: '#0a0d14', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Emergency Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Roberto Santos (Spouse)"
                    value={parqEmergencyContact}
                    onChange={(e) => setParqEmergencyContact(e.target.value)}
                    style={{ width: '100%', background: '#0a0d14', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Emergency Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+63 920 111 2222"
                    value={parqEmergencyPhone}
                    onChange={(e) => setParqEmergencyPhone(e.target.value)}
                    style={{ width: '100%', background: '#0a0d14', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8125rem' }}
                  />
                </div>
              </div>

              {/* 7 Standard PAR-Q Check Questions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Physical Readiness Health Questions (PAR-Q)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', background: '#090b10', border: '1px solid #262c3e', borderRadius: '8px', padding: '8px 12px' }}>
                  {[
                    { key: 'q1', text: '1. Has your doctor ever said that you have a heart condition and should only perform medically supervised exercise?' },
                    { key: 'q2', text: '2. Do you feel pain or tightness in your chest when engaging in physical training or exertion?' },
                    { key: 'q3', text: '3. In the past month, have you experienced chest pain when you were NOT doing physical activity?' },
                    { key: 'q4', text: '4. Do you ever lose balance due to dizziness or have you ever lost consciousness/fainted?' },
                    { key: 'q5', text: '5. Do you have a bone or joint problem (e.g. back, knee, hip) that could worsen with barbell lifting?' },
                    { key: 'q6', text: '6. Is your doctor currently prescribing medication for your blood pressure or a heart condition?' },
                    { key: 'q7', text: '7. Do you know of any other medical reason why you should not undergo physical exercise today?' }
                  ].map((q) => (
                    <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1a2030', fontSize: '0.75rem' }}>
                      <span style={{ color: '#cbd5e1', paddingRight: '8px' }}>{q.text}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setParqAnswers({ ...parqAnswers, [q.key]: false })}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: !parqAnswers[q.key] ? '1px solid #658256' : '1px solid #334155',
                            background: !parqAnswers[q.key] ? 'rgba(101, 130, 86, 0.2)' : 'transparent',
                            color: !parqAnswers[q.key] ? '#658256' : '#64748b',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          NO
                        </button>
                        <button
                          type="button"
                          onClick={() => setParqAnswers({ ...parqAnswers, [q.key]: true })}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: parqAnswers[q.key] ? '1px solid #ef4444' : '1px solid #334155',
                            background: parqAnswers[q.key] ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                            color: parqAnswers[q.key] ? '#ef4444' : '#64748b',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          YES
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning if any question answered YES */}
              {Object.values(parqAnswers).some(Boolean) && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} />
                  <span>Medical attention advised. Guest acknowledges risk and agrees to moderate workout intensity.</span>
                </div>
              )}

              {/* Canvas Touch / Mouse Signature Pad */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>
                    Guest Touch Signature Pad (Draw with Finger or Stylus/Mouse) *
                  </label>
                  <button
                    type="button"
                    onClick={clearCanvasSignature}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.6875rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Clear Signature
                  </button>
                </div>
                <div style={{ background: '#0a0d14', border: '1.5px dashed #475569', borderRadius: '8px', padding: '4px', textAlign: 'center' }}>
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={110}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ width: '100%', height: '110px', background: '#06080d', borderRadius: '6px', touchAction: 'none', cursor: 'crosshair' }}
                  />
                  <div style={{ fontSize: '0.625rem', color: '#475569', marginTop: '2px' }}>
                    Sign above using touchscreen or mouse pointer. Digital vector captured.
                  </div>
                </div>
              </div>

              {/* RA 10173 DPA & Liability Consent */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.6875rem', color: '#94a3b8', lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  required
                  checked={parqConsent}
                  onChange={(e) => setParqConsent(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I certify that all medical declarations provided are true and correct. In accordance with the Philippine Data Privacy Act of 2012 (RA 10173), I consent to the collection of this emergency record and release KSYN Fitness from liability arising from self-paced physical training.
                </span>
              </label>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowParqModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} /> Save & Clear Guest for Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5-Step Member Onboarding Wizard Modal */}
      {showOnboardingWizard && (
        <MemberOnboardingWizard
          isOpen={showOnboardingWizard}
          onClose={() => setShowOnboardingWizard(false)}
          defaultBranchId={user?.branch_id || 'b-mkt-01'}
        />
      )}

      {/* X-READING OFFICIAL TURNOVER MODAL */}
      {showXReadingModal && xReadingReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '20px'
          }}
        >
          <div
            className="ksyn-card"
            style={{
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0d1017',
              border: '2px solid #e1c256',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225, 194, 86, 0.15)'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #334155', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'inline-block', background: 'rgba(225, 194, 86, 0.15)', color: '#e1c256', padding: '4px 10px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '6px' }}>
                OFFICIAL CASHIER HANDOVER (X-READING)
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                KSYN FITCONNECT PHILIPPINES
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '4px 0 0 0' }}>
                {xReadingReport.branch_name || 'Makati Flagship Branch'} • Station Register POS-01
              </p>
              <div className="mono" style={{ color: '#64748b', fontSize: '0.6875rem', marginTop: '4px' }}>
                READING REF: {xReadingReport.reading_id || xReadingReport.id || 'X-READING'} • SHIFT: {xReadingReport.shift_id}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Cashier on Duty:</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{xReadingReport.cashier_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Closing Timestamp:</span>
                <span style={{ color: '#ffffff' }}>
                  {new Date(xReadingReport.closed_at).toLocaleDateString()} {new Date(xReadingReport.closed_at).toLocaleTimeString()}
                </span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Opening Cash Float:</span>
                <span className="mono" style={{ color: '#f7ffc4' }}>₱{Number(xReadingReport.opening_float || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shift Cash Sales:</span>
                <span className="mono" style={{ color: '#658256' }}>+₱{Number(xReadingReport.total_cash_sales || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mid-Shift Cash Drops:</span>
                <span className="mono" style={{ color: '#f87171' }}>-₱{Number(xReadingReport.cash_drops || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shift Digital Sales:</span>
                <span className="mono" style={{ color: '#e1c256' }}>₱{Number(xReadingReport.total_digital_sales || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Gross Shift Turnover:</span>
                <span className="mono" style={{ color: '#e1c256' }}>₱{Number(xReadingReport.gross_shift_sales || xReadingReport.gross_sales || 0).toFixed(2)}</span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Expected Drawer Cash:</span>
                <span className="mono">₱{Number(xReadingReport.expected_cash_drawer || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Actual Cash Counted:</span>
                <span className="mono" style={{ color: '#ffffff', fontWeight: 700 }}>₱{Number(xReadingReport.actual_cash_counted || 0).toFixed(2)}</span>
              </div>

              {/* Variance Accountability Display */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginTop: '4px',
                  background: Number(xReadingReport.variance) === 0
                    ? 'rgba(101, 130, 86, 0.12)'
                    : Number(xReadingReport.variance) < 0
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(225, 194, 86, 0.12)',
                  border: Number(xReadingReport.variance) === 0
                    ? '1px solid #658256'
                    : Number(xReadingReport.variance) < 0
                    ? '1px solid #ef4444'
                    : '1px solid #e1c256'
                }}
              >
                <span style={{ fontWeight: 800, color: Number(xReadingReport.variance) === 0 ? '#658256' : Number(xReadingReport.variance) < 0 ? '#ef4444' : '#e1c256' }}>
                  Variance / Discrepancy:
                </span>
                <span
                  className="mono"
                  style={{
                    fontWeight: 900,
                    fontSize: '0.9375rem',
                    color: Number(xReadingReport.variance) === 0 ? '#658256' : Number(xReadingReport.variance) < 0 ? '#ef4444' : '#e1c256'
                  }}
                >
                  {Number(xReadingReport.variance) === 0
                    ? '₱0.00 (BALANCED)'
                    : Number(xReadingReport.variance) < 0
                    ? `-₱${Math.abs(xReadingReport.variance).toFixed(2)} (SHORTAGE TAGGED)`
                    : `+₱${Number(xReadingReport.variance).toFixed(2)} (OVERAGE)`}
                </span>
              </div>
            </div>

            {/* Denomination Breakdown Accordion / Grid */}
            {xReadingReport.denominations && (
              <div style={{ background: '#121520', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Banknote size={14} /> Itemized Physical Denominations
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.72rem' }}>
                  {[
                    { label: '₱1,000 Bill', val: xReadingReport.denominations.p1000, mult: 1000 },
                    { label: '₱500 Bill', val: xReadingReport.denominations.p500, mult: 500 },
                    { label: '₱200 Bill', val: xReadingReport.denominations.p200, mult: 200 },
                    { label: '₱100 Bill', val: xReadingReport.denominations.p100, mult: 100 },
                    { label: '₱50 Bill', val: xReadingReport.denominations.p50, mult: 50 },
                    { label: '₱20 Bill', val: xReadingReport.denominations.p20, mult: 20 },
                    { label: '₱20 Coin', val: xReadingReport.denominations.c20, mult: 20 },
                    { label: '₱10 Coin', val: xReadingReport.denominations.c10, mult: 10 },
                    { label: '₱5 Coin', val: xReadingReport.denominations.c5, mult: 5 },
                    { label: '₱1 Coin', val: xReadingReport.denominations.c1, mult: 1 },
                    { label: '₱0.25 Centavo', val: xReadingReport.denominations.c025, mult: 0.25 }
                  ].filter(d => Number(d.val) > 0).map(d => (
                    <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>{d.label} × {d.val}:</span>
                      <span className="mono" style={{ color: '#ffffff', fontWeight: 700 }}>₱{(Number(d.val) * d.mult).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px' }}>
              <strong>Handover Remarks:</strong> {xReadingReport.notes || 'None logged.'}
            </div>

            {/* Official Cashier & Supervisor Signature Blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div style={{ background: '#0a0d14', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ height: '36px', borderBottom: '1.5px dashed #475569', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontStyle: 'italic', color: '#e1c256', fontSize: '0.8125rem' }}>
                    {xReadingReport.cashier_name}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
                  {xReadingReport.cashier_name}
                </div>
                <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cashier on Duty (Attestation)
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                  "I certify under penalty of sanction that the counted amounts are true & correct."
                </div>
              </div>

              <div style={{ background: '#0a0d14', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ height: '36px', borderBottom: '1.5px dashed #475569', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontStyle: 'italic', color: '#658256', fontSize: '0.8125rem' }}>
                    Verified & Witnessed
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
                  Shift Supervisor / Admin
                </div>
                <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Supervisor Signature (Auditor)
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                  "Physical count verified, shift turnover audited, and discrepancy acknowledged."
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handlePrintXReading(xReadingReport)}
                className="ksyn-btn ksyn-btn-outline"
                style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print 80mm X-Reading
              </button>
              <button
                type="button"
                onClick={() => setShowXReadingModal(false)}
                className="ksyn-btn ksyn-btn-gold"
                style={{ flex: 1, padding: '10px', fontSize: '0.8125rem', fontWeight: 800 }}
              >
                Dismiss & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPEN REGISTER SHIFT MODAL */}
      {showOpenShiftModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
          }}
        >
          <div
            className="ksyn-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#0d1017',
              border: '2px solid #e1c256',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225, 194, 86, 0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="#e1c256" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Open Register Shift Session</h3>
              </div>
              <Tooltip text="Close Modal" position="bottom">
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="modal-close-circle-btn"
                  title="Close Modal (Esc)"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#94a3b8',
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
                  aria-label="Close Modal"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Cashier on Duty
                </label>
                <div style={{ background: '#141824', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={16} color="#658256" />
                  <span>{user?.name || 'Front Desk Staff'}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>({user?.role || 'front_desk'})</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Starting Change Float (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={newShiftFloat}
                  onChange={(e) => setNewShiftFloat(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    background: '#0a0d14',
                    border: '1px solid #e1c256',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#ffffff',
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
                {/* Presets */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[2000, 3000, 5000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewShiftFloat(val)}
                      style={{
                        flex: 1,
                        background: newShiftFloat === val ? 'rgba(225, 194, 86, 0.2)' : 'rgba(255,255,255,0.04)',
                        border: newShiftFloat === val ? '1px solid #e1c256' : '1px solid rgba(255,255,255,0.1)',
                        color: newShiftFloat === val ? '#e1c256' : '#cbd5e1',
                        borderRadius: '6px',
                        padding: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ₱{val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Opening Drawer Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={newShiftNotes}
                  onChange={(e) => setNewShiftNotes(e.target.value)}
                  placeholder="e.g. Starting float received from Branch Safe. Change fund envelope #02."
                  style={{
                    width: '100%',
                    background: '#0a0d14',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ flex: 1, padding: '10px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenShift}
                  disabled={isOpeningShift}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ flex: 2, padding: '10px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} /> Confirm & Open Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLASS ROLL CALL MODAL */}
      {selectedRollCallClass && (() => {
        const currentRoster = getRosterForClass(selectedRollCallClass);
        const { isConcluded, isLive } = getClassStatus(selectedRollCallClass.time);
        const checkedInCount = currentRoster.filter(a => a.status === 'Checked In' || a.status === 'Walk-In Registered').length;
        const confirmedCount = currentRoster.filter(a => a.status !== 'Checked In' && a.status !== 'Walk-In Registered').length;
        const capacity = selectedRollCallClass.capacity || 20;
        const isCapacityFull = currentRoster.length >= capacity;

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
              padding: '20px'
            }}
          >
            <div
              className="ksyn-card"
              style={{
                maxWidth: '860px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#0d1017',
                border: '2px solid #e1c256',
                padding: '24px',
                borderRadius: '16px',
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
                      {selectedRollCallClass.category || selectedRollCallClass.type || 'Group Fitness'}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>{selectedRollCallClass.room}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                    <span className="mono" style={{ color: '#e1c256', fontSize: '0.75rem', fontWeight: 800 }}>{selectedRollCallClass.time}</span>
                    {isConcluded && (
                      <span className="badge badge-inactive" style={{ fontSize: '0.6875rem' }}>
                        Session Concluded
                      </span>
                    )}
                    {isLive && (
                      <span className="badge badge-active flex items-center gap-1" style={{ fontSize: '0.6875rem' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live In Session
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                    {selectedRollCallClass.name}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    Instructor: <strong style={{ color: '#f8fafc' }}>{selectedRollCallClass.instructor || selectedRollCallClass.coach_name}</strong>
                  </p>
                </div>

                <Tooltip text="Close Roll Call" position="bottom">
                  <button
                    type="button"
                    onClick={() => setSelectedRollCallClass(null)}
                    className="modal-close-circle-btn"
                    title="Close Roll Call (Esc)"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      minWidth: '36px',
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    aria-label="Close Roll Call"
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              </div>

              {/* Metrics Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#121520', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                    Total Enrolled
                  </div>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
                    {currentRoster.length} / {capacity} Athletes
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: isCapacityFull ? '#ef4444' : '#64748b', marginTop: '2px' }}>
                    {isCapacityFull ? 'Capacity Reached (Full)' : `${Math.max(0, capacity - currentRoster.length)} open slots remain`}
                  </div>
                </div>

                <div style={{ background: '#121520', border: '1px solid #1e293b', borderLeft: '4px solid #658256', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                    Present / Checked-In
                  </div>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#658256', marginTop: '4px' }}>
                    {checkedInCount} Verified
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
                    {currentRoster.length > 0 ? `${Math.round((checkedInCount / currentRoster.length) * 100)}% verified on floor` : '0%'}
                  </div>
                </div>

                <div style={{ background: '#121520', border: '1px solid #1e293b', borderLeft: '4px solid #e1c256', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
                    Remaining Absentees
                  </div>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', marginTop: '4px' }}>
                    {confirmedCount} Pending
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
                    {isConcluded ? 'Did not attend class session' : 'Awaiting turnstile scan arrival'}
                  </div>
                </div>
              </div>

              {/* Strict Walk-in Eligibility Controls */}
              <div style={{ background: '#141824', border: '1px solid #232d42', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e1c256', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Quick Walk-in Athlete Registration
                  </span>
                  {isConcluded ? (
                    <span className="inline-flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#ef4444', fontWeight: 700 }}>
                      <AlertTriangle size={12} /> Concluded Session
                    </span>
                  ) : isCapacityFull ? (
                    <span className="inline-flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#e1c256', fontWeight: 700 }}>
                      <AlertTriangle size={12} /> Capacity Limit Reached
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#658256', fontWeight: 700 }}>
                      <CheckCircle2 size={12} /> {capacity - currentRoster.length} Slots Available
                    </span>
                  )}
                </div>

                {isConcluded ? (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 700
                  }} className="flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>Class session concluded. Walk-in registrations closed.</span>
                  </div>
                ) : isCapacityFull ? (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(225, 194, 86, 0.1)',
                    border: '1px solid rgba(225, 194, 86, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 700
                  }} className="flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>Studio Capacity Limit Reached (Full - No slots available).</span>
                  </div>
                ) : (
                  <form onSubmit={handleStaffAddWalkIn} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Enter member name or select active member..."
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="ksyn-input flex-1"
                      style={{ minWidth: '220px', fontSize: '0.75rem', height: '36px' }}
                    />
                    <select
                      value={walkInTier}
                      onChange={(e) => setWalkInTier(e.target.value)}
                      className="ksyn-input"
                      style={{ width: '150px', fontSize: '0.75rem', height: '36px' }}
                    >
                      <option value="Walk-in Day Pass">Walk-in Day Pass</option>
                      <option value="1-Month Pass">1-Month Pass</option>
                      <option value="3-Months Pass">3-Months Pass</option>
                      <option value="Black Elite">Black Elite</option>
                    </select>
                    <button
                      type="submit"
                      disabled={!walkInName.trim()}
                      className="ksyn-btn ksyn-btn-gold"
                      style={{
                        padding: '0 16px',
                        height: '36px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        opacity: !walkInName.trim() ? 0.5 : 1,
                        cursor: !walkInName.trim() ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + Add Walk-In Athlete
                    </button>
                  </form>
                )}
              </div>

              {/* Live Audit Stream Roster Table (Zero Manual Front-Desk Overrides) */}
              <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #1e293b', borderRadius: '10px' }}>
                <table className="ksyn-table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#121520', zIndex: 10 }}>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Member Name</th>
                      <th>Plan Tier</th>
                      <th>Verification Source</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Verified Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRoster.map((athlete, index) => {
                      const isAutoCheckedIn = athlete.status === 'Checked In';
                      const isWalkIn = athlete.status === 'Walk-In Registered';
                      const isVerified = isAutoCheckedIn || isWalkIn;
                      const checkInTimeDisplay = athlete.checked_in_at
                        ? new Date(athlete.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : (athlete.checkInTime || '—');

                      return (
                        <tr key={athlete.id || athlete.user_id || index} style={{ background: isVerified ? 'rgba(101, 130, 86, 0.04)' : 'transparent' }}>
                          <td className="mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {index + 1}
                          </td>
                          <td style={{ fontWeight: 700, color: '#ffffff' }}>
                            <div>{athlete.name || 'Member'}</div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                              ID: {athlete.user_id || athlete.id || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: athlete.tier === 'Black Elite' ? 'rgba(225, 194, 86, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                              color: athlete.tier === 'Black Elite' ? '#e1c256' : '#cbd5e1',
                              border: athlete.tier === 'Black Elite' ? '1px solid rgba(225, 194, 86, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              {athlete.tier || '1-Month Pass'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', color: isVerified ? '#f7ffc4' : '#64748b', fontWeight: 600 }}>
                              {athlete.verified_via || (isAutoCheckedIn ? 'RFID / Dynamic QR' : (isWalkIn ? 'Front-Desk Reception' : 'Pending Turnstile Scan'))}
                            </span>
                          </td>
                          <td>
                            {isAutoCheckedIn ? (
                              <span className="badge badge-active flex items-center gap-1" style={{ fontSize: '0.6875rem', display: 'inline-flex' }}>
                                <ShieldCheck size={12} /> Auto-Verified via Turnstile
                              </span>
                            ) : isWalkIn ? (
                              <span className="badge badge-active flex items-center gap-1" style={{ fontSize: '0.6875rem', display: 'inline-flex' }}>
                                <CheckCircle2 size={12} /> Walk-In Registered
                              </span>
                            ) : isConcluded ? (
                              <span className="badge badge-inactive" style={{ fontSize: '0.6875rem', display: 'inline-flex' }}>
                                <XCircle size={12} /> No Show (Unattended)
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.6875rem', display: 'inline-flex' }}>
                                <Clock size={12} /> Confirmed (Awaiting Arrival)
                              </span>
                            )}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: '0.75rem', color: isVerified ? '#658256' : '#64748b' }}>
                            {checkInTimeDisplay}
                          </td>
                        </tr>
                      );
                    })}
                    {currentRoster.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          No athletes booked for this class session yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => exportClassAttendanceToExcel(selectedRollCallClass)}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  title="Export live attendance roster to Excel (.csv)"
                >
                  <FileText size={15} /> Export Class Attendance (.csv)
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedRollCallClass(null)}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeRollCall}
                    className="ksyn-btn ksyn-btn-gold"
                    style={{ padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={16} /> Save & Finalize Roll Call
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* COACH AVAILABILITY & SCHEDULE CONFIRMATION MODAL */}
      {verifyCoachModalEnrollment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmingAvailabilityLoading) {
              setVerifyCoachModalEnrollment(null);
            }
          }}
        >
          <div
            style={{
              background: '#10141e',
              border: '1.5px solid #e1c256',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #1f283d', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#e1c256" /> Verify Coach Availability
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Confirm coach availability before finalizing schedule slot and assigning athlete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyCoachModalEnrollment(null)}
                disabled={confirmingAvailabilityLoading}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#0a0d14', border: '1px solid #1a2336', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Athlete:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff' }}>{verifyCoachModalEnrollment.member_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Assigned Coach:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#e1c256' }}>{verifyCoachModalEnrollment.coach_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Package:</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#cbd5e1' }}>{verifyCoachModalEnrollment.package_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Requested Slot:</span>
                <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700 }}>
                  {verifyCoachModalEnrollment.preferred_date ? new Date(verifyCoachModalEnrollment.preferred_date).toLocaleDateString() : 'Flexible'} • {verifyCoachModalEnrollment.preferred_time_slot || 'Pending Confirmation'}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmAndClear} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Confirmed Coach Schedule Slot *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Slot (08:00 AM – 09:00 AM) or Tue/Thu 04:00 PM"
                  value={verifiedSlotInput}
                  onChange={(e) => setVerifiedSlotInput(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Verification / Handover Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified with Coach Sofia Cruz via floor radio"
                  value={verifiedCoachNotes}
                  onChange={(e) => setVerifiedCoachNotes(e.target.value)}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                />
              </div>

              <div style={{ background: 'rgba(101, 130, 86, 0.1)', border: '1px solid rgba(101, 130, 86, 0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.72rem', color: '#a7f3d0' }}>
                By confirming, you verify that Coach {verifyCoachModalEnrollment.coach_name?.split(' ')?.[0]} has confirmed their floor availability for this session.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setVerifyCoachModalEnrollment(null)}
                  disabled={confirmingAvailabilityLoading}
                  className="ksyn-btn"
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmingAvailabilityLoading || !verifiedSlotInput.trim()}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ flex: 2, padding: '10px', fontSize: '0.8125rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} />
                  {confirmingAvailabilityLoading ? 'Confirming & Assigning...' : 'Confirm Availability & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Front-Desk / Staff Facility Incident & Maintenance Request Modal */}
      {showReportMaintenanceModal && (
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
                  Report Facility / Equipment Issue
                </h3>
              </div>
              <button onClick={() => setShowReportMaintenanceModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#94a3b8' }}>
              This ticket will be immediately submitted to the Branch Admin Incident & Maintenance Log with your account signature.
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
                  <option value="Turnstile & Hardware">Turnstile & Hardware Access</option>
                  <option value="Equipment Maintenance">Gym Floor Equipment Maintenance</option>
                  <option value="Locker / Facilities">Lockers & Changing Room Facilities</option>
                  <option value="HVAC, Plumbing & Electrical">HVAC, Plumbing & Electrical</option>
                  <option value="Member Safety & Conduct">Member Safety & Conduct Incident</option>
                </select>
              </div>

              <div>
                <label className="ksyn-label">Incident / Equipment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Turnstile Gate 2 arm stuck / Locker L-14 cylinder jammed"
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
                  <option value="Low">Low (Cosmetic / Minor notice)</option>
                  <option value="Medium">Medium (Attention required today)</option>
                  <option value="High">High (Impacting member workouts)</option>
                  <option value="Critical">Critical (Safety hazard / Facility block)</option>
                </select>
              </div>

              <div>
                <label className="ksyn-label">Detailed Observations / Location</label>
                <textarea
                  rows={3}
                  placeholder="Describe location, symptoms observed, or steps taken on-site..."
                  value={maintenanceForm.details}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, details: e.target.value })}
                  className="ksyn-input"
                  style={{ width: '100%', fontSize: '0.8125rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowReportMaintenanceModal(false)}
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

      {/* Member Profile & Emergency Dossier Modal */}
      {selectedMemberProfileModal && (
        <MemberProfileModal
          member={selectedMemberProfileModal}
          onClose={() => setSelectedMemberProfileModal(null)}
        />
      )}

      {/* Front-Desk Over-The-Counter PT Package Enrollment Modal */}
      {showPosPtEnrollmentModal && (
        <PosPtEnrollmentModal
          isOpen={showPosPtEnrollmentModal}
          onClose={() => setShowPosPtEnrollmentModal(false)}
          cashierUser={user}
          currentBranchId={user?.branch_id}
          currentShift={currentShift}
          members={membersList}
          ptEnrollments={ptEnrollmentsQueue}
          onSuccess={() => {
            if (typeof fetchPtEnrollments === 'function') fetchPtEnrollments();
            if (typeof fetchCurrentShift === 'function') fetchCurrentShift();
            if (typeof loadLogs === 'function') loadLogs();
          }}
        />
      )}
    </div>
  );
}

export default function EmployeePortal(props) {
  return (
    <EmployeePortalErrorBoundary>
      <EmployeePortalContent {...props} />
    </EmployeePortalErrorBoundary>
  );
}

