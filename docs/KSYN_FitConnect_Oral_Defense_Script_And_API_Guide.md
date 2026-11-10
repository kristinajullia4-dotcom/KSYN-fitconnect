# KSYN FitConnect: Complete Oral Thesis Defense Script & Technical API Guide
## An End-to-End Presentation Handbook from Manuscript Chapters I–III to Live Demonstration

> **Capstone Project:** *DEVELOPMENT OF KSYN FitConnect: A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation*  
> **Institution:** College of Computing and Information Sciences, University of Makati  
> **Researchers:** Bautista, Luis Gabriel; Bozar, Merynelle B.; Marquez, Jullia Krisitina C.  
> **Target Audience:** Oral Thesis Examination Panel & Student Presenters  
> **Format:** Spoken Defense Script with Simple Explanations, On-Screen Actions, and Underlying RESTful APIs  

---

## 🎙️ STAGE 1: Formal Opening & Chapter I (The Problem and Its Background)

### 🗣️ Speaker Script:
* **Opening & Title Introduction:**
  * *"Good morning, honorable members of the panel, our research adviser, and fellow guests.*
  * *We are honored to present our undergraduate capstone thesis entitled: **'KSYN FitConnect: A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation.'**"*

* **The Problem Background (Why we built this):**
  * *"KSYN Fitness Gym is an expanding commercial fitness franchise in the Philippines with **7 branch locations** across Metro Manila: BGC Flagship, Alphaland Makati, Fairview, Kapitolyo Pasig, Del Monte Quezon City, Alabang, and Katipunan Regis Center.*
  * *During our preliminary interviews and operational observations, we discovered that KSYN was relying heavily on standalone spreadsheets, handwritten visitor logbooks, and paper receipts.*
  * *This fragmented, manual system caused three critical operational headaches:*
    1. **Inter-Branch Data Leakage:** Shared spreadsheets allowed branch managers and investors to accidentally peek at rival branches' private sales numbers and client contact details.
    2. **Front-Desk Cash Skimming:** Walk-in gym-goers were paying cash, but cashiers could easily pocket the money without recording it in the ledger.
    3. **Pass Sharing & Fraud:** Members were screenshotting their QR codes or barcodes and texting them to friends, letting multiple people work out on a single paid membership.*
  * *Furthermore, public paper logbooks at front counters exposed member phone numbers and email addresses, directly violating statutory privacy mandates under the **Philippine Data Privacy Act of 2012 (RA 10173)**."*

* **The Critical System Delimitation (Preempting hardware questions):**
  * *"Before we proceed, we wish to emphasize an essential system boundary established in Chapter I:*
  * *This system is **100% software-based**.*
  * *Physical electromechanical turnstiles, solenoid relays, and Arduino or ESP32 microcontrollers are **explicitly delimited** from this build.*
  * *Instead, access verification is executed via **responsive front-desk web camera optical scanners** on counter tablets and laptops, eliminating expensive mechanical hardware breakdowns while delivering bank-grade cryptographic authentication in pure software."*

---

## 🔒 STAGE 2: Chapter II (Review of Related Literature & Security Architecture)

### 🗣️ Speaker Script:
* **Multi-Tenancy & PostgreSQL Row-Level Security (RLS):**
  * *"To solve inter-branch data leaks, Chapter II examines modern multi-tenant cloud software architectures.*
  * *Instead of spending millions hosting 7 separate databases, we implemented a **Shared Database, Shared Schema with PostgreSQL Row-Level Security (RLS)**.*
  * *Think of it like an apartment building: all 7 branches share the same foundation and plumbing, but each branch has its own steel deadbolt lock.*
  * *Every time an Express endpoint connects to the database, our middleware injects the session variable:  
    `SET LOCAL app.current_tenant_id = [branch_id]`.*
  * *PostgreSQL evaluates every query at the database kernel level. Even if an Alabang cashier tries to alter a URL ID to view a BGC member, PostgreSQL returns **0 rows**."*

