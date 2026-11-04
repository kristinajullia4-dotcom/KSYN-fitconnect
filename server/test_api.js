// Automated integration test for KSYN FitConnect REST API
const assert = require('assert');

async function testSuite() {
  const port = process.env.PORT || 5080;
  const baseUrl = process.env.API_URL || `http://localhost:${port}/api`;

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/health`).then(r => r.json());
  console.log(' Health check:', healthRes.status, `(${healthRes.mode})`);
  assert.strictEqual(healthRes.status, 'healthy');

  // 2. Auth Login - Super Admin
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'super_admin@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());
  console.log(' Super Admin login:', adminLogin.success, adminLogin.user.name);
  assert.strictEqual(adminLogin.success, true);
  const adminToken = adminLogin.token;

  // 3. Auth Login - Makati Flagship Branch Admin
  const mktAdminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());
  console.log(' Makati Flagship Branch Admin login:', mktAdminLogin.success, mktAdminLogin.user.name);
  assert.strictEqual(mktAdminLogin.success, true);
  const mktAdminToken = mktAdminLogin.token;

  // 4. Auth Login - Legacy Alias Compatibility (admin.bgc@ksyn.com)
  const legacyAdminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.bgc@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());
  console.log(' Legacy Alias login (admin.bgc@ksyn.com):', legacyAdminLogin.success, legacyAdminLogin.user.name);
  assert.strictEqual(legacyAdminLogin.success, true);

  // 5. Auth Login - Makati Employee
  const employeeLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
  }).then(r => r.json());
  console.log(' Makati Employee login:', employeeLogin.success, employeeLogin.user.name);
  assert.strictEqual(employeeLogin.success, true);
  const employeeToken = employeeLogin.token;

  // 6. Auth Login - Member (Makati)
  const memberLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member.makati@ksyn.com', password: 'Password123!' })
  }).then(r => r.json());
  console.log(' Makati Member login:', memberLogin.success, memberLogin.user.name);
  assert.strictEqual(memberLogin.success, true);
  const memberToken = memberLogin.token;

  // 7. Multi-Tenant Data Isolation Test:
  // Makati Admin requests branches -> Should only see Makati Flagship (MKT-01)
  const mktBranchesRes = await fetch(`${baseUrl}/branches`, {
    headers: { Authorization: `Bearer ${mktAdminToken}` }
  }).then(r => r.json());
  console.log(` Tenant Isolation: Makati Admin sees ${mktBranchesRes.branches.length} branch(es) (Branch: ${mktBranchesRes.branches[0].name})`);
  assert.strictEqual(mktBranchesRes.branches.length, 1);
  assert.strictEqual(mktBranchesRes.branches[0].code, 'MKT-01');

  // Super Admin requests branches -> Should see all 7 branches
  const superBranchesRes = await fetch(`${baseUrl}/branches`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  console.log(` Super Admin sees ${superBranchesRes.branches.length} branches across network`);
  assert.strictEqual(superBranchesRes.branches.length, 7);

  // 8. Cross-Tenant IDOR Protection:
  // Makati Admin query members -> Should only receive Makati members
  const mktMembersRes = await fetch(`${baseUrl}/members`, {
    headers: { Authorization: `Bearer ${mktAdminToken}` }
  }).then(r => r.json());
  console.log(` Makati Admin Member query returned ${mktMembersRes.members.length} members; all belong to Makati.`);
  assert.ok(mktMembersRes.members.every(m => m.branch_id === mktAdminLogin.user.branch_id));

  // 9. Dynamic 60-Second Cryptographic QR Code Generation
  const qrGenRes = await fetch(`${baseUrl}/qr/generate-pass`, {
    headers: { Authorization: `Bearer ${memberToken}` }
  }).then(r => r.json());
  console.log(' Generated 60-Second Cryptographic QR Pass:', qrGenRes.token.slice(0, 30) + '... (TTL: ' + qrGenRes.ttl + 's)');
  assert.strictEqual(qrGenRes.success, true);
  const validToken = qrGenRes.token;

  // 10. High-Speed Employee Scanner Verification & Check-in
  const scanRes = await fetch(`${baseUrl}/qr/verify-pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ token: validToken, branchId: employeeLogin.user.branch_id, supervisor_pin: '1234' })
  }).then(r => r.json());
  console.log(' Employee Kiosk Scanner Verification:', scanRes.valid, scanRes.message, `(Member: ${scanRes.member.name})`);
  assert.strictEqual(scanRes.valid, true);

  // 11. Anti-Replay Nonce Verification:
  // Re-scanning the exact same token immediately must be REJECTED!
  const replayRes = await fetch(`${baseUrl}/qr/verify-pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ token: validToken, branchId: employeeLogin.user.branch_id })
  }).then(r => r.json());
  console.log(' Anti-Replay Detection on duplicate scan:', replayRes.reason);
  assert.strictEqual(replayRes.valid, false);
  assert.strictEqual(replayRes.reason, 'REPLAY_ATTACK_DETECTED');

  // 12. Corporate Royalty Computation Engine
  const royaltiesRes = await fetch(`${baseUrl}/finance/royalties`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  console.log(` Corporate Royalty Engine: Total Gross Sales ₱${royaltiesRes.networkTotals.totalGrossSales.toLocaleString()}, Corporate Royalties ₱${royaltiesRes.networkTotals.totalCorporateRoyalties.toLocaleString()}`);
  assert.ok(royaltiesRes.networkTotals.totalCorporateRoyalties > 0);

  // 13. Audit Trail Verification
  const auditRes = await fetch(`${baseUrl}/audit`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  console.log(` System Audit Trail: ${auditRes.logs.length} immutable events recorded.`);
  assert.ok(auditRes.logs.length >= 3);

  console.log('\n ALL 13 TEST CASES PASSED SUCCESSFULLY!');
}

testSuite().catch(err => {
  console.error(' Test suite failed:', err);
  process.exit(1);
});
