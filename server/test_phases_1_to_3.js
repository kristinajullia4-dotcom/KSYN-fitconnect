const assert = require('assert');

const BASE_URL = 'http://localhost:5080/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runPhasesVerification() {
  console.log('\n================================================================');
  console.log('  VERIFYING HARDENING ROADMAP PHASES 1 TO 3');
  console.log('   Target URL: ' + BASE_URL);
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(` [PASS] ${name}`);
    } catch (err) {
      console.error(` [FAIL] ${name}:`, err.message);
    }
  }

  // -------------------------------------------------------------
  // PHASE 1: TOKEN BLACKLIST & PROGRESSIVE LOCKOUT
  // -------------------------------------------------------------
  let memberToken = null;

  await test('Phase 1.1: Member Authenticates & Receives Valid Token', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'member.makati@ksyn.com', password: 'Password123!' })
    });
    assert.strictEqual(res.ok, true, 'Login should succeed');
    assert.ok(res.data.token, 'Should receive token');
    memberToken = res.data.token;
  });

  await test('Phase 1.2: Authenticated Route Accessible Before Logout', async () => {
    const res = await request('/auth/profile', {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.ok, true, 'Profile should be accessible');
    assert.strictEqual(res.data.success, true);
  });

  await test('Phase 1.3: Logout Revokes Token and Adds to Blacklist', async () => {
    const res = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.ok, true, 'Logout should succeed');
    assert.strictEqual(res.data.success, true);
  });

  await test('Phase 1.4: Revoked Token is Rejected on Subsequent Requests', async () => {
    const res = await request('/auth/profile', {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.status, 401, 'Revoked token must be rejected with 401');
    assert.strictEqual(res.data.error, 'TOKEN_REVOKED', 'Should indicate TOKEN_REVOKED');
  });

  // -------------------------------------------------------------
  // PHASE 2: HARD ANTI-PASSBACK (APB) & BLIND CASH-UP
  // -------------------------------------------------------------
  let deskToken = null;
  let sPassToken = null;

  await test('Phase 2.1: Staff Authenticates & Kiosk Prepares Turnstile', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
    });
    assert.strictEqual(res.ok, true, 'Staff login failed');
    deskToken = res.data.token;
  });

  await test('Phase 2.2: Generate Dynamic 60-Second QR Pass for Athlete Samantha', async () => {
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    });
    assert.strictEqual(loginRes.ok, true, 'Samantha login failed');
    const sToken = loginRes.data.token;
    const passRes = await request('/qr/generate-pass', {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    assert.strictEqual(passRes.ok, true, 'Pass generation failed');
    assert.ok(passRes.data.token, 'Should have pass token');
    sPassToken = passRes.data.token;
  });

  await test('Phase 2.3: First Turnstile Scan is Granted', async () => {
    const res = await request('/qr/verify-pass', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deskToken}` },
      body: JSON.stringify({ token: sPassToken, reset_apb: true })
    });
    assert.strictEqual(res.ok, true, 'Verify-pass endpoint returned error');
    assert.strictEqual(res.data.valid, true, 'First scan must be valid');
  });

  await test('Phase 2.4: Immediate Re-Scan Triggers Hard Anti-Passback Block', async () => {
    // Generate fresh ticket for same member to simulate immediate re-entry/passback
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    });
    const passRes = await request('/qr/generate-pass', {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    const res = await request('/qr/verify-pass', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deskToken}` },
      body: JSON.stringify({ token: passRes.data.token })
    });
    assert.strictEqual(res.status, 403, 'Anti-passback must return 403');
    assert.strictEqual(res.data.valid, false);
    assert.strictEqual(res.data.reason, 'ANTI_PASSBACK_VIOLATION');
    assert.strictEqual(res.data.requires_override, true);
  });

  await test('Phase 2.5: Anti-Passback Can Be Overridden with Supervisor PIN (1234)', async () => {
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    });
    const passRes = await request('/qr/generate-pass', {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    const res = await request('/qr/verify-pass', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deskToken}` },
      body: JSON.stringify({
        token: passRes.data.token,
        supervisor_pin: '1234',
        override_reason: 'Supervisor manual override for locker retrieval'
      })
    });
    assert.strictEqual(res.ok, true, 'Supervisor override failed');
    assert.strictEqual(res.data.valid, true, 'Override must grant admission');
  });

  await test('Phase 2.6: POS Blind Cash-Up Denomination Calculator Auditing', async () => {
    const res = await request('/finance/cash-drawer/blind-reconciliation', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deskToken}` },
      body: JSON.stringify({
        opening_float: 5000,
        denominations: {
          p1000: 5,  // 5000
          p500: 2,   // 1000
          p200: 0,
          p100: 10,  // 1000
          p50: 0,
          p20: 0,
          coins: 0
        },
        closing_notes: 'Standard shift close count'
      })
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.report.physical_counted_cash, 7000);
    assert.ok(res.data.report.variance !== undefined);
  });

  // -------------------------------------------------------------
  // PHASE 3: OPERATIONAL INTELLIGENCE & ROLE UPGRADES
  // -------------------------------------------------------------
  let adminToken = null;
  await test('Phase 3.0: Branch Admin Authenticates for BIR Tax Access', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Password123!' })
    });
    assert.strictEqual(res.ok, true);
    adminToken = res.data.token;
  });

  await test('Phase 3.1: BIR Form 2307 Creditable Withholding Tax Certificate', async () => {
    const res = await request('/finance/bir-2307/rem-mkt-2026-001', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.certificate.certificate_number);
    assert.strictEqual(res.data.certificate.income_payments[0].atc, 'WC158');
    assert.strictEqual(res.data.certificate.income_payments[0].tax_rate, '5%');
  });

  await test('Phase 3.2: Live Gym Floor Density & Occupancy Telemetry', async () => {
    const res = await request('/members/floor-density', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.current_occupancy >= 0);
    assert.ok(res.data.occupancy_pct >= 0);
    assert.ok(Array.isArray(res.data.hourly_forecast));
  });

  let coachToken = null;
  let createdPlanId = null;

  await test('Phase 3.3: Coach Workout Routine Program Builder', async () => {
    const coachLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'coach.sofia@ksyn.com', password: 'Password123!' })
    });
    assert.strictEqual(coachLogin.ok, true);
    coachToken = coachLogin.data.token;

    const res = await request('/coach/workout-plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${coachToken}` },
      body: JSON.stringify({
        client_id: 'u1000000-0000-0000-0000-000000000099',
        title: '6-Week Glute & Posterior Chain Hypertrophy',
        split_type: 'Glute & Posterior Chain Hypertrophy',
        days_per_week: 4,
        notes: 'Strict 2-second eccentric phase. Focus on hamstring mind-muscle connection.',
        exercises: [
          { name: 'Barbell Hip Thrust', sets: 4, reps: '8-10', target_weight: '140 kg', rest_seconds: 120 },
          { name: 'Romanian Deadlift (RDL)', sets: 3, reps: '10-12', target_weight: '100 kg', rest_seconds: 90 }
        ]
      })
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.plan.id);
    createdPlanId = res.data.plan.id;
  });

  await test('Phase 3.4: Member Fetches Workout Routine & Checks Off Exercise', async () => {
    const sLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    });
    assert.strictEqual(sLogin.ok, true, 'Samantha login failed');
    const sToken = sLogin.data.token;

    const plansRes = await request('/members/workout-plans', {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    assert.strictEqual(plansRes.ok, true);
    assert.ok(Array.isArray(plansRes.data.plans));
    assert.ok(plansRes.data.plans.length > 0, 'Must have at least 1 plan');

    const checkRes = await request(`/members/workout-plans/${createdPlanId}/complete-exercise`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sToken}` },
      body: JSON.stringify({ exerciseIndex: 0 })
    });
    assert.strictEqual(checkRes.ok, true, 'Toggle exercise failed');
    assert.strictEqual(checkRes.data.success, true);
    assert.strictEqual(checkRes.data.plan.exercises[0].completed, true);
  });

  console.log('\n================================================================');
  console.log(` RESULT: ${passed} / ${total} TESTS PASSED`);
  if (passed === total) {
    console.log(' ALL PHASES 1 TO 3 VERIFICATION TESTS PASSED FLAWLESSLY!');
  } else {
    console.log(' SOME TESTS ENCOUNTERED FAILURES');
  }
  console.log('================================================================\n');
}

runPhasesVerification();
