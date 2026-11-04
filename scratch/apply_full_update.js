const path = require('path');
const fs = require('fs');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const xs = require('../server/services/xenditService');

const storePath = path.join(__dirname, '../data/ksyn_store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

async function runFullUpdate() {
  console.log('=== STARTING STORE DATA INTEGRITY UPDATE ===');

  // 1. RECONCILE XENDIT INVOICES LIVE
  console.log('\n1. Reconciling Xendit invoices against live staging API...');
  const pendingInvoices = (store.payment_invoices || []).filter(inv => {
    return (inv.status === 'pending' || inv.status === 'PENDING') && inv.id && inv.id.length === 24;
  });

  let reconciledCount = 0;
  for (const inv of pendingInvoices) {
    try {
      const live = await xs.getInvoice(inv.id);
      if (live.status === 'PAID' || live.status === 'SETTLED') {
        console.log(`  -> Settled: ${inv.id} (${inv.invoice_no}) - ₱${inv.amount} for ${live.payer_email || inv.user_id}`);
        inv.status = 'settled';
        inv.settled_at = live.paid_at || new Date().toISOString();
        inv.payment_method = live.payment_method || 'xendit';
        inv.payment_channel = live.payment_channel || 'gcash';

        // Check if POS transaction
        const posTxn = (store.pos_transactions || []).find(t => t.invoice_id === inv.id || t.external_id === inv.invoice_no);
        if (posTxn) {
          posTxn.status = 'SETTLED';
          posTxn.settled_at = inv.settled_at;
        }

        // Check if matching sale exists
        const existingSale = (store.sales || []).find(s => 
          s.xendit_invoice_id === inv.id || 
          s.reference_no === inv.invoice_no ||
          s.invoice_number === inv.invoice_no
        );

        if (!existingSale) {
          const user = (store.users || []).find(u => u.id === inv.user_id || u.email === live.payer_email);
          const isPos = String(inv.invoice_no).startsWith('POS-');
          const isPt = String(inv.invoice_no).startsWith('PT-');
          const category = isPt ? 'personal_training' : (isPos ? 'merchandise' : 'membership_fee');
          
          const newSale = {
            id: require('crypto').randomUUID(),
            branch_id: inv.branch_id || 'b-mkt-01',
            user_id: user ? user.id : (inv.user_id || null),
            customer_name: user ? user.name : (live.payer_email || 'Valued Athlete'),
            amount: Number(inv.amount || live.amount),
            royalty_amount: Number((Number(inv.amount || live.amount) * 0.075).toFixed(2)),
            net_retained: Number((Number(inv.amount || live.amount) * 0.925).toFixed(2)),
            category,
            payment_method: 'xendit',
            payment_channel: (live.payment_channel || 'ewallet').toLowerCase(),
            description: live.description || (isPt ? 'Personal Training' : (isPos ? 'POS Retail Checkout' : 'Membership Plan')),
            reference_no: inv.invoice_no,
            reference_number: inv.invoice_no,
            invoice_number: inv.invoice_no,
            approval_code: inv.invoice_no,
            xendit_invoice_id: inv.id,
            created_at: live.paid_at || inv.created_at || new Date().toISOString()
          };

          if (!store.sales) store.sales = [];
          store.sales.unshift(newSale);
        }

        // Activate membership subscription
        if (inv.plan_id && inv.user_id) {
          const sub = (store.subscriptions || []).find(s => s.user_id === inv.user_id);
          if (sub) {
            sub.status = 'active';
            console.log(`     Activated subscription for member ${inv.user_id}`);
          }
        }
        reconciledCount++;
      }
    } catch (err) {
      console.error(`  Error checking ${inv.id}:`, err.message);
    }
  }
  console.log(`Xendit reconciliation complete: ${reconciledCount} invoices marked settled.`);

  // 2. PURGE MOCK SALES, PRESERVE AUTHENTIC SALES
  console.log('\n2. Cleaning mock sales from ledger...');
  const initialSalesCount = store.sales.length;
  store.sales = store.sales.filter(s => {
    // Drop synthetic loop card entries
    if (s.payment_method === 'card' && String(s.reference_no || '').startsWith('INV-2026-')) {
      return false;
    }
    // Drop synthetic del monte / tomas morato repetitions
    if (s.customer_name === 'Athlete Member (Del Monte)' || s.customer_name === 'Athlete Member (Tomas Morato)') {
      return false;
    }
    return true;
  });
  console.log(`Sales purged from ${initialSalesCount} down to ${store.sales.length} genuine actual sales.`);

  // 3. ENHANCE EQUIPMENT REGISTRY
  console.log('\n3. Structuring gym machinery equipment registry...');
  store.equipment_registry = [
    {
      id: 'eq-mkt-tm01',
      branch_id: 'b-mkt-01',
      name: 'Life Fitness Elevation Series Commercial Treadmills',
      category: 'cardio',
      model: 'Elevation SE3 HD Commercial',
      serial_number: 'LF-TM-2026-0041',
      total_units: 8,
      on_floor: 6,
      in_storage: 2,
      unit_value: 240000,
      status: 'operational',
      operating_hours_total: 22780,
      hours_since_last_service: 40,
      hours_interval_threshold: 500,
      days_interval_threshold: 180,
      last_serviced_at: '2026-10-26T13:59:41+00:00',
      maintenance_type: 'Usage Hours (Motor & Deck Lubrication)',
      assigned_technician: 'FitSupplyGym Engineering Team'
    },
    {
      id: 'eq-mkt-dap02',
      branch_id: 'b-mkt-01',
      name: 'Hammer Strength Dual Adjustable Pulley (Cable Station)',
      category: 'strength_machines',
      model: 'Select DAP-800 Dual Stack',
      serial_number: 'HS-DAP-2025-1102',
      total_units: 4,
      on_floor: 3,
      in_storage: 1,
      unit_value: 310000,
      status: 'under_maintenance',
      operating_hours_total: 1200,
      hours_since_last_service: 95,
      hours_interval_threshold: null,
      days_interval_threshold: 90,
      last_serviced_at: '2026-07-10T00:00:00Z',
      maintenance_type: 'Calendar Days (High-Tensile Cable & Bearing Inspection)',
      assigned_technician: 'Technician Rolando Reyes'
    },
    {
      id: 'eq-mkt-row03',
      branch_id: 'b-mkt-01',
      name: 'Concept2 RowErg PM5 Commercial (Cardio Loft)',
      category: 'cardio',
      model: 'RowErg Model D (PM5 Monitor)',
      serial_number: 'C2-ROW-2026-8819',
      total_units: 6,
      on_floor: 5,
      in_storage: 1,
      unit_value: 78000,
      status: 'operational',
      operating_hours_total: 210,
      hours_since_last_service: 210,
      hours_interval_threshold: 250,
      days_interval_threshold: 90,
      last_serviced_at: '2026-09-01T00:00:00Z',
      maintenance_type: 'Usage Hours (Nickel-Plated Chain Oiling)',
      assigned_technician: 'FitSupplyGym Engineering Team'
    },
    {
      id: 'eq-mkt-pr04',
      branch_id: 'b-mkt-01',
      name: 'Eleiko IPF Commercial Power Rack & Olympic Platform',
      category: 'free_weights',
      model: 'Eleiko Prestera Heavy Power Rack',
      serial_number: 'EL-PR-2026-0012',
      total_units: 5,
      on_floor: 4,
      in_storage: 1,
      unit_value: 195000,
      status: 'operational',
      operating_hours_total: 0,
      hours_since_last_service: 0,
      hours_interval_threshold: null,
      days_interval_threshold: 60,
      last_serviced_at: '2026-09-01T00:00:00Z',
      maintenance_type: 'Calendar Days (Anchor Bolt Torque & Structural Rigidity)',
      assigned_technician: 'Facility Operations Lead'
    },
    {
      id: 'eq-mkt-bb05',
      branch_id: 'b-mkt-01',
      name: 'Rogue Olympic Competition Barbell & Bumper Sets',
      category: 'free_weights',
      model: 'Rogue Ohio Bar (Cerakote Black)',
      serial_number: 'ROG-OB-2026-090',
      total_units: 12,
      on_floor: 10,
      in_storage: 2,
      unit_value: 42000,
      status: 'operational',
      operating_hours_total: 0,
      hours_since_last_service: 15,
      days_interval_threshold: 90,
      last_serviced_at: '2026-09-15T00:00:00Z',
      maintenance_type: 'Bushing Inspection & Sleeve Rotation',
      assigned_technician: 'Facility Operations Lead'
    },
    {
      id: 'eq-mkt-db06',
      branch_id: 'b-mkt-01',
      name: 'Urethane Dumbbell Pairs Full Set & 3-Tier Rack (5-100 lbs)',
      category: 'free_weights',
      model: 'Commercial Urethane Hex Dumbbell Set',
      serial_number: 'UD-SET-2026-01',
      total_units: 2,
      on_floor: 2,
      in_storage: 0,
      unit_value: 180000,
      status: 'operational',
      operating_hours_total: 0,
      hours_since_last_service: 20,
      days_interval_threshold: 90,
      last_serviced_at: '2026-09-10T00:00:00Z',
      maintenance_type: 'Weld & Fastener Inspection',
      assigned_technician: 'Facility Operations Lead'
    },
    {
      id: 'eq-mkt-bn07',
      branch_id: 'b-mkt-01',
      name: 'Heavy Duty Multi-Angle Incline/Flat Workout Benches',
      category: 'free_weights',
      model: 'Ironmaster Super Bench Pro V2',
      serial_number: 'IM-BN-2026-0033',
      total_units: 10,
      on_floor: 8,
      in_storage: 2,
      unit_value: 28000,
      status: 'operational',
      operating_hours_total: 0,
      hours_since_last_service: 10,
      days_interval_threshold: 90,
      last_serviced_at: '2026-09-20T00:00:00Z',
      maintenance_type: 'Padding Vinyl & Pivot Pin Check',
      assigned_technician: 'Facility Operations Lead'
    },
    {
      id: 'eq-mkt-gt08',
      branch_id: 'b-mkt-01',
      name: 'Fastlane Optical Turnstiles (Access Control Gate A & B)',
      category: 'facility_access',
      model: 'Fastlane Glasswing Optical Speed Gate',
      serial_number: 'FL-GW-2026-104',
      total_units: 2,
      on_floor: 2,
      in_storage: 0,
      unit_value: 350000,
      status: 'operational',
      operating_hours_total: 3120,
      hours_since_last_service: 25,
      days_interval_threshold: 60,
      last_serviced_at: '2026-10-01T00:00:00Z',
      maintenance_type: 'Optical Sensor Calibration & Motor Brake',
      assigned_technician: 'Turnstile Systems Specialist'
    }
  ];
  console.log(`Equipment registry set with ${store.equipment_registry.length} gym equipment assets.`);

  // 4. ENHANCE POS RETAIL & BAR INVENTORY
  console.log('\n4. Structuring POS retail & bar inventory with floor vs storage stock...');
  const posItems = (store.inventory || []).filter(i => i.branch_id === 'b-mkt-01');
  posItems.forEach(item => {
    // Ensure healthy non-zero quantities for active POS items
    if (item.quantity === 0) {
      item.quantity = Math.max(item.reorder_threshold * 2, 8);
    }
    // 50-60% on bar floor, rest in storage pantry
    const floorQty = Math.ceil(item.quantity * 0.55);
    const storageQty = item.quantity - floorQty;
    item.floor_stock = floorQty;
    item.storage_stock = storageQty;
    item.status = item.quantity <= item.reorder_threshold ? 'low_stock' : 'in_stock';
  });
  console.log(`Updated ${posItems.length} POS items with floor_stock and storage_stock.`);

  // SAVE BACK TO STORE
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log('\n=== STORE FILE SAVED SUCCESSFULLY! ===');
}

runFullUpdate();
