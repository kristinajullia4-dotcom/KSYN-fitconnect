const crypto = require('crypto');

/**
 * Normalizes branch ID, code, or name into official 3-letter uppercase branch code
 * MKT = Makati, ALB = Alabang, KAT = Katipunan, KAP = Kapitolyo, FRV = Fairview, DLM = Del Monte, TMO = Tomas Morato
 */
function getBranchCode(branchIdentifier) {
  if (!branchIdentifier) return 'MKT';
  const str = String(branchIdentifier).trim().toUpperCase();
  if (str.includes('MKT') || str.includes('MAKATI')) return 'MKT';
  if (str.includes('ALB') || str.includes('ALABANG')) return 'ALB';
  if (str.includes('KAT') || str.includes('KATIPUNAN')) return 'KAT';
  if (str.includes('KAP') || str.includes('KAPITOLYO')) return 'KAP';
  if (str.includes('FRV') || str.includes('FAIRVIEW')) return 'FRV';
  if (str.includes('DLM') || str.includes('DEL MONTE') || str.includes('DELMONTE')) return 'DLM';
  if (str.includes('TMO') || str.includes('MORATO')) return 'TMO';

  // Fallback: extract alphanumeric initials
  const cleaned = str.replace(/[^A-Z0-9]/g, '');
  return cleaned.length >= 3 ? cleaned.slice(0, 3) : 'MKT';
}

/**
 * Standardized External ID Generator across 3 primary transaction streams:
 * - POS:  POS-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
 * - PT:   PT-[BRANCH_CODE]-[COACH_ID]-[TIMESTAMP]
 * - PLAN: PLAN-[BRANCH_CODE]-[PLAN_TIER]-[TIMESTAMP]
 */
function generateExternalId(stream, branchIdentifier, extraParam = null) {
  const branchCode = getBranchCode(branchIdentifier);
  const timestamp = Math.floor(Date.now() / 1000); // 10-digit standard Unix timestamp
  const randomHash = crypto.randomBytes(3).toString('hex').slice(0, 5); // 5-character random hex hash

  const normalizedStream = String(stream).trim().toUpperCase();

  switch (normalizedStream) {
    case 'POS': {
      // Pattern: POS-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
      // Example: POS-MKT-1793170999-a1b2c
      return `POS-${branchCode}-${timestamp}-${randomHash}`;
    }

    case 'PT-POS':
    case 'PT_POS': {
      // Pattern: PT-POS-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
      // Example: PT-POS-MKT-1793212374-9f2b
      return `PT-POS-${branchCode}-${timestamp}-${randomHash}`;
    }

    case 'PT-OL':
    case 'PT_OL':
    case 'PT-ONLINE': {
      // Pattern: PT-OL-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
      // Example: PT-OL-MKT-1793212374-4a1c
      return `PT-OL-${branchCode}-${timestamp}-${randomHash}`;
    }

    case 'PT': {
      // If extraParam specifies channel origin ('POS' vs 'ONLINE')
      const channelParam = String(extraParam || '').trim().toUpperCase();
      if (channelParam === 'POS' || channelParam.includes('POS') || channelParam.includes('COUNTER')) {
        return `PT-POS-${branchCode}-${timestamp}-${randomHash}`;
      }
      if (channelParam === 'ONLINE' || channelParam.includes('PORTAL') || channelParam.includes('OL')) {
        return `PT-OL-${branchCode}-${timestamp}-${randomHash}`;
      }
      // Default to Online Portal channel format: PT-OL-[BRANCH]-[TIMESTAMP]-[HASH]
      return `PT-OL-${branchCode}-${timestamp}-${randomHash}`;
    }

    case 'PLAN': {
      // Pattern: PLAN-[BRANCH_CODE]-[PLAN_TIER]-[TIMESTAMP]
      // Example: PLAN-ALB-ELITE-1793171120
      let planTierSlug = 'BASIC';
      if (extraParam) {
        planTierSlug = String(extraParam)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/^PLAN_/, '')
          .slice(0, 12) || 'BASIC';
      }
      return `PLAN-${branchCode}-${planTierSlug}-${timestamp}`;
    }

    default:
      return `${normalizedStream}-${branchCode}-${timestamp}-${randomHash}`;
  }
}

/**
 * Inspect external ID prefix to demux incoming transaction stream
 */
function getStreamFromExternalId(externalId) {
  if (!externalId || typeof externalId !== 'string') return 'UNKNOWN';
  const trimmed = externalId.trim();
  if (trimmed.startsWith('POS-')) return 'POS';
  if (trimmed.startsWith('PT-POS-')) return 'PT_POS';
  if (trimmed.startsWith('PT-OL-')) return 'PT_ONLINE';
  if (trimmed.startsWith('PT-')) return 'PT';
  if (trimmed.startsWith('PLAN-') || trimmed.startsWith('inv_ksyn_')) return 'PLAN';
  return 'UNKNOWN';
}

/**
 * Standardized Xendit invoice description per transaction stream
 */
function formatStreamDescription(stream, params = {}) {
  const normalizedStream = String(stream).trim().toUpperCase();
  switch (normalizedStream) {
    case 'POS':
      return `[POS] Counter Order - Branch: ${params.branchName || params.branchCode || 'KSYN Fitness'}`;
    case 'PT':
      return `[PT Enrollment] ${params.packageName || 'Personal Training'} with ${params.coachName || 'Certified Trainer'}`;
    case 'PLAN':
      return `[Membership Plan] ${params.planName || params.planTier || 'Club Pass'} Subscription`;
    default:
      return `KSYN FitConnect Order - ${params.title || 'General'}`;
  }
}

module.exports = {
  getBranchCode,
  generateExternalId,
  getStreamFromExternalId,
  formatStreamDescription
};