* **Cryptographic 60-Second Dynamic Passes (HMAC-SHA256):**
  * *"To eliminate pass-sharing fraud, we implemented **HMAC-SHA256 rotating optical tokens**.*
  * *When a member opens their pass, the server signs a payload containing their member ID, current timestamp, and a random cryptographic nonce.*
  * *The pass expires in **60 seconds**.*
  * *The moment the pass is scanned at the front desk, the server commits the nonce to an in-memory anti-replay cache. If someone screenshots the pass and texts it to a friend outside, the second scan triggers an immediate **HTTP 409 Replay Attack Rejection**."*

* **Cash Governance (Blind Drawer Balancing):**
  * *"To prevent cashier cash skimming, Chapter II establishes **Blind Drawer Balancing**.*
  * *The system conceals the running expected cash total from the cashier throughout their shift.*
  * *When closing the shift, the cashier must count the physical cash in the drawer and type it in blind.*
  * *Only after it is submitted does the system reveal if there is a shortage or overage, permanently locking any discrepancy in an immutable audit log."*

---

## 🌐 STAGE 3: Chapter III (Methodology & Enterprise Network Topology)

### 🗣️ Speaker Script:
* **Research Methodology:**
  * *"In Chapter III, our development followed the **Design–Develop–Test–Evaluate (DDTE)** methodology, benchmarked against **ISO/IEC 27001** technological security controls."*

* **Enterprise Network Topology Discussion:**
  * *[Point to your Cisco Packet Tracer Topology Diagram]*
  * *"Here is our official **Hub-and-Spoke Enterprise Network Topology**:*
  * *At the center is our **AWS Cloud backbone**, which provides high-speed cloud infrastructure hosting our centralized backend and multi-tenant PostgreSQL database.*
  * *At the top is our **Corporate Headquarters Gateway (Cisco 2811 R0 and Server-PT)**, handling consolidated franchise financial rollups, automated royalty calculations, and tax audits.*
  * *Radiating from the center are our **Regional Franchise Branch Routers (R1, Router0, and R2)**.*
  * *Inside each branch, our Cisco 2960 switches connect:*
    * **Front-Desk POS Workstations:** Operating cashiering and web camera optical scanners.
    * **Wireless Access Points (APs):** Allowing gym members to load their mobile dynamic passes and coaches to access workout trackers.
    * **Cisco 7960 IP Phones:** Providing dedicated VoIP communication between the front desk, branch managers, and corporate headquarters."*

---

## 💻 STAGE 4: Step-by-Step Live Demonstration Script & Underlying APIs

* *"Now, honorable members of the panel, we will demonstrate KSYN FitConnect across our core user roles."*

---

### Step 1: Public Portal & Commercial Landing Page
* **Presenter Action:** Open the web browser at the root domain (`http://gym.com` or live portal).
* **Speaker Script:**
  * *"Here is our live commercial landing page. It showcases our 7 active franchise branches across Metro Manila, our membership pricing tiers, and our franchise investor portal.*
  * *When an investor submits a franchise inquiry, the form dispatches to our backend API."*
* **Underlying API Executed:**
  * **Endpoint:** `POST /api/franchise-inquiry`
  * **Payload:**
    ```json
    {
      "fullName": "Maria Santos",
      "email": "investor@example.com",
      "phone": "+63 917 123 4567",
      "targetLocation": "Makati CBD Hub",
      "proposedCapital": "₱4,000,000 – ₱6,000,000"
    }
    ```
  * **Response:** `201 Created` &bull; Dispatches official franchise prospectus.

---

