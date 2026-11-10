# KSYN FitConnect: Complete Guide to System Roles, Powers, and Security
## An Easy-to-Understand Technical and Operational Handbook for Thesis Defense

> **System Title:** KSYN FitConnect: A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation  
> **Prepared for:** Oral Thesis Defense Examination Panel & Student Presenters  
> **Format:** Reader-Friendly Guide with Plain-English Explanations, Scenarios, and Visual Analogies  

---

## 1. Executive Summary & The "Big Picture"

### What is KSYN FitConnect?
KSYN FitConnect is an enterprise web application designed for a fitness franchise with **7 branch locations** (BGC Elite, Alabang Prime, Quezon City Central, Makati CBD, Ortigas Hub, Cebu City, and Davao Central). 

Before this system, fitness franchises faced three major operational headaches:
1. **Data Leakage Between Branches:** Branch managers or investors could peek at other branches' private sales numbers and customer contact info.
2. **Cash Theft & Front-Desk Skimming:** Cashiers could take cash from walk-in gym-goers, let them inside, and pocket the money without recording it.
3. **Pass Sharing & Fraud:** Gym members would take a screenshot of their barcode or QR code pass and text it to their friends so multiple people could work out on one paid membership.

FitConnect solves all three problems using **Role-Based Access Control (RBAC)**, **PostgreSQL Row-Level Security (RLS)**, and **Rotating Cryptographic Optical Passes**.

### ⚠️ Critical Scope Boundary (What the Panel Must Know)
> **Delimitation Notice:**  
> This system is **100% software-based**. We explicitly **delimited** physical IoT hardware, Arduino/ESP32 microcontrollers, and physical solenoid turnstiles.  
> **How gym check-in actually works:** The front-desk cashier opens the FitConnect web camera scanner on their counter tablet or laptop. When the gym member holds up their smartphone, the camera optically scans their 60-second dynamic QR code pass and verifies it in under 20 milliseconds.

---

## 2. The 6 System Roles: Who They Are & Their Exact Powers

FitConnect divides all users into **six distinct roles**. Think of this like a secure office building where different keycards open different floors.

```
                    +-----------------------------+
                    |        SUPER ADMIN          |  (HQ / Franchisor)
                    |  - Global Access (7/7)      |
                    +-----------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v                                                   v
+-----------------------------+             +-----------------------------+
|        BRANCH OWNER         |             |        BRANCH ADMIN         |
|  - Franchise Investor       |             |  - General Manager          |
|  - Read-Only Financials     |             |  - Daily Operations         |
|  - Branch Locked            |             |  - Staff & Transfer Control |
+-----------------------------+             +-----------------------------+
                                                             |
                                   +-------------------------+
                                   |                         |
                                   v                         v
                    +-----------------------------+   +-----------------------------+
                    |      FRONT-DESK STAFF       |   |        FITNESS COACH        |
                    |  - POS Cashiering           |   |  - Workout Programming      |
                    |  - Blind Drawer Balancing   |   |  - Client 1-on-1 Chat       |
                    |  - Optical Pass Scanning    |   |  - 15% Commission Ledger    |
                    +-----------------------------+   +-----------------------------+
                                   |
                                   v
                    +-----------------------------+
                    |         GYM MEMBER          |
                    |  - 60s Dynamic Pass         |
                    |  - Self-Service Billing     |
                    |  - Workout Tracker          |
                    +-----------------------------+
```

---

### Role 1: Super Admin (Headquarters / Franchisor)
* **Who they are in real life:** The franchise founder, CEO, or Head of Operations at headquarters.
* **Their scope:** **Global Access** across all 7 branches.

#### 🟢 What Powers They Have:
1. **Franchise Branch Provisioning:** Can create new franchise branches, suspend non-paying branches, and assign Branch Owners.
2. **Consolidated Financial Rollup:** Can view total franchise revenue, comparative branch performance, and net profits across all locations in one screen.
3. **Automatic Royalty Fee Deduction (7.5%):** The system automatically calculates and charges the 7.5% HQ royalty cut from each branch's monthly gross revenues.
4. **BIR 2307 Tax Withholding Oversight:** Audits 5% Creditable Withholding Tax certificates for compliance with Philippine Bureau of Internal Revenue (BIR) regulations.
5. **Master Audit Log:** Can see every single administrative action, login, and price override that happened across all branches.

