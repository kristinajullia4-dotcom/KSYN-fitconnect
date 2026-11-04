const assert = require('assert');

const BASE_URL = 'http://localhost:5080/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('============================================================');
  console.log(' VERIFYING COACH REGISTRATION & TENANT ISOLATION (RBAC)');
  console.log('============================================================\n');

  // Step 1: Login as Super Admin
  console.log('1. Authenticating Super Admin...');
  const saLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'superadmin@ksyn.com', password: 'Password123!' })
  });
  assert.strictEqual(saLogin.status, 200, 'Super admin login failed');
  const saToken = saLogin.data.token || saLogin.data.accessToken;
  assert.ok(saToken, 'Missing Super admin JWT token');
  console.log(' Super Admin authenticated.');

  // Step 2: Super Admin provisions a Coach bound to BGC branch (branch-bgc-02)
  console.log('\n2. Super Admin provisioning Coach for BGC Branch (branch-bgc-02)...');
  const coachBgcEmail = `coach.bgc.${Date.now()}@ksyn.com`;
  const saCreateCoach = await request('/super-admin/admins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({
      name: 'Coach Marcus BGC',
      email: coachBgcEmail,
      username: `marcus_bgc_${Date.now()}`,
      password: 'CoachPass@2026!',
      role: 'coach',
      branch_id: 'branch-bgc-02'
    })
  });
  assert.strictEqual(saCreateCoach.status, 201, `Super Admin create coach failed: ${JSON.stringify(saCreateCoach.data)}`);
  assert.strictEqual(saCreateCoach.data.admin.role, 'coach', 'Role was not set to coach');
  assert.strictEqual(saCreateCoach.data.admin.branch_id, 'branch-bgc-02', 'Branch ID was not set to branch-bgc-02');
  console.log(' Super Admin successfully provisioned Coach Marcus bound to branch-bgc-02.');

  // Step 3: Login as Branch Admin (Makati: branch-mkt-01)
  console.log('\n3. Authenticating Branch Admin (Makati)...');
  const baLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Password123!' })
  });
  assert.strictEqual(baLogin.status, 200, 'Branch admin login failed');
  const baToken = baLogin.data.token || baLogin.data.accessToken;
  const baBranchId = baLogin.data.user.branch_id;
  assert.strictEqual(baBranchId, 'b-mkt-01', 'Branch Admin is not b-mkt-01');
  console.log(` Branch Admin authenticated (branch: ${baBranchId}).`);

  // Step 4: Branch Admin provisions a Coach with role: 'coach'
  console.log('\n4. Branch Admin provisioning Coach for Makati Branch...');
  const coachMktEmail = `coach.mkt.${Date.now()}@ksyn.com`;
  const baCreateCoach = await request('/branch-admin/staff', {
    method: 'POST',
    headers: { Authorization: `Bearer ${baToken}` },
    body: JSON.stringify({
      full_name: 'Coach Elena Makati',
      email: coachMktEmail,
      username: `elena_mkt_${Date.now()}`,
      password: 'CoachPass@2026!',
      shift_role: 'Fitness Coach / Personal Trainer',
      role: 'coach',
      branch_id: 'b-bgc-02' // Attempt to breach tenant isolation!
    })
  });
  assert.strictEqual(baCreateCoach.status, 201, `Branch Admin create coach failed: ${JSON.stringify(baCreateCoach.data)}`);
  assert.strictEqual(baCreateCoach.data.staff.role, 'coach', 'Role was not set to coach');
  assert.strictEqual(baCreateCoach.data.staff.branch_id, 'b-mkt-01', 'Tenant isolation failed! Branch Admin assigned foreign branch');
  console.log(' Branch Admin provisioned Coach Elena strictly bound to b-mkt-01 (Tenant Isolation verified!).');

  // Step 5: Verify Tenant Boundary Guard: Branch Admin cannot create super_admin or branch_admin
  console.log('\n5. Verifying Privilege Escalation Prevention on Branch Admin...');
  const escalationAttempt = await request('/branch-admin/staff', {
    method: 'POST',
    headers: { Authorization: `Bearer ${baToken}` },
    body: JSON.stringify({
      full_name: 'Hacker Admin',
      email: `hacker.${Date.now()}@ksyn.com`,
      password: 'Password123!',
      role: 'super_admin'
    })
  });
  assert.strictEqual(escalationAttempt.status, 403, 'Branch Admin was able to escalate role!');
  console.log(' Privilege escalation blocked with 403 Forbidden.');

  // Step 6: Verify Branch Admin staff roster returns coaches
  console.log('\n6. Verifying Branch Admin staff roster includes Coach Elena...');
  const staffRoster = await request('/branch-admin/staff', {
    method: 'GET',
    headers: { Authorization: `Bearer ${baToken}` }
  });
  assert.strictEqual(staffRoster.status, 200, 'Failed to fetch staff roster');
  const coachInRoster = staffRoster.data.staff.find(s => s.email === coachMktEmail);
  assert.ok(coachInRoster, 'Newly provisioned Coach Elena was not found in Makati staff roster');
  assert.strictEqual(coachInRoster.role, 'coach');
  assert.strictEqual(coachInRoster.branch_id, 'b-mkt-01');
  console.log(' Coach Elena present in Makati Staff & Coaches roster.');

  // Step 7: Verify Coach Login and Automated Routing Credentials
  console.log('\n7. Verifying Coach Login & Role Routing (/dashboard/coach)...');
  const coachLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: coachMktEmail, password: 'CoachPass@2026!' })
  });
  assert.strictEqual(coachLogin.status, 200, 'Coach login failed');
  assert.strictEqual(coachLogin.data.user.role, 'coach', 'Logged in user role is not coach');
  assert.strictEqual(coachLogin.data.user.branch_id, 'b-mkt-01', 'Coach branch_id mismatch');
  const coachToken = coachLogin.data.token || coachLogin.data.accessToken;
  console.log(` Coach logged in successfully! Role: "${coachLogin.data.user.role}" -> Routes to /dashboard/coach.`);

  // Step 8: Verify Coach RBAC boundary (Cannot access super admin endpoints)
  console.log('\n8. Verifying Coach RBAC Boundaries...');
  const coachForbidden = await request('/super-admin/admins', {
    method: 'GET',
    headers: { Authorization: `Bearer ${coachToken}` }
  });
  assert.strictEqual(coachForbidden.status, 403, 'Coach should not access super admin endpoints');
  console.log(' Coach blocked from Super Admin endpoint (403 Forbidden).');

  console.log('\n============================================================');
  console.log(' ALL 8 RBAC & COACH PROVISIONING TESTS PASSED (100%)!');
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('\n TEST FAILED:', err.message);
  process.exit(1);
});
