/**
 * KSYN FitConnect Enterprise Platform
 * RFC 6238 Time-Based One-Time Password (TOTP) & RFC 4226 (HOTP) Cryptographic Engine
 * Complies with: ISO/IEC 27001:2022 Control 8.5 (Secure Authentication) & NIST SP 800-63B
 */
const crypto = require('crypto');

// RFC 4648 Base32 Alphabet (standard for Google Authenticator / Authy / Microsoft Authenticator)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode Buffer to RFC 4648 Base32 string
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decode RFC 4648 Base32 string to Buffer
 */
function base32Decode(str) {
  if (!str) return Buffer.alloc(0);
  const clean = String(str).toUpperCase().replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically strong 160-bit (20-byte) Base32 TOTP secret
 * Produces exactly 32 Base32 characters
 */
function generateSecret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  return base32Encode(bytes);
}

/**
 * Calculate RFC 6238 TOTP token for given timestamp
 * @param {string} secretBase32 - Base32 encoded secret key
 * @param {number} timestamp - Unix epoch time in milliseconds
 * @param {number} period - Time step in seconds (default 30s)
 * @param {number} digits - Code length (default 6 digits)
 */
function generateTotp(secretBase32, timestamp = Date.now(), period = 30, digits = 6) {
  const counter = Math.floor(timestamp / 1000 / period);
  const secretBytes = base32Decode(secretBase32);
  if (secretBytes.length === 0) return null;

  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const token = binary % Math.pow(10, digits);
  return String(token).padStart(digits, '0');
}

/**
 * Verify a submitted TOTP token against a secret key
 * Incorporates time drift window (default +- 1 step = +- 30s)
 * Uses crypto.timingSafeEqual to prevent side-channel timing attacks
 *
 * @param {string} token - 6-digit candidate code
 * @param {string} secretBase32 - Base32 secret string
 * @param {object} options - { window: 1, period: 30, digits: 6 }
 * @returns {boolean}
 */
function verifyTotp(token, secretBase32, options = {}) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }
  if (!secretBase32) return false;

  const window = typeof options.window === 'number' ? options.window : 1;
  const period = options.period || 30;
  const now = Date.now();

  for (let errorStep = -window; errorStep <= window; errorStep++) {
    const checkTime = now + (errorStep * period * 1000);
    const expected = generateTotp(secretBase32, checkTime, period, 6);
    if (expected) {
      const bufToken = Buffer.from(cleanToken);
      const bufExpected = Buffer.from(expected);
      if (bufToken.length === bufExpected.length && crypto.timingSafeEqual(bufToken, bufExpected)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Generate standard otpauth:// URI for QR code generation
 */
function generateOtpAuthUri(accountEmail, secretBase32, issuer = 'KSYN FitConnect') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountEmail || 'admin@ksyn.com');
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a set of 8 single-use emergency backup codes (XXXX-XXXX format)
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const p1 = Math.floor(1000 + Math.random() * 9000);
    const p2 = Math.floor(1000 + Math.random() * 9000);
    codes.push(`${p1}-${p2}`);
  }
  return codes;
}

/**
 * Validate and consume a single-use backup code
 * @returns {boolean} true if valid and consumed
 */
function verifyAndConsumeBackupCode(inputCode, user) {
  if (!user || !Array.isArray(user.backup_codes) || !inputCode) return false;
  const cleanInput = String(inputCode).trim().replace(/\s+/g, '');

  const idx = user.backup_codes.findIndex(code => {
    const cleanSaved = String(code).trim().replace(/\s+/g, '');
    return cleanSaved === cleanInput || cleanSaved.replace('-', '') === cleanInput.replace('-', '');
  });

  if (idx !== -1) {
    // Consume code (burn after single use)
    user.backup_codes.splice(idx, 1);
    return true;
  }
  return false;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  generateTotp,
  verifyTotp,
  generateOtpAuthUri,
  generateBackupCodes,
  verifyAndConsumeBackupCode
};
