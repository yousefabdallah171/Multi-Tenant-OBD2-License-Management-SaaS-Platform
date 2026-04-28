<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ApiLog;
use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiStatusController extends BaseSuperAdminController
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(): JsonResponse
    {
        $status = $this->probe();

        return response()->json([
            'data' => [
                'status' => $status['state'],
                'last_check_at' => now()->toIso8601String(),
                'response_time_ms' => $status['response_time_ms'],
                'uptime' => [
                    '24h' => $this->uptimePercentage(24),
                    '7d' => $this->uptimePercentage(24 * 7),
                    '30d' => $this->uptimePercentage(24 * 30),
                ],
                'endpoints' => $this->endpointStatuses(),
            ],
        ]);
    }

    public function history(): JsonResponse
    {
        $history = ApiLog::query()
            ->where('endpoint', '/status')
            ->latest()
            ->take(24)
            ->get()
            ->sortBy('created_at')
            ->values()
            ->map(fn (ApiLog $log): array => [
                'time' => $log->created_at?->format('H:i'),
                'response_time_ms' => $log->response_time_ms,
                'status_code' => $log->status_code,
            ]);

        return response()->json(['data' => $history]);
    }

    public function ping(Request $request): JsonResponse
    {
        $status = $this->probe();

        ApiLog::query()->create([
            'tenant_id' => null,
            'user_id' => $request->user()?->id,
            'endpoint' => '/status',
            'method' => 'GET',
            'request_body' => [],
            'response_body' => $status['payload'],
            'status_code' => $status['status_code'],
            'response_time_ms' => $status['response_time_ms'],
        ]);

        return response()->json([
            'data' => [
                'status' => $status['state'],
                'status_code' => $status['status_code'],
                'response_time_ms' => $status['response_time_ms'],
                'payload' => $status['payload'],
            ],
        ]);
    }

    /**
     * @return array{state: string, status_code: int, response_time_ms: int, payload: array<string, mixed>}
     */
    private function probe(): array
    {
        $startedAt = microtime(true);
        $response = $this->externalApiService->getStatus();
        $responseTime = (int) round((microtime(true) - $startedAt) * 1000);

        $statusCode = (int) ($response['status_code'] ?? 503);
        $state = $statusCode >= 500 ? 'offline' : ($statusCode >= 400 ? 'degraded' : 'online');

        return [
            'state' => $state,
            'status_code' => $statusCode,
            'response_time_ms' => $responseTime,
            'payload' => is_array($response['data'] ?? null) ? $response['data'] : [],
        ];
    }

    private function uptimePercentage(int $hours): float
    {
        $logs = ApiLog::query()
            ->where('endpoint', '/status')
            ->where('created_at', '>=', now()->subHours($hours))
            ->get();

        if ($logs->isEmpty()) {
            return 100.0;
        }

        $successCount = $logs->filter(fn (ApiLog $log): bool => $log->status_code >= 200 && $log->status_code < 400)->count();

        return round(($successCount / $logs->count()) * 100, 1);
    }

    /**
     * @return \Illuminate\Support\Collection<int, array{endpoint: string, status: string, status_code: int|null, last_checked_at: string|null}>
     */
    private function endpointStatuses()
    {
        $endpoints = ['/status', '/users', '/activate', '/renew'];

        return collect($endpoints)->map(function (string $endpoint): array {
            $log = ApiLog::query()
                ->where('endpoint', $endpoint)
                ->latest('created_at')
                ->first(['status_code', 'created_at']);

            return [
                'endpoint' => $endpoint,
                'status' => match (true) {
                    ! $log => 'unknown',
                    $log->status_code >= 500 => 'offline',
                    $log->status_code >= 400 => 'degraded',
                    default => 'online',
                },
                'status_code' => $log?->status_code,
                'last_checked_at' => $log?->created_at?->toIso8601String(),
            ];
        })->values();
    }
}
