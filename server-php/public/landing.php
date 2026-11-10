<?php
/**
 * KSYN FitConnect - Enterprise Multi-Tenant Franchise Platform
 * Official Landing Page & Gateway (PHP Production Build)
 * Compatible with Apache/PHP, Nginx/PHP-FPM, and Cisco Simulated Web Environments
 */
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// -------------------------------------------------------------
// Form Processing & Backend Logic
// -------------------------------------------------------------
$inquirySuccess = false;
$inquiryError = '';
$freePassSuccess = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // Handle Franchise Investor Inquiry
    if ($action === 'franchise_inquiry') {
        $fullName = trim((string)($_POST['fullName'] ?? ''));
        $email    = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
        $phone    = trim((string)($_POST['phone'] ?? ''));
        $location = trim((string)($_POST['targetLocation'] ?? ''));
        $capital  = trim((string)($_POST['investmentCapital'] ?? ''));
        $notes    = trim((string)($_POST['notes'] ?? ''));

        if (!empty($fullName) && $email && !empty($phone)) {
            $inquirySuccess = true;
        } else {
            $inquiryError = 'Please fill out all required fields with a valid email address.';
        }
    }

    // Handle 1-Day Free Pass Claim
    if ($action === 'claim_free_pass') {
        $guestName  = trim((string)($_POST['guestName'] ?? ''));
        $guestEmail = filter_var(trim((string)($_POST['guestEmail'] ?? '')), FILTER_VALIDATE_EMAIL);
        $guestBranch = trim((string)($_POST['guestBranch'] ?? 'BGC Elite'));

        if (!empty($guestName) && $guestEmail) {
            $freePassSuccess = true;
        }
    }
}

// -------------------------------------------------------------
// Live Franchise Branch Directory (All 7 Branches)
// -------------------------------------------------------------
$branches = [
    [
        'code'    => 'BGC',
        'name'    => 'KSYN BGC Elite',
        'city'    => 'Taguig City',
        'address' => 'Bonifacio High Street, Taguig City',
        'hours'   => '5:00 AM - 12:00 MN',
        'phone'   => '(02) 8888-0001',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'ALB',
        'name'    => 'KSYN Alabang Prime',
        'city'    => 'Muntinlupa City',
        'address' => 'Alabang Town Center, Commerce Ave, Muntinlupa',
        'hours'   => '6:00 AM - 11:00 PM',
        'phone'   => '(02) 8888-0002',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'QC',
        'name'    => 'KSYN Quezon City Central',
        'city'    => 'Quezon City',
        'address' => 'Tomas Morato Ave cor. Timog, Quezon City',
        'hours'   => '24/7 All-Access',
        'phone'   => '(02) 8888-0003',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'MKT',
        'name'    => 'KSYN Makati CBD Hub',
        'city'    => 'Makati City',
        'address' => 'Ayala Avenue cor. Paseo de Roxas, Makati',
        'hours'   => '5:30 AM - 11:30 PM',
        'phone'   => '(02) 8888-0004',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'ORT',
        'name'    => 'KSYN Ortigas Center',
        'city'    => 'Pasig City',
        'address' => 'F. Ortigas Jr. Road, San Antonio, Pasig',
        'hours'   => '6:00 AM - 11:00 PM',
        'phone'   => '(02) 8888-0005',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'CEB',
        'name'    => 'KSYN Cebu City IT Park',
        'city'    => 'Cebu City',
        'address' => 'Salinas Drive, Lahug, Cebu City',
        'hours'   => '24/7 All-Access',
        'phone'   => '(032) 412-0006',
        'status'  => 'Active & Operational'
    ],
    [
        'code'    => 'DVO',
        'name'    => 'KSYN Davao Central',
        'city'    => 'Davao City',
        'address' => 'J.P. Laurel Ave, Bajada, Davao City',
        'hours'   => '6:00 AM - 10:00 PM',
        'phone'   => '(082) 221-0007',
        'status'  => 'Active & Operational'
    ]
];

