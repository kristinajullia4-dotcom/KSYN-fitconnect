<?php

namespace Ksyn\Utils;

class Mailer
{
    public static function sendEmail(string $to, string $subject, string $htmlBody): bool
    {
        // Sandbox logging / development mailer
        error_log("[Mailer Simulated] To: {$to} | Subject: {$subject}");
        return true;
    }

    public static function sendOtpEmail(string $to, string $otpCode): bool
    {
        return self::sendEmail(
            $to,
            "KSYN FitConnect - Your One-Time Password (OTP): {$otpCode}",
            "<p>Your security verification code is: <strong>{$otpCode}</strong>. Valid for 10 minutes.</p>"
        );
    }

    public static function sendWelcomeEmail(string $to, string $name, string $tempPassword = ''): bool
    {
        return self::sendEmail(
            $to,
            "Welcome to KSYN FitConnect Enterprise!",
            "<p>Hi {$name}, your account has been successfully provisioned.</p>"
        );
    }
}
