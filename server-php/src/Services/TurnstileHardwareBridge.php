<?php

namespace Ksyn\Services;

class TurnstileHardwareBridge
{
    private static ?array $lastRelayPulseEvent = null;

    public static function broadcastRelayPulse(array $params): array
    {
        $branchId = $params['branch_id'] ?? 'b-mkt-01';
        $memberName = $params['member_name'] ?? 'Member';
        $athleteId = $params['athlete_id'] ?? null;
        $durationMs = $params['duration_ms'] ?? 3000;
        $relayChannel = $params['relay_channel'] ?? 1;

        $pulsePacket = [
            'event' => 'RELAY_PULSE',
            'command' => 'PULSE_SOLENOID',
            'relay_channel' => $relayChannel,
            'duration_ms' => $durationMs,
            'branch_id' => $branchId,
            'athlete_name' => $memberName,
            'athlete_id' => $athleteId,
            'timestamp' => (int)(microtime(true) * 1000)
        ];

        self::$lastRelayPulseEvent = $pulsePacket;
        return ['delivered_controllers' => 1, 'packet' => $pulsePacket];
    }

    public static function getLastPulse(): ?array
    {
        return self::$lastRelayPulseEvent;
    }
}
