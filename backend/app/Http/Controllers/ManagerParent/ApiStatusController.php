<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Program;
use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiStatusController extends BaseManagerParentController
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $program = $this->resolveProgram($request);

        return response()->json([
            'data' => $this->probeExternalServer($program),
        ]);
    }

    public function ping(Request $request): JsonResponse
    {
        $program = $this->resolveProgram($request);

        return response()->json([
            'data' => $this->probeExternalServer($program),
        ]);
    }

    public function history(): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    /**
     * @return array{status: string, response_time_ms: int, last_checked: string, external_url: null}
     */
    private function probeExternalServer(?Program $program): array
    {
        $softwareId = (int) ($program?->external_software_id ?? 8);
        $startedAt = microtime(true);
        $response = $this->externalApiService->getSoftwareStats($softwareId, $program?->external_api_base_url);
        $responseTime = (int) round((microtime(true) - $startedAt) * 1000);
        $statusCode = (int) ($response['status_code'] ?? 503);

        return [
            'status' => $statusCode >= 500 ? 'offline' : ($statusCode >= 400 ? 'degraded' : 'online'),
            'response_time_ms' => $responseTime,
            'last_checked' => now()->toIso8601String(),
            'external_url' => null,
            'program_id' => $program?->id,
            'program_name' => $program?->name,
            'software_id' => $softwareId,
        ];
    }

    private function resolveProgram(Request $request): ?Program
    {
        $validated = $request->validate([
            'program_id' => ['nullable', 'integer'],
        ]);

        $query = Program::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('has_external_api', true)
            ->whereNotNull('external_software_id')
            ->where('status', 'active');

        if (! empty($validated['program_id'])) {
            return $query->where('id', (int) $validated['program_id'])->first();
        }

        return $query->latest('id')->first();
    }
}
