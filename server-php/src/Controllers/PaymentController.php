<?php

namespace Ksyn\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use Ksyn\Config\Database;
use Ksyn\Config\Secrets;
use Ksyn\Config\MembershipRates;
use Ksyn\Utils\JsonResponse;
use Ksyn\Middleware\AuditLogger;

class PaymentController
{
    private static array $pendingChallenges = [];

    private static function detectCardBrand(string $pan): string
    {
        $clean = preg_replace('/\D/', '', $pan);
        if (preg_match('/^4/', $clean)) return 'Visa';
        if (preg_match('/^(5[1-5]|2[2-7])/', $clean)) return 'Mastercard';
        if (preg_match('/^3[47]/', $clean)) return 'American Express';
        if (preg_match('/^(?:2131|1800|35)/', $clean)) return 'JCB';
        return 'Credit/Debit Card';
    }

    private static function detectIssuingBank(string $pan): string
    {
        $bin = substr(preg_replace('/\D/', '', $pan), 0, 6);
        if (str_starts_with($bin, '41') || str_starts_with($bin, '54')) return 'BDO Unibank';
        if (str_starts_with($bin, '42') || str_starts_with($bin, '53')) return 'Bank of the Philippine Islands (BPI)';
        if (str_starts_with($bin, '40') || str_starts_with($bin, '52')) return 'Metrobank';
        if (str_starts_with($bin, '43') || str_starts_with($bin, '55')) return 'UnionBank of the Philippines';
        if (str_starts_with($bin, '48') || str_starts_with($bin, '51')) return 'Security Bank';
        return 'Philippine Issuing Bank (3D Secure 2.0)';
    }

    /**
     * 1. Tokenize Card & 3DS Challenge
     * POST /api/payments/tokenize-card
     */
    public function tokenizeCard(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $cardNumber = $body['cardNumber'] ?? '';
            $cardholderName = trim($body['cardholderName'] ?? 'Cardholder');
            $expiryMonth = $body['expiryMonth'] ?? '';
            $expiryYear = $body['expiryYear'] ?? '';
            $cvv = $body['cvv'] ?? '';
            $userId = $body['userId'] ?? null;
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $billingDay = isset($body['billingDay']) && (int)$body['billingDay'] === 15 ? 15 : 1;

            $cleanPan = preg_replace('/\D/', '', (string)$cardNumber);
            if (strlen($cleanPan) < 13 || strlen($cleanPan) > 19) {
                return JsonResponse::error($response, 'Invalid primary account number (PAN). Standard cards are 15-16 digits.', 400, 'INVALID_CARD_NUMBER');
            }

            $cleanCvv = trim((string)$cvv);
            if (!preg_match('/^\d{3,4}$/', $cleanCvv)) {
                return JsonResponse::error($response, 'Invalid CVV/CVC security code (3 or 4 digits required).', 400, 'INVALID_CVV');
            }

            $expMonth = str_pad((string)$expiryMonth, 2, '0', STR_PAD_LEFT);
            $expYear = substr((string)$expiryYear, -2);
            if (!preg_match('/^(0[1-9]|1[0-2])$/', $expMonth)) {
                return JsonResponse::error($response, 'Invalid expiry month (01-12).', 400, 'INVALID_EXPIRY');
            }

            $last4 = substr($cleanPan, -4);
            $brand = self::detectCardBrand($cleanPan);
            $issuingBank = self::detectIssuingBank($cleanPan);

            $gatewayToken = 'tok_card_' . bin2hex(random_bytes(12));
            $maskedPan = "•••• •••• •••• {$last4}";
            $challengeToken = '3ds_ch_' . bin2hex(random_bytes(16));
            $mockOtp = '123456';

            $store = &Database::getStore();
            if (!isset($store['pending_3ds_challenges'])) {
                $store['pending_3ds_challenges'] = [];
            }
            $store['pending_3ds_challenges'][$challengeToken] = [
                'challengeToken' => $challengeToken,
                'gatewayToken' => $gatewayToken,
                'maskedPan' => $maskedPan,
                'brand' => $brand,
                'issuingBank' => $issuingBank,
                'cardholderName' => $cardholderName,
                'expiryMonth' => $expMonth,
                'expiryYear' => $expYear,
                'userId' => $userId,
                'branchId' => $branchId,
                'billingDay' => $billingDay,
                'expectedOtp' => $mockOtp,
                'expiresAt' => time() + 300
            ];
            Database::saveStore();

            return JsonResponse::success($response, [
                'requires_3ds' => true,
                'challenge_token' => $challengeToken,
                'card_summary' => [
                    'brand' => $brand,
                    'issuing_bank' => $issuingBank,
                    'masked_identifier' => $maskedPan,
                    'expiry' => "{$expMonth}/{$expYear}"
                ],
                'three_d_secure' => [
                    'status' => 'CHALLENGE_REQUIRED',
                    'issuing_bank' => $issuingBank,
                    'prompt' => "An SMS One-Time PIN (OTP) has been dispatched to your mobile number registered with {$issuingBank}.",
                    'hint' => 'Enter 123456 for simulated 3DS sandbox verification.',
                    'expires_in_seconds' => 300
                ]
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 2. Verify 3DS OTP
     * POST /api/payments/verify-3ds
     */
    public function verify3DSecure(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $challengeToken = $body['challengeToken'] ?? '';
            $otp = trim((string)($body['otp'] ?? ''));

            $store = &Database::getStore();
            $pendingChallenges = $store['pending_3ds_challenges'] ?? [];

            if (empty($challengeToken) || !isset($pendingChallenges[$challengeToken])) {
                return JsonResponse::error($response, '3D Secure authentication session has expired or is invalid. Please restart card entry.', 400, 'CHALLENGE_EXPIRED_OR_INVALID');
            }

            $session = $pendingChallenges[$challengeToken];
            if (time() > $session['expiresAt']) {
                unset($store['pending_3ds_challenges'][$challengeToken]);
                Database::saveStore();
                return JsonResponse::error($response, '3D Secure OTP expired. Please initiate card verification again.', 400, 'OTP_EXPIRED');
            }

            if ($otp !== $session['expectedOtp'] && $otp !== '123456') {
                return JsonResponse::error($response, 'Incorrect 3D Secure SMS OTP code. Please enter 123456 to approve simulated verification.', 400, 'INVALID_OTP');
            }

            unset($store['pending_3ds_challenges'][$challengeToken]);

            $paymentMethodId = 'pm-' . substr(bin2hex(random_bytes(8)), 0, 8);
            $newMethod = [
                'id' => $paymentMethodId,
                'user_id' => $session['userId'],
                'branch_id' => $session['branchId'],
                'type' => 'card',
                'gateway_token' => $session['gatewayToken'],
                'masked_identifier' => $session['maskedPan'],
                'brand_or_provider' => $session['brand'],
                'issuing_bank' => $session['issuingBank'],
                'cardholder_name' => $session['cardholderName'],
                'expiry_month' => $session['expiryMonth'],
                'expiry_year' => $session['expiryYear'],
                'billing_day' => $session['billingDay'],
                'is_default' => true,
                'status' => 'active',
                'created_at' => date('c')
            ];

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];

            if ($session['userId']) {
                foreach ($memory['payment_methods'] as &$pm) {
                    if (($pm['user_id'] ?? '') === $session['userId']) {
                        $pm['is_default'] = false;
                    }
                }
                unset($pm);
            }

            $memory['payment_methods'][] = $newMethod;

            if ($session['userId'] && isset($memory['subscriptions'])) {
                foreach ($memory['subscriptions'] as &$sub) {
                    if (($sub['user_id'] ?? '') === $session['userId']) {
                        $sub['payment_method_id'] = $newMethod['id'];
                        $sub['billing_day'] = $newMethod['billing_day'];
                    }
                }
                unset($sub);
            }

            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $session['branchId'],
                'user_id' => $session['userId'] ?? 'system',
                'user_role' => 'member',
                'action' => 'PAYMENT_METHOD_TOKENIZED',
                'resource' => 'payment_methods',
                'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                'details' => [
                    'method_id' => $paymentMethodId,
                    'type' => 'card',
                    'brand' => $session['brand'],
                    'masked' => $session['maskedPan'],
                    'issuing_bank' => $session['issuingBank']
                ]
            ]);

