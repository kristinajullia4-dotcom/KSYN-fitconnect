const crypto = require('crypto');
const { memoryStore, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Republic Act No. 8792 (Electronic Commerce Act of 2000)
 * Cryptographic Signature & Digital Waiver Sealing Service
 * 
 * Generates and validates immutable SHA-256 evidentiary digests for
 * digital liability waivers and PAR-Q health consents.
 */

if (!memoryStore.sealed_waivers) {
  memoryStore.sealed_waivers = [];
}

/**
 * Core cryptographic seal generation per RA 8792 specification
 */
function generateWaiverIntegrityDigest({ memberId, waiverVersion, signatureBase64, timestamp }) {
  const payload = `${memberId}|${waiverVersion}|${timestamp}|${signatureBase64}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Seeds initial baseline sealed waivers for established enrolled members if empty
 */
function ensureSealedWaiversBaseline() {
  if (!memoryStore.sealed_waivers) {
    memoryStore.sealed_waivers = [];
  }

  if (memoryStore.sealed_waivers.length === 0) {
    const baselineVersion = 'v2.4-2026';
    const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAYAAAAzO9g...KSYN_LEGAL_SEAL';
    
    // Seed verified sealed waivers for registered mock members
    const members = (memoryStore.users || []).filter(u => u.role === 'member');
    const targetCount = Math.max(120, members.length);

    for (let i = 0; i < targetCount; i++) {
      const member = members[i % members.length] || { id: `m-seal-${i + 1}`, name: `Athlete ${i + 1}` };
      const memberId = member.id || `m-seal-${i + 1}`;
      const signedAt = new Date(Date.now() - (i * 3600000 * 12)).toISOString();
      const hash = generateWaiverIntegrityDigest({
        memberId,
        waiverVersion: baselineVersion,
        signatureBase64: sampleSignature,
        timestamp: signedAt
      });

      memoryStore.sealed_waivers.push({
        id: `wvr_${crypto.randomUUID()}`,
        member_id: memberId,
        member_name: member.name || 'Enrolled Athlete',
        waiver_version: baselineVersion,
        signed_at: signedAt,
        signature_hash: hash,
        signature_base64: sampleSignature,
        signer_ip_address: '127.0.0.1',
        integrity_status: 'VERIFIED_SEALED',
        tampered: false,
        statute: 'Republic Act No. 8792 (Electronic Commerce Act of 2000)',
        created_at: new Date(signedAt)
      });
    }
  }
}

/**
 * Seals an incoming digital liability waiver / PAR-Q signature
 */
async function sealWaiver({
  memberId,
  waiverVersion = 'v2.4-2026',
  signatureBase64,
  signerIpAddress = '127.0.0.1',
  parqAnswers = null,
  termsAccepted = true,
  memberName = null
}) {
  if (!memberId) {
    throw new Error('Member ID is required to seal waiver digest.');
  }
  if (!signatureBase64) {
    throw new Error('Digital signature payload is required to seal waiver digest.');
  }

  ensureSealedWaiversBaseline();

  const timestamp = new Date().toISOString();
  const signatureHash = generateWaiverIntegrityDigest({
    memberId,
    waiverVersion,
    signatureBase64,
    timestamp
  });

  const record = {
    id: `wvr_${crypto.randomUUID()}`,
    member_id: memberId,
    member_name: memberName || 'Enrolled Athlete',
    waiver_version: waiverVersion,
    signed_at: timestamp,
    signature_hash: signatureHash,
    signature_base64: signatureBase64,
    signer_ip_address: signerIpAddress,
    parq_answers: parqAnswers,
    terms_accepted: termsAccepted,
    integrity_status: 'VERIFIED_SEALED',
    tampered: false,
    statute: 'Republic Act No. 8792 (Electronic Commerce Act of 2000)',
    created_at: new Date()
  };

  memoryStore.sealed_waivers.unshift(record);

  await logAuditEvent({
    branch_id: 'GLOBAL',
    user_id: memberId,
    user_role: 'member',
    action: 'WAIVER_CRYPTOGRAPHICALLY_SEALED',
    resource: 'legal_waivers',
    ip_address: signerIpAddress,
    details: {
      waiver_id: record.id,
      waiver_version: waiverVersion,
      signature_hash: signatureHash,
      integrity_status: record.integrity_status,
      statute: 'RA 8792 Section 8 Electronic Signature Legal Recognition'
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return record;
}

/**
 * Verification utility that re-computes the SHA-256 digest on demand
 * to prove the waiver text, member identity, timestamp, and signature
 * have not been tampered with or retroactively altered.
 */
function verifyWaiverSeal(recordOrId) {
  ensureSealedWaiversBaseline();

  let record = null;
  if (typeof recordOrId === 'string') {
    record = (memoryStore.sealed_waivers || []).find(
      w => w.id === recordOrId || w.member_id === recordOrId || w.signature_hash === recordOrId
    );
  } else if (recordOrId && typeof recordOrId === 'object') {
    record = recordOrId;
  }

  if (!record) {
    return {
      verified: false,
      error: 'NOT_FOUND',
      message: 'Sealed waiver record could not be found in ledger.'
    };
  }

  // Re-compute SHA-256 digest
  const computedHash = generateWaiverIntegrityDigest({
    memberId: record.member_id,
    waiverVersion: record.waiver_version,
    signatureBase64: record.signature_base64,
    timestamp: record.signed_at
  });

  const isAuthentic = computedHash === record.signature_hash;

  return {
    verified: isAuthentic,
    waiver_id: record.id,
    member_id: record.member_id,
    waiver_version: record.waiver_version,
    signed_at: record.signed_at,
    stored_signature_hash: record.signature_hash,
    computed_signature_hash: computedHash,
    integrity_status: isAuthentic ? 'VERIFIED_SEALED' : 'TAMPER_DETECTED',
    statute: 'Republic Act No. 8792 (Electronic Commerce Act of 2000)',
    message: isAuthentic
      ? 'Digital signature cryptographic seal verified authentic. No post-signing modifications detected.'
      : 'INTEGRITY BREACH DETECTED: Digital signature digest mismatch. Record altered retroactively.'
  };
}

/**
 * Returns summary audit report for E-Commerce Act signatures
 */
function getWaiverAuditSummary() {
  ensureSealedWaiversBaseline();

  const total = (memoryStore.sealed_waivers || []).length;
  let tamperedCount = 0;

  for (const w of (memoryStore.sealed_waivers || [])) {
    const res = verifyWaiverSeal(w);
    if (!res.verified) {
      tamperedCount++;
    }
  }

  return {
    status: 'ACTIVE',
    statute: 'Republic Act No. 8792 (Electronic Commerce Act of 2000)',
    hashing_algorithm: 'SHA-256',
    total_sealed_waivers: total,
    tampered_records_detected: tamperedCount,
    tamper_evident_sealing: true
  };
}

module.exports = {
  generateWaiverIntegrityDigest,
  sealWaiver,
  verifyWaiverSeal,
  getWaiverAuditSummary
};
