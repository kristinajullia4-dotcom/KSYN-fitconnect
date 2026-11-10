const crypto = require('crypto');
const { memoryStore, query, isPostgres } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { sendTransferCoordinationEmail } = require('../utils/mailer');

// 1. Get Branches (Public list or Tenant-Isolated Authenticated list)
async function getAllBranches(req, res) {
  try {
    const user = req.user;

    // If unauthenticated / public request, return active branches without confidential KPI stats
    if (!user) {
      try {
        if (isPostgres()) {
          const result = await query(
            `SELECT id, code, name, city, address, operating_hours, is_active 
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
            operating_hours: b.operating_hours,
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
        console.warn('[Branches] DB query failed, serving fallback active branches:', dbErr.message);
      }

      // Resilient active branches from memoryStore
      const fallbackBranches = (memoryStore.branches || []).filter(b => b.is_active !== false);

      return res.status(200).json({
        success: true,
        branches: fallbackBranches,
        data: fallbackBranches
      });
    }

    let branches = [];

    if (user.role === 'super_admin') {
      branches = memoryStore.branches || [];
    } else {
      // Branch Admin, Employee, or Member can only view their own branch
      branches = (memoryStore.branches || []).filter(b => b.id === user.branch_id);
    }

    // Attach aggregated KPI metrics to each branch
    const enrichedBranches = branches.map(branch => {
      const branchUsers = (memoryStore.users || []).filter(u => u.branch_id === branch.id);
      const memberCount = branchUsers.filter(u => u.role === 'member').length;
      const employeeCount = branchUsers.filter(u => u.role === 'employee').length;

      const branchSales = (memoryStore.sales || []).filter(s => s.branch_id === branch.id);
      const totalRevenue = branchSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);
      const corporateRoyaltyReceivable = (totalRevenue * (Number(branch.royalty_percentage || 0) / 100));

      const branchInventory = (memoryStore.inventory || []).filter(i => i.branch_id === branch.id);
      const lowStockCount = branchInventory.filter(i => i.quantity <= i.reorder_threshold).length;

      return {
        ...branch,
        stats: {
          memberCount,
          employeeCount,
          totalRevenue,
          corporateRoyaltyReceivable,
          lowStockCount
        }
      };
    });

    return res.json({ success: true, branches: enrichedBranches, data: enrichedBranches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, branches: [], data: [] });
  }
}

// 2. Get Single Branch Details
async function getBranchById(req, res) {
  try {
    const { branchId } = req.params;
    const user = req.user;

    // RBAC and Tenant Isolation check
    if (user.role !== 'super_admin' && user.branch_id !== branchId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Unauthorized access to cross-tenant branch details.'
      });
    }

    const branch = memoryStore.branches.find(b => b.id === branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    res.json({ success: true, branch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Register New Franchise Branch (Super Admin only)
async function createBranch(req, res) {
  try {
    const { code, name, address, city, phone, royalty_percentage } = req.body;

    if (!code || !name || !address || !city) {
      return res.status(400).json({ success: false, message: 'Branch code, name, address, and city are required.' });
    }

    const existing = memoryStore.branches.find(b => b.code.toUpperCase() === code.trim().toUpperCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Branch with this code already exists.' });
    }

    const newBranch = {
      id: crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      name,
      address,
      city,
      phone: phone || '',
      royalty_percentage: Number(royalty_percentage) || 7.00,
      is_active: true,
      created_at: new Date()
    };

    memoryStore.branches.push(newBranch);

    await logAuditEvent({
      branch_id: newBranch.id,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'BRANCH_REGISTER',
      resource: 'branches',
      ip_address: req.ip || '127.0.0.1',
      details: { code: newBranch.code, royalty_percentage: newBranch.royalty_percentage }
    });

    res.status(201).json({ success: true, message: 'Franchise branch registered successfully.', branch: newBranch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Update Corporate Royalty Percentage (Super Admin only)
async function updateRoyalty(req, res) {
  try {
    const { branchId } = req.params;
    const { royalty_percentage } = req.body;

    if (royalty_percentage === undefined || isNaN(royalty_percentage)) {
      return res.status(400).json({ success: false, message: 'Valid royalty percentage required.' });
    }

    const branch = memoryStore.branches.find(b => b.id === branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    const oldRate = branch.royalty_percentage;
    branch.royalty_percentage = Number(royalty_percentage);

    await logAuditEvent({
      branch_id: branch.id,
      user_id: req.user.id,
      user_role: req.user.role,
      action: 'ROYALTY_RATE_UPDATE',
      resource: 'branches',
      ip_address: req.ip || '127.0.0.1',
      details: { previous_rate: oldRate, new_rate: branch.royalty_percentage }
    });

    res.json({ success: true, message: 'Royalty rate updated successfully.', branch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Helper: Execute actual branch transfer atomically across multi-tenant boundaries
async function executeActualBranchTransfer({ userToTransfer, oldBranch, newBranch, reason, caller }) {
  const previousBranchId = userToTransfer.branch_id;

  // ATOMIC MULTI-TENANT UPDATE:
  userToTransfer.branch_id = newBranch.id;
  userToTransfer.branch_name = newBranch.name;
  userToTransfer.branch_code = newBranch.code;

  // Update active subscriptions
  if (memoryStore.subscriptions) {
    memoryStore.subscriptions.forEach(sub => {
      if (sub.user_id === userToTransfer.id || (sub.member_id && sub.member_id === userToTransfer.id)) {
        sub.branch_id = newBranch.id;
        sub.branch_name = newBranch.name;
      }
    });
  }

  if (memoryStore.membership_subscriptions) {
    memoryStore.membership_subscriptions.forEach(sub => {
      if (sub.user_id === userToTransfer.id || (sub.member_id && sub.member_id === userToTransfer.id)) {
        sub.branch_id = newBranch.id;
        sub.branch_name = newBranch.name;
      }
    });
  }

  // Update PT enrollments to destination facility
  if (memoryStore.pt_enrollments) {
    memoryStore.pt_enrollments.forEach(e => {
      if (e.member_id === userToTransfer.id || e.user_id === userToTransfer.id) {
        e.branch_id = newBranch.id;
      }
    });
  }

  // Update PT client contracts to destination facility
  if (memoryStore.pt_clients) {
    memoryStore.pt_clients.forEach(c => {
      if (c.client_id === userToTransfer.id || c.id === userToTransfer.id) {
        c.branch_id = newBranch.id;
      }
    });
  }

  // Update coaching/staff assignments if applicable
  if (['coach', 'trainer'].includes(userToTransfer.role)) {
    if (memoryStore.coaches) {
      const coachProfile = memoryStore.coaches.find(c => c.id === userToTransfer.id || c.name === userToTransfer.name);
      if (coachProfile) {
        coachProfile.branch_id = newBranch.id;
        coachProfile.branch_name = newBranch.name;
      }
    }
  }

  // NOTIFICATION DISPATCH LOGIC (3-Channel Multi-Tenant Alerts)
  if (!memoryStore.notifications) memoryStore.notifications = [];
  const notifTimestamp = new Date();

  // 1. User/Member notification
  const userNotif = {
    id: 'notif-' + crypto.randomUUID(),
    target_user_id: userToTransfer.id,
    title: 'Branch Transfer Completed: Welcome to ' + newBranch.name,
    message: `Your home branch has been successfully transferred from ${oldBranch.name} to ${newBranch.name}. Your active membership plan, digital pass, and turnstile credentials are now live at ${newBranch.name}.`,
    category: 'BRANCH_TRANSFER',
    branch_id: newBranch.id,
    created_at: notifTimestamp,
    read: false
  };
  memoryStore.notifications.unshift(userNotif);

  // 2. Source Branch Admin notification (Transfer Out)
  const sourceBranchNotif = {
    id: 'notif-' + crypto.randomUUID(),
    target_role: 'branch_admin',
    branch_id: previousBranchId,
    title: `Transfer Out Notice: ${userToTransfer.name}`,
    message: `${userToTransfer.name} (${userToTransfer.role.toUpperCase()}) has transferred their home branch from ${oldBranch.name} to ${newBranch.name}.${reason ? ' Reason: ' + reason : ''} Active facility access at this branch has been decommissioned.`,
    category: 'BRANCH_TRANSFER_OUT',
    created_at: notifTimestamp,
    read: false
  };
  memoryStore.notifications.unshift(sourceBranchNotif);

  // 3. Destination Branch Admin notification (Transfer In)
  const destBranchNotif = {
    id: 'notif-' + crypto.randomUUID(),
    target_role: 'branch_admin',
    branch_id: newBranch.id,
    title: `Transfer In Notice: ${userToTransfer.name}`,
    message: `New transfer arrival: ${userToTransfer.name} (${userToTransfer.role.toUpperCase()}) has joined ${newBranch.name} via branch relocation. Their membership profile is now active on your branch roster.`,
    category: 'BRANCH_TRANSFER_IN',
    created_at: notifTimestamp,
    read: false
  };
  memoryStore.notifications.unshift(destBranchNotif);

  // 4. SMS Dispatch to user phone
  if (userToTransfer.phone) {
    try {
      const { sendSms } = require('../utils/smsGateway');
      await sendSms(
        userToTransfer.phone,
        `[KSYN Fitness] Your branch transfer to ${newBranch.name} is complete. Your turnstile pass is now active. Welcome to your new home facility!`,
        { category: 'BRANCH_TRANSFER', branch_id: newBranch.id }
      );
    } catch (smsErr) {
      console.warn('[BranchTransfer] SMS dispatch skipped:', smsErr.message);
    }
  }

  // 5. Audit Logging
  await logAuditEvent({
    branch_id: newBranch.id,
    user_id: caller.id,
    user_role: caller.role,
    action: 'BRANCH_TRANSFER_EXECUTED',
    resource: 'users',
    ip_address: caller.ip || '127.0.0.1',
    details: {
      transferred_user_id: userToTransfer.id,
      user_name: userToTransfer.name,
      role: userToTransfer.role,
      origin_branch: oldBranch.name,
      destination_branch: newBranch.name,
      reason: reason || 'Relocation Request'
    }
  });

  const { saveStore } = require('../config/db');
  if (typeof saveStore === 'function') {
    saveStore();
  }

  return {
    success: true,
    message: `Successfully transferred ${userToTransfer.name} to ${newBranch.name} with strict tenant data isolation.`,
    user: {
      id: userToTransfer.id,
      name: userToTransfer.name,
      email: userToTransfer.email,
      branch_id: userToTransfer.branch_id,
      branch_name: userToTransfer.branch_name,
      branch_code: userToTransfer.branch_code
    }
  };
}

// 5. Audited Multi-Tenant Branch Transfer (Members, Coaches, Staff, Branch Admins)
async function transferUserBranch(req, res) {
  try {
    const { userId, user_id, targetBranchId, target_branch_id, branchId, branch_id, reason } = req.body;
    const caller = req.user;

    const rawTargetBranch = targetBranchId || target_branch_id || branchId || branch_id;
    if (!rawTargetBranch) {
      return res.status(400).json({ success: false, message: 'Destination target branch ID is required.' });
    }

    const branches = memoryStore.branches || [];

    // Normalize common branch IDs, legacy slugs, and aliases to official branch ID
    const normalizeBranch = (input) => {
      if (!input) return null;
      const str = String(input).trim().toLowerCase();
      if (str === 'b-mkt-01' || str === 'mkt-01' || str.includes('makati')) return 'b-mkt-01';
      if (str === 'b-kat-02' || str === 'kat-02' || str.includes('katipunan')) return 'b-kat-02';
      if (str === 'b-alb-03' || str === 'alb-03' || str.includes('alabang')) return 'b-alb-03';
      if (str === 'b-kap-04' || str === 'b-kap-05' || str === 'kap-04' || str === 'kap-05' || str.includes('kapitolyo')) return 'b-kap-04';
      if (str === 'b-frv-05' || str === 'b-fair-04' || str === 'b-fair' || str === 'frv-05' || str.includes('fairview')) return 'b-frv-05';
      if (str === 'b-del-06' || str === 'dlm-06' || str.includes('del monte') || str.includes('delmonte')) return 'b-del-06';
      if (str === 'b-tm-07' || str === 'tmo-07' || str.includes('morato')) return 'b-tm-07';
      return input;
    };

    const resolvedTargetBranchId = normalizeBranch(rawTargetBranch);

    // Determine target user
    const targetUserId = userId || user_id || caller.id;

    // RBAC & Tenant Permission Check:
    // Super Admin can transfer anyone immediately.
    // Branch Admin can approve or transfer to/from their branch.
    // Member/Coach/Staff can submit transfer requests requiring destination Branch Admin confirmation.
    const isSelf = caller.id === targetUserId;
    const isSuperAdmin = caller.role === 'super_admin';
    const isBranchAdmin = ['branch_admin', 'branch_owner'].includes(caller.role);

    const userToTransfer = (memoryStore.users || []).find(u => u.id === targetUserId || u.email === targetUserId);
    if (!userToTransfer) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    if (!isSuperAdmin && !isSelf) {
      if (!isBranchAdmin || (userToTransfer.branch_id !== caller.branch_id && caller.branch_id !== resolvedTargetBranchId)) {
        return res.status(403).json({
          success: false,
          message: 'Tenant violation: You can only transfer users stationed at or arriving at your own branch.'
        });
      }
    }

    const oldBranch = branches.find(b => b.id === userToTransfer.branch_id) || { id: userToTransfer.branch_id, name: 'Origin Facility', code: 'ORIG-01' };
    let newBranch = branches.find(b => b.id === resolvedTargetBranchId || b.code === resolvedTargetBranchId);
    if (!newBranch) {
      newBranch = branches.find(b => b.name && b.name.toLowerCase().includes(String(rawTargetBranch).toLowerCase()));
    }

    if (!newBranch) {
      return res.status(400).json({ success: false, message: 'Invalid target branch ID.' });
    }

    if (userToTransfer.branch_id === resolvedTargetBranchId) {
      return res.status(400).json({ success: false, message: 'User is already assigned to this branch.' });
    }

    // If super_admin OR caller is the destination branch admin, execute immediately:
    if (isSuperAdmin || (isBranchAdmin && caller.branch_id === resolvedTargetBranchId)) {
      const result = await executeActualBranchTransfer({
        userToTransfer,
        oldBranch,
        newBranch,
        reason,
        caller: { ...caller, ip: req.ip }
      });
      return res.status(200).json(result);
    }

    // 2-stage verification:
    // If the transfer is executed by the origin home branch admin directly, Stage 1 clearance
    // is granted upon creation and forwarded directly to the destination branch admin (Stage 2).
    // If submitted by a member/staff, Stage 1 clearance is required by the origin home branch first.
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];

    const existingPending = memoryStore.branch_transfer_requests.find(
      r => r.user_id === userToTransfer.id && ['PENDING_APPROVAL', 'PENDING_ORIGIN_CLEARANCE', 'PENDING_DESTINATION_ACCEPTANCE'].includes(r.status)
    );
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: `A transfer request for ${userToTransfer.name} to ${existingPending.to_branch_name} is already pending.`
      });
    }

    const isInitiatedByOriginAdmin = isBranchAdmin && (caller.branch_id === oldBranch.id || caller.branch_id === userToTransfer.branch_id);
    const initialStatus = isInitiatedByOriginAdmin ? 'PENDING_DESTINATION_ACCEPTANCE' : 'PENDING_ORIGIN_CLEARANCE';
    const initialStage = isInitiatedByOriginAdmin ? 2 : 1;

    const transferRequest = {
      id: 'xfer-' + crypto.randomUUID(),
      user_id: userToTransfer.id,
      user_name: userToTransfer.name,
      user_role: userToTransfer.role || 'member',
      user_email: userToTransfer.email,
      from_branch_id: oldBranch.id,
      from_branch_name: oldBranch.name,
      to_branch_id: newBranch.id,
      to_branch_name: newBranch.name,
      to_branch_code: newBranch.code,
      reason: reason || 'Facility Relocation Request',
      status: initialStatus,
      stage: initialStage,
      origin_approved_at: isInitiatedByOriginAdmin ? new Date().toISOString() : null,
      origin_approved_by: isInitiatedByOriginAdmin ? (caller.name || caller.id) : null,
      requested_at: new Date().toISOString(),
      requested_by: caller.id,
      requester_name: caller.name,
      requester_role: caller.role
    };

    memoryStore.branch_transfer_requests.unshift(transferRequest);

    if (!memoryStore.notifications) memoryStore.notifications = [];

    if (isInitiatedByOriginAdmin) {
      // Direct Stage 2 routing: Destination Branch Admin receives the inbound transfer request directly
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_role: 'branch_admin',
        branch_id: newBranch.id,
        title: `Inbound Branch Transfer: ${userToTransfer.name} (${(userToTransfer.role || 'member').toUpperCase()})`,
        message: `${oldBranch.name} has authorized transferring ${userToTransfer.name} to ${newBranch.name}. Reason: ${transferRequest.reason}. Verification and final acceptance required before activating on your branch roster.`,
        category: 'BRANCH_TRANSFER_REQUEST',
        created_at: new Date(),
        read: false
      });

      // Member notification
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: userToTransfer.id,
        title: 'Branch Transfer in Progress: Cleared by ' + oldBranch.name,
        message: `Your transfer from ${oldBranch.name} to ${newBranch.name} was approved by ${oldBranch.name}. It is now pending final acceptance by ${newBranch.name}. Your active plan and workout progress remain active.`,
        category: 'BRANCH_TRANSFER_PENDING',
        branch_id: userToTransfer.branch_id,
        created_at: new Date(),
        read: false
      });
    } else {
      // Stage 1 routing: Origin Home Branch Admin reviews clearance first
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_role: 'branch_admin',
        branch_id: oldBranch.id,
        title: `Branch Transfer Clearance: ${userToTransfer.name} (${(userToTransfer.role || 'member').toUpperCase()})`,
        message: `${userToTransfer.name} requested transfer from ${oldBranch.name} to ${newBranch.name}. Reason: ${transferRequest.reason}. As the home facility holding this member's contract and records, your review and clearance approval is required to release the transfer.`,
        category: 'BRANCH_TRANSFER_REQUEST',
        created_at: new Date(),
        read: false
      });

      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: userToTransfer.id,
        title: 'Branch Transfer Request Submitted',
        message: `Your transfer request to ${newBranch.name} has been submitted. It is pending clearance approval from your home branch (${oldBranch.name}).`,
        category: 'BRANCH_TRANSFER_PENDING',
        branch_id: userToTransfer.branch_id,
        created_at: new Date(),
        read: false
      });
    }

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.status(200).json({
      success: true,
      pendingApproval: true,
      stage: initialStage,
      request: transferRequest,
      message: isInitiatedByOriginAdmin
        ? `Transfer request authorized and released to ${newBranch.name}. The receiving branch admin has received the inbound transfer request for review & final acceptance.`
        : `Transfer request to ${newBranch.name} submitted. Awaiting Stage 1 clearance approval by home branch (${oldBranch.name}).`
    });
  } catch (err) {
    console.error('[transferUserBranch error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to submit branch transfer.' });
  }
}

