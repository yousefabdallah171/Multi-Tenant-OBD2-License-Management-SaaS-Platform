<?php

namespace App\Services;

use App\Models\ApiLog;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExternalApiService
{
    public function activateUser(string $biosId): array
    {
        return $this->send('post', '/activate', ['bios_id' => $biosId]);
    }

    public function deleteUser(string $biosId): array
    {
        return $this->send('delete', '/users/'.$biosId);
    }

    public function listUsers(): array
    {
        return $this->send('get', '/users');
    }

    public function checkUser(string $biosId): array
    {
        return $this->send('get', '/users/'.$biosId);
    }

    public function renewUser(string $biosId): array
    {
        return $this->send('post', '/renew', ['bios_id' => $biosId]);
    }

    public function getStatus(): array
    {
        return $this->send('get', '/status');
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{success: bool, data: array<string, mixed>, status_code: int}
     */
    private function send(string $method, string $uri, array $payload = []): array
    {
        $startedAt = microtime(true);
        $endpoint = ltrim($uri, '/');

        try {
            $request = $this->client();

            $response = match (strtolower($method)) {
                'get' => $request->get($endpoint, $payload),
                'post' => $request->post($endpoint, $payload),
                'delete' => $request->delete($endpoint, $payload),
                default => $request->send($method, $endpoint, ['json' => $payload]),
            };

            $body = $response->json() ?? [];
            $this->logApiCall($endpoint, strtoupper($method), $payload, $body, $response->status(), $startedAt);

            return [
                'success' => $response->successful(),
                'data' => $body,
                'status_code' => $response->status(),
            ];
        } catch (Throwable $exception) {
            $body = ['message' => $exception->getMessage()];
            $this->logApiCall($endpoint, strtoupper($method), $payload, $body, 503, $startedAt);

            return [
                'success' => false,
                'data' => $body,
                'status_code' => 503,
            ];
        }
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('external-api.url'), '/'))
            ->timeout((int) config('external-api.timeout', 10))
            ->retry((int) config('external-api.retries', 3), 200)
            ->acceptJson()
            ->withHeaders([
                'X-API-Key' => (string) config('external-api.key'),
            ]);
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