// -------------------------------------------------------------
// Membership Plans & Pricing
// -------------------------------------------------------------
$plans = [
    [
        'tier'     => 'WALK-IN PASS',
        'name'     => '1-Day Access Pass',
        'price'    => '₱450',
        'duration' => 'single day',
        'badge'    => 'Flexible',
        'features' => [
            'Full facility and locker access',
            '60-second rotating optical QR entry',
            'Cardio, free weights, and sauna',
            'No contract or long-term commitment'
        ]
    ],
    [
        'tier'     => 'STANDARD TIER',
        'name'     => 'Single Branch Monthly',
        'price'    => '₱1,800',
        'duration' => 'per month',
        'badge'    => 'Popular',
        'features' => [
            'Unlimited home branch gym access',
            '1-on-1 Fitness Assessment with Coach',
            'Member mobile web portal access',
            'Self-service plan renewal & receipt history'
        ]
    ],
    [
        'tier'     => 'VIP ALL-ACCESS',
        'name'     => 'Multi-Branch Gold VIP',
        'price'    => '₱2,800',
        'duration' => 'per month',
        'badge'    => 'Most Recommended',
        'features' => [
            'Unrestricted access across all 7 branches',
            'Complimentary permanent VIP locker',
            'Free coach workout split prescription',
            '1 Complimentary Guest Pass per month'
        ]
    ],
    [
        'tier'     => 'ELITE ANNUAL',
        'name'     => 'Black Card Annual',
        'price'    => '₱28,000',
        'duration' => 'per year (Save 17%)',
        'badge'    => 'Executive',
        'features' => [
            'Priority 7-branch national clearance',
            'Dedicated personal training periodization',
            'Exclusive KSYN Athlete Kit & bag',
            '15% discount on all pro shop retail'
        ]
    ]
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KSYN FitConnect — Multi-Tenant Commercial Fitness Franchise</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #0a0a0a;
    color: #f3f4f6;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  a { text-decoration: none; color: inherit; }

  /* NAVIGATION */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(10, 10, 10, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #1f1f1f;
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo-badge {
    width: 38px;
    height: 38px;
    background: #e1c256;
    color: #000;
    font-weight: 900;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(225, 194, 86, 0.4);
  }
  .brand-text h1 {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.5px;
    color: #ffffff;
  }
  .brand-text h1 span { color: #e1c256; }
  .brand-text p {
    font-size: 10px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .nav-links {
    display: flex;
    gap: 22px;
    align-items: center;
  }
  .nav-link {
    font-size: 13px;
    font-weight: 600;
    color: #9ca3af;
    transition: color 0.2s;
  }
  .nav-link:hover { color: #e1c256; }
  .nav-actions {
    display: flex;
    gap: 10px;
  }
  .btn {
    display: inline-block;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    text-align: center;
  }
  .btn-gold {
    background: #e1c256;
    color: #000000;
  }
  .btn-gold:hover { background: #f0d575; }
  .btn-outline {
    background: transparent;
    color: #e1c256;
    border: 1px solid #e1c256;
  }
  .btn-outline:hover {
    background: rgba(225, 194, 86, 0.15);
  }
  .btn-dark {
    background: #181818;
    color: #ffffff;
    border: 1px solid #333333;
  }
  .btn-dark:hover { background: #222222; }

  /* HERO BANNER */
  .hero {
    padding: 60px 24px 50px;
    max-width: 1100px;
    margin: 0 auto;
    text-align: center;
  }
  .hero-tag {
    display: inline-block;
    background: #17150a;
    border: 1px solid #e1c256;
    color: #e1c256;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 14px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 20px;
  }
  .hero-title {
    font-size: 42px;
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.15;
    margin-bottom: 18px;
    color: #ffffff;
  }
  .hero-title span { color: #e1c256; }
  .hero-subtitle {
    font-size: 15px;
    color: #9ca3af;
    max-width: 760px;
    margin: 0 auto 30px;
  }
  .hero-cta {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin-bottom: 50px;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    max-width: 950px;
    margin: 0 auto;
  }
  .metric-card {
    background: #121212;
    border: 1px solid #222222;
    padding: 16px;
    border-radius: 8px;
  }
  .metric-value {
    font-size: 26px;
    font-weight: 900;
    color: #e1c256;
  }
  .metric-label {
    font-size: 11px;
    color: #888888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* SECTION WRAPPERS */
  .section {
    padding: 60px 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .section-header {
    text-align: center;
    margin-bottom: 40px;
  }
  .section-header h2 {
    font-size: 28px;
    font-weight: 900;
    color: #ffffff;
    margin-bottom: 8px;
  }
  .section-header p {
    font-size: 14px;
    color: #9ca3af;
  }

  /* BRANCH DIRECTORY */
  .branches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 18px;
  }
  .branch-card {
    background: #131313;
    border: 1px solid #222222;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .branch-badge {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid #22c55e;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    display: inline-block;
    margin-bottom: 8px;
  }
  .branch-name {
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .branch-city {
    font-size: 12px;
    color: #e1c256;
    margin-bottom: 12px;
  }
  .branch-meta {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 6px;
  }

  /* MEMBERSHIP PLANS */
  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 16px;
  }
  .plan-card {
    background: #131313;
    border: 1px solid #222222;
    border-radius: 10px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }
  .plan-card.featured {
    border-color: #e1c256;
    box-shadow: 0 0 20px rgba(225, 194, 86, 0.15);
  }
  .plan-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    background: #e1c256;
    color: #000;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }
  .plan-name { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 10px; }
  .plan-price { font-size: 32px; font-weight: 900; color: #e1c256; }
  .plan-duration { font-size: 11px; color: #888; margin-bottom: 16px; }
  .plan-features { list-style: none; margin-bottom: 20px; font-size: 12px; color: #bbb; }
  .plan-features li { margin-bottom: 8px; }
  .plan-features li::before { content: "✓ "; color: #e1c256; font-weight: bold; }

  /* FRANCHISE INQUIRY FORM */
  .franchise-box {
    background: #111111;
    border: 1px solid #e1c256;
    border-radius: 12px;
    padding: 35px;
    max-width: 780px;
    margin: 0 auto;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 14px;
  }
  .form-group label {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .form-group input, .form-group select, .form-group textarea {
    background: #070707;
    border: 1px solid #333333;
    color: #ffffff;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 12px;
  }
  .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
    border-color: #e1c256;
    outline: none;
  }
  .alert-banner {
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .alert-success { background: #14532d; color: #4ade80; border: 1px solid #22c55e; }
  .alert-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; }

  /* FOOTER */
  .footer {
    border-top: 1px solid #1f1f1f;
    padding: 40px 24px;
    text-align: center;
    color: #777777;
    font-size: 12px;
  }

  /* MODAL */
  .modal-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 2000;
    align-items: center;
    justify-content: center;
  }
  .modal-overlay.open { display: flex; }
  .modal-content {
    background: #141414;
    border: 1px solid #e1c256;
    border-radius: 10px;
    padding: 26px;
    max-width: 420px;
    width: 90%;
    position: relative;
  }
  .modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .nav-links { display: none; }
    .hero-title { font-size: 28px; }
    .metrics-grid { grid-template-columns: 1fr 1fr; }
    .form-row { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<!-- TOP NAVIGATION -->
<nav class="navbar">
  <div class="brand">
    <div class="brand-logo-badge">K</div>
    <div class="brand-text">
      <h1>KSYN <span>FITCONNECT</span></h1>
      <p>Multi-Branch Commercial Fitness Franchise</p>
    </div>
  </div>

  <div class="nav-links">
    <a href="#franchise" class="nav-link">Franchise</a>
    <a href="#memberships" class="nav-link">Memberships</a>
    <a href="#locations" class="nav-link">7 Branches</a>
    <a href="#security" class="nav-link">Security Architecture</a>
  </div>

  <div class="nav-actions">
    <button class="btn btn-outline" onclick="openModal('freePassModal')">Claim 1-Day Pass</button>
    <button class="btn btn-gold" onclick="openModal('loginModal')">Account Sign In</button>
  </div>
</nav>

<!-- MAIN HERO SECTION -->
<header class="hero">
  <div class="hero-tag">Enterprise Multi-Tenant Architecture</div>
  <h1 class="hero-title">
    High-Performance Fitness &bull; <span>Secure Franchise SaaS</span>
  </h1>
  <p class="hero-subtitle">
    Unifying multi-branch gym operations, cryptographic member access, and automated franchise financials across the Philippines with PostgreSQL Row-Level Security.
  </p>

  <div class="hero-cta">
    <a href="#franchise" class="btn btn-gold" style="padding: 12px 24px; font-size: 14px;">Explore Franchise Investment</a>
    <a href="#locations" class="btn btn-dark" style="padding: 12px 24px; font-size: 14px;">Browse 7 Locations</a>
  </div>

  <!-- METRICS -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">7</div>
      <div class="metric-label">Active Branches</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">2,840+</div>
      <div class="metric-label">Enrolled Members</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">60s</div>
      <div class="metric-label">Dynamic Pass Rotation</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">100%</div>
      <div class="metric-label">Tenant Isolation</div>
    </div>
  </div>
</header>

<!-- BRANCH LOCATIONS SECTION -->
<section id="locations" class="section">
  <div class="section-header">
    <h2>Commercial Branch Network</h2>
    <p>Seven strategically located hubs connected to our central enterprise cloud gateway.</p>
  </div>

  <div class="branches-grid">
    <?php foreach ($branches as $b): ?>
      <div class="branch-card">
        <div>
          <span class="branch-badge"><?= htmlspecialchars($b['status']) ?></span>
          <div class="branch-name"><?= htmlspecialchars($b['name']) ?></div>
          <div class="branch-city"><?= htmlspecialchars($b['city']) ?></div>
          <div class="branch-meta">📍 <?= htmlspecialchars($b['address']) ?></div>
          <div class="branch-meta">⏰ <?= htmlspecialchars($b['hours']) ?></div>
          <div class="branch-meta">📞 <?= htmlspecialchars($b['phone']) ?></div>
        </div>
        <div style="margin-top: 16px;">
          <button class="btn btn-dark" style="width: 100%;" onclick="openFreePassFor('<?= htmlspecialchars($b['name']) ?>')">Claim Guest Pass at <?= htmlspecialchars($b['code']) ?></button>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</section>

<!-- MEMBERSHIP PRICING -->
<section id="memberships" class="section">
  <div class="section-header">
    <h2>Transparent Membership Plans</h2>
    <p>Select your training frequency. All memberships include cryptographic dynamic pass verification.</p>
  </div>

  <div class="plans-grid">
    <?php foreach ($plans as $p): ?>
      <div class="plan-card <?= $p['badge'] === 'Most Recommended' ? 'featured' : '' ?>">
        <?php if (!empty($p['badge'])): ?>
          <span class="plan-badge"><?= htmlspecialchars($p['badge']) ?></span>
        <?php endif; ?>
        <div>
          <div class="plan-name"><?= htmlspecialchars($p['name']) ?></div>
          <div class="plan-price"><?= htmlspecialchars($p['price']) ?></div>
          <div class="plan-duration"><?= htmlspecialchars($p['duration']) ?></div>
          <ul class="plan-features">
            <?php foreach ($p['features'] as $f): ?>
              <li><?= htmlspecialchars($f) ?></li>
            <?php endforeach; ?>
          </ul>
        </div>
        <button class="btn <?= $p['badge'] === 'Most Recommended' ? 'btn-gold' : 'btn-dark' ?>" style="width: 100%;" onclick="openModal('loginModal')">
          Join with <?= htmlspecialchars($p['name']) ?>
        </button>
      </div>
    <?php endforeach; ?>
  </div>
</section>

<!-- SECURITY & TENANT ISOLATION ARCHITECTURE -->
<section id="security" class="section">
  <div class="section-header">
    <h2>Enterprise Security Architecture</h2>
    <p>How FitConnect mathematically isolates franchise data and prevents fraud in software.</p>
  </div>

  <div style="background: #111111; border: 1px solid #222222; border-radius: 10px; padding: 25px;">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
      <div>
        <h3 style="color: #e1c256; font-size: 15px; margin-bottom: 6px;">PostgreSQL Row-Level Security</h3>
        <p style="font-size: 12px; color: #9ca3af;">
          Every database transaction injects <code>SET LOCAL app.current_tenant_id = [branch_id]</code>. Queries evaluate at the database kernel level, mathematically preventing cross-branch data leaks.
        </p>
      </div>
      <div>
        <h3 style="color: #e1c256; font-size: 15px; margin-bottom: 6px;">60s HMAC Optical Passes</h3>
        <p style="font-size: 12px; color: #9ca3af;">
          Pass tokens rotate every 60 seconds with cryptographic nonces. Replaying a screenshot triggers an immediate <code>409 Conflict: REPLAY ATTACK DETECTED</code>.
        </p>
      </div>
      <div>
        <h3 style="color: #e1c256; font-size: 15px; margin-bottom: 6px;">Blind Cash Drawer Balancing</h3>
        <p style="font-size: 12px; color: #9ca3af;">
          Cashiers close shifts by inputting counted cash blindly. The system conceals expected cash totals, preventing skimming and unrecorded walk-ins.
        </p>
      </div>
      <div>
        <h3 style="color: #e1c256; font-size: 15px; margin-bottom: 6px;">RA 10173 PII Protection</h3>
        <p style="font-size: 12px; color: #9ca3af;">
          Front-desk terminals feature active PII masking (<code>j***e@gmail.com</code>) to eliminate shoulder-surfing in public gym lobbies.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- FRANCHISE INQUIRY -->
<section id="franchise" class="section">
  <div class="section-header">
    <h2>Franchise Investment Inquiry</h2>
    <p>Partner with KSYN Fitness. Open a commercial branch in your target city.</p>
  </div>

  <div class="franchise-box">
    <?php if ($inquirySuccess): ?>
      <div class="alert-banner alert-success">
        ✓ Thank you, <strong><?= htmlspecialchars($fullName) ?></strong>! Your franchise inquiry has been recorded. Our Head of Franchise Development will send the official investment prospectus to <strong><?= htmlspecialchars($email) ?></strong>.
      </div>
    <?php elseif (!empty($inquiryError)): ?>
      <div class="alert-banner alert-error">
        ⚠ <?= htmlspecialchars($inquiryError) ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="#franchise">
      <input type="hidden" name="action" value="franchise_inquiry">
      
      <div class="form-row">
        <div class="form-group">
          <label>Full Name *</label>
          <input type="text" name="fullName" placeholder="e.g. Maria Santos" required value="<?= htmlspecialchars($_POST['fullName'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label>Email Address *</label>
          <input type="email" name="email" placeholder="e.g. investor@example.com" required value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Contact Phone Number *</label>
          <input type="tel" name="phone" placeholder="e.g. +63 917 123 4567" required value="<?= htmlspecialchars($_POST['phone'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label>Target Franchise Location *</label>
          <select name="targetLocation">
            <option value="Makati CBD">Makati CBD Hub</option>
            <option value="BGC Elite">Bonifacio Global City</option>
            <option value="Alabang Prime">Alabang / South Metro</option>
            <option value="Quezon City">Quezon City Central</option>
            <option value="Ortigas Hub">Ortigas Center</option>
            <option value="Cebu City">Cebu City IT Park</option>
            <option value="Davao City">Davao City Central</option>
            <option value="Other Province">Other Provincial Commercial Area</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Investment Capital Range</label>
        <select name="investmentCapital">
          <option>₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Hub)</option>
          <option>₱6,000,000 – ₱9,000,000 (700–1,000 sqm Flagship Facility)</option>
          <option>₱10,000,000+ (Multi-Unit Regional Franchisee)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Additional Notes / Site Availability</label>
        <textarea name="notes" rows="3" placeholder="Describe your commercial space or franchise goals..."><?= htmlspecialchars($_POST['notes'] ?? '') ?></textarea>
      </div>

      <button type="submit" class="btn btn-gold" style="width: 100%; padding: 12px; font-size: 14px;">
        Submit Official Franchise Inquiry
      </button>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer class="footer">
  <p>&copy; <?= date('Y') ?> KSYN FitConnect Enterprise Platform. All rights reserved.</p>
  <p style="margin-top: 6px; color: #555555;">
    Multi-Tenant SaaS with PostgreSQL Row-Level Security &bull; Republic Act 10173 (Data Privacy Act of 2012) Compliant
  </p>
</footer>

<!-- MODAL: LOGIN / PORTAL ACCESS -->
<div id="loginModal" class="modal-overlay">
  <div class="modal-content">
    <button class="modal-close" onclick="closeModal('loginModal')">&times;</button>
    <h3 style="color:#ffffff; font-size:18px; font-weight:800; margin-bottom:4px;">Account Sign In</h3>
    <p style="font-size:11px; color:#9ca3af; margin-bottom:16px;">Access your member pass or staff enterprise terminal.</p>
    
    <form onsubmit="event.preventDefault(); alert('Redirecting to authenticated portal session...'); closeModal('loginModal');">
      <div class="form-group">
        <label>Email Address or Username</label>
        <input type="text" placeholder="e.g. user@ksyn.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" placeholder="••••••••" required>
      </div>
      <button type="submit" class="btn btn-gold" style="width: 100%; padding: 10px; margin-top: 6px;">Sign In to Portal &rarr;</button>
    </form>
  </div>
</div>

<!-- MODAL: 1-DAY FREE PASS -->
<div id="freePassModal" class="modal-overlay">
  <div class="modal-content">
    <button class="modal-close" onclick="closeModal('freePassModal')">&times;</button>
    <h3 style="color:#ffffff; font-size:18px; font-weight:800; margin-bottom:4px;">Claim 1-Day Trial Pass</h3>
    <p style="font-size:11px; color:#9ca3af; margin-bottom:16px;">Experience world-class commercial gym equipment.</p>
    
    <form method="POST" action="">
      <input type="hidden" name="action" value="claim_free_pass">
      <div class="form-group">
        <label>Your Full Name</label>
        <input type="text" name="guestName" placeholder="e.g. Juan Dela Cruz" required>
      </div>
      <div class="form-group">
        <label>Email for Digital Pass</label>
        <input type="email" name="guestEmail" placeholder="e.g. juan@gmail.com" required>
      </div>
      <div class="form-group">
        <label>Select Preferred Branch</label>
        <select name="guestBranch" id="freePassBranchSelect">
          <?php foreach ($branches as $b): ?>
            <option value="<?= htmlspecialchars($b['name']) ?>"><?= htmlspecialchars($b['name']) ?> (<?= htmlspecialchars($b['city']) ?>)</option>
          <?php endforeach; ?>
        </select>
      </div>
      <button type="submit" class="btn btn-gold" style="width: 100%; padding: 10px; margin-top: 6px;">Generate Digital Free Pass</button>
    </form>
  </div>
</div>

<script>
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.className = 'modal-overlay open';
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.className = 'modal-overlay';
  }
  function openFreePassFor(branchName) {
    var sel = document.getElementById('freePassBranchSelect');
    if (sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.indexOf(branchName) !== -1) {
          sel.selectedIndex = i;
          break;
        }
      }
    }
    openModal('freePassModal');
  }
</script>
</body>
</html>
