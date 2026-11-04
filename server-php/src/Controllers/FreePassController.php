<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FreePassController
{
    public function getPublicBranches(Request $request, Response $response): Response
    {
        return (new BranchController())->getAllBranches($request, $response);
    }

    public function applyFreePass(Request $request, Response $response): Response
    {
        $body = (array)($request->getParsedBody() ?? []);
        $fullName = trim($body['full_name'] ?? $body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $phone = trim($body['phone'] ?? $body['phone_number'] ?? '');
        $branchId = $body['branch_id'] ?? 'b-mkt-01';

        if (!$fullName || !$email || !$phone) {
            return JsonResponse::create($response, [
                'success' => false,
                'message' => 'Full name, email, and phone number are required.'
            ], 400);
        }

        $store = &Database::getStore();
        if (!isset($store['free_pass_applications'])) $store['free_pass_applications'] = [];

        $app = [
            'id' => bin2hex(random_bytes(16)),
            'full_name' => $fullName,
            'email' => $email,
            'phone_number' => $phone,
            'branch_id' => $branchId,
            'month_year' => date('Y-m'),
            'status' => 'pending',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        array_unshift($store['free_pass_applications'], $app);
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Free Pass Raffle entry submitted successfully!',
            'application' => $app
        ], 201);
    }

    public function getBranchApplicants(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $branchId = $user['branch_id'] ?? 'b-mkt-01';
        $store = &Database::getStore();

        $applicants = array_values(array_filter($store['free_pass_applications'] ?? [], function($a) use ($branchId, $user) {
            if (($user['role'] ?? '') === 'super_admin') return true;
            return ($a['branch_id'] ?? '') === $branchId;
        }));

        return JsonResponse::create($response, [
            'success' => true,
            'applicants' => $applicants,
            'count' => count($applicants)
        ]);
    }

    public function awardFreePass(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? '';
        $store = &Database::getStore();

        foreach ($store['free_pass_applications'] as &$app) {
            if (($app['id'] ?? '') === $id) {
                $app['status'] = 'awarded';
                $app['awarded_at'] = gmdate('Y-m-d\TH:i:s.v\Z');
                $app['pass_code'] = 'FP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
                Database::saveStore();
                return JsonResponse::create($response, ['success' => true, 'message' => 'Free pass awarded.', 'application' => $app]);
            }
        }

        return JsonResponse::create($response, ['success' => false, 'message' => 'Applicant not found.'], 404);
    }

    public function drawWinner(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $branchId = $user['branch_id'] ?? 'b-mkt-01';
        $store = &Database::getStore();

        $pending = array_values(array_filter($store['free_pass_applications'] ?? [], function($a) use ($branchId, $user) {
            $isBranch = ($user['role'] ?? '') === 'super_admin' || ($a['branch_id'] ?? '') === $branchId;
            return $isBranch && ($a['status'] ?? '') === 'pending';
        }));

        if (empty($pending)) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'No eligible pending raffle applicants found.'], 400);
        }

        $winner = $pending[array_rand($pending)];
        foreach ($store['free_pass_applications'] as &$app) {
            if ($app['id'] === $winner['id']) {
                $app['status'] = 'awarded';
                $app['awarded_at'] = gmdate('Y-m-d\TH:i:s.v\Z');
                $app['pass_code'] = 'FP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
                $winner = $app;
                break;
            }
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Raffle winner selected!',
            'winner' => $winner
        ]);
    }
}
