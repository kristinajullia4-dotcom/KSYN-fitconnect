const crypto = require('crypto');
const { memoryStore, query, isPostgres } = require('../config/db');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeAuditHash(prevHash, id, branchId, userId, action, resource, details, createdAt) {
  const payload = `${prevHash}|${id}|${branchId || 'GLOBAL'}|${userId || 'SYS'}|${action}|${resource}|${JSON.stringify(details)}|${createdAt.toISOString()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function logAuditEvent({
  branch_id = null,
  user_id = null,
  user_role = null,
  action,
  resource,
  ip_address = '127.0.0.1',
  details = {}
}) {
  if (!memoryStore.audit_logs) {
    memoryStore.audit_logs = [];
  }

  const prevLog = memoryStore.audit_logs.length > 0 ? memoryStore.audit_logs[0] : null;
  const prev_hash = prevLog?.hash || GENESIS_HASH;
  const created_at = new Date();
  const id = crypto.randomUUID();
  const hash = computeAuditHash(prev_hash, id, branch_id, user_id, action, resource, details, created_at);

  const event = {
    id,
    branch_id,
    user_id,
    user_role,
    action,
    resource,
    ip_address,
    details,
    prev_hash,
    hash,
    created_at
  };

  try {
    if (isPostgres()) {
      await query(
        `INSERT INTO audit_logs (id, branch_id, user_id, user_role, action, resource, ip_address, details, prev_hash, hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          event.id,
          event.branch_id,
          event.user_id,
          event.user_role,
          event.action,
          event.resource,
          event.ip_address,
          JSON.stringify(event.details),
          event.prev_hash,
          event.hash,
          event.created_at
        ]
      );
    } else {
      // Prepend to immutable memory store audit trail
      memoryStore.audit_logs.unshift(event);
    }
  } catch (err) {
    console.error('[KSYN Audit Trail Error]: Failed to write audit record:', err.message);
  }

  return event;
}

/**
 * Validates the cryptographic integrity of the audit log chain
 * Returns verification report with any broken links or tampering detected
 */
function verifyAuditChain() {
  const logs = memoryStore.audit_logs || [];
  if (logs.length === 0) {
    return { verified: true, count: 0, message: 'Audit chain is pristine (empty).' };
  }

  // Logs are ordered newest-to-oldest (unshifted)
  // Verify backward from oldest to newest
  const chronological = [...logs].reverse();
  let expectedPrevHash = GENESIS_HASH;
  const tamperedRecords = [];

  for (let i = 0; i < chronological.length; i++) {
    const entry = chronological[i];
    const logDate = new Date(entry.created_at);

    if (entry.prev_hash && entry.prev_hash !== expectedPrevHash) {
      tamperedRecords.push({
        index: i,
        id: entry.id,
        reason: 'BROKEN_CHAIN_LINK',
        expected_prev_hash: expectedPrevHash,
        actual_prev_hash: entry.prev_hash
      });
    }

    if (entry.hash) {
      let detailsPayload = entry.details || {};
      let recomputed = computeAuditHash(
        entry.prev_hash || expectedPrevHash,
        entry.id,
        entry.branch_id,
        entry.user_id,
        entry.action,
        entry.resource,
        detailsPayload,
        logDate
      );

      // Gracefully handle empty array vs empty object serialization compatibility
      if (recomputed !== entry.hash && Array.isArray(detailsPayload) && detailsPayload.length === 0) {
        const fallbackHash = computeAuditHash(
          entry.prev_hash || expectedPrevHash,
          entry.id,
          entry.branch_id,
          entry.user_id,
          entry.action,
          entry.resource,
          {},
          logDate
        );
        if (fallbackHash === entry.hash) {
          recomputed = fallbackHash;
        }
      }

      if (recomputed !== entry.hash) {
        tamperedRecords.push({
          index: i,
          id: entry.id,
          reason: 'HASH_MISMATCH_TAMPERED_DATA',
          stored_hash: entry.hash,
          recomputed_hash: recomputed
        });
      }
      expectedPrevHash = entry.hash;
    }
  }

  return {
    verified: tamperedRecords.length === 0,
    count: logs.length,
    tampered_count: tamperedRecords.length,
    tampered_records: tamperedRecords,
    latest_block_hash: logs[0]?.hash || null,
    genesis_block_hash: chronological[0]?.hash || null,
    algorithm: 'SHA-256 Blockchain-Style Hash Chaining',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  logAuditEvent,
  verifyAuditChain
};
