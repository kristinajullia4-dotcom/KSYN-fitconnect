const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

// 1. Member generates dynamic 60s cryptographic pass
router.get('/generate-pass', rbacGuard('member'), qrController.generateDynamicPass);

// 2. High-speed employee/kiosk scanner verifies pass and logs check-in (Restricted to terminals and staff)
router.post('/verify-pass', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), qrController.verifyPassAndCheckIn);
router.post('/verify', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), qrController.verifyPassAndCheckIn);

// 3. View attendance log feed
router.get('/attendance-logs', qrController.getAttendanceLogs);

// 4. Physical Turnstile Hardware Relay Status & Manual Solenoid Pulse
const { getHardwareStatus, triggerManualPulse } = require('../services/turnstileHardwareBridge');
router.get('/hardware-status', rbacGuard('super_admin', 'branch_admin', 'employee'), getHardwareStatus);
router.post('/manual-pulse', rbacGuard('super_admin', 'branch_admin', 'employee'), triggerManualPulse);

module.exports = router;
