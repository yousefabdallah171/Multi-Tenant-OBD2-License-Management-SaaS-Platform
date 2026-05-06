<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Models\User;
use App\Services\MandiagApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MandiagTrackingController extends BaseManagerParentController
{
    public function __construct(private readonly MandiagApiService $mandiagApiService)
    {
    }

    public function summary(Request $request): JsonResponse
    {
        $period   = $this->normalizePeriod($request->query('period', 'month'));
        $tenantId = $this->currentTenantId($request);
        $cacheKey = "mandiag_summary_{$tenantId}_{$period}";

        $data = Cache::remember($cacheKey, 30, function () use ($period, $tenantId): array {
            $tenantSubIds = $this->tenantMandiagSubIds($tenantId);

            $allResellers = $this->mandiagApiService->getResellers($period);
            $items        = $allResellers['data']['items'] ?? [];
            $items        = is_array($items) ? $items : [];

            // Filter to resellers that belong to this tenant
            $filtered = array_values(array_filter(
                $items,
                fn (array $item): bool => in_array($item['sub_id'] ?? '', $tenantSubIds, true)
            ));

            $stats = array_column($filtered, 'stats');

            return [
                'total_revenue'      => array_sum(array_column($stats, 'revenue_total')),
                'total_manager_cost' => array_sum(array_column($stats, 'manager_cost_total')),
                'net_commission'     => array_sum(array_column($stats, 'commission')),
                'balance'            => 0,
                'active_resellers'   => count($filtered),
                'total_licenses'     => License::query()
                    ->where('tenant_id', $tenantId)
                    ->whereNotNull('mandiag_license_id')
                    ->whereIn('status', ['active', 'suspended'])
                    ->count(),
                'activations_count'  => array_sum(array_column($stats, 'activations_count')),
                'period'             => $period,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function resellers(Request $request): JsonResponse
    {
        $period   = $this->normalizePeriod($request->query('period', 'month'));
        $tenantId = $this->currentTenantId($request);
        $cacheKey = "mandiag_resellers_{$tenantId}_{$period}";

        $data = Cache::remember($cacheKey, 30, function () use ($period, $tenantId): array {
            $tenantSubIds = $this->tenantMandiagSubIds($tenantId);

            $response = $this->mandiagApiService->getResellers($period);
            $list     = $response['data']['items'] ?? [];
            $list     = is_array($list) ? $list : [];

            // Filter to this tenant's sub-resellers only
            return array_values(array_filter(
                $list,
                fn (array $item): bool => in_array($item['sub_id'] ?? '', $tenantSubIds, true)
            ));
        });

        return response()->json(['data' => $data]);
    }

    public function licenses(Request $request): JsonResponse
    {
        $page     = max(1, (int) $request->query('page', 1));
        $perPage  = min(100, max(10, (int) $request->query('per_page', 25)));
        $tenantId = $this->currentTenantId($request);

        // Serve from local DB scoped to this tenant — avoids cross-tenant data leaks
        $paginator = License::query()
            ->select([
                'id', 'mandiag_license_id', 'status', 'bios_id', 'external_username',
                'duration_days', 'starts_at', 'expires_at', 'program_id', 'reseller_id',
            ])
            ->with(['program:id,name,mandiag_software_key', 'reseller:id,name'])
            ->where('tenant_id', $tenantId)
            ->whereNotNull('mandiag_license_id')
            ->latest('id')
            ->paginate($perPage, ['*'], 'page', $page);

        $licenses = collect($paginator->items())->map(fn (License $l): array => [
            'id'                  => $l->id,
            'mandiag_license_id'  => $l->mandiag_license_id,
            'status'              => $l->status,
            'bios_id'             => $l->bios_id,
            'external_username'   => $l->external_username,
            'duration_days'       => $l->duration_days,
            'activated_at'        => $l->starts_at?->toIso8601String(),
            'expires_at'          => $l->expires_at?->toIso8601String(),
            'reseller_name'       => $l->reseller?->name,
            'program_name'        => $l->program?->name,
            'software_key'        => $l->program?->mandiag_software_key,
        ])->values();

        return response()->json([
            'data' => [
                'licenses'     => $licenses,
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * Returns the set of mandiag_sub_id values for resellers in this tenant.
     *
     * @return string[]
     */
    private function tenantMandiagSubIds(int $tenantId): array
    {
        return User::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('mandiag_sub_id')
            ->pluck('mandiag_sub_id')
            ->map(fn ($v): string => (string) $v)
            ->all();
    }

    private function normalizePeriod(mixed $value): string
    {
        $allowed = ['today', 'week', 'month', 'year', 'all'];
        $value   = is_string($value) ? strtolower($value) : 'month';
        return in_array($value, $allowed, true) ? $value : 'month';
    }
}
