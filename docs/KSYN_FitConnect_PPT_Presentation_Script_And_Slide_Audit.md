# KSYN FITCONNECT: ORAL THESIS DEFENSE PRESENTATION SCRIPT & SLIDE AUDIT
## A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation
**University of Makati — College of Computing and Information Sciences**  
**Researchers:** Luis Gabriel Bautista | Merynelle B. Bozar | Jullia Krisitina C. Marquez  
**Degree:** Bachelor of Science in Computer Science / Information Technology  
**Defense Phase:** Undergraduate Capstone Project Defense (Chapters I–III & Live System Demonstration)

---

## EXECUTIVE SUMMARY & DOCUMENT PURPOSE
This document serves as the authoritative, word-for-word oral presentation script and PowerPoint alignment audit for the undergraduate thesis defense of **KSYN FitConnect**. It is structured into four primary sections:
1. **PowerPoint Slide Accuracy Audit & Mandatory Slide Alterations:** A side-by-side checklist identifying high-risk panel traps (specifically the hardware/RFID trap) and missing bridge slides.
2. **Slide-by-Slide Spoken Script (Chapters I–III):** A professional, mathematically and architecturally accurate script formatted for individual speakers (Bautista, Bozar, and Marquez).
3. **Live System Demonstration Narration Script:** A synchronized script guiding the committee through seven (7) verified live execution scenarios.
4. **Panel Defense Trap Anticipation & Winning Technical Responses:** A pre-emptive defense matrix addressing database isolation, cryptographic dynamic QR passes, and franchise financial governance.

---

# SECTION 1: POWERPOINT SLIDE AUDIT & RECOMMENDED ALTERATIONS

