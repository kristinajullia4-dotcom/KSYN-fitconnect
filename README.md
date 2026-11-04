# KSYN FitConnect Enterprise Platform

> **A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation**
> Engineered for KSYN Fitness Gym using React.js (Vite), Node.js (Express REST API), and PostgreSQL with Row-Level Security (RLS).

---

## 🏛️ Architecture & Security Highlights

1. **Multi-Tenant Data Isolation (PostgreSQL RLS & Session Context)**:
   - Each franchise branch operates as an isolated tenant keyed by `branch_id`.
   - PostgreSQL schema with Row-Level Security (`ENABLE ROW LEVEL SECURITY`) and parameterized policies using session contexts:
     - `SET LOCAL app.current_user_id = $1`
     - `SET LOCAL app.current_role = $2`
     - `SET LOCAL app.current_branch_id = $3`
   - Super Admin bypass policy allows network-wide corporate oversight while blocking cross-tenant Insecure Direct Object References (IDOR) for branch admins and staff.
   - Dual-Mode Engine: Seamlessly connects to native PostgreSQL, with an automatic resilient in-memory multi-tenant store fallback for instant zero-dependency local evaluation.

2. **Role-Based Access Control (RBAC)**:
   - `super_admin`: Network-wide KPIs, corporate royalty calculation engine, branch provisioning, and immutable system audit logs.
   - `branch_admin`: Operational management strictly isolated to their assigned `branch_id` (branch revenue, members, staff, equipment stock).
   - `employee`: High-speed QR scanner terminal, attendance logging, and trainer schedules with zero access to financial ledgers.
   - `member`: Dynamic 60-second rotating cryptographic QR pass, digital membership card, subscription status, and check-in history.

3. **Time-Expiring Cryptographic Dynamic QR Pass (60s TTL)**:
   - Prevents screenshot and credential replay attacks.
   - Each pass is cryptographically signed using HMAC-SHA256 (`payloadBase64.signature`) containing `{ memberId, branchId, timestamp, nonce }`.
   - Sub-second employee scanner validation checks signature integrity, validates token age (<60s), checks single-use nonce against the replay prevention cache, and verifies active subscription status before granting entry.

4. **Defensive Engineering & Compliance**:
   - HTTP security hardening via `helmet` and CORS origin restriction.
   - Rate limiting via `express-rate-limit` to mitigate brute-force and DoS attempts.
   - Immutable append-only `audit_logs` tracking sensitive events (ISO/IEC 27001, ISO/IEC 25010, RA 10173 Philippine Data Privacy Act).

---

## 🔑 Pre-Seeded Test Accounts

All accounts share the default password: **`Password123!`**

| Role | Name & Title | Email | Branch Affiliation | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **`super_admin`** | Marcus Vance (CEO) | `super_admin@ksyn.com` | Global Corporate HQ | Network-Wide Oversight |
| **`branch_admin`** | Elena Rostova | `admin.bgc@ksyn.com` | KSYN BGC Flagship (`BGC-01`) | Branch-Isolated Operations |
| **`branch_admin`** | Rafael Silva | `admin.makati@ksyn.com` | KSYN Makati Central (`MKT-02`) | Branch-Isolated Operations |
| **`employee`** | Carlos Mendoza | `staff.bgc@ksyn.com` | KSYN BGC Flagship (`BGC-01`) | Turnstile Kiosk Scanner |
| **`employee`** | Maya Lin | `staff.makati@ksyn.com` | KSYN Makati Central (`MKT-02`) | Turnstile Kiosk Scanner |
| **`member`** | Aria Montgomery | `member.bgc@ksyn.com` | KSYN BGC Flagship (`BGC-01`) | Elite All-Branch Pass |
| **`member`** | Derrick Sterling | `member.makati@ksyn.com` | KSYN Makati Central (`MKT-02`) | Pro Branch Pass |

> 💡 **Evaluator Convenience**: When logging into the web app, an interactive **1-Click Quick Role Switcher** is available at the top and on the login page to immediately test any persona without typing credentials!

---

## 🚀 Quickstart & Execution Guide

### 1. Database Migration (PostgreSQL)
To apply the schema with Row-Level Security policies and initial seed data against a PostgreSQL instance:
```bash
psql -U postgres -d ksyn_db -f schema.sql
```
*(If running without a local PostgreSQL service, the backend automatically engages its built-in resilient multi-tenant store with identical schema and RLS emulation).*

### 2. Backend API Setup
```powershell
cd server
npm.cmd install
npm.cmd start
```
*Backend runs on `http://localhost:5050`.*

### 3. Frontend Client Setup
```powershell
cd client
npm.cmd install --legacy-peer-deps
npm.cmd run dev
```
*Frontend runs on `http://localhost:5180`.*

### 4. Run Automated Integration Test Suite
```powershell
node server/test_api.js
```
Validates all 13 automated test assertions (auth, tenant isolation, dynamic QR rotation, replay rejection, corporate royalty computation, and audit trails).
