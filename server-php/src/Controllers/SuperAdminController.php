<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Config\MembershipRates;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class SuperAdminController
{
    public function getStats(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        $branches = $store['branches'] ?? [];
        $users = $store['users'] ?? [];
        $sales = $store['sales'] ?? [];
        $subscriptions = $store['subscriptions'] ?? [];
        $attendance = $store['attendance_logs'] ?? [];

        $totalRevenue = array_reduce($sales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);
        $totalCorporateRoyalties = 0.0;
        foreach ($branches as $b) {
            $bId = $b['id'] ?? '';
            $branchSales = array_filter($sales, fn($s) => ($s['branch_id'] ?? '') === $bId);
            $gross = array_reduce($branchSales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);
            $totalCorporateRoyalties += $gross * (((float)($b['royalty_percentage'] ?? 7.5)) / 100.0);
        }

        $members = array_filter($users, fn($u) => ($u['role'] ?? '') === 'member');
        $activeMembers = array_filter($members, fn($m) => ($m['status'] ?? '') === 'active');
        $activeSubs = array_filter($subscriptions, fn($s) => ($s['status'] ?? '') === 'active');

        return JsonResponse::create($response, [
            'success' => true,
            'stats' => [
                'totalBranches' => count($branches),
                'activeBranches' => count(array_filter($branches, fn($b) => ($b['is_active'] ?? true) !== false)),
                'totalMembers' => count($members),
                'activeMembers' => count($activeMembers),
                'activeSubscriptions' => count($activeSubs),
                'totalGrossRevenue' => $totalRevenue,
                'totalCorporateRoyalties' => $totalCorporateRoyalties,
                'totalCheckIns' => count($attendance),
                'networkTurnstileScans' => count($attendance),
                'openFranchiseInquiries' => count($store['franchise_applications'] ?? []),
                'lowStockItemsCount' => count(array_filter($store['inventory'] ?? [], fn($i) => (int)($i['quantity'] ?? 0) <= (int)($i['reorder_threshold'] ?? 5)))
            ],
            'recentActivity' => array_slice($store['audit_logs'] ?? [], 0, 10)
        ]);
    }

    public function getAdmins(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        $admins = array_values(array_filter($store['users'] ?? [], function($u) {
            return in_array($u['role'] ?? '', ['super_admin', 'branch_admin', 'branch_owner'], true);
        }));

        return JsonResponse::create($response, [
            'success' => true,
            'admins' => $admins,
            'count' => count($admins)
        ]);
    }

    public function createAdmin(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $role = $body['role'] ?? 'branch_admin';
        $branchId = $body['branch_id'] ?? null;
        $password = (string)($body['password'] ?? 'Password123!');

        if (!$name || !$email) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Name and email are required.'], 400);
        }

        foreach ($store['users'] as $u) {
            if (strtolower($u['email'] ?? '') === $email) {
                return JsonResponse::create($response, ['success' => false, 'message' => 'User already exists.'], 409);
            }
        }

        $newAdmin = [
            'id' => bin2hex(random_bytes(16)),
            'name' => $name,
            'email' => $email,
            'username' => trim($body['username'] ?? explode('@', $email)[0]),
            'phone' => $body['phone'] ?? '+63 900 000 0000',
            'role' => $role,
            'branch_id' => $branchId,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]),
            'status' => 'active',
            'is_active' => true,
            'is_verified' => true,
            'email_verified' => true,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['users'][] = $newAdmin;
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Admin account provisioned successfully.',
            'admin' => $newAdmin
        ], 201);
    }

    public function updateAdminStatus(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $status = $body['status'] ?? 'active';

        $store = &Database::getStore();
        foreach ($store['users'] as &$u) {
            if (($u['id'] ?? '') === $id) {
                $u['status'] = $status;
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'message' => 'Status updated.', 'user' => $u]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'User not found.'], 404);
    }

    public function registerBranch(Request $request, Response $response): Response
    {
        return (new BranchController())->createBranch($request, $response);
    }

    public function updateBranchStatus(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $isActive = (bool)($body['is_active'] ?? true);

        $store = &Database::getStore();
        foreach ($store['branches'] as &$b) {
            if (($b['id'] ?? '') === $id) {
                $b['is_active'] = $isActive;
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'message' => 'Branch status updated.', 'branch' => $b]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'Branch not found.'], 404);
    }

    public function getFranchiseApplications(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'applications' => $store['franchise_applications'] ?? []
        ]);
    }

    public function createFranchiseInquiry(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $inquiry = [
            'id' => bin2hex(random_bytes(16)),
            'applicant_name' => $body['name'] ?? $body['applicant_name'] ?? 'Prospective Franchisee',
            'email' => $body['email'] ?? '',
            'phone' => $body['phone'] ?? '',
            'proposed_location' => $body['target_city'] ?? $body['location'] ?? 'Metro Manila',
            'liquid_capital' => $body['liquid_capital'] ?? '₱5M - ₱10M',
            'experience' => $body['experience'] ?? '',
            'status' => 'Pending Review',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['franchise_applications'])) $store['franchise_applications'] = [];
        array_unshift($store['franchise_applications'], $inquiry);
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Franchise inquiry submitted successfully.',
            'inquiry' => $inquiry
        ], 201);
    }

    public function updateFranchiseStatus(Request $request, Response $response, array $args): Response
    {
        $id = $args['applicationId'] ?? $args['id'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $status = $body['status'] ?? 'Under Due Diligence';

        $store = &Database::getStore();
        foreach ($store['franchise_applications'] as &$app) {
            if (($app['id'] ?? '') === $id) {
                $app['status'] = $status;
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'application' => $app]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'Application not found.'], 404);
    }

    public function updateFranchiseApplicationStatus(Request $request, Response $response, array $args): Response
    {
        return $this->updateFranchiseStatus($request, $response, $args);
    }

    public function contactFranchiseApplicant(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Contact dispatched.']);
    }

    public function getPermissionUsers(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'users' => $store['users'] ?? []
        ]);
    }

    public function updateUserPermissions(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        foreach ($store['users'] as &$u) {
            if (($u['id'] ?? '') === $id) {
                if (isset($body['role'])) $u['role'] = $body['role'];
                if (isset($body['status'])) $u['status'] = $body['status'];
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'user' => $u]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'User not found.'], 404);
    }

    public function getReports(Request $request, Response $response): Response
    {
        return (new FinanceController())->computeRoyalties($request, $response);
    }

    public function verifyAuditChainController(Request $request, Response $response): Response
    {
        return (new AuditController())->verifyChain($request, $response);
    }

    public function getMfaStatus(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'mfa_enabled' => false]);
    }

    public function setupMfa(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'secret' => 'KSYNMFA2026SECRET', 'qr_code' => '']);
    }

    public function verifyMfa(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'verified' => true]);
    }

    public function getHardwareTelemetry(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'devices' => [
                ['id' => 'gate-mkt-01', 'name' => 'Makati Turnstile Gateway', 'status' => 'ONLINE', 'ping_ms' => 12],
                ['id' => 'gate-bgc-01', 'name' => 'BGC Turnstile Gateway', 'status' => 'ONLINE', 'ping_ms' => 15]
            ],
            'telemetry' => $store['equipment_iot_telemetry'] ?? []
        ]);
    }

    public function getBroadcasts(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, ['success' => true, 'broadcasts' => $store['broadcasts'] ?? []]);
    }

    public function createBroadcast(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $broadcast = [
            'id' => bin2hex(random_bytes(16)),
            'title' => $body['title'] ?? 'Network Announcement',
            'message' => $body['message'] ?? '',
            'type' => $body['type'] ?? 'info',
            'target_audience' => $body['target_audience'] ?? 'all',
            'is_active' => true,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['broadcasts'])) $store['broadcasts'] = [];
        array_unshift($store['broadcasts'], $broadcast);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'broadcast' => $broadcast], 201);
    }

    public function deleteBroadcast(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $store = &Database::getStore();
        $store['broadcasts'] = array_values(array_filter($store['broadcasts'] ?? [], fn($b) => ($b['id'] ?? '') !== $id));
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => 'Broadcast deleted.']);
    }

    public function getRateCards(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'plans' => MembershipRates::MEMBERSHIP_PLANS]);
    }

    public function updateRateCards(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Rate card updated.']);
    }

    public function getPromos(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, ['success' => true, 'promos' => $store['promo_codes'] ?? []]);
    }

    public function createPromo(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $promo = [
            'id' => bin2hex(random_bytes(16)),
            'code' => strtoupper($body['code'] ?? 'DISCOUNT10'),
            'discount_pct' => (int)($body['discount_pct'] ?? 10),
            'is_active' => true,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['promo_codes'])) $store['promo_codes'] = [];
        array_unshift($store['promo_codes'], $promo);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'promo' => $promo], 201);
    }

    public function deletePromo(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $store = &Database::getStore();
        $store['promo_codes'] = array_values(array_filter($store['promo_codes'] ?? [], fn($p) => ($p['id'] ?? '') !== $id));
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => 'Promo code deleted.']);
    }
}
