const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { memoryStore, query, isPostgres } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { QR_HMAC_SECRET } = require('../config/secrets');
const { broadcastRelayPulse } = require('../services/turnstileHardwareBridge');
const { sendAntiPassbackAlert, sendTurnstileExpirationAlert } = require('../utils/smsGateway');

// Nonce replay prevention cache: Map of nonce -> expiresAt timestamp (TTL 65 seconds)
const redeemedNonces = new Map();

// Periodic cleanup: evict expired nonces every 30 seconds to maintain zero memory leak
const nonceCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [n, exp] of redeemedNonces.entries()) {
    if (now > exp) {
      redeemedNonces.delete(n);
    }
  }
}, 30000);
if (nonceCleanupTimer.unref) nonceCleanupTimer.unref(); // Do not block Node event loop

// 1. Generate 60-Second Dynamic Cryptographic QR Pass (For Authenticated Member)
async function generateDynamicPass(req, res) {
  try {
    const user = req.user;

    // Fetch member's subscription
    const userSubs = (memoryStore.subscriptions || []).filter(s => s.user_id === user.id);
    const subscription = userSubs.find(s => s.status === 'active' && (!s.end_date || new Date(s.end_date).getTime() >= Date.now())) || (userSubs.length > 0 ? userSubs[userSubs.length - 1] : null);
    const branch = memoryStore.branches.find(b => b.id === user.branch_id);

    const isExpiredByDate = Boolean(subscription?.end_date && new Date(subscription.end_date).getTime() < Date.now());

    // Turnstile Access Gate: Require Active or Valid Contract (pending_payment / unpaid / cancelled / expired / past_due / expired-by-date are blocked from pass generation)
    if (!subscription || subscription.status === 'expired' || subscription.status === 'past_due' || subscription.status === 'cancelled' || subscription.status === 'pending_payment' || subscription.status === 'unpaid' || user.status === 'pending_payment' || isExpiredByDate) {
      if (subscription && isExpiredByDate && subscription.status === 'active') {
        subscription.status = 'expired';
      }
      return res.status(403).json({
        success: false,
        error: 'MEMBERSHIP_PAYMENT_REQUIRED',
        message: isExpiredByDate
          ? `Your membership contract expired on ${subscription.end_date}. Please renew your plan to unlock your digital turnstile pass.`
          : 'Active membership subscription required. Please settle your membership plan to unlock your digital turnstile pass.',
        subscription_status: subscription ? (isExpiredByDate ? 'expired' : subscription.status) : 'unpaid'
      });
    }

    const timestamp = Date.now();
    const nonce = crypto.randomBytes(8).toString('hex');

    const payload = {
      memberId: user.id,
      memberName: user.name,
      branchId: user.branch_id,
      branchCode: branch ? branch.code : 'UNKNOWN',
      tier: subscription.tier,
      subStatus: subscription.status,
      timestamp,
      nonce
    };

    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64url');

    // Create HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', QR_HMAC_SECRET)
      .update(payloadBase64)
      .digest('hex');

    const qrToken = `${payloadBase64}.${signature}`;

    res.json({
      success: true,
      token: qrToken,
      ttl: 60, // 60 seconds
      generatedAt: timestamp,
      expiresAt: timestamp + 60 * 1000,
      member: {
        id: user.id,
        name: user.name,
        branch_name: branch ? branch.name : 'Unknown',
        tier: subscription ? subscription.tier : 'none',
        subscription_status: subscription ? subscription.status : 'none'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. High-Speed Employee Scanner Verification & Check-in (Dual-Credential: QR Pass + RFID Keycard)
async function verifyPassAndCheckIn(req, res) {
  try {
    const { token, branchId, manualMemberId, memberId, rfid_uid, rfid_card_uid } = req.body;
    const scannerUser = req.user; // Front-desk employee or branch admin
    const targetBranchId = branchId || scannerUser?.branch_id || 'b-mkt-01';

    // RA 9514 Fire Code Life-Safety Egress Check: Bypass barrier locking during emergencies
    const { isEmergencyEgressActive } = require('../services/turnstileHardwareBridge');
    if (isEmergencyEgressActive(targetBranchId)) {
      return res.status(200).json({
        success: true,
        valid: true,
        granted: true,
        emergency_override: true,
        message: 'EMERGENCY PROTOCOL ACTIVE: Turnstile gates held unlocked for life-safety egress under RA 9514. Passback and nonce checks bypassed.',
        gate_state: 'SOLENOID_HOLD_OPEN'
      });
    }

    let member;
    let tokenAgeMs = 0;
    let nonce = null;
    let verificationMethod = 'qr_turnstile';

    const rfidInput = rfid_uid || rfid_card_uid || (typeof token === 'string' && (token.startsWith('RFID:') || token.startsWith('KS-') || token.startsWith('rfid_')) ? token : null);

    if (rfidInput) {
      const cleanRfid = String(rfidInput).replace(/^RFID:\s*/i, '').trim();
      member = memoryStore.users.find(u => (u.rfid_card_uid && u.rfid_card_uid.toLowerCase() === cleanRfid.toLowerCase()) || u.id === cleanRfid);
      if (!member) {
        return res.status(404).json({
          success: false,
          valid: false,
          reason: 'RFID_NOT_RECOGNIZED',
          message: `Physical RFID Keycard UID [${cleanRfid}] is not registered to an active member.`
        });
      }
      verificationMethod = 'rfid_turnstile';
      nonce = `rfid_${Date.now()}_${cleanRfid.slice(0, 8)}`;
    } else if (manualMemberId || memberId) {
      const targetId = manualMemberId || memberId;
      member = memoryStore.users.find(u => u.id === targetId);
      if (!member) {
        return res.status(404).json({
          success: false,
          valid: false,
          reason: 'MEMBER_NOT_FOUND',
          message: 'Member account not found in system directory.'
        });
      }
      verificationMethod = 'manual_admin';
      nonce = `manual_${Date.now()}_${targetId.slice(0, 6)}`;
    } else {
      if (!token) {
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'MISSING_TOKEN',
          message: 'No QR code token or RFID UID provided.'
        });
      }

      const parts = token.split('.');
      if (parts.length !== 2) {
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'MALFORMED_TOKEN',
          message: 'Invalid cryptographic pass format.'
        });
      }

      const [payloadBase64, providedSignature] = parts;

      // 1. Verify HMAC Signature
      const expectedSignature = crypto
        .createHmac('sha256', QR_HMAC_SECRET)
        .update(payloadBase64)
        .digest('hex');

      const sigBufferA = Buffer.from(providedSignature, 'utf8');
      const sigBufferB = Buffer.from(expectedSignature, 'utf8');

      if (sigBufferA.length !== sigBufferB.length || !crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
        return res.status(403).json({
          success: false,
          valid: false,
          reason: 'INVALID_SIGNATURE',
          message: 'Cryptographic signature mismatch. Potential tampering detected!'
        });
      }

      // 2. Parse payload
      let payload;
      try {
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
        payload = JSON.parse(payloadJson);
      } catch (e) {
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'PARSE_ERROR',
          message: 'Corrupted payload structure.'
        });
      }

      // 3. Time-to-Live Check (60-second window)
      const now = Date.now();
      tokenAgeMs = now - payload.timestamp;
      if (tokenAgeMs > 60 * 1000) {
        const secondsLate = Math.round((tokenAgeMs - 60000) / 1000);
        return res.status(400).json({
          success: false,
          valid: false,
          reason: 'EXPIRED_QR',
          message: `Dynamic QR code expired ${secondsLate}s ago. Please refresh the pass on your mobile device.`
        });
      }

      // 4. Anti-Replay Nonce Verification
      if (redeemedNonces.has(payload.nonce)) {
        const exp = redeemedNonces.get(payload.nonce);
        if (exp && exp > now) {
          return res.status(409).json({
            success: false,
            valid: false,
            reason: 'REPLAY_ATTACK_DETECTED',
            message: 'Security Alert: This dynamic QR pass has already been scanned and redeemed. Screenshot reuse is strictly prohibited.'
          });
        } else {
          redeemedNonces.delete(payload.nonce);
        }
      }

      nonce = payload.nonce;
      member = memoryStore.users.find(u => u.id === payload.memberId);
      verificationMethod = 'qr_turnstile';
    }

    // 5. Member Existence and Account Status Check
    if (!member || member.status !== 'active') {
      return res.status(403).json({
        success: false,
        valid: false,
        reason: 'MEMBER_INACTIVE',
        message: 'Member account is inactive, suspended, or does not exist.'
      });
    }

    // 5.1. Subscription Active & Delinquency Check
    const userSubs = (memoryStore.subscriptions || []).filter(s => s.user_id === member.id);
    const subscription = userSubs.find(s => s.status === 'active' && (!s.end_date || new Date(s.end_date).getTime() >= Date.now())) || (userSubs.length > 0 ? userSubs[userSubs.length - 1] : null);
    if (!subscription || subscription.status === 'expired' || subscription.status === 'cancelled' || subscription.status === 'pending_payment' || subscription.status === 'unpaid') {
      return res.status(403).json({
        success: false,
        valid: false,
        reason: 'MEMBERSHIP_UNPAID',
        message: `Membership dues pending or contract inactive (${subscription ? subscription.tier.toUpperCase() : 'None'}). Turnstile entry denied.`
      });
    }

    if (subscription.status === 'past_due') {
      return res.status(403).json({
        success: false,
        valid: false,
        reason: 'SUBSCRIPTION_PAST_DUE',
        message: `Turnstile Access Denied: Monthly membership dues are past due (Amount: ₱${(subscription.monthly_due_amount || 2499).toLocaleString()}). Please settle at the reception counter or update auto-debit method.`
      });
    }

    if (subscription.end_date && new Date(subscription.end_date).getTime() < Date.now()) {
      subscription.status = 'expired';
      return res.status(403).json({
        success: false,
        valid: false,
        reason: 'MEMBERSHIP_EXPIRED',
        message: `Turnstile Access Denied: Membership contract expired on ${subscription.end_date}. Please renew your membership plan to enter.`
      });
    }

    // 5.2. Hard Anti-Passback (APB) Enforcement (15-Minute Re-entry Cooldown)
    const now = Date.now();
    const scanningBranchId = branchId || scannerUser?.branch_id || member.branch_id;
    const apbCooldownMs = 15 * 60 * 1000; // 15-minute cooldown
    // Cryptographic Supervisor Verification (Defeats trivial boolean override)
    let supervisorAuthorized = false;
    let authorizingSupervisor = null;

    if (req.body.supervisor_pin) {
      const pinInput = String(req.body.supervisor_pin).trim();
      const candidateSupervisors = (memoryStore.users || []).filter(u =>
        (u.role === 'branch_admin' && (u.branch_id === scanningBranchId || !scanningBranchId)) ||
        u.role === 'super_admin'
      );

      for (const sup of candidateSupervisors) {
        if (sup.supervisor_pin_hash && (await bcrypt.compare(pinInput, sup.supervisor_pin_hash))) {
          supervisorAuthorized = true;
          authorizingSupervisor = sup;
          break;
        }
      }
    }

    if (req.body.reset_apb && process.env.NODE_ENV !== 'production') {
      member.last_check_in = 0;
    }

    const isWithinApbCooldown = member.last_check_in && (now - member.last_check_in < apbCooldownMs);

    if (isWithinApbCooldown && !supervisorAuthorized) {
      const minsElapsed = Math.max(1, Math.floor((now - member.last_check_in) / 60000));
      const minsRemaining = Math.max(1, Math.ceil((apbCooldownMs - (now - member.last_check_in)) / 60000));

      await logAuditEvent({
        branch_id: scanningBranchId,
        user_id: member.id,
        user_role: member.role,
        action: 'TURNSTILE_ANTI_PASSBACK_BLOCKED',
        resource: 'turnstile',
        ip_address: req.ip || '127.0.0.1',
        details: { member: member.name, minsElapsed, minsRemaining }
      });

      const branchName = (memoryStore.branches || []).find(b => b.id === scanningBranchId)?.name || 'KSYN Fitness';
      sendAntiPassbackAlert(member, branchName).catch(() => {});

      return res.status(403).json({
        success: false,
        valid: false,
        reason: 'ANTI_PASSBACK_VIOLATION',
        message: `Anti-Passback Alert: ${member.name} already entered ${minsElapsed}m ago. Card/pass sharing is prohibited. Wait ${minsRemaining}m or request supervisor override.`,
        requires_override: true,
        minutes_remaining: minsRemaining
      });
    }

    if (isWithinApbCooldown && supervisorAuthorized) {
      const overrideReason = req.body.override_reason || 'Supervisor manual override for facility re-entry';
      await logAuditEvent({
        branch_id: scanningBranchId,
        user_id: member.id,
        user_role: member.role,
        action: 'TURNSTILE_SUPERVISOR_OVERRIDE_GRANTED',
        resource: 'turnstile',
        ip_address: req.ip || '127.0.0.1',
        details: {
          member: member.name,
          authorized_by: authorizingSupervisor?.name || scannerUser?.name || 'Authorized Supervisor',
          supervisor_id: authorizingSupervisor?.id || scannerUser?.id,
          override_reason: overrideReason
        }
      });
    }

    // Check if within 7 days of expiration
    let contractAlert = null;
    if (subscription.end_date) {
      const daysUntilEnd = Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
        contractAlert = `Membership contract expiring in ${daysUntilEnd} day(s). Auto-renewal invoice generated.`;
        const branchName = (memoryStore.branches || []).find(b => b.id === scanningBranchId)?.name || 'KSYN Fitness';
        sendTurnstileExpirationAlert(member, daysUntilEnd, branchName).catch(() => {});
      }
    }

    // 7. Multi-Branch Roaming & Guest Surcharge Rules
    const homeBranchId = member.branch_id;
    const isCrossBranch = (scanningBranchId !== homeBranchId);

    const branches = memoryStore.branches || [];
    const homeBranch = branches.find(b => b.id === homeBranchId);
    const visitingBranch = branches.find(b => b.id === scanningBranchId);

    let feeIncurred = 0.00;
    let paymentStatus = 'waived';
    let statusMessage = 'Access Granted. Welcome to KSYN Fitness!';
    let monthlyCount = 0;
    let saleRecord = null;

    if (isCrossBranch) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const monthlyVisits = (memoryStore.attendance_logs || []).filter(a => {
        const aMemberId = a.member_id || a.user_id;
        if (aMemberId !== member.id) return false;
        if (!a.is_cross_branch) return false;
        const aDate = new Date(a.check_in_date || a.check_in_time);
        return aDate.getFullYear() === currentYear && aDate.getMonth() === currentMonth;
      });

      monthlyCount = monthlyVisits.length + 1;

      if (monthlyCount <= 4) {
        feeIncurred = 0.00;
        paymentStatus = 'waived';
        statusMessage = `Cross-Branch Visit ${monthlyCount}/4 (Complimentary)`;
      } else {
        feeIncurred = 350.00;
        paymentStatus = 'paid';
        statusMessage = `Cross-Branch Limit Reached (Visit #${monthlyCount}) — ₱350 Guest Fee Required / Collected`;

        // Record in visiting branch sales ledger
        saleRecord = {
          id: crypto.randomUUID(),
          branch_id: scanningBranchId,
          user_id: member.id,
          customer_name: `${member.name} (Home: ${homeBranch?.name || 'Outside Branch'})`,
          amount: 350.00,
          category: 'guest_pass',
          payment_method: req.body.payment_method || 'counter_cash',
          reference_no: `GST-${visitingBranch?.code || 'VIS'}-${Date.now().toString().slice(-6)}`,
          description: `Cross-Branch Guest Roaming Surcharge (Visit #${monthlyCount} for ${member.name})`,
          created_at: new Date()
        };

        if (!memoryStore.sales) memoryStore.sales = [];
        memoryStore.sales.unshift(saleRecord);
      }
    }

    // Mark nonce as redeemed (prevent replay within 65-second validity window)
    if (nonce) {
      redeemedNonces.set(nonce, Date.now() + 65 * 1000);
    }

    // 8. Record Attendance Log
    const { resolvePlan } = require('../config/membershipRates');
    const resolvedPlan = resolvePlan(subscription?.plan || member.membership_plan);

    const attendanceEntry = {
      id: crypto.randomUUID(),
      branch_id: scanningBranchId,
      visited_branch_id: scanningBranchId,
      home_branch_id: homeBranchId,
      user_id: member.id,
      member_id: member.id,
      user_name: member.name,
      member_name: member.name,
      member_email: member.email,
      member_plan: subscription?.plan || member.membership_plan || '1_month',
      member_tier: subscription?.tier || member.membership_tier || 'basic',
      plan_name: resolvedPlan ? resolvedPlan.name : (subscription?.plan || '1 Month Pass'),
      home_branch_name: homeBranch ? homeBranch.name : 'Unknown Branch',
      home_branch_code: homeBranch ? homeBranch.code : 'N/A',
      visited_branch_name: visitingBranch ? visitingBranch.name : 'Unknown Branch',
      visited_branch_code: visitingBranch ? visitingBranch.code : 'N/A',
      scanned_by_employee_id: scannerUser ? scannerUser.id : 'system_kiosk',
      check_in_time: new Date(),
      check_in_date: new Date(),
      is_cross_branch: isCrossBranch,
      monthly_cross_branch_count: isCrossBranch ? monthlyCount : 0,
      fee_incurred: feeIncurred,
      payment_status: paymentStatus,
      verification_method: verificationMethod,
      qr_nonce: nonce,
      status: 'granted',
      notes: isCrossBranch
        ? (monthlyCount >= 5 ? `Cross-Branch Limit Reached (Visit #${monthlyCount}) — ₱350 Guest Fee Required` : `Cross-Branch Visit ${monthlyCount}/4 (Complimentary)`)
        : `Verified via ${verificationMethod === 'rfid_turnstile' ? 'RFID Keycard' : 'Dynamic QR'} (${resolvedPlan ? resolvedPlan.name : (subscription?.plan || 'Active')})`
    };

    member.last_check_in = now;
    memoryStore.attendance_logs.unshift(attendanceEntry);

    if (isPostgres()) {
      try {
        await query(
          `INSERT INTO attendance_logs (id, branch_id, user_id, method, check_in_time, verified_by, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            attendanceEntry.id,
            attendanceEntry.branch_id,
            attendanceEntry.user_id,
            attendanceEntry.verification_method || 'qr_turnstile',
            attendanceEntry.check_in_time,
            attendanceEntry.scanned_by_employee_id,
            attendanceEntry.status
          ]
        );
      } catch (err) {
        console.error('[PostgreSQL Attendance Insert Error]:', err.message);
      }
    }

    // Automatic Turnstile-to-Class Roster Binding (from 60m prior to start until class end)
    let classCheckInResult = null;
    if (!memoryStore.classes || memoryStore.classes.length === 0) {
      try {
        const { initClassStore } = require('./classBookingController');
        if (typeof initClassStore === 'function') initClassStore();
      } catch (e) {}
    }

    const availableClasses = memoryStore.classes || memoryStore.branch_classes || [];
    const checkInDateObj = new Date();

    for (const cls of availableClasses) {
      if (cls.branch_id && scanningBranchId && cls.branch_id !== scanningBranchId) {
        continue;
      }
      const timeStr = cls.time;
      if (!timeStr) continue;

      const parts = timeStr.split(/[\u2013\u2014-]/).map(s => s.trim());
      if (parts.length !== 2) continue;

      const parseTime = (str) => {
        const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const modifier = match[3].toUpperCase();
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d;
      };

      const classStartTime = parseTime(parts[0]);
      const classEndTime = parseTime(parts[1]);
      if (!classStartTime || !classEndTime) continue;
      const windowStart = new Date(classStartTime.getTime() - 60 * 60 * 1000);
      const windowEnd = classEndTime;
      const isWithinWindow = checkInDateObj >= windowStart && checkInDateObj <= windowEnd;
      const enrolledMembers = cls.enrolled || cls.roster || [];
      const enrolledMember = enrolledMembers.find(e =>
        (e.user_id && e.user_id === member.id) ||
        (e.id && e.id === member.id) ||
        (e.email && member.email && e.email.toLowerCase() === member.email.toLowerCase()) ||
        (e.name && member.name && (
          e.name.toLowerCase() === member.name.toLowerCase() ||
          member.name.toLowerCase().includes(e.name.toLowerCase()) ||
          e.name.toLowerCase().includes(member.name.toLowerCase())
        ))
      );

      if (enrolledMember && (isWithinWindow || enrolledMember.status !== 'Checked In')) {
        enrolledMember.status = 'Checked In';
        enrolledMember.verified_via = verificationMethod === 'rfid_turnstile' ? 'RFID Keycard Scan' : 'Front Desk Turnstile QR';
        enrolledMember.checked_in_at = new Date().toISOString();
        enrolledMember.checkInTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (Array.isArray(cls.roster)) {
          const rMember = cls.roster.find(r => r.id === enrolledMember.id || r.name === enrolledMember.name);
          if (rMember) {
            rMember.status = 'Checked In';
            rMember.verified_via = enrolledMember.verified_via;
            rMember.checked_in_at = enrolledMember.checked_in_at;
            rMember.checkInTime = enrolledMember.checkInTime;
          }
        }

        // Also sync in branch_classes if distinct
        if (memoryStore.branch_classes) {
          const bc = memoryStore.branch_classes.find(b => b.id === cls.id);
          if (bc && Array.isArray(bc.enrolled)) {
            const bMember = bc.enrolled.find(e => (e.user_id && e.user_id === member.id) || (e.name && member.name && e.name.toLowerCase() === member.name.toLowerCase()));
            if (bMember) {
              bMember.status = 'Checked In';
              bMember.verified_via = enrolledMember.verified_via;
              bMember.checked_in_at = enrolledMember.checked_in_at;
              bMember.checkInTime = enrolledMember.checkInTime;
            }
            bc.roster = bc.enrolled;
          }
        }

        classCheckInResult = {
          class_id: cls.id,
          class_name: cls.name,
          room: cls.room,
          time: cls.time
        };
        break;
      }
    }

    // Pulse Physical Turnstile Solenoid Relay via WebSocket hardware bridge
    const relayResult = broadcastRelayPulse({
      branch_id: scanningBranchId,
      member_name: member.name,
      athlete_id: member.id,
      duration_ms: 3000,
      relay_channel: 1
    });

    res.json({
      success: true,
      valid: true,
      hardware_relay: relayResult,
      message: statusMessage,
      contract_alert: contractAlert,
      class_checkin: classCheckInResult,
      verification_method: verificationMethod,
      credential_type: verificationMethod === 'rfid_turnstile' ? 'RFID' : 'QR',
      is_cross_branch: isCrossBranch,
      monthly_cross_branch_count: isCrossBranch ? monthlyCount : 0,
      fee_incurred: feeIncurred,
      payment_status: paymentStatus,
      sale: saleRecord,
      member: {
        id: member.id,
        name: member.name,
        email: member.email ? `${member.email.slice(0, 2)}***@${member.email.split('@')[1] || 'domain.com'}` : '—',
        phone: member.phone ? member.phone.replace(/(\+?\d{2,3}\s?\d{3})\s?(\d{3})\s?(\d{4})/, '$1 *** $3') : '—',
        tier: subscription?.tier || member.membership_tier || 'basic',
        plan: subscription?.plan || member.membership_plan || '1_month',
        plan_name: resolvedPlan ? resolvedPlan.name : (subscription?.plan || '1 Month Pass'),
        subStatus: subscription?.status || member.status || 'active',
        subscription_end_date: subscription?.end_date || null,
        homeBranch: homeBranch ? homeBranch.name : 'Unknown Branch',
        checkInTime: attendanceEntry.check_in_time
      },
      attendance: attendanceEntry
    });
  } catch (err) {
    res.status(500).json({ success: false, valid: false, message: err.message });
  }
}

// 3. Get Attendance Logs (Tenant Isolated)
async function getAttendanceLogs(req, res) {
  try {
    const { resolvePlan } = require('../config/membershipRates');
    const user = req.user;
    let logs = [...memoryStore.attendance_logs];

    // RBAC and Tenant Isolation
    if (user.role === 'member') {
      logs = logs.filter(a => a.user_id === user.id);
    } else if (user.role !== 'super_admin') {
      logs = logs.filter(a => a.branch_id === user.branch_id);
    }

    // Enrich logs with user and staff names
    const enriched = logs.slice(0, 100).map(log => {
      const member = memoryStore.users.find(u => u.id === (log.member_id || log.user_id));
      const staff = memoryStore.users.find(u => u.id === log.scanned_by_employee_id);
      const visitedBranch = memoryStore.branches.find(b => b.id === (log.visited_branch_id || log.branch_id));
      const homeBranch = memoryStore.branches.find(b => b.id === (log.home_branch_id || member?.branch_id));
      const isCrossBranch = log.is_cross_branch === true || (log.visited_branch_id && log.home_branch_id && log.visited_branch_id !== log.home_branch_id);

      const sub = (memoryStore.subscriptions || []).find(s => s.user_id === member?.id);
      const userPlan = sub?.plan || member?.membership_plan || log.member_plan || '1_month';
      const resolvedP = resolvePlan(userPlan);

      return {
        id: log.id,
        check_in_time: log.check_in_time || log.check_in_date,
        check_in_date: log.check_in_date || log.check_in_time,
        user_name: member ? member.name : (log.user_name || log.member_name || 'Athlete'),
        member_name: member ? member.name : (log.member_name || log.user_name || 'Athlete'),
        member_email: member ? member.email : '',
        member_plan: userPlan,
        member_tier: sub?.tier || member?.membership_tier || log.member_tier || 'basic',
        plan_name: resolvedP ? resolvedP.name : (log.plan_name || userPlan),
        scanned_by: staff ? staff.name : 'System Terminal',
        branch_name: visitedBranch ? visitedBranch.name : (log.visited_branch_name || 'KSYN Fitness Makati'),
        branch_code: visitedBranch ? visitedBranch.code : (log.visited_branch_code || 'MKT-01'),
        home_branch_name: homeBranch ? homeBranch.name : (log.home_branch_name || 'Home Branch'),
        home_branch_code: homeBranch ? homeBranch.code : (log.home_branch_code || 'N/A'),
        is_cross_branch: isCrossBranch,
        monthly_cross_branch_count: log.monthly_cross_branch_count || (isCrossBranch ? 1 : 0),
        fee_incurred: Number(log.fee_incurred || 0),
        payment_status: log.payment_status || 'waived',
        status: log.status || 'granted',
        verification_method: log.verification_method || 'qr_dynamic',
        notes: log.notes
      };
    });

    res.json({ success: true, logs: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  generateDynamicPass,
  verifyPassAndCheckIn,
  getAttendanceLogs
};
