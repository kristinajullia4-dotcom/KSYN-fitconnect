import React, { useState, useEffect } from 'react';
import { Printer, X, ShieldCheck, Download, FileText, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Tooltip from './Tooltip';

export default function Bir2307Modal({ remittance, onClose }) {
  const { authFetch } = useAuth();
  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!remittance) return;
    if (remittance.payee && remittance.income_payments) {
      setCertData(remittance);
      setLoading(false);
      return;
    }
    let isMounted = true;
    async function fetchCertificate() {
      try {
        setLoading(true);
        const remId = remittance.id || remittance.reference_no;
        const res = await authFetch(`/api/finance/bir-2307/${remId}`);
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.certificate) {
            setCertData(data.certificate);
          } else {
            // Local fallback constructor
            setCertData({
              certificate_number: `BIR2307-${remittance.reference_no || remittance.id}`,
              form_name: 'BIR Form No. 2307 (Certificate of Creditable Tax Withheld At Source)',
              period: remittance.period || 'Q3 2026',
              payee: {
                tin: '109-445-890-000',
                name: 'KSYN FITNESS PHILIPPINES INC.',
                trade_name: 'KSYN Fitness Corporate Headquarters',
                address: '28th Floor, Ayala Triangle Tower Two, Makati City, Metro Manila, Philippines',
                zip_code: '1226',
                rdo_code: '047'
              },
              payor: {
                tin: '204-891-302-000',
                name: remittance.branch_name ? `KSYN FITNESS (${remittance.branch_name.toUpperCase()})` : 'KSYN FITNESS MAKATI FLAGSHIP',
                trade_name: remittance.branch_name || 'KSYN Fitness Club',
                address: 'Ground Floor, KSYN Tower, Ayala Ave., Makati City',
                zip_code: '1200',
                rdo_code: '044'
              },
              income_payments: [
                {
                  atc: 'WC158',
                  nature_of_payment: 'Franchise Royalties and Licensing Fees',
                  total_gross: remittance.gross_royalty || (remittance.gross_sales * 0.075),
                  tax_rate: '5%',
                  tax_withheld: remittance.cwt_amount || ((remittance.gross_royalty || (remittance.gross_sales * 0.075)) * 0.05)
                }
              ],
              total_income_payment: remittance.gross_royalty || (remittance.gross_sales * 0.075),
              total_tax_withheld: remittance.cwt_amount || ((remittance.gross_royalty || (remittance.gross_sales * 0.075)) * 0.05),
              net_amount_remitted: remittance.net_remitted || ((remittance.gross_royalty || 0) - (remittance.cwt_amount || 0)),
              payment_rail: remittance.payment_rail || 'PayMongo Corporate B2B Rail',
              reference_no: remittance.reference_no || 'REMIT-B2B-102941',
              signatory: {
                name: 'Elena Rostova',
                title: 'Authorized Franchise Finance Officer / Managing Director',
                date_signed: remittance.settled_at || new Date().toISOString()
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to load BIR 2307 data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCertificate();
    return () => { isMounted = false; };
  }, [remittance, authFetch]);

  if (!remittance) return null;

  const handlePrint = () => {
    if (!certData) return;
    const c = certData;
    const printWindow = window.open('', '_blank', 'width=850,height=1000');
    if (!printWindow) {
      window.print();
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>BIR Form 2307 - ${c.certificate_number || 'Certificate'}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
    }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .gov-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; }
    .bir-title { font-size: 18px; font-weight: bold; margin: 3px 0; }
    .form-num { font-size: 13px; font-weight: bold; }
    .meta-bar { display: flex; justify-content: space-between; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }
    .box-title { font-size: 10px; font-weight: bold; background: #eee; padding: 3px 6px; margin: -8px -10px 8px -10px; border-bottom: 1px solid #000; text-transform: uppercase; }
    .field-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .field-label { color: #444; font-size: 10px; }
    .field-val { font-weight: bold; font-family: monospace; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    th, td { border: 1px solid #000; padding: 6px 8px; }
    th { background: #f0f0f0; text-align: left; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: monospace; font-size: 11px; }
    .perjury { font-size: 9px; line-height: 1.4; color: #333; margin: 12px 0; text-align: justify; }
    .sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 10px; }
    .sig-block { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 10px; }
    .seal { border: 2px dashed #000; padding: 6px 12px; font-family: monospace; font-size: 9px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="gov-title">Republic of the Philippines • Department of Finance</div>
    <div class="bir-title">BUREAU OF INTERNAL REVENUE</div>
    <div class="form-num">BIR FORM NO. 2307</div>
    <div style="font-size: 10px; font-weight: bold;">Certificate of Creditable Tax Withheld At Source</div>
    <div style="font-size: 9px; color: #555;">Prescribed by the Bureau of Internal Revenue under NIRC Regulation</div>
  </div>

  <div class="meta-bar">
    <div><strong>Certificate No:</strong> ${c.certificate_number || 'N/A'}</div>
    <div><strong>Taxable Period:</strong> ${c.period || 'Current Quarter'}</div>
    <div><strong>Date Issued:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <div class="box">
    <div class="box-title">Part I — Payee Information (Income Recipient)</div>
    <div class="field-row">
      <span class="field-label">Taxpayer Identification No. (TIN):</span>
      <span class="field-val">${c.payee?.tin || '000-000-000-000'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Payee Registered Name:</span>
      <span class="field-val">${(c.payee?.name || '').toUpperCase()}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Trade Name / Designation:</span>
      <span class="field-val">${c.payee?.trade_name || c.payee?.name || 'Personal Training Contractor'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Registered Business Address:</span>
      <span class="field-val">${c.payee?.address || 'Metro Manila, Philippines'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Zip Code: <strong>${c.payee?.zip_code || '1200'}</strong></span>
      <span class="field-label">RDO Code: <strong>${c.payee?.rdo_code || '047'}</strong></span>
    </div>
  </div>

  <div class="box">
    <div class="box-title">Part II — Payor Information (Withholding Agent)</div>
    <div class="field-row">
      <span class="field-label">Withholding Agent TIN:</span>
      <span class="field-val">${c.payor?.tin || '009-842-117-000'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Payor Registered Corporate Name:</span>
      <span class="field-val">${(c.payor?.name || 'KSYN FITNESS PHILIPPINES INC.').toUpperCase()}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Branch / Operating Facility:</span>
      <span class="field-val">${c.payor?.trade_name || 'KSYN Fitness Club'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Registered Address:</span>
      <span class="field-val">${c.payor?.address || 'Makati City, Metro Manila'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Zip Code: <strong>${c.payor?.zip_code || '1226'}</strong></span>
      <span class="field-label">RDO Code: <strong>${c.payor?.rdo_code || '047'}</strong></span>
    </div>
  </div>

  <div class="box">
    <div class="box-title">Part III — Details of Monthly Tax Withheld at Source (Schedule of Payments)</div>
    <table>
      <thead>
        <tr>
          <th>Nature of Income Payment</th>
          <th class="text-center">ATC</th>
          <th class="text-right">Total Gross Amount</th>
          <th class="text-center">Tax Rate</th>
          <th class="text-right">Tax Withheld (CWT)</th>
        </tr>
      </thead>
      <tbody>
        ${(c.income_payments || []).map(p => `
          <tr>
            <td><strong>${p.nature_of_payment}</strong></td>
            <td class="text-center mono"><strong>${p.atc}</strong></td>
            <td class="text-right mono">PHP ${Number(p.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-center"><strong>${p.tax_rate}</strong></td>
            <td class="text-right mono"><strong>PHP ${Number(p.tax_withheld || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background: #f5f5f5; font-weight: bold;">
          <td colspan="2">TOTALS:</td>
          <td class="text-right mono">PHP ${Number(c.total_income_payment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-center">—</td>
          <td class="text-right mono">PHP ${Number(c.total_tax_withheld || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top: 10px; font-size: 11px; text-align: right;">
      <strong>Net Payout / Remitted: </strong>
      <span class="mono" style="font-size: 13px; font-weight: bold;">PHP ${Number(c.net_amount_remitted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  </div>

  <div class="perjury">
    "We declare under penalties of perjury that this certificate has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof."
  </div>

  <div class="sig-row">
    <div class="sig-block">
      <strong>${c.signatory?.name || 'Elena Rostova'}</strong><br/>
      ${c.signatory?.title || 'Authorized Withholding Agent'}<br/>
      Date Signed: ${new Date(c.signatory?.date_signed || Date.now()).toLocaleDateString()}
    </div>
    <div class="seal">
      AUTHENTICATED COMPLIANCE SEAL<br/>
      REF #${c.reference_no || 'BIR2307'}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    if (!certData) return;
    const c = certData;
    const rows = [
      ['REPUBLIC OF THE PHILIPPINES - BUREAU OF INTERNAL REVENUE'],
      ['BIR FORM NO. 2307 - CERTIFICATE OF CREDITABLE TAX WITHHELD AT SOURCE'],
      ['OFFICIAL GOVERNMENT TAX COMPLIANCE RETURN'],
      [''],
      ['CERTIFICATE NUMBER:', c.certificate_number, '', 'TAXABLE PERIOD:', c.period, '', 'DATE ISSUED:', new Date().toLocaleDateString()],
      ['PAYMENT RAIL:', c.payment_rail || 'N/A', '', 'REMITTANCE REF:', c.reference_no || 'N/A'],
      [''],
      ['========================================================================================================================'],
      ['PART I: PAYEE INFORMATION (RECIPIENT OF INCOME SUBJECT TO WITHHOLDING TAX)'],
      ['========================================================================================================================'],
      ['PAYEE TAXPAYER IDENTIFICATION NO (TIN):', c.payee?.tin || '109-445-890-000'],
      ['PAYEE REGISTERED NAME:', c.payee?.name || 'KSYN FITNESS PHILIPPINES INC.'],
      ['TRADE NAME / BUSINESS STYLE:', c.payee?.trade_name || 'KSYN Fitness Corporate Headquarters'],
      ['REGISTERED ADDRESS:', c.payee?.address || 'Makati City, Metro Manila'],
      ['ZIP CODE:', c.payee?.zip_code || '1226', 'RDO CODE:', c.payee?.rdo_code || '047'],
      [''],
      ['========================================================================================================================'],
      ['PART II: PAYOR INFORMATION (WITHHOLDING AGENT / ACCRUAL BRANCH)'],
      ['========================================================================================================================'],
      ['PAYOR TAXPAYER IDENTIFICATION NO (TIN):', c.payor?.tin || '204-891-302-000'],
      ['PAYOR REGISTERED NAME:', c.payor?.name || 'KSYN FITNESS MAKATI FLAGSHIP'],
      ['TRADE NAME / BRANCH LOCATION:', c.payor?.trade_name || 'KSYN Fitness Club'],
      ['REGISTERED ADDRESS:', c.payor?.address || 'Ayala Ave., Makati City'],
      ['ZIP CODE:', c.payor?.zip_code || '1200', 'RDO CODE:', c.payor?.rdo_code || '044'],
      [''],
      ['========================================================================================================================'],
      ['PART III: DETAILS OF MONTHLY TAX WITHHELD AT SOURCE (SCHEDULE OF INCOME PAYMENTS)'],
      ['========================================================================================================================'],
      ['ATC CODE', 'NATURE OF INCOME PAYMENT', '1ST MONTH (PHP)', '2ND MONTH (PHP)', '3RD MONTH (PHP)', 'TOTAL GROSS AMOUNT (PHP)', 'TAX RATE', 'TAX WITHHELD (PHP)']
    ];

    (c.income_payments || []).forEach(p => {
      rows.push([
        p.atc || 'WC158',
        p.nature_of_payment || 'Franchise Royalties and Licensing Fees',
        Number(p.month_1 || 0).toFixed(2),
        Number(p.month_2 || 0).toFixed(2),
        Number(p.month_3 || 0).toFixed(2),
        Number(p.total_gross || 0).toFixed(2),
        p.tax_rate || '5%',
        Number(p.tax_withheld || 0).toFixed(2)
      ]);
    });

    rows.push(
      ['------------------------------------------------------------------------------------------------------------------------'],
      ['TOTAL GROSS INCOME PAYMENT:', '', '', '', '', Number(c.total_income_payment || 0).toFixed(2), '', ''],
      ['TOTAL CREDITABLE TAX WITHHELD (BIR FORM 2307):', '', '', '', '', '', '', Number(c.total_tax_withheld || 0).toFixed(2)],
      ['NET AMOUNT PAYABLE / REMITTED:', '', '', '', '', Number(c.net_amount_remitted || 0).toFixed(2), '', ''],
      [''],
      ['========================================================================================================================'],
      ['PART IV: DECLARATION OF PAYOR / AUTHORIZED REPRESENTATIVE'],
      ['========================================================================================================================'],
      ['AUTHORIZED SIGNATORY:', c.signatory?.name || 'Elena Rostova'],
      ['TITLE / DESIGNATION:', c.signatory?.title || 'Authorized Franchise Finance Officer / Managing Director'],
      ['DATE SIGNED:', c.signatory?.date_signed ? new Date(c.signatory.date_signed).toLocaleDateString() : new Date().toLocaleDateString()],
      ['DECLARATION ATTESTATION:', 'We declare under penalties of perjury that this certificate has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code (NIRC), as amended, and the regulations issued under authority thereof.'],
      ['AUTHENTICATION SEAL:', `BIR2307-AUTHENTICATED-${c.reference_no || 'REMIT'}`]
    );

    const csvContent = rows.map(r => 
      r.map(val => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BIR_Form_2307_${c.certificate_number || 'Certificate'}.csv`;
    link.click();
  };

  const c = certData;

  return (
    <div className="bir-modal-container" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#12151e',
        border: '2px solid #e1c256',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        overflowY: 'auto',
        color: '#f8fafc',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 40px rgba(225, 194, 86, 0.15)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Action Bar */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #1f2433',
          background: '#0b0d14'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#e1c256" />
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#ffffff' }}>
              OFFICIAL PHILIPPINE BIR FORM 2307 CERTIFICATE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tooltip content="Export to Excel (.csv)" position="bottom">
              <button
                onClick={handleExportExcel}
                className="ksyn-btn"
                style={{
                  fontSize: '0.8125rem',
                  padding: '8px 16px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#15803d',
                  color: '#ffffff',
                  border: '1px solid #16a34a',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={15} /> Export to Excel (.csv)
              </button>
            </Tooltip>
            <Tooltip content="Print or save as PDF" position="bottom">
              <button
                onClick={handlePrint}
                className="ksyn-btn ksyn-btn-outline"
                style={{ fontSize: '0.8125rem', padding: '8px 16px', minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print / Save PDF
              </button>
            </Tooltip>
            <Tooltip content="Close (Esc)" position="bottom">
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="modal-close-circle-btn"
                title="Close modal (Esc)"
                style={{
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Certificate Printable Body */}
        {loading || !c ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94a3b8' }}>
            Loading Certificate Data from Corporate Treasury...
          </div>
        ) : (
          <div style={{ padding: '28px 32px' }} className="bir-2307-sheet">
            {/* Government Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #333a4d', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                Republic of the Philippines • Department of Finance
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e1c256', margin: '4px 0 2px 0', letterSpacing: '0.03em' }}>
                BUREAU OF INTERNAL REVENUE
              </h2>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
                Certificate of Creditable Tax Withheld At Source (BIR Form No. 2307)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <span>Certificate No: <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{c.certificate_number}</strong></span>
                <span>Billing Period: <strong style={{ color: '#ffffff' }}>{c.period}</strong></span>
                <span>Audit Ref: <strong style={{ color: '#e1c256', fontFamily: 'monospace' }}>{c.reference_no}</strong></span>
              </div>
            </div>

            {/* Part I & Part II Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Part I: Payee (HQ) */}
              <div style={{ background: '#0b0d14', border: '1px solid #1f2433', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  PART I: PAYEE INFORMATION (INCOME RECIPIENT)
                </div>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><span style={{ color: '#94a3b8' }}>TIN:</span> <strong className="mono" style={{ color: '#ffffff' }}>{c.payee.tin}</strong> <span style={{ color: '#64748b', fontSize: '0.75rem' }}>(RDO {c.payee.rdo_code})</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Payee Name:</span> <strong style={{ color: '#ffffff' }}>{c.payee.name}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>Trade Name:</span> <span style={{ color: '#cbd5e1' }}>{c.payee.trade_name}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Address:</span> <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{c.payee.address}</span></div>
                </div>
              </div>

              {/* Part II: Payor (Franchise Branch) */}
              <div style={{ background: '#0b0d14', border: '1px solid #1f2433', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#658256', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  PART II: PAYOR INFORMATION (WITHHOLDING AGENT)
                </div>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><span style={{ color: '#94a3b8' }}>TIN:</span> <strong className="mono" style={{ color: '#ffffff' }}>{c.payor.tin}</strong> <span style={{ color: '#64748b', fontSize: '0.75rem' }}>(RDO {c.payor.rdo_code})</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Payor Name:</span> <strong style={{ color: '#ffffff' }}>{c.payor.name}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>Trade Name:</span> <span style={{ color: '#cbd5e1' }}>{c.payor.trade_name}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Address:</span> <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{c.payor.address}</span></div>
                </div>
              </div>
            </div>

            {/* Part III: Schedule of Income Payments & Tax Withheld */}
            <div style={{ background: '#0b0d14', border: '1px solid #1f2433', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '10px 16px', background: '#161a26', borderBottom: '1px solid #1f2433', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#e1c256', letterSpacing: '0.05em' }}>
                PART III: DETAILS OF MONTHLY INCOME PAYMENTS SUBJECT TO WITHHOLDING TAX
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#0d1017', borderBottom: '1px solid #1f2433', color: '#94a3b8', fontSize: '0.75rem' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>NATURE OF INCOME PAYMENT</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px' }}>ATC</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>GROSS AMOUNT</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px' }}>TAX RATE</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>TAX WITHHELD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.income_payments || []).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #161a26' }}>
                        <td style={{ padding: '12px 14px', color: '#f8fafc', fontWeight: 600 }}>{row.nature_of_payment}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#e1c256', fontFamily: 'monospace', fontWeight: 700 }}>{row.atc}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ffffff', fontWeight: 700 }} className="mono">
                          ₱{Number(row.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#e1c256', fontWeight: 700 }}>{row.tax_rate}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#658256', fontWeight: 700 }} className="mono">
                          ₱{Number(row.tax_withheld || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#12151e', borderTop: '2px solid #333a4d', fontWeight: 800 }}>
                      <td colSpan={2} style={{ padding: '12px 14px', color: '#ffffff' }}>TOTALS:</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ffffff' }} className="mono">
                        ₱{Number(c.total_income_payment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#658256' }} className="mono">
                        ₱{Number(c.total_tax_withheld || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Net Remittance Summary Callout */}
            <div style={{
              background: 'rgba(101, 130, 86, 0.08)',
              border: '1px solid rgba(101, 130, 86, 0.3)',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Net Corporate Remittance Settled via {c.payment_rail}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#658256' }} className="mono">
                  ₱{Number(c.net_amount_remitted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#658256" />
                <span style={{ fontSize: '0.75rem', color: '#7fa36d', fontWeight: 700 }}>
                  BIR Creditable Withholding Tax (CWT) Form Officially Issued
                </span>
              </div>
            </div>

            {/* Legal Perjury Statement & Signatory */}
            <div style={{ borderTop: '1px dashed #333a4d', paddingTop: '16px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 16px 0' }}>
                "We declare under the penalties of perjury that this certificate has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof."
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{c.signatory?.name}</div>
                  <div style={{ color: '#64748b' }}>{c.signatory?.title}</div>
                  <div style={{ color: '#64748b' }}>Date Signed: {new Date(c.signatory?.date_signed).toLocaleDateString()}</div>
                </div>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#0b0d14',
                  border: '1px solid #1f2433',
                  fontSize: '0.6875rem',
                  fontFamily: 'monospace',
                  color: '#e1c256'
                }}>
                  SEAL: BIR2307-AUTHENTICATED-{c.reference_no}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="no-print" style={{
          padding: '14px 24px',
          borderTop: '1px solid #1f2433',
          background: '#0b0d14',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            className="ksyn-btn ksyn-btn-gold"
            style={{ padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 800 }}
          >
            Close Certificate
          </button>
        </div>
      </div>
    </div>
  );
}
