const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const {
  handleEmergencyEgressOverride,
  handleEmergencyEgressReset,
  handleGetEmergencyStatus
} = require('../services/turnstileHardwareBridge');

// Public status check (for electronic gate telemetry display)
router.get('/egress-status', handleGetEmergencyStatus);

// Authenticated Emergency Controls (Restricted to super_admin and branch_admin per RA 9514)
router.use(authGuard);
router.post('/egress-override', rbacGuard('super_admin', 'branch_admin'), handleEmergencyEgressOverride);
router.post('/egress-reset', rbacGuard('super_admin', 'branch_admin'), handleEmergencyEgressReset);

module.exports = router;
