<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuditController
{
    public function getAuditLogs(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $logs = $store['audit_logs'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin') {
            $bId = $user['branch_id'] ?? '';
            $logs = array_values(array_filter($logs, fn($l) => ($l['branch_id'] ?? '') === $bId));
        }

        $branches = $store['branches'] ?? [];
        $users = $store['users'] ?? [];

        $enriched = array_map(function($log) use ($branches, $users) {
            $branch = null;
            if (!empty($log['branch_id'])) {
                foreach ($branches as $b) {
                    if (($b['id'] ?? '') === $log['branch_id']) {
                        $branch = $b;
                        break;
                    }
                }
            }

            $actor = null;
            if (!empty($log['user_id'])) {
                foreach ($users as $u) {
                    if (($u['id'] ?? '') === $log['user_id']) {
                        $actor = $u;
                        break;
                    }
                }
            }

            $copy = $log;
            $copy['branch_name'] = $branch ? $branch['name'] : (!empty($log['branch_id']) ? 'Unknown' : 'Corporate HQ');
            $copy['actor_name'] = $actor ? $actor['name'] : 'System';
            return $copy;
        }, $logs);

        return JsonResponse::create($response, [
            'success' => true,
            'logs' => $enriched
        ]);
    }

    public function getAuditTrail(Request $request, Response $response): Response
    {
        return $this->getAuditLogs($request, $response);
    }

    public function verifyChain(Request $request, Response $response): Response
    {
        $report = AuditLogger::verifyAuditChain();
        return JsonResponse::create($response, array_merge(['success' => true], $report));
    }

    public function verifyAuditChain(Request $request, Response $response): Response
    {
        return $this->verifyChain($request, $response);
    }
}