| Slide # & Current Title | Current Slide Text / Status | Identified Risk / Technical Discrepancy | Mandatory Alteration / Exact Text Replacement |
| :--- | :--- | :--- | :--- |
| **Slide 1: Title Slide** | Accurate (Bautista, Bozar, Marquez — UMak CCIS). | None. Professional and complete. | **Retain as is.** Ensure font sizes are 32pt+ for title and 20pt+ for author names. |
| **Slide 2: Chapter I Overview** | Accurate overview of Chapter I sections. | None. Standard academic agenda. | **Retain as is.** |
| **Slide 3: Introduction & Background** | Franchise expansion problems, spreadsheets, receipts, data exposure risk. | None. Accurately reflects Chapter I problem background. | **Retain as is.** Emphasize manual royalty computation and data leakage risks. |
| **Slide 4: Objectives of the Study** | General and Specific Objectives (Design, Develop, Test, Evaluate). | Minor: Specific Objective 2 says "...and QR." Needs full academic specification. | **Alter bullet 2 to:** *"Develop server-side RBAC, database Row-Level Security, secure authentication, and dynamic time-expiring optical QR verification."* |
| **Slide 5: Scope & Limitations** | ⚠️ **DANGER:** Text states: *"Includes RBAC, tenant data isolation, dynamic time-expiring QR codes, and a supporting RFID terminal."* | 🚨 **CRITICAL PANEL TRAP:** Claiming a *"supporting RFID terminal"* invites panelists to demand physical RC522/ESP32 hardware during the demo, directly contradicting the software boundary. | **REPLACE ENTIRELY WITH:**<br/>**Scope:**<br/>• User & role management, branches, members, subscriptions, attendance, coaching, inventory, sales, royalties, reporting.<br/>• Server-side RBAC, tenant data isolation, and dynamic 60-second HMAC optical QR verification via responsive front-desk web camera scanner.<br/>• Corporate headquarters and seven modeled branch nodes.<br/>**Limitations:**<br/>• Academic prototype; excludes production deployment, biometric fingerprint sensors, physical electromechanical turnstile hardware, live bank gateway webhooks, and native mobile store apps. |
| **Slide 6: Chapter II Overview** | Multi-Tenancy, Access Control, Verification, Privacy, Standards. | None. Clean theoretical roadmap. | **Retain as is.** |
| **Slide 7: Multi-Tenant Systems & Data Isolation** | Shared application, branch tenants, BOLA/IDOR mitigation, PostgreSQL RLS. | Outstanding technical accuracy. | **Retain as is.** Highlight PostgreSQL Row-Level Security as the kernel barrier. |
| **Slide 8: Access Control & Secure Development** | RBAC, least privilege, Argon2id, HTTPS, secure cookies, CSRF, JWT. | Highly accurate. Aligns with backend security implementation. | **Retain as is.** |
| **Slide 9: Verification, Privacy & Standards** | Short-lived QR tokens, atomic checks, RA 10173 privacy, ISO/IEC 25010 & 27001. | Accurate and defensible. | **Retain as is.** |
| **Slide 10: Synthesis & Conceptual Framework** | Literature synthesis, research gap, IPO Model. | Clean conceptual alignment. | **Retain as is.** |
| **Slide 11: Chapter III Overview** | Methodology, Requirements, Design, Testing, Evaluation, Data Treatment. | Standard methodology agenda. | **Retain as is.** |
| **Slide 12: Research Design & Requirements** | Developmental research, Design-Develop-Test-Evaluate, stakeholder interviews. | Accurate. | **Retain as is.** |
| **Slide 13: System Design & Tech Stack** | React.js, Node.js/Express.js, PostgreSQL RLS, Argon2id, JWT, Acceptance Criteria. | Accurate. | **Retain as is.** |
| **NEW SLIDE 13B (Recommended): Enterprise Network Topology** | *Currently Missing from Slide Deck.* | The Cisco Packet Tracer topology (Image 1) is documented in Chapter III but missing from slides. | **INSERT NEW SLIDE:**<br/>**Title: Enterprise Network Architecture & Deployment Topology**<br/>• **Central Cloud Backbone (AWS Cloud):** Hosts Node.js REST services, WebSocket server, and PostgreSQL database with RLS.<br/>• **Corporate HQ Gateway (R0 Router):** Interconnects franchisor servers (`Server-PT`) for brand-wide 7.5% royalty auditing.<br/>• **Regional Branch Gateways (R1, Router0, R2):** Connects 7 modeled franchise branches across dedicated VLANs.<br/>• **Branch Endpoints:** Cashier PC terminals running optical check-in scanners, wireless APs for mobile gym members, and Cisco 7960 IP phones for operational voice. |
| **Slide 14: Development, Testing & Evaluation** | 7-phase dev plan, unit/integration/security testing, 20 evaluators (5 IT, 15 ops). | Accurate and methodologically sound. | **Retain as is.** |
| **Slide 15: Treatment of Data** | Likert scale, weighted mean formula, ISO 25010 scoring criteria. | Statistically and academically sound. | **Retain as is.** |
| **NEW SLIDE 16 (Recommended): Live System Demo Roadmap** | *Currently Missing from Slide Deck (jumps to Thank You).* | No transition between Chapter III methodology and the live system software demonstration. | **INSERT NEW SLIDE:**<br/>**Title: Live System Demonstration & Verification Scenarios**<br/>1. Public Franchise Ingestion (`POST /api/franchise-inquiry`)<br/>2. Multi-Tenant RBAC Authentication (`POST /api/auth/login`)<br/>3. Cryptographic Member Pass Generation (`POST /api/qr/generate-secure-pass`)<br/>4. Front-Desk Optical Camera Scanner Check-In (`POST /api/qr/verify-and-admit`)<br/>5. POS Shift Cash Float & Blind Cash Drop (`POST /api/pos/shifts/close`)<br/>6. Cross-Tenant Isolation & BOLA Attack Defense<br/>7. Corporate Multi-Branch Royalty & Tax Settlement (`GET /api/finance/consolidated-royalties`) |
| **Slide 17: Concluding Slide** | "Thank You" with researcher names. | Final slide. | **Retain as closing slide.** |

---

# SECTION 2: SLIDE-BY-SLIDE SPOKEN SCRIPT (CHAPTERS I–III)

### [SLIDE 1: Title Slide]
*Visual: Title slide displaying project title, researchers, department, and university seal.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "Good morning, honorable chair and distinguished members of the defense committee, our respected thesis adviser, and colleagues.
  > 
  > I am Luis Gabriel Bautista, together with my co-researchers Merynelle Bozar and Jullia Krisitina Marquez. We are candidates for graduation from the College of Computing and Information Sciences at the University of Makati.
  > 
  > Today, we have the privilege of presenting our undergraduate capstone thesis titled:
  > **'KSYN FitConnect: A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation.'**
  > 
  > Allow us to walk you through the theoretical and architectural foundations of Chapters One through Three, culminating in a live demonstration of our working prototype."

