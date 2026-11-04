import React from 'react';
import { ChevronLeft } from 'lucide-react';
import MemberOnboardingWizard from '../components/MemberOnboardingWizard';

export default function Register({ onNavigateLogin, onNavigateHome }) {
  const navigateToLogin = () => {
    if (onNavigateLogin) {
      onNavigateLogin();
    } else {
      window.history.pushState(null, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const navigateToHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleOnboardingComplete = () => {
    // If authenticated session token exists, direct immediately to member portal
    if (localStorage.getItem('ksyn_token')) {
      window.history.pushState(null, '', '/portal');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      navigateToLogin();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #181614 0%, #0a0a0a 80%)',
      color: '#e5e7eb',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '36px 16px 64px 16px'
    }}>
      {/* Top Header Navigation */}
      <div style={{
        maxWidth: '920px',
        margin: '0 auto 28px auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={navigateToHome}
          className="ksyn-btn ksyn-btn-outline"
          style={{ padding: '8px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ChevronLeft size={16} /> Back to Public Landing
        </button>

        <button
          onClick={navigateToLogin}
          style={{
            background: 'none',
            border: 'none',
            color: '#e1c256',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Already a Member? Sign In &rarr;
        </button>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>
        {/* Top Branding Bar */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            background: '#e1c256',
            color: '#000000',
            borderRadius: '12px',
            fontWeight: 900,
            fontSize: '1.75rem',
            marginBottom: '14px',
            boxShadow: '0 0 30px rgba(225, 194, 86, 0.4)'
          }}>
            K
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#ffffff', marginBottom: '8px' }}>
            Join <span style={{ color: '#e1c256' }}>KSYN Fitness</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', maxWidth: '580px', margin: '0 auto' }}>
            Choose your home branch, select your pass privileges, and complete digital onboarding for instant turnstile access.
          </p>
        </div>

        {/* Unified 5-Step Member Onboarding Flow */}
        <div style={{
          background: '#0b0d14',
          borderRadius: '16px',
          border: '1px solid rgba(225, 194, 86, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden'
        }}>
          <MemberOnboardingWizard
            isModal={false}
            isOpen={true}
            onComplete={handleOnboardingComplete}
          />
        </div>

        {/* Bottom Helper Bar */}
        <div style={{ textAlign: 'center', marginTop: '28px', fontSize: '0.875rem', color: '#9ca3af' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={navigateToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#e1c256',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.875rem'
            }}
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
}
