const express = require('express');
const router = express.Router();
const branchAdminController = require('../controllers/branchAdminController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

const inventoryController = require('../controllers/inventoryController');
const freePassController = require('../controllers/freePassController');

// Allow branch_admin, super_admin, and branch_owner to access this router
router.use(authGuard);
router.use(rbacGuard('branch_admin', 'super_admin', 'branch_owner'));

// 1. List staff strictly isolated to req.user.branch_id
router.get('/staff', branchAdminController.getStaff);

// 2. Create staff strictly locked to req.user.branch_id (Admin only)
router.post('/staff', rbacGuard('branch_admin', 'super_admin'), branchAdminController.createStaff);

// 3. Update staff status or reset password strictly within req.user.branch_id (Admin only)
router.put('/staff/:id/status', rbacGuard('branch_admin', 'super_admin'), branchAdminController.updateStaffStatus);

// 4. List members strictly isolated to req.user.branch_id
router.get('/members', branchAdminController.getMembers);

// 5. Check-in member with multi-branch roaming rules (Admin/Staff only)
router.post('/check-in', rbacGuard('branch_admin', 'super_admin'), branchAdminController.checkInMember);

// 6. View cross-branch roaming guest visits to this facility
router.get('/cross-branch-visits', branchAdminController.getCrossBranchVisits);

// 7. Equipment Restock Reorder Request to Super Admin
router.post('/inventory/reorder-request', rbacGuard('branch_admin', 'super_admin'), inventoryController.createReorderRequest);
router.get('/inventory/reorder-requests', inventoryController.getBranchReorderRequests);
router.post('/inventory/reorder-verify/:requestId', rbacGuard('branch_admin', 'super_admin'), inventoryController.verifyReorderShipment);

// 8. 1-Day Free Pass Raffle Applicants & Monthly Winner Awarding
router.get('/free-pass-applicants', freePassController.getBranchApplicants);
router.get('/free-pass/applicants', freePassController.getBranchApplicants);
router.post('/free-pass/award/:id', rbacGuard('branch_admin', 'super_admin'), freePassController.awardFreePass);
router.post('/free-pass/draw-winner', rbacGuard('branch_admin', 'super_admin'), freePassController.drawWinner);

// 9. Tenant-Isolated Sales & Royalty Ledger with Timeframe Filtering
router.get('/ledger', branchAdminController.getLedger);

// 10. Incident, Maintenance & Disciplinary Log
router.get('/incidents', rbacGuard('branch_admin', 'super_admin', 'employee', 'staff', 'coach', 'trainer'), branchAdminController.getIncidents);
router.post('/incidents', rbacGuard('branch_admin', 'super_admin', 'employee', 'staff', 'coach', 'trainer'), branchAdminController.createIncident);
router.patch('/incidents/:id/status', rbacGuard('branch_admin', 'super_admin'), branchAdminController.updateIncidentStatus);

// 11. Floor Stock Burn-Rate & Runout Forecaster
router.get('/inventory/burn-rate', branchAdminController.getInventoryBurnRate);

// 12. Supervisor Witness PIN Authorization for Cash Discrepancies
router.post('/pos/verify-supervisor-pin', branchAdminController.verifySupervisorPin);

// 13. Staff Shift Roster Scheduler & Floor Rota
router.get('/shifts', branchAdminController.getShifts);
router.post('/shifts', rbacGuard('branch_admin', 'super_admin'), branchAdminController.createShift);
router.delete('/shifts/:id', rbacGuard('branch_admin', 'super_admin'), branchAdminController.deleteShift);

// Weekly Floor & Staff Rota
router.get('/floor-rota', branchAdminController.getFloorRota);
router.post('/floor-rota', rbacGuard('branch_admin', 'super_admin'), branchAdminController.saveFloorRota);
router.post('/floor-rota/publish', rbacGuard('branch_admin', 'super_admin'), branchAdminController.publishFloorRota);
router.delete('/floor-rota/:id', rbacGuard('branch_admin', 'super_admin'), branchAdminController.deleteFloorRotaSlot);

// Branch Admin Own Duty Rota (Scoped to branch admins of the same branch)
router.get('/admin-rota', rbacGuard('branch_admin', 'super_admin'), branchAdminController.getAdminRota);
router.post('/admin-rota', rbacGuard('branch_admin', 'super_admin'), branchAdminController.saveAdminRota);
router.post('/admin-rota/publish', rbacGuard('branch_admin', 'super_admin'), branchAdminController.publishAdminRota);

// 14. Staff Timeclock Attendance Logs
router.get('/timeclock', branchAdminController.getTimeclockLogs);
router.get('/timeclock/logs', branchAdminController.getTimeclockLogs);
router.post('/timeclock/punch', branchAdminController.punchTimeclock);

// 15. VIP Long-Term Locker Rental Manager
router.get('/lockers/vip', branchAdminController.getVipLockers);
router.post('/lockers/vip', rbacGuard('branch_admin', 'super_admin'), branchAdminController.assignVipLocker);
router.post('/lockers/vip/:id/release', rbacGuard('branch_admin', 'super_admin'), branchAdminController.releaseVipLocker);

// 16. Counter Petty Cash Expense Voucher Pad
router.get('/expenses', branchAdminController.getExpenses);
router.post('/expenses', rbacGuard('branch_admin', 'super_admin'), branchAdminController.recordExpense);

// 17. 14-Day Inactivity Churn Predictor & Retention Queue
router.get('/members/churn-risk', branchAdminController.getChurnRiskMembers);
router.post('/members/re-engage/:id', rbacGuard('branch_admin', 'super_admin'), branchAdminController.reEngageMember);

// 18. Branch Announcements & Targeted Promos
router.get('/announcements', branchAdminController.getBranchAnnouncements);
router.post('/announcements', rbacGuard('branch_admin', 'super_admin'), branchAdminController.createBranchAnnouncement);
router.delete('/announcements/:id', rbacGuard('branch_admin', 'super_admin'), branchAdminController.deleteBranchAnnouncement);

module.exports = router;
