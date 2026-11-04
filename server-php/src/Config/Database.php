<?php

namespace Ksyn\Config;

use PDO;
use PDOException;

class Database
{
    private static ?array $memoryStore = null;
    private static ?PDO $pdo = null;
    private static bool $usePostgres = false;
    private static string $dataDir;
    private static string $storeFile;
    private static string $liveStoreFile;
    private static bool $isTestMode = false;

    public static function init(): void
    {
        self::$dataDir = realpath(__DIR__ . '/../../../../data') ?: (__DIR__ . '/../../../data');
        self::$liveStoreFile = self::$dataDir . DIRECTORY_SEPARATOR . 'ksyn_store.json';

        $env = $_ENV['APP_ENV'] ?? $_ENV['NODE_ENV'] ?? 'development';
        self::$isTestMode = ($env === 'test' || ($_ENV['ISOLATE_TEST_STORE'] ?? '') === 'true');
        self::$storeFile = self::$isTestMode
            ? self::$dataDir . DIRECTORY_SEPARATOR . 'ksyn_test_store.json'
            : self::$liveStoreFile;

        self::loadPersistentStore();
        self::initDatabaseConnection();
    }

    public static function isPostgres(): bool
    {
        return self::$usePostgres && self::$pdo !== null;
    }

    public static function getPdo(): ?PDO
    {
        return self::$pdo;
    }

    private static function initDatabaseConnection(): void
    {
        $dbUrl = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL');
        if (!$dbUrl) {
            self::$usePostgres = false;
            return;
        }

        try {
            $parsed = parse_url($dbUrl);
            if (!$parsed || !isset($parsed['host'])) {
                self::$usePostgres = false;
                return;
            }

            $host = $parsed['host'];
            $port = $parsed['port'] ?? 5432;
            $user = $parsed['user'] ?? 'postgres';
            $pass = $parsed['pass'] ?? '';
            $dbname = ltrim($parsed['path'] ?? 'ksyn_db', '/');

            $dsn = "pgsql:host={$host};port={$port};dbname={$dbname};timeout=3";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 3
            ]);

