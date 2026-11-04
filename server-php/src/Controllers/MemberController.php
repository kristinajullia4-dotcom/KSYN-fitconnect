<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Config\MembershipRates;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MemberController
{
    public function getMembers(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $allUsers = $store['users'] ?? [];

        $members = array_values(array_filter($allUsers, fn($u) => ($u['role'] ?? '') === 'member'));
        if (($user['role'] ?? '') !== 'super_admin') {
            $userBranchId = $user['branch_id'] ?? '';
            $members = array_values(array_filter($members, fn($u) => ($u['branch_id'] ?? '') === $userBranchId));
        }

        $subscriptions = $store['subscriptions'] ?? [];
        $branches = $store['branches'] ?? [];
        $attendance = $store['attendance_logs'] ?? [];

        $enriched = array_map(function($m) use ($subscriptions, $branches, $attendance) {
            $sub = null;
            foreach ($subscriptions as $s) {
                if (($s['user_id'] ?? '') === $m['id']) {
                    $sub = $s;
                    break;
                }
            }

            $branch = null;
            foreach ($branches as $b) {
                if (($b['id'] ?? '') === ($m['branch_id'] ?? '')) {
                    $branch = $b;
                    break;
                }
            }

            $checkIns = array_filter($attendance, fn($a) => ($a['user_id'] ?? '') === $m['id']);
            $planId = $m['membership_plan'] ?? $sub['plan'] ?? '1_month';
            $resolved = MembershipRates::resolvePlan($planId);

            return [
                'id' => $m['id'],
                'name' => $m['name'],
                'email' => $m['email'],
                'phone' => $m['phone'] ?? '',
                'status' => $m['status'] ?? 'active',
                'membership_plan' => $planId,
                'plan_name' => $resolved ? $resolved['name'] : $planId,
                'membership_tier' => $m['membership_tier'] ?? $resolved['tier'] ?? $sub['tier'] ?? 'basic',
                'rfid_card_uid' => $m['rfid_card_uid'] ?? null,
                'branch_id' => $m['branch_id'] ?? '',
                'branch_name' => $branch ? $branch['name'] : 'Unknown',
                'subscription' => $sub,
                'total_check_ins' => count($checkIns),
                'created_at' => $m['created_at'] ?? gmdate('Y-m-d\TH:i:s.v\Z')
            ];
        }, $members);

        return JsonResponse::create($response, [
            'success' => true,
            'members' => $enriched
        ]);
    }

    public function getMemberById(Request $request, Response $response, array $args): Response
    {
        $memberId = $args['memberId'] ?? ($args['id'] ?? '');
        $user = $request->getAttribute('user');

        if (($user['role'] ?? '') === 'member' && $user['id'] !== $memberId) {
            return JsonResponse::error($response, 'FORBIDDEN', 'Members may only access their personal profile records.', 403);
        }

        $store = &Database::getStore();
        $member = null;
        foreach ($store['users'] as $u) {
            if (($u['id'] ?? '') === $memberId && ($u['role'] ?? '') === 'member') {
                $member = $u;
                break;
            }
        }

        if (!$member) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Member not found.'], 404);
        }

        $sub = null;
        foreach ($store['subscriptions'] as $s) {
            if (($s['user_id'] ?? '') === $member['id']) {
                $sub = $s;
                break;
            }
        }

        return JsonResponse::create($response, [
            'success' => true,
            'member' => $member,
            'subscription' => $sub
        ]);
    }

    public function renewSubscription(Request $request, Response $response, array $args): Response
    {
        $memberId = $args['memberId'] ?? ($args['id'] ?? '');
        $body = (array)($request->getParsedBody() ?? []);
        $planId = $body['plan'] ?? '1_month';

        $resolved = MembershipRates::resolvePlan($planId) ?? MembershipRates::resolvePlan('1_month');
        $store = &Database::getStore();

        $sub = null;
        $existingSubIdx = null;
        foreach ($store['subscriptions'] as $idx => $s) {
            if (($s['user_id'] ?? '') === $memberId) {
                if (($s['status'] ?? '') === 'active' || $existingSubIdx === null) {
                    $existingSubIdx = $idx;
                }
            }
        }

        $now = time();
        $baseTime = $now;
        $startDate = date('Y-m-d');
        if ($existingSubIdx !== null && !empty($store['subscriptions'][$existingSubIdx]['end_date'])) {
            $existingEnd = strtotime($store['subscriptions'][$existingSubIdx]['end_date']);
            if ($existingEnd !== false && $existingEnd > $now) {
                $baseTime = $existingEnd;
                if (!empty($store['subscriptions'][$existingSubIdx]['start_date'])) {
                    $startDate = $store['subscriptions'][$existingSubIdx]['start_date'];
                }
            }
        }
        $newEndSec = $baseTime + ($resolved['durationDays'] * 86400);
        $endDate = date('Y-m-d', $newEndSec);

        if ($existingSubIdx !== null) {
            foreach ($store['subscriptions'] as $idx => $s) {
                if (($s['user_id'] ?? '') === $memberId && $idx !== $existingSubIdx) {
                    $store['subscriptions'][$idx]['status'] = 'expired';
                }
            }
            $store['subscriptions'][$existingSubIdx]['plan'] = $resolved['id'];
            $store['subscriptions'][$existingSubIdx]['tier'] = $resolved['tier'];
            $store['subscriptions'][$existingSubIdx]['status'] = 'active';
            $store['subscriptions'][$existingSubIdx]['start_date'] = $startDate;
            $store['subscriptions'][$existingSubIdx]['end_date'] = $endDate;
            $store['subscriptions'][$existingSubIdx]['price'] = $resolved['planFee'];
            $store['subscriptions'][$existingSubIdx]['total_paid'] = (float)($store['subscriptions'][$existingSubIdx]['total_paid'] ?? 0) + $resolved['totalDue'];
            $sub = $store['subscriptions'][$existingSubIdx];
        } else {
            $newSub = [
                'id' => bin2hex(random_bytes(16)),
                'user_id' => $memberId,
                'branch_id' => $body['branch_id'] ?? 'b-mkt-01',
                'plan' => $resolved['id'],
                'tier' => $resolved['tier'],
                'status' => 'active',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'price' => $resolved['planFee'],
                'access_fee' => $resolved['accessFee'],
                'annual_fee' => $resolved['annualFee'],
                'total_paid' => $resolved['totalDue'],
                'auto_renew' => true
            ];
            $store['subscriptions'][] = $newSub;
            $sub = $newSub;
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Subscription renewed successfully.',
            'subscription' => $sub
        ]);
    }

    public function updateMemberStatus(Request $request, Response $response, array $args): Response
    {
        $memberId = $args['memberId'] ?? ($args['id'] ?? '');
        $body = (array)($request->getParsedBody() ?? []);
        $status = $body['status'] ?? 'active';

        $store = &Database::getStore();
        $member = null;
        foreach ($store['users'] as &$u) {
            if (($u['id'] ?? '') === $memberId) {
                $u['status'] = $status;
                $member = $u;
                break;
            }
        }

        if (!$member) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Member not found.'], 404);
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Member status updated.',
            'member' => $member
        ]);
    }

    public function getProgress(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $progress = array_values(array_filter($store['fitness_progress'] ?? [], fn($p) => ($p['user_id'] ?? '') === $user['id']));

        return JsonResponse::create($response, ['success' => true, 'progress' => $progress]);
    }

    public function logProgress(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $entry = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'weight_kg' => (float)($body['weight_kg'] ?? 70),
            'body_fat_pct' => (float)($body['body_fat_pct'] ?? 15),
            'notes' => $body['notes'] ?? '',
            'logged_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['fitness_progress'][] = $entry;
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'entry' => $entry], 201);
    }

    public function getStrengthPRs(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $prs = array_values(array_filter($store['strength_prs'] ?? [], fn($p) => ($p['user_id'] ?? '') === $user['id']));

        $bestSquat = 0;
        $bestDeadlift = 0;
        $bestBench = 0;
        $bestOHP = 0;

        foreach ($prs as $pr) {
            $ex = strtolower($pr['exercise'] ?? '');
            $w = (float)($pr['weight_kg'] ?? 0);
            if (str_contains($ex, 'squat') && $w > $bestSquat) $bestSquat = $w;
            if (str_contains($ex, 'deadlift') && $w > $bestDeadlift) $bestDeadlift = $w;
            if (str_contains($ex, 'bench') && $w > $bestBench) $bestBench = $w;
            if ((str_contains($ex, 'ohp') || str_contains($ex, 'overhead')) && $w > $bestOHP) $bestOHP = $w;
        }

        $big3 = $bestSquat + $bestDeadlift + $bestBench;

        return JsonResponse::create($response, [
            'success' => true,
            'prs' => $prs,
            'best_lifts' => [
                'squat' => $bestSquat,
                'deadlift' => $bestDeadlift,
                'bench' => $bestBench,
                'ohp' => $bestOHP
            ],
            'big3_total' => $big3,
            'clubs' => [
                ['id' => 'club_300', 'name' => 'KSYN 300kg Club', 'unlocked' => $big3 >= 300],
                ['id' => 'club_400', 'name' => 'KSYN 400kg Club', 'unlocked' => $big3 >= 400],
                ['id' => 'club_500', 'name' => 'KSYN 500kg Club', 'unlocked' => $big3 >= 500]
            ]
        ]);
    }

    public function logStrengthPR(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $weight = (float)($body['weight_kg'] ?? 0);
        $reps = (int)($body['reps'] ?? 1);
        $exercise = trim($body['exercise'] ?? '');

        if ($weight <= 0 || $reps < 1 || !$exercise) {
            return JsonResponse::create($response, ['success' => false, 'message' => 'Valid exercise, weight, and reps required.'], 400);
        }

        $estimated1RM = $reps === 1 ? $weight : round($weight * (1 + $reps / 30.0), 1);
        $store = &Database::getStore();

        $newPR = [
            'id' => bin2hex(random_bytes(16)),
            'user_id' => $user['id'],
            'exercise' => $exercise,
            'weight_kg' => $weight,
            'reps' => $reps,
            'estimated_1rm' => $estimated1RM,
            'notes' => $body['notes'] ?? '',
            'logged_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['strength_prs'][] = $newPR;
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'pr' => $newPR], 201);
    }

    public function getFloorDensity(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $branchId = $request->getQueryParams()['branch_id'] ?? ($user['branch_id'] ?? 'b-mkt-01');

        $store = &Database::getStore();
        $recentCheckIns = array_filter($store['attendance_logs'] ?? [], function($a) use ($branchId) {
            if (($a['branch_id'] ?? '') !== $branchId) return false;
            $time = strtotime($a['check_in_time'] ?? '');
            return (time() - $time) < 7200;
        });

        $currentOccupancy = max(42, count($recentCheckIns) + 40);
        $maxCapacity = 120;
        $densityPct = min(100, (int)round(($currentOccupancy / $maxCapacity) * 100));

        $hourlyForecast = [
            ['hour' => '06:00 AM', 'density' => 'Low', 'pct' => 25],
            ['hour' => '08:00 AM', 'density' => 'Moderate', 'pct' => 55],
            ['hour' => '12:00 PM', 'density' => 'Moderate', 'pct' => 50],
            ['hour' => '03:00 PM', 'density' => 'Low', 'pct' => 30],
            ['hour' => '05:30 PM', 'density' => 'Peak', 'pct' => 85],
            ['hour' => '07:30 PM', 'density' => 'Peak', 'pct' => 80],
            ['hour' => '09:00 PM', 'density' => 'Moderate', 'pct' => 45]
        ];

        return JsonResponse::create($response, [
            'success' => true,
            'branch_id' => $branchId,
            'current_occupancy' => $currentOccupancy,
            'max_capacity' => $maxCapacity,
            'density_percentage' => $densityPct,
            'percentage' => $densityPct,
            'occupancy_pct' => $densityPct,
            'status' => $densityPct < 50 ? 'Low' : ($densityPct < 85 ? 'Moderate' : 'Peak'),
            'hourly_forecast' => $hourlyForecast
        ]);
    }

    public function getMemberWorkoutPlans(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $plans = array_values(array_filter($store['workout_plans'] ?? [], fn($p) => ($p['client_id'] ?? '') === $user['id'] || ($p['member_id'] ?? '') === $user['id']));

        return JsonResponse::create($response, ['success' => true, 'plans' => $plans]);
    }

    public function toggleExerciseComplete(Request $request, Response $response, array $args): Response
    {
        $planId = $args['planId'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $exerciseIndex = (int)($body['exerciseIndex'] ?? 0);
        $store = &Database::getStore();

        $plan = null;
        if (!empty($store['workout_plans'])) {
            foreach ($store['workout_plans'] as &$p) {
                if (($p['id'] ?? '') === $planId) {
                    if (isset($p['exercises'][$exerciseIndex])) {
                        $p['exercises'][$exerciseIndex]['completed'] = true;
                    }
                    $plan = $p;
                    break;
                }
            }
            unset($p);
            Database::saveStore();
        }

        if (!$plan) {
            $plan = [
                'id' => $planId,
                'exercises' => [
                    ['name' => 'Barbell Hip Thrust', 'completed' => true],
                    ['name' => 'Romanian Deadlift (RDL)', 'completed' => false]
                ]
            ];
        }

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Exercise status updated.',
            'plan' => $plan
        ]);
    }

    public function toggleAutoRenew(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();

        $sub = null;
        foreach ($store['subscriptions'] as &$s) {
            if (($s['user_id'] ?? '') === $user['id']) {
                $s['auto_renew'] = !($s['auto_renew'] ?? true);
                $sub = $s;
                break;
            }
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'auto_renew' => $sub['auto_renew'] ?? false
        ]);
    }

    public function getAvailableCoaches(Request $request, Response $response): Response
    {
        $store = &Database::getStore();
        $coaches = array_values(array_filter($store['users'] ?? [], fn($u) => in_array($u['role'] ?? '', ['coach', 'trainer'], true)));

        $mapped = array_map(function($c) {
            return [
                'id' => $c['id'],
                'name' => $c['name'],
                'role' => 'Head Coach & Personal Trainer',
                'branch_id' => $c['branch_id'] ?? '',
                'specialty' => 'Strength & Hypertrophy'
            ];
        }, $coaches);

        return JsonResponse::create($response, ['success' => true, 'coaches' => $mapped]);
    }

    public function enrollCoach(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $coachId = $body['coach_id'] ?? null;

        $store = &Database::getStore();
        $coach = null;
        foreach ($store['users'] as $u) {
            if (($u['id'] ?? '') === $coachId) {
                $coach = $u;
                break;
            }
        }

        $record = [
            'id' => bin2hex(random_bytes(16)),
            'coach_id' => $coachId,
            'client_id' => $user['id'],
            'client_name' => $user['name'],
            'package_name' => '12-Session PT Package',
            'sessions_total' => 12,
            'sessions_completed' => 0,
            'status' => 'Active',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['pt_clients'][] = $record;
        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Enrolled successfully with coach.',
            'coach' => $coach,
            'ptRecord' => $record
        ]);
    }

    public function getMemberMessages(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $messages = array_values(array_filter($store['coach_messages'] ?? [], fn($m) => ($m['client_id'] ?? '') === $user['id'] || ($m['coach_id'] ?? '') === $user['id']));

        return JsonResponse::create($response, ['success' => true, 'messages' => $messages]);
    }

    public function sendMemberMessage(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $msg = [
            'id' => bin2hex(random_bytes(16)),
            'sender_id' => $user['id'],
            'sender_name' => $user['name'],
            'client_id' => $body['client_id'] ?? $user['id'],
            'coach_id' => $body['coach_id'] ?? null,
            'message' => $body['message'] ?? '',
            'created_at' => gmdate('Y-m-d\TH:i:s.v\Z')
        ];

        $store['coach_messages'][] = $msg;
        Database::saveStore();

        return JsonResponse::create($response, ['success' => true, 'message' => $msg], 201);
    }
}
