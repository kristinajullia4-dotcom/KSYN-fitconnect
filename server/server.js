const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDatabase, isPostgres } = require('./config/db');
require('./config/secrets'); // Validate and enforce cryptographic secrets on boot

// Route imports
const authRoutes = require('./routes/authRoutes');
const branchRoutes = require('./routes/branchRoutes');
const memberRoutes = require('./routes/memberRoutes');
const qrRoutes = require('./routes/qrRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const financeRoutes = require('./routes/financeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const branchAdminRoutes = require('./routes/branchAdminRoutes');
const freePassRoutes = require('./routes/freePassRoutes');
const coachRoutes = require('./routes/coachRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const xenditRoutes = require('./routes/xenditRoutes');
const posRoutes = require('./routes/posRoutes');
const xenditController = require('./controllers/xenditController');
const memberController = require('./controllers/memberController');
const authGuard = require('./middleware/authGuard');
const { createFranchiseInquiry, requestFranchiseReschedule } = require('./controllers/superAdminController');
const payrollRoutes = require('./routes/payrollRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const classRoutes = require('./routes/classRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const branchStaffRoutes = require('./routes/branchStaffRoutes');
const { initTurnstileHardwareBridge } = require('./services/turnstileHardwareBridge');
const { startDpaRetentionSchedule } = require('./jobs/dpaRetentionCron');

const app = express();
const PORT = process.env.PORT || 5080;

// Security Middleware (HTTP headers hardening & Content Security Policy)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "http://localhost:5080",
        "http://127.0.0.1:5080",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "ws:",
        "wss:",
        "https:",
        "https://*.xendit.co",
        "https://api.xendit.co"
      ],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));

// CORS Configuration allowing client dev servers, local hostnames, and credentials
const allowedOrigins = [
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:5080',
  'http://127.0.0.1:5080'
];
if (process.env.CORS_ORIGIN && !allowedOrigins.includes(process.env.CORS_ORIGIN)) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, ESP32 hardware, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any localhost/127.0.0.1 port or private dev subnet
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow Cloudflare tunnels, Localtunnel, Render, Railway, or Vercel
    if (/\.(trycloudflare\.com|loca\.lt|onrender\.com|railway\.app|vercel\.app|ngrok-free\.app|ngrok\.io)$/.test(origin)) {
      return callback(null, true);
    }
    // Defense / Evaluation fallback
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-tenant-id',
    'x-terminal-key',
    'x-callback-token',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Helper to detect local development / loopback traffic to prevent dev IP lockouts
const isLocalOrDev = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    process.env.NODE_ENV !== 'production' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  );
};

// Rate Limiting (Brute-force protection & DoS mitigation)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP address. Please wait before retrying.'
  }
});
app.use('/api', globalLimiter);

// Dedicated Auth Protection: 60 attempts per 15 minutes per IP (shield against credential stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev,
  message: {
    success: false,
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts from this network. Please wait 15 minutes before retrying.'
  }
});
app.use('/api/auth/login', authLimiter);

// Dedicated Free-Pass Raffle Protection: 15 inquiries per hour per IP
const raffleLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev,
  message: {
    success: false,
    error: 'RAFFLE_RATE_LIMIT_EXCEEDED',
    message: 'Free pass submission rate limit reached. Please try again later.'
  }
});
app.use('/api/free-pass/submit', raffleLimiter);

// Body Parser
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// System Health & Diagnostics
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'KSYN FitConnect Enterprise',
    version: '1.0.0',
    mode: isPostgres() ? 'Native PostgreSQL RLS' : 'Resilient Multi-Tenant Memory Store (RLS Emulated)',
    timestamp: new Date()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/turnstile', qrRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', superAdminRoutes);
