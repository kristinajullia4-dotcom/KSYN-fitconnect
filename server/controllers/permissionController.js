const { query, isPostgres, memoryStore, savePersistentStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

const ROOT_SUPER_ADMIN_ID = 'u1000000-0000-0000-0000-000000000001';
const ROOT_SUPER_ADMIN_EMAIL = 'superadmin@ksyn.com';

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

/**
 * GET /api/roles-and-permissions/staff
 * GET /api/roles-and-permissions/users
 * Returns staff and administrative users with granular permissions.
 * - Super Admin: returns network-wide staff or filtered by query.
 * - Branch Owner: strictly isolated to req.user.branch_id, excluding fellow owners/super admins.
 */
async function getStaffAndPermissions(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    if (user.role !== 'super_admin' && user.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Unauthorized: Only Super Admins and Branch Owners can access staff permission governance.'
      });
    }

    const branches = memoryStore.branches || [];
    const allUsers = memoryStore.users || [];
    const ownerBranchId = normalizeBranchId(user.branch_id);

    let filtered = [];

    if (user.role === 'super_admin') {
      const targetBranch = req.query.branch_id ? normalizeBranchId(req.query.branch_id) : null;
      filtered = allUsers.filter(u => {
        if (u.role === 'member') return false;
        if (targetBranch && normalizeBranchId(u.branch_id) !== targetBranch) return false;
        return true;
      });
    } else {
      // Branch Owner: Strictly users belonging to the logged-in owner's branch
      // Exclude members, super admins, and fellow branch owners
      filtered = allUsers.filter(u => {
        if (normalizeBranchId(u.branch_id) !== ownerBranchId) return false;
        if (u.role === 'member' || u.role === 'super_admin' || u.role === 'branch_owner') return false;
        if (String(u.id) === String(user.id)) return false;
        return true;
      });
    }

    const enriched = filtered.map(u => {
      const normBranch = normalizeBranchId(u.branch_id);
      const bObj = branches.find(b => b.id === normBranch || b.id === u.branch_id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username || u.email.split('@')[0],
        phone: u.phone || '—',
        role: u.role,
        status: u.status || 'active',
        is_active: u.status === 'active' && u.is_active !== false,
        branch_id: u.branch_id,
        branch_name: bObj ? bObj.name : 'Unknown Branch',
        branch_code: bObj ? bObj.code : 'N/A',
        can_refund: u.can_refund !== false,
        can_modify_inventory: u.can_modify_inventory !== false,
        can_export_reports: u.can_export_reports !== false,
        created_at: u.created_at || new Date('2026-01-01')
      };
    });

    return res.json({
      success: true,
      staff: enriched,
      users: enriched,
      branch_id: user.branch_id,
      branch_name: user.branch_name || 'Assigned Facility'
    });
  } catch (err) {
    console.error('[getStaffAndPermissions Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * PUT /api/roles-and-permissions/:id
 * Update user role, operational permissions, account status, and optional branch mapping.
 * Enforces strict security boundaries:
 * - Super Admin: Can edit anyone and change any branch mapping.
 * - Branch Owner:
 *   1. Can ONLY edit users in their own branch.
 *   2. CANNOT edit other branch owners or super admins.
 *   3. CANNOT change their own role or permissions.
 *   4. CANNOT transfer employees to another branch.
 *   5. If an unauthorized user tries to edit, return HTTP 403 Forbidden.
 */
async function updateRolesAndPermissions(req, res) {
  try {
    const { id } = req.params;
    const actor = req.user;

    if (!actor) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    // Role-based boundary: Only super_admin and branch_owner can modify permissions
    if (actor.role !== 'super_admin' && actor.role !== 'branch_owner') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Unauthorized: Only Super Admins and Branch Owners have authorization to modify staff roles and operational permissions.'
      });
    }

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
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'The specified employee account was not found in the system.'
      });
    }

    // =========================================================================
    // SECURITY CONTROLS FOR BRANCH OWNER
    // =========================================================================
    if (actor.role === 'branch_owner') {
      // Rule 1: CANNOT change their own role or permissions
      if (String(targetUser.id) === String(actor.id) || targetUser.email === actor.email) {
        return res.status(403).json({
          success: false,
          error: 'CANNOT_EDIT_SELF',
          message: 'Branch Owners are strictly prohibited from modifying their own account role, branch assignment, or governance permissions.'
        });
      }

      // Rule 2: CANNOT edit other branch owners or super admins
      if (targetUser.role === 'super_admin' || targetUser.role === 'branch_owner') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_TARGET_ROLE',
          message: 'Branch Owners cannot modify Super Admins or fellow Branch Owners.'
        });
      }

      // Rule 3: Can ONLY edit users in their own branch
      const actorBranch = normalizeBranchId(actor.branch_id);
      const targetBranch = normalizeBranchId(targetUser.branch_id);

      if (!actorBranch || !targetBranch || actorBranch !== targetBranch) {
        return res.status(403).json({
          success: false,
          error: 'TENANT_ISOLATION_VIOLATION',
          message: 'Branch Owners can only manage employees belonging strictly to their assigned branch facility.'
        });
      }

      // Rule 4: CANNOT transfer employees to another branch
      if (branch_id !== undefined && branch_id !== null && normalizeBranchId(branch_id) !== targetBranch) {
        return res.status(403).json({
          success: false,
          error: 'BRANCH_TRANSFER_FORBIDDEN',
          message: 'Branch Owners cannot transfer or reassign employees to other branch locations. Inter-branch transfers require Super Admin corporate approval.'
        });
      }

      // Rule 5: Allowed role assignments (Staff, Coach, Branch Admin)
      const ALLOWED_BRANCH_OWNER_ROLES = ['employee', 'staff', 'coach', 'trainer', 'branch_admin'];
      if (role && !ALLOWED_BRANCH_OWNER_ROLES.includes(role)) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED_ROLE_ELEVATION',
          message: 'Branch Owners can only assign Staff, Coach, or Branch Admin roles within their facility.'
        });
      }
    }

    // =========================================================================
    // SECURITY CONTROLS FOR SUPER ADMIN
    // =========================================================================
    if (actor.role === 'super_admin') {
      // Protection: Root Super Admin cannot be demoted or deactivated
      if (targetUser.id === ROOT_SUPER_ADMIN_ID || targetUser.email === ROOT_SUPER_ADMIN_EMAIL) {
        if ((role && role !== 'super_admin') || (status && status !== 'active')) {
          return res.status(403).json({
            success: false,
            error: 'SUPER_ADMIN_PROTECTED',
            message: 'Root Super Admin account cannot be demoted, reassigned, or deactivated.'
          });
        }
      }

      // Super Admin can edit anyone and change any branch mapping
      if (branch_id !== undefined) {
        targetUser.branch_id = branch_id;
      }
    }

    // Apply allowed updates
    if (role) {
      targetUser.role = role;
    }

    if (status) {
      targetUser.status = status;
      targetUser.is_active = (status === 'active');
    }

    if (can_refund !== undefined) {
      targetUser.can_refund = Boolean(can_refund);
    }

    if (can_modify_inventory !== undefined) {
      targetUser.can_modify_inventory = Boolean(can_modify_inventory);
    }

    if (can_export_reports !== undefined) {
      targetUser.can_export_reports = Boolean(can_export_reports);
    }

    // Persistent storage sync
    if (isPostgres()) {
      await query(
        `UPDATE users
         SET role = $1, branch_id = $2, status = $3, can_refund = $4,
             can_modify_inventory = $5, can_export_reports = $6, updated_at = NOW()
         WHERE id = $7`,
        [
          targetUser.role,
          targetUser.branch_id,
          targetUser.status,
          targetUser.can_refund,
          targetUser.can_modify_inventory,
          targetUser.can_export_reports,
          targetUser.id
        ]
      );
    } else {
      savePersistentStore();
    }

    // Cryptographic audit chain entry
    const auditAction = actor.role === 'super_admin'
      ? 'SUPER_ADMIN_UPDATE_USER_PERMISSIONS'
      : 'BRANCH_OWNER_UPDATE_STAFF_PERMISSIONS';

    await logAuditEvent({
      user_id: actor.id,
      user_role: actor.role,
      action: auditAction,
      resource: `USER:${targetUser.id}`,
      ip_address: req.ip,
      details: {
        actor_name: actor.name,
        actor_role: actor.role,
        target_id: targetUser.id,
        target_name: targetUser.name,
        target_email: targetUser.email,
        assigned_role: targetUser.role,
        assigned_branch: targetUser.branch_id,
        status: targetUser.status,
        can_refund: targetUser.can_refund,
        can_modify_inventory: targetUser.can_modify_inventory,
        can_export_reports: targetUser.can_export_reports
      }
    });

    return res.json({
      success: true,
      message: `Roles and permissions updated successfully for ${targetUser.name}.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        branch_id: targetUser.branch_id,
        status: targetUser.status,
        is_active: targetUser.is_active !== false,
        can_refund: targetUser.can_refund,
        can_modify_inventory: targetUser.can_modify_inventory,
        can_export_reports: targetUser.can_export_reports
      }
    });
  } catch (err) {
    console.error('[updateRolesAndPermissions Error]:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  getStaffAndPermissions,
  updateRolesAndPermissions
};