#### 🔴 What They CANNOT Do:
* They do not ring up walk-in protein shakes or operate the front-desk cash register (that is reserved for front-desk staff).

#### 💡 Real-World Scenario:
> *The Super Admin logs in at HQ on the 1st of the month. In three clicks, they export the consolidated royalty statement showing ₱420,000 collected across all 7 branches, with BIR 2307 vouchers automatically prepared for each branch investor.*

---

### Role 2: Branch Owner (Franchise Investor)
* **Who they are in real life:** The business investor who bought the franchise license for a specific location (e.g., KSYN Alabang).
* **Their scope:** **Strictly locked to their own single branch**.

#### 🟢 What Powers They Have:
1. **Executive Financial Dashboard:** Can see real-time daily, weekly, and monthly sales graphs for their branch only.
2. **Royalty & Tax Statement Review:** Can inspect their monthly 7.5% franchise royalty bill and download their BIR 2307 withholding tax vouchers.
3. **Membership Growth Metrics:** Can monitor total active members, churn rate, retention percentages, and peak gym hours.
4. **Expense Review:** Can review operational utility bills and equipment maintenance costs submitted by their General Manager.

#### 🔴 What They CANNOT Do (Read-Only Safeguard):
* **No Tampering with Records:** Branch Owners **cannot** edit member accounts, delete transactions, or alter cashier shift counts.
* **No Cross-Branch Spying:** The system strictly blocks them from seeing sales numbers or customer lists of rival branches (e.g., Alabang cannot see BGC's revenue).

#### 💡 Real-World Scenario:
> *The Alabang branch investor opens FitConnect on their iPad while on vacation. They can see today's gross revenue is ₱38,500 with 142 gym visits, but they cannot accidentally change a cashier's drawer count or see BGC's sales.*

---

### Role 3: Branch Admin (General Manager / Gym Supervisor)
* **Who they are in real life:** The on-site manager who runs the gym facility every day.
* **Their scope:** **Full operational control over their assigned branch**.

#### 🟢 What Powers They Have:
1. **Staff & Coach Hiring:** Can create employee logins, assign staff shifts, and manage coach profiles for their gym.
2. **Member Account Management:** Can register new members, freeze memberships for medical reasons, and handle cancellations.
3. **Two-Stage Inter-Branch Transfer Clearance:** 
   - When a member moves to another city and asks to transfer their membership, the destination Branch Admin gets an alert.
   - The Branch Admin can click **Approve** (accepting the athlete into their branch) or **Decline** (with a reason, such as branch at maximum capacity).
4. **Cash Shift Sign-Off & Variance Audit:** Reviews cashiers' blind drawer closing counts. If a cashier is short ₱50, the manager investigates and signs off on the discrepancy.
5. **Supervisor Pass Override (PIN `1234`):** If a legitimate member gets locked out by the 15-minute Anti-Passback rule (e.g., they went to their car to grab a water bottle), the Branch Admin can enter their supervisor PIN to admit them.
6. **VIP Locker Assignments & Equipment Maintenance:** Assigns lockers to VIP athletes and logs broken equipment repair tickets.

#### 🔴 What They CANNOT Do:
* Cannot alter franchise royalty rates or access HQ platform configurations.
* Cannot view or modify members registered at other branches without an official approved transfer.

#### 💡 Real-World Scenario:
> *A member moves from BGC to Quezon City. The Quezon City Branch Admin reviews the incoming transfer request, verifies locker availability, and clicks "Approve". The member's profile and recurring billing immediately shift to Quezon City.*

---

### Role 4: Front-Desk Staff / Cashier (`employee`)
* **Who they are in real life:** The front-counter receptionist who greets gym-goers, sells drinks, and rings up day passes.
* **Their scope:** **Front-desk POS and optical check-in scanner for their active shift**.

#### 🟢 What Powers They Have:
1. **Point of Sale (POS) Cashiering:** Can ring up walk-in day passes (₱450), retail supplements, water bottles, and gym apparel.
2. **Multi-Channel Payment Processing:** Accepts Cash (with automatic change calculation), GCash, Maya (QR reference tracking), and Credit/Debit cards.
3. **Shift Opening & Cash Drops:** Enters the opening cash float (e.g., ₱3,000 in change bills) at 6:00 AM; logs mid-shift cash drops into the office safe when the drawer gets too full.
4. **Blind Drawer Closing Count:** At the end of the shift, the cashier counts the physical cash in the drawer and types in the exact amount.
5. **Front-Desk Web Camera Scanner:** Operates the live web camera scanner to read members' mobile QR passes or tap manual RFID tags.
6. **PII Masking Toggle:** A prominent button on their screen can mask all member phone numbers and email addresses (`j***e@gmail.com`) so waiting customers cannot shoulder-surf personal data.

#### 🔴 What They CANNOT Do (Anti-Theft Safeguards):
* **No Pre-Closing Total Disclosed (Blind Count):** The system **hides** the expected cash total from the cashier before they type their count. They cannot skim ₱200 and manipulate the count to match.
* **No Unauthorized Discounts or Voids:** Cannot void a completed receipt or apply a discount without a supervisor PIN.
* **No Executive Financial Access:** Cannot view branch profits or monthly balance sheets.

#### 💡 Real-World Scenario:
> *At 2:00 PM, Cashier Maria ends her shift. She counts ₱14,250 in cash in the drawer and submits it. The system automatically compares it against its internal record of ₱14,300, logs a ₱50 shortage, and routes the report to the manager. Maria never saw the expected number before typing.*

---

### Role 5: Fitness Coach / Personal Trainer (`coach`)
* **Who they are in real life:** The certified gym trainer guiding athletes through workouts.
* **Their scope:** **Their assigned athlete roster and training programs**.

#### 🟢 What Powers They Have:
1. **Workout & Periodization Programming:** Can build multi-week exercise programs for clients, specifying exercises, sets, rep ranges, target weights, and RPE (Rate of Perceived Exertion).
2. **Athlete Biometric & Weigh-In Tracking:** Can monitor client body weight progress, body fat percentage, and personal record (PR) lifts over time.
3. **Real-Time Client Messaging:** Integrated 1-on-1 chat to answer client nutrition and training questions.
4. **Session Completion Verification:** Marks completed personal training sessions to deduct session credits from the member's package.
5. **15% Commission Ledger:** Can view personal earnings—every completed training session automatically logs their 15% commission cut.

#### 🔴 What They CANNOT Do:
* Cannot access the POS cash register or sell gym memberships.
* Cannot view other coaches' clients or inspect other coaches' earnings.

#### 💡 Real-World Scenario:
> *Coach Alex opens his portal on his phone, sees that his client Juan completed 4 sets of squats today, sends him a congratulatory message, and logs the session. Alex's commission dashboard updates to show ₱300 earned for the hour.*

---

### Role 6: Gym Member / Athlete (`member`)
* **Who they are in real life:** The gym member working out at the facility.
* **Their scope:** **Their personal account, passes, and workouts**.

#### 🟢 What Powers They Have:
1. **60-Second Dynamic Optical Pass:** Can tap "Show Pass" on their smartphone to generate an animated QR code that counts down from 60 seconds.
2. **Workout Routine Viewer:** Can open their phone to view the exact exercises and sets prescribed by their coach and check off finished sets.
3. **Personal Biometrics & PR Logger:** Can log their daily body weight and record personal best lifts (bench press, squat, deadlift).
4. **Self-Service Online Renewal:** Can renew their monthly membership plan using online payment methods (credit card or digital wallet).
5. **Self-Service Inter-Branch Transfer Request:** Can request a branch change right from their dashboard and see live updates (e.g., "Pending Approval from Quezon City").

#### 🔴 What They CANNOT Do:
* **Cannot Share Passes via Screenshot:** A screenshot sent to a friend will expire within 60 seconds or be rejected as a duplicate.
* **Cannot "Double Dip" Entry:** Cannot scan in, hand the phone back to a friend, and let them in (blocked by the 15-minute Anti-Passback rule).
* **Cannot See Any Other Member's Information.**

#### 💡 Real-World Scenario:
> *Member Carlos walks into KSYN BGC. He opens his phone, taps his dynamic pass, and holds it up to the counter camera. The screen flashes green: "Access Granted - Carlos Gomez (VIP Black Card)". He heads inside to start his workout.*

---

## 3. Side-by-Side Role Feature Matrix

| Feature / Power | Super Admin | Branch Owner | Branch Admin | Front-Desk Cashier | Coach / Trainer | Member / Athlete |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Branch Scope** | All 7 Branches | Own Branch Only | Own Branch Only | Own Shift & Branch | Assigned Clients | Own Profile |
| **Financial Access** | Consolidated P&L | Branch Sales Ledger | Shift Audits & Petty Cash | Cash Register Only | Commission Cut (15%) | Personal Receipts |
| **Branch Provisioning** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Manage Staff Logins** | ✅ Yes | ❌ No | ✅ Yes (Own Branch) | ❌ No | ❌ No | ❌ No |
| **Front-Desk POS Cashier** | ❌ No | ❌ No | ✅ (Supervisor Mode) | ✅ Full Cashiering | ❌ No | ❌ No |
| **Blind Drawer Count** | ❌ No | ❌ No | ✅ (Audit Sign-Off) | ✅ (Input Counts) | ❌ No | ❌ No |
| **Approve Inter-Branch Transfers** | ✅ (Arbitration) | ❌ No | ✅ (Approve / Decline) | ❌ No | ❌ No | ✅ (Request Only) |
| **Optical Web Scanner** | ❌ No | ❌ No | ✅ Yes | ✅ Full Scanner | ❌ No | ❌ No |
| **Generate 60s Dynamic Pass** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes (Mobile) |
| **Anti-Passback Override PIN** | ✅ Yes | ❌ No | ✅ Yes (`1234`) | ❌ No | ❌ No | ❌ No |
| **Prescribe Workout Routines** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Full Access | ❌ (View Only) |
| **Mask PII Toggle (Privacy)** | ❌ N/A | ❌ N/A | ✅ Yes | ✅ Yes (Front Counter) | ❌ N/A | ❌ N/A |

---

## 4. How the Security Mechanisms Work (Explained with Simple Analogies)

### 1. Multi-Tenancy & Row-Level Security (RLS)
* **The Analogy:** Imagine a modern apartment building. All 7 tenants share the same foundation, plumbing, and electrical grid (the shared database). However, each tenant has a physical steel deadbolt key. Tenant A's key will never turn in Tenant B's door.
* **The Technical Reality:** In PostgreSQL, whenever an Express endpoint talks to the database, it injects:
  ```sql
  SET LOCAL app.current_tenant_id = 'branch_002';
  ```
  PostgreSQL evaluates every single row at the database kernel level:
  ```sql
  CREATE POLICY tenant_isolation ON users
  USING (branch_id = current_setting('app.current_tenant_id', true));
  ```
  Even if a rogue cashier alters the URL to inspect another branch's member, PostgreSQL returns **0 rows**. It is mathematically impossible to leak data across branches.

---

### 2. The 60-Second Dynamic Pass & Anti-Replay Nonce
* **The Analogy:** Think of a movie ticket barcode that changes every minute, like the security code on a bank authenticator app.
* **The Technical Reality:** When a member opens their pass, the server generates an HMAC-SHA256 signature containing their ID, timestamp, and a random one-time string called a **nonce**:
  $$\text{Pass Token} = \text{Payload} \;+\; \text{HMAC-SHA256}(\text{Payload}, \text{SecretKey})$$
  1. If the pass is older than 60 seconds: **Rejected (`EXPIRED_QR`)**.
  2. If someone took a screenshot and scans it twice: The server checks its memory map. The nonce was already burned: **Rejected (`REPLAY_ATTACK_DETECTED`)**.
  3. If someone scanned in and handed their phone to a friend: The system checks their last entry time. It has been under 15 minutes: **Rejected (`ANTI_PASSBACK_VIOLATION`)**.

---

### 3. Blind Drawer Cash Balancing
* **The Analogy:** A bank teller placing their cash inside a sealed drop box at the end of the day without knowing what the computer expected. The branch manager opens the computer ledger afterward to compare.
* **The Technical Reality:**
  1. Cashier opens shift with an opening float (e.g., ₱3,000).
  2. Every cash transaction automatically increments an invisible counter (`expected_cash`).
  3. When closing, the cashier types what they physically counted.
  4. Only after submission does the system compute:
     $$\text{Variance} = \text{Actual Cash} - \text{Expected Cash}$$
  5. Any overage or shortage is permanently locked in the audit log.

---

### 4. Republic Act 10173 (Philippine Data Privacy Act) Compliance
* **The Problem:** When members stand at the front desk, other people in line behind them can see their personal phone number or email on the counter monitor.
* **FitConnect Solution:** The cashier UI has an automatic **PII Masking Filter**. Phone numbers display as `+63 917 **** 892` and emails display as `c****s@gmail.com`. Passwords are encrypted using salted **Bcrypt (cost factor 10)**, and historical logs older than 180 days are automatically summarized and purged.

---

## 5. Panel Defense "Cheat-Sheet": Top 5 Traps & Winning Answers

### Trap 1: "Why is there no physical turnstile with Arduino/ESP32?"
> **Winning Answer:**  
> *"Physical IoT microcontrollers and electromechanical turnstiles were explicitly delimited in Chapter 1 of our thesis manuscript. Our research focus is Enterprise Software Systems Architecture, Multi-Tenant Database Isolation, and Cryptographic Authentication. Our check-in verification is executed via responsive front-desk web camera optical scanners, which eliminates expensive hardware failure points while providing bank-grade cryptographic authentication in software."*

### Trap 2: "What if a cashier accepts cash for a walk-in gym pass and pockets the money?"
> **Winning Answer:**  
> *"In FitConnect, the Check-In Access module is strictly coupled with the POS module. An optical pass or walk-in entry ticket cannot be verified by the front-desk scanner unless a corresponding transaction record is generated. If a cashier lets someone walk past the desk, they are committing physical security breach outside the software, which is captured by physical CCTV and detected during shift inventory audits."*

### Trap 3: "Why use one database with RLS instead of a separate database for each branch?"
> **Winning Answer:**  
> *"Running 7 separate database servers increases operational cloud costs by 700%, creates nightmare database migration pipelines, and prevents headquarters from generating real-time cross-franchise financial rollups. PostgreSQL Row-Level Security gives us the exact same data isolation guarantees as separate databases, but with enterprise speed and resource efficiency."*

### Trap 4: "Can a member take a video of their dynamic QR code and send it to a friend?"
> **Winning Answer:**  
> *"No. The QR pass expires in 60 seconds. Furthermore, even if sent within 60 seconds, our server consumes the unique cryptographic nonce on the first scan. Any secondary scan of that same pass results in an instant HTTP 409 Replay Attack rejection. Finally, our 15-minute Anti-Passback rule prevents the same member account from checking in twice in rapid succession."*

### Trap 5: "What if an Alabang cashier tries to look up a BGC VIP member?"
> **Winning Answer:**  
> *"Every API request carries an authenticated JWT token containing the user's `branch_id`. Our database middleware executes `SET LOCAL app.current_tenant_id = $1`. PostgreSQL automatically filters the database query at the kernel level. Because the member belongs to BGC and the cashier's session is locked to Alabang, the database returns zero rows (HTTP 404 Not Found)."*

---

## 6. How to Use this Document for Your Oral Defense

1. **Print or Export to PDF:** Open this file or its accompanying Google Docs HTML version to print copies for your panel examiners.
2. **Assign Role Champions:** Have each member of your thesis group master one or two roles so that no matter which role the panel questions, your team answers immediately with confidence.
3. **Reference Chapter Delimitations Early:** In your opening 5-minute presentation, proudly state your software boundary to preempt hardware questions before they are even asked.
