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

// Email System Diagnostic Endpoint
router.get('/mail-diagnostic', async (req, res) => {
  const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSBTg9ex_epmkEP01lHqQLsiALhGJ5kK4hGq_TH46udKM8f4tc14Ci-iNFW8T49ZlD/exec';
  const googleScriptUrl = (process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim();
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const emailUser = (process.env.EMAIL_USER || 'jmarquez.k12150582@umak.edu.ph').trim();
  const targetEmail = (req.query.to || 'kristinajullia4@gmail.com').trim().toLowerCase();
  const forceProvider = req.query.provider; // e.g. 'smtp'

  const diagnostic = {
    timestamp: new Date().toISOString(),
    environment: {
      has_google_script_url: !!googleScriptUrl,
      has_brevo_key: !!brevoKey,
      brevo_key_preview: brevoKey ? brevoKey.substring(0, 15) + '...' : null,
      has_resend_key: !!resendKey,
      email_user: emailUser,
      node_env: process.env.NODE_ENV || 'development',
      force_provider: forceProvider || 'auto'
    },
    test_recipient: targetEmail,
    test_result: null,
    test_error: null
  };

  try {
    const { sendOtpEmail, transporter } = require('../utils/mailer');
    if (forceProvider === 'smtp') {
      const info = await transporter.sendMail({
        from: `"KSYN Fitness" <${emailUser}>`,
        to: targetEmail,
        subject: 'KSYN Direct SMTP Test',
        text: 'Direct Google Workspace SMTP delivery verification.',
        html: '<p>Direct Google Workspace SMTP delivery verification.</p>'
      });
      diagnostic.test_result = { success: true, provider: 'direct-smtp', messageId: info.messageId };
    } else {
      const result = await sendOtpEmail(targetEmail, '888999', 'KSYN Diagnostic Runner', 'KSYN Fitness - Live Cloud Email Verification');
      diagnostic.test_result = result;
    }
    return res.json({ success: true, diagnostic });
  } catch (err) {
    diagnostic.test_error = {
      message: err.message,
      stack: err.stack
    };
    return res.status(500).json({ success: false, diagnostic });
  }
});

// Protected endpoints
router.post('/logout', authGuard, logout);
router.get('/profile', authGuard, getProfile);
router.put('/profile', authGuard, updateProfile);
router.patch('/profile', authGuard, updateProfile);
router.post('/provision', authGuard, rbacGuard('super_admin', 'branch_admin'), registerUser);

module.exports = router;
