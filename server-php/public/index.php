<?php

declare(strict_types=1);

if (php_sapi_name() === 'cli-server') {
    $url = parse_url($_SERVER['REQUEST_URI']);
    $file = __DIR__ . ($url['path'] ?? '');
    if (is_file($file) && realpath($file) !== __FILE__) {
        return false;
    }
}

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Ksyn\Config\Database;
use Ksyn\Config\Secrets;
use Ksyn\Middleware\CorsMiddleware;
use Ksyn\Routes\ApiRoutes;
use Ksyn\Utils\JsonResponse;

// Load environment variables
$dotenv = Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

// Initialize persistent dual-store & RLS
Database::init();

$app = AppFactory::create();

// Parse request body JSON / form-urlencoded
$app->addBodyParsingMiddleware();

// Handle CORS
$app->add(new CorsMiddleware());

// Routing middleware
$app->addRoutingMiddleware();

// Preflight OPTIONS handler for all endpoints
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
    return $response->withStatus(200);
});

// -------------------------------------------------------------
// System Health & Diagnostics
// GET /api/health
// -------------------------------------------------------------
$app->get('/api/health', function (Request $request, Response $response): Response {
    $payload = [
        'status' => 'healthy',
        'platform' => 'KSYN FitConnect Enterprise',
        'version' => '1.0.0',
        'mode' => Database::isPostgres() ? 'Native PostgreSQL RLS' : 'Resilient Multi-Tenant Memory Store (RLS Emulated)',
        'timestamp' => date('c')
    ];
    $response->getBody()->write(json_encode($payload));
    return $response->withHeader('Content-Type', 'application/json');
});

// Helper for extracting optional authenticated user from Bearer token
$extractUser = function (Request $request): ?array {
    $authHeader = $request->getHeaderLine('Authorization');
    if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        try {
            $token = $matches[1];
            $decoded = (array)JWT::decode($token, new Key(Secrets::getJwtSecret(), 'HS256'));
            $userId = $decoded['id'] ?? '';
            $memory = &Database::getMemoryStore();
            foreach ($memory['users'] ?? [] as $u) {
                if (($u['id'] ?? '') === $userId) {
                    return $u;
                }
            }
        } catch (\Throwable $e) {
            // Expired or invalid token, treat as guest
        }
    }
    return null;
};

// Helper for branch map
$getBranchMap = function (): array {
    $branchMap = [
        'b1' => 'b-mkt-01', 'b2' => 'b-kat-02', 'b3' => 'b-alb-03', 'b4' => 'b-kap-04',
        'b5' => 'b-frv-05', 'b6' => 'b-del-06', 'b7' => 'b-tm-07',
        'MKT-01' => 'b-mkt-01', 'KAT-02' => 'b-kat-02', 'ALB-03' => 'b-alb-03', 'KAP-04' => 'b-kap-04',
        'FRV-05' => 'b-frv-05', 'DLM-06' => 'b-del-06', 'TMO-07' => 'b-tm-07',
        'b-mkt-01' => 'b-mkt-01', 'b-kat-02' => 'b-kat-02', 'b-alb-03' => 'b-alb-03', 'b-kap-04' => 'b-kap-04',
        'b-frv-05' => 'b-frv-05', 'b-del-06' => 'b-del-06', 'b-tm-07' => 'b-tm-07'
    ];
    $memory = &Database::getMemoryStore();
    foreach ($memory['branches'] ?? [] as $b) {
        if (!empty($b['id'])) $branchMap[$b['id']] = $b['id'];
        if (!empty($b['code'])) $branchMap[$b['code']] = $b['id'];
    }
    return $branchMap;
};

