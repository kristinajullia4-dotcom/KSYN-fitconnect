const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

// 1. Toggle Auto-Renew (PATCH & POST for broad compatibility)
router.patch('/toggle-auto-renew', rbacGuard('member', 'super_admin', 'branch_admin'), subscriptionController.toggleAutoRenew);
router.patch('/auto-renew', rbacGuard('member', 'super_admin', 'branch_admin'), subscriptionController.toggleAutoRenew);
router.post('/toggle-auto-renew', rbacGuard('member', 'super_admin', 'branch_admin'), subscriptionController.toggleAutoRenew);

// 2. Query Current Subscription & Billing Settings
router.get('/current', rbacGuard('member', 'super_admin', 'branch_admin'), subscriptionController.getCurrentSubscription);

module.exports = router;
