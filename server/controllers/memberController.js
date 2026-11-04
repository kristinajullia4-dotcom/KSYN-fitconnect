const crypto = require('crypto');
const { query, isPostgres, memoryStore, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { resolvePlan } = require('../config/membershipRates');
const chatService = require('../services/chatService');
const { generateExternalId, getBranchCode, formatStreamDescription } = require('../utils/transactionStreams');

// 1. Get Members (Strictly isolated by branch_id with optional pagination)
async function getMembers(req, res) {
  try {
    const user = req.user;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : null;
    const offset = limit ? (page - 1) * limit : 0;

    let total = 0;
    let enriched = [];

    if (isPostgres()) {
      let countSql = "SELECT COUNT(*) FROM users WHERE role = 'member'";
      let sql = `
        SELECT u.id, u.name, u.email, u.phone, u.status, u.branch_id, u.rfid_card_uid, u.created_at,
               b.name AS branch_name,
               s.id AS sub_id, s.plan, s.tier, s.status AS sub_status, s.start_date, s.end_date, s.total_paid
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        LEFT JOIN subscriptions s ON u.id = s.user_id
        WHERE u.role = 'member'
      `;
      const params = [];
      if (user.role !== 'super_admin') {
        countSql += " AND branch_id = $1";
        sql += " AND u.branch_id = $1";
        params.push(user.branch_id);
      }
      sql += " ORDER BY u.created_at DESC";
      if (limit) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
      }
      const countRes = await query(countSql, user.role !== 'super_admin' ? [user.branch_id] : []);
      total = parseInt(countRes.rows[0].count, 10);
      const dataRes = await query(sql, params);
      enriched = dataRes.rows.map(m => {
        const resolved = resolvePlan(m.plan || '1_month');
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          status: m.status,
          membership_plan: m.plan || '1_month',
          plan_name: resolved?.name || m.plan || '1 Month Pro Pass',
          membership_tier: m.tier || resolved?.tier || 'basic',
          rfid_card_uid: m.rfid_card_uid,
          branch_id: m.branch_id,
          branch_name: m.branch_name || 'Unknown',
          subscription: m.sub_id ? {
            id: m.sub_id,
            plan: m.plan,
            tier: m.tier,
            status: m.sub_status,
            start_date: m.start_date,
            end_date: m.end_date,
            total_paid: m.total_paid
          } : null,
          created_at: m.created_at
        };
      });
    } else {
      let members = (memoryStore.users || []).filter(u => u.role === 'member');
      if (user.role !== 'super_admin') {
        members = members.filter(u => u.branch_id === user.branch_id);
      }
      total = members.length;
      if (limit) {
        members = members.slice(offset, offset + limit);
      }

      // Attach subscription and branch details
      enriched = members.map(m => {
        const sub = (memoryStore.subscriptions || []).find(s => s.user_id === m.id);
        const branch = (memoryStore.branches || []).find(b => b.id === m.branch_id);
        const checkIns = (memoryStore.attendance_logs || []).filter(a => a.user_id === m.id);
        const planId = m.membership_plan || sub?.plan || '1_month';
        const resolved = resolvePlan(planId);

        // Calculate profile completion percentage if not explicitly recorded
        const reqFields = [
          Boolean(m.name && String(m.name).trim()),
          Boolean(m.email && String(m.email).trim()),
          Boolean(m.phone && String(m.phone).trim()),
          Boolean((m.address || m.residential_address) && String(m.address || m.residential_address).trim()),
          Boolean((m.emergency_contact_name || m.emergency_contact) && String(m.emergency_contact_name || m.emergency_contact).trim()),
          Boolean((m.emergency_contact_phone || m.emergency_phone) && String(m.emergency_contact_phone || m.emergency_phone).trim()),
          Boolean((m.fitness_goal || m.primary_fitness_goal) && String(m.fitness_goal || m.primary_fitness_goal).trim())
        ];
        const compCount = reqFields.filter(Boolean).length;
        const completionPct = m.profile_completion_percentage !== undefined
          ? m.profile_completion_percentage
          : Math.round((compCount / reqFields.length) * 100);

        return {
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          status: m.status,
          membership_plan: planId,
          plan_name: resolved?.name || planId,
          membership_tier: m.membership_tier || resolved?.tier || sub?.tier || 'basic',
          rfid_card_uid: m.rfid_card_uid || (sub?.plan !== '1_day' ? 'KS-8829-4102' : null),
          branch_id: m.branch_id,
          branch_name: branch ? branch.name : 'Unknown',
          address: m.address || m.residential_address || '',
          residential_address: m.address || m.residential_address || '',
          emergency_contact_name: m.emergency_contact_name || m.emergency_contact || '',
          emergency_contact_phone: m.emergency_contact_phone || m.emergency_phone || '',
          emergency_contact_relationship: m.emergency_contact_relationship || '',
          emergency_contact: m.emergency_contact || m.emergency_contact_name || '',
          fitness_goal: m.fitness_goal || m.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
          primary_fitness_goal: m.fitness_goal || m.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
          profile_completion_percentage: completionPct,
          is_profile_complete: completionPct === 100,
          subscription: sub || null,
          total_check_ins: checkIns.length,
          created_at: m.created_at
        };
      });
    }

    const response = { success: true, members: enriched };
    if (limit) {
      response.pagination = { total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Get Single Member Details
async function getMemberById(req, res) {
  try {
    const { memberId } = req.params;
    const user = req.user;

    // RBAC IDOR check: member can only view themselves
    if (user.role === 'member' && user.id !== memberId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Members may only access their personal profile records.'
      });
    }

    const member = (memoryStore.users || []).find(u => u.id === memberId && u.role === 'member');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Branch Admin / Employee isolation check
    if (user.role !== 'super_admin' && user.role !== 'member' && user.branch_id !== member.branch_id) {
      return res.status(403).json({
        success: false,
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Cannot access member belonging to another franchise branch.'
      });
    }

    const subscription = (memoryStore.subscriptions || []).find(s => s.user_id === member.id);
    const branch = (memoryStore.branches || []).find(b => b.id === member.branch_id);
    const attendance = (memoryStore.attendance_logs || [])
      .filter(a => a.user_id === member.id)
      .sort((a, b) => new Date(b.check_in_time) - new Date(a.check_in_time));

    const reqFields = [
      Boolean(member.name && String(member.name).trim()),
      Boolean(member.email && String(member.email).trim()),
      Boolean(member.phone && String(member.phone).trim()),
      Boolean((member.address || member.residential_address) && String(member.address || member.residential_address).trim()),
      Boolean((member.emergency_contact_name || member.emergency_contact) && String(member.emergency_contact_name || member.emergency_contact).trim()),
      Boolean((member.emergency_contact_phone || member.emergency_phone) && String(member.emergency_contact_phone || member.emergency_phone).trim()),
      Boolean((member.fitness_goal || member.primary_fitness_goal) && String(member.fitness_goal || member.primary_fitness_goal).trim())
    ];
    const compCount = reqFields.filter(Boolean).length;
    const completionPct = member.profile_completion_percentage !== undefined
      ? member.profile_completion_percentage
      : Math.round((compCount / reqFields.length) * 100);

    res.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        membership_plan: member.membership_plan || subscription?.plan,
        membership_tier: member.membership_tier || subscription?.tier || 'basic',
        rfid_card_uid: member.rfid_card_uid,
        branch_id: member.branch_id,
        branch_name: branch ? branch.name : null,
        address: member.address || member.residential_address || '',
        residential_address: member.address || member.residential_address || '',
        emergency_contact_name: member.emergency_contact_name || member.emergency_contact || '',
        emergency_contact_phone: member.emergency_contact_phone || member.emergency_phone || '',
        emergency_contact_relationship: member.emergency_contact_relationship || '',
        emergency_contact: member.emergency_contact || member.emergency_contact_name || '',
        fitness_goal: member.fitness_goal || member.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
        primary_fitness_goal: member.fitness_goal || member.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy',
        profile_completion_percentage: completionPct,
        is_profile_complete: completionPct === 100,
        subscription,
        attendance_history: attendance.slice(0, 10)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Renew / Upgrade Subscription
async function renewSubscription(req, res) {
  try {
    const { memberId } = req.params;
    const { plan, planId, plan_id, tier, payment_method, paymentMethod, payment_channel } = req.body;
    const user = req.user;

    if (user.role === 'member' && user.id !== memberId) {
      return res.status(403).json({ success: false, message: 'Forbidden. Members may only renew their own subscription.' });
    }

    const member = (memoryStore.users || []).find(u => u.id === memberId && u.role === 'member');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Tenant Isolation Guard: Branch admins/staff can only renew members at their assigned facility
    if (user.role !== 'super_admin' && user.role !== 'member') {
      if (user.branch_id && member.branch_id && user.branch_id !== member.branch_id) {
        return res.status(403).json({
          success: false,
          error: 'TENANT_ISOLATION_VIOLATION',
          message: 'Access Denied: Cross-tenant subscription modification is strictly prohibited.'
        });
      }
    }

    // Unified Rate Card Resolution (accepts plan, planId, plan_id, or tier)
    const targetPlanId = plan || planId || plan_id || (tier && tier !== 'basic' && tier !== 'pro' && tier !== 'elite' ? tier : null) || '1_month';
    const resolvedPlan = resolvePlan(targetPlanId);
    const renewalPrice = resolvedPlan.planFee;
    const durationDays = resolvedPlan.durationDays;

    if (!memoryStore.subscriptions) memoryStore.subscriptions = [];
    const userSubs = memoryStore.subscriptions.filter(s => s.user_id === member.id);
    let sub = userSubs.find(s => s.status === 'active') || userSubs[userSubs.length - 1] || null;
    userSubs.forEach(s => {
      if (s !== sub) s.status = 'expired';
    });

    // Smart Early Renewal & Term Extension Logic: Math.max(now, current_expiration_date) + selectedPlanDays
    const now = Date.now();
    let baseTime = now;
    if (sub && sub.end_date) {
      const existingEnd = new Date(sub.end_date).getTime();
      if (!isNaN(existingEnd) && existingEnd > now) {
        baseTime = existingEnd;
      }
    }
    const newEndMs = baseTime + (durationDays * 24 * 3600 * 1000);
    const startDate = (sub && sub.start_date) ? new Date(sub.start_date) : new Date(now);
    const endDate = new Date(newEndMs);

    // Sync member tier, plan and status
    member.membership_tier = resolvedPlan.tier;
    member.membership_plan = resolvedPlan.id;
    member.status = 'active';

    if (resolvedPlan.id !== '1_day' && !member.rfid_card_uid) {
      member.rfid_card_uid = `KS-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (sub) {
      sub.plan = resolvedPlan.id;
      sub.tier = resolvedPlan.tier;
      sub.status = 'active';
      sub.start_date = startDate.toISOString().split('T')[0];
      sub.end_date = endDate.toISOString().split('T')[0];
      sub.price = renewalPrice;
      sub.total_paid = (sub.total_paid || 0) + renewalPrice;
    } else {
      sub = {
        id: crypto.randomUUID(),
        user_id: member.id,
        branch_id: member.branch_id,
        plan: resolvedPlan.id,
        tier: resolvedPlan.tier,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        price: renewalPrice,
        access_fee: 0,
        annual_fee: 0,
        total_paid: renewalPrice,
        auto_renew: member.auto_renew !== undefined ? member.auto_renew : true
      };
      memoryStore.subscriptions.push(sub);
    }

    // Synchronize class rosters so front desk & coaches immediately see upgraded tier
    if (Array.isArray(memoryStore.classes)) {
      memoryStore.classes.forEach(c => {
        (c.enrolled || []).forEach(e => {
          if (e.user_id === member.id || e.id === member.id) {
            e.tier = resolvedPlan.name;
          }
        });
      });
    }

    // Record sales transaction in the branch financial ledger
    const saleTxn = {
      id: crypto.randomUUID(),
      branch_id: member.branch_id,
      user_id: member.id,
      amount: renewalPrice,
      category: 'membership_fee',
      payment_method,
      reference_no: `TXN-RNW-${Date.now().toString().slice(-6)}`,
      created_at: new Date()
    };
    if (!memoryStore.sales) memoryStore.sales = [];
    memoryStore.sales.unshift(saleTxn);

    if (isPostgres()) {
      await query(
        `UPDATE users SET status = 'active', membership_plan = $1, updated_at = NOW() WHERE id = $2`,
        [resolvedPlan.id, member.id]
      );
      await query(
        `UPDATE subscriptions
         SET plan = $1, tier = $2, status = 'active', start_date = $3, end_date = $4, price = $5, total_paid = $6, updated_at = NOW()
         WHERE user_id = $7`,
        [resolvedPlan.id, resolvedPlan.tier, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], renewalPrice, renewalPrice, member.id]
      );
      await query(
        `INSERT INTO sales (id, branch_id, user_id, amount, category, payment_method, reference_no, created_at)
         VALUES ($1, $2, $3, $4, 'membership_fee', $5, $6, NOW())`,
        [saleTxn.id, member.branch_id, member.id, renewalPrice, payment_method, saleTxn.reference_no]
      );
    }

    await logAuditEvent({
      branch_id: member.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'SUBSCRIPTION_RENEWAL',
      resource: 'subscriptions',
      ip_address: req.ip || '127.0.0.1',
      details: { member_id: member.id, plan: resolvedPlan.id, tier: resolvedPlan.tier, price: renewalPrice, reference_no: saleTxn.reference_no }
    });

    res.json({
      success: true,
      message: `Subscription successfully renewed to ${resolvedPlan.name} (₱${renewalPrice.toLocaleString()}).`,
      subscription: sub,
      member: {
        id: member.id,
        name: member.name,
        membership_plan: member.membership_plan,
        membership_tier: member.membership_tier,
        rfid_card_uid: member.rfid_card_uid,
        status: member.status
      },
      sale: saleTxn
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Update Member Status (Active/Suspended)
async function updateMemberStatus(req, res) {
  try {
    const { memberId } = req.params;
    const { status } = req.body;
    const user = req.user;

    const member = memoryStore.users.find(u => u.id === memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (user.role !== 'super_admin' && user.branch_id !== member.branch_id) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation.' });
    }

    const oldStatus = member.status;
    member.status = status;

    await logAuditEvent({
      branch_id: member.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'MEMBER_STATUS_CHANGE',
      resource: 'users',
      ip_address: req.ip || '127.0.0.1',
      details: { member_id: member.id, previous: oldStatus, new: status }
    });

    res.json({ success: true, message: `Member status updated to ${status}.`, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Get Fitness & Weight Progress
async function getProgress(req, res) {
  try {
    const userId = req.user.id;
    const user = memoryStore.users.find(u => u.id === userId);
    if (!memoryStore.fitness_progress) {
      memoryStore.fitness_progress = [];
    }

    const userLogs = memoryStore.fitness_progress
      .filter(p => p.user_id === userId)
      .sort((a, b) => new Date(b.logged_at || b.created_at) - new Date(a.logged_at || a.created_at));

    const userPtClient = (memoryStore.pt_clients || []).find(c => c.client_id === userId || c.id === userId);
    const resolvedTargetWeight = user?.target_weight_kg || userPtClient?.target_weight_kg || null;

    // Pure real data: if user has no weight logs, return clean null baseline
    if (userLogs.length === 0) {
      return res.json({
        success: true,
        baseline: {
          member_since: user?.created_at || null,
          starting_weight: null,
          current_weight: null,
          overall_change: null,
          target_weight: resolvedTargetWeight,
          is_empty: true
        },
        progress: []
      });
    }

    // Chronological order (oldest first) to compute changes accurately
    const chronological = [...userLogs].sort((a, b) => new Date(a.logged_at || a.created_at) - new Date(b.logged_at || b.created_at));
    const startingWeight = chronological.length > 0 ? chronological[0].weight_kg : null;
    const currentWeight = chronological.length > 0 ? chronological[chronological.length - 1].weight_kg : null;
    const overallChange = (startingWeight !== null && currentWeight !== null)
      ? parseFloat((currentWeight - startingWeight).toFixed(2))
      : null;

    // Calculate delta since previous weigh-in for each log
    const enrichedLogs = userLogs.map((log) => {
      const idxInChrono = chronological.findIndex(c => c.id === log.id);
      let deltaSinceLast = 0;
      if (idxInChrono > 0) {
        deltaSinceLast = parseFloat((log.weight_kg - chronological[idxInChrono - 1].weight_kg).toFixed(2));
      }
      return {
        id: log.id,
        weight_kg: log.weight_kg,
        notes: log.notes || 'Routine Progress Check',
        logged_at: log.logged_at || log.created_at,
        delta: deltaSinceLast
      };
    });

    res.json({
      success: true,
      baseline: {
        member_since: user?.created_at || null,
        starting_weight: startingWeight,
        current_weight: currentWeight,
        overall_change: overallChange,
        target_weight: resolvedTargetWeight,
        is_empty: false
      },
      progress: enrichedLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Log New Weight Entry (Strictly Validated: 30.0 kg - 250.0 kg, No Future Dates)
async function logProgress(req, res) {
  try {
    const userId = req.user.id;
    const { weight_kg, weight, notes, logged_at, date } = req.body;
    const finalWeight = parseFloat(weight_kg || weight);

    if (isNaN(finalWeight) || finalWeight < 30.0 || finalWeight > 250.0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WEIGHT_RANGE',
        message: 'Weight entry must be a valid number between 30.0 kg and 250.0 kg.'
      });
    }

    const entryDate = (logged_at || date) ? new Date(logged_at || date) : new Date();
    if (isNaN(entryDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATE',
        message: 'Please provide a valid date.'
      });
    }

    const now = new Date();
    // Allow up to current moment plus 5 minutes buffer for slight clock skew
    if (entryDate.getTime() > now.getTime() + 300000) {
      return res.status(400).json({
        success: false,
        error: 'FUTURE_DATE_NOT_ALLOWED',
        message: 'You cannot log biometric weigh-ins for a future date.'
      });
    }

    if (!memoryStore.fitness_progress) {
      memoryStore.fitness_progress = [];
    }

    const { savePersistentStoreSync } = require('../config/db');

    const newEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      weight_kg: parseFloat(finalWeight.toFixed(1)),
      notes: (notes || '').trim() || 'Biometric weigh-in log',
      logged_at: entryDate.toISOString(),
      created_at: new Date().toISOString()
    };

    memoryStore.fitness_progress.unshift(newEntry);

    // Synchronize logged weight to PT client roster and user record in real-time
    if (memoryStore.pt_clients) {
      memoryStore.pt_clients.forEach(c => {
        if (c.client_id === userId || c.id === userId) {
          c.current_weight_kg = newEntry.weight_kg;
          if (req.body.target_weight_kg) {
            const parsedTarget = parseFloat(req.body.target_weight_kg);
            if (!isNaN(parsedTarget) && parsedTarget >= 30.0 && parsedTarget <= 250.0) {
              c.target_weight_kg = parseFloat(parsedTarget.toFixed(1));
            }
          }
          c.updated_at = new Date();
        }
      });
    }
    const memberUser = (memoryStore.users || []).find(u => u.id === userId);
    if (memberUser) {
      memberUser.current_weight_kg = newEntry.weight_kg;
      if (req.body.target_weight_kg) {
        const parsedTarget = parseFloat(req.body.target_weight_kg);
        if (!isNaN(parsedTarget) && parsedTarget >= 30.0 && parsedTarget <= 250.0) {
          memberUser.target_weight_kg = parseFloat(parsedTarget.toFixed(1));
        }
      }
    }

    if (typeof savePersistentStoreSync === 'function') {
      savePersistentStoreSync();
    }

    res.json({
      success: true,
      message: `Weight entry of ${newEntry.weight_kg} kg recorded successfully.`,
      entry: newEntry
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6b. Update Member Goal / Target Weight
async function updateTargetWeight(req, res) {
  try {
    const userId = req.user.id;
    const { target_weight_kg, target_weight } = req.body;
    const finalTarget = parseFloat(target_weight_kg || target_weight);
    if (isNaN(finalTarget) || finalTarget < 30.0 || finalTarget > 250.0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TARGET_WEIGHT',
        message: 'Target weight must be a valid number between 30.0 kg and 250.0 kg.'
      });
    }

    const { savePersistentStoreSync } = require('../config/db');
    const memberUser = (memoryStore.users || []).find(u => u.id === userId);
    if (memberUser) {
      memberUser.target_weight_kg = parseFloat(finalTarget.toFixed(1));
    }

    if (memoryStore.pt_clients) {
      memoryStore.pt_clients.forEach(c => {
        if (c.client_id === userId || c.id === userId) {
          c.target_weight_kg = parseFloat(finalTarget.toFixed(1));
          c.updated_at = new Date();
        }
      });
    }

    if (typeof savePersistentStoreSync === 'function') {
      savePersistentStoreSync();
    }

    res.json({
      success: true,
      message: `Target goal weight updated to ${finalTarget.toFixed(1)} kg.`,
      target_weight_kg: parseFloat(finalTarget.toFixed(1))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Get Member Strength PRs & Epley 1RM Milestones
async function getStrengthPRs(req, res) {
  try {
    const userId = req.user.id;
    if (!memoryStore.strength_prs) memoryStore.strength_prs = [];

    const userPRs = memoryStore.strength_prs.filter(p => p.user_id === userId);

    const getBestFor = (terms) => {
      const matches = userPRs.filter(p => terms.some(t => p.exercise.toLowerCase().includes(t.toLowerCase())));
      if (matches.length === 0) return { weight_kg: 0, reps: 0, estimated_1rm: 0, exercise: terms[0], date: null };
      return matches.reduce((best, cur) => cur.estimated_1rm > best.estimated_1rm ? cur : best, matches[0]);
    };

    const bestSquat = getBestFor(['Barbell Back Squat', 'Squat']);
    const bestDeadlift = getBestFor(['Deadlift (Conventional)', 'Deadlift (Sumo)', 'Deadlift']);
    const bestBench = getBestFor(['Barbell Bench Press', 'Bench Press', 'Bench']);
    const bestOHP = getBestFor(['Overhead Strict Press', 'Overhead Press', 'OHP', 'Shoulder Press']);

    const big3Total = Math.round((bestSquat.estimated_1rm + bestDeadlift.estimated_1rm + bestBench.estimated_1rm) * 10) / 10;

    const clubs = [
      {
        id: 'club_300',
        name: 'KSYN 300kg Club',
        tier: 'Bronze Athlete',
        threshold: 300,
        unlocked: big3Total >= 300,
        color: '#f59e0b',
        progress: Math.min(100, Math.round((big3Total / 300) * 100))
      },
      {
        id: 'club_400',
        name: 'KSYN 400kg Club',
        tier: 'Silver Master',
        threshold: 400,
        unlocked: big3Total >= 400,
        color: '#38bdf8',
        progress: Math.min(100, Math.round((big3Total / 400) * 100))
      },
      {
        id: 'club_500',
        name: 'KSYN 500kg Club',
        tier: 'Obsidian Gold Elite',
        threshold: 500,
        unlocked: big3Total >= 500,
        color: '#f5c518',
        progress: Math.min(100, Math.round((big3Total / 500) * 100))
      }
    ];

    res.json({
      success: true,
      prs: userPRs,
      best_lifts: {
        squat: bestSquat,
        deadlift: bestDeadlift,
        bench: bestBench,
        ohp: bestOHP
      },
      big3_total: big3Total,
      clubs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Log New Strength Personal Record (PR) with Epley 1RM
async function logStrengthPR(req, res) {
  try {
    const userId = req.user.id;
    const { exercise, weight_kg, reps = 1, notes = '' } = req.body;

    const w = parseFloat(weight_kg);
    const r = parseInt(reps, 10);

    if (isNaN(w) || w <= 0 || w > 600) {
      return res.status(400).json({ success: false, message: 'Valid weight (1-600 kg) is required.' });
    }
    if (isNaN(r) || r < 1 || r > 30) {
      return res.status(400).json({ success: false, message: 'Valid repetition count (1-30 reps) is required.' });
    }
    if (!exercise || !exercise.trim()) {
      return res.status(400).json({ success: false, message: 'Exercise name is required.' });
    }

    // Epley Formula: 1RM = Weight * (1 + Reps / 30)
    const estimated1RM = r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;

    if (!memoryStore.strength_prs) memoryStore.strength_prs = [];

    const newPR = {
      id: crypto.randomUUID(),
      user_id: userId,
      exercise: exercise.trim(),
      weight_kg: w,
      reps: r,
      estimated_1rm: estimated1RM,
      logged_at: new Date(),
      notes: (notes || '').trim()
    };

    memoryStore.strength_prs.unshift(newPR);

    res.status(201).json({
      success: true,
      message: `Personal Record logged! Estimated 1RM: ${estimated1RM} kg.`,
      pr: newPR
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 9. Get Member Direct Coach Messages
async function getMemberMessages(req, res) {
  try {
    const userId = req.user.id;
    if (!memoryStore.coach_messages) memoryStore.coach_messages = [];

    const messages = memoryStore.coach_messages
      .filter(m => m.sender_id === userId || m.recipient_id === userId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Mark incoming messages as read
    messages.forEach(m => {
      if (m.recipient_id === userId) m.is_read = true;
    });

    let ptRecord = (memoryStore.pt_clients || []).find(c => (c.client_id === userId || c.id === userId) && c.status === 'Active');
    let coachUser = ptRecord ? (memoryStore.users || []).find(u => u.id === ptRecord.coach_id) : null;

    if (!coachUser) {
      const clearedEnrollment = (memoryStore.pt_enrollments || []).find(e => (e.member_id === userId || e.user_id === userId) && (e.enrollment_status === 'CLEARED' || e.is_cleared));
      if (clearedEnrollment) {
        coachUser = (memoryStore.users || []).find(u => u.id === clearedEnrollment.coach_id);
      }
    }
    if (!coachUser && req.user.coach_id) {
      coachUser = (memoryStore.users || []).find(u => u.id === req.user.coach_id);
    }

    // Attach avatar to messages
    messages.forEach(m => {
      if (m.sender_role === 'coach' && coachUser) {
        m.sender_avatar = coachUser.avatar_url || coachUser.profile_image || null;
      }
    });

    const is_coach_typing = coachUser ? chatService.isTyping(coachUser.id, userId) : false;

    res.json({
      success: true,
      messages,
      is_coach_typing,
      coach: coachUser ? {
        id: coachUser.id,
        name: coachUser.name,
        role: coachUser.role || 'Head Coach & Personal Trainer',
        specialty: coachUser.specialty || coachUser.coach_specialty || 'Head Coach & Personal Trainer',
        email: coachUser.email,
        avatar_url: coachUser.avatar_url || coachUser.profile_image || null,
        profile_image: coachUser.profile_image || coachUser.avatar_url || null
      } : null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 10. Send Member Message to Coach
async function sendMemberMessage(req, res) {
  try {
    const user = req.user;
    const { content, tag = 'Athlete Check-In' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be blank.' });
    }

    if (!memoryStore.coach_messages) memoryStore.coach_messages = [];

    let ptRecord = (memoryStore.pt_clients || []).find(c => (c.client_id === user.id || c.id === user.id) && c.status === 'Active');
    let coachId = ptRecord ? ptRecord.coach_id : null;
    let coachUser = coachId ? (memoryStore.users || []).find(u => u.id === coachId) : null;

    if (!coachUser) {
      const clearedEnrollment = (memoryStore.pt_enrollments || []).find(e => (e.member_id === user.id || e.user_id === user.id) && (e.enrollment_status === 'CLEARED' || e.is_cleared));
      if (clearedEnrollment) {
        coachId = clearedEnrollment.coach_id;
        coachUser = (memoryStore.users || []).find(u => u.id === coachId);
      }
    }
    if (!coachUser && user.coach_id) {
      coachId = user.coach_id;
      coachUser = (memoryStore.users || []).find(u => u.id === coachId);
    }

    if (!coachUser) {
      return res.status(403).json({
        success: false,
        message: 'No active Coach or Personal Trainer (PT) package found for your account. Please avail a Coach package to send messages.'
      });
    }

    const newMsg = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      sender_name: user.name,
      sender_role: 'member',
      sender_avatar: user.avatar_url || user.profile_image || null,
      recipient_id: coachId,
      recipient_name: coachUser.name,
      content: content.trim(),
      tag: tag || 'Athlete Check-In',
      created_at: new Date(),
      is_read: false
    };

    memoryStore.coach_messages.push(newMsg);
    chatService.clearTyping(user.id, coachId);

    res.status(201).json({
      success: true,
      message: 'Message sent to coach.',
      data: newMsg
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Set Member Typing Status
async function setMemberTyping(req, res) {
  try {
    const user = req.user;
    const { typing, coach_id } = req.body;
    let coachId = coach_id;
    if (!coachId) {
      const ptRecord = (memoryStore.pt_clients || []).find(c => (c.client_id === user.id || c.id === user.id) && c.status === 'Active');
      coachId = ptRecord?.coach_id;
    }
    if (coachId) {
      chatService.setTyping(user.id, coachId, Boolean(typing));
    }
    res.json({ success: true, typing: Boolean(typing) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 11. Get Member Workout Routine Program
async function getMemberWorkoutPlans(req, res) {
  try {
    const user = req.user;
    if (!memoryStore.workout_plans) {
      memoryStore.workout_plans = [];
    }

    let plans = memoryStore.workout_plans || [];
    if (user.role === 'member') {
      const uName = (user.name || '').toLowerCase().trim();
      plans = plans.filter(p => 
        p.client_id === user.id || 
        p.member_id === user.id || 
        (p.client_name && uName && (p.client_name.toLowerCase().trim() === uName || uName.includes(p.client_name.toLowerCase().trim()) || p.client_name.toLowerCase().trim().includes(uName))) ||
        (p.member_name && uName && (p.member_name.toLowerCase().trim() === uName || uName.includes(p.member_name.toLowerCase().trim())))
      );
    }
    // Normalize exercises array so member portal can render either exercises or days format
    plans = plans.map(p => {
      let exs = p.exercises;
      if (!exs && Array.isArray(p.days)) {
        exs = p.days.flatMap((d, dIdx) => (d.exercises || []).map((e, idx) => ({
          id: `ex-${dIdx}-${idx}`,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          target_weight: e.target_weight || 'Bodyweight',
          rest_seconds: 90,
          completed: false,
          notes: d.day || ''
        })));
      }
      return { ...p, exercises: exs || [] };
    });

    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, plans: [] });
  }
}

// 12. Toggle Workout Exercise Complete
async function toggleExerciseComplete(req, res) {
  try {
    const { planId } = req.params;
    const { exerciseId, exerciseIndex, completed } = req.body;

    const plan = (memoryStore.workout_plans || []).find(p => p.id === planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Workout plan not found.' });
    }

    let ex = null;
    if (exerciseId) {
      ex = (plan.exercises || []).find(e => e.id === exerciseId);
    } else if (exerciseIndex !== undefined) {
      ex = plan.exercises?.[exerciseIndex];
    }

    if (!ex) {
      return res.status(404).json({ success: false, message: 'Exercise not found in plan.' });
    }

    ex.completed = typeof completed === 'boolean' ? completed : !ex.completed;

    res.json({ success: true, message: 'Exercise status updated.', exercise: ex, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 13. Live Gym Floor Density & Occupancy Telemetry
async function getFloorDensity(req, res) {
  try {
    const user = req.user;
    const targetBranchId = user.branch_id || 'b-mkt-01';
    const branch = (memoryStore.branches || []).find(b => b.id === targetBranchId) || memoryStore.branches[0];

    const branchCapacities = {
      'b-mkt-01': 120, // Makati Flagship
      'b-kat-02': 90,
      'b-alb-03': 85,
      'b-kap-04': 75,
      'b-frv-05': 80,
      'b-dlm-06': 70,
      'b-tmo-07': 90
    };
    const maxCapacity = branchCapacities[targetBranchId] || 100;

    const ninetyMinsAgo = new Date(Date.now() - 90 * 60 * 1000);
    const recentCheckins = (memoryStore.attendance_logs || []).filter(log => {
      const isThisBranch = log.branch_id === targetBranchId || (!log.branch_id && targetBranchId === 'b-mkt-01');
      const isRecent = new Date(log.check_in_time) >= ninetyMinsAgo;
      return isThisBranch && isRecent;
    });

    const distinctUsers = new Set(recentCheckins.map(l => l.user_id)).size;
    const currentOccupancy = Math.min(maxCapacity, distinctUsers);
    const occupancyPercentage = maxCapacity > 0 ? Math.round((currentOccupancy / maxCapacity) * 100) : 0;

    let status = 'OPTIMAL_FLOW';
    let statusLabel = 'Optimal Flow';
    let badgeColor = '#10b981';

    if (occupancyPercentage < 40) {
      status = 'LOW_DENSITY';
      statusLabel = 'Low Density';
      badgeColor = '#10b981';
    } else if (occupancyPercentage >= 75) {
      status = 'PEAK_RUSH';
      statusLabel = 'Peak Rush Hour';
      badgeColor = '#ef4444';
    } else {
      status = 'MODERATE_FLOW';
      statusLabel = 'Moderate Flow';
      badgeColor = '#f5c518';
    }

    const hourlyForecast = [
      { hour: '06:00 AM', density: 'Low', pct: 25 },
      { hour: '08:00 AM', density: 'Moderate', pct: 55 },
      { hour: '12:00 PM', density: 'Moderate', pct: 50 },
      { hour: '03:00 PM', density: 'Low', pct: 30 },
      { hour: '05:30 PM', density: 'Peak', pct: 85 },
      { hour: '07:30 PM', density: 'Peak', pct: 80 },
      { hour: '09:00 PM', density: 'Moderate', pct: 45 }
    ];

    // Single source of truth for Metro Manila Club Occupancy & Crowd Radar
    const networkRadar = [
      {
        code: 'MKT-01',
        name: 'Makati Flagship',
        branch_id: 'b-mkt-01',
        athletes: targetBranchId === 'b-mkt-01' ? currentOccupancy : 48,
        max: branchCapacities['b-mkt-01'] || 120,
        status: (targetBranchId === 'b-mkt-01' ? occupancyPercentage : 40) >= 75 ? 'Peak Flow' : (targetBranchId === 'b-mkt-01' ? occupancyPercentage : 40) >= 40 ? 'Moderate Flow' : 'Optimal Flow',
        color: (targetBranchId === 'b-mkt-01' ? occupancyPercentage : 40) >= 75 ? '#ef4444' : (targetBranchId === 'b-mkt-01' ? occupancyPercentage : 40) >= 40 ? '#f5c518' : '#10b981'
      },
      {
        code: 'KAT-02',
        name: 'Katipunan',
        branch_id: 'b-kat-02',
        athletes: targetBranchId === 'b-kat-02' ? currentOccupancy : 54,
        max: branchCapacities['b-kat-02'] || 90,
        status: 'Peak Flow',
        color: '#f5c518'
      },
      {
        code: 'ALB-03',
        name: 'Alabang',
        branch_id: 'b-alb-03',
        athletes: targetBranchId === 'b-alb-03' ? currentOccupancy : 28,
        max: branchCapacities['b-alb-03'] || 85,
        status: 'Optimal Flow',
        color: '#10b981'
      },
      {
        code: 'FRV-05',
        name: 'Fairview',
        branch_id: 'b-frv-05',
        athletes: targetBranchId === 'b-frv-05' ? currentOccupancy : 22,
        max: branchCapacities['b-frv-05'] || 80,
        status: 'Optimal Flow',
        color: '#10b981'
      }
    ];

    res.json({
      success: true,
      branch_id: targetBranchId,
      branch_name: branch?.name || 'KSYN Fitness Club',
      current_occupancy: currentOccupancy,
      max_capacity: maxCapacity,
      percentage: occupancyPercentage,
      occupancy_pct: occupancyPercentage,
      status,
      status_label: statusLabel,
      badge_color: badgeColor,
      hourly_forecast: hourlyForecast,
      network_radar: networkRadar,
      last_updated: new Date()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 13. Interactive Auto-Debit Opt-in/Opt-out Toggle
async function toggleAutoRenew(req, res) {
  try {
    const user = req.user;
    const { autoRenew } = req.body;
    const enabled = Boolean(autoRenew);

    const member = memoryStore.users.find(u => u.id === user.id);
    if (member) {
      member.auto_renew = enabled;
    }

    const sub = memoryStore.subscriptions.find(s => s.user_id === user.id);
    if (sub) {
      sub.auto_renew = enabled;
    }

    if (isPostgres()) {
      await query(
        `UPDATE subscriptions SET auto_renew = $1, updated_at = NOW() WHERE user_id = $2`,
        [enabled, user.id]
      ).catch(() => {});
      await query(
        `UPDATE users SET auto_renew = $1 WHERE id = $2`,
        [enabled, user.id]
      ).catch(() => {});
    }

    saveStore();

    await logAuditEvent({
      branch_id: user.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'AUTO_RENEW_TOGGLE',
      resource: 'subscriptions',
      ip_address: req.ip || '127.0.0.1',
      details: { auto_renew: enabled }
    });

    res.json({
      success: true,
      auto_renew: enabled,
      message: `Auto-debit recurring renewal has been ${enabled ? 'enabled' : 'disabled'}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 14. Get Available Coaches for Enrollment
async function getAvailableCoaches(req, res) {
  try {
    const defaultDetails = {
      'coach.sofia@ksyn.com': {
        specialties: [
          'Weight Loss & Fat Reduction',
          'Caloric Burn & Metabolic Conditioning',
          'Body Recomposition & Caloric Deficit',
          'Sustainable Lifestyle & Nutrition Habits',
          'Cardiorespiratory Conditioning'
        ],
        certifications: ['Certified Weight Loss Specialist (NASM-WLS)', 'CSCS Certified', 'Precision Nutrition (Pn1)', 'CPR/AED Certified'],
        bio: 'Lead Weight Loss & Metabolic Conditioning Specialist • 8+ Years Experience in Caloric Expenditure & Body Transformation',
        experience_years: 8
      },
      'coach.marcus@ksyn.com': {
        specialties: ['Metabolic Conditioning', 'Kettlebell Athletics', 'Turf Sprints', 'Athletic Performance', 'HIIT'],
        certifications: ['NASM-CPT', 'CrossFit Level 2', 'CPR/AED Certified'],
        bio: 'Metcon & Athletic Conditioning Lead • 6+ Years Experience',
        experience_years: 6
      },
      'coach.valerie@ksyn.com': {
        specialties: [
          'Medical Fitness & Health Conditions',
          'Hypertension & Diabetes Exercise Care',
          'Joint Recovery & Post-Rehab Mobility',
          'Low-Impact Cardiac Conditioning',
          'Corrective Movement Screening (FMS)'
        ],
        certifications: ['Clinical Exercise Physiologist (ACSM-CEP)', 'Medical Exercise Specialist (MES)', 'ACE Certified Health Coach', 'CPR/AED Certified'],
        bio: 'Clinical Health & Medical Exercise Specialist • 7+ Years Experience working with members managing chronic conditions (hypertension, diabetes), joint recovery, and mobility.',
        experience_years: 7
      },
      'coach.diego@ksyn.com': {
        specialties: ['Combat Boxing & Striking', 'Heavy Bag Conditioning', 'Power Generation', 'Core Stability', 'Footwork'],
        certifications: ['USA Boxing Certified', 'Muay Thai Specialist', 'CPR/AED Certified'],
        bio: 'Combat & Boxing Performance Coach • 7+ Years Experience',
        experience_years: 7
      },
      'coach.camille@ksyn.com': {
        specialties: [
          'Weight Loss & Fat Reduction',
          'Caloric Burn & Metabolic Conditioning',
          'Body Recomposition & Caloric Deficit',
          'Sustainable Lifestyle & Nutrition Habits',
          'Cardiorespiratory Conditioning'
        ],
        certifications: ['Certified Weight Loss Specialist (NASM-WLS)', 'Precision Nutrition (Pn1)', 'CPR/AED Certified'],
        bio: 'Lead Weight Loss & Caloric Transformation Specialist (Fairview) • 7+ Years Experience in Caloric Expenditure & Body Recomposition',
        experience_years: 7
      },
      'coach.brandon@ksyn.com': {
        specialties: [
          'Medical Fitness & Health Conditions',
          'Hypertension & Diabetes Exercise Care',
          'Joint Recovery & Post-Rehab Mobility',
          'Low-Impact Cardiac Conditioning',
          'Corrective Movement Screening (FMS)'
        ],
        certifications: ['Clinical Exercise Physiologist (ACSM-CEP)', 'Medical Exercise Specialist (MES)', 'ACE Certified Health Coach', 'CPR/AED Certified'],
        bio: 'Clinical Health & Medical Exercise Specialist (Fairview) • 8+ Years Experience working with members managing chronic health conditions (hypertension, diabetes), joint recovery, and cardiac safety.',
        experience_years: 8
      },
      'coach.ryan@ksyn.com': {
        specialties: ['Hypertrophy & Muscle Building', 'Powerlifting Splits', 'Olympic Lifting', 'Posture Assessment', 'Metabolic Conditioning'],
        certifications: ['NASM-CPT', 'CSCS Certified', 'CPR/AED Certified'],
        bio: 'Hypertrophy & Biomechanics Coach (Fairview) • 6+ Years Experience in Functional Overload & Turf Athletics',
        experience_years: 6
      }
    };

    const coaches = (memoryStore.users || [])
      .filter(u => u.role === 'coach' || u.role === 'trainer')
      .map(c => {
        const activeClients = (memoryStore.pt_clients || []).filter(p => p.coach_id === c.id);
        const branchObj = (memoryStore.branches || []).find(b => b.id === c.branch_id);
        const details = defaultDetails[c.email] || {
          specialties: ['General Strength', 'Hypertrophy', 'Cardiovascular Fitness', 'Flexibility'],
          certifications: ['Certified Personal Trainer (CPT)', 'CPR/AED Certified'],
          bio: `${c.name} • Certified Personal Trainer`,
          experience_years: 4
        };

        return {
          id: c.id,
          name: c.name,
          role: 'Head Coach & Personal Trainer',
          email: c.email,
          avatar_url: c.avatar_url || c.profile_image || details.avatar_url || null,
          branch_id: c.branch_id,
          branch_name: branchObj?.name || 'KSYN Fitness Makati Flagship',
          specialties: (Array.isArray(c.specialties) && c.specialties.length > 0) ? c.specialties : details.specialties,
          certifications: details.certifications,
          bio: c.bio || details.bio,
          experience_years: c.experience_years || details.experience_years,
          active_athletes_count: activeClients.length,
          packages: [
            {
              id: 'pt-1',
              name: 'Single 1-on-1 Session / Assessment',
              sessions: 1,
              session_rate: 500,
              total_price: 500,
              desc: 'Trial assessment, baseline kinetic evaluation, and guided workout (~₱500 to ₱1,100 per session depending on trainer tier).'
            },
            {
              id: 'pt-12',
              name: '12-Session Signature PT Package',
              sessions: 12,
              session_rate: 500,
              total_price: 6000,
              desc: 'Comprehensive 12-session coaching bundle (₱500/session) with custom periodized split and direct app messaging.'
            },
            {
              id: 'pt-16',
              name: '16-Session Transformation Package',
              sessions: 16,
              session_rate: 468.75,
              total_price: 7500,
              desc: 'Best-value bundle lowering session cost down to ~₱470/session (₱7,500 total) with nutrition guidance and body recomposition tracking.'
            }
          ]
        };
      });

    res.json({ success: true, coaches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, coaches: [] });
  }
}

// 15. Initiate 1-on-1 PT Enrollment (Payment Routing & Front Desk Verification Queue)
async function initiatePtEnrollment(req, res) {
  try {
    const user = req.user;
    const {
      coach_id,
      package_id,
      package_plan,
      sessions_total,
      goal = 'Hypertrophy & Conditioning',
      preferred_date,
      preferred_time_slot,
      payment_channel = 'online_xendit', // 'online_xendit' | 'counter_cash'
      payment_method_detail = 'gcash' // 'gcash', 'card', 'qr_ph', 'cash'
    } = req.body;

    const sessionDate = preferred_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const sessionTimeSlot = preferred_time_slot || '09:00 AM – 10:00 AM';

    const todayIsoStr = new Date().toISOString().split('T')[0];
    if (sessionDate < todayIsoStr) {
      return res.status(400).json({ success: false, message: 'Preferred session date cannot be in the past. Please select a current or upcoming date.' });
    }

    if (!coach_id) {
      return res.status(400).json({ success: false, message: 'Please select a coach to enroll.' });
    }

    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];

    // Strict Restriction: Check if member already has an active PT contract/package in progress
    const existingActive = (memoryStore.pt_clients || []).find(c => 
      (c.client_id === user.id || c.id === user.id || (c.email && c.email.toLowerCase() === (user.email || '').toLowerCase())) && 
      (c.status === 'Active' || c.status === 'active') &&
      ((c.sessions_total || 12) - (c.sessions_completed || 0) > 0)
    ) || (memoryStore.pt_enrollments || []).find(e =>
      (e.member_id === user.id || e.user_id === user.id || (e.member_email && e.member_email.toLowerCase() === (user.email || '').toLowerCase())) &&
      ['CLEARED', 'CLEARED_ACTIVE', 'Active', 'active'].includes(e.enrollment_status) &&
      !e.is_concluded &&
      ((e.sessions_total || 12) - (e.sessions_completed || 0) > 0)
    );

    if (existingActive) {
      const coachUser = (memoryStore.users || []).find(u => u.id === existingActive.coach_id);
      const coachDisplayName = (coachUser?.name || 'Personal Trainer').replace(/^Coach\s+/i, '');
      return res.status(400).json({
        success: false,
        code: 'ACTIVE_PT_EXISTS',
        message: `You currently have an active Personal Trainer (PT) plan in progress with Coach ${coachDisplayName}. You are restricted from booking another package until your current sessions are completed.`
      });
    }

    // Check if member already has a pending enrollment in queue
    const pendingIndex = memoryStore.pt_enrollments.findIndex(e => e.member_id === user.id && (e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE' || e.clearance_status === 'AWAITING_PAYMENT'));
    if (pendingIndex !== -1 && !req.body.replacePending && !req.path.includes('enroll-checkout')) {
      return res.json({
        success: true,
        message: 'You already have an incoming PT enrollment in the front-desk queue.',
        enrollment: memoryStore.pt_enrollments[pendingIndex],
        external_id: memoryStore.pt_enrollments[pendingIndex].xendit_external_id || memoryStore.pt_enrollments[pendingIndex].payment_reference
      });
    }
    if (pendingIndex !== -1) {
      memoryStore.pt_enrollments.splice(pendingIndex, 1);
    }

    const targetCoach = (memoryStore.users || []).find(u => u.id === coach_id && (u.role === 'coach' || u.role === 'trainer'));
    if (!targetCoach) {
      return res.status(404).json({ success: false, message: 'Selected coach not found in facility directory.' });
    }

    // Strict ROTA Schedule Validation: Ensure coach is on-duty on ROTA for the chosen date/day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const sessionDayIndex = new Date(sessionDate).getDay();
    const dayName = dayNames[sessionDayIndex];

    const rotaEntry = (memoryStore.floor_rota || []).find(r => 
      (r.staff_id === targetCoach.id) ||
      (r.coach_name && targetCoach.name && (
        r.coach_name.toLowerCase().includes(targetCoach.name.toLowerCase()) ||
        targetCoach.name.toLowerCase().includes(r.coach_name.toLowerCase())
      ))
    );

    if (rotaEntry) {
      const scheduledShift = rotaEntry[dayName];
      const isOffDuty = !scheduledShift || 
        scheduledShift.toLowerCase().includes('off') || 
        scheduledShift.toLowerCase().includes('rest');

      if (isOffDuty) {
        return res.status(400).json({
          success: false,
          error: 'COACH_UNAVAILABLE_ON_ROTA',
          message: `Booking blocked: Coach ${targetCoach.name.replace(/^Coach\s+/i, '')} is off-duty on ${dayName.toUpperCase()}s on the club Floor Duty Rota. Please pick a date when this coach is on-duty.`
        });
      }
    }

    // Resolve sessions and package details
    let totalSessions = Number(sessions_total) || 12;
    if (package_id === 'pt-16' || (package_plan && package_plan.includes('16'))) {
      totalSessions = 16;
    } else if (package_id === 'pt-10' || (package_plan && package_plan.includes('10'))) {
      totalSessions = 10;
    } else if (package_id === 'pt-single' || (package_plan && package_plan.includes('Single'))) {
      totalSessions = 1;
    } else {
      totalSessions = 12;
    }

    let rate = 500;
    let totalPrice = 6000;
    let resolvedPackageName = '12-Session Signature PT Package (₱6,000)';

    if (totalSessions === 16) {
      rate = 468.75;
      totalPrice = 7500;
      resolvedPackageName = '16-Session Transformation Package (₱7,500)';
    } else if (totalSessions === 10) {
      rate = 800;
      totalPrice = 8000;
      resolvedPackageName = '10-Session Performance Bundle (₱8,000)';
    } else if (totalSessions === 1) {
      rate = 500;
      totalPrice = 500;
      resolvedPackageName = 'Single 1-on-1 Session (~₱500)';
    }

    const isOnline = payment_channel === 'online_xendit';
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();

    const targetBranchId = targetCoach.branch_id || user.branch_id || 'b-mkt-01';
    const targetBranchObj = (memoryStore.branches || []).find(b => b.id === targetBranchId);
    const targetBranchName = targetBranchObj?.name || user.branch_name || targetCoach.branch_name || 'KSYN Fitness';
    const branchCode = getBranchCode(targetBranchObj?.code || targetBranchId);

    // Enforce Online Portal Nomenclature: PT-OL-[BRANCH_CODE]-[TIMESTAMP]-[RANDOM_HASH]
    // Example: PT-OL-MKT-1793212374-4a1c
    const externalId = generateExternalId('PT-OL', branchCode);
    const invoiceDescription = formatStreamDescription('PT', {
      packageName: package_plan || resolvedPackageName,
      coachName: targetCoach.name
    });

    let xenditInvoice = null;
    if (isOnline) {
      const clientOrigin = req.headers.origin || process.env.CORS_ORIGIN || 'http://localhost:5180';
      const xenditService = require('../services/xenditService');
      try {
        xenditInvoice = await xenditService.createInvoice({
          externalId,
          amount: totalPrice,
          payerEmail: user.email || 'member@ksynfitness.com',
          customerName: user.name || 'Valued Athlete',
          customerPhone: user.phone || '+639171234567',
          description: invoiceDescription,
          successRedirectUrl: `${clientOrigin}/dashboard/member?payment_status=success&enrollment_type=pt&external_id=${externalId}`,
          failureRedirectUrl: `${clientOrigin}/dashboard/member?payment_status=failed&enrollment_type=pt`,
          items: [
            {
              name: `PT Package: ${package_plan || resolvedPackageName} (${targetCoach.name})`,
              quantity: 1,
              price: totalPrice,
              category: 'Personal Training'
            }
          ],
          metadata: {
            stream: 'PT',
            type: 'pt_enrollment',
            channel: 'PT ENROLLMENT',
            category: 'pt_enrollment',
            user_id: user.id,
            coach_id: targetCoach.id,
            coach_name: targetCoach.name,
            package_id: package_id || `pt-${totalSessions}`,
            sessions_total: totalSessions,
            preferred_date: sessionDate,
            preferred_time_slot: sessionTimeSlot,
            coach_confirmation_status: 'PENDING_COACH_CONFIRMATION',
            branch_id: targetBranchId,
            external_id: externalId
          }
        });
      } catch (xErr) {
        console.error('[XENDIT PT INVOICE ERROR]:', xErr);
        return res.status(502).json({
          success: false,
          gateway_error: true,
          message: 'Failed to create Xendit invoice for PT Enrollment. Please check connection or try again.'
        });
      }
    }

    const coachCommissionRate = 15.00;
    const coachPayoutAmount = Number((totalPrice * 0.15).toFixed(2));
    const gymRetainedAmount = Number((totalPrice * 0.85).toFixed(2));

    const newEnrollment = {
      id: `pte-${Date.now()}-${randSuffix}`,
      member_id: user.id,
      member_name: user.name,
      member_email: user.email,
      branch_id: targetBranchId,
      branch_name: targetBranchName,
      coach_id: targetCoach.id,
      coach_name: targetCoach.name,
      coach_specialty: targetCoach.specialty || targetCoach.coach_specialty || 'Strength & Conditioning',
      package_id: package_id || `pt-${totalSessions}`,
      package_name: package_plan || resolvedPackageName,
      sessions_total: totalSessions,
      sessions_remaining: totalSessions,
      sessions_completed: 0,
      session_rate: rate,
      total_price: totalPrice,
      gross_amount: totalPrice,
      coach_commission_rate: coachCommissionRate,
      coach_payout_amount: coachPayoutAmount,
      gym_retained_amount: gymRetainedAmount,
      goal: goal || 'Hypertrophy & Conditioning',
      preferred_date: sessionDate,
      preferred_time_slot: sessionTimeSlot,
      coach_confirmation_status: 'PENDING_COACH_CONFIRMATION',
      coach_confirmation_notes: 'Front Desk will verify coach availability for requested slot',
      payment_channel: isOnline ? 'XENDIT' : 'CASH',
      origin_channel: 'ONLINE',
      payment_method_detail: isOnline ? (payment_method_detail || 'GCash / Card / QR Ph') : 'OTC Cash',
      xendit_external_id: externalId,
      payment_reference: externalId,
      invoice_id: xenditInvoice?.id || null,
      invoice_url: xenditInvoice?.invoice_url || null,
      payment_status: isOnline ? 'AWAITING_PAYMENT' : 'COLLECT_CASH',
      clearance_status: isOnline ? 'AWAITING_PAYMENT' : 'AWAITING_DESK_CLEARANCE',
      enrollment_status: isOnline ? 'AWAITING_PAYMENT' : 'PENDING_FRONT_DESK_CLEARANCE',
      created_at: new Date().toISOString(),
      cleared_at: null,
      cleared_by: null
    };

    memoryStore.pt_enrollments.push(newEnrollment);

    // Record in memoryStore.payment_invoices for general Xendit ledger lookup
    if (isOnline && xenditInvoice) {
      if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
      const invRecord = {
        id: xenditInvoice.id,
        invoice_no: externalId,
        user_id: user.id,
        customer_name: user.name,
        customer_email: user.email,
        branch_id: newEnrollment.branch_id,
        plan_id: newEnrollment.package_id,
        package_name: newEnrollment.package_name,
        coach_id: targetCoach.id,
        coach_name: targetCoach.name,
        sessions_total: totalSessions,
        amount: totalPrice,
        preferred_date: sessionDate,
        preferred_time_slot: sessionTimeSlot,
        channel: 'PT ENROLLMENT',
        category: 'pt_enrollment',
        payment_rail: 'xendit_hosted_checkout',
        status: 'pending',
        invoice_url: xenditInvoice.invoice_url,
        gateway_ref: xenditInvoice.id,
        metadata: {
          type: 'pt_enrollment',
          enrollment_id: newEnrollment.id,
          user_id: user.id,
          coach_id: targetCoach.id,
          preferred_date: sessionDate,
          preferred_time_slot: sessionTimeSlot
        },
        created_at: new Date()
      };
      memoryStore.payment_invoices.unshift(invRecord);
    }

    // Cross-Branch Notification Dispatch to Front Desk, Branch Admin & Branch Owner of the attending facility
    const isCrossBranch = Boolean(user.branch_id && targetCoach.branch_id && user.branch_id !== targetCoach.branch_id);
    const attendingBranch = (memoryStore.branches || []).find(b => b.id === targetCoach.branch_id);
    const homeBranch = (memoryStore.branches || []).find(b => b.id === user.branch_id);
    const attendingBranchName = attendingBranch?.name || targetCoach.branch_name || 'Attending Facility';
    const homeBranchName = homeBranch?.name || 'Home Facility';

    if (!memoryStore.notifications) memoryStore.notifications = [];
    const notifRoles = ['employee', 'staff', 'branch_admin', 'branch_owner'];
    const notifTitle = isCrossBranch
      ? `Cross-Branch PT Enrollment: ${user.name}`
      : `New PT Enrollment: ${user.name}`;
    const notifMessage = isCrossBranch
      ? `${user.name} (Home Facility: ${homeBranchName}) has authorized and enrolled in a Cross-Branch PT package with Coach ${targetCoach.name.replace(/^Coach\s+/i, '')} at ${attendingBranchName}. Front desk verification and training slot allocated.`
      : `${user.name} enrolled in 1-on-1 PT package with Coach ${targetCoach.name.replace(/^Coach\s+/i, '')} at ${attendingBranchName}.`;

    notifRoles.forEach(role => {
      memoryStore.notifications.unshift({
        id: `notif-${crypto.randomUUID()}`,
        target_role: role,
        branch_id: targetCoach.branch_id,
        title: notifTitle,
        message: notifMessage,
        category: isCrossBranch ? 'CROSS_BRANCH_PT_ENROLLMENT' : 'PT_ENROLLMENT',
        created_at: new Date().toISOString(),
        read: false,
        metadata: {
          member_id: user.id,
          member_name: user.name,
          home_branch_id: user.branch_id,
          home_branch_name: homeBranchName,
          attending_branch_id: targetCoach.branch_id,
          attending_branch_name: attendingBranchName,
          coach_id: targetCoach.id,
          coach_name: targetCoach.name,
          package_name: resolvedPackageName,
          is_cross_branch: isCrossBranch
        }
      });
    });

    // Also notify the assigned coach directly
    memoryStore.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      target_user_id: targetCoach.id,
      title: notifTitle,
      message: notifMessage,
      category: isCrossBranch ? 'CROSS_BRANCH_PT_ENROLLMENT' : 'PT_ENROLLMENT',
      created_at: new Date().toISOString(),
      read: false
    });

    if (typeof saveStore === 'function') {
      saveStore();
    }

    await logAuditEvent({
      branch_id: newEnrollment.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'PT_ENROLLMENT_INITIATED',
      resource: 'pt_enrollments',
      ip_address: req.ip || '127.0.0.1',
      details: {
        enrollment_id: newEnrollment.id,
        coach_id: targetCoach.id,
        coach_name: targetCoach.name,
        payment_channel: newEnrollment.payment_channel,
        payment_status: newEnrollment.payment_status,
        total_price: newEnrollment.total_price
      }
    });

    res.json({
      success: true,
      message: isOnline
        ? 'Xendit Hosted Checkout invoice created. Redirecting to payment...'
        : `PT Enrollment initiated (Ref: ${newEnrollment.payment_reference})! Please proceed to the Front Desk to complete payment of ₱${totalPrice.toLocaleString()}.`,
      invoice_url: xenditInvoice?.invoice_url || null,
      invoice_id: xenditInvoice?.id || null,
      external_id: xenditInvoice?.external_id || externalId,
      enrollment: newEnrollment
    });
  } catch (err) {
    console.error('[initiatePtEnrollment error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 15B. Confirm PT Enrollment Payment (Client Redirection from Xendit Hosted Checkout or Webhook)
async function confirmPtEnrollmentPayment(req, res) {
  try {
    const user = req.user;
    const { external_id, invoice_id } = req.body;

    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];
    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
    if (!memoryStore.payment_invoices) memoryStore.payment_invoices = [];
    if (!memoryStore.coach_sales_commissions) memoryStore.coach_sales_commissions = [];
    if (!memoryStore.sales) memoryStore.sales = [];
    if (!memoryStore.coach_messages) memoryStore.coach_messages = [];

    // Find enrollment by external ID, payment reference, or invoice ID
    let enrollment = memoryStore.pt_enrollments.find(e => 
      (external_id && (e.payment_reference === external_id || e.id === external_id)) ||
      (invoice_id && (e.invoice_id === invoice_id || e.id === invoice_id))
    );

    if (!enrollment && user) {
      // Find latest pending enrollment for this user
      enrollment = memoryStore.pt_enrollments.find(e => 
        e.member_id === user.id && 
        (e.payment_status === 'PENDING' || e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT')
      );
    }

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'PT Enrollment record not found.' });
    }

    // Find invoice
    const invoice = memoryStore.payment_invoices.find(inv => 
      (external_id && inv.invoice_no === external_id) ||
      (invoice_id && (inv.id === invoice_id || inv.gateway_ref === invoice_id)) ||
      (enrollment.invoice_id && inv.id === enrollment.invoice_id) ||
      (enrollment.payment_reference && inv.invoice_no === enrollment.payment_reference)
    );

    // Update invoice status if found
    if (invoice) {
      invoice.status = 'settled';
      invoice.settled_at = new Date();
    }

    // Mark enrollment as PAID and CLEARED
    enrollment.payment_status = 'PAID';
    enrollment.enrollment_status = 'CLEARED';
    enrollment.cleared_at = new Date().toISOString();
    enrollment.cleared_by = 'Xendit Hosted Checkout (Automated Settlement)';

    // Verify coach
    const coach = (memoryStore.users || []).find(u => u.id === enrollment.coach_id);

    // 1. Create or activate PT contract in pt_clients
    let clientContract = memoryStore.pt_clients.find(c => 
      (c.client_id === enrollment.member_id || c.id === enrollment.member_id) && 
      c.coach_id === enrollment.coach_id &&
      c.status === 'Active'
    );

    if (!clientContract) {
      const memberUser = (memoryStore.users || []).find(u => u.id === enrollment.member_id);
      clientContract = {
        id: `ptc-${Date.now()}`,
        coach_id: enrollment.coach_id,
        client_id: enrollment.member_id,
        client_name: enrollment.member_name,
        package_plan: enrollment.package_name,
        session_rate: enrollment.session_rate,
        sessions_completed: 0,
        sessions_total: enrollment.sessions_total,
        goal: enrollment.goal || 'Hypertrophy & Conditioning',
        current_weight_kg: Number(enrollment.current_weight_kg || memberUser?.current_weight_kg) || null,
        target_weight_kg: Number(enrollment.target_weight_kg || memberUser?.target_weight_kg) || null,
        body_fat_percentage: memberUser?.body_fat_percentage || 18,
        contract_tier: 'Contracted Tier (Sales + Servicing Split)',
        contract_split_percentage: 30,
        sales_commission_rate: 15,
        status: 'Active',
        assigned_date: new Date().toISOString().split('T')[0],
        enrollment_id: enrollment.id
      };
      memoryStore.pt_clients.push(clientContract);
    }

    // 2. Accrue Sales Commission (15%)
    const salesCommissionRate = 15;
    const salesCommissionAmount = Math.round((Number(enrollment.total_price) * (salesCommissionRate / 100)) * 100) / 100;
    const existingComm = memoryStore.coach_sales_commissions.find(c => c.enrollment_id === enrollment.id);
    if (!existingComm) {
      memoryStore.coach_sales_commissions.push({
        id: `csc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        coach_id: enrollment.coach_id,
        coach_name: enrollment.coach_name,
        client_id: enrollment.member_id,
        client_name: enrollment.member_name,
        enrollment_id: enrollment.id,
        package_name: enrollment.package_name,
        package_amount: Number(enrollment.total_price),
        commission_rate: salesCommissionRate,
        commission_earned: salesCommissionAmount,
        date: new Date().toISOString(),
        cleared_by_staff: 'Xendit Gateway (Online Settlement)',
        payout_status: 'Accrued'
      });
    }

    // 3. Record in sales ledger
    const existingSale = memoryStore.sales.find(s => s.reference_no === enrollment.payment_reference);
    if (!existingSale) {
      memoryStore.sales.push({
        id: `sale-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        user_id: enrollment.member_id,
        customer_name: enrollment.member_name,
        branch_id: enrollment.branch_id || 'b-mkt-01',
        category: 'personal_training',
        amount: Number(enrollment.total_price),
        payment_method: 'xendit',
        reference_no: enrollment.payment_reference,
        description: `PT Package: ${enrollment.package_name} (Coach: ${enrollment.coach_name}) - Xendit Payment`,
        created_at: new Date()
      });
    }

    // 4. Send initial welcome greeting from coach
    const welcomeMsg = {
      id: `msg-${Date.now()}`,
      sender_id: enrollment.coach_id,
      sender_name: enrollment.coach_name,
      sender_role: 'coach',
      recipient_id: enrollment.member_id,
      recipient_name: enrollment.member_name,
      content: `Welcome to 1-on-1 Personal Training, ${enrollment.member_name.split(' ')[0]}! Your ${enrollment.package_name} is active via Xendit. I've unlocked our direct chat and will build your periodized workout split. Feel free to message me anytime!`,
      tag: 'Coach Welcome',
      created_at: new Date().toISOString(),
      is_read: false
    };
    memoryStore.coach_messages.push(welcomeMsg);

    // Save
    if (typeof saveStore === 'function') {
      saveStore();
    }

    await logAuditEvent({
      branch_id: enrollment.branch_id || 'b-mkt-01',
      user_id: user?.id || enrollment.member_id,
      user_role: user?.role || 'member',
      action: 'PT_ENROLLMENT_XENDIT_SETTLED',
      resource: 'pt_enrollments',
      ip_address: req.ip || '127.0.0.1',
      details: {
        enrollment_id: enrollment.id,
        member_name: enrollment.member_name,
        coach_name: enrollment.coach_name,
        package_amount: enrollment.total_price,
        payment_reference: enrollment.payment_reference
      }
    });

    return res.json({
      success: true,
      message: `PT Enrollment successfully settled via Xendit! Athlete assigned to Coach ${enrollment.coach_name}.`,
      enrollment,
      clientContract,
      coach
    });
  } catch (err) {
    console.error('[confirmPtEnrollmentPayment error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 16. Get Member's PT Enrollment Status (Active vs Pending Front Desk Queue)
async function getPtEnrollmentStatus(req, res) {
  try {
    const user = req.user;
    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];
    if (!memoryStore.pt_enrollments) memoryStore.pt_enrollments = [];

    const uName = (user.name || '').toLowerCase().trim();
    const activeContract = memoryStore.pt_clients.find(c => 
      (c.client_id === user.id || c.id === user.id || (c.client_name && uName && (c.client_name.toLowerCase().trim() === uName || uName.includes(c.client_name.toLowerCase().trim())))) && 
      (c.status === 'Active' || c.status === 'active') &&
      ((c.sessions_total || 12) - (c.sessions_completed || 0) > 0)
    ) || null;

    const clearedEnrollment = memoryStore.pt_enrollments.find(e =>
      (e.member_id === user.id || e.user_id === user.id || (e.member_email && e.member_email.toLowerCase() === (user.email || '').toLowerCase())) &&
      ['CLEARED', 'CLEARED_ACTIVE', 'Active', 'active'].includes(e.enrollment_status) &&
      !e.is_concluded &&
      ((e.sessions_total || 12) - (e.sessions_completed || 0) > 0)
    ) || null;

    const hasActiveContract = !!(activeContract || clearedEnrollment);

    const pendingEnrollment = memoryStore.pt_enrollments
      .filter(e => (e.member_id === user.id || e.user_id === user.id) && (e.enrollment_status === 'ENROLLMENT_PENDING_PAYMENT' || e.enrollment_status === 'PENDING_FRONT_DESK_CLEARANCE' || e.clearance_status === 'AWAITING_PAYMENT'))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

    let coachInfo = null;
    const targetCoachId = activeContract?.coach_id || clearedEnrollment?.coach_id || user.coach_id;
    if (targetCoachId) {
      const coachUser = (memoryStore.users || []).find(u => u.id === targetCoachId);
      if (coachUser) {
        coachInfo = {
          id: coachUser.id,
          name: coachUser.name,
          email: coachUser.email,
          role: coachUser.role || 'coach',
          specialty: coachUser.specialty || coachUser.coach_specialty || 'Head Coach & Personal Trainer',
          avatar_url: coachUser.avatar_url || coachUser.profile_image || null,
          profile_image: coachUser.profile_image || coachUser.avatar_url || null
        };
      }
    }

    res.json({
      success: true,
      has_active_contract: hasActiveContract,
      active_contract: activeContract || clearedEnrollment || null,
      has_pending_enrollment: !hasActiveContract && !!pendingEnrollment,
      pending_enrollment: !hasActiveContract ? pendingEnrollment : null,
      coach: coachInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 17. Enroll in 1-on-1 Coaching (Delegates to initiatePtEnrollment or direct admin override)
async function enrollCoach(req, res) {
  try {
    const user = req.user;
    const { coach_id, package_plan, goal = 'Hypertrophy & Conditioning', sessions_total = 12, direct = false } = req.body;

    if (!direct) {
      return initiatePtEnrollment(req, res);
    }

    if (!coach_id) {
      return res.status(400).json({ success: false, message: 'Please select a coach to enroll.' });
    }

    if (!memoryStore.pt_clients) memoryStore.pt_clients = [];

    // Check if member already has an active PT contract
    const existing = memoryStore.pt_clients.find(c => (c.client_id === user.id || c.id === user.id) && c.status === 'Active');
    if (existing) {
      const coachUser = (memoryStore.users || []).find(u => u.id === existing.coach_id);
      return res.status(400).json({
        success: false,
        message: `You are already enrolled with Coach ${coachUser?.name || 'Personal Trainer'}. You can renew sessions when your package completes.`
      });
    }

    const targetCoach = (memoryStore.users || []).find(u => u.id === coach_id && (u.role === 'coach' || u.role === 'trainer'));
    if (!targetCoach) {
      return res.status(404).json({ success: false, message: 'Selected coach not found in facility directory.' });
    }

    // Strict ROTA Schedule Validation: Ensure coach is on-duty on ROTA for the chosen date/day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const sessionDayIndex = new Date(sessionDate).getDay();
    const dayName = dayNames[sessionDayIndex];

    const rotaEntry = (memoryStore.floor_rota || []).find(r => 
      (r.staff_id === targetCoach.id) ||
      (r.coach_name && targetCoach.name && (
        r.coach_name.toLowerCase().includes(targetCoach.name.toLowerCase()) ||
        targetCoach.name.toLowerCase().includes(r.coach_name.toLowerCase())
      ))
    );

    if (rotaEntry) {
      const scheduledShift = rotaEntry[dayName];
      const isOffDuty = !scheduledShift || 
        scheduledShift.toLowerCase().includes('off') || 
        scheduledShift.toLowerCase().includes('rest');

      if (isOffDuty) {
        return res.status(400).json({
          success: false,
          error: 'COACH_UNAVAILABLE_ON_ROTA',
          message: `Booking blocked: Coach ${targetCoach.name.replace(/^Coach\s+/i, '')} is off-duty on ${dayName.toUpperCase()}s on the club Floor Duty Rota. Please pick a date when this coach is on-duty.`
        });
      }
    }

    const totalSessions = Number(sessions_total) || (package_plan && package_plan.includes('16') ? 16 : (package_plan && package_plan.includes('Single') ? 1 : 12));
    let rate = 500;
    let resolvedPackageName = '12-Session Signature PT Package (₱6,000)';
    if (totalSessions === 16) {
      rate = 468.75;
      resolvedPackageName = '16-Session Transformation Package (₱7,500)';
    } else if (totalSessions === 1) {
      rate = 500;
      resolvedPackageName = 'Single 1-on-1 Session (~₱500)';
    }

    const newPtRecord = {
      id: `ptc-${Date.now()}`,
      coach_id: targetCoach.id,
      client_id: user.id,
      client_name: user.name,
      package_plan: package_plan || resolvedPackageName,
      session_rate: rate,
      sessions_completed: 0,
      sessions_total: totalSessions,
      goal: goal || 'Hypertrophy & Body Recomposition',
      current_weight_kg: Number(req.body.current_weight_kg || user?.current_weight_kg) || null,
      target_weight_kg: Number(req.body.target_weight_kg || user?.target_weight_kg) || null,
      body_fat_percentage: 18,
      contract_tier: 'Contracted Tier 1 (60% Payroll Split)',
      contract_split_percentage: 60,
      status: 'Active',
      assigned_date: new Date().toISOString().split('T')[0]
    };

    memoryStore.pt_clients.push(newPtRecord);

    // Initial coach greeting message
    if (!memoryStore.coach_messages) memoryStore.coach_messages = [];
    const welcomeMsg = {
      id: `msg-${Date.now()}`,
      sender_id: targetCoach.id,
      sender_name: targetCoach.name,
      sender_role: 'coach',
      recipient_id: user.id,
      recipient_name: user.name,
      content: `Welcome to 1-on-1 Personal Training, ${user.name.split(' ')[0]}! I've confirmed your enrollment for the ${newPtRecord.package_plan}. Send me a message here anytime with questions about your workouts or nutrition.`,
      tag: 'Coach Welcome',
      created_at: new Date().toISOString(),
      is_read: false
    };
    memoryStore.coach_messages.push(welcomeMsg);

    // Record audit log
    await logAuditEvent({
      branch_id: user.branch_id || targetCoach.branch_id || 'b-mkt-01',
      user_id: user.id,
      user_role: user.role,
      action: 'COACH_ENROLLMENT',
      resource: 'pt_clients',
      ip_address: req.ip || '127.0.0.1',
      details: { coach_id: targetCoach.id, coach_name: targetCoach.name, package_plan: newPtRecord.package_plan }
    });

    if (typeof saveStore === 'function') {
      saveStore();
    }

    res.json({
      success: true,
      message: `Successfully enrolled with ${targetCoach.name}! Your 1-on-1 training portal is now active.`,
      coach: {
        id: targetCoach.id,
        name: targetCoach.name,
        role: 'Head Coach & Personal Trainer',
        email: targetCoach.email
      },
      ptRecord: newPtRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getMembers,
  getMemberById,
  renewSubscription,
  updateMemberStatus,
  getProgress,
  logProgress,
  getStrengthPRs,
  logStrengthPR,
  getMemberMessages,
  sendMemberMessage,
  setMemberTyping,
  getMemberWorkoutPlans,
  toggleExerciseComplete,
  getFloorDensity,
  toggleAutoRenew,
  getAvailableCoaches,
  enrollCoach,
  initiatePtEnrollment,
  confirmPtEnrollmentPayment,
  getPtEnrollmentStatus,
  updateTargetWeight
};
