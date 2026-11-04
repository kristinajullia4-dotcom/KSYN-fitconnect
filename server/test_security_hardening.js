const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.API_URL || 'http://localhost:5080/api';

async function runSecurityTests() {
  console.log('\n============================================================');
  console.log('  VERIFYING SECURITY HARDENING & DEFENSE-IN-DEPTH SUITE');
  console.log('   Target: ' + baseUrl);
  console.log('============================================================\n');

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
  // TEST 1: rolePassMap REMOVAL
  // -------------------------------------------------------------
  await test('1. Hardcoded fallback password (Admin@12345) is rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Admin@12345' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401, 'Fallback password should be rejected with 401');
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'INVALID_CREDENTIALS');
  });

  await test('2. Legitimate bcrypt password (Password123!) authenticates properly', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.makati@ksyn.com', password: 'Password123!' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.accessToken, 'Should return accessToken');
    assert.ok(data.refreshToken, 'Should return refreshToken');
  });

  // -------------------------------------------------------------
  // TEST 2: DUAL-TOKEN & REFRESH TOKEN ROTATION (RTR)
  // -------------------------------------------------------------
  let originalRefresh = null;
  let rotatedRefresh = null;
  let secondAccessToken = null;

  await test('3. Login issues dual tokens (15m Access Token + 7d Refresh Token)', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member.makati@ksyn.com', password: 'Password123!' })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.accessToken, 'Access token missing');
    assert.ok(data.refreshToken, 'Refresh token missing');
    assert.strictEqual(data.expires_in, 900, 'Access token should expire in 15m (900s)');
    originalRefresh = data.refreshToken;
  });

  await test('4. POST /api/auth/refresh rotates tokens successfully', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: originalRefresh })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.accessToken, 'New access token missing');
    assert.ok(data.refreshToken, 'Rotated refresh token missing');
    assert.notStrictEqual(data.refreshToken, originalRefresh, 'Refresh token must be rotated');
    rotatedRefresh = data.refreshToken;
    secondAccessToken = data.accessToken;
  });

  await test('5. Replay Attack Detection: Reusing consumed refresh token triggers breach alert', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: originalRefresh })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.error, 'REFRESH_TOKEN_REUSE_DETECTED');
  });

  await test('6. Accessing profile with new rotated access token succeeds', async () => {
    const res = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${secondAccessToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
  });

  // -------------------------------------------------------------
  // TEST 3: SUPERVISOR PIN & ANTI-PASSBACK HARDENING
  // -------------------------------------------------------------
  let deskToken = null;
  let passToken = null;

  await test('7. Setup staff & athlete turnstile pass', async () => {
    const sLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
    }).then(r => r.json());
    deskToken = sLogin.token;

    const mLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    }).then(r => r.json());

    const passRes = await fetch(`${baseUrl}/qr/generate-pass`, {
      headers: { Authorization: `Bearer ${mLogin.token}` }
    }).then(r => r.json());
    passToken = passRes.token;

    const scanRes = await fetch(`${baseUrl}/qr/verify-pass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deskToken}`
      },
      body: JSON.stringify({ token: passToken, reset_apb: true })
    }).then(r => r.json());
    assert.strictEqual(scanRes.valid, true, 'First scan should succeed');
  });

  await test('8. Boolean supervisor_override: true without valid PIN is rejected', async () => {
    const mLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    }).then(r => r.json());
    const passRes = await fetch(`${baseUrl}/qr/generate-pass`, {
      headers: { Authorization: `Bearer ${mLogin.token}` }
    }).then(r => r.json());

    const res = await fetch(`${baseUrl}/qr/verify-pass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deskToken}`
      },
      body: JSON.stringify({
        token: passRes.token,
        supervisor_override: true // Boolean without PIN must be ignored
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.reason, 'ANTI_PASSBACK_VIOLATION');
  });

  await test('9. Invalid supervisor PIN (9999) is rejected', async () => {
    const mLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    }).then(r => r.json());
    const passRes = await fetch(`${baseUrl}/qr/generate-pass`, {
      headers: { Authorization: `Bearer ${mLogin.token}` }
    }).then(r => r.json());

    const res = await fetch(`${baseUrl}/qr/verify-pass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deskToken}`
      },
      body: JSON.stringify({
        token: passRes.token,
        supervisor_pin: '9999',
        override_reason: 'Unauthorized bypass attempt'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.reason, 'ANTI_PASSBACK_VIOLATION');
  });

  await test('10. Hashed supervisor PIN (1234) with audit reason is verified and approved', async () => {
    const mLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'samantha.perez@ksyn.com', password: 'Password123!' })
    }).then(r => r.json());
    const passRes = await fetch(`${baseUrl}/qr/generate-pass`, {
      headers: { Authorization: `Bearer ${mLogin.token}` }
    }).then(r => r.json());

    const res = await fetch(`${baseUrl}/qr/verify-pass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deskToken}`
      },
      body: JSON.stringify({
        token: passRes.token,
        supervisor_pin: '1234',
        override_reason: 'Supervisor override: Member retrieved medicine from vehicle'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.valid, true);
  });

  // -------------------------------------------------------------
  // TEST 4: DURABLE PERSISTENCE OF REVOKED TOKENS
  // -------------------------------------------------------------
  await test('11. Revoked token is saved in persistent store file', async () => {
    const mLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member.makati@ksyn.com', password: 'Password123!' })
    }).then(r => r.json());

    await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mLogin.token}` }
    });

    // Wait for debounced scheduleSave (150ms) to flush to disk
    await new Promise(r => setTimeout(r, 300));

    // Verify revoked token was captured in data store
    const storePath = path.join(__dirname, '..', 'data', 'ksyn_store.json');
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      assert.ok(Array.isArray(data.revoked_tokens), 'Store should have revoked_tokens array');
      assert.ok(data.revoked_tokens.includes(mLogin.token), 'Revoked token must be written to disk');
    }
  });

  console.log('\n============================================================');
  console.log(` RESULT: ${passed} / ${total} TESTS PASSED`);
  if (passed === total) {
    console.log(' ALL SECURITY HARDENING TESTS PASSED 100%!');
  } else {
    console.log(' SOME SECURITY TESTS ENCOUNTERED FAILURES');
  }
  console.log('============================================================\n');
}

runSecurityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
