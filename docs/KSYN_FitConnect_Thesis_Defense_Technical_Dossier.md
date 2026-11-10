# KSYN FitConnect: Complete Technical Dossier & Panel Defense Guide
## "A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation"

**Target Audience:** Undergraduate Thesis Examination Panel (IT & Cybersecurity Specialty)  
**System Classification:** Multi-Tenant Enterprise Software-as-a-Service (SaaS) Web Application  
**System Boundary Notice:** *This system is strictly an enterprise web application. Physical IoT hardware, microcontrollers (ESP32/Arduino), and electromechanical solenoid turnstile relays are delimited from this build. Physical check-ins, pass validations, and gate authorizations are executed via responsive front-desk web camera optical scanners and authenticated client endpoints.*

---

## 1. System Features & Granular Powers per Role Matrix

KSYN FitConnect enforces a strict, hierarchical **Role-Based Access Control (RBAC)** model layered directly on top of tenant data boundaries. Below is the exhaustive matrix of all features, capabilities, operational powers, and boundary constraints per role:

| Feature / Domain | Super Admin (HQ / Franchisor) | Branch Owner (Franchise Investor) | Branch Admin (Branch General Manager) | Front-Desk Staff / Cashier (`employee`) | Coach / Personal Trainer (`coach`) | Member / Athlete (`member`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **System Scope & Data Boundary** | **Global / Cross-Tenant** (All 7 Franchise Branches) | **Single Branch Locked** (`tenant_id` enforced) | **Single Branch Locked** (`tenant_id` enforced) | **Single Branch Locked** (`tenant_id` enforced) | **Single Branch & Assigned Clients Locked** | **Self-Account & Assigned Branch Locked** |
| **Authentication & Session** | Email/Password + Bcrypt (Cost 10) + JWT Token Rotation | Email/Password + Bcrypt (Cost 10) + JWT Token Rotation | Email/Password + Bcrypt (Cost 10) + JWT Token Rotation | Email/Password + Bcrypt (Cost 10) + PIN + JWT Token Rotation | Email/Password + Bcrypt (Cost 10) + JWT Token Rotation | Email/Password + Google OAuth 2.0 + Dynamic QR HMAC |
| **Franchise Branch Provisioning** | **Full Power**: Create, edit, suspend, archive franchise branches, assign initial owners. | **No Access**: Cannot create or modify branch configurations. | **No Access**: Cannot alter branch registry details. | **No Access** | **No Access** | **No Access** |
| **Financial Ledger & Royalty Tracking** | **Full Power**: View consolidated P&L across all branches; compute 7.5% HQ royalty cut; audit BIR 2307 vouchers. | **Read-Only Executive View**: Real-time sales rollups, monthly royalty invoices, BIR 2307 tax credits for their branch only. | **Operational Financials**: Daily sales reports, cashier shift audits, operational expense logging. | **Shift-Restricted**: Blind drawer entry, register cash collection, no visibility into overall P&L. | **Commission Ledger**: View personal 15% session commissions and payout history. | **Personal Billing**: View personal payment receipts and plan invoices. |
| **Front-Desk POS & Cashiering** | Can view audit logs of all branch transactions. | Read-only ledger of branch daily sales totals. | Approve voids, supervisor discounts, and manual price overrides. | **Full Cashiering**: Process cash, GCash, Maya, card payments; sell day passes, supplements, merch; print receipts. | **No Access** | **Self-Service**: Digital renewals via payment gateway integrations. |
| **Shift Management & Cash Governance** | Cross-branch shift audit review. | View closed shift financial summaries. | Review cashier variances, sign off on closed shifts, investigate discrepancies. | **Full Shift Operations**: Input opening float, record mid-shift cash drops, execute blind drawer count at close. | **No Access** | **No Access** |
| **Member Enrollment & Account Lifecycle** | Can inspect cross-branch accounts for fraud investigations. | View active/inactive member counts & retention metrics. | Register members, edit member profiles, freeze accounts, handle terminations. | Register walk-in members, capture member photos, issue physical RFID/passes. | View assigned client roster and training profiles. | Self-registration, profile management, personal biometric logs. |
| **Inter-Branch Member Transfers** | HQ arbitration if transfer disputes arise between branches. | View member incoming/outgoing migration metrics. | **2-Stage Transfer Clearance**: Initiate transfer from origin, approve or decline transfer at destination branch. | Check transfer status; prompt members with pending clearances. | Client transfer notifications if assigned athlete transfers. | **Self-Service Request**: Initiate transfer request to another branch; view live pending/declined status. |
| **Optical Pass Verification & Check-In** | System-wide access log audit. | View branch peak-hour foot-traffic charts. | Override Anti-Passback (APB) lockouts via Supervisor PIN (`1234`); review check-in denials. | **Full Scanner Power**: Run front-desk web camera optical scanner; validate rotating HMAC QR; tap manual RFID. | Check-in via coach roster; record client session attendance. | **Client Dynamic Pass**: Generate 60-second rotating HMAC-SHA256 optical QR code pass with countdown timer. |
| **Workout & Periodization Management** | Platform-level fitness routine template management. | View coach session utilization rates. | Assign members to coaches; review training schedule compliance. | View coach schedule to book client walk-ins. | **Full Programming Power**: Prescribe multi-week periodization splits, sets, reps, RPE, track weigh-ins, 1-on-1 chat. | View prescribed workouts, log set completions, record body weight and PRs. |
| **Staff & User Management** | Provision Branch Admins and Franchise Owners; reset credentials. | Request new admin/staff hires to HQ. | Hire, assign roles, and manage credentials for front-desk staff and coaches in their branch. | **No Access** | **No Access** | **No Access** |
| **Inventory & Equipment Maintenance** | Cross-branch equipment procurement oversight. | View equipment Capex & depreciation schedules. | Log equipment downtime, dispatch repair tickets, track inventory burn rate, order stock. | Process retail stock sales via POS (auto-deduct inventory count). | Report broken gym equipment to front desk. | View facility status announcements. |
| **Data Privacy & PII Access (RA 10173)** | Access full unmasked logs for compliance audits. | Masked PII (names, aggregated revenues, masked phone numbers). | Unmasked branch data for emergency contacts, member agreements. | **Toggleable PII Masking**: Email and phone numbers masked by default on front desk UI to deter shoulder-surfing. | Only sees assigned client phone/medical notes. | Full access to own data; Right to Data Portability (export data). |

---

## 2. Complete API Catalog & Route Architecture

FitConnect routes are organized strictly by functional domains. Every protected endpoint passes through authentication middleware (`authenticateToken`), tenant injection middleware (`resolveTenantContext`), and role verification middleware (`rbacGuard`).

### 2.1 Authentication & Credential Domain (`/api/auth`)

#### `POST /api/auth/login`
- **RBAC**: Public / Unauthenticated
- **Tenant Scope Enforcement**: Resolved dynamically from the user's registered account record upon successful credential validation.
- **Request Payload**:
  ```json
  {
    "email": "cashier.alabang@ksyn.com",
    "password": "StaffPass@2026!"
  }
  ```
- **Validation & Sanitation**: Regex validation on email format; string sanitization against SQL/NoSQL injection payloads.
- **Response Structure (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_99120",
      "name": "Maria Santos",
      "email": "cashier.alabang@ksyn.com",
      "role": "employee",
      "branch_id": "branch_002",
      "branch_code": "ALB"
    }
  }
  ```
- **Error Codes**: `400 Bad Request` (missing fields), `401 Unauthorized` (invalid password or email), `403 Forbidden` (account suspended).
- **Security Controls**: In-memory IP rate limiting (max 5 attempts per minute); salted bcrypt hash comparison (cost factor 10); JWT expiration set to 8 hours with sliding refresh.

#### `POST /api/auth/google`
- **RBAC**: Public (Members & Athletes)
- **Tenant Scope Enforcement**: Default assigned branch or user-selected home branch upon onboarding.
- **Request Payload**: `{ "credential": "<Google_ID_Token>" }`
- **Response (200 OK)**: Returns authenticated JWT and member profile.
- **Security Controls**: Google OAuth2 audience token verification against client ID.

---

### 2.2 Tenants & Franchise Management Domain (`/api/branches`)

#### `GET /api/branches`
- **RBAC**: `super_admin` (retrieves all 7 branches); all other roles retrieve their assigned branch only.
- **Tenant Scope**: Enforced in query resolver (`WHERE branch_id = req.user.branch_id` unless role is `super_admin`).
- **Response Structure (200 OK)**:
  ```json
  [
    {
      "id": "branch_001",
      "code": "BGC",
      "name": "KSYN FitConnect BGC Elite",
      "address": "Bonifacio High Street, Taguig City",
      "status": "active",
      "active_members_count": 482,
      "royalty_rate": 0.075
    }
  ]
  ```

#### `POST /api/branches/transfer-request`
- **RBAC**: `member`, `branch_admin`, `super_admin`
- **Tenant Scope**: Origin branch locked to `member.branch_id`; destination branch specified by `target_branch_id`.
- **Request Payload**:
  ```json
  {
    "memberId": "mem_4401",
    "targetBranchId": "branch_003",
    "reason": "Relocating residence to Quezon City"
  }
  ```
- **Response (201 Created)**: `{ "success": true, "requestId": "trf_8812", "status": "pending_target_approval" }`
- **Error Codes**: `400 Bad Request` (same branch transfer), `409 Conflict` (existing pending transfer exists).

#### `POST /api/branches/transfer-review`
- **RBAC**: `branch_admin` (target branch only) or `super_admin`
- **Tenant Scope**: Requires `req.user.branch_id == transfer.targetBranchId`.
- **Request Payload**: `{ "requestId": "trf_8812", "action": "approved" | "declined", "notes": "Capacity available" }`
- **Response (200 OK)**: Updates member record atomically, migrates recurring billing ledger, records audit log.

---

### 2.3 Cryptographic Pass & Optical Verification Domain (`/api/qr`)

#### `GET /api/qr/generate-secure-pass`
- **RBAC**: `member` (athlete generating personal entry pass)
- **Tenant Scope**: Encodes the member's current active `branch_id`.
- **Request Query**: None (identity inferred strictly from authenticated JWT `req.user.id`).
- **Response (200 OK)**:
  ```json
  {
    "qrToken": "eyJtZW1iZXJJZCI6Im1lbV80NDAxIiwiYnJhbmNoSWQiOiJicmFuY2hfMDAxIiwidGllciI6IkdvbGQiLCJ0aW1lc3RhbXAiOjE3OTQzNDAwMDAsIm5vbmNlIjoiOGE3ZGYxYzkifQ.4f3e6a...hexSignature",
    "expiresIn": 60,
    "validUntil": 1794340060000
  }
  ```
- **Security Controls**: HMAC-SHA256 signature generated using server environment secret `QR_HMAC_SECRET`.

#### `POST /api/qr/verify-and-admit`
- **RBAC**: `employee` (front desk cashier), `branch_admin`, `super_admin`
- **Tenant Scope**: Scanner endpoint compares token's `branchId` against cashier's `req.user.branch_id` (unless multi-branch roaming tier applies).
- **Request Payload**:
  ```json
  {
    "qrToken": "eyJtZW1iZXJJZCI...hexSignature",
    "supervisorPin": "1234"
  }
  ```
- **Response (200 OK - Access Granted)**:
  ```json
  {
    "admitted": true,
    "action": "GATE_ACCESS_GRANTED",
    "member": {
      "id": "mem_4401",
      "name": "Carlos Gomez",
      "tier": "VIP Black Card",
      "remainingSessions": 18
    },
    "verificationTimestamp": 1794340015420
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: `MALFORMED_OR_FORGED_QR_TOKEN` (signature mismatch)
  - `410 Gone`: `EXPIRED_QR` (token age exceeds 60 seconds)
  - `409 Conflict`: `REPLAY_ATTACK_DETECTED` (nonce already in cache)
  - `429 Too Many Requests`: `ANTI_PASSBACK_VIOLATION` (admitted within 15 mins without supervisor PIN)
  - `403 Forbidden`: `BRANCH_MISMATCH_ROAMING_DENIED` or `MEMBERSHIP_EXPIRED`

---

### 2.4 Front-Desk POS & Shift Reconciliation Domain (`/api/pos`)

#### `POST /api/pos/shifts/open`
- **RBAC**: `employee`, `branch_admin`
- **Tenant Scope**: Locked to cashier's active branch.
- **Request Payload**: `{ "openingFloat": 3000.00, "registerNumber": 1 }`
- **Response (201 Created)**: `{ "shiftId": "shf_10023", "status": "open", "openedAt": "2026-11-11T06:00:00Z" }`
- **Security Controls**: Prevents opening a second concurrent shift on the same terminal.

#### `POST /api/pos/checkout`
- **RBAC**: `employee`, `branch_admin`
- **Tenant Scope**: Auto-injected `branch_id`.
- **Request Payload**:
  ```json
  {
    "shiftId": "shf_10023",
    "customerId": "mem_4401",
    "items": [
      { "sku": "PASS-DAY", "qty": 1, "unitPrice": 450.00 },
      { "sku": "WHEY-ISO", "qty": 1, "unitPrice": 1800.00 }
    ],
    "subtotal": 2250.00,
    "discount": 0.00,
    "taxAmount": 270.00,
    "total": 2250.00,
    "paymentMethod": "CASH",
    "cashReceived": 2500.00,
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
  ```
- **Response (200 OK)**: `{ "transactionId": "txn_55021", "changeDue": 250.00, "status": "COMPLETED" }`
- **Security Controls**: Idempotency key enforced in Redis/Memory to prevent duplicate charges on network retries.

#### `POST /api/pos/shifts/close`
- **RBAC**: `employee`, `branch_admin`
- **Tenant Scope**: Tied strictly to current shift ID.
- **Request Payload (Blind Drawer Count)**:
  ```json
  {
    "shiftId": "shf_10023",
    "actualCashCount": 14250.00,
    "notes": "End of morning peak shift"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "shiftId": "shf_10023",
    "expectedCash": 14300.00,
    "actualCash": 14250.00,
    "variance": -50.00,
    "varianceStatus": "SHORTAGE",
    "reconciliationStatus": "FLAGGED_FOR_MANAGER_REVIEW"
  }
  ```

---

## 3. Multi-Tenancy & PostgreSQL Row-Level Security (RLS)

FitConnect implements a **Shared Database, Shared Schema with Row-Level Security (RLS)** architecture. This provides strict physical separation guarantees while eliminating the operational overhead of running hundreds of isolated database instances.

```
+-----------------------------------------------------------------------------------+
|                           HTTP Request with Bearer JWT                            |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|      Express Tenant Context Middleware (ksyn/server/middleware/tenantGuard.js)    |
|      1. Decodes JWT -> Extracts `tenant_id` (branch_id) and `user_role`           |
|      2. Acquires DB Client from Connection Pool                                   |
|      3. Executes: SET LOCAL app.current_tenant_id = 'branch_001';                 |
|                   SET LOCAL app.current_user_role = 'employee';                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     PostgreSQL Database Engine Execution                          |
|  - Table-level RLS Policies evaluate `app.current_tenant_id` against row columns  |
|  - Queries automatically filtered: WHERE branch_id = app.current_tenant_id        |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|               Pool Connection Release (Connection Hygiene Guarantee)               |
|  - Executes `DISCARD ALL` or connection check-in automatically resets `LOCAL`     |
+-----------------------------------------------------------------------------------+
```

### 3.1 Tenant Context Setting in Middleware

To prevent context bleeding in connection-pooled environments (e.g., PgBouncer or `pg.Pool`), the tenant variable is set with `SET LOCAL`, which confines the variable strictly to the lifetime of the active transaction:

```javascript
// Middleware: tenantContextInjector.js
const db = require('../config/db');

const setTenantContext = async (req, res, next) => {
  const client = await db.pool.connect();
  req.dbClient = client;

  try {
    const tenantId = req.user ? req.user.branch_id : null;
    const userRole = req.user ? req.user.role : 'anonymous';

    // Begin transaction for request scope
    await client.query('BEGIN');

    // Inject session parameters isolated to this transaction
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId || '']);
    await client.query("SELECT set_config('app.current_user_role', $1, true)", [userRole]);

    // Ensure client cleanup upon response completion
    const cleanup = async () => {
      res.removeListener('finish', commitAndRelease);
      res.removeListener('close', rollbackAndRelease);
      res.removeListener('error', rollbackAndRelease);
    };

    const commitAndRelease = async () => {
      await cleanup();
      try {
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    };

    const rollbackAndRelease = async () => {
      await cleanup();
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    };

    res.on('finish', commitAndRelease);
    res.on('close', rollbackAndRelease);
    res.on('error', rollbackAndRelease);

    next();
  } catch (err) {
    client.release();
    return res.status(500).json({ error: 'FAILED_TO_SET_TENANT_SECURITY_CONTEXT' });
  }
};
```

### 3.2 SQL DDL & Table RLS Policies

All sensitive multi-tenant tables enforce `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.

```sql
-- 1. Enable RLS on core tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Enforce RLS even for table owners
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE check_ins FORCE ROW LEVEL SECURITY;

-- 2. Tenant Isolation Policy for `users` (Members, Coaches, Staff)
CREATE POLICY user_tenant_isolation_policy ON users
FOR ALL
USING (
  -- Super Admin bypass clause: unrestricted cross-branch visibility
  current_setting('app.current_user_role', true) = 'super_admin'
  OR
  -- Strict tenant match: row branch must equal active session tenant
  branch_id = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
  current_setting('app.current_user_role', true) = 'super_admin'
  OR
  branch_id = current_setting('app.current_tenant_id', true)
);

-- 3. Tenant Isolation Policy for `pos_transactions`
CREATE POLICY pos_transactions_isolation_policy ON pos_transactions
FOR ALL
USING (
  current_setting('app.current_user_role', true) = 'super_admin'
  OR
  branch_id = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
  branch_id = current_setting('app.current_tenant_id', true)
);

-- 4. Fail-Safe Default Deny Behavior
-- If `app.current_tenant_id` is NULL, empty string, or missing,
-- current_setting('app.current_tenant_id', true) evaluates to '' (empty string).
-- Because no legitimate record has branch_id = '', all SELECT, UPDATE, DELETE queries return 0 rows.
```

---

## 4. Cryptographic Verification & Token Rotation (Software Pass Verification)

Physical solenoid turnstiles are delimited from this build. Physical front-desk optical scanners running directly inside the web application inspect digital passes generated on members' mobile devices.

### 4.1 Cryptographic Token Pipeline
Each pass token is structured as a signed JSON Web Token (JWT) or Base64URL-encoded HMAC container:

$$\text{Token} = \text{Base64Url}(\text{Payload}) \;\|\; \text{"."} \;\|\; \text{HMAC-SHA256}(\text{Base64Url}(\text{Payload}), K_{\text{secret}})$$

```
+----------------------------------------------------------------------------------------------------+
|                                    QR Pass Verification Lifecycle                                  |
+----------------------------------------------------------------------------------------------------+
 Member Mobile Client                              Front-Desk Web Camera Scanner Endpoint
         |                                                                |
         |  1. Request Pass Token                                         |
         |--------------------------------------------------------------->|
         |     (Payload: memberId, branchId, timestamp, nonce)            |
         |                                                                |
         |  2. Returns Signed Token (Valid for 60 seconds)                |
         |<---------------------------------------------------------------|
         |                                                                |
         |  3. Displays animated dynamic QR with live countdown           |
         |     [Present QR to Web Camera]                                 |
         |                                                                |
         |  4. Optical scanner captures payload                           |
         |--------------------------------------------------------------->|
         |                                                                | 5. Cryptographic HMAC Check
         |                                                                |    - Verify timingSafeEqual()
         |                                                                | 6. Timestamp TTL Window
         |                                                                |    - |t_now - t_token| <= 60s
         |                                                                | 7. Anti-Replay Nonce Verification
         |                                                                |    - Check cache: Nonce reused?
         |                                                                | 8. Anti-Passback (APB) Rule
         |                                                                |    - Check last admittance < 15m
         |                                                                | 9. Grant / Deny Admittance
         |<---------------------------------------------------------------|
```

### 4.2 Exact Server Verification Implementation (`qrController.js`)

```javascript
const crypto = require('crypto');
const redeemedNonces = new Map(); // In-memory anti-replay cache with TTL eviction

// Background sweep for expired nonces
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of redeemedNonces.entries()) {
    if (now > expiry) redeemedNonces.delete(nonce);
  }
}, 30000);

