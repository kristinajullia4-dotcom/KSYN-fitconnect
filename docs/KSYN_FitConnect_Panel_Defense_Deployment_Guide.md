# 🎓 KSYN FitConnect — Panel Defense Deployment & Hosting Guide

> **System**: KSYN FitConnect Enterprise Platform  
> **Target Audience**: Thesis / Capstone Panel Defense & Evaluators  
> **Key Architecture**: React 18 (Vite SPA) + Node.js (Express API) + WebSockets (`ws`) + Multi-Tenant RLS / In-Memory Resilient Store

---

## 🌟 Quick Summary of Prepared Improvements

We have configured the backend to **unify frontend and backend serving**:
1. **Single Port & Single Domain**: The Express server now automatically serves the compiled React client (`dist/`) for all frontend routes while handling `/api/...` for the REST endpoints.
2. **Zero CORS Issues**: Because the web client and API share the exact same host and port, cross-origin blocking is eliminated.
3. **Turnstile WebSockets (`wss://`)**: WebSockets connect directly to the same host without requiring separate proxy tunnels.
4. **Mobile Camera Ready (HTTPS)**: Mobile browsers (iOS Safari & Chrome Android) require HTTPS to open the camera for QR code scanning. Both methods below provide HTTPS with zero cost.

---

## 🚀 Option A: Cloud Deployment on Render.com (Recommended for Defense Slides)

Deploying to [Render.com](https://render.com) provides a permanent, professional public URL (e.g. `https://ksyn-fitconnect.onrender.com`) that you can print on your presentation slides and evaluation handouts.

### Step 1: Push Code to GitHub
1. Create a repository on [GitHub](https://github.com) named `ksyn-fitconnect`.
2. Push your project folder to GitHub.

### Step 2: Create Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com) (free account).
2. Click **New +** → **Web Service**.
3. Connect your `ksyn-fitconnect` GitHub repository.
4. Configure the service settings:
   * **Name**: `ksyn-fitconnect` (or any name you prefer)
   * **Region**: `Singapore` (closest to the Philippines for lowest latency)
   * **Root Directory**: `ksyn` *(or leave blank if your repository root is `ksyn`)*
   * **Environment**: `Node`
   * **Build Command**: 
     ```bash
     npm install --prefix client && npm run build --prefix client && npm install --prefix server
     ```
   * **Start Command**: 
     ```bash
     node server/server.js
     ```
   * **Plan**: `Free`

### Step 3: Add Environment Variables
In the **Environment Variables** tab, add the following:

| Key | Recommended Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations & static asset caching |
| `PORT` | `10000` *(Render assigns this automatically)* | Port listener |
| `JWT_SECRET` | `ksyn_fitconnect_jwt_secret_ultra_secure_key_2026` | Token generation |
| `QR_HMAC_SECRET` | `ksyn_fitconnect_qr_hmac_secret_60s_ttl_key` | 60-second dynamic QR pass cryptographic signature |
| `REFRESH_TOKEN_SECRET` | `ksyn_fitconnect_refresh_token_secure_key_2026` | Session refresh |
| `PAYMENT_WEBHOOK_SECRET` | `ksyn-payment-webhook-secret-2026` | Xendit webhook signature |
| `DATABASE_URL` | *(Optional)* | If omitted, the platform uses its resilient in-memory multi-tenant store with all pre-seeded accounts |

5. Click **Deploy Web Service**. Render will build the React Vite bundle and launch the server in ~2 minutes!

---

## ⚡ Option B: Instant HTTPS Tunnel (Best for Live Defense Room Demonstration)

If you are defending in a conference room with your laptop and turnstile hardware or camera scanner, you can generate an instant live HTTPS address in **under 60 seconds** without uploading code or creating cloud accounts.

### Step 1: Build & Start the Unified Server Locally
Open PowerShell or Command Prompt in the `ksyn` directory:
```powershell
cd ksyn
npm run build
npm start
```
*Your server is now live on `http://localhost:5080` serving both the React frontend and Express API.*

### Step 2: Open an Instant HTTPS Tunnel
Open a second terminal window and run:
```powershell
npx --yes localtunnel --port 5080
```
This prints a public HTTPS URL such as:
```
your url is: https://bright-puma-42.loca.lt
```

---

## 📱 Mobile QR Scanning & Panel Defense Walkthrough

To demonstrate mobile functionality to the panel:
1. Provide the panel with the **HTTPS link** (from Render or Localtunnel).
2. **Panelist as Member**:
   * Open the link on their smartphone.
   * Log in with `member.bgc@ksyn.com` (Password: `Password123!`) or click the **1-Click Role Switcher** at the top.
   * Navigate to **My Pass**: Show the rotating 60-second dynamic QR code refreshing with HMAC cryptographic protection.
3. **Presenter as Turnstile Employee**:
   * On your laptop or tablet, log in with `staff.bgc@ksyn.com` (Password: `Password123!`).
   * Open the **Turnstile Kiosk Scanner**.
   * Scan the panelist's smartphone screen with the camera: Entry is instantly verified and logged in the append-only audit trail!

---

## 🔑 Pre-Seeded Panel Evaluation Accounts

All accounts use the default password: **`Password123!`**

| Persona | Email | Branch Affiliation | Core Demonstration Flow |
| :--- | :--- | :--- | :--- |
| **Super Admin (CEO)** | `super_admin@ksyn.com` | Corporate HQ | Consolidated EBITDA, BIR 2307, franchise audit log, network map |
| **Branch Admin** | `admin.bgc@ksyn.com` | BGC Flagship (`BGC-01`) | Branch members, equipment restock requisition, employee shifts |
| **Employee (Kiosk)** | `staff.bgc@ksyn.com` | BGC Flagship (`BGC-01`) | High-speed QR scanner terminal, attendance access gate |
| **Member** | `member.bgc@ksyn.com` | BGC Flagship (`BGC-01`) | Rotating 60s dynamic QR pass, digital ID card, workout history |
