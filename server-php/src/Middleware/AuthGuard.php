<?php

namespace Ksyn\Middleware;

use Ksyn\Config\Database;
use Ksyn\Config\Secrets;
use Ksyn\Utils\JsonResponse;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class AuthGuard implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        $token = null;
        $authHeader = $request->getHeaderLine('Authorization');

        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
        } else {
            $cookies = $request->getCookieParams();
            $token = $cookies['ksyn_token'] ?? $cookies['token'] ?? null;
        }

        if (!$token) {
            return JsonResponse::error(
                new SlimResponse(),
                'UNAUTHORIZED',
                'Access denied. Missing Authorization header or security session cookie.',
                401
            );
        }

        try {
            $decoded = JWT::decode($token, new Key(Secrets::getJwtSecret(), 'HS256'));
            $decodedArray = (array)$decoded;
        } catch (\Throwable $e) {
            return JsonResponse::error(
                new SlimResponse(),
                'TOKEN_INVALID_OR_EXPIRED',
                'Security token has expired or signature verification failed.',
                401
            );
        }

        $store = &Database::getStore();
        $revokedTokens = $store['revoked_tokens'] ?? [];
        if (in_array($token, $revokedTokens, true)) {
            return JsonResponse::error(
                new SlimResponse(),
                'TOKEN_REVOKED',
                'Security session has been terminated. Please log in again.',
                401
            );
        }

        $userId = $decodedArray['id'] ?? null;
        $users = $store['users'] ?? [];
        $user = null;
        foreach ($users as $u) {
            if (($u['id'] ?? '') === $userId) {
                $user = $u;
                break;
            }
        }

        if (!$user) {
            return JsonResponse::error(
                new SlimResponse(),
                'USER_NOT_FOUND',
                'Associated user account could not be found.',
                401
            );
        }

        $status = $user['status'] ?? 'active';
        if ($status === 'suspended' || $status === 'banned' || $status === 'inactive') {
            return JsonResponse::error(
                new SlimResponse(),
                'ACCOUNT_SUSPENDED',
                'Your account has been deactivated or suspended by gym management.',
                403
            );
        }

        $userInfo = [
            'id' => $user['id'],
            'role' => $user['role'],
            'branch_id' => $user['branch_id'] ?? null,
            'email' => $user['email'],
            'name' => $user['name'],
            'status' => $user['status'] ?? 'active'
        ];

        $context = [
            'userId' => $user['id'],
            'role' => $user['role'],
            'branchId' => $user['branch_id'] ?? null
        ];

        $request = $request
            ->withAttribute('user', $userInfo)
            ->withAttribute('context', $context)
            ->withAttribute('token', $token);

        return $handler->handle($request);
    }
}
