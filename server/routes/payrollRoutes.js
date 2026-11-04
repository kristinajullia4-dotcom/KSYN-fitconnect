const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

// 1. Generate Batch Payout (Super Admin & Branch Admin)
router.post('/batch-payout', rbacGuard('super_admin', 'branch_admin'), payrollController.generateBatchPayroll);

// 2. View Payslips (Super Admin, Branch Admin, Coaches)
router.get('/payslips', rbacGuard('super_admin', 'branch_admin', 'coach', 'trainer'), payrollController.getPayslips);
router.get('/payslips/:id', rbacGuard('super_admin', 'branch_admin', 'coach', 'trainer'), payrollController.getPayslipById);

// 3. Export PESONet Bank Clearing File (CSV)
router.get('/export-bank-batch', rbacGuard('super_admin', 'branch_admin'), payrollController.exportBankBatchCsv);

module.exports = router;
