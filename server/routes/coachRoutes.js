const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

// Restrict all coach endpoints to coach, trainer, branch_admin, super_admin, front_desk, and staff
router.use(authGuard);
router.use(rbacGuard('coach', 'trainer', 'branch_admin', 'super_admin', 'front_desk', 'employee', 'staff'));

router.get('/clients', coachController.getClients);
router.post('/clients/:clientId/renew-package', coachController.renewClientPackage);
router.post('/sessions', coachController.logSession);
router.post('/log-session', coachController.logSession);
router.get('/sessions', coachController.getSessions);
router.put('/clients/:clientId/metrics', coachController.updateClientMetrics);
router.get('/commissions', coachController.getCommissions);
router.get('/classes', coachController.getAssignedClasses);
router.post('/classes', coachController.scheduleClass);
router.delete('/classes/:classId', coachController.deleteClass);
router.post('/classes/check-in', coachController.checkInClassAttendee);
router.post('/classes/:classId/check-in', coachController.checkInClassAttendee);
router.get('/messages/:clientId?', coachController.getCoachMessages);
router.post('/messages', coachController.sendCoachMessage);
router.post('/messages/typing', coachController.setCoachTyping);
router.get('/workout-plans', coachController.getWorkoutPlans);
router.post('/workout-plans', coachController.createWorkoutPlan);
router.delete('/workout-plans/:planId', coachController.deleteWorkoutPlan);

// 13. In-Studio Class QR Scanner Check-In
router.post('/classes/:classId/scan-pass', coachController.scanClassQrPass);

// 14. 1RM Progressive Overload & Strength Records
router.get('/clients/:clientId/strength', coachController.getClientStrength);
router.post('/clients/:clientId/strength', coachController.recordClientStrength);

// 15. Nutrition & Macronutrient Prescription
router.get('/clients/:clientId/nutrition', coachController.getClientNutrition);
router.post('/clients/:clientId/nutrition', coachController.setClientNutrition);

// 16. Itemized Commission Slips with BIR 2307 Withholding Tax
router.get('/commission-slips', coachController.getItemizedCommissionSlips);

// 17. Branch Coach Verified Sessions & Commission Ledger (Front Desk & Branch Admin)
router.get('/branch-ledger', coachController.getBranchCoachLedger);

module.exports = router;
