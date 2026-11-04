import React, { useEffect } from 'react';
import { X, Shield, Lock, FileCheck, Eye, Database, AlertCircle } from 'lucide-react';
import Tooltip from './Tooltip';

export default function PrivacyPolicyModal({ isOpen, onClose, onAccept }) {
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
      aria-labelledby="privacy-policy-title"
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
              <Shield size={20} />
            </div>
            <div>
              <h3
                id="privacy-policy-title"
                style={{
                  color: '#e1c256',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '0.01em',
                  margin: 0
                }}
              >
                KSYN Privacy Policy & Data Governance
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>
                Republic Act No. 10173 (Philippine Data Privacy Act of 2012) Compliant
              </p>
            </div>
          </div>
          <Tooltip content="Close (Esc)" position="bottom">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-circle-btn"
              title="Close Privacy Policy dialog (Esc)"
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
              aria-label="Close Privacy Policy dialog"
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
          {/* Section 1: Data Controller */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Personal Information Controller (PIC)
            </h4>
            <p style={{ margin: 0 }}>
              <strong>KSYN Fitness Inc.</strong> (SEC Reg. No. CS2024-08912, BIR TIN: 009-842-192-000) operates as the Personal Information Controller (PIC) under the Philippine Data Privacy Act of 2012 (RA 10173). Our registered headquarters is located at Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St., Makati City, Metro Manila.
            </p>
          </div>

          {/* Section 2: Data Collected */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2. Categories of Personal & Sensitive Information Collected
            </h4>
            <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Identity & Contact Information:</strong> Full legal name, date of birth, mobile number, email address, physical address, and emergency contact details.</li>
              <li><strong>Physical Health & Medical Declarations:</strong> Physical Activity Readiness Questionnaire (PAR-Q) answers, fitness assessments, and emergency medical disclosures required to ensure member safety.</li>
              <li><strong>Facility Access & Hardware Telemetry:</strong> Proximity RFID keycard identifiers (e.g. KS-XXXX-XXXX), dynamic HMAC-SHA256 optical QR turnstile nonces, turnstile entry/exit timestamps, and club security CCTV footage.</li>
              <li><strong>Payment & Financial Records:</strong> Zero-PAN tokenized payment references processed via PCI-DSS Level 1 certified gateways (Xendit Philippines, GCash, Maya, and BDO/BPI rails). KSYN never stores raw credit/debit card numbers or CVVs.</li>
            </ul>
          </div>

          {/* Section 3: Purpose of Processing */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Purpose & Legal Basis of Processing
            </h4>
            <p style={{ margin: 0 }}>
              We collect and process your personal information strictly for: (a) verifying identity and provisioning digital optical/RFID turnstile access; (b) managing active subscriptions and recurring billing; (c) preventing unauthorized pass sharing via cryptographic Anti-Passback (APB) telemetry; (d) administering safety protocols and emergency medical response; and (e) complying with statutory obligations including Bureau of Internal Revenue (BIR) tax withholding certificates (BIR Form 2307).
            </p>
          </div>

          {/* Section 4: Data Retention & Security */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              4. Data Retention & Multi-Tenant Isolation
            </h4>
            <p style={{ margin: 0 }}>
              All member records are secured within tenant-isolated databases enforced by Row-Level Security (RLS) policies and bcrypt password hashing. Financial transaction ledgers are retained for ten (10) years in compliance with BIR Revenue Regulations No. 5-2014. Facility access logs are retained for five (5) years for security audits, after which records are securely purged or irreversibly anonymized.
            </p>
          </div>

          {/* Section 5: Data Subject Rights */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              5. Your Rights as a Data Subject (Section 16, RA 10173)
            </h4>
            <p style={{ margin: '0 0 8px 0' }}>
              Under the Philippine Data Privacy Act of 2012, you are entitled to:
            </p>
            <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>Right to be Informed:</strong> Know how your personal and health data is gathered and utilized.</li>
              <li><strong>Right to Access:</strong> Request reasonable access to your registered profile and attendance history.</li>
              <li><strong>Right to Rectification:</strong> Demand immediate correction of inaccurate or outdated personal data.</li>
              <li><strong>Right to Erasure or Blocking:</strong> Request suspension, withdrawal, or deletion of your personal data upon lawful grounds.</li>
              <li><strong>Right to Damages & Complaint:</strong> Indemnification for damages sustained due to inaccurate or unlawfully obtained data, and the right to file a complaint before the National Privacy Commission (NPC).</li>
            </ul>
          </div>

          {/* Section 6: Data Protection Officer */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.825rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              6. Data Protection Officer (DPO) Contact
            </h4>
            <p style={{ margin: 0 }}>
              For data privacy inquiries, requests to exercise your data subject rights, or privacy concerns, please contact our designated Data Protection Officer:
              <br />
              <strong>Email:</strong> <span style={{ color: '#e1c256' }}>dpo@ksynfitness.com</span>
              <br />
              <strong>Office:</strong> Data Protection Office, KSYN Fitness Inc., Alphaland Makati Place, Makati City, Metro Manila
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
              I Understand & Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
