<?php

namespace Ksyn\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class CorsMiddleware implements MiddlewareInterface
{
    private array $allowedOrigins = [
        'http://localhost:5080',
        'http://127.0.0.1:5080',
        'http://localhost:5180',
        'http://127.0.0.1:5180'
    ];

    public function __construct()
    {
        $customOrigin = $_ENV['CORS_ORIGIN'] ?? getenv('CORS_ORIGIN');
        if ($customOrigin && !in_array($customOrigin, $this->allowedOrigins, true)) {
            $this->allowedOrigins[] = $customOrigin;
        }
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $origin = $request->getHeaderLine('Origin');

        // Preflight OPTIONS handling
        if ($request->getMethod() === 'OPTIONS') {
            $response = new SlimResponse();
            return $this->attachCorsHeaders($response, $origin)->withStatus(204);
        }

        $response = $handler->handle($request);
        return $this->attachCorsHeaders($response, $origin);
    }

    private function attachCorsHeaders(Response $response, string $origin): Response
    {
        $allowOrigin = '';
        if (!$origin || in_array($origin, $this->allowedOrigins, true)) {
            $allowOrigin = $origin ?: '*';
        }

        if ($allowOrigin) {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, x-terminal-key');
        }

        return $response;
    }
}
