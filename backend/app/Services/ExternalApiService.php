<?php

namespace App\Services;

use App\Models\ApiLog;
use App\Support\ExternalApiSecurity;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class ExternalApiService
{
    public function activateUser(string $apiKey, string $username, string $biosId, ?string $baseUrl = null): array
    {
        $requestPath = $this->buildPath('apiuseradd', [$apiKey, $username, $biosId]);
        $logPath = $this->buildPath('apiuseradd', ['[REDACTED]', $username, $biosId]);

        return $this->sendPlainText(
            'GET',
            $requestPath,
            [
                'username' => $username,
                'bios_id' => $biosId,
            ],
            $baseUrl,
            $logPath,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200 && Str::contains(Str::lower($body), 'true'),
                'data' => ['response' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function deactivateUser(string $apiKey, string $username, ?string $baseUrl = null): array
    {
        $requestPath = $this->buildPath('apideluser', [$apiKey, $username]);
        $logPath = $this->buildPath('apideluser', ['[REDACTED]', $username]);

        return $this->sendPlainText(
            'GET',
            $requestPath,
            [
                'username' => $username,
            ],
            $baseUrl,
            $logPath,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200 && Str::contains(Str::lower($body), 'true'),
                'data' => ['response' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getActiveUsers(int $softwareId, ?string $baseUrl = null): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('apiusers', [$softwareId]),
            ['software_id' => $softwareId],
            $baseUrl,
            null,
            function (string $body, int $statusCode): array {
                $normalized = str_replace(["'", 'True', 'False'], ['"', 'true', 'false'], $body);
                $decoded = json_decode($normalized, true);

                return [
                    'success' => $statusCode === 200 && is_array($decoded),
                    'data' => ['users' => is_array($decoded) ? $decoded : []],
                    'status_code' => $statusCode,
                ];
            },
        );
    }

    public function getSoftwareStats(int $softwareId, ?string $baseUrl = null): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('showallapi', [$softwareId]),
            ['software_id' => $softwareId],
            $baseUrl,
            null,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => ['count' => (int) trim($body)],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getProgramLogs(int $softwareId, ?string $baseUrl = null, string $logsEndpoint = 'apilogs'): array
    {
        $normalizedLogsEndpoint = $this->normalizeLogsEndpoint($logsEndpoint);

        return $this->sendPlainText(
            'GET',
            $this->buildPath($normalizedLogsEndpoint, [$softwareId]),
            ['software_id' => $softwareId],
            $baseUrl,
            null,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => ['raw' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getGlobalLogs(?string $baseUrl = null): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('getmylogs'),
            [],
            $baseUrl,
            null,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => ['raw' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    // Backward compatibility for existing API status pages/controllers.
    public function getStatus(): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('showallapi', [8]),
            ['software_id' => 8],
            null,
            null,
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => [
                    'status' => $statusCode === 200 ? 'online' : 'offline',
                    'count' => (int) trim($body),
                ],
                'status_code' => $statusCode,
            ],
        );
    }

    public function listUsers(): array
    {
        return $this->getActiveUsers(8);
    }

    public function checkUser(string $biosId): array
    {
        $response = $this->getActiveUsers(8);
        $users = is_array($response['data']['users'] ?? null) ? $response['data']['users'] : [];

        return [
            'success' => $response['success'],
            'data' => ['exists' => array_key_exists($biosId, $users)],
            'status_code' => $response['status_code'] ?? 503,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param \Closure(string, int): array{success: bool, data: array<string, mixed>, status_code: int} $formatter
     * @return array{success: bool, data: array<string, mixed>, status_code: int}
     */
    private function sendPlainText(
        string $method,
        string $path,
        array $payload,
        ?string $baseUrl,
        ?string $logPath,
        \Closure $formatter
    ): array {
        $startedAt = microtime(true);
        $resolvedBaseUrl = $this->resolveBaseUrl($baseUrl);
        $url = rtrim($resolvedBaseUrl, '/').'/'.ltrim($path, '/');
        $endpointForLogs = '/'.ltrim($logPath ?? $path, '/');
        $safePayload = $this->sanitizePayloadForLogs($payload);

        try {
            $response = Http::timeout((int) config('external-api.timeout', 10))
                ->retry((int) config('external-api.retries', 3), 200)
                ->accept('*/*')
                ->send($method, $url);

            $body = trim((string) $response->body());
            $result = $formatter($body, $response->status());
            $this->logApiCall($endpointForLogs, strtoupper($method), $safePayload, $result['data'], $response->status(), $startedAt);

            return $result;
        } catch (Throwable $exception) {
            $body = ['message' => $exception->getMessage()];
            $this->logApiCall($endpointForLogs, strtoupper($method), $safePayload, $body, 503, $startedAt);

            return [
                'success' => false,
                'data' => $body,
                'status_code' => 503,
            ];
        }
    }

    /**
     * @param array<int, string|int> $segments
     */
    private function buildPath(string $root, array $segments = []): string
    {
        $parts = array_map(static fn ($segment) => rawurlencode((string) $segment), $segments);

        return $root.(empty($parts) ? '' : '/'.implode('/', $parts));
    }

    private function resolveBaseUrl(?string $baseUrl = null): string
    {
        $candidate = ExternalApiSecurity::normalizeBaseUrl($baseUrl)
            ?? ExternalApiSecurity::normalizeBaseUrl((string) config('external-api.url'));

        if ($candidate === null) {
            throw new InvalidArgumentException('External API base URL is not configured.');
        }

        ExternalApiSecurity::assertSafeBaseUrl($candidate);

        return $candidate;
    }

    private function normalizeLogsEndpoint(string $value): string
    {
        $normalized = trim($value, " \t\n\r\0\x0B/");
        if ($normalized === '') {
            return 'apilogs';
        }

        if (! preg_match('/^[A-Za-z0-9_-]+$/', $normalized)) {
            throw new InvalidArgumentException('External logs endpoint is invalid.');
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function sanitizePayloadForLogs(array $payload): array
    {
        $safePayload = $payload;

        foreach (['api_key', 'key', 'token', 'authorization'] as $key) {
            if (array_key_exists($key, $safePayload)) {
                $safePayload[$key] = '[REDACTED]';
            }
        }

        return $safePayload;
    }

    private function logApiCall(string $endpoint, string $method, array $payload, array $responseBody, int $statusCode, float $startedAt): void
    {
        try {
            $user = auth()->user();

            ApiLog::query()->create([
                'tenant_id' => $user?->tenant_id,
                'user_id' => $user?->id,
                'endpoint' => $endpoint,
                'method' => $method,
                'request_body' => $payload === [] ? null : $payload,
                'response_body' => $responseBody === [] ? null : $responseBody,
                'status_code' => $statusCode,
                'response_time_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        } catch (Throwable) {
            // External API telemetry must never break business flow.
        }
    }
}
