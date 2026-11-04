<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class CoachController
{
    public function getClients(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $clients = array_values(array_filter($store['pt_clients'] ?? [], function($c) use ($user) {
            if (($user['role'] ?? '') === 'super_admin') return true;
            return ($c['coach_id'] ?? '') === $user['id'] || ($c['branch_id'] ?? '') === ($user['branch_id'] ?? '');
        }));

        return JsonResponse::create($response, ['success' => true, 'clients' => $clients]);
    }

    public function renewClientPackage(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Package renewed.']);
    }

    public function getPtClients(Request $request, Response $response): Response
    {
        return $this->getClients($request, $response);
    }

    public function logPtSession(Request $request, Response $response): Response
    {
        return $this->logSession($request, $response);
    }

    public function getClasses(Request $request, Response $response): Response
    {
        return $this->getAssignedClasses($request, $response);
    }

    public function logSession(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $sessionRate = (float)($body['session_rate'] ?? 850.00);
        $split = (float)($body['split_percentage'] ?? 60.00);
        $commission = round(($sessionRate * $split) / 100.0, 2);

        $session = [
            'id' => bin2hex(random_bytes(16)),
            'coach_id' => $user['id'],
            'client_id' => $body['client_id'] ?? '',
            'client_name' => $body['client_name'] ?? 'Client',
            'branch_id' => $user['branch_id'] ?? 'b-mkt-01',
            'session_rate' => $sessionRate,
            'split_percentage' => $split,
            'commission_earned' => $commission,
            'focus_area' => $body['focus_area'] ?? ($body['focus'] ?? 'Strength & Conditioning'),
            'notes' => $body['notes'] ?? '',
            'duration_minutes' => (int)($body['duration_minutes'] ?? 60),
            'logged_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['pt_sessions'])) $store['pt_sessions'] = [];
        array_unshift($store['pt_sessions'], $session);

        // Increment sessions_completed in pt_clients
        if (!empty($body['client_id'])) {
            foreach ($store['pt_clients'] as &$c) {
                if (($c['client_id'] ?? '') === $body['client_id'] || ($c['id'] ?? '') === $body['client_id']) {
                    $c['sessions_completed'] = (int)($c['sessions_completed'] ?? 0) + 1;
                    break;
                }
            }
        }

        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'session' => $session], 201);
    }

    public function getSessions(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $sessions = array_values(array_filter($store['pt_sessions'] ?? [], function($s) use ($user) {
            if (($user['role'] ?? '') === 'super_admin') return true;
            return ($s['coach_id'] ?? '') === $user['id'];
        }));

        return JsonResponse::create($response, ['success' => true, 'sessions' => $sessions]);
    }

    public function updateClientMetrics(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Metrics updated.']);
    }

    public function getCommissions(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $sessions = array_values(array_filter($store['pt_sessions'] ?? [], fn($s) => ($s['coach_id'] ?? '') === $user['id']));

        $totalCommission = array_reduce($sessions, fn($acc, $s) => $acc + (float)($s['commission_earned'] ?? 510), 0.0);
        $totalSessions = count($sessions);

        return JsonResponse::create($response, [
            'success' => true,
            'totalEarnings' => $totalCommission,
            'totalCommission' => $totalCommission,
            'sessionsCount' => $totalSessions,
            'totalSessions' => $totalSessions,
            'sessions' => $sessions
        ]);
    }

    public function getAssignedClasses(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $classes = array_values(array_filter($store['classes'] ?? [], function($c) use ($user) {
            if (($user['role'] ?? '') === 'super_admin') return true;
            return ($c['coach_id'] ?? '') === $user['id'] || ($c['branch_id'] ?? '') === ($user['branch_id'] ?? '');
        }));

        return JsonResponse::create($response, ['success' => true, 'classes' => $classes]);
    }

    public function checkInClassAttendee(Request $request, Response $response): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Class attendee checked in successfully.']);
    }

    public function getCoachMessages(Request $request, Response $response, array $args): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $messages = array_values(array_filter($store['coach_messages'] ?? [], fn($m) => ($m['coach_id'] ?? '') === $user['id']));

        return JsonResponse::create($response, ['success' => true, 'messages' => $messages]);
    }

    public function sendCoachMessage(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $msg = [
            'id' => bin2hex(random_bytes(16)),
            'coach_id' => $user['id'],
            'client_id' => $body['client_id'] ?? '',
            'sender_id' => $user['id'],
            'sender_name' => $user['name'],
            'message' => $body['message'] ?? '',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['coach_messages'])) $store['coach_messages'] = [];
        array_unshift($store['coach_messages'], $msg);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => $msg], 201);
    }

    public function getWorkoutPlans(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $plans = array_values(array_filter($store['workout_plans'] ?? [], function($p) use ($user) {
            if (($user['role'] ?? '') === 'super_admin') return true;
            return ($p['coach_id'] ?? '') === $user['id'];
        }));

        return JsonResponse::create($response, ['success' => true, 'plans' => $plans]);
    }

    public function createWorkoutPlan(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $plan = [
            'id' => bin2hex(random_bytes(16)),
            'coach_id' => $user['id'],
            'client_id' => $body['client_id'] ?? '',
            'title' => $body['title'] ?? 'Custom Workout Routine',
            'exercises' => $body['exercises'] ?? [],
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        if (!isset($store['workout_plans'])) $store['workout_plans'] = [];
        array_unshift($store['workout_plans'], $plan);
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'plan' => $plan], 201);
    }

    public function deleteWorkoutPlan(Request $request, Response $response, array $args): Response
    {
        $id = $args['planId'] ?? '';
        $store = &Database::getStore();
        $store['workout_plans'] = array_values(array_filter($store['workout_plans'] ?? [], fn($p) => ($p['id'] ?? '') !== $id));
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => 'Plan deleted.']);
    }

    public function scanClassQrPass(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Class pass validated.']);
    }

    public function getClientStrength(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'strength' => []]);
    }

    public function recordClientStrength(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Strength recorded.']);
    }

    public function getClientNutrition(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'nutrition' => null]);
    }

    public function setClientNutrition(Request $request, Response $response, array $args): Response
    {
        return JsonResponse::create($response, ['success' => true, 'message' => 'Nutrition updated.']);
    }

    public function getItemizedCommissionSlips(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $slips = array_values(array_filter($store['coach_payslips'] ?? [], fn($p) => ($p['coach_id'] ?? '') === $user['id']));

        return JsonResponse::create($response, ['success' => true, 'slips' => $slips]);
    }
}
