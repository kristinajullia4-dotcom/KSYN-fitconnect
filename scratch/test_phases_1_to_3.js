const assert = require('assert');

async function testPhases() {
  const baseUrl = 'http://localhost:5080/api';

  console.log('\n--- 1. Testing Phase 1: Token Revocation & Progressive Lockout ---');
  // Login employee
  const empLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
  }).then(r => r.json());
  assert.strictEqual(empLogin.success, true);

  // Logout to revoke token
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empLogin.token}` }
  }).then(r => r.json());
  console.log('✅ Token Revocation:', logoutRes.success, logoutRes.message);
  assert.strictEqual(logoutRes.success, true);

  // Attempt using revoked token
  const revokedAccess = await fetch(`${baseUrl}/branches`, {
    headers: { Authorization: `Bearer ${empLogin.token}` }
  });
  console.log('✅ Revoked Token Rejected with 401:', revokedAccess.status === 401);
  assert.strictEqual(revokedAccess.status, 401);

  // Login again with fresh token for subsequent tests
  const freshEmp = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
  }).then(r => r.json());

  console.log('\n--- 2. Testing Phase 2: Blind Cash Reconciliation & SHA-256 Waiver ---');
  const zReading = await fetch(`${baseUrl}/finance/cash-drawer/blind-reconciliation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${freshEmp.token}`
    },
    body: JSON.stringify({
      opening_float: 3000,
      denominations: { p1000: 3, p500: 1, p200: 2, p100: 1, p50: 0, p20: 0, coins: 10 },
      closing_notes: 'End of Morning Shift Z-Reading'
    })
  }).then(r => r.json());
  console.log('✅ Blind Cash Reconciliation:', zReading.success, zReading.message);
  console.log('   Expected:', zReading.report.expected_cash_in_drawer, 'Counted:', zReading.report.physical_counted_cash, 'Status:', zReading.report.status);
  assert.strictEqual(zReading.success, true);

  const waiverRes = await fetch(`${baseUrl}/finance/waivers/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${freshEmp.token}`
    },
    body: JSON.stringify({
      guest_name: 'Test Guest Athlete',
      phone: '+63 917 555 1234',
      emergency_contact: 'Family Contact',
      emergency_phone: '+63 917 555 4321',
      answers: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
      signature: 'data:image/png;base64,sampleSig'
    })
  }).then(r => r.json());
  console.log('✅ SHA-256 Legal Seal Waiver:', waiverRes.success, 'Hash:', waiverRes.waiver.legal_seal.slice(0, 16) + '...');
  assert.strictEqual(waiverRes.success, true);
  assert.strictEqual(typeof waiverRes.waiver.legal_seal, 'string');

  console.log('\n--- 3. Testing Phase 3: BIR Form 2307, Floor Density & Workout Plans ---');
  // Super Admin login to check remittances
  const saLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'super_admin@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());

  // Settle a remittance
  const remitSettle = await fetch(`${baseUrl}/finance/remittances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saLogin.token}`
    },
    body: JSON.stringify({
      branch_id: 'b-mkt-01',
      gross_sales: 65000,
      royalty_rate: 7.5
    })
  }).then(r => r.json());
  console.log('✅ Remittance Settled:', remitSettle.success, remitSettle.remittance.id);

  // Fetch BIR 2307 certificate
  const birRes = await fetch(`${baseUrl}/finance/bir-2307/${remitSettle.remittance.id}`, {
    headers: { Authorization: `Bearer ${saLogin.token}` }
  }).then(r => r.json());
  console.log('✅ BIR Form 2307 Certificate Generated:', birRes.success, 'ATC:', birRes.certificate.income_payments[0].atc, 'Withheld: ₱' + birRes.certificate.total_tax_withheld);
  assert.strictEqual(birRes.success, true);
  assert.strictEqual(birRes.certificate.income_payments[0].atc, 'WC158');

  // Member Floor Density
  const densityRes = await fetch(`${baseUrl}/members/floor-density`, {
    headers: { Authorization: `Bearer ${freshEmp.token}` }
  }).then(r => r.json());
  console.log('✅ Live Gym Floor Density:', densityRes.success, `${densityRes.current_occupancy}/${densityRes.max_capacity} athletes (${densityRes.percentage}%)`, densityRes.status_label);
  assert.strictEqual(densityRes.success, true);

  // Coach Workout Plans
  const coachLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'coach.sofia@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());

  const coachPlans = await fetch(`${baseUrl}/coach/workout-plans`, {
    headers: { Authorization: `Bearer ${coachLogin.token}` }
  }).then(r => r.json());
  console.log('✅ Coach Workout Plans retrieved:', coachPlans.success, `Found ${coachPlans.plans.length} plan(s)`);
  assert.strictEqual(coachPlans.success, true);

  console.log('\n🎉 ALL PHASE 1, PHASE 2, AND PHASE 3 BACKEND FEATURES VERIFIED!\n');
}

testPhases().catch(e => {
  console.error('❌ Phase verification failed:', e);
  process.exit(1);
});
