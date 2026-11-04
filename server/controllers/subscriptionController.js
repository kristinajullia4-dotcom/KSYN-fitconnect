const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Subscription Controller
 * Enterprise Recurring Auto-Debit & Contract Subscription Management
 */

// Format readable date
function formatDate(d) {
  if (!d) return 'Next Billing Cycle';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return String(d);
  }
}

/**
 * 1. Toggle Recurring Auto-Debit
 * PATCH /api/subscriptions/toggle-auto-renew
 */
async function toggleAutoRenew(req, res) {
  try {
    const user = req.user;
    const { subscriptionId, autoRenew } = req.body;
    const isTargetEnabled = Boolean(autoRenew);

    const member = (memoryStore.users || []).find(u => u.id === user.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member account not found.' });
    }

    // 1. Membership Status Check
    const memberStatus = (member.status || member.membership_status || 'active').toLowerCase();
    if (memberStatus === 'suspended' || memberStatus === 'cancelled' || memberStatus === 'terminated') {
      return res.status(403).json({
        success: false,
        code: 'MEMBERSHIP_INACTIVE',
        message: 'Only active memberships can modify recurring billing terms.'
      });
    }

    // Locate active subscription
    if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
    let sub = subscriptionId
      ? memoryStore.subscriptions.find(s => s.id === subscriptionId && s.user_id === user.id)
      : memoryStore.subscriptions.find(s => s.user_id === user.id && s.status === 'active');

    if (!sub) {
      sub = memoryStore.subscriptions.find(s => s.user_id === user.id) || null;
    }

    // 2. Fixed-Term Contract Lockout
    if (sub && (sub.contract_type === 'FIXED_TERM_LOCKIN' || sub.plan === '12_months_annual_lockin')) {
      return res.status(403).json({
        success: false,
        code: 'CONTRACT_LOCKED',
        message: 'Fixed-term lock-in contracts require front-desk clearance or formal notice to modify billing terms.'
      });
    }

    // 3. Saved Payment Method Mandate Check when enabling auto-renew
    if (isTargetEnabled) {
      const userPaymentMethods = member.payment_methods || [];
      const hasTokenInUser = userPaymentMethods.some(pm => 
        (pm.gateway_token || pm.masked_identifier || pm.payment_token_id) &&
        pm.type !== 'counter_cash' && pm.type !== 'cash'
      );
      const hasDirectToken = Boolean(member.payment_token_id || member.card_token || member.mandate_id);
      
      // Also check memoryStore payment methods
      const storeMethods = (memoryStore.payment_methods || []).filter(pm => pm.user_id === user.id);
      const hasStoreToken = storeMethods.some(pm => pm.gateway_token || pm.payment_token_id);

      if (!hasTokenInUser && !hasDirectToken && !hasStoreToken) {
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_METHOD_REQUIRED',
          message: 'A valid tokenized payment method (Card or E-Wallet agreement) is required to activate automatic recurring billing.'
        });
      }
    }

    // Update auto_renew status
    member.auto_renew = isTargetEnabled;
    if (sub) {
      sub.auto_renew = isTargetEnabled;
      if (typeof sub.updated_at !== 'undefined') sub.updated_at = new Date().toISOString();
    }

    if (isPostgres()) {
      await query(
        `UPDATE users SET auto_renew = $1, updated_at = NOW() WHERE id = $2`,
        [isTargetEnabled, user.id]
      ).catch(() => {});
      if (sub && sub.id) {
        await query(
          `UPDATE subscriptions SET auto_renew = $1, updated_at = NOW() WHERE id = $2`,
          [isTargetEnabled, sub.id]
        ).catch(() => {});
      }
    }

    if (typeof saveStore === 'function') {
      saveStore();
    }

    await logAuditEvent({
      branch_id: user.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'AUTO_RENEW_TOGGLED',
      resource: 'subscriptions',
      ip_address: req.ip || '127.0.0.1',
      details: {
        subscription_id: sub?.id,
        auto_renew: isTargetEnabled
      }
    });

    const nextBillingDate = sub?.end_date || sub?.next_billing_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    return res.json({
      success: true,
      auto_renew: isTargetEnabled,
      renewal_status: isTargetEnabled ? 'ACTIVE' : 'DISABLED_MANUAL',
      formatted_next_billing_date: formatDate(nextBillingDate),
      formatted_expiration_date: formatDate(nextBillingDate),
      message: isTargetEnabled
        ? 'Auto-debit recurring renewal activated successfully.'
        : 'Auto-debit disabled. Switched to manual renewal mode.',
      subscription: sub ? {
        id: sub.id,
        plan: sub.plan,
        tier: sub.tier,
        status: sub.status,
        auto_renew: isTargetEnabled,
        next_billing_date: nextBillingDate,
        end_date: sub.end_date,
        contract_type: sub.contract_type || 'STANDARD_MONTHLY'
      } : null
    });
  } catch (err) {
    console.error('[toggleAutoRenew error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. Get Current Subscription & Billing Profile
 * GET /api/subscriptions/current
 */
async function getCurrentSubscription(req, res) {
  try {
    const user = req.user;
    const member = (memoryStore.users || []).find(u => u.id === user.id);
    const sub = (memoryStore.subscriptions || []).find(s => s.user_id === user.id && s.status === 'active') ||
      (memoryStore.subscriptions || []).find(s => s.user_id === user.id) || null;

    const nextBillingDate = sub?.end_date || sub?.next_billing_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const isAutoDebit = Boolean(sub?.auto_renew ?? member?.auto_renew ?? true);

    return res.json({
      success: true,
      subscription: sub,
      auto_renew: isAutoDebit,
      renewal_status: isAutoDebit ? 'ACTIVE' : 'DISABLED_MANUAL',
      formatted_next_billing_date: formatDate(nextBillingDate),
      formatted_expiration_date: formatDate(nextBillingDate),
      payment_methods: member?.payment_methods || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  toggleAutoRenew,
  getCurrentSubscription
};
