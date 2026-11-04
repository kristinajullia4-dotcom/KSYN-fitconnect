import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Dumbbell,
  Shield,
  Building2,
  Users,
  QrCode,
  DollarSign,
  Banknote,
  Package,
  PackageSearch,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Lock,
  Layers,
  CheckCircle2,
  CalendarCheck,
  Flame,
  User,
  CreditCard,
  Activity,
  UserCheck,
  TrendingUp,
  Gift,
  Ticket,
  Receipt,
  Award,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Key,
  PanelLeftOpen,
  PanelLeftClose,
  Menu,
  Megaphone,
  X
} from 'lucide-react';
import Tooltip from './Tooltip';
import EmployeeSidebar from './EmployeeSidebar';
import { formatUserDisplayName } from '../utils/userDisplay';

const getRoleHexColor = (role) => {
  const r = role?.toLowerCase()?.replace('-', '_');
  switch (r) {
    case 'super_admin':
    case 'superadmin':
      return '#e1c256'; // Warm Gold
    case 'branch_admin':
    case 'branchadmin':
      return '#e1c256'; // Warm Gold
    case 'branch_owner':
      return '#f7ffc4'; // Pale Cream
    case 'coach':
    case 'trainer':
      return '#7fa36d'; // Sage Olive Green
    case 'employee':
    case 'staff':
      return '#f7ffc4'; // Pale Cream
    case 'member':
      return '#7fa36d'; // Sage Olive Green
    default:
      return '#9ca3af';
  }
};

const getRoleBgColor = (role) => {
  const r = role?.toLowerCase()?.replace('-', '_');
  switch (r) {
    case 'super_admin':
    case 'superadmin':
      return 'rgba(225, 194, 86, 0.15)';
    case 'branch_admin':
    case 'branchadmin':
      return 'rgba(225, 194, 86, 0.12)';
    case 'branch_owner':
      return 'rgba(247, 255, 196, 0.12)';
    case 'coach':
    case 'trainer':
      return 'rgba(101, 130, 86, 0.16)';
    case 'employee':
    case 'staff':
      return 'rgba(247, 255, 196, 0.12)';
    case 'member':
      return 'rgba(101, 130, 86, 0.16)';
    default:
      return 'rgba(156, 163, 175, 0.1)';
  }
};

const getRoleBorderColor = (role) => {
  const r = role?.toLowerCase()?.replace('-', '_');
  switch (r) {
    case 'super_admin':
    case 'superadmin':
      return 'rgba(225, 194, 86, 0.4)';
    case 'branch_admin':
    case 'branchadmin':
      return 'rgba(225, 194, 86, 0.35)';
    case 'branch_owner':
      return 'rgba(247, 255, 196, 0.35)';
    case 'coach':
    case 'trainer':
      return 'rgba(101, 130, 86, 0.35)';
    case 'employee':
    case 'staff':
      return 'rgba(247, 255, 196, 0.35)';
    case 'member':
      return 'rgba(101, 130, 86, 0.35)';
    default:
      return 'rgba(156, 163, 175, 0.3)';
  }
};

const formatRoleName = (role) => {
  if (!role) return 'USER';
  return String(role).replace(/_/g, ' ').toUpperCase();
};

const formatRole = (role) => formatRoleName(role);

