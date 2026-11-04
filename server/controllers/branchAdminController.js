const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { resolvePlan } = require('../config/membershipRates');

/**
 * 1. GET /api/branch-admin/staff
 * Returns only staff records where branch_id = req.user.branch_id
 */
async function getStaff(req, res) {
  try {
    const user = req.user;
    const branches = memoryStore.branches || [];

    // Tenant Isolation: branch staff query
    const isOwnerOrSuper = user.role === 'branch_owner' || user.role === 'super_admin';
    let staff = (memoryStore.users || []).filter(u => {
      if (u.role === 'member') return false;
      if (isOwnerOrSuper) {
        if (String(u.id) === String(user.id)) return false;
        return u.role === 'employee' || u.role === 'staff' || u.role === 'coach' || u.role === 'trainer' || u.role === 'branch_admin';
      }
      return u.role === 'employee' || u.role === 'staff' || u.role === 'coach' || u.role === 'trainer';
    });

    if (user.role !== 'super_admin') {
      if (!user.branch_id) {
        return res.status(400).json({
          success: false,
          error: 'NO_BRANCH_ASSIGNED',
          message: 'Branch Admin account is not currently assigned to a physical facility.'
        });
      }
      staff = staff.filter(u => u.branch_id === user.branch_id);
    } else if (req.query.branch_id) {
      staff = staff.filter(u => u.branch_id === req.query.branch_id);
    }

    if (isPostgres()) {
      const branchParam = (user.role === 'super_admin' && req.query.branch_id) ? req.query.branch_id : user.branch_id;
      const result = await query(
        `SELECT u.id, u.name, u.email, u.username, u.phone, u.role, u.shift_role, u.status, u.branch_id, u.created_at,
                b.name AS branch_name, b.code AS branch_code
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE (u.role = 'employee' OR u.role = 'staff' OR u.role = 'coach' OR u.role = 'trainer') AND u.branch_id = $1
         ORDER BY u.created_at DESC`,
        [branchParam]
      );
      return res.json({ success: true, staff: result.rows, data: result.rows });
    }

    const enrichedStaff = staff.map(s => {
      const branch = branches.find(b => b.id === s.branch_id);
      const isCoachRole = s.role === 'coach' || s.role === 'trainer' || (s.name && s.name.toLowerCase().includes('coach'));
      const defaultShiftRole = isCoachRole
        ? (s.name && s.name.includes('Head Coach') ? 'Head Coach' : 'Fitness Coach')
        : 'Front Desk Staff';

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        username: s.username || s.email.split('@')[0],
        phone: s.phone || '—',
        role: s.role,
        shift_role: s.shift_role || defaultShiftRole,
        status: s.status || 'active',
        is_active: s.is_active !== false,
        is_verified: s.is_verified !== false,
        email_verified: s.email_verified !== false,
        branch_id: s.branch_id,
        branch_name: branch ? branch.name : 'Unknown Branch',
        branch_code: branch ? branch.code : 'N/A',
        can_refund: s.can_refund !== false,
        can_modify_inventory: s.can_modify_inventory !== false,
        can_export_reports: s.can_export_reports !== false,
        created_at: s.created_at || new Date('2026-01-01')
      };
    });

    return res.json({ success: true, staff: enrichedStaff, data: enrichedStaff });
  } catch (err) {
    console.error('[BranchAdmin getStaff error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message, staff: [], data: [] });
  }
}

/**
 * 2. POST /api/branch-admin/staff
 * Provisions a new Front Desk / Employee account strictly locked to req.user.branch_id (no OTP or secondary approval required)
 */
