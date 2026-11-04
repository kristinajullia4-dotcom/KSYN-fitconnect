const { memoryStore, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Republic Act No. 10173 (Data Privacy Act of 2012) & BIR RR 5-2014
 * Automated Data Retention & Disposal Routine
 * 
 * Retention Schedules:
 *  1. Turnstile Scans & Optical Passes: Purge nonces older than 365 days.
 *  2. Inactive Guest PAR-Q Health Data: Anonymize entries for visitors who did not convert within 90 days.
 *  3. Financial & POS Tax Records: Protect and mark as archived for mandatory 10-year retention (BIR RR 5-2014).
 */

async function executeDpaRetentionPurge() {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

  let turnstileNoncesPurged = 0;
  let guestParqAnonymized = 0;
  let financialTaxRecordsProtected = 0;

  // 1. Purge turnstile nonces older than 365 days
  if (memoryStore.redeemed_nonces) {
    if (Array.isArray(memoryStore.redeemed_nonces)) {
      const initialNoncesCount = memoryStore.redeemed_nonces.length;
      memoryStore.redeemed_nonces = memoryStore.redeemed_nonces.filter(entry => {
        const entryDate = new Date(entry.timestamp || entry.created_at || entry.used_at || now);
        return entryDate >= oneYearAgo;
      });
      turnstileNoncesPurged += (initialNoncesCount - memoryStore.redeemed_nonces.length);
    } else if (typeof memoryStore.redeemed_nonces === 'object') {
      const cutoffMs = oneYearAgo.getTime();
      for (const [nonce, val] of Object.entries(memoryStore.redeemed_nonces)) {
        const entryMs = typeof val === 'number' ? val : (new Date(val?.timestamp || val || 0).getTime());
        if (entryMs < cutoffMs) {
          delete memoryStore.redeemed_nonces[nonce];
          turnstileNoncesPurged++;
        }
      }
    }
  }

  // Also purge transient QR passes in attendance logs older than 365 days
  if (Array.isArray(memoryStore.attendance_logs)) {
    memoryStore.attendance_logs.forEach(log => {
      const logDate = new Date(log.timestamp || log.check_in_time || now);
      if (logDate < oneYearAgo && log.transient_nonce) {
        delete log.transient_nonce;
        turnstileNoncesPurged++;
      }
    });
  }

  // 2. Anonymize Inactive Guest PAR-Q Data older than 90 days
  const activeUserEmails = new Set(
    (memoryStore.subscriptions || [])
      .filter(s => s.status === 'active')
      .map(s => {
        const u = (memoryStore.users || []).find(user => user.id === s.user_id);
        return u ? (u.email || '').toLowerCase() : '';
      })
      .filter(Boolean)
  );

  if (Array.isArray(memoryStore.free_pass_applications)) {
    memoryStore.free_pass_applications.forEach(app => {
      const appDate = new Date(app.created_at || now);
      const email = (app.email || '').toLowerCase();
      const hasActiveSub = activeUserEmails.has(email);

      if (appDate < ninetyDaysAgo && !hasActiveSub && !app.dpa_anonymized) {
        app.dpa_anonymized = true;
        app.anonymized_at = now.toISOString();
        app.name = `Anonymized Guest ${app.id ? app.id.slice(0, 6) : 'Visitor'}`;
        app.email = 'anonymized-parq@privacy.ksynpos.local';
        app.phone = '+63-9XX-XXX-0000';
        app.emergency_contact = 'Redacted (DPA Retention 90D)';
        app.emergency_phone = '+63-9XX-XXX-0000';
        if (app.parq_answers || app.parq) {
          app.parq_answers = { status: '[ANONYMIZED PER RA 10173 RETENTION POLICY]' };
          app.parq = { status: '[ANONYMIZED PER RA 10173 RETENTION POLICY]' };
        }
        guestParqAnonymized++;
      }
    });
  }

  // 3. Mark Financial & POS Tax Records for 10-year statutory retention (BIR RR 5-2014)
  const tenYearsFuture = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).toISOString();

  if (Array.isArray(memoryStore.sales)) {
    memoryStore.sales.forEach(sale => {
      if (!sale.bir_retention_years) {
        sale.bir_retention_years = 10;
        sale.bir_retention_until = tenYearsFuture;
        sale.bir_archive_status = 'MANDATORY_10_YEAR_STATUTORY_HOLD';
        financialTaxRecordsProtected++;
      }
    });
  }

  if (Array.isArray(memoryStore.bir_invoices)) {
    memoryStore.bir_invoices.forEach(inv => {
      if (!inv.bir_retention_years) {
        inv.bir_retention_years = 10;
        inv.bir_retention_until = tenYearsFuture;
        inv.bir_archive_status = 'MANDATORY_10_YEAR_STATUTORY_HOLD';
        financialTaxRecordsProtected++;
      }
    });
  }

  // Record cryptographic audit trail
  await logAuditEvent({
    branch_id: 'GLOBAL',
    user_id: 'SYSTEM_CRON',
    user_role: 'dpo',
    action: 'DPA_RETENTION_SCHEDULE_PURGE',
    resource: 'data_lifecycle',
    details: {
      turnstile_nonces_purged: turnstileNoncesPurged,
      guest_parq_anonymized: guestParqAnonymized,
      financial_tax_records_protected_10y: financialTaxRecordsProtected,
      statutes: ['RA 10173 Sections 11 & 20', 'BIR RR 5-2014 10-Year Books Retention']
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return {
    success: true,
    executed_at: now.toISOString(),
    retention_metrics: {
      turnstile_nonces_purged: turnstileNoncesPurged,
      guest_parq_anonymized: guestParqAnonymized,
      financial_tax_records_retained_10y: financialTaxRecordsProtected
    },
    statutory_citations: [
      'RA 10173 (Data Privacy Act of 2012) - Mandatory Purge of Stale Optical Nonces (>365d)',
      'RA 10173 - Non-converted Inactive Guest Health Records Anonymization (>90d)',
      'BIR RR 5-2014 - Mandatory 10-Year Preservation of Commercial Accounting and POS Books'
    ]
  };
}

/**
 * Initializes recurring cron schedule
 */
function startDpaRetentionSchedule() {
  // Run on startup
  executeDpaRetentionPurge().catch(err => {
    console.error('[DPA Retention Cron Startup Error]:', err.message);
  });

  // Run daily (every 24 hours = 86,400,000 ms)
  const timer = setInterval(() => {
    executeDpaRetentionPurge().catch(err => {
      console.error('[DPA Retention Daily Cron Error]:', err.message);
    });
  }, 24 * 60 * 60 * 1000);

  if (timer.unref) timer.unref();
  return timer;
}

module.exports = {
  executeDpaRetentionPurge,
  startDpaRetentionSchedule
};