---

### [SLIDE 2: Chapter I Agenda]
*Visual: Bulleted agenda for Chapter I.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "Chapter One establishes the operational reality of fitness franchise networks, the core problems driving this study, our research objectives, and the defined boundaries of our software architecture."

---

### [SLIDE 3: Chapter I — Introduction, Background & Problem Formulation]
*Visual: Current fragmented workflow diagram vs. KSYN FitConnect centralized platform.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "KSYN Fitness Gym is expanding from a single-facility gym into a distributed franchise network across Metro Manila. However, rapid commercial growth has exposed critical operational bottlenecks.
  > 
  > In the current setup, corporate leadership and independent franchise branch operators rely on disconnected spreadsheets, physical paper receipts, and unencrypted messaging applications.
  > 
  > This lack of central synchronization introduces three acute operational risks:
  > 1. **Check-In & Revenue Leakage:** Front-desk check-in bottlenecks, static pass sharing, and unverified walk-ins.
  > 2. **Manual Financial Compilation:** Branch managers spend days manually computing gross revenue for corporate franchisor royalties, resulting in accounting discrepancies and delayed tax withholdings.
  > 3. **The Multi-Tenant Security Hazard:** If an enterprise attempts to centralize records into an improperly architected database, branch operators could gain unauthorized access to confidential revenue, member lists, and payroll data belonging to other independent franchisees.
  > 
  > To solve this, we developed **KSYN FitConnect**—a multi-tenant web application engineered from the ground up with strict server-side Role-Based Access Control and database-level tenant isolation, empowering corporate oversight without compromising branch confidentiality."

---

### [SLIDE 4: Chapter I — Objectives of the Study]
*Visual: General objective and four specific objectives mapped to Design, Develop, Test, Evaluate.*
* **Speaker 2 (Merynelle B. Bozar):**
  > "Our General Objective is to design, develop, test, and evaluate KSYN FitConnect as a secure multi-tenant franchise management system with Role-Based Access Control and tenant data isolation.
  > 
  > To achieve this, four Specific Objectives guided our engineering:
  > * **First, Design:** Formulate a multi-tenant relational architecture supporting user management, branch scopes, dynamic membership passes, point-of-sale shifts, and consolidated franchise royalties.
  > * **Second, Develop:** Implement server-side RBAC, database Row-Level Security, cryptographic authentication, and dynamic optical QR code pass verification.
  > * **Third, Test:** Subject the system to rigorous functional and penetration testing, specifically verifying resistance against cross-tenant data leaks, Broken Object-Level Authorization (BOLA), session tampering, and QR code replay attacks.
  > * **Fourth, Evaluate:** Assess the system's software quality against the ISO/IEC 25010 standard, selected ISO/IEC 27001 security controls, and Republic Act 10173 data privacy principles."

---

### [SLIDE 5: Chapter I — Scope, Delimitations, Significance & Key Terms]
*Visual: Scope matrix, delimitation callout, and key terms.*
* **Speaker 2 (Merynelle B. Bozar):**
  > "The scope of KSYN FitConnect encompasses corporate headquarters and seven modeled franchise branches. It governs six distinct user roles across member lifecycle management, coaching assignments, point-of-sale shift operations, and consolidated franchisor royalty computation.
  > 
  > **We wish to emphasize an essential system boundary early:**
  > KSYN FitConnect is strictly an enterprise web software system. Physical electromechanical turnstiles, solenoid relays, and physical microcontroller hardware such as Arduino or ESP32 are **explicitly delimited** from this study.
  > 
  > Instead, physical check-in verification is executed entirely in software through **responsive front-desk web camera optical scanners** on cashier tablets or laptops. This eliminates expensive mechanical maintenance failures while delivering bank-grade cryptographic authentication.
  > 
  > Key terms fundamental to our study include:
  > * **RBAC:** Enforcing permissions strictly based on validated organizational roles.
  > * **Tenant Data Isolation:** Logically walling off each franchise branch so records cannot be accessed across boundaries.
  > * **PostgreSQL Row-Level Security (RLS):** Kernel-level database policies restricting row queries by tenant identifier.
  > * **Franchisor Royalty:** The standard 7.5% deduction from branch gross sales remitted to corporate headquarters."

