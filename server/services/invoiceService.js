const crypto = require('crypto');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * BIR CAS / POS Gapless Monotonic Invoicing Service
 * Standard Compliance: BIR RMO No. 10-2005, RR 9-2009, & RR 5-2014
 * 
 * Invoicing Format: [BRANCH_CODE]-INV-[YYYYMMDD]-[000001]
 * Guarantees:
 *  1. Zero-gap monotonic sequence incrementation.
 *  2. Immutable audit log linking.
 *  3. Strictly forbidden record deletion or sequence number reuse.
 *  4. Full statutory 12% VAT decomposition (Taxable, Exempt, VAT Amount).
 */

// Initialize store collections if absent
if (!memoryStore.bir_invoices) {
  memoryStore.bir_invoices = [];
}
if (!memoryStore.bir_invoice_sequences) {
  memoryStore.bir_invoice_sequences = {};
}

/**
 * Normalizes branch code to standard 3-4 uppercase characters
 * e.g., 'b-mkt-01' -> 'MKT', 'b-kat-02' -> 'KAT', 'b-alb-03' -> 'ALB'
 */
function normalizeBranchCode(branchIdentifier) {
  if (!branchIdentifier) return 'MKT';
  const raw = String(branchIdentifier).toUpperCase().trim();
  if (raw.startsWith('B-')) {
    const parts = raw.split('-');
    return parts[1] || 'MKT';
  }
  const clean = raw.replace(/[^A-Z0-9]/g, '');
  return clean.slice(0, 4) || 'MKT';
}

/**
 * Formats date into YYYYMMDD
 */
function formatDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Atomically generates next monotonic sequential invoice number
 * Format: [BRANCH_CODE]-INV-[YYYYMMDD]-[000001]
 */
function generateSequentialInvoiceNumber(branchIdentifier, date = new Date()) {
  const branchCode = normalizeBranchCode(branchIdentifier);
  const dateKey = formatDateKey(date);
  
  if (!memoryStore.bir_invoice_sequences) {
    memoryStore.bir_invoice_sequences = {};
  }
  if (!memoryStore.bir_invoice_sequences[branchCode]) {
    memoryStore.bir_invoice_sequences[branchCode] = {
      dates: {},
      lifetime_count: 0
    };
  }

  const branchSeq = memoryStore.bir_invoice_sequences[branchCode];
  if (!branchSeq.dates[dateKey]) {
    // Scan existing invoices in memory store to resume without duplicate or gap
    let maxForDate = 0;
    (memoryStore.bir_invoices || []).forEach(inv => {
      if (inv.branch_code === branchCode && inv.invoice_date_key === dateKey) {
        const seqMatch = inv.invoice_number?.match(/-(\d{6})$/);
        if (seqMatch) {
          const num = parseInt(seqMatch[1], 10);
          if (num > maxForDate) maxForDate = num;
        }
      }
    });
    branchSeq.dates[dateKey] = maxForDate;
  }

  // Atomic increment
  branchSeq.dates[dateKey] += 1;
  branchSeq.lifetime_count = (branchSeq.lifetime_count || 0) + 1;
  const currentSeq = branchSeq.dates[dateKey];
  const paddedSeq = String(currentSeq).padStart(6, '0');
  const invoiceNumber = `${branchCode}-INV-${dateKey}-${paddedSeq}`;

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return {
    invoiceNumber,
    sequenceNumber: currentSeq,
    branchCode,
    dateKey
  };
}

/**
 * Calculates statutory Philippine 12% Value-Added Tax decomposition
 */