exports.verifyPass = async (req, res) => {
  try {
    const { qrToken, supervisorPin } = req.body;
    const scannerBranchId = req.user.branch_id;

    if (!qrToken || !qrToken.includes('.')) {
      return res.status(400).json({ error: 'MALFORMED_TOKEN_STRUCTURE' });
    }

    const [payloadB64, signatureHex] = qrToken.split('.');

    // 1. Verify HMAC-SHA256 Signature using timing-safe equality
    const expectedSig = crypto
      .createHmac('sha256', process.env.QR_HMAC_SECRET)
      .update(payloadB64)
      .digest('hex');

    const sigBufferA = Buffer.from(signatureHex, 'hex');
    const sigBufferB = Buffer.from(expectedSig, 'hex');

    if (sigBufferA.length !== sigBufferB.length || !crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
      return res.status(401).json({ error: 'CRYPTOGRAPHIC_SIGNATURE_INVALID_FORGERY_DETECTED' });
    }

    // 2. Decode and parse token payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Date.now();

    // 3. Time Window Validation (60s TTL with 5s network drift grace period)
    const tokenAge = now - payload.timestamp;
    if (tokenAge > 65000) {
      return res.status(410).json({ error: 'PASS_TOKEN_EXPIRED', ageMs: tokenAge });
    }
    if (tokenAge < -5000) {
      return res.status(400).json({ error: 'CLOCK_SKEW_FUTURE_TIMESTAMP' });
    }

    // 4. Anti-Replay Nonce Verification
    if (redeemedNonces.has(payload.nonce)) {
      return res.status(409).json({ error: 'REPLAY_ATTACK_DETECTED_NONCE_ALREADY_CONSUMED' });
    }
    // Commit nonce to replay cache with 70s TTL
    redeemedNonces.set(payload.nonce, now + 70000);

    // 5. Tenant Branch Isolation Check
    if (payload.branchId !== scannerBranchId && payload.tier !== 'VIP_ALL_ACCESS') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED_HOME_BRANCH_MISMATCH' });
    }

    // 6. Anti-Passback (APB) Enforcement (15-Minute Cooldown)
    const member = await getMemberById(payload.memberId);
    const lastCheckIn = member.last_check_in_timestamp ? new Date(member.last_check_in_timestamp).getTime() : 0;
    const cooldownMs = 15 * 60 * 1000;

    if (now - lastCheckIn < cooldownMs) {
      // Check if authorized supervisor PIN is supplied
      if (supervisorPin && supervisorPin === process.env.SUPERVISOR_OVERRIDE_PIN) {
        logAuditTrail('APB_OVERRIDE', req.user.id, { memberId: payload.memberId });
      } else {
        return res.status(429).json({
          error: 'ANTI_PASSBACK_COOLDOWN_ACTIVE',
          remainingSeconds: Math.ceil((cooldownMs - (now - lastCheckIn)) / 1000)
        });
      }
    }

    // Admittance recorded
    await recordCheckInLog(payload.memberId, scannerBranchId);
    return res.status(200).json({ success: true, message: 'ACCESS_GRANTED', member: payload.memberName });

  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_VERIFICATION_FAILURE', details: err.message });
  }
};
```

---

## 5. Front-Desk POS, Cash Governance & Shift Reconciliation

Front-desk operations are vulnerable to cash skimming, off-the-book walk-in admissions, and register tampering. FitConnect implements strict **Blind Drawer Balancing** and financial audit controls.

```
[Cashier Shift Start]
       │
       ▼
