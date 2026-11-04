<?php

namespace Ksyn\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Ksyn\Config\Database;
use Ksyn\Config\Secrets;
use Ksyn\Config\MembershipRates;
use Ksyn\Services\XenditService;
use Ksyn\Utils\JsonResponse;
use Ksyn\Middleware\AuditLogger;

class XenditController
{
    private XenditService $xenditService;

    public function __construct()
    {
        $this->xenditService = new XenditService();
    }

    private function generateTurnstilePass(array $user, ?array $branch, string $tier): string
    {
        $passTimestamp = (int)(microtime(true) * 1000);
        $passNonce = bin2hex(random_bytes(8));
        $qrPassPayload = [
            'memberId' => $user['id'] ?? '',
            'memberName' => $user['name'] ?? '',
            'branchId' => $branch['id'] ?? ($user['branch_id'] ?? 'b-mkt-01'),
            'branchCode' => $branch['code'] ?? 'MKT-01',
            'tier' => $tier,
            'subStatus' => 'active',
            'timestamp' => $passTimestamp,
            'nonce' => $passNonce
        ];
        $payloadBase64 = rtrim(strtr(base64_encode(json_encode($qrPassPayload)), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $payloadBase64, Secrets::getQrHmacSecret());
        return "{$payloadBase64}.{$signature}";
    }

    private function settleMembershipAccess(array $params): array
    {
        $userId = $params['userId'];
        $branchId = $params['branchId'] ?? 'b-mkt-01';
        $planId = $params['planId'];
        $amount = (float)($params['amount'] ?? 0);
        $paymentRail = $params['paymentRail'] ?? 'invoice';
        $referenceNo = $params['referenceNo'] ?? '';
        $billingDay = isset($params['billingDay']) && (int)$params['billingDay'] === 15 ? 15 : 1;
        $ipAddress = $params['ipAddress'] ?? '127.0.0.1';

        $resolvedPlan = MembershipRates::resolvePlan($planId);
        $isOneDayPass = $resolvedPlan['id'] === '1_day';

        $memory = &Database::getMemoryStore();
        if (!isset($memory['users'])) $memory['users'] = [];

        $user = null;
        foreach ($memory['users'] as &$u) {
            if (($u['id'] ?? '') === $userId) {
                $u['status'] = 'active';
                $u['membership_plan'] = $resolvedPlan['id'];
                $u['membership_tier'] = $resolvedPlan['tier'];

                if (!$isOneDayPass) {
                    if (empty($u['rfid_card_uid'])) {
                        $u['rfid_card_uid'] = sprintf('KS-%04d-%04d', random_int(1000, 9999), random_int(1000, 9999));
                    }
                } else {
                    $u['rfid_card_uid'] = null;
                }
                $user = $u;
                break;
            }
        }
        unset($u);

        // Update or create subscription with cumulative term extension
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
        $newEndSec = $baseTime + ($resolvedPlan['durationDays'] * 86400);
        $endDate = date('Y-m-d', $newEndSec);
        $nextBillingDate = date('Y-m-d', $newEndSec);
        $paymentAmount = $amount > 0 ? (float)$amount : (float)$resolvedPlan['totalDue'];

        $sub = null;
        if ($existingSubIdx !== null) {
            foreach ($memory['subscriptions'] as $idx => $s) {
                if (($s['user_id'] ?? '') === $userId && $idx !== $existingSubIdx) {
                    $memory['subscriptions'][$idx]['status'] = 'expired';
                }
            }
            $memory['subscriptions'][$existingSubIdx]['plan'] = $resolvedPlan['id'];
            $memory['subscriptions'][$existingSubIdx]['tier'] = $resolvedPlan['tier'];
            $memory['subscriptions'][$existingSubIdx]['status'] = 'active';
            $memory['subscriptions'][$existingSubIdx]['start_date'] = $startDate;
            $memory['subscriptions'][$existingSubIdx]['end_date'] = $endDate;
            $memory['subscriptions'][$existingSubIdx]['price'] = $resolvedPlan['planFee'];
            $memory['subscriptions'][$existingSubIdx]['access_fee'] = $resolvedPlan['accessFee'];
            $memory['subscriptions'][$existingSubIdx]['annual_fee'] = $resolvedPlan['annualFee'];
            $memory['subscriptions'][$existingSubIdx]['total_paid'] = (float)($memory['subscriptions'][$existingSubIdx]['total_paid'] ?? 0) + $paymentAmount;
            $memory['subscriptions'][$existingSubIdx]['monthly_due_amount'] = $resolvedPlan['planFee'];
            $memory['subscriptions'][$existingSubIdx]['billing_day'] = $billingDay;
            $memory['subscriptions'][$existingSubIdx]['next_billing_date'] = $nextBillingDate;
            $memory['subscriptions'][$existingSubIdx]['auto_renew'] = !$isOneDayPass;
            $memory['subscriptions'][$existingSubIdx]['auto_debit_retries'] = 0;
            $sub = $memory['subscriptions'][$existingSubIdx];
        } else {
            $sub = [
                'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                'user_id' => $userId,
                'branch_id' => $branchId,
                'plan' => $resolvedPlan['id'],
                'tier' => $resolvedPlan['tier'],
                'status' => 'active',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'price' => $resolvedPlan['planFee'],
                'access_fee' => $resolvedPlan['accessFee'],
                'annual_fee' => $resolvedPlan['annualFee'],
                'total_paid' => $paymentAmount,
                'monthly_due_amount' => $resolvedPlan['planFee'],
                'billing_day' => $billingDay,
                'next_billing_date' => $nextBillingDate,
                'auto_renew' => !$isOneDayPass,
                'auto_debit_retries' => 0,
                'created_at' => date('c')
            ];
            $memory['subscriptions'][] = $sub;
        }
                'auto_debit_retries' => 0
            ];
            $memory['subscriptions'][] = $sub;
        }

