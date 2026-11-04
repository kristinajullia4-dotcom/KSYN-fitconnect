const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const xenditService = require('../services/xenditService');
const { memoryStore, isPostgres, query, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { resolvePlan } = require('../config/membershipRates');
const { JWT_SECRET } = require('../config/secrets');
const {
  getBranchCode,
  generateExternalId,
  getStreamFromExternalId,
  formatStreamDescription
} = require('../utils/transactionStreams');

const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'ksyn-turnstile-hmac-secret-key-2026';

/**
 * Helper: Generate 60s dynamic optical turnstile QR entry pass
 */
function generateTurnstilePass(user, branch, tier) {
  const passTimestamp = Date.now();
  const passNonce = crypto.randomBytes(8).toString('hex');
  const qrPassPayload = {
    memberId: user.id,
    memberName: user.name,
    branchId: branch?.id || user.branch_id || 'b-mkt-01',
    branchCode: branch?.code || 'MKT-01',
    tier: tier || 'basic',
    subStatus: 'active',
    timestamp: passTimestamp,
    nonce: passNonce
  };
  const payloadBase64 = Buffer.from(JSON.stringify(qrPassPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', QR_HMAC_SECRET).update(payloadBase64).digest('hex');
  return `${payloadBase64}.${signature}`;
}

/**
 * Helper: Settle membership access, provision credentials, and log financial sale
 */
async function settleMembershipAccess({
  userId,
  branchId,
  planId,
  amount,
  paymentRail,
  referenceNo,
  billingDay = 1,
  ipAddress = '127.0.0.1'
}) {
  const resolvedPlan = resolvePlan(planId);
  const targetBranchId = branchId || 'b-mkt-01';
  const effectiveBillingDay = parseInt(billingDay, 10) === 15 ? 15 : 1;
  const isOneDayPass = resolvedPlan.id === '1_day';
  const user = (memoryStore.users || []).find(u => u.id === userId);

  // 0. Idempotency Check: Avoid processing the exact same payment reference twice
  if (referenceNo) {
    if (!memoryStore.sales) memoryStore.sales = [];
    const existingSale = memoryStore.sales.find(s => s.reference_no === referenceNo);
    if (existingSale) {
      console.log(`[XENDIT] Transaction ${referenceNo} already settled. Returning current active subscription.`);
      const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);
      const userSubs = (memoryStore.subscriptions || []).filter(s => s.user_id === userId);
      const activeSub = userSubs.find(s => s.status === 'active') || userSubs[userSubs.length - 1] || null;
      const turnstilePass = generateTurnstilePass(user || { id: userId, name: 'Valued Member' }, branch, activeSub?.tier || resolvedPlan.tier);
      return {
        user,
        subscription: activeSub,
        turnstilePass
      };
    }
  }

  // 1. Update user record in memoryStore
  if (user) {
    user.status = 'active';
    user.membership_plan = resolvedPlan.id;
    user.membership_tier = resolvedPlan.tier;

    // Physical RFID is strictly only for monthly/annual plans (1-day pass uses dynamic digital turnstile QR pass)
    if (!isOneDayPass) {
      if (!user.rfid_card_uid) {
        user.rfid_card_uid = `KS-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    } else {
      user.rfid_card_uid = null;
    }

    // Synchronize class rosters so front desk & coaches immediately see upgraded tier
    if (Array.isArray(memoryStore.classes)) {
      memoryStore.classes.forEach(c => {
        (c.enrolled || []).forEach(e => {
          if (e.user_id === userId || e.id === userId) {
            e.tier = resolvedPlan.name;
          }
        });
      });
    }
  }

  // 2. Update or create subscription in memoryStore with accurate term extension
  if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
  const userSubs = memoryStore.subscriptions.filter(s => s.user_id === userId);
  let sub = userSubs.find(s => s.status === 'active') || (userSubs.length > 0 ? userSubs[userSubs.length - 1] : null);
  userSubs.forEach(s => {
    if (s !== sub) s.status = 'expired';
  });

  const now = Date.now();
  let baseTime = now;
  let isTrueExtension = false;

  // Only extend cumulatively if user currently has an ACTIVE subscription with future expiration
  // on the EXACT SAME plan tier (not a 1-day pass, not an expired pass, and not a plan switch).
  if (sub && sub.status === 'active' && sub.end_date && sub.plan === resolvedPlan.id && !isOneDayPass) {
    const existingEnd = new Date(sub.end_date).getTime();
    if (!isNaN(existingEnd) && existingEnd > now) {
      baseTime = existingEnd;
      isTrueExtension = true;
    }
  }

  const newEndMs = baseTime + (resolvedPlan.durationDays * 24 * 3600 * 1000);
  const startDate = (isTrueExtension && sub?.start_date) ? new Date(sub.start_date) : new Date(now);
  const endDate = new Date(newEndMs);
  const nextBillingDate = new Date(newEndMs).toISOString().split('T')[0];

  const paymentAmount = Number(amount || resolvedPlan.totalDue);

  if (sub) {
    sub.plan = resolvedPlan.id;
    sub.tier = resolvedPlan.tier;
    sub.status = 'active';
    sub.start_date = startDate.toISOString().split('T')[0];
    sub.end_date = endDate.toISOString().split('T')[0];
    sub.price = resolvedPlan.planFee;
    sub.access_fee = resolvedPlan.accessFee;
    sub.annual_fee = resolvedPlan.annualFee;
    sub.total_paid = isTrueExtension ? ((Number(sub.total_paid) || 0) + paymentAmount) : paymentAmount;
    sub.monthly_due_amount = resolvedPlan.planFee;
    sub.billing_day = effectiveBillingDay;
    sub.next_billing_date = nextBillingDate;
    sub.auto_renew = !isOneDayPass;
    sub.auto_debit_retries = 0;
  } else {
    sub = {
      id: crypto.randomUUID(),
      user_id: userId,
      branch_id: targetBranchId,
      plan: resolvedPlan.id,
      tier: resolvedPlan.tier,
      status: 'active',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      price: resolvedPlan.planFee,
      access_fee: resolvedPlan.accessFee,
      annual_fee: resolvedPlan.annualFee,
      total_paid: paymentAmount,
      monthly_due_amount: resolvedPlan.planFee,
      billing_day: effectiveBillingDay,
      next_billing_date: nextBillingDate,
      auto_renew: !isOneDayPass,
      auto_debit_retries: 0
    };
    memoryStore.subscriptions.push(sub);
  }

  // 2B. Segregated membership_subscriptions ledger entry
  if (!memoryStore.membership_subscriptions) memoryStore.membership_subscriptions = [];
  let memSub = memoryStore.membership_subscriptions.find(s => s.user_id === userId || s.member_id === userId);
  if (memSub) {
    memSub.plan_id = resolvedPlan.id;
    memSub.tier = resolvedPlan.tier;
    memSub.status = 'active';
    memSub.billing_status = 'SETTLED';
    memSub.start_date = startDate.toISOString().split('T')[0];
    memSub.end_date = endDate.toISOString().split('T')[0];
    memSub.auto_renew = !isOneDayPass;
    memSub.price = resolvedPlan.planFee;
    memSub.total_paid = isTrueExtension ? ((Number(memSub.total_paid) || 0) + paymentAmount) : paymentAmount;
    if (referenceNo) memSub.xendit_external_id = referenceNo;
  } else {
    memSub = {
      id: crypto.randomUUID(),
      member_id: userId,
      user_id: userId,
      branch_id: targetBranchId,
      plan_id: resolvedPlan.id,
      plan: resolvedPlan.id,
      tier: resolvedPlan.tier,
      status: 'active',
      billing_status: 'SETTLED',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      auto_renew: !isOneDayPass,
      price: resolvedPlan.planFee,
      access_fee: resolvedPlan.accessFee,
      annual_fee: resolvedPlan.annualFee,
      total_paid: paymentAmount,
      monthly_due_amount: resolvedPlan.planFee,
      billing_day: effectiveBillingDay,
      next_billing_date: nextBillingDate,
      auto_debit_retries: 0,
      xendit_external_id: referenceNo || generateExternalId('PLAN', getBranchCode(targetBranchId), resolvedPlan.tier)
    };
    memoryStore.membership_subscriptions.push(memSub);
  }

  if (typeof saveStore === 'function') {
    try { saveStore(); } catch (e) { console.error('Failed to save store in settleMembershipAccess:', e.message); }
  }

  // 3. Record in financial sales ledger
  if (!memoryStore.sales) memoryStore.sales = [];
  const saleRecord = {
    id: crypto.randomUUID(),
    branch_id: targetBranchId,
    user_id: userId,
    amount: Number(amount || resolvedPlan.totalDue),
    category: 'membership_fee',
    payment_method: `xendit_${paymentRail || 'invoice'}`,
    reference_no: referenceNo,
    created_at: new Date()
  };
  memoryStore.sales.unshift(saleRecord);

  // 4. PostgreSQL synchronization if enabled
  if (isPostgres()) {
    try {
      await query(
        `UPDATE users
         SET status = 'active', rfid_card_uid = $1, updated_at = NOW()
         WHERE id = $2`,
        [user?.rfid_card_uid || null, userId]
      );
      await query(
        `UPDATE subscriptions
         SET status = 'active', plan = $1, tier = $2, start_date = $3, end_date = $4, price = $5, total_paid = $6, updated_at = NOW()
         WHERE user_id = $7`,
        [resolvedPlan.id, resolvedPlan.tier, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], resolvedPlan.planFee, sub.total_paid, userId]
      );
      await query(
        `INSERT INTO sales (id, branch_id, user_id, amount, category, payment_method, reference_no, created_at)
         VALUES ($1, $2, $3, $4, 'membership_fee', $5, $6, NOW())`,
        [saleRecord.id, targetBranchId, userId, saleRecord.amount, saleRecord.payment_method, referenceNo]
      );
    } catch (pgErr) {
      console.warn('Non-fatal PostgreSQL sync warning:', pgErr.message);
    }
  }

  // 5. Audit Logging
  await logAuditEvent({
    branch_id: targetBranchId,
    user_id: userId,
    user_role: 'member',
    action: 'XENDIT_MEMBERSHIP_SETTLED',
    resource: 'subscriptions',
    ip_address: ipAddress,
    details: {
      plan: resolvedPlan.name,
      amount: saleRecord.amount,
      rail: paymentRail,
      invoice_no: referenceNo,
      rfid_issued: Boolean(user?.rfid_card_uid)
    }
  });

  const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);
  const turnstilePass = generateTurnstilePass(user || { id: userId, name: 'Valued Member' }, branch, resolvedPlan.tier);

  return {
    user,
    subscription: sub,
    turnstilePass
  };
}

// -------------------------------------------------------------
// 1. GET XENDIT CLIENT CONFIGURATION
// -------------------------------------------------------------
async function getConfig(req, res) {
  res.json({
    success: true,
    gateway: 'Xendit Philippines',
    environment: xenditService.environment,
    public_key: xenditService.publicKey,
    supported_rails: [
      { id: 'card', name: 'Credit / Debit Card (Visa / Mastercard)', type: 'recurring_token' },
      { id: 'gcash', name: 'GCash Philippines', type: 'ewallet' },
      { id: 'maya', name: 'Maya Philippines', type: 'ewallet' },
      { id: 'qr_ph', name: 'QR Ph (National QR Standard)', type: 'dynamic_qr' }
    ]
  });
}

// -------------------------------------------------------------
// 2. CREATE XENDIT INVOICE (Unified Hosted Checkout - Stream 3: PLANS)
// -------------------------------------------------------------
async function createInvoice(req, res) {
  try {
    const {
      planTier,
      planName,
      amount,
      branchId = 'b-mkt-01',
      customerName,
      name,
      email,
      payer_email,
      phone,
      mobile_number,
      userId,
      successRedirectUrl,
      success_redirect_url,
      failureRedirectUrl,
      failure_redirect_url
    } = req.body;

    let targetPlanName = planName;
    let targetAmount = amount;
    let targetPlanId = planTier;
    let targetTier = 'BASIC';

    if (planTier) {
      const resolvedPlan = resolvePlan(planTier);
      if (resolvedPlan) {
        targetPlanId = resolvedPlan.id;
        targetPlanName = targetPlanName || resolvedPlan.name;
        targetAmount = targetAmount || resolvedPlan.totalDue;
        targetTier = resolvedPlan.tier || 'BASIC';
      }
    }

    if (!targetAmount) targetAmount = 500;
    if (!targetPlanName) targetPlanName = 'Membership Pass';

    const branchObj = (memoryStore.branches || []).find(b => b.id === branchId);
    const branchCode = getBranchCode(branchObj?.code || branchId);

    // Enforce Stream 3: PLAN-[BRANCH_CODE]-[PLAN_TIER]-[TIMESTAMP]
    // Example: PLAN-ALB-ELITE-1793171120
    const externalId = generateExternalId('PLAN', branchCode, targetTier);
    const streamDescription = formatStreamDescription('PLAN', { planName: targetPlanName });

    const userEmail = email || payer_email || req.user?.email || 'member@ksynfitness.com';
    const userName = customerName || name || req.user?.name || 'Valued Athlete';
    const userPhone = phone || mobile_number || req.user?.phone || '+639171234567';
    const targetUserId = userId || req.user?.id || req.body?.userId || null;

    const invoice = await xenditService.createInvoice({
      externalId,
      amount: targetAmount,
      payerEmail: userEmail,
      description: streamDescription,
      customerName: userName,
      customerPhone: userPhone,
      successRedirectUrl: successRedirectUrl || success_redirect_url || `${process.env.CORS_ORIGIN || 'http://localhost:5180'}/dashboard/member?payment_status=success`,
      failureRedirectUrl: failureRedirectUrl || failure_redirect_url || `${process.env.CORS_ORIGIN || 'http://localhost:5180'}/dashboard/member?payment_status=failed`,
      metadata: {
        stream: 'PLAN',
        category: 'membership_subscription',
        userId: targetUserId,
        branchId,
        planTier: targetPlanId || '1_month',
        planName: targetPlanName
      }
    });

    // Track invoice in memoryStore
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const invRecord = {
      id: invoice.id,
      invoice_no: externalId,
      user_id: targetUserId,
      branch_id: branchId,
      plan_id: targetPlanId || '1_month',
      amount: invoice.amount || targetAmount,
      payment_rail: 'xendit_invoice',
      status: 'pending',
      invoice_url: invoice.invoice_url,
      gateway_ref: invoice.id,
      created_at: new Date()
    };
    memoryStore.payment_invoices.unshift(invRecord);

    // Save pending subscription in segregated membership_subscriptions table
    if (targetUserId) {
      if (!memoryStore.membership_subscriptions) memoryStore.membership_subscriptions = [];
      const durationDays = targetPlanId === '1_day' ? 1 : (targetPlanId === '3_months' ? 90 : (targetPlanId === '6_months' ? 180 : (targetPlanId === '12_months' ? 365 : 30)));
      const now = new Date();
      const endDate = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);

      memoryStore.membership_subscriptions.unshift({
        id: crypto.randomUUID(),
        member_id: targetUserId,
        user_id: targetUserId,
        branch_id: branchId,
        plan_id: targetPlanId || '1_month',
        plan: targetPlanId || '1_month',
        tier: targetTier,
        start_date: now.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        auto_renew: targetPlanId !== '1_day',
        billing_status: 'AWAITING_PAYMENT',
        status: 'pending_payment',
        price: targetAmount,
        total_paid: 0,
        xendit_external_id: externalId,
        invoice_id: invoice.id,
        created_at: now.toISOString()
      });
    }

    if (typeof saveStore === 'function') saveStore();

    res.json({
      success: true,
      message: 'Xendit unified invoice generated successfully.',
      invoice_id: invoice.id,
      external_id: invoice.external_id,
      invoice_url: invoice.invoice_url,
      amount: invoice.amount,
      expiry_date: invoice.expiry_date
    });
  } catch (err) {
    console.error('[XENDIT] createInvoice error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 2B. SUBSCRIBE MEMBERSHIP PLAN (Stream 3 - POST /api/plans/subscribe)
// -------------------------------------------------------------
async function subscribeMembershipPlan(req, res) {
  try {
    const {
      planTier,
      planId,
      planName,
      amount,
      branchId,
      billingDay = 1,
      auto_renew = true,
      autoRenew,
      successRedirectUrl,
      failureRedirectUrl
    } = req.body;

    const user = req.user;
    const targetUserId = user?.id || req.body.userId || req.body.user_id;

    if (!targetUserId) {
      return res.status(401).json({ success: false, message: 'Authentication or userId required to subscribe to membership plans.' });
    }

    const effectiveAutoRenew = autoRenew !== undefined ? autoRenew : (auto_renew !== false);
    const resolvedPlan = resolvePlan(planTier || planId || '1_month');
    const targetBranchId = branchId || user?.branch_id || 'b-mkt-01';
    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const branchCode = getBranchCode(branch?.code || targetBranchId);

    const targetAmount = amount ? Number(amount) : (resolvedPlan ? resolvedPlan.totalDue : 2500);
    const targetPlanName = planName || resolvedPlan?.name || 'Monthly Membership';
    const targetPlanTier = resolvedPlan?.tier || planTier || 'BASIC';

    // Stream 3: PLAN-[BRANCH_CODE]-[PLAN_TIER]-[TIMESTAMP]
    // Example: PLAN-ALB-ELITE-1793171120
    const externalId = generateExternalId('PLAN', branchCode, targetPlanTier);
    const invoiceDescription = formatStreamDescription('PLAN', { planName: targetPlanName });

    const clientOrigin = req.headers.origin || process.env.CORS_ORIGIN || 'http://localhost:5180';
    const invoice = await xenditService.createInvoice({
      externalId,
      amount: targetAmount,
      payerEmail: user?.email || req.body.email || 'member@ksynfitness.com',
      customerName: user?.name || req.body.name || 'Valued Athlete',
      customerPhone: user?.phone || req.body.phone || '+639171234567',
      description: invoiceDescription,
      successRedirectUrl: successRedirectUrl || `${clientOrigin}/dashboard/member?payment_status=success&stream=plan&external_id=${externalId}`,
      failureRedirectUrl: failureRedirectUrl || `${clientOrigin}/dashboard/member?payment_status=failed&stream=plan`,
      metadata: {
        stream: 'PLAN',
        category: 'membership_subscription',
        userId: targetUserId,
        branchId: targetBranchId,
        planTier: resolvedPlan?.id || targetPlanTier,
        planName: targetPlanName,
        billingDay,
        autoRenew: effectiveAutoRenew
      }
    });

    const now = new Date();
    const durationDays = resolvedPlan?.durationDays || 30;
    const endDate = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);

    const subscriptionRecord = {
      id: crypto.randomUUID(),
      member_id: targetUserId,
      user_id: targetUserId,
      branch_id: targetBranchId,
      plan_id: resolvedPlan?.id || targetPlanTier,
      plan: resolvedPlan?.id || targetPlanTier,
      tier: targetPlanTier,
      start_date: now.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      auto_renew: effectiveAutoRenew,
      billing_status: 'AWAITING_PAYMENT',
      status: 'pending_payment',
      price: resolvedPlan?.planFee || targetAmount,
      access_fee: resolvedPlan?.accessFee || 0,
      annual_fee: resolvedPlan?.annualFee || 0,
      total_paid: 0,
      xendit_external_id: externalId,
      invoice_id: invoice.id,
      created_at: now.toISOString()
    };

    if (!memoryStore.membership_subscriptions) memoryStore.membership_subscriptions = [];
    memoryStore.membership_subscriptions.unshift(subscriptionRecord);

    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    memoryStore.payment_invoices.unshift({
      id: invoice.id,
      invoice_no: externalId,
      user_id: targetUserId,
      branch_id: targetBranchId,
      plan_id: resolvedPlan?.id || targetPlanTier,
      amount: invoice.amount || targetAmount,
      payment_rail: 'xendit_invoice',
      status: 'pending',
      invoice_url: invoice.invoice_url,
      gateway_ref: invoice.id,
      created_at: new Date()
    });

    if (typeof saveStore === 'function') saveStore();

    res.json({
      success: true,
      message: 'Xendit membership subscription invoice generated successfully.',
      invoice_id: invoice.id,
      external_id: externalId,
      invoice_url: invoice.invoice_url,
      amount: invoice.amount,
      subscription: subscriptionRecord
    });
  } catch (err) {
    console.error('[XENDIT] subscribeMembershipPlan error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 3. CREATE DYNAMIC QR PH (1-Day Pass / Shake Bar POS)
// -------------------------------------------------------------
async function createDynamicQr(req, res) {
  try {
    const {
      amount,
      planTier,
      branchId = 'b-mkt-01',
      userId = null,
      description
    } = req.body;

    const targetUserId = userId || req.user?.id || null;
    const resolvedPlan = planTier ? resolvePlan(planTier) : null;
    const finalAmount = resolvedPlan ? resolvedPlan.totalDue : (amount ? Number(amount) : 500);
    const finalPlanId = resolvedPlan ? resolvedPlan.id : (planTier || '1_day');
    const finalDesc = description || (resolvedPlan ? `${resolvedPlan.name} Membership Pass` : '1-Day All-Access Drop-In Pass');

    const externalId = `KSYN-QR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:5080'}/api/payments/xendit/webhook`;

    const qrResult = await xenditService.createDynamicQr({
      externalId,
      amount: finalAmount,
      callbackUrl,
      metadata: {
        userId: targetUserId,
        branchId,
        planTier: finalPlanId,
        description: finalDesc
      }
    });

    // Track QR invoice in memoryStore
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const invRecord = {
      id: qrResult.id,
      invoice_no: externalId,
      user_id: targetUserId,
      branch_id: branchId,
      plan_id: planTier,
      amount: Number(amount),
      payment_rail: 'qr_ph',
      status: 'pending',
      gateway_ref: qrResult.id,
      created_at: new Date()
    };
    memoryStore.payment_invoices.unshift(invRecord);

    res.json({
      success: true,
      message: 'Dynamic QR Ph code generated. Scan with any PH Bank or GCash/Maya.',
      qr_id: qrResult.id,
      external_id: qrResult.external_id,
      qr_string: qrResult.qr_string,
      amount: qrResult.amount,
      status: qrResult.status,
      expires_in_minutes: 15
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 4. CHARGE TOKENIZED CARD (Zero-PAN Token & 3DS Verified)
// -------------------------------------------------------------
async function chargeCard(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required to bind card payment.' });
    }

    const {
      tokenId,
      authenticationId,
      planTier = '12_months',
      billingDay = 1,
      cardholderName,
      maskedPan,
      brand = 'Mastercard',
      issuingBank = 'BDO Unibank',
      cardCvv
    } = req.body;

    if (!tokenId) {
      return res.status(400).json({ success: false, message: 'Xendit card token_id is required.' });
    }

    const resolvedPlan = resolvePlan(planTier);
    const externalId = `KSYN-CARD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Process charge via Xendit
    const chargeResult = await xenditService.chargeCard({
      tokenId,
      authenticationId,
      externalId,
      amount: resolvedPlan.totalDue,
      cardCvv,
      isRecurring: resolvedPlan.id !== '1_day'
    });

    if (chargeResult.status !== 'CAPTURED') {
      return res.status(402).json({
        success: false,
        error: 'CARD_CHARGE_FAILED',
        message: 'Credit/Debit card charge was not approved by issuing bank.'
      });
    }

    // Save tokenized payment method for recurring auto-debit
    const paymentMethodId = `pm-${crypto.randomUUID().slice(0, 8)}`;
    const effectiveBillingDay = parseInt(billingDay, 10) === 15 ? 15 : 1;

    const pmRecord = {
      id: paymentMethodId,
      user_id: userId,
      branch_id: req.user?.branch_id || 'b-mkt-01',
      type: 'card',
      gateway_token: tokenId,
      masked_identifier: maskedPan || chargeResult.masked_card_number || '•••• •••• •••• 4242',
      brand_or_provider: brand || chargeResult.card_brand || 'Mastercard',
      issuing_bank: issuingBank,
      cardholder_name: cardholderName || req.user?.name,
      billing_day: effectiveBillingDay,
      is_default: true,
      status: 'active',
      created_at: new Date()
    };

    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
    memoryStore.payment_methods.forEach(pm => {
      if (pm.user_id === userId) pm.is_default = false;
    });
    memoryStore.payment_methods.push(pmRecord);

    // Settle membership dues and unlock turnstile
    const settlement = await settleMembershipAccess({
      userId,
      branchId: req.user?.branch_id || 'b-mkt-01',
      planId: resolvedPlan.id,
      amount: resolvedPlan.totalDue,
      paymentRail: 'card',
      referenceNo: externalId,
      billingDay: effectiveBillingDay,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      message: `Card charged ₱${resolvedPlan.totalDue.toLocaleString()} via Xendit! Auto-debit tokenized for the ${effectiveBillingDay === 15 ? '15th' : '1st'} of each month.`,
      charge_id: chargeResult.id,
      user: settlement.user,
      subscription: settlement.subscription,
      turnstile_pass: settlement.turnstilePass
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 5. TRANSACTION STREAM SETTLEMENT HANDLERS
// -------------------------------------------------------------

/**
 * Stream 1 Settlement Handler: Front Desk POS Counter Sales
 * Mark pos_transactions record as SETTLED; do NOT touch drawer cash.
 */
async function handlePosPaymentSettlement(externalId, payload) {
  if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];
  let posTxn = memoryStore.pos_transactions.find(t => 
    t.external_id === externalId || 
    t.xendit_external_id === externalId || 
    t.invoice_id === payload.id
  );

  if (posTxn) {
    const { settleTransactionRecord } = require('./posCheckoutController');
    await settleTransactionRecord({ posTxn, xenditData: payload });
    return posTxn;
  }

  // Fallback POS transaction if not pre-created
  const branchId = payload.metadata?.branchId || 'b-mkt-01';
  const amount = Number(payload.amount || payload.paid_amount || 0);

  const fallbackPosTxn = {
    id: `pos-${Date.now()}`,
    external_id: externalId,
    xendit_external_id: externalId,
    invoice_id: payload.id,
    branch_id: branchId,
    payment_method: 'XENDIT',
    amount: amount,
    subtotal: Number((amount / 1.12).toFixed(2)),
    tax_amount: Number((amount - (amount / 1.12)).toFixed(2)),
    status: 'SETTLED',
    customer_name: payload.customer?.given_names || 'Front Desk Customer',
    items: payload.items || [{ name: 'POS Counter Merch', quantity: 1, price: amount }],
    created_at: new Date().toISOString(),
    settled_at: new Date().toISOString()
  };
  memoryStore.pos_transactions.unshift(fallbackPosTxn);

  if (!memoryStore.sales) memoryStore.sales = [];
  memoryStore.sales.unshift({
    id: crypto.randomUUID(),
    branch_id: branchId,
    user_id: null,
    customer_name: fallbackPosTxn.customer_name,
    amount: amount,
    category: 'merchandise',
    payment_method: 'xendit',
    payment_channel: (payload.payment_method || payload.payment_channel || 'xendit').toLowerCase(),
    description: `POS Counter Order - ${fallbackPosTxn.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
    reference_no: externalId,
    reference_number: externalId,
    invoice_number: externalId,
    created_at: new Date()
  });

  if (typeof saveStore === 'function') saveStore();
  return fallbackPosTxn;
}

/**
 * Stream 2 Settlement Handler: Personal Trainer / Coach Enrollments
 * Mark pt_enrollments as PAID_ONLINE and set clearance_status to AWAITING_DESK_CLEARANCE.
 */
async function handlePtPaymentSettlement(externalId, payload) {
  if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
  let ptEnrollment = memoryStore.pt_enrollments.find(e => 
    e.xendit_external_id === externalId ||
    e.payment_reference === externalId || 
    e.invoice_id === payload.id ||
    (payload.metadata?.enrollment_id && e.id === payload.metadata.enrollment_id)
  );

  const amount = Number(payload.amount || payload.paid_amount || (ptEnrollment?.gross_amount) || 6000);
  const coachCommissionRate = 15.00;
  const coachPayoutAmount = Number((amount * 0.15).toFixed(2));
  const gymRetainedAmount = Number((amount * 0.85).toFixed(2));

  const isPos = String(externalId || '').startsWith('PT-POS-') ||
    payload.metadata?.channel === 'POS' ||
    payload.metadata?.origin_channel === 'POS' ||
    ptEnrollment?.origin_channel === 'POS';
  const originChannel = isPos ? 'POS' : 'ONLINE';
  const originTag = isPos ? 'FRONT_DESK_POS' : 'ONLINE_PORTAL';

  if (ptEnrollment) {
    ptEnrollment.origin_channel = originChannel;
    ptEnrollment.origin = originTag;
    ptEnrollment.payment_status = 'PAID';
    ptEnrollment.coach_payout_amount = coachPayoutAmount;
    ptEnrollment.gym_retained_amount = gymRetainedAmount;
    ptEnrollment.coach_commission_rate = coachCommissionRate;
    ptEnrollment.paid_online_at = new Date().toISOString();

    if (isPos) {
      // Counter enrollment via Xendit invoice: cashier is present, clear immediately
      ptEnrollment.status = 'CLEARED_ACTIVE';
      ptEnrollment.clearance_status = 'CLEARED_ACTIVE';
      ptEnrollment.enrollment_status = 'CLEARED_ACTIVE';
      ptEnrollment.is_cleared = true;
      ptEnrollment.cleared_at = new Date().toISOString();
      ptEnrollment.cleared_by = ptEnrollment.cashier_name || 'Front Desk POS Cashier';

      // Ensure active in pt_clients for coach
      if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
      const existingClient = memoryStore.pt_clients.find(c => (c.client_id === ptEnrollment.member_id || c.id === ptEnrollment.member_id) && c.coach_id === ptEnrollment.coach_id);
      if (!existingClient) {
        memoryStore.pt_clients.unshift({
          id: ptEnrollment.member_id,
          client_id: ptEnrollment.member_id,
          client_name: ptEnrollment.member_name,
          coach_id: ptEnrollment.coach_id,
          coach_name: ptEnrollment.coach_name,
          package_plan: ptEnrollment.package_name,
          status: 'Active',
          sessions_total: ptEnrollment.sessions_total || 12,
          sessions_completed: 0,
          sessions_remaining: ptEnrollment.sessions_total || 12,
          enrolled_at: new Date().toISOString()
        });
      }
    } else {
      // Self-service online portal: requires front desk check-in clearance
      ptEnrollment.clearance_status = 'AWAITING_DESK_CLEARANCE';
      ptEnrollment.enrollment_status = 'AWAITING_DESK_CLEARANCE';
    }
  } else {
    // If not found in memoryStore.pt_enrollments, create segregated record
    const coachId = payload.metadata?.coach_id || 'c-01';
    const coach = (memoryStore.users || []).find(u => u.id === coachId) || { name: 'Certified Coach' };
    const memberId = payload.metadata?.user_id || payload.metadata?.userId || 'm-walkin';
    const memberName = payload.customer?.given_names || 'Enrolled Athlete';
    const branchId = payload.metadata?.branchId || 'b-mkt-01';

    ptEnrollment = {
      id: `pte-${Date.now()}`,
      member_id: memberId,
      member_name: memberName,
      branch_id: branchId,
      coach_id: coachId,
      coach_name: coach.name,
      package_name: payload.metadata?.packageName || '12-Session PT Package',
      sessions_total: payload.metadata?.sessions_total || 12,
      sessions_remaining: payload.metadata?.sessions_total || 12,
      gross_amount: amount,
      coach_commission_rate: coachCommissionRate,
      coach_payout_amount: coachPayoutAmount,
      gym_retained_amount: gymRetainedAmount,
      payment_channel: 'XENDIT',
      origin_channel: originChannel,
      origin: originTag,
      xendit_external_id: externalId,
      payment_status: 'PAID',
      clearance_status: isPos ? 'CLEARED_ACTIVE' : 'AWAITING_DESK_CLEARANCE',
      enrollment_status: isPos ? 'CLEARED_ACTIVE' : 'AWAITING_DESK_CLEARANCE',
      is_cleared: isPos,
      cleared_at: isPos ? new Date().toISOString() : null,
      cleared_by: isPos ? 'Front Desk POS Cashier' : null,
      created_at: new Date().toISOString(),
      paid_online_at: new Date().toISOString()
    };
    memoryStore.pt_enrollments.unshift(ptEnrollment);
  }

  // Check if sale already recorded
  if (!memoryStore.sales) memoryStore.sales = [];
  const existingSale = memoryStore.sales.find(s => s.reference_no === externalId);
  if (!existingSale) {
    const branchId = ptEnrollment?.branch_id || payload.metadata?.branchId || 'b-mkt-01';
    const coachId = ptEnrollment?.coach_id || payload.metadata?.coach_id;
    const coachUser = (memoryStore.users || []).find(u => u.id === coachId);
    const memberName = ptEnrollment?.member_name || payload.customer?.given_names || 'Enrolled Athlete';

    memoryStore.sales.unshift({
      id: crypto.randomUUID(),
      branch_id: branchId,
      user_id: ptEnrollment?.member_id || payload.metadata?.user_id || null,
      customer_name: memberName,
      amount: amount,
      royalty_amount: Number((amount * 0.075).toFixed(2)),
      net_retained: gymRetainedAmount,
      category: 'pt_packages',
      payment_method: 'xendit',
      payment_channel: (payload.payment_method || payload.payment_channel || 'xendit').toLowerCase(),
      origin_channel: originChannel,
      description: `[PT Enrollment - ${originChannel}] ${ptEnrollment?.package_name || 'Personal Training Package'} with Coach ${(coachUser?.name || 'Assigned Coach').replace(/^Coach\s+/i, '')}`,
      reference_no: externalId,
      reference_number: externalId,
      invoice_number: externalId,
      created_at: new Date()
    });
  }

  // Update invoice record if present
  if (memoryStore.payment_invoices) {
    const inv = memoryStore.payment_invoices.find(i => i.invoice_no === externalId || i.id === payload.id);
    if (inv) {
      inv.status = 'settled';
      inv.settled_at = new Date();
    }
  }

  if (typeof saveStore === 'function') saveStore();
  return ptEnrollment;
}

/**
 * Stream 3 Settlement Handler: Membership Plans & Subscriptions
 * Activate membership plan and update rotating turnstile access credentials.
 */
async function handlePlanPaymentSettlement(externalId, payload) {
  if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
  const invoice = memoryStore.payment_invoices.find(inv => inv.invoice_no === externalId || inv.id === payload.id);

  if (!memoryStore.membership_subscriptions) memoryStore.membership_subscriptions = [];
  let memSub = memoryStore.membership_subscriptions.find(s => s.xendit_external_id === externalId || (invoice && s.id === invoice.plan_id));

  const amountPaid = payload.amount || payload.paid_amount || (invoice ? invoice.amount : (memSub ? memSub.price : 500));
  const paymentRail = (payload.payment_method || payload.payment_channel || 'xendit').toLowerCase();
  const userId = invoice?.user_id || payload.metadata?.userId || memSub?.member_id || memSub?.user_id;
  const branchId = invoice?.branch_id || payload.metadata?.branchId || memSub?.branch_id || 'b-mkt-01';

  let planTier = invoice?.plan_id || payload.metadata?.planTier || memSub?.plan_id || memSub?.plan;
  if (!planTier) {
    if (amountPaid <= 500) planTier = '1_day';
    else if (amountPaid <= 4600) planTier = '1_month';
    else if (amountPaid <= 9500) planTier = '3_months';
    else if (amountPaid <= 16400) planTier = '6_months';
    else planTier = '12_months';
  }

  if (invoice) {
    invoice.status = 'settled';
    invoice.settled_at = new Date();
    invoice.gateway_ref = payload.id;
  }

  let settlementResult = null;
  if (userId) {
    settlementResult = await settleMembershipAccess({
      userId,
      branchId,
      planId: planTier,
      amount: amountPaid,
      paymentRail,
      referenceNo: externalId,
      ipAddress: '127.0.0.1'
    });

    if (memSub) {
      memSub.billing_status = 'SETTLED';
      memSub.status = 'active';
      memSub.settled_at = new Date().toISOString();
    }
  } else {
    // Guest counter pass
    if (!memoryStore.sales) memoryStore.sales = [];
    memoryStore.sales.unshift({
      id: crypto.randomUUID(),
      branch_id: branchId,
      user_id: 'guest_counter',
      amount: Number(amountPaid),
      category: amountPaid <= 500 ? 'day_pass' : 'membership_fee',
      payment_method: `xendit_${paymentRail}`,
      reference_no: externalId,
      created_at: new Date()
    });
  }

  if (typeof saveStore === 'function') saveStore();
  return settlementResult;
}

// -------------------------------------------------------------
// 5B. XENDIT WEBHOOK RECEIVER & DEMUXER (POST /api/webhooks/xendit)
// -------------------------------------------------------------
async function handleWebhook(req, res) {
  try {
    const incomingToken = req.headers['x-callback-token'];

    // Webhook Token Authentication (strictly enforce if header present or in production)
    if (incomingToken && !xenditService.verifyWebhookToken(incomingToken)) {
      console.warn('[SECURITY] Unauthorized Xendit webhook callback attempt blocked. Invalid token:', incomingToken);
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Invalid Xendit x-callback-token signature.'
      });
    }

    const { external_id: bodyExternalId, status: bodyStatus } = req.body || {};
    const external_id = bodyExternalId || req.body?.externalId || '';
    const status = (bodyStatus || '').toUpperCase();
    const event = req.body?.event || (status === 'PAID' ? 'invoice.paid' : 'unknown');
    const amount = Number(req.body?.amount || req.body?.paid_amount || 0);

    console.log(`[Xendit Webhook Demuxer] Received event: ${event} | ExternalId: ${external_id} | Status: ${status}`);

    // If status is not PAID or SETTLED, acknowledge and return
    if (status !== 'PAID' && status !== 'SETTLED' && status !== 'COMPLETED' && event !== 'invoice.paid' && event !== 'qr.payment') {
      return res.status(200).send('Event acknowledged');
    }

    if (!external_id) {
      return res.status(200).send('Event acknowledged');
    }

    // -------------------------------------------------------------------------
    // WEBHOOK IDEMPOTENCY LEDGER & ATOMIC CONCURRENCY LOCK (PCI / ISO 25010)
    // -------------------------------------------------------------------------
    const eventId = req.body?.id || req.body?.event_id || req.headers['x-event-id'] || `evt_${external_id}_${status}`;
    const payloadHash = crypto.createHash('sha256').update(`${external_id}+${status}+${amount}`).digest('hex');

    if (!memoryStore.webhook_events) {
      memoryStore.webhook_events = [];
    }

    const existingEvent = memoryStore.webhook_events.find(
      e => e.event_id === eventId || e.payload_hash === payloadHash
    );

    if (existingEvent) {
      existingEvent.duplicate_count = (existingEvent.duplicate_count || 1) + 1;
      existingEvent.last_intercepted_at = new Date();

      if (existingEvent.status === 'COMPLETED') {
        console.log(`[Xendit Idempotency Ledger] Duplicate webhook event intercepted for ${external_id} (hash: ${payloadHash.slice(0, 12)}). Deduplicating.`);
        return res.status(200).json({
          success: true,
          status: 'ALREADY_PROCESSED',
          event_id: existingEvent.event_id,
          external_id: existingEvent.external_id,
          message: 'Duplicate webhook intercepted. Event previously settled and recorded in idempotency ledger.'
        });
      }

      if (existingEvent.status === 'PROCESSING') {
        // Concurrency lock: another worker/request is actively handling this event
        console.log(`[Xendit Idempotency Ledger] Concurrent webhook lock active for ${external_id}. Deduplicating in-flight call.`);
        return res.status(200).json({
          success: true,
          status: 'ALREADY_PROCESSED',
          event_id: existingEvent.event_id,
          external_id: existingEvent.external_id,
          message: 'Concurrent webhook payload locked in processing. Returning acknowledged without duplicate mutation.'
        });
      }
    }

    // Determine transaction stream type
    let streamType = 'MEMBERSHIP_PLAN';
    if (external_id.startsWith('POS-')) streamType = 'POS_RETAIL';
    else if (external_id.startsWith('PT-')) streamType = 'PERSONAL_TRAINING';

    // Register atomic lock record in idempotency ledger
    const ledgerEntry = {
      event_id: eventId,
      external_id: external_id,
      stream_type: streamType,
      amount: amount,
      status: 'PROCESSING',
      payload_hash: payloadHash,
      processed_at: new Date(),
      duplicate_count: 1
    };
    memoryStore.webhook_events.unshift(ledgerEntry);

    // Demux incoming transaction stream by external_id prefix:
    if (external_id.startsWith('POS-')) {
      // Route exclusively to POS processing:
      // Mark pos_transactions record as SETTLED; do NOT touch drawer cash.
      await handlePosPaymentSettlement(external_id, req.body);
    } else if (external_id.startsWith('PT-')) {
      // Route exclusively to PT processing:
      // Mark pt_enrollments as PAID_ONLINE and set clearance_status to AWAITING_DESK_CLEARANCE.
      await handlePtPaymentSettlement(external_id, req.body);
    } else if (external_id.startsWith('PLAN-') || external_id.startsWith('inv_ksyn_') || external_id.startsWith('KSYN-')) {
      // Route exclusively to Membership processing:
      // Activate membership plan and update rotating turnstile access credentials.
      await handlePlanPaymentSettlement(external_id, req.body);
    } else {
      // Fallback check in pos_transactions or pt_enrollments
      const posTxn = (memoryStore.pos_transactions || []).find(t => t.invoice_id === req.body?.id);
      if (posTxn) {
        await handlePosPaymentSettlement(posTxn.external_id || external_id, req.body);
      } else {
        const ptEnroll = (memoryStore.pt_enrollments || []).find(e => e.invoice_id === req.body?.id);
        if (ptEnroll) {
          await handlePtPaymentSettlement(ptEnroll.xendit_external_id || external_id, req.body);
        } else {
          await handlePlanPaymentSettlement(external_id, req.body);
        }
      }
    }

    // Mark status as COMPLETED in idempotency ledger
    ledgerEntry.status = 'COMPLETED';
    ledgerEntry.completed_at = new Date();

    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.status(200).json({
      success: true,
      status: 'COMPLETED',
      event_id: eventId,
      received: true
    });
  } catch (err) {
    console.error('Xendit webhook demuxer error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 6. TRIGGER RECURRING AUTO-DEBIT DUES (1st or 15th Simulation)
// -------------------------------------------------------------
async function triggerRecurringBilling(req, res) {
  try {
    const today = new Date();
    const cycleDay = req.body.cycleDay ? parseInt(req.body.cycleDay, 10) : (today.getDate() >= 15 ? 15 : 1);

    if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];

    // Find active subscriptions eligible for recurring auto-debit on this cycle day
    const eligibleSubs = memoryStore.subscriptions.filter(s => 
      s.status === 'active' && 
      s.auto_renew && 
      s.plan !== '1_day' &&
      (s.billing_day === cycleDay || !s.billing_day)
    );

    const chargeResults = [];

    for (const sub of eligibleSubs) {
      const pm = memoryStore.payment_methods.find(p => p.user_id === sub.user_id && p.status === 'active');
      const resolvedPlan = resolvePlan(sub.plan);
      const monthlyAmount = sub.monthly_due_amount || resolvedPlan.planFee;

      if (!pm || !pm.gateway_token) {
        chargeResults.push({
          user_id: sub.user_id,
          plan: sub.plan,
          status: 'SKIPPED_NO_TOKEN',
          message: 'No active tokenized card found on file.'
        });
        continue;
      }

      try {
        const externalId = `KSYN-REC-${sub.user_id.slice(0, 8)}-${Date.now()}`;
        const charge = await xenditService.chargeCard({
          tokenId: pm.gateway_token,
          externalId,
          amount: monthlyAmount,
          isRecurring: true,
          descriptor: 'KSYN MONTHLY MEMBERSHIP'
        });

        if (charge.status === 'CAPTURED') {
          // Increment subscription end date by 30 days
          const currentEnd = new Date(sub.end_date);
          const newEnd = new Date(currentEnd.getTime() + 30 * 24 * 3600 * 1000);
          sub.end_date = newEnd.toISOString().split('T')[0];
          sub.next_billing_date = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
          sub.auto_debit_retries = 0;

          // Record in sales ledger with complete enrichment
          if (!memoryStore.sales) memoryStore.sales = [];
          const matchedUser = (memoryStore.users || []).find(u => u.id === sub.user_id);
          const royaltyAmount = Number((monthlyAmount * 0.075).toFixed(2));
          const netRetained = Number((monthlyAmount * 0.925).toFixed(2));
          memoryStore.sales.unshift({
            id: crypto.randomUUID(),
            branch_id: sub.branch_id || 'b-mkt-01',
            user_id: sub.user_id,
            customer_name: matchedUser?.name || 'Subscribed Athlete',
            buyer_name: matchedUser?.name || 'Subscribed Athlete',
            amount: monthlyAmount,
            royalty_amount: royaltyAmount,
            net_retained: netRetained,
            category: 'membership_fee',
            payment_method: 'xendit',
            payment_channel: 'xendit_auto_debit',
            description: `KSYN Membership Auto-Debit Renewal - ${sub.plan_name || sub.plan}`,
            reference_no: externalId,
            reference_number: externalId,
            invoice_number: externalId,
            approval_code: externalId,
            created_at: new Date().toISOString()
          });

          chargeResults.push({
            user_id: sub.user_id,
            plan: sub.plan,
            status: 'SUCCESS',
            amount: monthlyAmount,
            charge_id: charge.id,
            new_end_date: sub.end_date
          });
        } else {
          sub.auto_debit_retries = (sub.auto_debit_retries || 0) + 1;
          chargeResults.push({
            user_id: sub.user_id,
            plan: sub.plan,
            status: 'DECLINED',
            retries: sub.auto_debit_retries
          });
        }
      } catch (chargeErr) {
        sub.auto_debit_retries = (sub.auto_debit_retries || 0) + 1;
        chargeResults.push({
          user_id: sub.user_id,
          plan: sub.plan,
          status: 'FAILED',
          error: chargeErr.message
        });
      }
    }

    saveStore();

    res.json({
      success: true,
      message: `Xendit recurring billing cycle executed for the ${cycleDay}th of the month.`,
      cycle_day: cycleDay,
      total_eligible: eligibleSubs.length,
      successful_charges: chargeResults.filter(r => r.status === 'SUCCESS').length,
      declined_charges: chargeResults.filter(r => r.status === 'DECLINED' || r.status === 'FAILED').length,
      results: chargeResults
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 7. GET DYNAMIC QR PH PAYMENT STATUS
// -------------------------------------------------------------
async function getQrStatus(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const invoice = memoryStore.payment_invoices.find(inv => 
      inv.id === id || 
      inv.invoice_no === id || 
      inv.gateway_ref === id ||
      inv.id === `qr_${id}` ||
      (inv.id && inv.id.includes(id))
    );

    if (!invoice) {
      return res.json({ success: true, status: 'PENDING', paid: false, id });
    }

    const isPaid = invoice.status === 'settled' || invoice.status === 'PAID' || invoice.status === 'COMPLETED';
    return res.json({
      success: true,
      id: invoice.id,
      invoice_no: invoice.invoice_no,
      status: isPaid ? 'PAID' : (invoice.status || 'PENDING'),
      paid: isPaid,
      amount: invoice.amount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 8. SIMULATE / TEST DYNAMIC QR PH PAYMENT CONFIRMATION
// -------------------------------------------------------------
async function simulateQrPaid(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    let invoice = memoryStore.payment_invoices.find(inv => 
      inv.id === id || 
      inv.invoice_no === id || 
      inv.gateway_ref === id ||
      (inv.id && inv.id.includes(id))
    );

    if (!invoice) {
      invoice = {
        id,
        invoice_no: `KSYN-QR-${Date.now()}`,
        status: 'pending',
        amount: Number(req.body?.amount || 0),
        created_at: new Date()
      };
      memoryStore.payment_invoices.unshift(invoice);
    }

    invoice.status = 'PAID';
    invoice.paid_at = new Date();

    return res.json({
      success: true,
      message: 'Dynamic QR Ph payment marked as PAID.',
      status: 'PAID',
      paid: true,
      invoice
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 9. CONFIRM PAYMENT & SETTLE MEMBERSHIP (Client Redirection or Verification)
// -------------------------------------------------------------
async function confirmPayment(req, res) {
  try {
    const { external_id, invoice_id, planTier, userId, amount } = req.body;

    // Check if this is a PT Enrollment confirmation
    if ((external_id && String(external_id).startsWith('PT-')) || req.body?.enrollment_type === 'pt') {
      const { confirmPtEnrollmentPayment } = require('./memberController');
      return confirmPtEnrollmentPayment(req, res);
    }

    let invoice = null;
    if (external_id || invoice_id) {
      if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
      invoice = memoryStore.payment_invoices.find(inv => 
        (external_id && inv.invoice_no === external_id) || 
        (invoice_id && (inv.id === invoice_id || inv.gateway_ref === invoice_id))
      );
    }

    if (invoice?.channel === 'PT ENROLLMENT' || invoice?.category === 'pt_enrollment') {
      const { confirmPtEnrollmentPayment } = require('./memberController');
      return confirmPtEnrollmentPayment(req, res);
    }

    let targetUserId = userId || req.user?.id || invoice?.user_id || invoice?.metadata?.userId;
    if (!targetUserId && invoice?.payer_email) {
      const match = (memoryStore.users || []).find(u => u.email?.toLowerCase() === invoice.payer_email.toLowerCase());
      if (match) targetUserId = match.id;
    }
    if (!targetUserId && req.body?.email) {
      const match = (memoryStore.users || []).find(u => u.email?.toLowerCase() === req.body.email.toLowerCase());
      if (match) targetUserId = match.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User identification required to settle payment.' });
    }

    const resolvedPlanId = planTier || invoice?.plan_id || '1_month';
    const resolvedAmount = amount || invoice?.amount;
    const resolvedBranchId = invoice?.branch_id || req.user?.branch_id || 'b-mkt-01';

    if (invoice) {
      invoice.status = 'settled';
      invoice.settled_at = new Date();
    }

    const settlement = await settleMembershipAccess({
      userId: targetUserId,
      branchId: resolvedBranchId,
      planId: resolvedPlanId,
      amount: resolvedAmount,
      paymentRail: 'xendit_hosted_checkout',
      referenceNo: external_id || invoice?.invoice_no || `inv_ksyn_${Date.now()}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    // Issue refreshed credentials so user never loses session after returning from hosted checkout
    const tokenPayload = {
      id: settlement.user.id,
      role: settlement.user.role,
      branch_id: settlement.user.branch_id,
      email: settlement.user.email,
      username: settlement.user.username,
      name: settlement.user.name,
      jti: crypto.randomUUID()
    };
    const freshToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    const freshRefreshToken = crypto.randomBytes(40).toString('hex');
    const freshRefreshTokenHash = crypto.createHash('sha256').update(freshRefreshToken).digest('hex');
    if (!memoryStore.refresh_tokens) memoryStore.refresh_tokens = [];
    memoryStore.refresh_tokens.push({
      id: crypto.randomUUID(),
      user_id: settlement.user.id,
      family_id: crypto.randomUUID(),
      token_hash: freshRefreshTokenHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      is_revoked: false
    });

    return res.json({
      success: true,
      message: `Membership successfully settled and updated to ${settlement.subscription?.plan || resolvedPlanId}.`,
      token: freshToken,
      refreshToken: freshRefreshToken,
      user: settlement.user,
      subscription: settlement.subscription,
      turnstile_pass: settlement.turnstilePass
    });
  } catch (err) {
    console.error('[XENDIT] confirmPayment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------
// 10. GET INVOICE STATUS
// -------------------------------------------------------------
async function getInvoiceStatus(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const invoice = memoryStore.payment_invoices.find(inv => 
      inv.id === id || 
      inv.invoice_no === id || 
      inv.gateway_ref === id ||
      (inv.id && inv.id.includes(id))
    );

    if (!invoice) {
      return res.json({ success: true, status: 'PENDING', paid: false, id });
    }

    const isPaid = invoice.status === 'settled' || invoice.status === 'PAID' || invoice.status === 'COMPLETED';
    return res.json({
      success: true,
      id: invoice.id,
      invoice_no: invoice.invoice_no,
      status: isPaid ? 'PAID' : (invoice.status || 'PENDING'),
      paid: isPaid,
      plan_id: invoice.plan_id,
      amount: invoice.amount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getConfig,
  createInvoice,
  subscribeMembershipPlan,
  handlePosPaymentSettlement,
  handlePtPaymentSettlement,
  handlePlanPaymentSettlement,
  createDynamicQr,
  chargeCard,
  handleWebhook,
  triggerRecurringBilling,
  getQrStatus,
  simulateQrPaid,
  confirmPayment,
  getInvoiceStatus
};
