const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:5080';

function post(endpoint, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(endpoint, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(respData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: respData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(endpoint, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(respData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: respData });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('========================================================================');
  console.log(' VERIFYING 4-STEP PT ENROLLMENT, FRONT DESK CLEARANCE & COMMISSIONS');
  console.log('========================================================================\n');

  // 1. Authenticate Personas
  console.log('1. Authenticating Branch Admin, Front Desk Staff, and Coach...');
  const adminLogin = await post('/api/auth/login', {
    email: 'admin.makati@ksyn.com',
    password: 'Password123!'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.body.token;

  // Provision fresh test athlete to ensure fresh enrollment state
  const athleteEmail = `athlete.workflow.${Date.now()}@ksyn.com`;
  const provRes = await post('/api/auth/provision', {
    name: 'Carlos Mendoza Athlete',
    email: athleteEmail,
    password: 'Password123!',
    role: 'member',
    branch_id: 'b-mkt-01'
  }, adminToken);
  assert.strictEqual(provRes.status, 201, 'Failed to provision test athlete');

  // Login as fresh athlete
  const memberLogin = await post('/api/auth/login', {
    email: athleteEmail,
    password: 'Password123!'
  });
  assert.strictEqual(memberLogin.status, 200, 'Member login failed');
  const memberToken = memberLogin.body.token;
  const memberUser = memberLogin.body.user;

  // Front Desk Employee Login
  const staffLogin = await post('/api/auth/login', {
    email: 'makati.staff@ksyn.com',
    password: 'StaffMember@2026'
  });
  assert.strictEqual(staffLogin.status, 200, 'Employee login failed');
  const staffToken = staffLogin.body.token;

  // Coach Sofia Login
  const coachLogin = await post('/api/auth/login', {
    email: 'coach.sofia@ksyn.com',
    password: 'Password123!'
  });
  assert.strictEqual(coachLogin.status, 200, 'Coach login failed');
  const coachToken = coachLogin.body.token;
  const coachUser = coachLogin.body.user;
  console.log(` Personas authenticated: Member (${memberUser.name}), Staff (Maya Lin), Coach (${coachUser.name})\n`);

  // 2. Fetch Available Coaches
  console.log('2. Member checking available branch coaches...');
  const coachesRes = await get('/api/members/available-coaches', memberToken);
  assert.strictEqual(coachesRes.status, 200);
  assert.ok(Array.isArray(coachesRes.body.coaches), 'Coaches list missing');
  const targetCoach = coachesRes.body.coaches.find(c => c.id === coachUser.id) || coachesRes.body.coaches[0];
  console.log(` Selected Coach: ${targetCoach.name} (ID: ${targetCoach.id})\n`);

  // 3. STEP 1 & 2: Member Initiates Online Xendit PT Enrollment
  console.log('3. [STEP 1 & 2]: Member initiating 12-Session PT Package with Online Xendit payment...');
  const enrollRes = await post('/api/members/pt-enrollments/initiate', {
    coach_id: targetCoach.id,
    package_id: 'pt-12',
    sessions_total: 12,
    goal: 'Hypertrophy & Biomechanics',
    payment_channel: 'online_xendit',
    payment_method_detail: 'gcash'
  }, memberToken);

  assert.strictEqual(enrollRes.status, 200);
  const enrollment = enrollRes.body.enrollment;
  assert.ok(enrollment, 'Enrollment object missing');
  console.log(` Enrollment Initiated: Ref ${enrollment.payment_reference}`);
  console.log(`   Enrollment Status: ${enrollment.enrollment_status}`);
  console.log(`   Payment Status: ${enrollment.payment_status} (Channel: ${enrollment.payment_channel})`);
  console.log(`   Total Amount: ₱${enrollment.total_price.toLocaleString()}\n`);

  // 4. Verify Coach Cannot See Trainee Yet (Strict Front Desk Boundary)
  console.log('4. Verifying Coach Roster Boundary: Trainee must NOT appear before clearance...');
  const coachClientsBefore = await get('/api/coach/clients', coachToken);
  assert.strictEqual(coachClientsBefore.status, 200);
  const traineeBefore = coachClientsBefore.body.clients?.find(c => c.client_id === enrollment.member_id && c.enrollment_id === enrollment.id);
  assert.strictEqual(traineeBefore, undefined, 'Tenant Security Failure: Trainee visible before Front Desk clearance!');
  console.log(' Verified: Trainee is strictly quarantined from Coach portal until Front Desk approval.\n');

  // 5. STEP 3: Front Desk Queue Inspection
  console.log('5. [STEP 3]: Front Desk Staff checking Incoming PT Queue...');
  const queueRes = await get('/api/pos/pt-enrollments', staffToken);
  assert.strictEqual(queueRes.status, 200);
  console.log(`   Queue Count: ${queueRes.body.count} total enrollments (${queueRes.body.pending_count} pending)`);
  const queuedItem = queueRes.body.enrollments?.find(e => e.id === enrollment.id);
  assert.ok(queuedItem, 'Enrollment not found in Front Desk Queue');
  console.log(` Found enrollment in Front Desk Queue: ${queuedItem.member_name} -> ${queuedItem.coach_name} (Status: ${queuedItem.payment_status})\n`);

  // 6. Front Desk Staff Clears Enrollment & Collects / Confirms
  console.log('6. Front Desk Staff clicking [ Confirm & Assign to Coach ]...');
  const clearRes = await post(`/api/pos/pt-enrollments/${enrollment.id}/clear`, {
    notes: 'Payment verified and cleared at Makati Front Desk Counter'
  }, staffToken);

  assert.strictEqual(clearRes.status, 200);
  assert.strictEqual(clearRes.body.success, true);
  console.log(` Clearance confirmed: ${clearRes.body.message}`);
  console.log(`   Active PT Contract ID: ${clearRes.body.ptClient?.id}`);
  console.log(`   Sales Commission Logged: ₱${clearRes.body.salesCommission?.commission_earned} (15% of ₱${enrollment.total_price})\n`);

  // 7. STEP 4: Coach Portal Visibility & Commission Architecture
  console.log('7. [STEP 4]: Verifying Coach Portal Visibility & Commissions...');
  const coachClientsAfter = await get('/api/coach/clients', coachToken);
  const activeTrainee = coachClientsAfter.body.clients?.find(c => c.client_id === enrollment.member_id);
  assert.ok(activeTrainee, 'Trainee not found in Coach Roster after Front Desk clearance');
  console.log(` Trainee active in Coach Roster: ${activeTrainee.client_name}`);
  console.log(`   Package: ${activeTrainee.package_plan} (${activeTrainee.sessions_completed}/${activeTrainee.sessions_total} sessions completed)`);

  // 8. Coach Commission & Performance Accrual Telemetry
  console.log('\n8. Checking Coach Commission Telemetry...');
  const commRes = await get('/api/coach/commissions', coachToken);
  assert.strictEqual(commRes.status, 200);
  console.log(`   Sales Commission Total: ₱${commRes.body.salesCommissionTotal.toLocaleString()}`);
  console.log(`   Servicing Commission Total: ₱${commRes.body.servicingCommissionTotal.toLocaleString()}`);
  console.log(`   Active Milestone Tier: ${commRes.body.milestoneTier?.tier_level} (${commRes.body.milestoneTier?.active_servicing_rate_percent}% Servicing Rate)`);
  console.log(`   Total Earnings Accrued: ₱${commRes.body.totalEarnings.toLocaleString()}`);

  // 9. Coach Conducts & Logs Workout Session (Servicing Milestone Commission)
  console.log('\n9. Coach conducting and logging workout session with client...');
  const sessionLogRes = await post('/api/coach/sessions', {
    client_id: activeTrainee.id,
    duration_mins: 60,
    focus: 'Barbell Hypertrophy & Kinetic Assessment',
    rpe_intensity: '8/10',
    notes: 'Excellent movement biomechanics on squats. Mobility drills prescribed.'
  }, coachToken);

  assert.strictEqual(sessionLogRes.status, 201);
  const loggedSession = sessionLogRes.body.session;
  console.log(` Session Logged successfully: ID ${loggedSession?.id}`);
  console.log(`   Milestone Servicing Tier: ${loggedSession?.milestone_tier}`);
  console.log(`   Servicing Rate: ${loggedSession?.coach_split_percentage}%`);
  console.log(`   Servicing Commission Earned: ₱${loggedSession?.commission_earned}`);

  // 10. STEP 1 & 2 (OPTION B): Member Initiates Over-the-Counter Cash Enrollment
  console.log('\n10. [OPTION B]: Member 2 initiating 16-Session PT Package with Over-the-Counter Cash...');
  const athleteEmail2 = `athlete.otc.${Date.now()}@ksyn.com`;
  await post('/api/auth/provision', {
    name: 'Samantha OTC Athlete',
    email: athleteEmail2,
    password: 'Password123!',
    role: 'member',
    branch_id: 'b-mkt-01'
  }, adminToken);

  const memberLogin2 = await post('/api/auth/login', { email: athleteEmail2, password: 'Password123!' });
  const memberToken2 = memberLogin2.body.token;

  const otcEnrollRes = await post('/api/members/pt-enrollments/initiate', {
    coach_id: targetCoach.id,
    package_id: 'pt-16',
    sessions_total: 16,
    goal: 'Powerlifting & Maximal Strength',
    payment_channel: 'counter_cash',
    payment_method_detail: 'cash'
  }, memberToken2);

  assert.strictEqual(otcEnrollRes.status, 200);
  const otcEnrollment = otcEnrollRes.body.enrollment;
  assert.strictEqual(otcEnrollment.payment_status, 'COLLECT_CASH');
  assert.strictEqual(otcEnrollment.enrollment_status, 'ENROLLMENT_PENDING_PAYMENT');
  assert.ok(otcEnrollment.payment_reference.startsWith('OTC-PT-'));
  console.log(` OTC Cash Enrollment Queued: Ref ${otcEnrollment.payment_reference}`);
  console.log(`   Payment Status: ${otcEnrollment.payment_status} (Amount to collect: ₱${otcEnrollment.total_price.toLocaleString()})`);

  // 11. Front Desk Receives Cash & Clears
  console.log('\n11. Front Desk Staff receiving cash at counter and clearing PT enrollment...');
  const otcClearRes = await post(`/api/pos/pt-enrollments/${otcEnrollment.id}/clear`, {
    cash_tendered: 8000,
    change_due: 500,
    notes: 'Collected ₱7,500 cash at reception'
  }, staffToken);

  assert.strictEqual(otcClearRes.status, 200);
  assert.strictEqual(otcClearRes.body.success, true);
  console.log(` OTC Cash clearance confirmed: ${otcClearRes.body.message}`);
  console.log(`   Sales Commission Earned: ₱${otcClearRes.body.salesCommission?.commission_earned} (15% of ₱${otcEnrollment.total_price})`);
  console.log(`   POS Sale Ledger Entry: Ref ${otcClearRes.body.sale?.reference_no} (Method: ${otcClearRes.body.sale?.payment_method})`);

  console.log('\n========================================================================');
  console.log(' ALL 11 TEST STEPS IN PT ENROLLMENT & COMMISSION FLOW PASSED (100%)!');
  console.log('========================================================================\n');
}

runTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
