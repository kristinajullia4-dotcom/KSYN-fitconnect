const crypto = require('crypto');
const { query, memoryStore, isPostgres, saveStore } = require('../config/db');
const { sendFreePassAwardEmail } = require('../utils/mailer');

/**
 * GET /api/free-pass/branches
 * Public endpoint to list active branches for raffle entry selection
 */
async function getPublicBranches(req, res) {
  try {
    if (isPostgres()) {
      const result = await query(
        `SELECT id, code, name, city, address, is_active 
         FROM branches 
         WHERE is_active = TRUE 
         ORDER BY name ASC`
      );

      const branches = result?.rows || [];
      if (branches.length > 0) {
        return res.status(200).json({ 
          success: true, 
          branches, 
          data: branches 
        });
      }
    }

    const activeBranches = (memoryStore.branches || [])
      .filter(b => b.is_active !== false)
      .map(b => ({
        id: b.id,
        code: b.code,
        name: b.name,
        city: b.city,
        address: b.address,
        is_active: b.is_active
      }));

    if (activeBranches.length > 0) {
      return res.status(200).json({ 
        success: true, 
        branches: activeBranches, 
        data: activeBranches 
      });
    }
  } catch (dbErr) {
    console.warn('[FreePass Branches] DB query failed, serving fallback active branches:', dbErr.message);
  }

  // Resilient fallback branches if PostgreSQL is offline or table is empty
  const fallbackBranches = [
    { id: 'b-mkt-01', code: 'MKT-01', name: 'KSYN Fitness Makati', city: 'Makati City', address: 'Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St.', is_active: true },
    { id: 'b-kat-02', code: 'KAT-02', name: 'KSYN Fitness Katipunan', city: 'Quezon City', address: '4th Floor, Regis Center, 327 Katipunan Ave., Loyola Heights, Quezon City', is_active: true },
    { id: 'b-alb-03', code: 'ALB-03', name: 'KSYN Fitness Alabang', city: 'Las Piñas', address: '2nd Floor, B116, Alabang West Parade, Daang Hari Rd, Las Piñas', is_active: true },
    { id: 'b-kap-04', code: 'KAP-04', name: 'KSYN Fitness Kapitolyo (transitioning to FitSupplyGym)', city: 'Pasig City', address: '3rd Floor, JNCV Building, 165 Pasig Blvd, Pasig', is_active: true },
    { id: 'b-frv-05', code: 'FRV-05', name: 'KSYN Fitness Fairview', city: 'Quezon City', address: 'Pontiac St. corner Camaro St., West Fairview, Quezon City', is_active: true },
    { id: 'b-del-06', code: 'DLM-06', name: 'KSYN Fitness Del Monte', city: 'Quezon City', address: '4th Floor, VCT Building, 447 Del Monte Ave. corner Biak na Bato, Manresa, Quezon City', is_active: true }
  ];

  return res.status(200).json({ 
    success: true, 
    branches: fallbackBranches, 
    data: fallbackBranches 
  });
}

/**
 * POST /api/free-pass/apply
 * Public endpoint to enter the 1-day free pass monthly raffle
 */
