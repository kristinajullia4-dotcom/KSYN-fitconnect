const crypto = require('crypto');
const { memoryStore, query, isPostgres, saveStore } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');

// 1. Get Inventory Items (Tenant Isolated with PostgreSQL Support)
async function getInventory(req, res) {
  try {
    const user = req.user;

    if (isPostgres()) {
      let sql = `
        SELECT i.id, i.branch_id, i.item_name, i.sku, i.category, i.quantity, i.reorder_level AS reorder_threshold,
               i.unit_price, i.supplier, i.status, i.created_at,
               b.name AS branch_name, b.code AS branch_code,
               (i.quantity <= i.reorder_level) AS is_low_stock
        FROM inventory i
        LEFT JOIN branches b ON i.branch_id = b.id
      `;
      const params = [];
      if (user.role !== 'super_admin') {
        sql += ' WHERE i.branch_id = $1';
        params.push(user.branch_id);
      }
      sql += ' ORDER BY i.item_name ASC';
      const result = await query(sql, params);
      return res.json({ success: true, inventory: result.rows });
    }

    let items = [...(memoryStore.inventory || [])];

    if (user.role !== 'super_admin') {
      items = items.filter(i => i.branch_id === user.branch_id);
    }

    const restockRequests = memoryStore.inventory_restock_requests || [];

    const enriched = items.map(item => {
      const branch = memoryStore.branches.find(b => b.id === item.branch_id);
      const pendingRestock = restockRequests.find(
        r => r.equipment_id === item.id && ['Pending HQ Review', 'Approved', 'Dispatched'].includes(r.status)
      );

      return {
        ...item,
        branch_name: branch ? branch.name : 'Unknown',
        branch_code: branch ? branch.code : '',
        is_low_stock: item.quantity <= item.reorder_threshold,
        pending_restock: pendingRestock || null
      };
    });

    res.json({ success: true, inventory: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Add Item to Branch Inventory
async function addInventoryItem(req, res) {
  try {
    const user = req.user;
    const { item_name, sku, category = 'weights', quantity = 0, reorder_threshold = 5, unit_price = 0.00, branch_id } = req.body;

    const targetBranchId = user.role === 'super_admin' ? (branch_id || memoryStore.branches[0].id) : user.branch_id;

    if (!item_name) {
      return res.status(400).json({ success: false, message: 'Item name is required.' });
    }

    const qty = Number(quantity);
    const threshold = Number(reorder_threshold);

    const floorQty = req.body.floor_stock !== undefined ? Math.max(0, Number(req.body.floor_stock)) : Math.ceil(qty * 0.55);
    const storageQty = req.body.storage_stock !== undefined ? Math.max(0, Number(req.body.storage_stock)) : (qty - floorQty);

    const newItem = {
      id: crypto.randomUUID(),
      branch_id: targetBranchId,
      item_name,
      sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
      category,
      quantity: floorQty + storageQty,
      floor_stock: floorQty,
      storage_stock: storageQty,
      reorder_threshold: threshold,
      unit_price: Number(unit_price),
      status: (floorQty + storageQty) <= threshold ? 'low_stock' : 'in_stock',
      last_inspected_at: new Date(),
      created_at: new Date()
    };

    if (!memoryStore.inventory) memoryStore.inventory = [];
    memoryStore.inventory.push(newItem);
    saveStore();

    await logAuditEvent({
      branch_id: targetBranchId,
      user_id: user.id,
      user_role: user.role,
      action: 'INVENTORY_ADD',
      resource: 'inventory',
      ip_address: req.ip || '127.0.0.1',
      details: { item_name: newItem.item_name, quantity: qty }
    });

    res.status(201).json({ success: true, message: 'Item added to inventory.', item: newItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Update Item Quantity & Status
async function updateInventoryItem(req, res) {
  try {
    const { itemId } = req.params;
    const { quantity, status, item_name, floor_stock, storage_stock } = req.body;
    const user = req.user;

    const item = (memoryStore.inventory || []).find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    // Tenant Isolation
    if (user.role !== 'super_admin' && user.branch_id !== item.branch_id) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation.' });
    }

    if (floor_stock !== undefined) {
      item.floor_stock = Math.max(0, Number(floor_stock));
    }
    if (storage_stock !== undefined) {
      item.storage_stock = Math.max(0, Number(storage_stock));
    }

    if (quantity !== undefined) {
      item.quantity = Math.max(0, Number(quantity));
      if (floor_stock === undefined && storage_stock === undefined) {
        // Automatically partition across bar floor and storage pantry
        item.floor_stock = Math.ceil(item.quantity * 0.55);
        item.storage_stock = item.quantity - item.floor_stock;
      }
    } else if (floor_stock !== undefined || storage_stock !== undefined) {
      item.quantity = (item.floor_stock || 0) + (item.storage_stock || 0);
    }

    if (item.quantity <= (item.reorder_threshold || 5)) {
      item.status = 'low_stock';
    } else if (item.status === 'low_stock') {
      item.status = 'in_stock';
    }

    if (status) {
      item.status = status;
    }
    if (item_name) {
      item.item_name = item_name;
    }
    item.last_inspected_at = new Date();
    saveStore();

    await logAuditEvent({
      branch_id: item.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: 'INVENTORY_UPDATE',
      resource: 'inventory',
      ip_address: req.ip || '127.0.0.1',
      details: { item_id: item.id, new_quantity: item.quantity, floor_stock: item.floor_stock, storage_stock: item.storage_stock, status: item.status }
    });

    res.json({ success: true, message: 'Inventory item updated.', item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Submit Equipment Restock Request (Branch Admin Protected)
async function createReorderRequest(req, res) {
  try {
    const user = req.user;
    const { equipmentId, requestedQty = 1, urgency = 'Normal', notes = '', itemType } = req.body;

    if (!equipmentId) {
      return res.status(400).json({ success: false, message: 'equipmentId is required.' });
    }

    const qty = Math.max(1, parseInt(requestedQty, 10) || 1);
    
    // Check in POS Inventory first
    let item = (memoryStore.inventory || []).find(i => i.id === equipmentId);
    let resolvedItemType = 'pos_item';
    let itemName = '';
    let itemSku = '';
    let currentStock = 0;
    let branchId = '';

    if (item) {
      resolvedItemType = 'pos_item';
      itemName = item.item_name;
      itemSku = item.sku || 'SKU-POS';
      currentStock = item.quantity;
      branchId = item.branch_id || user.branch_id || 'b-mkt-01';
    } else {
      // Check in Equipment Registry (Gym Floor Machinery)
      const eq = (memoryStore.equipment_registry || []).find(e => e.id === equipmentId);
      if (eq) {
        resolvedItemType = 'machinery';
        itemName = eq.name;
        itemSku = eq.model || eq.serial_number || 'MACHINERY';
        currentStock = eq.total_units || 1;
        branchId = eq.branch_id || user.branch_id || 'b-mkt-01';
      } else {
        return res.status(404).json({ success: false, message: 'Item or machinery not found in registry.' });
      }
    }

    // Tenant Isolation Guard
    if (user.role !== 'super_admin' && user.branch_id && user.branch_id !== branchId) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation: cannot request restock for other branches.' });
    }

    const branch = (memoryStore.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : (user.branch_name || 'KSYN Makati Flagship');
    const normalizedUrgency = (urgency === 'Critical' || urgency === 'Urgent Replacement') ? 'Critical' : 'Normal';

    const newRequest = {
      id: crypto.randomUUID(),
      branch_id: branchId,
      equipment_id: equipmentId,
      item_type: resolvedItemType,
      item_name: itemName,
      sku: itemSku,
      current_stock: currentStock,
      requested_quantity: qty,
      urgency: normalizedUrgency,
      status: 'Pending HQ Review',
      delivery_status: 'PENDING_APPROVAL',
      expected_delivery_date: null,
      expected_restock_date: null,
      delivery_notes: null,
      discrepancy: null,
      requested_by: user.name || user.email || 'Branch Admin',
      notes: notes ? String(notes).trim() : '',
      hq_notes: null,
      created_at: new Date(),
      resolved_at: null
    };

    if (!memoryStore.inventory_restock_requests) {
      memoryStore.inventory_restock_requests = [];
    }
    memoryStore.inventory_restock_requests.unshift(newRequest);

    // Broadcast HQ telemetry notification
    if (!memoryStore.notifications) {
      memoryStore.notifications = [];
    }
    memoryStore.notifications.unshift({
      id: crypto.randomUUID(),
      target_role: 'super_admin',
      title: `${resolvedItemType === 'machinery' ? 'Gym Machinery' : 'POS Retail'} Restock Request`,
      message: `${branchName} requested restock of ${itemName} (${qty} units).`,
      category: 'PROCUREMENT',
      created_at: new Date(),
      read: false
    });

    saveStore();

    // Audit logging
    await logAuditEvent({
      branch_id: branchId,
      user_id: user.id,
      user_role: user.role,
      action: 'INVENTORY_RESTOCK_REQUEST',
      resource: 'inventory',
      ip_address: req.ip || '127.0.0.1',
      details: {
        requestId: newRequest.id,
        item_name: itemName,
        requested_qty: qty,
        urgency: normalizedUrgency,
        item_type: resolvedItemType
      }
    });

    res.status(201).json({
      success: true,
      message: `Restock request for "${itemName}" submitted to Super Admin HQ.`,
      request: {
        ...newRequest,
        branch_name: branchName,
        branch_code: branch ? branch.code : 'MKT-01'
      }
    });
  } catch (err) {
    console.error('[createReorderRequest Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Get Procurement Feed (Super Admin Protected)
async function getProcurementFeed(req, res) {
  try {
    const user = req.user;
    let requests = [...(memoryStore.inventory_restock_requests || [])];

    // If branch admin queries, filter strictly to their branch
    if (user.role !== 'super_admin') {
      requests = requests.filter(r => r.branch_id === user.branch_id);
    }

    const enriched = requests.map(r => {
      const branch = (memoryStore.branches || []).find(b => b.id === r.branch_id);
      const item = (memoryStore.inventory || []).find(i => i.id === r.equipment_id);
      const eq = (memoryStore.equipment_registry || []).find(e => e.id === r.equipment_id);

      return {
        ...r,
        branch_name: branch ? branch.name : 'Unknown Branch',
        branch_code: branch ? branch.code : 'N/A',
        current_stock: item ? item.quantity : (eq ? eq.total_units : r.current_stock)
      };
    });

    res.json({ success: true, requests: enriched });
  } catch (err) {
    console.error('[getProcurementFeed Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Update Procurement Request Status (Super Admin Protected)
async function updateProcurementRequest(req, res) {
  try {
    const user = req.user;
    const { requestId } = req.params;
    const {
      status,
      hqNotes,
      expected_delivery_date,
      expected_restock_date,
      delivery_date,
      restock_date,
      delivery_notes
    } = req.body;

    const allowedStatuses = [
      'Pending HQ Review',
      'Approved',
      'Soon to be delivered',
      'Super Admin Out of Stock',
      'Delivered',
      'Dispatched',
      'Fulfilled',
      'Rejected'
    ];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    const restockRequests = memoryStore.inventory_restock_requests || [];
    const request = restockRequests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Procurement request not found.' });
    }

    if (status) {
      request.status = status;
      if (status === 'Fulfilled' || status === 'Rejected') {
        request.resolved_at = new Date();
      }
    }

    if (hqNotes !== undefined) {
      request.hq_notes = String(hqNotes).trim();
    }

    if (status === 'Soon to be delivered') {
      request.expected_delivery_date = expected_delivery_date || delivery_date || request.expected_delivery_date || new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
      request.delivery_notes = delivery_notes || hqNotes || request.delivery_notes || '';
    } else if (status === 'Super Admin Out of Stock') {
      request.expected_restock_date = expected_restock_date || restock_date || request.expected_restock_date || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
      request.delivery_notes = delivery_notes || hqNotes || request.delivery_notes || '';
    } else if (status === 'Delivered') {
      request.delivered_at = new Date();
    }

    // Push notification to Branch Admin so updates are immediately visible in notifications
    if (!memoryStore.notifications) memoryStore.notifications = [];
    const notifTitleMap = {
      'Soon to be delivered': 'Delivery Scheduled from Super Admin HQ',
      'Super Admin Out of Stock': 'Item Out of Stock at Super Admin HQ',
      'Delivered': 'Shipment Delivered to Branch - Verification Required',
      'Rejected': 'Procurement Requisition Disapproved by HQ',
      'Fulfilled': 'Procurement Order Fulfilled & Closed'
    };
    const notifMsgMap = {
      'Soon to be delivered': `HQ scheduled delivery of ${request.item_name} (${request.requested_quantity} units) for ${request.expected_delivery_date || 'In 2 Days'}.${request.delivery_notes ? ' Notes: ' + request.delivery_notes : ''}`,
      'Super Admin Out of Stock': `HQ marked ${request.item_name} as Out of Stock. Estimated restock: ${request.expected_restock_date || 'Next Week'}.${request.delivery_notes ? ' Notes: ' + request.delivery_notes : ''}`,
      'Delivered': `HQ marked shipment of ${request.item_name} (${request.requested_quantity} units) as Delivered. Please recount and verify shipment into stock.`,
      'Rejected': `HQ disapproved requisition for ${request.item_name} (${request.requested_quantity} units). Reason: ${request.hq_notes || 'Disapproved by Super Admin HQ.'}`,
      'Fulfilled': `Procurement request for ${request.item_name} has been completed.`
    };
    if (notifTitleMap[status]) {
      memoryStore.notifications.unshift({
        id: crypto.randomUUID(),
        target_role: 'branch_admin',
        branch_id: request.branch_id,
        title: notifTitleMap[status],
        message: notifMsgMap[status],
        category: 'PROCUREMENT',
        created_at: new Date(),
        read: false
      });
    }

    // If status becomes 'Fulfilled', automatically increment stock
    if (status === 'Fulfilled') {
      if (request.item_type === 'machinery') {
        const eq = (memoryStore.equipment_registry || []).find(e => e.id === request.equipment_id);
        if (eq) {
          eq.in_storage = (Number(eq.in_storage) || 0) + (Number(request.requested_quantity) || 1);
          eq.total_units = (Number(eq.total_units) || 0) + (Number(request.requested_quantity) || 1);
        }
      } else {
        const item = (memoryStore.inventory || []).find(i => i.id === request.equipment_id);
        if (item) {
          item.quantity += Number(request.requested_quantity) || 0;
          if (item.quantity > item.reorder_threshold && item.status === 'low_stock') {
            item.status = 'in_stock';
          }
          item.last_inspected_at = new Date();
        }
      }
    }

    saveStore();

    await logAuditEvent({
      branch_id: request.branch_id,
      user_id: user.id,
      user_role: user.role,
      action: `PROCUREMENT_${(status || 'UPDATE').toUpperCase()}`,
      resource: 'inventory',
      ip_address: req.ip || '127.0.0.1',
      details: {
        requestId,
        new_status: request.status,
        expected_delivery_date: request.expected_delivery_date,
        expected_restock_date: request.expected_restock_date,
        hq_notes: request.hq_notes,
        item_name: request.item_name
      }
    });

    const branch = (memoryStore.branches || []).find(b => b.id === request.branch_id);
    const item = (memoryStore.inventory || []).find(i => i.id === request.equipment_id);
    const eq = (memoryStore.equipment_registry || []).find(e => e.id === request.equipment_id);

    res.json({
      success: true,
      message: `Procurement request marked as "${request.status}".`,
      request: {
        ...request,
        branch_name: branch ? branch.name : 'Unknown Branch',
        branch_code: branch ? branch.code : 'N/A',
        current_stock: item ? item.quantity : (eq ? eq.total_units : request.current_stock)
      }
    });
  } catch (err) {
    console.error('[updateProcurementRequest Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Get Branch-Specific Reorder Requests (Enriched with Live Current Stock)
async function getBranchReorderRequests(req, res) {
  try {
    const user = req.user;
    const branchId = user.role === 'super_admin' ? req.query.branch_id : user.branch_id;

    let requests = [...(memoryStore.inventory_restock_requests || [])];
    if (branchId) {
      requests = requests.filter(r => r.branch_id === branchId);
    }

    const enriched = requests.map(r => {
      const branch = (memoryStore.branches || []).find(b => b.id === r.branch_id);
      const item = (memoryStore.inventory || []).find(i => i.id === r.equipment_id);
      const eq = (memoryStore.equipment_registry || []).find(e => e.id === r.equipment_id);
      return {
        ...r,
        branch_name: branch ? branch.name : 'Unknown Branch',
        branch_code: branch ? branch.code : 'N/A',
        current_stock: item ? item.quantity : (eq ? eq.total_units : r.current_stock)
      };
    });

    res.json({ success: true, requests: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Branch Admin Verification & Recount of Delivered Shipment (Accept / Discrepancy Note)
async function verifyReorderShipment(req, res) {
  try {
    const user = req.user;
    const { requestId } = req.params;
    const { verification_type, shortage_qty = 0, damage_notes = '' } = req.body;

    const restockRequests = memoryStore.inventory_restock_requests || [];
    const request = restockRequests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Procurement shipment request not found.' });
    }

    if (user.role !== 'super_admin' && user.branch_id && user.branch_id !== request.branch_id) {
      return res.status(403).json({ success: false, message: 'Tenant isolation violation.' });
    }

    const branch = (memoryStore.branches || []).find(b => b.id === request.branch_id);
    const branchName = branch ? branch.name : (user.branch_name || 'Branch');

    if (verification_type === 'ACCEPTED') {
      const addedQty = Number(request.requested_quantity) || 1;
      
      if (request.item_type === 'machinery') {
        const eq = (memoryStore.equipment_registry || []).find(e => e.id === request.equipment_id);
        if (eq) {
          eq.in_storage = (Number(eq.in_storage) || 0) + addedQty;
          eq.total_units = (Number(eq.total_units) || 0) + addedQty;
        }
      } else {
        const item = (memoryStore.inventory || []).find(i => i.id === request.equipment_id);
        if (item) {
          item.storage_stock = (Number(item.storage_stock) || 0) + addedQty;
          item.quantity = (Number(item.quantity) || 0) + addedQty;
          if (item.quantity > (item.reorder_threshold || 5)) {
            item.status = 'in_stock';
          }
          item.last_inspected_at = new Date();
        }
      }

      request.status = 'Verified & Accepted';
      request.verified_at = new Date();
      request.verified_by = user.name || user.email || 'Branch Admin';
      request.resolved_at = new Date();

      if (!memoryStore.notifications) memoryStore.notifications = [];
      memoryStore.notifications.unshift({
        id: crypto.randomUUID(),
        target_role: 'super_admin',
        title: 'Shipment Verified & Recounted',
        message: `${branchName} verified & accepted delivery of ${request.item_name} (+${addedQty} units added to active stock).`,
        category: 'PROCUREMENT',
        created_at: new Date(),
        read: false
      });

      saveStore();

      return res.json({
        success: true,
        message: `Delivery verified! ${addedQty} units of "${request.item_name}" recounted and added to club stock.`,
        request
      });
    } else {
      const shortage = Math.max(0, parseInt(shortage_qty, 10) || 0);
      const notes = String(damage_notes || '').trim();

      request.status = 'Discrepancy Reported (Kulang / Damaged)';
      request.discrepancy = {
        shortage_qty: shortage,
        damage_notes: notes,
        reported_by: user.name || user.email || 'Branch Admin',
        reported_at: new Date()
      };

      if (!memoryStore.notifications) memoryStore.notifications = [];
      memoryStore.notifications.unshift({
        id: crypto.randomUUID(),
        target_role: 'super_admin',
        title: 'SHIPMENT DISCREPANCY: Kulang / Damaged',
        message: `${branchName} reported discrepancy on ${request.item_name}: ${shortage > 0 ? shortage + ' units missing (kulang). ' : ''}${notes}`,
        category: 'PROCUREMENT_DISCREPANCY',
        created_at: new Date(),
        read: false
      });

      saveStore();

      return res.json({
        success: true,
        message: `Discrepancy note logged and escalated to Super Admin HQ for ${request.item_name}.`,
        request
      });
    }
  } catch (err) {
    console.error('[verifyReorderShipment Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  createReorderRequest,
  getProcurementFeed,
  updateProcurementRequest,
  getBranchReorderRequests,
  verifyReorderShipment
};
