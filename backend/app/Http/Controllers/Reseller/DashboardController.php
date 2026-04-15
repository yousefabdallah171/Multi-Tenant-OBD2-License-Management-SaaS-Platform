<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ActivityLog;
use App\Models\License;
use App\Support\CustomerOwnership;
use App\Support\RevenueAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends BaseResellerController
{
    public function stats(Request $request): JsonResponse
    {
        $resellerId = $this->currentReseller($request)->id;
        $currentMonth = now()->startOfMonth();

        $result = Cache::remember("reseller:{$resellerId}:dashboard:stats", 45, function () use ($request, $resellerId, $currentMonth): array {
            $licenseQuery = License::query()->where('reseller_id', $resellerId);

            return [
                'customers' => CustomerOwnership::currentOwnedCustomerCount([$resellerId], $this->currentTenantId($request)),
                'active_licenses' => (int) (clone $licenseQuery)
                    ->whereEffectivelyActive()
                    ->whereNotNull('customer_id')
                    ->distinct('customer_id')
                    ->count('customer_id'),
                'revenue' => RevenueAnalytics::totalRevenue([], $this->currentTenantId($request), null, $resellerId),
                'monthly_activations' => (int) (clone $licenseQuery)
                    ->where('activated_at', '>=', $currentMonth)
                    ->count(),
            ];
        });

        return response()->json(['stats' => $result]);
    }

    public function activationsChart(Request $request): JsonResponse
    {
        $resellerId = $this->currentReseller($request)->id;

        $data = Cache::remember("reseller:{$resellerId}:dashboard:activations-chart", 30, function () use ($resellerId): array {
            $firstMonth = CarbonImmutable::now()->subMonths(11)->startOfMonth();

            $counts = License::query()
                ->where('reseller_id', $resellerId)
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m') as month_key, COUNT(*) as total")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m')")
                ->pluck('total', 'month_key');

            $months = collect(range(11, 0))
                ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->subMonths($offset)->startOfMonth());

            return $months->map(function (CarbonImmutable $month) use ($counts): array {
                $key = $month->format('Y-m');
                $value = (int) ($counts->get($key) ?? 0);

                return [
                    'month' => $month->format('M Y'),
                    'count' => $value,
                    'revenue' => $value,
                ];
            })->values()->all();
        });

        return response()->json(['data' => $data]);
    }

    public function revenueChart(Request $request): JsonResponse
    {
        $resellerId = $this->currentReseller($request)->id;
        $tenantId = $this->currentTenantId($request);

        $data = Cache::remember("reseller:{$resellerId}:dashboard:revenue-chart", 30, function () use ($resellerId, $tenantId): array {
            $revenues = RevenueAnalytics::monthlyRevenueMap(12, [], $tenantId, null, $resellerId);

            $months = collect(range(11, 0))
                ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->subMonths($offset)->startOfMonth());

            return $months->map(function (CarbonImmutable $month) use ($revenues): array {
                $key = $month->format('Y-m');
                $value = (float) ($revenues->get($key) ?? 0);

                return [
                    'month' => $month->format('M Y'),
                    'count' => $value,
                    'revenue' => $value,
                ];
            })->values()->all();
        });

        return response()->json(['data' => $data]);
    }

    public function recentActivity(Request $request): JsonResponse
    {
        $resellerId = $this->currentReseller($request)->id;

        $activity = Cache::remember("reseller:{$resellerId}:dashboard:recent-activity", 60, function () use ($resellerId): array {
            return ActivityLog::query()
                ->select(['id', 'user_id', 'action', 'description', 'metadata', 'created_at'])
                ->with('user:id,name')
                ->where('user_id', $resellerId)
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn (ActivityLog $entry): array => [
                    'id' => $entry->id,
                    'action' => $entry->action,
                    'description' => $entry->description,
                    'metadata' => $entry->metadata ?? [],
                    'user' => $entry->user ? ['id' => $entry->user->id, 'name' => $entry->user->name] : null,
                    'created_at' => $entry->created_at?->toIso8601String(),
                ])
                ->values()
                ->all();
        });

        return response()->json(['data' => $activity]);
    }
}
