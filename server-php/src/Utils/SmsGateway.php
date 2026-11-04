<?php

namespace Ksyn\Utils;

use Ksyn\Config\Database;

class SmsGateway
{
    public static function sendSms(string $recipient, string $message, array $metadata = []): array
    {
        $cleanPhone = preg_replace('/[^0-9+]/', '', trim($recipient));
        $timestamp = gmdate('Y-m-d\TH:i:s.v\Z');
        $id = 'sms-' . (int)(microtime(true) * 1000) . '-' . substr(bin2hex(random_bytes(4)), 0, 4);

        $smsRecord = [
            'id' => $id,
            'recipient' => $cleanPhone,
            'message' => $message,
            'category' => $metadata['category'] ?? 'TRANSACTIONAL',
            'status' => 'delivered',
            'provider' => $_ENV['SMS_PROVIDER'] ?? 'Sandbox Simulated',
            'sent_at' => $timestamp,
            'metadata' => $metadata
        ];

        $store = &Database::getStore();
        if (!isset($store['sms_audit_logs']) || !is_array($store['sms_audit_logs'])) {
            $store['sms_audit_logs'] = [];
        }
        array_unshift($store['sms_audit_logs'], $smsRecord);
        Database::saveStore();

        return $smsRecord;
    }

    public static function sendAntiPassbackAlert(array $member, string $branchName): array
    {
        $firstName = explode(' ', $member['name'] ?? 'Member')[0];
        $msg = "SECURITY NOTICE: Hi {$firstName}, re-entry scan rejected at {$branchName}. Anti-passback 15-minute cooldown active.";
        return self::sendSms($member['phone'] ?? '', $msg, ['category' => 'SECURITY_ALERT']);
    }

    public static function sendTurnstileExpirationAlert(array $member): array
    {
        $firstName = explode(' ', $member['name'] ?? 'Member')[0];
        $msg = "KSYN ALERT: Hello {$firstName}, your membership subscription has expired. Turnstile access locked.";
        return self::sendSms($member['phone'] ?? '', $msg, ['category' => 'MEMBERSHIP_ALERT']);
    }
}
