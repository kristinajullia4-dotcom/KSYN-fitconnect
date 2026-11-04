const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

// Public endpoint for prospective franchise applicants
router.post('/franchise-inquiry', superAdminController.createFranchiseInquiry);
router.post('/franchise-inquiry/reschedule', superAdminController.requestFranchiseReschedule);

// Protect all following routes: super_admin only
router.use(authGuard);
router.use(rbacGuard('super_admin'));

// 1. Consolidated metrics & live feed
router.get('/stats', superAdminController.getStats);

// 2. Admin & Branch Owner accounts
router.get('/admins', superAdminController.getAdmins);
router.post('/admins', superAdminController.createAdmin);
router.put('/admins/:id/status', superAdminController.updateAdminStatus);

// 3. Branch Management
router.post('/branches', superAdminController.registerBranch);
router.put('/branches/:id/status', superAdminController.updateBranchStatus);

// 4. Franchise Applications & Due Diligence Pipeline
router.get('/franchise-applications', superAdminController.getFranchiseApplications);
router.put('/franchise-applications/:id/status', superAdminController.updateFranchiseApplicationStatus);
router.post('/franchise/contact/:applicationId', superAdminController.contactFranchiseApplicant);
router.post('/franchise-applications/:id/contact', superAdminController.contactFranchiseApplicant);
router.patch('/franchise/status/:applicationId', superAdminController.updateFranchiseStatus);
router.patch('/franchise-applications/:id/status', superAdminController.updateFranchiseStatus);

const inventoryController = require('../controllers/inventoryController');

const permissionController = require('../controllers/permissionController');

// 5. Roles & Permissions Control (governance matrix)
router.get('/permissions/users', superAdminController.getPermissionUsers);
router.put('/permissions/:id', permissionController.updateRolesAndPermissions);
router.put('/users/:id/permissions', permissionController.updateRolesAndPermissions);

// 6. Branch Performance Reports
router.get('/reports', superAdminController.getReports);

// 7. Equipment & Restock Procurement Oversight
router.get('/inventory/procurement-feed', inventoryController.getProcurementFeed);
router.patch('/inventory/procurement/:requestId', inventoryController.updateProcurementRequest);

// 8. Cryptographic Audit Chain Verification
router.get('/audit/verify-chain', superAdminController.verifyAuditChainController);

// 9. Super Admin Multi-Factor Authentication (2FA)
router.get('/mfa/status', superAdminController.getMfaStatus);
router.post('/mfa/setup', superAdminController.setupMfa);
router.post('/mfa/verify', superAdminController.verifyMfa);

// 10. IoT Hardware & Edge Gateway Live Telemetry
router.get('/hardware/telemetry', superAdminController.getHardwareTelemetry);

// 11. Global Emergency Broadcast System
router.get('/broadcast', superAdminController.getBroadcasts);
router.post('/broadcast', superAdminController.createBroadcast);
router.delete('/broadcast/:id', superAdminController.deleteBroadcast);

// 12. Centralized Rate-Card & Global Promo Engine
router.get('/rate-cards', superAdminController.getRateCards);
router.put('/rate-cards', superAdminController.updateRateCards);
router.get('/promos', superAdminController.getPromos);
router.post('/promos', superAdminController.createPromo);
router.delete('/promos/:id', superAdminController.deletePromo);

module.exports = router;
