import React, { useEffect } from 'react';
import { X, RefreshCcw, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import Tooltip from './Tooltip';

export default function RefundPolicyModal({ isOpen, onClose, onAccept }) {
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
      aria-labelledby="refund-policy-title"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(225, 194, 86, 0.15)',
              color: '#e1c256',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RefreshCcw size={20} />
            </div>
            <div>
              <h3
                id="refund-policy-title"
                style={{
                  color: '#e1c256',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '0.01em',
                  margin: 0
                }}
              >
                KSYN Refund & Membership Cancellation Policy
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>
                Republic Act No. 7394 (Consumer Act of the Philippines) Compliant
              </p>
            </div>
          </div>
          <Tooltip content="Close (Esc)" position="bottom">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-circle-btn"
              title="Close Refund Policy dialog (Esc)"
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
              aria-label="Close Refund Policy dialog"
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
          {/* Section 1: Cooling-off Period */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Statutory 7-Day Cooling-Off Period
            </h4>
            <p style={{ margin: 0 }}>
              Under the Consumer Act of the Philippines (RA 7394), newly enrolled members subscribing to 1-Month, 3-Month, or 12-Month tiers are entitled to a full seven (7) calendar day cooling-off period from the date of enrollment, provided the digital QR pass or physical RFID keycard has not been redeemed for turnstile entry. If the pass has been used for entry, the membership is considered activated and fees become non-refundable.
            </p>
          </div>

          {/* Section 2: Recurring Auto-Debit Cancellation */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2. Recurring Auto-Debit Cancellation Procedure
            </h4>
            <p style={{ margin: 0 }}>
              For members enrolled via recurring auto-debit agreements (Credit/Debit Card tokenization, GCash Pre-Approved Agreement, or Maya Auto-Debit), cancellation requests must be submitted at least five (5) business days prior to the next scheduled monthly billing date via the in-app Member Portal or by email to <span style={{ color: '#e1c256' }}>billing@ksynfitness.com</span>. Cancellations received after billing has been processed will take effect on the subsequent billing cycle.
            </p>
          </div>

          {/* Section 3: Medical Freezes & Relocation */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Medical Freezes & Club Transfers
            </h4>
            <p style={{ margin: 0 }}>
              Members who suffer verified medical incapacitation, prolonged illness, or pregnancy may request a complimentary membership freeze of up to three (3) months upon presentation of a signed medical certificate from a licensed physician (MD). Members relocating permanently outside Metro Manila may apply for a pro-rata credit or transfer their remaining membership term to an authorized family member upon management review.
            </p>
          </div>

          {/* Section 4: Non-Refundable Items */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              4. Non-Refundable Items & Services
            </h4>
            <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>1-Day Drop-In Passes:</strong> Single-day passes are non-refundable once issued and confirmed.</li>
              <li><strong>Physical RFID Keycard Replacement Fees:</strong> Lost or damaged card replacement fees (₱350) are non-refundable once encoded.</li>
              <li><strong>Completed Personal Training (PT) Sessions:</strong> Rendered 1-on-1 coaching sessions are non-refundable. Remaining unused sessions within an active PT package may be credited towards a different trainer.</li>
              <li><strong>Retail Nutrition & Apparel:</strong> Supplements, beverages, protein shakes, and branded apparel are non-refundable once unsealed or consumed.</li>
            </ul>
          </div>

          {/* Section 5: Processing Time */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              5. Refund Settlement Timelines
            </h4>
            <p style={{ margin: 0 }}>
              Approved refunds are credited strictly back to the original payment rail used during purchase:
              <br />
              • <strong>GCash / Maya:</strong> 3 to 7 banking days.
              <br />
              • <strong>Credit / Debit Card:</strong> 7 to 14 banking days, subject to the card issuing bank's settlement cycle.
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
          {onAccept && (
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
              I Understand
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