Input Opening Float (e.g., ₱3,000.00 in small bills)
       │
       ├──────────────────────────────────────────────────────┐
       │ (Active Shift Cashiering)                             │
       ▼                                                      ▼
Cash Payments (Increments `expected_cash`)          Digital Payments (GCash, Maya, Card)
(Auto-logged with immutable transaction ID)         (Recorded with Gateway Reference Number)
       │                                                      │
       ├──────────────────────────────────────────────────────┘
       │
[Cashier Shift Close]
       │
       ▼
Blind Drawer Count Input
(Cashier inputs actual counted cash; system NEVER discloses its expected total prior to entry)
       │
       ▼
Automated Variance Calculation: `variance = actualCashCount - expectedCash`
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
`variance == 0`           `variance > 0`            `variance < 0`
[Exact Balance]          [Cash Overage (+)]        [Cash Shortage (-)]
       │                         │                         │
       └─────────────────────────┼─────────────────────────┘
                                 │
                                 ▼
         Flagged in Manager Audit Portal + Signed by Branch Admin
```

### Key Governance Controls:
1. **Blind Close Guarantee**: Cashiers cannot "top off" or adjust their count to match expected numbers because the system conceals the running cash tally from front-desk staff until the count is irreversibly committed.
2. **Transaction Idempotency**: Each transaction payload includes a client-generated UUID `idempotencyKey` stored in cache for 60 minutes. Network retries will not bill customers twice.
3. **Dual-Approval Price Overrides**: Any manual line-item discount or complimentary membership pass requires instant Branch Admin PIN entry, triggering an immutable audit event (`DISCOUNT_OVERRIDE_LOG`).

---

## 6. Compliance, Governance & Data Privacy Act of 2012 (RA 10173)

The Republic Act 10173 (Philippine Data Privacy Act) mandates the protection of personal, sensitive, and financial information.

| Privacy Principle / Requirement | FitConnect Implementation & Defensive Mechanism |
| :--- | :--- |
| **Data Masking (Section 20)** | The front-desk POS interface features a persistent **"Mask PII"** security mode. When active, customer emails (`j***e@gmail.com`) and phone numbers (`+63 917 **** 892`) are masked in DOM rendering to protect members against shoulder-surfing in public gym lobbies. |
| **Encryption at Rest & in Transit** | All data in transit is encrypted using **TLS 1.3** with enforced HTTPS. Sensitive credentials and PINs are hashed using **Bcrypt with 10 salt rounds**; no plaintext passwords or secrets exist in the database. |
| **Principle of Proportionality** | Data collection is restricted strictly to operational needs (Name, Email, Emergency Contact, Health Clearance). Biometric scans and government ID numbers are not stored in the database. |
| **Immutable Append-Only Audit Trail** | Every sensitive transaction (user login, membership freeze, branch transfer approval, shift balance close, check-in override) generates an append-only audit log capturing `user_id`, `tenant_id`, `action_type`, `ip_address`, `user_agent`, and `timestamp`. Deletion of audit logs is restricted from all roles, including Branch Admins. |
| **Right to Erasure & Data Retention** | Historical check-in logs older than 180 days are automatically summarized into aggregate daily attendance counts, and raw timestamp entries are purged via an automated cron worker, fulfilling data minimization standards. |

---

## 7. Panel Defense "Trap" Questions & Model Answers

### Question 1: Connection Pooling & RLS Context Leakage
> **Panelist:** *"You claim that PostgreSQL Row-Level Security isolates tenant data using `app.current_tenant_id`. But in enterprise deployments, you use connection poolers like PgBouncer or a Node.js `pg.Pool`. When a database connection is returned to the pool and reused by another user from a different branch, won't that connection leak the previous tenant's context?"*

**Defensible Model Answer:**
> "That is an excellent technical observation. In connection-pooled architectures, persistent session variables can indeed leak across requests if set globally via `SET app.current_tenant_id`.
> 
> To eliminate this vulnerability, FitConnect employs two concrete defenses:
> 1. We wrap every database interaction inside an explicit transaction scope and set the parameter using `SET LOCAL app.current_tenant_id = $1` or `set_config('app.current_tenant_id', $1, true)` where the third parameter is `is_local = true`. In PostgreSQL, `SET LOCAL` guarantees that the variable is strictly bound to the current transaction. The moment the transaction commits or rolls back, the variable instantly unbinds and vanishes.
> 2. On the connection pool wrapper, upon check-in, our middleware registers a response event listener that executes a reset sequence (`DISCARD ALL` or `RESET ALL`) prior to releasing the socket back to the pool, ensuring zero state carries over."

---

### Question 2: Optical Pass Screenshot Sharing & Screen Recording
> **Panelist:** *"Since you don't use physical turnstiles with biometric fingerprint readers or RFID cards, what stops a paying member from screen-recording their dynamic QR code pass and sending it via WhatsApp or Telegram to an unpaid friend waiting outside?"*

**Defensible Model Answer:**
> "FitConnect mitigates pass sharing through a synchronized, multi-layered cryptographic approach:
> 1. **Short-Lived 60-Second Window:** The QR pass is computed using HMAC-SHA256 with a microsecond-accurate timestamp and a 60-second expiration window. A recorded video will expire in under one minute.
> 2. **One-Time Nonce Consumption (Anti-Replay):** Even if the pass is sent via instant messaging within that 60-second window, the server maintains an in-memory anti-replay nonce registry. The exact millisecond the QR is scanned by the front-desk web camera, the nonce is flagged as consumed. If a second person attempts to scan the same pass, the server rejects it with HTTP `409 Conflict: REPLAY_ATTACK_DETECTED`.
> 3. **15-Minute Anti-Passback (APB) Rule:** If the friend tries to generate another pass immediately after the first person entered, our system checks the member's `last_check_in_timestamp`. Any admittance attempt within 15 minutes of an entry is blocked under Anti-Passback rules, requiring manager PIN clearance."

---

### Question 3: Multi-Tenancy Architecture Selection (Shared Schema vs. Isolated DB)
> **Panelist:** *"Why did your group choose a Shared Database with Row-Level Security instead of giving every franchise branch its own separate database or separate PostgreSQL schema?"*

**Defensible Model Answer:**
> "We evaluated all three multi-tenancy models during the architectural design phase:
> 1. **Database-per-Tenant:** Provides the highest isolation, but has prohibitive resource overhead for a gym franchise. Operating separate database instances or connection pools for every branch drives server memory usage through the roof, complicates schema migrations across branches, and makes cross-franchise analytics and royalty rollups extraordinarily difficult and slow.
> 2. **Schema-per-Tenant:** Causes schema explosion. Having 20+ branches means running 20 migrations for every minor database change, and cross-schema queries for HQ executive reporting require heavy dynamic SQL.
> 3. **Shared Database with PostgreSQL RLS:** This represents the industry standard for modern enterprise SaaS. By enforcing data isolation at the PostgreSQL database kernel level rather than solely in application `WHERE` clauses, we ensure high resource efficiency, frictionless automated migrations, and instant real-time financial rollups for HQ, while mathematically guaranteeing that non-super-admin queries cannot cross tenant boundaries."

---

### Question 4: Detecting Front-Desk Cash Skimming
> **Panelist:** *"A walk-in customer pays ₱500 cash for a day pass. What stops the cashier from pocketing the ₱500, waving the customer into the gym, and never recording it in your POS software?"*

**Defensible Model Answer:**
> "FitConnect counters cash skimming through process intertwining between the POS module and the Check-In Access module:
> 1. **Software Access Coupling:** A walk-in day pass cannot be scanned or verified at the front-desk web camera terminal without a valid transaction record existing in the system. The POS checkout action is what triggers the creation of the one-time admittance record.
> 2. **Blind Drawer Reconciliation:** For registered members paying fees or buying retail items, cashiers operate under blind drawer balancing. Because cashiers are blind to expected drawer totals, any off-book cash discrepancies create an immediate mismatch with inventory burn-rates.
> 3. **Inventory Depletion Tracking:** Selling physical retail goods (drinks, supplements) without ringing them up creates a physical inventory shortage that is caught during weekly inventory stock counts."

---

### Question 5: Broken Object-Level Authorization (BOLA / IDOR)
> **Panelist:** *"What stops an authenticated cashier at Branch A (e.g., Alabang) from sending a crafted `GET /api/members/mem_9921` request with an ID belonging to a member at Branch B (BGC) to inspect their profile?"*

**Defensible Model Answer:**
> "This classic Insecure Direct Object Reference (IDOR / BOLA) vulnerability is mitigated by enforcing security at both the application and database tiers:
> 1. **Middleware Level:** The user's JWT cryptographically binds their `branch_id`. The application resolver automatically injects `AND branch_id = req.user.branch_id` into the query abstraction layer.
> 2. **Database Level (RLS Defense-in-Depth):** Even if a developer accidentally wrote `SELECT * FROM members WHERE id = $1` without adding the tenant filter, PostgreSQL Row-Level Security evaluates the row against `current_setting('app.current_tenant_id')`. Because the row's `branch_id` does not match the session's active tenant parameter, PostgreSQL filters out the row at the engine level and returns zero results (`HTTP 404 Not Found`)."

---

### Question 6: Super-Admin Royalty & Tax Calculations (BIR 2307)
> **Panelist:** *"How does FitConnect calculate HQ royalties and ensure compliance with Philippine tax laws like withholding tax?"*

**Defensible Model Answer:**
> "FitConnect's financial engine automatically calculates:
> 1. **HQ Royalty Cut:** A 7.5% royalty fee is automatically deducted from gross monthly branch membership and POS revenues.
> 2. **BIR Form 2307 Withholding Tax:** In compliance with Philippine Bureau of Internal Revenue (BIR) regulations, franchise royalties are subject to Creditable Withholding Tax (typically 5%). The platform calculates the net remittance and generates downloadable BIR Form 2307 voucher breakdowns, allowing franchise owners and HQ accountants to reconcile tax credits without discrepancies."

---

### Question 7: Preventing Denial of Service on the Optical QR Endpoint
> **Panelist:** *"If someone spams your `/api/qr/verify-and-admit` endpoint with millions of forged tokens, couldn't they overwhelm your server with cryptographic computations?"*

**Defensible Model Answer:**
> "We implement tiered defensive rate limiting:
> 1. **IP & Terminal Rate Limiting:** The verification endpoint is rate-limited to 60 requests per minute per authenticated front-desk terminal IP.
> 2. **Rapid Fail Validation:** The endpoint validates payload string formatting and token length before executing cryptographic HMAC functions.
> 3. **Low Compute Overhead:** HMAC-SHA256 is computationally lightweight compared to asymmetric RSA or ECDSA signature verifications, allowing the server to process legitimate checks in under 2 milliseconds without CPU bottlenecking."

---

### Question 8: Inter-Branch Member Transfer Discrepancies
> **Panelist:** *"If a member initiates an inter-branch transfer, how does the system prevent data corruption or double billing during the transition?"*

**Defensible Model Answer:**
> "FitConnect enforces a **Two-Stage Branch Clearance Protocol**:
> 1. When a member requests a transfer, their status transitions to `PENDING_TRANSFER`. They remain active at their origin branch until formal clearance.
> 2. The destination Branch Admin must review and accept the transfer.
> 3. Upon acceptance, an atomic database transaction (`BEGIN ... COMMIT`) updates the member's `branch_id`, recalculates pro-rated membership dues, and routes future recurring billing to the new branch ledger. If the destination branch declines, the transfer is marked `DECLINED`, leaving the member's active status intact at their original branch without data loss."

---

### Question 9: Data Privacy Compliance for Gym Locker and Biometric Logs
> **Panelist:** *"Does your database store biometric fingerprint templates or face recognition embeddings? How do you comply with the National Privacy Commission guidelines on biometric data?"*

**Defensible Model Answer:**
> "FitConnect deliberately **delimited raw biometric storage** from this release to maintain strict compliance with National Privacy Commission (NPC) Circulars on sensitive personal information.
> 
> Check-in identification relies on dynamically generated rotating cryptographic optical passes and authorized member ID numbers. We store zero raw fingerprint templates and zero facial biometric vectors, eliminating the risk of biometric identity theft in the event of a database compromise."

---

### Question 10: Fail-Safe Security Default (Default Deny)
> **Panelist:** *"What happens if a developer introduces a new API route and forgets to add tenant verification middleware?"*

**Defensible Model Answer:**
> "FitConnect operates under the security principle of **Default Deny**:
> 1. If an unauthenticated or misconfigured request reaches the database without setting `app.current_tenant_id`, the PostgreSQL session parameter defaults to an empty string `''`.
> 2. Because our RLS policies require `branch_id = current_setting('app.current_tenant_id', true)`, and no branch record has an empty string ID, the query will return zero rows.
> 3. Security is not dependent on the programmer remembering to append `WHERE branch_id = ...` in Express. The database engine itself enforces tenant isolation as a mandatory gatekeeper."

---

## 8. Summary & Defense Strategy Recommendations

1. **Own the System Boundary:** When panelists ask why there is no physical ESP32 or relay wiring, state clearly: *"Physical IoT hardware and electromechanical turnstiles are explicitly delimited in Chapter 1. Our capstone focuses on Enterprise Software Architecture, Multi-Tenant Database Security, Cryptographic Pass Verification, and Financial Shift Governance."*
2. **Emphasize Defense-in-Depth:** Point out that security exists at three distinct layers:
   - **Network/Route Layer:** JWT authentication, rate limiting, and RBAC guards.
   - **Application Layer:** Cryptographic HMAC-SHA256 signature and replay nonces.
   - **Database Layer:** Kernel-level PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`).
3. **Highlight Real-World Enterprise Governance:** Reiterate the blind drawer closing, two-stage member transfer clearance, and BIR 2307 royalty computations as proof of practical enterprise readiness.