// 6. Get Pending & Historical Branch Transfer Requests (2-Stage Approval Routing)
async function getPendingTransferRequests(req, res) {
  try {
    const caller = req.user;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    
    let allBranchRequests = memoryStore.branch_transfer_requests;
    if (caller.role !== 'super_admin') {
      const branchId = caller.branch_id || 'b-mkt-01';
      allBranchRequests = allBranchRequests.filter(r => r.from_branch_id === branchId || r.to_branch_id === branchId);
    }

    const activeStatuses = ['PENDING_APPROVAL', 'PENDING_ORIGIN_CLEARANCE', 'PENDING_DESTINATION_ACCEPTANCE'];
    const activeCount = allBranchRequests.filter(r => activeStatuses.includes(r.status)).length;
    const declinedCount = allBranchRequests.filter(r => ['DECLINED_BY_DESTINATION', 'DECLINED_BY_ORIGIN'].includes(r.status) && !r.dismissed).length;
    const completedCount = allBranchRequests.filter(r => r.status === 'APPROVED').length;

    const filter = (req.query.filter || 'all').toLowerCase();
    let requests = allBranchRequests;
    if (filter === 'active' || filter === 'pending') {
      requests = allBranchRequests.filter(r => activeStatuses.includes(r.status));
    } else if (filter === 'declined') {
      requests = allBranchRequests.filter(r => ['DECLINED_BY_DESTINATION', 'DECLINED_BY_ORIGIN'].includes(r.status) && !r.dismissed);
    } else if (filter === 'approved' || filter === 'completed') {
      requests = allBranchRequests.filter(r => r.status === 'APPROVED');
    } else {
      // 'all': return active requests plus non-dismissed declined and completed
      requests = allBranchRequests.filter(r => !r.dismissed || activeStatuses.includes(r.status));
    }

    const enriched = requests.map(r => {
      const isOrigin = caller.role === 'super_admin' || r.from_branch_id === caller.branch_id;
      const isDestination = caller.role === 'super_admin' || r.to_branch_id === caller.branch_id;
      const isStage1 = r.status === 'PENDING_ORIGIN_CLEARANCE' || r.status === 'PENDING_APPROVAL';
      const isStage2 = r.status === 'PENDING_DESTINATION_ACCEPTANCE';
      const isDeclined = r.status === 'DECLINED_BY_DESTINATION' || r.status === 'DECLINED_BY_ORIGIN';
      const isApproved = r.status === 'APPROVED';
      const isCancelled = r.status === 'CANCELLED';

      // Look up target and origin branch admins from store
      const toAdmin = (memoryStore.users || []).find(u => u.branch_id === r.to_branch_id && (u.role === 'branch_admin' || u.role === 'branch_owner'));
      const fromAdmin = (memoryStore.users || []).find(u => u.branch_id === r.from_branch_id && (u.role === 'branch_admin' || u.role === 'branch_owner'));

      const toAdminName = toAdmin ? toAdmin.name : `${r.to_branch_name} Admin`;
      const toAdminEmail = toAdmin ? toAdmin.email : `admin.${(r.to_branch_code || 'branch').toLowerCase()}@ksyn.com`;
      const fromAdminName = fromAdmin ? fromAdmin.name : `${r.from_branch_name} Admin`;
      const fromAdminEmail = fromAdmin ? fromAdmin.email : `admin.${(r.from_branch_code || 'branch').toLowerCase()}@ksyn.com`;

      // Home branch has action required in Stage 1
      // Destination branch has action required in Stage 2
      const canApprove = (caller.role === 'super_admin' || (isOrigin && isStage1) || (isDestination && isStage2)) && !isDeclined && !isApproved && !isCancelled;
      const canCancel = (caller.role === 'super_admin' || isOrigin || caller.id === r.user_id) && !isApproved && !isDeclined && !isCancelled;

      let actionLabel = 'Review';
      let stageDescription = '';
      if (isStage1) {
        actionLabel = isOrigin ? 'Approve & Forward to Target Branch' : 'Awaiting Home Branch Clearance';
        stageDescription = `Stage 1/2: Home Branch (${r.from_branch_name}) clearance required`;
      } else if (isStage2) {
        actionLabel = isDestination ? 'Accept & Finalize Transfer' : 'Awaiting Target Branch Acceptance';
        stageDescription = `Stage 2/2: Destination Facility (${r.to_branch_name}) acceptance required`;
      } else if (r.status === 'DECLINED_BY_DESTINATION') {
        actionLabel = 'Declined by Target Facility';
        stageDescription = `Declined by ${r.to_branch_name}: ${r.rejection_reason || 'Facility capacity or administrative constraints'}`;
      } else if (r.status === 'DECLINED_BY_ORIGIN') {
        actionLabel = 'Declined by Home Facility';
        stageDescription = `Declined by ${r.from_branch_name}: ${r.rejection_reason || 'Home clearance withheld'}`;
      } else if (isApproved) {
        actionLabel = 'Transfer Completed';
        stageDescription = `Completed & Activated at ${r.to_branch_name}`;
      } else if (isCancelled) {
        actionLabel = 'Transfer Cancelled';
        stageDescription = `Cancelled: ${r.cancel_reason || 'Withdrawn by requester'}`;
      }

      return {
        ...r,
        to_branch_admin_name: toAdminName,
        to_branch_admin_email: toAdminEmail,
        from_branch_admin_name: fromAdminName,
        from_branch_admin_email: fromAdminEmail,
        is_origin_branch: r.from_branch_id === caller.branch_id,
        is_destination_branch: r.to_branch_id === caller.branch_id,
        is_stage_1: isStage1,
        is_stage_2: isStage2,
        is_declined: isDeclined,
        is_approved: isApproved,
        is_cancelled: isCancelled,
        can_approve: canApprove,
        can_cancel: canCancel,
        action_label: actionLabel,
        stage_description: stageDescription
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      activeCount,
      declinedCount,
      completedCount,
      requests: enriched
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, requests: [] });
  }
}

// 7. Approve / Advance Transfer (2-Stage Multi-Branch Approval)
async function approveTransferRequest(req, res) {
  try {
    const { requestId } = req.params;
    const caller = req.user;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    const request = memoryStore.branch_transfer_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    const branches = memoryStore.branches || [];
    const oldBranch = branches.find(b => b.id === request.from_branch_id) || { id: request.from_branch_id, name: request.from_branch_name, code: 'ORIG-01' };
    const newBranch = branches.find(b => b.id === request.to_branch_id) || { id: request.to_branch_id, name: request.to_branch_name, code: request.to_branch_code || 'DEST-01' };

    const userToTransfer = (memoryStore.users || []).find(u => u.id === request.user_id || u.email === request.user_email);
    if (!userToTransfer) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    // =========================================================================
    // STAGE 1: ORIGIN HOME BRANCH APPROVAL
    // =========================================================================
    if (request.status === 'PENDING_ORIGIN_CLEARANCE' || request.status === 'PENDING_APPROVAL') {
      if (caller.role !== 'super_admin' && request.from_branch_id !== caller.branch_id) {
        return res.status(403).json({
          success: false,
          message: `Tenant violation: Only the origin home branch (${request.from_branch_name}) holding member records can approve Stage 1 clearance.`
        });
      }

      // Advance to Stage 2: Destination Branch Acceptance
      request.status = 'PENDING_DESTINATION_ACCEPTANCE';
      request.stage = 2;
      request.origin_approved_at = new Date().toISOString();
      request.origin_approved_by = caller.name || caller.id;

      // Member data remains stationed at oldBranch until destination branch accepts!

      // Dispatch Notification to Destination Branch Admin (Stage 2 Action Required):
      if (!memoryStore.notifications) memoryStore.notifications = [];
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_role: 'branch_admin',
        branch_id: newBranch.id, // Destination branch gets notified now!
        title: `Inbound Transfer Acceptance: ${request.user_name}`,
        message: `${request.user_name} (${(request.user_role || 'member').toUpperCase()}) has been cleared and released by ${oldBranch.name}. Verification and final acceptance required before incoming member is activated on your branch roster.`,
        category: 'BRANCH_TRANSFER_REQUEST',
        created_at: new Date(),
        read: false
      });

      // Dispatch Notification to User:
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: request.user_id,
        title: 'Home Branch Clearance Approved',
        message: `Your transfer clearance was approved by your home branch (${oldBranch.name}). Your request has now been forwarded to ${newBranch.name} for final enrollment acceptance.`,
        category: 'BRANCH_TRANSFER_PENDING',
        branch_id: request.from_branch_id,
        created_at: new Date(),
        read: false
      });

      const { saveStore } = require('../config/db');
      if (typeof saveStore === 'function') {
        saveStore();
      }

      return res.json({
        success: true,
        stage: 1,
        message: `Transfer clearance approved by ${oldBranch.name}! Request forwarded to ${newBranch.name} for final acceptance. Member records remain stationed at ${oldBranch.name} until accepted.`,
        request
      });
    }

    // =========================================================================
    // STAGE 2: DESTINATION TARGET BRANCH ACCEPTANCE
    // =========================================================================
    if (request.status === 'PENDING_DESTINATION_ACCEPTANCE') {
      if (caller.role !== 'super_admin' && request.to_branch_id !== caller.branch_id) {
        return res.status(403).json({
          success: false,
          message: `Tenant violation: Only the target destination branch (${request.to_branch_name}) can finalize Stage 2 acceptance.`
        });
      }

      // Execute atomic transfer across multi-tenant boundaries
      const result = await executeActualBranchTransfer({
        userToTransfer,
        oldBranch,
        newBranch,
        reason: request.reason,
        caller: { ...caller, ip: req.ip }
      });

      request.status = 'APPROVED';
      request.stage = 2;
      request.destination_approved_at = new Date().toISOString();
      request.destination_approved_by = caller.name || caller.id;
      request.approved_at = new Date().toISOString();
      request.approved_by = caller.name || caller.id;

      const { saveStore } = require('../config/db');
      if (typeof saveStore === 'function') {
        saveStore();
      }

      return res.json({
        success: true,
        stage: 2,
        message: `Transfer finalized! ${userToTransfer.name} (${userToTransfer.role.toUpperCase()}) records and continuing plan have been activated at ${newBranch.name} and cleared from ${oldBranch.name}.`,
        request,
        user: result.user
      });
    }

    return res.status(400).json({ success: false, message: `Request is already ${request.status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Decline Transfer Request (2-Stage Multi-Branch Routing)
async function rejectTransferRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { reason = 'Capacity or Administrative Constraints' } = req.body;
    const caller = req.user;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    const request = memoryStore.branch_transfer_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    // =========================================================================
    // STAGE 1 DECLINE: BY ORIGIN HOME BRANCH
    // =========================================================================
    if (request.status === 'PENDING_ORIGIN_CLEARANCE' || request.status === 'PENDING_APPROVAL') {
      if (caller.role !== 'super_admin' && request.from_branch_id !== caller.branch_id) {
        return res.status(403).json({
          success: false,
          message: `Tenant violation: Only the origin home branch (${request.from_branch_name}) can decline Stage 1 clearance.`
        });
      }

      request.status = 'DECLINED_BY_ORIGIN';
      request.rejected_at = new Date().toISOString();
      request.rejected_by = caller.name || caller.id;
      request.rejection_reason = reason;

      // Member data remains stationed at Home Branch. Request does not reach Destination Branch.
      if (!memoryStore.notifications) memoryStore.notifications = [];
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: request.user_id,
        title: 'Branch Transfer Clearance Declined',
        message: `Your transfer request to ${request.to_branch_name} was declined by your home branch (${request.from_branch_name}). Reason: ${reason}. Your profile remains stationed at ${request.from_branch_name}.`,
        category: 'BRANCH_TRANSFER_REJECTED',
        branch_id: request.from_branch_id,
        created_at: new Date(),
        read: false
      });

      const { saveStore } = require('../config/db');
      if (typeof saveStore === 'function') {
        saveStore();
      }

      return res.json({ success: true, stage: 1, message: 'Transfer request declined by home branch.', request });
    }

    // =========================================================================
    // STAGE 2 DECLINE: BY DESTINATION TARGET BRANCH
    // =========================================================================
    if (request.status === 'PENDING_DESTINATION_ACCEPTANCE') {
      if (caller.role !== 'super_admin' && request.to_branch_id !== caller.branch_id) {
        return res.status(403).json({
          success: false,
          message: `Tenant violation: Only the target destination branch (${request.to_branch_name}) can decline Stage 2 acceptance.`
        });
      }

      request.status = 'DECLINED_BY_DESTINATION';
      request.rejected_at = new Date().toISOString();
      request.rejected_by = caller.name || caller.id;
      request.rejection_reason = reason;

      // Member data remains stationed at Home Branch!
      if (!memoryStore.notifications) memoryStore.notifications = [];
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: request.user_id,
        title: 'Branch Transfer Declined by Destination Facility',
        message: `Your transfer was cleared by ${request.from_branch_name}, but ${request.to_branch_name} could not accept enrollment at this time. Reason: ${reason}. Your membership records remain active at ${request.from_branch_name}.`,
        category: 'BRANCH_TRANSFER_REJECTED',
        branch_id: request.from_branch_id,
        created_at: new Date(),
        read: false
      });

      // Notify Home Branch Admin that destination declined, so member remains in their roster
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_role: 'branch_admin',
        branch_id: request.from_branch_id,
        title: `Transfer Declined by ${request.to_branch_name}: ${request.user_name}`,
        message: `${request.to_branch_name} declined the incoming transfer for ${request.user_name}. Reason: ${reason}. Member records and continuing plan remain stationed at your branch.`,
        category: 'BRANCH_TRANSFER_REJECTED',
        created_at: new Date(),
        read: false
      });

      const { saveStore } = require('../config/db');
      if (typeof saveStore === 'function') {
        saveStore();
      }

      return res.json({
        success: true,
        stage: 2,
        message: `Transfer declined by destination facility. Member records remain active at ${request.from_branch_name}.`,
        request
      });
    }

    return res.status(400).json({ success: false, message: `Request is already ${request.status}.` });

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({ success: true, message: 'Transfer request declined.', request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 9. Send Transfer Coordination Email between Branch Admins
async function contactTransferAdmin(req, res) {
  try {
    const { requestId } = req.params;
    const {
      recipient_email,
      recipient_name,
      subject,
      message,
      is_urgent = false
    } = req.body;
    const caller = req.user;

    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    const request = memoryStore.branch_transfer_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    // Determine target admin email if not explicitly provided
    let targetEmail = recipient_email;
    let targetName = recipient_name;
    if (!targetEmail) {
      const targetUser = (memoryStore.users || []).find(u => u.branch_id === request.to_branch_id && (u.role === 'branch_admin' || u.role === 'branch_owner'));
      targetEmail = targetUser ? targetUser.email : `admin.${(request.to_branch_code || 'branch').toLowerCase()}@ksyn.com`;
      targetName = targetUser ? targetUser.name : `${request.to_branch_name} Administration`;
    }

    const emailSubject = subject || `[KSYN Transfer Coordination] Member Relocation Clearance: ${request.user_name || 'Member'} (${request.id})`;
    const defaultBody = message || `Hello ${targetName},\n\nWe are coordinating the member transfer for ${request.user_name} (${request.user_email || 'Member'}) from ${request.from_branch_name} to ${request.to_branch_name}.\n\nPlease review the transfer clearance requirements.\n\nBest regards,\n${caller.name} (${caller.role})`;

    // Dispatch email via mailer utility
    await sendTransferCoordinationEmail({
      recipientEmail: targetEmail,
      recipientName: targetName,
      senderName: caller.name,
      senderBranchName: caller.branch_name || 'KSYN Operations',
      memberName: request.user_name,
      memberEmail: request.user_email,
      originBranchName: request.from_branch_name,
      targetBranchName: request.to_branch_name,
      requestId: request.id,
      subject: emailSubject,
      message: defaultBody
    });

    // Advance transfer to Stage 2: Directly notifies and requests target branch admin
    request.status = 'PENDING_DESTINATION_ACCEPTANCE';
    request.email_dispatched = true;
    request.home_cleared = true;
    request.is_stage_2 = true;
    request.origin_cleared_at = new Date();
    request.declined = false;
    request.rejected = false;
    request.notes = (request.notes ? request.notes + ' | ' : '') + `Coordination email dispatched by ${caller.name} to ${targetName} (${targetEmail}). Re-queued for destination acceptance.`;

    // Record audit event in SHA-256 chain
    await logAuditEvent({
      event_type: 'INTER_BRANCH_TRANSFER_COORDINATION_EMAIL',
      user_id: caller.id,
      user_name: caller.name,
      user_role: caller.role,
      branch_id: caller.branch_id,
      details: {
        requestId: request.id,
        member_name: request.user_name,
        member_email: request.user_email,
        from_branch: request.from_branch_name,
        to_branch: request.to_branch_name,
        recipient_email: targetEmail,
        recipient_name: targetName,
        transitioned_to: 'PENDING_DESTINATION_ACCEPTANCE',
        is_urgent
      }
    });

    return res.json({
      success: true,
      message: `Official coordination email sent to ${targetName} (${targetEmail})`,
      recipient_email: targetEmail,
      recipient_name: targetName
    });
  } catch (err) {
    console.error('[contactTransferAdmin error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 9. Cancel / Withdraw Transfer Request
async function cancelTransferRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { reason = 'Cancelled by administration' } = req.body;
    const caller = req.user;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    const request = memoryStore.branch_transfer_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    const isOrigin = caller.role === 'super_admin' || request.from_branch_id === caller.branch_id;
    const isSelf = caller.id === request.user_id;
    if (!isOrigin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Only the originating branch or user can cancel this transfer.' });
    }

    if (['APPROVED', 'CANCELLED'].includes(request.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a transfer that is already ${request.status}.` });
    }

    request.status = 'CANCELLED';
    request.cancelled_at = new Date().toISOString();
    request.cancelled_by = caller.name || caller.id;
    request.cancel_reason = reason;

    if (!memoryStore.notifications) memoryStore.notifications = [];
    // Notify member if admin cancelled
    if (!isSelf) {
      memoryStore.notifications.unshift({
        id: 'notif-' + crypto.randomUUID(),
        target_user_id: request.user_id,
        title: 'Branch Transfer Request Cancelled',
        message: `Your transfer request to ${request.to_branch_name} has been cancelled. Your membership records remain stationed at ${request.from_branch_name}.`,
        category: 'BRANCH_TRANSFER_CANCELLED',
        branch_id: request.from_branch_id,
        created_at: new Date(),
        read: false
      });
    }

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({
      success: true,
      message: `Transfer request for ${request.user_name} has been cancelled. Member records remain active at ${request.from_branch_name}.`,
      request
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 10. Dismiss / Archive Declined Transfer Request
async function dismissTransferRequest(req, res) {
  try {
    const { requestId } = req.params;
    const caller = req.user;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    const request = memoryStore.branch_transfer_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    request.dismissed = true;
    request.dismissed_at = new Date().toISOString();
    request.dismissed_by = caller.name || caller.id;

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({ success: true, message: 'Transfer request dismissed from view.', request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 11. Member / Staff Status Check for Pending / Recent Transfer
async function getMyTransferStatus(req, res) {
  try {
    const userId = req.user.id;
    if (!memoryStore.branch_transfer_requests) memoryStore.branch_transfer_requests = [];
    
    // Find most recent transfer request for this user
    const userRequests = memoryStore.branch_transfer_requests
      .filter(r => r.user_id === userId)
      .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

    const latest = userRequests[0] || null;
    if (!latest) {
      return res.json({ success: true, hasPending: false, isDeclined: false, isApproved: false, request: null });
    }

    const isPending = ['PENDING_APPROVAL', 'PENDING_ORIGIN_CLEARANCE', 'PENDING_DESTINATION_ACCEPTANCE'].includes(latest.status);
    const isDeclined = ['DECLINED_BY_DESTINATION', 'DECLINED_BY_ORIGIN'].includes(latest.status) && !latest.dismissed;
    const isApproved = latest.status === 'APPROVED';

    return res.json({
      success: true,
      hasPending: isPending,
      isDeclined: isDeclined,
      isApproved: isApproved,
      request: latest
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateRoyalty,
  transferUserBranch,
  getPendingTransferRequests,
  approveTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,
  dismissTransferRequest,
  contactTransferAdmin,
  getMyTransferStatus
};
