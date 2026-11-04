const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

router.get('/ledger', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getSalesLedger);
router.post('/record-sale', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.recordSale);
router.post('/checkout', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.recordSale);
router.get('/royalties', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.computeRoyalties);
router.get('/waivers', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.getWaivers);
router.get('/remittances', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getRemittances);
router.post('/remittances', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.settleRemittance);
router.post('/remit-royalty', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.settleRemittance);
router.get('/capex-assets', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getCapexAssets);
router.get('/opex-summary', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getOpexSummary);
router.get('/opex', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getOpexSummary);
router.post('/cash-drawer/blind-reconciliation', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.reconcileBlindCash);
router.get('/bir-2307/:remittanceId', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), financeController.getBir2307Certificate);
router.post('/waivers/sign', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.signWaiver);

module.exports = router;
