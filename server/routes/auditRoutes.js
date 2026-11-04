const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

router.get('/', rbacGuard('super_admin', 'branch_admin'), auditController.getAuditLogs);

module.exports = router;
