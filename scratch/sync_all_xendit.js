const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const xs = require('../server/services/xenditService');
const store = require('../data/ksyn_store.json');

async function syncAllPending() {
  const pendingInvoices = (store.payment_invoices || []).filter(inv => {
    return (inv.status === 'pending' || inv.status === 'PENDING') && inv.id && inv.id.length === 24;
  });

  console.log(`Checking ${pendingInvoices.length} pending Xendit invoices...`);
  const results = [];

  for (const inv of pendingInvoices) {
    try {
      const live = await xs.getInvoice(inv.id);
      results.push({
        id: inv.id,
        invoice_no: inv.invoice_no,
        amount: inv.amount,
        liveStatus: live.status,
        paid_at: live.paid_at,
        payment_method: live.payment_method,
        payment_channel: live.payment_channel,
        payer_email: live.payer_email
      });
    } catch (err) {
      results.push({
        id: inv.id,
        error: err.message
      });
    }
  }

  console.log('Results:');
  console.log(JSON.stringify(results, null, 2));
}

syncAllPending();
