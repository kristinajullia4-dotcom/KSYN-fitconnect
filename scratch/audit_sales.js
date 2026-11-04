const store = require('../data/ksyn_store.json');

console.log('Total sales:', store.sales.length);
const realSales = store.sales.filter(s => {
  // Check if it's one of the synthetic card test transactions
  if (s.payment_method === 'card' && String(s.reference_no || '').startsWith('INV-2026-')) {
    return false;
  }
  return true;
});

console.log('Real sales count:', realSales.length);
console.log('Mock/synthetic sales to remove:', store.sales.length - realSales.length);

console.log('\nBreakdown of real sales:');
realSales.forEach(s => {
  console.log(`[${s.created_at?.slice(0, 16)}] ${s.payment_method || 'none'} | ₱${s.amount} | ${s.customer_name || s.user_id || 'User'} | Ref: ${s.reference_no || s.xendit_invoice_id || 'None'} | ${s.category || ''}`);
});
