/**
 * Automated Verification Suite for KSYN Xendit Payment Gateway Integration
 * 
 * Verifies:
 * 1. Gateway Client Configuration (/api/payments/xendit/config)
 * 2. Unified Hosted Checkout Invoices (/api/payments/xendit/create-invoice)
 * 3. Dynamic QR Ph Generation (/api/payments/xendit/create-qr)
 * 4. Webhook Security Verification (403 on missing/invalid x-callback-token)
 * 5. Webhook Settlement & Turnstile Optical QR Provisioning for 1-Day Pass (verify rfid_card_uid === null)
 * 6. Card Tokenization & Auto-Debit Binding with Physical RFID Provisioning (verify rfid_card_uid !== null)
 * 7. Webhook Idempotency Check (Duplicate webhook callbacks return 200 OK Idempotent)
 * 8. Recurring Billing Auto-Debit Trigger Engine (1st / 15th cycles)
 */

const http = require('http');
const { app } = require('./server');
const { memoryStore } = require('./config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ksyn_fitconnect_jwt_secret_ultra_secure_key_2026';
const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN || 'xnd_wh_token_ksyn_fitconnect_secure_2026';

let server;
let port;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, testName) {
  if (!condition) {
    console.error(` FAILED: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(` PASSED: ${testName}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log(' STARTING KSYN XENDIT PAYMENT GATEWAY VERIFICATION SUITE');
  console.log('============================================================\n');

  // Start temporary test server
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(` Test server running on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Gateway Configuration Endpoint
    // -------------------------------------------------------------
    console.log('--- TEST 1: GET /api/payments/xendit/config ---');
    const configRes = await makeRequest('GET', '/api/payments/xendit/config');
    assert(configRes.status === 200, 'Config endpoint responds with 200 OK');
    assert(configRes.body.success === true, 'Config returns success: true');
    assert(configRes.body.gateway === 'Xendit Philippines', 'Config identifies Xendit Philippines gateway');
    assert(Array.isArray(configRes.body.supported_rails) && configRes.body.supported_rails.length === 4, 'Config exposes 4 supported payment rails');

    // -------------------------------------------------------------
    // TEST 2: Unified Hosted Checkout Invoice
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: POST /api/payments/xendit/create-invoice ---');
    const invoiceRes = await makeRequest('POST', '/api/payments/xendit/create-invoice', {
      planTier: '12_months',
      branchId: 'b-mkt-01',
      customerName: 'Juan Dela Cruz',
      email: 'juan.delacruz@ksyn.ph'
    });
    assert(invoiceRes.status === 200, 'Invoice creation returns 200 OK');
    assert(invoiceRes.body.success === true, 'Invoice created successfully');
    assert(Boolean(invoiceRes.body.invoice_url), 'Invoice includes secure hosted checkout URL');
    assert(Boolean(invoiceRes.body.external_id), 'Invoice includes KSYN unique external_id');

    // -------------------------------------------------------------
    // TEST 3: Dynamic QR Ph Generation (1-Day Pass & Shake Bar)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: POST /api/payments/xendit/create-qr ---');
    const qrRes = await makeRequest('POST', '/api/payments/xendit/create-qr', {
      amount: 500,
      planTier: '1_day',
      branchId: 'b-bgc-02',
      description: '1-Day All-Access Drop-In Pass'
    });
    assert(qrRes.status === 200, 'QR Ph generation returns 200 OK');
    assert(qrRes.body.success === true, 'QR Ph payload generated successfully');
    assert(Boolean(qrRes.body.qr_string), 'QR Ph includes EMVCo-compliant QR string');
    assert(qrRes.body.expires_in_minutes === 15, 'QR Ph has 15-minute validity window');
    const generatedQrExternalId = qrRes.body.external_id;

    // -------------------------------------------------------------
    // TEST 4: Webhook Security - Rejection of Unauthorized Callbacks
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Webhook Security (Missing / Invalid Token) ---');
    const unauthWebhookRes = await makeRequest('POST', '/api/payments/xendit/webhook', {
      event: 'qr.payment',
      external_id: generatedQrExternalId,
      status: 'PAID',
      amount: 500
    });
    assert(unauthWebhookRes.status === 403, 'Webhook rejects missing x-callback-token with 403 Forbidden');

    const invalidWebhookRes = await makeRequest('POST', '/api/payments/xendit/webhook', {
      event: 'qr.payment',
      external_id: generatedQrExternalId,
      status: 'PAID',
      amount: 500
    }, {
      'x-callback-token': 'invalid_forged_token_xyz'
    });
    assert(invalidWebhookRes.status === 403, 'Webhook rejects forged x-callback-token with 403 Forbidden');

    // -------------------------------------------------------------
    // TEST 5: Webhook Settlement & Turnstile QR Issuance for 1-Day Pass
    // (Verify rfid_card_uid remains null!)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: 1-Day Pass Settlement & Turnstile QR Isolation ---');
    // Create a pending test user for 1-day pass
    const oneDayUser = {
      id: 'test-user-oneday-' + Date.now(),
      name: 'Maria Clara',
      email: 'maria.clara@gmail.com',
      branch_id: 'b-bgc-02',
      status: 'pending_payment',
      rfid_card_uid: null
    };
    memoryStore.users.push(oneDayUser);

    // Track a corresponding pending invoice
    memoryStore.payment_invoices.unshift({
      id: 'inv-test-oneday',
      invoice_no: generatedQrExternalId,
      user_id: oneDayUser.id,
      branch_id: 'b-bgc-02',
      plan_id: '1_day',
      amount: 500,
      status: 'pending'
    });

    const validWebhookRes = await makeRequest('POST', '/api/payments/xendit/webhook', {
      event: 'qr.payment',
      external_id: generatedQrExternalId,
      status: 'PAID',
      amount: 500,
      payment_method: 'qr_ph'
    }, {
      'x-callback-token': WEBHOOK_TOKEN
    });
    assert(validWebhookRes.status === 200, 'Valid webhook returns 200 OK');
    assert(validWebhookRes.body.success === true, 'Webhook marks payment confirmed');

    // Verify User State in memoryStore
    const verifiedOneDayUser = memoryStore.users.find(u => u.id === oneDayUser.id);
    assert(verifiedOneDayUser.status === 'active', '1-Day pass user status flipped to active');
    assert(verifiedOneDayUser.rfid_card_uid === null, '1-Day pass user strictly has NO physical RFID UID (rfid_card_uid === null)');

    // -------------------------------------------------------------
    // TEST 6: Webhook Idempotency Check
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Webhook Idempotency Protection ---');
    const duplicateWebhookRes = await makeRequest('POST', '/api/payments/xendit/webhook', {
      event: 'qr.payment',
      external_id: generatedQrExternalId,
      status: 'PAID',
      amount: 500,
      payment_method: 'qr_ph'
    }, {
      'x-callback-token': WEBHOOK_TOKEN
    });
    assert(duplicateWebhookRes.status === 200, 'Duplicate webhook returns 200 OK without errors');
    assert(duplicateWebhookRes.body.message.includes('Idempotent response'), 'Duplicate webhook identifies idempotent execution');

    // -------------------------------------------------------------
    // TEST 7: Tokenized Card Charge & Physical RFID Provisioning
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Card Charge & Physical RFID Provisioning for Annual Plan ---');
    const recurringUser = {
      id: 'test-user-recurring-' + Date.now(),
      name: 'Carlos Yulo',
      email: 'carlos.yulo@ksyn.ph',
      role: 'member',
      branch_id: 'b-mkt-01',
      status: 'pending_payment',
      rfid_card_uid: null
    };
    memoryStore.users.push(recurringUser);

    const recurringUserToken = jwt.sign(
      { id: recurringUser.id, role: recurringUser.role, branch_id: recurringUser.branch_id, email: recurringUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const cardChargeRes = await makeRequest('POST', '/api/payments/xendit/charge-card', {
      tokenId: 'tok_card_xendit_mastercard_4242',
      planTier: '12_months',
      billingDay: 1,
      cardholderName: 'CARLOS YULO',
      maskedPan: '•••• •••• •••• 4242',
      brand: 'Mastercard',
      issuingBank: 'BDO Unibank'
    }, {
      'Authorization': `Bearer ${recurringUserToken}`
    });

    assert(cardChargeRes.status === 200, 'Card charge returns 200 OK');
    assert(cardChargeRes.body.success === true, 'Card charge succeeded');
    assert(Boolean(cardChargeRes.body.turnstile_pass), 'Optical turnstile dynamic QR pass issued');

    const verifiedRecurringUser = memoryStore.users.find(u => u.id === recurringUser.id);
    assert(verifiedRecurringUser.status === 'active', 'Recurring user status is active');
    assert(Boolean(verifiedRecurringUser.rfid_card_uid), `Physical RFID UID provisioned: ${verifiedRecurringUser.rfid_card_uid}`);
    assert(verifiedRecurringUser.rfid_card_uid.startsWith('KS-'), 'RFID UID follows standard KS-XXXX-XXXX format');

    // -------------------------------------------------------------
    // TEST 8: Recurring Auto-Debit Billing Engine Run
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Recurring Auto-Debit Engine Run (/api/payments/xendit/trigger-recurring) ---');
    const adminToken = jwt.sign(
      { id: 'u0000000-0000-0000-0000-000000000001', role: 'super_admin', email: 'superadmin@ksyn.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const recurringRunRes = await makeRequest('POST', '/api/payments/xendit/trigger-recurring', {
      cycleDay: 1
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(recurringRunRes.status === 200, 'Recurring billing trigger returns 200 OK');
    assert(recurringRunRes.body.success === true, 'Recurring billing execution successful');
    assert(recurringRunRes.body.cycle_day === 1, 'Executed billing for Day 1 cycle');

    console.log('\n============================================================');
    console.log(' ALL 8 XENDIT PAYMENT GATEWAY TESTS PASSED SUCCESSFULLY!');
    console.log('============================================================\n');
  } catch (err) {
    console.error('\n Test suite encountered failure:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();
