<?php

namespace App\Http\Controllers\ManagerParent;

use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;

class ApiStatusController extends BaseManagerParentController
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => $this->probeExternalServer(),
        ]);
    }

    public function ping(): JsonResponse
    {
        return response()->json([
            'data' => $this->probeExternalServer(),
        ]);
    }

    public function history(): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    /**
     * @return array{status: string, response_time_ms: int, last_checked: string, external_url: string}
     */
    private function probeExternalServer(): array
    {
        $startedAt = microtime(true);
        $response = $this->externalApiService->getSoftwareStats(8);
        $responseTime = (int) round((microtime(true) - $startedAt) * 1000);
        $statusCode = (int) ($response['status_code'] ?? 503);

        return [
            'status' => $statusCode >= 500 ? 'offline' : ($statusCode >= 400 ? 'degraded' : 'online'),
            'response_time_ms' => $responseTime,
            'last_checked' => now()->toIso8601String(),
            'external_url' => rtrim((string) config('external-api.url'), '/'),
        ];
    }
}
