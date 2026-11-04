import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowRight, LogOut, Home, Lock } from 'lucide-react';

export default function Unauthorized({ onNavigate }) {
  const { user, logout } = useAuth();

  const getAuthorizedDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'super_admin':
        return '/dashboard/super-admin';
      case 'branch_admin':
        return '/dashboard/branch-admin';
      case 'employee':
        return '/dashboard/employee';
      case 'member':
        return '/dashboard/member';
      default:
        return '/login';
    }
  };

  const handleReturnToDashboard = () => {
    const target = getAuthorizedDashboardPath();
    if (onNavigate) {
      onNavigate(target);
    } else {
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleLogout = () => {
    logout();
    if (onNavigate) {
      onNavigate('/login');
    } else {
      window.history.pushState(null, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1c1010 0%, #0a0a0a 80%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: '#f9fafb',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div className="ksyn-card" style={{
        maxWidth: '560px',
        width: '100%',
        padding: '40px 32px',
        textAlign: 'center',
        borderColor: 'rgba(239, 68, 68, 0.4)',
        boxShadow: '0 0 40px rgba(239, 68, 68, 0.15)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto'
        }}>
          <ShieldAlert size={32} color="#ef4444" />
        </div>

        <div style={{
          display: 'inline-block',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          fontSize: '0.75rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          padding: '4px 10px',
          borderRadius: '4px',
          marginBottom: '12px'
        }}>
          HTTP 403 &bull; ACCESS FORBIDDEN
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '12px' }}>
          Insufficient Role Clearance
        </h1>

        <p style={{ color: '#9ca3af', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '24px' }}>
          You attempted to navigate to a protected dashboard route restricted by KSYN Zero-Trust Role-Based Access Control policies.
        </p>

        {user && (
          <div style={{
            background: '#141414',
            border: '1px solid #282828',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '28px',
            textAlign: 'left',
            fontSize: '0.8125rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280' }}>Authenticated User:</span>
              <strong style={{ color: '#ffffff' }}>{user.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280' }}>Current RBAC Role:</span>
              <span className={`badge badge-${user.role}`} style={{ textTransform: 'uppercase' }}>
                <Lock size={10} /> {user.role.replace('_', ' ')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Designated Dashboard:</span>
              <strong style={{ color: '#e1c256', fontFamily: 'monospace' }}>{getAuthorizedDashboardPath()}</strong>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            id="unauthorized-return-btn"
            onClick={handleReturnToDashboard}
            className="ksyn-btn ksyn-btn-gold"
            style={{ width: '100%', padding: '12px', fontWeight: 800 }}
          >
            Back to My Authorized Dashboard <ArrowRight size={16} />
          </button>

          <button
            onClick={handleLogout}
            className="ksyn-btn ksyn-btn-outline"
            style={{ width: '100%', padding: '11px', color: '#ef4444', borderColor: '#333' }}
          >
            <LogOut size={16} /> Switch Account / Logout
          </button>
        </div>
      </div>
    </div>
  );
}
