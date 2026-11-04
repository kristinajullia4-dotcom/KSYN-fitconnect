<?php

namespace Ksyn\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Ksyn\Config\Database;
use Ksyn\Utils\JsonResponse;
use Ksyn\Utils\SmsGateway;

class NotificationController
{
    /**
     * 1. View SMS Audit Logs
     * GET /api/notifications/sms/logs
     */
    public function getSmsLogs(Request $request, Response $response): Response
    {
        $memory = &Database::getMemoryStore();
        $logs = $memory['sms_audit_logs'] ?? [];

        return JsonResponse::success($response, [
            'count' => count($logs),
            'logs' => $logs
        ]);
    }

    /**
     * 2. Dispatch Direct Administrative SMS
     * POST /api/notifications/sms/send
     */
    public function sendAdministrativeSms(Request $request, Response $response): Response
    {
        $body = (array)$request->getParsedBody();
        $user = $request->getAttribute('user');

        $recipient = trim($body['recipient'] ?? '');
        $message = trim($body['message'] ?? '');
        $category = $body['category'] ?? 'ADMIN_DISPATCH';

        if (empty($recipient) || empty($message)) {
            return JsonResponse::error($response, 'Recipient phone number and message text are required.', 400);
        }

        $result = SmsGateway::sendSms($recipient, $message, [
            'category' => $category,
            'dispatched_by' => $user['name'] ?? 'Administrative Staff',
            'branch_id' => $user['branch_id'] ?? null
        ]);

        return JsonResponse::success($response, [
            'message' => 'SMS message dispatched to gateway.',
            'sms' => $result
        ], 201);
    }
}