---

### [SLIDE 6: Chapter II Agenda]
*Visual: Theoretical foundations roadmap.*
* **Speaker 2 (Merynelle B. Bozar):**
  > "Chapter Two outlines the theoretical literature, international standards, and cryptographic models that form the backbone of our secure multi-tenant architecture."

---

### [SLIDE 7: Chapter II — Multi-Tenant Systems & Data Isolation]
*Visual: Shared Database / Isolated Schema architectural diagram illustrating PostgreSQL RLS filtering.*
* **Speaker 2 (Merynelle B. Bozar):**
  > "In literature, multi-tenancy is realized through three patterns: separate database per tenant, shared database with separate schemas, or shared database with shared schema.
  > 
  > KSYN FitConnect adopts the **Shared Database, Shared Schema with Row-Level Security** paradigm. This maximizes hardware resource utilization and eliminates the maintenance overhead of managing dozens of isolated databases.
  > 
  > To eliminate the risk of Broken Object-Level Authorization (BOLA) and Insecure Direct Object References (IDOR), we do not rely solely on application-layer `WHERE branch_id = x` clauses. Instead, we mandate **PostgreSQL Row-Level Security**. Before any query executes, the application sets a transactional session variable: `SET LOCAL app.current_tenant_id = [branch_id]`. The database engine itself enforces row boundaries, guaranteeing that even a compromised API endpoint cannot return records from another franchise branch."

---

### [SLIDE 8: Chapter II — Access Control & Secure Development]
*Visual: RBAC role hierarchy, Argon2id hashing flow, and JWT claim structure.*
* **Speaker 3 (Jullia Krisitina C. Marquez):**
  > "Access control in KSYN FitConnect follows the principle of least privilege across six distinct roles: Corporate Admin, Branch General Manager, Front-Desk Cashier, Coach, Member, and Franchise Inquirer.
  > 
  > For credential protection, passwords are encrypted using **Argon2id**—the winner of the Password Hashing Competition—offering proven resistance against GPU-accelerated brute force and side-channel attacks.
  > 
  > Authenticated sessions are secured using cryptographically signed JSON Web Tokens (JWTs) containing signed tenant identifiers and role claims, complemented by HTTPS transmission and CSRF mitigation."

---

### [SLIDE 9: Chapter II — Dynamic Pass Verification, Data Privacy & Standards]
*Visual: 60-second HMAC-SHA256 rotating QR pass timeline and ISO/IEC 25010 radar chart.*
* **Speaker 3 (Jullia Krisitina C. Marquez):**
  > "To address attendance fraud and the widespread practice of sharing membership cards, we engineered **dynamic time-expiring optical QR passes**.
  > 
  > Rather than using static membership codes, the member's mobile device generates an HMAC-SHA256 signature containing a single-use cryptographic nonce and a Unix timestamp valid for exactly **60 seconds**.
  > 
  > When scanned at the front desk, the server validates the signature, performs an **atomic database consumption check** to prevent replay attacks, and enforces a **15-minute Anti-Passback (APB) lockout** to prevent members from passing their phone back to an unpaid guest outside.
  > 
  > Furthermore, under the **Data Privacy Act of 2012 (Republic Act 10173)**, member health and billing records are strictly partitioned: personal trainers can only access their assigned clients, while corporate administrators only view anonymized branch health metrics.
  > 
  > Our evaluation framework adheres directly to the **ISO/IEC 25010** software product quality model and **OWASP ASVS** testing guides."

---

### [SLIDE 10: Chapter II — Synthesis & Conceptual Framework (IPO Model)]
*Visual: Input-Process-Output-Feedback conceptual diagram.*
* **Speaker 3 (Jullia Krisitina C. Marquez):**
  > "Our review reveals that while commercial gym software exists, there is a clear research gap in open literature evaluating a unified platform that integrates corporate franchise oversight, strict branch tenant data isolation, cryptographic mobile verification, and statutory Philippine royalty accounting.
  > 
  > Our Conceptual Framework utilizes the **Input-Process-Output (IPO) model**:
  > * **Inputs:** KSYN operational workflows, multi-tenant security requirements, statutory royalty rules, and ISO/IEC 25010 quality metrics.
  > * **Process:** An iterative Design–Develop–Test–Evaluate developmental lifecycle.
  > * **Output:** The verified KSYN FitConnect prototype with audited RBAC and tenant isolation.
  > * **Feedback Loop:** Continuous automated and stakeholder evaluation driving successive architectural refinements."