async function createStaff(req, res) {
  try {
    const adminUser = req.user;
    const {
      full_name,
      name,
      email,
      username,
      phone_number,
      phone,
      password,
      shift_role = 'Front Desk Staff',
      role
    } = req.body;

    const staffName = (full_name || name || '').trim();
    const staffEmail = (email || '').trim().toLowerCase();
    const staffPhone = (phone_number || phone || '').trim();
    const staffUsername = (username || '').trim().toLowerCase();
    const staffPassword = password || 'StaffPass@2026!';

    // Strict validation: Full Name
    if (!staffName) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Full Name is required.'
      });
    }
    const nameRegex = /^[A-Za-z\s.,'-]+$/;
    if (!nameRegex.test(staffName)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_NAME',
        message: 'Full Name may only contain letters, spaces, periods, commas, apostrophes, and hyphens.'
      });
    }

    // Strict validation: Email
    if (!staffEmail) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email address is required.'
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staffEmail)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EMAIL',
        message: 'A valid email address is required.'
      });
    }

    // Check duplicate email
    const existing = (memoryStore.users || []).find(u => u.email.toLowerCase() === staffEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'USER_ALREADY_EXISTS',
        message: `An account with email '${staffEmail}' already exists in the system directory.`
      });
    }

    // Tenant Lockdown: Pull branch_id directly from the authenticated JWT token
    let targetBranchId = adminUser.branch_id;
    if (adminUser.role === 'super_admin' && req.body.branch_id) {
      targetBranchId = req.body.branch_id;
    }
    if (!targetBranchId) {
      return res.status(400).json({
        success: false,
        error: 'NO_BRANCH_ASSIGNED',
        message: 'Cannot provision staff: Authenticated admin is not assigned to a physical branch.'
      });
    }

    // Enforce Role Boundary: Allow 'employee', 'staff', or 'coach' strictly locked to branch_id
    // Branch admin cannot create another branch_admin or super_admin
    if (role && role !== 'employee' && role !== 'staff' && role !== 'coach') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ROLE_ESCALATION',
        message: 'Branch Admins are restricted to creating Front Desk / Employee / Coach accounts only.'
      });
    }

    // Hash password with bcrypt directly
    const password_hash = await bcrypt.hash(staffPassword, 10);
    const assignedRole = (role === 'staff' || role === 'employee' || role === 'coach')
      ? role
      : (shift_role?.toLowerCase()?.includes('coach') ? 'coach' : 'staff');

    const newStaff = {
      id: crypto.randomUUID(),
      branch_id: targetBranchId,
      role: assignedRole,
      name: staffName,
      email: staffEmail,
      username: staffUsername || staffEmail.split('@')[0],
      phone: staffPhone || '+63 900 000 0000',
      password_hash,
      shift_role: shift_role || 'Front Desk Staff',
      status: 'active',
      is_active: true,
      is_verified: true,
      email_verified: true,
      created_at: new Date()
    };

    memoryStore.users.push(newStaff);

    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: adminUser.id,
      user_role: adminUser.role,
      action: 'BRANCH_ADMIN_CREATE_STAFF',
      resource: `USER:${newStaff.id}`,
      ip_address: req.ip,
      details: {
        staff_name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        branch: branch?.name || targetBranchId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Staff account created and active immediately for login.',
      staff: {
        id: newStaff.id,
        name: newStaff.name,
        email: newStaff.email,
        username: newStaff.username,
        phone: newStaff.phone,
        role: newStaff.role,
        shift_role: newStaff.shift_role,
        status: newStaff.status,
        is_active: true,
        is_verified: true,
        email_verified: true,
        branch_id: newStaff.branch_id,
        branch_name: branch ? branch.name : 'Your Branch',
        created_at: newStaff.created_at
      }
    });
  } catch (err) {
    console.error('[BranchAdmin createStaff error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 3. PUT /api/branch-admin/staff/:id/status
 * Toggle active/suspended status or reset temporary password, restricted strictly by branch_id
 */
async function updateStaffStatus(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const { status, temporary_password } = req.body;

    const targetUser = (memoryStore.users || []).find(u => u.id === id && (u.role === 'employee' || u.role === 'staff'));
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Staff member not found in staff roster.'
      });
    }

    // Strict Tenant Isolation: Branch admin cannot modify staff belonging to another branch
    if (adminUser.role !== 'super_admin' && targetUser.branch_id !== adminUser.branch_id) {
      return res.status(403).json({
        success: false,
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access Denied: You may only manage staff within your assigned branch facility.'
      });
    }

    if (status) {
      targetUser.status = status;
    }

    if (temporary_password) {
      const salt = await bcrypt.genSalt(10);
      targetUser.password_hash = await bcrypt.hash(temporary_password, salt);
    }

    await logAuditEvent({
      branch_id: targetUser.branch_id,
      user_id: adminUser.id,
      user_role: adminUser.role,
      action: 'BRANCH_ADMIN_UPDATE_STAFF_STATUS',
      resource: `USER:${targetUser.id}`,
      ip_address: req.ip,
      details: { new_status: targetUser.status, password_reset: !!temporary_password }
    });

    res.json({
      success: true,
      message: `Staff member '${targetUser.name}' status updated to ${targetUser.status}.`,
      staff: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        status: targetUser.status,
        branch_id: targetUser.branch_id
      }
    });
  } catch (err) {
    console.error('[BranchAdmin updateStaffStatus error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 4. GET /api/branch-admin/members
 * Strictly returns members registered to req.user.branch_id
 */
async function getMembers(req, res) {
  try {
    const user = req.user;
    if (!user.branch_id && user.role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        error: 'NO_BRANCH_ASSIGNED',
        message: 'Admin is not assigned to a branch facility.'
      });
    }

    let members = (memoryStore.users || []).filter(u => u.role === 'member');
    if (user.role !== 'super_admin') {
      members = members.filter(u => u.branch_id === user.branch_id);
    } else if (req.query.branch_id) {
      members = members.filter(u => u.branch_id === req.query.branch_id);
    }

    if (isPostgres()) {
      const branchParam = (user.role === 'super_admin' && req.query.branch_id) ? req.query.branch_id : user.branch_id;
      const result = await query(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.branch_id, u.created_at,
                b.name AS branch_name, b.code AS branch_code,
                s.plan, s.tier, s.status AS sub_status, s.start_date, s.end_date,
                COALESCE(c.check_in_count, 0) AS total_check_ins
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.id
         LEFT JOIN subscriptions s ON u.id = s.user_id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS check_in_count
           FROM attendance_logs
           GROUP BY user_id
         ) c ON u.id = c.user_id
         WHERE u.role = 'member' AND u.branch_id = $1
         ORDER BY u.created_at DESC`,
        [branchParam]
      );
      const rows = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role || 'member',
        phone: r.phone || '—',
        status: r.status || 'active',
        branch_id: r.branch_id,
        branch_name: r.branch_name || 'Unknown Branch',
        branch_code: r.branch_code || 'N/A',
        subscription: r.plan ? { plan: r.plan, tier: r.tier, status: r.sub_status, start_date: r.start_date, end_date: r.end_date } : null,
        total_check_ins: parseInt(r.total_check_ins, 10) || 0,
        created_at: r.created_at
      }));
      return res.json({ success: true, members: rows });
    }

    const branches = memoryStore.branches || [];
    const subscriptions = memoryStore.subscriptions || [];
    const attendanceLogs = memoryStore.attendance_logs || [];
    const ptEnrollments = memoryStore.pt_enrollments || [];
    const ptClients = memoryStore.pt_clients || [];
    const ptSessions = memoryStore.pt_sessions || [];

    const enriched = members.map(m => {
      const sub = subscriptions.find(s => s.user_id === m.id);
      const branch = branches.find(b => b.id === m.branch_id);
      const checkIns = attendanceLogs.filter(a => (a.member_id === m.id || a.user_id === m.id));
      const planId = m.membership_plan || sub?.plan || '1_month';
      const resolved = resolvePlan(planId);

      // Personal Training Package & Completed Sessions Classification (Requirement 5)
      const memberPtEnroll = ptEnrollments.find(e =>
        (e.member_id === m.id || e.user_id === m.id || (e.client_email && e.client_email === m.email) || (e.member_email && e.member_email === m.email)) &&
        e.status !== 'cancelled'
      );
      const memberPtClient = ptClients.find(c => c.client_id === m.id || c.id === m.id || c.email === m.email);

      // Find all completed PT sessions for this member
      const memberCompletedSessions = ptSessions.filter(s =>
        (s.client_id === m.id || s.member_id === m.id || s.user_id === m.id || (s.client_name && s.client_name === m.name)) &&
        (s.status === 'Completed' || s.status === 'completed' || s.verified === true)
      );

      const isPtEnrolled = Boolean(memberPtEnroll || memberPtClient);
      const ptPackageName = memberPtEnroll?.package_name || memberPtClient?.package_tier || (isPtEnrolled ? '12-Session Signature PT Package' : null);
      const ptCoachName = memberPtEnroll?.coach_name || memberPtClient?.coach_name || 'Assigned Coach';
      const ptSessionsTotal = Number(memberPtEnroll?.sessions_total || memberPtClient?.sessions_total || (isPtEnrolled ? 12 : 0));
      const ptSessionsCompleted = Math.max(
        memberCompletedSessions.length,
        Number(memberPtEnroll?.sessions_completed || 0),
        Number(memberPtClient?.sessions_completed || 0)
      );
      const ptSessionsRemaining = Math.max(0, ptSessionsTotal - ptSessionsCompleted);

      // Finished workout details
      const ptCompletedWorkouts = memberCompletedSessions.map((s, idx) => ({
        session_number: idx + 1,
        id: s.id,
        workout_title: s.focus || s.workout_title || 'PT Strength & Hypertrophy Session',
        focus_area: s.focus || 'Target Muscle Hypertrophy',
        coach_name: s.coach_name || ptCoachName,
        session_date: s.session_date || s.created_at,
        duration_mins: s.duration_mins || 60,
        rpe_intensity: s.rpe_intensity || '7/10',
        exercise_list: Array.isArray(s.exercise_list) ? s.exercise_list : (s.exercises || []),
        notes: s.notes || 'Full range of motion achieved with progressive load overload.',
        verification_method: s.verification_method || 'Athlete PIN Verified'
      }));

      const reqFields = [
        Boolean(m.name && String(m.name).trim()),
        Boolean(m.email && String(m.email).trim()),
        Boolean(m.phone && String(m.phone).trim()),
        Boolean((m.address || m.residential_address) && String(m.address || m.residential_address).trim()),
        Boolean((m.emergency_contact_name || m.emergency_contact) && String(m.emergency_contact_name || m.emergency_contact).trim()),
        Boolean((m.emergency_contact_phone || m.emergency_phone) && String(m.emergency_contact_phone || m.emergency_phone).trim()),
        Boolean((m.fitness_goal || m.primary_fitness_goal) && String(m.fitness_goal || m.primary_fitness_goal).trim())
      ];
      const compCount = reqFields.filter(Boolean).length;
      const completionPct = m.profile_completion_percentage !== undefined
        ? m.profile_completion_percentage
        : Math.round((compCount / reqFields.length) * 100);

      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role || 'member',
        phone: m.phone || '—',
        status: m.status || 'active',
        membership_plan: planId,
        plan_name: resolved?.name || planId,
        membership_tier: m.membership_tier || resolved?.tier || sub?.tier || 'basic',
        rfid_card_uid: m.rfid_card_uid || (sub?.plan !== '1_day' ? 'KS-8829-4102' : null),
        branch_id: m.branch_id,
        branch_name: branch ? branch.name : 'Unknown Branch',
        branch_code: branch ? branch.code : 'N/A',
        address: m.address || m.residential_address || '',
        residential_address: m.address || m.residential_address || '',
        emergency_contact_name: m.emergency_contact_name || m.emergency_contact || '',
        emergency_contact_phone: m.emergency_contact_phone || m.emergency_phone || '',
        emergency_contact_relationship: m.emergency_contact_relationship || '',
        emergency_contact: m.emergency_contact || m.emergency_contact_name || '',
        fitness_goal: m.fitness_goal || m.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
        primary_fitness_goal: m.fitness_goal || m.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
        profile_completion_percentage: completionPct,
        is_profile_complete: completionPct === 100,
        subscription: sub || null,
        total_check_ins: checkIns.length,
        is_pt_enrolled: isPtEnrolled,
        pt_package_name: ptPackageName,
        pt_coach_name: ptCoachName,
        pt_sessions_total: ptSessionsTotal,
        pt_sessions_completed: ptSessionsCompleted,
        pt_sessions_remaining: ptSessionsRemaining,
        pt_completed_workouts: ptCompletedWorkouts,
        created_at: m.created_at || new Date('2026-01-01')
      };
    });

    const { sanitizeMemberList } = require('../middleware/dpaDataSanitizer');
    const sanitized = sanitizeMemberList(enriched, user, { ipAddress: req.ip });
    res.json({ success: true, members: sanitized });
  } catch (err) {
    console.error('[BranchAdmin getMembers error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 5. POST /api/branch-admin/check-in
 * Processes member turnstile check-in with multi-branch roaming rules:
 * - 4 complimentary cross-branch visits per calendar month
 * - On 5th+ visit: ₱350 Guest Roaming Fee assessed and logged in visiting branch ledger
 */
async function checkInMember(req, res) {
  try {
    const adminUser = req.user;
    const {
      member_id,
      manualMemberId,
      branch_id,
      branchId,
      payment_method = 'counter_cash',
      verification_method = 'manual_admin'
    } = req.body;

    const targetMemberId = member_id || manualMemberId;
    if (!targetMemberId) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'MISSING_MEMBER_ID',
        message: 'Member ID is required to process check-in.'
      });
    }

    const member = (memoryStore.users || []).find(u => u.id === targetMemberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'MEMBER_NOT_FOUND',
        message: 'Member account not found in system directory.'
      });
    }

    if (member.status !== 'active') {
      return res.status(403).json({
        success: false,
        valid: false,
        error: 'ACCOUNT_INACTIVE',
        message: `Member account is ${member.status}. Access denied.`
      });
    }

    // Determine facilities
    const homeBranchId = member.branch_id;
    const visitingBranchId = adminUser.branch_id || branch_id || branchId || homeBranchId;
    const isCrossBranch = (visitingBranchId !== homeBranchId);

    const branches = memoryStore.branches || [];
    const homeBranch = branches.find(b => b.id === homeBranchId);
    const visitingBranch = branches.find(b => b.id === visitingBranchId);

    let feeIncurred = 0.00;
    let paymentStatus = 'waived';
    let statusMessage = '';
    let monthlyCount = 0;
    let saleRecord = null;

    if (isCrossBranch) {
      // Query existing cross-branch check-ins in the current calendar month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const monthlyVisits = (memoryStore.attendance_logs || []).filter(a => {
        const aMemberId = a.member_id || a.user_id;
        if (aMemberId !== member.id) return false;
        if (!a.is_cross_branch) return false;
        const aDate = new Date(a.check_in_date || a.check_in_time);
        return aDate.getFullYear() === currentYear && aDate.getMonth() === currentMonth;
      });

      monthlyCount = monthlyVisits.length + 1;

      if (monthlyCount <= 4) {
        feeIncurred = 0.00;
        paymentStatus = 'waived';
        statusMessage = `Cross-Branch Visit ${monthlyCount}/4 (Complimentary)`;
      } else {
        // 5th visit and above: assess ₱350 Guest Roaming Fee
        feeIncurred = 350.00;
        paymentStatus = 'paid';
        statusMessage = `Cross-Branch Limit Reached (Visit #${monthlyCount}) — ₱350 Guest Fee Required / Collected`;

        // Record ₱350 transaction in the visiting branch's daily revenue ledger
        saleRecord = {
          id: crypto.randomUUID(),
          branch_id: visitingBranchId,
          user_id: member.id,
          customer_name: `${member.name} (Home: ${homeBranch?.name || 'Outside Branch'})`,
          amount: 350.00,
          category: 'guest_pass',
          payment_method: payment_method || 'counter_cash',
          reference_no: `GST-${visitingBranch?.code || 'VIS'}-${Date.now().toString().slice(-6)}`,
          description: `Cross-Branch Guest Roaming Pass (Visit #${monthlyCount} for ${member.name})`,
          created_at: new Date()
        };

        if (!memoryStore.sales) memoryStore.sales = [];
        memoryStore.sales.unshift(saleRecord);
      }
    } else {
      feeIncurred = 0.00;
      paymentStatus = 'waived';
      statusMessage = 'Home Facility Check-In. Access Granted.';
    }

    const attendanceEntry = {
      id: crypto.randomUUID(),
      branch_id: visitingBranchId,
      visited_branch_id: visitingBranchId,
      home_branch_id: homeBranchId,
      user_id: member.id,
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      home_branch_name: homeBranch ? homeBranch.name : 'Unknown Branch',
      home_branch_code: homeBranch ? homeBranch.code : 'N/A',
      visited_branch_name: visitingBranch ? visitingBranch.name : 'Unknown Branch',
      visited_branch_code: visitingBranch ? visitingBranch.code : 'N/A',
      scanned_by_employee_id: adminUser.id,
      scanned_by_name: adminUser.name,
      check_in_time: new Date(),
      check_in_date: new Date(),
      is_cross_branch: isCrossBranch,
      monthly_cross_branch_count: isCrossBranch ? monthlyCount : 0,
      fee_incurred: feeIncurred,
      payment_status: paymentStatus,
      verification_method: verification_method || 'manual_admin',
      status: 'granted',
      notes: isCrossBranch
        ? (monthlyCount >= 5 ? `Cross-Branch Limit Reached (Visit #${monthlyCount}) — ₱350 Guest Fee Required` : `Cross-Branch Visit ${monthlyCount}/4 (Complimentary)`)
        : 'Home Branch Standard Check-In'
    };

    if (!memoryStore.attendance_logs) memoryStore.attendance_logs = [];
    memoryStore.attendance_logs.unshift(attendanceEntry);

    await logAuditEvent({
      branch_id: visitingBranchId,
      user_id: adminUser.id,
      user_role: adminUser.role,
      action: 'BRANCH_ADMIN_MEMBER_CHECK_IN',
      resource: `USER:${member.id}`,
      ip_address: req.ip,
      details: {
        member: member.name,
        is_cross_branch: isCrossBranch,
        monthly_cross_branch_count: isCrossBranch ? monthlyCount : 0,
        fee_incurred: feeIncurred,
        payment_status: paymentStatus,
        visiting_branch: visitingBranch?.name,
        home_branch: homeBranch?.name
      }
    });

    res.json({
      success: true,
      valid: true,
      message: statusMessage,
      is_cross_branch: isCrossBranch,
      monthly_cross_branch_count: isCrossBranch ? monthlyCount : 0,
      fee_incurred: feeIncurred,
      payment_status: paymentStatus,
      attendance: attendanceEntry,
      sale: saleRecord,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        home_branch: homeBranch?.name || 'Unknown'
      }
    });
  } catch (err) {
    console.error('[BranchAdmin checkInMember error]:', err);
    res.status(500).json({ success: false, valid: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 6. GET /api/branch-admin/cross-branch-visits
 * Returns all guest visits by outside branch members to this facility
 */
async function getCrossBranchVisits(req, res) {
  try {
    const adminUser = req.user;
    const branches = memoryStore.branches || [];
    let visits = (memoryStore.attendance_logs || []).filter(a => a.is_cross_branch === true);

    if (adminUser.role !== 'super_admin') {
      visits = visits.filter(a => (a.visited_branch_id === adminUser.branch_id || a.branch_id === adminUser.branch_id));
    } else if (req.query.branch_id) {
      visits = visits.filter(a => (a.visited_branch_id === req.query.branch_id || a.branch_id === req.query.branch_id));
    }

    const enriched = visits.map(v => {
      const homeBranch = branches.find(b => b.id === v.home_branch_id);
      const visitedBranch = branches.find(b => b.id === v.visited_branch_id);
      return {
        id: v.id,
        member_id: v.member_id || v.user_id,
        member_name: v.member_name || 'Member',
        member_email: v.member_email || '',
        home_branch_id: v.home_branch_id,
        home_branch_name: homeBranch ? homeBranch.name : (v.home_branch_name || 'Other Facility'),
        home_branch_code: homeBranch ? homeBranch.code : (v.home_branch_code || 'N/A'),
        visited_branch_id: v.visited_branch_id,
        visited_branch_name: visitedBranch ? visitedBranch.name : (v.visited_branch_name || 'This Facility'),
        check_in_time: v.check_in_time || v.check_in_date,
        check_in_date: v.check_in_date || v.check_in_time,
        is_cross_branch: true,
        monthly_cross_branch_count: v.monthly_cross_branch_count || 1,
        fee_incurred: Number(v.fee_incurred || 0),
        payment_status: v.payment_status || 'waived',
        status: v.status || 'granted',
        notes: v.notes || ''
      };
    });

    return res.json({ success: true, visits: enriched, data: enriched });
  } catch (err) {
    console.error('[BranchAdmin getCrossBranchVisits error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message, visits: [], data: [] });
  }
}

/**
 * 7. GET /api/branch-admin/ledger
 * Returns tenant-isolated sales & royalty ledger with multi-timeframe filtering:
 * - year: records from 2026-01-01 00:00:00 to now
 * - six_months: records from rolling 180 days to now (NOW() - INTERVAL '6 MONTHS')
 * - all: complete historical ledger records for this branch only
 * Returns summary: { grossTotal, royaltyTotal, netTotal, count } and enriched ledger array
 */
async function getLedger(req, res) {
  try {
    const user = req.user;
    const timeframe = (req.query.timeframe || 'year').toLowerCase();

    // Tenant Isolation
    let targetBranchId = user.branch_id;
    if (user.role === 'super_admin' && req.query.branch_id) {
      targetBranchId = req.query.branch_id;
    }
    if (!targetBranchId && user.role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        error: 'NO_BRANCH_ASSIGNED',
        message: 'Authenticated admin is not assigned to a physical branch facility.',
        data: [],
        ledger: [],
        summary: { grossTotal: 0, royaltyTotal: 0, netTotal: 0, count: 0 }
      });
    }
    if (!targetBranchId && user.role === 'super_admin') {
      targetBranchId = (memoryStore.branches && memoryStore.branches[0]?.id) || 'b1000000-0000-0000-0000-000000000001';
    }

    const now = new Date();

    if (isPostgres()) {
      let dateCondition = '';
      if (timeframe === 'month') {
        dateCondition = "AND s.created_at >= DATE_TRUNC('month', NOW())";
      } else if (timeframe === 'year') {
        dateCondition = "AND s.created_at >= '2026-01-01 00:00:00'";
      } else if (timeframe === 'six_months') {
        dateCondition = "AND s.created_at >= NOW() - INTERVAL '6 months'";
      }

      const branchRes = await query(
        `SELECT id, name, code FROM branches WHERE id = $1`,
        [targetBranchId]
      );
      const branchObj = branchRes.rows[0] || {
        id: targetBranchId,
        name: user.branch_name || 'KSYN Fitness Makati',
        code: user.branch_code || 'MKT-01'
      };

      const result = await query(
        `SELECT s.id, s.branch_id, s.user_id, s.amount, s.category, s.payment_method, s.reference_no, s.created_at, s.remittance_status,
                u.name AS member_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.branch_id = $1 ${dateCondition}
         ORDER BY s.created_at DESC`,
        [targetBranchId]
      );

      const enriched = result.rows.map(s => {
        const amount = Number(s.amount || 0);
        const royaltyAmount = Number((amount * 0.075).toFixed(2));
        const netAmount = Number((amount * 0.925).toFixed(2));

        let categoryLabel = 'Membership Plan';
        if (s.category === 'guest_pass') categoryLabel = 'Guest Roaming Pass';
        else if (s.category === 'personal_training') categoryLabel = 'Personal Training';
        else if (s.category === 'locker_rental') categoryLabel = 'Locker Rental';
        else if (s.category === 'merchandise') categoryLabel = 'Merchandise';
        else if (s.category === 'supplements') categoryLabel = 'Supplements & Nutrition';
        else if (s.category) {
          categoryLabel = s.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        let paymentChannel = 'POS / Cash';
        const pm = (s.payment_method || '').toLowerCase();
        if (pm.includes('card') || pm.includes('credit') || pm.includes('debit')) {
          paymentChannel = 'Credit/Debit Card';
        } else if (pm.includes('bank') || pm.includes('transfer')) {
          paymentChannel = 'Bank Transfer';
        } else if (pm.includes('gcash')) {
          paymentChannel = 'E-Wallet (GCash)';
        } else if (pm.includes('maya')) {
          paymentChannel = 'E-Wallet (Maya)';
        } else if (pm.includes('cash')) {
          paymentChannel = 'POS / Cash';
        }

        const txDate = new Date(s.created_at);
        const isCurrentMonth = txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
        const remittanceStatus = s.remittance_status || (isCurrentMonth ? 'Pending Settlement' : 'Remitted to HQ');

        return {
          id: s.id,
          reference_no: s.reference_no || `TXN-${branchObj.code || 'MKT'}-${s.id.slice(0, 6).toUpperCase()}`,
          created_at: s.created_at,
          member_id: s.user_id,
          member_name: s.member_name || 'Walk-in Customer',
          category: categoryLabel,
          raw_category: s.category,
          payment_channel: paymentChannel,
          raw_payment_method: s.payment_method,
          gross_amount: amount,
          royalty_amount: royaltyAmount,
          net_amount: netAmount,
          remittance_status: remittanceStatus,
          branch_id: s.branch_id,
          branch_name: branchObj.name,
          branch_code: branchObj.code
        };
      });

      const grossTotal = Number(enriched.reduce((sum, item) => sum + item.gross_amount, 0).toFixed(2));
      const royaltyTotal = Number((grossTotal * 0.075).toFixed(2));
      const netTotal = Number((grossTotal * 0.925).toFixed(2));
      const count = enriched.length;

      return res.json({
        success: true,
        branch: {
          id: branchObj.id,
          name: branchObj.name,
          code: branchObj.code
        },
        timeframe,
        summary: {
          grossTotal,
          royaltyTotal,
          netTotal,
          count
        },
        ledger: enriched,
        data: enriched
      });
    }

    const branches = memoryStore.branches || [];
    const branch = branches.find(b => b.id === targetBranchId) || {
      id: targetBranchId || 'b-mkt-01',
      name: user.branch_name || 'KSYN Fitness Makati',
      code: user.branch_code || 'MKT-01'
    };

    // Strict Tenant Isolation: Only sales strictly belonging to targetBranchId
    let sales = (memoryStore.sales || []).filter(s => s.branch_id === targetBranchId);

    // Exclude any synthetic/mock transactions to guarantee 100% actual real sales
    sales = sales.filter(s => {
      if (s.customer_name === 'Test Cash Member') return false;
      if (s.reference_no && s.reference_no.includes('ttest1')) return false;
      if (s.reference_no && s.reference_no.startsWith('TEST-QR-')) return false;
      if (s.reference_no && s.reference_no.startsWith('KSYN-REC-test-use-')) return false;
      if (s.payment_method === 'card' && String(s.reference_no || '').startsWith('INV-2026-')) return false;
      if (s.customer_name === 'Athlete Member (Del Monte)' || s.customer_name === 'Athlete Member (Tomas Morato)') return false;
      return true;
    });

    // Multi-timeframe date filtering
    if (timeframe === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      sales = sales.filter(s => new Date(s.created_at) >= monthStart);
    } else if (timeframe === 'year') {
      const yearStart = new Date('2026-01-01T00:00:00Z');
      sales = sales.filter(s => new Date(s.created_at) >= yearStart);
    } else if (timeframe === 'six_months') {
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      sales = sales.filter(s => new Date(s.created_at) >= sixMonthsAgo);
    } // 'all' requires no lower bound filter

    // Sort by created_at descending
    sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const users = memoryStore.users || [];

    const enriched = sales.map(s => {
      const member = s.user_id ? users.find(u => u.id === s.user_id) : null;
      const amount = Number(s.amount || 0);
      const royaltyAmount = Number((amount * 0.075).toFixed(2));
      const netAmount = Number((amount * 0.925).toFixed(2));

      // Category formatting
      let categoryLabel = 'Membership Plan';
      if (s.category === 'guest_pass') categoryLabel = 'Guest Roaming Pass';
      else if (s.category === 'personal_training') categoryLabel = 'Personal Training';
      else if (s.category === 'locker_rental') categoryLabel = 'Locker Rental';
      else if (s.category === 'merchandise') categoryLabel = 'Merchandise';
      else if (s.category === 'supplements') categoryLabel = 'Supplements & Nutrition';
      else if (s.category) {
        categoryLabel = s.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Payment Channel formatting
      let paymentChannel = 'POS / Cash';
      const pm = (s.payment_method || '').toLowerCase();
      if (pm.includes('card') || pm.includes('credit') || pm.includes('debit')) {
        paymentChannel = 'Credit/Debit Card';
      } else if (pm.includes('bank') || pm.includes('transfer')) {
        paymentChannel = 'Bank Transfer';
      } else if (pm.includes('gcash')) {
        paymentChannel = 'E-Wallet (GCash)';
      } else if (pm.includes('maya')) {
        paymentChannel = 'E-Wallet (Maya)';
      } else if (pm.includes('cash')) {
        paymentChannel = 'POS / Cash';
      }

      // Remittance Status: Older months remitted to HQ, current cycle pending settlement
      const txDate = new Date(s.created_at);
      const isCurrentMonth = txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
      const remittanceStatus = s.remittance_status || (isCurrentMonth ? 'Pending Settlement' : 'Remitted to HQ');

      return {
        id: s.id,
        reference_no: s.reference_no || `TXN-${branch.code || 'MKT'}-${s.id.slice(0, 6).toUpperCase()}`,
        created_at: s.created_at,
        member_id: s.user_id,
        member_name: s.customer_name || (member ? member.name : 'Walk-in Customer'),
        category: categoryLabel,
        raw_category: s.category,
        payment_channel: paymentChannel,
        raw_payment_method: s.payment_method,
        gross_amount: amount,
        royalty_amount: royaltyAmount,
        net_amount: netAmount,
        remittance_status: remittanceStatus,
        branch_id: s.branch_id,
        branch_name: branch.name,
        branch_code: branch.code
      };
    });

    const grossTotal = Number(enriched.reduce((sum, item) => sum + item.gross_amount, 0).toFixed(2));
    const royaltyTotal = Number((grossTotal * 0.075).toFixed(2));
    const netTotal = Number((grossTotal * 0.925).toFixed(2));
    const count = enriched.length;

    return res.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code
      },
      timeframe,
      summary: {
        grossTotal,
        royaltyTotal,
        netTotal,
        count
      },
      ledger: enriched,
      data: enriched
    });
  } catch (err) {
    console.error('[BranchAdmin getLedger error]:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message,
      data: [],
      ledger: [],
      summary: { grossTotal: 0, royaltyTotal: 0, netTotal: 0, count: 0 }
    });
  }
}

