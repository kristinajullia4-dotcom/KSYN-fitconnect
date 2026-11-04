<?php

namespace Ksyn\Config;

class MembershipRates
{
    public const MEMBERSHIP_PLANS = [
        [
            'id' => '1_day',
            'name' => '1-Day Pass',
            'planFee' => 500,
            'accessFee' => 0,
            'annualFee' => 0,
            'totalDue' => 500,
            'durationDays' => 1,
            'tier' => 'basic'
        ],
        [
            'id' => '1_month',
            'name' => '1 Month Pass',
            'planFee' => 2600,
            'accessFee' => 1000,
            'annualFee' => 1000,
            'totalDue' => 4600,
            'durationDays' => 30,
            'tier' => 'basic'
        ],
        [
            'id' => '3_months',
            'name' => '3 Months Pass',
            'planFee' => 7500,
            'accessFee' => 1000,
            'annualFee' => 1000,
            'totalDue' => 9500,
            'durationDays' => 90,
            'tier' => 'pro'
        ],
        [
            'id' => '6_months',
            'name' => '6 Months Pass',
            'planFee' => 14400,
            'accessFee' => 1000,
            'annualFee' => 1000,
            'totalDue' => 16400,
            'durationDays' => 180,
            'tier' => 'pro'
        ],
        [
            'id' => '12_months',
            'name' => '12 Months Annual Elite',
            'planFee' => 27600,
            'accessFee' => 1000,
            'annualFee' => 0,
            'totalDue' => 28600,
            'durationDays' => 365,
            'tier' => 'elite'
        ]
    ];

    public static function resolvePlan(?string $planIdentifier): ?array
    {
        if (!$planIdentifier) {
            return null;
        }
        $str = strtolower(trim($planIdentifier));

        if ($str === '1_day' || str_contains($str, '1-day') || str_contains($str, 'trial') || $str === 'day') {
            return self::MEMBERSHIP_PLANS[0];
        }
        if ($str === '1_month' || str_contains($str, '1-month') || str_contains($str, '1 month')) {
            return self::MEMBERSHIP_PLANS[1];
        }
        if ($str === '3_months' || str_contains($str, '3-month') || str_contains($str, '3 month')) {
            return self::MEMBERSHIP_PLANS[2];
        }
        if ($str === '6_months' || str_contains($str, '6-month') || str_contains($str, '6 month')) {
            return self::MEMBERSHIP_PLANS[3];
        }
        if ($str === '12_months' || str_contains($str, '12-month') || str_contains($str, '12 month') || str_contains($str, 'annual') || str_contains($str, 'elite')) {
            return self::MEMBERSHIP_PLANS[4];
        }

        return null;
    }
}