### Step 2: Member Mobile Experience (60-Second Dynamic Pass)
* **Presenter Action:** Log in as gym member `carlos.gomez@ksyn.com`, click **"Show Pass"**.
* **Speaker Script:**
  * *"We will now log in as our gym member, Carlos Gomez.*
  * *When Carlos taps 'Show Pass', his smartphone requests an ephemeral, cryptographically signed token.*
  * *Notice the live animated countdown timer from 60 seconds.*
  * *If Carlos takes a screenshot and sends it to a friend, it will expire in under one minute, and duplicate scans are blocked by our anti-replay nonce."*
* **Underlying APIs Executed:**
  * **Authentication:** `POST /api/auth/login` (Returns JWT token with `user.role = "member"`, `branch_id = "branch_001"`).
  * **Pass Generation:** `GET /api/qr/generate-secure-pass`
  * **Server Response:**
    ```json
    {
      "qrToken": "eyJtZW1iZXJJZCI6Im1lbV80NDAxIiwiYnJhbmNoSWQiOiJicmFuY2hfMDAxIiwidGltZXN0YW1wIjoxNzk0MzQwMDAwLCJub25jZSI6IjhjN2Q5YjJlIn0.4f8a9e...sig",
      "expiresIn": 60,
      "validUntil": 1794340060000
    }
    ```

---

### Step 3: Front-Desk Cashier (Optical Camera Scanning & POS Cashiering)
* **Presenter Action:** Switch to front-desk cashier session at BGC.
* **Speaker Script:**
  * *"Now, we switch to our front-desk cashier workstation at BGC.*
  * *First, observe our **PII Masking Toggle**: customer emails and phone numbers are masked on the screen (`j***z@gmail.com`) so waiting customers cannot shoulder-surf personal data.*
  * *Next, Carlos holds his phone up to our front-desk web camera scanner.*
  * *[Action: Click Verify / Scan]*
  * *In under 20 milliseconds, the server verifies the HMAC signature, confirms the token age is under 60 seconds, commits the nonce, and flashes green: **Access Granted**.*
  * *If Carlos tries to scan in again within 15 minutes, our **Anti-Passback rule** blocks him unless a manager enters supervisor PIN `1234`.*
  * *Finally, we ring up a walk-in day pass for ₱450. When the shift ends, the cashier types their counted cash blind. The server automatically calculates any shortage or overage."*
* **Underlying APIs Executed:**
  * **Shift Opening:** `POST /api/pos/shifts/open` (`{ "openingFloat": 3000.00 }`)
  * **Optical Pass Verification:** `POST /api/qr/verify-and-admit`
    ```json
    {
      "qrToken": "eyJtZW1iZXJJZCI6...",
      "supervisorPin": "1234"
    }
    ```
    *Response:* `200 OK` &bull; `{ "admitted": true, "member": "Carlos Gomez" }`
  * **POS Checkout:** `POST /api/pos/checkout` (`{ "items": [{"sku": "PASS-DAY", "price": 450}], "paymentMethod": "CASH" }`)
  * **Blind Drawer Close:** `POST /api/pos/shifts/close` (`{ "actualCashCount": 14250.00 }`)
    *Response:* `200 OK` &bull; `{ "expectedCash": 14250.00, "variance": 0.00, "status": "BALANCED" }`

---

### Step 4: Branch Admin (Two-Stage Member Transfers & APB Clearance)
* **Presenter Action:** Switch to Branch Admin (General Manager) account.
* **Speaker Script:**
  * *"Next is our Branch General Manager.*
  * *If a member moves from BGC to Quezon City, they can request an inter-branch transfer right from their phone.*
  * *The destination Branch Admin reviews the request and clicks **Approve**.*
  * *The member's profile, recurring billing, and locker assignments are migrated atomically in the database without any manual paperwork."*
* **Underlying APIs Executed:**
  * **Fetch Pending Transfers:** `GET /api/branches/transfer-requests`
  * **Approve / Decline Transfer:** `POST /api/branches/transfer-review`
    ```json
    {
      "requestId": "trf_8812",
      "action": "approved",
      "notes": "Locker and gym floor capacity available"
    }
    ```
  * **Supervisor Anti-Passback Override:** `POST /api/qr/supervisor-override` (Validates bcrypt hash of PIN `1234`).