async function applyFreePass(req, res) {
  try {
    let { branch_id, full_name, email, phone, phone_number, zip_code } = req.body;

    // Normalize branch_id if short code, district code, or fallback ID passed
    const branchMap = {
      'b1': 'b-mkt-01',
      'b2': 'b-kat-02',
      'b3': 'b-alb-03',
      'b4': 'b-kap-04',
      'b5': 'b-frv-05',
      'b6': 'b-del-06',
      'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01',
      'KAT-02': 'b-kat-02',
      'ALB-03': 'b-alb-03',
      'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05',
      'DLM-06': 'b-del-06',
      'TMO-07': 'b-tm-07',
      'branch-bgc': 'b-mkt-01',
      'branch-makati': 'b-mkt-01',
      'b-mkt-01': 'b-mkt-01',
      'b-kat-02': 'b-kat-02',
      'b-alb-03': 'b-alb-03',
      'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05',
      'b-del-06': 'b-del-06',
      'b-tm-07': 'b-tm-07'
    };
    if (branchMap[branch_id]) {
      branch_id = branchMap[branch_id];
    }

    // 1. Validate Gym Branch
    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Please select a KSYN gym branch.' });
    }

    const branch = (memoryStore.branches || []).find(b => 
      b.id === branch_id || 
      b.code === branch_id || 
      (b.name && b.name.toLowerCase() === String(branch_id).toLowerCase())
    );
    if (!branch && !isPostgres()) {
      return res.status(400).json({ success: false, message: 'Selected gym branch is invalid or inactive.' });
    }

    // 2. Validate Full Name (Strict regex: only letters, spaces, commas, periods, hyphens, apostrophes - reject numbers)
    const nameRegex = /^[A-Za-z\s.,'-]+$/;
    if (!full_name || !nameRegex.test(full_name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Name must only contain letters, spaces, commas, or periods (no numbers).'
      });
    }

    // 3. Validate Email Address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address containing "@".' });
    }

    // 4. Validate Philippine Phone Number (+63 9XX XXX XXXX or 09XXXXXXXXX)
    const rawPhone = phone || phone_number || '';
    const cleanPhone = String(rawPhone).replace(/[\s-]/g, '');
    const phPhoneRegex = /^(09|\+639)\d{9}$/;
    if (!rawPhone || !phPhoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid Philippine mobile (PH) number (e.g. 09171234567 or +639171234567).'
      });
    }

    // 5. Validate Zip / Postal Code (4-digit Philippine postal code)
    const zipRegex = /^\d{4}$/;
    if (!zip_code || !zipRegex.test(String(zip_code).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 4-digit PH postal/zip code.'
      });
    }

    // Current month_year tag (e.g., '2026-09')
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    // 6. Check for duplicate entry in the same calendar month for this branch
    if (isPostgres()) {
      const checkRes = await query(
        `SELECT id FROM free_pass_applications 
         WHERE LOWER(email) = LOWER($1) AND branch_id = $2 AND month_year = $3`,
        [email.trim(), branch_id, currentMonthYear]
      );
      if (checkRes.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "You have already entered this month's free pass raffle for this branch."
        });
      }

      const insertRes = await query(
        `INSERT INTO free_pass_applications (branch_id, full_name, email, phone, zip_code, month_year, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [branch_id, full_name.trim(), email.trim().toLowerCase(), cleanPhone, String(zip_code).trim(), currentMonthYear]
      );

      return res.status(201).json({
        success: true,
        message: "Entry recorded successfully.",
        applicant: insertRes.rows[0]
      });
    }

    // Memory Store Implementation
    if (!memoryStore.free_pass_applications) {
      memoryStore.free_pass_applications = [];
    }

    const existingEntry = memoryStore.free_pass_applications.find(
      a => a.email.toLowerCase() === email.trim().toLowerCase() &&
           (a.branch_id === branch_id || a.branch_id === branch?.id) &&
           a.month_year === currentMonthYear
    );

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: "You have already entered this month's free pass raffle for this branch."
      });
    }

    const targetBranchId = branch?.id || branch_id;

    const newApplication = {
      id: `fpa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      branch_id: targetBranchId,
      branch_name: branch?.name || targetBranchId,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: rawPhone.trim(),
      phone_number: rawPhone.trim(),
      zip_code: String(zip_code).trim(),
      applied_at: new Date().toISOString(),
      month_year: currentMonthYear,
      status: 'pending',
      awarded_at: null
    };

    memoryStore.free_pass_applications.push(newApplication);
    if (typeof saveStore === 'function') {
      try { saveStore(); } catch (e) { console.error('Failed to save store in applyFreePass:', e.message); }
    }

    console.log(`[FREE PASS ENTRY] New applicant registered: ${newApplication.full_name} (${newApplication.email}) for branch ${branch?.name || targetBranchId} [${currentMonthYear}]`);

    return res.status(201).json({
      success: true,
      message: "Entry recorded successfully.",
      applicant: newApplication
    });
  } catch (err) {
    console.error('Error applying for free pass:', err);
    return res.status(500).json({ success: false, message: 'An error occurred while submitting your raffle entry.' });
  }
}