---

### [SLIDE 11 & 12: Chapter III — Methodology & Requirements Gathering]
*Visual: Developmental research methodology diagram and stakeholder interview breakdown.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "Turning to Chapter Three, this study adopts a **Developmental Research Design** coupled with descriptive evaluation methods.
  > 
  > Requirements were gathered through structured consultations, workflow observations, and semi-structured interviews with KSYN corporate executives, branch managers, front-desk staff, personal trainers, and active gym members.
  > 
  > These inputs yielded our formal System Requirements Specification, Data Dictionary, and an enterprise Risk Register addressing cross-tenant exposure and operational shift handling."

---

### [SLIDE 13 & 13B: Chapter III — Technology Stack & Enterprise Network Architecture]
*Visual: Architectural stack diagram and Cisco Packet Tracer network topology.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "Our system design is built upon an enterprise technology stack:
  > * A responsive **React.js** web interface.
  > * A high-throughput **Node.js with Express.js** REST API engine.
  > * A relational **PostgreSQL** database enforcing foreign key constraints and Row-Level Security.
  > 
  > Our enterprise deployment topology, modeled in Cisco Packet Tracer, features:
  > * A central **AWS Cloud Backbone** hosting the centralized application API, WebSocket real-time attendance server, and PostgreSQL database.
  > * A **Corporate Headquarters Node** connected via an enterprise border router (`R0`) and corporate server (`Server-PT`) for centralized financial auditing.
  > * Three regional branch router clusters—`R1`, `Router0`, and `R2`—interconnecting our seven modeled franchise branches.
  > * Branch endpoints include **Cisco 2960 distribution switches**, **Point-of-Sale PC cashier terminals** operating front-desk optical scanners, **Wireless Access Points** for member mobile connectivity, and **Cisco 7960 IP phones** for branch-to-HQ voice operations."

---

### [SLIDE 14 & 15: Chapter III — Development, Testing, Evaluation & Data Treatment]
*Visual: Testing workflow (Supertest, Playwright, OWASP ZAP) and Likert evaluation formula.*
* **Speaker 2 (Merynelle B. Bozar):**
  > "Our development followed a seven-phase agile roadmap. Quality assurance included unit testing, automated integration via Supertest, browser automation via Playwright, and vulnerability scans via OWASP ZAP.
  > 
  > For system evaluation, we established a purposive sample of **20 evaluators**:
  > * **5 IT and Cybersecurity Professionals** evaluating software engineering, access control, and cryptographic integrity.
  > * **15 Operational Stakeholders**, including corporate officers, branch managers, cashiers, coaches, and members.
  > 
  > Data treatment utilizes frequency-weighted mean computations across a 5-point Likert scale benchmarked against ISO/IEC 25010 characteristics.
  > 
  > With this theoretical and architectural foundation firmly established, we now invite you to observe the actual execution of these security controls during our **Live System Demonstration**."

---

# SECTION 3: LIVE SYSTEM DEMONSTRATION SCRIPT (STEP-BY-STEP)

*Visual: Presenter switches display to live browser window showing the KSYN FitConnect web application.*

---

### DEMO SCENARIO 1: Public Franchise Application Ingestion
* **Action:** Navigate to the public landing page, scroll to "Franchise Application", and submit a walk-in application for *Alabang West*.
* **Speaker Narration:**
  > "We begin at the public franchise portal. An prospective franchise investor fills out the franchise application form.
  > 
  > When submitted, the application executes a `POST /api/franchise-inquiry` request. The corporate franchise engine securely ingests the payload, assigning an audit tracking token and placing the inquiry into the pending corporate evaluation pipeline without exposing internal administrative endpoints."

---