function calculateVatBreakdown(grossAmount, isVatExempt = false) {
  const gross = Math.round(Number(grossAmount || 0) * 100) / 100;
  if (isVatExempt || gross <= 0) {
    return {
      gross_amount: gross,
      net_sales: gross,
      vat_taxable_sales: 0.00,
      vat_exempt_sales: gross,
      zero_rated_sales: 0.00,
      vat_amount_12pct: 0.00
    };
  }

  // Standard 12% VAT Inclusive Formula: Net = Gross / 1.12
  const netOfVat = Math.round((gross / 1.12) * 100) / 100;
  const vatAmount = Math.round((gross - netOfVat) * 100) / 100;

  return {
    gross_amount: gross,
    net_sales: netOfVat,
    vat_taxable_sales: netOfVat,
    vat_exempt_sales: 0.00,
    zero_rated_sales: 0.00,
    vat_amount_12pct: vatAmount
  };
}

/**
 * Issues and persists an immutable BIR Monotonic Invoice
 */
async function issueInvoiceRecord({
  branchCode,
  branchId = null,
  customerName = 'Walk-in Athlete',
  customerEmail = null,
  customerTin = null,
  cashierId = null,
  cashierName = 'Front Desk Cashier',
  shiftId = null,
  items = [],
  grossAmount = 0,
  isVatExempt = false,
  paymentMethod = 'CASH',
  paymentReference = null,
  notes = '',
  ipAddress = '127.0.0.1'
}) {
  const normCode = normalizeBranchCode(branchCode || branchId);
  const now = new Date();
  const { invoiceNumber, sequenceNumber, dateKey } = generateSequentialInvoiceNumber(normCode, now);
  const vat = calculateVatBreakdown(grossAmount, isVatExempt);

  const invoiceRecord = {
    id: `bir_${crypto.randomUUID()}`,
    invoice_number: invoiceNumber,
    sequence_number: sequenceNumber,
    invoice_date_key: dateKey,
    branch_code: normCode,
    branch_id: branchId || `b-${normCode.toLowerCase()}-01`,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_tin: customerTin || '000-000-000-000',
    cashier_id: cashierId,
    cashier_name: cashierName,
    shift_id: shiftId,
    items: Array.isArray(items) ? items : [],
    gross_amount: vat.gross_amount,
    net_sales: vat.net_sales,
    vat_taxable_sales: vat.vat_taxable_sales,
    vat_exempt_sales: vat.vat_exempt_sales,
    zero_rated_sales: vat.zero_rated_sales,
    vat_amount_12pct: vat.vat_amount_12pct,
    payment_method: (paymentMethod || 'CASH').toUpperCase(),
    payment_reference: paymentReference,
    status: 'ISSUED',
    voided_at: null,
    void_reason: null,
    voided_by: null,
    notes: notes,
    statutory_notice: 'THIS SERVES AS AN OFFICIAL RECEIPT / BIR ELECTRONIC INVOICE (RR 9-2009)',
    created_at: now
  };

  memoryStore.bir_invoices.unshift(invoiceRecord);

  // Cross-register in payment_invoices for unified lookup
  if (Array.isArray(memoryStore.payment_invoices)) {
    const existingPaymentInv = memoryStore.payment_invoices.find(p => p.invoice_no === invoiceNumber);
    if (!existingPaymentInv) {
      memoryStore.payment_invoices.unshift({
        id: invoiceRecord.id,
        invoice_no: invoiceNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        amount: vat.gross_amount,
        status: 'PAID',
        payment_method: invoiceRecord.payment_method,
        shift_id: shiftId,
        branch_id: invoiceRecord.branch_id,
        created_at: now
      });
    }
  }

  // Cryptographic audit log entry
  await logAuditEvent({
    branch_id: invoiceRecord.branch_id,
    user_id: cashierId,
    user_role: 'cashier',
    action: 'BIR_INVOICE_ISSUED',
    resource: 'bir_invoices',
    ip_address: ipAddress,
    details: {
      invoice_number: invoiceNumber,
      sequence: sequenceNumber,
      gross_amount: vat.gross_amount,
      vat_amount: vat.vat_amount_12pct,
      vat_taxable: vat.vat_taxable_sales,
      payment_method: invoiceRecord.payment_method,
      shift_id: shiftId
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return invoiceRecord;
}

/**
 * Statutory Void Process (RR 9-2009)
 * Forbids row deletion or sequence reuse; updates status to 'VOIDED' with audit trail.
 */
async function voidInvoiceRecord(invoiceNumber, {
  reason,
  voidedBy,
  userRole = 'manager',
  ipAddress = '127.0.0.1'
}) {
  if (!invoiceNumber) {
    throw new Error('Invoice number is required for statutory void action.');
  }

  const invoice = (memoryStore.bir_invoices || []).find(i => i.invoice_number === invoiceNumber);
  if (!invoice) {
    throw new Error(`Invoice record ${invoiceNumber} not found.`);
  }

  if (invoice.status === 'VOIDED') {
    throw new Error(`Invoice ${invoiceNumber} has already been voided at ${invoice.voided_at}.`);
  }

  invoice.status = 'VOIDED';
  invoice.voided_at = new Date();
  invoice.void_reason = reason || 'Statutory Cashier Correction';
  invoice.voided_by = voidedBy || 'Authorized Manager';

  await logAuditEvent({
    branch_id: invoice.branch_id,
    user_id: voidedBy,
    user_role: userRole,
    action: 'BIR_INVOICE_VOIDED',
    resource: 'bir_invoices',
    ip_address: ipAddress,
    details: {
      invoice_number: invoiceNumber,
      sequence: invoice.sequence_number,
      gross_amount: invoice.gross_amount,
      reason: invoice.void_reason,
      voided_by: invoice.voided_by
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return invoice;
}

/**
 * Returns BIR Monotonic Invoicing Ledger Summary
 */
function getBIRInvoicingLedgerSummary(branchCode = 'MKT') {
  const normCode = normalizeBranchCode(branchCode);
  const invoices = (memoryStore.bir_invoices || []).filter(
    i => i.branch_code === normCode || branchCode === 'ALL'
  );

  const issuedInvoices = invoices.filter(i => i.status === 'ISSUED');
  const voidedInvoices = invoices.filter(i => i.status === 'VOIDED');

  const lifetimeGross = issuedInvoices.reduce((acc, curr) => acc + (Number(curr.gross_amount) || 0), 0);
  const lifetimeVatTaxable = issuedInvoices.reduce((acc, curr) => acc + (Number(curr.vat_taxable_sales) || 0), 0);
  const lifetimeVatAmount = issuedInvoices.reduce((acc, curr) => acc + (Number(curr.vat_amount_12pct) || 0), 0);
  const lifetimeVatExempt = issuedInvoices.reduce((acc, curr) => acc + (Number(curr.vat_exempt_sales) || 0), 0);

  // Find last sequential invoice
  const lastInvoice = invoices[0] || null;

  return {
    status: 'ACTIVE',
    branch_code: normCode,
    total_invoices_recorded: invoices.length,
    active_invoices_count: issuedInvoices.length,
    voided_invoices_count: voidedInvoices.length,
    last_sequential_inv: lastInvoice ? lastInvoice.invoice_number : `${normCode}-INV-${formatDateKey()}-000000`,
    lifetime_grand_total: Math.round(lifetimeGross * 100) / 100,
    vat_taxable_sales: Math.round(lifetimeVatTaxable * 100) / 100,
    vat_amount_12pct: Math.round(lifetimeVatAmount * 100) / 100,
    vat_exempt_sales: Math.round(lifetimeVatExempt * 100) / 100,
    statute: 'BIR RMO No. 10-2005 & RR 9-2009 Gapless Monotonic Register'
  };
}

module.exports = {
  normalizeBranchCode,
  formatDateKey,
  generateSequentialInvoiceNumber,
  calculateVatBreakdown,
  issueInvoiceRecord,
  voidInvoiceRecord,
  getBIRInvoicingLedgerSummary
};
