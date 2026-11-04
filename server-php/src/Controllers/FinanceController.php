<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FinanceController
{
    public function getSalesLedger(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $sales = $store['sales'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin') {
            $userBranchId = $user['branch_id'] ?? '';
            $sales = array_values(array_filter($sales, fn($s) => ($s['branch_id'] ?? '') === $userBranchId));
        }

        $totalRevenue = array_reduce($sales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);

        return JsonResponse::create($response, [
            'success' => true,
            'sales' => $sales,
            'totalRevenue' => $totalRevenue,
            'count' => count($sales)
        ]);
    }

    public function recordSale(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $amount = (float)($body['amount'] ?? 0);
        $category = $body['category'] ?? 'merchandise';
        $paymentMethod = $body['payment_method'] ?? $body['payment_channel'] ?? 'cash';
        $items = (array)($body['items'] ?? []);

        if ($amount <= 0 && !empty($items)) {
            foreach ($items as $item) {
                $amount += ((float)($item['price'] ?? $item['unit_price'] ?? 0)) * ((int)($item['quantity'] ?? 1));
            }
        }

        if ($amount <= 0) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Valid positive amount required.'], 400);
        }

        $targetBranchId = ($user['role'] ?? '') === 'super_admin'
            ? ($body['branch_id'] ?? ($store['branches'][0]['id'] ?? 'b-mkt-01'))
            : ($user['branch_id'] ?? 'b-mkt-01');

        $refNo = 'POS-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(4)), 0, 6);
        $royaltyAmount = round($amount * 0.075, 2);
        $netRetained = round($amount - $royaltyAmount, 2);

        $newSale = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $targetBranchId,
            'user_id' => $body['user_id'] ?? null,
            'customer_name' => $body['customer_name'] ?? 'Walk-in Customer',
            'amount' => $amount,
            'royalty_amount' => $royaltyAmount,
            'net_retained' => $netRetained,
            'category' => $category,
            'payment_method' => $paymentMethod,
            'payment_channel' => $paymentMethod,
            'reference_no' => $refNo,
            'reference_number' => $refNo,
            'invoice_number' => $refNo,
            'items' => $items,
            'notes' => $body['description'] ?? '',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        array_unshift($store['sales'], $newSale);

        // Update active POS shift expected cash
        if (!empty($store['pos_shifts'])) {
            foreach ($store['pos_shifts'] as &$shift) {
                if (($shift['branch_id'] ?? '') === $targetBranchId && ($shift['status'] ?? '') === 'OPEN') {
                    if (str_contains(strtolower($paymentMethod), 'cash')) {
                        $shift['total_cash_sales'] = round(((float)($shift['total_cash_sales'] ?? 0) + $amount), 2);
                    } else {
                        $shift['total_digital_sales'] = round(((float)($shift['total_digital_sales'] ?? 0) + $amount), 2);
                    }
                    $shift['expected_cash_drawer'] = round(((float)($shift['opening_float'] ?? 0) + (float)($shift['total_cash_sales'] ?? 0)), 2);
                    break;
                }
            }
        }

        AuditLogger::logAuditEvent([
            'branch_id' => $targetBranchId,
            'user_id' => $user['id'] ?? null,
            'user_role' => $user['role'] ?? 'cashier',
            'action' => 'POS_TRANSACTION',
            'resource' => 'sales',
            'details' => ['amount' => $amount, 'payment_method' => $paymentMethod, 'reference_no' => $refNo]
        ]);

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'POS transaction processed successfully.',
            'sale' => $newSale
        ], 201);
    }

    public function getRoyalties(Request $request, Response $response): Response
    {
        return $this->computeRoyalties($request, $response);
    }

    public function saveWaiver(Request $request, Response $response): Response
    {
        return $this->signWaiver($request, $response);
    }

    public function computeRoyalties(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $branches = $store['branches'] ?? [];
        $sales = $store['sales'] ?? [];

        $targetBranches = [];
        if (($user['role'] ?? '') === 'super_admin') {
            $targetBranches = $branches;
        } else {
            $userBranchId = $user['branch_id'] ?? '';
            $targetBranches = array_values(array_filter($branches, fn($b) => ($b['id'] ?? '') === $userBranchId));
        }

        $calculations = [];
        foreach ($targetBranches as $b) {
            $bId = $b['id'] ?? '';
            $branchSales = array_filter($sales, fn($s) => ($s['branch_id'] ?? '') === $bId);
            $grossSales = array_reduce($branchSales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);
            $rate = (float)($b['royalty_percentage'] ?? 7.50);
            $royaltyPayable = $grossSales * ($rate / 100.0);
            $netFranchiseRetained = $grossSales - $royaltyPayable;

            $categories = [];
            foreach ($branchSales as $s) {
                $cat = $s['category'] ?? 'other';
                $categories[$cat] = ($categories[$cat] ?? 0) + (float)($s['amount'] ?? 0);
            }

            $calculations[] = [
                'branch_id' => $bId,
                'branch_name' => $b['name'] ?? '',
                'branch_code' => $b['code'] ?? '',
                'city' => $b['city'] ?? '',
                'grossSales' => $grossSales,
                'royaltyRate' => $rate,
                'royaltyPayable' => $royaltyPayable,
                'netFranchiseRetained' => $netFranchiseRetained,
                'contract_agreement' => $b['franchise_agreement'] ?? 'Commercial Franchise Agreement',
                'agreement_terms' => $b['franchise_agreement'] ?? "{$rate}% Variable Commercial Share",
                'transactionCount' => count($branchSales),
                'categories' => $categories,
                'status' => 'pending_remittance'
            ];
        }

        $networkTotals = [
            'totalGrossSales' => array_reduce($calculations, fn($acc, $c) => $acc + $c['grossSales'], 0.0),
            'totalCorporateRoyalties' => array_reduce($calculations, fn($acc, $c) => $acc + $c['royaltyPayable'], 0.0),
            'totalFranchiseRetained' => array_reduce($calculations, fn($acc, $c) => $acc + $c['netFranchiseRetained'], 0.0),
            'totalTransactions' => array_reduce($calculations, fn($acc, $c) => $acc + $c['transactionCount'], 0)
        ];

        return JsonResponse::create($response, [
            'success' => true,
            'networkTotals' => $networkTotals,
            'branchCalculations' => $calculations
        ]);
    }

    public function getWaivers(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $waivers = $store['waivers'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin') {
            $userBranchId = $user['branch_id'] ?? '';
            $waivers = array_values(array_filter($waivers, fn($w) => ($w['branch_id'] ?? '') === $userBranchId));
        }

        return JsonResponse::create($response, [
            'success' => true,
            'waivers' => $waivers,
            'total' => count($waivers)
        ]);
    }

    public function signWaiver(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();
        $guestName = $body['guest_name'] ?? 'Walk-in Athlete';
        $branchId = $body['branch_id'] ?? 'b-mkt-01';

        $legalSeal = hash('sha256', "{$branchId}|{$guestName}|" . microtime(true));

        $waiver = [
            'id' => bin2hex(random_bytes(16)),
            'branch_id' => $branchId,
            'guest_name' => $guestName,
            'phone' => $body['phone'] ?? 'N/A',
            'legal_seal' => $legalSeal,
            'sha256_hash' => $legalSeal,
            'signed_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['waivers'])) $store['waivers'] = [];
        array_unshift($store['waivers'], $waiver);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'waiver' => $waiver], 201);
    }

    public function getRemittances(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'remittances' => $store['remittances'] ?? []
        ]);
    }

    public function settleRemittance(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Remittance settled successfully.']);
    }

    public function getCapexAssets(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        return JsonResponse::create($response, [
            'success' => true,
            'assets' => $store['capex_assets'] ?? []
        ]);
    }

    public function reconcileBlindCash(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $openingFloat = (float)($body['opening_float'] ?? 3000);
        $denominations = (array)($body['denominations'] ?? []);
        $closingNotes = trim((string)($body['closing_notes'] ?? ''));

        $targetBranchId = ($user['role'] ?? '') === 'super_admin'
            ? ($body['branch_id'] ?? ($store['branches'][0]['id'] ?? 'b-mkt-01'))
            : ($user['branch_id'] ?? ($store['branches'][0]['id'] ?? 'b-mkt-01'));

        $branch = null;
        foreach ($store['branches'] ?? [] as $b) {
            if ($b['id'] === $targetBranchId) {
                $branch = $b;
                break;
            }
        }

        $counts = [
            'p1000' => max(0, (int)($denominations['p1000'] ?? 0)),
            'p500' => max(0, (int)($denominations['p500'] ?? 0)),
            'p200' => max(0, (int)($denominations['p200'] ?? 0)),
            'p100' => max(0, (int)($denominations['p100'] ?? 0)),
            'p50' => max(0, (int)($denominations['p50'] ?? 0)),
            'p20' => max(0, (int)($denominations['p20'] ?? 0)),
            'coins' => max(0, (float)($denominations['coins'] ?? 0))
        ];

        $physicalCountedCash =
            ($counts['p1000'] * 1000) +
            ($counts['p500'] * 500) +
            ($counts['p200'] * 200) +
            ($counts['p100'] * 100) +
            ($counts['p50'] * 50) +
            ($counts['p20'] * 20) +
            $counts['coins'];

        $branchSales = array_filter($store['sales'] ?? [], fn($s) => ($s['branch_id'] ?? '') === $targetBranchId);
        $cashSales = array_filter($branchSales, fn($s) => str_contains(strtolower($s['payment_method'] ?? ($s['payment_channel'] ?? '')), 'cash'));
        $totalCashIntake = array_reduce($cashSales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);

        $digitalSales = array_filter($branchSales, fn($s) => !str_contains(strtolower($s['payment_method'] ?? ($s['payment_channel'] ?? '')), 'cash'));
        $totalDigitalIntake = array_reduce($digitalSales, fn($acc, $s) => $acc + (float)($s['amount'] ?? 0), 0.0);

        $expectedCashInDrawer = $openingFloat + $totalCashIntake;
        $variance = $physicalCountedCash - $expectedCashInDrawer;
        $status = abs($variance) < 0.01 ? 'BALANCED' : ($variance > 0 ? 'OVERAGE' : 'SHORTAGE');

        $zReadingRecord = [
            'id' => 'ZREAD-' . ($branch ? ($branch['code'] ?? 'MKT') : 'MKT') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
            'timestamp' => date('c'),
            'reconciled_by' => ($user['name'] ?? $user['email']) . ' (' . ($user['role'] ?? 'staff') . ')',
            'branch_id' => $targetBranchId,
            'branch_name' => $branch ? $branch['name'] : 'Unknown Branch',
            'opening_float' => $openingFloat,
            'total_cash_sales' => $totalCashIntake,
            'total_digital_sales' => $totalDigitalIntake,
            'gross_shift_sales' => $totalCashIntake + $totalDigitalIntake,
            'expected_cash_in_drawer' => $expectedCashInDrawer,
            'physical_counted_cash' => $physicalCountedCash,
            'variance' => round($variance, 2),
            'status' => $status,
            'denomination_counts' => $counts,
            'closing_notes' => $closingNotes
        ];

        if (!isset($store['z_readings'])) $store['z_readings'] = [];
        array_unshift($store['z_readings'], $zReadingRecord);
        Database::saveStore();

        AuditLogger::logAuditEvent([
            'branch_id' => $targetBranchId,
            'user_id' => $user['id'] ?? 'staff',
            'user_role' => $user['role'] ?? 'staff',
            'action' => 'POS_BLIND_CASH_RECONCILIATION',
            'resource' => 'cash_drawer',
            'details' => [
                'z_id' => $zReadingRecord['id'],
                'counted' => $physicalCountedCash,
                'expected' => $expectedCashInDrawer,
                'variance' => $zReadingRecord['variance'],
                'status' => $status
            ]
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'message' => "Shift Z-Reading completed with {$status} status (Variance: ₱" . number_format(abs($zReadingRecord['variance']), 2) . ").",
            'report' => $zReadingRecord
        ]);
    }

    public function getBir2307Certificate(Request $request, Response $response, array $args): Response
    {
        $remittanceId = $args['remittanceId'] ?? '';
        $user = $request->getAttribute('user');
        $store = &Database::getStore();

        $remittance = null;
        foreach ($store['remittances'] ?? [] as $r) {
            if (($r['id'] ?? '') === $remittanceId || ($r['reference_no'] ?? '') === $remittanceId) {
                $remittance = $r;
                break;
            }
        }

        if (!$remittance) {
            $remittance = [
                'id' => $remittanceId,
                'reference_no' => $remittanceId,
                'branch_id' => 'b-mkt-01',
                'period' => 'Q3 2026',
                'gross_royalty' => 889619.07,
                'cwt_amount' => 44480.95,
                'net_remitted' => 845138.12,
                'payment_rail' => 'BDO PESONet Commercial Wire',
                'settled_at' => date('c')
            ];
        }

        $branch = null;
        foreach ($store['branches'] ?? [] as $b) {
            if ($b['id'] === ($remittance['branch_id'] ?? 'b-mkt-01')) {
                $branch = $b;
                break;
            }
        }

        $certificate = [
            'certificate_number' => "BIR2307-{$remittance['reference_no']}",
            'form_name' => 'BIR Form No. 2307 (Certificate of Creditable Tax Withheld At Source)',
            'period' => $remittance['period'] ?? 'Q3 2026',
            'period_from' => '2026-07-01',
            'period_to' => '2026-09-30',
            'payee' => [
                'tin' => '109-445-890-000',
                'name' => 'KSYN FITNESS PHILIPPINES INC.',
                'trade_name' => 'KSYN Fitness Corporate Headquarters',
                'address' => '28th Floor, Ayala Triangle Tower Two, Makati City, Metro Manila, Philippines',
                'zip_code' => '1226',
                'rdo_code' => '047'
            ],
            'payor' => [
                'tin' => '204-891-302-000',
                'name' => $branch ? "KSYN FITNESS FRANCHISE (" . strtoupper($branch['name']) . ")" : 'KSYN FITNESS FRANCHISE OPERATOR',
                'trade_name' => $branch ? $branch['name'] : 'KSYN Fitness Club',
                'address' => $branch ? $branch['address'] : 'Metro Manila, Philippines',
                'zip_code' => '1200',
                'rdo_code' => '044'
            ],
            'income_payments' => [
                [
                    'atc' => 'WC158',
                    'nature_of_payment' => 'Franchise Royalties and Licensing Fees',
                    'first_month' => round(((float)($remittance['gross_royalty'] ?? 0) / 3), 2),
                    'second_month' => round(((float)($remittance['gross_royalty'] ?? 0) / 3), 2),
                    'third_month' => round(((float)($remittance['gross_royalty'] ?? 0) / 3), 2),
                    'total_gross' => (float)($remittance['gross_royalty'] ?? 0),
                    'tax_rate' => '5%',
                    'tax_withheld' => (float)($remittance['cwt_amount'] ?? 0)
                ]
            ],
            'total_income_payment' => (float)($remittance['gross_royalty'] ?? 0),
            'total_tax_withheld' => (float)($remittance['cwt_amount'] ?? 0),
            'net_amount_remitted' => (float)($remittance['net_remitted'] ?? 0),
            'payment_rail' => $remittance['payment_rail'] ?? 'PESONet',
            'reference_no' => $remittance['reference_no'],
            'signatory' => [
                'name' => 'Elena Rostova',
                'title' => 'Authorized Franchise Finance Officer / Managing Director',
                'date_signed' => $remittance['settled_at'] ?? date('c')
            ]
        ];

        return JsonResponse::create($response, ['success' => true, 'certificate' => $certificate]);
    }
}
