<?php

namespace Ksyn\Utils;

use Psr\Http\Message\ResponseInterface as Response;

class JsonResponse
{
    public static function create(Response $response, array $data, int $status = 200): Response
    {
        $payload = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $response->getBody()->write($payload !== false ? $payload : '{}');
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    public static function success(Response $response, array $data = [], int $status = 200): Response
    {
        $payload = array_merge(['success' => true], $data);
        return self::create($response, $payload, $status);
    }

    public static function error(Response $response, string $error, string $message, int $status = 400, array $extra = []): Response
    {
        $payload = array_merge([
            'success' => false,
            'error' => $error,
            'message' => $message
        ], $extra);
        return self::create($response, $payload, $status);
    }
}
