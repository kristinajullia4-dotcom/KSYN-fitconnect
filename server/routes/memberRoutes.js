const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

router.use(authGuard);

router.get('/', rbacGuard('super_admin', 'branch_admin', 'employee', 'staff'), memberController.getMembers);
router.get('/progress', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.getProgress);
router.post('/progress', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.logProgress);
router.put('/target-weight', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.updateTargetWeight);
router.get('/strength-prs', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.getStrengthPRs);
router.post('/strength-prs', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.logStrengthPR);
router.get('/available-coaches', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.getAvailableCoaches);
router.get('/coaches', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.getAvailableCoaches);
router.post('/enroll-coach', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.enrollCoach);
router.post('/pt-enrollments/initiate', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.initiatePtEnrollment);
router.post('/pt-enrollments/confirm-payment', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.confirmPtEnrollmentPayment);
router.get('/pt-enrollments/status', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.getPtEnrollmentStatus);
router.get('/messages', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.getMemberMessages);
router.post('/messages', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.sendMemberMessage);
router.post('/messages/typing', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.setMemberTyping);
router.get('/floor-density', memberController.getFloorDensity);
router.get('/workout-plans', rbacGuard('member', 'coach', 'trainer', 'super_admin', 'branch_admin'), memberController.getMemberWorkoutPlans);
router.post('/workout-plans/:planId/complete-exercise', rbacGuard('member', 'coach', 'trainer'), memberController.toggleExerciseComplete);
router.get('/:memberId', memberController.getMemberById);
router.post('/subscription/toggle-auto-renew', rbacGuard('member', 'super_admin', 'branch_admin'), memberController.toggleAutoRenew);
router.post('/:memberId/renew', rbacGuard('super_admin', 'branch_admin', 'member'), memberController.renewSubscription);
router.patch('/:memberId/status', rbacGuard('super_admin', 'branch_admin'), memberController.updateMemberStatus);

module.exports = router;
