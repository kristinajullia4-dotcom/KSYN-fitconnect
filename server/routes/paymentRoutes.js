const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const xenditController = require('../controllers/xenditController');
const memberController = require('../controllers/memberController');
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const { qaSandboxGuard } = require('../middleware/qaSandboxGuard');
const xenditRoutes = require('./xenditRoutes');

// 0. Xendit Enterprise Payment Gateway Sub-Router
router.use('/xendit', xenditRoutes);

// Dedicated Segregated Transaction Streams Endpoints
router.post('/plans/subscribe', authGuard, xenditController.subscribeMembershipPlan);
router.post('/pt/enroll-checkout', authGuard, memberController.initiatePtEnrollment);
router.post('/webhooks/xendit', xenditController.handleWebhook);

// 1. Zero-PAN Card Tokenization & 3D Secure Challenge (Public / Onboarding)
router.post('/tokenize-card', paymentController.tokenizeCard);
router.post('/verify-3ds', paymentController.verify3DSecure);

// 2. E-Wallet Recurring Billing Agreements (GCash / Maya)
router.post('/create-billing-agreement', paymentController.createBillingAgreement);

// 3. Dynamic QR Ph Generation (Prepaid / One-Time Passes)
router.post('/generate-qr-ph', paymentController.generateDynamicQrPh);

// 4. HMAC-SHA256 Webhook Listener
router.post('/webhook', paymentController.handlePaymentWebhook);

// 5. Unified 5-Step Member Onboarding Pipeline
router.post('/onboard-member', paymentController.onboardMember);

// 5.1 Authenticated Member Pending Payment Settlement
router.post('/settle-member-payment', authGuard, paymentController.settleMemberPayment);

// 6. Automated Recurring Billing Trigger (1st / 15th Simulation)
router.post('/trigger-recurring-billing', authGuard, rbacGuard('super_admin', 'branch_admin'), paymentController.triggerRecurringBilling);

// 7. Member Payment Methods Management
router.get('/methods/:userId', authGuard, paymentController.getPaymentMethods);
router.delete('/methods/:methodId', authGuard, paymentController.deletePaymentMethod);

// 8. Payment Invoices Ledger
router.get('/invoices', authGuard, paymentController.getInvoices);

// 9. Segregated Xendit Transactions Ledger (PLANS, POS, PT ENROLLMENT)
router.get('/transactions', authGuard, paymentController.getXenditTransactions);
router.post('/simulate-paid', authGuard, qaSandboxGuard, paymentController.simulateInvoicePaid);
router.get('/reconcile', authGuard, paymentController.reconcileXenditInvoices);
router.post('/reconcile', authGuard, paymentController.reconcileXenditInvoices);

module.exports = router;
