<?php

namespace Ksyn\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Ksyn\Config\Database;
use Ksyn\Utils\JsonResponse;
use Ksyn\Middleware\AuditLogger;

class PayrollController
{
    /**
     * 1. Generate Batch Commission Payroll for Coaches
     * POST /api/coach/payroll/batch-payout or /api/finance/payroll/batch-payout
     */
    public function generateBatchPayroll(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            $body = (array)$request->getParsedBody();

            $month = isset($body['month']) ? (int)$body['month'] : (int)date('n');
            $year = isset($body['year']) ? (int)$body['year'] : (int)date('Y');
            $branchId = $body['branch_id'] ?? null;
            $withholdingTaxRate = isset($body['withholding_tax_rate']) ? (float)$body['withholding_tax_rate'] : 0.10;

            $targetBranchId = ($user['role'] ?? '') === 'super_admin' ? $branchId : ($user['branch_id'] ?? null);

            $memory = &Database::getMemoryStore();
            if (!isset($memory['coach_payslips'])) $memory['coach_payslips'] = [];
            if (!isset($memory['payroll_batch_runs'])) $memory['payroll_batch_runs'] = [];
            if (!isset($memory['pt_sessions'])) $memory['pt_sessions'] = [];

            $users = $memory['users'] ?? [];
            $coaches = array_values(array_filter($users, function ($u) use ($targetBranchId) {
                $isCoach = in_array($u['role'] ?? '', ['coach', 'trainer'], true);
                if (!$isCoach) return false;
                if ($targetBranchId) {
                    return ($u['branch_id'] ?? '') === $targetBranchId || empty($u['branch_id']);
                }
                return true;
            }));

            if (empty($coaches)) {
                return JsonResponse::error($response, 'No eligible coaches found for commission payroll in the specified branch.', 404);
            }

            $dateObj = \DateTime::createFromFormat('!m', (string)$month);
            $monthName = $dateObj ? $dateObj->format('F') : 'Current Month';

            $batchRunId = sprintf('pr-run-%d-%02d-%s', $year, $month, substr((string)time(), -4));
            $createdPayslips = [];
            $totalGrossBatch = 0.0;
            $totalTaxBatch = 0.0;
            $totalNetBatch = 0.0;

            foreach ($coaches as $coach) {
                $coachId = $coach['id'] ?? '';
                $eligibleSessions = [];

                foreach ($memory['pt_sessions'] as &$s) {
                    if (($s['coach_id'] ?? '') !== $coachId) continue;
                    $sDateStr = $s['session_date'] ?? ($s['created_at'] ?? 'now');
                    $sTime = strtotime($sDateStr);
                    $sMonth = (int)date('n', $sTime);
                    $sYear = (int)date('Y', $sTime);
                    if ($sMonth === $month && $sYear === $year) {
                        $eligibleSessions[] = &$s;
                    }
                }
                unset($s);

                $sessionsCount = count($eligibleSessions);
                $baseCommission = 0.0;
                foreach ($eligibleSessions as $s) {
                    $baseCommission += isset($s['commission_earned']) ? (float)$s['commission_earned'] : 570.00;
                }

                // Performance Tier Bonus
                $tierBonus = $sessionsCount >= 15 ? 5000.00 : ($sessionsCount >= 10 ? 2500.00 : 0.00);
                $grossEarnings = round($baseCommission + $tierBonus, 2);
                $taxAmount = round($grossEarnings * $withholdingTaxRate, 2);
                $netPayout = round($grossEarnings - $taxAmount, 2);

                $payslipNo = sprintf('PAY-%d%02d-%s', $year, $month, strtoupper(substr($coachId, -4)));
                $slipId = sprintf('slip-%d-%s', time(), substr($coachId, -4));

                $payslip = [
                    'id' => $slipId,
                    'batch_run_id' => $batchRunId,
                    'payslip_no' => $payslipNo,
                    'period_month' => $month,
                    'period_year' => $year,
                    'period_label' => "{$monthName} {$year}",
                    'coach_id' => $coachId,
                    'coach_name' => $coach['name'] ?? 'Coach',
                    'coach_email' => $coach['email'] ?? '',
                    'branch_id' => $coach['branch_id'] ?? ($targetBranchId ?? 'b-mkt-01'),
                    'contract_title' => 'Head Coach / Senior Personal Trainer (Tier 2)',
                    'split_percentage' => 60.0,
                    'sessions_completed' => $sessionsCount,
                    'base_commission' => $baseCommission,
                    'tier_bonus' => $tierBonus,
                    'gross_earnings' => $grossEarnings,
                    'withholding_tax_rate' => $withholdingTaxRate * 100,
                    'withholding_tax_amount' => $taxAmount,
                    'bir_form_ref' => 'BIR Form 2307 (Creditable Withholding Tax at Source - 10%)',
                    'net_payout' => $netPayout,
                    'currency' => 'PHP',
                    'bank_details' => [
                        'bank_name' => 'BDO Unibank, Inc.',
                        'bank_code' => 'BDO001',
                        'account_number' => '1098-7654-3210',
                        'account_name' => $coach['name'] ?? 'Coach'
                    ],
                    'payment_rail' => 'PESONet Batch Direct Credit',
                    'payout_status' => 'Disbursed',
                    'generated_at' => date('c'),
                    'generated_by' => $user['name'] ?? 'System Payroll Engine'
                ];

                // Mark sessions as disbursed
                foreach ($eligibleSessions as &$s) {
                    $s['payout_id'] = $slipId;
                    $s['payout_status'] = 'disbursed';
                }
                unset($s);

                array_unshift($memory['coach_payslips'], $payslip);
                $createdPayslips[] = $payslip;

                $totalGrossBatch += $grossEarnings;
                $totalTaxBatch += $taxAmount;
                $totalNetBatch += $netPayout;
            }

            $batchSummary = [
                'id' => $batchRunId,
                'branch_id' => $targetBranchId,
                'period' => "{$monthName} {$year}",
                'coaches_count' => count($createdPayslips),
                'total_gross_earnings' => round($totalGrossBatch, 2),
                'total_withholding_tax' => round($totalTaxBatch, 2),
                'total_net_payout' => round($totalNetBatch, 2),
                'clearing_rail' => 'BDO / BPI PESONet Electronic Fund Transfer',
                'created_at' => date('c'),
                'created_by' => $user['name'] ?? 'System'
            ];

            array_unshift($memory['payroll_batch_runs'], $batchSummary);
            Database::saveStore();

            AuditLogger::logAuditEvent([
                'branch_id' => $targetBranchId,
                'user_id' => $user['id'] ?? 'system',
                'user_role' => $user['role'] ?? 'super_admin',
                'action' => 'PAYROLL_BATCH_DISBURSED',
                'resource' => "PAYROLL_BATCH:{$batchRunId}",
                'ip_address' => $request->getServerParams()['REMOTE_ADDR'] ?? '127.0.0.1',
                'details' => [
                    'period' => "{$monthName} {$year}",
                    'coaches' => count($createdPayslips),
                    'totalNet' => $totalNetBatch
                ]
            ]);

            return JsonResponse::success($response, [
                'message' => "Batch commission payroll for {$monthName} {$year} generated successfully.",
                'batch' => $batchSummary,
                'payslips' => $createdPayslips
            ], 201);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 2. View Payslips List
     * GET /api/coach/payroll/payslips or /api/finance/payroll/payslips
     */
    public function getPayslips(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');

            if (Database::isPostgres()) {
                $sql = 'SELECT * FROM coach_payslips';
                $params = [];
                if (in_array($user['role'] ?? '', ['coach', 'trainer'], true)) {
                    $sql .= ' WHERE coach_id = ?';
                    $params[] = $user['id'] ?? '';
                } elseif (($user['role'] ?? '') === 'branch_admin' && !empty($user['branch_id'])) {
                    $sql .= ' WHERE branch_id = ?';
                    $params[] = $user['branch_id'];
                }
                $sql .= ' ORDER BY created_at DESC';
                $rows = Database::query($sql, $params, $user['id'] ?? null);
                return JsonResponse::success($response, [
                    'count' => count($rows),
                    'payslips' => $rows
                ]);
            }

            $memory = &Database::getMemoryStore();
            $slips = $memory['coach_payslips'] ?? [];

            if (in_array($user['role'] ?? '', ['coach', 'trainer'], true)) {
                $userId = $user['id'] ?? '';
                $slips = array_values(array_filter($slips, fn($p) => ($p['coach_id'] ?? '') === $userId));
            } elseif (($user['role'] ?? '') === 'branch_admin' && !empty($user['branch_id'])) {
                $branchId = $user['branch_id'];
                $slips = array_values(array_filter($slips, fn($p) => ($p['branch_id'] ?? '') === $branchId));
            }

            return JsonResponse::success($response, [
                'count' => count($slips),
                'payslips' => $slips
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 3. View Single Payslip by ID
     * GET /api/coach/payroll/payslips/{id} or /api/finance/payroll/payslips/{id}
     */
    public function getPayslipById(Request $request, Response $response, array $args): Response
    {
        try {
            $id = $args['id'] ?? '';
            $user = $request->getAttribute('user');

            $memory = &Database::getMemoryStore();
            $slips = $memory['coach_payslips'] ?? [];
            $slip = null;

            foreach ($slips as $s) {
                if (($s['id'] ?? '') === $id || ($s['payslip_no'] ?? '') === $id) {
                    $slip = $s;
                    break;
                }
            }

            if (!$slip) {
                return JsonResponse::error($response, 'Payslip record not found.', 404);
            }

            if (in_array($user['role'] ?? '', ['coach', 'trainer'], true) && ($slip['coach_id'] ?? '') !== ($user['id'] ?? '')) {
                return JsonResponse::error($response, 'Unauthorized to view another coach payslip.', 403);
            }

            $itemizedSessions = [];
            foreach ($memory['pt_sessions'] ?? [] as $session) {
                if (($session['payout_id'] ?? '') === $slip['id']) {
                    $itemizedSessions[] = $session;
                }
            }

            $slip['itemized_sessions'] = $itemizedSessions;

            return JsonResponse::success($response, [
                'payslip' => $slip
            ]);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }

    /**
     * 4. Export PESONet Bank Clearing File (CSV)
     * GET /api/coach/payroll/export-bank-batch or /api/finance/payroll/export-bank-batch
     */
    public function exportBankBatchCsv(Request $request, Response $response): Response
    {
        try {
            $params = $request->getQueryParams();
            $batchRunId = $params['batchRunId'] ?? null;
            $format = $params['format'] ?? 'pesonet';

            $memory = &Database::getMemoryStore();
            $slips = $memory['coach_payslips'] ?? [];

            if ($batchRunId) {
                $slips = array_values(array_filter($slips, fn($s) => ($s['batch_run_id'] ?? '') === $batchRunId));
            }

            if (empty($slips)) {
                return JsonResponse::error($response, 'No payslip records available for bank batch export.', 404);
            }

            $csvLines = [];
            $csvLines[] = implode(',', [
                'RECORD_TYPE',
                'BENEFICIARY_NAME',
                'BANK_CODE',
                'BANK_NAME',
                'ACCOUNT_NUMBER',
                'AMOUNT',
                'CURRENCY',
                'REFERENCE_NO',
                'REMARKS'
            ]);

            foreach ($slips as $s) {
                $coachName = str_replace('"', '""', $s['coach_name'] ?? '');
                $bankCode = $s['bank_details']['bank_code'] ?? 'BDO001';
                $bankName = str_replace('"', '""', $s['bank_details']['bank_name'] ?? 'BDO Unibank');
                $acctNum = str_replace('"', '""', $s['bank_details']['account_number'] ?? '1098-7654-3210');
                $amt = number_format((float)($s['net_payout'] ?? 0), 2, '.', '');
                $refNo = $s['payslip_no'] ?? '';
                $periodLabel = $s['period_label'] ?? '';
                $remarks = "\"KSYN {$periodLabel} Trainer Commission Settlement\"";

                $csvLines[] = implode(',', [
                    'CREDIT',
                    "\"{$coachName}\"",
                    $bankCode,
                    "\"{$bankName}\"",
                    "\"{$acctNum}\"",
                    $amt,
                    'PHP',
                    $refNo,
                    $remarks
                ]);
            }

            $csvContent = implode("\r\n", $csvLines);
            $filename = sprintf('KSYN_%s_Batch_%d.csv', strtoupper($format), time());

            $response->getBody()->write($csvContent);
            return $response
                ->withHeader('Content-Type', 'text/csv; charset=utf-8')
                ->withHeader('Content-Disposition', "attachment; filename=\"{$filename}\"")
                ->withStatus(200);
        } catch (\Throwable $e) {
            return JsonResponse::error($response, $e->getMessage(), 500);
        }
    }
}
