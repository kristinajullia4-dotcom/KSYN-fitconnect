import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, AlertTriangle, ShieldCheck, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SubscriptionBillingCard({
  subscription,
  user,
  paymentMethods = [],
  onUpdateSubscription,
  onOpenSetupModal
}) {
  const { authFetch } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Derive active subscription attributes
  const isOneDayPass = subscription?.plan === '1_day' || user?.membership_plan === '1_day';
  const isPaymentPending = subscription?.status === 'pending_payment' || subscription?.status === 'unpaid';
  const isFixedTermLockin = subscription?.contract_type === 'FIXED_TERM_LOCKIN' ||
    subscription?.plan === '12_months_annual_lockin' ||
    user?.membership_plan === '12_months_annual_lockin';

  // Resolve Saved Payment Method Token
  const safePaymentMethods = Array.isArray(paymentMethods) ? paymentMethods.filter(Boolean) : [];
  const defaultMethod = safePaymentMethods.find(m => m && m.is_default) || safePaymentMethods[0] || null;
  const hasValidPaymentToken = Boolean(
    (defaultMethod && defaultMethod.type !== 'counter_cash' && defaultMethod.type !== 'cash') ||
    user?.payment_token_id ||
    user?.card_token ||
    user?.mandate_id ||
    (user?.payment_methods && user.payment_methods.length > 0) ||
    safePaymentMethods.length > 0
  );

  // Optimistic local toggle state to eliminate UI lag
  const propAutoRenew = Boolean(subscription?.auto_renew ?? user?.auto_renew ?? true);
  const [localAutoRenew, setLocalAutoRenew] = useState(propAutoRenew);

  useEffect(() => {
    if (subscription?.auto_renew !== undefined) {
      setLocalAutoRenew(Boolean(subscription.auto_renew));
    } else if (user?.auto_renew !== undefined) {
      setLocalAutoRenew(Boolean(user.auto_renew));
    }
  }, [subscription?.auto_renew, user?.auto_renew]);

  // Formatting Payment Method Brand & Identifier
  const paymentBrand = defaultMethod?.brand_or_provider || (defaultMethod?.type === 'credit_card' ? 'Visa' : 'GCash');
  const maskedIdentifier = defaultMethod?.masked_identifier || '•••• 4242';

  // Dates
  const nextBillingDate = subscription?.end_date
    ? new Date(subscription.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upcoming Expiration Date';

  // Polarity: Auto-Debit is Active only if enabled and not fixed-term/pending
  const isAutoDebitActive = Boolean(
    !isOneDayPass &&
    !isPaymentPending &&
    localAutoRenew
  );

  // Toggle Action Handler
  const handleToggleClick = () => {
    if (isFixedTermLockin || loading) return;

    if (isAutoDebitActive) {
      // Disabling requires confirmation dialog
      setShowConfirmModal(true);
    } else {
      // Enabling requires saved token mandate check
      if (!hasValidPaymentToken) {
        if (typeof onOpenSetupModal === 'function') {
          onOpenSetupModal();
        } else {
          toast.warning('A tokenized payment method (Card or E-Wallet) is required to activate auto-debit.', 'Payment Method Required');
        }
        return;
      }
      executeToggle(true);
    }
  };

  const executeToggle = async (enable) => {
    setLoading(true);
    // Instant optimistic toggle animation
    setLocalAutoRenew(enable);
    setShowConfirmModal(false);

    try {
      const fetchFn = typeof authFetch === 'function' ? authFetch : fetch;
      const token = localStorage.getItem('ksyn_token') || localStorage.getItem('token');
      const res = await fetchFn('/api/subscriptions/toggle-auto-renew', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          subscriptionId: subscription?.id,
          autoRenew: enable
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (enable) {
          toast.success('Auto-debit recurring renewal enabled.', 'Billing Updated');
        } else {
          toast.info('Auto-debit disabled. Switched to Manual Renewal mode.', 'Manual Renewal Active');
        }
        if (typeof onUpdateSubscription === 'function') {
          onUpdateSubscription(enable);
        }
      } else {
        // Revert optimistic state on failure
        setLocalAutoRenew(!enable);
        if (data.code === 'PAYMENT_METHOD_REQUIRED') {
          toast.error(data.message || 'Payment method required for auto-debit.', 'Token Required');
          if (typeof onOpenSetupModal === 'function') onOpenSetupModal();
        } else {
          toast.error(data.message || 'Failed to update auto-debit setting.', 'Error');
        }
      }
    } catch (err) {
      setLocalAutoRenew(!enable);
      toast.error(err.message, 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{
        background: '#161616',
        border: '1px solid #282828',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left Side: Header & Dynamic Helper Subtext */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 800,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CreditCard size={17} color={isAutoDebitActive ? '#34d399' : '#e1c256'} />
            <span>Auto-Debit & Recurring Billing</span>
            {isFixedTermLockin && (
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Lock size={11} /> Locked by Contract Agreement
              </span>
            )}
          </div>

          {/* Dynamic Helper Subtext */}
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', lineHeight: 1.4 }}>
            {isOneDayPass ? (
              'Single 24-hour drop-in pass. Recurring auto-debit does not apply.'
            ) : isPaymentPending ? (
              'Settle pending invoice dues to activate turnstile access and recurring billing rails.'
            ) : isFixedTermLockin ? (
              'Fixed-term lock-in contracts require front-desk clearance or formal notice to modify billing terms.'
            ) : isAutoDebitActive ? (
              `Your subscription will automatically renew on ${nextBillingDate} via your saved payment method (${paymentBrand} ${maskedIdentifier}).`
            ) : (
              `Manual renewal is active. Your access will expire on ${nextBillingDate} unless manually renewed. An invoice notification will be sent prior to expiration.`
            )}
          </div>
        </div>

        {/* Right Side: Toggle Switch & Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isOneDayPass ? (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
              NON-RECURRING
            </span>
          ) : isPaymentPending ? (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>
              PENDING SETTLEMENT
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Toggle Label */}
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: isAutoDebitActive ? '#34d399' : '#9ca3af'
              }}>
                {isAutoDebitActive ? 'Auto-Debit: ACTIVE' : 'Auto-Debit: DISABLED (Manual Renewal)'}
              </span>

              {/* Polarity-Aligned Switch Button */}
              <button
                type="button"
                role="switch"
                aria-checked={isAutoDebitActive}
                disabled={loading || isFixedTermLockin}
                onClick={handleToggleClick}
                title={isFixedTermLockin ? 'Locked by Contract Agreement' : (isAutoDebitActive ? 'Disable auto-debit' : 'Enable auto-debit')}
                style={{
                  position: 'relative',
                  width: '54px',
                  height: '28px',
                  borderRadius: '14px',
                  border: isFixedTermLockin ? '1px solid #4b5563' : (isAutoDebitActive ? '1px solid #10b981' : '1px solid #4b5563'),
                  background: isFixedTermLockin ? '#1f2937' : (isAutoDebitActive ? '#065f46' : '#262626'),
                  cursor: isFixedTermLockin || loading ? 'not-allowed' : 'pointer',
                  padding: 0,
                  transition: 'background 0.25s ease, border-color 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: isAutoDebitActive ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
                  opacity: isFixedTermLockin ? 0.6 : 1
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: isAutoDebitActive ? '#34d399' : '#9ca3af',
                    transform: isAutoDebitActive ? 'translateX(28px)' : 'translateX(3px)',
                    transition: 'transform 0.25s ease, background 0.25s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                  }}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog on Disabling Auto-Debit */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#12151e',
            border: '1px solid #282f3f',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171'
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Disable Recurring Auto-Debit?
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to disable automatic renewal? You will need to manually pay your dues before <strong style={{ color: '#ffffff' }}>{nextBillingDate}</strong> to prevent turnstile access interruption.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="ksyn-btn ksyn-btn-outline"
                style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 700, borderRadius: '8px' }}
              >
                Keep Auto-Debit
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => executeToggle(false)}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Disabling...' : 'Confirm Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
