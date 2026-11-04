import React, { useEffect } from 'react';
import { X, FileCode, ShieldCheck, Lock, Cpu, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Tooltip from './Tooltip';

export default function EulaModal({ isOpen, onClose, onAccept }) {
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
      aria-labelledby="eula-modal-title"
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
          maxWidth: '44rem',
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
              <FileCode size={20} />
            </div>
            <div>
              <h3
                id="eula-modal-title"
                style={{
                  color: '#e1c256',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '0.01em',
                  margin: 0
                }}
              >
                KSYN End User License Agreement (EULA)
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>
                Enterprise Software Platform & Kiosk Hardware Terms of Use &bull; RA 8293 & RA 10175 Compliant
              </p>
            </div>
          </div>
          <Tooltip content="Close (Esc)" position="bottom">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-circle-btn"
              title="Close EULA dialog (Esc)"
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
              aria-label="Close EULA dialog"
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
          {/* Section 1 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Grant of Limited, Non-Exclusive License
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              The student development team and Capstone Engineering Research Group (&quot;Licensors&quot;), creators and exclusive software owners, hereby grant to KSYN Fitness Inc., its corporate management, franchisees, front-desk staff, personal trainers/coaches, and registered gym members (&quot;Licensee&quot;) a personal, non-exclusive, non-transferable, and revocable enterprise license to access and interact with the KSYN FitConnect Platform. This includes the Member Digital Pass Portal, Front-Desk POS Cashier Module, Floor Duty Rota, Optical Scanner Kiosk Terminal, and Branch Administration Management Consoles strictly in accordance with this Agreement and the Licensee&apos;s authenticated role credentials.
            </p>
          </div>

          {/* Section 2 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Lock size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Intellectual Property & Proprietary Algorithms (RA 8293)
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              All software source code, user interfaces, dynamic optical QR token generation (HMAC-SHA256 60-second rotating cryptographic passes), PostgreSQL Row-Level Security (RLS) multi-tenant models, hardware turnstile solenoid relay drivers, automated BIR CAS invoicing engines, and systems architecture are the exclusive intellectual property of the student development team (&quot;Licensors&quot;) protected under the <strong>Intellectual Property Code of the Philippines (Republic Act No. 8293)</strong>, international copyright treaties, and trade secret laws. KSYN Fitness Inc. retains rights only to its commercial trademarks, brand assets, and customer operational records.
            </p>
          </div>

          {/* Section 3 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Technical Restrictions & Anti-Tampering Rules
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              Licensee expressly covenants and agrees NOT to:
            </p>
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Decompile, reverse-engineer, disassemble, decrypt, or attempt to derive underlying source code or algorithms of the KSYN FitConnect client or backend API.</li>
              <li>Replay, forge, screenshot-forward, or mirror dynamic cryptographic QR passes to circumvent turnstile access control or anti-passback cooldown barriers.</li>
              <li>Perform automated scraping, penetration fuzzing, Denial-of-Service attacks, or bypass multi-tenant branch data isolation (RLS).</li>
              <li>Clone, duplicate, or alter physical RFID keycard UIDs registered within the KSYN access control registry.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Cpu size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Terminal Hardware & Turnstile Solenoid Relays
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              The software interfaces with local turnstile solenoid hardware relays, barcode scanners, and biometric peripherals via WebSocket bridge connections. Licensee shall not tamper with, rewire, or bridge physical relay circuits to trigger unauthorized barrier unlock pulses. The software logs all solenoid triggers, manual overrides, and credential scans in immutable audit ledgers.
            </p>
          </div>

          {/* Section 5 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Scale size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                5. Academic Capstone Disclaimer & Limitation of Liability
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              The KSYN FitConnect software suite was designed and implemented by the student engineering development group as an Academic Capstone Project and deployed for commercial operations, field evaluation, and enterprise demonstration. The software is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. To the maximum extent permitted under Philippine law, the Licensors disclaim all warranties, express or implied. Under no circumstances shall the Licensors or developers be liable for incidental, indirect, or consequential damages resulting from internet service disruptions, peripheral scanner disconnection, or third-party digital payment gateway delays (such as Xendit webhook settlement timing).
            </p>
          </div>

          {/* Section 6 */}
          <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle2 size={16} color="#e1c256" />
              <h4 style={{ color: '#e1c256', fontWeight: 800, fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                6. Termination & Governing Law
              </h4>
            </div>
            <p style={{ margin: 0 }}>
              This license is effective until terminated. Your rights under this license terminate automatically without notice if you fail to comply with any of its terms. Upon termination, you must cease all access to the software. This Agreement shall be governed by and construed in accordance with the laws of the Republic of the Philippines, including the <strong>Intellectual Property Code (RA 8293)</strong>, <strong>Cybercrime Prevention Act of 2012 (RA 10175)</strong>, and the <strong>Data Privacy Act of 2012 (RA 10173)</strong>, with exclusive venue in the courts of Makati City / Metro Manila.
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
            onClick={onAccept || onClose}
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
            I Accept the EULA
          </button>
        </div>
      </div>
    </div>
  );
}
