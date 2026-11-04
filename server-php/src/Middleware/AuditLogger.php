<?php

namespace Ksyn\Middleware;

use Ksyn\Config\Database;

class AuditLogger
{
    public const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

    public static function computeAuditHash(
        string $prevHash,
        string $id,
        ?string $branchId,
        ?string $userId,
        string $action,
        string $resource,
        array $details,
        string $createdAtIso
    ): string {
        $bId = !empty($branchId) ? $branchId : 'GLOBAL';
        $uId = !empty($userId) ? $userId : 'SYS';
        $detailsJson = json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($detailsJson === false) {
            $detailsJson = '{}';
        }
        $payload = "{$prevHash}|{$id}|{$bId}|{$uId}|{$action}|{$resource}|{$detailsJson}|{$createdAtIso}";
        return hash('sha256', $payload);
    }

    public static function logAuditEvent(array $params): array
    {
        $store = &Database::getStore();
        if (!isset($store['audit_logs']) || !is_array($store['audit_logs'])) {
            $store['audit_logs'] = [];
        }

        $prevLog = !empty($store['audit_logs']) ? $store['audit_logs'][0] : null;
        $prevHash = $prevLog['hash'] ?? self::GENESIS_HASH;

        $id = bin2hex(random_bytes(16));
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        // JavaScript Date.toISOString() format: Y-m-d\TH:i:s.v\Z
        $createdAtIso = $now->format('Y-m-d\TH:i:s.v\Z');

        $branchId = $params['branch_id'] ?? null;
        $userId = $params['user_id'] ?? null;
        $userRole = $params['user_role'] ?? null;
        $action = $params['action'] ?? 'UNKNOWN_ACTION';
        $resource = $params['resource'] ?? 'SYSTEM';
        $ipAddress = $params['ip_address'] ?? '127.0.0.1';
        $details = $params['details'] ?? [];

        $hash = self::computeAuditHash(
            $prevHash,
            $id,
            $branchId,
            $userId,
            $action,
            $resource,
            $details,
            $createdAtIso
        );

        $event = [
            'id' => $id,
            'branch_id' => $branchId,
            'user_id' => $userId,
            'user_role' => $userRole,
            'action' => $action,
            'resource' => $resource,
            'ip_address' => $ipAddress,
            'details' => $details,
            'prev_hash' => $prevHash,
            'hash' => $hash,
            'created_at' => $createdAtIso
        ];

        // Prepend to audit_logs (newest first)
        array_unshift($store['audit_logs'], $event);
        Database::saveStore();

        return $event;
    }

    public static function verifyAuditChain(): array
    {
        $store = &Database::getStore();
        $logs = $store['audit_logs'] ?? [];

        if (empty($logs)) {
            return [
                'verified' => true,
                'count' => 0,
                'message' => 'Audit chain is pristine (empty).'
            ];
        }

        $chronological = array_reverse($logs);
        $expectedPrevHash = self::GENESIS_HASH;
        $tamperedRecords = [];

        foreach ($chronological as $index => $entry) {
            if (!empty($entry['prev_hash']) && $entry['prev_hash'] !== $expectedPrevHash) {
                $tamperedRecords[] = [
                    'index' => $index,
                    'id' => $entry['id'] ?? 'unknown',
                    'reason' => 'BROKEN_CHAIN_LINK',
                    'expected_prev_hash' => $expectedPrevHash,
                    'actual_prev_hash' => $entry['prev_hash']
                ];
            }
            $expectedPrevHash = $entry['hash'] ?? '';
        }

        return [
            'verified' => count($tamperedRecords) === 0,
            'total_blocks' => count($logs),
            'tampered_count' => count($tamperedRecords),
            'tampered_records' => $tamperedRecords,
            'latest_hash' => $logs[0]['hash'] ?? null
        ];
    }
}