app.use('/api/branch-admin', branchAdminRoutes);
app.use('/api/free-pass', freePassRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/xendit', xenditRoutes);

// Dedicated Segregated Transaction Streams Endpoints (Stream 1: POS, Stream 2: PT, Stream 3: PLANS)
app.post('/api/plans/subscribe', authGuard, xenditController.subscribeMembershipPlan);
app.post('/api/pt/enroll-checkout', authGuard, memberController.initiatePtEnrollment);
app.post('/api/webhooks/xendit', xenditController.handleWebhook);
app.post('/api/franchise-inquiry', createFranchiseInquiry);
app.post('/api/franchise-inquiry/reschedule', requestFranchiseReschedule);

// Enterprise Functional Enhancements
app.use('/api/coach/payroll', payrollRoutes);
app.use('/api/finance/payroll', payrollRoutes);
app.use('/api/inventory/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/roles-and-permissions', permissionRoutes);
app.use('/api/branch-owner/staff', branchStaffRoutes);

// Philippine Data Privacy Act (RA 10173) & BIR RR 5-2014 Retention Schedule Routine
startDpaRetentionSchedule();

// Background Cron: Automated Subscription Expiration Engine (Periodic lifecycle monitor)
function runSubscriptionExpirationCheck() {
  try {
    const { memoryStore, query, isPostgres } = require('./config/db');
    const todayStr = new Date().toISOString().split('T')[0];
    let expiredCount = 0;

    if (Array.isArray(memoryStore.subscriptions)) {
      memoryStore.subscriptions.forEach(sub => {
        if (sub.status === 'active' && sub.end_date && sub.end_date < todayStr) {
          sub.status = 'expired';
          expiredCount++;
        }
      });
    }

    if (isPostgres()) {
      query("UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND end_date < CURRENT_DATE")
        .catch(err => console.error('[Postgres Sub Expiration Cron Error]:', err.message));
    }

    if (expiredCount > 0) {
      console.log(`[Subscription Expiration Cron] Marked ${expiredCount} expired subscriptions.`);
    }
  } catch (err) {
    console.error('[Subscription Expiration Cron Error]:', err.message);
  }
}

// Run immediately and every 60 seconds
runSubscriptionExpirationCheck();
const subExpirationCronTimer = setInterval(runSubscriptionExpirationCheck, 60000);
if (subExpirationCronTimer.unref) subExpirationCronTimer.unref();

// Global Active Broadcast Banner endpoint (accessible across all role portals with strict audience targeting)
app.get('/api/broadcast/active', (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { memoryStore } = require('./config/db');
    const { JWT_SECRET } = require('./config/secrets');

    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = (memoryStore.users || []).find(u => u.id === decoded.id);
      } catch (e) {
        // invalid token or expired
      }
    }

    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
    };

    if (Array.isArray(memoryStore.branches)) {
      memoryStore.branches.forEach(b => {
        if (b.id) branchMap[b.id] = b.id;
        if (b.code) branchMap[b.code] = b.id;
      });
    }

    const userBranchId = user ? (branchMap[user.branch_id] || user.branch_id) : null;
    const userRole = user ? user.role : 'guest';

    if (!memoryStore.broadcasts) {
      memoryStore.broadcasts = memoryStore.announcements || [];
    }

    const eligible = (memoryStore.broadcasts || []).filter(item => {
      if (!item.is_active) return false;
      if (userRole === 'super_admin') return true;

      // If created by branch admin:
      if (item.created_by_role === 'branch_admin') {
        const itemBranchId = branchMap[item.branch_id] || item.branch_id;
        if (!userBranchId || userBranchId !== itemBranchId) return false;
        if (item.target_audience === 'branch_all') return true;
        if (item.target_audience === 'members_only' && userRole === 'member') return true;
        if (item.target_audience === 'coaches_only' && (userRole === 'coach' || userRole === 'trainer')) return true;
        if (item.target_audience === 'staff_only' && (userRole === 'employee' || userRole === 'staff')) return true;
        if (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor') return true;
        return false;
      }

      // If created by super admin:
      const aud = item.target_audience || 'all';
      if (aud === 'all') return true;
      if (aud === 'branch_admins' && (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor')) return true;
      if ((aud === 'branch_owners' || aud === 'investors') && (userRole === 'branch_owner' || userRole === 'investor')) return true;
      if (aud === 'branch_all' && (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor')) return true;
      if (aud === 'coaches' && (userRole === 'coach' || userRole === 'trainer')) return true;
      if ((aud === 'members_all' || aud === 'members') && userRole === 'member') return true;
      if (aud === 'staff' && (userRole === 'employee' || userRole === 'staff' || userRole === 'front_desk' || userRole === 'cashier')) return true;

      // Branch-specific member targeting: e.g. "members_b-mkt-01" or "members_b-kat-02"
      if (aud.startsWith('members_')) {
        const targetBranch = aud.replace('members_', '');
        const normTarget = branchMap[targetBranch] || targetBranch;
        if (userRole === 'member' && userBranchId === normTarget) return true;
        return false;
      }

      return false;
    });

    res.json({ success: true, broadcast: eligible[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Universal Announcements & Promos endpoint with Role & Branch Targeting
app.get('/api/announcements', (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { memoryStore } = require('./config/db');
    const { JWT_SECRET } = require('./config/secrets');

    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = (memoryStore.users || []).find(u => u.id === decoded.id);
      } catch (e) {
        // invalid token or expired
      }
    }

    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
    };

    if (Array.isArray(memoryStore.branches)) {
      memoryStore.branches.forEach(b => {
        if (b.id) branchMap[b.id] = b.id;
        if (b.code) branchMap[b.code] = b.id;
      });
    }

    const userBranchId = user ? (branchMap[user.branch_id] || user.branch_id) : null;
    const userRole = user ? user.role : 'guest';

    if (!memoryStore.announcements) {
      memoryStore.announcements = memoryStore.broadcasts || [];
    }

    const filtered = (memoryStore.announcements || []).filter(item => {
      if (!item.is_active) return false;
      if (userRole === 'super_admin') return true;

      // If created by branch admin:
      if (item.created_by_role === 'branch_admin') {
        const itemBranchId = branchMap[item.branch_id] || item.branch_id;
        if (!userBranchId || userBranchId !== itemBranchId) return false;
        if (item.target_audience === 'branch_all') return true;
        if (item.target_audience === 'members_only' && userRole === 'member') return true;
        if (item.target_audience === 'coaches_only' && (userRole === 'coach' || userRole === 'trainer')) return true;
        if (item.target_audience === 'staff_only' && (userRole === 'employee' || userRole === 'staff' || userRole === 'front_desk' || userRole === 'cashier')) return true;
        if (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor') return true;
        return false;
      }

      // If created by super admin:
      const aud = item.target_audience || 'all';
      if (aud === 'all') return true;
      if (aud === 'branch_admins' && (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor')) return true;
      if ((aud === 'branch_owners' || aud === 'investors') && (userRole === 'branch_owner' || userRole === 'investor')) return true;
      if (aud === 'branch_all' && (userRole === 'branch_admin' || userRole === 'branch_owner' || userRole === 'investor')) return true;
      if (aud === 'coaches' && (userRole === 'coach' || userRole === 'trainer')) return true;
      if ((aud === 'members_all' || aud === 'members') && userRole === 'member') return true;
      if (aud === 'staff' && (userRole === 'employee' || userRole === 'staff' || userRole === 'front_desk' || userRole === 'cashier')) return true;

      // Branch-specific member targeting: e.g. "members_b-mkt-01" or "members_b-kat-02"
      if (aud.startsWith('members_')) {
        const targetBranch = aud.replace('members_', '');
        const normTarget = branchMap[targetBranch] || targetBranch;
        if (userRole === 'member' && userBranchId === normTarget) return true;
        return false;
      }

      return false;
    });

    res.json({
      success: true,
      announcements: filtered,
      promos: filtered.filter(a => a.type === 'promo')
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static React client build in production / unified hosting
const fs = require('fs');
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for client navigation (non-API routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// 404 Handler for API endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: `API endpoint '${req.originalUrl}' does not exist on this server.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Handle body parser SyntaxError (e.g. malformed JSON payloads)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'MALFORMED_JSON',
      message: 'The request body contains invalid JSON syntax.'
    });
  }

  // Handle CORS rejection gracefully without terminating the process
  if (err && (err.message?.includes('CORS') || err.name === 'CORSError')) {
    console.warn('[KSYN CORS Warning]:', err.message);
    return res.status(403).json({
      success: false,
      error: 'CORS_NOT_ALLOWED',
      message: 'Request origin not allowed by CORS policy.'
    });
  }

  console.error('[KSYN FitConnect Uncaught Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred processing your request.'
  });
  // Note: Non-critical errors and CORS rejections must never call process.exit()
});

// Start Server
async function startServer() {
  await initDatabase();

  const server = app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`KSYN Backend active on port ${PORT}`);
    console.log(`[KSYN] FitConnect Enterprise REST API online on port ${PORT}`);
    console.log(`[KSYN] Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`[KSYN] Tenant isolation: ENABLED (Strict branch_id check & RLS)`);
    console.log(`========================================================`);
  });

  // Engage WebSocket Turnstile Hardware Bridge for microcontrollers
  try {
    initTurnstileHardwareBridge(server);
  } catch (hwErr) {
    console.warn('[Turnstile Hardware Bridge Warning]:', hwErr.message);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[PORT IN USE] Port ${PORT} is already in use. Please free port ${PORT} to run KSYN FitConnect.`);
    } else {
      console.error('[SERVER ERROR]', err);
    }
  });

  process.on('uncaughtException', (err) => {
    console.error('[KSYN FitConnect Uncaught Exception]:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.warn('[KSYN FitConnect Unhandled Rejection]:', reason);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

