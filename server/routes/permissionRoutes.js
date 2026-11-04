const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const permissionController = require('../controllers/permissionController');

// All endpoints in this router require authentication and super_admin or branch_owner role
router.use(authGuard);
router.use(rbacGuard('super_admin', 'branch_owner'));

// 1. Fetch staff & users with permission flags
router.get('/staff', permissionController.getStaffAndPermissions);
router.get('/users', permissionController.getStaffAndPermissions);

// 2. Security Checks & Permission Updates (PUT /api/roles-and-permissions/:id)
router.put('/:id', permissionController.updateRolesAndPermissions);

module.exports = router;