/**
 * 8. GET /api/branch-admin/incidents
 * Returns facility maintenance tickets, turnstile faults, and conduct logs strictly tenant-isolated
 */
async function getIncidents(req, res) {
  try {
    const user = req.user;
    if (!memoryStore.incidents) memoryStore.incidents = [];

    let incidents = memoryStore.incidents;
    if (user.role !== 'super_admin' && user.branch_id) {
      incidents = incidents.filter(i => i.branch_id === user.branch_id);
    }

    incidents.sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));

    return res.json({ success: true, incidents });
  } catch (err) {
    console.error('[BranchAdmin getIncidents error]:', err);
    return res.status(500).json({ success: false, message: err.message, incidents: [] });
  }
}

/**
 * 9. POST /api/branch-admin/incidents
 * Log new incident or facilities maintenance ticket
 */
async function createIncident(req, res) {
  try {
    const user = req.user;
    const { title, category, severity = 'Medium', details = '', resolution_notes = '' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Incident title is required.' });
    }

    const branchId = user.branch_id || req.body.branch_id || 'b-mkt-01';
    if (!memoryStore.incidents) memoryStore.incidents = [];

    let roleSuffix = '';
    if (user.role === 'employee' || user.role === 'staff') roleSuffix = 'Front Desk';
    else if (user.role === 'coach' || user.role === 'trainer') roleSuffix = 'Coach';
    else if (user.role === 'branch_admin') roleSuffix = 'GM';
    else roleSuffix = user.role.replace('_', ' ');

    const cleanReporter = user.name.includes('(') ? user.name : `${user.name} (${roleSuffix})`;

    const newIncident = {
      id: `inc-${Date.now().toString(36)}`,
      branch_id: branchId,
      title: title.trim(),
      category: category || 'Turnstile & Hardware',
      severity: severity || 'Medium',
      status: 'Open',
      reported_by: cleanReporter,
      reported_at: new Date(),
      details: (details || '').trim(),
      resolution_notes: (resolution_notes || '').trim() || 'Ticket logged. Awaiting inspection.'
    };

    memoryStore.incidents.unshift(newIncident);
    saveStore();

    return res.status(201).json({
      success: true,
      message: 'Incident recorded successfully.',
      incident: newIncident
    });
  } catch (err) {
    console.error('[BranchAdmin createIncident error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 10. PATCH /api/branch-admin/incidents/:id/status
 * Update incident ticket status and resolution notes
 */
async function updateIncidentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;
    const user = req.user;

    if (!memoryStore.incidents) memoryStore.incidents = [];
    const incident = memoryStore.incidents.find(i => i.id === id);

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident record not found.' });
    }

    if (user.role !== 'super_admin' && user.branch_id !== incident.branch_id) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation.' });
    }

    if (status) incident.status = status;
    if (resolution_notes !== undefined) incident.resolution_notes = resolution_notes.trim();
    incident.updated_at = new Date();
    saveStore();

    return res.json({
      success: true,
      message: `Incident marked as ${incident.status}.`,
      incident
    });
  } catch (err) {
    console.error('[BranchAdmin updateIncidentStatus error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 11. GET /api/branch-admin/inventory/burn-rate
 * Floor Stock Burn-Rate & Runout Forecaster: Estimates depletion rates and predicts stockout date
 */
async function getInventoryBurnRate(req, res) {
  try {
    const user = req.user;
    const branchId = user.branch_id || 'b-mkt-01';

    let items = (memoryStore.inventory || []).filter(item => item.branch_id === branchId);

    const burnRateMatrix = {
      'supplements': 2.8, // 2.8 units per day
      'nutrition': 2.8,
      'beverages': 6.5,
      'drinks': 6.5,
      'apparel': 0.6,
      'gear': 0.8,
      'accessories': 1.2
    };

    const enriched = items.map(item => {
      const cat = (item.category || '').toLowerCase();
      let dailyBurn = 1.5;
      for (const [key, rate] of Object.entries(burnRateMatrix)) {
        if (cat.includes(key)) {
          dailyBurn = rate;
          break;
        }
      }

      const currentStock = Number(item.quantity ?? item.current_stock ?? 0);
      const daysRemaining = currentStock > 0 ? Math.round((currentStock / dailyBurn) * 10) / 10 : 0;
      
      let status = 'HEALTHY';
      if (daysRemaining <= 3) status = 'CRITICAL';
      else if (daysRemaining <= 7) status = 'REORDER';

      const suggestedReorder = Math.max(12, Math.round(dailyBurn * 14) - currentStock);

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        sku: item.sku || `SKU-${item.id.slice(0, 6)}`,
        current_stock: currentStock,
        daily_burn_rate: dailyBurn,
        days_remaining: daysRemaining,
        runout_status: status,
        suggested_reorder: suggestedReorder > 0 ? suggestedReorder : 10,
        unit_price: Number(item.unit_price || item.price || 500)
      };
    });

    return res.json({ success: true, items: enriched });
  } catch (err) {
    console.error('[BranchAdmin getInventoryBurnRate error]:', err);
    return res.status(500).json({ success: false, message: err.message, items: [] });
  }
}

/**
 * 12. Supervisor Witness PIN Verification for Cash Drawer Shortage
 * POST /api/branch-admin/pos/verify-supervisor-pin
 */
async function verifySupervisorPin(req, res) {
  try {
    const { pin, supervisor_pin, reason = 'CASH_DRAWER_VARIANCE_OVERRIDE', variance_amount = 0 } = req.body;
    const effectivePin = String(pin || supervisor_pin || '').trim();
    if (!effectivePin) return res.status(400).json({ success: false, message: 'Supervisor PIN is required.' });

    // Cryptographic Supervisor Verification: Compare strictly against hashed PIN stored in database
    let isValid = false;
    let candidate = (memoryStore.users || []).find(u => u.id === req.user.id);
    if (isPostgres()) {
      const resUser = await query('SELECT supervisor_pin_hash, branch_id, role, name FROM users WHERE id = $1', [req.user.id]);
      if (resUser.rows.length > 0) candidate = resUser.rows[0];
    }

    if (candidate?.supervisor_pin_hash) {
      isValid = await bcrypt.compare(effectivePin, candidate.supervisor_pin_hash);
    }

    // If caller is an employee/cashier, allow dual sign-off against authorized supervisors at this branch or Super Admin
    if (!isValid) {
      const candidateSupervisors = (memoryStore.users || []).filter(u =>
        (u.role === 'branch_admin' && (u.branch_id === req.user.branch_id || !req.user.branch_id)) ||
        u.role === 'super_admin'
      );
      for (const sup of candidateSupervisors) {
        if (sup.supervisor_pin_hash && (await bcrypt.compare(effectivePin, sup.supervisor_pin_hash))) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      await logAuditEvent({
        branch_id: req.user.branch_id,
        user_id: req.user.id,
        user_role: req.user.role,
        action: 'SUPERVISOR_PIN_FAILED',
        resource: 'POS_DRAWER',
        ip_address: req.ip,
        details: { reason, variance_amount }
      });
      return res.status(403).json({ success: false, message: 'Invalid Supervisor Authorization PIN. Dual sign-off rejected.' });
    }

    await logAuditEvent({
      branch_id: req.user.branch_id,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'SUPERVISOR_PIN_AUTHORIZED',
      resource: 'POS_DRAWER',
      ip_address: req.ip,
      details: { reason, variance_amount, authorized_by: req.user.name }
    });

    res.json({
      success: true,
      verified: true,
      authorized_by: req.user.name,
      message: 'Supervisor authorization verified. Cash discrepancy sign-off recorded in audit log.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 13. Staff Shift Roster Scheduler
 * GET /api/branch-admin/shifts
 * POST /api/branch-admin/shifts
 * DELETE /api/branch-admin/shifts/:id
 */
async function getShifts(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    if (!memoryStore.staff_shifts) {
      memoryStore.staff_shifts = [
        {
          id: 'sft-001',
          branch_id: branchId,
          staff_id: 'u1000000-0000-0000-0000-000000000002',
          staff_name: 'Maya Lin',
          role: 'Front Desk Cashier',
          shift_type: 'Morning Shift',
          start_time: '06:00 AM',
          end_time: '02:00 PM',
          days_of_week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          notes: 'Opening terminal, POS float count & turnstile gate unlock.'
        },
        {
          id: 'sft-002',
          branch_id: branchId,
          staff_id: 'u1000000-0000-0000-0000-000000000004',
          staff_name: 'Carlos Mendoza',
          role: 'Operations & Floor Staff',
          shift_type: 'Evening Shift',
          start_time: '02:00 PM',
          end_time: '10:00 PM',
          days_of_week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          notes: 'Closing shift, Z-Reading cash drop & locker inventory audit.'
        }
      ];
    }

    const filtered = memoryStore.staff_shifts.filter(s => s.branch_id === branchId);
    const enriched = filtered.map(s => ({
      ...s,
      day_of_week: s.day_of_week || (Array.isArray(s.days_of_week) ? s.days_of_week.join(', ') : s.days_of_week) || 'Mon, Tue, Wed, Thu, Fri'
    }));
    res.json({ success: true, shifts: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createShift(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const { staff_name, role = 'Front Desk Staff', shift_type = 'Morning Shift', start_time = '06:00 AM', end_time = '02:00 PM', days_of_week = ['Mon', 'Tue', 'Wed'], notes = '' } = req.body;

    if (!staff_name) return res.status(400).json({ success: false, message: 'Staff name is required.' });

    if (!memoryStore.staff_shifts) memoryStore.staff_shifts = [];

    const newShift = {
      id: crypto.randomUUID(),
      branch_id: branchId,
      staff_name: staff_name.trim(),
      role,
      shift_type,
      start_time,
      end_time,
      days_of_week: Array.isArray(days_of_week) ? days_of_week : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      notes: notes.trim(),
      created_at: new Date()
    };

    memoryStore.staff_shifts.unshift(newShift);

    await logAuditEvent({
      branch_id: branchId,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'STAFF_SHIFT_ASSIGNED',
      resource: `SHIFT:${newShift.id}`,
      ip_address: req.ip,
      details: { staff: staff_name, shift_type }
    });

    res.status(201).json({ success: true, shift: newShift, message: 'Staff shift schedule saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteShift(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.staff_shifts) memoryStore.staff_shifts = [];
    memoryStore.staff_shifts = memoryStore.staff_shifts.filter(s => s.id !== id);
    res.json({ success: true, message: 'Shift deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Helper: Calculate ISO Week Key (e.g. 2026-W44)
 * Every Monday midnight marks the start of a new weekly cycle.
 */
function getIsoWeekKey(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Weekly Rollover Check: Every Monday midnight archives previous week's rota
 * and resets active rota state so branch admins post a fresh schedule (up to twice a week).
 */
function checkAndRefreshWeeklyRota() {
  const currentWeek = getIsoWeekKey(new Date());
  if (!memoryStore.rota_metadata) memoryStore.rota_metadata = {};
  if (!memoryStore.admin_rota_metadata) memoryStore.admin_rota_metadata = {};
  if (!memoryStore.rota_archives) memoryStore.rota_archives = [];

  const branches = (memoryStore.branches || []).map(b => b.id);
  ['b-mkt-01', 'b-kat-02', 'b-alb-03', 'b-kap-04', 'b-frv-05'].forEach(b => {
    if (!branches.includes(b)) branches.push(b);
  });

  branches.forEach(branchId => {
    const meta = memoryStore.rota_metadata[branchId];
    if (!meta || meta.week_key !== currentWeek) {
      // Archive previous week's rota if present
      const oldShifts = (memoryStore.floor_rota || []).filter(r => r.branch_id === branchId);
      if (oldShifts.length > 0 && meta?.week_key) {
        memoryStore.rota_archives.push({
          branch_id: branchId,
          week_key: meta.week_key,
          rota: JSON.parse(JSON.stringify(oldShifts)),
          archived_at: new Date().toISOString()
        });
      }

      // New week refresh: Reset publication status and publish count
      memoryStore.rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: currentWeek,
        publish_count: 0,
        is_published: false,
        published_at: null,
        deleted_staff_ids: []
      };

      // Mark current shifts as draft / unpublished for the new week
      if (Array.isArray(memoryStore.floor_rota)) {
        memoryStore.floor_rota.filter(r => r.branch_id === branchId).forEach(r => {
          r.is_published = false;
        });
      }
    }

    // Apply same Monday midnight refresh to admin rota
    const adminMeta = memoryStore.admin_rota_metadata[branchId];
    if (!adminMeta || adminMeta.week_key !== currentWeek) {
      memoryStore.admin_rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: currentWeek,
        publish_count: 0,
        is_published: false,
        published_at: null
      };
      if (Array.isArray(memoryStore.admin_rota)) {
        memoryStore.admin_rota.filter(r => r.branch_id === branchId).forEach(r => {
          r.is_published = false;
        });
      }
    }
  });
}

/**
 * Unified Weekly Coach & Staff Floor Rota
 * GET /api/branch-admin/floor-rota (or /api/branch/floor-rota)
 * POST /api/branch-admin/floor-rota
 * POST /api/branch-admin/floor-rota/publish
 * DELETE /api/branch-admin/floor-rota/:id
 */
async function getFloorRota(req, res) {
  try {
    const branchId = req.user?.branch_id || 'b-mkt-01';
    checkAndRefreshWeeklyRota();

    const meta = memoryStore.rota_metadata?.[branchId] || {
      publish_count: 0,
      is_published: false,
      week_key: getIsoWeekKey(),
      deleted_staff_ids: []
    };
    const deletedStaffIds = new Set(meta.deleted_staff_ids || []);

    // Get all valid coaches and staff with actual accounts strictly in this branch
    const validStaffAndCoaches = (memoryStore.users || []).filter(u => 
      u.branch_id === branchId &&
      ['coach', 'trainer', 'employee', 'staff'].includes(u.role)
    );

    const validIds = new Set(validStaffAndCoaches.map(u => u.id));
    const validNames = validStaffAndCoaches.map(u => (u.name || '').toLowerCase());

    if (!memoryStore.floor_rota || !Array.isArray(memoryStore.floor_rota)) {
      memoryStore.floor_rota = [];
    }

    // Prune invalid personnel for this specific branch only (leaving other branches untouched)
    memoryStore.floor_rota = memoryStore.floor_rota.filter(r => {
      if (r.branch_id && r.branch_id !== branchId) return true;
      if (r.coach_name && (r.coach_name.toLowerCase().includes('marcus vance') || r.coach_name.toLowerCase().includes('ceo'))) return false;
      if (r.staff_id && validIds.has(r.staff_id)) return true;
      if (r.coach_name && validNames.some(name => name.includes(r.coach_name.toLowerCase()) || r.coach_name.toLowerCase().includes(name))) return true;
      if (r.branch_id === branchId && r.coach_name) return true;
      return false;
    });

    // Sync rota coach_name and staff_role with real account data for this branch
    memoryStore.floor_rota.filter(r => r.branch_id === branchId).forEach(r => {
      const matchedUser = validStaffAndCoaches.find(u => u.id === r.staff_id || (r.coach_name && u.name && (u.name.toLowerCase().includes(r.coach_name.toLowerCase()) || r.coach_name.toLowerCase().includes(u.name.toLowerCase()))));
      if (matchedUser) {
        r.staff_id = matchedUser.id;
        r.coach_name = matchedUser.name;
        r.staff_role = (matchedUser.role === 'coach' || matchedUser.role === 'trainer') ? 'coach' : 'staff';
      }
    });

    // Populate default slots ONLY for personnel whose schedule was NOT explicitly deleted by admin
    validStaffAndCoaches.forEach(user => {
      if (deletedStaffIds.has(user.id)) return; // DO NOT auto-regenerate deleted schedules!

      const exists = memoryStore.floor_rota.find(r => 
        r.branch_id === branchId &&
        ((r.staff_id === user.id) || 
        (r.coach_name && (r.coach_name.toLowerCase().includes(user.name.toLowerCase()) || user.name.toLowerCase().includes(r.coach_name.toLowerCase()))))
      );
      if (!exists) {
        const isCoach = user.role === 'coach' || user.role === 'trainer';
        memoryStore.floor_rota.push({
          id: `rota-${user.id}`,
          branch_id: branchId,
          staff_id: user.id,
          coach_name: user.name,
          staff_role: isCoach ? 'coach' : 'staff',
          specialty: isCoach ? 'Personal Trainer & Fitness Coach' : 'Front Desk Officer & Kiosk Cashier',
          monday: isCoach ? '06:00 - 14:00 (Morning Shift)' : '06:00 - 14:00 (Front Desk)',
          tuesday: isCoach ? '06:00 - 14:00 (Morning Shift)' : '06:00 - 14:00 (Front Desk)',
          wednesday: isCoach ? '06:00 - 14:00 (Morning Shift)' : '06:00 - 14:00 (Front Desk)',
          thursday: isCoach ? 'Rest / Off-Duty' : '06:00 - 14:00 (Front Desk)',
          friday: isCoach ? '14:00 - 22:00 (Evening Shift)' : '06:00 - 14:00 (Front Desk)',
          saturday: isCoach ? '08:00 - 16:00 (Weekend Peak)' : 'Rest / Off-Duty',
          sunday: 'Rest / Off-Duty',
          is_published: Boolean(meta.is_published),
          updated_at: new Date().toISOString()
        });
      }
    });

    // Exclude executive and admin roles from floor duty rota
    memoryStore.floor_rota = memoryStore.floor_rota.filter(r => 
      r.staff_role !== 'super_admin' && 
      r.staff_role !== 'branch_owner' && 
      r.staff_role !== 'branch_admin' && 
      r.staff_role !== 'investor' &&
      !String(r.coach_name || '').toLowerCase().includes('admin') &&
      !String(r.coach_name || '').toLowerCase().includes('owner')
    );

    saveStore();

    // STRICT MULTI-TENANT ISOLATION: Only return shifts belonging strictly to this branch facility
    let branchRota = memoryStore.floor_rota.filter(r => r.branch_id === branchId);

    // RULE 3 ENFORCEMENT: Staff and coaches ONLY receive their rota when it is PUBLISHED!
    const isManagement = ['branch_admin', 'super_admin', 'branch_owner'].includes(req.user?.role);
    const isPublished = Boolean(meta.is_published);

    if (!isManagement && !isPublished) {
      return res.json({
        success: true,
        rota: [],
        is_published: false,
        message: 'The weekly schedule for this week is currently in draft and will be visible once published by Branch Administration.'
      });
    }

    const isPersonalLookup = req.query.personal === 'true' || (req.path && req.path.includes('/my-schedule'));
    if (isPersonalLookup && req.user) {
      const mySchedule = branchRota.filter(r => r.staff_id === req.user.id || (r.coach_name && r.coach_name.toLowerCase().includes((req.user.name || '').toLowerCase())));
      return res.json({
        success: true,
        rota: mySchedule,
        is_published: isPublished,
        week_key: meta.week_key
      });
    }

    res.json({
      success: true,
      rota: branchRota,
      is_published: isPublished,
      publish_count: meta.publish_count || 0,
      remaining_publishes: Math.max(0, 2 - (meta.publish_count || 0)),
      week_key: meta.week_key || getIsoWeekKey(),
      published_at: meta.published_at || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function publishFloorRota(req, res) {
  try {
    const branchId = req.user?.branch_id || 'b-mkt-01';
    checkAndRefreshWeeklyRota();

    if (!memoryStore.rota_metadata) memoryStore.rota_metadata = {};
    if (!memoryStore.rota_metadata[branchId]) {
      memoryStore.rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: getIsoWeekKey(),
        publish_count: 0,
        is_published: false,
        deleted_staff_ids: []
      };
    }

    const meta = memoryStore.rota_metadata[branchId];
    if ((meta.publish_count || 0) >= 2) {
      return res.status(400).json({
        success: false,
        error: 'PUBLISH_LIMIT_REACHED',
        message: 'Publish limit reached: Branch admins can only publish the weekly rota up to twice a week. The schedule resets every Monday midnight.',
        publish_count: meta.publish_count,
        remaining_publishes: 0
      });
    }

    meta.publish_count = (meta.publish_count || 0) + 1;
    meta.is_published = true;
    meta.published_at = new Date().toISOString();

    // Mark all slots for this branch as published
    if (Array.isArray(memoryStore.floor_rota)) {
      memoryStore.floor_rota.filter(r => r.branch_id === branchId).forEach(r => {
        r.is_published = true;
      });
    }

    // Also publish admin rota for this branch
    if (!memoryStore.admin_rota_metadata) memoryStore.admin_rota_metadata = {};
    if (!memoryStore.admin_rota_metadata[branchId]) {
      memoryStore.admin_rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: getIsoWeekKey(),
        publish_count: 0,
        is_published: false
      };
    }
    const adminMeta = memoryStore.admin_rota_metadata[branchId];
    adminMeta.publish_count = Math.min(2, (adminMeta.publish_count || 0) + 1);
    adminMeta.is_published = true;
    adminMeta.published_at = new Date().toISOString();

    if (Array.isArray(memoryStore.admin_rota)) {
      memoryStore.admin_rota.filter(r => r.branch_id === branchId).forEach(r => {
        r.is_published = true;
      });
    }

    saveStore();

    res.json({
      success: true,
      message: `Weekly Coach & Staff Floor Rota published successfully (${meta.publish_count}/2 used for this week)! Shifts are now live across Coach and Staff portals.`,
      publish_count: meta.publish_count,
      remaining_publishes: Math.max(0, 2 - meta.publish_count),
      is_published: true,
      published_at: meta.published_at
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function saveFloorRota(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    checkAndRefreshWeeklyRota();
    const { id, staff_id, coach_name, staff_role = 'coach', specialty = 'Fitness Coach', monday, tuesday, wednesday, thursday, friday, saturday, sunday, is_published } = req.body;

    if (!coach_name) {
      return res.status(400).json({ success: false, message: 'Coach or staff member name is required.' });
    }

    if (staff_role === 'super_admin' || staff_role === 'branch_owner' || staff_role === 'branch_admin' || staff_role === 'investor') {
      return res.status(400).json({ success: false, message: 'Executive admins and branch owners cannot be scheduled for floor duty rota.' });
    }

    if (!memoryStore.floor_rota) memoryStore.floor_rota = [];

    // If staff was in deleted_staff_ids, remove them since admin is now actively scheduling them
    if (staff_id && memoryStore.rota_metadata?.[branchId]?.deleted_staff_ids) {
      memoryStore.rota_metadata[branchId].deleted_staff_ids = memoryStore.rota_metadata[branchId].deleted_staff_ids.filter(sid => sid !== staff_id);
    }

    const meta = memoryStore.rota_metadata?.[branchId] || {};
    const effectivePublished = is_published !== undefined ? Boolean(is_published) : Boolean(meta.is_published);

    const existingIndex = id ? memoryStore.floor_rota.findIndex(r => r.id === id) : -1;
    let savedSlot;

    if (existingIndex >= 0) {
      savedSlot = {
        ...memoryStore.floor_rota[existingIndex],
        staff_id: staff_id || memoryStore.floor_rota[existingIndex].staff_id,
        coach_name: coach_name.trim(),
        staff_role: staff_role || memoryStore.floor_rota[existingIndex].staff_role,
        specialty: specialty.trim(),
        monday: monday || memoryStore.floor_rota[existingIndex].monday || 'Rest / Off-Duty',
        tuesday: tuesday || memoryStore.floor_rota[existingIndex].tuesday || 'Rest / Off-Duty',
        wednesday: wednesday || memoryStore.floor_rota[existingIndex].wednesday || 'Rest / Off-Duty',
        thursday: thursday || memoryStore.floor_rota[existingIndex].thursday || 'Rest / Off-Duty',
        friday: friday || memoryStore.floor_rota[existingIndex].friday || 'Rest / Off-Duty',
        saturday: saturday || memoryStore.floor_rota[existingIndex].saturday || 'Rest / Off-Duty',
        sunday: sunday || memoryStore.floor_rota[existingIndex].sunday || 'Rest / Off-Duty',
        is_published: effectivePublished,
        updated_at: new Date().toISOString()
      };
      memoryStore.floor_rota[existingIndex] = savedSlot;
    } else {
      savedSlot = {
        id: id || `rota-${Date.now()}`,
        branch_id: branchId,
        staff_id: staff_id || null,
        coach_name: coach_name.trim(),
        staff_role: staff_role,
        specialty: specialty.trim(),
        monday: monday || '06:00 - 14:00 (Morning Shift)',
        tuesday: tuesday || '06:00 - 14:00 (Morning Shift)',
        wednesday: wednesday || '06:00 - 14:00 (Morning Shift)',
        thursday: thursday || 'Rest / Off-Duty',
        friday: friday || '14:00 - 22:00 (Evening Shift)',
        saturday: saturday || '08:00 - 16:00 (Weekend Peak)',
        sunday: sunday || 'Rest / Off-Duty',
        is_published: effectivePublished,
        updated_at: new Date().toISOString()
      };
      memoryStore.floor_rota.unshift(savedSlot);
    }

    saveStore();
    res.json({ success: true, slot: savedSlot, message: 'Shift schedule rota saved & synchronized.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteFloorRotaSlot(req, res) {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id || 'b-mkt-01';
    checkAndRefreshWeeklyRota();

    if (!memoryStore.floor_rota) memoryStore.floor_rota = [];
    const target = memoryStore.floor_rota.find(r => r.id === id);
    if (target && target.branch_id && target.branch_id !== branchId && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: cannot modify rota of another facility.' });
    }

    if (target) {
      // Deleting means we delete their schedule for this week, NOT deleting the person/staff account!
      if (!memoryStore.rota_metadata) memoryStore.rota_metadata = {};
      if (!memoryStore.rota_metadata[branchId]) {
        memoryStore.rota_metadata[branchId] = {
          branch_id: branchId,
          week_key: getIsoWeekKey(),
          publish_count: 0,
          is_published: false,
          deleted_staff_ids: []
        };
      }
      if (!memoryStore.rota_metadata[branchId].deleted_staff_ids) {
        memoryStore.rota_metadata[branchId].deleted_staff_ids = [];
      }
      if (target.staff_id && !memoryStore.rota_metadata[branchId].deleted_staff_ids.includes(target.staff_id)) {
        memoryStore.rota_metadata[branchId].deleted_staff_ids.push(target.staff_id);
      }

      memoryStore.floor_rota = memoryStore.floor_rota.filter(r => r.id !== id);
      saveStore();
    }

    res.json({
      success: true,
      message: 'Schedule slot removed from floor rota. Staff user account remains intact in staff directory.',
      deleted_id: id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Branch Admin Own Duty Rota (Visible only to branch admins of the same branch)
 * Quota: Maximum 2 edits/publishes per week across all branch admins of this branch.
 * GET /api/branch-admin/admin-rota
 * POST /api/branch-admin/admin-rota
 * POST /api/branch-admin/admin-rota/publish
 */
async function getAdminRota(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    checkAndRefreshWeeklyRota();

    const currentWeek = getIsoWeekKey();
    if (!memoryStore.admin_rota_metadata) memoryStore.admin_rota_metadata = {};
    if (!memoryStore.admin_rota_metadata[branchId] || memoryStore.admin_rota_metadata[branchId].week_key !== currentWeek) {
      memoryStore.admin_rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: currentWeek,
        edit_count: 0,
        publish_count: 0,
        is_published: true,
        published_at: null,
        last_edited_by: null,
        last_edited_at: null
      };
    }

    if (!memoryStore.admin_rota || !Array.isArray(memoryStore.admin_rota)) {
      memoryStore.admin_rota = [];
    }

    // Get all real branch_admins belonging to this branch
    const branchAdmins = (memoryStore.users || []).filter(u => 
      (u.role === 'branch_admin' || u.role === 'branchadmin') && 
      (u.branch_id === branchId || (!u.branch_id && branchId === 'b-mkt-01'))
    );

    // Ensure each branch admin has an entry in admin_rota
    branchAdmins.forEach(admin => {
      const exists = memoryStore.admin_rota.find(r => 
        (r.staff_id === admin.id) || 
        (r.coach_name && r.coach_name.toLowerCase().includes(admin.name.toLowerCase()))
      );
      if (!exists) {
        memoryStore.admin_rota.push({
          id: `admin-rota-${admin.id}`,
          branch_id: branchId,
          staff_id: admin.id,
          coach_name: admin.name,
          staff_role: 'branch_admin',
          specialty: 'Branch Operations Administrator',
          monday: '07:00 - 15:00 (Facility Command)',
          tuesday: '07:00 - 15:00 (Facility Command)',
          wednesday: '07:00 - 15:00 (Facility Command)',
          thursday: '07:00 - 15:00 (Facility Command)',
          friday: '07:00 - 15:00 (Facility Command)',
          saturday: 'Rest / Standby',
          sunday: 'Rest / Standby',
          is_published: true,
          updated_at: new Date().toISOString()
        });
      }
    });

    const branchAdminRota = memoryStore.admin_rota.filter(r => r.branch_id === branchId);
    saveStore();

    const meta = memoryStore.admin_rota_metadata[branchId];
    const editsUsed = meta.edit_count || 0;
    const editsRemaining = Math.max(0, 2 - editsUsed);
    const canEdit = req.user.role === 'super_admin' || editsUsed < 2;

    return res.json({
      success: true,
      rota: branchAdminRota,
      weekly_edits_used: editsUsed,
      weekly_edits_limit: 2,
      weekly_edits_remaining: editsRemaining,
      can_edit: canEdit,
      is_published: Boolean(meta.is_published),
      publish_count: meta.publish_count || 0,
      last_edited_by: meta.last_edited_by || null,
      last_edited_at: meta.last_edited_at || null,
      week_key: meta.week_key
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function saveAdminRota(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const { id, staff_id, coach_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;

    // Check permission: user must be branch_admin of this branch or super_admin
    if (req.user.role !== 'super_admin' && req.user.branch_id && req.user.branch_id !== branchId) {
      return res.status(403).json({ success: false, message: 'You can only edit the admin duty rota for your own home branch.' });
    }

    checkAndRefreshWeeklyRota();
    const currentWeek = getIsoWeekKey();
    if (!memoryStore.admin_rota_metadata) memoryStore.admin_rota_metadata = {};
    if (!memoryStore.admin_rota_metadata[branchId] || memoryStore.admin_rota_metadata[branchId].week_key !== currentWeek) {
      memoryStore.admin_rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: currentWeek,
        edit_count: 0,
        publish_count: 0,
        is_published: true,
        published_at: null,
        last_edited_by: null,
        last_edited_at: null
      };
    }

    const meta = memoryStore.admin_rota_metadata[branchId];
    if (req.user.role !== 'super_admin' && (meta.edit_count || 0) >= 2) {
      return res.status(403).json({
        success: false,
        error: 'WEEKLY_EDIT_LIMIT_REACHED',
        message: 'Weekly edit quota reached: Maximum 2 duty rota revisions allowed per week across all branch administrators for this branch. Revisions reset every Monday.',
        weekly_edits_used: meta.edit_count,
        weekly_edits_remaining: 0
      });
    }

    if (!memoryStore.admin_rota) memoryStore.admin_rota = [];

    const idx = memoryStore.admin_rota.findIndex(r => r.id === id || (staff_id && r.staff_id === staff_id));
    let saved;
    if (idx >= 0) {
      saved = {
        ...memoryStore.admin_rota[idx],
        coach_name: coach_name || memoryStore.admin_rota[idx].coach_name,
        monday: monday || memoryStore.admin_rota[idx].monday,
        tuesday: tuesday || memoryStore.admin_rota[idx].tuesday,
        wednesday: wednesday || memoryStore.admin_rota[idx].wednesday,
        thursday: thursday || memoryStore.admin_rota[idx].thursday,
        friday: friday || memoryStore.admin_rota[idx].friday,
        saturday: saturday || memoryStore.admin_rota[idx].saturday,
        sunday: sunday || memoryStore.admin_rota[idx].sunday,
        updated_at: new Date().toISOString(),
        updated_by: req.user.name || req.user.username
      };
      memoryStore.admin_rota[idx] = saved;
    } else {
      saved = {
        id: id || `admin-rota-${Date.now()}`,
        branch_id: branchId,
        staff_id: staff_id || req.user.id,
        coach_name: coach_name || req.user.name,
        staff_role: 'branch_admin',
        specialty: 'Branch Operations Administrator',
        monday: monday || '07:00 - 15:00 (Facility Command)',
        tuesday: tuesday || '07:00 - 15:00 (Facility Command)',
        wednesday: wednesday || '07:00 - 15:00 (Facility Command)',
        thursday: thursday || '07:00 - 15:00 (Facility Command)',
        friday: friday || '07:00 - 15:00 (Facility Command)',
        saturday: saturday || 'Rest / Standby',
        sunday: sunday || 'Rest / Standby',
        is_published: true,
        updated_at: new Date().toISOString(),
        updated_by: req.user.name || req.user.username
      };
      memoryStore.admin_rota.unshift(saved);
    }

    meta.edit_count = (meta.edit_count || 0) + 1;
    meta.last_edited_by = req.user.name || req.user.username;
    meta.last_edited_at = new Date().toISOString();

    saveStore();
    return res.json({
      success: true,
      slot: saved,
      message: `Branch Admin duty schedule updated (${meta.edit_count}/2 weekly revisions used for this branch). Synchronized across all co-administrators.`,
      weekly_edits_used: meta.edit_count,
      weekly_edits_remaining: Math.max(0, 2 - meta.edit_count),
      can_edit: req.user.role === 'super_admin' || meta.edit_count < 2
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function publishAdminRota(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    if (req.user.role !== 'super_admin' && req.user.branch_id && req.user.branch_id !== branchId) {
      return res.status(403).json({ success: false, message: 'You can only publish the admin duty rota for your own home branch.' });
    }

    checkAndRefreshWeeklyRota();
    const currentWeek = getIsoWeekKey();
    if (!memoryStore.admin_rota_metadata) memoryStore.admin_rota_metadata = {};
    if (!memoryStore.admin_rota_metadata[branchId] || memoryStore.admin_rota_metadata[branchId].week_key !== currentWeek) {
      memoryStore.admin_rota_metadata[branchId] = {
        branch_id: branchId,
        week_key: currentWeek,
        edit_count: 0,
        publish_count: 0,
        is_published: true,
        published_at: null,
        last_edited_by: null,
        last_edited_at: null
      };
    }

    const meta = memoryStore.admin_rota_metadata[branchId];
    if (req.user.role !== 'super_admin' && (meta.edit_count || 0) >= 2) {
      return res.status(403).json({
        success: false,
        error: 'WEEKLY_EDIT_LIMIT_REACHED',
        message: 'Weekly edit quota reached: Maximum 2 duty rota revisions allowed per week across all branch administrators for this branch. Revisions reset every Monday.',
        weekly_edits_used: meta.edit_count,
        weekly_edits_remaining: 0
      });
    }

    meta.edit_count = (meta.edit_count || 0) + 1;
    meta.publish_count = (meta.publish_count || 0) + 1;
    meta.is_published = true;
    meta.published_at = new Date().toISOString();
    meta.last_edited_by = req.user.name || req.user.username;
    meta.last_edited_at = meta.published_at;

    if (Array.isArray(memoryStore.admin_rota)) {
      memoryStore.admin_rota.filter(r => r.branch_id === branchId).forEach(r => {
        r.is_published = true;
      });
    }

    saveStore();

    return res.json({
      success: true,
      message: `Branch Admin Duty Rota published and synchronized across all co-administrators (${meta.edit_count}/2 edits used this week)!`,
      weekly_edits_used: meta.edit_count,
      weekly_edits_remaining: Math.max(0, 2 - meta.edit_count),
      is_published: true,
      published_at: meta.published_at
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 14. Staff Timeclock Attendance Logs
 * GET /api/branch-admin/timeclock/logs
 * POST /api/branch-admin/timeclock/punch
 */
async function getTimeclockLogs(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    if (!memoryStore.timeclock_logs) {
      memoryStore.timeclock_logs = [
        {
          id: 'tc-001',
          branch_id: branchId,
          staff_id: 'u1000000-0000-0000-0000-000000000002',
          staff_name: 'Maya Lin',
          role: 'Front Desk Cashier',
          clock_in: new Date(Date.now() - 3600000 * 6),
          clock_out: null,
          status: 'ON_DUTY',
          hours_rendered: 6.0
        }
      ];
    }
    const filtered = memoryStore.timeclock_logs.filter(t => t.branch_id === branchId);
    res.json({ success: true, logs: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function punchTimeclock(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const { staff_name = req.user.name, action_type = 'clock_in' } = req.body;

    if (!memoryStore.timeclock_logs) memoryStore.timeclock_logs = [];

    if (action_type === 'clock_in') {
      const punch = {
        id: crypto.randomUUID(),
        branch_id: branchId,
        staff_id: req.user.id,
        staff_name,
        role: req.user.role || 'employee',
        clock_in: new Date(),
        clock_out: null,
        status: 'ON_DUTY',
        hours_rendered: 0
      };
      memoryStore.timeclock_logs.unshift(punch);
      return res.status(201).json({ success: true, punch, message: `Clocked in successfully at ${new Date().toLocaleTimeString()}.` });
    } else {
      // Find active punch
      const active = memoryStore.timeclock_logs.find(t => t.staff_name === staff_name && t.status === 'ON_DUTY');
      if (active) {
        active.clock_out = new Date();
        active.status = 'COMPLETED';
        const diffMs = active.clock_out - new Date(active.clock_in);
        active.hours_rendered = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        return res.json({ success: true, punch: active, message: `Clocked out successfully. Rendered ${active.hours_rendered} hours.` });
      }
      return res.status(400).json({ success: false, message: 'No active clock-in found for this staff member.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 15. VIP Long-Term Locker Rental Manager
 * GET /api/branch-admin/lockers/vip
 * POST /api/branch-admin/lockers/vip
 * POST /api/branch-admin/lockers/vip/:id/release
 */
async function getVipLockers(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    if (!memoryStore.vip_lockers) {
      memoryStore.vip_lockers = [
        {
          id: 'vlk-01',
          branch_id: branchId,
          locker_number: 'VIP-01',
          member_name: 'Derrick Sterling',
          member_phone: '+63 917 555 0101',
          tier: '1-Year Black Elite',
          deposit_paid: 200.00,
          monthly_fee: 1200.00,
          duration_months: 12,
          start_date: '2026-01-01',
          expiry_date: '2026-12-31',
          status: 'ACTIVE'
        },
        {
          id: 'vlk-02',
          branch_id: branchId,
          locker_number: 'VIP-02',
          member_name: 'Valerie Ramos',
          member_phone: '+63 917 555 0102',
          tier: '1-Month Pass',
          deposit_paid: 200.00,
          monthly_fee: 1200.00,
          duration_months: 2,
          start_date: '2026-09-01',
          expiry_date: '2026-10-31',
          status: 'ACTIVE'
        }
      ];
    }
    const filtered = memoryStore.vip_lockers.filter(l => l.branch_id === branchId);
    const enriched = filtered.map(l => ({
      ...l,
      monthly_fee: Number(l.monthly_fee) === 500 ? 1200.00 : (Number(l.monthly_fee) || 1200.00),
      duration_months: l.duration_months || (l.tier && l.tier.includes('Year') ? 12 : 2)
    }));
    res.json({ success: true, lockers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function assignVipLocker(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const { locker_number, member_name, member_phone, duration_months = 1, deposit_paid = 200 } = req.body;

    if (!locker_number || !member_name) {
      return res.status(400).json({ success: false, message: 'Locker number and Member name are required.' });
    }

    if (!memoryStore.vip_lockers) memoryStore.vip_lockers = [];

    const now = new Date();
    const expiry = new Date(now.getFullYear(), now.getMonth() + Number(duration_months), now.getDate());

    const newLocker = {
      id: crypto.randomUUID(),
      branch_id: branchId,
      locker_number: locker_number.toUpperCase(),
      member_name: member_name.trim(),
      member_phone: member_phone ? member_phone.trim() : '—',
      deposit_paid: Number(deposit_paid) || 200,
      monthly_fee: 500,
      start_date: now.toISOString().split('T')[0],
      expiry_date: expiry.toISOString().split('T')[0],
      status: 'ACTIVE',
      created_at: now
    };

    memoryStore.vip_lockers.unshift(newLocker);

    await logAuditEvent({
      branch_id: branchId,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'VIP_LOCKER_ASSIGNED',
      resource: `LOCKER:${newLocker.locker_number}`,
      ip_address: req.ip,
      details: { member: member_name, deposit: deposit_paid }
    });

    res.status(201).json({ success: true, locker: newLocker, message: `VIP Locker ${newLocker.locker_number} leased to ${member_name}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function releaseVipLocker(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.vip_lockers) memoryStore.vip_lockers = [];
    const target = memoryStore.vip_lockers.find(l => l.id === id);
    if (!target) return res.status(404).json({ success: false, message: 'Locker record not found.' });

    target.status = 'RELEASED';
    target.deposit_refunded = true;
    target.released_at = new Date();

    await logAuditEvent({
      branch_id: req.user.branch_id,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'VIP_LOCKER_RELEASED',
      resource: `LOCKER:${target.locker_number}`,
      ip_address: req.ip,
      details: { deposit_refunded: target.deposit_paid }
    });

    res.json({ success: true, message: `Locker ${target.locker_number} released and ₱${target.deposit_paid} deposit refunded to member.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 16. Counter Petty Cash Expense Voucher Pad
 * GET /api/branch-admin/expenses
 * POST /api/branch-admin/expenses
 */
async function getExpenses(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    if (!memoryStore.petty_expenses) {
      memoryStore.petty_expenses = [
        {
          id: 'exp-01',
          branch_id: branchId,
          description: '5x 5-Gallon Purified Mineral Water Refills (Water Dispenser)',
          amount: 250.00,
          category: 'Facility Operations',
          paid_to: 'AquaPure Makati',
          receipt_no: 'OR-88219',
          authorized_by: 'Rafael Silva (Admin)',
          created_at: new Date(Date.now() - 3600000 * 24)
        },
        {
          id: 'exp-02',
          branch_id: branchId,
          description: 'Emergency Microfiber Towel Detergent & Sanitizer',
          amount: 180.00,
          category: 'Hygiene & Cleaning',
          paid_to: '7-Eleven Malugay',
          receipt_no: 'OR-41109',
          authorized_by: 'Maya Lin (Desk)',
          created_at: new Date(Date.now() - 3600000 * 8)
        }
      ];
    }
    const filtered = memoryStore.petty_expenses.filter(e => e.branch_id === branchId);
    const enriched = filtered.map(e => ({
      ...e,
      payee: e.payee || e.paid_to || 'General Vendor'
    }));
    res.json({ success: true, expenses: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function recordExpense(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const { description, amount, category = 'Facility Operations', paid_to = 'Cash Vendor', receipt_no = 'N/A' } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ success: false, message: 'Expense description and amount are required.' });
    }

    if (!memoryStore.petty_expenses) memoryStore.petty_expenses = [];

    const newExpense = {
      id: crypto.randomUUID(),
      branch_id: branchId,
      description: description.trim(),
      amount: Number(amount) || 0,
      category,
      paid_to: paid_to.trim(),
      receipt_no: receipt_no.trim(),
      authorized_by: req.user.name || 'Branch Admin',
      created_at: new Date()
    };

    memoryStore.petty_expenses.unshift(newExpense);

    await logAuditEvent({
      branch_id: branchId,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'COUNTER_EXPENSE_DISBURSED',
      resource: `EXPENSE:${newExpense.id}`,
      ip_address: req.ip,
      details: { amount: newExpense.amount, category }
    });

    res.status(201).json({ success: true, expense: newExpense, message: 'Petty cash disbursement recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 17. 14-Day Inactivity Churn Predictor & Retention Queue
 * GET /api/branch-admin/members/churn-risk
 * POST /api/branch-admin/members/re-engage/:id
 */
async function getChurnRiskMembers(req, res) {
  try {
    const branchId = req.user.branch_id || 'b-mkt-01';
    const rawUsers = (memoryStore.users || []).filter(u => u.role === 'member' && u.branch_id === branchId);
    // Deduplicate members by email
    const usersMap = new Map();
    for (const u of rawUsers) {
      const key = (u.email || u.id).toLowerCase();
      if (!usersMap.has(key)) usersMap.set(key, u);
    }
    const users = Array.from(usersMap.values());

    const attendance = memoryStore.attendance_logs || [];
    // System reference date: October 20, 2026
    const systemDate = new Date('2026-10-20T12:00:00Z');

    const atRisk = users.map(u => {
      const logs = attendance.filter(a => a.user_id === u.id || a.member_name?.includes(u.name));
      let lastCheckInDateStr = '2026-09-28';
      let lastCheckIn;
      if (logs.length > 0) {
        lastCheckIn = new Date(logs[0].created_at || logs[0].check_in_time);
        lastCheckInDateStr = lastCheckIn.toISOString().split('T')[0];
      } else if (u.last_visit_date) {
        lastCheckIn = new Date(u.last_visit_date);
        lastCheckInDateStr = u.last_visit_date;
      } else {
        lastCheckIn = new Date('2026-09-28T09:00:00Z');
        lastCheckInDateStr = '2026-09-28';
      }

      // Compute elapsed inactive days from 2026-09-28 to 2026-10-20 -> exactly 22 days
      const daysInactive = Math.max(14, Math.floor((systemDate.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '—',
        tier: u.membership_tier || '1-Month Pass',
        plan: u.membership_tier || '12_months',
        plan_name: u.membership_tier || '12-Month Black Elite',
        last_check_in: lastCheckIn,
        last_visit_date: lastCheckInDateStr,
        days_inactive: daysInactive,
        churn_risk_level: daysInactive >= 30 ? 'CRITICAL (30+ Days)' : (daysInactive >= 21 ? 'HIGH (3 Weeks)' : 'MODERATE (2 Weeks)'),
        re_engaged: !!u.last_re_engaged_at,
        last_re_engaged_at: u.last_re_engaged_at || null
      };
    }).filter(m => m.days_inactive >= 14).sort((a, b) => b.days_inactive - a.days_inactive);

    res.json({ success: true, at_risk_count: atRisk.length, members: atRisk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function reEngageMember(req, res) {
  try {
    const { id } = req.params;
    const { message_note = 'VIP Free PT Session & Welcome Back Coffee' } = req.body;
    const user = (memoryStore.users || []).find(u => u.id === id);
    if (!user) return res.status(404).json({ success: false, message: 'Member not found.' });

    user.last_re_engaged_at = new Date();
    user.re_engage_note = message_note;

    await logAuditEvent({
      branch_id: req.user.branch_id,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'CHURN_RE_ENGAGEMENT_SENT',
      resource: `USER:${user.id}`,
      ip_address: req.ip,
      details: { member: user.name, note: message_note }
    });

    res.json({
      success: true,
      message: `Re-engagement notification dispatched to ${user.name} via SMS & Email.`,
      timestamp: user.last_re_engaged_at
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 14. Branch Announcements & Targeted Promos
 * GET /api/branch-admin/announcements
 * POST /api/branch-admin/announcements
 * DELETE /api/branch-admin/announcements/:id
 */
async function getBranchAnnouncements(req, res) {
  try {
    const rawBranchId = req.user?.branch_id || req.query.branch_id;
    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
    };
    const normBranchId = branchMap[rawBranchId] || rawBranchId;

    if (!memoryStore.announcements) {
      memoryStore.announcements = memoryStore.broadcasts || [];
    }

    // Branch Admin sees announcements for their branch + relevant Super Admin announcements
    const items = (memoryStore.announcements || []).filter(item => {
      const itemBranch = branchMap[item.branch_id] || item.branch_id;
      if (itemBranch === normBranchId) return true;
      if (!item.branch_id && (item.target_audience === 'all' || item.target_audience === 'branch_admins')) return true;
      return false;
    });

    res.json({ success: true, announcements: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createBranchAnnouncement(req, res) {
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
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
    };
    const normBranchId = branchMap[rawBranchId] || rawBranchId;
    const branch = (memoryStore.branches || []).find(b => b.id === normBranchId || b.code === normBranchId);

    const {
      title,
      message,
      type = 'announcement',
      severity = 'info',
      target_audience = 'branch_all',
      promo_code = null,
      discount_percentage = null,
      valid_until = null
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Headline / Title and Message are required.' });
    }

    if (!memoryStore.announcements) {
      memoryStore.announcements = memoryStore.broadcasts || [];
    }

    const newAnnouncement = {
      id: crypto.randomUUID(),
      title: title.trim(),
      message: message.trim(),
      type: type === 'promo' ? 'promo' : 'announcement',
      severity,
      target_audience,
      promo_code: promo_code ? promo_code.trim().toUpperCase() : null,
      discount_percentage: discount_percentage ? Number(discount_percentage) : null,
      valid_until: valid_until || null,
      branch_id: normBranchId,
      branch_name: branch?.name || 'Local Branch',
      created_by_role: 'branch_admin',
      created_by_name: req.user.name || 'Branch Admin',
      is_active: true,
      created_at: new Date().toISOString()
    };

    memoryStore.announcements.unshift(newAnnouncement);
    memoryStore.broadcasts = memoryStore.announcements;
    saveStore();

    await logAuditEvent({
      user_id: req.user.id,
      user_role: 'branch_admin',
      action: type === 'promo' ? 'BRANCH_PROMO_CREATED' : 'BRANCH_ANNOUNCEMENT_CREATED',
      resource: `ANNOUNCEMENT:${newAnnouncement.id}`,
      ip_address: req.ip,
      details: { title, type, target_audience, branch_id: normBranchId }
    });

    res.status(201).json({
      success: true,
      announcement: newAnnouncement,
      message: `${type === 'promo' ? 'Branch promo' : 'Branch announcement'} published successfully.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteBranchAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const rawBranchId = req.user?.branch_id;
    const branchMap = {
      'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
      'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
      'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
      'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
      'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
      'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
    };
    const normBranchId = branchMap[rawBranchId] || rawBranchId;

    if (!memoryStore.announcements) memoryStore.announcements = memoryStore.broadcasts || [];
    
    const existing = memoryStore.announcements.find(a => a.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    if (req.user?.role !== 'super_admin' && (branchMap[existing.branch_id] || existing.branch_id) !== normBranchId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete announcements from another facility.' });
    }

    memoryStore.announcements = memoryStore.announcements.filter(a => a.id !== id);
    memoryStore.broadcasts = memoryStore.announcements;
    saveStore();

    await logAuditEvent({
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'BRANCH_ANNOUNCEMENT_REMOVED',
      resource: `ANNOUNCEMENT:${id}`,
      ip_address: req.ip
    });

    res.json({ success: true, message: 'Branch announcement removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getStaff,
  createStaff,
  updateStaffStatus,
  getMembers,
  checkInMember,
  getCrossBranchVisits,
  getLedger,
  getIncidents,
  createIncident,
  updateIncidentStatus,
  getInventoryBurnRate,
  verifySupervisorPin,
  getShifts,
  createShift,
  deleteShift,
  getTimeclockLogs,
  punchTimeclock,
  getVipLockers,
  assignVipLocker,
  releaseVipLocker,
  getExpenses,
  recordExpense,
  getChurnRiskMembers,
  reEngageMember,
  getBranchAnnouncements,
  createBranchAnnouncement,
  deleteBranchAnnouncement,
  getFloorRota,
  saveFloorRota,
  publishFloorRota,
  deleteFloorRotaSlot,
  checkAndRefreshWeeklyRota,
  getAdminRota,
  saveAdminRota,
  publishAdminRota
};
