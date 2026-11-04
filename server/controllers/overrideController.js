const crypto = require('crypto');
const { memoryStore, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Four-Eyes Principle / Dual-Control Authorization Controller
 * Standards: ISO/IEC 25010 & SOX / COBIT Segregation of Duties (SoD)
 * 
 * Enforces dual-operator verification on high-risk financial and contract modifications:
 *  1. Cash drawer variance adjustments exceeding ₱2,000.
 *  2. Manual retroactive plan cancellations or fee adjustments.
 *  3. Shift discrepancy write-offs.
 * 
 * Rule: Initiator cannot approve their own request (approver_id !== initiator_id).
 */

if (!memoryStore.two_party_approvals) {
  memoryStore.two_party_approvals = [];
}

const HIGH_RISK_TRIGGER_ACTIONS = [
  'DRAWER_VARIANCE_ADJUSTMENT',
  'RETROACTIVE_PLAN_CANCELLATION',
  'SHIFT_DISCREPANCY_WRITEOFF',
  'MANUAL_FEE_WAIVER'
];

/**
 * Programmatic helper to request a dual-control approval
 */
async function requestDualControl({
  branchId = 'b-mkt-01',
  actionType,
  amount = 0,
  payload = {},
  reason = 'High-risk financial override',
  initiator,
  ipAddress = '127.0.0.1'
}) {
  if (!initiator || !initiator.id) {
    throw new Error('Valid initiator user object is required for dual-control requests.');
  }

  const numAmount = Number(amount) || 0;
  const requiresDualControl = HIGH_RISK_TRIGGER_ACTIONS.includes(actionType) || numAmount > 2000;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000); // 24-hour expiration window
  const approvalId = `appr_${crypto.randomUUID()}`;

  const approvalRecord = {
    id: approvalId,
    branch_id: branchId,
    action_type: actionType,
    amount: numAmount,
    payload,
    reason,
    initiator_id: initiator.id,
    initiator_name: initiator.name || initiator.email || 'Staff Cashier',
    initiator_role: initiator.role || 'staff',
    approver_id: null,
    approver_name: null,
    approver_role: null,
    status: requiresDualControl ? 'PENDING' : 'APPROVED',
    requires_dual_approval: requiresDualControl,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    reviewed_at: requiresDualControl ? null : now.toISOString(),
    review_notes: requiresDualControl ? null : 'Autonomous cashier threshold permissible (<= P2,000)'
  };

  if (!memoryStore.two_party_approvals) {
    memoryStore.two_party_approvals = [];
  }
  memoryStore.two_party_approvals.unshift(approvalRecord);

  await logAuditEvent({
    branch_id: branchId,
    user_id: initiator.id,
    user_role: initiator.role,
    action: 'DUAL_CONTROL_APPROVAL_INITIATED',
    resource: 'financial_overrides',
    ip_address: ipAddress,
    details: {
      approval_id: approvalId,
      action_type: actionType,
      amount: numAmount,
      status: approvalRecord.status,
      requires_dual_approval: requiresDualControl
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return approvalRecord;
}

/**
 * Programmatic helper to review and execute dual-control approval
 */
async function reviewDualControl(approvalId, {
  decision = 'APPROVE', // 'APPROVE' or 'REJECT'
  approver,
  notes = '',
  ipAddress = '127.0.0.1'
}) {
  if (!approver || !approver.id) {
    throw new Error('Valid approver user object is required.');
  }

  const record = (memoryStore.two_party_approvals || []).find(a => a.id === approvalId);
  if (!record) {
    const notFoundErr = new Error(`Approval request ${approvalId} not found.`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (record.status !== 'PENDING') {
    const resolvedErr = new Error(`Approval request is already in status: ${record.status}`);
    resolvedErr.statusCode = 400;
    throw resolvedErr;
  }

  // -------------------------------------------------------------
  // FOUR-EYES HARD INVARIANT: approver_id !== initiator_id
  // -------------------------------------------------------------
  if (record.initiator_id === approver.id) {
    const fourEyesErr = new Error('FOUR-EYES RULE VIOLATION: Initiator cannot approve their own high-risk override.');
    fourEyesErr.code = 'FOUR_EYES_RULE_VIOLATION';
    fourEyesErr.statusCode = 403;
    throw fourEyesErr;
  }

  // Verify approver authority: must be branch_owner or super_admin
  const allowedRoles = ['branch_owner', 'super_admin'];
  if (!allowedRoles.includes(approver.role)) {
    const roleErr = new Error('Unauthorized: Dual-control approval requires branch_owner or super_admin role.');
    roleErr.statusCode = 403;
    throw roleErr;
  }

  const now = new Date();
  const isApproved = decision.toUpperCase() === 'APPROVE';

  record.status = isApproved ? 'APPROVED' : 'REJECTED';
  record.approver_id = approver.id;
  record.approver_name = approver.name || approver.email || 'Authorizing Supervisor';
  record.approver_role = approver.role;
  record.reviewed_at = now.toISOString();
  record.review_notes = notes || (isApproved ? 'Approved by second authorized supervisor' : 'Rejected by supervisor');

  await logAuditEvent({
    branch_id: record.branch_id,
    user_id: approver.id,
    user_role: approver.role,
    action: isApproved ? 'DUAL_CONTROL_APPROVAL_GRANTED' : 'DUAL_CONTROL_APPROVAL_REJECTED',
    resource: 'financial_overrides',
    ip_address: ipAddress,
    details: {
      approval_id: record.id,
      action_type: record.action_type,
      amount: record.amount,
      initiator_id: record.initiator_id,
      approver_id: approver.id,
      decision: record.status
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return record;
}

/**
 * REST Endpoint: POST /api/approvals/request
 */
async function handleCreateApprovalRequest(req, res) {
  try {
    const user = req.user;
    const {
      branchId = user?.branch_id || 'b-mkt-01',
      actionType,
      amount = 0,
      payload = {},
      reason
    } = req.body;

    if (!actionType) {
      return res.status(400).json({ success: false, message: 'actionType is required.' });
    }

    const approval = await requestDualControl({
      branchId,
      actionType,
      amount,
      payload,
      reason,
      initiator: user,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      requires_dual_approval: approval.requires_dual_approval,
      approval
    });
  } catch (err) {
    console.error('[Create Approval Request Error]:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * REST Endpoint: POST /api/approvals/:id/review
 */
async function handleReviewApprovalRequest(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { decision = 'APPROVE', notes } = req.body;

    const approval = await reviewDualControl(id, {
      decision,
      approver: user,
      notes,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(200).json({
      success: true,
      message: `Override request ${approval.status.toLowerCase()} successfully.`,
      approval
    });
  } catch (err) {
    const code = err.statusCode || (err.code === 'FOUR_EYES_RULE_VIOLATION' ? 403 : 500);
    return res.status(code).json({
      success: false,
      error: err.code || 'APPROVAL_ERROR',
      message: err.message
    });
  }
}

/**
 * REST Endpoint: GET /api/approvals
 */
function handleListApprovalRequests(req, res) {
  try {
    const user = req.user;
    const branchId = req.query.branch_id || (user?.role === 'super_admin' ? null : user?.branch_id);

    let list = memoryStore.two_party_approvals || [];
    if (branchId) {
      list = list.filter(a => a.branch_id === branchId);
    }

    return res.status(200).json({
      success: true,
      count: list.length,
      approvals: list
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  requestDualControl,
  reviewDualControl,
  handleCreateApprovalRequest,
  handleReviewApprovalRequest,
  handleListApprovalRequests,
  HIGH_RISK_TRIGGER_ACTIONS
};