$filterAudience = function (array $item, ?array $user, array $branchMap): bool {
    if (empty($item['is_active'])) return false;
    $userRole = $user['role'] ?? 'guest';
    if ($userRole === 'super_admin') return true;

    $userBranchId = $user ? ($branchMap[$user['branch_id'] ?? ''] ?? ($user['branch_id'] ?? null)) : null;

    if (($item['created_by_role'] ?? '') === 'branch_admin') {
        $itemBranchId = $branchMap[$item['branch_id'] ?? ''] ?? ($item['branch_id'] ?? null);
        if (!$userBranchId || $userBranchId !== $itemBranchId) return false;
        $target = $item['target_audience'] ?? '';
        if ($target === 'branch_all') return true;
        if ($target === 'members_only' && $userRole === 'member') return true;
        if ($target === 'coaches_only' && in_array($userRole, ['coach', 'trainer'], true)) return true;
        if ($target === 'staff_only' && in_array($userRole, ['employee', 'staff', 'front_desk', 'cashier'], true)) return true;
        if ($userRole === 'branch_admin') return true;
        return false;
    }

    $aud = $item['target_audience'] ?? 'all';
    if ($aud === 'all') return true;
    if ($aud === 'branch_admins' && $userRole === 'branch_admin') return true;
    if (in_array($aud, ['branch_owners', 'investors'], true) && in_array($userRole, ['branch_owner', 'investor'], true)) return true;
    if ($aud === 'coaches' && in_array($userRole, ['coach', 'trainer'], true)) return true;
    if (in_array($aud, ['members_all', 'members'], true) && $userRole === 'member') return true;
    if ($aud === 'staff' && in_array($userRole, ['employee', 'staff', 'front_desk', 'cashier'], true)) return true;

    if (str_starts_with($aud, 'members_')) {
        $targetBranch = substr($aud, 8);
        $normTarget = $branchMap[$targetBranch] ?? $targetBranch;
        if ($userRole === 'member' && $userBranchId === $normTarget) return true;
        return false;
    }

    return false;
};

// -------------------------------------------------------------
// Global Active Broadcast Banner endpoint
// GET /api/broadcast/active
// -------------------------------------------------------------
$app->get('/api/broadcast/active', function (Request $request, Response $response) use ($extractUser, $getBranchMap, $filterAudience): Response {
    $user = $extractUser($request);
    $branchMap = $getBranchMap();

    $memory = &Database::getMemoryStore();
    if (!isset($memory['broadcasts'])) {
        $memory['broadcasts'] = $memory['announcements'] ?? [];
    }

    $eligible = array_values(array_filter($memory['broadcasts'], function ($item) use ($user, $branchMap, $filterAudience) {
        return $filterAudience($item, $user, $branchMap);
    }));

    return JsonResponse::success($response, [
        'broadcast' => $eligible[0] ?? null
    ]);
});

// -------------------------------------------------------------
// Universal Announcements & Promos endpoint
// GET /api/announcements
// -------------------------------------------------------------
$app->get('/api/announcements', function (Request $request, Response $response) use ($extractUser, $getBranchMap, $filterAudience): Response {
    $user = $extractUser($request);
    $branchMap = $getBranchMap();

    $memory = &Database::getMemoryStore();
    if (!isset($memory['announcements'])) {
        $memory['announcements'] = $memory['broadcasts'] ?? [];
    }

    $filtered = array_values(array_filter($memory['announcements'], function ($item) use ($user, $branchMap, $filterAudience) {
        return $filterAudience($item, $user, $branchMap);
    }));

    $promos = array_values(array_filter($filtered, fn($a) => ($a['type'] ?? '') === 'promo'));

    return JsonResponse::success($response, [
        'announcements' => $filtered,
        'promos' => $promos
    ]);
});

// Register all modular route groups
ApiRoutes::register($app);

// Global Error Handling & 404
$customErrorHandler = function (
    Request $request,
    \Throwable $exception,
    bool $displayErrorDetails,
    bool $logErrors,
    bool $logErrorDetails
) use ($app): Response {
    $response = $app->getResponseFactory()->createResponse();

    if ($exception instanceof \Slim\Exception\HttpNotFoundException) {
        $uri = $request->getUri()->getPath();
        $response->getBody()->write(json_encode([
            'success' => false,
            'error' => 'ROUTE_NOT_FOUND',
            'message' => "API endpoint '{$uri}' does not exist on this server."
        ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
    }

    if ($exception instanceof \Slim\Exception\HttpMethodNotAllowedException) {
        $response->getBody()->write(json_encode([
            'success' => false,
            'error' => 'METHOD_NOT_ALLOWED',
            'message' => 'The HTTP request method is not allowed for this route.'
        ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(405);
    }

    $response->getBody()->write(json_encode([
        'success' => false,
        'error' => 'INTERNAL_SERVER_ERROR',
        'message' => $exception->getMessage() ?: 'An unexpected error occurred processing your request.'
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    return $response->withHeader('Content-Type', 'application/json')->withStatus(500);
};

$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler($customErrorHandler);

$app->run();
