const { WebSocketServer } = require('ws');
const { memoryStore, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

let wss = null;
const connectedHardware = new Map(); // terminalId -> { ws, info, connectedAt, lastPing }
let lastRelayPulseEvent = null;

// RA 9514 (Fire Code of the Philippines) Life-Safety Physical Egress State
let emergencyEgressState = {
  is_active: false,
  branch_id: null,
  reason: null,
  triggered_by: null,
  triggered_at: null,
  duration_minutes: 60,
  expires_at: null,
  solenoid_state: 'LOCKED',
  statute: 'RA 9514 Fire Code of the Philippines Life-Safety Egress Standard'
};

/**
 * Checks whether an emergency egress override is currently active for a branch
 */
function isEmergencyEgressActive(branchId = null) {
  if (!emergencyEgressState.is_active) return false;
  if (emergencyEgressState.expires_at && new Date() > new Date(emergencyEgressState.expires_at)) {
    emergencyEgressState.is_active = false;
    emergencyEgressState.solenoid_state = 'LOCKED';
    return false;
  }
  if (!emergencyEgressState.branch_id || emergencyEgressState.branch_id === 'GLOBAL' || emergencyEgressState.branch_id === 'ALL') {
    return true;
  }
  return !branchId || emergencyEgressState.branch_id === branchId;
}

/**
 * Activates Life-Safety Physical Egress Override
 * De-energizes fail-safe magnetic/solenoid locks to allow unobstructed mass evacuation.
 */
async function activateEmergencyEgress({
  branchId = 'GLOBAL',
  reason = 'Fire Alarm / Emergency Evacuation Protocol (RA 9514)',
  triggeredBy = 'Station Commander / Facility Admin',
  durationMinutes = 60,
  userRole = 'super_admin',
  userId = 'u-admin-emergency',
  ipAddress = '127.0.0.1'
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (Number(durationMinutes) || 60) * 60000);

  emergencyEgressState = {
    is_active: true,
    branch_id: branchId || 'GLOBAL',
    reason: reason,
    triggered_by: triggeredBy,
    triggered_at: now.toISOString(),
    duration_minutes: Number(durationMinutes) || 60,
    expires_at: expiresAt.toISOString(),
    solenoid_state: 'SOLENOID_HOLD_OPEN',
    statute: 'RA 9514 Fire Code of the Philippines Life-Safety Egress Standard'
  };

  const egressPacket = {
    event: 'EMERGENCY_EGRESS_ACTIVE',
    command: 'SOLENOID_HOLD_OPEN',
    status: 'DE_ENERGIZED_UNLOCKED',
    branch_id: branchId || 'GLOBAL',
    reason,
    banner: 'EMERGENCY PROTOCOL ACTIVE: TURNSTILE GATES HELD UNLOCKED FOR EGRESS',
    timestamp: Date.now()
  };

  let signaledControllers = 0;
  for (const [id, client] of connectedHardware.entries()) {
    if (client.ws && client.ws.readyState === 1) {
      if (branchId === 'GLOBAL' || !client.info.branch_id || client.info.branch_id === branchId) {
        client.ws.send(JSON.stringify(egressPacket));
        client.info.relay_state = 'SOLENOID_HOLD_OPEN';
        signaledControllers++;
      }
    }
  }

  // Active Critical Red Broadcast Banner across all client dashboards
  if (!memoryStore.broadcasts) memoryStore.broadcasts = [];
  const existingBcast = memoryStore.broadcasts.find(b => b.id === 'bcast-emergency-egress');
  if (existingBcast) {
    existingBcast.is_active = true;
    existingBcast.updated_at = now;
  } else {
    memoryStore.broadcasts.unshift({
      id: 'bcast-emergency-egress',
      title: 'EMERGENCY LIFE-SAFETY PROTOCOL (RA 9514)',
      message: 'EMERGENCY PROTOCOL ACTIVE: TURNSTILE GATES HELD UNLOCKED FOR EGRESS',
      audience: 'ALL',
      priority: 'CRITICAL',
      theme: 'RED_EMERGENCY',
      branch_id: branchId,
      is_active: true,
      created_at: now
    });
  }

  // SHA-256 Back-linked Audit Trail
  await logAuditEvent({
    branch_id: branchId === 'GLOBAL' ? 'GLOBAL' : branchId,
    user_id: userId,
    user_role: userRole,
    action: 'EMERGENCY_LIFE_SAFETY_EGRESS_ACTIVATED',
    resource: 'turnstile_solenoid_barriers',
    ip_address: ipAddress,
    details: {
      reason,
      duration_minutes: durationMinutes,
      expires_at: emergencyEgressState.expires_at,
      solenoid_state: 'SOLENOID_HOLD_OPEN',
      signaled_controllers: signaledControllers,
      statute: 'RA 9514 Section 10.2.5.3 Unobstructed Egress Requirement'
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return {
    success: true,
    emergency_egress: emergencyEgressState,
    signaled_controllers: signaledControllers,
    banner: 'EMERGENCY PROTOCOL ACTIVE: TURNSTILE GATES HELD UNLOCKED FOR EGRESS'
  };
}

/**
 * Resets Life-Safety Egress Override and restores normal locking state
 */
async function deactivateEmergencyEgress({
  branchId = 'GLOBAL',
  resetBy = 'Safety Inspector / Admin',
  userRole = 'super_admin',
  userId = 'u-admin-reset',
  ipAddress = '127.0.0.1'
}) {
  emergencyEgressState.is_active = false;
  emergencyEgressState.solenoid_state = 'LOCKED';
  emergencyEgressState.expires_at = new Date().toISOString();

  const resetPacket = {
    event: 'EMERGENCY_EGRESS_RESET',
    command: 'SOLENOID_RESTORE_LOCKED',
    status: 'LOCKED',
    branch_id: branchId,
    timestamp: Date.now()
  };

  let signaledControllers = 0;
  for (const [id, client] of connectedHardware.entries()) {
    if (client.ws && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(resetPacket));
      client.info.relay_state = 'LOCKED';
      signaledControllers++;
    }
  }

  // Deactivate broadcast banner
  if (Array.isArray(memoryStore.broadcasts)) {
    const bcast = memoryStore.broadcasts.find(b => b.id === 'bcast-emergency-egress');
    if (bcast) bcast.is_active = false;
  }

  await logAuditEvent({
    branch_id: branchId === 'GLOBAL' ? 'GLOBAL' : branchId,
    user_id: userId,
    user_role: userRole,
    action: 'EMERGENCY_LIFE_SAFETY_EGRESS_DEACTIVATED',
    resource: 'turnstile_solenoid_barriers',
    ip_address: ipAddress,
    details: {
      reset_by: resetBy,
      solenoid_state: 'LOCKED',
      signaled_controllers: signaledControllers
    }
  });

  if (typeof saveStore === 'function') {
    saveStore();
  }

  return {
    success: true,
    message: 'Emergency egress override reset. Normal solenoid locking restored.',
    emergency_egress: emergencyEgressState
  };
}

/**
 * Initializes WebSocket Bridge on the existing Express HTTP Server
 */
function initTurnstileHardwareBridge(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: '/ws/turnstile' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const terminalKey = url.searchParams.get('terminal_key') || req.headers['x-terminal-key'] || 'HW-DEV-001';
    const branchId = url.searchParams.get('branch_id') || 'b-mkt-01';
    const terminalId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const hardwareInfo = {
      terminal_id: terminalId,
      terminal_key: terminalKey,
      branch_id: branchId,
      ip: req.socket.remoteAddress,
      device_type: 'ESP32 Solenoid Relay Controller (12V DC)',
      relay_state: 'LOCKED',
      connected_at: new Date(),
      last_heartbeat: new Date()
    };

    connectedHardware.set(terminalId, { ws, info: hardwareInfo });
    console.log(`[Turnstile Hardware Bridge] Controller connected: ${terminalId} (Branch: ${branchId})`);

    // Send connection greeting & configuration
    ws.send(JSON.stringify({
      type: 'INIT_ACK',
      status: 'CONNECTED',
      terminal_id: terminalId,
      relay_channel: 1,
      default_pulse_ms: 3000,
      timestamp: Date.now()
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'HEARTBEAT' || msg.type === 'PING') {
          hardwareInfo.last_heartbeat = new Date();
          if (msg.relay_state) hardwareInfo.relay_state = msg.relay_state;
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        } else if (msg.type === 'RELAY_ACK') {
          hardwareInfo.relay_state = msg.status || 'UNLOCKED';
          console.log(`[Hardware Bridge ACK] Solenoid Relay activated on ${terminalId}`);
        }
      } catch (err) {
        // ignore malformed ping
      }
    });

    ws.on('close', () => {
      connectedHardware.delete(terminalId);
      console.log(`[Turnstile Hardware Bridge] Controller disconnected: ${terminalId}`);
    });

    ws.on('error', (err) => {
      console.warn('[Turnstile Hardware Bridge Warning]:', err.message);
    });
  });

  console.log('[Turnstile Hardware Bridge] WebSocket Relay service active at ws://localhost:5080/ws/turnstile');
  return wss;
}

