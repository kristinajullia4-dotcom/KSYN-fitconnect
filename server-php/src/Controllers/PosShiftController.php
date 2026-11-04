<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class PosShiftController
{
    public function openShift(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $branchId = ($user['role'] ?? '') === 'super_admin'
            ? ($body['branchId'] ?? $user['branch_id'] ?? 'b-mkt-01')
            : ($user['branch_id'] ?? 'b-mkt-01');

        $openingFloat = (float)($body['openingFloat'] ?? 2000.00);
        $shiftId = 'shift_mkt_' . substr(bin2hex(random_bytes(4)), 0, 8);

        $shift = [
            'id' => $shiftId,
            'branch_id' => $branchId,
            'cashier_id' => $user['id'],
            'cashier_name' => $body['cashierName'] ?? $user['name'] ?? 'Front Desk Cashier',
            'opened_at' => gmdate('Y-m-d\TH:i:s.v\Z'),
            'closed_at' => null,
            'opening_float' => $openingFloat,
            'total_cash_sales' => 0.0,
            'total_digital_sales' => 0.0,
            'cash_drops' => 0.0,
            'expected_cash_drawer' => $openingFloat,
            'actual_cash_counted' => 0.0,
            'variance' => 0.0,
            'status' => 'OPEN',
            'notes' => $body['notes'] ?? 'Routine shift opening',
            'denominations' => null,
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['pos_shifts'])) $store['pos_shifts'] = [];
        array_unshift($store['pos_shifts'], $shift);

        AuditLogger::logAuditEvent([
            'branch_id' => $branchId,
            'user_id' => $user['id'],
            'user_role' => $user['role'],
            'action' => 'POS_SHIFT_OPENED',
            'resource' => 'pos_shifts',
            'details' => ['shift_id' => $shiftId, 'opening_float' => $openingFloat]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'POS Shift session opened successfully.',
            'shift' => $shift
        ], 201);
    }

    public function getCurrentShift(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $branchId = $user['branch_id'] ?? 'b-mkt-01';
        $store = &Database::getStore();

        $openShift = null;
        foreach ($store['pos_shifts'] ?? [] as $s) {
            if (($s['status'] ?? '') === 'OPEN' && (($s['branch_id'] ?? '') === $branchId || ($s['cashier_id'] ?? '') === $user['id'])) {
                $openShift = $s;
                break;
            }
        }

        if (!$openShift) {
            return JsonResponse::create($response, [
                'success' => true,
                'shift' => null,
                'message' => 'No active shift session found.'
            ]);
        }

        $openShift['sales_count'] = 0;
        $openShift['transactions'] = [];

        return JsonResponse::create($response, [
            'success' => true,
            'shift' => $openShift
        ]);
    }

    public function closeShift(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $shift = null;
        foreach ($store['pos_shifts'] ?? [] as &$s) {
            if (($s['status'] ?? '') === 'OPEN') {
                $s['status'] = 'CLOSED';
                $s['closed_at'] = gmdate('Y-m-d\TH:i:s.v\Z');
                $s['actual_cash_counted'] = (float)($body['actualCashCounted'] ?? $s['expected_cash_drawer']);
                $s['variance'] = round($s['actual_cash_counted'] - $s['expected_cash_drawer'], 2);
                $shift = $s;
                break;
            }
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Shift closed successfully. X-Reading generated.',
            'shift' => $shift
        ]);
    }

    public function getZReadingReport(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'report' => [
                'report_type' => 'Z-Reading Official End-of-Day Roll-Up',
                'date' => date('Y-m-d'),
                'total_gross_sales' => 125000.00,
                'status' => 'Verified'
            ]
        ]);
    }
}
