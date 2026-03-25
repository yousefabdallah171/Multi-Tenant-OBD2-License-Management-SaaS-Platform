<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Services\BiosDetailsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosDetailsController extends BaseSuperAdminController
{
    public function __construct(private readonly BiosDetailsService $biosDetailsService)
    {
    }

    public function show(string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getBiosOverview($biosId, null),
        ]);
    }

    public function licenses(Request $request, string $biosId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'program_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->biosDetailsService->getBiosLicenseHistory($biosId, null, $validated);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function resellers(string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getResellerBreakdown($biosId, null),
        ]);
    }

    public function ips(string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getIpAnalytics($biosId, null),
        ]);
    }

    public function activity(string $biosId): JsonResponse
    {
        return response()->json([
            'data' => $this->biosDetailsService->getBiosActivity($biosId, null),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:1'],
        ]);

        return response()->json([
            'data' => $this->biosDetailsService->searchBiosIds((string) $validated['query'], null),
        ]);
    }

    public function recent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json([
            'data' => $this->biosDetailsService->getRecentBiosIds(null, (int) ($validated['limit'] ?? 20)),
        ]);
    }
}
