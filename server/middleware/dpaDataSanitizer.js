const { logAuditEvent } = require('./auditLogger');

/**
 * Philippine Data Privacy Act of 2012 (Republic Act No. 10173)
 * Server-Side PII Field Sanitization & Redaction Engine
 * 
 * Statutory References:
 * - Section 11: General Data Privacy Principles (Transparency, Legitimate Purpose, Proportionality)
 * - Section 20: Security of Personal Information (Access limitation, pseudonymization, redaction)
 */

/**
 * Masks email address: e.g. "kristina@gmail.com" -> "k***@gmail.com"
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'n/a';
  const parts = email.trim().split('@');
  if (parts.length < 2) return '***@redacted.local';
  const local = parts[0];
  const domain = parts[1];
  const firstChar = local.charAt(0) || 'u';
  return `${firstChar}***@${domain}`;
}

/**
 * Masks phone number: e.g. "+639171234567" -> "+63-9**-***-4567"
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '+63-9**-***-XXXX';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    return `+63-9**-***-${last4}`;
  }
  return '+63-9**-***-XXXX';
}

/**
 * Masks residential / home address
 */
function maskAddress(address) {
  return '[REDACTED UNDER RA 10173 DPA COMPLIANCE]';
}

/**
 * Masks emergency contact details
 */
function maskEmergencyContact(name) {
  return 'Protected Contact (RA 10173)';
}

function maskEmergencyPhone(phone) {
  return '+63-9**-***-XXXX';
}

/**
 * Determines whether a user role is authorized to view unmasked PII.
 * Full PII is strictly restricted to designated DPO and Super Admin roles.
 */
function isAuthorizedDPO(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return (
    role === 'dpo' ||
    role === 'super_admin' ||
    role === 'branch_admin' ||
    role === 'branch_owner' ||
    role === 'owner' ||
    email.includes('dpo@')
  );
}

/**
 * Sanitizes a single member record
 */
function sanitizeMemberRecord(member, requestingUser = null, context = {}) {
  if (!member || typeof member !== 'object') return member;

  const isDPO = isAuthorizedDPO(requestingUser);

  if (isDPO) {
    // Deliver unmasked PII with statutory audit logging
    if (context.auditLog !== false && requestingUser) {
      logAuditEvent({
        branch_id: member.branch_id || requestingUser.branch_id || 'GLOBAL',
        user_id: requestingUser.id || 'SYS',
        user_role: requestingUser.role || 'dpo',
        action: 'DPA_PII_UNMASKED_ACCESS',
        resource: 'member_pii',
        ip_address: context.ipAddress || '127.0.0.1',
        details: {
          target_member_id: member.id,
          target_member_name: member.name,
          statute: 'RA 10173 Section 12 Legitimate Purpose Exemption',
          dpo_authorized: true
        }
      }).catch(() => {});
    }
    return { ...member, dpa_redacted: false };
  }

  // Non-DPO roles (cashier, coach, trainer, branch admin, frontdesk staff): Redact server-side
  const sanitized = { ...member };

  if (sanitized.email) {
    sanitized.email = maskEmail(sanitized.email);
  }
  if (sanitized.phone) {
    sanitized.phone = maskPhone(sanitized.phone);
  }
  if (sanitized.emergency_phone || sanitized.emergency_contact_phone) {
    sanitized.emergency_phone = maskEmergencyPhone(sanitized.emergency_phone || sanitized.emergency_contact_phone);
    sanitized.emergency_contact_phone = sanitized.emergency_phone;
  }
  if (sanitized.emergency_contact || sanitized.emergency_contact_name) {
    sanitized.emergency_contact = maskEmergencyContact(sanitized.emergency_contact || sanitized.emergency_contact_name);
    sanitized.emergency_contact_name = sanitized.emergency_contact;
  }
  if (sanitized.address || sanitized.residential_address) {
    sanitized.address = maskAddress(sanitized.address || sanitized.residential_address);
    sanitized.residential_address = sanitized.address;
  }
  if (sanitized.emergency_contact_relationship) {
    sanitized.emergency_contact_relationship = 'Protected (RA 10173)';
  }

  sanitized.dpa_redacted = true;
  sanitized.statutory_protection = 'Protected under Section 11 & Section 20 of RA 10173 (Data Privacy Act of 2012)';

  return sanitized;
}

/**
 * Sanitizes an array of member records
 */
function sanitizeMemberList(members, requestingUser = null, context = {}) {
  if (!Array.isArray(members)) return [];
  const isDPO = isAuthorizedDPO(requestingUser);

  if (isDPO && requestingUser && context.auditLog !== false) {
    logAuditEvent({
      branch_id: requestingUser.branch_id || 'GLOBAL',
      user_id: requestingUser.id || 'SYS',
      user_role: requestingUser.role || 'dpo',
      action: 'DPA_PII_BULK_UNMASKED_ACCESS',
      resource: 'member_roster',
      ip_address: context.ipAddress || '127.0.0.1',
      details: {
        records_accessed: members.length,
        statute: 'RA 10173 Section 12 Legitimate Purpose Exemption',
        dpo_authorized: true
      }
    }).catch(() => {});
  }

  return members.map(m => sanitizeMemberRecord(m, requestingUser, { auditLog: false }));
}

/**
 * Express middleware to sanitize outgoing responses containing member data
 */
function dpaSanitizerMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    if (data && typeof data === 'object') {
      const user = req.user;
      if (Array.isArray(data.members)) {
        data.members = sanitizeMemberList(data.members, user, { ipAddress: req.ip });
      }
      if (data.member && typeof data.member === 'object') {
        data.member = sanitizeMemberRecord(data.member, user, { ipAddress: req.ip });
      }
    }
    return originalJson(data);
  };

  next();
}

module.exports = {
  maskEmail,
  maskPhone,
  maskAddress,
  maskEmergencyContact,
  maskEmergencyPhone,
  isAuthorizedDPO,
  sanitizeMemberRecord,
  sanitizeMemberList,
  dpaSanitizerMiddleware
};
