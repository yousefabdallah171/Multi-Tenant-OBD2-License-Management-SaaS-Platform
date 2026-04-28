<?php

namespace App\Http\Middleware;

use App\Models\ApiLog;
use Closure;
use Illuminate\Http\Request;
use Throwable;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApiLogger
{
    private const MAX_LOGGED_RESPONSE_BYTES = 65536;

    /**
     * @var list<string>
     */
    private array $sensitiveKeys = [
        'password',
        'password_confirmation',
        'temporary_password',
        'token',
        'api_key',
        'external_api_key',
        'authorization',
        'current_password',
        'new_password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = microtime(true);
        $response = $next($request);

        try {
            ApiLog::create([
                'tenant_id' => $request->user()?->tenant_id,
                'user_id' => $request->user()?->id,
                'endpoint' => $request->path(),
                'method' => $request->method(),
                'request_body' => $this->sanitizePayload($request->all()),
                'response_body' => $this->sanitizePayload($this->extractResponseBody($response)),
                'status_code' => $response->getStatusCode(),
                'response_time_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        } catch (Throwable) {
            // Logging failure is non-critical and must not fail the request.
        }

        return $response;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function extractResponseBody(Response $response): ?array
    {
        if (! $this->shouldLogResponseBody($response)) {
            return null;
        }

        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return null;
        }

        if (strlen($content) > self::MAX_LOGGED_RESPONSE_BYTES) {
            return [
                'omitted' => 'response body exceeded logging size threshold',
            ];
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : ['content' => $content];
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>|null
     */
    private function sanitizePayload(?array $payload): ?array
    {
        if (! is_array($payload) || $payload === []) {
            return null;
        }

        $sanitized = [];

        foreach ($payload as $key => $value) {
            $normalizedKey = strtolower((string) $key);

            if (in_array($normalizedKey, $this->sensitiveKeys, true)) {
                $sanitized[$key] = '[REDACTED]';
                continue;
            }

            if (is_array($value)) {
                $sanitized[$key] = $this->sanitizePayload($value);
                continue;
            }

            if (is_object($value)) {
                $sanitized[$key] = sprintf('[OBJECT:%s]', $value::class);
                continue;
            }

            $sanitized[$key] = $value;
        }

        return $sanitized;
    }

    private function shouldLogResponseBody(Response $response): bool
    {
        if ($response instanceof BinaryFileResponse || $response instanceof StreamedResponse) {
            return false;
        }

        $contentDisposition = strtolower((string) $response->headers->get('Content-Disposition', ''));
        if (str_contains($contentDisposition, 'attachment')) {
            return false;
        }

        $contentType = strtolower((string) $response->headers->get('Content-Type', 'application/json'));
        if (! str_contains($contentType, 'json')) {
            return false;
        }

        return true;
    }
}
