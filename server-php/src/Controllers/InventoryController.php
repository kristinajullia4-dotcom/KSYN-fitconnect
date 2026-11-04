<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class InventoryController
{
    public function getInventory(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $inventory = $store['inventory'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin') {
            $userBranchId = $user['branch_id'] ?? '';
            $inventory = array_values(array_filter($inventory, fn($i) => ($i['branch_id'] ?? '') === $userBranchId));
        }

        return JsonResponse::create($response, [
            'success' => true,
            'inventory' => $inventory,
            'items' => $inventory
        ]);
    }

    public function addInventoryItem(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $branchId = ($user['role'] ?? '') === 'super_admin' ? ($body['branch_id'] ?? 'b-mkt-01') : ($user['branch_id'] ?? 'b-mkt-01');

        $item = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $branchId,
            'item_name' => $body['item_name'] ?? 'Equipment/Item',
            'sku' => $body['sku'] ?? ('SKU-' . rand(1000, 9999)),
            'category' => $body['category'] ?? 'Equipment',
            'quantity' => (int)($body['quantity'] ?? 10),
            'reorder_threshold' => (int)($body['reorder_threshold'] ?? 5),
            'unit_price' => (float)($body['unit_price'] ?? 100),
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['inventory'][] = $item;
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'item' => $item], 201);
    }

    public function updateInventoryItem(Request $request, Response $response, array $args): Response
    {
        $itemId = $args['itemId'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        foreach ($store['inventory'] as &$i) {
            if (($i['id'] ?? '') === $itemId) {
                if (isset($body['quantity'])) $i['quantity'] = (int)$body['quantity'];
                if (isset($body['item_name'])) $i['item_name'] = $body['item_name'];
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'item' => $i]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'Item not found.'], 404);
    }

    public function createReorderRequest(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $req = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $user['branch_id'] ?? 'b-mkt-01',
            'item_name' => $body['item_name'] ?? 'Inventory Item',
            'requested_quantity' => (int)($body['requested_quantity'] ?? 10),
            'status' => 'Pending HQ Review',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['inventory_restock_requests'])) $store['inventory_restock_requests'] = [];
        array_unshift($store['inventory_restock_requests'], $req);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'request' => $req], 201);
    }

    public function getBranchReorderRequests(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $reqs = $store['inventory_restock_requests'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin') {
            $userBranchId = $user['branch_id'] ?? '';
            $reqs = array_values(array_filter($reqs, fn($r) => ($r['branch_id'] ?? '') === $userBranchId));
        }

        return JsonResponse::create($response, ['success' => true, 'requests' => $reqs]);
    }

    public function getProcurementFeed(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, ['success' => true, 'feed' => $store['inventory_restock_requests'] ?? []]);
    }

    public function updateProcurementRequest(Request $request, Response $response, array $args): Response
    {
        $requestId = $args['requestId'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        foreach ($store['inventory_restock_requests'] as &$r) {
            if (($r['id'] ?? '') === $requestId) {
                if (isset($body['status'])) $r['status'] = $body['status'];
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'request' => $r]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'Request not found.'], 404);
    }
}
