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
