const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { memoryStore, query, isPostgres, savePersistentStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

const branchMap = {
  'b1': 'b-mkt-01', 'b2': 'b-kat-02', 'b3': 'b-alb-03', 'b4': 'b-kap-04',
  'b5': 'b-frv-05', 'b6': 'b-del-06', 'b7': 'b-tm-07',
  'MKT-01': 'b-mkt-01', 'KAT-02': 'b-kat-02', 'ALB-03': 'b-alb-03', 'KAP-04': 'b-kap-04',
  'FRV-05': 'b-frv-05', 'DLM-06': 'b-del-06', 'TMO-07': 'b-tm-07',
  'b-mkt-01': 'b-mkt-01', 'b-kat-02': 'b-kat-02', 'b-alb-03': 'b-alb-03', 'b-kap-04': 'b-kap-04',
  'b-frv-05': 'b-frv-05', 'b-del-06': 'b-del-06', 'b-tm-07': 'b-tm-07'
};

function normalizeBranchId(rawId) {
  if (!rawId) return null;
  return branchMap[rawId] || rawId;
}

const ALLOWED_STAFF_ROLES = ['branch_admin', 'coach', 'employee'];
const FORBIDDEN_ROLES = ['super_admin', 'branch_owner', 'dpo'];

function normalizeRole(r) {
  if (!r) return 'employee';
  const clean = String(r).toLowerCase().trim();
  if (clean === 'trainer') return 'coach';
  if (clean === 'staff' || clean === 'cashier' || clean === 'front_desk') return 'employee';
  return clean;
}

/**
 * POST /api/branch-owner/staff
 * Create staff member within branch owner's assigned facility
 */
async function createStaffMember(req, res) {
  try {
    const owner = req.user;
    if (!owner || owner.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only authenticated Branch Owners can provision branch personnel.'
      });
    }

    const { fullName, email, password, role, operationalPermissions } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Work email is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'A temporary password of at least 8 characters is required.'
      });
    }

    const normalizedRole = normalizeRole(role);

    // 1. Role Ceiling Enforcement
    if (FORBIDDEN_ROLES.includes(normalizedRole) || !ALLOWED_STAFF_ROLES.includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        error: 'ROLE_CEILING_EXCEEDED',
        message: `Branch Owners are strictly prohibited from provisioning '${role}'. Allowed roles: branch_admin, coach, employee.`
      });
    }

    // 2. Check for duplicate email
    const cleanEmail = email.trim().toLowerCase();
    const existing = (memoryStore.users || []).find(u => (u.email || '').toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: `An account with email '${cleanEmail}' already exists in the system.`
      });
    }

    // 3. Tenant Scoping - Inject owner's branch_id (ignoring any arbitrary branch_id in body)
    const targetBranchId = owner.branch_id || 'b-mkt-01';

    // 4. Password Security: Hash initial password with salted bcrypt (factor 10)
    const password_hash = await bcrypt.hash(password, 10);

    const newUserId = crypto.randomUUID();
    const newUser = {
      id: newUserId,
      name: fullName.trim(),
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      password_hash,
      plain_password: password, // preserved for local dev verification
      role: normalizedRole,
      branch_id: targetBranchId,
      status: 'active',
      is_active: true,
      require_password_change: true,
      can_refund: operationalPermissions?.canRefund !== false && operationalPermissions?.can_refund !== false,
      can_modify_inventory: operationalPermissions?.canModifyInventory !== false && operationalPermissions?.can_modify_inventory !== false,
      can_export_reports: operationalPermissions?.canExportReports !== false && operationalPermissions?.can_export_reports !== false,
      created_at: new Date().toISOString()
    };

    if (!memoryStore.users) memoryStore.users = [];
    memoryStore.users.push(newUser);

    if (isPostgres()) {
      try {
        await query(
          `INSERT INTO users (id, name, email, password_hash, role, branch_id, status, is_active, require_password_change, can_refund, can_modify_inventory, can_export_reports, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            newUser.id,
            newUser.name,
            newUser.email,
            newUser.password_hash,
            newUser.role,
            newUser.branch_id,
            newUser.status,
            newUser.is_active,
            newUser.require_password_change,
            newUser.can_refund,
            newUser.can_modify_inventory,
            newUser.can_export_reports,
            newUser.created_at
          ]
        );
      } catch (dbErr) {
        console.error('[Postgres Branch Staff Insert Error]:', dbErr.message);
      }
    }

    savePersistentStore();

    // 5. Audit Logging
    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: owner.id,
      user_role: owner.role,
      action: 'PROVISION_BRANCH_STAFF',
      resource: 'USER',
      details: {
        provisioned_user_id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branch_id: targetBranchId,
        permissions: {
          can_refund: newUser.can_refund,
          can_modify_inventory: newUser.can_modify_inventory,
          can_export_reports: newUser.can_export_reports
        }
      }
    });

    const { password_hash: _h, plain_password: _p, ...safeUser } = newUser;
    return res.status(201).json({
      success: true,
      message: `Staff member '${newUser.name}' provisioned successfully under ${owner.branch_name || 'facility'}.`,
      user: safeUser
    });
  } catch (err) {
    console.error('[createStaffMember Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * PUT /api/branch-owner/staff/:userId
 * Update permissions, role, or active status of staff in owner's branch
 */
async function updateStaffMember(req, res) {
  try {
    const owner = req.user;
    if (!owner || owner.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only authenticated Branch Owners can manage branch personnel.'
      });
    }

    const { userId } = req.params;
    const targetUser = (memoryStore.users || []).find(u => String(u.id) === String(userId));

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'Staff member account not found.' });
    }

    // 1. Tenant Scoping Check: Target must match owner's branch_id
    const ownerNormBranch = normalizeBranchId(owner.branch_id);
    const targetNormBranch = normalizeBranchId(targetUser.branch_id);

    if (ownerNormBranch !== targetNormBranch) {
      return res.status(403).json({
        success: false,
        error: 'TENANT_VIOLATION',
        message: 'Security Policy Violation: You cannot modify personnel belonging to another branch facility.'
      });
    }

    // 2. Role Ceiling Check: Disallow modifying super_admin or branch_owner
    if (FORBIDDEN_ROLES.includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        error: 'ROLE_CEILING_EXCEEDED',
        message: 'Unauthorized: Cannot modify executive, DPO, or platform administrator accounts.'
      });
    }

    const { status, role, can_refund, can_modify_inventory, can_export_reports, fullName } = req.body;

    if (role !== undefined) {
      const normRole = normalizeRole(role);
      if (FORBIDDEN_ROLES.includes(normRole) || !ALLOWED_STAFF_ROLES.includes(normRole)) {
        return res.status(403).json({
          success: false,
          error: 'ROLE_CEILING_EXCEEDED',
          message: `Cannot assign role '${role}'. Allowed roles: branch_admin, coach, employee.`
        });
      }
      targetUser.role = normRole;
    }

    if (fullName !== undefined && fullName.trim()) {
      targetUser.name = fullName.trim();
    }

    if (status !== undefined) {
      const isAct = status === 'active';
      targetUser.status = isAct ? 'active' : 'inactive';
      targetUser.is_active = isAct;
    }

    if (can_refund !== undefined) targetUser.can_refund = Boolean(can_refund);
    if (can_modify_inventory !== undefined) targetUser.can_modify_inventory = Boolean(can_modify_inventory);
    if (can_export_reports !== undefined) targetUser.can_export_reports = Boolean(can_export_reports);

    if (isPostgres()) {
      try {
        await query(
          `UPDATE users SET name = $1, role = $2, status = $3, is_active = $4, can_refund = $5, can_modify_inventory = $6, can_export_reports = $7
           WHERE id = $8`,
          [
            targetUser.name,
            targetUser.role,
            targetUser.status,
            targetUser.is_active,
            targetUser.can_refund,
            targetUser.can_modify_inventory,
            targetUser.can_export_reports,
            targetUser.id
          ]
        );
      } catch (dbErr) {
        console.error('[Postgres Staff Update Error]:', dbErr.message);
      }
    }

    savePersistentStore();

    // 3. Audit Logging
    await logAuditEvent({
      branch_id: owner.branch_id,
      user_id: owner.id,
      user_role: owner.role,
      action: 'UPDATE_BRANCH_STAFF',
      resource: 'USER',
      details: {
        target_user_id: targetUser.id,
        role: targetUser.role,
        status: targetUser.status,
        permissions: {
          can_refund: targetUser.can_refund,
          can_modify_inventory: targetUser.can_modify_inventory,
          can_export_reports: targetUser.can_export_reports
        }
      }
    });

    const { password_hash: _h, plain_password: _p, ...safeUser } = targetUser;
    return res.json({
      success: true,
      message: `Staff member '${targetUser.name}' updated successfully.`,
      user: safeUser
    });
  } catch (err) {
    console.error('[updateStaffMember Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/branch-owner/staff/:userId/reset-password
 * Reset temporary password for staff in branch owner's facility
 */
async function resetStaffPassword(req, res) {
  try {
    const owner = req.user;
    if (!owner || owner.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only authenticated Branch Owners can reset branch personnel credentials.'
      });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'New temporary password must be at least 8 characters long.'
      });
    }

    const targetUser = (memoryStore.users || []).find(u => String(u.id) === String(userId));
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'Staff member account not found.' });
    }

    if (normalizeBranchId(owner.branch_id) !== normalizeBranchId(targetUser.branch_id)) {
      return res.status(403).json({
        success: false,
        error: 'TENANT_VIOLATION',
        message: 'Security Policy Violation: You cannot modify credentials for personnel from another branch.'
      });
    }

    if (FORBIDDEN_ROLES.includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        error: 'ROLE_CEILING_EXCEEDED',
        message: 'Unauthorized: Cannot reset credentials for executive or administrator accounts.'
      });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    targetUser.password_hash = password_hash;
    targetUser.plain_password = newPassword;
    targetUser.require_password_change = true;

    if (isPostgres()) {
      try {
        await query(
          'UPDATE users SET password_hash = $1, require_password_change = true WHERE id = $2',
          [password_hash, targetUser.id]
        );
      } catch (dbErr) {
        console.error('[Postgres Password Reset Error]:', dbErr.message);
      }
    }

    savePersistentStore();

    await logAuditEvent({
      branch_id: owner.branch_id,
      user_id: owner.id,
      user_role: owner.role,
      action: 'RESET_STAFF_PASSWORD',
      resource: 'USER',
      details: {
        target_user_id: targetUser.id,
        target_email: targetUser.email,
        require_password_change: true
      }
    });

    return res.json({
      success: true,
      message: `Temporary password reset for '${targetUser.name}'. User will be prompted to change credentials upon next login.`
    });
  } catch (err) {
    console.error('[resetStaffPassword Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/branch-owner/staff
 * Fetch branch roster strictly isolated to branch owner's branch
 */
async function fetchBranchRoster(req, res) {
  try {
    const owner = req.user;
    if (!owner || owner.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only authenticated Branch Owners can access the branch roster.'
      });
    }

    const ownerNormBranch = normalizeBranchId(owner.branch_id);
    const branches = memoryStore.branches || [];
    const bObj = branches.find(b => normalizeBranchId(b.id) === ownerNormBranch);

    const staff = (memoryStore.users || [])
      .filter(u => {
        if (normalizeBranchId(u.branch_id) !== ownerNormBranch) return false;
        if (u.role === 'member' || u.role === 'super_admin' || u.role === 'branch_owner') return false;
        if (String(u.id) === String(owner.id)) return false;
        return true;
      })
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username || u.email.split('@')[0],
        phone: u.phone || '—',
        role: u.role,
        status: u.status || 'active',
        is_active: u.status === 'active' && u.is_active !== false,
        branch_id: u.branch_id,
        branch_name: bObj ? bObj.name : (owner.branch_name || 'Assigned Facility'),
        branch_code: bObj ? bObj.code : (owner.branch_code || 'N/A'),
        can_refund: u.can_refund !== false,
        can_modify_inventory: u.can_modify_inventory !== false,
        can_export_reports: u.can_export_reports !== false,
        require_password_change: Boolean(u.require_password_change),
        created_at: u.created_at || '2026-01-01'
      }));

    return res.json({
      success: true,
      staff,
      branch_id: owner.branch_id,
      branch_name: bObj ? bObj.name : owner.branch_name
    });
  } catch (err) {
    console.error('[fetchBranchRoster Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  createStaffMember,
  updateStaffMember,
  resetStaffPassword,
  fetchBranchRoster
};
