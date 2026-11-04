const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

router.get('/', rbacGuard('super_admin', 'branch_admin', 'employee'), inventoryController.getInventory);
router.post('/', rbacGuard('super_admin', 'branch_admin'), inventoryController.addInventoryItem);
router.patch('/:itemId', rbacGuard('super_admin', 'branch_admin'), inventoryController.updateInventoryItem);

// Restock & Procurement Endpoints
router.post('/reorder-request', rbacGuard('branch_admin', 'super_admin'), inventoryController.createReorderRequest);
router.get('/reorder-requests', rbacGuard('branch_admin', 'super_admin'), inventoryController.getBranchReorderRequests);
router.get('/procurement-feed', rbacGuard('super_admin'), inventoryController.getProcurementFeed);
router.patch('/procurement/:requestId', rbacGuard('super_admin'), inventoryController.updateProcurementRequest);

module.exports = router;
