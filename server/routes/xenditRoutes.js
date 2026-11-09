const express = require('express');
const router = express.Router();
const xenditController = require('../controllers/xenditController');
const posCheckoutController = require('../controllers/posCheckoutController');
const paymentController = require('../controllers/paymentController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const { qaSandboxGuard } = require('../middleware/qaSandboxGuard');

// 1. Gateway Client Configuration
router.get('/config', xenditController.getConfig);

// 2. Unified Hosted Checkout Invoice (Cards, GCash, Maya, QR Ph, BDO, BPI)
router.post('/create-invoice', xenditController.createInvoice);

// 3. Dynamic QR Ph Generation (1-Day Pass / Protein Shake Bar POS Orders)
router.post('/create-qr', xenditController.createDynamicQr);

// 4. Tokenized Card Charge & Auto-Debit Binding (Authenticated Members)
router.post('/charge-card', authGuard, xenditController.chargeCard);

// 5. Xendit Webhook Receiver (HMAC & Token Verification)
router.post('/webhook', xenditController.handleWebhook);

// 6. Automated Recurring Billing Trigger (1st / 15th of the month)
router.post('/trigger-recurring', authGuard, rbacGuard('super_admin', 'branch_admin'), xenditController.triggerRecurringBilling);

// 7. Dynamic QR Ph Polling Status & Simulation Check (Hardened in Production)
router.get('/qr-status/:id', xenditController.getQrStatus);
router.post('/simulate-qr-paid/:id', qaSandboxGuard, xenditController.simulateQrPaid);

// 8. Confirm Payment & Settle Membership Access
router.post('/confirm-payment', xenditController.confirmPayment);

// 9. Invoice Polling Status
router.get('/invoice-status/:id', xenditController.getInvoiceStatus);
router.get('/status/:invoiceId', posCheckoutController.getStatus);
router.post('/simulate-invoice-paid/:invoiceId', qaSandboxGuard, posCheckoutController.simulatePaid);

// 10. Segregated Digital Transactions Ledger (PLANS, POS, PT ENROLLMENT)
router.get('/transactions', authGuard, paymentController.getXenditTransactions);
router.post('/simulate-paid', authGuard, qaSandboxGuard, paymentController.simulateInvoicePaid);
router.get('/reconcile', authGuard, paymentController.reconcileXenditInvoices);
router.post('/reconcile', authGuard, paymentController.reconcileXenditInvoices);

module.exports = router;
