// Integration test for Franchise Owner, Coach Sofia, and POS Cashier Terminal
const assert = require('assert');

async function testNewRoles() {
  const port = process.env.PORT || 5080;
  const baseUrl = process.env.API_URL || `http://localhost:${port}/api`;

  console.log(`\n==================================================`);
  console.log(` TESTING NEW ROLES & POS CAPABILITIES`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`==================================================\n`);

  // --- TEST 1: FRANCHISE OWNER (INVESTOR READ-ONLY) ---
  console.log('--- 1. Testing Franchise Owner (Investor Read-Only) ---');
  const ownerLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner.bgc@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());

  console.log(' Franchise Owner Login:', ownerLogin.success, ownerLogin.user?.name, `(Role: ${ownerLogin.user?.role})`);
  assert.strictEqual(ownerLogin.success, true);
  assert.strictEqual(ownerLogin.user.role, 'branch_owner');
  const ownerToken = ownerLogin.token;

  // Franchise owner can access branch financial ledger & royalties
  const ownerLedger = await fetch(`${baseUrl}/branch-admin/ledger`, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  }).then(r => r.json());
  console.log(' Franchise Owner Ledger Access:', ownerLedger.success, `(Gross Sales: ₱${Number(ownerLedger.summary?.grossTotal || 0).toLocaleString()})`);
  assert.strictEqual(ownerLedger.success, true);

  // --- TEST 2: GYM COACH (COACH SOFIA CRUZ) ---
  console.log('\n--- 2. Testing Gym Coach (Coach Sofia Cruz) ---');
  const coachLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'coach.sofia@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());

  console.log(' Coach Sofia Login:', coachLogin.success, coachLogin.user?.name, `(Role: ${coachLogin.user?.role})`);
  assert.strictEqual(coachLogin.success, true);
  assert.strictEqual(coachLogin.user.role, 'coach');
  const coachToken = coachLogin.token;

  // Fetch Coach's PT Clients
  const clientsRes = await fetch(`${baseUrl}/coach/clients`, {
    headers: { Authorization: `Bearer ${coachToken}` }
  }).then(r => r.json());
  console.log(' Coach PT Clients query:', clientsRes.success, `Found ${clientsRes.clients?.length} athletes`);
  assert.strictEqual(clientsRes.success, true);
  assert.ok(clientsRes.clients?.length >= 1);

  // Fetch Coach's Assigned Classes
  const classesRes = await fetch(`${baseUrl}/coach/classes`, {
    headers: { Authorization: `Bearer ${coachToken}` }
  }).then(r => r.json());
  console.log(' Coach Assigned Classes:', classesRes.success, `Found ${classesRes.classes?.length} classes`);
  assert.strictEqual(classesRes.success, true);
  assert.ok(classesRes.classes?.length >= 1);

  // Log a 1-on-1 PT Session (KSYN Real Pricing: ₱800 - ₱1,100/session, Contracted Payroll Split: 60%)
  const sampleClient = clientsRes.clients[0];
  const logSessionRes = await fetch(`${baseUrl}/coach/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coachToken}`
    },
    body: JSON.stringify({
      client_id: sampleClient.id,
      duration_minutes: 60,
      focus_area: 'Hypertrophy & Core Conditioning',
      notes: 'Excellent bench press form. Increased weight by 5kg.',
      session_rate: 850,
      split_percentage: 60
    })
  }).then(r => r.json());
  console.log(' Log PT Session:', logSessionRes.success, `Session ID: ${logSessionRes.session?.id}, Rate: ₱${logSessionRes.session?.session_rate}, Commission: ₱${logSessionRes.session?.commission_earned}`);
  assert.strictEqual(logSessionRes.success, true);
  assert.strictEqual(logSessionRes.session.commission_earned, 510);

  // Fetch Coach's Commissions
  const commRes = await fetch(`${baseUrl}/coach/commissions`, {
    headers: { Authorization: `Bearer ${coachToken}` }
  }).then(r => r.json());
  console.log(' Coach Commissions Telemetry:', commRes.success, `Total: ₱${commRes.totalEarnings}, Completed Sessions: ${commRes.sessionsCount}`);
  assert.strictEqual(commRes.success, true);
  assert.ok(commRes.totalEarnings >= 510);

  // Check In Class Attendee
  const targetClass = classesRes.classes[0];
  const classCheckinRes = await fetch(`${baseUrl}/coach/classes/${targetClass.id}/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coachToken}`
    },
    body: JSON.stringify({
      member_name: 'Juan Dela Cruz',
      member_id: sampleClient.member_id || sampleClient.id
    })
  }).then(r => r.json());
  console.log(' Class Attendee Check-In:', classCheckinRes.success, classCheckinRes.message);
  assert.strictEqual(classCheckinRes.success, true);

  // --- TEST 3: FRONT-DESK POS CASHIER TERMINAL ---
  console.log('\n--- 3. Testing Front-Desk POS Cashier Terminal ---');
  // Employee Login
  const staffLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff.bgc@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());

  console.log(' Front-Desk Staff Login:', staffLogin.success, staffLogin.user?.name);
  assert.strictEqual(staffLogin.success, true);
  const staffToken = staffLogin.token;

  // Process POS Retail Checkout (Protein Shake Bar + Grab-and-Go Beverages)
  const posSaleRes = await fetch(`${baseUrl}/finance/record-sale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      customer_name: 'Walk-in Athlete (Carlos Vance)',
      payment_method: 'cash',
      category: 'protein_shakes',
      items: [
        { name: 'Standard Whey Shake (Chocolate Butterscotch • Whole Milk)', quantity: 2, unit_price: 180, category: 'protein_shakes' },
        { name: 'Whey Isolate Shake (Vanilla Leche Flan • Almond Milk)', quantity: 2, unit_price: 210, category: 'protein_shakes' },
        { name: 'Cold Bottled Mineral Water (500ml)', quantity: 2, unit_price: 35, category: 'drinks' },
        { name: 'Canned Performance Energy Drink', quantity: 1, unit_price: 110, category: 'drinks' },
        { name: 'Single Scoop Standard Whey (Powder Only)', quantity: 1, unit_price: 40, category: 'powder' }
      ]
    })
  }).then(r => r.json());

  console.log(' POS Cashier Retail Sale:', posSaleRes.success, `Invoice: ${posSaleRes.sale?.invoice_number}, Total: ₱${posSaleRes.sale?.amount}`);
  assert.strictEqual(posSaleRes.success, true);
  assert.strictEqual(posSaleRes.sale.amount, 1000); // 360 + 420 + 70 + 110 + 40 = 1000
  assert.strictEqual(posSaleRes.sale.royalty_amount, 75); // 7.5% of 1000 = 75

  console.log('\n ALL NEW ROLES & CAPABILITIES PASSED VERIFICATION SUITE!\n');
}

testNewRoles().catch(err => {
  console.error('\n Test execution error:', err);
  process.exit(1);
});