/**
 * GET /api/branch-admin/free-pass-applicants
 * Protected endpoint for Branch Admin to view applicants for their branch
 */
async function getBranchApplicants(req, res) {
  try {
    const rawBranchId = req.user?.branch_id || req.query.branch_id;
    if (!rawBranchId && req.user?.role !== 'super_admin') {
      return res.status(400).json({ success: false, message: 'Branch ID is required.', applicants: [], data: [] });
    }

    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04'
    };
    const normBranchId = branchMap[rawBranchId] || rawBranchId;

    const currentMonthYear = (req.query.month && req.query.month !== 'all')
      ? req.query.month
      : new Date().toISOString().slice(0, 7);

    if (isPostgres()) {
      let sql = `SELECT * FROM free_pass_applications WHERE (branch_id = $1 OR branch_id = $2)`;
      const params = [normBranchId, rawBranchId];

      if (req.query.month && req.query.month !== 'all') {
        sql += ` AND month_year = $3`;
        params.push(req.query.month);
      }
      sql += ` ORDER BY applied_at DESC`;

      const result = await query(sql, params);
      const applicants = result.rows;
      const winner = applicants.find(a => a.status === 'awarded') || null;

      return res.json({
        success: true,
        month: currentMonthYear,
        winner,
        applicants,
        data: applicants
      });
    }

    // Memory Store
    if (!memoryStore.free_pass_applications) {
      memoryStore.free_pass_applications = [];
    }

    // Automatically remove applicants from previous months once the month has passed
    const activeCalendarMonth = new Date().toISOString().slice(0, 7);
    memoryStore.free_pass_applications = memoryStore.free_pass_applications.filter(a => {
      if (a.month_year && a.month_year < activeCalendarMonth) {
        return false;
      }
      return true;
    });

    const validBranchIds = new Set();
    if (normBranchId) {
      validBranchIds.add(normBranchId);
      const matched = (memoryStore.branches || []).find(b => b.id === normBranchId || b.code === normBranchId);
      if (matched) {
        if (matched.id) validBranchIds.add(matched.id);
        if (matched.code) validBranchIds.add(matched.code);
      }
    }
    if (rawBranchId) validBranchIds.add(rawBranchId);

    let branchApplicants = (!normBranchId && req.user?.role === 'super_admin')
      ? [...memoryStore.free_pass_applications]
      : memoryStore.free_pass_applications.filter(a => 
          validBranchIds.has(a.branch_id) || 
          (a.branch_id && normBranchId && a.branch_id.toLowerCase().includes(normBranchId.toLowerCase()))
        );

    // Strictly restrict to the requested/active month (never show past months)
    branchApplicants = branchApplicants.filter(a => a.month_year === currentMonthYear);

    // Sort newest first
    branchApplicants.sort((a, b) => new Date(b.applied_at || 0) - new Date(a.applied_at || 0));

    const winner = branchApplicants.find(a => a.status === 'awarded') || null;

    // Requirement: The applicants of the roster will be automatically removed once there is already a winner
    if (winner) {
      memoryStore.free_pass_applications = memoryStore.free_pass_applications.filter(a => {
        if (validBranchIds.has(a.branch_id) && a.month_year === currentMonthYear && a.status !== 'awarded') {
          return false;
        }
        return true;
      });
      branchApplicants = [];
    }

    return res.json({
      success: true,
      month: currentMonthYear,
      winner,
      applicants: branchApplicants,
      data: branchApplicants,
      totalCount: branchApplicants.length
    });
  } catch (err) {
    console.error('Error fetching branch free pass applicants:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve applicants.', applicants: [], data: [] });
  }
}

/**
 * POST /api/branch-admin/free-pass/award/:id
 * Protected endpoint for Branch Admin to select winner & dispatch 1-day access pass
 * Enforces 1-Winner-Per-Month Constraint
 */
