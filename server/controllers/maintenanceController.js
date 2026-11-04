const crypto = require('crypto');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

// Initialize Maintenance & IoT Stores
function initMaintenanceStore() {
  if (!memoryStore.equipment_registry) {
    memoryStore.equipment_registry = [
      {
        id: 'eq-mkt-tm01',
        branch_id: 'b-mkt-01',
        name: 'Life Fitness Elevation Series Treadmill (Zone 1)',
        category: 'cardio',
        model: 'Elevation SE3 HD',
        serial_number: 'LF-TM-2026-0041',
        installed_date: '2026-01-01',
        operating_hours_total: 485,
        hours_since_last_service: 485,
        hours_interval_threshold: 500, // Treadmill motor & deck lubrication every 500 hrs
        days_interval_threshold: 180,
        last_serviced_at: '2026-01-01T00:00:00Z',
        maintenance_type: 'Usage Hours (Motor & Deck Lubrication)',
        assigned_technician: 'FitSupplyGym Engineering Team',
        status: 'warning', // 485 / 500 hrs -> approaching 500h limit!
        checklist: [
          'Lubricate phenolic deck with 100% silicone emulsion',
          'Inspect drive belt tension and motor commutator brushes',
          'Calibrate optical speed sensor and elevation motor potentiometer',
          'Vacuum motor compartment dust buildup'
        ]
      },
      {
        id: 'eq-mkt-dap02',
        branch_id: 'b-mkt-01',
        name: 'Hammer Strength Dual Adjustable Pulley (Cable Station A)',
        category: 'strength_cables',
        model: 'Select DAP-800',
        serial_number: 'HS-DAP-2025-1102',
        installed_date: '2026-01-01',
        operating_hours_total: 1200,
        hours_since_last_service: 0,
        hours_interval_threshold: null,
        days_interval_threshold: 90, // Cable tension & integrity check every 90 days
        last_serviced_at: '2026-01-10T00:00:00Z',
        maintenance_type: 'Calendar Days (High-Tensile Cable & Bearing Inspection)',
        assigned_technician: 'Technician Rolando Reyes',
        status: 'critical', // > 90 days since Jan 10!
        checklist: [
          'Inspect 7x19 mil-spec aircraft cable for fraying, kink or outer nylon stripping',
          'Check cable termination fittings and weight stack pin insertion',
          'Grease sealed ball bearing pulleys with synthetic PTFE grease',
          'Verify smooth guide rod travel with non-grease silicone lubricant'
        ]
      },
      {
        id: 'eq-mkt-row03',
        branch_id: 'b-mkt-01',
        name: 'Concept2 RowErg PM5 (Cardio Loft)',
        category: 'cardio',
        model: 'RowErg Model D',
        serial_number: 'C2-ROW-2026-8819',
        installed_date: '2026-01-01',
        operating_hours_total: 210,
        hours_since_last_service: 210,
        hours_interval_threshold: 250, // Chain oiling & shock cord recoil inspection every 250 hrs
        days_interval_threshold: 90,
        last_serviced_at: '2026-01-01T00:00:00Z',
        maintenance_type: 'Usage Hours (Nickel-Plated Chain Oiling)',
        assigned_technician: 'FitSupplyGym Engineering Team',
        status: 'optimal',
        checklist: [
          'Apply 20W non-detergent oil along full length of drive chain',
          'Check shock cord tension and return mechanism',
          'Clean monorail stainless steel track with damp cloth',
          'Update PM5 firmware and verify optical flywheel tachometer'
        ]
      },
      {
        id: 'eq-mkt-pr04',
        branch_id: 'b-mkt-01',
        name: 'Eleiko IPF Power Rack & Olympic Platform (Plates Area)',
        category: 'free_weights',
        model: 'Eleiko Prestera Power Rack',
        serial_number: 'EL-PR-2026-0012',
        installed_date: '2026-01-01',
        operating_hours_total: 0,
        hours_since_last_service: 0,
        hours_interval_threshold: null,
        days_interval_threshold: 60, // Bolt torque & platform inspection every 60 days
        last_serviced_at: '2026-09-01T00:00:00Z',
        maintenance_type: 'Calendar Days (Anchor Bolt Torque & Structural Rigidity)',
        assigned_technician: 'Facility Operations Lead',
        status: 'optimal',
        checklist: [
          'Torque frame anchor bolts and cross-members to 85 Nm',
          'Inspect magnetic J-Cup polyurethane wear liners',
          'Check band pegs, safety strap pins, and pull-up knurling',
          'Inspect oak drop platform surface for splintering or delamination'
        ]
      }
    ];
  }

  if (!memoryStore.maintenance_work_orders) {
    memoryStore.maintenance_work_orders = [
      {
        id: 'wo-2026-001',
        equipment_id: 'eq-mkt-dap02',
        equipment_name: 'Hammer Strength Dual Adjustable Pulley (Cable Station A)',
        branch_id: 'b-mkt-01',
        priority: 'CRITICAL',
        status: 'Dispatched',
        trigger_reason: '90-Day Periodic Cable Tension & Bearing Inspection Overdue',
        assigned_technician: 'Technician Rolando Reyes (FitSupplyGym Certified)',
        estimated_downtime_hours: 1.5,
        scheduled_for: new Date(Date.now() + 86400000),
        created_at: new Date(Date.now() - 86400000 * 2),
        checklist_progress: [
          { task: 'Inspect 7x19 aircraft cable for fraying or sleeve separation', done: true },
          { task: 'Check weight stack selector pin and magnetic lock', done: true },
          { task: 'Lubricate sealed ball bearing pulleys', done: false },
          { task: 'Verify smooth guide rod travel', done: false }
        ]
      }
    ];
  }

  if (!memoryStore.equipment_iot_telemetry) {
    memoryStore.equipment_iot_telemetry = [];
  }
}

