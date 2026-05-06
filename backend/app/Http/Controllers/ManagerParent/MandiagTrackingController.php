<?php

namespace App\Http\Controllers\ManagerParent;

use App\Http\Controllers\Controller;
use App\Services\MandiagApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MandiagTrackingController extends Controller
{
    public function __construct(private readonly MandiagApiService $mandiagApiService)
    {
    }

    public function summary(Request $request): JsonResponse
    {
        $period   = $this->normalizePeriod($request->query('period', 'month'));
        $tenantId = (int) auth()->user()?->tenant_id;
        $cacheKey = "mandiag_summary_{$tenantId}_{$period}";

        $data = Cache::remember($cacheKey, 30, function () use ($period): array {
            $balance    = $this->mandiagApiService->getBalance();
            $commission = null;
            try {
                $raw = $this->mandiagApiService->getCommission($period);
                if (($raw['success'] ?? false) === true) {
                    $commission = $raw['data'] ?? $raw;
                }
            } catch (\Throwable) {
                // commission endpoint unavailable — fall back to reseller rollup
            }

            // Fall back: compute totals from /resellers if /commission fails
            if ($commission === null) {
                $resellers  = $this->mandiagApiService->getResellers($period);
                $items      = $resellers['data']['items'] ?? [];
                $commission = [
                    'revenue_total'      => array_sum(array_column(array_column($items, 'stats'), 'revenue_total')),
                    'manager_cost_total' => array_sum(array_column(array_column($items, 'stats'), 'manager_cost_total')),
                    'commission_total'   => array_sum(array_column(array_column($items, 'stats'), 'commission')),
                    'activations_count'  => array_sum(array_column(array_column($items, 'stats'), 'activations_count')),
                    'sub_reseller_count' => count($items),
                ];
            }

            return [
                'total_revenue'      => $commission['revenue_total']      ?? 0,
                'total_manager_cost' => $commission['manager_cost_total'] ?? 0,
                'net_commission'     => $commission['commission_total']    ?? 0,
                'balance'            => $balance['data']['manager_balance_total'] ?? 0,
                'active_resellers'   => $commission['sub_reseller_count'] ?? $balance['data']['sub_reseller_count'] ?? 0,
                'total_licenses'     => $balance['data']['license_count'] ?? 0,
                'activations_count'  => $commission['activations_count']  ?? 0,
                'period'             => $period,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function resellers(Request $request): JsonResponse
    {
        $period   = $this->normalizePeriod($request->query('period', 'month'));
        $tenantId = (int) auth()->user()?->tenant_id;
        $cacheKey = "mandiag_resellers_{$tenantId}_{$period}";

        // GET /resellers?include_stats=1&period={period} → data.items[]
        // Each item: { sub_id, realname, status, ..., stats: { activations_count, revenue_total, manager_cost_total, commission } }
        $data = Cache::remember($cacheKey, 30, function () use ($period): array {
            $response = $this->mandiagApiService->getResellers($period);
            $list     = $response['data']['items'] ?? [];
            return is_array($list) ? array_values($list) : [];
        });

        return response()->json(['data' => $data]);
    }

    public function licenses(Request $request): JsonResponse
    {
        $page     = max(1, (int) $request->query('page', 1));
        $perPage  = min(100, max(10, (int) $request->query('per_page', 25)));
        $tenantId = (int) auth()->user()?->tenant_id;
        $cacheKey = "mandiag_licenses_{$tenantId}_{$page}_{$perPage}";

        // GET /licenses?page=&per_page= → data.items[], data.pagination.{ page, per_page, total, total_pages }
        $data = Cache::remember($cacheKey, 30, function () use ($page, $perPage): array {
            $response   = $this->mandiagApiService->getLicenses($page, $perPage);
            $pagination = $response['data']['pagination'] ?? [];

            return [
                'licenses'     => $response['data']['items'] ?? [],
                'total'        => $pagination['total']       ?? null,
                'per_page'     => $pagination['per_page']    ?? $perPage,
                'current_page' => $pagination['page']        ?? $page,
                'last_page'    => $pagination['total_pages'] ?? null,
            ];
        });

        return response()->json(['data' => $data]);
    }

    private function normalizePeriod(mixed $value): string
    {
        $allowed = ['today', 'week', 'month', 'year', 'all'];
        $value   = is_string($value) ? strtolower($value) : 'month';
        return in_array($value, $allowed, true) ? $value : 'month';
    }
}
