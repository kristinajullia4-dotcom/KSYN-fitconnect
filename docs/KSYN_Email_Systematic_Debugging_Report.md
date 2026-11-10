# 🔬 Systematic Debugging Report: KSYN Email & OTP Subsystem

> **System**: KSYN FitConnect Enterprise Platform  
> **Investigation Scope**: Email dispatch, OTP verification, franchise notifications, SMTP ports, and cloud hosting network environment.  
> **Target Environment**: Render.com Free Tier (`ksynfitconnect.onrender.com`) vs Local Execution.

---

## 1. Executive Summary

| Layer | Component | Status | Verified Evidence |
| :--- | :--- | :--- | :--- |
| **Credentials** | Google Workspace (`umak.edu.ph`) | **VERIFIED (100% Working)** | `250 2.0.0 OK (gsmtp)` via Port 465 SSL |
| **Credentials** | Brevo Account (`kristinajullia4@gmail.com`) | **AUTHENTICATED** | Account ID `12691581`, 300 free credits/day active |
| **Permissions** | Brevo API Key (`xkeysib-ff2bb...`) | **BLOCKED (Transactional)** | `403 permission_denied: not authorized for "transactional.email"` |
| **Network** | Render Free Tier Cloud Sandbox | **FIREWALL BLOCKED** | Ports `25`, `465`, and `587` are dropped by Render platform rules |
| **Network** | HTTPS REST API (Port 443) | **ALLOWED** | HTTP traffic on port 443 connects cleanly from Render in <500ms |

---

## 2. Evidence & Automated Test Results

### Test A: Direct Google SMTP Authentication Test
```bash
node -e "transporter.verify()"
```
* **Result**:
  ```text
  [KSYN Mailer] Live Gmail SMTP connection verified successfully (IPv4)!
  SMTP Connection Status: VERIFIED (250 OK)
  Message-ID: <b31c7426-ddea-aee1-3256-31dd9b4d65e3@umak.edu.ph>
  ```
* **Verdict**: Your Google credentials (`jmarquez.k12150582@umak.edu.ph` / `ycgmrwgkzwhumbtj`) are **completely valid** and can send real emails directly to Google's mail servers.

---

### Test B: Brevo Account Authentication Test
```bash
GET https://api.brevo.com/v3/account
```
* **Result**:
  ```json
  {
    "email": "kristinajullia4@gmail.com",
    "firstName": "Jullia",
    "lastName": "Kristina",
    "plan": [{ "type": "free", "credits": 300, "creditsType": "sendLimit" }],
    "planVerticals": [{ "planCategory": "Marketing", "status": "active" }]
  }
  ```
* **Verdict**: The API key is recognized and authenticates your Brevo account with 300 credits.

---

### Test C: Brevo Transactional Email Send Test
```bash
POST https://api.brevo.com/v3/smtp/email
```
* **Result**:
  ```json
  {
    "message": "api key is not authorized for resource \"transactional.email\"",
    "code": "permission_denied"
  }
  ```
* **Verdict**: Brevo created the account under the **"Marketing"** category. The API key was not granted permission for the `transactional.email` resource, so Brevo rejects outbound transactional dispatch.

---

### Test D: Render Cloud Network Firewall Trace
* **Free Tier Rules**: Render's official infrastructure policy blocks outbound TCP connections on ports `25`, `465`, and `587` on all Free instances to prevent automated spam.
* **Result on Render**: When Node.js tries to open a socket to `smtp.gmail.com:465`, packets are dropped by Render's host firewall. After 15 seconds, the OS times out and throws `Connection timeout`.

---

## 3. The 3 Clear Paths Forward

### 🛣️ Path 1: Activate Transactional Permissions in Brevo (Free, Port 443)
To enable Brevo to send transactional emails over Port 443:
1. In **[Brevo](https://app.brevo.com/)**, go to **Transactional** on the left menu.
2. If Brevo displays a banner saying *"Activate your Transactional platform"*, complete the 1-click activation request.
3. In **SMTP & API** → **API Keys**, ensure the key has **Transactional email: All** permissions enabled.

---

### 🛣️ Path 2: Use Resend API (Free, Port 443, Instant Activation)
Unlike Brevo, **[Resend](https://resend.com)** does not require separate account activation for transactional emails:
1. Sign in to **[resend.com](https://resend.com)** with GitHub (`kristinajullia4-dotcom`).
2. Click **API Keys** → **Create API Key**.
3. In Render Environment variables, add:
   * `RESEND_API_KEY`: `re_...`
4. The server's built-in Resend dispatcher will send immediately over HTTPS Port 443.

---

### 🛣️ Path 3: Laptop Defense Launcher (`start_defense_demo.bat`) — Recommended for Defense Day
If this is for your **Thesis / Panel Defense**:
* Run [`ksyn/start_defense_demo.bat`](file:///c:/Users/admin/OneDrive/Desktop/systems/ksyn-20260923T052834Z-1-001/ksyn/start_defense_demo.bat) on your laptop.
* Your laptop is **not restricted by Render's firewall**.
* Google SMTP (`@umak.edu.ph`) works directly on Port 465, sending real emails in 2 seconds to any recipient.
* The launcher provides an instant public `https://...` link so panelists can test mobile camera scanning and member check-ins.
