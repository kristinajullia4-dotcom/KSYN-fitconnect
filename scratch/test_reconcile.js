const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const xs = require('../server/services/xenditService');
const fs = require('fs');

const storePath = path.join(__dirname, '../data/ksyn_store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

async function reconcileInvoices() {
  const pendingInvoices = (store.payment_invoices || []).filter(inv => {
    return (inv.status === 'pending' || inv.status === 'PENDING') && inv.id && inv.id.length === 24;
  });

  console.log(`Checking ${pendingInvoices.length} pending Xendit invoices...`);
  let updatedCount = 0;

  for (const inv of pendingInvoices) {
    try {
      const live = await xs.getInvoice(inv.id);
      if (live.status === 'PAID' || live.status === 'SETTLED') {
        console.log(`[PAID ON XENDIT] ${inv.id} (${inv.invoice_no}) - Amount: ₱${inv.amount} - User: ${live.payer_email || inv.user_id}`);
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

        // Check if matching sale exists in sales
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
          console.log(`  -> Recorded new real sale: ${newSale.id} (₱${newSale.amount})`);
        } else {
          console.log(`  -> Existing sale found: ${existingSale.id}`);
        }

        // Activate subscription if membership plan
        if (inv.plan_id && inv.user_id) {
          const sub = (store.subscriptions || []).find(s => s.user_id === inv.user_id);
          if (sub) {
            sub.status = 'active';
            console.log(`  -> Activated subscription for member ${inv.user_id}`);
          }
        }

        updatedCount++;
      }
    } catch (err) {
      console.error(`Error checking ${inv.id}:`, err.message);
    }
  }

  console.log(`Reconciliation complete! Updated ${updatedCount} invoices.`);
}

reconcileInvoices();
