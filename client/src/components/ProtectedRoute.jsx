import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Unauthorized from '../views/Unauthorized';

export default function ProtectedRoute({ allowedRoles = [], onNavigate, children }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      if (window.location.pathname !== '/login') {
        if (onNavigate) {
          onNavigate('/login');
        } else {
          window.history.replaceState(null, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    }
  }, [user, loading, onNavigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
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
            VERIFYING RBAC CLEARANCE...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Unauthenticated user: show dark loader while redirecting rather than null or crashing
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
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
            REDIRECTING TO SECURE LOGIN...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Unauthorized role: render styled 403 page with safe optional chaining on user?.role
  if (allowedRoles.length > 0) {
    const roleAliases = {
      'branch_owner': ['branch_admin', 'branch_owner'],
      'branch_admin': ['branch_admin', 'branch_owner'],
      'staff': ['employee', 'staff'],
      'employee': ['employee', 'staff']
    };
    const effectiveRoles = roleAliases[user?.role] || [user?.role];
    const isAllowed = allowedRoles.some(r => effectiveRoles.includes(r));
    if (!isAllowed) {
      return <Unauthorized onNavigate={onNavigate} />;
    }
  }

  return children;
}
