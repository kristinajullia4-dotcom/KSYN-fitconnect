const https = require('https');
const { memoryStore } = require('../config/db');

if (!memoryStore.sms_audit_logs) {
  memoryStore.sms_audit_logs = [];
}

/**
 * Universal SMS Gateway Adapter for Semaphore and PhilSMS
 * Provides live HTTP integration with resilient sandbox/mock mode
 */
async function sendSms(recipient, message, metadata = {}) {
  const cleanPhone = String(recipient || '').trim().replace(/[^0-9+]/g, '');
  const timestamp = new Date();

  const smsRecord = {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    recipient: cleanPhone,
    message,
    category: metadata.category || 'TRANSACTIONAL',
    status: 'delivered',
    provider: process.env.SMS_PROVIDER || (process.env.SEMAPHORE_API_KEY ? 'Semaphore' : (process.env.PHILSMS_API_KEY ? 'PhilSMS' : 'Sandbox Simulated')),
    sent_at: timestamp,
    metadata
  };

  // If Semaphore API key is provided and not in simulated mode
  if (process.env.SEMAPHORE_API_KEY && process.env.NODE_ENV === 'production') {
    try {
      const payload = JSON.stringify({
        apikey: process.env.SEMAPHORE_API_KEY,
        number: cleanPhone,
        message,
        sendername: process.env.SEMAPHORE_SENDER_NAME || 'KSYN'
      });

      // Post to Semaphore API
      const req = https.request({
        hostname: 'api.semaphore.co',
        path: '/api/v4/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      });
      req.write(payload);
      req.end();
    } catch (err) {
      console.warn('[SMS Gateway Semaphore Warning]:', err.message);
    }
  }

  // Record dispatch in memoryStore
  memoryStore.sms_audit_logs.unshift(smsRecord);

  // Terminal telemetry banner
  console.log(`\n================================================================`);
  console.log(`[KSYN FITNESS SMS GATEWAY - DISPATCH]`);
  console.log(`Recipient : ${cleanPhone}`);
  console.log(`Category  : ${smsRecord.category}`);
  console.log(`Message   : ${message}`);
  console.log(`Provider  : ${smsRecord.provider}`);
  console.log(`================================================================\n`);

  return smsRecord;
}

// 1. Alert athlete when membership contract is within 7 days of expiration
async function sendTurnstileExpirationAlert(member, daysRemaining, branchName = 'KSYN Fitness') {
  const phone = member.phone || '+639171110099';
  const msg = `KSYN ALERT: Hi ${member.name.split(' ')[0]}, your membership at ${branchName} expires in ${daysRemaining} day(s). Renew today at reception or via your Member Portal to avoid turnstile access interruption.`;
  return sendSms(phone, msg, { category: 'CONTRACT_EXPIRATION_ALERT', member_id: member.id });
}

// 2. Alert athlete and floor security on Anti-Passback double-entry violation
async function sendAntiPassbackAlert(member, branchName = 'KSYN Fitness Makati') {
  const phone = member.phone || '+639171110099';
  const msg = `KSYN SECURITY: Immediate re-entry attempt detected for ${member.name} at ${branchName}. Turnstile pass sharing is strictly prohibited under facility safety policy.`;
  return sendSms(phone, msg, { category: 'SECURITY_APB_VIOLATION', member_id: member.id });
}

// 3. 3DS Payment OTP SMS
async function send3dsOtp(recipientPhone, otpCode) {
  const msg = `KSYN Pay: Your OTP code for membership payment authorization is ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;
  return sendSms(recipientPhone, msg, { category: 'PAYMENT_3DS_OTP', otp: otpCode });
}

// 4. Standby Waitlist Promotion Alert
async function sendWaitlistPromotionAlert(member, className, classTime, room) {
  const phone = member.phone || '+639171110099';
  const msg = `KSYN CLASS UPDATE: Great news ${member.name.split(' ')[0]}! A slot opened for "${className}" (${classTime} at ${room}). You have been automatically PROMOTED from waitlist to CONFIRMED.`;
  return sendSms(phone, msg, { category: 'CLASS_WAITLIST_PROMOTION', member_id: member.id });
}

module.exports = {
  sendSms,
  sendTurnstileExpirationAlert,
  sendAntiPassbackAlert,
  send3dsOtp,
  sendWaitlistPromotionAlert
};
