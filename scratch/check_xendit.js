const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const xs = require('../server/services/xenditService');

async function checkInvoice() {
  try {
    const res = await xs.getInvoice('6ae1b726c031fa0d89cb38ea');
    console.log('Invoice details:', {
      id: res.id,
      status: res.status,
      amount: res.amount,
      payer_email: res.payer_email,
      description: res.description,
      payment_method: res.payment_method,
      paid_at: res.paid_at
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkInvoice();
