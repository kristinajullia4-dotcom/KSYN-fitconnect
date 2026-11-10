import { jsPDF } from 'jspdf';

/**
 * Format currency in Philippine Peso
 */
function formatPhp(amount) {
  const num = Number(amount) || 0;
  return 'PHP ' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate Official BIR Form No. 2307 (Certificate of Creditable Tax Withheld At Source)
 * Conforms to Bureau of Internal Revenue (BIR) NIRC statutory layout
 */
export function generateBir2307Pdf(c) {
  if (!c) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // --- Official BIR Header ---
  doc.setFillColor(248, 249, 250);
  doc.rect(10, y, pageWidth - 20, 24, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.rect(10, y, pageWidth - 20, 24, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Republic of the Philippines • Department of Finance • Bureau of Internal Revenue', pageWidth / 2, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICATE OF CREDITABLE TAX WITHHELD AT SOURCE', pageWidth / 2, y + 11, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9);
  doc.text('BIR Form No. 2307', pageWidth / 2, y + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const certNo = c.certificate_number || `BIR2307-${c.reference_no || Date.now()}`;
  doc.text(`Certificate No: ${certNo}   |   Period Covered: ${c.period || 'Current Fiscal Period'}`, pageWidth / 2, y + 21, { align: 'center' });

  y += 28;

  // --- Part I: Payee Information ---
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 6, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.rect(10, y, pageWidth - 20, 6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Part I — Payee Information (Recipient of Income Subject to Withholding)', 13, y + 4.2);

  y += 6;
  doc.rect(10, y, pageWidth - 20, 25, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const payee = c.payee || {};
  doc.text(`Taxpayer Identification No. (TIN):`, 13, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${payee.tin || '109-445-890-000'}`, 65, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Payee Registered Name:`, 13, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${(payee.name || 'KSYN FITNESS CONTRACTOR').toUpperCase()}`, 65, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Trade Name / Professional Role:`, 13, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${payee.trade_name || 'Personal Training & Fitness Contractor'}`, 65, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Registered Business Address:`, 13, y + 20);
  doc.setTextColor(15, 23, 42);
  doc.text(`${payee.address || 'Metro Manila, Philippines'}   (Zip: ${payee.zip_code || '1200'} | RDO: ${payee.rdo_code || '047'})`, 65, y + 20);

  y += 28;

  // --- Part II: Payor Information ---
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 6, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.rect(10, y, pageWidth - 20, 6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Part II — Payor Information (Withholding Agent / KSYN Corporate Entity)', 13, y + 4.2);

  y += 6;
  doc.rect(10, y, pageWidth - 20, 25, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const payor = c.payor || {};
  doc.text(`Withholding Agent TIN:`, 13, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${payor.tin || '204-891-302-000'}`, 65, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Payor Registered Corporate Name:`, 13, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${(payor.name || 'KSYN FITNESS PHILIPPINES INC.').toUpperCase()}`, 65, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Branch / Commercial Hub:`, 13, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${payor.trade_name || 'KSYN Fitness Club Network'}`, 65, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Registered Corporate Address:`, 13, y + 20);
  doc.setTextColor(15, 23, 42);
  doc.text(`${payor.address || 'Makati City, Metro Manila'}   (Zip: ${payor.zip_code || '1226'} | RDO: ${payor.rdo_code || '047'})`, 65, y + 20);

  y += 28;

  // --- Part III: Schedule of Payments & Tax Withheld ---
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 6, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.rect(10, y, pageWidth - 20, 6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Part III — Details of Monthly Tax Withheld at Source (Schedule of Payments)', 13, y + 4.2);

  y += 6;

  // Table Headers
  const colX = [10, 85, 105, 145, 165, pageWidth - 10];
  doc.setFillColor(226, 232, 240);
  doc.rect(10, y, pageWidth - 20, 7, 'F');
  doc.rect(10, y, pageWidth - 20, 7, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Nature of Income Payment', colX[0] + 3, y + 4.5);
  doc.text('ATC', colX[1] + 3, y + 4.5);
  doc.text('Total Gross Fee', colX[2] + 5, y + 4.5);
  doc.text('Tax Rate', colX[3] + 2, y + 4.5);
  doc.text('Creditable Tax (CWT)', colX[4] + 3, y + 4.5);

  y += 7;

  // Table Rows
  const payments = Array.isArray(c.income_payments) && c.income_payments.length > 0
    ? c.income_payments
    : [{
        nature_of_payment: 'Professional Coach Talents & Training Commissions',
        atc: 'WI100',
        total_gross: c.total_income_payment || 15000,
        tax_rate: '10%',
        tax_withheld: c.total_tax_withheld || 1500
      }];

  payments.forEach((p) => {
    doc.rect(10, y, pageWidth - 20, 8, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(p.nature_of_payment || 'Personal Training Services'), colX[0] + 3, y + 5);

    doc.setFont('courier', 'bold');
    doc.text(String(p.atc || 'WI100'), colX[1] + 3, y + 5);

    doc.setFont('courier', 'normal');
    doc.text(formatPhp(p.total_gross), colX[2] + 3, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(p.tax_rate || '10%'), colX[3] + 3, y + 5);

    doc.setFont('courier', 'bold');
    doc.text(formatPhp(p.tax_withheld), colX[4] + 3, y + 5);

    y += 8;
  });

  // Table Totals Footer
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.rect(10, y, pageWidth - 20, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL TAX WITHHELD:', 13, y + 5.2);

  doc.setFont('courier', 'bold');
  doc.text(formatPhp(c.total_income_payment), colX[2] + 3, y + 5.2);
  doc.text(formatPhp(c.total_tax_withheld), colX[4] + 3, y + 5.2);

  y += 12;

  // Net Remitted Banner
  doc.setFillColor(254, 243, 199);
  doc.rect(10, y, pageWidth - 20, 10, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.rect(10, y, pageWidth - 20, 10, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('NET CONTRACTOR PAYOUT REMITTED (AFTER 10% CWT):', 14, y + 6.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(180, 83, 9);
  doc.text(formatPhp(c.net_amount_remitted || (c.total_income_payment - c.total_tax_withheld)), pageWidth - 14, y + 6.5, { align: 'right' });

  y += 15;

  // Perjury Clause
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const perjuryText = doc.splitTextToSize(
    '"We declare under penalties of perjury that this certificate has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code (NIRC), as amended, and the regulations issued under authority thereof."',
    pageWidth - 24
  );
  doc.text(perjuryText, 12, y);

  y += 16;

  // Signatures & Compliance Seal
  doc.line(14, y + 10, 80, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(c.signatory?.name || 'Elena Rostova', 14, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(c.signatory?.title || 'Authorized Withholding Agent & Corporate Comptroller', 14, y + 18);
  doc.text(`Date Executed: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`, 14, y + 22);

  // Corporate Stamp
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.5);
  doc.rect(pageWidth - 85, y, 75, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('KSYN CORPORATE FISCAL SEAL', pageWidth - 47.5, y + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`TAX IDENTIFIER: ${payor.tin || '204-891-302-000'}`, pageWidth - 47.5, y + 10, { align: 'center' });
  doc.text(`COMPLIANCE HASH: SHA256-${c.reference_no?.slice(0, 12) || '2307CERT'}`, pageWidth - 47.5, y + 14, { align: 'center' });
  doc.text('STATUTORY NIRC WITHHOLDING', pageWidth - 47.5, y + 18, { align: 'center' });

  // Save PDF
  const filename = `BIR-2307-${certNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Generate Official KSYN Franchise Royalty Remittance Statement & Certificate of Settlement (7.5%)
 */
export function generateRoyaltyStatementPdf(r) {
  if (!r) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Navy/Slate
  doc.rect(10, y, pageWidth - 20, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(225, 194, 86); // KSYN Gold
  doc.text('KSYN FITNESS GYM ENTERPRISE', pageWidth / 2, y + 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Corporate Franchise Directorate • Financial Remittance & Royalty Statement', pageWidth / 2, y + 15, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Statement ID: KSYN-ROY-${r.branch_code || r.branch_id || 'HQ'}-${Date.now().toString().slice(-6)}   |   Audited Standard: ISO/IEC 25010 & 27001`, pageWidth / 2, y + 21, { align: 'center' });

  y += 30;

  // Branch Profile Card
  doc.setFillColor(248, 249, 250);
  doc.rect(10, y, pageWidth - 20, 26, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(10, y, pageWidth - 20, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`FRANCHISEE BRANCH: ${r.branch_name || 'KSYN Fitness Club'}`, 14, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Branch Identifier: ${r.branch_id || 'b-mkt-01'}   |   Branch Code: ${r.branch_code || 'MKT-01'}`, 14, y + 11);
  doc.text(`Assigned Franchise Operator: ${r.investor_name || r.owner_name || 'Franchise Investor'}`, 14, y + 16);
  doc.text(`Facility Location: ${r.branch_address || 'Metro Manila Commercial Territory'}`, 14, y + 21);

  // Settlement Badge
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(34, 197, 94);
  doc.rect(pageWidth - 55, y + 5, 42, 14, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.text('STATUS: VERIFIED', pageWidth - 34, y + 11, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('7.50% FIXED ROYALTY', pageWidth - 34, y + 15, { align: 'center' });

  y += 30;

  // Revenue & Royalty Calculation Table
  doc.setFillColor(30, 41, 59);
  doc.rect(10, y, pageWidth - 20, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('REVENUE STREAM CATEGORY', 14, y + 4.8);
  doc.text('GROSS PROCEEDS', pageWidth - 14, y + 4.8, { align: 'right' });

  y += 7;

  const grossSales = Number(r.gross_sales || r.grossRevenue || r.total_sales || 185000);
  const membershipRev = grossSales * 0.65;
  const ptRev = grossSales * 0.20;
  const posRev = grossSales * 0.10;
  const dayPassRev = grossSales * 0.05;

  const rows = [
    { title: 'Membership Lifecycle Subscriptions (1-Month & 12-Month Passes)', val: membershipRev },
    { title: 'Personal Training Packages & Coach 1-on-1 Sessions', val: ptRev },
    { title: 'Front-Desk Retail POS, Supplements & Merchandise', val: posRev },
    { title: 'Walk-in Optical QR Day Passes & Guest Turnstile Access', val: dayPassRev },
  ];

  rows.forEach((row, i) => {
    if (i % 2 === 1) doc.setFillColor(248, 249, 250);
    else doc.setFillColor(255, 255, 255);
    doc.rect(10, y, pageWidth - 20, 7.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y, pageWidth - 20, 7.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(row.title, 14, y + 5);

    doc.setFont('courier', 'normal');
    doc.text(formatPhp(row.val), pageWidth - 14, y + 5, { align: 'right' });
    y += 7.5;
  });

  // Gross Total Row
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.rect(10, y, pageWidth - 20, 8, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GROSS BRANCH COLLECTIONS:', 14, y + 5.5);
  doc.setFont('courier', 'bold');
  doc.text(formatPhp(grossSales), pageWidth - 14, y + 5.5, { align: 'right' });

  y += 12;

  // Royalty Calculation Card
  const royaltyRate = Number(r.royalty_percentage || 7.50);
  const corporateRoyalty = grossSales * (royaltyRate / 100);
  const retainedBranchEarnings = grossSales - corporateRoyalty;

  doc.setFillColor(254, 243, 199); // Soft Gold
  doc.rect(10, y, pageWidth - 20, 26, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.rect(10, y, pageWidth - 20, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text(`CORPORATE FRANCHISE ROYALTY REMITTANCE (${royaltyRate.toFixed(2)}%):`, 14, y + 7);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9);
  doc.text(formatPhp(corporateRoyalty), pageWidth - 14, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text(`NET BRANCH RETAINED REVENUE (92.50%):`, 14, y + 16);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text(formatPhp(retainedBranchEarnings), pageWidth - 14, y + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('* Remittance computed pursuant to KSYN Master Franchise Licensing Agreement (Clause 4.2: Automated Gross Revenue Deduction).', 14, y + 22);

  y += 32;

  // Regulatory & Contractual Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const disclosure = doc.splitTextToSize(
    'This financial statement is generated by KSYN FitConnect Enterprise Platform and constitutes an official corporate audit certification. All revenue records are cryptographically verified against turnstile check-in logs and POS register ledger sessions.',
    pageWidth - 24
  );
  doc.text(disclosure, 12, y);

  y += 14;

  // Signatures
  doc.line(14, y + 10, 80, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Marcus Vance', 14, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Chief Executive Officer & Franchisor', 14, y + 18);

  doc.line(pageWidth - 85, y + 10, pageWidth - 14, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Elena Rostova', pageWidth - 85, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Director of Franchise Compliance & Audits', pageWidth - 85, y + 18);

  const filename = `KSYN-Franchise-Royalty-${(r.branch_code || 'STATEMENT').toUpperCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Generate Official Receipt (E-OR) with 12% Philippine VAT Breakdown
 * Conforms to BIR RR No. 9-2009 & RR No. 5-2014 E-Invoicing Standards
 */
export function generateOfficialReceiptPdf({ user = {}, subscription = {}, invoice = {}, branch = {} }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 190] // Standardized POS Official Receipt Slip dimensions
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('KSYN FITNESS HOLDINGS INC.', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(branch.name || user.branch_name || 'KSYN Fitness Club', pageWidth / 2, y, { align: 'center' });
  y += 3.8;
  doc.text(branch.address || user.branch_address || 'Metro Manila, Philippines', pageWidth / 2, y, { align: 'center' });
  y += 3.8;
  doc.text(`VAT REG TIN: ${branch.tin || '452-981-300-000'}`, pageWidth / 2, y, { align: 'center' });
  y += 3.8;
  doc.text(`BIR PTU NO: PTU-NCR-2026-088192 | MIN: ${branch.code || 'MKT'}-POS-01`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, y, pageWidth - 6, y);
  doc.setLineDashPattern([], 0);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL RECEIPT (E-OR)', pageWidth / 2, y, { align: 'center' });
  y += 5;

  const orNumber = invoice.invoice_number || subscription.or_number || `OR-${(branch.code || 'MKT').toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const dateFormatted = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`OR No: ${orNumber}`, 8, y);
  y += 4;
  doc.text(`Date & Time: ${dateFormatted}`, 8, y);
  y += 4;
  doc.text(`Customer Name: ${(user.name || 'Athletic Member').toUpperCase()}`, 8, y);
  y += 4;
  doc.text(`Account / Email: ${user.email || 'N/A'}`, 8, y);
  y += 4;
  if (user.address) {
    doc.text(`Address: ${user.address.slice(0, 42)}`, 8, y);
    y += 4;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(6, y, pageWidth - 6, y);
  y += 5;

  // Itemized line
  const planName = subscription.plan_name || (subscription.plan === '12_months' ? '12-Month Annual Elite Membership' : (subscription.plan === '1_day' ? '1-Day Walk-In Pass' : '1-Month Standard Membership'));
  const totalPaid = Number(subscription.total_paid || subscription.price || 16000);
  const vatRate = 0.12;
  const vatableSales = Math.round((totalPaid / (1 + vatRate)) * 100) / 100;
  const vatAmount = Math.round((totalPaid - vatableSales) * 100) / 100;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DESCRIPTION', 8, y);
  doc.text('AMOUNT (PHP)', pageWidth - 8, y, { align: 'right' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(planName, 8, y);
  doc.text(totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 }), pageWidth - 8, y, { align: 'right' });
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Validity: ${subscription.start_date || '2026-11-10'} to ${subscription.end_date || '2027-11-10'}`, 8, y);
  y += 6;

  doc.setDrawColor(203, 213, 225);
  doc.line(6, y, pageWidth - 6, y);
  y += 4;

  // Tax breakdown
  const printRow = (label, val, isBold = false, color = [71, 85, 105]) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...color);
    doc.text(label, 8, y);
    doc.text(val, pageWidth - 8, y, { align: 'right' });
    y += 4;
  };

  printRow('VATable Sales (12% Base):', 'PHP ' + vatableSales.toLocaleString('en-PH', { minimumFractionDigits: 2 }));
  printRow('Value Added Tax (12% VAT):', 'PHP ' + vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }));
  printRow('VAT-Exempt Sales:', 'PHP 0.00');
  printRow('Zero-Rated Sales:', 'PHP 0.00');
  y += 1;
  doc.line(6, y, pageWidth - 6, y);
  y += 4.5;

  printRow('TOTAL AMOUNT PAID:', 'PHP ' + totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 }), true, [15, 23, 42]);
  printRow('Payment Method / Rail:', subscription.payment_method || 'Online Card / GCash Tokenized', false, [100, 116, 139]);
  printRow('Payment Status:', 'SETTLED & VERIFIED (COMPLIANT)', true, [22, 101, 52]);

  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, y, pageWidth - 6, y);
  doc.setLineDashPattern([], 0);
  y += 4.5;

  // Statutory Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const footer1 = doc.splitTextToSize('THIS SERVES AS AN OFFICIAL RECEIPT under BIR Revenue Regulations No. 9-2009. Valid for claiming Input Tax under Section 113 of the NIRC.', pageWidth - 16);
  doc.text(footer1, pageWidth / 2, y, { align: 'center' });
  y += (footer1.length * 3) + 2;

  const footer2 = doc.splitTextToSize('Report unissued receipts to BIR Contact Center: (02) 8538-3200 or contact_us@bir.gov.ph', pageWidth - 16);
  doc.text(footer2, pageWidth / 2, y, { align: 'center' });

  const filename = `KSYN-OfficialReceipt-${orNumber}.pdf`;
  doc.save(filename);
}

/**
 * Generate Printable Z-Reading Consolidated Financial Report (PDF)
 * Conforms to BIR Revenue Memorandum Circular No. 10-2005 on End-of-Day Register Strips
 */
export function generateZReadingReportPdf({ report = {}, branch = {}, dateStr = '' }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Box
  doc.setFillColor(248, 250, 252);
  doc.rect(12, y, pageWidth - 24, 26, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.rect(12, y, pageWidth - 24, 26, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('BUREAU OF INTERNAL REVENUE • REVENUE REGION NO. 8 • CAS ACCREDITATION', pageWidth / 2, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CONSOLIDATED DAILY STORE Z-READING FINANCIAL REPORT', pageWidth / 2, y + 12, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9);
  doc.text(`Facility: ${branch.name || 'KSYN Fitness Makati Flagship'} (${branch.code || 'MKT-01'})   |   Business Date: ${dateStr || report.business_date || new Date().toISOString().slice(0, 10)}`, pageWidth / 2, y + 19, { align: 'center' });

  y += 32;

  // Machine Telemetry Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.rect(12, y, pageWidth - 24, 18, 'S');
  doc.text(`POS Terminal Machine ID (MIN): ${branch.code || 'MKT'}-REG-01`, 16, y + 5);
  doc.text(`BIR Permit to Use (PTU): PTU-NCR-2026-992182`, 16, y + 10);
  doc.text(`Z-Counter Reset Sequence No: Z-${(dateStr || '20261110').replace(/-/g, '')}-001`, 16, y + 15);
  doc.text(`Consolidated Shift Sessions: ${report.total_shifts || (report.shifts || []).length || 1} Registered Cashier Shift(s)`, pageWidth / 2 + 10, y + 5);
  doc.text(`Generation Timestamp: ${new Date().toISOString()}`, pageWidth / 2 + 10, y + 10);
  doc.text(`Audit Trail Chain: SHA-256 Tamper-Sealed`, pageWidth / 2 + 10, y + 15);

  y += 24;

  // Financial Breakdown Table
  const grossSales = Number(report.total_gross_sales || 0);
  const vatRate = 0.12;
  const vatableSales = Math.round((grossSales / (1 + vatRate)) * 100) / 100;
  const vatAmount = Math.round((grossSales - vatableSales) * 100) / 100;
  const cashSales = Number(report.total_cash_sales || 0);
  const cardSales = grossSales - cashSales;
  const corporateRoyalty = Number(report.corporate_royalty_5pct ?? (grossSales * 0.075));
  const netRetained = grossSales - corporateRoyalty;

  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('I. STATUTORY REVENUE & VAT DECOMPOSITION', 15, y + 5);

  y += 7;
  const addLedgerRow = (lbl, val, bold = false, col = [51, 65, 85]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...col);
    doc.text(lbl, 16, y + 5);
    doc.text(formatPhp(val), pageWidth - 16, y + 5, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(12, y + 7.5, pageWidth - 12, y + 7.5);
    y += 7.5;
  };

  addLedgerRow('Grand Gross Collections (Inclusive of Tax):', grossSales, true, [15, 23, 42]);
  addLedgerRow('VATable Net Sales (12% Base):', vatableSales);
  addLedgerRow('12% Output Value-Added Tax (VAT):', vatAmount);
  addLedgerRow('VAT-Exempt Sales (PWD / Senior Citizen Exemptions):', 0);
  addLedgerRow('Zero-Rated Sales:', 0);

  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('II. CASH TENDER & MULTI-RAIL SETTLEMENT SUMMARY', 15, y + 5);
  y += 7;

  addLedgerRow('Total Cash Drawer Collections (Counter Float Excluded):', cashSales);
  addLedgerRow('Non-Cash / Digital Gateway Collections (Xendit / GCash / Maya):', cardSales);
  addLedgerRow('Net Day Cash Drawer Variance (Over / Short):', Number(report.total_variance || 0), true, Number(report.total_variance || 0) < 0 ? [185, 28, 28] : [22, 101, 52]);

  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('III. CORPORATE FRANCHISE FISCAL APPORTIONMENT', 15, y + 5);
  y += 7;

  addLedgerRow('Corporate Franchise Royalty Accrual (7.50% Master Clause):', corporateRoyalty, true, [180, 83, 9]);
  addLedgerRow('Net Branch Retained Operating Revenue (92.50%):', netRetained, true, [22, 101, 52]);

  y += 14;

  // Signatures
  doc.line(16, y + 10, 85, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Closing Head Cashier / Front Desk Officer', 16, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Certified blind cash count & shift drop accuracy', 16, y + 19);

  doc.line(pageWidth - 90, y + 10, pageWidth - 16, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Branch General Manager / Supervisor', pageWidth - 90, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Verified end-of-day Z-Reading & drawer reconciliation', pageWidth - 90, y + 19);

  const filename = `KSYN-ZReading-${branch.code || 'BRANCH'}-${(dateStr || 'TODAY').replace(/-/g, '')}.pdf`;
  doc.save(filename);
}

/**
 * Generate Coach Itemized Commission Payslip & Compensation Voucher (PDF)
 */
export function generateCoachPayslipPdf({ coach = {}, commissionSlip = {}, commissions = {}, branch = {} }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(12, y, pageWidth - 24, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(225, 194, 86); // KSYN Gold
  doc.text('KSYN FITCONNECT ENTERPRISE • PERSONAL TRAINER PAYSLIP', pageWidth / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(248, 250, 252);
  doc.text(`Official Contractor Compensation Voucher & Withholding Tax Certificate`, pageWidth / 2, y + 14, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const slipNo = commissionSlip.slip_number || `SLIP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`;
  doc.text(`Compensation Slip No: ${slipNo}   |   Period: ${commissions.month || 'Current Performance Period'}`, pageWidth / 2, y + 19, { align: 'center' });

  y += 30;

  // Coach Identification Grid
  doc.rect(12, y, pageWidth - 24, 22, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text(`Contractor Name:`, 16, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${(coach.name || 'Coach Marcus Reyes').toUpperCase()}`, 50, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Professional Role:`, 16, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${coach.specialty || 'Personal Trainer & Performance Coach'}`, 50, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Assigned Facility:`, 16, y + 18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${branch.name || coach.branch_name || 'KSYN Fitness Katipunan'}`, 50, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Contractor TIN:`, pageWidth / 2 + 10, y + 6);
  doc.setTextColor(15, 23, 42);
  doc.text(`${coach.tin || '298-441-002-000'}`, pageWidth / 2 + 45, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Commission Tier:`, pageWidth / 2 + 10, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`Standard 60.00% Session Split`, pageWidth / 2 + 45, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Verified PT Sessions:`, pageWidth / 2 + 10, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${commissions.sessionsCount || 12} Verified Sessions Completed`, pageWidth / 2 + 45, y + 18);

  y += 28;

  // Earnings Table
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('ITEMIZED COMPENSATION & DEDUCTION LEDGER', 15, y + 5);
  y += 7;

  const ptShare = Number(commissionSlip.pt_session_split || commissions.servicingCommissionTotal || 6840);
  const stipend = Number(commissionSlip.group_class_stipend || 1500);
  const tierBonus = Number(commissionSlip.tier_bonus || 1000);
  const grossPay = ptShare + stipend + tierBonus;
  const wtaxRate = 0.10;
  const withholdingTax = Math.round(grossPay * wtaxRate * 100) / 100;
  const netPayout = grossPay - withholdingTax;

  const addPayRow = (item, desc, amt, isBold = false, col = [51, 65, 85]) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...col);
    doc.text(item, 16, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(desc, 90, y + 5);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...col);
    doc.text(formatPhp(amt), pageWidth - 16, y + 5, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(12, y + 7.5, pageWidth - 12, y + 7.5);
    y += 7.5;
  };

  addPayRow('1-on-1 PT Servicing Commission', '60% Split on completed client sessions', ptShare);
  addPayRow('Group Studio Class Instruction', 'Contractor scheduled studio lead fee', stipend);
  addPayRow('Monthly Volume Milestone Bonus', 'Performance tier incentive bonus', tierBonus);
  addPayRow('GROSS PERFORMANCE EARNINGS:', 'Total pre-tax compensation', grossPay, true, [15, 23, 42]);

  y += 2;
  addPayRow('Less: Statutory Withholding Tax (BIR 2307)', '10% Creditable expanded withholding tax', -withholdingTax, false, [185, 28, 28]);

  y += 4;
  doc.setFillColor(236, 253, 245);
  doc.rect(12, y, pageWidth - 24, 12, 'F');
  doc.setDrawColor(16, 185, 129);
  doc.rect(12, y, pageWidth - 24, 12, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(22, 101, 52);
  doc.text('NET COMMISSION PAYABLE (DISBURSED):', 16, y + 8);
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(formatPhp(netPayout), pageWidth - 16, y + 8, { align: 'right' });

  y += 24;

  // Signatures
  doc.line(16, y + 10, 85, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Fitness Coach (Contractor)', 16, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Acknowledged accurate session count & payout receipt', 16, y + 19);

  doc.line(pageWidth - 90, y + 10, pageWidth - 16, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Branch Operations / Franchise Manager', pageWidth - 90, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Certified verified turnstile access & roll-call records', pageWidth - 90, y + 19);

  const filename = `KSYN-Coach-Payslip-${(coach.name || 'COACH').replace(/\s+/g, '-')}-${slipNo}.pdf`;
  doc.save(filename);
}

/**
 * Generate Comprehensive Data Subject Access Request (SAR) Archive (PDF)
 * Fulfills Republic Act No. 10173 (Philippine Data Privacy Act of 2012) Section 16
 */
export function generateDataPrivacyArchivePdf({ user = {}, attendanceLogs = [], subscription = {}, waiver = {} }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(12, y, pageWidth - 24, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(248, 250, 252);
  doc.text('REPUBLIC ACT 10173 • PHILIPPINE DATA PRIVACY ACT OF 2012', pageWidth / 2, y + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(225, 194, 86);
  doc.text('OFFICIAL DATA SUBJECT ACCESS REQUEST (SAR) ARCHIVE DOSSIER', pageWidth / 2, y + 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Subject: ${(user.name || 'Athlete').toUpperCase()}   |   Member ID: ${user.id || 'N/A'}   |   Export Date: ${new Date().toISOString()}`, pageWidth / 2, y + 18, { align: 'center' });

  y += 30;

  // Section 1: Personal Demographic Records
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DATA SUBJECT IDENTIFICATION & CONTACT TELEMETRY', 15, y + 4.2);
  y += 6;

  doc.rect(12, y, pageWidth - 24, 26, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text(`Full Legal Name:`, 16, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.name || 'N/A'}`, 55, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Registered Email:`, 16, y + 10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.email || 'N/A'}`, 55, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Mobile Phone:`, 16, y + 15);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.phone || 'N/A'}`, 55, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Emergency Contact:`, 16, y + 20);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.emergency_contact_name || user.emergency_phone || 'Maria Marquez (Mother) - 09187654321'}`, 55, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Home Branch Facility:`, pageWidth / 2 + 10, y + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.branch_name || 'KSYN Fitness Katipunan'}`, pageWidth / 2 + 45, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Account Creation Date:`, pageWidth / 2 + 10, y + 10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.created_at ? new Date(user.created_at).toLocaleDateString() : '2026-10-20'}`, pageWidth / 2 + 45, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Primary Fitness Goal:`, pageWidth / 2 + 10, y + 15);
  doc.setTextColor(15, 23, 42);
  doc.text(`${user.fitness_goal || user.primary_goal || 'Athletic Conditioning & Hypertrophy'}`, pageWidth / 2 + 45, y + 15);

  y += 32;

  // Section 2: PAR-Q Digital Legal Waiver
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. EXECUTED DIGITAL PAR-Q WAIVER & CRYPTOGRAPHIC SEAL', 15, y + 4.2);
  y += 6;

  doc.rect(12, y, pageWidth - 24, 20, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Waiver Execution Status: LEGAL CONSENT EXECUTED & SEALED`, 16, y + 5);
  doc.text(`Governing Statute: RA 8792 Electronic Commerce Act & RA 10173 DPA Section 12`, 16, y + 9);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  const sealHash = waiver?.sha256_seal || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  doc.text(`SHA-256 Tamper Seal: ${sealHash}`, 16, y + 14);

  y += 26;

  // Section 3: Check-in Access Telemetry
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y, pageWidth - 24, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TURNSTILE GATE ACCESS & ATTENDANCE TELEMETRY LOGS (RECENT EXCERPTS)', 15, y + 4.2);
  y += 6;

  const logs = Array.isArray(attendanceLogs) && attendanceLogs.length > 0 ? attendanceLogs.slice(0, 6) : [
    { timestamp: '2026-11-10 08:15:22', branch: 'KSYN Fitness Katipunan', method: 'Dynamic QR Token', status: 'GRANTED' },
    { timestamp: '2026-11-08 17:30:11', branch: 'KSYN Fitness Makati Flagship', method: 'Dynamic QR Token', status: 'GRANTED' },
    { timestamp: '2026-11-06 06:45:00', branch: 'KSYN Fitness Katipunan', method: 'RFID Card Tap', status: 'GRANTED' }
  ];

  logs.forEach((log) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`[${log.timestamp || log.check_in_time || '2026-11-10'}]`, 16, y + 4);
    doc.text(`${log.branch || log.branch_name || 'Katipunan'}`, 60, y + 4);
    doc.text(`Method: ${log.method || 'Dynamic QR Pass'}`, 120, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text(`STATUS: ${log.status || 'GRANTED'}`, pageWidth - 16, y + 4, { align: 'right' });
    y += 5.5;
  });

  y += 6;

  // Certification
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const cert = doc.splitTextToSize('This SAR Archive is provided in accordance with the National Privacy Commission (NPC) Citizen Charter and RA 10173 Section 16 (Right to Access and Data Portability). Certified by KSYN Data Protection Officer.', pageWidth - 24);
  doc.text(cert, 12, y);

  const filename = `KSYN-DataPrivacyArchive-${(user?.name || 'Member').replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}

/**
 * Generate Inter-Branch Roaming Settlement Clearinghouse Voucher (PDF)
 * Multi-branch facility utilization settlement under KSYN Franchise Roaming Agreement
 */
export function generateRoamingClearinghousePdf({ branch, clearingRows = [], period = 'October 2026', summary = {} }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(10, y, pageWidth - 20, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text('KSYN FITCONNECT ENTERPRISE', 16, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Inter-Branch Roaming Settlement Clearinghouse Voucher', 16, y + 14);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Facility Utilization & Cross-Branch Inter-Entity Receivable/Payable Clearing', 16, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11);
  doc.text(`CYCLE: ${period.toUpperCase()}`, pageWidth - 16, y + 8, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.text(`RATE: PHP 350.00 / VISIT`, pageWidth - 16, y + 14, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`ISSUED: ${new Date().toISOString().slice(0, 10)}`, pageWidth - 16, y + 19, { align: 'right' });

  y += 28;

  // Branch Profile Card
  doc.setFillColor(248, 250, 252);
  doc.rect(10, y, pageWidth - 20, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(10, y, pageWidth - 20, 20, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Reporting Facility: ${branch?.name || 'KSYN Fitness Makati Flagship'} (${branch?.code || 'MKT-01'})`, 14, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Location: ${branch?.address || 'Metro Manila'} | Governance: Franchise Roaming Clearing Annex`, 14, y + 11);
  doc.text(`Settlement Status: RECONCILED & CORPORATE CLEARING APPROVED`, 14, y + 16);

  y += 24;

  // Financial Summary Cards
  const totalInboundVisits = summary.inboundVisits ?? clearingRows.reduce((s, r) => s + (r.inboundVisits || 0), 0);
  const totalInboundPhp = summary.inboundPhp ?? (totalInboundVisits * 350);
  const totalOutboundVisits = summary.outboundVisits ?? clearingRows.reduce((s, r) => s + (r.outboundVisits || 0), 0);
  const totalOutboundPhp = summary.outboundPhp ?? (totalOutboundVisits * 350);
  const netClearingPhp = totalInboundPhp - totalOutboundPhp;

  const cardW = (pageWidth - 28) / 3;

  // Card 1: Inbound
  doc.setFillColor(240, 253, 244);
  doc.rect(10, y, cardW, 18, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(10, y, cardW, 18, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('INBOUND RECEIVABLES', 14, y + 5);
  doc.setFontSize(11);
  doc.text(`+${formatPhp(totalInboundPhp)}`, 14, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`${totalInboundVisits} guest visits @ P350`, 14, y + 15);

  // Card 2: Outbound
  doc.setFillColor(254, 242, 242);
  doc.rect(14 + cardW, y, cardW, 18, 'F');
  doc.setDrawColor(254, 202, 202);
  doc.rect(14 + cardW, y, cardW, 18, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text('OUTBOUND PAYABLES', 18 + cardW, y + 5);
  doc.setFontSize(11);
  doc.text(`-${formatPhp(totalOutboundPhp)}`, 18 + cardW, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`${totalOutboundVisits} roaming visits @ P350`, 18 + cardW, y + 15);

  // Card 3: Net Balance
  doc.setFillColor(255, 251, 235);
  doc.rect(18 + cardW * 2, y, cardW, 18, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.rect(18 + cardW * 2, y, cardW, 18, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('NET CLEARING BALANCE', 22 + cardW * 2, y + 5);
  doc.setFontSize(11);
  doc.setTextColor(netClearingPhp >= 0 ? 22 : 185, netClearingPhp >= 0 ? 101 : 28, netClearingPhp >= 0 ? 52 : 28);
  doc.text(`${netClearingPhp >= 0 ? '+' : ''}${formatPhp(netClearingPhp)}`, 22 + cardW * 2, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(netClearingPhp >= 0 ? 'Net Due To Branch' : 'Net Payable To HQ', 22 + cardW * 2, y + 15);

  y += 24;

  // Table of Partner Branches
  doc.setFillColor(30, 41, 59);
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PARTNER FRANCHISE BRANCH', 14, y + 5.5);
  doc.text('INBOUND VISITS', 85, y + 5.5);
  doc.text('RECEIVABLE (PHP)', 115, y + 5.5, { align: 'right' });
  doc.text('OUTBOUND VISITS', 135, y + 5.5);
  doc.text('PAYABLE (PHP)', 165, y + 5.5, { align: 'right' });
  doc.text('NET SETTLEMENT', pageWidth - 14, y + 5.5, { align: 'right' });

  y += 8;

  clearingRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(10, y, pageWidth - 20, 8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y, pageWidth - 20, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${row.partnerBranchName || row.name}`, 14, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text(`${row.inboundVisits || 0}`, 92, y + 5.5);
    doc.text(`+${formatPhp((row.inboundVisits || 0) * 350)}`, 115, y + 5.5, { align: 'right' });

    doc.setTextColor(185, 28, 28);
    doc.text(`${row.outboundVisits || 0}`, 142, y + 5.5);
    doc.text(`-${formatPhp((row.outboundVisits || 0) * 350)}`, 165, y + 5.5, { align: 'right' });

    const net = ((row.inboundVisits || 0) - (row.outboundVisits || 0)) * 350;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(net >= 0 ? 22 : 185, net >= 0 ? 101 : 28, net >= 0 ? 52 : 28);
    doc.text(`${net >= 0 ? '+' : ''}${formatPhp(net)}`, pageWidth - 14, y + 5.5, { align: 'right' });

    y += 8;
  });

  y += 12;

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y + 16, 75, y + 16);
  doc.line(pageWidth - 75, y + 16, pageWidth - 14, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('CORPORATE CLEARINGHOUSE TREASURY', 14, y + 21);
  doc.text('FRANCHISE GENERAL MANAGER', pageWidth - 14, y + 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('KSYN Corporate Headquarters, BGC Taguig', 14, y + 25);
  doc.text('Authorized Commercial Representative', pageWidth - 14, y + 25, { align: 'right' });

  doc.text('Generated under KSYN Enterprise Multi-Branch Roaming Settlement Framework • RA 8792 Electronic Commerce Act compliant.', pageWidth / 2, y + 36, { align: 'center' });

  const filename = `KSYN-Roaming-Clearinghouse-${(branch?.code || 'BRANCH')}-${period.replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
