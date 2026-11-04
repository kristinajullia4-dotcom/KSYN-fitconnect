const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const {
  handleCreateApprovalRequest,
  handleReviewApprovalRequest,
  handleListApprovalRequests
} = require('../controllers/overrideController');

router.use(authGuard);

// 1. List approvals (Filtered by branch for branch managers/owners)
router.get('/', rbacGuard('super_admin', 'branch_owner', 'branch_admin', 'employee', 'staff'), handleListApprovalRequests);

// 2. Initiate approval request
router.post('/request', rbacGuard('super_admin', 'branch_owner', 'branch_admin', 'employee', 'staff'), handleCreateApprovalRequest);

// 3. Review approval request (Restricted to higher authority: branch_owner or super_admin)
router.post('/:id/review', rbacGuard('super_admin', 'branch_owner'), handleReviewApprovalRequest);

module.exports = router;
