const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const {
  createStaffMember,
  updateStaffMember,
  resetStaffPassword,
  fetchBranchRoster
} = require('../controllers/branchStaffController');

// All endpoints strictly protected for authenticated branch_owner
router.use(authGuard);
router.use(rbacGuard('branch_owner'));

// GET /api/branch-owner/staff - Fetch branch personnel roster
router.get('/', fetchBranchRoster);

// POST /api/branch-owner/staff - Provision new staff/admin member
router.post('/', createStaffMember);

// PUT /api/branch-owner/staff/:userId - Update status & operational permissions
router.put('/:userId', updateStaffMember);

// POST /api/branch-owner/staff/:userId/reset-password - Reset temporary password
router.post('/:userId/reset-password', resetStaffPassword);

module.exports = router;
