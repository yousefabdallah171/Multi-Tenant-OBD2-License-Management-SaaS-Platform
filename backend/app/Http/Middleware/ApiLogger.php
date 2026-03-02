<?php

namespace App\Http\Middleware;

use App\Models\ApiLog;
use Closure;
use Illuminate\Http\Request;
use Throwable;
use Symfony\Component\HttpFoundation\Response;

class ApiLogger
{
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
                'request_body' => $request->all() ?: null,
                'response_body' => $this->extractResponseBody($response),
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
        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return null;
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : ['content' => $content];
    }
}