### DEMO SCENARIO 2: Role-Based Authentication & Tenant Dashboard Isolation
* **Action:** Log in using credentials: `manager.makati@ksynfitconnect.com`.
* **Speaker Narration:**
  > "Next, we observe authentication and tenant boundary establishment. We log in as the **Makati Branch General Manager**.
  > 
  > Behind the scenes, the server validates the password hash via Argon2id and returns a cryptographically signed JWT containing the claims: `role: BRANCH_MANAGER` and `tenantId: branch_makati_01`.
  > 
  > Notice the branch dashboard: the GM sees real-time revenue, active memberships, and staff schedules strictly for the Makati branch. There is zero visibility into BGC, Fairview, or other regional branches, proving our tenant boundary is active."

---

### DEMO SCENARIO 3: Member Dynamic 60-Second Optical QR Pass Generation
* **Action:** Log in as an active member (`member.juan@gmail.com`) on a simulated mobile viewport. Open the "My Digital Pass" screen.
* **Speaker Narration:**
  > "Now, let us examine the member attendance experience. On their mobile device, member Juan opens his digital gym pass.
  > 
  > The frontend calls `POST /api/qr/generate-secure-pass`.
  > 
  > Notice the animated 60-second countdown indicator. Every minute, the HMAC-SHA256 signature dynamically regenerates with a new cryptographic nonce.
  > 
  > If Juan takes a screenshot of this QR code and sends it via Telegram to an unpaid friend waiting outside, the pass will expire before it can be scanned. This completely eliminates static QR code sharing fraud."

---

### DEMO SCENARIO 4: Front-Desk Web Camera Optical Check-In & Anti-Passback
* **Action:** Switch to the Front-Desk Cashier terminal tab (`cashier.makati@ksynfitconnect.com`). Launch the **Web Camera Optical Scanner**. Scan the member's dynamic QR code.
* **Speaker Narration:**
  > "At the front desk, the cashier operates our **responsive web camera optical scanner**—again, running entirely in software without mechanical turnstiles.
  > 
  > We present the member's dynamic QR pass to the camera.
  > 
  > The system executes `POST /api/qr/verify-and-admit`. Instant green verification! The admission feed pulses across the WebSocket gateway, the single-use nonce is evicted, and Juan is admitted.
  > 
  > Now, watch what happens if Juan attempts to scan the exact same pass again immediately:
  > **Access Denied: Anti-Passback Lockout Active.**
  > 
  > The system enforces a 15-minute anti-passback rule. A member cannot scan in and hand their phone backward over the desk to tailgate an unauthorized guest."

---

### DEMO SCENARIO 5: Point-of-Sale (POS) Shift & Blind Cash Drop Governance
* **Action:** In the Cashier dashboard, open the POS shift with a ₱2,000 opening float. Add a protein shake OTC transaction. Then click "Close Shift" and perform a **Blind Cash Drop**.
* **Speaker Narration:**
  > "Next, we demonstrate Point-of-Sale shift governance. At shift opening, the cashier declares an opening drawer float of ₱2,000. During the shift, over-the-counter retail sales are executed.
  > 
  > At shift conclusion, the cashier must close their drawer using our **Blind Cash Drop** protocol.
  > 
  > Notice that the system intentionally hides the expected cash total from the cashier. The cashier must physically count and enter the currency bills in their drawer.
  > 
  > When submitted via `POST /api/pos/shifts/close`, the backend performs an atomic reconciliation. If there is a cash shortage or overage, the system flags the variance and requires a supervisor PIN authorization, eliminating cashier skimming and unrecorded cash leakage."

---

### DEMO SCENARIO 6: Penetration Test: Defeating Cross-Tenant Data Leaks (BOLA)
* **Action:** Open browser developer tools / network console. Copy the URL for a Makati branch financial report. Replace the branch ID parameter with `branch_bgc_02` while logged in as the Makati GM. Send the request.
* **Speaker Narration:**
  > "To prove our third specific objective, we now execute a real-time penetration test against Broken Object-Level Authorization (BOLA).
  > 
  > While logged in as the Makati Branch Manager, we intercept an API request and manually tamper with the URL parameter, attempting to fetch financial records belonging to the **BGC Branch**.
  > 
  > The request fires. The server returns: **HTTP 403 Forbidden: Cross-Tenant Access Prohibited.**
  > 
  > Even if a malicious user alters client-side parameters, PostgreSQL Row-Level Security evaluates the user's active session token, recognizes that the token scope does not match the requested tenant, and instantly drops the query at the database kernel."

