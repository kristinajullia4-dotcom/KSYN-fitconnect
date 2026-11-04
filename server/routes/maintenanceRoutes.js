const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

// 1. Equipment Registry & Scheduled Intervals
router.get('/schedules', rbacGuard('super_admin', 'branch_admin', 'employee'), maintenanceController.getEquipmentRegistry);
router.post('/equipment', rbacGuard('super_admin', 'branch_admin'), maintenanceController.addEquipment);
router.patch('/equipment/:id', rbacGuard('super_admin', 'branch_admin'), maintenanceController.updateEquipment);

// 2. Ingest IoT Sensor Operating Hours Telemetry
router.post('/telemetry', rbacGuard('super_admin', 'branch_admin', 'employee'), maintenanceController.recordIoTTelemetry);

// 3. Work Order Dispatch & Maintenance Tickets
router.get('/work-orders', rbacGuard('super_admin', 'branch_admin', 'employee'), maintenanceController.getWorkOrders);
router.post('/work-orders', rbacGuard('super_admin', 'branch_admin'), maintenanceController.createWorkOrder);
router.patch('/work-orders/:id/complete', rbacGuard('super_admin', 'branch_admin', 'employee'), maintenanceController.completeWorkOrder);

module.exports = router;