async function awardFreePass(req, res) {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;

    if (isPostgres()) {
      // Find applicant
      const appRes = await query(`SELECT * FROM free_pass_applications WHERE id = $1`, [id]);
      if (appRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Applicant record not found.' });
      }

      const applicant = appRes.rows[0];

      // Branch Isolation check (unless super_admin)
      if (req.user.role !== 'super_admin' && applicant.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Applicant belongs to another branch.' });
      }

      // Check 1-Winner-Per-Month Constraint
      const winnerCheck = await query(
        `SELECT * FROM free_pass_applications 
         WHERE branch_id = $1 AND month_year = $2 AND status = 'awarded' AND id != $3`,
        [applicant.branch_id, applicant.month_year, id]
      );

      if (winnerCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Only 1 free pass can be awarded per branch per calendar month.'
        });
      }

      // Update applicant
      const updateRes = await query(
        `UPDATE free_pass_applications 
         SET status = 'awarded', awarded_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING *`,
        [id]
      );
      const updatedApplicant = updateRes.rows[0];

      // Mark other pending applicants for this branch and month as not_selected
      await query(
        `UPDATE free_pass_applications 
         SET status = 'not_selected' 
         WHERE branch_id = $1 AND month_year = $2 AND id != $3 AND status = 'pending'`,
        [applicant.branch_id, applicant.month_year, id]
      );

      // Branch name lookup
      const branchRes = await query(`SELECT name FROM branches WHERE id = $1`, [applicant.branch_id]);
      const branchName = branchRes.rows[0]?.name || 'KSYN Fitness';

      // Generate Single-Use Pass Code
      const passCode = `KSYN-${applicant.month_year.replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // Dispatch simulated/real email
      await sendFreePassAwardEmail(applicant.email, applicant.full_name, branchName, passCode);

      return res.json({
        success: true,
        message: `Free 1-Day Pass awarded to ${applicant.full_name}! Digital guest QR pass sent to ${applicant.email}.`,
        applicant: updatedApplicant,
        passCode
      });
    }

    // Memory Store Implementation
    if (!memoryStore.free_pass_applications) {
      memoryStore.free_pass_applications = [];
    }

    const applicant = memoryStore.free_pass_applications.find(a => a.id === id);
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant record not found.' });
    }

    // Branch Isolation check
    if (req.user.role !== 'super_admin' && applicant.branch_id !== branchId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Applicant belongs to another branch.' });
    }

    // 1-Winner-Per-Month Constraint:
    // Check if another applicant in this branch already has status = 'awarded' for the given month_year
    const existingWinner = memoryStore.free_pass_applications.find(
      a => a.branch_id === applicant.branch_id &&
           a.month_year === applicant.month_year &&
           a.status === 'awarded' &&
           a.id !== id
    );

    if (existingWinner) {
      return res.status(400).json({
        success: false,
        message: 'Only 1 free pass can be awarded per branch per calendar month.'
      });
    }

    // Update selected applicant status to 'awarded' and record awarded_at
    applicant.status = 'awarded';
    applicant.awarded_at = new Date();

    // Requirement 2: The applicants of the roster will be automatically removed once there is already a winner
    memoryStore.free_pass_applications = memoryStore.free_pass_applications.filter(a => {
      if (a.branch_id === applicant.branch_id && a.month_year === applicant.month_year && a.id !== id) {
        return false;
      }
      return true;
    });

    const branch = (memoryStore.branches || []).find(b => b.id === applicant.branch_id);
    const branchName = branch ? branch.name : 'KSYN Fitness';

    // Generate Single-Use Pass Code
    const passCode = `KSYN-${applicant.month_year.replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Dispatch simulated/real email
    await sendFreePassAwardEmail(applicant.email, applicant.full_name, branchName, passCode);

    if (typeof saveStore === 'function') {
      try { saveStore(); } catch (e) { console.error('Save store error in awardFreePass:', e.message); }
    }

    return res.json({
      success: true,
      message: `Free 1-Day Pass awarded to ${applicant.full_name}! Digital guest QR pass sent to ${applicant.email}.`,
      applicant,
      passCode
    });
  } catch (err) {
    console.error('Error in awardFreePass:', err);
    return res.status(500).json({ success: false, message: 'Failed to award free pass.' });
  }
}