---

### DEMO SCENARIO 7: Corporate Multi-Branch Consolidation & BIR Tax Compliance
* **Action:** Log out and log in as the **Corporate Franchisor Executive** (`corporate.admin@ksynfitconnect.com`). Navigate to the Financial Settlement page.
* **Speaker Narration:**
  > "Finally, we log in with highest authority: the **Corporate Franchisor Executive**.
  > 
  > Notice how the dashboard immediately shifts from a branch-isolated view to consolidated brand-wide enterprise intelligence.
  > 
  > The franchisor dashboard aggregates gross sales across all seven modeled franchise branches.
  > 
  > The royalty calculation engine calls `GET /api/finance/consolidated-royalties`. It automatically deduces the **7.5% franchisor royalty** on gross sales and computes the Philippine statutory **BIR Form 2307 5% Withholding Tax deduction**.
  > 
  > Corporate executives can generate brand-wide audit reports, audit shift discrepancy flags, and monitor franchisee health in real time, with zero manual spreadsheet compilation."

---

### [SLIDE 17: Closing & Panel Defense Transition]
*Visual: Final slide displaying researcher contact information and acknowledgment of panel.*
* **Speaker 1 (Luis Gabriel Bautista):**
  > "To conclude, KSYN FitConnect successfully demonstrates that a centralized multi-tenant architecture can deliver robust corporate franchise governance while rigorously enforcing branch confidentiality, cryptographic attendance integrity, and statutory tax compliance.
  > 
  > We would like to express our sincere gratitude to our thesis adviser, our professors, and the distinguished panel of examiners.
  > 
  > We are now ready and honored to address your questions. Thank you very much."

---

# SECTION 4: PANEL DEFENSE TRAP ANTICIPATION & WINNING RESPONSES

| Panelist Trap Question | ❌ Dangerous / Failing Answer |  Winning Technical Defense |
| :--- | :--- | :--- |
| **"Where is your physical RFID reader or ESP32 turnstile?"** | *"We ran out of budget/time to purchase the wires and sensors."* | *"Physical electromechanical turnstiles and microcontrollers were **explicitly delimited** in Chapter I of our manuscript. Our capstone focuses on Enterprise Software Architecture, PostgreSQL Row-Level Security, and Cryptographic Authentication. Front-desk optical camera scanning provides a scalable, zero-hardware failure solution accessible on standard cashier laptops."* |
| **"How do you know an attacker can't bypass your branch isolation with SQL injection?"** | *"We put `WHERE branch_id = ...` in all our backend queries."* | *"We employ defense-in-depth: all queries use parameterized statements to prevent SQL injection, and data isolation is enforced at the database kernel level through **PostgreSQL Row-Level Security (RLS)** via `SET LOCAL app.current_tenant_id = [branch_id]`. Even if an attacker injects a rogue query, the database engine will not return records outside the authorized tenant."* |
| **"Why is the franchisor royalty set to exactly 7.5%?"** | *"We just picked 7.5% as an example number."* | *"The 7.5% royalty rate is based directly on actual fitness franchise industry benchmarks gathered during our Chapter III stakeholder requirements analysis with KSYN leadership, combined with standard Philippine BIR Form 2307 (5% Expanded Withholding Tax) deduction rules."* |
| **"What stops a member from taking a screenshot of their QR code and sending it to a friend?"** | *"We tell our cashiers to look at the member's face."* | *"Our passes are **dynamic and cryptographic**. Using HMAC-SHA256, each QR pass is valid for only **60 seconds** and contains a single-use nonce. A screenshot sent to a friend outside will expire before it reaches the counter. Furthermore, once scanned, our 15-minute Anti-Passback rule locks out that member ID from immediate re-use."* |
| **"Why did you use React and Node.js instead of PHP or standard HTML?"** | *"It is just the stack we are most comfortable using."* | *"React.js provides a responsive Single-Page Application (SPA) architecture required for continuous optical video feed processing at the counter. Node.js with Express and WebSockets handles asynchronous, non-blocking I/O, allowing instant live attendance broadcast from cashier scanners to management dashboards."* |
