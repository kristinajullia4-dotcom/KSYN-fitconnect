const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request({
    hostname: 'localhost',
    port: 5080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password });
  return res.data;
}

async function runTest() {
  console.log('--- STARTING UPGRADE REFLECTION VERIFICATION ---');

  // 1. Log in as Member, Branch Admin, and Employee (Front Desk)
  const memberAuth = await login('member.makati@ksyn.com', 'Password123!');
  const adminAuth = await login('admin.makati@ksyn.com', 'Password123!');
  const employeeAuth = await login('makati.staff@ksyn.com', 'StaffMember@2026');

  console.log('✓ Logged in as:');
  console.log('  - Member:', memberAuth.user.name, `(${memberAuth.user.id})`);
  console.log('  - Branch Admin:', adminAuth.user.name);
  console.log('  - Front Desk Employee:', employeeAuth.user.name);

  // 2. Member Upgrades Plan to '12_months' (Annual Elite)
  console.log('\n[STEP 1] Member upgrades plan to "12_months" (Annual Elite)...');
  const renewRes = await request({
    hostname: 'localhost',
    port: 5080,
    path: `/api/members/${memberAuth.user.id}/renew`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberAuth.token}`
    }
  }, {
    planId: '12_months',
    paymentMethod: 'gcash',
    months: 12
  });

  console.log('Renewal API status:', renewRes.status);
  console.log('Renewal response:', renewRes.data);
  if (!renewRes.data.success) {
    throw new Error('Member upgrade renewal failed: ' + JSON.stringify(renewRes.data));
  }
  console.log('✓ Member successfully upgraded to 12_months (Elite)!');

  // 3. Verify Branch Admin sees the upgraded plan & tier immediately
  console.log('\n[STEP 2] Verifying Branch Admin (/api/branch-admin/members)...');
  const adminMembersRes = await request({
    hostname: 'localhost',
    port: 5080,
    path: '/api/branch-admin/members',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminAuth.token}`
    }
  });

  const memberInAdmin = adminMembersRes.data.members.find(m => m.id === memberAuth.user.id);
  console.log('Member profile seen by Branch Admin:', {
    name: memberInAdmin?.name,
    membership_plan: memberInAdmin?.membership_plan,
    plan_name: memberInAdmin?.plan_name,
    membership_tier: memberInAdmin?.membership_tier,
    rfid_card_uid: memberInAdmin?.rfid_card_uid,
    sub_end_date: memberInAdmin?.subscription?.end_date
  });

  if (memberInAdmin?.membership_plan !== '12_months' || memberInAdmin?.membership_tier !== 'elite') {
    throw new Error(`Branch Admin did NOT see upgraded plan! Found: ${memberInAdmin?.membership_plan}, ${memberInAdmin?.membership_tier}`);
  }
  console.log('✓ PASSED: Branch Admin immediately reflects upgraded "12_months" & "elite" tier!');

  // 4. Verify Front Desk (Employee) sees the upgraded plan in Member Look-Up (/api/members)
  console.log('\n[STEP 3] Verifying Front Desk Employee (/api/members)...');
  const employeeMembersRes = await request({
    hostname: 'localhost',
    port: 5080,
    path: '/api/members',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${employeeAuth.token}`
    }
  });

  console.log('Employee members API status:', employeeMembersRes.status);
  const memberInEmployee = employeeMembersRes.data.members.find(m => m.id === memberAuth.user.id);
  console.log('Member profile seen by Front Desk Employee:', {
    name: memberInEmployee?.name,
    membership_plan: memberInEmployee?.membership_plan,
    plan_name: memberInEmployee?.plan_name,
    membership_tier: memberInEmployee?.membership_tier,
    rfid_card_uid: memberInEmployee?.rfid_card_uid,
    sub_end_date: memberInEmployee?.subscription?.end_date
  });

  if (memberInEmployee?.membership_plan !== '12_months' || memberInEmployee?.membership_tier !== 'elite') {
    throw new Error(`Front Desk Employee did NOT see upgraded plan! Found: ${memberInEmployee?.membership_plan}, ${memberInEmployee?.membership_tier}`);
  }
  console.log('✓ PASSED: Front Desk Employee immediately reflects upgraded "12_months" & "elite" tier in Member Directory!');

  // 5. Verify Turnstile Gate Verification returns upgraded plan & tier
  console.log('\n[STEP 4] Testing Turnstile Gate Verification (/api/turnstile/verify)...');
  const rfidToUse = memberInEmployee.rfid_card_uid || 'KS-8829-4102';
  const turnstileRes = await request({
    hostname: 'localhost',
    port: 5080,
    path: '/api/turnstile/verify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employeeAuth.token}`
    }
  }, {
    rfid_uid: rfidToUse,
    branchId: employeeAuth.user.branch_id,
    supervisor_override: true,
    supervisor_pin: '1234'
  });

  console.log('Turnstile verification result:', {
    valid: turnstileRes.data.valid,
    member_name: turnstileRes.data.member?.name,
    plan_name: turnstileRes.data.member?.plan_name,
    tier: turnstileRes.data.member?.tier,
    subStatus: turnstileRes.data.member?.subStatus,
    sub_end_date: turnstileRes.data.member?.subscription_end_date
  });

  if (turnstileRes.data.member?.tier !== 'elite' || turnstileRes.data.member?.plan !== '12_months') {
    throw new Error(`Turnstile gate did NOT reflect upgraded plan! Found: ${turnstileRes.data.member?.plan}, ${turnstileRes.data.member?.tier}`);
  }
  console.log('✓ PASSED: Turnstile gate immediately reflects upgraded "12 Months Annual Elite" & "elite" tier!');

  // 6. Verify Attendance Stream contains upgraded plan
  console.log('\n[STEP 5] Checking Attendance Stream (/api/qr/attendance-logs)...');
  const logsRes = await request({
    hostname: 'localhost',
    port: 5080,
    path: '/api/qr/attendance-logs',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${employeeAuth.token}`
    }
  });

  const latestLog = logsRes.data.logs?.[0];
  console.log('Latest Turnstile Check-In Log:', {
    member_name: latestLog?.member_name,
    member_plan: latestLog?.member_plan,
    plan_name: latestLog?.plan_name,
    member_tier: latestLog?.member_tier,
    status: latestLog?.status
  });

  if (latestLog?.member_tier !== 'elite' || latestLog?.member_plan !== '12_months') {
    throw new Error(`Attendance log did NOT record upgraded plan! Found: ${latestLog?.member_plan}, ${latestLog?.member_tier}`);
  }
  console.log('✓ PASSED: Front Desk Attendance Log accurately records upgraded "12 Months Annual Elite" & "elite" tier!');

  console.log('\n🎉 ALL TESTS PASSED! Member plan upgrade reflects 100% on Branch Admin and Front Desk!');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