/**
 * Broadcast Solenoid Pulse to all connected hardware relays in the branch
 */
function broadcastRelayPulse({ branch_id, member_name, athlete_id, duration_ms = 3000, relay_channel = 1 }) {
  const pulsePacket = {
    event: 'RELAY_PULSE',
    command: 'PULSE_SOLENOID',
    relay_channel,
    duration_ms,
    branch_id: branch_id || 'b-mkt-01',
    athlete_name: member_name || 'Member',
    athlete_id: athlete_id || null,
    timestamp: Date.now()
  };

  lastRelayPulseEvent = pulsePacket;
  let sentCount = 0;

  for (const [id, client] of connectedHardware.entries()) {
    if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN
      if (!branch_id || client.info.branch_id === branch_id) {
        client.ws.send(JSON.stringify(pulsePacket));
        client.info.relay_state = 'PULSING_UNLOCKED';
        sentCount++;
      }
    }
  }

  console.log(`[Turnstile Solenoid Pulse]: Sent to ${sentCount} connected hardware kiosk(s) for ${member_name} (${duration_ms}ms pulse)`);
  return { delivered_controllers: sentCount, packet: pulsePacket };
}

// REST handler: Get Hardware Status Telemetry
function getHardwareStatus(req, res) {
  const list = [];
  for (const [id, item] of connectedHardware.entries()) {
    list.push({
      ...item.info,
      ready_state: item.ws.readyState
    });
  }

  res.json({
    success: true,
    active_controllers: list.length,
    controllers: list,
    last_relay_pulse: lastRelayPulseEvent
  });
}

