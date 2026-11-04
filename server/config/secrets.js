const crypto = require('crypto');

/**
 * Centralized Security Secrets Management
 * Validates, enforces, and exports cryptographic secrets for KSYN FitConnect Enterprise
 */

const isProd = process.env.NODE_ENV === 'production';

// Critical secrets definitions
function getOrGenerateSecret(envVar, defaultEntropyHint, requiredMinLength = 32) {
  const val = process.env[envVar];
  if (val && val.trim().length >= requiredMinLength) {
    if (isProd && (val.includes('ultra_secure_key') || val.includes('secret_key') || val.includes('fallback'))) {
      throw new Error(`[CRITICAL SECURITY ERROR] Insecure or default ${envVar} detected in production! You must supply a high-entropy secret.`);
    }
    return val.trim();
  }

  if (isProd) {
    throw new Error(`[CRITICAL SECURITY ERROR] ${envVar} must be set in production with at least ${requiredMinLength} characters.`);
  }

  // Development mode: Fallback with deterministic persistent secret across restarts
  const fallbackDevSecret = `dev_${defaultEntropyHint}_ksyn_master_persistent_secret_dev_2026`;
  return val && val.trim().length > 0 ? val.trim() : fallbackDevSecret;
}

const JWT_SECRET = getOrGenerateSecret('JWT_SECRET', 'jwt', 16);
const REFRESH_TOKEN_SECRET = getOrGenerateSecret('REFRESH_TOKEN_SECRET', 'refresh', 16);
const QR_HMAC_SECRET = getOrGenerateSecret('QR_HMAC_SECRET', 'qr_hmac', 16);
const PAYMENT_WEBHOOK_SECRET = getOrGenerateSecret('PAYMENT_WEBHOOK_SECRET', 'webhook', 16);

module.exports = {
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  QR_HMAC_SECRET,
  PAYMENT_WEBHOOK_SECRET,
  isProd
};
