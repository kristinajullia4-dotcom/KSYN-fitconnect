const assert = require('assert');
const crypto = require('crypto');

const baseUrl = 'http://localhost:5080/api';

async function runTest() {
  console.log('========================================================');
  console.log(' TESTING UNPAID ACCOUNT REGISTRATION & PAYWALL GATING');
  console.log('========================================================\n');

  // STEP 1: Member creates an account (Self-Registration)
  console.log('--- Step 1: Member Self-Registration (No upfront payment) ---');
  const testEmail = `newmember.${Date.now()}@ksyn.com`;
  const regPayload = {
    name: 'Mark Angelo Santos',
    dob: '1998-04-12',
    username: `marksantos_${Date.now().toString().slice(-4)}`,
    email: testEmail,
    phone: '09179998877',
    password: 'Password123!',
    branch_id: 'b-mkt-01',
    membership_plan: '12_months',
    address: 'Ayala Ave, Makati City',
    waiver_accepted: true,
    otpCode: '123456'
  };

  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload)
  }).then(r => r.json());

  console.log(' Registration Response:', regRes.success, 'User Status:', regRes.user?.status, 'Sub Status:', regRes.subscription?.status);
  assert.strictEqual(regRes.success, true);
  assert.strictEqual(regRes.user.status, 'pending_payment', 'Registered user must have status pending_payment');
  assert.strictEqual(regRes.subscription.status, 'pending_payment', 'Registered subscription must be pending_payment');

  // STEP 2: Unpaid member signs in at /login
  console.log('\n--- Step 2: Unpaid Member Signs In (/login) ---');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'Password123!' })
  }).then(r => r.json());

  console.log(' Login Response:', loginRes.success, 'Role:', loginRes.user?.role, 'Status:', loginRes.user?.status);
  assert.strictEqual(loginRes.success, true);
  assert.strictEqual(loginRes.user.status, 'pending_payment');
  const memberToken = loginRes.token;

  // STEP 3: Unpaid member attempts to generate dynamic turnstile pass
  console.log('\n--- Step 3: Unpaid Member Attempts to Generate Turnstile Pass ---');
  const passRes = await fetch(`${baseUrl}/qr/generate-pass`, {
    headers: { Authorization: `Bearer ${memberToken}` }
  });
  const passData = await passRes.json();

  console.log(' Generate Pass Blocked:', passRes.status === 403, 'Error:', passData.error, 'Message:', passData.message);
  assert.strictEqual(passRes.status, 403, 'Must return 403 Forbidden for unpaid member');
  assert.strictEqual(passData.error, 'MEMBERSHIP_PAYMENT_REQUIRED');

  // STEP 4: Tokenize Card and complete 3DS OTP verification
  console.log('\n--- Step 4: Paywall Payment (Card Tokenization & 3DS Challenge) ---');
  const tokRes = await fetch(`${baseUrl}/payments/tokenize-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardNumber: '4111222233334444',
      cardholderName: 'Mark Angelo Santos',
      expiryMonth: '11',
      expiryYear: '28',
      cvv: '789',
      userId: loginRes.user.id,
      branchId: 'b-mkt-01',
      billingDay: 1
    })
  }).then(r => r.json());

  console.log(' Card Tokenize Challenge:', tokRes.requires_3ds, 'Bank:', tokRes.card_summary?.issuing_bank);

  const otpRes = await fetch(`${baseUrl}/payments/verify-3ds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: tokRes.challenge_token,
      otp: '123456'
    })
  }).then(r => r.json());

  console.log(' 3DS OTP Approved! Token:', otpRes.payment_method?.gateway_token);
  const gatewayToken = otpRes.payment_method.gateway_token;

  // STEP 5: Settle Member Payment via /api/payments/settle-member-payment
  console.log('\n--- Step 5: Settle Pending Membership Payment ---');
  const settleRes = await fetch(`${baseUrl}/payments/settle-member-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`
    },
    body: JSON.stringify({
      planTier: '12_months',
      paymentOption: 'card',
      gatewayToken,
      billingDay: 1,
      maskedIdentifier: otpRes.payment_method.masked_identifier,
      brand: otpRes.payment_method.brand_or_provider,
      issuingBank: otpRes.payment_method.issuing_bank
    })
  }).then(r => r.json());

  console.log(' Settle Payment Response:', settleRes.success, 'New Status:', settleRes.user?.status);
  console.log('   Subscription Status:', settleRes.subscription?.status, 'Plan:', settleRes.subscription?.plan, 'Total Paid: ₱' + settleRes.subscription?.total_paid);
  console.log('   Provisioned RFID Keycard:', settleRes.user?.rfid_card_uid);
  assert.strictEqual(settleRes.success, true);
  assert.strictEqual(settleRes.user.status, 'active');
  assert.strictEqual(settleRes.subscription.status, 'active');
  assert.ok(settleRes.user.rfid_card_uid.startsWith('KS-'));
  assert.ok(settleRes.turnstile_pass);

  // STEP 6: Now that payment is settled, member requests turnstile pass again
  console.log('\n--- Step 6: Request Turnstile Pass Now That Account is Active ---');
  const activePassRes = await fetch(`${baseUrl}/qr/generate-pass`, {
    headers: { Authorization: `Bearer ${memberToken}` }
  });
  const activePassData = await activePassRes.json();

  console.log(' Generate Pass Result:', activePassData.success, 'TTL:', activePassData.ttl + 's', 'Token Length:', activePassData.token?.length);
  assert.strictEqual(activePassData.success, true);
  assert.ok(activePassData.token);

  // STEP 7: Staff scanner at reception turnstile validates the active pass
  console.log('\n--- Step 7: Front Desk Turnstile Check-In Scan ---');
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
  }).then(r => r.json());

  const checkinRes = await fetch(`${baseUrl}/qr/verify-pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      token: activePassData.token,
      branchId: 'b-mkt-01'
    })
  }).then(r => r.json());

  console.log(' Turnstile Check-In Result:', checkinRes.success, 'Valid:', checkinRes.valid, 'Method:', checkinRes.verification_method);
  assert.strictEqual(checkinRes.success, true);
  assert.strictEqual(checkinRes.valid, true);

  console.log('\n========================================================');
  console.log(' UNPAID ACCOUNT & PAYWALL GATING FLOW VERIFIED 100%!');
  console.log('========================================================');
}

runTest().catch(err => {
  console.error(' Test failed with error:', err);
  process.exit(1);
});
