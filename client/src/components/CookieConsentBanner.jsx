import React, { useState, useEffect } from 'react';
import { Cookie, Shield, Check, X, Settings } from 'lucide-react';

export default function CookieConsentBanner({ onOpenPrivacyPolicy }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const savedConsent = localStorage.getItem('ksyn_cookie_consent');
    if (!savedConsent) {
      // Delay slightly for smooth render
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('ksyn_cookie_consent', JSON.stringify({
      necessary: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
    setShowSettingsModal(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem('ksyn_cookie_consent', JSON.stringify({
      necessary: true,
      functional: true,
      analytics: false,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
    setShowSettingsModal(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem('ksyn_cookie_consent', JSON.stringify({
      necessary: true,
      functional: true,
      analytics: analyticsEnabled,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
    setShowSettingsModal(false);
  };

  if (!isVisible && !showSettingsModal) return null;

  return (
    <>
      {/* Floating Banner */}
      {isVisible && (
        <aside
          role="region"
          aria-label="Cookie and Local Storage Consent"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            maxWidth: '920px',
            margin: '0 auto',
            zIndex: 9999,
            backgroundColor: '#12141a',
            border: '1px solid rgba(225, 194, 86, 0.3)',
            borderRadius: '14px',
            padding: '18px 24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 20px rgba(225, 194, 86, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 340px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(225, 194, 86, 0.15)',
              color: '#e1c256',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Cookie size={20} />
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                Your Privacy & Storage Preferences
              </h4>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>
                KSYN FitConnect uses strictly necessary local storage to authenticate multi-tenant sessions, deliver encrypted turnstile QR passes, and ensure tenant data isolation under RA 10173. We do not sell data or deploy intrusive third-party ad trackers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              style={{
                background: 'transparent',
                border: '1px solid #333333',
                color: '#d1d5db',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Settings size={14} /> Customize
            </button>
            <button
              type="button"
              onClick={handleEssentialOnly}
              style={{
                background: '#1f232b',
                border: '1px solid #2e3542',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              style={{
                background: '#e1c256',
                border: 'none',
                color: '#000000',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(225, 194, 86, 0.3)'
              }}
            >
              Accept All
            </button>
          </div>
        </aside>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-settings-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10002,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettingsModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#121212',
              border: '1px solid #262626',
              borderRadius: '16px',
              maxWidth: '36rem',
              width: '100%',
              padding: '24px',
              color: '#e5e7eb',
              boxShadow: '0 25px 50px rgba(0,0,0,0.9)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={20} color="#e1c256" />
                <h3 id="cookie-settings-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#e1c256' }}>
                  Cookie & Storage Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
                aria-label="Close Cookie settings"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.78rem', lineHeight: 1.5 }}>
              {/* Category 1: Strictly Necessary */}
              <div style={{ background: '#181818', border: '1px solid #262626', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>Strictly Necessary Storage (Always Active)</span>
                  <span style={{ fontSize: '0.7rem', color: '#7fa36d', fontWeight: 700, textTransform: 'uppercase' }}>Required</span>
                </div>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.74rem' }}>
                  Essential for authenticating member/staff login sessions (`ksyn_token`), multi-tenant data isolation, CSRF protection, and generating dynamic 60-second turnstile gate access tokens. Cannot be disabled.
                </p>
              </div>

              {/* Category 2: Functional & UI Preferences */}
              <div style={{ background: '#181818', border: '1px solid #262626', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>Functional & Accessibility Preferences</span>
                  <span style={{ fontSize: '0.7rem', color: '#7fa36d', fontWeight: 700, textTransform: 'uppercase' }}>Always Active</span>
                </div>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.74rem' }}>
                  Remembers your selected branch filter, high-contrast dark theme, and navigation states across browser refreshes.
                </p>
              </div>

              {/* Category 3: Privacy-Preserving Telemetry */}
              <div style={{ background: '#181818', border: '1px solid #262626', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>Privacy-First Performance Telemetry</span>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                      style={{ accentColor: '#e1c256', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.74rem' }}>
                  Anonymous, zero-PII performance metrics to monitor turnstile scanner speeds and API health. Never shared with third parties.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #222' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  if (onOpenPrivacyPolicy) onOpenPrivacyPolicy();
                }}
                style={{ background: 'none', border: 'none', color: '#e1c256', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Read Full Privacy Policy &rarr;
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  style={{ background: '#1f232b', border: '1px solid #333', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Essential Only
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  style={{ background: '#e1c256', border: 'none', color: '#000', padding: '8px 18px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
