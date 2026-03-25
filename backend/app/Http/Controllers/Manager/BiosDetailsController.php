<?php

namespace App\Http\Controllers\Manager;

use App\Services\BiosDetailsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosDetailsController extends BaseManagerController
{
    public function __construct(private readonly BiosDetailsService $biosDetailsService)
    {
    }

    public function show(Request $request, string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getBiosOverview($biosId, $this->currentTenantId($request)),
        ]);
    }

    public function licenses(Request $request, string $biosId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'program_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->biosDetailsService->getBiosLicenseHistory($biosId, $this->currentTenantId($request), $validated);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function resellers(Request $request, string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getResellerBreakdown($biosId, $this->currentTenantId($request)),
        ]);
    }

    public function ips(Request $request, string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getIpAnalytics($biosId, $this->currentTenantId($request)),
        ]);
    }

    public function activity(Request $request, string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getBiosActivity($biosId, $this->currentTenantId($request)),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:1'],
        ]);

        return response()->json([
            'data' => $this->biosDetailsService->searchBiosIds((string) $validated['query'], $this->currentTenantId($request)),
        ]);
    }

    public function recent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json([
            'data' => $this->biosDetailsService->getRecentBiosIds($this->currentTenantId($request), (int) ($validated['limit'] ?? 20)),
        ]);
    }
}
