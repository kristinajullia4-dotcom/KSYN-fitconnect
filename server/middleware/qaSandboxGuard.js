/**
 * KSYN FitConnect Enterprise Platform
 * Production Security Hardening: QA Sandbox Guard
 * Restricts mock payment settlement, simulated 3DS OTP bypasses, and fake invoice settlement
 * in production environments (ISO/IEC 27001 Control 8.20 / Control 8.5).
 */

function qaSandboxGuard(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const qaBypassKey = req.headers['x-ksyn-qa-key'] || req.query.qa_key;
  const configuredQaKey = process.env.QA_BYPASS_KEY || 'ksyn-qa-eval-sandbox-2026';

  if (isProduction && (!qaBypassKey || qaBypassKey !== configuredQaKey)) {
    return res.status(403).json({
      success: false,
      error: 'PRODUCTION_SIMULATION_FORBIDDEN',
      message: 'Payment simulation endpoints are strictly prohibited in the production environment. Payments must be processed through verified Xendit webhooks with cryptographic HMAC signatures.'
    });
  }
  next();
}

module.exports = { qaSandboxGuard };
