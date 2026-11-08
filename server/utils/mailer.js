const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
// Permanently disable IPv6 DNS queries in Nodemailer resolver to prevent ENETUNREACH on Render/Docker
dns.resolve6 = (h, o, cb) => (typeof o === 'function' ? o : cb)(null, []);
if (dns.Resolver && dns.Resolver.prototype) {
  dns.Resolver.prototype.resolve6 = function(h, o, cb) {
    (typeof o === 'function' ? o : cb)(null, []);
  };
}
if (dns.promises) {
  dns.promises.resolve6 = async () => [];
}
const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_EMAIL_USER = 'jmarquez.k12150582@umak.edu.ph';
const DEFAULT_EMAIL_PASS = 'ycgmrwgkzwhumbtj';

function isPlaceholderConfig() {
  return false; // Live email dispatch active across all environments
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  lookup: (hostname, options, callback) => {
    // Explicitly enforce IPv4 resolution to prevent ENETUNREACH on Render/Docker cloud networks
    return dns.lookup(hostname, { family: 4 }, callback);
  },
  auth: {
    user: (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim(),
    pass: (process.env.EMAIL_PASS || DEFAULT_EMAIL_PASS).trim()
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection on module load if not in API-only mode
if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
  transporter.verify((err, success) => {
    if (err) {
      console.warn('[KSYN Mailer Warning] SMTP Gmail connection notice:', err.message);
    } else {
      console.log('[KSYN Mailer] Live Gmail SMTP connection verified successfully (IPv4)! Ready to dispatch emails.');
    }
  });
}

/**
 * Universal Email Dispatcher
 * Automatically uses HTTPS REST API (Port 443 - Brevo or Resend) when configured,
 * completely bypassing Render Free tier SMTP firewall blocks!
 */
async function dispatchEmail(options) {
  const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSBTg9ex_epmkEP01lHqQLsiALhGJ5kK4hGq_TH46udKM8f4tc14Ci-iNFW8T49ZlD/exec';
  const googleScriptUrl = (process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim();
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const senderEmail = (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();

  // 0. Google Apps Script HTTPS Relay (Port 443 - Native Gmail delivery to ANY inbox worldwide with zero holds)
  if (googleScriptUrl) {
    try {
      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Google Apps Script handles text/plain without CORS preflight
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text
        }),
        redirect: 'follow'
      });
      const data = await response.json();
      if (data && data.success) {
        console.log(`[MAIL SUCCESS via Google Apps Script] Delivered to ${options.to}`);
        return { success: true, provider: 'google-apps-script', messageId: data.messageId || 'gas-' + Date.now() };
      }
    } catch (gasErr) {
      console.warn('[Google Apps Script Warning - Falling back]:', gasErr.message);
    }
  }

  // 1. Resend HTTPS API (Port 443 - Sub-second delivery, zero compliance hold)
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'KSYN Fitness <onboarding@resend.dev>',
          to: [options.to],
          reply_to: options.replyTo || senderEmail,
          subject: options.subject,
          html: options.html,
          text: options.text
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Resend API HTTP ${response.status}`);
      }
      console.log(`[MAIL SUCCESS via Resend HTTPS] Email delivered to ${options.to} (MessageId: ${data.id})`);
      return { success: true, provider: 'resend', messageId: data.id };
    } catch (resendErr) {
      console.warn('[Resend HTTPS Warning - Auto Fallback]:', resendErr.message);
      // Gracefully fall through to Brevo or Google SMTP rather than aborting!
    }
  }

  // 2. Brevo HTTPS API (Port 443 - Guaranteed free cloud delivery to any inbox)
  if (brevoApiKey) {
    const brevoSender = (process.env.BREVO_SENDER_EMAIL || 'kristinajullia4@gmail.com').trim();
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'KSYN Fitness', email: brevoSender },
          to: [{ email: options.to, name: options.toName || options.to.split('@')[0] }],
          replyTo: options.replyTo ? { email: options.replyTo } : { email: brevoSender },
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Brevo API HTTP ${response.status}`);
      }
      console.log(`[MAIL SUCCESS via Brevo HTTPS] Email delivered to ${options.to} (MessageId: ${data.messageId})`);
      return { success: true, provider: 'brevo', messageId: data.messageId };
    } catch (brevoErr) {
      console.warn('[Brevo HTTPS Warning - Auto Fallback]:', brevoErr.message);
      // Gracefully fall through to Google SMTP rather than aborting!
    }
  }

  // 3. Fallback: SMTP via Google (Port 465) for local / paid / unblocked environments
  try {
    const info = await transporter.sendMail({
      from: `"KSYN Fitness" <${senderEmail}>`,
      to: options.to,
      replyTo: options.replyTo || senderEmail,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    console.log(`[MAIL SUCCESS via SMTP] Email delivered to ${options.to} (MessageId: ${info.messageId})`);
    return { success: true, provider: 'smtp', messageId: info.messageId };
  } catch (smtpErr) {
    console.error(`[SMTP ERROR on ${options.to}]:`, smtpErr.message);
    throw new Error(
      `Email delivery timed out (${smtpErr.message}). Render Free Tier blocks outbound SMTP ports 465/587. Please add your BREVO_API_KEY in Render Environment tab to dispatch via HTTPS Port 443.`
    );
  }
}

/**
 * Send 6-digit OTP verification email
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} [userName] - Optional recipient name
 * @param {string} [customSubject] - Optional custom email subject
 */
async function sendOtpEmail(toEmail, otpCode, userName = null, customSubject = null) {
  const recipient = toEmail ? toEmail.trim() : '';
  const senderUser = (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const isPasswordReset = (customSubject && customSubject.toLowerCase().includes('password')) || false;
  const subject = customSubject || 'KSYN Fitness - Your Account Verification Code';
  const headerSubtitle = isPasswordReset ? 'Security Authorization Protocol' : 'Account Verification Protocol';
  const titleText = isPasswordReset ? 'Password Reset Authorization' : 'Complete your athlete registration';
  const instructionText = isPasswordReset
    ? 'Use the single-use 6-digit authorization code below to reset your password:'
    : 'Use the single-use 6-digit authorization code below to verify your email address:';

  const mailOptions = {
    from: `"KSYN Fitness" <${senderUser}>`,
    to: recipient,
    subject: subject,
    text: `Your KSYN Fitness verification code is: ${otpCode}. This code will expire in 10 minutes.`,
    html: `
      <div style="background-color: #0d0f12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 36px 20px; border-radius: 8px; max-width: 520px; margin: 0 auto; border: 1px solid #262a30;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #F5C518; font-size: 26px; font-weight: 900; letter-spacing: 3px; margin: 0; text-transform: uppercase;">KSYN FITNESS</h1>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 6px; text-transform: uppercase; letter-spacing: 1.5px;">${headerSubtitle}</p>
        </div>
        <div style="background-color: #14171d; border-radius: 8px; padding: 28px 24px; text-align: center; border: 1px solid #2e333d;">
          <p style="color: #e5e7eb; font-size: 15px; margin: 0 0 16px 0; font-weight: 500;">${titleText}</p>
          ${userName ? `<p style="color: #f5c518; font-size: 13px; margin: 0 0 12px 0;">Hello ${userName},</p>` : ''}
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 24px 0;">${instructionText}</p>
          <div style="margin: 20px 0; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #F5C518; background: #0a0c10; padding: 18px 12px; border-radius: 6px; border: 1px dashed #F5C518; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.</p>
        </div>
        <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 11px; line-height: 1.4;">
          If you did not initiate this request, please disregard this transmission.<br/>
          &copy; ${new Date().getFullYear()} KSYN Fitness Inc. All rights reserved.
        </div>
      </div>
    `
  };

  console.log('\n' + '='.repeat(64));
  console.log('[KSYN FITNESS AUTH ENGINE - EMAIL OTP DISPATCH]');
  console.log(`Recipient : ${recipient}`);
  console.log(`Subject   : ${subject}`);
  console.log(`OTP Code  : [ ${otpCode} ]`);
  console.log(`Validity  : Expires in 10 minutes`);
  console.log(`Facility  : KSYN Member Gateway`);
  console.log('='.repeat(64) + '\n');

  return await dispatchEmail({
    to: recipient,
    toName: userName,
    subject: subject,
    text: `Your KSYN Fitness verification code is: ${otpCode}. This code will expire in 10 minutes.`,
    html: mailOptions.html
  });
}

/**
 * Send 1-Day Free Pass award email with single-use guest QR access pass
 * @param {string} toEmail - Recipient email
 * @param {string} applicantName - Recipient full name
 * @param {string} branchName - Selected gym branch
 * @param {string} passCode - Single-use guest QR code string
 */
async function sendFreePassAwardEmail(toEmail, applicantName, branchName, passCode) {
  const recipient = toEmail ? toEmail.trim() : '';
  const senderUser = (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const subject = `Congratulations! You won a KSYN 1-Day Trial Pass - ${branchName || 'KSYN Fitness'}`;

  console.log(`\n============================================================`);
  console.log(`[FREE PASS RAFFLE DISPATCHED] Single-Use Guest Pass Generated`);
  console.log(`Winner: ${applicantName} <${recipient}>`);
  console.log(`Branch: ${branchName}`);
  console.log(`Single-Use QR Pass Code: ${passCode}`);
  console.log(`============================================================\n`);

  const mailOptions = {
    from: `"KSYN Fitness" <${senderUser}>`,
    to: recipient,
    subject: subject,
    text: `Congratulations ${applicantName}! You have been selected for this month's Complimentary 1-Day Trial Pass at ${branchName}. Your single-use access code is: ${passCode}. Present this at the front desk turnstile.`,
    html: `
      <div style="background-color: #0d0f12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 36px 20px; border-radius: 8px; max-width: 540px; margin: 0 auto; border: 1px solid #262a30;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #F5C518; font-size: 26px; font-weight: 900; letter-spacing: 3px; margin: 0; text-transform: uppercase;">KSYN FITNESS</h1>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 6px; text-transform: uppercase; letter-spacing: 1.5px;">Complimentary 1-Day Access Pass</p>
        </div>

        <div style="background-color: #14171d; border-radius: 12px; padding: 28px 24px; text-align: center; border: 1px solid #2e333d;">
          <div style="display: inline-block; background: rgba(245, 197, 24, 0.15); color: #F5C518; border: 1px solid rgba(245, 197, 24, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 16px;">
            Monthly Free Pass Winner
          </div>
          <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Congratulations, ${applicantName}!</p>
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
            You have been selected by <strong style="color: #F5C518;">${branchName || 'KSYN Fitness'}</strong> for this month's complimentary 1-Day Trial Pass. Enjoy full access to our state-of-the-art strength facility, recovery zones, and cardio deck.
          </p>

          <div style="margin: 24px 0; background: #0a0c10; padding: 20px; border-radius: 8px; border: 1px dashed #F5C518;">
            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Single-Use Guest Pass Code</div>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #F5C518; font-family: monospace;">
              ${passCode}
            </div>
            <div style="color: #6b7280; font-size: 11px; margin-top: 8px;">Present this digital code or barcode at the turnstile / front desk</div>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0 0;">
            Valid for a single-day visit within <strong>30 days</strong> from receipt. Single-use only. Valid photo ID required upon entry.
          </p>
        </div>

        <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 11px; line-height: 1.4;">
          KSYN High-Performance Gym & Franchise Network &bull; Manila, Philippines<br/>
          &copy; ${new Date().getFullYear()} KSYN Fitness Inc. All rights reserved.
        </div>
      </div>
    `
  };

  const result = await dispatchEmail({
    to: recipient,
    toName: applicantName,
    subject: subject,
    text: mailOptions.text,
    html: mailOptions.html
  });
  return { success: true, ...result, passCode };
}

/**
 * Send Franchise Discovery & Due Diligence Invitation Email
 * @param {Object} options
 * @param {string} options.toEmail - Applicant's email address
 * @param {string} options.applicantName - Applicant's full name
 * @param {string} [options.companyName] - Applicant's entity/company name
 * @param {string} [options.desiredLocation] - Target franchise territory
 * @param {string} options.interviewType - 'Video Call' | 'In-Person (HQ Boardroom)'
 * @param {string|Date} options.interviewDatetime - Proposed meeting date & time
 * @param {string} options.meetingDetails - Link or physical address
 * @param {Array<string>} [options.requestedDocs] - List of required documents
 * @param {string} [options.customMessage] - Executive message from Super Admin
 */
async function sendFranchiseDiscoveryEmail({
  toEmail,
  applicantName,
  companyName = '',
  desiredLocation = '',
  interviewType = 'Video Call',
  interviewDatetime,
  meetingDetails,
  requestedDocs = [],
  customMessage = ''
}) {
  const recipient = toEmail ? toEmail.trim() : '';
  const senderUser = (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const replyToEmail = senderUser;
  const subject = 'KSYN Fitness Franchise — Discovery Meeting & Credential Verification';

  const formattedDate = interviewDatetime
    ? new Date(interviewDatetime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    : 'To be coordinated';

  const defaultDocs = [
    "Government-Issued Valid ID (Passport, UMID, Driver's License)",
    "Company / SEC / DTI Registration Certificate",
    "Bank Reference / Proof of Financial Capacity (Liquid Capital)"
  ];
  const docList = Array.isArray(requestedDocs) && requestedDocs.length > 0 ? requestedDocs : defaultDocs;

  console.log(`\n============================================================`);
  console.log(`[FRANCHISE DISCOVERY DISPATCHED] Due Diligence Request`);
  console.log(`Applicant: ${applicantName} <${recipient}>`);
  console.log(`Territory: ${desiredLocation || 'N/A'}`);
  console.log(`Meeting Format: ${interviewType}`);
  console.log(`Proposed Time: ${formattedDate}`);
  console.log(`Location / Link: ${meetingDetails}`);
  console.log(`Required Docs: ${docList.length} items`);
  console.log(`============================================================\n`);

  const isMeetingLink = meetingDetails && (meetingDetails.startsWith('http://') || meetingDetails.startsWith('https://'));

  const mailOptions = {
    from: `"KSYN Corporate HQ" <${senderUser}>`,
    to: recipient,
    replyTo: replyToEmail,
    subject: `KSYN Fitness Franchise — Discovery Meeting Invitation (${applicantName})`,
    text: `Hello ${applicantName},

Thank you for your interest in opening a KSYN Fitness franchise in ${desiredLocation || 'our network'}. We have reviewed your application and would like to invite you to an introductory discovery meeting.

Meeting Details:
- Proposed Schedule: ${formattedDate}
- Format: ${interviewType}
- Meeting Link / Location: ${meetingDetails}

${docList.length > 0 ? `Required Documents:
Prior to our meeting, please reply to this email with a copy of:
${docList.map(d => `- ${d}`).join('\n')}
` : ''}
${customMessage && customMessage.trim() ? `Note from KSYN Management:
${customMessage.trim()}
` : ''}
Need to reschedule?
If this date or time does not work for you, simply reply directly to this email with your preferred schedule and our team will coordinate a new time.

Best regards,
KSYN Franchise Team
Manila, Philippines`,
    html: `
      <div style="background-color: #0d0f12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px 18px; border-radius: 8px; max-width: 580px; margin: 0 auto; border: 1px solid #262a30;">
        <div style="text-align: center; margin-bottom: 22px;">
          <h1 style="color: #F5C518; font-size: 24px; font-weight: 900; letter-spacing: 2.5px; margin: 0; text-transform: uppercase;">KSYN FITNESS</h1>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Franchise Partnership Discovery</p>
        </div>

        <div style="background-color: #14171d; border-radius: 12px; padding: 26px 22px; border: 1px solid #2e333d;">
          <p style="color: #ffffff; font-size: 17px; margin: 0 0 10px 0; font-weight: 700;">
            Dear ${applicantName}${companyName ? ` (${companyName})` : ''},
          </p>

          <p style="color: #d1d5db; font-size: 13px; line-height: 1.6; margin: 0 0 18px 0;">
            Thank you for your interest in opening a KSYN Fitness franchise in <strong style="color: #F5C518;">${desiredLocation || 'our network'}</strong>. We have reviewed your application and would like to invite you to an introductory discovery meeting.
          </p>

          <div style="background: #0a0c10; padding: 16px 18px; border-radius: 8px; border: 1px solid #262626; margin-bottom: 18px; font-size: 13px; line-height: 1.6;">
            <div style="margin-bottom: 8px;">
              <strong style="color: #9ca3af;">Proposed Schedule:</strong> <span style="color: #34d399; font-weight: 700;">${formattedDate}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: #9ca3af;">Format:</strong> <span style="color: #ffffff;">${interviewType}</span>
            </div>
            <div>
              <strong style="color: #9ca3af;">Meeting Link / Venue:</strong><br/>
              ${isMeetingLink ? `<a href="${meetingDetails}" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all; font-family: monospace;">${meetingDetails}</a>` : `<span style="color: #ffffff;">${meetingDetails}</span>`}
            </div>
          </div>

          ${docList.length > 0 ? `
            <p style="color: #d1d5db; font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">
              Prior to our meeting, please reply to this email with a copy of:
            </p>
            <ul style="margin: 0 0 18px 0; padding-left: 20px; color: #f3f4f6; font-size: 12px; line-height: 1.8;">
              ${docList.map(doc => `<li>${doc}</li>`).join('')}
            </ul>
          ` : ''}

          ${customMessage && customMessage.trim() ? `
            <div style="background: #0a0c10; padding: 14px 18px; border-radius: 8px; border-left: 3px solid #F5C518; margin-bottom: 18px;">
              <span style="color: #F5C518; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Note from Corporate HQ:</span>
              <p style="color: #e5e7eb; font-size: 12px; line-height: 1.5; margin: 0; white-space: pre-wrap;">${customMessage.trim()}</p>
            </div>
          ` : ''}

          <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; padding: 14px 18px; margin-bottom: 18px;">
            <strong style="color: #93c5fd; font-size: 12.5px; display: block; margin-bottom: 4px;">Need to reschedule?</strong>
            <p style="color: #cbd5e1; font-size: 12px; margin: 0 0 10px 0; line-height: 1.5;">
              If this date or time does not work for you, simply reply directly to this email with your preferred schedule and our team will coordinate a new time.
            </p>
            <a href="mailto:${replyToEmail}?subject=Reschedule%20Request%20-%20Franchise%20Discovery%20Meeting%20(${encodeURIComponent(applicantName)})&body=Hi%20KSYN%20Franchise%20Team,%0A%0AI%20would%20like%20to%20request%20to%20reschedule%20our%20discovery%20session.%0A%0AMy%20available%20dates%20and%20times:%0A1.%20%0A2.%20%0A%0AThank%20you,%0A${encodeURIComponent(applicantName)}" style="display: inline-block; background: #1e293b; color: #f8fafc; border: 1px solid #3b82f6; border-radius: 6px; padding: 7px 14px; font-size: 11px; font-weight: 700; text-decoration: none;">
              Reply to Request Reschedule
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0 0 16px 0;">
            We look forward to meeting you and exploring this franchise opportunity together.
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.4;">
            Best regards,<br/>
            <strong style="color: #ffffff;">KSYN Franchise Team</strong><br/>
            <span style="font-size: 11px; color: #6b7280;">Corporate HQ &bull; Manila, Philippines</span>
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 11px; line-height: 1.4;">
          KSYN Enterprise Gym & Franchise Network &bull; Corporate Boardroom, Taguig, Philippines<br/>
          &copy; ${new Date().getFullYear()} KSYN Fitness Inc. All inquiries remain confidential.
        </div>
      </div>
    `
  };

  return await dispatchEmail({
    to: recipient,
    toName: applicantName,
    replyTo: replyToEmail,
    subject: `KSYN Fitness Franchise — Discovery Meeting Invitation (${applicantName})`,
    text: mailOptions.text,
    html: mailOptions.html
  });
}

/**
 * Send Multi-Branch Member Transfer Coordination Email to Target/Origin Branch Admin
 */
async function sendTransferCoordinationEmail({
  recipientEmail,
  recipientName,
  senderName,
  senderBranchName,
  memberName,
  memberEmail,
  originBranchName,
  targetBranchName,
  requestId,
  subject,
  message
}) {
  const mailOptions = {
    from: `"KSYN Multi-Branch Transfer Protocol" <${(process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim()}>`,
    to: recipientEmail,
    subject: subject || `[KSYN Transfer Clearance] Inter-Branch Member Coordination: ${memberName} (${requestId})`,
    text: message || `Inter-branch member transfer clearance requested for ${memberName}.`,
    html: `
      <div style="background-color: #0d0f12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 36px 20px; border-radius: 8px; max-width: 580px; margin: 0 auto; border: 1px solid #262a30;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #F5C518; font-size: 24px; font-weight: 900; letter-spacing: 2px; margin: 0; text-transform: uppercase;">KSYN FITCONNECT</h1>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 6px; text-transform: uppercase; letter-spacing: 1.5px;">Multi-Branch Transfer & Records Coordination Protocol</p>
        </div>
        <div style="background-color: #14171d; border-radius: 8px; padding: 24px; border: 1px solid #2e333d;">
          <div style="font-size: 14px; color: #f3f4f6; margin-bottom: 16px;">
            Hello <strong>${recipientName || 'Branch Administrator'}</strong>,
          </div>
          <p style="color: #d1d5db; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            This is an official inter-facility transfer communication from <strong>${senderName}</strong> (${senderBranchName}) regarding athlete member transfer record <code>${requestId}</code>.
          </p>
          <div style="background: #0a0c10; padding: 16px; border-radius: 6px; border: 1px solid #262626; margin-bottom: 16px; font-size: 12px; line-height: 1.8;">
            <div><strong style="color: #9ca3af;">Athlete Name:</strong> <span style="color: #ffffff; font-weight: 700;">${memberName}</span></div>
            <div><strong style="color: #9ca3af;">Athlete Email:</strong> <span style="color: #e1c256;">${memberEmail}</span></div>
            <div><strong style="color: #9ca3af;">Originating Facility:</strong> <span style="color: #fca5a5;">${originBranchName}</span></div>
            <div><strong style="color: #9ca3af;">Target Destination Facility:</strong> <span style="color: #86efac; font-weight: 700;">${targetBranchName}</span></div>
            <div><strong style="color: #9ca3af;">Transfer Request ID:</strong> <span style="color: #93c5fd; font-family: monospace;">${requestId}</span></div>
          </div>
          ${message ? `
            <div style="background: rgba(225, 194, 86, 0.08); padding: 14px 16px; border-radius: 6px; border-left: 3px solid #e1c256; margin-bottom: 16px;">
              <div style="color: #e1c256; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">Coordination Message:</div>
              <p style="color: #f3f4f6; font-size: 12px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          ` : ''}
          <p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 0;">
            Under KSYN multi-tenant governance (DPA Section 11 & RA 10173), member health profiles and RFID turnstile privileges transfer securely upon two-stage mutual authorization.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 11px; line-height: 1.4;">
          KSYN FitConnect Enterprise &bull; Cross-Branch Clearing Protocol<br/>
          &copy; ${new Date().getFullYear()} KSYN Fitness Inc. All rights reserved.
        </div>
      </div>
    `
  };

  return await dispatchEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: mailOptions.subject,
    text: mailOptions.text,
    html: mailOptions.html
  });
}

module.exports = {
  transporter,
  sendOtpEmail,
  sendFreePassAwardEmail,
  sendFranchiseDiscoveryEmail,
  sendTransferCoordinationEmail,
  isPlaceholderConfig
};
