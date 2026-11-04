import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Landing from './views/Landing';
import Login from './views/Login';
import Unauthorized from './views/Unauthorized';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Register from './views/Register';
import PaymentBridge from './pages/PaymentBridge';
import ErrorBoundary from './components/ErrorBoundary';

// Role-Based Code Splitting via Dynamic Imports (Vite / React.lazy)
const SuperAdminDashboard = React.lazy(() => import('./views/SuperAdminDashboard'));
const BranchAdminDashboard = React.lazy(() => import('./views/BranchAdminDashboard'));
const EmployeeKiosk = React.lazy(() => import('./views/EmployeeKiosk'));
const MemberPortal = React.lazy(() => import('./views/MemberPortal'));
const CoachDashboard = React.lazy(() => import('./views/CoachDashboard'));
const InvestorDashboard = React.lazy(() => import('./views/InvestorDashboard'));

const DashboardLoadingFallback = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '16px',
    color: '#e1c256'
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      border: '3px solid rgba(225, 194, 86, 0.2)',
      borderTopColor: '#e1c256',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
      LOADING ROLE WORKSPACE...
    </span>
  </div>
);

export default function App() {
  const { user, setUser, token: authToken, setToken, loading } = useAuth();

  // Helper for role default main dashboard (Requirement 2)
  const getDefaultMainDashboardForRole = (role) => {
    const r = role?.toLowerCase()?.replace('-', '_');
    switch (r) {
      case 'super_admin':
      case 'superadmin':
        return 'overview';
      case 'branch_admin':
      case 'branchadmin':
      case 'branch_owner':
      case 'coach':
      case 'trainer':
        return 'overview';
      case 'employee':
      case 'staff':
        return 'turnstile';
      case 'member':
        return 'pass';
      default:
        return 'overview';
    }
  };

  // Requirement 3: Restore last page path on reload
  const [currentPath, setCurrentPath] = useState(() => {
    const rawPath = window.location.pathname;
    if (rawPath === '/portal' || rawPath.startsWith('/portal')) return '/dashboard/member';
    if (window.location.search.includes('payment_status')) return '/dashboard/member';
    if (rawPath && rawPath !== '/') return rawPath;
    try {
      const storedUser = JSON.parse(localStorage.getItem('ksyn_user') || 'null');
      const lastPath = localStorage.getItem('ksyn_last_path');
      if (storedUser && lastPath && lastPath.startsWith('/dashboard')) {
        return lastPath;
      }
    } catch {}
    return rawPath || '/';
  });

  // Cross-Window payment handler: If this window is a checkout child popup/tab, notify opener/POS terminal and close
  const [isPopupSettledReturn, setIsPopupSettledReturn] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const isPosSuccess = params.get('pos_settlement') === 'success' || params.get('pos_settlement') === 'paid';
    return isPosSuccess;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pStatus = params.get('payment_status') || params.get('status') || (params.get('pos_settlement') === 'success' ? 'success' : null);
    const isPosSuccess = params.get('pos_settlement') === 'success' || params.get('pos_settlement') === 'paid';
    const extId = params.get('ext_id') || params.get('external_id');
    const invoiceId = params.get('invoice_id');
    const planTier = params.get('plan_tier');

    if (isPosSuccess) {
      setIsPopupSettledReturn(true);

      // 1. Cross-Window Communication via BroadcastChannel (Works 100% across all tabs/windows of same origin even when opener is severed)
      try {
        const bc = new BroadcastChannel('ksyn_pos_settlement_channel');
        bc.postMessage({
          type: 'KSYN_POS_PAYMENT_SUCCESS',
          pos_settlement: 'success',
          external_id: extId,
          invoice_id: invoiceId
        });
        bc.close();
      } catch (bcErr) {}

      // 2. Cross-Window Communication via localStorage StorageEvent
      try {
        localStorage.setItem('ksyn_pos_settlement_event', JSON.stringify({
          type: 'KSYN_POS_PAYMENT_SUCCESS',
          pos_settlement: 'success',
          external_id: extId,
          invoice_id: invoiceId,
          timestamp: Date.now()
        }));
      } catch (lsErr) {}

      // 3. Fallback: window.opener postMessage (if window.opener is preserved)
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'KSYN_POS_PAYMENT_SUCCESS',
            pos_settlement: 'success',
            external_id: extId,
            invoice_id: invoiceId
          }, '*');
          window.opener.focus();
        } catch (e) {}
      }

      // 4. Also directly trigger server settlement lookup to ensure backend record is SETTLED
      const targetQueryId = extId || invoiceId;
      if (targetQueryId) {
        fetch(`/api/pos/xendit/status/${encodeURIComponent(targetQueryId)}`).catch(() => {});
      }

      // 5. Automated window closure attempts (Immediate + staggered)
      const tryClose = () => {
        try { window.close(); } catch (e) {}
      };
      tryClose();
      const t1 = setTimeout(tryClose, 200);
      const t2 = setTimeout(tryClose, 600);
      const t3 = setTimeout(tryClose, 1200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (pStatus === 'success' || pStatus === 'paid') {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'KSYN_PAYMENT_SUCCESS',
            external_id: extId,
            plan_tier: planTier
          }, '*');
          window.opener.focus();
        } catch (e) {}
        setIsPopupSettledReturn(true);
        setTimeout(() => {
          try { window.close(); } catch (e) {}
        }, 300);
      }
    }
  }, []);

  // Safety Recovery: If returned with payment success but session state is pending hydration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pStatus = params.get('payment_status') || params.get('status');
    const extId = params.get('external_id');
    const planTier = params.get('plan_tier');

    if (pStatus === 'success' || pStatus === 'paid') {
      // 1. Pending onboarding recovery (New athlete sign up)
      const pendingStr = localStorage.getItem('ksyn_pending_onboarding');
      if (pendingStr && !user) {
        try {
          const pending = JSON.parse(pendingStr);
          fetch('/api/payments/onboard-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...pending,
              paymentOption: 'online_xendit'
            })
          })
            .then(res => res.json())
            .then(data => {
              if (data && data.success && data.token) {
                localStorage.setItem('ksyn_token', data.token);
                if (data.refreshToken) {
                  localStorage.setItem('ksyn_refresh_token', data.refreshToken);
                }
                const mem = {
                  ...(data.member || {}),
                  subscription: data.subscription,
                  turnstile_pass: data.turnstile_pass || data.turnstile_access?.initial_dynamic_qr_pass,
                  planTier: pending.planTier || '1_month',
                  role: 'member'
                };
                localStorage.setItem('ksyn_user', JSON.stringify(mem));
                localStorage.removeItem('ksyn_pending_onboarding');
                if (typeof setToken === 'function') setToken(data.token);
                if (typeof setUser === 'function') setUser(mem);
                navigate('/dashboard/member');
              }
            })
            .catch(err => console.error('Failed to auto-settle pending onboarding:', err));
        } catch (e) {}
      }

      // 2. Pending extension / renewal recovery (Existing member)
      const pendingCheckoutStr = localStorage.getItem('ksyn_pending_checkout');
      if (pendingCheckoutStr) {
        try {
          const pendingCheckout = JSON.parse(pendingCheckoutStr);
          const cachedUser = JSON.parse(localStorage.getItem('ksyn_user') || 'null');
          const effectiveUserId = pendingCheckout.userId || user?.id || cachedUser?.id;

          fetch('/api/payments/xendit/confirm-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('ksyn_token') ? { Authorization: `Bearer ${localStorage.getItem('ksyn_token')}` } : {})
            },
            body: JSON.stringify({
              external_id: extId || pendingCheckout.externalId,
              planTier: planTier || pendingCheckout.planTier,
              userId: effectiveUserId,
              amount: pendingCheckout.amount
            })
          })
            .then(res => res.json())
            .then(data => {
              if (data && data.success) {
                if (data.token) {
                  localStorage.setItem('ksyn_token', data.token);
                  if (typeof setToken === 'function') setToken(data.token);
                }
                if (data.refreshToken) {
                  localStorage.setItem('ksyn_refresh_token', data.refreshToken);
                }
                const updatedUser = {
                  ...(cachedUser || {}),
                  ...(data.user || {}),
                  subscription: data.subscription,
                  membership_plan: data.subscription?.plan || data.user?.membership_plan || pendingCheckout.planTier,
                  membership_status: data.subscription?.status || 'active',
                  role: 'member'
                };
                localStorage.setItem('ksyn_user', JSON.stringify(updatedUser));
                localStorage.removeItem('ksyn_pending_checkout');
                if (typeof setUser === 'function') setUser(updatedUser);
                navigate('/dashboard/member');
              }
            })
            .catch(err => console.error('Failed to auto-settle pending checkout:', err));
        } catch (e) {}
      }
    }
  }, [user]);

  // Requirement 3: Restore last page subtab/view on reload
  const [currentView, setCurrentView] = useState(() => {
    try {
      // 1. Check URL query params first: ?tab=xxx
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) return urlTab;

      // 2. Check session storage (for in-session reloads)
      const sessionView = sessionStorage.getItem('ksyn_last_active_view');
      if (sessionView) return sessionView;

      // 3. Check role-specific saved view
      const storedUser = JSON.parse(localStorage.getItem('ksyn_user') || 'null');
      const role = storedUser?.role;
      if (role) {
        const savedView = localStorage.getItem(`ksyn_active_view_${role}`) || (role === 'member' ? localStorage.getItem('ksyn_member_subtab') : null);
        if (savedView) return savedView;
        return getDefaultMainDashboardForRole(role);
      }
    } catch {}
    return 'overview';
  });

  const handleSetView = (view) => {
    setCurrentView(view);
    if (user?.role) {
      localStorage.setItem(`ksyn_active_view_${user.role}`, view);
    }
    if (user?.role === 'member' || !user?.role) {
      localStorage.setItem('ksyn_member_subtab', view);
    }
    sessionStorage.setItem('ksyn_last_active_view', view);

    // Keep URL parameter in sync so F5 reload stays on exact tab
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', view);
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {}
  };

  // Client-side navigation helper with tab preservation
  const navigate = (newPath, tabOverride = null) => {
    let finalUrl = newPath;
    if (tabOverride) {
      finalUrl = `${newPath}?tab=${tabOverride}`;
    } else {
      const params = new URLSearchParams(window.location.search);
      const existingTab = params.get('tab');
      if (existingTab && newPath.startsWith('/dashboard')) {
        finalUrl = `${newPath}?tab=${existingTab}`;
      }
    }
    if (window.location.pathname + window.location.search !== finalUrl) {
      window.history.pushState(null, '', finalUrl);
    }
    setCurrentPath(newPath);
    localStorage.setItem('ksyn_last_path', newPath);
  };

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) {
        setCurrentView(urlTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Universal Accessible Tooltip Enhancer for all clickable buttons across the system
  useEffect(() => {
    const handleMouseOver = (e) => {
      const btn = e.target.closest('button, a[role="button"], [role="button"]');
      if (btn && !btn.getAttribute('title')) {
        const text = btn.getAttribute('aria-label') ||
                     btn.getAttribute('data-tooltip') ||
                     btn.innerText?.trim();
        if (text && text.length < 90) {
          btn.setAttribute('title', text);
        }
      }
    };
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, []);

  // Helper for authorized dashboard path
  const getRoleDashboardPath = (role) => {
    switch (role) {
      case 'super_admin':
        return '/dashboard/super-admin';
      case 'branch_admin':
        return '/dashboard/branch-admin';
      case 'branch_owner':
        return '/dashboard/investor';
      case 'coach':
      case 'trainer':
        return '/dashboard/coach';
      case 'employee':
      case 'staff':
        return '/dashboard/employee';
      case 'member':
        return '/dashboard/member';
      default:
        return '/login';
    }
  };

  // Role initialization: preserve URL tab or session view, otherwise set role default
  useEffect(() => {
    if (user?.role) {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) {
        setCurrentView(urlTab);
        return;
      }

      const sessionView = sessionStorage.getItem('ksyn_last_active_view');
      if (sessionView) {
        setCurrentView(sessionView);
        return;
      }

      const defaultMain = getDefaultMainDashboardForRole(user.role);
      setCurrentView(defaultMain);
    }
  }, [user?.role]);

  // Dedicated High-Contrast Xendit Payment Settlement Bridge (Zero Blank / Black Screen)
  if (currentPath === '/payment-bridge' || isPopupSettledReturn) {
    return <PaymentBridge />;
  }

  // Loading Screen
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e1c256'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(225, 194, 86, 0.2)',
            borderTopColor: '#e1c256',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }} />
          <p style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
            STARTING KSYN FITCONNECT...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Route /front-desk (Ensure it redirects to POS tab instead of landing page)
  if (currentPath === '/front-desk') {
    if (!isPopupSettledReturn) {
      navigate('/dashboard/employee?tab=pos');
      return null;
    }
  }

  // 1. Public Landing Page: Route '/'
  if (currentPath === '/' || currentPath === '') {
    return (
      <Landing
        onNavigateLogin={() => {
          if (user) {
            navigate(getRoleDashboardPath(user.role));
          } else {
            navigate('/login');
          }
        }}
        onNavigateRegister={() => {
          if (user) {
            navigate(getRoleDashboardPath(user.role));
          } else {
            navigate('/register');
          }
        }}
      />
    );
  }

  // 2. Dedicated Registration Page: Route '/register'
  if (currentPath === '/register') {
    if (user) {
      const target = getRoleDashboardPath(user.role);
      navigate(target);
      return null;
    }

    return (
      <Register
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 3. Dedicated Login Page: Route '/login'
  if (currentPath === '/login') {
    // If authenticated, automatically redirect to user's authorized role dashboard
    if (user) {
      const target = getRoleDashboardPath(user.role);
      navigate(target);
      return null;
    }

    const handleLoginSuccess = (loggedInUser, targetPath) => {
      // Requirement 2: ALWAYS open the main dashboard of that role first!
      const defaultMain = getDefaultMainDashboardForRole(loggedInUser.role);
      setCurrentView(defaultMain);
      if (loggedInUser.role) {
        localStorage.setItem(`ksyn_active_view_${loggedInUser.role}`, defaultMain);
      }
      sessionStorage.setItem('ksyn_last_active_view', defaultMain);

      const dest = targetPath || getRoleDashboardPath(loggedInUser.role);
      localStorage.setItem('ksyn_last_path', dest);

      window.history.pushState(null, '', `${dest}?tab=${defaultMain}`);
      setCurrentPath(dest);
    };

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={() => navigate('/')}
        onNavigateRegister={() => navigate('/register')}
      />
    );
  }

  // 4. HTTP 403 Unauthorized Route: '/unauthorized'
  if (currentPath === '/unauthorized') {
    return <Unauthorized onNavigate={navigate} />;
  }

  // 5. Protected Routes: Unauthenticated Guard
  if (loading) {
    return <DashboardLoadingFallback />;
  }

  if (!user) {
    // 1. Attempt cached user hydration from localStorage
    try {
      const storedStr = localStorage.getItem('ksyn_user');
      if (storedStr) {
        const cached = JSON.parse(storedStr);
        if (cached && cached.id && (cached.role || cached.email)) {
          setUser(cached);
          return <DashboardLoadingFallback />;
        }
      }
    } catch (e) {}

    // 2. Allow fallback only if actively returning from payment checkout URL
    const isPaymentReturnUrl = window.location.search.includes('payment_status') || window.location.search.includes('status=paid');
    if (isPaymentReturnUrl) {
      return <DashboardLoadingFallback />;
    }

    // 3. Unauthenticated access: Clean stale checkout flags & redirect to /login
    localStorage.removeItem('ksyn_pending_checkout');
    navigate('/login');
    return <Login onLoginSuccess={(u, t) => {
      const defaultMain = getDefaultMainDashboardForRole(u.role);
      setCurrentView(defaultMain);
      if (u.role) {
        localStorage.setItem(`ksyn_active_view_${u.role}`, defaultMain);
      }
      sessionStorage.setItem('ksyn_last_active_view', defaultMain);
      const dest = t || getRoleDashboardPath(u.role);
      localStorage.setItem('ksyn_last_path', dest);
      window.history.pushState(null, '', `${dest}?tab=${defaultMain}`);
      setCurrentPath(dest);
    }} onNavigateHome={() => navigate('/')} />;
  }

  // 5. Strict RBAC Dashboard Routes
  if (currentPath === '/dashboard/super-admin') {
    return (
      <ProtectedRoute allowedRoles={['super_admin']} onNavigate={navigate}>
        <Layout currentView={currentView} setCurrentView={handleSetView}>
          <ErrorBoundary>
            <React.Suspense fallback={<DashboardLoadingFallback />}>
              <SuperAdminDashboard
                activeSection={currentView}
                setActiveSection={handleSetView}
                activeTab={currentView}
                onTabChange={handleSetView}
              />
            </React.Suspense>
          </ErrorBoundary>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (currentPath === '/dashboard/branch-admin' || currentPath === '/dashboard/investor') {
    return (
      <ProtectedRoute allowedRoles={['branch_admin', 'branch_owner']} onNavigate={navigate}>
        <Layout currentView={currentView} setCurrentView={handleSetView}>
          <ErrorBoundary>
            <React.Suspense fallback={<DashboardLoadingFallback />}>
              {user?.role === 'branch_owner' ? (
                <InvestorDashboard
                  activeSection={currentView}
                  setActiveSection={handleSetView}
                  activeTab={currentView}
                  onTabChange={handleSetView}
                />
              ) : (
                <BranchAdminDashboard
                  activeSection={currentView}
                  setActiveSection={handleSetView}
                  activeTab={currentView}
                  onTabChange={handleSetView}
                />
              )}
            </React.Suspense>
          </ErrorBoundary>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (currentPath === '/dashboard/coach') {
    return (
      <ProtectedRoute allowedRoles={['coach', 'trainer']} onNavigate={navigate}>
        <Layout currentView={currentView} setCurrentView={handleSetView}>
          <ErrorBoundary>
            <React.Suspense fallback={<DashboardLoadingFallback />}>
              <CoachDashboard
                activeSection={currentView}
                setActiveSection={handleSetView}
                activeTab={currentView}
                onTabChange={handleSetView}
              />
            </React.Suspense>
          </ErrorBoundary>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (currentPath === '/dashboard/employee') {
    return (
      <ProtectedRoute allowedRoles={['employee', 'staff']} onNavigate={navigate}>
        <Layout currentView={currentView} setCurrentView={handleSetView}>
          <ErrorBoundary>
            <React.Suspense fallback={<DashboardLoadingFallback />}>
              <EmployeeKiosk
                activeSection={currentView}
                setActiveSection={handleSetView}
                activeTab={currentView}
                onTabChange={handleSetView}
              />
            </React.Suspense>
          </ErrorBoundary>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (currentPath === '/dashboard/member' || currentPath === '/portal' || currentPath.startsWith('/portal')) {
    return (
      <ProtectedRoute allowedRoles={['member', 'guest']} onNavigate={navigate}>
        <Layout currentView={currentView} setCurrentView={handleSetView}>
          <ErrorBoundary>
            <React.Suspense fallback={<DashboardLoadingFallback />}>
              <MemberPortal
                activeSection={currentView}
                setActiveSection={handleSetView}
                activeTab={currentView}
                onTabChange={handleSetView}
              />
            </React.Suspense>
          </ErrorBoundary>
        </Layout>
      </ProtectedRoute>
    );
  }

  // 6. Fallback Route: If user visits an unrecognized /dashboard path or other URL
  if (currentPath.startsWith('/dashboard')) {
    return <Unauthorized onNavigate={navigate} />;
  }

  // Default fallback to public landing
  return <Landing onNavigateLogin={() => navigate('/login')} />;
}
