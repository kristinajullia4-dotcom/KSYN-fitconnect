const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { sendFranchiseDiscoveryEmail, sendFranchiseInquiryEmail } = require('../utils/mailer');
const totp = require('../utils/totp');

// Root Super Admin identifier protected from demotion or suspension
const ROOT_SUPER_ADMIN_ID = 'u0000000-0000-0000-0000-000000000001';
const ROOT_SUPER_ADMIN_EMAIL = 'superadmin@ksyn.com';

/**
 * 1. GET /api/super-admin/stats
 * Consolidated corporate network metrics & live activity feed
 */
async function getStats(req, res) {
  try {
    const branches = memoryStore.branches || [];
    const sales = memoryStore.sales || [];
    const users = memoryStore.users || [];
    const applications = memoryStore.franchise_applications || [];

    // Branch operational counts
    const activeBranches = branches.filter(b => b.status === 'Active' || (b.is_active !== false && b.status !== 'Under Fit-Out' && b.status !== 'Suspended')).length;
    const underFitOut = branches.filter(b => b.status === 'Under Fit-Out').length;
    const suspended = branches.filter(b => b.status === 'Suspended' || b.is_active === false).length;

    // Gross sales network-wide
    const networkGrossRevenue = sales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

    // Active members
    const totalActiveMembers = users.filter(u => u.role === 'member' && u.status === 'active').length;

    // Consolidated corporate royalties (7.5% corporate benchmark)
    const corporateRoyaltiesDue = branches.reduce((acc, br) => {
      const brSales = sales.filter(s => s.branch_id === br.id).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const rate = Number(br.royalty_percentage) || 7.50;
      return acc + (brSales * (rate / 100));
    }, 0);

    // Procurement Restock Requests
    const restockRequests = memoryStore.inventory_restock_requests || [];
    const pendingRestockCount = restockRequests.filter(r => r.status === 'Pending HQ Review').length;
    const lowStockNetworkCount = (memoryStore.inventory || []).filter(i => i.quantity <= i.reorder_threshold).length;

    // Network Activity Feed
    const activityFeed = [
      ...restockRequests.map(req => {
        const branch = branches.find(b => b.id === req.branch_id);
        const branchName = branch ? branch.name : 'Unknown Branch';
        return {
          id: `act-restock-${req.id}`,
          type: 'RESTOCK_REQUEST',
          title: `Restock Requested: ${branchName} reordered ${req.requested_quantity}x ${req.item_name}`,
          description: `SKU: ${req.sku} • Current Stock: ${req.current_stock} • Urgency: ${req.urgency} • Status: ${req.status}`,
          status: req.status,
          timestamp: req.created_at
        };
      }),
      ...applications.slice(0, 3).map(app => ({
        id: `act-${app.id}`,
        type: 'FRANCHISE_APPLICATION',
        title: `Franchise Inquiry: ${app.fullName}`,
        description: `Target Location: ${app.desiredLocation} (${app.proposedCapital})`,
        status: app.status,
        timestamp: app.submittedAt || app.created_at
      })),
      ...branches.slice(0, 2).map(br => ({
        id: `act-${br.id}`,
        type: 'BRANCH_DEPLOYMENT',
        title: `Branch Facility: ${br.name} (${br.code})`,
        description: `Status: ${br.status || 'Active'} • Royalty Rate: ${br.royalty_percentage}%`,
        status: br.status || 'Active',
        timestamp: br.created_at
      })),
      {
        id: 'act-remit-1',
        type: 'REMITTANCE_SETTLEMENT',
        title: 'HQ Monthly Royalty Computation Completed',
        description: `Consolidated Network Cut: ₱${corporateRoyaltiesDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        status: 'Settled',
        timestamp: new Date()
      }
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      stats: {
        totalBranches: branches.length,
        activeBranches,
        branchStatusCounts: {
          active: activeBranches,
          underFitOut,
          suspended
        },
        networkGrossRevenue,
        totalActiveMembers,
        corporateRoyaltiesDue,
        totalTransactions: sales.length,
        totalApplications: applications.length,
        pendingRestockCount,
        lowStockNetworkCount
      },
      activityFeed
    });
  } catch (err) {
    console.error('[SuperAdmin getStats Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 2. GET /api/super-admin/admins
 * List all administrative & branch owner accounts with branch mapping
 */
async function getAdmins(req, res) {
  try {
    const users = memoryStore.users || [];
    const branches = memoryStore.branches || [];

    const allowedRoles = ['branch_admin', 'branch_owner', 'super_admin', 'hq_employee', 'coach', 'trainer', 'staff', 'employee'];
    const admins = users
      .filter(u => allowedRoles.includes(u.role))
      .map(u => {
        const branch = branches.find(b => b.id === u.branch_id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.username || u.email.split('@')[0],
          role: u.role,
          status: u.status || 'active',
          is_active: u.is_active !== false,
          is_verified: u.is_verified !== false,
          email_verified: u.email_verified !== false,
          branch_id: u.branch_id,
          branch_name: branch?.name || (u.role === 'super_admin' ? 'Global Corporate HQ' : 'Unassigned Branch'),
          branch_code: branch?.code || (u.role === 'super_admin' ? 'HQ-00' : 'N/A'),
          phone: u.phone || '—',
          can_refund: u.can_refund !== false,
          can_modify_inventory: u.can_modify_inventory !== false,
          can_export_reports: u.can_export_reports !== false,
          created_at: u.created_at || new Date('2026-01-01')
        };
      });

    res.json({ success: true, admins });
  } catch (err) {
    console.error('[SuperAdmin getAdmins Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 3. POST /api/super-admin/admins
 * Create a new Branch Admin / Owner account with instant activation (no OTP required)
 */
async function createAdmin(req, res) {
  try {
    const { name, email, username, password, branch_id, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Name, email, and temporary password are required.'
      });
    }

    const emailClean = email.trim().toLowerCase();
    const existing = memoryStore.users.find(u => u.email.toLowerCase() === emailClean);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'USER_ALREADY_EXISTS',
        message: `An account with email '${emailClean}' already exists in the enterprise directory.`
      });
    }

    let assignedRole = 'branch_admin';
    if (role === 'branch_owner' || role === 'owner') {
      assignedRole = 'branch_owner';
    } else if (role === 'coach' || role === 'trainer') {
      assignedRole = 'coach';
    } else if (role === 'staff' || role === 'employee') {
      assignedRole = 'staff';
    } else if (role === 'branch_admin') {
      assignedRole = 'branch_admin';
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newAdmin = {
      id: crypto.randomUUID(),
      branch_id: branch_id || null,
      role: assignedRole,
      email: emailClean,
      username: (username || emailClean.split('@')[0]).trim().toLowerCase(),
      password_hash,
      name: name.trim(),
      phone: phone || req.body.phone || '+63 900 000 0000',
      status: 'active',
      is_active: true,
      is_verified: true,
      email_verified: true,
      can_refund: true,
      can_modify_inventory: true,
      can_export_reports: true,
      created_at: new Date()
    };

    memoryStore.users.push(newAdmin);

    // If branch_id was provided and role is branch_admin or branch_owner, update assigned_admin on the branch
    if (branch_id && (assignedRole === 'branch_admin' || assignedRole === 'branch_owner')) {
      const branch = memoryStore.branches.find(b => b.id === branch_id);
      if (branch) {
        branch.assigned_admin_id = newAdmin.id;
        branch.assigned_admin_name = newAdmin.name;
      }
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: assignedRole === 'coach' ? 'SUPER_ADMIN_CREATE_COACH' : (assignedRole === 'staff' ? 'SUPER_ADMIN_CREATE_STAFF' : 'SUPER_ADMIN_CREATE_BRANCH_ADMIN'),
      resource: `USER:${newAdmin.id}`,
      ip_address: req.ip,
      details: {
        admin_name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        branch_id: newAdmin.branch_id
      }
    });

    const roleLabel = assignedRole === 'coach' ? 'Coach' : (assignedRole === 'staff' ? 'Staff' : 'Branch Admin');
    res.status(201).json({
      success: true,
      message: `${roleLabel} account created and active immediately for login.`,
      admin: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        username: newAdmin.username,
        role: newAdmin.role,
        branch_id: newAdmin.branch_id,
        status: newAdmin.status,
        is_active: true,
        is_verified: true,
        email_verified: true,
        created_at: newAdmin.created_at
      }
    });
  } catch (err) {
    console.error('[SuperAdmin createAdmin Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 4. PUT /api/super-admin/admins/:id/status
 * Toggle status or reset temporary credentials
 */
async function updateAdminStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, temporary_password } = req.body;

    const user = memoryStore.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Admin account not found.' });
    }

    if (user.id === ROOT_SUPER_ADMIN_ID || user.email === ROOT_SUPER_ADMIN_EMAIL) {
      if (status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'PROTECTED_ACCOUNT',
          message: 'Root Super Admin account cannot be deactivated or suspended.'
        });
      }
    }

    if (status) {
      user.status = status;
    }

    if (temporary_password) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(temporary_password, salt);
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_ADMIN_STATUS',
      resource: `USER:${user.id}`,
      ip_address: req.ip,
      details: { new_status: user.status, password_reset: !!temporary_password }
    });

    res.json({
      success: true,
      message: `Admin account ${user.name} updated successfully.`,
      admin: { id: user.id, name: user.name, email: user.email, status: user.status }
    });
  } catch (err) {
    console.error('[SuperAdmin updateAdminStatus Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 5. POST /api/super-admin/branches
 * Register a new physical franchise gym facility
 */
async function registerBranch(req, res) {
  try {
    const {
      name,
      code,
      address,
      city,
      phone,
      operating_hours = '24/7 Access',
      assigned_admin_id,
      target_opening_date,
      royalty_percentage = 7.50,
      status = 'Active'
    } = req.body;

    if (!name || !code || !address || !city) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Branch name, code, address, and city are required.'
      });
    }

    const codeClean = code.trim().toUpperCase();
    const existing = memoryStore.branches.find(b => b.code.toUpperCase() === codeClean);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'BRANCH_CODE_EXISTS',
        message: `Branch code '${codeClean}' is already allocated to ${existing.name}.`
      });
    }

    let assignedAdminName = 'HQ Operations Pool';
    if (assigned_admin_id) {
      const adminUser = memoryStore.users.find(u => u.id === assigned_admin_id);
      if (adminUser) {
        assignedAdminName = adminUser.name;
      }
    }

    const newBranch = {
      id: crypto.randomUUID(),
      code: codeClean,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone || '+63 2 8888 0000',
      operating_hours: operating_hours || '24/7 Access',
      royalty_percentage: Number(royalty_percentage) || 7.50,
      is_active: status !== 'Suspended',
      status: status || 'Active',
      assigned_admin_id: assigned_admin_id || null,
      assigned_admin_name: assignedAdminName,
      target_opening_date: target_opening_date || null,
      created_at: new Date()
    };

    memoryStore.branches.push(newBranch);

    // Map admin's branch_id if specified
    if (assigned_admin_id) {
      const adminUser = memoryStore.users.find(u => u.id === assigned_admin_id);
      if (adminUser) {
        adminUser.branch_id = newBranch.id;
      }
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_REGISTER_BRANCH',
      resource: `BRANCH:${newBranch.id}`,
      ip_address: req.ip,
      details: { name: newBranch.name, code: newBranch.code, city: newBranch.city }
    });

    res.status(201).json({
      success: true,
      message: `Franchise facility '${newBranch.name}' provisioned successfully.`,
      branch: newBranch
    });
  } catch (err) {
    console.error('[SuperAdmin registerBranch Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 6. PUT /api/super-admin/branches/:id/status
 * Update branch status or assigned owner
 */
async function updateBranchStatus(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      is_active,
      assigned_admin_id,
      royalty_percentage,
      name,
      address,
      city,
      phone
    } = req.body;

    const branch = memoryStore.branches.find(b => b.id === id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Branch facility not found.' });
    }

    if (status !== undefined) {
      branch.status = status;
      branch.is_active = status !== 'Suspended';
    }
    if (is_active !== undefined) {
      branch.is_active = !!is_active;
      if (!is_active) branch.status = 'Suspended';
    }
    if (royalty_percentage !== undefined) {
      branch.royalty_percentage = Number(royalty_percentage);
    }
    if (name) branch.name = name.trim();
    if (address) branch.address = address.trim();
    if (city) branch.city = city.trim();
    if (phone) branch.phone = phone.trim();

    if (assigned_admin_id !== undefined) {
      branch.assigned_admin_id = assigned_admin_id;
      if (assigned_admin_id) {
        const adminUser = memoryStore.users.find(u => u.id === assigned_admin_id);
        if (adminUser) {
          branch.assigned_admin_name = adminUser.name;
          adminUser.branch_id = branch.id;
        }
      } else {
        branch.assigned_admin_name = 'HQ Operations Pool';
      }
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_BRANCH',
      resource: `BRANCH:${branch.id}`,
      ip_address: req.ip,
      details: { name: branch.name, status: branch.status, royalty_percentage: branch.royalty_percentage }
    });

    res.json({
      success: true,
      message: `Branch facility '${branch.name}' updated successfully.`,
      branch
    });
  } catch (err) {
    console.error('[SuperAdmin updateBranchStatus Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 7. GET /api/super-admin/franchise-applications
 * List franchise investor applications
 */
async function getFranchiseApplications(req, res) {
  try {
    const applications = memoryStore.franchise_applications || [];
    res.json({ success: true, applications });
  } catch (err) {
    console.error('[SuperAdmin getFranchiseApplications Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 8. PUT /api/super-admin/franchise-applications/:id/status
 * Update approval/rejection or convert applicant into a registered branch partner
 */
async function updateFranchiseApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reviewNote, convertToBranch, branchData } = req.body;

    const application = (memoryStore.franchise_applications || []).find(a => a.id === id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Franchise application not found.' });
    }

    if (status) {
      application.status = status;
    }
    if (reviewNote !== undefined) {
      application.reviewNote = reviewNote;
    }
    application.updated_at = new Date();

    let createdBranch = null;

    // Convert applicant into registered branch facility
    if (convertToBranch && branchData) {
      const codeClean = (branchData.code || 'HUB-NEW').toUpperCase();
      createdBranch = {
        id: crypto.randomUUID(),
        code: codeClean,
        name: branchData.name || `KSYN ${application.desiredLocation} Hub`,
        address: branchData.address || application.desiredLocation,
        city: branchData.city || 'Metro Manila',
        phone: branchData.phone || application.phone,
        royalty_percentage: Number(branchData.royalty_percentage) || 7.50,
        is_active: true,
        status: 'Under Fit-Out',
        assigned_admin_name: application.fullName,
        created_at: new Date()
      };
      memoryStore.branches.push(createdBranch);
      application.status = 'Approved';
      application.linkedBranchId = createdBranch.id;
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_FRANCHISE_APPLICATION',
      resource: `APPLICATION:${application.id}`,
      ip_address: req.ip,
      details: { applicant: application.fullName, status: application.status, created_branch: createdBranch?.code }
    });

    res.json({
      success: true,
      message: `Franchise application for '${application.fullName}' updated to ${application.status}.`,
      application,
      createdBranch
    });
  } catch (err) {
    console.error('[SuperAdmin updateFranchiseApplicationStatus Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 8.1. POST /api/super-admin/franchise/contact/:applicationId
 * Dispatches formal interview invitation & document request via Nodemailer
 */
async function contactFranchiseApplicant(req, res) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const {
      interviewType,
      interviewDatetime,
      meetingDetails,
      requestedDocs,
      customMessage
    } = req.body;

    const application = (memoryStore.franchise_applications || []).find(a => a.id === applicationId);
    if (!application) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Franchise application not found.' });
    }

    // Clean custom message (ignore if the whole generated preview was passed)
    let cleanCustomMessage = customMessage ? customMessage.trim() : '';
    if (cleanCustomMessage.includes('SCHEDULED SESSION PARTICULARS:') || cleanCustomMessage.includes('CRITICAL ACTION REQUIRED')) {
      cleanCustomMessage = '';
    }

    // Update application state in memoryStore
    application.interview_type = interviewType || 'Video Call';
    application.interview_datetime = interviewDatetime ? new Date(interviewDatetime) : null;
    application.meeting_details = meetingDetails || '';
    application.id_verification_requested = true;
    application.status = application.status === 'Reschedule Requested' ? 'Interview Scheduled' : 'Under Evaluation';
    application.last_contacted_at = new Date();
    application.updated_at = new Date();

    const stamp = `[${new Date().toLocaleDateString('en-US')}]`;
    const dtLabel = application.interview_datetime ? new Date(application.interview_datetime).toLocaleString('en-US') : 'To be coordinated';
    const contactLog = `${stamp} Discovery meeting invitation dispatched: ${dtLabel} (${application.interview_type}).${cleanCustomMessage ? ` Note: ${cleanCustomMessage}` : ''}`;
    application.admin_notes = application.admin_notes ? `${application.admin_notes}\n${contactLog}` : contactLog;

    // If PostgreSQL is active, update the table
    if (isPostgres()) {
      try {
        await query(`
          UPDATE franchise_applications SET
            interview_type = $1,
            interview_datetime = $2,
            meeting_details = $3,
            id_verification_requested = TRUE,
            status = $4,
            last_contacted_at = NOW(),
            admin_notes = COALESCE(admin_notes || E'\n' || $5, $5)
          WHERE id = $6
        `, [
          application.interview_type,
          application.interview_datetime,
          application.meeting_details,
          application.status,
          contactLog,
          application.id
        ]);
      } catch (dbErr) {
        console.warn('[Postgres update error on franchise contact]:', dbErr.message);
      }
    }

    // Dispatch clean due diligence email via Nodemailer
    const emailResult = await sendFranchiseDiscoveryEmail({
      toEmail: application.email,
      applicantName: application.fullName || application.full_name,
      companyName: application.companyName || application.company_name,
      desiredLocation: application.desiredLocation || application.desired_location,
      interviewType: application.interview_type,
      interviewDatetime: application.interview_datetime,
      meetingDetails: application.meeting_details,
      requestedDocs: requestedDocs || [],
      customMessage: cleanCustomMessage
    });

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_FRANCHISE_CONTACT_DISPATCHED',
      resource: `APPLICATION:${application.id}`,
      ip_address: req.ip,
      details: {
        applicant: application.fullName || application.full_name,
        email: application.email,
        interviewType: application.interview_type,
        interviewDatetime: application.interview_datetime
      }
    });

    res.json({
      success: true,
      message: 'Interview invitation and verification request dispatched via email.',
      application,
      emailResult
    });
  } catch (err) {
    console.error('[SuperAdmin contactFranchiseApplicant Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 8.2. PATCH /api/super-admin/franchise/status/:applicationId
 * Updates franchise application status and internal admin notes
 */
async function updateFranchiseStatus(req, res) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const { status, adminNotes, admin_notes, reviewNote, convertToBranch, branchData } = req.body;

    const application = (memoryStore.franchise_applications || []).find(a => a.id === applicationId);
    if (!application) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Franchise application not found.' });
    }

    if (status) {
      application.status = status;
    }
    const notesToSet = adminNotes !== undefined ? adminNotes : (admin_notes !== undefined ? admin_notes : reviewNote);
    if (notesToSet !== undefined) {
      application.admin_notes = notesToSet;
      application.reviewNote = notesToSet;
    }
    application.updated_at = new Date();

    let createdBranch = null;
    if (convertToBranch && branchData) {
      const codeClean = (branchData.code || 'HUB-NEW').toUpperCase();
      createdBranch = {
        id: crypto.randomUUID(),
        code: codeClean,
        name: branchData.name || `KSYN ${application.desiredLocation || application.desired_location} Hub`,
        address: branchData.address || application.desiredLocation || application.desired_location,
        city: branchData.city || 'Metro Manila',
        phone: branchData.phone || application.phone,
        royalty_percentage: Number(branchData.royalty_percentage) || 7.50,
        is_active: true,
        status: 'Under Fit-Out',
        assigned_admin_name: application.fullName || application.full_name,
        created_at: new Date()
      };
      memoryStore.branches.push(createdBranch);
      application.status = 'Approved';
      application.linkedBranchId = createdBranch.id;
    }

    if (isPostgres()) {
      try {
        await query(`
          UPDATE franchise_applications SET
            status = COALESCE($1, status),
            admin_notes = COALESCE($2, admin_notes)
          WHERE id = $3
        `, [status || null, notesToSet || null, application.id]);
      } catch (dbErr) {
        console.warn('[Postgres update error on franchise status]:', dbErr.message);
      }
    }

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_FRANCHISE_STATUS',
      resource: `APPLICATION:${application.id}`,
      ip_address: req.ip,
      details: {
        applicant: application.fullName || application.full_name,
        status: application.status,
        created_branch: createdBranch?.code
      }
    });

    res.json({
      success: true,
      message: `Franchise application status updated to ${application.status}.`,
      application,
      createdBranch
    });
  } catch (err) {
    console.error('[SuperAdmin updateFranchiseStatus Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 8.5. GET /api/super-admin/permissions/users
 * Returns users eligible for Super Admin corporate governance:
 * Enforces SQL/memoryStore query: WHERE role IN ('branch_admin', 'hq_employee', 'super_admin')
 * Strictly excludes 'member' and branch 'employee'.
 */
async function getPermissionUsers(req, res) {
  try {
    if (isPostgres()) {
      const result = await query(
        `SELECT u.id, u.name, u.email, u.username, u.role, u.status, u.branch_id, u.phone,
                u.can_refund, u.can_modify_inventory, u.can_export_reports, u.created_at,
                b.name AS branch_name, b.code AS branch_code
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE u.role IN ('branch_admin', 'hq_employee')
         ORDER BY u.created_at DESC`
      );
      return res.json({ success: true, users: result.rows });
    }

    const users = memoryStore.users || [];
    const branches = memoryStore.branches || [];

    // Strictly enforce role scope: Super Admin manages only HQ staff & branch admins
    const allowedRoles = ['branch_admin', 'hq_employee'];
    const filteredUsers = users
      .filter(u => allowedRoles.includes(u.role))
      .map(u => {
        const branch = branches.find(b => b.id === u.branch_id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.username || u.email.split('@')[0],
          role: u.role,
          status: u.status || 'active',
          branch_id: u.branch_id,
          branch_name: branch?.name || (u.role === 'super_admin' ? 'Global Corporate HQ' : 'Unassigned Branch'),
          branch_code: branch?.code || (u.role === 'super_admin' ? 'HQ-00' : 'N/A'),
          phone: u.phone || '—',
          can_refund: u.can_refund !== false,
          can_modify_inventory: u.can_modify_inventory !== false,
          can_export_reports: u.can_export_reports !== false,
          created_at: u.created_at || new Date('2026-01-01')
        };
      });

    res.json({ success: true, users: filteredUsers });
  } catch (err) {
    console.error('[SuperAdmin getPermissionUsers Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 9. PUT /api/super-admin/permissions/:id (and /users/:id/permissions)
 * Update user role, branch_id, status, and administrative override permissions
 */
async function updateUserPermissions(req, res) {
  try {
    const { id } = req.params;
    const {
      role,
      branch_id,
      status,
      can_refund,
      can_modify_inventory,
      can_export_reports
    } = req.body;

    let targetUser = null;
    if (isPostgres()) {
      const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
      targetUser = userRes.rows[0];
    } else {
      targetUser = (memoryStore.users || []).find(u => u.id === id);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found.' });
    }

    // Role Governance Scope Restriction:
    // If target user has role 'member' or branch 'employee', Super Admin is forbidden from modifying them.
    // Branch members and staff must be managed directly by their respective branch administrator.
    if (targetUser.role === 'member' || targetUser.role === 'employee' || targetUser.role === 'staff') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_SCOPE_VIOLATION',
        message: 'Branch members and staff must be managed directly by their respective branch administrator.'
      });
    }

    // Protection rule: Root Super Admin cannot be demoted or deactivated
    if (targetUser.id === ROOT_SUPER_ADMIN_ID || targetUser.email === ROOT_SUPER_ADMIN_EMAIL) {
      if ((role && role !== 'super_admin') || (status && status !== 'active')) {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_PROTECTED',
          message: 'Root Super Admin account cannot be demoted, reassigned, or deactivated.'
        });
      }
    }

    if (role) targetUser.role = role;
    if (branch_id !== undefined) targetUser.branch_id = branch_id;
    if (status) targetUser.status = status;
    if (can_refund !== undefined) targetUser.can_refund = !!can_refund;
    if (can_modify_inventory !== undefined) targetUser.can_modify_inventory = !!can_modify_inventory;
    if (can_export_reports !== undefined) targetUser.can_export_reports = !!can_export_reports;

    await logAuditEvent({
      user_id: req.user?.id,
      user_role: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_USER_PERMISSIONS',
      resource: `USER:${targetUser.id}`,
      ip_address: req.ip,
      details: {
        target_name: targetUser.name,
        role: targetUser.role,
        branch_id: targetUser.branch_id,
        status: targetUser.status
      }
    });

    res.json({
      success: true,
      message: `Permissions updated for ${targetUser.name}.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        branch_id: targetUser.branch_id,
        status: targetUser.status,
        can_refund: targetUser.can_refund,
        can_modify_inventory: targetUser.can_modify_inventory,
        can_export_reports: targetUser.can_export_reports
      }
    });
  } catch (err) {
    console.error('[SuperAdmin updateUserPermissions Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * 10. GET /api/super-admin/reports
 * Aggregated revenue, royalties (7.5%), turnstiles, and branch performance rating
 */
async function getReports(req, res) {
  try {
    const { branch_id, date_range = 'all' } = req.query;

    const branches = memoryStore.branches || [];
    const sales = memoryStore.sales || [];
    const users = memoryStore.users || [];
    const attendanceLogs = memoryStore.attendance_logs || [];

    const filteredBranches = (branch_id && branch_id !== 'all')
      ? branches.filter(b => b.id === branch_id)
      : branches;

    const branchReports = filteredBranches.map(br => {
      const brSales = sales.filter(s => s.branch_id === br.id);
      const grossRevenue = brSales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const royaltyRate = Number(br.royalty_percentage) || 7.50;
      const corporateRoyalty = grossRevenue * (royaltyRate / 100);
      const activeRosterCount = users.filter(u => u.branch_id === br.id && u.role === 'member' && u.status === 'active').length;
      const turnstileCheckIns = attendanceLogs.filter(a => a.branch_id === br.id).length;

      let performanceRating = 'B Target';
      if (grossRevenue >= 500000) performanceRating = 'A+ Flagship';
      else if (grossRevenue >= 300000) performanceRating = 'A Strong';
      else if (grossRevenue < 100000 && br.status !== 'Under Fit-Out') performanceRating = 'Needs Attention';

      return {
        branch_id: br.id,
        branch_name: br.name,
        branch_code: br.code,
        city: br.city,
        status: br.status || 'Active',
        franchise_agreement: br.franchise_agreement || 'Commercial Franchise Agreement',
        grossRevenue,
        royaltyRate,
        corporateRoyalty,
        activeRosterCount,
        turnstileCheckIns,
        performanceRating
      };
    });

    const totals = {
      totalGrossRevenue: branchReports.reduce((acc, r) => acc + r.grossRevenue, 0),
      totalCorporateRoyalty: branchReports.reduce((acc, r) => acc + r.corporateRoyalty, 0),
      totalMembers: branchReports.reduce((acc, r) => acc + r.activeRosterCount, 0),
      totalCheckIns: branchReports.reduce((acc, r) => acc + r.turnstileCheckIns, 0)
    };

    res.json({
      success: true,
      filters: { branch_id: branch_id || 'all', date_range },
      reports: branchReports,
      totals,
      generatedAt: new Date()
    });
  } catch (err) {
    console.error('[SuperAdmin getReports Error]:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * Public: POST /api/franchise-inquiry
 * Record inquiry from commercial landing page
 */
async function createFranchiseInquiry(req, res) {
  try {
    const { fullName, email, phone, desiredLocation, targetLocation, customRegionDetail, proposedCapital, investmentCapital, notes, experience } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Full name, email, and phone are required.' });
    }

    const baseLocation = (desiredLocation || targetLocation || 'Metro Manila').trim();
    const finalLocation = customRegionDetail ? `${baseLocation} (${customRegionDetail.trim()})` : baseLocation;

    const newInquiry = {
      id: `app-${Date.now().toString().slice(-4)}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      desiredLocation: finalLocation,
      customRegionDetail: customRegionDetail ? customRegionDetail.trim() : null,
      proposedCapital: proposedCapital || investmentCapital || '₱8M – ₱15M',
      experience: experience || 'Direct Web Inquiry',
      notes: notes || 'Prospect requested official franchise disclosure packet.',
      status: 'Pending Review',
      submittedAt: new Date(),
      created_at: new Date()
    };

    if (!memoryStore.franchise_applications) {
      memoryStore.franchise_applications = [];
    }
    memoryStore.franchise_applications.unshift(newInquiry);

    await logAuditEvent({
      action: 'PUBLIC_FRANCHISE_INQUIRY',
      resource: `APPLICATION:${newInquiry.id}`,
      ip_address: req.ip,
      details: { applicant: newInquiry.fullName, location: newInquiry.desiredLocation }
    });

    // Send automated acknowledgment & prospectus email to applicant in background (non-blocking for fast UI response)
    sendFranchiseInquiryEmail({
      toEmail: newInquiry.email,
      applicantName: newInquiry.fullName,
      desiredLocation: newInquiry.desiredLocation,
      proposedCapital: newInquiry.proposedCapital,
      notes: newInquiry.notes
    }).then((emailResult) => {
      console.log(`[createFranchiseInquiry] Automated confirmation email dispatched to ${newInquiry.email}:`, emailResult?.success);
    }).catch((mailErr) => {
      console.warn(`[createFranchiseInquiry] Automated confirmation email error for ${newInquiry.email}:`, mailErr.message);
    });

    res.status(201).json({
      success: true,
      message: 'Franchise inquiry received. Confirmation prospectus sent to your email and KSYN Franchise Director will contact you within 24 hours.',
      inquiry: newInquiry,
      emailSent: true
    });
  } catch (err) {
    console.error('[createFranchiseInquiry Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 8.4. POST /api/franchise-inquiry/reschedule
 * Public / Candidate endpoint allowing an applicant to request a meeting reschedule
 */
async function requestFranchiseReschedule(req, res) {
  try {
    const { applicationId, email, preferredDatetime, reason } = req.body;

    if (!applicationId && !email) {
      return res.status(400).json({ success: false, message: 'Application ID or email is required.' });
    }

    if (!memoryStore.franchise_applications) {
      memoryStore.franchise_applications = [];
    }

    const app = memoryStore.franchise_applications.find(a => 
      (applicationId && (a.id === applicationId || a.id === `app-${applicationId}`)) || 
      (email && a.email && a.email.toLowerCase().trim() === email.toLowerCase().trim())
    );

    if (!app) {
      return res.status(404).json({ success: false, message: 'Franchise inquiry record not found.' });
    }

    app.status = 'Reschedule Requested';
    app.reschedule_requested_at = new Date();
    if (preferredDatetime) {
      app.candidate_preferred_datetime = preferredDatetime;
    }

    const stamp = `[${new Date().toLocaleDateString('en-US')}]`;
    const reschedNote = `${stamp} [Candidate Reschedule Request]: Preferred date/time: ${preferredDatetime || 'Not specified'}.${reason ? ` Note: ${reason}` : ''}`;
    app.admin_notes = app.admin_notes ? `${app.admin_notes}\n${reschedNote}` : reschedNote;
    app.updated_at = new Date();

    if (isPostgres()) {
      try {
        await query(`
          UPDATE franchise_applications SET
            status = 'Reschedule Requested',
            admin_notes = COALESCE(admin_notes || E'\n' || $1, $1),
            updated_at = NOW()
          WHERE id = $2
        `, [reschedNote, app.id]);
      } catch (err) {
        console.warn('[Postgres update error on reschedule]:', err.message);
      }
    }

    await logAuditEvent({
      action: 'PUBLIC_FRANCHISE_RESCHEDULE_REQUESTED',
      resource: `APPLICATION:${app.id}`,
      ip_address: req.ip,
      details: { applicant: app.fullName || app.full_name, preferredDatetime, reason }
    });

    res.json({
      success: true,
      message: 'Your reschedule request has been received by KSYN Executive Management. An updated invitation will be dispatched shortly.',
      application: app
    });
  } catch (err) {
    console.error('[requestFranchiseReschedule Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 8. Cryptographic Audit Chain Verification
 * GET /api/super-admin/audit/verify-chain
 */
async function verifyAuditChainController(req, res) {
  try {
    const { verifyAuditChain } = require('../middleware/auditLogger');
    const report = verifyAuditChain();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 9. Super Admin MFA / 2FA Management
 * GET /api/super-admin/mfa/status
 * POST /api/super-admin/mfa/setup
 * POST /api/super-admin/mfa/verify
 */
async function getMfaStatus(req, res) {
  try {
    const user = req.user;
    res.json({
      success: true,
      mfa_enabled: !!user.mfa_enabled,
      has_backup_codes: Array.isArray(user.backup_codes) && user.backup_codes.length > 0,
      verified_at: user.mfa_verified_at || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function setupMfa(req, res) {
  try {
    const user = memoryStore.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Generate genuine RFC 4648 Base32 TOTP secret & 8 single-use backup codes
    const secret = totp.generateSecret(20); // 32 Base32 characters
    const backupCodes = totp.generateBackupCodes(8);

    user.pending_mfa_secret = secret;
    user.pending_backup_codes = backupCodes;
    saveStore();

    const otpauthUrl = totp.generateOtpAuthUri(user.email, secret, 'KSYN FitConnect HQ');

    res.json({
      success: true,
      secret,
      otpauth_url: otpauthUrl,
      backup_codes: backupCodes,
      message: 'Scan the QR code or enter the secret key into Google Authenticator / Microsoft Authenticator / Authy.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function verifyMfa(req, res) {
  try {
    const { code } = req.body;
    const user = memoryStore.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit TOTP verification code.' });
    }

    const targetSecret = user.pending_mfa_secret || user.mfa_secret;
    if (!targetSecret) {
      return res.status(400).json({ success: false, message: 'MFA setup has not been initiated. Please generate a new QR secret.' });
    }

    // Cryptographic RFC 6238 TOTP verification with +-30s drift tolerance
    const isTotpValid = totp.verifyTotp(cleanCode, targetSecret, { window: 1 });
    const isBackupValid = !isTotpValid && totp.verifyAndConsumeBackupCode(cleanCode, user);

    if (!isTotpValid && !isBackupValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOTP_CODE',
        message: 'Invalid 6-digit authenticator code or expired time-window. Please check Google Authenticator / Authy.'
      });
    }

    user.mfa_enabled = true;
    user.mfa_secret = targetSecret;
    user.backup_codes = user.pending_backup_codes || user.backup_codes || [];
    user.mfa_verified_at = new Date();
    delete user.pending_mfa_secret;
    delete user.pending_backup_codes;

    saveStore();

    if (isPostgres()) {
      try {
        await query(
          'UPDATE users SET mfa_enabled = TRUE, mfa_secret = $1, updated_at = NOW() WHERE id = $2',
          [user.mfa_secret, user.id]
        );
      } catch (dbErr) {
        console.warn('[verifyMfa DB sync]:', dbErr.message);
      }
    }

    await logAuditEvent({
      user_id: user.id,
      user_role: 'super_admin',
      action: 'MFA_ENABLED',
      resource: `USER:${user.id}`,
      ip_address: req.ip,
      details: { method: 'TOTP_RFC6238', verified_via: isTotpValid ? 'TOTP' : 'BACKUP_CODE' }
    });

    res.json({
      success: true,
      message: 'Multi-Factor Authentication (2FA) successfully enforced for this Super Admin session.',
      mfa_enabled: true
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 10. IoT Hardware & Telemetry Network Desk
 * GET /api/super-admin/hardware/telemetry
 */
async function getHardwareTelemetry(req, res) {
  try {
    const branches = memoryStore.branches || [];
    const now = Date.now();

    const telemetry = branches.map(br => {
      const isOnline = br.status ? !br.status.toLowerCase().includes('suspended') : true;

      // Deterministic hardware devices per branch
      const branchSubnets = {
        'MKT-01': 10,
        'KAT-02': 35,
        'ALB-03': 22,
        'KAP-04': 38, // Explicitly re-allocated to 38 to eliminate subnet collision with Katipunan (35)
        'FRV-05': 42,
        'DLM-06': 55,
        'TMO-07': 60
      };
      const subnet = branchSubnets[br.code] || (br.code.charCodeAt(br.code.length - 1) * 3 + 10);

      return {
        branch_id: br.id,
        branch_name: br.name,
        branch_code: br.code,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        last_heartbeat: new Date(now - (isOnline ? 12000 : 86400000)),
        latency_ms: isOnline ? Math.floor(18 + (br.code.charCodeAt(0) % 25)) : null,
        devices: [
          {
            id: `dev-${br.code}-turnstile-01`,
            type: 'TURNSTILE_RFID_BARRIER',
            name: 'Turnstile A (Main Entry)',
            ip: `192.168.${subnet}.101`,
            firmware: 'ESP32-KSYN-v2.4.1',
            status: isOnline ? 'OPERATIONAL' : 'OFFLINE',
            scans_today: Math.floor(65 + (br.code.charCodeAt(0) * 2)),
            relay_state: 'LOCKED'
          },
          {
            id: `dev-${br.code}-qr-cam-01`,
            type: 'OPTICAL_DYNAMIC_QR_READER',
            name: 'FastScan 60FPS Camera Pod',
            ip: `192.168.${subnet}.102`,
            firmware: 'CAM-OVM-v1.8',
            status: isOnline ? 'OPERATIONAL' : 'OFFLINE',
            fps: isOnline ? 60 : 0
          },
          {
            id: `dev-${br.code}-thermal-pos`,
            type: 'THERMAL_RECEIPT_PRINTER',
            name: 'Front Desk 80mm ESC/POS',
            ip: `192.168.${subnet}.105`,
            firmware: 'EPSON-TM-T82III',
            status: isOnline ? 'READY' : 'OFFLINE',
            paper_status: 'NORMAL (78% Roll)'
          }
        ]
      };
    });

    res.json({ success: true, telemetry, generated_at: new Date() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 11. Global Emergency Broadcast System
 * GET /api/super-admin/broadcast
 * POST /api/super-admin/broadcast
 * DELETE /api/super-admin/broadcast/:id
 */
async function getBroadcasts(req, res) {
  try {
    if (!memoryStore.announcements) {
      if (memoryStore.broadcasts && Array.isArray(memoryStore.broadcasts)) {
        memoryStore.announcements = memoryStore.broadcasts;
      } else {
        memoryStore.announcements = [
          {
            id: 'bc-sample-01',
            title: 'Typhoon Protocol: Facility Precautionary Operating Hours',
            message: 'All Metro Manila KSYN clubs will operate under emergency power generators until 10:00 PM tonight. Group classes suspended.',
            type: 'announcement',
            severity: 'warning',
            target_audience: 'all',
            is_active: true,
            created_by_role: 'super_admin',
            created_by_name: 'Super Admin HQ',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
          }
        ];
      }
    }
    memoryStore.broadcasts = memoryStore.announcements;
    res.json({ success: true, broadcasts: memoryStore.announcements, announcements: memoryStore.announcements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createBroadcast(req, res) {
  try {
    const {
      title,
      message,
      type = 'announcement',
      severity = 'info',
      target_audience = 'all',
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
    memoryStore.broadcasts = memoryStore.announcements;

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
      branch_id: null,
      branch_name: 'Network HQ (All Branches)',
      created_by_role: 'super_admin',
      created_by_name: req.user.name || 'Super Admin HQ',
      is_active: true,
      created_at: new Date().toISOString()
    };

    memoryStore.announcements.unshift(newAnnouncement);
    saveStore();

    await logAuditEvent({
      user_id: req.user.id,
      user_role: 'super_admin',
      action: type === 'promo' ? 'GLOBAL_PROMO_PUBLISHED' : 'GLOBAL_BROADCAST_PUBLISHED',
      resource: `ANNOUNCEMENT:${newAnnouncement.id}`,
      ip_address: req.ip,
      details: { title, type, severity, target_audience, promo_code, discount_percentage }
    });

    res.status(201).json({
      success: true,
      broadcast: newAnnouncement,
      announcement: newAnnouncement,
      message: `${type === 'promo' ? 'Special promo' : 'Broadcast announcement'} published successfully.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteBroadcast(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.announcements) memoryStore.announcements = memoryStore.broadcasts || [];
    memoryStore.announcements = memoryStore.announcements.filter(b => b.id !== id);
    memoryStore.broadcasts = memoryStore.announcements;
    saveStore();

    await logAuditEvent({
      user_id: req.user.id,
      user_role: 'super_admin',
      action: 'GLOBAL_BROADCAST_REMOVED',
      resource: `ANNOUNCEMENT:${id}`,
      ip_address: req.ip
    });

    res.json({ success: true, message: 'Announcement deactivated and archived.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 12. Centralized Rate-Card & Global Promo Engine
 * GET /api/super-admin/rate-cards
 * PUT /api/super-admin/rate-cards
 * GET /api/super-admin/promos
 * POST /api/super-admin/promos
 * DELETE /api/super-admin/promos/:id
 */
async function getRateCards(req, res) {
  try {
    if (!memoryStore.rate_cards) {
      memoryStore.rate_cards = [
        { id: 'tier-1m', name: '1-Month All-Access Pass', price: 2500, duration_days: 30, access_type: 'Single Home Branch', is_active: true },
        { id: 'tier-3m', name: '3-Months Peak Commitment Pass', price: 6500, duration_days: 90, access_type: 'Single Home Branch + 3 Roaming Visits', is_active: true },
        { id: 'tier-1y', name: '1-Year Black Elite Passport', price: 21999, duration_days: 365, access_type: 'Unlimited Cross-Branch Roaming', is_active: true },
        { id: 'pass-1day', name: '1-Day Walk-In Pass', price: 350, duration_days: 1, access_type: 'Single Visit', is_active: true }
      ];
    }
    res.json({ success: true, rate_cards: memoryStore.rate_cards });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateRateCards(req, res) {
  try {
    const { rate_cards } = req.body;
    if (!Array.isArray(rate_cards)) {
      return res.status(400).json({ success: false, message: 'rate_cards array is required.' });
    }

    memoryStore.rate_cards = rate_cards;

    await logAuditEvent({
      user_id: req.user.id,
      user_role: 'super_admin',
      action: 'GLOBAL_RATE_CARD_UPDATED',
      resource: 'CONFIG:RATE_CARDS',
      ip_address: req.ip,
      details: { count: rate_cards.length }
    });

    res.json({ success: true, rate_cards: memoryStore.rate_cards, message: 'Master rate card updated across all branch POS terminals.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getPromos(req, res) {
  try {
    if (!memoryStore.promo_codes) {
      memoryStore.promo_codes = [
        { id: 'prm-fit2026', code: 'FITCONNECT2026', discount_percentage: 15, valid_until: '2026-12-31', max_uses: 500, used_count: 82, is_active: true },
        { id: 'prm-elite', code: 'BLACKELITE20', discount_percentage: 20, valid_until: '2026-11-30', max_uses: 100, used_count: 29, is_active: true }
      ];
    }
    res.json({ success: true, promos: memoryStore.promo_codes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createPromo(req, res) {
  try {
    const { code, discount_percentage = 10, valid_until, max_uses = 100 } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Promo code is required.' });

    if (!memoryStore.promo_codes) memoryStore.promo_codes = [];

    const newPromo = {
      id: crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      discount_percentage: Number(discount_percentage) || 10,
      valid_until: valid_until || '2026-12-31',
      max_uses: Number(max_uses) || 100,
      used_count: 0,
      is_active: true,
      created_at: new Date()
    };

    memoryStore.promo_codes.unshift(newPromo);

    await logAuditEvent({
      user_id: req.user.id,
      user_role: 'super_admin',
      action: 'PROMO_CODE_CREATED',
      resource: `PROMO:${newPromo.code}`,
      ip_address: req.ip,
      details: { discount: newPromo.discount_percentage }
    });

    res.status(201).json({ success: true, promo: newPromo, message: `Promo code ${newPromo.code} created.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deletePromo(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.promo_codes) memoryStore.promo_codes = [];
    memoryStore.promo_codes = memoryStore.promo_codes.filter(p => p.id !== id && p.code !== id);
    res.json({ success: true, message: 'Promo code deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getStats,
  getAdmins,
  createAdmin,
  updateAdminStatus,
  registerBranch,
  updateBranchStatus,
  getFranchiseApplications,
  updateFranchiseApplicationStatus,
  contactFranchiseApplicant,
  updateFranchiseStatus,
  getPermissionUsers,
  updateUserPermissions,
  getReports,
  createFranchiseInquiry,
  requestFranchiseReschedule,
  verifyAuditChainController,
  getMfaStatus,
  setupMfa,
  verifyMfa,
  getHardwareTelemetry,
  getBroadcasts,
  createBroadcast,
  deleteBroadcast,
  getRateCards,
  updateRateCards,
  getPromos,
  createPromo,
  deletePromo
};
