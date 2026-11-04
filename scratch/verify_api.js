const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const jwt = require('../server/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ksyn-super-secure-jwt-secret-key-production-grade';

// Sign token for branch admin of b-mkt-01
const token = jwt.sign({
  id: 'u1000000-0000-0000-0000-000000000001',
  name: 'Elena Rostova (Makati Flagship Admin)',
  email: 'makati.admin@ksyn.com',
  role: 'branch_admin',
  branch_id: 'b-mkt-01',
  branch_name: 'KSYN Fitness Makati Flagship',
  branch_code: 'MKT-01'
}, JWT_SECRET, { expiresIn: '1h' });

async function verifyEndpoints() {
  console.log('Testing Endpoints with Authenticated Branch Admin Token:');

  // 1. Health
  const healthRes = await fetch('http://localhost:5080/api/health');
  const healthData = await healthRes.json();
  console.log('1. Health check:', healthData.status);

  // 2. Equipment registry
  const eqRes = await fetch('http://localhost:5080/api/inventory/maintenance/schedules', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const eqData = await eqRes.json();
  console.log('2. Equipment registry:', eqData.success, 'Count:', eqData.equipment?.length || eqData.schedules?.length);
  if (eqData.equipment) {
    console.log('   First equipment:', eqData.equipment[0]?.name, '- Total:', eqData.equipment[0]?.total_units, '- Floor:', eqData.equipment[0]?.on_floor, '- Storage:', eqData.equipment[0]?.in_storage);
  }

  // 3. POS inventory
  const invRes = await fetch('http://localhost:5080/api/inventory', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const invData = await invRes.json();
  console.log('3. POS inventory:', invData.success, 'Count:', invData.inventory?.length);
  if (invData.inventory) {
    console.log('   First POS item:', invData.inventory[0]?.item_name, '- Total:', invData.inventory[0]?.quantity, '- Floor:', invData.inventory[0]?.floor_stock, '- Storage:', invData.inventory[0]?.storage_stock);
  }

  // 4. Ledger
  const ledgerRes = await fetch('http://localhost:5080/api/branch-admin/ledger?timeframe=year', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const ledgerData = await ledgerRes.json();
  console.log('4. Sales ledger:', ledgerData.success, 'Entries:', ledgerData.ledger?.length);
  console.log('   Gross Total:', ledgerData.summary?.grossTotal, 'Net Total:', ledgerData.summary?.netTotal);

  // 5. Xendit Reconcile
  const reconRes = await fetch('http://localhost:5080/api/payments/xendit/reconcile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reconData = await reconRes.json();
  console.log('5. Xendit Reconcile:', reconData.success, reconData.message);

  // 6. Xendit Transactions
  const xnRes = await fetch('http://localhost:5080/api/payments/xendit/transactions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const xnData = await xnRes.json();
  console.log('6. Xendit Transactions Ledger:', xnData.success, 'Plans:', xnData.categories?.plans?.length, 'POS:', xnData.categories?.pos?.length, 'PT:', xnData.categories?.pt_enrollments?.length);
  const julliaTxn = xnData.all?.find(t => t.customer_email === 'jullia@gmail.com' || t.customer_name === 'jullia' || t.external_id === 'inv_ksyn_1793177382268');
  console.log('   Jullia transaction status:', julliaTxn ? `${julliaTxn.external_id} | ₱${julliaTxn.amount} | Status: ${julliaTxn.status}` : 'Not found');
}

verifyEndpoints().catch(console.error);
