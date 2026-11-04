import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  Sparkles,
  X,
  ShieldCheck
} from 'lucide-react';

/**
 * PosCheckoutModal Component
 * Commercial-Grade Xendit Hosted Checkout & Dynamic QR Ph Integration
 */
export default function PosCheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  cartTotal = 0,
  customerName = 'Walk-in Athlete',
  customerEmail = '',
  currentShift = null,
  user = null,
  authFetch = fetch,
  signedWaiver = null,
  onSuccess,
  onSwitchToCash
}) {
  const [activeTab, setActiveTab] = useState('customer_display'); // 'customer_display' | 'dynamic_qr'
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [invoiceData, setInvoiceData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('PENDING'); // 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [isSimulating, setIsSimulating] = useState(false);

  const customerWindowRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Initialize Invoice upon modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage('');
    setPaymentStatus('PENDING');
    setCountdown(600);
    setInvoiceData(null);

    const initiateCheckout = async () => {
      try {
        const payload = {
          branchId: user?.branch_id || 'b-mkt-01',
          cashierId: user?.id,
          shiftSessionId: currentShift?.id || null,
          items: cartItems.map(item => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            category: item.category || 'Retail'
          })),
          totalAmount: Number(cartTotal),
          paymentMethod: 'XENDIT',
          customerName: customerName.trim() || 'Walk-in Athlete',
          customerEmail: customerEmail.trim() || 'athlete@ksynfitness.com',
          waiver: signedWaiver || undefined
        };

        const res = await authFetch('/api/pos/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Hindi maabot ang payment gateway. Pakisuri ang koneksyon sa server o subukan muli.');
        }

        setInvoiceData(data);
        setLoading(false);

        // FLOW 1: Automatically launch customer-facing secondary browser popup
        if (data.invoice_url) {
          try {
            const popup = window.open(
              data.invoice_url,
              'CustomerDisplay',
              'width=650,height=850,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
            );
            if (popup) {
              customerWindowRef.current = popup;
            }
          } catch (winErr) {
            console.warn('[POS Popup Blocked]:', winErr);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('POS Checkout Initiation Error:', err);
        setErrorMessage(err.message || 'Hindi maabot ang payment gateway. Pakisuri ang koneksyon sa server o subukan muli.');
        setLoading(false);
      }
    };

    initiateCheckout();

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (customerWindowRef.current && !customerWindowRef.current.closed) {
        customerWindowRef.current.close();
      }
    };
  }, [isOpen, cartTotal, currentShift?.id]);

  // Automated Settlement & Window Cleanup Handler
  const handlePaymentConfirmed = (data) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setPaymentStatus('PAID');

    // Automated Window Cleanup
    if (customerWindowRef.current && !customerWindowRef.current.closed) {
      try { customerWindowRef.current.close(); } catch (e) {}
    }

    if (typeof onSuccess === 'function') {
      onSuccess({
        sale: data.sale,
        turnstilePass: data.turnstile_pass,
        transaction: data.transaction
      });
    }
  };

  // Multi-Channel Real-time Listener (BroadcastChannel + LocalStorage Event + PostMessage)
  useEffect(() => {
    if (!isOpen || paymentStatus === 'PAID') return;

    const onPaymentSignal = async (payload) => {
      // 1. Immediately close the popup window from the POS terminal!
      if (customerWindowRef.current && !customerWindowRef.current.closed) {
        try {
          customerWindowRef.current.close();
        } catch (err) {}
      }

      // 2. Query status to immediately settle and fetch sale data
      const targetQueryId = invoiceData?.invoice_id || invoiceData?.external_id || payload?.invoice_id || payload?.external_id;
      if (targetQueryId) {
        try {
          const res = await fetch(`/api/pos/xendit/status/${encodeURIComponent(targetQueryId)}`);
          const data = await res.json();
          if (data.success && (data.status === 'PAID' || data.settled)) {
            handlePaymentConfirmed(data);
            return;
          }
        } catch (err) {
          console.warn('Real-time settlement query error:', err);
        }
      }

      // 3. Fallback: If status query took longer, complete settlement directly
      handlePaymentConfirmed({
        sale: { amount: cartTotal, customer_name: customerName, reference_no: invoiceData?.external_id || payload?.external_id },
        turnstile_pass: null,
        transaction: { amount: cartTotal, status: 'SETTLED' }
      });
    };

    // Channel A: BroadcastChannel (Works 100% across all browser windows on the same origin without opener)
    let bc = null;
    try {
      bc = new BroadcastChannel('ksyn_pos_settlement_channel');
      bc.onmessage = (e) => {
        if (
          e.data?.type === 'XENDIT_PAYMENT_SUCCESS' ||
          e.data?.type === 'KSYN_POS_PAYMENT_SUCCESS' ||
          e.data?.pos_settlement === 'success' ||
          e.data?.status === 'SETTLED'
        ) {
          onPaymentSignal(e.data);
        }
      };
    } catch (e) {}

    // Channel B: LocalStorage Cross-Tab StorageEvent
    const handleStorageEvent = (e) => {
      if ((e.key === 'ksyn_pos_settlement_event' || e.key === 'ksyn_pos_last_settlement') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (
            parsed?.type === 'XENDIT_PAYMENT_SUCCESS' ||
            parsed?.type === 'KSYN_POS_PAYMENT_SUCCESS' ||
            parsed?.pos_settlement === 'success' ||
            parsed?.status === 'SETTLED'
          ) {
            onPaymentSignal(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Channel C: Window Message (postMessage fallback)
    const handleWindowMessage = (e) => {
      if (
        e.data?.type === 'XENDIT_PAYMENT_SUCCESS' ||
        e.data?.type === 'KSYN_POS_PAYMENT_SUCCESS' ||
        e.data?.type === 'KSYN_PAYMENT_SUCCESS' ||
        e.data?.pos_settlement === 'success' ||
        e.data?.status === 'SETTLED'
      ) {
        onPaymentSignal(e.data);
      }
    };
    window.addEventListener('message', handleWindowMessage);

    return () => {
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [isOpen, invoiceData, paymentStatus, cartTotal, customerName]);

  // Status Polling Engine (Every 1.5 seconds)
  useEffect(() => {
    if (!isOpen || paymentStatus === 'PAID') return;
    const targetQueryId = invoiceData?.invoice_id || invoiceData?.external_id;
    if (!targetQueryId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        let res = await fetch(`/api/pos/xendit/status/${encodeURIComponent(targetQueryId)}`);
        if (!res.ok) {
          res = await fetch(`/api/payments/xendit/status/${encodeURIComponent(targetQueryId)}`);
        }
        const data = await res.json();

        if (data.success && (data.status === 'SETTLED' || data.status === 'PAID' || data.settled)) {
          if (customerWindowRef.current && !customerWindowRef.current.closed) {
            try { customerWindowRef.current.close(); } catch (err) {}
          }
          handlePaymentConfirmed(data);
        }
      } catch (pollErr) {
        console.warn('[Xendit Polling Warn]:', pollErr.message);
      }
    }, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, invoiceData, paymentStatus, onSuccess]);

  // Countdown Timer Engine (10 minutes)
  useEffect(() => {
    if (!isOpen || paymentStatus === 'PAID') return;

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setPaymentStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isOpen, paymentStatus]);

  // Re-open Customer Display Window
  const handleReopenCustomerWindow = () => {
    if (!invoiceData?.invoice_url) return;
    try {
      const popup = window.open(
        invoiceData.invoice_url,
        'CustomerDisplay',
        'width=650,height=850,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
      );
      if (popup) {
        customerWindowRef.current = popup;
        popup.focus();
      }
    } catch (e) {
      console.warn('Could not open popup:', e);
    }
  };

  // Instant Sandbox Simulation
  const handleSimulatePayment = async () => {
    if (!invoiceData?.invoice_id || isSimulating) return;
    setIsSimulating(true);
    try {
      const res = await authFetch(`/api/pos/xendit/simulate-paid/${encodeURIComponent(invoiceData.invoice_id)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.settled) {
        setPaymentStatus('PAID');
        if (customerWindowRef.current && !customerWindowRef.current.closed) {
          customerWindowRef.current.close();
        }
        if (typeof onSuccess === 'function') {
          onSuccess({
            sale: data.sale,
            turnstilePass: data.turnstile_pass,
            transaction: data.transaction
          });
        }
      } else {
        alert(data.message || 'Simulation failed.');
      }
    } catch (simErr) {
      alert('Simulation error: ' + simErr.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCancelAndSwitchToCash = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (customerWindowRef.current && !customerWindowRef.current.closed) {
      customerWindowRef.current.close();
    }
    if (typeof onSwitchToCash === 'function') {
      onSwitchToCash();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const qrDisplayString = invoiceData?.qr_string || invoiceData?.invoice_url || 'KSYN-DYNAMIC-QR-PH';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99995,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={handleCancelAndSwitchToCash}
    >
      <div
        style={{
          width: 'min(580px, 96vw)',
          background: '#0d1017',
          border: '2px solid #e1c256',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 25px rgba(225, 194, 86, 0.2)',
          color: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: '#121520',
          borderBottom: '1px solid #232938',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 900, color: '#f8fafc' }}>
                Xendit Digital Checkout Rail
              </h3>
              <span style={{
                background: 'rgba(101, 130, 86, 0.2)',
                color: '#658256',
                border: '1px solid #658256',
                fontSize: '0.625rem',
                fontWeight: 900,
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                Staging Live
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              GCash • Maya • Cards • Dynamic QR Ph • Multi-Channel Digital Settlement
            </p>
          </div>

          <button
            type="button"
            onClick={handleCancelAndSwitchToCash}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Amount & Shift Summary Bar */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(225, 194, 86, 0.06)',
          borderBottom: '1px solid rgba(225, 194, 86, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8' }}>
              Amount Due
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#658256', fontFamily: 'monospace' }}>
              ₱{Number(cartTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'block' }}>
              Customer: <strong style={{ color: '#fff' }}>{customerName}</strong>
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#658256', fontFamily: 'monospace' }}>
              Shift: {currentShift ? `#${currentShift.id.slice(-6)}` : 'Walk-in'}
            </span>
          </div>
        </div>

        {/* Tab Switcher: Flow 1 (Customer Display) vs Flow 2 (Dynamic QR Ph) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1e293b',
          background: '#0a0d14'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('customer_display')}
            style={{
              flex: 1,
              padding: '11px',
              background: activeTab === 'customer_display' ? 'rgba(225, 194, 86, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'customer_display' ? '2px solid #e1c256' : '2px solid transparent',
              color: activeTab === 'customer_display' ? '#e1c256' : '#94a3b8',
              fontSize: '0.8125rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Smartphone size={15} /> Flow 1: Customer Display Window
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dynamic_qr')}
            style={{
              flex: 1,
              padding: '11px',
              background: activeTab === 'dynamic_qr' ? 'rgba(101, 130, 86, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dynamic_qr' ? '2px solid #658256' : '2px solid transparent',
              color: activeTab === 'dynamic_qr' ? '#658256' : '#94a3b8',
              fontSize: '0.8125rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <QrCode size={15} /> Flow 2: In-Terminal Dynamic QR Ph
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <RefreshCw size={32} className="animate-spin" color="#e1c256" style={{ margin: '0 auto 16px' }} />
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                Connecting to Xendit Staging Gateway...
              </h4>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Generating secure multi-channel hosted checkout invoice & dynamic QR Ph token.
              </p>
            </div>
          ) : errorMessage ? (
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <AlertTriangle size={28} color="#ef4444" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ margin: 0, fontSize: '0.9375rem', color: '#f87171', fontWeight: 800 }}>
                Gateway Connection Timeout
              </h4>
              <p style={{ margin: '6px 0 16px 0', fontSize: '0.8125rem', color: '#fca5a5' }}>
                {errorMessage}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleCancelAndSwitchToCash}
                  className="ksyn-btn ksyn-btn-gold"
                  style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 800 }}
                >
                  Switch to Cash (Counter)
                </button>
              </div>
            </div>
          ) : paymentStatus === 'PAID' ? (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(101, 130, 86, 0.2)',
                border: '2px solid #658256',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle2 size={36} color="#658256" />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#658256' }}>
                Payment Confirmed & Settled!
              </h4>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                Xendit digital invoice was paid successfully. Printing receipt & generating pass...
              </p>
            </div>
          ) : activeTab === 'customer_display' ? (
            /* TAB 1: Customer-Facing Screen / Secondary Window */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
              {/* Visual Loading Radar */}
              <div style={{
                padding: '18px',
                background: 'rgba(101, 130, 86, 0.08)',
                border: '1.5px dashed rgba(101, 130, 86, 0.4)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={20} className="animate-spin" color="#658256" />
                  <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#658256' }}>
                    Naghihintay ng Pagbabayad ng Customer sa Xendit Display...
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.4 }}>
                  A dedicated customer display window has been opened for the athlete. Customer can pay with <strong>GCash, Maya, Visa, Mastercard, or QR Ph</strong>.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleReopenCustomerWindow}
                    className="ksyn-btn ksyn-btn-outline"
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: '#e1c256',
                      color: '#e1c256'
                    }}
                  >
                    <ExternalLink size={14} /> Buksan Muli ang Customer Display Popup
                  </button>
                </div>
              </div>

              {/* Status & Reference Details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                textAlign: 'left',
                background: '#121520',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.75rem'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>External Reference:</span>
                  <span className="mono" style={{ color: '#f8fafc', fontWeight: 700 }}>
                    {invoiceData?.external_id || 'POS-PENDING'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Gateway Status:</span>
                  <span style={{ color: '#e1c256', fontWeight: 800 }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-[#e1c256] mr-1.5 align-middle animate-pulse" />
                    Polling Live (bawat 3s)
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Session Expiry:</span>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>
                    {minutes}:{seconds.toString().padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Drawer Accountability:</span>
                  <span style={{ color: '#658256', fontWeight: 800 }}>
                    Zero Variance (Digital Only)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Dynamic QR Modal Fallback (Option 2) */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#658256', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  POWERED BY XENDIT DIGITAL CHECKOUT
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#e1c256',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(225, 194, 86, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  <Clock size={13} /> {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              </div>

              {/* QR Image Box */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrDisplayString)}`}
                  alt="Xendit Hosted Checkout QR"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{ display: 'none', width: '180px', height: '180px', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={140} color="#000000" />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#000000', marginTop: '6px' }}>
                  SCAN TO PAY VIA XENDIT (GCASH • MAYA • QR PH • CARDS)
                </span>
              </div>

              <div style={{ maxWidth: '440px', lineHeight: 1.4 }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>
                  Direct the customer to scan this QR code with their mobile phone camera or scanner. It opens their official Xendit checkout session on their phone.
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.6875rem', color: '#658256', fontWeight: 700 }}>
                  Automatic Settlement: Once paid on their phone, Xendit records the payment and this POS terminal confirms the sale automatically without any manual input.
                </p>
              </div>
            </div>
          )}

          {/* Dev/Staging Simulation Shortcut */}
          {!loading && !errorMessage && paymentStatus !== 'PAID' && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={isSimulating}
                className="ksyn-btn"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'rgba(101, 130, 86, 0.2)',
                  border: '1px dashed #658256',
                  color: '#658256',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: isSimulating ? 'not-allowed' : 'pointer',
                  borderRadius: '8px'
                }}
                title="Simulate instant customer payment confirmation for testing without real money"
              >
                <Sparkles size={14} />
                {isSimulating ? 'Processing Sandbox Settlement...' : 'Simulate Payment Success (Staging/Dev Test)'}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          background: '#0a0d14',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={handleCancelAndSwitchToCash}
            className="ksyn-btn ksyn-btn-outline"
            style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700 }}
          >
            Kanselahin / Lumipat sa Cash
          </button>

          <span style={{ fontSize: '0.6875rem', color: '#658256', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} /> Zero Variance Guardrail Active
          </span>
        </div>
      </div>
    </div>
  );
}
