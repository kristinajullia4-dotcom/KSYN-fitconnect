const express = require('express');
const router = express.Router();
const {
  login,
  verifyMfa,
  logout,
  refresh,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  register,
  demoSwitchRole,
  getProfile,
  updateProfile,
  registerUser,
  forgotPassword,
  resetPassword,
  googleLogin,
  completeGoogleRegistration
} = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');

// Public endpoints
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);
router.post('/refresh', refresh);
router.post('/send-registration-otp', sendRegistrationOtp);
router.post('/verify-registration-otp', verifyRegistrationOtp);
router.post('/register', register);
router.post('/demo-switch', demoSwitchRole);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google', googleLogin);
router.post('/google/complete', completeGoogleRegistration);

// Protected endpoints
router.post('/logout', authGuard, logout);
router.get('/profile', authGuard, getProfile);
router.put('/profile', authGuard, updateProfile);
router.patch('/profile', authGuard, updateProfile);
router.post('/provision', authGuard, rbacGuard('super_admin', 'branch_admin'), registerUser);

module.exports = router;
