<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ActivityLog;
use App\Models\License;
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

        $result = Cache::remember("reseller:{$resellerId}:dashboard:stats", 45, function () use ($resellerId, $currentMonth): array {
            $stats = License::query()
                ->where('reseller_id', $resellerId)
                ->selectRaw("
                    COUNT(DISTINCT customer_id) as customers,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_licenses,
                    ROUND(SUM(price), 2) as revenue,
                    SUM(CASE WHEN activated_at >= ? THEN 1 ELSE 0 END) as monthly_activations
                ", [$currentMonth])
                ->first();

            return [
                'customers' => (int) ($stats->customers ?? 0),
                'active_licenses' => (int) ($stats->active_licenses ?? 0),
                'revenue' => (float) ($stats->revenue ?? 0),
                'monthly_activations' => (int) ($stats->monthly_activations ?? 0),
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

        $data = Cache::remember("reseller:{$resellerId}:dashboard:revenue-chart", 30, function () use ($resellerId): array {
            $firstMonth = CarbonImmutable::now()->subMonths(11)->startOfMonth();

            $revenues = License::query()
                ->where('reseller_id', $resellerId)
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m') as month_key, ROUND(SUM(price), 2) as total")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m')")
                ->pluck('total', 'month_key');

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
