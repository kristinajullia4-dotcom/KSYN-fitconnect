const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

// Optional auth helper: decodes token if provided, but does not block if missing
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authGuard(req, res, next);
};

// Public branch listing (accessible without token for landing page/modal; enriched with stats if token present)
router.get('/', optionalAuth, branchController.getAllBranches);
router.get('/public', branchController.getAllBranches);

const branchAdminController = require('../controllers/branchAdminController');

// Protected branch routes require valid JWT auth
router.use(authGuard);

// Tenant-isolated ledger endpoint
router.get('/ledger', rbacGuard('branch_admin', 'super_admin'), branchAdminController.getLedger);

// Audited Multi-Tenant Branch Transfer (Members, Coaches, Staff, Branch Admins)
router.post('/transfer-user', branchController.transferUserBranch);
router.post('/transfer', branchController.transferUserBranch);

// Inbound Branch Transfer Verification & Approvals (Branch Admin / Super Admin)
router.get('/transfers/pending', rbacGuard('branch_admin', 'branch_owner', 'super_admin'), branchController.getPendingTransferRequests);
router.post('/transfers/:requestId/approve', rbacGuard('branch_admin', 'branch_owner', 'super_admin'), branchController.approveTransferRequest);
router.post('/transfers/:requestId/reject', rbacGuard('branch_admin', 'branch_owner', 'super_admin'), branchController.rejectTransferRequest);
router.post('/transfers/:requestId/cancel', rbacGuard('branch_admin', 'branch_owner', 'super_admin', 'member'), branchController.cancelTransferRequest);
router.post('/transfers/:requestId/dismiss', rbacGuard('branch_admin', 'branch_owner', 'super_admin', 'member'), branchController.dismissTransferRequest);
router.post('/transfers/:requestId/contact', rbacGuard('branch_admin', 'branch_owner', 'super_admin'), branchController.contactTransferAdmin);
router.get('/transfers/my-status', branchController.getMyTransferStatus);

// Published Branch Floor Rota (Accessible to members, coaches, staff, branch admins, and branch owners)
router.get('/floor-rota', rbacGuard('super_admin', 'branch_admin', 'branch_owner', 'coach', 'trainer', 'employee', 'staff', 'member'), branchAdminController.getFloorRota);

// View branch details (tenant-filtered or all for super_admin)
router.get('/:branchId', branchController.getBranchById);

// Super Admin branch management
router.post('/', rbacGuard('super_admin'), branchController.createBranch);
router.patch('/:branchId/royalty', rbacGuard('super_admin'), branchController.updateRoyalty);

module.exports = router;
