<?php

namespace Ksyn\Config;

class Secrets
{
    private static ?string $jwtSecret = null;
    private static ?string $refreshTokenSecret = null;
    private static ?string $qrHmacSecret = null;
    private static ?string $paymentWebhookSecret = null;
    private static ?bool $isProd = null;

    public static function isProd(): bool
    {
        if (self::$isProd === null) {
            $env = $_ENV['APP_ENV'] ?? $_ENV['NODE_ENV'] ?? 'development';
            self::$isProd = ($env === 'production');
        }
        return self::$isProd;
    }

    private static function getOrGenerateSecret(string $envVar, string $defaultEntropyHint, int $requiredMinLength = 32): string
    {
        $val = $_ENV[$envVar] ?? getenv($envVar) ?: null;
        $isProd = self::isProd();

        if ($val !== null && strlen(trim($val)) >= $requiredMinLength) {
            if ($isProd && (str_contains($val, 'ultra_secure_key') || str_contains($val, 'secret_key') || str_contains($val, 'fallback'))) {
                throw new \RuntimeException("[CRITICAL SECURITY ERROR] Insecure or default {$envVar} detected in production! You must supply a high-entropy secret.");
            }
            return trim($val);
        }

        if ($isProd) {
            throw new \RuntimeException("[CRITICAL SECURITY ERROR] {$envVar} must be set in production with at least {$requiredMinLength} characters.");
        }

        return ($val !== null && strlen(trim($val)) > 0)
            ? trim($val)
            : "dev_{$defaultEntropyHint}_" . bin2hex(random_bytes(24));
    }

    public static function getJwtSecret(): string
    {
        if (self::$jwtSecret === null) {
            self::$jwtSecret = self::getOrGenerateSecret('JWT_SECRET', 'jwt', 16);
        }
        return self::$jwtSecret;
    }

    public static function getRefreshTokenSecret(): string
    {
        if (self::$refreshTokenSecret === null) {
            self::$refreshTokenSecret = self::getOrGenerateSecret('REFRESH_TOKEN_SECRET', 'refresh', 16);
        }
        return self::$refreshTokenSecret;
    }

    public static function getQrHmacSecret(): string
    {
        if (self::$qrHmacSecret === null) {
            self::$qrHmacSecret = self::getOrGenerateSecret('QR_HMAC_SECRET', 'qr_hmac', 16);
        }
        return self::$qrHmacSecret;
    }

    public static function getPaymentWebhookSecret(): string
    {
        if (self::$paymentWebhookSecret === null) {
            self::$paymentWebhookSecret = self::getOrGenerateSecret('PAYMENT_WEBHOOK_SECRET', 'webhook', 16);
        }
        return self::$paymentWebhookSecret;
    }

    public static function getQrSecret(): string
    {
        return self::getQrHmacSecret();
    }
}
