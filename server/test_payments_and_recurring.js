const assert = require('assert');
const crypto = require('crypto');

async function runPaymentTests() {
  const port = process.env.PORT || 5080;
  const baseUrl = process.env.API_URL || `http://localhost:${port}/api`;

  console.log(`\n========================================================`);
  console.log(` KSYN FITCONNECT - PAYMENT RAILS & RECURRING BILLING TEST`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`========================================================\n`);

  // --- Step 0: Login as Branch Admin for administrative verification ---
  console.log('--- 0. Admin Authentication ---');
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());
  assert.strictEqual(adminLogin.success, true);
  const adminToken = adminLogin.token;
  console.log(' Admin Authenticated:', adminLogin.user.name, `(${adminLogin.user.role})`);

  // --- TEST 1: Option 1 - Credit/Debit Card Tokenization & 3DS Challenge ---
  console.log('\n--- 1. Testing Option 1: Credit / Debit Card (Zero-PAN Tokenization & 3DS) ---');
  const tokenizeRes = await fetch(`${baseUrl}/payments/tokenize-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardNumber: '5412 7512 3412 4242',
      cardholderName: 'Juan Dela Cruz',
      expiryMonth: '12',
      expiryYear: '28',
      cvv: '123',
      branchId: 'b-mkt-01',
      billingDay: 1
    })
  }).then(r => r.json());

  console.log(' Card Tokenize Response:', tokenizeRes.success, `Requires 3DS: ${tokenizeRes.requires_3ds}`);
  assert.strictEqual(tokenizeRes.success, true);
  assert.strictEqual(tokenizeRes.requires_3ds, true);
  assert.strictEqual(tokenizeRes.card_summary.brand, 'Mastercard');
  assert.ok(tokenizeRes.challenge_token);
  assert.strictEqual(tokenizeRes.card_summary.masked_identifier, '•••• •••• •••• 4242');

  // Verify 3DS OTP
  const challengeToken = tokenizeRes.challenge_token;
  const verify3dsRes = await fetch(`${baseUrl}/payments/verify-3ds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken,
      otp: '123456'
    })
  }).then(r => r.json());

  console.log(' 3DS Verification:', verify3dsRes.success, verify3dsRes.status, `Token: ${verify3dsRes.payment_method.gateway_token.slice(0, 16)}...`);
  assert.strictEqual(verify3dsRes.success, true);
  assert.strictEqual(verify3dsRes.status, 'AUTHENTICATION_SUCCESSFUL');
  assert.ok(verify3dsRes.payment_method.gateway_token.startsWith('tok_card_'));

  // --- TEST 2: Option 2 - GCash Recurring Billing Agreement ---
  console.log('\n--- 2. Testing Option 2: GCash Auto-Debit Billing Agreement ---');
  // Initiate
  const gcashInitRes = await fetch(`${baseUrl}/payments/create-billing-agreement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletType: 'gcash',
      mobileNumber: '0917 888 1234',
      branchId: 'b-mkt-01',
      billingDay: 15
    })
  }).then(r => r.json());
  assert.strictEqual(gcashInitRes.success, true);
  assert.strictEqual(gcashInitRes.requires_otp, true);
  console.log(' GCash OTP Prompt:', gcashInitRes.message);

  // Authorize with OTP
  const gcashAuthRes = await fetch(`${baseUrl}/payments/create-billing-agreement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletType: 'gcash',
      mobileNumber: '0917 888 1234',
      otp: '123456',
      branchId: 'b-mkt-01',
      billingDay: 15
    })
  }).then(r => r.json());
  assert.strictEqual(gcashAuthRes.success, true);
  assert.ok(gcashAuthRes.payment_method.gateway_token.startsWith('agr_gcash_'));
  console.log(' GCash Agreement Authorized:', gcashAuthRes.payment_method.gateway_token);

  // --- TEST 3: Option 2 (Maya) Recurring Billing Agreement ---
  console.log('\n--- 3. Testing Option 2: Maya Auto-Debit Billing Agreement ---');
  const mayaAuthRes = await fetch(`${baseUrl}/payments/create-billing-agreement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletType: 'maya',
      mobileNumber: '0918 555 9876',
      otp: '123456',
      branchId: 'b-mkt-01',
      billingDay: 1
    })
  }).then(r => r.json());
  assert.strictEqual(mayaAuthRes.success, true);
  assert.ok(mayaAuthRes.payment_method.gateway_token.startsWith('agr_maya_'));
  console.log(' Maya Agreement Authorized:', mayaAuthRes.payment_method.gateway_token);

  // --- TEST 4: Option 3 - Dynamic QR Ph Code Generation with 10-Min Timer ---
  console.log('\n--- 4. Testing Option 3: Dynamic QR Ph Code Generation (Prepaid Pass) ---');
  const qrGenRes = await fetch(`${baseUrl}/payments/generate-qr-ph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 2999.00,
      description: '1-Month Flexible Pass (Dynamic QR Ph)',
      branchId: 'b-mkt-01',
      planTier: '1_month'
    })
  }).then(r => r.json());

  assert.strictEqual(qrGenRes.success, true);
  assert.strictEqual(qrGenRes.qr_code.ttl_seconds, 600);
  assert.strictEqual(qrGenRes.invoice.amount, 2999.00);
  assert.strictEqual(qrGenRes.invoice.status, 'pending');
  console.log(' Dynamic QR Ph Generated:', qrGenRes.invoice.invoice_no, `Expires in ${qrGenRes.qr_code.ttl_seconds}s`);

  // --- TEST 5: HMAC-SHA256 Background Webhook Settlement ---
  console.log('\n--- 5. Testing HMAC-SHA256 Webhook Settlement ---');
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'ksyn-payment-webhook-secret-2026';
  const webhookBody = {
    event: 'payment.settled',
    data: {
      invoice_no: qrGenRes.invoice.invoice_no,
      amount: 2999.00,
      reference_no: `PAYMONGO-REF-${Date.now()}`
    }
  };
  const bodyString = JSON.stringify(webhookBody);
  const hmacSignature = crypto.createHmac('sha256', webhookSecret).update(bodyString).digest('hex');

  const webhookRes = await fetch(`${baseUrl}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-KSYN-Signature': hmacSignature
    },
    body: bodyString
  }).then(r => r.json());

  console.log(' Webhook Processed:', webhookRes.success, webhookRes.message);
  assert.strictEqual(webhookRes.success, true);
  assert.strictEqual(webhookRes.invoice.status, 'settled');

  // --- TEST 6: Unified 5-Step Member Onboarding Pipeline ---
  console.log('\n--- 6. Testing 5-Step Member Onboarding Wizard Pipeline ---');
  const uniqueTestEmail = `test.member.${Date.now()}@ksyn.com`;
  const onboardRes = await fetch(`${baseUrl}/payments/onboard-member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branchId: 'b-mkt-01',
      fullName: 'Carlos Antonio Yulo',
      email: uniqueTestEmail,
      phone: '0917 555 4321',
      password: 'Password123!',
      planTier: '12_months',
      parqAnswers: {
        heart_condition: false,
        chest_pain_activity: false,
        dizziness_balance: false,
        bone_joint_problem: false,
        blood_pressure_meds: false
      },
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      paymentOption: 'card',
      gatewayToken: verify3dsRes.payment_method.gateway_token,
      maskedIdentifier: '•••• •••• •••• 4242',
      brand: 'Mastercard',
      issuingBank: 'BDO Unibank',
      billingDay: 1
    })
  }).then(r => r.json());

  console.log(' 5-Step Onboarding Complete:', onboardRes.success, onboardRes.member?.name, `(RFID: ${onboardRes.turnstile_access?.rfid_uid})`);
  assert.strictEqual(onboardRes.success, true);
  assert.ok(onboardRes.turnstile_access.rfid_uid.startsWith('KS-'));
  assert.ok(onboardRes.turnstile_access.initial_dynamic_qr_pass);
  const newMemberId = onboardRes.member.id;

  // --- TEST 7: Turnstile Entry with Newly Onboarded Member Pass ---
  console.log('\n--- 7. Testing Turnstile Check-in with New Member Dynamic QR Pass ---');
  const checkinRes = await fetch(`${baseUrl}/qr/verify-pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      token: onboardRes.turnstile_access.initial_dynamic_qr_pass,
      branchId: 'b-mkt-01'
    })
  }).then(r => r.json());
  console.log(' Turnstile Check-In Result:', checkinRes.success, `Valid: ${checkinRes.valid}`);
  assert.strictEqual(checkinRes.success, true);
  assert.strictEqual(checkinRes.valid, true);

  // --- TEST 8: Recurring Billing Engine (1st & 15th Simulation) ---
  console.log('\n--- 8. Testing Automated Recurring Auto-Debit Engine ---');
  const billingRunRes = await fetch(`${baseUrl}/payments/trigger-recurring-billing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      targetDay: 1
    })
  }).then(r => r.json());

  console.log(' Recurring Billing Run:', billingRunRes.success, `Processed: ${billingRunRes.execution_summary?.total_processed}`);
  assert.strictEqual(billingRunRes.success, true);
  assert.ok(billingRunRes.execution_summary.successful >= 1);

  // --- TEST 9: Delinquency Simulation & Turnstile Gating (Past-Due Lockout) ---
  console.log('\n--- 9. Testing Delinquency Simulation & Turnstile Past-Due Lockout Rule ---');
  // Trigger failure on new member
  const failBillingRes = await fetch(`${baseUrl}/payments/trigger-recurring-billing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      targetDay: 1,
      simulateFailureUserId: newMemberId
    })
  }).then(r => r.json());

  console.log(' Delinquency Triggered for Member:', failBillingRes.execution_summary?.failed >= 1);

  // Generate dynamic QR pass for past_due member and attempt check-in
  const memberLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: uniqueTestEmail, password: 'Password123!' })
  }).then(r => r.json());
  assert.strictEqual(memberLogin.success, true);

  const memberPassRes = await fetch(`${baseUrl}/qr/generate-pass`, {
    headers: { Authorization: `Bearer ${memberLogin.token}` }
  }).then(r => r.json());

  const blockedCheckinRes = await fetch(`${baseUrl}/qr/verify-pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      token: memberPassRes.token,
      branchId: 'b-mkt-01',
      supervisor_override: false
    })
  }).then(r => r.json());

  console.log(' Turnstile Gating Rejection for Past-Due Account:');
  console.log('   Reason:', blockedCheckinRes.reason);
  console.log('   Message:', blockedCheckinRes.message);
  assert.strictEqual(blockedCheckinRes.success, false);
  assert.strictEqual(blockedCheckinRes.reason, 'SUBSCRIPTION_PAST_DUE');

  // --- TEST 10: Invoices Ledger with Tenant Isolation ---
  console.log('\n--- 10. Testing Invoices Ledger ---');
  const invoicesRes = await fetch(`${baseUrl}/payments/invoices`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  console.log(' Admin Invoices Query:', invoicesRes.success, `Found ${invoicesRes.invoices?.length} invoices`);
  assert.strictEqual(invoicesRes.success, true);
  assert.ok(invoicesRes.invoices.length >= 2);

  console.log(`\n========================================================`);
  console.log(` ALL 10 PAYMENT & RECURRING BILLING TEST SUITES PASSED 100%!`);
  console.log(`========================================================\n`);
}

runPaymentTests().catch(err => {
  console.error('\n Payment Tests Failed with Error:\n', err);
  process.exit(1);
});
