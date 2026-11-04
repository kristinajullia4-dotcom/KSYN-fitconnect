const crypto = require('crypto');
const { memoryStore, query, isPostgres } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

// Ensure payroll stores exist
if (!memoryStore.coach_payslips) memoryStore.coach_payslips = [];
if (!memoryStore.payroll_batch_runs) memoryStore.payroll_batch_runs = [];

// 1. Generate Batch Commission Payroll for Coaches
async function generateBatchPayroll(req, res) {
  try {
    const user = req.user;
    const {
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear(),
      branch_id,
      withholding_tax_rate = 0.10 // 10% BIR Form 2307 Creditable Withholding Tax
    } = req.body;

    const targetBranchId = user.role === 'super_admin' ? (branch_id || null) : user.branch_id;

    // Fetch all coaches/trainers
    let coaches = (memoryStore.users || []).filter(u => u.role === 'coach' || u.role === 'trainer');
    if (targetBranchId) {
      coaches = coaches.filter(c => c.branch_id === targetBranchId || !c.branch_id);
    }

    if (coaches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible coaches found for commission payroll in the specified branch.'
      });
    }

    if (!memoryStore.pt_sessions) memoryStore.pt_sessions = [];

    const monthNum = Number(month);
    const yearNum = Number(year);
    const monthName = new Date(yearNum, monthNum - 1).toLocaleString('en-US', { month: 'long' });

    const batchRunId = `pr-run-${yearNum}-${String(monthNum).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
    const createdPayslips = [];
    let totalGrossBatch = 0;
    let totalTaxBatch = 0;
    let totalNetBatch = 0;

    for (const coach of coaches) {
      // Find completed sessions for this coach and period
      const eligibleSessions = memoryStore.pt_sessions.filter(s => {
        if (s.coach_id !== coach.id) return false;
        const sDate = new Date(s.session_date || s.created_at || Date.now());
        const isPeriodMatch = (sDate.getMonth() + 1) === monthNum && sDate.getFullYear() === yearNum;
        return isPeriodMatch;
      });

      const sessionsCount = eligibleSessions.length;

      // Base commission (60% split or recorded commission)
      const baseCommission = eligibleSessions.reduce(
        (sum, s) => sum + (Number(s.commission_earned) || 570.00),
        0
      );

      // Performance Tier Bonus (Contracted Incentive)
      // >= 15 sessions = ₱5,000; >= 10 sessions = ₱2,500; else ₱0
      const tierBonus = sessionsCount >= 15 ? 5000.00 : (sessionsCount >= 10 ? 2500.00 : 0.00);

      const grossEarnings = Math.round((baseCommission + tierBonus) * 100) / 100;
      const taxAmount = Math.round((grossEarnings * Number(withholding_tax_rate)) * 100) / 100;
      const netPayout = Math.round((grossEarnings - taxAmount) * 100) / 100;

      const payslipNo = `PAY-${yearNum}${String(monthNum).padStart(2, '0')}-${coach.id.slice(-4).toUpperCase()}`;

      const payslip = {
        id: `slip-${Date.now()}-${coach.id.slice(-4)}`,
        batch_run_id: batchRunId,
        payslip_no: payslipNo,
        period_month: monthNum,
        period_year: yearNum,
        period_label: `${monthName} ${yearNum}`,
        coach_id: coach.id,
        coach_name: coach.name,
        coach_email: coach.email,
        branch_id: coach.branch_id || targetBranchId || 'b-mkt-01',
        contract_title: 'Head Coach / Senior Personal Trainer (Tier 2)',
        split_percentage: 60.0,
        sessions_completed: sessionsCount,
        base_commission: baseCommission,
        tier_bonus: tierBonus,
        gross_earnings: grossEarnings,
        withholding_tax_rate: Number(withholding_tax_rate) * 100,
        withholding_tax_amount: taxAmount,
        bir_form_ref: 'BIR Form 2307 (Creditable Withholding Tax at Source - 10%)',
        net_payout: netPayout,
        currency: 'PHP',
        bank_details: {
          bank_name: 'BDO Unibank, Inc.',
          bank_code: 'BDO001',
          account_number: '1098-7654-3210',
          account_name: coach.name
        },
        payment_rail: 'PESONet Batch Direct Credit',
        payout_status: 'Disbursed',
        generated_at: new Date(),
        generated_by: user.name || 'System Payroll Engine'
      };

      // Mark sessions as disbursed
      eligibleSessions.forEach(s => {
        s.payout_id = payslip.id;
        s.payout_status = 'disbursed';
      });

      memoryStore.coach_payslips.unshift(payslip);
      createdPayslips.push(payslip);

      totalGrossBatch += grossEarnings;
      totalTaxBatch += taxAmount;
      totalNetBatch += netPayout;
    }

    const batchSummary = {
      id: batchRunId,
      branch_id: targetBranchId,
      period: `${monthName} ${yearNum}`,
      coaches_count: createdPayslips.length,
      total_gross_earnings: Math.round(totalGrossBatch * 100) / 100,
      total_withholding_tax: Math.round(totalTaxBatch * 100) / 100,
      total_net_payout: Math.round(totalNetBatch * 100) / 100,
      clearing_rail: 'BDO / BPI PESONet Electronic Fund Transfer',
      created_at: new Date(),
      created_by: user.name
    };

    memoryStore.payroll_batch_runs.unshift(batchSummary);

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'PAYROLL_BATCH_DISBURSED',
      resource: `PAYROLL_BATCH:${batchRunId}`,
      ip_address: req.ip || '127.0.0.1',
      details: {
        period: `${monthName} ${yearNum}`,
        coaches: createdPayslips.length,
        totalNet: totalNetBatch
      }
    });

    res.status(201).json({
      success: true,
      message: `Batch commission payroll for ${monthName} ${yearNum} generated successfully.`,
      batch: batchSummary,
      payslips: createdPayslips
    });
  } catch (err) {
    console.error('[payrollController generateBatchPayroll error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Get Payslips List (Role-Guarded with PostgreSQL Support)
async function getPayslips(req, res) {
  try {
    const user = req.user;

    if (isPostgres()) {
      let sql = 'SELECT * FROM coach_payslips';
      const params = [];
      if (user.role === 'coach' || user.role === 'trainer') {
        sql += ' WHERE coach_id = $1';
        params.push(user.id);
      } else if (user.role === 'branch_admin' && user.branch_id) {
        sql += ' WHERE branch_id = $1';
        params.push(user.branch_id);
      }
      sql += ' ORDER BY created_at DESC';
      const result = await query(sql, params);
      return res.json({
        success: true,
        count: result.rows.length,
        payslips: result.rows
      });
    }

    let slips = [...(memoryStore.coach_payslips || [])];

    if (user.role === 'coach' || user.role === 'trainer') {
      slips = slips.filter(p => p.coach_id === user.id);
    } else if (user.role === 'branch_admin' && user.branch_id) {
      slips = slips.filter(p => p.branch_id === user.branch_id);
    }

    res.json({
      success: true,
      count: slips.length,
      payslips: slips
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, payslips: [] });
  }
}

// 3. Get Single Payslip by ID
async function getPayslipById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const slip = (memoryStore.coach_payslips || []).find(p => p.id === id || p.payslip_no === id);

    if (!slip) {
      return res.status(404).json({ success: false, message: 'Payslip record not found.' });
    }

    if ((user.role === 'coach' || user.role === 'trainer') && slip.coach_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view another coach payslip.' });
    }

    // Attach itemized sessions
    const itemizedSessions = (memoryStore.pt_sessions || []).filter(s => s.payout_id === slip.id);

    res.json({
      success: true,
      payslip: {
        ...slip,
        itemized_sessions: itemizedSessions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Export BDO / BPI PESONet Clearing Batch CSV
async function exportBankBatchCsv(req, res) {
  try {
    const { batchRunId, format = 'pesonet' } = req.query;
    let slips = memoryStore.coach_payslips || [];

    if (batchRunId) {
      slips = slips.filter(s => s.batch_run_id === batchRunId);
    }

    if (slips.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No payslip records available for bank batch export.'
      });
    }

    // Standard PESONet / BDO Payroll Clearing Format
    // Format: Record Type, Beneficiary Account, Beneficiary Name, Bank Code, Amount, Currency, Reference Number, Remarks
    const csvRows = [];
    csvRows.push([
      'RECORD_TYPE',
      'BENEFICIARY_NAME',
      'BANK_CODE',
      'BANK_NAME',
      'ACCOUNT_NUMBER',
      'AMOUNT',
      'CURRENCY',
      'REFERENCE_NO',
      'REMARKS'
    ].join(','));

    slips.forEach((s, idx) => {
      const row = [
        'CREDIT',
        `"${s.coach_name.replace(/"/g, '""')}"`,
        s.bank_details?.bank_code || 'BDO001',
        `"${s.bank_details?.bank_name || 'BDO Unibank'}"`,
        `"${s.bank_details?.account_number || '1098-7654-3210'}"`,
        s.net_payout.toFixed(2),
        'PHP',
        s.payslip_no,
        `"KSYN ${s.period_label} Trainer Commission Settlement"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\r\n');
    const filename = `KSYN_${format.toUpperCase()}_Batch_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  generateBatchPayroll,
  getPayslips,
  getPayslipById,
  exportBankBatchCsv
};
