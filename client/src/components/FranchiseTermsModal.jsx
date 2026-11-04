import React, { useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import Tooltip from './Tooltip';

export default function FranchiseTermsModal({ isOpen, onClose, onAccept }) {
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
      aria-labelledby="franchise-terms-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
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
          maxWidth: '40rem',
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
              id="franchise-terms-title"
              style={{
                color: '#e1c256',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '0.02em',
                margin: 0
              }}
            >
              KSYN Franchise Partnership Agreement & Terms
            </h3>
          </div>
          <Tooltip content="Close (Esc)" position="bottom">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-circle-btn"
              title="Close Franchise Terms dialog (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#94a3b8',
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
              aria-label="Close Franchise Terms dialog"
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Content Body */}
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
          <p>
            By submitting this application, the prospective franchisee confirms that all financial declarations, capital allocation statements, and personal background representations provided are truthful, accurate, and submitted in good faith. All proprietary franchise manuals, equipment schedules, architectural build-out plans, and software models disclosed by KSYN Fitness Inc. remain protected intellectual property.
          </p>
          <p>
            Submission of preferred commercial hubs or target municipalities does not constitute a territorial reservation or grant exclusive commercial rights until site inspection, corporate vetting, formal licensing contract signing, and initial franchise fee remittances are finalized.
          </p>
          <p>
            Upon approval, operators agree to standard KSYN enterprise governance, including remitting the mandatory 7.5% monthly gross corporate royalty and upholding rigorous equipment maintenance standards. Branch operators must maintain administrative governance strictly within their provisioned branch tenant environment while honoring the network-wide member roaming agreement.
          </p>
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '12px', fontSize: '0.72rem', color: '#9ca3af' }}>
            <strong>Financial Disclaimer:</strong> Historical revenue figures, capital outlay ranges, and projected returns discussed during discovery calls are illustrative and do not constitute a financial guarantee of profitability. Success depends on location foot traffic, operational management, and local market factors.
          </div>
        </div>

        {/* Footer */}
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
            I Acknowledge & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