initMaintenanceStore();

// 1. Get Equipment Maintenance Registry & Health Telemetry
async function getEquipmentRegistry(req, res) {
  try {
    initMaintenanceStore();
    const user = req.user;

    if (isPostgres()) {
      let sql = 'SELECT * FROM equipment_registry';
      const params = [];
      if (user.role !== 'super_admin' && user.branch_id) {
        sql += ' WHERE branch_id = $1';
        params.push(user.branch_id);
      }
      sql += ' ORDER BY name ASC';
      const dbRes = await query(sql, params);
      if (dbRes.rows.length > 0) {
        return res.json({ success: true, equipment: dbRes.rows, schedules: dbRes.rows });
      }
    }
    let list = [...memoryStore.equipment_registry];

    if (user.role !== 'super_admin' && user.branch_id) {
      list = list.filter(e => e.branch_id === user.branch_id || !e.branch_id);
    }

    const now = Date.now();

    // Enforce dynamic status computation
    const enriched = list.map(eq => {
      const daysSince = eq.last_serviced_at
        ? Math.floor((now - new Date(eq.last_serviced_at).getTime()) / (86400000))
        : 90;

      let hoursPct = 0;
      if (eq.hours_interval_threshold) {
        hoursPct = Math.min(100, Math.round((eq.hours_since_last_service / eq.hours_interval_threshold) * 100));
      }

      let daysPct = 0;
      if (eq.days_interval_threshold) {
        daysPct = Math.min(100, Math.round((daysSince / eq.days_interval_threshold) * 100));
      }

      let dynamicStatus = 'optimal';
      if (hoursPct >= 100 || daysPct >= 100) {
        dynamicStatus = 'critical';
      } else if (hoursPct >= 85 || daysPct >= 85) {
        dynamicStatus = 'warning';
      }

      const activeWorkOrder = (memoryStore.maintenance_work_orders || []).find(
        wo => wo.equipment_id === eq.id && wo.status !== 'Completed'
      );

      const effectiveStatus = (eq.status === 'under_maintenance' || eq.status === 'critical') 
        ? eq.status 
        : (activeWorkOrder ? 'under_maintenance' : dynamicStatus);

      return {
        ...eq,
        days_since_last_service: daysSince,
        hours_utilization_percent: hoursPct,
        days_utilization_percent: daysPct,
        status: effectiveStatus,
        active_work_order: activeWorkOrder || null
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      equipment: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Ingest IoT Sensor Telemetry (Operating hours, motor temp, vibration)
async function recordIoTTelemetry(req, res) {
  try {
    initMaintenanceStore();
    const {
      equipment_id,
      runtime_hours_added = 0,
      total_hours,
      vibration_index_mms = 1.2,
      motor_temperature_celsius = 42.5,
      device_gateway_id = 'GW-MKT-IOT-01'
    } = req.body;

    if (!equipment_id) {
      return res.status(400).json({ success: false, message: 'Equipment ID is required.' });
    }

    const eq = memoryStore.equipment_registry.find(e => e.id === equipment_id);
    if (!eq) {
      return res.status(404).json({ success: false, message: 'Equipment item not found in registry.' });
    }

    const addedHours = Number(runtime_hours_added) || 0;
    if (total_hours !== undefined) {
      eq.operating_hours_total = Number(total_hours);
    } else {
      eq.operating_hours_total += addedHours;
    }
    eq.hours_since_last_service += addedHours;

    const logEntry = {
      id: `iot-${Date.now()}`,
      equipment_id,
      equipment_name: eq.name,
      gateway: device_gateway_id,
      runtime_hours_added: addedHours,
      operating_hours_total: eq.operating_hours_total,
      hours_since_last_service: eq.hours_since_last_service,
      vibration_index_mms: Number(vibration_index_mms),
      motor_temperature_celsius: Number(motor_temperature_celsius),
      recorded_at: new Date()
    };

    memoryStore.equipment_iot_telemetry.unshift(logEntry);

    // Automated Dispatch Rule: Check if threshold breached
    let autoDispatched = false;
    let workOrder = null;

    if (eq.hours_interval_threshold && eq.hours_since_last_service >= eq.hours_interval_threshold) {
      const existingWO = memoryStore.maintenance_work_orders.find(
        w => w.equipment_id === eq.id && w.status !== 'Completed'
      );

      if (!existingWO) {
        workOrder = {
          id: `wo-auto-${Date.now().toString().slice(-6)}`,
          equipment_id: eq.id,
          equipment_name: eq.name,
          branch_id: eq.branch_id,
          priority: 'CRITICAL',
          status: 'Dispatched',
          trigger_reason: `Automated IoT Alert: Motor runtime threshold reached (${eq.hours_since_last_service}h / ${eq.hours_interval_threshold}h limit)`,
          assigned_technician: eq.assigned_technician,
          estimated_downtime_hours: 2.0,
          scheduled_for: new Date(Date.now() + 86400000),
          created_at: new Date(),
          checklist_progress: (eq.checklist || []).map(task => ({ task, done: false }))
        };

        memoryStore.maintenance_work_orders.unshift(workOrder);
        autoDispatched = true;

        await logAuditEvent({
          branch_id: eq.branch_id,
          user_id: req.user?.id || 'iot-gateway',
          user_role: 'system',
          action: 'EQUIPMENT_MAINTENANCE_AUTO_DISPATCH',
          resource: `WORK_ORDER:${workOrder.id}`,
          ip_address: req.ip || '127.0.0.1',
          details: {
            equipment: eq.name,
            hours: eq.hours_since_last_service,
            threshold: eq.hours_interval_threshold
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `IoT telemetry recorded for ${eq.name}.`,
      telemetry: logEntry,
      threshold_breached: autoDispatched,
      automated_work_order: workOrder
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Get Work Orders List
async function getWorkOrders(req, res) {
  try {
    initMaintenanceStore();
    const user = req.user;
    let orders = [...memoryStore.maintenance_work_orders];

    if (user.role !== 'super_admin' && user.branch_id) {
      orders = orders.filter(o => o.branch_id === user.branch_id || !o.branch_id);
    }

    res.json({
      success: true,
      count: orders.length,
      work_orders: orders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Create Technician Work Order
async function createWorkOrder(req, res) {
  try {
    initMaintenanceStore();
    const user = req.user;
    const { equipment_id, priority = 'HIGH', trigger_reason, assigned_technician, checklist = [] } = req.body;

    if (!equipment_id || !trigger_reason) {
      return res.status(400).json({ success: false, message: 'Equipment ID and trigger reason are required.' });
    }

    const eq = memoryStore.equipment_registry.find(e => e.id === equipment_id);
    if (!eq) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    const newWO = {
      id: `wo-${Date.now().toString().slice(-6)}`,
      equipment_id: eq.id,
      equipment_name: eq.name,
      branch_id: eq.branch_id,
      priority,
      status: 'Dispatched',
      trigger_reason: trigger_reason.trim(),
      assigned_technician: (assigned_technician || eq.assigned_technician || 'FitSupplyGym Team').trim(),
      estimated_downtime_hours: 1.5,
      scheduled_for: new Date(Date.now() + 86400000),
      created_at: new Date(),
      created_by: user.name,
      checklist_progress: (checklist.length > 0 ? checklist : eq.checklist).map(t => ({ task: t, done: false }))
    };

    memoryStore.maintenance_work_orders.unshift(newWO);

    await logAuditEvent({
      branch_id: eq.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'WORK_ORDER_DISPATCHED',
      resource: `WORK_ORDER:${newWO.id}`,
      ip_address: req.ip || '127.0.0.1',
      details: { equipment: eq.name, priority, reason: trigger_reason }
    });

    res.status(201).json({
      success: true,
      message: `Work order dispatched to ${newWO.assigned_technician}.`,
      work_order: newWO
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Complete Work Order & Sign-off Inspection
async function completeWorkOrder(req, res) {
  try {
    initMaintenanceStore();
    const user = req.user;
    const { id } = req.params;
    const { technician_notes = '', replaced_parts = [], sign_off_pin } = req.body;

    const order = memoryStore.maintenance_work_orders.find(w => w.id === id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    const eq = memoryStore.equipment_registry.find(e => e.id === order.equipment_id);
    if (eq) {
      // Reset operating hours counter and update last service date
      eq.hours_since_last_service = 0;
      eq.last_serviced_at = new Date();
      eq.status = 'optimal';
    }

    order.status = 'Completed';
    order.completed_at = new Date();
    order.technician_notes = technician_notes.trim() || 'All preventive maintenance checks passed factory specifications.';
    order.replaced_parts = Array.isArray(replaced_parts) ? replaced_parts : [];
    order.signed_off_by = user.name;
    order.checklist_progress.forEach(t => t.done = true);

    await logAuditEvent({
      branch_id: order.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'WORK_ORDER_COMPLETED',
      resource: `WORK_ORDER:${order.id}`,
      ip_address: req.ip || '127.0.0.1',
      details: {
        equipment: order.equipment_name,
        technician: order.assigned_technician,
        notes: order.technician_notes
      }
    });

    res.json({
      success: true,
      message: `Maintenance service completed and signed off for ${order.equipment_name}.`,
      work_order: order,
      equipment_status: eq ? eq.status : 'optimal'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Add Gym Equipment Asset
async function addEquipment(req, res) {
  try {
    initMaintenanceStore();
    const user = req.user;
    const {
      name,
      category = 'strength_machines',
      model,
      serial_number,
      total_units = 1,
      on_floor,
      in_storage,
      unit_value = 0,
      status = 'operational',
      assigned_technician
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Equipment name is required.' });
    }

    const branch_id = user.role === 'super_admin' ? (req.body.branch_id || 'b-mkt-01') : user.branch_id;
    const totalUnits = Math.max(1, Number(total_units) || 1);
    const onFloor = on_floor !== undefined ? Math.max(0, Number(on_floor)) : totalUnits;
    const inStorage = in_storage !== undefined ? Math.max(0, Number(in_storage)) : Math.max(0, totalUnits - onFloor);

    const newEq = {
      id: `eq-${Date.now().toString().slice(-6)}`,
      branch_id: branch_id || 'b-mkt-01',
      name: name.trim(),
      category: category || 'strength_machines',
      model: model ? model.trim() : 'Commercial Grade',
      serial_number: serial_number ? serial_number.trim() : `EQ-SN-${Date.now().toString().slice(-4)}`,
      total_units: onFloor + inStorage,
      on_floor: onFloor,
      in_storage: inStorage,
      unit_value: Number(unit_value) || 0,
      status: status === 'under_maintenance' ? 'under_maintenance' : 'operational',
      operating_hours_total: 0,
      hours_since_last_service: 0,
      days_interval_threshold: 90,
      last_serviced_at: new Date().toISOString(),
      maintenance_type: 'General Inspection & Maintenance',
      assigned_technician: (assigned_technician || 'FitSupplyGym Engineering Team').trim()
    };

    if (!memoryStore.equipment_registry) memoryStore.equipment_registry = [];
    memoryStore.equipment_registry.push(newEq);
    saveStore();

    await logAuditEvent({
      branch_id: newEq.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'EQUIPMENT_ADD',
      resource: `EQUIPMENT:${newEq.id}`,
      ip_address: req.ip || '127.0.0.1',
      details: { name: newEq.name, total_units: newEq.total_units, on_floor: newEq.on_floor, in_storage: newEq.in_storage }
    });

    res.status(201).json({ success: true, message: 'Equipment added to registry.', equipment: newEq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Update Equipment Asset Details, Counts, or Status
async function updateEquipment(req, res) {
  try {
    initMaintenanceStore();
    const { id } = req.params;
    const { status, on_floor, in_storage, total_units, name, unit_value } = req.body;
    const user = req.user;

    const eq = (memoryStore.equipment_registry || []).find(e => e.id === id);
    if (!eq) {
      return res.status(404).json({ success: false, message: 'Equipment not found in registry.' });
    }

    if (user.role !== 'super_admin' && user.branch_id !== eq.branch_id) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation.' });
    }

    if (status !== undefined) {
      eq.status = (status === 'under_maintenance' || status === 'critical') ? 'under_maintenance' : 'operational';
    }
    if (name !== undefined) eq.name = name.trim();
    if (unit_value !== undefined) eq.unit_value = Number(unit_value);

    if (on_floor !== undefined) eq.on_floor = Math.max(0, Number(on_floor));
    if (in_storage !== undefined) eq.in_storage = Math.max(0, Number(in_storage));
    if (total_units !== undefined) {
      eq.total_units = Math.max(1, Number(total_units));
      if (on_floor === undefined && in_storage === undefined) {
        eq.on_floor = Math.min(eq.total_units, eq.on_floor || eq.total_units);
        eq.in_storage = Math.max(0, eq.total_units - eq.on_floor);
      }
    } else if (on_floor !== undefined || in_storage !== undefined) {
      eq.total_units = (eq.on_floor || 0) + (eq.in_storage || 0);
    }

    saveStore();

    await logAuditEvent({
      branch_id: eq.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'EQUIPMENT_UPDATE',
      resource: `EQUIPMENT:${eq.id}`,
      ip_address: req.ip || '127.0.0.1',
      details: { name: eq.name, status: eq.status, on_floor: eq.on_floor, in_storage: eq.in_storage }
    });

    res.json({ success: true, message: 'Equipment updated.', equipment: eq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getEquipmentRegistry,
  recordIoTTelemetry,
  getWorkOrders,
  createWorkOrder,
  completeWorkOrder,
  addEquipment,
  updateEquipment
};
