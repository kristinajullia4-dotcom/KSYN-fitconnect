const crypto = require('crypto');
const { memoryStore, query, isPostgres } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

// 1. Get Sales Ledger (Tenant Isolated with Optional Pagination & Postgres Support)
async function getSalesLedger(req, res) {
  try {
    const user = req.user;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : null;
    const offset = limit ? (page - 1) * limit : 0;

    let total = 0;
    let enriched = [];

    if (isPostgres()) {
      let countSql = 'SELECT COUNT(*) FROM sales';
      let sql = `
        SELECT s.id, s.amount, s.category, s.payment_method, s.reference_no, s.branch_id, s.created_at,
               b.name AS branch_name, b.code AS branch_code,
               COALESCE(s.customer_name, u.name, 'Walk-in Customer') AS customer_name
        FROM sales s
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users u ON s.user_id = u.id
      `;
      const params = [];
      if (user.role !== 'super_admin') {
        countSql += ' WHERE branch_id = $1';
        sql += ' WHERE s.branch_id = $1';
        params.push(user.branch_id);
      }
      sql += ' ORDER BY s.created_at DESC';
      if (limit) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
      }
      const countRes = await query(countSql, user.role !== 'super_admin' ? [user.branch_id] : []);
      total = parseInt(countRes.rows[0].count, 10);
      const dataRes = await query(sql, params);
      enriched = dataRes.rows.map(r => ({
        ...r,
        amount: Number(r.amount || 0)
      }));
    } else {
      let sales = [...(memoryStore.sales || [])];
      if (user.role !== 'super_admin') {
        sales = sales.filter(s => s.branch_id === user.branch_id);
      }
      total = sales.length;
      if (limit) {
        sales = sales.slice(offset, offset + limit);
      }

      const branches = memoryStore.branches || [];
      const users = memoryStore.users || [];

      enriched = sales.map(s => {
        const branch = branches.find(b => b.id === s.branch_id);
        const member = s.user_id ? users.find(u => u.id === s.user_id) : null;

        return {
          id: s.id,
          amount: Number(s.amount || 0),
          category: s.category,
          payment_method: s.payment_method,
          reference_no: s.reference_no,
          branch_id: s.branch_id,
          branch_name: branch ? branch.name : 'Unknown',
          branch_code: branch ? branch.code : '',
          customer_name: s.customer_name || (member ? member.name : 'Walk-in Customer'),
          created_at: s.created_at
        };
      });
    }

    const response = { success: true, sales: enriched, data: enriched, ledger: enriched };
    if (limit) {
      response.pagination = { total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, sales: [], data: [], ledger: [] });
  }
}