export default function Layout({ currentView, setCurrentView, children }) {
  const { user, logout, authFetch } = useAuth();
  const { toast } = useToast();
  const [pendingRestockCount, setPendingRestockCount] = useState(0);
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSlidePaused, setIsSlidePaused] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(() => {
    try {
      const stored = sessionStorage.getItem('ksyn_dismissed_announcements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Poll for active global announcements & broadcasts with strict audience targeting
  useEffect(() => {
    let isMounted = true;
    const fetchAnnouncements = async () => {
      try {
        const token = localStorage.getItem('ksyn_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [annRes, broadRes] = await Promise.all([
          fetch('/api/announcements', { headers }).then(r => r.json()).catch(() => null),
          fetch('/api/broadcast/active', { headers }).then(r => r.json()).catch(() => null)
        ]);

        const combined = [];
        const seenKeys = new Set();

        const addIfValid = (item) => {
          if (!item) return;
          const key = item.id ? String(item.id) : (item.title ? String(item.title) : null);
          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            combined.push(item);
          }
        };

        if (broadRes?.success && broadRes.broadcast) {
          addIfValid(broadRes.broadcast);
        }
        if (annRes?.success && Array.isArray(annRes.announcements)) {
          annRes.announcements.forEach(addIfValid);
        }

        if (isMounted) {
          setAnnouncementsList(combined);
        }
      } catch {
        // silently catch
      }
    };

    fetchAnnouncements();
    const bInterval = setInterval(fetchAnnouncements, 20000);
    return () => {
      isMounted = false;
      clearInterval(bInterval);
    };
  }, [user]);

  // Filter visible announcements against audience targeting and session dismissal
  const visibleAnnouncements = announcementsList.filter(item => {
    if (!item) return false;
    if (item.is_active === false) return false;
    if (item.valid_until && new Date(item.valid_until) < new Date()) return false;

    // Check dismissal in current session
    const idKey = item.id ? String(item.id) : null;
    const titleKey = item.title ? String(item.title) : null;
    if ((idKey && dismissedAnnouncements.includes(idKey)) || (titleKey && dismissedAnnouncements.includes(titleKey))) {
      return false;
    }

    // Role filtering & accurate audience delivery
    const aud = String(item.target_audience || 'all');
    const r = user?.role;
    if (!r) return true;

    if (r === 'super_admin') {
      // Super Admin should only see global/executive announcements, never branch-specific member promos
      if (item.type === 'promo' || aud.startsWith('members') || aud.startsWith('member')) {
        return false;
      }
      return true;
    }

    if (aud === 'all') return true;

    // Normalize branch check
    const matchesUserBranch = !item.branch_id || !user?.branch_id || String(item.branch_id) === String(user.branch_id);

    if (r === 'branch_owner' || r === 'investor') {
      if (aud === 'branch_owners' || aud === 'investors') return true;
      if (aud === 'branch_admins' || aud === 'branch_all') {
        return matchesUserBranch;
      }
      return false;
    }
    if (r === 'branch_admin') {
      if (aud === 'branch_admins') return true;
      if (aud === 'branch_all') return matchesUserBranch;
      return false;
    }
    if (r === 'member') {
      if (aud === 'members' || aud === 'members_all') return true;
      if (aud === 'members_only' || aud === 'branch_all') return matchesUserBranch;
      if (aud === `members_${user?.branch_id}` || aud === `members_${user?.branch_code?.toLowerCase()}`) return true;
      return false;
    }
    if (r === 'coach' || r === 'trainer') {
      if (aud === 'coaches' || aud === 'coaches_only' || aud === 'branch_all') {
        return matchesUserBranch;
      }
      return false;
    }
    if (r === 'employee' || r === 'staff') {
      if (aud === 'staff' || aud === 'staff_only' || aud === 'branch_all') {
        return matchesUserBranch;
      }
      return false;
    }
    return true;
  });

  const activeSlideCount = visibleAnnouncements.length;
  const safeSlideIndex = activeSlideCount > 0 ? ((currentSlideIndex % activeSlideCount) + activeSlideCount) % activeSlideCount : 0;
  const currentAnnouncement = visibleAnnouncements[safeSlideIndex];

  // Auto-slide every 6 seconds if not hovered/paused
  useEffect(() => {
    if (activeSlideCount <= 1 || isSlidePaused) return;
    const slideTimer = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % activeSlideCount);
    }, 6000);
    return () => clearInterval(slideTimer);
  }, [activeSlideCount, isSlidePaused]);

  const handleDismissAnnouncement = (item) => {
    if (!item) return;
    const keysToAdd = [item.id ? String(item.id) : null, item.title ? String(item.title) : null].filter(Boolean);
    const updated = Array.from(new Set([...dismissedAnnouncements, ...keysToAdd]));
    try {
      sessionStorage.setItem('ksyn_dismissed_announcements', JSON.stringify(updated));
    } catch {}
    setDismissedAnnouncements(updated);
  };

  const handleProfileClick = () => {
    if (!user || typeof setCurrentView !== 'function') return;
    const r = user?.role?.toLowerCase()?.replace('-', '_');
    if (r === 'super_admin' || r === 'superadmin') {
      return; // Super admin does not view profile
    }
    if (r === 'member' || r === 'guest') {
      setCurrentView('profile');
    } else if (r === 'coach' || r === 'trainer') {
      setCurrentView('profile_credentials');
    } else if (r === 'branch_admin' || r === 'branchadmin') {
      setCurrentView('profile');
    } else if (r === 'employee' || r === 'staff') {
      setCurrentView('profile');
    } else if (r === 'branch_owner' || r === 'investor') {
      setCurrentView('overview');
    } else {
      setCurrentView('profile');
    }
  };

  // Poll for pending equipment restock requests across all branches (Super Admin only)
  useEffect(() => {
    if (user?.role === 'super_admin' && typeof authFetch === 'function') {
      const fetchRestockCount = async () => {
        try {
          const res = await authFetch('/api/super-admin/inventory/procurement-feed');
          const data = await res.json();
          if (data.success && Array.isArray(data.requests)) {
            const count = data.requests.filter(r => r.status === 'Pending HQ Review').length;
            setPendingRestockCount(count);
          }
        } catch {
          // silently catch network hiccup
        }
      };
      fetchRestockCount();
      const interval = setInterval(fetchRestockCount, 10000);
      return () => clearInterval(interval);
    }
  }, [user, authFetch]);

  // Navigation Items per Role
  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'super_admin':
        return [
          { id: 'overview', label: 'System-Wide Dashboard', icon: Building2 },
          { id: 'admin_accounts', label: 'Admin & Branch Owner Accounts', icon: Users },
          { id: 'branches', label: 'Branch Management', icon: Layers },
          { id: 'equipment_oversight', label: 'Equipment & Restock Oversight', icon: PackageSearch, badge: pendingRestockCount },
          { id: 'applications', label: 'Franchise Applications & Records', icon: FileText },
          { id: 'permissions', label: 'Roles & Permissions Control', icon: Shield },
          { id: 'reports', label: 'Branch Performance Reports', icon: Banknote },
          { id: 'xendit', label: 'Xendit Digital Ledger', icon: CreditCard },
          { id: 'telemetry', label: 'IoT Hardware & Turnstiles', icon: Activity },
          { id: 'broadcasts', label: 'Announcements & Promos', icon: Megaphone }
        ];
      case 'branch_admin':
        return [
          { id: 'overview', label: 'Branch Dashboard', icon: Building2 },
          { id: 'members', label: 'Members & Subscriptions', icon: Users },
          { id: 'staff', label: 'Staff & Front Desk', icon: UserCheck },
          { id: 'equipment', label: 'Equipment & Stock', icon: Package },
          { id: 'incidents', label: 'Incident & Maintenance Log', icon: AlertTriangle },
          { id: 'ledger', label: 'Sales & Royalty Ledger', icon: Banknote },
          { id: 'z_reading', label: 'Cash Drawer & Z-Reading', icon: Receipt },
          { id: 'free_pass', label: 'Free Pass Applicants', icon: Ticket },
          { id: 'announcements', label: 'Announcements & Promos', icon: Megaphone },
          { id: 'profile', label: 'Admin Profile Settings', icon: User }
        ];
      case 'branch_owner':
        return [
          { id: 'overview', label: 'Macro & Financial Telemetry', icon: TrendingUp },
          { id: 'ledger', label: 'EBITDA & Financial Ledger', icon: Banknote },
          { id: 'staff', label: 'Branch Staff & Permissions', icon: ShieldCheck },
          { id: 'equipment', label: 'CapEx Fleet Assets', icon: Package }
        ];
      case 'coach':
      case 'trainer':
        return [
          { id: 'overview', label: 'Coach Dashboard', icon: Dumbbell },
          { id: 'clients', label: 'PT Athletes & Programs', icon: Users },
          { id: 'chat', label: 'Athlete Quick-Chat', icon: MessageSquare },
          { id: 'classes', label: 'Assigned Group Classes', icon: Flame },
          { id: 'commissions', label: 'Earnings & Session Logs', icon: Banknote },
          { id: 'profile_credentials', label: 'Profile & Credentials', icon: UserCheck }
        ];
      case 'employee':
      case 'staff':
        return [
          { id: 'turnstile', label: 'Turnstile Gate / QR Scanner', icon: QrCode },
          { id: 'members', label: 'Member Look-Up & Roster', icon: Users },
          { id: 'lockers', label: 'Locker Key Manager', icon: ShieldCheck },
          { id: 'pos', label: 'Front-Desk POS / Cashier', icon: CreditCard },
          { id: 'schedule', label: 'Class Schedules', icon: Flame },
          { id: 'pt_enrollments', label: 'PT Enrollments Queue', icon: Dumbbell },
          { id: 'profile', label: 'Staff Profile & Rota', icon: User }
        ];
      case 'member':
        return [
          { id: 'pass', label: 'My Digital Pass (QR)', icon: QrCode },
          { id: 'activity_progress', label: 'Activity & Progress', icon: Activity },
          { id: 'classes', label: 'Group Class Bookings', icon: Flame },
          { id: 'chat', label: 'Coach Quick-Chat', icon: MessageSquare },
          { id: 'plan', label: 'Membership Plan & Receipts', icon: CreditCard },
          { id: 'profile', label: 'Profile Settings', icon: User }
        ];
      default:
        return [];
    }
  };

  const isItemActive = (itemId) => {
    if (currentView === itemId) return true;
    if (itemId === 'overview' && (currentView === 'overview' || currentView === 'branch_admin_overview' || currentView === 'super_admin_overview' || currentView === 'coach_overview')) return true;
    if (itemId === 'admin_accounts' && (currentView === 'admin_accounts' || currentView === 'admins' || currentView === 'accounts')) return true;
    if (itemId === 'branches' && (currentView === 'branches' || currentView === 'super_admin_branches')) return true;
    if (itemId === 'equipment_oversight' && (currentView === 'equipment_oversight' || currentView === 'procurement' || currentView === 'restock' || currentView === 'super_admin_equipment')) return true;
    if (itemId === 'applications' && (currentView === 'applications' || currentView === 'franchise_applications')) return true;
    if (itemId === 'permissions' && (currentView === 'permissions' || currentView === 'roles_permissions')) return true;
    if (itemId === 'reports' && (currentView === 'reports' || currentView === 'royalties' || currentView === 'super_admin_reports')) return true;
    if (itemId === 'members' && (currentView === 'members' || currentView === 'branch_admin_members' || currentView === 'employee_members')) return true;
    if (itemId === 'staff' && (currentView === 'staff' || currentView === 'branch_admin_staff' || currentView === 'employees')) return true;
    if (itemId === 'equipment' && (currentView === 'equipment' || currentView === 'inventory' || currentView === 'branch_admin_inventory')) return true;
    if (itemId === 'ledger' && (currentView === 'ledger' || currentView === 'finances' || currentView === 'sales' || currentView === 'branch_admin_finances')) return true;
    if (itemId === 'incidents' && (currentView === 'incidents' || currentView === 'branch_admin_incidents' || currentView === 'maintenance')) return true;
    if (itemId === 'free_pass' && (currentView === 'free_pass' || currentView === 'branch_admin_free_pass' || currentView === 'raffle')) return true;
    if (itemId === 'announcements' && (currentView === 'announcements' || currentView === 'branch_admin_announcements' || currentView === 'promos' || currentView === 'broadcasts')) return true;
    if (itemId === 'inventory' && (currentView === 'equipment' || currentView === 'inventory' || currentView === 'branch_admin_inventory')) return true;
    if (itemId === 'finances' && (currentView === 'ledger' || currentView === 'finances' || currentView === 'branch_admin_finances')) return true;
    if (itemId === 'turnstile' && (currentView === 'turnstile' || currentView === 'kiosk' || currentView === 'employee_kiosk')) return true;
    if (itemId === 'pt_enrollments' && (currentView === 'pt_enrollments' || currentView === 'pt_queue' || currentView === 'enrollments' || currentView === 'employee_pt_enrollments')) return true;
    if (itemId === 'kiosk' && (currentView === 'turnstile' || currentView === 'kiosk' || currentView === 'employee_kiosk')) return true;
    if (itemId === 'members' && (currentView === 'members' || currentView === 'checkins' || currentView === 'employee_attendance')) return true;
    if (itemId === 'pos' && (currentView === 'pos' || currentView === 'cashier' || currentView === 'retail' || currentView === 'employee_pos' || currentView === 'drawer' || currentView === 'cash_drawer')) return true;
    if (itemId === 'lockers' && (currentView === 'lockers' || currentView === 'locker_keys' || currentView === 'employee_lockers')) return true;
    if (itemId === 'schedule' && (currentView === 'schedule' || currentView === 'classes' || currentView === 'employee_classes')) return true;
    if (itemId === 'classes' && (currentView === 'classes' || currentView === 'schedule' || currentView === 'member_classes' || currentView === 'employee_classes' || currentView === 'coach_classes')) return true;
    if (itemId === 'activity_progress' && (currentView === 'activity_progress' || currentView === 'progress' || currentView === 'attendance' || currentView === 'programs' || currentView === 'workout_plans' || currentView === 'checkins' || currentView === 'history' || currentView === 'weight' || currentView === 'fitness' || currentView === 'routine' || currentView === 'workouts' || currentView === 'member_progress' || currentView === 'member_attendance')) return true;
    if (itemId === 'progress' && (currentView === 'progress' || currentView === 'activity_progress' || currentView === 'programs' || currentView === 'workout_plans' || currentView === 'routine' || currentView === 'workouts' || currentView === 'member_progress' || currentView === 'weight' || currentView === 'fitness')) return true;
    if (itemId === 'clients' && (currentView === 'clients' || currentView === 'coach_clients' || currentView === 'pt_clients' || currentView === 'programs' || currentView === 'workouts' || currentView === 'routines' || currentView === 'athletes')) return true;
    if (itemId === 'chat' && (currentView === 'chat' || currentView === 'messages' || currentView === 'coach_chat' || currentView === 'member_chat')) return true;
    if (itemId === 'commissions' && (currentView === 'commissions' || currentView === 'coach_commissions' || currentView === 'earnings' || currentView === 'sessions' || currentView === 'coach_sessions' || currentView === 'pt_sessions' || currentView === 'payout')) return true;
    if (itemId === 'profile_credentials' && (currentView === 'profile_credentials' || currentView === 'coach_profile' || currentView === 'credentials')) return true;
    if (itemId === 'attendance' && (currentView === 'attendance' || currentView === 'member_attendance' || currentView === 'checkins' || currentView === 'history')) return true;
    if (itemId === 'pass' && (currentView === 'pass' || currentView === 'member_pass')) return true;
    if (itemId === 'plan' && (currentView === 'plan' || currentView === 'subscription' || currentView === 'member_subscription')) return true;
    if (itemId === 'subscription' && (currentView === 'plan' || currentView === 'subscription' || currentView === 'member_subscription')) return true;
    if (itemId === 'profile' && (currentView === 'profile' || currentView === 'member_profile' || currentView === 'staff_profile' || currentView === 'admin_profile')) return true;
    return false;
  };

  const navItems = getNavItems();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('ksyn_sidebar_collapsed') === 'true';
  });
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ksyn_sidebar_collapsed', String(next));
      return next;
    });
  };
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('ksyn_last_active_view');
    localStorage.removeItem('ksyn_last_path');
    logout();
    toast.info('You have safely signed out of KSYN FitConnect.', 'Session Ended');
  };

  return (
    <div className="min-h-screen bg-[#090a0c] text-white flex flex-col font-sans">

      {/* Accessible Skip Link (WCAG 2.1 AA) */}
      <a
        href="#role-workspace-main"
        style={{
          position: 'absolute',
          top: '-100px',
          left: '16px',
          background: '#e1c256',
          color: '#000000',
          padding: '10px 18px',
          fontWeight: 800,
          borderRadius: '8px',
          zIndex: 100000,
          textDecoration: 'none',
          transition: 'top 0.2s ease',
          fontSize: '0.875rem'
        }}
        onFocus={(e) => (e.currentTarget.style.top = '16px')}
        onBlur={(e) => (e.currentTarget.style.top = '-100px')}
      >
        Skip to main content
      </a>

      {/* Top Navbar: Spacious 66px Obsidian Header */}
      <header
        style={{
          width: '100%',
          minHeight: '66px',
          backgroundColor: '#0a0c0b',
          borderBottom: '1px solid #1c201d',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)'
        }}
      >
        <div
          style={{
            width: '100%',
            padding: isMobile ? '8px 12px' : '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            boxSizing: 'border-box'
          }}
        >
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(prev => !prev)}
                aria-label={mobileDrawerOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
                className="p-2 rounded-lg bg-[#131614] border border-[#282e29] text-gray-300 hover:text-white hover:border-[#e1c256] transition-all cursor-pointer flex items-center justify-center"
                style={{
                  width: '40px',
                  height: '40px',
                  minWidth: '40px',
                  minHeight: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#131614',
                  border: '1px solid #282e29',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {mobileDrawerOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            <img
              src="/ksyn-logo.png"
              alt="KSYN Gym Logo"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 6px rgba(225, 194, 86, 0.35))'
              }}
            />
            <span
              style={{
                fontSize: '0.9375rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: '#ffffff'
              }}
            >
              KSYN <span style={{ color: '#e1c256' }}>FITCONNECT</span>
            </span>
          </div>
          {/* Right-Side Badges & Actions with Responsive Viewport Adaptation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '14px' }}>
            {/* Branch Tenant Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '6px' : '10px',
                backgroundColor: '#131614',
                border: '1px solid #282e29',
                padding: isMobile ? '0 8px' : '0 14px',
                borderRadius: '8px',
                height: '36px',
                fontSize: '12px'
              }}
            >
              <Building2 size={15} color="#e1c256" style={{ flexShrink: 0 }} />
              <span
                style={{
                  color: '#e5e7eb',
                  fontWeight: 600,
                  maxWidth: isMobile ? '80px' : '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={user?.branch_name || 'Global Corporate HQ'}
              >
                {isMobile ? (user?.branch_code || 'MKT-01') : (user?.branch_name || 'Global Corporate HQ')}
              </span>
              {!isMobile && user?.branch_code && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    backgroundColor: 'rgba(225, 194, 86, 0.12)',
                    border: '1px solid rgba(225, 194, 86, 0.35)',
                    color: '#e1c256',
                    padding: '2px 7px',
                    borderRadius: '4px'
                  }}
                >
                  {user?.branch_code}
                </span>
              )}
            </div>
            {/* Dynamic Role Badge / Profile Settings Link */}
            {(user?.role === 'super_admin' || user?.role === 'superadmin') ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '10px',
                  height: '36px',
                  padding: isMobile ? '0 8px' : '0 14px',
                  borderRadius: '8px',
                  border: `1px solid ${getRoleBorderColor(user?.role)}`,
                  backgroundColor: getRoleBgColor(user?.role),
                  fontSize: '12px',
                  cursor: 'default',
                  userSelect: 'none'
                }}
              >
                <Shield size={14} color={getRoleHexColor(user?.role)} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      color: '#ffffff',
                      fontWeight: 600,
                      maxWidth: isMobile ? '80px' : 'none',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap'
                    }}
                    title={user?.name || 'Operator'}
                  >
                    {formatUserDisplayName(user)}
                  </span>
                  {!isMobile && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: getRoleHexColor(user?.role)
                      }}
                    >
                      • {formatRoleName(user?.role)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <Tooltip content="Click to view Profile Settings" position="bottom">
                <button
                  type="button"
                  onClick={handleProfileClick}
                  aria-label="View Profile Settings"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '6px' : '10px',
                    height: '36px',
                    padding: isMobile ? '0 8px' : '0 14px',
                    borderRadius: '8px',
                    border: `1px solid ${getRoleBorderColor(user?.role)}`,
                    backgroundColor: getRoleBgColor(user?.role),
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {user?.avatar_url || user?.profile_image ? (
                    <img
                      src={user.avatar_url || user.profile_image}
                      alt={user?.name || 'Profile'}
                      style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${getRoleBorderColor(user?.role)}` }}
                    />
                  ) : (
                    <Shield size={14} color={getRoleHexColor(user?.role)} style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        color: '#ffffff',
                        fontWeight: 600,
                        maxWidth: isMobile ? '80px' : 'none',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        whiteSpace: 'nowrap'
                      }}
                      title={user?.name || 'Operator'}
                    >
                      {formatUserDisplayName(user)}
                    </span>
                    {!isMobile && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: getRoleHexColor(user?.role)
                        }}
                      >
                        • {formatRoleName(user?.role)}
                      </span>
                    )}
                  </div>
                </button>
              </Tooltip>
            )}

            {/* Sign Out Button: High-Contrast Obsidian Dark */}
            <Tooltip content="Sign out of system" position="bottom">
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out of system"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '44px',
                  minHeight: '44px',
                  minWidth: isMobile ? '44px' : 'auto',
                  justifyContent: 'center',
                  padding: isMobile ? '0 10px' : '0 14px',
                  borderRadius: '8px',
                  border: '1px solid #282f3d',
                  backgroundColor: '#161922',
                  color: '#d1d5db',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#d1d5db';
                  e.currentTarget.style.borderColor = '#282f3d';
                  e.currentTarget.style.backgroundColor = '#161922';
                }}
              >
                <LogOut size={15} />
                {!isMobile && <span>Sign Out</span>}
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Sliding Announcement & Broadcast Banner */}
      {visibleAnnouncements.length > 0 && currentAnnouncement && (
        <div
          onMouseEnter={() => setIsSlidePaused(true)}
          onMouseLeave={() => setIsSlidePaused(false)}
          style={{
            background: 'rgba(225, 194, 86, 0.18)', // Transparent yellow/gold glass
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(225, 194, 86, 0.35)',
            padding: '10px 20px',
            color: '#f9fafb',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            zIndex: 999,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}
        >
          <style>{`
            @keyframes ksynAnnouncementSlide {
              from {
                opacity: 0;
                transform: translateY(4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            {/* Announcement Badge, Title, Full Message with Transition and NO Truncation */}
            <div
              key={currentAnnouncement.id || safeSlideIndex}
              style={{
                lineHeight: 1.5,
                flex: 1,
                minWidth: 0,
                wordBreak: 'break-word',
                animation: 'ksynAnnouncementSlide 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span style={{
                background: '#e1c256',
                color: '#000000',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginRight: '8px',
                display: 'inline-block',
                verticalAlign: 'baseline'
              }}>
                {currentAnnouncement.type === 'promo' ? 'PROMO' : (currentAnnouncement.severity === 'critical' ? 'URGENT' : 'ANNOUNCEMENT')}
              </span>
              <strong style={{
                color: '#fef08a',
                fontWeight: 800,
                textTransform: 'uppercase',
                marginRight: '6px',
                letterSpacing: '0.02em',
                verticalAlign: 'baseline'
              }}>
                {currentAnnouncement.title}:
              </strong>
              <span style={{
                color: '#f9fafb',
                fontWeight: 500,
                verticalAlign: 'baseline'
              }}>
                {currentAnnouncement.message}
              </span>
              {currentAnnouncement.promo_code && (
                <span style={{
                  background: '#e1c256',
                  border: '1px dashed #000000',
                  color: '#000000',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  marginLeft: '8px',
                  display: 'inline-block',
                  verticalAlign: 'baseline'
                }}>
                  CODE: {currentAnnouncement.promo_code}
                </span>
              )}
            </div>
          </div>

          {/* Controls: Close Button Only (Prev/Next/2 of 2 buttons removed as requested) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => handleDismissAnnouncement(currentAnnouncement)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(225, 194, 86, 0.25)',
                color: '#d1d5db',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(225, 194, 86, 0.25)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(225, 194, 86, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#d1d5db';
                e.currentTarget.style.borderColor = 'rgba(225, 194, 86, 0.25)';
              }}
              title="Dismiss announcement for this session"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {isMobile && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            width: '280px',
            maxWidth: '85vw',
            backgroundColor: '#101216',
            borderRight: '1px solid #1f232b',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            transform: mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: mobileDrawerOpen ? '10px 0 30px rgba(0, 0, 0, 0.8)' : 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #1c201d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src="/ksyn-logo.png"
                  alt="KSYN Gym Logo"
                  style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(225, 194, 86, 0.35))' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff' }}>
                  ROLE <span style={{ color: '#e1c256' }}>WORKSPACE</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="modal-close-circle-btn"
                title="Close drawer"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#94a3b8',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              {navItems.map((item) => {
                const Icon = item.icon || Dumbbell;
                const active = isItemActive(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: active ? 700 : 500,
                      color: active ? '#000000' : '#9ca3af',
                      background: active ? '#e1c256' : 'transparent',
                      textAlign: 'left'
                    }}
                  >
                    <Icon size={16} color={active ? '#000000' : '#9ca3af'} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: active ? '#000000' : '#ef4444',
                        color: active ? '#e1c256' : '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '8px',
                        lineHeight: 1
                      }}>
                        {item.badge}
                      </span>
                    )}
                    {active && <ChevronRight size={13} color="#000000" />}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Drawer Compliance & Security Footer */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#0a0c0b',
            borderRadius: '8px',
            border: '1px solid #1c201d',
            fontSize: '11px',
            color: '#6b7280'
          }}>
            {user?.role === 'super_admin' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7fa36d', fontWeight: 700, marginBottom: '2px' }}>
                  <CheckCircle2 size={13} /> TENANT DATA ISOLATED
                </div>
                <div style={{ lineHeight: 1.4, color: '#9ca3af', fontSize: '10px' }}>
                  PostgreSQL RLS Active
                </div>
              </>
            ) : user?.role === 'member' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7fa36d', fontWeight: 700, marginBottom: '2px' }}>
                  <ShieldCheck size={13} /> SECURE MEMBER CONNECTION
                </div>
                <div style={{ lineHeight: 1.4, color: '#9ca3af', fontSize: '10px' }}>
                  Data Protected &bull; RA 10173 Compliant
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7fa36d', fontWeight: 700, marginBottom: '2px' }}>
                  <ShieldCheck size={13} /> SECURE DATA CONNECTION
                </div>
                <div style={{ lineHeight: 1.4, color: '#9ca3af', fontSize: '10px' }}>
                  RA 10173 & ISO 27001 Guarded
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Body - Flush Left Rail with Generous Workspace Expansion */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        padding: isMobile ? '10px 8px' : '16px 24px 24px 12px',
        display: 'flex',
        gap: isMobile ? '0px' : '16px',
        boxSizing: 'border-box'
      }}>
        {/* Dual-State Auto-Expanding Navigation Rail for ALL Roles */}
        {!isMobile && (
          <EmployeeSidebar
            currentTab={currentView}
            onSelectTab={setCurrentView}
            navItems={navItems}
            isItemActive={isItemActive}
            hasAnnouncement={visibleAnnouncements.length > 0 && Boolean(currentAnnouncement)}
            roleName={
              user?.role === 'super_admin' ? 'Super Admin' :
              user?.role === 'branch_admin' ? 'Branch Admin' :
              user?.role === 'branch_owner' ? 'Branch Owner' :
              user?.role === 'coach' || user?.role === 'trainer' ? 'Coach Rota' :
              user?.role === 'member' ? 'Member Pass' :
              'Role Workspace'
            }
          />
        )}
        {/* Main Dashboard Area */}
        <main
          id="role-workspace-main"
          className="flex-1 min-h-screen transition-all duration-300"
          style={{
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            margin: 0,
            padding: isMobile ? '4px 2px' : '0 4px 16px 4px',
            boxSizing: 'border-box',
            transition: 'all 0.22s ease-in-out'
          }}
        >
          {children || null}
        </main>
      </div>

    </div>
  );
}