---

### Step 5: Corporate Headquarters (Super Admin Global Governance)
* **Presenter Action:** Switch to Super Admin session.
* **Speaker Script:**
  * *"Finally, we log in as the **Super Admin at Corporate Headquarters**.*
  * *While Branch Owners are strictly locked to their single branch, HQ has global oversight across all 7 branches.*
  * *Notice our automated financial engine: it computes our **7.5% corporate franchisor royalty cut** across gross revenues, and generates **BIR Form 2307 Creditable Withholding Tax vouchers (5%)** for each franchise investor with one click."*
* **Underlying APIs Executed:**
  * **Consolidated Financial Rollup:** `GET /api/finance/consolidated-royalties`
    ```json
    {
      "totalGrossRevenue": 4620000.00,
      "royaltyRate": 0.075,
      "hqRoyaltyDue": 346500.00,
      "bir2307TaxWithholding": 17325.00
    }
    ```
  * **Cross-Tenant Audit Trail:** `GET /api/audit/logs?limit=100`

---

## 🏆 STAGE 5: Conclusion & Q&A Handoff

### 🗣️ Speaker Script:
* *"In summary:*
  * *KSYN FitConnect solves branch data leaks through **PostgreSQL Row-Level Security**.*
  * *It stops pass-sharing fraud through **60-second dynamic HMAC-SHA256 optical passes**.*
  * *It eliminates cash theft through **Blind Drawer shift reconciliation**.*
  * *And it guarantees statutory compliance under the **Data Privacy Act (RA 10173)** and **Philippine BIR tax rules**.*
* *This concludes our formal presentation and live demonstration.*
* *We are now ready and honored to receive your questions, feedback, and recommendations. Thank you very much!"*

---

## 📋 Comprehensive API Route Reference Table

| Functional Domain | HTTP Verb & URI Endpoint | Required Role | Tenant Resolution & Data Scope | Primary Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `POST /api/auth/login` | Public | Resolved from user record | Rate-limited (5/min), Bcrypt cost 10 |
| **Authentication** | `POST /api/auth/google` | Public (Member) | Default home branch | Google OAuth 2.0 token audience audit |
| **Franchise Public** | `POST /api/franchise-inquiry` | Public | System-wide lead routing | Input sanitation, regex validation |
| **Pass Generation** | `GET /api/qr/generate-secure-pass` | `member` | Locked to member `branch_id` | HMAC-SHA256 signature, 60s TTL, Nonce |
| **Pass Verification** | `POST /api/qr/verify-and-admit` | `employee`, `branch_admin` | Matches cashier `branch_id` | `timingSafeEqual()`, Anti-Replay cache, APB |
| **POS Shift Open** | `POST /api/pos/shifts/open` | `employee`, `branch_admin` | Locked to active branch | One concurrent shift per terminal |
| **POS Checkout** | `POST /api/pos/checkout` | `employee`, `branch_admin` | Auto-injected `branch_id` | Idempotency Key (UUID), cash change check |
| **POS Shift Close** | `POST /api/pos/shifts/close` | `employee`, `branch_admin` | Active shift ID | Blind drawer count, automated variance log |
| **Branch Transfers** | `POST /api/branches/transfer-request` | `member`, `branch_admin` | Origin & target branch IDs | Atomic SQL transaction migration |
| **Transfer Review** | `POST /api/branches/transfer-review` | `branch_admin` (Target), HQ | Target `branch_id` required | 2-Stage clearance, reason logging |
| **Consolidated P&L** | `GET /api/finance/consolidated-royalties` | `super_admin` | Global (All 7 Branches) | 7.5% royalty formula, BIR 2307 vouchers |
| **Audit Logs** | `GET /api/audit/logs` | `super_admin`, `branch_admin` | Filtered by RLS `tenant_id` | Append-only immutable log store |