        // Record in sales ledger
        if (!isset($memory['sales'])) $memory['sales'] = [];
        $saleRecord = [
            'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
            'branch_id' => $branchId,
            'user_id' => $userId,
            'amount' => $amount > 0 ? $amount : $resolvedPlan['totalDue'],
            'category' => 'membership_fee',
            'payment_method' => "xendit_{$paymentRail}",
            'reference_no' => $referenceNo,
            'created_at' => date('c')
        ];
        array_unshift($memory['sales'], $saleRecord);

        Database::saveStore();

        AuditLogger::logAuditEvent([
            'branch_id' => $branchId,
            'user_id' => $userId,
            'user_role' => 'member',
            'action' => 'XENDIT_MEMBERSHIP_SETTLED',
            'resource' => 'subscriptions',
            'ip_address' => $ipAddress,
            'details' => [
                'plan' => $resolvedPlan['name'],
                'amount' => $saleRecord['amount'],
                'rail' => $paymentRail,
                'invoice_no' => $referenceNo,
                'rfid_issued' => !empty($user['rfid_card_uid'])
            ]
        ]);

        $branch = null;
        foreach ($memory['branches'] ?? [] as $b) {
            if (($b['id'] ?? '') === $branchId) {
                $branch = $b;
                break;
            }
        }

        $turnstilePass = $this->generateTurnstilePass($user ?: ['id' => $userId, 'name' => 'Valued Member'], $branch, $resolvedPlan['tier']);

