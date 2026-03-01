<?php

namespace App\Services;

use App\Models\ApiLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class ExternalApiService
{
    public function activateUser(string $apiKey, string $username, string $biosId): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('apiuseradd', [$apiKey, $username, $biosId]),
            [
                'api_key' => $apiKey,
                'username' => $username,
                'bios_id' => $biosId,
            ],
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200 && Str::contains(Str::lower($body), 'true'),
                'data' => ['response' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function deactivateUser(string $apiKey, string $username): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('apideluser', [$apiKey, $username]),
            [
                'api_key' => $apiKey,
                'username' => $username,
            ],
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200 && Str::contains(Str::lower($body), 'true'),
                'data' => ['response' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getActiveUsers(int $softwareId): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('apiusers', [$softwareId]),
            ['software_id' => $softwareId],
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

    public function getSoftwareStats(int $softwareId): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('showallapi', [$softwareId]),
            ['software_id' => $softwareId],
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => ['count' => (int) trim($body)],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getProgramLogs(int $softwareId): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('apilogs', [$softwareId]),
            ['software_id' => $softwareId],
            fn (string $body, int $statusCode): array => [
                'success' => $statusCode === 200,
                'data' => ['raw' => $body],
                'status_code' => $statusCode,
            ],
        );
    }

    public function getGlobalLogs(): array
    {
        return $this->sendPlainText(
            'GET',
            $this->buildPath('getmylogs'),
            [],
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
    private function sendPlainText(string $method, string $path, array $payload, \Closure $formatter): array
    {
        $startedAt = microtime(true);
        $url = rtrim((string) config('external-api.url'), '/').'/'.ltrim($path, '/');

        try {
            $response = Http::timeout((int) config('external-api.timeout', 10))
                ->retry((int) config('external-api.retries', 3), 200)
                ->accept('*/*')
                ->send($method, $url);

            $body = trim((string) $response->body());
            $result = $formatter($body, $response->status());
            $this->logApiCall($path, strtoupper($method), $payload, $result['data'], $response->status(), $startedAt);

            return $result;
        } catch (Throwable $exception) {
            $body = ['message' => $exception->getMessage()];
            $this->logApiCall($path, strtoupper($method), $payload, $body, 503, $startedAt);

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

    private function logApiCall(string $endpoint, string $method, array $payload, array $responseBody, int $statusCode, float $startedAt): void
    {
        $user = auth()->user();

        ApiLog::query()->create([
            'tenant_id' => $user?->tenant_id,
            'user_id' => $user?->id,
            'endpoint' => '/'.$endpoint,
            'method' => $method,
            'request_body' => $payload === [] ? null : $payload,
            'response_body' => $responseBody === [] ? null : $responseBody,
            'status_code' => $statusCode,
            'response_time_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);
    }
}