/**
 * POST /api/branch-admin/free-pass/draw-winner
 * Automated, provably-unbiased cryptographic random selection of 1 winner
 * Prevents favoritism/bias by removing manual applicant selection power from branch admins
 */
async function drawWinner(req, res) {
  try {
    const rawBranchId = req.user?.branch_id || req.body.branch_id;
    if (!rawBranchId && req.user?.role !== 'super_admin') {
      return res.status(400).json({ success: false, message: 'Branch ID is required.' });
    }

    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04'
    };
    const normBranchId = branchMap[rawBranchId] || rawBranchId;
    const currentMonthYear = req.body.month || new Date().toISOString().slice(0, 7);

    // Build branch match set
    const validBranchIds = new Set();
    if (normBranchId) {
      validBranchIds.add(normBranchId);
      const matched = (memoryStore.branches || []).find(b => b.id === normBranchId || b.code === normBranchId);
      if (matched) {
        if (matched.id) validBranchIds.add(matched.id);
        if (matched.code) validBranchIds.add(matched.code);
      }
    }
    if (rawBranchId) validBranchIds.add(rawBranchId);

    if (!memoryStore.free_pass_applications) {
      memoryStore.free_pass_applications = [];
    }

    // Check if a winner has already been drawn this month for this branch
    const existingWinner = memoryStore.free_pass_applications.find(a => 
      validBranchIds.has(a.branch_id) && 
      a.month_year === currentMonthYear && 
      a.status === 'awarded'
    );

    if (existingWinner) {
      return res.status(400).json({
        success: false,
        message: `A winner has already been drawn by the system for ${currentMonthYear} (${existingWinner.full_name}). Strictly 1 free pass limit per calendar month.`
      });
    }

    // Get all eligible pending applicants for this branch and month (or pending pool)
    const eligiblePool = memoryStore.free_pass_applications.filter(a => 
      validBranchIds.has(a.branch_id) && 
      (a.month_year === currentMonthYear || a.status === 'pending') &&
      a.status === 'pending'
    );

    if (eligiblePool.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible pending applicants found in the raffle pool to draw a winner.'
      });
    }

    // Cryptographically unbiased random selection: zero bias, zero favoritism
    const randomIndex = crypto.randomInt(0, eligiblePool.length);
    const winner = eligiblePool[randomIndex];

    // Mark winner
    winner.status = 'awarded';
    winner.awarded_at = new Date().toISOString();
    winner.draw_method = 'SYSTEM_UNBIASED_RANDOM_DRAW';

    // Requirement 2: The applicants of the roster will be automatically removed once there is already a winner
    memoryStore.free_pass_applications = memoryStore.free_pass_applications.filter(a => {
      if (validBranchIds.has(a.branch_id) && a.month_year === currentMonthYear && a.id !== winner.id) {
        return false;
      }
      return true;
    });

    const branch = (memoryStore.branches || []).find(b => validBranchIds.has(b.id) || validBranchIds.has(b.code));
    const branchName = branch ? branch.name : 'KSYN Fitness';

    // Generate Single-Use Pass Code
    const passCode = `KSYN-${winner.month_year.replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    winner.pass_code = passCode;

    // Dispatch simulated/real email
    await sendFreePassAwardEmail(winner.email, winner.full_name, branchName, passCode);

    if (typeof saveStore === 'function') {
      try { saveStore(); } catch (e) { console.error('Save store error in drawWinner:', e.message); }
    }

    return res.json({
      success: true,
      message: `System unbiased raffle draw complete! Winner chosen randomly: ${winner.full_name}`,
      winner,
      passCode,
      totalPoolCount: eligiblePool.length
    });
  } catch (err) {
    console.error('Error in drawWinner:', err);
    return res.status(500).json({ success: false, message: 'Failed to run automated raffle draw.' });
  }
}

module.exports = {
  getPublicBranches,
  applyFreePass,
  getBranchApplicants,
  awardFreePass,
  drawWinner
};