        return [
            'user' => $user,
            'subscription' => $sub,
            'turnstilePass' => $turnstilePass
        ];
    }

    /**
     * 1. GET XENDIT CLIENT CONFIGURATION
     * GET /api/payments/xendit/config
     */
    public function getConfig(Request $request, Response $response): Response
    {
        return JsonResponse::success($response, [
            'gateway' => 'Xendit Philippines',
            'environment' => $this->xenditService->getEnvironment(),
            'public_key' => $this->xenditService->getPublicKey(),
            'supported_rails' => [
                ['id' => 'card', 'name' => 'Credit / Debit Card (Visa / Mastercard)', 'type' => 'recurring_token'],
                ['id' => 'gcash', 'name' => 'GCash Philippines', 'type' => 'ewallet'],
                ['id' => 'maya', 'name' => 'Maya Philippines', 'type' => 'ewallet'],
                ['id' => 'qr_ph', 'name' => 'QR Ph (National QR Standard)', 'type' => 'dynamic_qr']
            ]
        ]);
    }

    /**
     * 2. CREATE XENDIT INVOICE (Unified Hosted Checkout)
     * POST /api/payments/xendit/create-invoice
     */
    public function createInvoice(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $planTier = $body['planTier'] ?? '';
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $customerName = $body['customerName'] ?? ($request->getAttribute('user')['name'] ?? 'Valued Member');
            $email = $body['email'] ?? ($request->getAttribute('user')['email'] ?? 'member@ksynfitness.com');
            $phone = $body['phone'] ?? ($request->getAttribute('user')['phone'] ?? null);
            $successRedirectUrl = $body['successRedirectUrl'] ?? null;
            $failureRedirectUrl = $body['failureRedirectUrl'] ?? null;

            if (empty($planTier)) {
                return JsonResponse::error($response, 'Please select a membership plan before creating an invoice.', 400, 'PLAN_REQUIRED');
            }

            $resolvedPlan = MembershipRates::resolvePlan($planTier);
            if (!$resolvedPlan) {
                return JsonResponse::error($response, 'The selected membership plan is invalid. Please select a valid plan.', 400, 'INVALID_PLAN');
            }

            $externalId = sprintf('KSYN-INV-%s-%04d', time(), random_int(1000, 9999));

            $invoice = $this->xenditService->createInvoice([
                'externalId' => $externalId,
                'amount' => $resolvedPlan['totalDue'],
                'payerEmail' => $email,
                'description' => "KSYN Fitness - {$resolvedPlan['name']} Membership",
                'customerName' => $customerName,
                'customerPhone' => $phone,
                'successRedirectUrl' => $successRedirectUrl ?: ($_ENV['CORS_ORIGIN'] ?? 'http://localhost:5180') . '/portal?status=paid',
                'failureRedirectUrl' => $failureRedirectUrl ?: ($_ENV['CORS_ORIGIN'] ?? 'http://localhost:5180') . '/portal?status=failed',
                'metadata' => [
                    'userId' => $request->getAttribute('user')['id'] ?? null,
                    'branchId' => $branchId,
                    'planTier' => $resolvedPlan['id'],
                    'planName' => $resolvedPlan['name']
                ]
            ]);

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            $invRecord = [
                'id' => $invoice['id'],
                'invoice_no' => $externalId,
                'user_id' => $request->getAttribute('user')['id'] ?? null,
                'branch_id' => $branchId,
                'plan_id' => $resolvedPlan['id'],
                'amount' => $resolvedPlan['totalDue'],
                'payment_rail' => 'xendit_invoice',
                'status' => 'pending',
                'invoice_url' => $invoice['invoice_url'],
                'gateway_ref' => $invoice['id'],
                'created_at' => date('c')
            ];
            array_unshift($memory['payment_invoices'], $invRecord);
            Database::saveStore();

            return JsonResponse::success($response, [
                'message' => 'Xendit unified invoice generated successfully.',
                'invoice_id' => $invoice['id'],
                'external_id' => $invoice['external_id'],
                'invoice_url' => $invoice['invoice_url'],
                'amount' => $invoice['amount'],
                'expiry_date' => $invoice['expiry_date']
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 3. CREATE DYNAMIC QR PH
     * POST /api/payments/xendit/create-qr
     */
    public function createDynamicQr(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $amount = $body['amount'] ?? null;
            $planTier = $body['planTier'] ?? null;
            $branchId = $body['branchId'] ?? 'b-mkt-01';
            $userId = $body['userId'] ?? ($request->getAttribute('user')['id'] ?? null);
            $description = $body['description'] ?? null;

            $resolvedPlan = $planTier ? MembershipRates::resolvePlan($planTier) : null;
            $finalAmount = $resolvedPlan ? $resolvedPlan['totalDue'] : ($amount ? (float)$amount : 500);
            $finalPlanId = $resolvedPlan ? $resolvedPlan['id'] : ($planTier ?: '1_day');
            $finalDesc = $description ?: ($resolvedPlan ? "{$resolvedPlan['name']} Membership Pass" : '1-Day All-Access Drop-In Pass');

            $externalId = sprintf('KSYN-QR-%s-%04d', time(), random_int(1000, 9999));
            $callbackUrl = ($_ENV['BACKEND_URL'] ?? 'http://localhost:5080') . '/api/payments/xendit/webhook';

            $qrResult = $this->xenditService->createDynamicQr([
                'externalId' => $externalId,
                'amount' => $finalAmount,
                'callbackUrl' => $callbackUrl,
                'metadata' => [
                    'userId' => $userId,
                    'branchId' => $branchId,
                    'planTier' => $finalPlanId,
                    'description' => $finalDesc
                ]
            ]);

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];
            $invRecord = [
                'id' => $qrResult['id'],
                'invoice_no' => $externalId,
                'user_id' => $userId,
                'branch_id' => $branchId,
                'plan_id' => $finalPlanId,
                'amount' => (float)$finalAmount,
                'payment_rail' => 'qr_ph',
                'status' => 'pending',
                'gateway_ref' => $qrResult['id'],
                'created_at' => date('c')
            ];
            array_unshift($memory['payment_invoices'], $invRecord);
            Database::saveStore();

            return JsonResponse::success($response, [
                'message' => 'Dynamic QR Ph code generated. Scan with any PH Bank or GCash/Maya.',
                'qr_id' => $qrResult['id'],
                'external_id' => $qrResult['external_id'],
                'qr_string' => $qrResult['qr_string'],
                'amount' => $qrResult['amount'],
                'status' => $qrResult['status'],
                'expires_in_minutes' => 15
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 4. CHARGE TOKENIZED CARD
     * POST /api/payments/xendit/charge-card
     */
    public function chargeCard(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            $userId = $user['id'] ?? null;
            if (!$userId) {
                return JsonResponse::error($response, 'Authentication required to bind card payment.', 401);
            }

            $body = (array)$request->getParsedBody();
            $tokenId = $body['tokenId'] ?? '';
            $planTier = $body['planTier'] ?? '12_months';
            $billingDay = isset($body['billingDay']) && (int)$body['billingDay'] === 15 ? 15 : 1;
            $cardholderName = $body['cardholderName'] ?? ($user['name'] ?? 'Member');
            $maskedPan = $body['maskedPan'] ?? '•••• •••• •••• 4242';
            $brand = $body['brand'] ?? 'Mastercard';
            $issuingBank = $body['issuingBank'] ?? 'BDO Unibank';

            if (empty($tokenId)) {
                return JsonResponse::error($response, 'Xendit card token_id is required.', 400);
            }

            $resolvedPlan = MembershipRates::resolvePlan($planTier);
            $externalId = sprintf('KSYN-CARD-%s-%04d', time(), random_int(1000, 9999));

            $chargeResult = $this->xenditService->chargeCard([
                'tokenId' => $tokenId,
                'externalId' => $externalId,
                'amount' => $resolvedPlan['totalDue']
            ]);

            if ($chargeResult['status'] !== 'CAPTURED') {
                return JsonResponse::error($response, 'Credit/Debit card charge was not approved by issuing bank.', 402, 'CARD_CHARGE_FAILED');
            }

            $paymentMethodId = 'pm-' . substr(bin2hex(random_bytes(8)), 0, 8);
            $pmRecord = [
                'id' => $paymentMethodId,
                'user_id' => $userId,
                'branch_id' => $user['branch_id'] ?? 'b-mkt-01',
                'type' => 'card',
                'gateway_token' => $tokenId,
                'masked_identifier' => $maskedPan,
                'brand_or_provider' => $brand,
                'issuing_bank' => $issuingBank,
                'cardholder_name' => $cardholderName,
                'billing_day' => $billingDay,
                'is_default' => true,
                'status' => 'active',
                'created_at' => date('c')
            ];

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];
            foreach ($memory['payment_methods'] as &$pm) {
                if (($pm['user_id'] ?? '') === $userId) {
                    $pm['is_default'] = false;
                }
            }
            unset($pm);
            $memory['payment_methods'][] = $pmRecord;

            $settlement = $this->settleMembershipAccess([
                'userId' => $userId,
                'branchId' => $user['branch_id'] ?? 'b-mkt-01',
                'planId' => $resolvedPlan['id'],
                'amount' => $resolvedPlan['totalDue'],
                'paymentRail' => 'card',
                'referenceNo' => $externalId,
                'billingDay' => $billingDay,
                'ipAddress' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);

            return JsonResponse::success($response, [
                'message' => sprintf('Card charged ₱%s via Xendit! Auto-debit tokenized for the %sth of each month.', number_format($resolvedPlan['totalDue']), $billingDay === 15 ? '15' : '1'),
                'charge_id' => $chargeResult['id'],
                'user' => $settlement['user'],
                'subscription' => $settlement['subscription'],
                'turnstile_pass' => $settlement['turnstilePass']
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 5. XENDIT WEBHOOK RECEIVER
     * POST /api/payments/xendit/webhook or /api/webhooks/xendit
     */
    public function handleWebhook(Request $request, Response $response): Response
    {
        try {
            $incomingToken = $request->getHeaderLine('x-callback-token');

            if (!$this->xenditService->verifyWebhookToken($incomingToken)) {
                return JsonResponse::error($response, 'Invalid Xendit x-callback-token signature.', 403, 'FORBIDDEN');
            }

            $rawBody = (string)$request->getBody();
            $payload = json_decode($rawBody, true) ?: (array)$request->getParsedBody();

            $externalId = $payload['external_id'] ?? '';
            $invoiceStatus = strtoupper($payload['status'] ?? '');
            $event = $payload['event'] ?? ($invoiceStatus === 'PAID' ? 'invoice.paid' : 'unknown');

            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];

            $invoice = null;
            foreach ($memory['payment_invoices'] as &$inv) {
                if (($inv['invoice_no'] ?? '') === $externalId || ($inv['id'] ?? '') === ($payload['id'] ?? '')) {
                    $invoice = &$inv;
                    break;
                }
            }

            // IDEMPOTENCY CHECK
            if ($invoice && ($invoice['status'] ?? '') === 'settled') {
                return JsonResponse::success($response, [
                    'message' => "Invoice {$externalId} has already been settled and processed (Idempotent response)."
                ]);
            }

            if (in_array($invoiceStatus, ['PAID', 'COMPLETED'], true) || in_array($event, ['invoice.paid', 'qr.payment'], true)) {
                $amountPaid = (float)($payload['amount'] ?? ($payload['paid_amount'] ?? ($invoice['amount'] ?? 500)));
                $paymentRail = strtolower($payload['payment_method'] ?? ($payload['payment_channel'] ?? 'xendit'));
                $userId = $invoice['user_id'] ?? ($payload['metadata']['userId'] ?? null);
                $branchId = $invoice['branch_id'] ?? ($payload['metadata']['branchId'] ?? 'b-mkt-01');

                $planTier = $invoice['plan_id'] ?? ($payload['metadata']['planTier'] ?? null);
                if (!$planTier) {
                    if ($amountPaid <= 500) $planTier = '1_day';
                    elseif ($amountPaid <= 4600) $planTier = '1_month';
                    elseif ($amountPaid <= 9500) $planTier = '3_months';
                    elseif ($amountPaid <= 16400) $planTier = '6_months';
                    else $planTier = '12_months';
                }

                if ($invoice) {
                    $invoice['status'] = 'settled';
                    $invoice['settled_at'] = date('c');
                    $invoice['gateway_ref'] = $payload['id'] ?? ($invoice['gateway_ref'] ?? '');
                }

                if ($userId) {
                    $this->settleMembershipAccess([
                        'userId' => $userId,
                        'branchId' => $branchId,
                        'planId' => $planTier,
                        'amount' => $amountPaid,
                        'paymentRail' => $paymentRail,
                        'referenceNo' => $externalId,
                        'ipAddress' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1'
                    ]);
                } else {
                    if (!isset($memory['sales'])) $memory['sales'] = [];
                    array_unshift($memory['sales'], [
                        'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                        'branch_id' => $branchId,
                        'user_id' => 'guest_counter',
                        'amount' => $amountPaid,
                        'category' => $amountPaid <= 500 ? 'day_pass' : 'membership_fee',
                        'payment_method' => "xendit_{$paymentRail}",
                        'reference_no' => $externalId,
                        'created_at' => date('c')
                    ]);
                }

                Database::saveStore();

                return JsonResponse::success($response, [
                    'message' => "Xendit payment confirmed for {$externalId}. Access privileges unlocked.",
                    'external_id' => $externalId
                ]);
            }

            return JsonResponse::success($response, [
                'message' => "Xendit webhook acknowledged for event [{$event}]."
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 6. TRIGGER RECURRING AUTO-DEBIT DUES
     * POST /api/payments/xendit/trigger-recurring
     */
    public function triggerRecurringBilling(Request $request, Response $response): Response
    {
        try {
            $body = (array)$request->getParsedBody();
            $cycleDay = isset($body['cycleDay']) ? (int)$body['cycleDay'] : ((int)date('j') >= 15 ? 15 : 1);

            $memory = &Database::getMemoryStore();
            if (!isset($memory['subscriptions'])) $memory['subscriptions'] = [];
            if (!isset($memory['payment_methods'])) $memory['payment_methods'] = [];
            if (!isset($memory['sales'])) $memory['sales'] = [];

            $eligibleSubs = array_filter($memory['subscriptions'], function ($s) use ($cycleDay) {
                return ($s['status'] ?? '') === 'active' &&
                    !empty($s['auto_renew']) &&
                    ($s['plan'] ?? '') !== '1_day' &&
                    (($s['billing_day'] ?? 1) === $cycleDay || empty($s['billing_day']));
            });

            $chargeResults = [];

            foreach ($eligibleSubs as &$sub) {
                $pm = null;
                foreach ($memory['payment_methods'] as $p) {
                    if (($p['user_id'] ?? '') === ($sub['user_id'] ?? '') && ($p['status'] ?? '') === 'active') {
                        $pm = $p;
                        break;
                    }
                }

                $resolvedPlan = MembershipRates::resolvePlan($sub['plan'] ?? '1_month');
                $monthlyAmount = (float)($sub['monthly_due_amount'] ?? $resolvedPlan['planFee']);

                if (!$pm || empty($pm['gateway_token'])) {
                    $chargeResults[] = [
                        'user_id' => $sub['user_id'],
                        'plan' => $sub['plan'],
                        'status' => 'SKIPPED_NO_TOKEN',
                        'message' => 'No active tokenized card found on file.'
                    ];
                    continue;
                }

                $externalId = sprintf('KSYN-REC-%s-%s', substr($sub['user_id'] ?? '', 0, 8), time());
                $charge = $this->xenditService->chargeCard([
                    'tokenId' => $pm['gateway_token'],
                    'externalId' => $externalId,
                    'amount' => $monthlyAmount
                ]);

                if ($charge['status'] === 'CAPTURED') {
                    $sub['end_date'] = date('Y-m-d', strtotime('+30 days', strtotime($sub['end_date'] ?? 'now')));
                    $sub['next_billing_date'] = date('Y-m-d', time() + (30 * 86400));
                    $sub['auto_debit_retries'] = 0;

                    array_unshift($memory['sales'], [
                        'id' => sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff) | 0x4000, random_int(0, 0x3fff) | 0x8000, random_int(0, 0xffffffffffff)),
                        'branch_id' => $sub['branch_id'] ?? 'b-mkt-01',
                        'user_id' => $sub['user_id'],
                        'amount' => $monthlyAmount,
                        'category' => 'membership_fee',
                        'payment_method' => 'xendit_recurring_card',
                        'reference_no' => $externalId,
                        'created_at' => date('c')
                    ]);

                    $chargeResults[] = [
                        'user_id' => $sub['user_id'],
                        'plan' => $sub['plan'],
                        'status' => 'SUCCESS',
                        'amount' => $monthlyAmount,
                        'charge_id' => $charge['id'],
                        'new_end_date' => $sub['end_date']
                    ];
                } else {
                    $sub['auto_debit_retries'] = ($sub['auto_debit_retries'] ?? 0) + 1;
                    $chargeResults[] = [
                        'user_id' => $sub['user_id'],
                        'plan' => $sub['plan'],
                        'status' => 'DECLINED',
                        'retries' => $sub['auto_debit_retries']
                    ];
                }
            }
            unset($sub);

            Database::saveStore();

            $successCount = count(array_filter($chargeResults, fn($r) => $r['status'] === 'SUCCESS'));
            $declinedCount = count(array_filter($chargeResults, fn($r) => in_array($r['status'], ['DECLINED', 'FAILED'], true)));

            return JsonResponse::success($response, [
                'message' => "Xendit recurring billing cycle executed for the {$cycleDay}th of the month.",
                'cycle_day' => $cycleDay,
                'total_eligible' => count($eligibleSubs),
                'successful_charges' => $successCount,
                'declined_charges' => $declinedCount,
                'results' => $chargeResults
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 7. GET DYNAMIC QR PH PAYMENT STATUS
     * GET /api/payments/xendit/qr-status/{id}
     */
    public function getQrStatus(Request $request, Response $response, array $args): Response
    {
        try {
            $id = $args['id'] ?? '';
            $memory = &Database::getMemoryStore();
            $invoices = $memory['payment_invoices'] ?? [];

            $invoice = null;
            foreach ($invoices as $inv) {
                if (($inv['id'] ?? '') === $id || ($inv['invoice_no'] ?? '') === $id || ($inv['gateway_ref'] ?? '') === $id || ($inv['id'] ?? '') === "qr_{$id}" || str_contains($inv['id'] ?? '', $id)) {
                    $invoice = $inv;
                    break;
                }
            }

            if (!$invoice) {
                return JsonResponse::success($response, [
                    'status' => 'PENDING',
                    'paid' => false,
                    'id' => $id
                ]);
            }

            $isPaid = in_array(strtoupper($invoice['status'] ?? ''), ['SETTLED', 'PAID', 'COMPLETED'], true);
            return JsonResponse::success($response, [
                'id' => $invoice['id'],
                'invoice_no' => $invoice['invoice_no'] ?? $id,
                'status' => $isPaid ? 'PAID' : ($invoice['status'] ?? 'PENDING'),
                'paid' => $isPaid,
                'amount' => $invoice['amount'] ?? 0
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 8. SIMULATE / TEST DYNAMIC QR PH PAYMENT CONFIRMATION
     * POST /api/payments/xendit/simulate-qr-paid/{id}
     */
    public function simulateQrPaid(Request $request, Response $response, array $args): Response
    {
        try {
            $id = $args['id'] ?? '';
            $body = (array)$request->getParsedBody();
            $memory = &Database::getMemoryStore();
            if (!isset($memory['payment_invoices'])) $memory['payment_invoices'] = [];

            $invoice = null;
            foreach ($memory['payment_invoices'] as &$inv) {
                if (($inv['id'] ?? '') === $id || ($inv['invoice_no'] ?? '') === $id || ($inv['gateway_ref'] ?? '') === $id || str_contains($inv['id'] ?? '', $id)) {
                    $invoice = &$inv;
                    break;
                }
            }

            if (!$invoice) {
                $invoice = [
                    'id' => $id,
                    'invoice_no' => 'KSYN-QR-' . time(),
                    'status' => 'pending',
                    'amount' => (float)($body['amount'] ?? 0),
                    'created_at' => date('c')
                ];
                array_unshift($memory['payment_invoices'], $invoice);
            }

            $invoice['status'] = 'PAID';
            $invoice['paid_at'] = date('c');
            Database::saveStore();

            return JsonResponse::success($response, [
                'message' => 'Dynamic QR Ph payment marked as PAID.',
                'status' => 'PAID',
                'paid' => true,
                'invoice' => $invoice
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }
}
