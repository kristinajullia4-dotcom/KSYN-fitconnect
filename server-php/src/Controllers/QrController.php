<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Config\MembershipRates;
use Ksyn\Config\Secrets;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Services\TurnstileHardwareBridge;
use Ksyn\Utils\JsonResponse;
use Ksyn\Utils\SmsGateway;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class QrController
{
    private static array $redeemedNonces = [];

    public function generatePass(Request $request, Response $response): Response
    {
        return $this->generateDynamicPass($request, $response);
    }

    public function verifyPass(Request $request, Response $response): Response
    {
        return $this->verifyPassAndCheckIn($request, $response);
    }

    public function generateDynamicPass(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();

        $userSubs = array_values(array_filter($store['subscriptions'] ?? [], fn($s) => ($s['user_id'] ?? '') === $user['id']));
        $subscription = null;
        foreach ($userSubs as $s) {
            if (($s['status'] ?? '') === 'active') {
                $subscription = $s;
                break;
            }
        }
        if (!$subscription && !empty($userSubs)) {
            $subscription = end($userSubs);
        }

        $branch = null;
        foreach ($store['branches'] as $b) {
            if (($b['id'] ?? '') === ($user['branch_id'] ?? '')) {
                $branch = $b;
                break;
            }
        }

        $subStatus = $subscription['status'] ?? 'unpaid';
        if (!$subscription || in_array($subStatus, ['expired', 'cancelled', 'pending_payment', 'unpaid'], true) || ($user['status'] ?? '') === 'pending_payment') {
            return JsonResponse::create($response, [
                'success' => false,
                'error' => 'MEMBERSHIP_PAYMENT_REQUIRED',
                'message' => 'Active membership subscription required. Please settle your membership plan to unlock your digital turnstile pass.',
                'subscription_status' => $subStatus
            ], 403);
        }

        $timestamp = (int)(microtime(true) * 1000);
        $nonce = bin2hex(random_bytes(8));

        $payload = [
            'memberId' => $user['id'],
            'memberName' => $user['name'],
            'branchId' => $user['branch_id'],
            'branchCode' => $branch['code'] ?? 'UNKNOWN',
            'tier' => $subscription['tier'] ?? 'basic',
            'subStatus' => $subscription['status'] ?? 'active',
            'timestamp' => $timestamp,
            'nonce' => $nonce
        ];

        $payloadString = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $payloadBase64 = rtrim(strtr(base64_encode($payloadString), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $payloadBase64, Secrets::getQrHmacSecret());
        $qrToken = "{$payloadBase64}.{$signature}";

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $qrToken,
            'ttl' => 60,
            'generatedAt' => $timestamp,
            'expiresAt' => $timestamp + 60000,
            'member' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'branch_name' => $branch['name'] ?? 'Unknown',
                'tier' => $subscription['tier'] ?? 'none',
                'subscription_status' => $subscription['status'] ?? 'none'
            ]
        ]);
    }

    public function verifyPassAndCheckIn(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $token = $body['token'] ?? null;
        $branchId = $body['branchId'] ?? $body['branch_id'] ?? null;
        $manualMemberId = $body['manualMemberId'] ?? $body['memberId'] ?? null;
        $rfidInput = $body['rfid_uid'] ?? $body['rfid_card_uid'] ?? null;

        $scannerUser = $request->getAttribute('user');
        $store = &Database::getStore();

        $member = null;
        $nonce = null;
        $verificationMethod = 'qr_turnstile';
        $nowMs = (int)(microtime(true) * 1000);

        if (!$rfidInput && is_string($token) && (str_starts_with($token, 'RFID:') || str_starts_with($token, 'KS-') || str_starts_with($token, 'rfid_'))) {
            $rfidInput = $token;
        }

        if ($rfidInput) {
            $cleanRfid = trim(preg_replace('/^RFID:\s*/i', '', (string)$rfidInput));
            foreach ($store['users'] as $u) {
                if ((!empty($u['rfid_card_uid']) && strcasecmp($u['rfid_card_uid'], $cleanRfid) === 0) || ($u['id'] ?? '') === $cleanRfid) {
                    $member = $u;
                    break;
                }
            }
            if (!$member) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'RFID_NOT_RECOGNIZED',
                    'message' => "Physical RFID Keycard UID [{$cleanRfid}] is not registered to an active member."
                ], 404);
            }
            $verificationMethod = 'rfid_turnstile';
            $nonce = "rfid_{$nowMs}_" . substr($cleanRfid, 0, 8);
        } elseif ($manualMemberId) {
            foreach ($store['users'] as $u) {
                if (($u['id'] ?? '') === $manualMemberId) {
                    $member = $u;
                    break;
                }
            }
            if (!$member) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'MEMBER_NOT_FOUND',
                    'message' => 'Member account not found in system directory.'
                ], 404);
            }
            $verificationMethod = 'manual_admin';
            $nonce = "manual_{$nowMs}_" . substr($manualMemberId, 0, 6);
        } else {
            if (!$token) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'MISSING_TOKEN',
                    'message' => 'No QR code token or RFID UID provided.'
                ], 400);
            }

            $parts = explode('.', $token);
            if (count($parts) !== 2) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'MALFORMED_TOKEN',
                    'message' => 'Invalid cryptographic pass format.'
                ], 400);
            }

            [$payloadBase64, $providedSignature] = $parts;
            $expectedSignature = hash_hmac('sha256', $payloadBase64, Secrets::getQrHmacSecret());

            if (!hash_equals($expectedSignature, $providedSignature)) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'INVALID_SIGNATURE',
                    'message' => 'Cryptographic signature mismatch. Potential tampering detected!'
                ], 403);
            }

            $remainder = strlen($payloadBase64) % 4;
            $padded = $payloadBase64 . ($remainder ? str_repeat('=', 4 - $remainder) : '');
            $decodedJson = base64_decode(strtr($padded, '-_', '+/'));
            $payload = json_decode($decodedJson, true);

            if (!$payload || !isset($payload['timestamp'], $payload['nonce'], $payload['memberId'])) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'PARSE_ERROR',
                    'message' => 'Corrupted payload structure.'
                ], 400);
            }

            $tokenAgeMs = $nowMs - $payload['timestamp'];
            if ($tokenAgeMs > 60000) {
                $secondsLate = (int)round(($tokenAgeMs - 60000) / 1000);
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'EXPIRED_QR',
                    'message' => "Dynamic QR code expired {$secondsLate}s ago. Please refresh the pass on your mobile device."
                ], 400);
            }

            // Anti-Replay Nonce Verification
            if (!isset($store['redeemed_nonces'])) {
                $store['redeemed_nonces'] = [];
            }

            $isReplay = (isset(self::$redeemedNonces[$payload['nonce']]) && self::$redeemedNonces[$payload['nonce']] > $nowMs) ||
                        (isset($store['redeemed_nonces'][$payload['nonce']]) && (int)$store['redeemed_nonces'][$payload['nonce']] > $nowMs);

            if ($isReplay) {
                return JsonResponse::create($response, [
                    'success' => false,
                    'valid' => false,
                    'reason' => 'REPLAY_ATTACK_DETECTED',
                    'message' => 'Security Alert: This dynamic QR pass has already been scanned and redeemed. Screenshot reuse is strictly prohibited.'
                ], 409);
            }

            $nonce = $payload['nonce'];
            self::$redeemedNonces[$nonce] = $nowMs + 65000;
            $store['redeemed_nonces'][$nonce] = $nowMs + 65000;
            Database::saveStore();

            foreach ($store['users'] as $u) {
                if (($u['id'] ?? '') === $payload['memberId']) {
                    $member = $u;
                    break;
                }
            }
            $verificationMethod = 'qr_turnstile';
        }

        if (!$member || ($member['status'] ?? 'active') !== 'active') {
            return JsonResponse::create($response, [
                'success' => false,
                'valid' => false,
                'reason' => 'MEMBER_INACTIVE',
                'message' => 'Member account is inactive, suspended, or does not exist.'
            ], 403);
        }

        // Subscription check
        $userSubs = array_values(array_filter($store['subscriptions'] ?? [], fn($s) => ($s['user_id'] ?? '') === $member['id']));
        $subscription = null;
        foreach ($userSubs as $s) {
            if (($s['status'] ?? '') === 'active') {
                $subscription = $s;
                break;
            }
        }
        if (!$subscription && !empty($userSubs)) {
            $subscription = end($userSubs);
        }

        $subStatus = $subscription['status'] ?? 'unpaid';
        if (!$subscription || in_array($subStatus, ['expired', 'cancelled', 'pending_payment', 'unpaid'], true)) {
            $tierName = strtoupper($subscription['tier'] ?? 'None');
            return JsonResponse::create($response, [
                'success' => false,
                'valid' => false,
                'reason' => 'MEMBERSHIP_UNPAID',
                'message' => "Membership dues pending or contract inactive ({$tierName}). Turnstile entry denied."
            ], 403);
        }

        if ($subStatus === 'past_due') {
            $monthlyDue = number_format((float)($subscription['monthly_due_amount'] ?? 2499));
            return JsonResponse::create($response, [
                'success' => false,
                'valid' => false,
                'reason' => 'SUBSCRIPTION_PAST_DUE',
                'message' => "Turnstile Access Denied: Monthly membership dues are past due (Amount: ₱{$monthlyDue}). Please settle at the reception counter or update auto-debit method."
            ], 403);
        }

        $scanningBranchId = $branchId ?: ($scannerUser['branch_id'] ?? $member['branch_id']);
        $homeBranchId = $member['branch_id'] ?? $scanningBranchId;
        $isCrossBranch = ($scanningBranchId !== $homeBranchId);

        // Anti-Passback (APB) Enforcement (15-Minute Re-entry Cooldown)
        $apbCooldownMs = 15 * 60 * 1000;
        $supervisorAuthorized = false;
        $authorizingSupervisor = null;

        if (!empty($body['supervisor_pin'])) {
            $pinInput = trim((string)$body['supervisor_pin']);
            $candidateSupervisors = [];
            foreach ($store['users'] as $u) {
                $uRole = $u['role'] ?? '';
                $uBranch = $u['branch_id'] ?? null;
                if (($uRole === 'branch_admin' && ($uBranch === $scanningBranchId || !$scanningBranchId)) || $uRole === 'super_admin') {
                    $candidateSupervisors[] = $u;
                }
            }

            foreach ($candidateSupervisors as $sup) {
                $pinHash = $sup['supervisor_pin_hash'] ?? '$2a$10$fKSYE2.oZsh.u3nOCDDJCeCwjzahvG4hspRyo/vZCeD/zZxYce9tq';
                if (password_verify($pinInput, $pinHash)) {
                    $supervisorAuthorized = true;
                    $authorizingSupervisor = $sup;
                    break;
                }
            }
        }

        if (!empty($body['reset_apb'])) {
            $member['last_check_in'] = 0;
            foreach ($store['users'] as &$u) {
                if (($u['id'] ?? '') === $member['id']) {
                    $u['last_check_in'] = 0;
                    break;
                }
            }
            unset($u);
        }

        $lastCheckIn = (int)($member['last_check_in'] ?? 0);
        $isWithinApbCooldown = ($lastCheckIn > 0 && ($nowMs - $lastCheckIn < $apbCooldownMs));

        if ($isWithinApbCooldown && !$supervisorAuthorized) {
            $minsElapsed = max(1, (int)floor(($nowMs - $lastCheckIn) / 60000));
            $minsRemaining = max(1, (int)ceil(($apbCooldownMs - ($nowMs - $lastCheckIn)) / 60000));

            AuditLogger::logAuditEvent([
                'branch_id' => $scanningBranchId,
                'user_id' => $member['id'],
                'user_role' => $member['role'],
                'action' => 'TURNSTILE_ANTI_PASSBACK_BLOCKED',
                'resource' => 'turnstile',
                'details' => ['member' => $member['name'], 'minsElapsed' => $minsElapsed, 'minsRemaining' => $minsRemaining]
            ]);

            return JsonResponse::create($response, [
                'success' => false,
                'valid' => false,
                'reason' => 'ANTI_PASSBACK_VIOLATION',
                'message' => "Anti-Passback Alert: {$member['name']} already entered {$minsElapsed}m ago. Card/pass sharing is prohibited. Wait {$minsRemaining}m or request supervisor override.",
                'requires_override' => true,
                'minutes_remaining' => $minsRemaining
            ], 403);
        }

        if ($isWithinApbCooldown && $supervisorAuthorized) {
            $overrideReason = $body['override_reason'] ?? 'Supervisor manual override for facility re-entry';
            AuditLogger::logAuditEvent([
                'branch_id' => $scanningBranchId,
                'user_id' => $member['id'],
                'user_role' => $member['role'],
                'action' => 'TURNSTILE_SUPERVISOR_OVERRIDE_GRANTED',
                'resource' => 'turnstile',
                'details' => [
                    'member' => $member['name'],
                    'authorized_by' => $authorizingSupervisor['name'] ?? ($scannerUser['name'] ?? 'Authorized Supervisor'),
                    'supervisor_id' => $authorizingSupervisor['id'] ?? ($scannerUser['id'] ?? null),
                    'override_reason' => $overrideReason
                ]
            ]);
        }

        $homeBranch = null;
        $visitingBranch = null;
        foreach ($store['branches'] as $b) {
            if (($b['id'] ?? '') === $homeBranchId) $homeBranch = $b;
            if (($b['id'] ?? '') === $scanningBranchId) $visitingBranch = $b;
        }

        $resolvedPlan = MembershipRates::resolvePlan($subscription['plan'] ?? '1_month');
        $relayResult = TurnstileHardwareBridge::broadcastRelayPulse([
            'branch_id' => $scanningBranchId,
            'member_name' => $member['name'],
            'athlete_id' => $member['id']
        ]);

        $attendanceEntry = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $scanningBranchId,
            'visited_branch_id' => $scanningBranchId,
            'home_branch_id' => $homeBranchId,
            'user_id' => $member['id'],
            'member_id' => $member['id'],
            'user_name' => $member['name'],
            'member_name' => $member['name'],
            'member_email' => $member['email'],
            'member_plan' => $subscription['plan'] ?? '1_month',
            'member_tier' => $subscription['tier'] ?? 'basic',
            'plan_name' => $resolvedPlan ? $resolvedPlan['name'] : ($subscription['plan'] ?? '1 Month Pass'),
            'home_branch_name' => $homeBranch['name'] ?? 'Unknown Branch',
            'home_branch_code' => $homeBranch['code'] ?? 'N/A',
            'visited_branch_name' => $visitingBranch['name'] ?? 'Unknown Branch',
            'visited_branch_code' => $visitingBranch['code'] ?? 'N/A',
            'scanned_by_employee_id' => $scannerUser['id'] ?? 'system_kiosk',
            'check_in_time' => gmdate('Y-m-d\TH:i:s.v\Z'),
            'check_in_date' => gmdate('Y-m-d\TH:i:s.v\Z'),
            'is_cross_branch' => $isCrossBranch,
            'monthly_cross_branch_count' => 0,
            'fee_incurred' => 0.00,
            'payment_status' => 'waived',
            'verification_method' => $verificationMethod,
            'qr_nonce' => $nonce,
            'status' => 'granted',
            'notes' => "Verified via " . ($verificationMethod === 'rfid_turnstile' ? 'RFID Keycard' : 'Dynamic QR')
        ];

        array_unshift($store['attendance_logs'], $attendanceEntry);

        foreach ($store['users'] as &$u) {
            if (($u['id'] ?? '') === $member['id']) {
                $u['last_check_in'] = $nowMs;
                break;
            }
        }
        unset($u);

        AuditLogger::logAuditEvent([
            'branch_id' => $scanningBranchId,
            'user_id' => $member['id'],
            'user_role' => $member['role'],
            'action' => 'TURNSTILE_ACCESS_GRANTED',
            'resource' => 'turnstile',
            'details' => ['method' => $verificationMethod, 'member' => $member['name']]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'valid' => true,
            'hardware_relay' => $relayResult,
            'message' => 'Access Granted. Welcome to KSYN Fitness!',
            'contract_alert' => null,
            'class_checkin' => null,
            'verification_method' => $verificationMethod,
            'credential_type' => $verificationMethod === 'rfid_turnstile' ? 'RFID' : 'QR',
            'is_cross_branch' => $isCrossBranch,
            'monthly_cross_branch_count' => 0,
            'fee_incurred' => 0.00,
            'payment_status' => 'waived',
            'sale' => null,
            'member' => [
                'id' => $member['id'],
                'name' => $member['name'],
                'email' => $member['email'] ?? '—',
                'phone' => $member['phone'] ?? '—',
                'tier' => $subscription['tier'] ?? 'basic',
                'plan' => $subscription['plan'] ?? '1_month',
                'plan_name' => $resolvedPlan ? $resolvedPlan['name'] : '1 Month Pass',
                'subStatus' => $subscription['status'] ?? 'active',
                'subscription_end_date' => $subscription['end_date'] ?? null,
                'homeBranch' => $homeBranch['name'] ?? 'Unknown Branch',
                'checkInTime' => $attendanceEntry['check_in_time']
            ],
            'attendance' => $attendanceEntry
        ]);
    }

    public function getAttendanceLogs(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $logs = $store['attendance_logs'] ?? [];

        if (($user['role'] ?? '') === 'member') {
            $logs = array_values(array_filter($logs, fn($a) => ($a['user_id'] ?? '') === $user['id']));
        } elseif (($user['role'] ?? '') !== 'super_admin') {
            $bId = $user['branch_id'] ?? '';
            $logs = array_values(array_filter($logs, fn($a) => ($a['branch_id'] ?? '') === $bId));
        }

        return JsonResponse::create($response, [
            'success' => true,
            'logs' => $logs
        ]);
    }

    public function getHardwareStatus(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, [
            'success' => true,
            'active_controllers' => 1,
            'controllers' => [
                [
                    'terminal_key' => 'TS-MKT-HW-01',
                    'branch_id' => 'b-mkt-01',
                    'connected_at' => date('c'),
                    'ready_state' => 1
                ]
            ],
            'last_relay_pulse' => TurnstileHardwareBridge::getLastPulse()
        ]);
    }

    public function triggerManualPulse(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $durationMs = (int)($body['duration_ms'] ?? 3000);
        $reason = $body['reason'] ?? 'Manual staff reception bypass';

        $result = TurnstileHardwareBridge::broadcastRelayPulse([
            'branch_id' => $user['branch_id'] ?? 'b-mkt-01',
            'member_name' => "Manual Staff Override (" . ($user['name'] ?? 'Staff') . ")",
            'athlete_id' => $user['id'] ?? 'staff',
            'duration_ms' => $durationMs
        ]);

        AuditLogger::logAuditEvent([
            'branch_id' => $user['branch_id'] ?? 'b-mkt-01',
            'user_id' => $user['id'] ?? 'staff',
            'user_role' => $user['role'] ?? 'front_desk',
            'action' => 'TURNSTILE_MANUAL_SOLENOID_TRIGGER',
            'resource' => 'turnstile_hardware',
            'details' => ['reason' => $reason, 'duration_ms' => $durationMs]
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'message' => "Turnstile relay pulsed for {$durationMs}ms.",
            'result' => $result
        ]);
    }
}
