const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const xenditController = require('../controllers/xenditController');
const posShiftController = require('../controllers/posShiftController');
const posCheckoutController = require('../controllers/posCheckoutController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

// 1B. POS Xendit Status Check (Lookup by specific invoiceId/externalId so customer display & polling can verify settlement)
router.get('/xendit/status/:invoiceId', posCheckoutController.getStatus);

router.use(authGuard);

// 1. POS Cashier & Retail Sales Checkout (Commercial-Grade Xendit Rails & Cash Counter)
router.post('/checkout', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posCheckoutController.checkout);
router.post('/record-sale', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posCheckoutController.checkout);
router.post('/pt-enrollment', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posCheckoutController.enrollPtPackage);
router.get('/coaches', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posCheckoutController.getPosCoaches);

// 1C. POS Xendit Instant Simulation (Authenticated QA Staff)
router.post('/xendit/simulate-paid/:invoiceId', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posCheckoutController.simulatePaid);

// 2. Front Desk POS Sales Ledger
router.get('/ledger', rbacGuard('super_admin', 'branch_admin', 'branch_owner', 'employee', 'staff'), financeController.getSalesLedger);

// 3. Dynamic QR Ph Cashless Generation & Verification
router.post('/create-qr', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), xenditController.createDynamicQr);
router.get('/qr-status/:id', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), xenditController.getQrStatus);
router.post('/simulate-qr-paid/:id', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), xenditController.simulateQrPaid);

// 4. POS Shift Session Management & Cash Drawer Accountability (Feature Requirements 2 & 3)
router.post('/shifts/open', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posShiftController.openShift);
router.get('/shifts/current', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posShiftController.getCurrentShift);
router.post('/shifts/close', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), posShiftController.closeShift);

// 5. End-of-Day Store Z-Reading Roll-up Report (Branch Admin & Owner Managerial Audit Only)
router.get('/reports/z-reading', rbacGuard('super_admin', 'branch_admin', 'branch_owner'), posShiftController.getZReadingReport);

// 6. Incoming PT Enrollments Queue & Clearance (Front Desk Verification & Coach Assignment)
router.get('/pt-enrollments', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.getPtEnrollmentsQueue);
router.post('/pt-enrollments/:id/clear', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.clearPtEnrollment);
router.post('/pt-enrollments/:id/confirm-availability', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff', 'coach', 'trainer'), financeController.confirmCoachAvailability);
router.post('/pt-enrollments/:id/conclude', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.concludePtEnrollment);
router.delete('/pt-enrollments/:id', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), financeController.deletePtEnrollment);

module.exports = router;
