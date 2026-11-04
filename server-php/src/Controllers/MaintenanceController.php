<?php

namespace Ksyn\Controllers;

use Ksyn\Config\Database;
use Ksyn\Middleware\AuditLogger;
use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MaintenanceController
{
    private static function initMaintenanceStore(): void
    {
        $store = &Database::getStore();
        if (empty($store['equipment_registry'])) {
            $store['equipment_registry'] = [
                [
                    'id' => 'eq-mkt-tm01',
                    'branch_id' => 'b-mkt-01',
                    'name' => 'Life Fitness Elevation Series Treadmill (Zone 1)',
                    'category' => 'cardio',
                    'model' => 'Elevation SE3 HD',
                    'serial_number' => 'LF-TM-2026-0041',
                    'installed_date' => '2026-01-01',
                    'operating_hours_total' => 485,
                    'hours_since_last_service' => 485,
                    'hours_interval_threshold' => 500,
                    'days_interval_threshold' => 180,
                    'last_serviced_at' => '2026-01-01T00:00:00Z',
                    'maintenance_type' => 'Usage Hours (Motor & Deck Lubrication)',
                    'assigned_technician' => 'FitSupplyGym Engineering Team',
                    'status' => 'warning',
                    'checklist' => [
                        'Lubricate phenolic deck with 100% silicone emulsion',
                        'Inspect drive belt tension and motor commutator brushes',
                        'Calibrate optical speed sensor and elevation motor potentiometer',
                        'Vacuum motor compartment dust buildup'
                    ]
                ],
                [
                    'id' => 'eq-mkt-dap02',
                    'branch_id' => 'b-mkt-01',
                    'name' => 'Hammer Strength Dual Adjustable Pulley (Cable Station A)',
                    'category' => 'strength_cables',
                    'model' => 'Select DAP-800',
                    'serial_number' => 'HS-DAP-2025-1102',
                    'installed_date' => '2026-01-01',
                    'operating_hours_total' => 1200,
                    'hours_since_last_service' => 0,
                    'hours_interval_threshold' => null,
                    'days_interval_threshold' => 90,
                    'last_serviced_at' => '2026-01-10T00:00:00Z',
                    'maintenance_type' => 'Calendar Days (High-Tensile Cable & Bearing Inspection)',
                    'assigned_technician' => 'Technician Rolando Reyes',
                    'status' => 'critical',
                    'checklist' => [
                        'Inspect 7x19 mil-spec aircraft cable for fraying, kink or outer nylon stripping',
                        'Check cable termination fittings and weight stack pin insertion',
                        'Grease sealed ball bearing pulleys with synthetic PTFE grease',
                        'Verify smooth guide rod travel with non-grease silicone lubricant'
                    ]
                ],
                [
                    'id' => 'eq-mkt-row03',
                    'branch_id' => 'b-mkt-01',
                    'name' => 'Concept2 RowErg PM5 (Cardio Loft)',
                    'category' => 'cardio',
                    'model' => 'RowErg Model D',
                    'serial_number' => 'C2-ROW-2026-8819',
                    'installed_date' => '2026-01-01',
                    'operating_hours_total' => 210,
                    'hours_since_last_service' => 210,
                    'hours_interval_threshold' => 250,
                    'days_interval_threshold' => 90,
                    'last_serviced_at' => '2026-01-01T00:00:00Z',
                    'maintenance_type' => 'Usage Hours (Nickel-Plated Chain Oiling)',
                    'assigned_technician' => 'FitSupplyGym Engineering Team',
                    'status' => 'optimal',
                    'checklist' => [
                        'Apply 20W non-detergent oil along full length of drive chain',
                        'Check shock cord tension and return mechanism',
                        'Clean monorail stainless steel track with damp cloth',
                        'Update PM5 firmware and verify optical flywheel tachometer'
                    ]
                ],
                [
                    'id' => 'eq-mkt-pr04',
                    'branch_id' => 'b-mkt-01',
                    'name' => 'Eleiko IPF Power Rack & Olympic Platform (Plates Area)',
                    'category' => 'free_weights',
                    'model' => 'Eleiko Prestera Power Rack',
                    'serial_number' => 'EL-PR-2026-0012',
                    'installed_date' => '2026-01-01',
                    'operating_hours_total' => 0,
                    'hours_since_last_service' => 0,
                    'hours_interval_threshold' => null,
                    'days_interval_threshold' => 60,
                    'last_serviced_at' => '2026-09-01T00:00:00Z',
                    'maintenance_type' => 'Calendar Days (Anchor Bolt Torque & Structural Rigidity)',
                    'assigned_technician' => 'Facility Operations Lead',
                    'status' => 'optimal',
                    'checklist' => [
                        'Torque frame anchor bolts and cross-members to 85 Nm',
                        'Inspect magnetic J-Cup polyurethane wear liners',
                        'Check band pegs, safety strap pins, and pull-up knurling',
                        'Inspect oak drop platform surface for splintering or delamination'
                    ]
                ]
            ];
            Database::saveStore();
        }

        if (empty($store['maintenance_work_orders'])) {
            $store['maintenance_work_orders'] = [
                [
                    'id' => 'wo-2026-001',
                    'equipment_id' => 'eq-mkt-dap02',
                    'equipment_name' => 'Hammer Strength Dual Adjustable Pulley (Cable Station A)',
                    'branch_id' => 'b-mkt-01',
                    'priority' => 'CRITICAL',
                    'status' => 'Dispatched',
                    'trigger_reason' => '90-Day Periodic Cable Tension & Bearing Inspection Overdue',
                    'assigned_technician' => 'Technician Rolando Reyes (FitSupplyGym Certified)',
                    'estimated_downtime_hours' => 1.5,
                    'scheduled_for' => date('c', time() + 86400),
                    'created_at' => date('c', time() - 86400 * 2),
                    'checklist_progress' => [
                        ['task' => 'Inspect 7x19 aircraft cable for fraying or sleeve separation', 'done' => true],
                        ['task' => 'Check weight stack selector pin and magnetic lock', 'done' => true],
                        ['task' => 'Lubricate sealed ball bearing pulleys', 'done' => false],
                        ['task' => 'Verify smooth guide rod travel', 'done' => false]
                    ]
                ]
            ];
            Database::saveStore();
        }
    }

    public function getEquipmentRegistry(Request $request, Response $response): Response
    {
        self::initMaintenanceStore();
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $registry = $store['equipment_registry'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin' && !empty($user['branch_id'])) {
            $userBranchId = $user['branch_id'];
            $registry = array_values(array_filter($registry, fn($e) => empty($e['branch_id']) || ($e['branch_id'] === $userBranchId)));
        }

        $now = time();
        $enriched = array_map(function ($eq) use ($now, $store) {
            $lastServiced = !empty($eq['last_serviced_at']) ? strtotime($eq['last_serviced_at']) : ($now - 90 * 86400);
            $daysSince = max(0, (int)floor(($now - $lastServiced) / 86400));

            $hoursPct = 0;
            if (!empty($eq['hours_interval_threshold'])) {
                $hoursPct = min(100, (int)round(($eq['hours_since_last_service'] / $eq['hours_interval_threshold']) * 100));
            }

            $daysPct = 0;
            if (!empty($eq['days_interval_threshold'])) {
                $daysPct = min(100, (int)round(($daysSince / $eq['days_interval_threshold']) * 100));
            }

            $dynamicStatus = 'optimal';
            if ($hoursPct >= 100 || $daysPct >= 100) {
                $dynamicStatus = 'critical';
            } elseif ($hoursPct >= 85 || $daysPct >= 85) {
                $dynamicStatus = 'warning';
            }

            $activeWorkOrder = null;
            foreach ($store['maintenance_work_orders'] ?? [] as $wo) {
                if (($wo['equipment_id'] ?? '') === ($eq['id'] ?? '') && ($wo['status'] ?? '') !== 'Completed') {
                    $activeWorkOrder = $wo;
                    break;
                }
            }

            return array_merge($eq, [
                'days_since_last_service' => $daysSince,
                'hours_utilization_percent' => $hoursPct,
                'days_utilization_percent' => $daysPct,
                'status' => $dynamicStatus,
                'active_work_order' => $activeWorkOrder
            ]);
        }, $registry);

        return JsonResponse::create($response, [
            'success' => true,
            'count' => count($enriched),
            'equipment' => $enriched,
            'schedules' => $enriched
        ]);
    }

    public function recordIoTTelemetry(Request $request, Response $response): Response
    {
        self::initMaintenanceStore();
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $equipmentId = $body['equipment_id'] ?? '';
        if (!$equipmentId) {
            return JsonResponse::error($response, 'EQUIPMENT_ID_REQUIRED', 'Equipment ID is required.', 400);
        }

        $eqIndex = -1;
        foreach ($store['equipment_registry'] as $idx => $e) {
            if (($e['id'] ?? '') === $equipmentId) {
                $eqIndex = $idx;
                break;
            }
        }

        if ($eqIndex === -1) {
            return JsonResponse::error($response, 'EQUIPMENT_NOT_FOUND', 'Equipment item not found in registry.', 404);
        }

        $eq = &$store['equipment_registry'][$eqIndex];
        $addedHours = (float)($body['runtime_hours_added'] ?? 0);

        if (isset($body['total_hours'])) {
            $eq['operating_hours_total'] = (float)$body['total_hours'];
        } else {
            $eq['operating_hours_total'] = (float)($eq['operating_hours_total'] ?? 0) + $addedHours;
        }
        $eq['hours_since_last_service'] = (float)($eq['hours_since_last_service'] ?? 0) + $addedHours;

        $logEntry = [
            'id' => 'iot-' . (int)(microtime(true) * 1000),
            'equipment_id' => $equipmentId,
            'equipment_name' => $eq['name'] ?? 'Equipment',
            'gateway' => $body['device_gateway_id'] ?? 'GW-MKT-IOT-01',
            'runtime_hours_added' => $addedHours,
            'operating_hours_total' => $eq['operating_hours_total'],
            'hours_since_last_service' => $eq['hours_since_last_service'],
            'vibration_index_mms' => (float)($body['vibration_index_mms'] ?? 1.2),
            'motor_temperature_celsius' => (float)($body['motor_temperature_celsius'] ?? 42.5),
            'recorded_at' => date('c')
        ];

        if (!isset($store['equipment_iot_telemetry'])) {
            $store['equipment_iot_telemetry'] = [];
        }
        array_unshift($store['equipment_iot_telemetry'], $logEntry);

        // Check if threshold breached
        $autoDispatched = false;
        $workOrder = null;

        if (!empty($eq['hours_interval_threshold']) && $eq['hours_since_last_service'] >= $eq['hours_interval_threshold']) {
            $existingWo = null;
            foreach ($store['maintenance_work_orders'] ?? [] as $w) {
                if (($w['equipment_id'] ?? '') === $eq['id'] && ($w['status'] ?? '') !== 'Completed') {
                    $existingWo = $w;
                    break;
                }
            }

            if (!$existingWo) {
                $workOrder = [
                    'id' => 'wo-auto-' . substr(bin2hex(random_bytes(3)), 0, 6),
                    'equipment_id' => $eq['id'],
                    'equipment_name' => $eq['name'],
                    'branch_id' => $eq['branch_id'] ?? 'b-mkt-01',
                    'priority' => 'CRITICAL',
                    'status' => 'Dispatched',
                    'trigger_reason' => "Automated IoT Alert: Motor runtime threshold reached ({$eq['hours_since_last_service']}h / {$eq['hours_interval_threshold']}h limit)",
                    'assigned_technician' => $eq['assigned_technician'] ?? 'FitSupplyGym Engineering Team',
                    'estimated_downtime_hours' => 2.0,
                    'scheduled_for' => date('c', time() + 86400),
                    'created_at' => date('c'),
                    'checklist_progress' => array_map(fn($t) => ['task' => $t, 'done' => false], $eq['checklist'] ?? [])
                ];

                if (!isset($store['maintenance_work_orders'])) {
                    $store['maintenance_work_orders'] = [];
                }
                array_unshift($store['maintenance_work_orders'], $workOrder);
                $autoDispatched = true;

                AuditLogger::logAuditEvent([
                    'branch_id' => $eq['branch_id'] ?? 'b-mkt-01',
                    'user_id' => $user['id'] ?? 'iot-gateway',
                    'user_role' => 'system',
                    'action' => 'EQUIPMENT_MAINTENANCE_AUTO_DISPATCH',
                    'resource' => "WORK_ORDER:{$workOrder['id']}",
                    'details' => [
                        'equipment' => $eq['name'],
                        'hours' => $eq['hours_since_last_service'],
                        'threshold' => $eq['hours_interval_threshold']
                    ]
                ]);
            }
        }

        Database::saveStore();

        return JsonResponse::create($response, [
            'success' => true,
            'message' => "IoT telemetry recorded for {$eq['name']}.",
            'telemetry' => $logEntry,
            'threshold_breached' => $autoDispatched,
            'automated_work_order' => $workOrder
        ], 201);
    }

    public function getWorkOrders(Request $request, Response $response): Response
    {
        self::initMaintenanceStore();
        $user = $request->getAttribute('user');
        $store = &Database::getStore();
        $orders = $store['maintenance_work_orders'] ?? [];

        if (($user['role'] ?? '') !== 'super_admin' && !empty($user['branch_id'])) {
            $userBranchId = $user['branch_id'];
            $orders = array_values(array_filter($orders, fn($o) => empty($o['branch_id']) || ($o['branch_id'] === $userBranchId)));
        }

        return JsonResponse::create($response, [
            'success' => true,
            'count' => count($orders),
            'work_orders' => $orders
        ]);
    }

    public function createWorkOrder(Request $request, Response $response): Response
    {
        self::initMaintenanceStore();
        $user = $request->getAttribute('user');
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $equipmentId = $body['equipment_id'] ?? '';
        $triggerReason = $body['trigger_reason'] ?? $body['reported_issue'] ?? '';
        if (!$equipmentId || !$triggerReason) {
            return JsonResponse::error($response, 'MISSING_FIELDS', 'Equipment ID and trigger reason are required.', 400);
        }

        $eq = null;
        foreach ($store['equipment_registry'] ?? [] as $e) {
            if (($e['id'] ?? '') === $equipmentId) {
                $eq = $e;
                break;
            }
        }

        $order = [
            'id' => 'wo-' . date('Y') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
            'branch_id' => $eq['branch_id'] ?? ($user['branch_id'] ?? 'b-mkt-01'),
            'equipment_id' => $equipmentId,
            'equipment_name' => $eq['name'] ?? 'Equipment',
            'priority' => $body['priority'] ?? 'HIGH',
            'status' => 'Dispatched',
            'trigger_reason' => $triggerReason,
            'assigned_technician' => $body['assigned_technician'] ?? ($eq['assigned_technician'] ?? 'Facility Operations Lead'),
            'estimated_downtime_hours' => 2.0,
            'scheduled_for' => date('c', time() + 86400),
            'created_at' => date('c'),
            'checklist_progress' => array_map(fn($t) => ['task' => $t, 'done' => false], $body['checklist'] ?? ($eq['checklist'] ?? []))
        ];

        if (!isset($store['maintenance_work_orders'])) {
            $store['maintenance_work_orders'] = [];
        }
        array_unshift($store['maintenance_work_orders'], $order);
        Database::saveStore();

        AuditLogger::logAuditEvent([
            'branch_id' => $order['branch_id'],
            'user_id' => $user['id'] ?? 'staff',
            'user_role' => $user['role'] ?? 'staff',
            'action' => 'WORK_ORDER_DISPATCHED',
            'resource' => "WORK_ORDER:{$order['id']}",
            'details' => ['equipment' => $order['equipment_name'], 'priority' => $order['priority']]
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'message' => "Work order dispatched to {$order['assigned_technician']}.",
            'work_order' => $order
        ], 201);
    }

    public function completeWorkOrder(Request $request, Response $response, array $args): Response
    {
        self::initMaintenanceStore();
        $user = $request->getAttribute('user');
        $id = $args['id'] ?? '';
        $body = (array)($request->getParsedBody() ?? []);
        $store = &Database::getStore();

        $orderIndex = -1;
        foreach ($store['maintenance_work_orders'] as $idx => $wo) {
            if (($wo['id'] ?? '') === $id) {
                $orderIndex = $idx;
                break;
            }
        }

        if ($orderIndex === -1) {
            return JsonResponse::error($response, 'WORK_ORDER_NOT_FOUND', 'Work order not found.', 404);
        }

        $order = &$store['maintenance_work_orders'][$orderIndex];
        $order['status'] = 'Completed';
        $order['completed_at'] = date('c');
        $order['technician_notes'] = trim($body['technician_notes'] ?? 'All preventive maintenance checks passed factory specifications.');
        $order['replaced_parts'] = is_array($body['replaced_parts'] ?? null) ? $body['replaced_parts'] : [];
        $order['signed_off_by'] = $user['name'] ?? 'Staff Technician';

        if (isset($order['checklist_progress']) && is_array($order['checklist_progress'])) {
            foreach ($order['checklist_progress'] as &$task) {
                $task['done'] = true;
            }
            unset($task);
        }

        // Reset operating hours counter on equipment
        if (!empty($order['equipment_id']) && !empty($store['equipment_registry'])) {
            foreach ($store['equipment_registry'] as &$eq) {
                if (($eq['id'] ?? '') === $order['equipment_id']) {
                    $eq['hours_since_last_service'] = 0;
                    $eq['last_serviced_at'] = date('c');
                    $eq['status'] = 'optimal';
                    break;
                }
            }
            unset($eq);
        }

        Database::saveStore();

        AuditLogger::logAuditEvent([
            'branch_id' => $order['branch_id'] ?? 'b-mkt-01',
            'user_id' => $user['id'] ?? 'staff',
            'user_role' => $user['role'] ?? 'staff',
            'action' => 'WORK_ORDER_COMPLETED',
            'resource' => "WORK_ORDER:{$order['id']}",
            'details' => ['equipment' => $order['equipment_name'] ?? 'Equipment']
        ]);

        return JsonResponse::create($response, [
            'success' => true,
            'message' => 'Work order signed off and completed.',
            'work_order' => $order,
            'equipment_status' => 'optimal'
        ]);
    }
}
