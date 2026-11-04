<?php

namespace Ksyn\Middleware;

use Ksyn\Utils\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class RbacGuard
{
    public static function roles(string ...$allowedRoles): callable
    {
        return function (Request $request, RequestHandler $handler) use ($allowedRoles): Response {
            $user = $request->getAttribute('user');
            if (!$user) {
                return JsonResponse::error(
                    new SlimResponse(),
                    'UNAUTHENTICATED',
                    'Authentication required before authorization verification.',
                    401
                );
            }

            $userRole = $user['role'] ?? '';
            $roleAliases = [
                'branch_owner' => ['branch_owner'],
                'branch_admin' => ['branch_admin'],
                'staff' => ['employee', 'staff'],
                'employee' => ['employee', 'staff'],
                'coach' => ['coach', 'trainer'],
                'trainer' => ['coach', 'trainer']
            ];

            $effectiveRoles = $roleAliases[$userRole] ?? [$userRole];
            $isAllowed = false;
            foreach ($allowedRoles as $allowed) {
                if (in_array($allowed, $effectiveRoles, true)) {
                    $isAllowed = true;
                    break;
                }
            }

            if (!$isAllowed) {
                return JsonResponse::error(
                    new SlimResponse(),
                    'FORBIDDEN_INSUFFICIENT_PRIVILEGES',
                    "Role '{$userRole}' does not possess required authorization credentials.",
                    403
                );
            }

            return $handler->handle($request);
        };
    }

    public static function enforceTenantIsolation(): callable
    {
        return function (Request $request, RequestHandler $handler): Response {
            $user = $request->getAttribute('user');
            if (!$user) {
                return $handler->handle($request);
            }

            if (($user['role'] ?? '') === 'super_admin') {
                return $handler->handle($request);
            }

            $queryParams = $request->getQueryParams();
            $body = (array)($request->getParsedBody() ?? []);
            $targetBranchId = $queryParams['branch_id'] ?? $body['branch_id'] ?? null;

            if ($targetBranchId && $targetBranchId !== ($user['branch_id'] ?? '')) {
                return JsonResponse::error(
                    new SlimResponse(),
                    'TENANT_ISOLATION_VIOLATION',
                    'Access Denied: Cross-tenant data operations are strictly prohibited by KSYN Security Policy.',
                    403
                );
            }

            return $handler->handle($request);
        };
    }
}