// REST handler: Manual Staff Solenoid Trigger
async function triggerManualPulse(req, res) {
  try {
    const user = req.user;
    const { duration_ms = 3000, reason = 'Manual staff reception bypass' } = req.body;

    const result = broadcastRelayPulse({
      branch_id: user.branch_id || 'b-mkt-01',
      member_name: `Manual Staff Override (${user.name})`,
      athlete_id: user.id,
      duration_ms: Number(duration_ms) || 3000
    });

    await logAuditEvent({
      branch_id: user.branch_id || 'b-mkt-01',
      user_id: user.id,
      user_role: user.role,
      action: 'TURNSTILE_MANUAL_SOLENOID_TRIGGER',
      resource: 'turnstile_hardware',
      ip_address: req.ip || '127.0.0.1',
      details: {
        reason,
        duration_ms,
        controllers_signaled: result.delivered_controllers
      }
    });

    res.json({
      success: true,
      message: `Turnstile relay pulsed for ${duration_ms}ms.`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// REST handler: POST /api/emergency/egress-override
async function handleEmergencyEgressOverride(req, res) {
  try {
    const user = req.user;
    if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only super_admin or branch_admin roles may trigger emergency life-safety egress overrides.'
      });
    }

    const {
      branchId = user?.branch_id || 'GLOBAL',
      reason = 'Fire Alarm / Emergency Evacuation Protocol (RA 9514)',
      triggeredBy = user?.name || user?.email || 'Facility Administrator',
      durationMinutes = 60
    } = req.body || {};

    const result = await activateEmergencyEgress({
      branchId,
      reason,
      triggeredBy,
      durationMinutes,
      userRole: user?.role || 'super_admin',
      userId: user?.id || 'u-admin-emergency',
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(200).json({
      success: true,
      message: 'Life-safety emergency egress override activated under RA 9514. Barriers continuously de-energized.',
      ...result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// REST handler: POST /api/emergency/egress-reset
async function handleEmergencyEgressReset(req, res) {
  try {
    const user = req.user;
    if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only super_admin or branch_admin roles may reset emergency life-safety egress overrides.'
      });
    }

    const { branchId = user?.branch_id || 'GLOBAL' } = req.body || {};
    const result = await deactivateEmergencyEgress({
      branchId,
      resetBy: user?.name || user?.email || 'Safety Inspector / Admin',
      userRole: user?.role || 'super_admin',
      userId: user?.id || 'u-admin-reset',
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// REST handler: GET /api/emergency/egress-status
function handleGetEmergencyStatus(req, res) {
  return res.status(200).json({
    success: true,
    emergency_egress: emergencyEgressState,
    is_active: isEmergencyEgressActive(req.query.branch_id || null)
  });
}

module.exports = {
  initTurnstileHardwareBridge,
  broadcastRelayPulse,
  getHardwareStatus,
  triggerManualPulse,
  activateEmergencyEgress,
  deactivateEmergencyEgress,
  isEmergencyEgressActive,
  handleEmergencyEgressOverride,
  handleEmergencyEgressReset,
  handleGetEmergencyStatus
};
