const crypto = require('crypto');
const xenditService = require('../services/xenditService');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { generateExternalId, getBranchCode, formatStreamDescription } = require('../utils/transactionStreams');

const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'ksyn-turnstile-hmac-secret-key-2026';

/**
 * Generate 60-second dynamic optical turnstile QR entry pass for walk-in day pass
 */
function generateWalkInTurnstilePass({ guestName, branchId, branchCode }) {
  const passTimestamp = Date.now();
  const passNonce = crypto.randomBytes(8).toString('hex');
  const tempUserId = `walkin_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const qrPassPayload = {
    memberId: tempUserId,
    memberName: guestName || 'Walk-in Athlete',
    branchId: branchId || 'b-mkt-01',
    branchCode: branchCode || 'MKT-01',
    tier: 'day_pass',
    subStatus: 'active',
    isWalkInPass: true,
    timestamp: passTimestamp,
    nonce: passNonce
  };
  const payloadBase64 = Buffer.from(JSON.stringify(qrPassPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', QR_HMAC_SECRET).update(payloadBase64).digest('hex');
  return {
    rawPass: `${payloadBase64}.${signature}`,
    tempUserId,
    payload: qrPassPayload
  };
}

/**
 * Internal Helper: Settle POS Transaction & Record in Sales Ledger
 */
async function settleTransactionRecord({ posTxn, xenditData = null, cashierUser = null }) {
  if (!memoryStore.sales) memoryStore.sales = [];
  if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];

  const existingSale = memoryStore.sales.find(s => 
    (posTxn.external_id && s.reference_no === posTxn.external_id) ||
    (posTxn.invoice_id && s.reference_no === posTxn.invoice_id)
  );

  if (existingSale) {
    posTxn.status = 'SETTLED';
    posTxn.sale = existingSale;
    return { sale: existingSale, turnstilePass: posTxn.turnstile_pass };
  }

  const branch = (memoryStore.branches || []).find(b => b.id === posTxn.branch_id);
  const branchCode = branch ? branch.code : 'POS';
  const paymentChannel = (xenditData?.payment_channel || xenditData?.payment_method || posTxn.payment_method || 'xendit').toLowerCase();

  // Deduct inventory items
  if (Array.isArray(posTxn.items) && posTxn.items.length > 0 && memoryStore.inventory) {
    posTxn.items.forEach(cartItem => {
      const invItem = memoryStore.inventory.find(i => 
        (cartItem.id && i.id === cartItem.id) ||
        (cartItem.sku && i.sku === cartItem.sku) ||
        (cartItem.name && i.item_name && i.item_name.toLowerCase() === cartItem.name.toLowerCase())
      );
      if (invItem && invItem.category !== 'passes') {
        const qtyToDeduct = Number(cartItem.quantity) || 1;
        invItem.quantity = Math.max(0, invItem.quantity - qtyToDeduct);
        if (invItem.quantity <= invItem.reorder_threshold) {
          invItem.status = 'low_stock';
        }
        invItem.last_inspected_at = new Date();
      }
    });
  }

  // Check if items include Day Pass or Drop-In pass
  let turnstilePass = null;
  const hasDayPass = (posTxn.items || []).some(i => 
    (i.id && (i.id.includes('pass') || i.id.includes('day'))) ||
    (i.category === 'passes') ||
    (i.name && (i.name.toLowerCase().includes('pass') || i.name.toLowerCase().includes('drop-in') || i.name.toLowerCase().includes('walk-in')))
  );

  if (hasDayPass) {
    const passObj = generateWalkInTurnstilePass({
      guestName: posTxn.customer_name,
      branchId: posTxn.branch_id,
      branchCode
    });
    turnstilePass = passObj.rawPass;
    posTxn.turnstile_pass = turnstilePass;
  }

  // Check if items include PT session or PT package (use word boundary to avoid matching 'Optimum', 'Option', etc.)
  const hasPtSession = (posTxn.items || []).some(i => 
    (i.category === 'pt_packages' || i.category === 'pt') ||
    (i.id && (i.id.startsWith('pt-') || i.id === 'pt')) ||
    (i.name && (/\bpt\b/i.test(i.name) || /personal\s+training/i.test(i.name)))
  );

  if (hasPtSession && memoryStore.pt_enrollments) {
    const ptEnrollment = memoryStore.pt_enrollments.find(e => 
      e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' &&
      e.client_name && e.client_name.toLowerCase() === (posTxn.customer_name || '').toLowerCase()
    );
    if (ptEnrollment) {
      ptEnrollment.enrollment_status = 'CLEARED_ACTIVE';
      ptEnrollment.cleared_at = new Date().toISOString();
      ptEnrollment.payment_ref = posTxn.external_id || posTxn.invoice_id;
    }
  }

  // Generate BIR Monotonic Gapless Invoicing Record (BIR RR 9-2009)
  const invoiceService = require('../services/invoiceService');
  let birInvoice = null;
  try {
    birInvoice = await invoiceService.issueInvoiceRecord({
      branchCode,
      branchId: posTxn.branch_id,
      customerName: posTxn.customer_name || 'Walk-in Athlete',
      customerEmail: posTxn.customer_email || 'guest@ksynpos.local',
      cashierId: cashierUser?.id || posTxn.cashier_id,
      cashierName: cashierUser?.name || posTxn.cashier_name || 'Front Desk Cashier',
      shiftId: posTxn.shift_id,
      items: posTxn.items || [],
      grossAmount: Number(posTxn.amount),
      paymentMethod: posTxn.payment_method,
      paymentReference: posTxn.external_id || posTxn.invoice_id
    });
  } catch (invErr) {
    console.error('[BIR Invoicing Engine Warn]:', invErr.message);
  }

  // Construct official Sale object
  const royaltyVal = Number((Number(posTxn.amount) * 0.075).toFixed(2));
  const assignedInvoiceNo = birInvoice ? birInvoice.invoice_number : (posTxn.external_id || `TXN-${branchCode}-${Date.now().toString().slice(-6)}`);

  const newSale = {
    id: crypto.randomUUID(),
    shift_id: posTxn.shift_id || null,
    branch_id: posTxn.branch_id,
    user_id: posTxn.user_id || null,
    customer_name: posTxn.customer_name || 'Walk-in Athlete',
    amount: Number(posTxn.amount),
    royalty_amount: royaltyVal,
    net_retained: Number((Number(posTxn.amount) - royaltyVal).toFixed(2)),
    category: hasDayPass ? 'passes' : (hasPtSession ? 'pt_packages' : 'merchandise'),
    payment_method: posTxn.payment_method === 'CASH' ? 'cash' : 'xendit',
    payment_channel: paymentChannel,
    description: (posTxn.items || []).map(i => `${i.quantity || 1}x ${i.name}`).join(', ') || 'POS Front Desk Checkout',
    reference_no: posTxn.external_id || assignedInvoiceNo,
    reference_number: posTxn.external_id,
    invoice_number: assignedInvoiceNo,
    bir_invoice_number: assignedInvoiceNo,
    vat_taxable_sales: birInvoice ? birInvoice.vat_taxable_sales : Math.round((Number(posTxn.amount) / 1.12) * 100) / 100,
    vat_amount_12pct: birInvoice ? birInvoice.vat_amount_12pct : Math.round((Number(posTxn.amount) - (Number(posTxn.amount) / 1.12)) * 100) / 100,
    approval_code: posTxn.external_id,
    xendit_invoice_id: posTxn.invoice_id || undefined,
    items: posTxn.items || [],
    created_at: new Date()
  };

  memoryStore.sales.unshift(newSale);

  // Update active POS shift session
  if (posTxn.shift_id && memoryStore.pos_shifts) {
    const shift = memoryStore.pos_shifts.find(s => s.id === posTxn.shift_id);
    if (shift && shift.status === 'OPEN') {
      if (posTxn.payment_method === 'CASH') {
        shift.total_cash_sales = Math.round(((shift.total_cash_sales || 0) + posTxn.amount) * 100) / 100;
        shift.expected_cash_drawer = Math.round(((shift.opening_float || 0) + (shift.total_cash_sales || 0) - (shift.cash_drops || 0)) * 100) / 100;
      } else {
        // STRICT FINANCIAL GUARDRAIL (Requirement 3):
        // Xendit digital settlements only increment total_digital_sales.
        // DO NOT add to expected_cash_drawer or physical cash total!
        shift.total_digital_sales = Math.round(((shift.total_digital_sales || 0) + posTxn.amount) * 100) / 100;
      }
    }
  }

  // Update transaction state
  posTxn.status = 'SETTLED';
  posTxn.settled_at = new Date();
  posTxn.sale = newSale;

  // Persist store
  saveStore();

  return { sale: newSale, turnstilePass };
}

/**
 * 1. UNIFIED POS CHECKOUT CONTROLLER
 * POST /api/pos/checkout
 */
async function checkout(req, res) {
  try {
    const user = req.user || {};
    const {
      branchId,
      branch_id,
      cashierId,
      cashier_id,
      shiftSessionId,
      shift_id,
      items = [],
      totalAmount,
      amount,
      paymentMethod,
      payment_method,
      payment_channel,
      customerName,
      customer_name,
      customerEmail,
      customer_email,
      waiver,
      cash_tendered,
      change_due
    } = req.body;

    const targetBranchId = branchId || branch_id || user.branch_id || 'b-mkt-01';
    const targetCashierId = cashierId || cashier_id || user.id || 'cashier-01';
    const targetShiftId = shiftSessionId || shift_id || null;
    const effectiveCustomer = customerName || customer_name || 'Walk-in Athlete';
    const effectiveEmail = customerEmail || customer_email || 'guest@ksynpos.local';

    let computedAmount = totalAmount !== undefined ? Number(totalAmount) : (amount !== undefined ? Number(amount) : 0);
    if ((!computedAmount || isNaN(computedAmount)) && Array.isArray(items) && items.length > 0) {
      computedAmount = items.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * (Number(item.quantity) || 1)), 0);
    }

    if (!computedAmount || computedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive totalAmount is required.' });
    }

    const rawMethod = (paymentMethod || payment_method || payment_channel || 'cash').toUpperCase();
    const isCashPayment = rawMethod === 'CASH' || rawMethod === 'COUNTER' || rawMethod === 'REGISTER';

    // -------------------------------------------------------------
    // CHANNEL 1: CASH (COUNTER)
    // -------------------------------------------------------------
    if (isCashPayment) {
      const posExternalId = generateExternalId('POS', targetBranchId);
      const cashPosTxn = {
        id: crypto.randomUUID(),
        invoice_id: `CASH-${Date.now()}`,
        external_id: posExternalId,
        xendit_external_id: posExternalId,
        branch_id: targetBranchId,
        cashier_id: targetCashierId,
        cashier_name: user.name || 'Front Desk Cashier',
        shift_id: targetShiftId,
        customer_name: effectiveCustomer,
        customer_email: effectiveEmail,
        items,
        items_json: items,
        subtotal: computedAmount,
        tax_amount: 0,
        amount: computedAmount,
        total_amount: computedAmount,
        payment_method: 'CASH',
        payment_channel: 'CASH',
        cash_tendered: cash_tendered !== undefined ? Number(cash_tendered) : computedAmount,
        change_due: change_due !== undefined ? Number(change_due) : 0,
        status: 'PENDING',
        waiver: waiver || null,
        created_at: new Date()
      };

      if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];
      memoryStore.pos_transactions.unshift(cashPosTxn);

      const { sale, turnstilePass } = await settleTransactionRecord({
        posTxn: cashPosTxn,
        cashierUser: user
      });

      await logAuditEvent({
        branch_id: targetBranchId,
        user_id: user.id,
        user_role: user.role,
        action: 'POS_CASH_CHECKOUT',
        resource: 'pos_transactions',
        ip_address: req.ip || '127.0.0.1',
        details: {
          reference_no: sale.reference_no,
          amount: computedAmount,
          cash_tendered,
          change_due
        }
      });

      return res.status(201).json({
        success: true,
        settled: true,
        payment_method: 'CASH',
        invoice_id: cashPosTxn.invoice_id,
        external_id: cashPosTxn.external_id,
        sale,
        turnstile_pass: turnstilePass,
        message: 'Cash sale completed and recorded in drawer.'
      });
    }

    // -------------------------------------------------------------
    // CHANNEL 2: XENDIT DIGITAL CHECKOUT
    // (Hosted Checkout & Dynamic QR Ph covering GCash, Maya, Cards, QR Ph)
    // -------------------------------------------------------------
    const targetBranchObj = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const targetBranchName = targetBranchObj?.name || 'KSYN Fitness';
    const targetBranchCode = getBranchCode(targetBranchObj?.code || targetBranchId);
    const external_id = generateExternalId('POS', targetBranchCode);
    const invoiceDescription = formatStreamDescription('POS', { branchName: targetBranchName });
    const origin = req.headers.origin || 'http://localhost:5180';

    let xenditInvoice;
    try {
      xenditInvoice = await xenditService.createInvoice({
        externalId: external_id,
        amount: computedAmount,
        payerEmail: effectiveEmail,
        description: invoiceDescription,
        customerName: effectiveCustomer,
        customerPhone: '+639170000000',
        currency: 'PHP',
        successRedirectUrl: `${origin}/payment-bridge?status=success&invoice_id=${external_id}&ext_id=${external_id}`,
        failureRedirectUrl: `${origin}/payment-bridge?status=failed&invoice_id=${external_id}&ext_id=${external_id}`,
        items: items.map(i => ({
          name: i.name || i.item_name || 'Item',
          quantity: Number(i.quantity) || 1,
          price: Number(i.price || i.unit_price || 0),
          category: i.category || 'Retail'
        })),
        metadata: {
          stream: 'POS',
          branchId: targetBranchId,
          cashierId: targetCashierId,
          shiftSessionId: targetShiftId,
          external_id,
          pos_source: 'front_desk_checkout'
        }
      });
    } catch (apiErr) {
      console.error('[XENDIT POS Checkout API Error]:', apiErr);
      return res.status(502).json({
        success: false,
        gateway_error: true,
        message: 'Hindi maabot ang payment gateway. Pakisuri ang koneksyon sa server o subukan muli.'
      });
    }

    const posTxn = {
      id: crypto.randomUUID(),
      invoice_id: xenditInvoice.id,
      external_id: xenditInvoice.external_id,
      xendit_external_id: xenditInvoice.external_id,
      invoice_url: xenditInvoice.invoice_url,
      qr_string: xenditInvoice.qr_string || null,
      branch_id: targetBranchId,
      cashier_id: targetCashierId,
      cashier_name: user.name || 'Front Desk Cashier',
      shift_id: targetShiftId,
      customer_name: effectiveCustomer,
      customer_email: effectiveEmail,
      items,
      items_json: items,
      subtotal: computedAmount,
      tax_amount: 0,
      amount: computedAmount,
      total_amount: computedAmount,
      payment_method: 'XENDIT',
      payment_channel: 'XENDIT_CHECKOUT',
      status: 'PENDING',
      waiver: waiver || null,
      created_at: new Date()
    };

    if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];
    memoryStore.pos_transactions.unshift(posTxn);

    // Also mirror to payment_invoices for general lookup
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    memoryStore.payment_invoices.unshift({
      id: xenditInvoice.id,
      invoice_no: external_id,
      user_id: user.id || null,
      branch_id: targetBranchId,
      amount: computedAmount,
      payment_rail: 'xendit_hosted_checkout',
      status: 'pending',
      invoice_url: xenditInvoice.invoice_url,
      gateway_ref: xenditInvoice.id,
      created_at: new Date()
    });

    saveStore();

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'POS_XENDIT_INVOICE_CREATED',
      resource: 'pos_transactions',
      ip_address: req.ip || '127.0.0.1',
      details: {
        invoice_id: xenditInvoice.id,
        external_id,
        amount: computedAmount
      }
    });

    return res.status(201).json({
      success: true,
      invoice_url: xenditInvoice.invoice_url,
      invoice_id: xenditInvoice.id,
      external_id: xenditInvoice.external_id,
      qr_string: xenditInvoice.qr_string || null,
      amount: computedAmount,
      transaction: posTxn
    });
  } catch (err) {
    console.error('POS Checkout Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Hindi maabot ang payment gateway. Pakisuri ang koneksyon sa server o subukan muli.'
    });
  }
}

/**
 * 2. GET XENDIT INVOICE STATUS & AUTOMATED SETTLEMENT
 * GET /api/pos/xendit/status/:invoiceId
 * GET /api/payments/xendit/status/:invoiceId
 */
async function getStatus(req, res) {
  try {
    const { invoiceId } = req.params;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoiceId parameter is required.' });
    }

    if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];
    const posTxn = memoryStore.pos_transactions.find(t => 
      t.invoice_id === invoiceId ||
      t.external_id === invoiceId ||
      t.id === invoiceId
    );

    // If already settled in memoryStore, return immediately
    if (posTxn && posTxn.status === 'SETTLED') {
      return res.json({
        success: true,
        status: 'PAID',
        settled: true,
        invoice_id: invoiceId,
        external_id: posTxn.external_id,
        sale: posTxn.sale,
        turnstile_pass: posTxn.turnstile_pass,
        transaction: posTxn
      });
    }

    // Check if this is a PT Enrollment transaction
    const ptEnrollment = (memoryStore.pt_enrollments || []).find(e =>
      e.invoice_id === invoiceId ||
      e.xendit_external_id === invoiceId ||
      e.id === invoiceId ||
      e.payment_reference === invoiceId
    );

    if (ptEnrollment) {
      if (ptEnrollment.status === 'CLEARED_ACTIVE' || ptEnrollment.payment_status === 'PAID') {
        return res.json({
          success: true,
          status: 'PAID',
          settled: true,
          isPaid: true,
          invoice_id: invoiceId,
          external_id: ptEnrollment.xendit_external_id,
          enrollment: ptEnrollment
        });
      }

      const realPtInvId = (ptEnrollment.invoice_id && ptEnrollment.invoice_id.length === 24) ? ptEnrollment.invoice_id : invoiceId;
      let xenditData = null;
      if (realPtInvId && realPtInvId.length === 24) {
        try {
          xenditData = await xenditService.getInvoice(realPtInvId);
        } catch (fetchErr) {
          console.warn(`[Xendit Status PT Warning]:`, fetchErr.message);
        }
      }

      const isPaid = xenditData && (xenditData.status === 'PAID' || xenditData.status === 'SETTLED' || xenditData.status === 'COMPLETED');
      if (isPaid) {
        const xenditController = require('./xenditController');
        await xenditController.handlePtPaymentSettlement(ptEnrollment.xendit_external_id || realPtInvId, xenditData);
        return res.json({
          success: true,
          status: 'PAID',
          settled: true,
          isPaid: true,
          invoice_id: invoiceId,
          external_id: ptEnrollment.xendit_external_id,
          enrollment: ptEnrollment
        });
      }

      return res.json({
        success: true,
        status: xenditData?.status || ptEnrollment.status || 'AWAITING_PAYMENT',
        settled: false,
        invoice_id: invoiceId,
        external_id: ptEnrollment.xendit_external_id || invoiceId,
        enrollment: ptEnrollment
      });
    }

    // Query Xendit live API
    let xenditData = null;
    const realInvoiceId = (posTxn?.invoice_id && posTxn.invoice_id.length === 24) ? posTxn.invoice_id : invoiceId;
    try {
      xenditData = await xenditService.getInvoice(realInvoiceId);
    } catch (fetchErr) {
      console.warn(`[Xendit Status Warning]: Could not fetch ${realInvoiceId} from Xendit:`, fetchErr.message);
    }

    const isPaid = xenditData && (xenditData.status === 'PAID' || xenditData.status === 'SETTLED' || xenditData.status === 'COMPLETED');

    if (isPaid && posTxn) {
      const { sale, turnstilePass } = await settleTransactionRecord({
        posTxn,
        xenditData,
        cashierUser: req.user || { name: posTxn.cashier_name || 'Front Desk Cashier', id: posTxn.cashier_id }
      });

      return res.json({
        success: true,
        status: 'SETTLED',
        is_settled: true,
        settled: true,
        isPaid: true,
        invoice_id: invoiceId,
        external_id: posTxn.external_id,
        sale,
        turnstile_pass: turnstilePass,
        transaction: posTxn
      });
    }

    return res.json({
      success: true,
      status: xenditData?.status || posTxn?.status || 'PENDING',
      settled: false,
      invoice_id: invoiceId,
      external_id: posTxn?.external_id || invoiceId
    });
  } catch (err) {
    console.error('Error fetching Xendit status:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. SIMULATE XENDIT PAYMENT SUCCESS (Sandbox/Staging QA Shortcut)
 * POST /api/pos/xendit/simulate-paid/:invoiceId
 */
async function simulatePaid(req, res) {
  try {
    const { invoiceId } = req.params;
    if (!memoryStore.pos_transactions) memoryStore.pos_transactions = [];

    const posTxn = memoryStore.pos_transactions.find(t => 
      t.invoice_id === invoiceId ||
      t.external_id === invoiceId ||
      t.id === invoiceId
    );

    if (!posTxn) {
      const ptEnrollment = (memoryStore.pt_enrollments || []).find(e =>
        e.invoice_id === invoiceId ||
        e.xendit_external_id === invoiceId ||
        e.id === invoiceId ||
        e.payment_reference === invoiceId
      );

      if (ptEnrollment) {
        const xenditController = require('./xenditController');
        const dummyPayload = {
          id: invoiceId,
          external_id: ptEnrollment.xendit_external_id || invoiceId,
          status: 'PAID',
          paid_amount: ptEnrollment.gross_amount || ptEnrollment.total_price || 6000,
          payment_method: 'EWALLET',
          payment_channel: 'GCASH_SIMULATED',
          metadata: {
            channel: 'POS',
            origin_channel: 'POS',
            enrollment_id: ptEnrollment.id
          }
        };
        await xenditController.handlePtPaymentSettlement(ptEnrollment.xendit_external_id || invoiceId, dummyPayload);
        return res.json({
          success: true,
          status: 'PAID',
          settled: true,
          message: 'PT Enrollment payment simulated and settled successfully.',
          enrollment: ptEnrollment
        });
      }

      return res.status(404).json({ success: false, message: 'Transaction not found for invoice ID.' });
    }

    const { sale, turnstilePass } = await settleTransactionRecord({
      posTxn,
      xenditData: { payment_channel: 'GCASH_SIMULATED', payment_method: 'EWALLET' },
      cashierUser: req.user
    });

    return res.json({
      success: true,
      status: 'PAID',
      settled: true,
      message: 'Simulated payment settled successfully in Sandbox.',
      sale,
      turnstile_pass: turnstilePass,
      transaction: posTxn
    });
  } catch (err) {
    console.error('Simulate Paid Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. Front-Desk Over-the-Counter PT Package Enrollment
 * POST /api/pos/pt-enrollment
 * Handles cashier counter enrollments with origin-channel prefixing:
 * - PT-POS-[BRANCH]-[TIMESTAMP]-[HASH]
 * Cash: Requires active open shift, updates cash drawer, marks CLEARED_ACTIVE, awards coach commission.
 * Xendit: Creates Xendit hosted invoice with PT-POS prefix, sets AWAITING_PAYMENT, awaits webhook/poll.
 */
async function enrollPtPackage(req, res) {
  try {
    const cashierUser = req.user;
    const {
      memberId,
      member_id,
      coachId,
      coach_id,
      packageId,
      package_id,
      branchCode,
      branch_code,
      paymentMethod = 'CASH',
      payment_method,
      sessionDate,
      sessionTimeSlot,
      notes
    } = req.body;

    const targetMemberId = memberId || member_id;
    const targetCoachId = coachId || coach_id;
    const targetPackageId = packageId || package_id || 'pt-12';
    const targetPaymentMethod = (paymentMethod || payment_method || 'CASH').toUpperCase();

    if (!targetMemberId) {
      return res.status(400).json({ success: false, message: 'Member selection is required.' });
    }
    if (!targetCoachId) {
      return res.status(400).json({ success: false, message: 'Coach selection is required.' });
    }

    // Resolve member
    const member = (memoryStore.users || []).find(u =>
      u.id === targetMemberId ||
      u.email === targetMemberId ||
      (u.name && u.name.toLowerCase() === String(targetMemberId).toLowerCase())
    );
    if (!member) {
      return res.status(404).json({ success: false, message: 'Athlete member not found in directory.' });
    }

    // Strict Restriction: Check if athlete already has an active PT contract/package in progress
    const existingActive = (memoryStore.pt_clients || []).find(c => 
      (c.client_id === member.id || c.id === member.id || (c.email && c.email.toLowerCase() === (member.email || '').toLowerCase())) && 
      (c.status === 'Active' || c.status === 'active') &&
      ((c.sessions_total || 12) - (c.sessions_completed || 0) > 0)
    ) || (memoryStore.pt_enrollments || []).find(e =>
      (e.member_id === member.id || e.user_id === member.id || (e.member_email && e.member_email.toLowerCase() === (member.email || '').toLowerCase())) &&
      ['CLEARED', 'CLEARED_ACTIVE', 'Active', 'active'].includes(e.enrollment_status) &&
      !e.is_concluded &&
      ((e.sessions_total || 12) - (e.sessions_completed || 0) > 0)
    );

    if (existingActive) {
      const coachUser = (memoryStore.users || []).find(u => u.id === existingActive.coach_id);
      const coachDisplayName = (coachUser?.name || 'Personal Trainer').replace(/^Coach\s+/i, '');
      return res.status(400).json({
        success: false,
        code: 'ACTIVE_PT_EXISTS',
        message: `${member.name} already has an active Personal Trainer (PT) package in progress (${coachDisplayName ? 'with Coach ' + coachDisplayName : 'active'}). Front desk cannot enroll this member into another package until their current sessions are completed.`
      });
    }

    // Deduplicate: purge any stale pending drafts for this member before creating new enrollment
    if (memoryStore.pt_enrollments) {
      memoryStore.pt_enrollments = memoryStore.pt_enrollments.filter(e =>
        !(e.member_id === member.id && ['AWAITING_PAYMENT', 'ENROLLMENT_PENDING_PAYMENT', 'PENDING_FRONT_DESK_CLEARANCE'].includes(e.enrollment_status))
      );
    }

    // Resolve coach
    const coach = (memoryStore.users || []).find(u =>
      (u.id === targetCoachId || u.username === targetCoachId) &&
      (u.role === 'coach' || u.role === 'trainer')
    );
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Selected coach not found in staff roster.' });
    }

    // Resolve Branch & Branch Code
    const targetBranchId = coach.branch_id || cashierUser.branch_id || member.branch_id || 'b-mkt-01';
    const branchObj = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const resolvedBranchCode = getBranchCode(branchCode || branch_code || branchObj?.code || targetBranchId);
    const branchName = branchObj?.name || cashierUser.branch_name || 'KSYN Fitness';

    // Resolve Package Details & Pricing
    let totalSessions = 12;
    let packageName = '12-Session Signature PT Package';
    let grossPrice = 6000;

    const pkgKey = String(targetPackageId).toLowerCase();
    if (pkgKey.includes('16') || pkgKey === 'pt-16') {
      totalSessions = 16;
      packageName = '16-Session Elite Transformation PT Package';
      grossPrice = 8000;
    } else if (pkgKey.includes('10') || pkgKey === 'pt-10') {
      totalSessions = 10;
      packageName = '10-Session Jumpstart PT Package';
      grossPrice = 5000;
    } else if (pkgKey.includes('single') || pkgKey === 'pt-single' || pkgKey === 'pt-1') {
      totalSessions = 1;
      packageName = 'Single 1-on-1 Assessment Session';
      grossPrice = 500;
    } else if (req.body.customPrice) {
      grossPrice = Number(req.body.customPrice);
      totalSessions = Number(req.body.customSessions) || 12;
      packageName = req.body.packageName || `${totalSessions}-Session Custom PT Package`;
    }

    // 15% Coach Commission Split, 85% Gym Retained
    const coachCommissionRate = 15.0;
    const coachPayoutAmount = Number((grossPrice * 0.15).toFixed(2));
    const gymRetainedAmount = Number((grossPrice * 0.85).toFixed(2));

    // Generate Standardized POS External ID: PT-POS-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
    const externalId = generateExternalId('PT-POS', resolvedBranchCode);
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Verify Active Shift for Cash
    let activeShift = null;
    if (targetPaymentMethod === 'CASH') {
      activeShift = (memoryStore.pos_shifts || []).find(s =>
        (s.cashier_id === cashierUser.id || s.branch_id === targetBranchId) && s.status === 'OPEN'
      );
      if (!activeShift) {
        return res.status(400).json({
          success: false,
          error: 'NO_ACTIVE_SHIFT',
          message: 'No active cash drawer shift is currently open. Please open your shift cash drawer before collecting cash.'
        });
      }
    }

    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];

    if (targetPaymentMethod === 'CASH') {
      const cashReference = `PT-POS-${resolvedBranchCode}-CASH-${Date.now()}`;
      const newEnrollment = {
        id: `pte-${Date.now()}-${randSuffix}`,
        member_id: member.id,
        member_name: member.name,
        member_email: member.email,
        branch_id: targetBranchId,
        branch_name: branchName,
        coach_id: coach.id,
        coach_name: coach.name,
        package_id: targetPackageId,
        package_name: packageName,
        sessions_total: totalSessions,
        sessions_remaining: totalSessions,
        sessions_completed: 0,
        gross_amount: grossPrice,
        total_price: grossPrice,
        coach_commission_rate: coachCommissionRate,
        coach_payout_amount: coachPayoutAmount,
        gym_retained_amount: gymRetainedAmount,
        payment_channel: 'CASH',
        origin_channel: 'POS',
        origin: 'FRONT_DESK_POS',
        payment_reference: cashReference,
        xendit_external_id: cashReference,
        payment_status: 'PAID',
        clearance_status: 'CLEARED_ACTIVE',
        enrollment_status: 'CLEARED_ACTIVE',
        status: 'CLEARED_ACTIVE',
        is_cleared: true,
        cleared_at: new Date().toISOString(),
        cleared_by: cashierUser.name || 'Front Desk POS Cashier',
        cashier_id: cashierUser.id,
        cashier_name: cashierUser.name,
        shift_id: activeShift.id,
        preferred_date: sessionDate || new Date().toISOString().split('T')[0],
        preferred_time_slot: sessionTimeSlot || '09:00 AM – 10:00 AM',
        notes: notes || 'Front Desk POS Counter Cash Enrollment',
        created_at: new Date().toISOString()
      };

      memoryStore.pt_enrollments.unshift(newEnrollment);

      // Increment physical drawer cash total
      activeShift.total_cash_sales = Math.round(((activeShift.total_cash_sales || 0) + grossPrice) * 100) / 100;
      activeShift.expected_cash_drawer = Math.round(((activeShift.opening_float || 0) + (activeShift.total_cash_sales || 0) - (activeShift.cash_drops || 0)) * 100) / 100;

      // Record in Sales Ledger
      if (!memoryStore.sales) memoryStore.sales = [];
      memoryStore.sales.unshift({
        id: crypto.randomUUID(),
        shift_id: activeShift.id,
        branch_id: targetBranchId,
        user_id: member.id,
        customer_name: member.name,
        amount: grossPrice,
        royalty_amount: Number((grossPrice * 0.075).toFixed(2)),
        net_retained: gymRetainedAmount,
        category: 'pt_packages',
        payment_method: 'CASH',
        payment_channel: 'cash',
        origin_channel: 'POS',
        description: `[PT Enrollment - Front Desk POS Cash] ${packageName} with Coach ${coach.name.replace(/^Coach\s+/i, '')}`,
        reference_no: cashReference,
        reference_number: cashReference,
        invoice_number: cashReference,
        created_at: new Date()
      });

      // Record Closed PT Package Sales Commission for Coach
      if (!memoryStore.coach_sales_commissions) memoryStore.coach_sales_commissions = [];
      memoryStore.coach_sales_commissions.unshift({
        id: `csc-${Date.now()}-${randSuffix}`,
        coach_id: coach.id,
        coach_name: coach.name,
        client_id: member.id,
        client_name: member.name,
        enrollment_id: newEnrollment.id,
        package_name: packageName,
        package_amount: grossPrice,
        commission_rate: coachCommissionRate,
        commission_earned: coachPayoutAmount,
        date: new Date().toISOString(),
        cleared_by_staff: cashierUser.name || 'Front Desk POS Cashier',
        payout_status: 'Accrued',
        branch_id: targetBranchId,
        origin_channel: 'POS'
      });

      // Activate athlete in coach's pt_clients
      if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
      const existingClient = memoryStore.pt_clients.find(c => (c.client_id === member.id || c.id === member.id) && c.coach_id === coach.id);
      if (!existingClient) {
        memoryStore.pt_clients.unshift({
          id: member.id,
          client_id: member.id,
          client_name: member.name,
          coach_id: coach.id,
          coach_name: coach.name,
          package_plan: packageName,
          status: 'Active',
          sessions_total: totalSessions,
          sessions_completed: 0,
          sessions_remaining: totalSessions,
          enrolled_at: new Date().toISOString(),
          branch_id: targetBranchId
        });
      }

      if (typeof saveStore === 'function') saveStore();

      return res.json({
        success: true,
        paymentMethod: 'CASH',
        message: `PT Package successfully enrolled via Cash. Collected ₱${grossPrice.toLocaleString()} into drawer.`,
        enrollment: newEnrollment,
        reference: cashReference,
        drawer_expected: activeShift.expected_cash_drawer
      });
    }

    // Else: XENDIT Hosted Invoice
    const xenditService = require('../services/xenditService');
    const clientOrigin = req.headers.origin || process.env.CORS_ORIGIN || 'http://localhost:5180';
    let xenditInvoice = null;

    try {
      xenditInvoice = await xenditService.createInvoice({
        externalId,
        amount: grossPrice,
        payerEmail: member.email || 'guest@ksynpos.local',
        customerName: member.name,
        customerPhone: member.phone || '+639171234567',
        description: `[PT Enrollment - Front Desk POS] ${packageName} (${coach.name})`,
        successRedirectUrl: `${clientOrigin}/dashboard/employee?payment_status=success&external_id=${externalId}`,
        failureRedirectUrl: `${clientOrigin}/dashboard/employee?payment_status=failed&external_id=${externalId}`,
        items: [
          {
            name: `PT Package: ${packageName} (${coach.name})`,
            quantity: 1,
            price: grossPrice,
            category: 'Personal Training'
          }
        ],
        metadata: {
          stream: 'PT',
          channel: 'POS',
          origin_channel: 'POS',
          type: 'pt_pos_enrollment',
          member_id: member.id,
          coach_id: coach.id,
          cashier_id: cashierUser.id,
          branch_id: targetBranchId,
          package_id: targetPackageId,
          sessions_total: totalSessions,
          external_id: externalId
        }
      });
    } catch (invErr) {
      console.error('[Xendit POS PT Invoice Error]:', invErr);
      return res.status(502).json({
        success: false,
        message: 'Failed to generate Xendit invoice. Please check gateway connection or collect cash.'
      });
    }

    const newEnrollment = {
      id: `pte-${Date.now()}-${randSuffix}`,
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      branch_id: targetBranchId,
      branch_name: branchName,
      coach_id: coach.id,
      coach_name: coach.name,
      package_id: targetPackageId,
      package_name: packageName,
      sessions_total: totalSessions,
      sessions_remaining: totalSessions,
      sessions_completed: 0,
      gross_amount: grossPrice,
      total_price: grossPrice,
      coach_commission_rate: coachCommissionRate,
      coach_payout_amount: coachPayoutAmount,
      gym_retained_amount: gymRetainedAmount,
      payment_channel: 'XENDIT',
      origin_channel: 'POS',
      origin: 'FRONT_DESK_POS',
      xendit_external_id: externalId,
      payment_reference: externalId,
      invoice_id: xenditInvoice.id,
      invoice_url: xenditInvoice.invoice_url,
      payment_status: 'AWAITING_PAYMENT',
      clearance_status: 'AWAITING_PAYMENT',
      enrollment_status: 'AWAITING_PAYMENT',
      status: 'AWAITING_PAYMENT',
      cashier_id: cashierUser.id,
      cashier_name: cashierUser.name,
      preferred_date: sessionDate || new Date().toISOString().split('T')[0],
      preferred_time_slot: sessionTimeSlot || '09:00 AM – 10:00 AM',
      notes: notes || 'Front Desk POS Counter Xendit Enrollment',
      created_at: new Date().toISOString()
    };

    memoryStore.pt_enrollments.unshift(newEnrollment);

    // Record in payment_invoices
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    memoryStore.payment_invoices.unshift({
      id: xenditInvoice.id,
      invoice_no: externalId,
      user_id: member.id,
      customer_name: member.name,
      customer_email: member.email,
      branch_id: targetBranchId,
      package_id: targetPackageId,
      package_name: packageName,
      coach_id: coach.id,
      coach_name: coach.name,
      amount: grossPrice,
      channel: 'POS PT ENROLLMENT',
      origin_channel: 'POS',
      status: 'pending',
      invoice_url: xenditInvoice.invoice_url,
      created_at: new Date()
    });

    if (typeof saveStore === 'function') saveStore();

    return res.json({
      success: true,
      paymentMethod: 'XENDIT',
      message: 'Xendit PT checkout invoice created successfully.',
      enrollment: newEnrollment,
      externalId,
      invoiceId: xenditInvoice.id,
      invoiceUrl: xenditInvoice.invoice_url
    });
  } catch (err) {
    console.error('POS PT Enrollment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. List Coaches for POS Counter PT Enrollment
 * GET /api/pos/coaches
 */
async function getPosCoaches(req, res) {
  try {
    const { branch_id, branchId } = req.query;
    const targetBranch = branch_id || branchId;
    let coaches = (memoryStore.users || []).filter(u => u.role === 'coach' || u.role === 'trainer');
    if (targetBranch) {
      coaches = coaches.filter(c => !c.branch_id || c.branch_id === targetBranch);
    }
    return res.json({
      success: true,
      coaches: coaches.map(c => ({
        id: c.id,
        name: c.name,
        specialty: c.specialty || c.shift_role || 'Personal Trainer',
        avatar_url: c.avatar_url || c.profile_image || null,
        branch_id: c.branch_id || 'b-mkt-01',
        email: c.email,
        phone: c.phone
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  checkout,
  getStatus,
  simulatePaid,
  settleTransactionRecord,
  enrollPtPackage,
  getPosCoaches
};