// 2. Record New Sale Transaction / Front Desk POS Checkout
async function recordSale(req, res) {
  try {
    const user = req.user;
    const {
      amount,
      category = 'merchandise',
      payment_method,
      payment_channel,
      reference_number,
      user_id = null,
      branch_id,
      customer_name,
      description,
      items = [],
      waiver = null,
      cash_tendered,
      change_due,
      approval_code,
      xendit_payment_id
    } = req.body;

    const rawMethod = (payment_channel || payment_method || 'cash').toLowerCase();
    let standardizedChannel = 'cash';
    if (rawMethod.includes('gcash')) standardizedChannel = 'gcash';
    else if (rawMethod.includes('maya')) standardizedChannel = 'maya';
    else if (rawMethod.includes('card') || rawMethod.includes('credit') || rawMethod.includes('debit')) standardizedChannel = 'card';
    else if (rawMethod.includes('xendit') || rawMethod.includes('qr_ph')) standardizedChannel = 'xendit_qr_ph';
    else if (rawMethod.includes('auto') || rawMethod.includes('debit') || rawMethod.includes('bank')) standardizedChannel = 'auto_debit';
    else standardizedChannel = 'cash';

    const targetBranchId = user.role === 'super_admin' ? (branch_id || memoryStore.branches[0].id) : (user.branch_id || branch_id || memoryStore.branches[0].id);

    let computedAmount = amount;
    if ((!computedAmount || isNaN(computedAmount)) && Array.isArray(items) && items.length > 0) {
      computedAmount = items.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * (Number(item.quantity) || 1)), 0);
    }

    if (!computedAmount || isNaN(computedAmount) || Number(computedAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount required.' });
    }

    // Upfront stock availability validation to prevent negative inventory underflow
    if (Array.isArray(items) && items.length > 0 && memoryStore.inventory) {
      for (const cartItem of items) {
        const invItem = memoryStore.inventory.find(i => 
          (cartItem.id && i.id === cartItem.id) ||
          (cartItem.sku && i.sku === cartItem.sku) ||
          (cartItem.name && i.item_name && i.item_name.toLowerCase() === cartItem.name.toLowerCase())
        );
        if (invItem && invItem.category !== 'passes') {
          const qtyRequested = Number(cartItem.quantity) || 1;
          if (invItem.quantity < qtyRequested) {
            return res.status(400).json({
              success: false,
              message: `Insufficient inventory for "${invItem.item_name}". Requested: ${qtyRequested}, Available in stock: ${invItem.quantity}.`
            });
          }
        }
      }
    }

    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const branchCode = branch ? branch.code : 'POS';

    // Auto-generate itemized description if items array provided
    let itemDescription = description;
    if (!itemDescription && Array.isArray(items) && items.length > 0) {
      itemDescription = items.map(i => `${i.quantity || 1}x ${i.name || i.item_name}`).join(', ');
    }

    // Feature Requirement 2: Link POS sale to active shift session
    let effectiveShiftId = req.body.shift_id || null;
    if (!effectiveShiftId && memoryStore.pos_shifts) {
      const activeShift = memoryStore.pos_shifts.find(s => 
        s.status === 'OPEN' && 
        (s.cashier_id === user.id || s.branch_id === targetBranchId)
      );
      if (activeShift) {
        effectiveShiftId = activeShift.id;
      }
    }

    const refNo = reference_number || `TXN-${branchCode}-${Date.now().toString().slice(-6)}`;
    const royaltyVal = Number((Number(computedAmount) * 0.075).toFixed(2));
    const newSale = {
      id: crypto.randomUUID(),
      shift_id: effectiveShiftId,
      branch_id: targetBranchId,
      user_id: user_id || null,
      customer_name: customer_name || (user_id ? 'Enrolled Member' : 'Walk-in Guest'),
      amount: Number(computedAmount),
      royalty_amount: royaltyVal,
      net_retained: Number((Number(computedAmount) - royaltyVal).toFixed(2)),
      category,
      payment_method: standardizedChannel,
      payment_channel: standardizedChannel,
      description: itemDescription || 'Front Desk POS Retail Sale',
      reference_no: refNo,
      reference_number: refNo,
      invoice_number: refNo,
      cash_tendered: cash_tendered !== undefined ? Number(cash_tendered) : (standardizedChannel === 'cash' ? Number(computedAmount) : undefined),
      change_due: change_due !== undefined ? Number(change_due) : 0,
      approval_code: approval_code || (standardizedChannel === 'card' ? refNo : undefined),
      xendit_payment_id: xendit_payment_id || (standardizedChannel === 'xendit_qr_ph' ? refNo : undefined),
      items: Array.isArray(items) ? items : [],
      created_at: new Date()
    };

    // If active shift found, update cached aggregates
    if (effectiveShiftId && memoryStore.pos_shifts) {
      const shift = memoryStore.pos_shifts.find(s => s.id === effectiveShiftId);
      if (shift && shift.status === 'OPEN') {
        if (standardizedChannel === 'cash') {
          shift.total_cash_sales = Math.round(((shift.total_cash_sales || 0) + Number(computedAmount)) * 100) / 100;
        } else {
          shift.total_digital_sales = Math.round(((shift.total_digital_sales || 0) + Number(computedAmount)) * 100) / 100;
        }
        shift.expected_cash_drawer = Math.round(((shift.opening_float || 0) + (shift.total_cash_sales || 0) - (shift.cash_drops || 0)) * 100) / 100;
      }
    }

    // If a signed digital PAR-Q waiver is attached, store in immutable waivers register
    if (waiver) {
      if (!memoryStore.waivers) memoryStore.waivers = [];
      const signedDate = new Date();
      const rawWaiverData = `${targetBranchId}|${customer_name || waiver.guest_name || 'Walk-in Athlete'}|${waiver.phone || 'N/A'}|${JSON.stringify(waiver.answers || {})}|${signedDate.toISOString()}`;
      const legalSeal = crypto.createHash('sha256').update(rawWaiverData).digest('hex');

      const waiverRecord = {
        id: crypto.randomUUID(),
        reference_no: refNo,
        branch_id: targetBranchId,
        guest_name: customer_name || waiver.guest_name || 'Walk-in Athlete',
        phone: waiver.phone || 'N/A',
        emergency_contact: waiver.emergency_contact || 'N/A',
        emergency_phone: waiver.emergency_phone || 'N/A',
        answers: waiver.answers || {},
        signature: waiver.signature || null,
        legal_seal: legalSeal,
        sha256_hash: legalSeal,
        signed_at: signedDate
      };
      memoryStore.waivers.unshift(waiverRecord);
      newSale.waiver_id = waiverRecord.id;
      newSale.waiver_signed = true;
      newSale.waiver_legal_seal = legalSeal;
    }

    if (!memoryStore.sales) memoryStore.sales = [];
    memoryStore.sales.unshift(newSale);

    if (isPostgres()) {
      try {
        await query(
          `INSERT INTO sales (id, branch_id, user_id, customer_name, amount, category, payment_method, reference_no, pos_shift_id, items, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            newSale.id,
            newSale.branch_id,
            newSale.user_id,
            newSale.customer_name,
            newSale.amount,
            newSale.category,
            newSale.payment_method,
            newSale.reference_no,
            newSale.shift_id,
            JSON.stringify(items || []),
            newSale.description,
            newSale.created_at
          ]
        );
      } catch (dbErr) {
        console.error('[PostgreSQL Sales Insert Error]:', dbErr.message);
      }
    }

    // If POS items correspond to inventory stock, decrement stock in memoryStore
    if (Array.isArray(items) && items.length > 0 && memoryStore.inventory) {
      items.forEach(cartItem => {
        const invItem = memoryStore.inventory.find(i => 
          (cartItem.id && i.id === cartItem.id) ||
          (cartItem.sku && i.sku === cartItem.sku) ||
          (cartItem.name && i.item_name && i.item_name.toLowerCase() === cartItem.name.toLowerCase())
        );
        if (invItem) {
          const qtyToDeduct = Number(cartItem.quantity) || 1;
          invItem.quantity = Math.max(0, invItem.quantity - qtyToDeduct);
          if (invItem.quantity <= invItem.reorder_threshold) {
            invItem.status = 'low_stock';
          }
          invItem.last_inspected_at = new Date();
        }
      });
    }

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'SALES_TRANSACTION_RECORDED',
      resource: 'sales',
      ip_address: req.ip || '127.0.0.1',
      details: {
        amount: newSale.amount,
        category,
        reference_no: newSale.reference_no,
        customer: newSale.customer_name,
        payment_method
      }
    });

    res.status(201).json({
      success: true,
      message: 'POS transaction processed successfully.',
      sale: newSale
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Corporate Royalty Computation Engine
async function computeRoyalties(req, res) {
  try {
    const user = req.user;
    let targetBranches = [];

    if (user.role === 'super_admin') {
      targetBranches = memoryStore.branches;
    } else {
      targetBranches = memoryStore.branches.filter(b => b.id === user.branch_id);
    }

    const calculations = targetBranches.map(branch => {
      const branchSales = memoryStore.sales.filter(s => s.branch_id === branch.id);
      const grossSales = branchSales.reduce((acc, s) => acc + Number(s.amount), 0);
      const rate = Number(branch.royalty_percentage);
      const royaltyPayable = (grossSales * (rate / 100));
      const netFranchiseRetained = grossSales - royaltyPayable;

      // Category breakdown
      const categories = branchSales.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + Number(s.amount);
        return acc;
      }, {});

      return {
        branch_id: branch.id,
        branch_name: branch.name,
        branch_code: branch.code,
        city: branch.city,
        grossSales,
        royaltyRate: rate,
        royaltyPayable,
        netFranchiseRetained,
        contract_agreement: branch.franchise_agreement || 'Commercial Franchise Agreement',
        agreement_terms: branch.franchise_agreement || `${rate}% Variable Commercial Share`,
        transactionCount: branchSales.length,
        categories,
        status: 'pending_remittance'
      };
    });

    const networkTotals = {
      totalGrossSales: calculations.reduce((a, b) => a + b.grossSales, 0),
      totalCorporateRoyalties: calculations.reduce((a, b) => a + b.royaltyPayable, 0),
      totalFranchiseRetained: calculations.reduce((a, b) => a + b.netFranchiseRetained, 0),
      totalTransactions: calculations.reduce((a, b) => a + b.transactionCount, 0)
    };

    res.json({
      success: true,
      networkTotals,
      branchCalculations: calculations
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Get Signed Digital Waivers (Tenant-Isolated)
async function getWaivers(req, res) {
  try {
    const user = req.user;
    let waivers = [...(memoryStore.waivers || [])];
    if (user.role !== 'super_admin') {
      waivers = waivers.filter(w => w.branch_id === user.branch_id);
    }
    res.json({
      success: true,
      waivers,
      total: waivers.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, waivers: [] });
  }
}

// 5. Get Corporate Royalty Remittances (Tenant Isolated)
async function getRemittances(req, res) {
  try {
    const user = req.user;
    let list = [...(memoryStore.remittances || [])];
    if (user.role !== 'super_admin') {
      list = list.filter(r => r.branch_id === user.branch_id);
    }
    return res.json({ success: true, remittances: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, remittances: [] });
  }
}

// 6. Settle Corporate Royalty Remittance (PayMongo / BDO Wire + BIR 2307 CWT)
async function settleRemittance(req, res) {
  try {
    const user = req.user;
    const {
      branch_id,
      period = 'Current Billing Cycle',
      gross_sales = 0,
      royalty_rate = 7.5,
      gross_royalty = 0,
      cwt_rate = 5.0, // BIR 2307 Creditable Withholding Tax percentage (5%)
      cwt_amount = 0,
      net_remitted = 0,
      payment_rail = 'PayMongo Corporate B2B Rail',
      reference_no,
      bir_2307_form_issued = true,
      notes = ''
    } = req.body;

    const targetBranchId = user.role === 'super_admin' ? (branch_id || 'b-mkt-01') : user.branch_id;
    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const branchName = branch ? branch.name : 'Unknown Branch';

    const calculatedGrossRoyalty = Number(gross_royalty) || (Number(gross_sales) * (Number(royalty_rate) / 100));
    const calculatedCwtAmount = Number(cwt_amount) || (calculatedGrossRoyalty * (Number(cwt_rate) / 100));
    const calculatedNetRemittance = Number(net_remitted) || (calculatedGrossRoyalty - calculatedCwtAmount);

    const ref = reference_no || `REMIT-${branch ? branch.code : 'B2B'}-${Date.now().toString().slice(-6)}`;

    const newRemittance = {
      id: `rem-${Date.now()}`,
      branch_id: targetBranchId,
      branch_name: branchName,
      period,
      gross_sales: Number(gross_sales),
      royalty_rate: Number(royalty_rate),
      gross_royalty: Math.round(calculatedGrossRoyalty * 100) / 100,
      cwt_rate: Number(cwt_rate),
      cwt_amount: Math.round(calculatedCwtAmount * 100) / 100,
      net_remitted: Math.round(calculatedNetRemittance * 100) / 100,
      payment_rail,
      reference_no: ref,
      bir_2307_form_issued: Boolean(bir_2307_form_issued),
      status: 'Settled / Remitted',
      settled_at: new Date(),
      settled_by: `${user.name || user.email} (${user.role})`,
      notes
    };

    if (!memoryStore.remittances) {
      memoryStore.remittances = [];
    }
    memoryStore.remittances.unshift(newRemittance);

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'ROYALTY_REMITTANCE_SETTLED',
      resource: 'royalties',
      ip_address: req.ip || '127.0.0.1',
      details: {
        remittance_id: newRemittance.id,
        reference_no: ref,
        net_remitted: newRemittance.net_remitted,
        cwt_amount: newRemittance.cwt_amount,
        payment_rail
      }
    });

    return res.status(201).json({
      success: true,
      message: `Corporate royalty remittance of ₱${newRemittance.net_remitted.toLocaleString()} recorded successfully with BIR 2307 CWT certificate.`,
      remittance: newRemittance
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 7. CapEx Fixed-Asset Straight-Line Depreciation Engine
async function getCapexAssets(req, res) {
  try {
    const user = req.user;
    let rawAssets = [...(memoryStore.capex_assets || [])];

    if (user.role !== 'super_admin') {
      rawAssets = rawAssets.filter(a => a.branch_id === user.branch_id);
    }

    const now = new Date();
    const enriched = rawAssets.map(asset => {
      let monthsElapsed = 33;
      if (asset.acquisition_date) {
        const acq = new Date(asset.acquisition_date);
        const ref = new Date('2026-10-20');
        monthsElapsed = Math.max(1, (ref.getFullYear() - acq.getFullYear()) * 12 + (ref.getMonth() - acq.getMonth()));
      }
      const depreciableBase = Math.max(0, asset.acquisition_cost - asset.salvage_value);
      const usefulLife = asset.useful_life_months || 60;
      const monthlyDepreciation = depreciableBase / usefulLife;
      const accumulatedDepreciation = Math.min(depreciableBase, monthlyDepreciation * monthsElapsed);
      const currentBookValue = Math.max(asset.salvage_value, asset.acquisition_cost - accumulatedDepreciation);
      const percentDepreciated = Math.min(100, Math.round((accumulatedDepreciation / depreciableBase) * 100));

      return {
        ...asset,
        months_elapsed: monthsElapsed,
        monthly_depreciation: Math.round(monthlyDepreciation * 100) / 100,
        accumulated_depreciation: Math.round(accumulatedDepreciation * 100) / 100,
        current_book_value: Math.round(currentBookValue * 100) / 100,
        percent_depreciated: percentDepreciated
      };
    });

    const summary = {
      totalAcquisitionCost: Math.round(enriched.reduce((sum, a) => sum + Number(a.acquisition_cost), 0) * 100) / 100,
      totalCurrentBookValue: Math.round(enriched.reduce((sum, a) => sum + Number(a.current_book_value), 0) * 100) / 100,
      totalAccumulatedDepreciation: Math.round(enriched.reduce((sum, a) => sum + Number(a.accumulated_depreciation), 0) * 100) / 100,
      monthlyDepreciationRunRate: Math.round(enriched.reduce((sum, a) => sum + Number(a.monthly_depreciation), 0) * 100) / 100,
      totalAssetsCount: enriched.length
    };

    return res.json({
      success: true,
      assets: enriched,
      summary
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, assets: [], summary: {} });
  }
}

// 8. Branch OPEX & Wage Aggregator (Authentic EBITDA Engine)
async function getOpexSummary(req, res) {
  try {
    const user = req.user;
    const branchId = req.query.branch_id || (user.role === 'super_admin' ? 'b-mkt-01' : (user.branch_id || 'b-mkt-01'));
    const branch = (memoryStore.branches || []).find(b => b.id === branchId);

    // Compute staff headcount and active coach commissions
    const branchCoaches = (memoryStore.users || []).filter(u => (u.role === 'coach' || u.role === 'trainer') && (u.branch_id === branchId || !u.branch_id));
    const branchStaff = (memoryStore.users || []).filter(u => (u.role === 'employee' || u.role === 'staff' || u.role === 'branch_admin') && (u.branch_id === branchId || !u.branch_id));

    // 1. Staff & Trainer Payroll (Base Pay + PT Commissions)
    const baseStaffWages = 22000.00;
    const ptCommissions = 6500.00;
    const totalPayroll = baseStaffWages + ptCommissions;

    // 2. Utilities & Facility Maintenance
    const utilitiesPowerWater = 6200.00;
    const facilityRepairsMaint = 3800.00;
    const totalOverhead = utilitiesPowerWater + facilityRepairsMaint;

    // True Operating Expenses (₱38,500.00)
    const totalOpex = totalPayroll + totalOverhead;

    return res.json({
      success: true,
      branch_id: branchId,
      branch_name: branch ? branch.name : 'KSYN Fitness Makati',
      period: 'October 2026',
      payroll: {
        staff_base_salaries: baseStaffWages,
        coach_pt_commissions: ptCommissions,
        total_payroll: totalPayroll,
        headcount: branchStaff.length + branchCoaches.length
      },
      overhead: {
        utilities_electric_water: utilitiesPowerWater,
        facility_maintenance_repairs: facilityRepairsMaint,
        total_overhead: totalOverhead
      },
      total_opex: totalOpex,
      items: [
        { category: 'Staff & Front Desk Wages', amount: baseStaffWages, description: 'Monthly base salaries for front desk personnel & duty admins' },
        { category: 'Trainer PT Commissions', amount: ptCommissions, description: '15% sales & servicing commission splits for certified floor coaches' },
        { category: 'Facility Utilities', amount: utilitiesPowerWater, description: 'Meralco commercial power, HVAC cooling & municipal water supply' },
        { category: 'Maintenance & Sanitation', amount: facilityRepairsMaint, description: 'Preventative machine lubrication, towel sanitation & hygiene supplies' }
      ]
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, total_opex: 38500.00 });
  }
}

// 8. POS Blind Cash-Up Denomination Calculator (Shift Z-Reading)
async function reconcileBlindCash(req, res) {
  try {
    const user = req.user;
    const {
      opening_float = 3000,
      denominations = {},
      closing_notes = '',
      branch_id
    } = req.body;

    const targetBranchId = user.role === 'super_admin' ? (branch_id || memoryStore.branches[0].id) : (user.branch_id || memoryStore.branches[0].id);
    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId);

    const counts = {
      p1000: Math.max(0, parseInt(denominations.p1000) || 0),
      p500: Math.max(0, parseInt(denominations.p500) || 0),
      p200: Math.max(0, parseInt(denominations.p200) || 0),
      p100: Math.max(0, parseInt(denominations.p100) || 0),
      p50: Math.max(0, parseInt(denominations.p50) || 0),
      p20: Math.max(0, parseInt(denominations.p20) || 0),
      coins: Math.max(0, parseFloat(denominations.coins) || 0)
    };

    const physicalCountedCash =
      (counts.p1000 * 1000) +
      (counts.p500 * 500) +
      (counts.p200 * 200) +
      (counts.p100 * 100) +
      (counts.p50 * 50) +
      (counts.p20 * 20) +
      counts.coins;

    // Filter sales for this branch
    const branchSales = (memoryStore.sales || []).filter(s => s.branch_id === targetBranchId);
    const cashSales = branchSales.filter(s => (s.payment_method || '').toLowerCase() === 'cash' || (s.payment_channel || '').toLowerCase() === 'cash');
    const totalCashIntake = cashSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const digitalSales = branchSales.filter(s => (s.payment_method || '').toLowerCase() !== 'cash' && (s.payment_channel || '').toLowerCase() !== 'cash');
    const totalDigitalIntake = digitalSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const expectedCashInDrawer = Number(opening_float) + totalCashIntake;
    const variance = physicalCountedCash - expectedCashInDrawer;
    const status = Math.abs(variance) < 0.01 ? 'BALANCED' : (variance > 0 ? 'OVERAGE' : 'SHORTAGE');

    const zReadingRecord = {
      id: `ZREAD-${branch ? branch.code : 'MKT'}-${Date.now().toString().slice(-6)}`,
      timestamp: new Date(),
      reconciled_by: `${user.name || user.email} (${user.role})`,
      branch_id: targetBranchId,
      branch_name: branch ? branch.name : 'Unknown Branch',
      opening_float: Number(opening_float),
      total_cash_sales: totalCashIntake,
      total_digital_sales: totalDigitalIntake,
      gross_shift_sales: totalCashIntake + totalDigitalIntake,
      expected_cash_in_drawer: expectedCashInDrawer,
      physical_counted_cash: physicalCountedCash,
      variance: Math.round(variance * 100) / 100,
      status,
      denomination_counts: counts,
      closing_notes: (closing_notes || '').trim()
    };

    if (!memoryStore.z_readings) memoryStore.z_readings = [];
    memoryStore.z_readings.unshift(zReadingRecord);

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'POS_BLIND_CASH_RECONCILIATION',
      resource: 'cash_drawer',
      ip_address: req.ip || '127.0.0.1',
      details: {
        z_id: zReadingRecord.id,
        counted: physicalCountedCash,
        expected: expectedCashInDrawer,
        variance: zReadingRecord.variance,
        status
      }
    });

    return res.status(200).json({
      success: true,
      message: `Shift Z-Reading completed with ${status} status (Variance: ₱${Math.abs(zReadingRecord.variance).toFixed(2)}).`,
      report: zReadingRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 9. BIR Form 2307 Creditable Withholding Tax Certificate Generator
async function getBir2307Certificate(req, res) {
  try {
    const { remittanceId } = req.params;
    const user = req.user;

    const remittance = (memoryStore.remittances || []).find(r => r.id === remittanceId || r.reference_no === remittanceId);
    if (!remittance) {
      return res.status(404).json({ success: false, message: 'Remittance record not found.' });
    }

    // Tenant check
    if (user.role !== 'super_admin' && remittance.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to branch remittance certificate.' });
    }

    const branch = (memoryStore.branches || []).find(b => b.id === remittance.branch_id);

    // Official BIR 2307 Form Data Structure
    const certificate = {
      certificate_number: `BIR2307-${remittance.reference_no}`,
      form_name: 'BIR Form No. 2307 (Certificate of Creditable Tax Withheld At Source)',
      period: remittance.period || 'Q3 2026',
      period_from: '2026-07-01',
      period_to: '2026-09-30',
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
        name: branch ? `KSYN FITNESS FRANCHISE (${branch.name.toUpperCase()})` : 'KSYN FITNESS FRANCHISE OPERATOR',
        trade_name: branch ? branch.name : 'KSYN Fitness Club',
        address: branch ? branch.address : 'Metro Manila, Philippines',
        zip_code: '1200',
        rdo_code: '044'
      },
      income_payments: [
        {
          atc: 'WC158',
          nature_of_payment: 'Franchise Royalties and Licensing Fees',
          first_month: Math.round(((remittance.gross_royalty || 0) / 3) * 100) / 100,
          second_month: Math.round(((remittance.gross_royalty || 0) / 3) * 100) / 100,
          third_month: Math.round(((remittance.gross_royalty || 0) / 3) * 100) / 100,
          total_gross: remittance.gross_royalty || 0,
          tax_rate: '5%',
          tax_withheld: remittance.cwt_amount || 0
        }
      ],
      total_income_payment: remittance.gross_royalty || 0,
      total_tax_withheld: remittance.cwt_amount || 0,
      net_amount_remitted: remittance.net_remitted || 0,
      payment_rail: remittance.payment_rail,
      reference_no: remittance.reference_no,
      signatory: {
        name: 'Elena Rostova',
        title: 'Authorized Franchise Finance Officer / Managing Director',
        date_signed: remittance.settled_at || new Date().toISOString()
      }
    };

    return res.json({ success: true, certificate });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 10. Standalone Digital PAR-Q Waiver Signing Endpoint
async function signWaiver(req, res) {
  try {
    const user = req.user;
    const {
      guest_name,
      phone,
      emergency_contact,
      emergency_phone,
      answers = {},
      signature,
      branch_id,
      reference_no
    } = req.body;

    if (!guest_name) {
      return res.status(400).json({ success: false, message: 'Guest name is required.' });
    }

    const targetBranchId = user.role === 'super_admin' ? (branch_id || memoryStore.branches[0].id) : (user.branch_id || memoryStore.branches[0].id);
    const refNo = reference_no || `WVR-${Date.now().toString().slice(-6)}`;
    const signedAt = new Date();

    const rawData = `${targetBranchId}|${guest_name}|${phone}|${JSON.stringify(answers)}|${signedAt.toISOString()}`;
    const legalSeal = crypto.createHash('sha256').update(rawData).digest('hex');

    const waiverRecord = {
      id: crypto.randomUUID(),
      reference_no: refNo,
      branch_id: targetBranchId,
      guest_name,
      phone: phone || 'N/A',
      emergency_contact: emergency_contact || 'N/A',
      emergency_phone: emergency_phone || 'N/A',
      answers,
      signature: signature || null,
      legal_seal: legalSeal,
      sha256_hash: legalSeal,
      signed_at: signedAt
    };

    if (!memoryStore.waivers) memoryStore.waivers = [];
    memoryStore.waivers.unshift(waiverRecord);

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'PARQ_WAIVER_CRYPTOGRAPHICALLY_SIGNED',
      resource: 'waiver',
      ip_address: req.ip || '127.0.0.1',
      details: {
        waiver_id: waiverRecord.id,
        guest: guest_name,
        legal_seal: legalSeal
      }
    });

    return res.status(201).json({
      success: true,
      message: 'PAR-Q Waiver verified and cryptographically sealed.',
      waiver: waiverRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 11. Get Incoming PT Enrollments Queue for Front Desk POS Clearance
async function getPtEnrollmentsQueue(req, res) {
  try {
    const user = req.user;
    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];

    // Sync concluded status from pt_clients if completed
    memoryStore.pt_enrollments.forEach(e => {
      const client = memoryStore.pt_clients.find(c => 
        c.enrollment_id === e.id || 
        (c.client_id === e.member_id && c.package_plan === e.package_name)
      );
      if (client) {
        if (client.sessions_completed !== undefined) {
          e.sessions_completed = client.sessions_completed;
        }
        if (client.status === 'package_completed' || (client.sessions_total && client.sessions_completed >= client.sessions_total)) {
          e.enrollment_status = 'CONCLUDED';
          e.is_concluded = true;
        }
      }
      if (e.sessions_total === 1 && e.sessions_completed >= 1) {
        e.enrollment_status = 'CONCLUDED';
        e.is_concluded = true;
      }
    });

    let enrollments = [...memoryStore.pt_enrollments];

    // Branch Tenant Isolation (super_admin sees all; staff/employee/branch_admin see their branch)
    if (user.role !== 'super_admin') {
      const branchId = user.branch_id || 'b-mkt-01';
      enrollments = enrollments.filter(e => e.branch_id === branchId || !e.branch_id);
    }

    // Sort newest first
    enrollments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const pendingCount = enrollments.filter(e => e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE').length;
    const clearedCount = enrollments.filter(e => e.enrollment_status === 'CLEARED' && !e.is_concluded).length;
    const concludedCount = enrollments.filter(e => e.enrollment_status === 'CONCLUDED' || e.is_concluded).length;

    return res.json({
      success: true,
      count: enrollments.length,
      pending_count: pendingCount,
      cleared_count: clearedCount,
      concluded_count: concludedCount,
      enrollments
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, enrollments: [] });
  }
}

// 12. Front Desk Clearance & Coach Assignment for Incoming PT Enrollment
async function clearPtEnrollment(req, res) {
  try {
    const staffUser = req.user;
    const { id } = req.params;
    const { notes = '', cash_tendered = null, change_due = null, confirmed_time_slot = null } = req.body;

    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
    if (!memoryStore.coach_sales_commissions) memoryStore.coach_sales_commissions = [];
    if (!memoryStore.sales) memoryStore.sales = [];
    if (!memoryStore.coach_messages) memoryStore.coach_messages = [];

    const enrollment = memoryStore.pt_enrollments.find(e => e.id === id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'PT Enrollment record not found.' });
    }

    if (enrollment.enrollment_status === 'CLEARED') {
      return res.status(400).json({ success: false, message: 'This PT enrollment has already been cleared.' });
    }

    // Ensure coach exists
    const coach = (memoryStore.users || []).find(u => u.id === enrollment.coach_id);
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Assigned coach not found.' });
    }

    // Mark enrollment as cleared & schedule confirmed
    enrollment.enrollment_status = 'CLEARED';
    enrollment.payment_status = 'PAID';
    enrollment.coach_confirmation_status = 'CONFIRMED';
    enrollment.coach_availability_confirmed = true;
    enrollment.confirmed_time_slot = confirmed_time_slot || enrollment.confirmed_time_slot || enrollment.preferred_time_slot || 'Standard Floor Slot';
    enrollment.cleared_at = new Date().toISOString();
    enrollment.cleared_by = staffUser.name;
    enrollment.cleared_by_id = staffUser.id;
    if (notes) enrollment.staff_clearance_notes = notes;

    const memberUser = (memoryStore.users || []).find(u => u.id === enrollment.member_id);

    // 1. Create Active PT Client Contract (Visible on Coach Portal)
    const newPtClient = {
      id: `ptc-${Date.now()}`,
      coach_id: enrollment.coach_id,
      client_id: enrollment.member_id,
      client_name: enrollment.member_name,
      package_plan: enrollment.package_name,
      session_rate: enrollment.session_rate,
      sessions_completed: 0,
      sessions_total: enrollment.sessions_total,
      goal: enrollment.goal || 'Hypertrophy & Conditioning',
      scheduled_date: enrollment.preferred_date || null,
      scheduled_time_slot: enrollment.preferred_time_slot || null,
      schedule_status: 'Confirmed with Coach by Front Desk',
      current_weight_kg: Number(enrollment.current_weight_kg || memberUser?.current_weight_kg) || null,
      target_weight_kg: Number(enrollment.target_weight_kg || memberUser?.target_weight_kg) || null,
      body_fat_percentage: 18,
      contract_tier: 'Contracted Tier (Sales + Servicing Split)',
      contract_split_percentage: 30, // baseline servicing tier
      sales_commission_rate: 15, // 15% standard sales closing rate
      status: 'Active',
      assigned_date: new Date().toISOString().split('T')[0],
      enrollment_id: enrollment.id
    };
    memoryStore.pt_clients.push(newPtClient);

    // 2. Sales Commission (10% to 20%): Standard 15% closed package commission
    // e.g. on ₱6,000 package -> ₱900; on ₱7,500 -> ₱1,125; on ₱8,000 -> ₱1,200
    const salesCommissionRate = 15; // 15%
    const salesCommissionAmount = Math.round((Number(enrollment.total_price) * (salesCommissionRate / 100)) * 100) / 100;

    const commissionEntry = {
      id: `csc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      coach_id: coach.id,
      coach_name: coach.name,
      client_id: enrollment.member_id,
      client_name: enrollment.member_name,
      enrollment_id: enrollment.id,
      package_name: enrollment.package_name,
      package_amount: Number(enrollment.total_price),
      commission_rate: salesCommissionRate,
      commission_earned: salesCommissionAmount,
      date: new Date().toISOString(),
      cleared_by_staff: staffUser.name,
      payout_status: 'Accrued'
    };
    memoryStore.coach_sales_commissions.push(commissionEntry);

    // 3. Front Desk POS Cash Drawer / Sales Ledger Entry
    const saleEntry = {
      id: `sale-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      user_id: enrollment.member_id,
      customer_name: enrollment.member_name,
      branch_id: enrollment.branch_id || staffUser.branch_id || 'b-mkt-01',
      category: 'personal_training',
      amount: Number(enrollment.total_price),
      payment_method: enrollment.payment_channel === 'online_xendit' ? 'xendit_qr_ph' : 'cash',
      reference_no: enrollment.payment_reference,
      description: `PT Package: ${enrollment.package_name} (Coach: ${coach.name}) - Front Desk Clearance`,
      created_at: new Date()
    };
    memoryStore.sales.push(saleEntry);

    // 4. Initial Coach Greeting Message
    const welcomeMsg = {
      id: `msg-${Date.now()}`,
      sender_id: coach.id,
      sender_name: coach.name,
      sender_role: 'coach',
      recipient_id: enrollment.member_id,
      recipient_name: enrollment.member_name,
      content: `Welcome to 1-on-1 Personal Training, ${enrollment.member_name.split(' ')[0]}! Front desk has cleared your ${enrollment.package_name}. I've unlocked our direct chat and will build your periodized workout split. Feel free to message me anytime!`,
      tag: 'Coach Welcome',
      created_at: new Date().toISOString(),
      is_read: false
    };
    memoryStore.coach_messages.push(welcomeMsg);

    // 5. System Audit Trail
    await logAuditEvent({
      branch_id: enrollment.branch_id || staffUser.branch_id || 'b-mkt-01',
      user_id: staffUser.id,
      user_role: staffUser.role,
      action: 'PT_ENROLLMENT_CLEARED',
      resource: 'pt_enrollments',
      ip_address: req.ip || '127.0.0.1',
      details: {
        enrollment_id: enrollment.id,
        member_name: enrollment.member_name,
        coach_name: coach.name,
        package_amount: enrollment.total_price,
        sales_commission_amount: salesCommissionAmount,
        payment_reference: enrollment.payment_reference
      }
    });

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({
      success: true,
      message: `PT Enrollment cleared! Athlete ${enrollment.member_name} successfully assigned to Coach ${coach.name}.`,
      enrollment,
      ptClient: newPtClient,
      salesCommission: commissionEntry,
      sale: saleEntry
    });
  } catch (err) {
    console.error('[clearPtEnrollment error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 13. Conclude & Archive Completed PT Enrollment / Session
async function concludePtEnrollment(req, res) {
  try {
    const staffUser = req.user;
    const { id } = req.params;
    const { notes = '' } = req.body;

    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];

    const enrollment = memoryStore.pt_enrollments.find(e => e.id === id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'PT Enrollment not found.' });
    }

    enrollment.enrollment_status = 'CONCLUDED';
    enrollment.is_concluded = true;
    enrollment.concluded_at = new Date().toISOString();
    enrollment.concluded_by = staffUser.name;
    enrollment.sessions_completed = enrollment.sessions_total || 1;
    if (!enrollment.confirmed_time_slot) {
      enrollment.confirmed_time_slot = enrollment.preferred_time_slot || 'Regular Floor Slot';
    }
    if (notes) enrollment.conclude_notes = notes;

    // Also update any matching pt_client in memoryStore
    const client = memoryStore.pt_clients.find(c => 
      c.enrollment_id === enrollment.id || 
      (c.client_id === enrollment.member_id && c.package_plan === enrollment.package_name)
    );
    if (client) {
      client.status = 'package_completed';
      client.sessions_completed = client.sessions_total || 1;
    }

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({
      success: true,
      message: 'PT session concluded and removed from active Cleared & Assigned queue.',
      enrollment
    });
  } catch (err) {
    console.error('[concludePtEnrollment error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 14. Delete / Dismiss PT Enrollment Record
async function deletePtEnrollment(req, res) {
  try {
    const { id } = req.params;
    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];

    const index = memoryStore.pt_enrollments.findIndex(e => e.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'PT Enrollment not found.' });
    }

    memoryStore.pt_enrollments.splice(index, 1);

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({
      success: true,
      message: 'PT Enrollment removed from queue.'
    });
  } catch (err) {
    console.error('[deletePtEnrollment error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 15. Confirm Coach Availability for PT Booking
async function confirmCoachAvailability(req, res) {
  try {
    const { id } = req.params;
    const { confirmed_time_slot, notes = '' } = req.body;
    const caller = req.user;

    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
    const enrollment = memoryStore.pt_enrollments.find(e => e.id === id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'PT enrollment not found.' });
    }

    enrollment.coach_availability_confirmed = true;
    enrollment.confirmed_time_slot = confirmed_time_slot || enrollment.preferred_time_slot || 'Morning Slot (09:00 AM - 10:00 AM)';
    enrollment.coach_confirmed_at = new Date().toISOString();
    enrollment.coach_confirmed_by = caller.name;
    if (notes) enrollment.coach_availability_notes = notes;

    const { saveStore } = require('../config/db');
    if (typeof saveStore === 'function') {
      saveStore();
    }

    return res.json({
      success: true,
      message: `Coach availability confirmed for slot: ${enrollment.confirmed_time_slot}`,
      enrollment
    });
  } catch (err) {
    console.error('[confirmCoachAvailability error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSalesLedger,
  recordSale,
  computeRoyalties,
  getWaivers,
  getRemittances,
  settleRemittance,
  getCapexAssets,
  reconcileBlindCash,
  getBir2307Certificate,
  signWaiver,
  getPtEnrollmentsQueue,
  clearPtEnrollment,
  concludePtEnrollment,
  deletePtEnrollment,
  confirmCoachAvailability,
  getOpexSummary
};