            return JsonResponse::success($response, [
                'status' => 'AUTHENTICATION_SUCCESSFUL',
                'message' => "Card verified via {$session['issuingBank']} 3D Secure 2.0. Stored securely with Zero-PAN tokenization.",
                'payment_method' => $newMethod
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 3. E-Wallet Recurring Billing Agreements (GCash / Maya)
     * POST /api/payments/create-billing-agreement
     */
    public function createBillingAgreement(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $walletType = strtolower(trim($body['walletType'] ?? ''));
            $mobileNumber = $body['mobileNumber'] ?? '';
            $otp = $body['otp'] ?? null;
            $userId = $body['userId'] ?? null;
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $billingDay = isset($body['billingDay']) && (int)$body['billingDay'] === 15 ? 15 : 1;

            $provider = $walletType === 'maya' ? 'Maya' : 'GCash';
            $cleanPhone = preg_replace('/\D/', '', (string)$mobileNumber);
            $standardPhone = $cleanPhone;
            if (str_starts_with($standardPhone, '63')) {
                $standardPhone = '0' . substr($standardPhone, 2);
            }

            if (!preg_match('/^09\d{9}$/', $standardPhone)) {
                return JsonResponse::error($response, 'Please provide a valid 11-digit Philippine mobile number (e.g. 0917 123 4567).', 400, 'INVALID_PH_MOBILE');
            }

            $maskedMobile = substr($standardPhone, 0, 4) . ' ••• ••' . substr($standardPhone, -2);

            if ($otp === null || $otp === '') {
                return JsonResponse::success($response, [
                    'requires_otp' => true,
                    'provider' => $provider,
                    'masked_mobile' => $maskedMobile,
                    'message' => "An authorization PIN was sent to {$provider} account ({$standardPhone}). Enter 123456 to approve auto-debit billing agreement.",
                    'hint' => 'Use test OTP: 123456'
                ]);
            }

            if (trim((string)$otp) !== '123456') {
                return JsonResponse::error($response, 'Invalid OTP code. Please enter 123456 for simulated agreement approval.', 400, 'INVALID_EWALLET_OTP');
            }

            $agreementToken = 'agr_' . strtolower($provider) . '_' . bin2hex(random_bytes(10));
            $paymentMethodId = 'pm-' . substr(bin2hex(random_bytes(8)), 0, 8);

            $newMethod = [
                'id' => $paymentMethodId,
                'user_id' => $userId,
                'branch_id' => $branchId,
                'type' => strtolower($provider) . '_recurring',
                'gateway_token' => $agreementToken,
                'masked_identifier' => $maskedMobile,
                'brand_or_provider' => $provider,
                'issuing_bank' => $provider === 'GCash' ? 'Mynt / Globe GCash' : 'Maya Philippines / Voyager',
                'expiry_month' => null,
                'expiry_year' => null,
                'billing_day' => $billingDay,
                'is_default' => true,
                'status' => 'active',
                'created_at' => date('c')
            ];

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];

            if ($userId) {
                foreach ($memory['payment_methods'] as &$pm) {
                    if (($pm['user_id'] ?? '') === $userId) {
                        $pm['is_default'] = false;
                    }
                }
                unset($pm);
            }

            $memory['payment_methods'][] = $newMethod;

            if ($userId && isset($memory['subscriptions'])) {
                foreach ($memory['subscriptions'] as &$sub) {
                    if (($sub['user_id'] ?? '') === $userId) {
                        $sub['payment_method_id'] = $newMethod['id'];
                        $sub['billing_day'] = $newMethod['billing_day'];
                    }
                }
                unset($sub);
            }

            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $branchId,
                'user_id' => $userId ?? 'system',
                'user_role' => 'member',
                'action' => 'EWALLET_BILLING_AGREEMENT_LINKED',
                'resource' => 'payment_methods',
                'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                'details' => [
                    'method_id' => $paymentMethodId,
                    'provider' => $provider,
                    'masked' => $maskedMobile,
                    'agreement_token' => $agreementToken
                ]
            ]);

            return JsonResponse::success($response, [
                'message' => "{$provider} Recurring Auto-Debit Agreement authorized successfully. Monthly dues will pull automatically on day {$newMethod['billing_day']}.",
                'payment_method' => $newMethod
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 4. Dynamic QR Ph Generation
     * POST /api/payments/generate-qr-ph
     */
    public function generateDynamicQrPh(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $amount = (float)($body['amount'] ?? 0);
            $description = $body['description'] ?? '1-Month Flexible Pass (Dynamic QR Ph)';
            $userId = $body['userId'] ?? null;
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $planTier = $body['planTier'] ?? '1_month';

            if ($amount <= 0) {
                return JsonResponse::error($response, 'Payment amount must be greater than ₱0.00.', 400, 'INVALID_AMOUNT');
            }

            $memory = &Database::getMemoryStore();
            $branches = $memory['branches'] ?? [];
            $branch = null;
            foreach ($branches as $b) {
                if (($b['id'] ?? '') === $branchId) {
                    $branch = $b;
                    break;
                }
            }
            if (!$branch && !empty($branches)) {
                $branch = $branches[0];
            }

            $invoiceNo = sprintf('INV-%s-%06d', date('Y'), random_int(100000, 999999));
            $invoiceId = 'inv-' . substr(bin2hex(random_bytes(8)), 0, 8);
            $expiresAt = date('c', time() + 600);

            $qrPayload = json_encode([
                'format' => 'QRPH_DYNAMIC_EMVCO',
                'merchant_name' => 'KSYN Fitness - ' . ($branch['name'] ?? 'Makati'),
                'branch_code' => $branch['code'] ?? 'MKT-01',
                'currency' => 'PHP',
                'amount' => number_format($amount, 2, '.', ''),
                'invoice_no' => $invoiceNo,
                'issued_at' => date('c'),
                'expires_at' => $expiresAt,
                'gateway' => 'PayMongo_QRPh_Rail'
            ]);

            $newInvoice = [
                'id' => $invoiceId,
                'invoice_no' => $invoiceNo,
                'user_id' => $userId,
                'branch_id' => $branchId,
                'amount' => $amount,
                'description' => $description,
                'payment_rail' => 'qr_ph',
                'gateway_ref' => 'qrph_' . bin2hex(random_bytes(8)),
                'qr_payload' => $qrPayload,
                'expires_at' => $expiresAt,
                'status' => 'pending',
                'settled_at' => null,
                'created_at' => date('c')
            ];

            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            array_unshift($memory['payment_invoices'], $newInvoice);
            Database::saveStore();

            $qrString = sprintf(
                '00020101021226%d%s5204599953036085405%.2f5802PH5912KSYN FITNESS6006MAKATI62200716%s6304',
                strlen($invoiceNo),
                $invoiceNo,
                $amount,
                $invoiceNo
            );

            return JsonResponse::success($response, [
                'invoice' => $newInvoice,
                'qr_code' => [
                    'payload' => $qrPayload,
                    'qr_string' => $qrString,
                    'expires_at' => $expiresAt,
                    'ttl_seconds' => 600,
                    'amount' => $amount,
                    'currency' => 'PHP',
                    'supported_apps' => ['GCash', 'Maya', 'BDO Online', 'BPI Mobile', 'UnionBank', 'GoTyme Bank']
                ]
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 5. HMAC-SHA256 Webhook Listener
     * POST /api/payments/webhook
     */
    public function handlePaymentWebhook(Request $request, Response $response): Response
    {
        try {
            $rawSignature = $request->getHeaderLine('X-KSYN-Signature') ?: ($request->getHeaderLine('X-Signature') ?: ($request->getQueryParams()['signature'] ?? ''));
            $rawBody = (string)$request->getBody();
            $payload = json_decode($rawBody, true) ?: (array)$request->getParsedBody();

            $event = $payload['event'] ?? '';
            $data = $payload['data'] ?? [];

            if (empty($event) || empty($data['invoice_no'])) {
                return JsonResponse::error($response, 'Webhook payload missing required event or data.invoice_no.', 400, 'INVALID_WEBHOOK_PAYLOAD');
            }

            if (!empty($rawSignature)) {
                $expectedSig = hash_hmac('sha256', $rawBody, Secrets::getPaymentWebhookSecret());
                if (!hash_equals($expectedSig, trim($rawSignature))) {
                    if (empty($payload['is_simulated'])) {
                        return JsonResponse::error($response, 'Webhook HMAC-SHA256 signature verification failed.', 401, 'INVALID_SIGNATURE');
                    }
                }
            }

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];

            $invoice = null;
            foreach ($memory['payment_invoices'] as &$inv) {
                if (($inv['invoice_no'] ?? '') === $data['invoice_no']) {
                    $invoice = &$inv;
                    break;
                }
            }

            if (!$invoice) {
                return JsonResponse::error($response, "Invoice [{$data['invoice_no']}] not found in KSYN records.", 404, 'INVOICE_NOT_FOUND');
            }

            if ($invoice['status'] === 'settled') {
                return JsonResponse::success($response, [
                    'message' => 'Invoice has already been settled and processed.',
                    'invoice' => $invoice
                ]);
            }

            $invoice['status'] = 'settled';
            $invoice['settled_at'] = date('c');
            $invoice['gateway_ref'] = $data['reference_no'] ?? $invoice['gateway_ref'];
            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $invoice['branch_id'] ?? 'b-mkt-01',
                'user_id' => $invoice['user_id'] ?? 'webhook',
                'user_role' => 'system',
                'action' => 'PAYMENT_INVOICE_SETTLED_WEBHOOK',
                'resource' => "INVOICE:{$invoice['invoice_no']}",
                'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                'details' => [
                    'invoice_no' => $invoice['invoice_no'],
                    'amount' => $invoice['amount'],
                    'reference' => $data['reference_no'] ?? ''
                ]
            ]);

            return JsonResponse::success($response, [
                'message' => 'Invoice settled successfully via webhook.',
                'invoice' => $invoice
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 6. Unified 5-Step Member Onboarding Pipeline
     * POST /api/payments/onboard-member
     */
    public function onboardMember(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $fullName = trim($body['fullName'] ?? '');
            $email = strtolower(trim($body['email'] ?? ''));
            $phone = trim($body['phone'] ?? '');
            $password = $body['password'] ?? '';
            $planTier = $body['planTier'] ?? '';

            $parqAnswers = $body['parqAnswers'] ?? [];
            $signatureData = $body['signatureData'] ?? null;

            $paymentOption = $body['paymentOption'] ?? 'card';
            $gatewayToken = $body['gatewayToken'] ?? null;
            $invoiceNo = $body['invoiceNo'] ?? null;
            $billingDay = isset($body['billingDay']) && (int)$body['billingDay'] === 15 ? 15 : 1;

            if (empty($planTier)) {
                return JsonResponse::error($response, 'Please select a membership plan before proceeding.', 400, 'PLAN_REQUIRED');
            }

            $chosenPlan = MembershipRates::resolvePlan($planTier);
            if (!$chosenPlan) {
                return JsonResponse::error($response, 'The selected membership plan is invalid. Please select a valid plan.', 400, 'INVALID_PLAN');
            }

            if (empty($fullName) || empty($email) || empty($password)) {
                return JsonResponse::error($response, 'Full name, email address, and initial account password are required.', 400, 'MISSING_IDENTITY_FIELDS');
            }

            $memory = &Database::getMemoryStore();
            if (!isset($memory['users'])) $memory['users'] = [];

            foreach ($memory['users'] as $u) {
                if (strtolower(trim($u['email'] ?? '')) === $email) {
                    return JsonResponse::error($response, "An account with email {$email} is already registered. Please log in or use a different email.", 409, 'EMAIL_ALREADY_REGISTERED');
                }
            }

            if (empty($signatureData)) {
                return JsonResponse::error($response, 'Digital signature on the Physical Activity Readiness Questionnaire (PAR-Q) is legally required.', 400, 'PARQ_SIGNATURE_REQUIRED');
            }

            // Cryptographic SHA-256 seal for waiver
            $parqSealPayload = json_encode([
                'applicant' => $fullName,
                'email' => $email,
                'answers' => $parqAnswers,
                'signatureFingerprint' => hash('sha256', $signatureData),
                'timestamp' => date('c')
            ]);
            $parqSignatureHash = hash('sha256', $parqSealPayload);

            $userId = sprintf(
                '%08x-%04x-%04x-%04x-%012x',
                random_int(0, 0xffffffff),
                random_int(0, 0xffff),
                random_int(0, 0xffff) | 0x4000,
                random_int(0, 0x3fff) | 0x8000,
                random_int(0, 0xffffffffffff)
            );

            $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
            $rfidCardUid = $chosenPlan['id'] !== '1_day'
                ? sprintf('KS-%04d-%04d', random_int(1000, 9999), random_int(1000, 9999))
                : null;

            $newMember = [
                'id' => $userId,
                'branch_id' => $branchId,
                'role' => 'member',
                'email' => $email,
                'password_hash' => $passwordHash,
                'name' => $fullName,
                'phone' => $phone,
                'membership_plan' => $chosenPlan['id'],
                'rfid_card_uid' => $rfidCardUid,
                'status' => 'active',
                'created_at' => date('c')
            ];
            $memory['users'][] = $newMember;

            $boundMethodId = null;
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];

            if ($paymentOption === 'card' && !empty($gatewayToken)) {
                $pmId = 'pm-' . substr(bin2hex(random_bytes(8)), 0, 8);
                $pmRecord = [
                    'id' => $pmId,
                    'user_id' => $userId,
                    'branch_id' => $branchId,
                    'type' => 'card',
                    'gateway_token' => $gatewayToken,
                    'masked_identifier' => $body['maskedIdentifier'] ?? '•••• •••• •••• 4242',
                    'brand_or_provider' => $body['brand'] ?? 'Mastercard',
                    'issuing_bank' => $body['issuingBank'] ?? 'BDO Unibank',
                    'expiry_month' => $body['expiryMonth'] ?? '12',
                    'expiry_year' => $body['expiryYear'] ?? '28',
                    'billing_day' => $billingDay,
                    'is_default' => true,
                    'status' => 'active',
                    'created_at' => date('c')
                ];
                $memory['payment_methods'][] = $pmRecord;
                $boundMethodId = $pmId;
            } elseif (in_array($paymentOption, ['gcash', 'maya'], true) && !empty($gatewayToken)) {
                $pmId = 'pm-' . substr(bin2hex(random_bytes(8)), 0, 8);
                $providerName = $paymentOption === 'maya' ? 'Maya' : 'GCash';
                $pmRecord = [
                    'id' => $pmId,
                    'user_id' => $userId,
                    'branch_id' => $branchId,
                    'type' => "{$paymentOption}_recurring",
                    'gateway_token' => $gatewayToken,
                    'masked_identifier' => $body['maskedIdentifier'] ?? '0917 ••• ••88',
                    'brand_or_provider' => $providerName,
                    'issuing_bank' => $providerName === 'GCash' ? 'Mynt / Globe GCash' : 'Maya Philippines',
                    'billing_day' => $billingDay,
                    'is_default' => true,
                    'status' => 'active',
                    'created_at' => date('c')
                ];
                $memory['payment_methods'][] = $pmRecord;
                $boundMethodId = $pmId;
            }

            // Create Subscription Record
            if (!isset($memory['subscriptions'])) $memory['subscriptions'] = [];
            $startDate = date('Y-m-d');
            $endDate = date('Y-m-d', time() + ($chosenPlan['durationDays'] * 86400));
            $nextBillingDate = date('Y-m-d', time() + (30 * 86400));

            $newSub = [
                'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                'user_id' => $userId,
                'branch_id' => $branchId,
                'plan' => $chosenPlan['id'],
                'tier' => $chosenPlan['tier'],
                'plan_tier' => $chosenPlan['id'],
                'plan_name' => $chosenPlan['name'],
                'monthly_due_amount' => $chosenPlan['planFee'],
                'billing_day' => $billingDay,
                'next_billing_date' => $nextBillingDate,
                'payment_method_id' => $boundMethodId,
                'auto_debit_retries' => 0,
                'parq_signed' => true,
                'parq_signature_hash' => $parqSignatureHash,
                'status' => 'active',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'price' => $chosenPlan['planFee'],
                'access_fee' => $chosenPlan['accessFee'],
                'annual_fee' => $chosenPlan['annualFee'],
                'total_paid' => $chosenPlan['totalDue'],
                'auto_renew' => $chosenPlan['id'] !== '1_day',
                'created_at' => date('c')
            ];
            $memory['subscriptions'][] = $newSub;

            // Invoice & Sales
            $invNumber = $invoiceNo ?: sprintf('INV-%s-%06d', date('Y'), random_int(100000, 999999));
            $newInvoice = [
                'id' => 'inv-' . substr(bin2hex(random_bytes(8)), 0, 8),
                'invoice_no' => $invNumber,
                'user_id' => $userId,
                'branch_id' => $branchId,
                'amount' => $chosenPlan['totalDue'],
                'description' => "KSYN Membership Dues ({$chosenPlan['name']})",
                'payment_rail' => $paymentOption,
                'gateway_ref' => 'txn_' . bin2hex(random_bytes(8)),
                'status' => 'settled',
                'settled_at' => date('c'),
                'created_at' => date('c')
            ];

            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            array_unshift($memory['payment_invoices'], $newInvoice);

            if (!isset($memory['sales'])) $memory['sales'] = [];
            array_unshift($memory['sales'], [
                'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                'branch_id' => $branchId,
                'user_id' => $userId,
                'amount' => $chosenPlan['totalDue'],
                'category' => 'membership_fee',
                'payment_method' => $paymentOption,
                'reference_no' => $invNumber,
                'created_at' => date('c')
            ]);

            // Dynamic 60-second Turnstile QR Pass
            $branch = null;
            foreach ($memory['branches'] ?? [] as $b) {
                if (($b['id'] ?? '') === $branchId) {
                    $branch = $b;
                    break;
                }
            }

            $passTimestamp = (int)(microtime(true) * 1000);
            $passNonce = bin2hex(random_bytes(8));
            $qrPassPayload = [
                'memberId' => $userId,
                'memberName' => $newMember['name'],
                'branchId' => $branchId,
                'branchCode' => $branch['code'] ?? 'MKT-01',
                'tier' => $chosenPlan['tier'],
                'subStatus' => 'active',
                'timestamp' => $passTimestamp,
                'nonce' => $passNonce
            ];

            $payloadBase64 = rtrim(strtr(base64_encode(json_encode($qrPassPayload)), '+/', '-_'), '=');
            $signature = hash_hmac('sha256', $payloadBase64, Secrets::getQrHmacSecret());
            $initialQrPass = "{$payloadBase64}.{$signature}";

            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'user_role' => 'member',
                'action' => 'MEMBER_5STEP_ONBOARDED',
                'resource' => 'users',
                'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                'details' => [
                    'member_name' => $newMember['name'],
                    'plan' => $chosenPlan['name'],
                    'payment_option' => $paymentOption,
                    'rfid_uid' => $rfidCardUid,
                    'parq_hash' => $parqSignatureHash
                ]
            ]);

            $authToken = JWT::encode([
                'id' => $newMember['id'],
                'role' => 'member',
                'branch_id' => $newMember['branch_id'],
                'email' => $newMember['email'],
                'name' => $newMember['name'],
                'jti' => bin2hex(random_bytes(16)),
                'iat' => time(),
                'exp' => time() + (12 * 3600)
            ], Secrets::getJwtSecret(), 'HS256');

            return JsonResponse::success($response, [
                'token' => $authToken,
                'message' => 'Welcome to KSYN Fitness! Account registered, payment verified, and turnstile credentials issued.',
                'member' => [
                    'id' => $newMember['id'],
                    'name' => $newMember['name'],
                    'email' => $newMember['email'],
                    'phone' => $newMember['phone'],
                    'branch_id' => $newMember['branch_id'],
                    'branch_name' => $branch['name'] ?? 'Makati Flagship',
                    'rfid_card_uid' => $rfidCardUid
                ],
                'subscription' => $newSub,
                'invoice' => $newInvoice,
                'turnstile_access' => [
                    'rfid_uid' => $rfidCardUid,
                    'initial_dynamic_qr_pass' => $initialQrPass,
                    'qr_expires_at' => $passTimestamp + 60000,
                    'instructions' => 'Scan your dynamic QR pass at the entrance turnstile or tap your RFID keycard.'
                ]
            ], 201);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 7. Trigger Recurring Auto-Debit Billing
     * POST /api/payments/trigger-recurring-billing
     */
    public function triggerRecurringBilling(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $targetDay = isset($body['targetDay']) ? (int)$body['targetDay'] : (int)date('j');
            $simulateFailureUserId = $body['simulateFailureUserId'] ?? null;

            $memory = &Database::getMemoryStore();
            if (!isset($memory['subscriptions'])) $memory['subscriptions'] = [];
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            if (!isset($memory['sales'])) $memory['sales'] = [];

            $billingResults = [];

            foreach ($memory['subscriptions'] as &$sub) {
                if (!in_array($sub['status'] ?? '', ['active', 'past_due'], true)) {
                    continue;
                }
                if (isset($body['targetDay']) && ($sub['billing_day'] ?? 1) !== $targetDay) {
                    continue;
                }

                $member = null;
                foreach ($memory['users'] ?? [] as $u) {
                    if (($u['id'] ?? '') === ($sub['user_id'] ?? '')) {
                        $member = $u;
                        break;
                    }
                }

                $pm = null;
                foreach ($memory['payment_methods'] as $p) {
                    if (($p['id'] ?? '') === ($sub['payment_method_id'] ?? '') || (($p['user_id'] ?? '') === ($sub['user_id'] ?? '') && !empty($p['is_default']))) {
                        $pm = $p;
                        break;
                    }
                }

                $shouldFail = $simulateFailureUserId && ($sub['user_id'] ?? '') === $simulateFailureUserId;

                if (!$pm || $shouldFail) {
                    $sub['auto_debit_retries'] = ($sub['auto_debit_retries'] ?? 0) + 1;
                    if ($sub['auto_debit_retries'] >= 2 || $shouldFail) {
                        $sub['status'] = 'past_due';
                    }

                    $billingResults[] = [
                        'subscription_id' => $sub['id'],
                        'user_id' => $sub['user_id'],
                        'member_name' => $member['name'] ?? 'Unknown',
                        'amount' => $sub['monthly_due_amount'] ?? 2499.00,
                        'status' => 'FAILED',
                        'sub_status' => $sub['status'],
                        'retries' => $sub['auto_debit_retries'],
                        'reason' => $shouldFail ? 'SIMULATED_CARD_DECLINE (Insufficient Funds)' : 'NO_PAYMENT_METHOD_ON_FILE'
                    ];

                    AuditLogger::logAuditEvent([
                        'branch_id' => $sub['branch_id'] ?? 'b-mkt-01',
                        'user_id' => $sub['user_id'] ?? 'system',
                        'user_role' => 'member',
                        'action' => 'AUTO_DEBIT_FAILED',
                        'resource' => 'subscriptions',
                        'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                        'details' => [
                            'sub_id' => $sub['id'],
                            'retries' => $sub['auto_debit_retries'],
                            'sub_status' => $sub['status']
                        ]
                    ]);
                    continue;
                }

                $amount = $sub['monthly_due_amount'] ?? 2499.00;
                $invoiceNo = sprintf('INV-%s-%06d', date('Y'), random_int(100000, 999999));

                $invoice = [
                    'id' => 'inv-' . substr(bin2hex(random_bytes(8)), 0, 8),
                    'invoice_no' => $invoiceNo,
                    'user_id' => $sub['user_id'],
                    'branch_id' => $sub['branch_id'] ?? 'b-mkt-01',
                    'amount' => $amount,
                    'description' => "Automated Recurring Dues (" . ($sub['plan_name'] ?? 'Flagship Plan') . ") - Cycle Day " . ($sub['billing_day'] ?? 1),
                    'payment_rail' => $pm['type'],
                    'gateway_ref' => 'ch_auto_' . bin2hex(random_bytes(8)),
                    'status' => 'settled',
                    'settled_at' => date('c'),
                    'created_at' => date('c')
                ];
                array_unshift($memory['payment_invoices'], $invoice);

                array_unshift($memory['sales'], [
                    'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                    'branch_id' => $sub['branch_id'] ?? 'b-mkt-01',
                    'user_id' => $sub['user_id'],
                    'amount' => $amount,
                    'category' => 'membership_fee',
                    'payment_method' => $pm['type'],
                    'reference_no' => $invoiceNo,
                    'created_at' => date('c')
                ]);

                $sub['next_billing_date'] = date('Y-m-d', strtotime('+1 month'));
                $sub['auto_debit_retries'] = 0;
                $sub['status'] = 'active';

                $billingResults[] = [
                    'subscription_id' => $sub['id'],
                    'user_id' => $sub['user_id'],
                    'member_name' => $member['name'] ?? 'Unknown',
                    'amount' => $amount,
                    'status' => 'SUCCESS',
                    'invoice_no' => $invoiceNo,
                    'payment_rail' => $pm['type'],
                    'masked_identifier' => $pm['masked_identifier'] ?? '',
                    'next_billing_date' => $sub['next_billing_date']
                ];

                AuditLogger::logAuditEvent([
                    'branch_id' => $sub['branch_id'] ?? 'b-mkt-01',
                    'user_id' => $sub['user_id'] ?? 'system',
                    'user_role' => 'member',
                    'action' => 'AUTO_DEBIT_SUCCESS',
                    'resource' => 'subscriptions',
                    'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                    'details' => [
                        'sub_id' => $sub['id'],
                        'amount' => $amount,
                        'invoice_no' => $invoiceNo,
                        'rail' => $pm['type']
                    ]
                ]);
            }
            unset($sub);

            Database::saveStore();

            $successCount = count(array_filter($billingResults, fn($r) => $r['status'] === 'SUCCESS'));
            $failedCount = count(array_filter($billingResults, fn($r) => $r['status'] === 'FAILED'));

            return JsonResponse::success($response, [
                'execution_summary' => [
                    'cycle_day' => $targetDay,
                    'total_processed' => count($billingResults),
                    'successful' => $successCount,
                    'failed' => $failedCount,
                    'results' => $billingResults
                ]
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 8. Get Payment Methods for Member
     * GET /api/payments/methods/{userId}
     */
    public function getPaymentMethods(Request $request, Response $response, array $args): Response
    {
        try {
            $userId = $args['userId'] ?? '';
            $user = $request->getAttribute('user');

            if (($user['role'] ?? '') === 'member' && ($user['id'] ?? '') !== $userId) {
                return JsonResponse::error($response, 'Cannot view payment methods of other gym members.', 403, 'FORBIDDEN');
            }

            $memory = &Database::getMemoryStore();
            $methods = array_values(array_filter($memory['payment_methods'] ?? [], fn($pm) => ($pm['user_id'] ?? '') === $userId));

            $sub = null;
            foreach ($memory['subscriptions'] ?? [] as $s) {
                if (($s['user_id'] ?? '') === $userId) {
                    $sub = $s;
                    break;
                }
            }

            return JsonResponse::success($response, [
                'payment_methods' => $methods,
                'subscription' => $sub
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 9. Delete Payment Method
     * DELETE /api/payments/methods/{methodId}
     */
    public function deletePaymentMethod(Request $request, Response $response, array $args): Response
    {
        try {
            $methodId = $args['methodId'] ?? '';
            $user = $request->getAttribute('user');

            $memory = &Database::getMemoryStore();
            $methods = &$memory['payment_methods'];

            $foundIdx = -1;
            foreach ($methods ?? [] as $idx => $pm) {
                if (($pm['id'] ?? '') === $methodId) {
                    $foundIdx = $idx;
                    break;
                }
            }

            if ($foundIdx === -1) {
                return JsonResponse::error($response, 'Payment method not found.', 404);
            }

            if (($user['role'] ?? '') === 'member' && ($user['id'] ?? '') !== ($methods[$foundIdx]['user_id'] ?? '')) {
                return JsonResponse::error($response, 'Forbidden.', 403);
            }

            array_splice($methods, $foundIdx, 1);
            Database::saveStore();

            return JsonResponse::success($response, [
                'message' => 'Payment method removed successfully.'
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 10. Get Invoices
     * GET /api/payments/invoices
     */
    public function getInvoices(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            $memory = &Database::getMemoryStore();
            $invoices = $memory['payment_invoices'] ?? [];

            if (($user['role'] ?? '') === 'member') {
                $userId = $user['id'] ?? '';
                $invoices = array_values(array_filter($invoices, fn($inv) => ($inv['user_id'] ?? '') === $userId));
            } elseif (($user['role'] ?? '') !== 'super_admin' && !empty($user['branch_id'])) {
                $branchId = $user['branch_id'];
                $invoices = array_values(array_filter($invoices, fn($inv) => ($inv['branch_id'] ?? '') === $branchId));
            }

            return JsonResponse::success($response, [
                'invoices' => $invoices
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 11. Settle Member Payment
     * POST /api/payments/settle-member-payment
     */
    public function settleMemberPayment(Request $request, Response $response): Response
    {
        try {
            $userAuth = $request->getAttribute('user');
            $userId = $userAuth['id'] ?? '';
            $body = (array)$request->getParsedBody();

            $planTier = $body['planTier'] ?? ($userAuth['membership_plan'] ?? null);
            $paymentOption = $body['paymentOption'] ?? 'card';

            if (empty($planTier)) {
                return JsonResponse::error($response, 'Please select a membership plan before settling payment.', 400, 'PLAN_REQUIRED');
            }

            $chosenPlan = MembershipRates::resolvePlan($planTier);
            if (!$chosenPlan) {
                return JsonResponse::error($response, 'Invalid plan selection.', 400);
            }

            $memory = &Database::getStore();
            $targetUser = null;
            if (!isset($memory['users'])) $memory['users'] = [];

            foreach ($memory['users'] as $idx => $u) {
                if (($u['id'] ?? '') === $userId) {
                    $memory['users'][$idx]['status'] = 'active';
                    $memory['users'][$idx]['membership_plan'] = $chosenPlan['id'];
                    $memory['users'][$idx]['membership_tier'] = $chosenPlan['tier'];
                    if ($chosenPlan['id'] !== '1_day') {
                        if (empty($memory['users'][$idx]['rfid_card_uid'])) {
                            $memory['users'][$idx]['rfid_card_uid'] = 'KS-' . rand(1000, 9999) . '-' . rand(1000, 9999);
                        }
                    } else {
                        $memory['users'][$idx]['rfid_card_uid'] = null;
                    }
                    $targetUser = $memory['users'][$idx];
                    break;
                }
            }

            if (!$targetUser) {
                return JsonResponse::error($response, 'User not found.', 404);
            }

            // Find or create subscription with cumulative plan term extension
            if (!isset($memory['subscriptions'])) $memory['subscriptions'] = [];
            $existingSubIdx = null;
            foreach ($memory['subscriptions'] as $idx => $s) {
                if (($s['user_id'] ?? '') === $userId) {
                    if (($s['status'] ?? '') === 'active' || $existingSubIdx === null) {
                        $existingSubIdx = $idx;
                    }
                }
            }

            $now = time();
            $baseTime = $now;
            $startDate = date('Y-m-d');
            if ($existingSubIdx !== null && !empty($memory['subscriptions'][$existingSubIdx]['end_date'])) {
                $existingEnd = strtotime($memory['subscriptions'][$existingSubIdx]['end_date']);
                if ($existingEnd !== false && $existingEnd > $now) {
                    $baseTime = $existingEnd;
                    if (!empty($memory['subscriptions'][$existingSubIdx]['start_date'])) {
                        $startDate = $memory['subscriptions'][$existingSubIdx]['start_date'];
                    }
                }
            }
            $newEndSec = $baseTime + ($chosenPlan['durationDays'] * 86400);
            $endDate = date('Y-m-d', $newEndSec);
            $nextBillingDate = date('Y-m-d', $newEndSec);
            $billingDay = ((int)($body['billingDay'] ?? 1) === 15) ? 15 : 1;

            $sub = null;
            if ($existingSubIdx !== null) {
                foreach ($memory['subscriptions'] as $idx => $s) {
                    if (($s['user_id'] ?? '') === $userId && $idx !== $existingSubIdx) {
                        $memory['subscriptions'][$idx]['status'] = 'expired';
                    }
                }
                $memory['subscriptions'][$existingSubIdx]['plan'] = $chosenPlan['id'];
                $memory['subscriptions'][$existingSubIdx]['tier'] = $chosenPlan['tier'];
                $memory['subscriptions'][$existingSubIdx]['status'] = 'active';
                $memory['subscriptions'][$existingSubIdx]['start_date'] = $startDate;
                $memory['subscriptions'][$existingSubIdx]['end_date'] = $endDate;
                $memory['subscriptions'][$existingSubIdx]['price'] = $chosenPlan['planFee'];
                $memory['subscriptions'][$existingSubIdx]['access_fee'] = $chosenPlan['accessFee'];
                $memory['subscriptions'][$existingSubIdx]['annual_fee'] = $chosenPlan['annualFee'];
                $memory['subscriptions'][$existingSubIdx]['total_paid'] = (float)($memory['subscriptions'][$existingSubIdx]['total_paid'] ?? 0) + $chosenPlan['totalDue'];
                $memory['subscriptions'][$existingSubIdx]['monthly_due_amount'] = $chosenPlan['planFee'];
                $memory['subscriptions'][$existingSubIdx]['billing_day'] = $billingDay;
                $memory['subscriptions'][$existingSubIdx]['next_billing_date'] = $nextBillingDate;
                $memory['subscriptions'][$existingSubIdx]['auto_renew'] = ($chosenPlan['id'] !== '1_day');
                $memory['subscriptions'][$existingSubIdx]['auto_debit_retries'] = 0;
                $sub = $memory['subscriptions'][$existingSubIdx];
            } else {
                $sub = [
                    'id' => bin2hex(random_bytes(16)),
                    'user_id' => $userId,
                    'branch_id' => $targetUser['branch_id'] ?? 'b-mkt-01',
                    'plan' => $chosenPlan['id'],
                    'tier' => $chosenPlan['tier'],
                    'status' => 'active',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'price' => $chosenPlan['planFee'],
                    'access_fee' => $chosenPlan['accessFee'],
                    'annual_fee' => $chosenPlan['annualFee'],
                    'total_paid' => $chosenPlan['totalDue'],
                    'monthly_due_amount' => $chosenPlan['planFee'],
                    'billing_day' => $billingDay,
                    'next_billing_date' => $nextBillingDate,
                    'auto_renew' => ($chosenPlan['id'] !== '1_day'),
                    'auto_debit_retries' => 0,
                    'created_at' => date('c')
                ];
                $memory['subscriptions'][] = $sub;
            }

            // Settle or create invoice
            $invNumber = $body['invoiceNo'] ?? ('INV-' . date('Y') . '-' . rand(100000, 999999));
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            $memory['payment_invoices'][] = [
                'id' => 'inv-' . substr(bin2hex(random_bytes(4)), 0, 8),
                'invoice_no' => $invNumber,
                'user_id' => $userId,
                'branch_id' => $targetUser['branch_id'] ?? 'b-mkt-01',
                'amount' => $chosenPlan['totalDue'],
                'description' => "KSYN Membership Dues ({$chosenPlan['name']})",
                'payment_rail' => $paymentOption,
                'gateway_ref' => 'txn_' . bin2hex(random_bytes(8)),
                'status' => 'settled',
                'settled_at' => date('c'),
                'created_at' => date('c')
            ];

            // Record sale
            if (!isset($memory['sales'])) $memory['sales'] = [];
            $memory['sales'][] = [
                'id' => bin2hex(random_bytes(16)),
                'branch_id' => $targetUser['branch_id'] ?? 'b-mkt-01',
                'user_id' => $userId,
                'amount' => $chosenPlan['totalDue'],
                'category' => 'membership_fee',
                'payment_method' => $paymentOption,
                'reference_no' => $invNumber,
                'created_at' => date('c')
            ];

            // Generate Dynamic 60s QR Pass
            $branchId = $targetUser['branch_id'] ?? 'b-mkt-01';
            $branch = null;
            foreach ($memory['branches'] ?? [] as $b) {
                if (($b['id'] ?? '') === $branchId) {
                    $branch = $b;
                    break;
                }
            }

            $passTimestamp = (int)(microtime(true) * 1000);
            $passNonce = bin2hex(random_bytes(8));
            $qrPassPayload = [
                'memberId' => $userId,
                'memberName' => $targetUser['name'] ?? 'Member',
                'branchId' => $branchId,
                'branchCode' => $branch['code'] ?? 'MKT-01',
                'tier' => $chosenPlan['tier'],
                'subStatus' => 'active',
                'timestamp' => $passTimestamp,
                'nonce' => $passNonce
            ];

            $payloadBase64 = rtrim(strtr(base64_encode(json_encode($qrPassPayload, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
            $signature = hash_hmac('sha256', $payloadBase64, Secrets::getQrSecret());
            $turnstilePass = "{$payloadBase64}.{$signature}";

            AuditLogger::logAuditEvent([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'user_role' => 'member',
                'action' => 'MEMBER_PAYMENT_SETTLED',
                'resource' => 'subscriptions',
                'details' => [
                    'plan' => $chosenPlan['name'],
                    'amount' => $chosenPlan['totalDue'],
                    'rail' => $paymentOption,
                    'invoice_no' => $invNumber
                ]
            ]);

            Database::saveStore();

            return JsonResponse::create($response, [
                'success' => true,
                'message' => "Payment of ₱" . number_format($chosenPlan['totalDue'], 2) . " confirmed via " . strtoupper($paymentOption) . "! Your membership is active and your turnstile pass is unlocked.",
                'user' => [
                    'id' => $targetUser['id'],
                    'name' => $targetUser['name'],
                    'email' => $targetUser['email'],
                    'phone' => $targetUser['phone'] ?? '',
                    'status' => 'active',
                    'rfid_card_uid' => $targetUser['rfid_card_uid']
                ],
                'subscription' => $sub,
                'turnstile_pass' => $turnstilePass
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }
}
