<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class BranchController
{
    public function getAllBranches(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $allBranches = $store['branches'] ?? [];

        if (!$user) {
            $activeBranches = array_values(array_filter($allBranches, fn($b) => ($b['is_active'] ?? true) !== false));
            $mapped = array_map(function($b) {
                return [
                    'id' => $b['id'] ?? '',
                    'code' => $b['code'] ?? '',
                    'name' => $b['name'] ?? '',
                    'city' => $b['city'] ?? '',
                    'address' => $b['address'] ?? '',
                    'operating_hours' => $b['operating_hours'] ?? '',
                    'is_active' => $b['is_active'] ?? true
                ];
            }, $activeBranches);

            return JsonResponse::create($response, [
                'success' => true,
                'branches' => $mapped,
                'data' => $mapped
            ]);
        }

        $branches = [];
        if (($user['role'] ?? '') === 'super_admin') {
            $branches = $allBranches;
        } else {
            $userBranchId = $user['branch_id'] ?? '';
            $branches = array_values(array_filter($allBranches, fn($b) => ($b['id'] ?? '') === $userBranchId));
        }

        $users = $store['users'] ?? [];
        $sales = $store['sales'] ?? [];
        $inventory = $store['inventory'] ?? [];

        $enrichedBranches = array_map(function($branch) use ($users, $sales, $inventory) {
            $bId = $branch['id'] ?? '';
            $branchUsers = array_filter($users, fn($u) => ($u['branch_id'] ?? '') === $bId);
            $memberCount = count(array_filter($branchUsers, fn($u) => ($u['role'] ?? '') === 'member'));
            $employeeCount = count(array_filter($branchUsers, fn($u) => in_array($u['role'] ?? '', ['employee', 'staff'], true)));

            $branchSales = array_filter($sales, fn($s) => ($s['branch_id'] ?? '') === $bId);
            $totalRevenue = array_reduce($branchSales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);
            $royaltyPct = (float)($branch['royalty_percentage'] ?? 0);
            $corporateRoyaltyReceivable = $totalRevenue * ($royaltyPct / 100.0);

            $branchInventory = array_filter($inventory, fn($i) => ($i['branch_id'] ?? '') === $bId);
            $lowStockCount = count(array_filter($branchInventory, fn($i) => (int)($i['quantity'] ?? 0) <= (int)($i['reorder_threshold'] ?? 5)));

            $branchCopy = $branch;
            $branchCopy['stats'] = [
                'memberCount' => $memberCount,
                'employeeCount' => $employeeCount,
                'totalRevenue' => $totalRevenue,
                'corporateRoyaltyReceivable' => $corporateRoyaltyReceivable,
                'lowStockCount' => $lowStockCount
            ];
            return $branchCopy;
        }, $branches);

        return JsonResponse::create($response, [
            'success' => true,
            'branches' => $enrichedBranches,
            'data' => $enrichedBranches
        ]);
    }

    public function getBranchById(Request $request, Response $response, array $args): Response
    {
        $branchId = $args['branchId'] ?? '';
        $user = $request->getAttribute('user');

        if (($user['role'] ?? '') !== 'super_admin' && ($user['branch_id'] ?? '') !== $branchId) {
            return JsonResponse::error($response, 'FORBIDDEN', 'Unauthorized access to cross-tenant branch details.', 403);
        }

        $store = &Database::getStore();
        $branch = null;
        foreach ($store['branches'] as $b) {
            if (($b['id'] ?? '') === $branchId) {
                $branch = $b;
                break;
            }
        }

        if (!$branch) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Branch not found.'], 404);
        }

        return JsonResponse::create($response, ['success' => true, 'branch' => $branch]);
    }

    public function createBranch(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $code = strtoupper(trim($body['code'] ?? ''));
        $name = trim($body['name'] ?? '');
        $address = trim($body['address'] ?? '');
        $city = trim($body['city'] ?? '');
        $phone = $body['phone'] ?? '';
        $royalty = (float)($body['royalty_percentage'] ?? 7.00);

        if (!$code || !$name || !$address || !$city) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Branch code, name, address, and city are required.'], 400);
        }

        $store = &Database::getStore();
        foreach ($store['branches'] as $b) {
            if (strtoupper($b['code'] ?? '') === $code) {
                return JsonResponse::create($response, ['success' => false, 'message' => 'Branch with this code already exists.'], 409);
            }
        }

        $newBranch = [
            'id' => 'b-' . strtolower(substr($code, 0, 3)) . '-' . rand(10, 99),
            'code' => $code,
            'name' => $name,
            'address' => $address,
            'city' => $city,
            'phone' => $phone,
            'royalty_percentage' => $royalty,
            'is_active' => true,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['branches'][] = $newBranch;
        $user = $request->getAttribute('user');

        AuditLogger::logAuditEvent([
            'branch_id' => $newBranch['id'],
            'user_id' => $user['id'] ?? null,
            'user_role' => $user['role'] ?? 'super_admin',
            'action' => 'BRANCH_REGISTER',
            'resource' => 'branches',
            'details' => ['code' => $code, 'royalty_percentage' => $royalty]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Franchise branch registered successfully.',
            'branch' => $newBranch
        ], 201);
    }

    public function updateRoyalty(Request $request, Response $response, array $args): Response
    {
        $branchId = $args['branchId'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $royalty = $body['royalty_percentage'] ?? null;

        if ($royalty === null || !is_numeric($royalty)) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Valid royalty percentage required.'], 400);
        }

        $store = &Database::getStore();
        $branch = null;
        foreach ($store['branches'] as &$b) {
            if (($b['id'] ?? '') === $branchId) {
                $branch = &$b;
                break;
            }
        }

        if (!$branch) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Branch not found.'], 404);
        }

        $oldRate = $branch['royalty_percentage'] ?? 0;
        $branch['royalty_percentage'] = (float)$royalty;

        $user = $request->getAttribute('user');
        AuditLogger::logAuditEvent([
            'branch_id' => $branch['id'],
            'user_id' => $user['id'] ?? null,
            'user_role' => $user['role'] ?? 'super_admin',
            'action' => 'ROYALTY_RATE_UPDATE',
            'resource' => 'branches',
            'details' => ['previous_rate' => $oldRate, 'new_rate' => $branch['royalty_percentage']]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Royalty rate updated successfully.',
            'branch' => $branch
        ]);
    }
}
