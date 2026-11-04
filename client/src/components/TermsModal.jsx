import React, { useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import Tooltip from './Tooltip';

export default function TermsModal({ isOpen, onClose, onAccept }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10001,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#121212',
          border: '1px solid #262626',
          borderRadius: '16px',
          maxWidth: '42rem',
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
          color: '#e5e7eb',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#161616'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(225, 194, 86, 0.15)',
              color: '#e1c256',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={18} />
            </div>
            <h3
              id="terms-modal-title"
              style={{
                color: '#e1c256',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '0.02em',
                margin: 0
              }}
            >
              KSYN Terms of Gym Service & Liability Waiver
            </h3>
          </div>
          <Tooltip content="Close (Esc)" position="bottom">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-circle-btn"
              title="Close Terms dialog (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                minWidth: '36px',
                minHeight: '36px',
                borderRadius: '50%',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              aria-label="Close Terms dialog"
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontSize: '0.78rem',
            lineHeight: 1.65,
            color: '#d1d5db'
          }}
        >
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '14px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Facility Usage & Code of Conduct
            </h4>
            <p style={{ margin: 0 }}>
              All members must present their dynamic optical QR pass or authorized proximity RFID keycard at turnstiles before entering the training floor. Proper athletic attire and clean closed-toe footwear are strictly mandatory. All barbells, dumbbells, and calibrated plates must be re-racked after use. Intimidation, harassment, or unsafe equipment handling will result in immediate privilege revocation.
            </p>
          </div>

          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '14px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2. Age & Health Verification
            </h4>
            <p style={{ margin: 0 }}>
              Members must be at least 18 years of age, or 16 years of age with signed legal guardian consent. Members declare they are in sound cardiovascular and muscular health, have answered the PAR-Q truthfully, and acknowledge that high-intensity exercise carries inherent physical risk.
            </p>
          </div>

          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '14px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Cross-Branch Guest Policy & Anti-Passback Rules
            </h4>
            <p style={{ margin: 0 }}>
              Members are registered to a home branch. Visits to other KSYN clubs are permitted up to four (4) complimentary sessions per calendar month. A standard ₱350 roaming surcharge is assessed per visit starting on the 5th outside visit within the same calendar month. <strong>Card or pass sharing is strictly prohibited.</strong> Any attempt to pass credentials back to another individual triggers an automated turnstile anti-passback violation and account suspension.
            </p>
          </div>

          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '14px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              4. Physical Liability Waiver & Assumption of Risk
            </h4>
            <p style={{ margin: 0 }}>
              The member voluntarily assumes full responsibility for any physical injuries, equipment accidents, or personal property loss sustained within any KSYN facility. The member hereby releases and holds harmless KSYN Fitness Inc., its directors, coaches, and staff from any civil claims or liabilities arising from self-directed training or class participation.
            </p>
          </div>

          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '14px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.8125rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              5. Governing Law & Jurisdiction
            </h4>
            <p style={{ margin: 0 }}>
              These Terms of Gym Service and all related membership agreements shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any legal disputes arising hereunder shall be submitted exclusively to the proper courts of Makati City, Metro Manila.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: '#0e0e0e'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#9ca3af',
              background: 'transparent',
              border: '1px solid #262626',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              padding: '10px 22px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#000000',
              background: '#e1c256',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(225, 194, 86, 0.3)'
            }}
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
}