            $pdo->query("SELECT 1");
            self::$pdo = $pdo;
            self::$usePostgres = true;
        } catch (PDOException $e) {
            self::$usePostgres = false;
            self::$pdo = null;
        }
    }

    public static function loadPersistentStore(): void
    {
        if (!is_dir(self::$dataDir)) {
            @mkdir(self::$dataDir, 0777, true);
        }

        if (self::$isTestMode && !file_exists(self::$storeFile) && file_exists(self::$liveStoreFile)) {
            @copy(self::$liveStoreFile, self::$storeFile);
        }

        if (file_exists(self::$storeFile)) {
            $raw = file_get_contents(self::$storeFile);
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                self::$memoryStore = $decoded;
            } else {
                self::$memoryStore = [];
            }
        } else {
            self::$memoryStore = [];
            self::saveStore();
        }

        // Ensure key array structures exist
        $defaults = [
            'branches', 'users', 'subscriptions', 'attendance_logs', 'inventory', 'sales',
            'audit_logs', 'franchise_applications', 'inventory_restock_requests', 'notifications',
            'otp_verifications', 'free_pass_applications', 'pt_clients', 'pt_sessions',
            'strength_prs', 'coach_messages', 'incidents', 'remittances', 'capex_assets',
            'revoked_tokens', 'login_attempts', 'refresh_tokens', 'workout_plans',
            'payment_methods', 'payment_invoices', 'pos_shifts', 'x_readings', 'z_readings',
            'fitness_progress', 'sms_audit_logs', 'coach_payslips', 'payroll_batch_runs',
            'equipment_registry', 'maintenance_work_orders', 'equipment_iot_telemetry',
            'classes', 'branch_classes', 'staff_shifts', 'broadcasts', 'rate_cards',
            'promo_codes', 'vip_lockers', 'petty_expenses', 'client_nutrition', 'announcements'
        ];

        foreach ($defaults as $col) {
            if (!isset(self::$memoryStore[$col]) || !is_array(self::$memoryStore[$col])) {
                self::$memoryStore[$col] = [];
            }
        }
    }

    public static function saveStore(): void
    {
        if (self::$memoryStore === null) {
            return;
        }

        if (!is_dir(self::$dataDir)) {
            @mkdir(self::$dataDir, 0777, true);
        }

        $encoded = json_encode(self::$memoryStore, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return;
        }

        $fp = @fopen(self::$storeFile, 'c+');
        if ($fp) {
            if (flock($fp, LOCK_EX)) {
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, $encoded);
                fflush($fp);
                flock($fp, LOCK_UN);
                fclose($fp);
            } else {
                fclose($fp);
            }
        }
    }

    public static function &getStore(): array
    {
        if (self::$memoryStore === null) {
            self::init();
        }
        return self::$memoryStore;
    }

    public static function &getMemoryStore(): array
    {
        return self::getStore();
    }

    public static function &getCollection(string $name): array
    {
        $store = &self::getStore();
        if (!isset($store[$name]) || !is_array($store[$name])) {
            $store[$name] = [];
        }
        return $store[$name];
    }

    public static function query(string $text, array $params = [], ?array $context = null): array
    {
        if (self::isPostgres() && self::$pdo !== null) {
            try {
                if ($context !== null) {
                    self::$pdo->beginTransaction();
                    if (!empty($context['userId'])) {
                        $stmt = self::$pdo->prepare("SET LOCAL app.current_user_id = :userId");
                        $stmt->execute(['userId' => $context['userId']]);
                    }
                    if (!empty($context['role'])) {
                        $stmt = self::$pdo->prepare("SET LOCAL app.current_role = :role");
                        $stmt->execute(['role' => $context['role']]);
                    }
                    if (!empty($context['branchId'])) {
                        $stmt = self::$pdo->prepare("SET LOCAL app.current_branch_id = :branchId");
                        $stmt->execute(['branchId' => $context['branchId']]);
                    }
                }

                // Convert Node-style $1, $2, ... to PDO ? placeholders
                $convertedSql = preg_replace('/\$\d+/', '?', $text);
                $stmt = self::$pdo->prepare($convertedSql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if ($context !== null && self::$pdo->inTransaction()) {
                    self::$pdo->commit();
                }

                return ['rows' => $rows, 'rowCount' => count($rows)];
            } catch (\Throwable $e) {
                if ($context !== null && self::$pdo->inTransaction()) {
                    self::$pdo->rollBack();
                }
                throw $e;
            }
        }

        // In-memory fallback
        return self::executeMemoryStore($text, $params, $context);
    }

    private static function executeMemoryStore(string $text, array $params = [], ?array $context = null): array
    {
        $clean = trim($text);
        $upper = strtoupper($clean);
        $store = &self::getStore();

        // Branches query
        if (str_starts_with($upper, 'SELECT') && stripos($clean, 'from branches') !== false) {
            $rows = $store['branches'] ?? [];
            if (str_contains($clean, 'WHERE id = $1') && count($params) > 0) {
                $rows = array_values(array_filter($rows, fn($b) => ($b['id'] ?? '') === $params[0]));
            }
            return ['rows' => $rows, 'rowCount' => count($rows)];
        }

        // Users query
        if (str_starts_with($upper, 'SELECT') && stripos($clean, 'from users') !== false) {
            $rows = $store['users'] ?? [];
            if ($context && ($context['role'] ?? '') !== 'super_admin' && !empty($context['branchId'])) {
                $bId = $context['branchId'];
                $uId = $context['userId'] ?? '';
                $rows = array_values(array_filter($rows, fn($u) => ($u['branch_id'] ?? '') === $bId || ($u['id'] ?? '') === $uId));
            }
            if (str_contains($clean, 'WHERE email = $1') && count($params) > 0) {
                $target = strtolower($params[0]);
                $rows = array_values(array_filter($rows, fn($u) => strtolower($u['email'] ?? '') === $target));
            } elseif (str_contains($clean, 'WHERE id = $1') && count($params) > 0) {
                $rows = array_values(array_filter($rows, fn($u) => ($u['id'] ?? '') === $params[0]));
            } elseif (str_contains($clean, 'WHERE branch_id = $1') && count($params) > 0) {
                $rows = array_values(array_filter($rows, fn($u) => ($u['branch_id'] ?? '') === $params[0]));
            }
            return ['rows' => $rows, 'rowCount' => count($rows)];
        }

        return ['rows' => [], 'rowCount' => 0];
    }
}
