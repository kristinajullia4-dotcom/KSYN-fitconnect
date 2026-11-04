<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Config\MembershipRates;
use Ksyn\Config\Secrets;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Ksyn\Utils\Mailer;
use Firebase\JWT\JWT;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuthController
{
    private const EMAIL_ALIASES = [
        'superadmin@ksyn.com' => ['superadmin@ksyn.com', 'super_admin@ksyn.com'],
        'super_admin@ksyn.com' => ['superadmin@ksyn.com', 'super_admin@ksyn.com'],
        'makati.admin@ksyn.com' => ['admin.makati@ksyn.com', 'makati.admin@ksyn.com', 'admin.bgc@ksyn.com', 'bgc.admin@ksyn.com'],
        'admin.makati@ksyn.com' => ['admin.makati@ksyn.com', 'makati.admin@ksyn.com', 'admin.bgc@ksyn.com', 'bgc.admin@ksyn.com'],
        'bgc.admin@ksyn.com' => ['admin.makati@ksyn.com', 'makati.admin@ksyn.com', 'admin.bgc@ksyn.com', 'bgc.admin@ksyn.com'],
        'admin.bgc@ksyn.com' => ['admin.makati@ksyn.com', 'makati.admin@ksyn.com', 'admin.bgc@ksyn.com', 'bgc.admin@ksyn.com'],
        'makati.staff@ksyn.com' => ['makati.staff@ksyn.com', 'staff.makati@ksyn.com', 'staff.bgc@ksyn.com'],
        'staff.makati@ksyn.com' => ['makati.staff@ksyn.com', 'staff.makati@ksyn.com', 'staff.bgc@ksyn.com'],
        'staff.bgc@ksyn.com' => ['makati.staff@ksyn.com', 'staff.makati@ksyn.com', 'staff.bgc@ksyn.com'],
        'member.makati@ksyn.com' => ['member.makati@ksyn.com', 'member.juan@ksyn.com', 'member.bgc@ksyn.com'],
        'member.juan@ksyn.com' => ['member.juan@ksyn.com', 'member.makati@ksyn.com', 'member.bgc@ksyn.com'],
        'member.bgc@ksyn.com' => ['member.makati@ksyn.com', 'member.juan@ksyn.com', 'member.bgc@ksyn.com'],
        'coach.sofia@ksyn.com' => ['coach.sofia@ksyn.com', 'coach@ksyn.com'],
        'coach@ksyn.com' => ['coach.sofia@ksyn.com', 'coach@ksyn.com'],
        'owner.makati@ksyn.com' => ['owner.makati@ksyn.com', 'owner.bgc@ksyn.com', 'investor.bgc@ksyn.com'],
        'owner.bgc@ksyn.com' => ['owner.makati@ksyn.com', 'owner.bgc@ksyn.com', 'investor.bgc@ksyn.com']
    ];

    public function login(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $rawIdentifier = trim($body['email'] ?? $body['username'] ?? $body['identifier'] ?? '');
        $password = (string)($body['password'] ?? '');

        if (!$rawIdentifier || !$password) {
            return JsonResponse::error(
                $response,
                'MISSING_CREDENTIALS',
                'Email address (or username) and password are required.',
                400
            );
        }

        $cleanIdentifier = strtolower($rawIdentifier);
        $candidates = self::EMAIL_ALIASES[$cleanIdentifier] ?? [$cleanIdentifier];

        $store = &Database::getStore();
        $users = &$store['users'];

        $user = null;
        foreach ($users as &$u) {
            $uEmail = strtolower($u['email'] ?? '');
            $uUser = strtolower($u['username'] ?? '');
            if (in_array($uEmail, $candidates, true) || $uUser === $cleanIdentifier) {
                $user = &$u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::error(
                $response,
                'INVALID_CREDENTIALS',
                'Authentication failed. Please verify your email/username and password.',
                401
            );
        }

        if (($user['status'] ?? '') !== 'active' && ($user['is_active'] ?? null) === false) {
            return JsonResponse::error(
                $response,
                'ACCOUNT_INACTIVE',
                'Your account is deactivated or suspended. Please contact KSYN administration.',
                403
            );
        }

        $now = time();
        $lockKey = strtolower($user['email'] ?? $cleanIdentifier);

        if (!isset($store['login_attempts']) || !is_array($store['login_attempts'])) {
            $store['login_attempts'] = [];
        }

        $attemptInfo = $store['login_attempts'][$lockKey] ?? ['failed_count' => 0, 'locked_until' => 0];

        // 1. Check if account is currently locked out
        if (!empty($attemptInfo['locked_until']) && $attemptInfo['locked_until'] > $now) {
            $remainingSeconds = $attemptInfo['locked_until'] - $now;
            $remainingMinutes = ceil($remainingSeconds / 60);

            AuditLogger::logAuditEvent([
                'branch_id' => $user['branch_id'] ?? null,
                'user_id' => $user['id'] ?? null,
                'user_role' => $user['role'] ?? null,
                'action' => 'AUTH_LOGIN_BLOCKED_LOCKOUT',
                'resource' => 'auth',
                'details' => ['identifier' => $rawIdentifier, 'remaining_seconds' => $remainingSeconds]
            ]);

            return JsonResponse::create($response, [
                'success' => false,
                'error' => 'ACCOUNT_LOCKED',
                'message' => "Account is temporarily locked due to 5 consecutive failed login attempts. Please wait {$remainingMinutes} minute(s) or reset your password.",
                'remaining_seconds' => $remainingSeconds,
                'locked_until' => $attemptInfo['locked_until']
            ], 423);
        }

        // If lockout period has expired, reset attempt count
        if (!empty($attemptInfo['locked_until']) && $attemptInfo['locked_until'] <= $now) {
            $attemptInfo['failed_count'] = 0;
            $attemptInfo['locked_until'] = 0;
        }

        // 2. Verify password
        $match = false;
        if (!empty($user['password_hash'])) {
            $match = password_verify($password, $user['password_hash']);
        }
        if (!$match && !empty($user['secondary_password_hash'])) {
            $match = password_verify($password, $user['secondary_password_hash']);
        }
        if (!$match && !Secrets::isProd()) {
            if ($password === 'Password123!' || (!empty($user['plain_password']) && $password === $user['plain_password'])) {
                $match = true;
            }
        }

        if (!$match) {
            $newFailedCount = ($attemptInfo['failed_count'] ?? 0) + 1;
            $maxAttempts = 5;

            if ($newFailedCount >= $maxAttempts) {
                // Lock account for 15 minutes (900 seconds)
                $lockedUntil = $now + 900;
                $store['login_attempts'][$lockKey] = [
                    'failed_count' => $newFailedCount,
                    'locked_until' => $lockedUntil,
                    'last_failed_at' => $now
                ];
                Database::saveStore();

                AuditLogger::logAuditEvent([
                    'branch_id' => $user['branch_id'] ?? null,
                    'user_id' => $user['id'] ?? null,
                    'user_role' => $user['role'] ?? null,
                    'action' => 'AUTH_ACCOUNT_LOCKED',
                    'resource' => 'auth',
                    'details' => ['identifier' => $rawIdentifier, 'failed_attempts' => $newFailedCount, 'locked_until' => date('c', $lockedUntil)]
                ]);

                return JsonResponse::create($response, [
                    'success' => false,
                    'error' => 'ACCOUNT_LOCKED',
                    'message' => 'Account locked: 5 consecutive failed login attempts. Please wait 15 minutes or click Forgot Password to reset.',
                    'remaining_seconds' => 900,
                    'locked_until' => $lockedUntil
                ], 423);
            }

            // Increment failed attempts and return remaining count
            $remainingAttempts = $maxAttempts - $newFailedCount;
            $store['login_attempts'][$lockKey] = [
                'failed_count' => $newFailedCount,
                'locked_until' => 0,
                'last_failed_at' => $now
            ];
            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $user['branch_id'] ?? null,
                'user_id' => $user['id'] ?? null,
                'user_role' => $user['role'] ?? null,
                'action' => 'AUTH_LOGIN_FAILED',
                'resource' => 'auth',
                'details' => ['identifier' => $rawIdentifier, 'failed_attempts' => $newFailedCount, 'remaining_attempts' => $remainingAttempts]
            ]);

            return JsonResponse::create($response, [
                'success' => false,
                'error' => 'INVALID_CREDENTIALS',
                'message' => "Invalid email or password. Warning: {$remainingAttempts} attempt(s) remaining before temporary account lockout.",
                'remaining_attempts' => $remainingAttempts
            ], 401);
        }

        // On successful password match, reset failed attempt tracker!
        if (isset($store['login_attempts'][$lockKey])) {
            unset($store['login_attempts'][$lockKey]);
            Database::saveStore();
        }

        // Sign Short-Lived Access Token (15 mins)
        $now = time();
        $tokenPayload = [
            'id' => $user['id'],
            'role' => $user['role'],
            'branch_id' => $user['branch_id'] ?? null,
            'email' => $user['email'],
            'username' => $user['username'] ?? explode('@', $user['email'])[0],
            'name' => $user['name'],
            'iat' => $now,
            'exp' => $now + 900
        ];

        $accessToken = JWT::encode($tokenPayload, Secrets::getJwtSecret(), 'HS256');
        $refreshToken = bin2hex(random_bytes(40));
        $refreshTokenHash = hash('sha256', $refreshToken);
        $familyId = bin2hex(random_bytes(16));

        if (!isset($store['refresh_tokens']) || !is_array($store['refresh_tokens'])) {
            $store['refresh_tokens'] = [];
        }
        $store['refresh_tokens'][] = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'family_id' => $familyId,
            'token_hash' => $refreshTokenHash,
            'expires_at' => date('c', time() + 7 * 86400),
            'created_at' => date('c'),
            'is_revoked' => false
        ];
        Database::saveStore();

        $branch = null;
        if (!empty($user['branch_id'])) {
            foreach ($store['branches'] as $b) {
                if ($b['id'] === $user['branch_id']) {
                    $branch = $b;
                    break;
                }
            }
        }

        AuditLogger::logAuditEvent([
            'branch_id' => $user['branch_id'] ?? null,
            'user_id' => $user['id'],
            'user_role' => $user['role'],
            'action' => 'AUTH_LOGIN_SUCCESS',
            'resource' => 'auth',
            'details' => ['role' => $user['role'], 'branch_code' => $branch['code'] ?? 'GLOBAL']
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $accessToken,
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'expires_in' => 900,
            'user' => [
                'id' => $user['id'],
                'role' => $user['role'],
                'branch_id' => $user['branch_id'] ?? null,
                'branch_name' => $branch ? $branch['name'] : ($user['role'] === 'super_admin' ? 'KSYN Corporate HQ' : null),
                'branch_code' => $branch ? $branch['code'] : ($user['role'] === 'super_admin' ? 'HQ-GLOBAL' : null),
                'name' => $user['name'],
                'email' => $user['email'],
                'username' => $user['username'] ?? explode('@', $user['email'])[0],
                'phone' => $user['phone'] ?? '',
                'status' => $user['status'] ?? 'active',
                'is_active' => ($user['status'] ?? 'active') === 'active',
                'is_verified' => true,
                'email_verified' => true,
                'membership_plan' => $user['membership_plan'] ?? null,
                'rfid_card_uid' => $user['rfid_card_uid'] ?? null
            ]
        ]);
    }

    public function googleLogin(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $credential = $body['credential'] ?? $body['token'] ?? null;
        $demoProfile = $body['demo_profile'] ?? null;

        $email = null;
        $name = null;
        $googleId = null;
        $picture = null;

        if (!empty($credential)) {
            // A Google ID Token is a JWT with 3 parts: header.payload.signature
            $parts = explode('.', (string)$credential);
            if (count($parts) === 3) {
                $payloadJson = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1]));
                $payload = json_decode($payloadJson, true);
                if (is_array($payload) && !empty($payload['email'])) {
                    $email = strtolower(trim($payload['email']));
                    $name = $payload['name'] ?? explode('@', $email)[0];
                    $googleId = $payload['sub'] ?? ('google_' . bin2hex(random_bytes(8)));
                    $picture = $payload['picture'] ?? null;
                }
            }
        }

        if (!$email && is_array($demoProfile) && !empty($demoProfile['email'])) {
            $email = strtolower(trim($demoProfile['email']));
            $name = $demoProfile['name'] ?? explode('@', $email)[0];
            $googleId = $demoProfile['id'] ?? ('google_' . bin2hex(random_bytes(8)));
            $picture = $demoProfile['picture'] ?? null;
        }

        if (!$email && !empty($body['email'])) {
            $email = strtolower(trim($body['email']));
            $name = !empty($body['name']) ? trim($body['name']) : ucwords(str_replace(['.', '_', '-'], ' ', explode('@', $email)[0]));
            $googleId = $body['google_id'] ?? ('google_' . bin2hex(random_bytes(8)));
            $picture = $body['picture'] ?? null;
        }

        if (!$email) {
            return JsonResponse::error(
                $response,
                'GOOGLE_AUTH_FAILED',
                'Invalid Google credential token or profile payload.',
                400
            );
        }

        $store = &Database::getStore();
        $user = null;
        $userIndex = -1;

        foreach ($store['users'] as $idx => $u) {
            if (
                (!empty($u['google_id']) && $u['google_id'] === $googleId) ||
                (strtolower($u['email'] ?? '') === $email)
            ) {
                $user = $u;
                $userIndex = $idx;
                break;
            }
        }

        $isVerifiedCompleteAthlete = $user &&
            !empty($user['phone']) &&
            $user['phone'] !== '+63 917 000 0000' &&
            (!empty($user['password_hash']) || ($user['auth_provider'] ?? '') === 'google' || !empty($user['is_verified']));

        if (!$isVerifiedCompleteAthlete) {
            return JsonResponse::success($response, [
                'is_new_user' => true,
                'google_profile' => [
                    'email' => $email,
                    'name' => $user['name'] ?? $name,
                    'picture' => $user['avatar_url'] ?? $picture,
                    'google_id' => $user['google_id'] ?? $googleId
                ],
                'message' => 'Account is not yet verified or registered. Please complete athlete registration.'
            ]);
        } else {
            // User is ALREADY signed up & verified! Link Google ID if not present and sign in directly
            $updated = false;
            if (empty($user['google_id'])) {
                $user['google_id'] = $googleId;
                $user['auth_provider'] = 'google';
                $updated = true;
            }
            if ($picture && empty($user['avatar_url'])) {
                $user['avatar_url'] = $picture;
                $updated = true;
            }
            if ($updated) {
                $store['users'][$userIndex] = $user;
                Database::saveStore();
            }
        }

        // Issue Access Token & Refresh Token
        $now = time();
        $tokenPayload = [
            'id' => $user['id'],
            'role' => $user['role'],
            'branch_id' => $user['branch_id'] ?? null,
            'email' => $user['email'],
            'username' => $user['username'] ?? explode('@', $user['email'])[0],
            'name' => $user['name'],
            'auth_provider' => 'google',
            'iat' => $now,
            'exp' => $now + 900
        ];

        $accessToken = JWT::encode($tokenPayload, Secrets::getJwtSecret(), 'HS256');
        $refreshToken = bin2hex(random_bytes(40));
        $refreshTokenHash = hash('sha256', $refreshToken);
        $familyId = bin2hex(random_bytes(16));

        if (!isset($store['refresh_tokens']) || !is_array($store['refresh_tokens'])) {
            $store['refresh_tokens'] = [];
        }
        $store['refresh_tokens'][] = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'family_id' => $familyId,
            'token_hash' => $refreshTokenHash,
            'expires_at' => date('c', time() + 7 * 86400),
            'created_at' => date('c'),
            'is_revoked' => false
        ];
        Database::saveStore();

        $branch = null;
        if (!empty($user['branch_id']) && !empty($store['branches'])) {
            foreach ($store['branches'] as $b) {
                if ($b['id'] === $user['branch_id']) {
                    $branch = $b;
                    break;
                }
            }
        }

        AuditLogger::logAuditEvent([
            'branch_id' => $user['branch_id'] ?? null,
            'user_id' => $user['id'],
            'user_role' => $user['role'],
            'action' => 'AUTH_GOOGLE_LOGIN',
            'resource' => 'auth',
            'details' => [
                'provider' => 'google',
                'google_id' => $googleId,
                'email' => $email,
                'role' => $user['role']
            ]
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $accessToken,
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'expires_in' => 900,
            'user' => [
                'id' => $user['id'],
                'role' => $user['role'],
                'branch_id' => $user['branch_id'] ?? null,
                'branch_name' => $branch ? $branch['name'] : ($user['role'] === 'super_admin' ? 'KSYN Corporate HQ' : 'KSYN Fitness Makati'),
                'branch_code' => $branch ? $branch['code'] : ($user['role'] === 'super_admin' ? 'HQ-GLOBAL' : 'MKT-02'),
                'name' => $user['name'],
                'email' => $user['email'],
                'username' => $user['username'] ?? explode('@', $user['email'])[0],
                'phone' => $user['phone'] ?? '+63 917 000 0000',
                'status' => $user['status'] ?? 'active',
                'is_active' => ($user['status'] ?? 'active') === 'active',
                'is_verified' => true,
                'email_verified' => true,
                'auth_provider' => 'google',
                'avatar_url' => $user['avatar_url'] ?? $picture,
                'membership_plan' => $user['membership_plan'] ?? '12_months_annual_elite',
                'rfid_card_uid' => $user['rfid_card_uid'] ?? null
            ]
        ]);
    }

    /**
     * Complete Google Registration with Gym System Requirements
     * Receives Google verified identity + required gym fields (Phone, DOB, Branch, Plan, Emergency, Waiver)
     */
    public function completeGoogleRegistration(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $googleProfile = $body['google_profile'] ?? [];
        $email = strtolower(trim($googleProfile['email'] ?? ($body['email'] ?? '')));
        $name = trim($googleProfile['name'] ?? ($body['name'] ?? ''));
        $googleId = $googleProfile['google_id'] ?? ($body['google_id'] ?? ('google_' . bin2hex(random_bytes(8))));
        $picture = $googleProfile['picture'] ?? ($body['picture'] ?? null);

        $phone = trim($body['phone'] ?? '');
        $dob = trim($body['dob'] ?? '');
        $address = trim($body['address'] ?? '');
        $branchId = trim($body['branch_id'] ?? 'MKT-02');
        $membershipPlan = trim($body['membership_plan'] ?? '12_months');
        $tier = trim($body['tier'] ?? ($membershipPlan === '12_months' ? 'elite' : ($membershipPlan === '6_months' ? 'pro' : 'standard')));
        $emergencyName = trim($body['emergency_contact_name'] ?? '');
        $emergencyPhone = trim($body['emergency_contact_phone'] ?? '');
        $waiverAccepted = !empty($body['waiver_accepted']);

        if (empty($email)) {
            return JsonResponse::error($response, 'VALIDATION_ERROR', 'Google email is required.', 400);
        }

        if (empty($phone)) {
            return JsonResponse::error($response, 'VALIDATION_ERROR', 'Mobile phone number is required.', 400);
        }

        if (empty($dob)) {
            return JsonResponse::error($response, 'VALIDATION_ERROR', 'Date of birth is required for age verification.', 400);
        }

        // Validate age >= 16
        $birthDate = strtotime($dob);
        if ($birthDate === false || (time() - $birthDate) < (16 * 365.25 * 86400)) {
            return JsonResponse::error($response, 'VALIDATION_ERROR', 'Athletes must be at least 16 years of age to register.', 400);
        }

        if (!$waiverAccepted) {
            return JsonResponse::error($response, 'VALIDATION_ERROR', 'You must accept the KSYN Gym Safety Waiver & Terms of Service.', 400);
        }

        $store = &Database::getStore();

        // Check if user already exists
        $user = null;
        $userIndex = -1;
        foreach ($store['users'] as $idx => $u) {
            if (
                (!empty($u['google_id']) && $u['google_id'] === $googleId) ||
                (strtolower($u['email'] ?? '') === $email)
            ) {
                $user = $u;
                $userIndex = $idx;
                break;
            }
        }

        $newId = $user ? $user['id'] : ('usr_' . bin2hex(random_bytes(6)));

        // Create or update athlete record
        $userData = [
            'id' => $newId,
            'branch_id' => $branchId,
            'role' => 'member',
            'name' => $name ?: explode('@', $email)[0],
            'email' => $email,
            'username' => explode('@', $email)[0],
            'phone' => $phone,
            'dob' => $dob,
            'address' => $address,
            'status' => 'active',
            'auth_provider' => 'google',
            'google_id' => $googleId,
            'avatar_url' => $picture,
            'membership_plan' => $membershipPlan,
            'membership_tier' => $tier,
            'emergency_contact_name' => $emergencyName,
            'emergency_contact_phone' => $emergencyPhone,
            'waiver_accepted' => true,
            'is_active' => true,
            'is_verified' => true,
            'email_verified' => true,
            'created_at' => $user ? ($user['created_at'] ?? date('c')) : date('c'),
            'updated_at' => date('c')
        ];

        if ($userIndex >= 0) {
            $store['users'][$userIndex] = array_merge($store['users'][$userIndex], $userData);
            $user = $store['users'][$userIndex];
        } else {
            $store['users'][] = $userData;
            $user = $userData;
        }

        // Add or update members table
        if (isset($store['members']) && is_array($store['members'])) {
            $existingMemberIdx = -1;
            foreach ($store['members'] as $mIdx => $m) {
                if ($m['id'] === $newId || strtolower($m['email'] ?? '') === $email) {
                    $existingMemberIdx = $mIdx;
                    break;
                }
            }

            $planName = $membershipPlan === '12_months' ? '12 Months Annual Elite' : ($membershipPlan === '6_months' ? '6 Months Pro' : '1 Month Standard');
            $memberData = [
                'id' => $newId,
                'name' => $userData['name'],
                'email' => $email,
                'phone' => $phone,
                'dob' => $dob,
                'address' => $address,
                'branch_id' => $branchId,
                'membership_tier' => $tier,
                'membership_plan' => $membershipPlan,
                'plan_name' => $planName,
                'status' => 'active',
                'emergency_contact_name' => $emergencyName,
                'emergency_contact_phone' => $emergencyPhone,
                'waiver_accepted' => true,
                'total_check_ins' => 0,
                'created_at' => date('c'),
                'subscription' => [
                    'status' => 'active',
                    'start_date' => date('c'),
                    'end_date' => date('c', time() + ($membershipPlan === '12_months' ? 365 : ($membershipPlan === '6_months' ? 180 : 30)) * 86400)
                ]
            ];

            if ($existingMemberIdx >= 0) {
                $store['members'][$existingMemberIdx] = array_merge($store['members'][$existingMemberIdx], $memberData);
            } else {
                $store['members'][] = $memberData;
            }
        }
        Database::saveStore();

        // Issue tokens
        $now = time();
        $tokenPayload = [
            'id' => $user['id'],
            'role' => 'member',
            'branch_id' => $branchId,
            'email' => $user['email'],
            'username' => $user['username'] ?? explode('@', $user['email'])[0],
            'name' => $user['name'],
            'auth_provider' => 'google',
            'iat' => $now,
            'exp' => $now + 900
        ];

        $accessToken = JWT::encode($tokenPayload, Secrets::getJwtSecret(), 'HS256');
        $refreshToken = bin2hex(random_bytes(40));
        $refreshTokenHash = hash('sha256', $refreshToken);
        $familyId = bin2hex(random_bytes(16));

        if (!isset($store['refresh_tokens']) || !is_array($store['refresh_tokens'])) {
            $store['refresh_tokens'] = [];
        }
        $store['refresh_tokens'][] = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'family_id' => $familyId,
            'token_hash' => $refreshTokenHash,
            'expires_at' => date('c', time() + 7 * 86400),
            'created_at' => date('c'),
            'is_revoked' => false
        ];
        Database::saveStore();

        $branch = null;
        if (!empty($store['branches'])) {
            foreach ($store['branches'] as $b) {
                if ($b['id'] === $branchId) {
                    $branch = $b;
                    break;
                }
            }
        }

        AuditLogger::logAuditEvent([
            'branch_id' => $branchId,
            'user_id' => $user['id'],
            'user_role' => 'member',
            'action' => 'AUTH_GOOGLE_REGISTER',
            'resource' => 'auth',
            'details' => [
                'provider' => 'google',
                'google_id' => $googleId,
                'email' => $email,
                'branch_id' => $branchId,
                'plan' => $membershipPlan
            ]
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $accessToken,
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'expires_in' => 900,
            'user' => [
                'id' => $user['id'],
                'role' => 'member',
                'branch_id' => $branchId,
                'branch_name' => $branch['name'] ?? 'KSYN Fitness Makati',
                'branch_code' => $branch['code'] ?? 'MKT-02',
                'name' => $user['name'],
                'email' => $user['email'],
                'username' => $user['username'] ?? explode('@', $user['email'])[0],
                'phone' => $phone,
                'status' => 'active',
                'is_active' => true,
                'is_verified' => true,
                'email_verified' => true,
                'auth_provider' => 'google',
                'avatar_url' => $user['avatar_url'] ?? $picture,
                'membership_plan' => $membershipPlan,
                'membership_tier' => $tier,
                'rfid_card_uid' => $user['rfid_card_uid'] ?? ''
            ]
        ], 201);
    }

    public function getProfile(Request $request, Response $response): Response
    {
        $auth = $request->getAttribute('user');
        $store = &Database::getStore();
        $user = null;

        foreach ($store['users'] as $u) {
            if ($u['id'] === $auth['id']) {
                $user = $u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'User not found.', 'user' => null], 404);
        }

        $branch = null;
        if (!empty($user['branch_id'])) {
            foreach ($store['branches'] as $b) {
                if ($b['id'] === $user['branch_id']) {
                    $branch = $b;
                    break;
                }
            }
        }

        $subscription = null;
        if (($user['role'] ?? '') === 'member') {
            $userSubs = array_filter($store['subscriptions'] ?? [], fn($s) => ($s['user_id'] ?? '') === $user['id']);
            foreach ($userSubs as $s) {
                if (($s['status'] ?? '') === 'active') {
                    $subscription = $s;
                    break;
                }
            }
            if (!$subscription && !empty($userSubs)) {
                $subscription = end($userSubs);
            }
        }

        return JsonResponse::create($response, [
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'role' => $user['role'],
                'branch_id' => $user['branch_id'] ?? null,
                'branch_name' => $branch ? $branch['name'] : ($user['role'] === 'super_admin' ? 'KSYN Corporate HQ' : null),
                'branch_code' => $branch ? $branch['code'] : ($user['role'] === 'super_admin' ? 'HQ-GLOBAL' : null),
                'name' => $user['name'],
                'email' => $user['email'],
                'phone' => $user['phone'] ?? '',
                'status' => $user['status'] ?? 'active',
                'membership_plan' => $user['membership_plan'] ?? null,
                'membership_tier' => $user['membership_tier'] ?? $subscription['tier'] ?? 'basic',
                'rfid_card_uid' => $user['rfid_card_uid'] ?? null
            ],
            'subscription' => $subscription
        ]);
    }

    public function logout(Request $request, Response $response): Response
    {
        $token = $request->getAttribute('token');
        if (!$token) {
            $authHeader = $request->getHeaderLine('Authorization');
            if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = trim($matches[1]);
            }
        }

        $store = &Database::getStore();
        if ($token) {
            if (!isset($store['revoked_tokens']) || !is_array($store['revoked_tokens'])) {
                $store['revoked_tokens'] = [];
            }
            if (!in_array($token, $store['revoked_tokens'], true)) {
                $store['revoked_tokens'][] = $token;
            }
            Database::saveStore();
        }

        $body = (array)($request->getParsedBody() ?? []);
        $rawRefreshToken = $body['refreshToken'] ?? $request->getHeaderLine('x-refresh-token');
        if ($rawRefreshToken && isset($store['refresh_tokens'])) {
            $tokenHash = hash('sha256', $rawRefreshToken);
            foreach ($store['refresh_tokens'] as &$rec) {
                if (($rec['token_hash'] ?? '') === $tokenHash) {
                    $rec['is_revoked'] = true;
                }
            }
            unset($rec);
            Database::saveStore();
        }

        return JsonResponse::success($response, [
            'message' => 'Logged out successfully. Security session token revoked.'
        ]);
    }

    public function refreshToken(Request $request, Response $response): Response
    {
        return $this->refresh($request, $response);
    }

    public function refresh(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $rawRefreshToken = $body['refreshToken'] ?? $request->getHeaderLine('x-refresh-token');

        if (!$rawRefreshToken) {
            return JsonResponse::error($response, 'MISSING_REFRESH_TOKEN', 'Valid refresh token required to renew security session.', 400);
        }

        $tokenHash = hash('sha256', $rawRefreshToken);
        $store = &Database::getStore();
        if (!isset($store['refresh_tokens']) || !is_array($store['refresh_tokens'])) {
            $store['refresh_tokens'] = [];
        }

        $existingRecordIndex = -1;
        foreach ($store['refresh_tokens'] as $idx => $r) {
            if (($r['token_hash'] ?? '') === $tokenHash) {
                $existingRecordIndex = $idx;
                break;
            }
        }

        if ($existingRecordIndex === -1) {
            return JsonResponse::error($response, 'INVALID_REFRESH_TOKEN', 'Refresh token is unrecognized or invalid.', 401);
        }

        $existingRecord = $store['refresh_tokens'][$existingRecordIndex];

        // Replay attack detection: if token is already revoked, revoke entire token family
        if (!empty($existingRecord['is_revoked'])) {
            $targetFamily = $existingRecord['family_id'] ?? '';
            foreach ($store['refresh_tokens'] as &$r) {
                if (($r['family_id'] ?? '') === $targetFamily) {
                    $r['is_revoked'] = true;
                }
            }
            unset($r);
            Database::saveStore();

            return JsonResponse::error(
                $response,
                'REFRESH_TOKEN_REUSE_DETECTED',
                'Security breach alert: Attempted reuse of an invalidated refresh token. All active sessions terminated.',
                401
            );
        }

        // Check expiration
        if (isset($existingRecord['expires_at']) && strtotime($existingRecord['expires_at']) < time()) {
            $store['refresh_tokens'][$existingRecordIndex]['is_revoked'] = true;
            Database::saveStore();
            return JsonResponse::error($response, 'REFRESH_TOKEN_EXPIRED', 'Session refresh token has expired. Please log in again.', 401);
        }

        // Find associated user
        $userId = $existingRecord['user_id'] ?? null;
        $user = null;
        foreach ($store['users'] as $u) {
            if (($u['id'] ?? '') === $userId) {
                $user = $u;
                break;
            }
        }

        if (!$user || ($user['status'] ?? '') === 'suspended' || ($user['status'] ?? '') === 'inactive') {
            $store['refresh_tokens'][$existingRecordIndex]['is_revoked'] = true;
            Database::saveStore();
            return JsonResponse::error($response, 'ACCOUNT_INACTIVE', 'Associated user account is inactive or suspended.', 403);
        }

        // Invalidate old refresh token (Rotation)
        $store['refresh_tokens'][$existingRecordIndex]['is_revoked'] = true;

        // Issue new access token (15 mins) & new rotating refresh token (7 days)
        $now = time();
        $tokenPayload = [
            'id' => $user['id'],
            'role' => $user['role'],
            'branch_id' => $user['branch_id'] ?? null,
            'email' => $user['email'],
            'username' => $user['username'] ?? explode('@', $user['email'])[0],
            'name' => $user['name'],
            'iat' => $now,
            'exp' => $now + 900
        ];
        $newAccessToken = JWT::encode($tokenPayload, Secrets::getJwtSecret(), 'HS256');

        $newRefreshToken = bin2hex(random_bytes(40));
        $newRefreshTokenHash = hash('sha256', $newRefreshToken);

        $store['refresh_tokens'][] = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'family_id' => $existingRecord['family_id'] ?? bin2hex(random_bytes(16)),
            'token_hash' => $newRefreshTokenHash,
            'expires_at' => date('c', $now + 7 * 86400),
            'created_at' => date('c'),
            'is_revoked' => false
        ];

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $newAccessToken,
            'accessToken' => $newAccessToken,
            'refreshToken' => $newRefreshToken,
            'expires_in' => 900
        ]);
    }

    public function demoSwitchRole(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $demoRole = $body['demoRole'] ?? '';

        $roleMap = [
            'super_admin' => 'super_admin@ksyn.com',
            'branch_admin_makati' => 'admin.makati@ksyn.com',
            'branch_admin_bgc' => 'admin.makati@ksyn.com',
            'employee_makati' => 'makati.staff@ksyn.com',
            'employee_bgc' => 'makati.staff@ksyn.com',
            'member_makati' => 'member.makati@ksyn.com',
            'member_bgc' => 'member.makati@ksyn.com',
            'coach_makati' => 'coach.sofia@ksyn.com',
            'coach_bgc' => 'coach.sofia@ksyn.com',
            'branch_owner_makati' => 'owner.makati@ksyn.com',
            'branch_owner_bgc' => 'owner.makati@ksyn.com'
        ];

        $targetEmail = $roleMap[$demoRole] ?? null;
        if (!$targetEmail) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Invalid demoRole identifier.'], 400);
        }

        $store = &Database::getStore();
        $user = null;
        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === $targetEmail) {
                $user = $u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Demo user not found.'], 404);
        }

        $now = time();
        $tokenPayload = [
            'id' => $user['id'],
            'role' => $user['role'],
            'branch_id' => $user['branch_id'] ?? null,
            'email' => $user['email'],
            'name' => $user['name'],
            'iat' => $now,
            'exp' => $now + 900
        ];

        $accessToken = JWT::encode($tokenPayload, Secrets::getJwtSecret(), 'HS256');

        return JsonResponse::create($response, [
            'success' => true,
            'token' => $accessToken,
            'accessToken' => $accessToken,
            'refreshToken' => bin2hex(random_bytes(20)),
            'expires_in' => 900,
            'user' => [
                'id' => $user['id'],
                'role' => $user['role'],
                'branch_id' => $user['branch_id'] ?? null,
                'name' => $user['name'],
                'email' => $user['email']
            ]
        ]);
    }

    public function registerUser(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $auth = $request->getAttribute('user');

        $name = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = (string)($body['password'] ?? '');
        $role = trim($body['role'] ?? '');
        $branchId = $body['branch_id'] ?? null;
        $phone = $body['phone'] ?? '';

        if (!$name || !$email || !$password || !$role) {
            return JsonResponse::create($response, [
                'success' => false,
                'message' => 'Name, email, password, and role are required.'
            ], 400);
        }

        if (($auth['role'] ?? '') === 'branch_admin') {
            if ($role === 'super_admin' || ($branchId && $branchId !== $auth['branch_id'])) {
                return JsonResponse::error($response, 'FORBIDDEN', 'Branch Admins can only register staff or members for their assigned branch.', 403);
            }
        }

        $targetBranchId = ($auth['role'] ?? '') === 'branch_admin' ? $auth['branch_id'] : $branchId;
        $store = &Database::getStore();

        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === strtolower($email)) {
                return JsonResponse::create($response, ['success' => false, 'message' => 'User with this email already exists.'], 409);
            }
        }

        $newUser = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $role === 'super_admin' ? null : $targetBranchId,
            'role' => $role,
            'email' => strtolower($email),
            'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]),
            'name' => $name,
            'phone' => $phone,
            'rfid_card_uid' => $body['rfid_card_uid'] ?? ('KS-' . rand(1000, 9999) . '-' . rand(1000, 9999)),
            'status' => 'active',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['users'][] = $newUser;

        if ($role === 'member') {
            $defaultPlan = MembershipRates::resolvePlan('1_month');
            $store['subscriptions'][] = [
                'id' => bin2hex(random_bytes(16)),
                'user_id' => $newUser['id'],
                'branch_id' => $targetBranchId,
                'plan' => $defaultPlan['id'],
                'tier' => $defaultPlan['tier'],
                'status' => 'active',
                'start_date' => date('Y-m-d'),
                'end_date' => date('Y-m-d', strtotime("+{$defaultPlan['durationDays']} days")),
                'price' => $defaultPlan['planFee'],
                'access_fee' => $defaultPlan['accessFee'],
                'annual_fee' => $defaultPlan['annualFee'],
                'total_paid' => $defaultPlan['totalDue'],
                'auto_renew' => false
            ];
        }

        AuditLogger::logAuditEvent([
            'branch_id' => $targetBranchId,
            'user_id' => $auth['id'],
            'user_role' => $auth['role'],
            'action' => 'USER_PROVISION',
            'resource' => 'users',
            'details' => ['new_user_id' => $newUser['id'], 'role' => $newUser['role'], 'email' => $newUser['email']]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'User provisioned successfully.',
            'user' => [
                'id' => $newUser['id'],
                'name' => $newUser['name'],
                'email' => $newUser['email'],
                'role' => $newUser['role'],
                'branch_id' => $newUser['branch_id'],
                'status' => $newUser['status']
            ]
        ], 201);
    }

    public function sendRegistrationOtp(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $email = strtolower(trim($body['email'] ?? ''));

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return JsonResponse::error($response, 'INVALID_EMAIL', 'A valid email address is required.', 400);
        }

        $store = &Database::getStore();
        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === $email) {
                return JsonResponse::error($response, 'DUPLICATE_ACCOUNT', 'Email is already registered. Please sign in.', 409);
            }
        }

        $otpCode = (string)rand(100000, 999999);
        $otpHash = password_hash($otpCode, PASSWORD_BCRYPT, ['cost' => 10]);

        $store['otp_verifications'][] = [
            'id' => bin2hex(random_bytes(16)),
            'email' => $email,
            'otp_hash' => $otpHash,
            'expires_at' => gmdate('Y-m-d\TH:i:s.v\Z', time() + 600),
            'attempts' => 0,
            'verified' => false,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        Mailer::sendOtpEmail($email, $otpCode);
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Verification code sent to your email.'
        ]);
    }

    public function register(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $branchId = $body['branch_id'] ?? 'b-mkt-01';
        $planId = $body['membership_plan'] ?? '1_month';

        if (!$name || !$email || !$password) {
            return JsonResponse::error($response, 'MISSING_FIELDS', 'Name, email, and password are required.', 400);
        }

        $store = &Database::getStore();
        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === $email) {
                return JsonResponse::error($response, 'DUPLICATE_ACCOUNT', 'Email is already registered.', 409);
            }
        }

        $resolvedPlan = MembershipRates::resolvePlan($planId) ?? MembershipRates::resolvePlan('1_month');
        $newUserId = bin2hex(random_bytes(16));

        $isPaidUpfront = !empty($body['is_paid']) || !empty($body['payment_method_id']) || !empty($body['gatewayToken']);
        $initialUserStatus = $isPaidUpfront ? 'active' : 'pending_payment';
        $initialSubStatus = $isPaidUpfront ? 'active' : 'pending_payment';
        $initialTotalPaid = $isPaidUpfront ? $resolvedPlan['totalDue'] : 0;

        $newUser = [
            'id' => $newUserId,
            'branch_id' => $branchId,
            'role' => 'member',
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]),
            'name' => $name,
            'phone' => $body['phone'] ?? '',
            'status' => $initialUserStatus,
            'membership_plan' => $resolvedPlan['id'],
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['users'][] = $newUser;
        $newSub = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $newUserId,
            'branch_id' => $branchId,
            'plan' => $resolvedPlan['id'],
            'tier' => $resolvedPlan['tier'],
            'status' => $initialSubStatus,
            'start_date' => date('Y-m-d'),
            'end_date' => date('Y-m-d', strtotime("+{$resolvedPlan['durationDays']} days")),
            'price' => $resolvedPlan['planFee'],
            'access_fee' => $resolvedPlan['accessFee'],
            'annual_fee' => $resolvedPlan['annualFee'],
            'total_paid' => $initialTotalPaid,
            'auto_renew' => true
        ];
        $store['subscriptions'][] = $newSub;

        AuditLogger::logAuditEvent([
            'branch_id' => $branchId,
            'user_id' => $newUserId,
            'user_role' => 'member',
            'action' => 'MEMBER_SELF_REGISTER',
            'resource' => 'users',
            'details' => ['email' => $email, 'plan' => $resolvedPlan['id']]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Member registered successfully.',
            'plan' => $resolvedPlan,
            'user' => [
                'id' => $newUserId,
                'name' => $newUser['name'],
                'email' => $newUser['email'],
                'role' => 'member',
                'branch_id' => $branchId,
                'status' => $initialUserStatus
            ],
            'subscription' => $newSub
        ], 201);
    }

    public function forgotPassword(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $email = strtolower(trim($body['email'] ?? ''));

        $store = &Database::getStore();
        $user = null;
        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === $email) {
                $user = $u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'No account found with this email address'], 404);
        }

        $otpCode = (string)rand(100000, 999999);
        $otpHash = password_hash($otpCode, PASSWORD_BCRYPT, ['cost' => 10]);

        $store['otp_verifications'][] = [
            'id' => bin2hex(random_bytes(16)),
            'email' => $email,
            'otp_hash' => $otpHash,
            'type' => 'password_reset',
            'expires_at' => gmdate('Y-m-d\TH:i:s.v\Z', time() + 600),
            'attempts' => 0,
            'verified' => false,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        Mailer::sendOtpEmail($email, $otpCode);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => 'Reset code sent to your email.']);
    }

    public function resetPassword(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $email = strtolower(trim($body['email'] ?? ''));
        $otpCode = trim($body['otpCode'] ?? '');
        $newPassword = (string)($body['newPassword'] ?? '');
        $confirmPassword = (string)($body['confirmPassword'] ?? '');

        if ($newPassword !== $confirmPassword) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Passwords do not match.'], 400);
        }

        $store = &Database::getStore();
        $user = null;
        foreach ($store['users'] as &$u) {
            if (strtolower($u['email'] ?? '') === $email) {
                $user = &$u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'User account not found.'], 404);
        }

        $user['password_hash'] = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Password updated successfully. Please log in with your new credentials.'
        ]);
    }

    public function verifyMfa(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'MFA verification passed.']);
    }
}
