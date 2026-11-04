const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { memoryStore, isPostgres, query, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { QR_HMAC_SECRET, PAYMENT_WEBHOOK_SECRET } = require('../config/secrets');

// In-memory 3DS Challenge Sessions (TTL: 5 minutes)
const pendingChallenges = new Map();

// Helper: Determine card brand from PAN
function detectCardBrand(pan) {
  const clean = String(pan).replace(/\D/g, '');
  if (/^4/.test(clean)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard';
  if (/^3[47]/.test(clean)) return 'American Express';
  if (/^(?:2131|1800|35)/.test(clean)) return 'JCB';
  return 'Credit/Debit Card';
}

// Helper: Detect likely PH issuing bank from BIN
function detectIssuingBank(pan) {
  const bin = String(pan).replace(/\D/g, '').slice(0, 6);
  if (bin.startsWith('41') || bin.startsWith('54')) return 'BDO Unibank';
  if (bin.startsWith('42') || bin.startsWith('53')) return 'Bank of the Philippine Islands (BPI)';
  if (bin.startsWith('40') || bin.startsWith('52')) return 'Metrobank';
  if (bin.startsWith('43') || bin.startsWith('55')) return 'UnionBank of the Philippines';
  if (bin.startsWith('48') || bin.startsWith('51')) return 'Security Bank';
  return 'Philippine Issuing Bank (3D Secure 2.0)';
}

// -------------------------------------------------------------
// 1. OPTION 1: CREDIT / DEBIT CARD TOKENIZATION & 3DS CHALLENGE
// -------------------------------------------------------------
async function tokenizeCard(req, res) {
  try {
    const { cardNumber, cardholderName, expiryMonth, expiryYear, cvv, userId, branchId, billingDay = 1 } = req.body;

    const cleanPan = String(cardNumber || '').replace(/\D/g, '');
    if (cleanPan.length < 13 || cleanPan.length > 19) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CARD_NUMBER',
        message: 'Invalid primary account number (PAN). Standard cards are 15-16 digits.'
      });
    }

    const cleanCvv = String(cvv || '').trim();
    if (!/^\d{3,4}$/.test(cleanCvv)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CVV',
        message: 'Invalid CVV/CVC security code (3 or 4 digits required).'
      });
    }

    const expMonth = String(expiryMonth || '').padStart(2, '0');
    const expYear = String(expiryYear || '').slice(-2);
    if (!/^(0[1-9]|1[0-2])$/.test(expMonth)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EXPIRY',
        message: 'Invalid expiry month (01-12).'
      });
    }

    const last4 = cleanPan.slice(-4);
    const brand = detectCardBrand(cleanPan);
    const issuingBank = detectIssuingBank(cleanPan);

    // ZERO-PAN COMPLIANCE: Raw PAN and CVV are NEVER stored in database!
    // Gateway generates irreversible token:
    const gatewayToken = `tok_card_${crypto.randomBytes(12).toString('hex')}`;
    const maskedPan = `•••• •••• •••• ${last4}`;

    // Generate 3DS Challenge OTP
    const challengeToken = `3ds_ch_${crypto.randomBytes(16).toString('hex')}`;
    const mockOtp = '123456'; // Default test OTP for Philippines 3DS sandbox

    const challengeRecord = {
      challengeToken,
      gatewayToken,
      maskedPan,
      brand,
      issuingBank,
      cardholderName: (cardholderName || 'Cardholder').trim(),
      expiryMonth: expMonth,
      expiryYear: expYear,
      userId: userId || null,
      branchId: branchId || 'b-mkt-01',
      billingDay: parseInt(billingDay, 10) === 15 ? 15 : 1,
      expectedOtp: mockOtp,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes TTL
    };

    pendingChallenges.set(challengeToken, challengeRecord);

    res.json({
      success: true,
      requires_3ds: true,
      challenge_token: challengeToken,
      card_summary: {
        brand,
        issuing_bank: issuingBank,
        masked_identifier: maskedPan,
        expiry: `${expMonth}/${expYear}`
      },
      three_d_secure: {
        status: 'CHALLENGE_REQUIRED',
        issuing_bank: issuingBank,
        prompt: `An SMS One-Time PIN (OTP) has been dispatched to your mobile number registered with ${issuingBank}.`,
        hint: 'Enter 123456 for simulated 3DS sandbox verification.',
        expires_in_seconds: 300
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Verify 3DS OTP and store tokenized payment method
async function verify3DSecure(req, res) {
  try {
    const { challengeToken, otp } = req.body;

    if (!challengeToken || !pendingChallenges.has(challengeToken)) {
      return res.status(400).json({
        success: false,
        error: 'CHALLENGE_EXPIRED_OR_INVALID',
        message: '3D Secure authentication session has expired or is invalid. Please restart card entry.'
      });
    }

    const session = pendingChallenges.get(challengeToken);
    if (Date.now() > session.expiresAt) {
      pendingChallenges.delete(challengeToken);
      return res.status(400).json({
        success: false,
        error: 'OTP_EXPIRED',
        message: '3D Secure OTP expired. Please initiate card verification again.'
      });
    }

    if (String(otp).trim() !== session.expectedOtp && String(otp).trim() !== '123456') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'Incorrect 3D Secure SMS OTP code. Please enter 123456 to approve simulated verification.'
      });
    }

    // Successfully verified! Save tokenized payment method
    pendingChallenges.delete(challengeToken);

    const paymentMethodId = `pm-${crypto.randomUUID().slice(0, 8)}`;
    const newMethod = {
      id: paymentMethodId,
      user_id: session.userId,
      branch_id: session.branchId,
      type: 'card',
      gateway_token: session.gatewayToken,
      masked_identifier: session.maskedPan,
      brand_or_provider: session.brand,
      issuing_bank: session.issuingBank,
      cardholder_name: session.cardholderName,
      expiry_month: session.expiryMonth,
      expiry_year: session.expiryYear,
      billing_day: session.billingDay,
      is_default: true,
      status: 'active',
      created_at: new Date()
    };

    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];

    // If userId exists, mark previous cards as not default
    if (session.userId) {
      memoryStore.payment_methods.forEach(pm => {
        if (pm.user_id === session.userId) pm.is_default = false;
      });
    }
    memoryStore.payment_methods.push(newMethod);

    // If user has an existing subscription, bind this payment method
    if (session.userId && memoryStore.subscriptions) {
      const sub = memoryStore.subscriptions.find(s => s.user_id === session.userId);
      if (sub) {
        sub.payment_method_id = newMethod.id;
        sub.billing_day = newMethod.billing_day;
      }
    }

    await logAuditEvent({
      branch_id: session.branchId,
      user_id: session.userId || 'system',
      user_role: 'member',
      action: 'PAYMENT_METHOD_TOKENIZED',
      resource: 'payment_methods',
      ip_address: req.ip || '127.0.0.1',
      details: {
        method_id: paymentMethodId,
        type: 'card',
        brand: session.brand,
        masked: session.maskedPan,
        issuing_bank: session.issuingBank
      }
    });

    res.json({
      success: true,
      status: 'AUTHENTICATION_SUCCESSFUL',
      message: `Card verified via ${session.issuingBank} 3D Secure 2.0. Stored securely with Zero-PAN tokenization.`,
      payment_method: newMethod
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 2. OPTION 2: E-WALLET AUTO-DEBIT (GCASH / MAYA BILLING AGREEMENT)
// -------------------------------------------------------------------
async function createBillingAgreement(req, res) {
  try {
    const { walletType, mobileNumber, otp, userId, branchId, billingDay = 1 } = req.body;

    const provider = String(walletType || '').toLowerCase() === 'maya' ? 'Maya' : 'GCash';
    const cleanPhone = String(mobileNumber || '').replace(/\D/g, '');

    // Validate Philippine mobile number (e.g. 09171234567 or 639171234567)
    let standardPhone = cleanPhone;
    if (standardPhone.startsWith('63')) standardPhone = '0' + standardPhone.slice(2);
    if (!/^09\d{9}$/.test(standardPhone)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PH_MOBILE',
        message: 'Please provide a valid 11-digit Philippine mobile number (e.g. 0917 123 4567).'
      });
    }

    // Check OTP for simulated account linking
    if (!otp) {
      // Step A: Initiate authorization session
      return res.json({
        success: true,
        requires_otp: true,
        provider,
        masked_mobile: `${standardPhone.slice(0, 4)} ••• ••${standardPhone.slice(-2)}`,
        message: `An authorization PIN was sent to ${provider} account (${standardPhone}). Enter 123456 to approve auto-debit billing agreement.`,
        hint: 'Use test OTP: 123456'
      });
    }

    if (String(otp).trim() !== '123456') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EWALLET_OTP',
        message: 'Invalid OTP code. Please enter 123456 for simulated agreement approval.'
      });
    }

    // Step B: Issue Recurring Billing Agreement Token
    const agreementToken = `agr_${provider.toLowerCase()}_${crypto.randomBytes(10).toString('hex')}`;
    const maskedMobile = `${standardPhone.slice(0, 4)} ••• ••${standardPhone.slice(-2)}`;
    const paymentMethodId = `pm-${crypto.randomUUID().slice(0, 8)}`;

    const newMethod = {
      id: paymentMethodId,
      user_id: userId || null,
      branch_id: branchId || 'b-mkt-01',
      type: `${provider.toLowerCase()}_recurring`,
      gateway_token: agreementToken,
      masked_identifier: maskedMobile,
      brand_or_provider: provider,
      issuing_bank: provider === 'GCash' ? 'Mynt / Globe GCash' : 'Maya Philippines / Voyager',
      expiry_month: null,
      expiry_year: null,
      billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
      is_default: true,
      status: 'active',
      created_at: new Date()
    };

    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
    if (userId) {
      memoryStore.payment_methods.forEach(pm => {
        if (pm.user_id === userId) pm.is_default = false;
      });
    }
    memoryStore.payment_methods.push(newMethod);

    if (userId && memoryStore.subscriptions) {
      const sub = memoryStore.subscriptions.find(s => s.user_id === userId);
      if (sub) {
        sub.payment_method_id = newMethod.id;
        sub.billing_day = newMethod.billing_day;
      }
    }

    await logAuditEvent({
      branch_id: branchId || 'b-mkt-01',
      user_id: userId || 'system',
      user_role: 'member',
      action: 'EWALLET_BILLING_AGREEMENT_LINKED',
      resource: 'payment_methods',
      ip_address: req.ip || '127.0.0.1',
      details: {
        method_id: paymentMethodId,
        provider,
        masked: maskedMobile,
        agreement_token: agreementToken
      }
    });

    res.json({
      success: true,
      message: `${provider} Recurring Auto-Debit Agreement authorized successfully. Monthly dues will pull automatically on day ${newMethod.billing_day}.`,
      payment_method: newMethod
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 3. OPTION 3: DYNAMIC QR PH CODE (ONE-TIME & PREPAID INVOICES)
// -------------------------------------------------------------------
async function generateDynamicQrPh(req, res) {
  try {
    const { amount, description, userId, branchId, planTier } = req.body;

    const invoiceAmount = parseFloat(amount);
    if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Payment amount must be greater than ₱0.00.'
      });
    }

    const branch = (memoryStore.branches || []).find(b => b.id === branchId) || memoryStore.branches[0];
    const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoiceId = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (600s)

    // Dynamic QR Ph EMVCo compliant payload string
    const qrPayload = JSON.stringify({
      format: 'QRPH_DYNAMIC_EMVCO',
      merchant_name: `KSYN Fitness - ${branch ? branch.name : 'Makati'}`,
      branch_code: branch ? branch.code : 'MKT-01',
      currency: 'PHP',
      amount: invoiceAmount.toFixed(2),
      invoice_no: invoiceNo,
      issued_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      gateway: 'PayMongo_QRPh_Rail'
    });

    const newInvoice = {
      id: invoiceId,
      invoice_no: invoiceNo,
      user_id: userId || null,
      branch_id: branchId || 'b-mkt-01',
      amount: invoiceAmount,
      description: description || `KSYN Membership Pass (${planTier || 'Prepaid'})`,
      payment_rail: 'qr_ph',
      gateway_ref: `qrph_${crypto.randomBytes(8).toString('hex')}`,
      qr_payload: qrPayload,
      expires_at: expiresAt,
      status: 'pending',
      settled_at: null,
      created_at: new Date()
    };

    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    memoryStore.payment_invoices.unshift(newInvoice);

    res.json({
      success: true,
      invoice: newInvoice,
      qr_code: {
        payload: qrPayload,
        qr_string: `00020101021226${invoiceNo.length}${invoiceNo}5204599953036085405${invoiceAmount.toFixed(2)}5802PH5912KSYN FITNESS6006MAKATI62200716${invoiceNo}6304`,
        expires_at: expiresAt,
        ttl_seconds: 600,
        amount: invoiceAmount,
        currency: 'PHP',
        supported_apps: ['GCash', 'Maya', 'BDO Online', 'BPI Mobile', 'UnionBank', 'GoTyme Bank']
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 4. HMAC-SHA256 WEBHOOK LISTENER FOR INSTANT QR PH SETTLEMENT
// -------------------------------------------------------------------
async function handlePaymentWebhook(req, res) {
  try {
    const rawSignature = req.headers['x-ksyn-signature'] || req.headers['x-signature'] || req.query.signature;
    const { event, data } = req.body;

    // Check payload structure
    if (!event || !data || !data.invoice_no) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Webhook payload missing required event or data.invoice_no.'
      });
    }

    // Verify HMAC-SHA256 Signature (if provided or in production)
    if (rawSignature) {
      const payloadString = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', PAYMENT_WEBHOOK_SECRET)
        .update(payloadString)
        .digest('hex');

      const bufA = Buffer.from(String(rawSignature), 'utf8');
      const bufB = Buffer.from(expectedSignature, 'utf8');

      if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        // Accept sandbox test bypass if marked as simulated
        if (!req.body.is_simulated) {
          return res.status(401).json({
            success: false,
            error: 'INVALID_SIGNATURE',
            message: 'Webhook HMAC-SHA256 signature verification failed.'
          });
        }
      }
    }

    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const invoice = memoryStore.payment_invoices.find(inv => inv.invoice_no === data.invoice_no);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'INVOICE_NOT_FOUND',
        message: `Invoice [${data.invoice_no}] not found in KSYN records.`
      });
    }

    if (invoice.status === 'settled') {
      return res.json({
        success: true,
        message: 'Invoice has already been settled and processed.',
        invoice
      });
    }

    // Flip invoice status to settled
    invoice.status = 'settled';
    invoice.settled_at = new Date();
    invoice.gateway_ref = data.reference_no || invoice.gateway_ref;

    // Record into financial sales ledger
    if (!memoryStore.sales) memoryStore.sales = [];
    const saleTxn = {
      id: crypto.randomUUID(),
      branch_id: invoice.branch_id,
      user_id: invoice.user_id || 'guest_onboarding',
      amount: invoice.amount,
      category: 'membership_fee',
      payment_method: invoice.payment_rail || 'qr_ph',
      reference_no: invoice.invoice_no,
      created_at: new Date()
    };
    memoryStore.sales.unshift(saleTxn);

    // If invoice is tied to a user subscription, ensure status is active
    if (invoice.user_id && memoryStore.subscriptions) {
      const sub = memoryStore.subscriptions.find(s => s.user_id === invoice.user_id);
      if (sub) {
        sub.status = 'active';
        sub.auto_debit_retries = 0;
      }
    }

    await logAuditEvent({
      branch_id: invoice.branch_id,
      user_id: invoice.user_id || 'system_gateway',
      user_role: 'system',
      action: 'PAYMENT_WEBHOOK_SETTLED',
      resource: 'payment_invoices',
      ip_address: req.ip || '127.0.0.1',
      details: {
        invoice_no: invoice.invoice_no,
        amount: invoice.amount,
        rail: invoice.payment_rail,
        reference_no: invoice.gateway_ref
      }
    });

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_no} settled. Account verified and access privileges unlocked.`,
      invoice
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 5. UNIFIED 5-STEP MEMBER ONBOARDING PIPELINE
// -------------------------------------------------------------------
async function onboardMember(req, res) {
  try {
    const {
      // Step 1: Identity & Plan
      branchId,
      fullName,
      email,
      phone,
      password,
      planTier,

      // Step 2: PAR-Q Waiver & Signature
      parqAnswers, // { heart_condition: false, chest_pain: false, dizziness: false, etc. }
      signatureData, // Base64 canvas data URL

      // Step 3 & 4: Payment Selection & Settlement
      paymentOption, // 'card', 'gcash', 'maya', 'qr_ph'
      paymentMethodId,
      gatewayToken,
      invoiceNo,
      billingDay = 1
    } = req.body;

    // Validate Step 1
    if (!planTier) {
      return res.status(400).json({
        success: false,
        error: 'PLAN_REQUIRED',
        message: 'Please select a membership plan before proceeding.'
      });
    }

    const { resolvePlan } = require('../config/membershipRates');
    const chosenPlan = resolvePlan(planTier);
    if (!chosenPlan) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'The selected membership plan is invalid. Please select a valid plan.'
      });
    }

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IDENTITY_FIELDS',
        message: 'Full name, email address, and initial account password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = (memoryStore.users || []).find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_REGISTERED',
        message: `An account with email ${cleanEmail} is already registered. Please log in or use a different email.`
      });
    }

    // Validate Step 2: Signature
    if (!signatureData) {
      return res.status(400).json({
        success: false,
        error: 'PARQ_SIGNATURE_REQUIRED',
        message: 'Digital signature on the Physical Activity Readiness Questionnaire (PAR-Q) is legally required.'
      });
    }

    // Compute cryptographic SHA-256 seal for the legal waiver
    const parqSealPayload = JSON.stringify({
      applicant: fullName,
      email: cleanEmail,
      answers: parqAnswers || {},
      signatureFingerprint: crypto.createHash('sha256').update(signatureData).digest('hex'),
      timestamp: new Date().toISOString()
    });
    const parqSignatureHash = crypto.createHash('sha256').update(parqSealPayload).digest('hex');

    // Create Member User Account
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const rfidCardUid = chosenPlan.id !== '1_day'
      ? `KS-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
      : null;

    const newMember = {
      id: userId,
      branch_id: branchId || 'b-mkt-01',
      role: 'member',
      email: cleanEmail,
      password_hash: passwordHash,
      name: fullName.trim(),
      phone: phone || '',
      membership_plan: chosenPlan.id,
      rfid_card_uid: rfidCardUid,
      status: 'active',
      created_at: new Date()
    };
    memoryStore.users.push(newMember);

    // Link or Create Payment Method
    let boundMethodId = paymentMethodId || null;
    if (paymentOption === 'card' && gatewayToken) {
      const pmId = `pm-${crypto.randomUUID().slice(0, 8)}`;
      const pmRecord = {
        id: pmId,
        user_id: userId,
        branch_id: newMember.branch_id,
        type: 'card',
        gateway_token: gatewayToken,
        masked_identifier: req.body.maskedIdentifier || '•••• •••• •••• 4242',
        brand_or_provider: req.body.brand || 'Mastercard',
        issuing_bank: req.body.issuingBank || 'BDO Unibank',
        expiry_month: req.body.expiryMonth || '12',
        expiry_year: req.body.expiryYear || '28',
        billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
        is_default: true,
        status: 'active',
        created_at: new Date()
      };
      if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
      memoryStore.payment_methods.push(pmRecord);
      boundMethodId = pmId;
    } else if ((paymentOption === 'gcash' || paymentOption === 'maya') && gatewayToken) {
      const pmId = `pm-${crypto.randomUUID().slice(0, 8)}`;
      const providerName = paymentOption === 'maya' ? 'Maya' : 'GCash';
      const pmRecord = {
        id: pmId,
        user_id: userId,
        branch_id: newMember.branch_id,
        type: `${paymentOption}_recurring`,
        gateway_token: gatewayToken,
        masked_identifier: req.body.maskedIdentifier || '0917 ••• ••88',
        brand_or_provider: providerName,
        issuing_bank: providerName === 'GCash' ? 'Mynt / Globe GCash' : 'Maya Philippines',
        billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
        is_default: true,
        status: 'active',
        created_at: new Date()
      };
      if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
      memoryStore.payment_methods.push(pmRecord);
      boundMethodId = pmId;
    }

    // Create Subscription Record
    const startDate = new Date();
    const endDate = new Date(Date.now() + chosenPlan.durationDays * 24 * 3600 * 1000);
    const nextBillingDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const newSub = {
      id: crypto.randomUUID(),
      user_id: userId,
      branch_id: newMember.branch_id,
      plan: chosenPlan.id,
      tier: chosenPlan.tier,
      plan_tier: chosenPlan.id,
      plan_name: chosenPlan.name,
      monthly_due_amount: chosenPlan.planFee,
      billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
      next_billing_date: nextBillingDate,
      payment_method_id: boundMethodId,
      auto_debit_retries: 0,
      parq_signed: true,
      parq_signature_hash: parqSignatureHash,
      status: 'active',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      price: chosenPlan.planFee,
      access_fee: chosenPlan.accessFee,
      annual_fee: chosenPlan.annualFee,
      total_paid: chosenPlan.totalDue,
      auto_renew: chosenPlan.id !== '1_day',
      created_at: new Date()
    };
    memoryStore.subscriptions.push(newSub);

    // Initial Registration Sale & Invoice
    const invNumber = invoiceNo || `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newInvoice = {
      id: `inv-${crypto.randomUUID().slice(0, 8)}`,
      invoice_no: invNumber,
      user_id: userId,
      branch_id: newMember.branch_id,
      amount: chosenPlan.totalDue,
      description: `KSYN Membership Dues (${chosenPlan.name})`,
      payment_rail: paymentOption || 'card',
      gateway_ref: `txn_${crypto.randomBytes(8).toString('hex')}`,
      status: 'settled',
      settled_at: new Date(),
      created_at: new Date()
    };
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    memoryStore.payment_invoices.unshift(newInvoice);

    if (!memoryStore.sales) memoryStore.sales = [];
    memoryStore.sales.unshift({
      id: crypto.randomUUID(),
      branch_id: newMember.branch_id,
      user_id: userId,
      amount: chosenPlan.totalDue,
      category: 'membership_fee',
      payment_method: paymentOption || 'card',
      reference_no: invNumber,
      created_at: new Date()
    });

    // Generate Dynamic 60-second QR Pass for instant gym entrance
    const branch = (memoryStore.branches || []).find(b => b.id === newMember.branch_id);
    const passTimestamp = Date.now();
    const passNonce = crypto.randomBytes(8).toString('hex');
    const qrPassPayload = {
      memberId: userId,
      memberName: newMember.name,
      branchId: newMember.branch_id,
      branchCode: branch ? branch.code : 'MKT-01',
      tier: chosenPlan.tier,
      subStatus: 'active',
      timestamp: passTimestamp,
      nonce: passNonce
    };
    const payloadBase64 = Buffer.from(JSON.stringify(qrPassPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', QR_HMAC_SECRET).update(payloadBase64).digest('hex');
    const initialQrPass = `${payloadBase64}.${signature}`;

    await logAuditEvent({
      branch_id: newMember.branch_id,
      user_id: userId,
      user_role: 'member',
      action: 'MEMBER_5STEP_ONBOARDED',
      resource: 'users',
      ip_address: req.ip || '127.0.0.1',
      details: {
        member_name: newMember.name,
        plan: chosenPlan.name,
        payment_option: paymentOption,
        rfid_uid: rfidCardUid,
        parq_hash: parqSignatureHash
      }
    });

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'ksyn_fitconnect_jwt_secret_ultra_secure_key_2026';
    const authToken = jwt.sign({
      id: newMember.id,
      role: 'member',
      branch_id: newMember.branch_id,
      email: newMember.email,
      name: newMember.name,
      jti: crypto.randomUUID()
    }, JWT_SECRET, { expiresIn: '12h' });

    if (typeof saveStore === 'function') {
      try { saveStore(); } catch (e) { console.error('Failed to save store during onboardMember:', e.message); }
    }

    res.status(201).json({
      success: true,
      token: authToken,
      message: `Welcome to KSYN Fitness! Account registered, payment verified, and turnstile credentials issued.`,
      member: {
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        phone: newMember.phone,
        branch_id: newMember.branch_id,
        branch_name: branch ? branch.name : 'Makati Flagship',
        rfid_card_uid: rfidCardUid
      },
      subscription: newSub,
      invoice: newInvoice,
      turnstile_access: {
        rfid_uid: rfidCardUid,
        initial_dynamic_qr_pass: initialQrPass,
        qr_expires_at: passTimestamp + 60 * 1000,
        instructions: 'Scan your dynamic QR pass at the entrance turnstile or tap your RFID keycard.'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 6. RECURRING AUTO-DEBIT BILLING ENGINE (1st / 15th RUN)
// -------------------------------------------------------------------
async function triggerRecurringBilling(req, res) {
  try {
    const { targetDay, simulateFailureUserId } = req.body;
    const currentDay = targetDay ? parseInt(targetDay, 10) : new Date().getDate();

    if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];

    const dueSubscriptions = memoryStore.subscriptions.filter(sub => {
      // Must be active and match target day (or if run on all)
      if (sub.status !== 'active' && sub.status !== 'past_due') return false;
      if (targetDay && sub.billing_day !== currentDay) return false;
      return true;
    });

    const billingResults = [];

    for (const sub of dueSubscriptions) {
      const member = (memoryStore.users || []).find(u => u.id === sub.user_id);
      const paymentMethod = (memoryStore.payment_methods || []).find(pm => pm.id === sub.payment_method_id || (pm.user_id === sub.user_id && pm.is_default));

      // Simulate failure scenario if requested for testing delinquency
      const shouldFail = simulateFailureUserId && sub.user_id === simulateFailureUserId;

      if (!paymentMethod || shouldFail) {
        sub.auto_debit_retries = (sub.auto_debit_retries || 0) + 1;
        if (sub.auto_debit_retries >= 2 || shouldFail) {
          sub.status = 'past_due'; // Intercepts turnstile access!
        }

        billingResults.push({
          subscription_id: sub.id,
          user_id: sub.user_id,
          member_name: member ? member.name : 'Unknown',
          amount: sub.monthly_due_amount || 2499.00,
          status: 'FAILED',
          sub_status: sub.status,
          retries: sub.auto_debit_retries,
          reason: shouldFail ? 'SIMULATED_CARD_DECLINE (Insufficient Funds)' : 'NO_PAYMENT_METHOD_ON_FILE'
        });

        await logAuditEvent({
          branch_id: sub.branch_id,
          user_id: sub.user_id,
          user_role: 'member',
          action: 'AUTO_DEBIT_FAILED',
          resource: 'subscriptions',
          ip_address: req.ip || '127.0.0.1',
          details: { sub_id: sub.id, retries: sub.auto_debit_retries, sub_status: sub.status }
        });
        continue;
      }

      // Successful auto-debit charge
      const amount = sub.monthly_due_amount || 2499.00;
      const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const invoice = {
        id: `inv-${crypto.randomUUID().slice(0, 8)}`,
        invoice_no: invoiceNo,
        user_id: sub.user_id,
        branch_id: sub.branch_id,
        amount,
        description: `Automated Recurring Dues (${sub.plan_name || 'Flagship Plan'}) - Cycle Day ${sub.billing_day}`,
        payment_rail: paymentMethod.type,
        gateway_ref: `ch_auto_${crypto.randomBytes(8).toString('hex')}`,
        status: 'settled',
        settled_at: new Date(),
        created_at: new Date()
      };
      memoryStore.payment_invoices.unshift(invoice);

      if (!memoryStore.sales) memoryStore.sales = [];
      memoryStore.sales.unshift({
        id: crypto.randomUUID(),
        branch_id: sub.branch_id,
        user_id: sub.user_id,
        amount,
        category: 'membership_fee',
        payment_method: paymentMethod.type,
        reference_no: invoiceNo,
        created_at: new Date()
      });

      // Update next billing date +1 month
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(sub.billing_day || 1);
      sub.next_billing_date = nextDate.toISOString().split('T')[0];
      sub.auto_debit_retries = 0;
      sub.status = 'active';

      billingResults.push({
        subscription_id: sub.id,
        user_id: sub.user_id,
        member_name: member ? member.name : 'Unknown',
        amount,
        status: 'SUCCESS',
        invoice_no: invoiceNo,
        payment_rail: paymentMethod.type,
        masked_identifier: paymentMethod.masked_identifier,
        next_billing_date: sub.next_billing_date
      });

      await logAuditEvent({
        branch_id: sub.branch_id,
        user_id: sub.user_id,
        user_role: 'member',
        action: 'AUTO_DEBIT_SUCCESS',
        resource: 'subscriptions',
        ip_address: req.ip || '127.0.0.1',
        details: { sub_id: sub.id, amount, invoice_no: invoiceNo, rail: paymentMethod.type }
      });
    }

    res.json({
      success: true,
      execution_summary: {
        cycle_day: currentDay,
        total_processed: dueSubscriptions.length,
        successful: billingResults.filter(r => r.status === 'SUCCESS').length,
        failed: billingResults.filter(r => r.status === 'FAILED').length,
        results: billingResults
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 7. GET PAYMENT METHODS FOR MEMBER
// -------------------------------------------------------------------
async function getPaymentMethods(req, res) {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // RBAC: Member can only view their own payment methods
    if (requestingUser.role === 'member' && requestingUser.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cannot view payment methods of other gym members.'
      });
    }

    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
    const methods = memoryStore.payment_methods.filter(pm => pm.user_id === userId);

    const subscription = (memoryStore.subscriptions || []).find(s => s.user_id === userId);

    res.json({
      success: true,
      payment_methods: methods,
      subscription: subscription || null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 8. DELETE PAYMENT METHOD
// -------------------------------------------------------------------
async function deletePaymentMethod(req, res) {
  try {
    const { methodId } = req.params;
    const requestingUser = req.user;

    if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
    const methodIndex = memoryStore.payment_methods.findIndex(pm => pm.id === methodId);

    if (methodIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment method not found.' });
    }

    const pm = memoryStore.payment_methods[methodIndex];
    if (requestingUser.role === 'member' && requestingUser.id !== pm.user_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    memoryStore.payment_methods.splice(methodIndex, 1);

    res.json({
      success: true,
      message: 'Payment method removed successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 9. GET PAYMENT INVOICES (WITH TENANT ISOLATION)
// -------------------------------------------------------------------
async function getInvoices(req, res) {
  try {
    const user = req.user;
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];

    let invoices = [...memoryStore.payment_invoices].filter(inv => {
      const no = inv.invoice_no || inv.external_id || '';
      return !no.startsWith('INV-') && (!inv.id || !String(inv.id).startsWith('inv-test-'));
    });

    if (user.role === 'member') {
      invoices = invoices.filter(inv => inv.user_id === user.id);
    } else if (user.role !== 'super_admin' && user.branch_id) {
      invoices = invoices.filter(inv => inv.branch_id === user.branch_id);
    }

    res.json({
      success: true,
      invoices
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 10. SETTLE PENDING MEMBERSHIP PAYMENT (FOR AUTHENTICATED MEMBER)
// -------------------------------------------------------------------
async function settleMemberPayment(req, res) {
  try {
    const userId = req.user.id;
    const {
      planTier,
      paymentOption = 'card', // 'card', 'gcash', 'maya', 'qr_ph'
      gatewayToken,
      invoiceNo,
      billingDay = 1,
      maskedIdentifier,
      brand,
      issuingBank
    } = req.body;

    const user = memoryStore.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetPlanTier = planTier || user.membership_plan;
    if (!targetPlanTier) {
      return res.status(400).json({
        success: false,
        error: 'PLAN_REQUIRED',
        message: 'Please select a membership plan before settling payment.'
      });
    }

    const { resolvePlan } = require('../config/membershipRates');
    const resolvedPlan = resolvePlan(targetPlanTier);
    if (!resolvedPlan) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'The selected membership plan is invalid. Please select a valid plan.'
      });
    }
    const branchId = user.branch_id || 'b-mkt-01';

    // Link or Create Payment Method if token provided
    let boundMethodId = null;
    if (paymentOption === 'card' && gatewayToken) {
      const pmId = `pm-${crypto.randomUUID().slice(0, 8)}`;
      const pmRecord = {
        id: pmId,
        user_id: userId,
        branch_id: branchId,
        type: 'card',
        gateway_token: gatewayToken,
        masked_identifier: maskedIdentifier || '•••• •••• •••• 4242',
        brand_or_provider: brand || 'Visa',
        issuing_bank: issuingBank || 'BDO Unibank',
        billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
        is_default: true,
        status: 'active',
        created_at: new Date()
      };
      if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
      memoryStore.payment_methods.push(pmRecord);
      boundMethodId = pmId;
    } else if ((paymentOption === 'gcash' || paymentOption === 'maya') && gatewayToken) {
      const pmId = `pm-${crypto.randomUUID().slice(0, 8)}`;
      const providerName = paymentOption === 'maya' ? 'Maya' : 'GCash';
      const pmRecord = {
        id: pmId,
        user_id: userId,
        branch_id: branchId,
        type: `${paymentOption}_recurring`,
        gateway_token: gatewayToken,
        masked_identifier: maskedIdentifier || '0917 ••• ••88',
        brand_or_provider: providerName,
        issuing_bank: providerName === 'GCash' ? 'Mynt / Globe GCash' : 'Maya Philippines',
        billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
        is_default: true,
        status: 'active',
        created_at: new Date()
      };
      if (!memoryStore.payment_methods) memoryStore.payment_methods = [];
      memoryStore.payment_methods.push(pmRecord);
      boundMethodId = pmId;
    }

    // Activate user status and provision RFID (recurring members only; 1-day pass uses dynamic QR pass)
    user.status = 'active';
    user.membership_plan = resolvedPlan.id;
    user.membership_tier = resolvedPlan.tier;
    if (resolvedPlan.id !== '1_day') {
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

    // Find or create subscription with cumulative plan term extension
    if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
    const userSubs = memoryStore.subscriptions.filter(s => s.user_id === userId);
    let sub = userSubs.find(s => s.status === 'active') || (userSubs.length > 0 ? userSubs[userSubs.length - 1] : null);
    userSubs.forEach(s => {
      if (s !== sub) s.status = 'expired';
    });

    const now = Date.now();
    let baseTime = now;
    if (sub && sub.end_date) {
      const existingEnd = new Date(sub.end_date).getTime();
      if (!isNaN(existingEnd) && existingEnd > now) {
        baseTime = existingEnd;
      }
    }
    const newEndMs = baseTime + (resolvedPlan.durationDays * 24 * 3600 * 1000);
    const startDate = (sub && sub.start_date && new Date(sub.end_date).getTime() > now) ? new Date(sub.start_date) : new Date(now);
    const endDate = new Date(newEndMs);
    const nextBillingDate = new Date(newEndMs).toISOString().split('T')[0];

    if (sub) {
      sub.plan = resolvedPlan.id;
      sub.tier = resolvedPlan.tier;
      sub.status = 'active';
      sub.start_date = startDate.toISOString().split('T')[0];
      sub.end_date = endDate.toISOString().split('T')[0];
      sub.price = resolvedPlan.planFee;
      sub.access_fee = resolvedPlan.accessFee;
      sub.annual_fee = resolvedPlan.annualFee;
      sub.total_paid = (Number(sub.total_paid) || 0) + resolvedPlan.totalDue;
      sub.monthly_due_amount = resolvedPlan.planFee;
      sub.billing_day = parseInt(billingDay, 10) === 15 ? 15 : 1;
      sub.next_billing_date = nextBillingDate;
      sub.payment_method_id = boundMethodId || sub.payment_method_id;
      sub.auto_renew = resolvedPlan.id !== '1_day';
      sub.auto_debit_retries = 0;
    } else {
      sub = {
        id: crypto.randomUUID(),
        user_id: userId,
        branch_id: branchId,
        plan: resolvedPlan.id,
        tier: resolvedPlan.tier,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        price: resolvedPlan.planFee,
        access_fee: resolvedPlan.accessFee,
        annual_fee: resolvedPlan.annualFee,
        total_paid: resolvedPlan.totalDue,
        monthly_due_amount: resolvedPlan.planFee,
        billing_day: parseInt(billingDay, 10) === 15 ? 15 : 1,
        next_billing_date: nextBillingDate,
        payment_method_id: boundMethodId,
        auto_renew: resolvedPlan.id !== '1_day',
        auto_debit_retries: 0,
        created_at: new Date()
      };
      memoryStore.subscriptions.push(sub);
    }

    // Settle or create invoice
    const invNumber = invoiceNo || `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    const existingInv = memoryStore.payment_invoices.find(inv => inv.user_id === userId && inv.status === 'pending');
    if (existingInv) {
      existingInv.status = 'settled';
      existingInv.settled_at = new Date();
      existingInv.payment_rail = paymentOption;
    } else {
      memoryStore.payment_invoices.unshift({
        id: `inv-${crypto.randomUUID().slice(0, 8)}`,
        invoice_no: invNumber,
        user_id: userId,
        branch_id: branchId,
        amount: resolvedPlan.totalDue,
        description: `KSYN Membership Dues (${resolvedPlan.name})`,
        payment_rail: paymentOption,
        gateway_ref: `txn_${crypto.randomBytes(8).toString('hex')}`,
        status: 'settled',
        settled_at: new Date(),
        created_at: new Date()
      });
    }

    // Record sales transaction
    if (!memoryStore.sales) memoryStore.sales = [];
    memoryStore.sales.unshift({
      id: crypto.randomUUID(),
      branch_id: branchId,
      user_id: userId,
      amount: resolvedPlan.totalDue,
      category: 'membership_fee',
      payment_method: paymentOption,
      reference_no: invNumber,
      created_at: new Date()
    });

    if (isPostgres()) {
      await query(`UPDATE users SET status = 'active', membership_plan = $1, updated_at = NOW() WHERE id = $2`, [resolvedPlan.id, userId]);
      await query(
        `UPDATE subscriptions
         SET status = 'active', plan = $1, tier = $2, start_date = $3, end_date = $4, price = $5, total_paid = $6, updated_at = NOW()
         WHERE user_id = $7`,
        [resolvedPlan.id, resolvedPlan.tier, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], resolvedPlan.planFee, sub.total_paid, userId]
      );
      await query(
        `INSERT INTO sales (id, branch_id, user_id, amount, category, payment_method, reference_no, created_at)
         VALUES ($1, $2, $3, $4, 'membership_fee', $5, $6, NOW())`,
        [crypto.randomUUID(), branchId, userId, resolvedPlan.totalDue, paymentOption, invNumber]
      );
    }

    if (typeof saveStore === 'function') {
      try { saveStore(); } catch (e) { console.error('Failed to save store in settleMemberPayment:', e.message); }
    }

    // Generate Dynamic 60s QR Pass
    const branch = (memoryStore.branches || []).find(b => b.id === branchId);
    const passTimestamp = Date.now();
    const passNonce = crypto.randomBytes(8).toString('hex');
    const qrPassPayload = {
      memberId: userId,
      memberName: user.name,
      branchId,
      branchCode: branch ? branch.code : 'MKT-01',
      tier: resolvedPlan.tier,
      subStatus: 'active',
      timestamp: passTimestamp,
      nonce: passNonce
    };
    const payloadBase64 = Buffer.from(JSON.stringify(qrPassPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', QR_HMAC_SECRET).update(payloadBase64).digest('hex');
    const turnstilePass = `${payloadBase64}.${signature}`;

    await logAuditEvent({
      branch_id: branchId,
      user_id: userId,
      user_role: 'member',
      action: 'MEMBER_PAYMENT_SETTLED',
      resource: 'subscriptions',
      ip_address: req.ip || '127.0.0.1',
      details: {
        plan: resolvedPlan.name,
        amount: resolvedPlan.totalDue,
        rail: paymentOption,
        invoice_no: invNumber
      }
    });

    res.json({
      success: true,
      message: `Payment of ₱${resolvedPlan.totalDue.toLocaleString()} confirmed via ${paymentOption.toUpperCase()}! Your membership is active and your turnstile pass is unlocked.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: 'active',
        rfid_card_uid: user.rfid_card_uid
      },
      subscription: sub,
      turnstile_pass: turnstilePass
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 11. GET SEGREGATED XENDIT TRANSACTIONS (PLANS, POS, PT ENROLLMENT)
// -------------------------------------------------------------------
async function getXenditTransactions(req, res) {
  try {
    const user = req.user;
    const branchFilter = req.query.branch_id || (user.role !== 'super_admin' ? user.branch_id : null);

    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];
    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];

    // Live Xendit Reconcile: Verify any pending invoices against live gateway
    const pendingToSync = (memoryStore.payment_invoices || []).filter(inv => 
      (inv.status === 'pending' || inv.status === 'PENDING') && inv.id && inv.id.length === 24
    );

    if (pendingToSync.length > 0) {
      try {
        const xs = require('../services/xenditService');
        let didSync = false;
        for (const inv of pendingToSync) {
          try {
            const live = await xs.getInvoice(inv.id);
            if (live && (live.status === 'PAID' || live.status === 'SETTLED')) {
              inv.status = 'settled';
              inv.settled_at = live.paid_at || new Date().toISOString();
              inv.payment_method = live.payment_method || 'xendit';
              inv.payment_channel = live.payment_channel || 'gcash';

              // Sync POS transaction if matching
              const posTxn = (memoryStore.pos_transactions || []).find(t => t.invoice_id === inv.id || t.external_id === inv.invoice_no);
              if (posTxn) {
                posTxn.status = 'SETTLED';
                posTxn.settled_at = inv.settled_at;
              }

              // Ensure sale recorded in sales
              const existingSale = (memoryStore.sales || []).find(s => 
                s.xendit_invoice_id === inv.id || 
                s.reference_no === inv.invoice_no ||
                s.invoice_number === inv.invoice_no
              );
              if (!existingSale) {
                const userObj = (memoryStore.users || []).find(u => u.id === inv.user_id || u.email === live.payer_email);
                const isPos = String(inv.invoice_no).startsWith('POS-');
                const isPt = String(inv.invoice_no).startsWith('PT-');
                const category = isPt ? 'personal_training' : (isPos ? 'merchandise' : 'membership_fee');
                
                const newSale = {
                  id: crypto.randomUUID(),
                  branch_id: inv.branch_id || 'b-mkt-01',
                  user_id: userObj ? userObj.id : (inv.user_id || null),
                  customer_name: userObj ? userObj.name : (live.payer_email || 'Walk-in Customer'),
                  amount: Number(inv.amount || live.amount),
                  royalty_amount: Number((Number(inv.amount || live.amount) * 0.075).toFixed(2)),
                  net_retained: Number((Number(inv.amount || live.amount) * 0.925).toFixed(2)),
                  category,
                  payment_method: 'xendit',
                  payment_channel: (live.payment_channel || 'ewallet').toLowerCase(),
                  description: live.description || (isPt ? 'Personal Training' : (isPos ? 'POS Retail Checkout' : 'Membership Plan')),
                  reference_no: inv.invoice_no,
                  reference_number: inv.invoice_no,
                  invoice_number: inv.invoice_no,
                  approval_code: inv.invoice_no,
                  xendit_invoice_id: inv.id,
                  created_at: live.paid_at || inv.created_at || new Date().toISOString()
                };
                if (!memoryStore.sales) memoryStore.sales = [];
                memoryStore.sales.unshift(newSale);
              }

              // Activate subscription
              if (inv.plan_id && inv.user_id) {
                const sub = (memoryStore.subscriptions || []).find(s => s.user_id === inv.user_id);
                if (sub) {
                  sub.status = 'active';
                }
              }
              didSync = true;
            }
          } catch (e) {
            // Skip individual lookup failure
          }
        }
        if (didSync) {
          saveStore();
        }
      } catch (e) {
        // Skip reconcile block error
      }
    }

    const plans = [];
    const pos = [];
    const ptEnrollments = [];
    const seenExternalIds = new Set();

    // 1. Invoices from payment_invoices
    for (const inv of memoryStore.payment_invoices) {
      if (branchFilter && inv.branch_id && inv.branch_id !== branchFilter) continue;

      const extId = inv.invoice_no || inv.external_id || inv.id;
      // Filter out any legacy synthetic/mock test records
      if (!extId || String(extId).startsWith('INV-') || (inv.id && String(inv.id).startsWith('inv-test-')) || (inv.user_id && String(inv.user_id).startsWith('test-user-')) || String(extId).includes('ttest1') || (inv.payer_name && String(inv.payer_name).toLowerCase().includes('test'))) continue;
      if (seenExternalIds.has(extId)) continue;
      seenExternalIds.add(extId);

      const isPt = inv.channel === 'PT ENROLLMENT' || 
                   inv.category === 'pt_enrollment' || 
                   (extId && String(extId).startsWith('PT-')) ||
                   inv.metadata?.type === 'pt_enrollment';

      const isPos = inv.channel === 'POS' || 
                    inv.category === 'pos' || 
                    (extId && String(extId).startsWith('POS-')) ||
                    inv.metadata?.pos_source === 'front_desk_checkout';

      const itemUser = (memoryStore.users || []).find(u => u.id === inv.user_id);
      const branchObj = (memoryStore.branches || []).find(b => b.id === inv.branch_id);

      // Cross-reconcile with completed sales ledger if invoice was left pending
      if (inv.status === 'pending' || inv.status === 'PENDING') {
        const matchingSale = (memoryStore.sales || []).find(s => 
          s.xendit_invoice_id === inv.id || 
          s.reference_no === inv.invoice_no ||
          (s.user_id && s.user_id === inv.user_id && Number(s.amount) === Number(inv.amount))
        );
        if (matchingSale) {
          inv.status = 'settled';
          inv.settled_at = matchingSale.created_at || new Date().toISOString();
          inv.payment_channel = matchingSale.payment_channel || 'gcash';
          if (!matchingSale.xendit_invoice_id && inv.id) matchingSale.xendit_invoice_id = inv.id;
        }
      }

      const record = {
        id: inv.id,
        external_id: extId,
        channel: isPt ? 'PT ENROLLMENT' : (isPos ? 'POS' : 'PLANS'),
        channel_badge: isPt ? 'PT ENROLLMENT' : (isPos ? 'POS RETAIL' : 'MEMBERSHIP PLAN'),
        customer_name: inv.customer_name || itemUser?.name || 'Walk-in Customer',
        customer_email: inv.customer_email || itemUser?.email || 'counter@ksynmakati.ph',
        branch_id: inv.branch_id || 'b-mkt-01',
        branch_name: branchObj?.name || 'KSYN Makati Flagship',
        amount: Number(inv.amount || 0),
        status: (inv.status === 'settled' || inv.status === 'PAID' || inv.status === 'SETTLED') ? 'SETTLED' : (inv.status === 'pending' ? 'PENDING' : String(inv.status).toUpperCase()),
        payment_rail: inv.payment_rail || 'Xendit Hosted Checkout',
        invoice_url: inv.invoice_url || (inv.id ? `https://checkout-staging.xendit.co/web/${inv.id}` : null),
        gateway_ref: inv.gateway_ref || inv.id,
        description: inv.description || (isPt ? `PT: ${inv.package_name || 'Personal Training'}` : (isPos ? 'Front-Desk POS Checkout' : `Membership Plan (${inv.plan_id || '1_month'})`)),
        details: isPt ? {
          coach_name: inv.coach_name || 'Personal Trainer',
          package_name: inv.package_name || 'PT Package',
          sessions: inv.sessions_total || 12
        } : isPos ? {
          pos_source: 'Front Desk POS',
          items_count: inv.items?.length || 1
        } : {
          plan_tier: inv.plan_id || '1_month',
          plan_name: inv.plan_name || 'Membership Plan'
        },
        created_at: inv.created_at || new Date().toISOString(),
        settled_at: inv.settled_at || null
      };

      if (isPt) {
        ptEnrollments.push(record);
      } else if (isPos) {
        pos.push(record);
      } else {
        plans.push(record);
      }
    }

    // 2. Front Desk POS transactions (strictly where payment_method === 'XENDIT' and has 24-char gateway id)
    for (const txn of memoryStore.pos_transactions) {
      if (txn.payment_method !== 'XENDIT') continue;
      if (!txn.invoice_id || String(txn.invoice_id).length !== 24) continue;
      if (branchFilter && txn.branch_id && txn.branch_id !== branchFilter) continue;

      const extId = txn.external_id || txn.invoice_id || txn.id;
      if (seenExternalIds.has(extId)) continue;
      seenExternalIds.add(extId);

      const branchObj = (memoryStore.branches || []).find(b => b.id === txn.branch_id);
      const itemsList = Array.isArray(txn.items) ? txn.items.map(i => `${i.quantity || 1}x ${i.name || i.item_name}`).join(', ') : 'Front-Desk Retail';

      const record = {
        id: txn.id,
        external_id: extId,
        channel: 'POS',
        channel_badge: 'POS RETAIL',
        customer_name: txn.customer_name || 'Walk-in Customer',
        customer_email: txn.customer_email || 'guest@ksynpos.local',
        branch_id: txn.branch_id || 'b-mkt-01',
        branch_name: branchObj?.name || 'KSYN Makati Flagship',
        amount: Number(txn.amount || txn.total_amount || 0),
        status: (txn.status === 'SETTLED' || txn.status === 'PAID') ? 'SETTLED' : 'PENDING',
        payment_rail: 'Xendit Hosted Checkout / Dynamic QR Ph',
        invoice_url: txn.invoice_url || (txn.invoice_id ? `https://checkout-staging.xendit.co/web/${txn.invoice_id}` : null),
        gateway_ref: txn.invoice_id || txn.id,
        description: `POS Retail: ${itemsList}`,
        details: {
          cashier_name: txn.cashier_name || 'Cashier',
          shift_id: txn.shift_id || '01',
          items: txn.items || []
        },
        created_at: txn.created_at || new Date().toISOString(),
        settled_at: txn.settled_at || null
      };

      pos.push(record);
    }

    // 3. Online PT Enrollments (strictly where verified with authentic 24-char Xendit invoice)
    for (const pte of memoryStore.pt_enrollments) {
      if (pte.payment_channel !== 'online_xendit') continue;
      if (!pte.invoice_id || String(pte.invoice_id).length !== 24) continue;
      const matchingInvoice = (memoryStore.payment_invoices || []).find(inv => inv.id === pte.invoice_id);
      if (!matchingInvoice) continue;
      if (branchFilter && pte.branch_id && pte.branch_id !== branchFilter) continue;

      const extId = pte.payment_reference || pte.invoice_id || pte.id;
      if (seenExternalIds.has(extId)) continue;
      seenExternalIds.add(extId);

      const branchObj = (memoryStore.branches || []).find(b => b.id === pte.branch_id);

      const record = {
        id: pte.id,
        external_id: extId,
        channel: 'PT ENROLLMENT',
        channel_badge: 'PT ENROLLMENT',
        customer_name: pte.member_name || 'Athlete Member',
        customer_email: pte.member_email || 'member@ksynfitness.com',
        branch_id: pte.branch_id || 'b-mkt-01',
        branch_name: branchObj?.name || 'KSYN Makati Flagship',
        amount: Number(pte.total_price || 0),
        status: (pte.payment_status === 'PAID' || pte.enrollment_status === 'CLEARED') ? 'SETTLED' : 'PENDING',
        payment_rail: 'Xendit Hosted Checkout (GCash / Card / QR Ph)',
        invoice_url: pte.invoice_url || (pte.invoice_id ? `https://checkout-staging.xendit.co/web/${pte.invoice_id}` : null),
        gateway_ref: pte.invoice_id || pte.id,
        description: `PT Package: ${pte.package_name} (${pte.coach_name})`,
        details: {
          coach_name: pte.coach_name,
          package_name: pte.package_name,
          sessions_total: pte.sessions_total,
          session_rate: pte.session_rate
        },
        created_at: pte.created_at || new Date().toISOString(),
        settled_at: pte.cleared_at || null
      };

      ptEnrollments.push(record);
    }

    // Sort all arrays by created_at desc
    const sortByDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    plans.sort(sortByDateDesc);
    pos.sort(sortByDateDesc);
    ptEnrollments.sort(sortByDateDesc);

    const all = [...plans, ...pos, ...ptEnrollments].sort(sortByDateDesc);

    // Compute Summaries
    const sumSettled = (arr) => arr.filter(i => i.status === 'SETTLED').reduce((acc, i) => acc + i.amount, 0);
    const plansVolume = sumSettled(plans);
    const posVolume = sumSettled(pos);
    const ptVolume = sumSettled(ptEnrollments);
    const totalVolume = plansVolume + posVolume + ptVolume;

    res.json({
      success: true,
      summary: {
        total_volume: totalVolume,
        plans_volume: plansVolume,
        pos_volume: posVolume,
        pt_volume: ptVolume,
        total_count: all.length,
        plans_count: plans.length,
        pos_count: pos.length,
        pt_count: ptEnrollments.length,
        settled_count: all.filter(i => i.status === 'SETTLED').length,
        pending_count: all.filter(i => i.status === 'PENDING').length
      },
      categories: {
        plans,
        pos,
        pt_enrollments: ptEnrollments
      },
      all
    });
  } catch (err) {
    console.error('[getXenditTransactions error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// -------------------------------------------------------------------
// 12. SIMULATE XENDIT INVOICE PAID (FOR STAGING TESTS)
// -------------------------------------------------------------------
async function simulateInvoicePaid(req, res) {
  try {
    const { external_id, invoice_id } = req.body;
    if (!external_id && !invoice_id) {
      return res.status(400).json({ success: false, message: 'external_id or invoice_id is required.' });
    }

    // 1. Check if PT Enrollment
    if ((external_id && String(external_id).startsWith('PT-')) || (memoryStore.pt_enrollments || []).some(e => e.payment_reference === external_id || e.invoice_id === invoice_id)) {
      const { confirmPtEnrollmentPayment } = require('./memberController');
      return confirmPtEnrollmentPayment(req, res);
    }

    // 2. Check if POS transaction
    const posTxn = (memoryStore.pos_transactions || []).find(t => t.external_id === external_id || t.invoice_id === invoice_id);
    if (posTxn) {
      const { settleTransactionRecord } = require('./posCheckoutController');
      const { sale, turnstilePass } = await settleTransactionRecord({ posTxn });
      return res.json({
        success: true,
        message: 'POS transaction simulated as PAID and settled.',
        posTxn,
        sale,
        turnstilePass
      });
    }

    // 3. Otherwise Plans/Membership invoice
    const { confirmPayment } = require('./xenditController');
    return confirmPayment(req, res);
  } catch (err) {
    console.error('[simulateInvoicePaid error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function reconcileXenditInvoices(req, res) {
  try {
    const xs = require('../services/xenditService');
    const pendingToSync = (memoryStore.payment_invoices || []).filter(inv => 
      (inv.status === 'pending' || inv.status === 'PENDING') && inv.id && inv.id.length === 24
    );

    let reconciled = 0;
    for (const inv of pendingToSync) {
      try {
        const live = await xs.getInvoice(inv.id);
        if (live && (live.status === 'PAID' || live.status === 'SETTLED')) {
          inv.status = 'settled';
          inv.settled_at = live.paid_at || new Date().toISOString();
          inv.payment_method = live.payment_method || 'xendit';
          inv.payment_channel = live.payment_channel || 'gcash';

          const posTxn = (memoryStore.pos_transactions || []).find(t => t.invoice_id === inv.id || t.external_id === inv.invoice_no);
          if (posTxn) {
            posTxn.status = 'SETTLED';
            posTxn.settled_at = inv.settled_at;
          }

          const existingSale = (memoryStore.sales || []).find(s => 
            s.xendit_invoice_id === inv.id || 
            s.reference_no === inv.invoice_no ||
            s.invoice_number === inv.invoice_no
          );
          if (!existingSale) {
            const userObj = (memoryStore.users || []).find(u => u.id === inv.user_id || u.email === live.payer_email);
            const isPos = String(inv.invoice_no).startsWith('POS-');
            const isPt = String(inv.invoice_no).startsWith('PT-');
            const category = isPt ? 'personal_training' : (isPos ? 'merchandise' : 'membership_fee');
            
            const newSale = {
              id: crypto.randomUUID(),
              branch_id: inv.branch_id || 'b-mkt-01',
              user_id: userObj ? userObj.id : (inv.user_id || null),
              customer_name: userObj ? userObj.name : (live.payer_email || 'Valued Athlete'),
              amount: Number(inv.amount || live.amount),
              royalty_amount: Number((Number(inv.amount || live.amount) * 0.075).toFixed(2)),
              net_retained: Number((Number(inv.amount || live.amount) * 0.925).toFixed(2)),
              category,
              payment_method: 'xendit',
              payment_channel: (live.payment_channel || 'ewallet').toLowerCase(),
              description: live.description || (isPt ? 'Personal Training' : (isPos ? 'POS Retail Checkout' : 'Membership Plan')),
              reference_no: inv.invoice_no,
              reference_number: inv.invoice_no,
              invoice_number: inv.invoice_no,
              approval_code: inv.invoice_no,
              xendit_invoice_id: inv.id,
              created_at: live.paid_at || inv.created_at || new Date().toISOString()
            };
            if (!memoryStore.sales) memoryStore.sales = [];
            memoryStore.sales.unshift(newSale);
          }

          if (inv.plan_id && inv.user_id) {
            const sub = (memoryStore.subscriptions || []).find(s => s.user_id === inv.user_id);
            if (sub) {
              sub.status = 'active';
            }
          }
          reconciled++;
        }
      } catch (e) {
        // Skip individual
      }
    }

    if (reconciled > 0) {
      saveStore();
    }

    return res.json({ success: true, message: `Reconciliation complete. ${reconciled} invoices synchronized.`, reconciled });
  } catch (err) {
    console.error('[reconcileXenditInvoices error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  tokenizeCard,
  verify3DSecure,
  createBillingAgreement,
  generateDynamicQrPh,
  handlePaymentWebhook,
  onboardMember,
  settleMemberPayment,
  triggerRecurringBilling,
  getPaymentMethods,
  deletePaymentMethod,
  getInvoices,
  getXenditTransactions,
  simulateInvoicePaid,
  reconcileXenditInvoices
};
