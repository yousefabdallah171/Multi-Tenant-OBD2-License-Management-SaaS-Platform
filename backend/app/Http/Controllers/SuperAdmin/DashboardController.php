<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserIpLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DashboardController extends BaseSuperAdminController
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => Cache::remember('super-admin:dashboard:stats', now()->addSeconds(60), function (): array {
                $countries = UserIpLog::query()
                    ->selectRaw('country, COUNT(*) as count')
                    ->whereNotNull('country')
                    ->groupBy('country')
                    ->orderByDesc('count')
                    ->limit(5)
                    ->get()
                    ->map(fn ($row): array => [
                        'country' => (string) $row->country,
                        'count' => (int) $row->count,
                    ])
                    ->values()
                    ->all();

                return [
                    'stats' => [
                        'total_tenants' => Tenant::query()->count(),
                        'total_revenue' => (float) License::query()->sum('price'),
                        'active_licenses' => License::query()->where('status', 'active')->count(),
                        'total_users' => User::query()->count(),
                        'ip_country_map' => $countries,
                    ],
                ];
            }),
        ]);
    }

    public function revenueTrend(): JsonResponse
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));
        $firstMonth = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        $totals = Cache::remember('super-admin:dashboard:revenue-trend', now()->addSeconds(60), function () use ($firstMonth) {
            return License::query()
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m') as month_key, ROUND(COALESCE(SUM(price), 0), 2) as revenue")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m')")
                ->pluck('revenue', 'month_key');
        });

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'key' => $month->format('Y-m'),
                'revenue' => round((float) ($totals[$month->format('Y-m')] ?? 0), 2),
            ])->values(),
        ]);
    }

    public function tenantComparison(): JsonResponse
    {
        $tenants = Cache::remember('super-admin:dashboard:tenant-comparison', now()->addMinutes(5), function (): array {
            return Tenant::query()
                ->withCount([
                    'licenses as active_licenses_count' => fn ($query) => $query->where('status', 'active'),
                ])
                ->withSum('licenses as total_revenue', 'price')
                ->get()
                ->sortByDesc(fn (Tenant $tenant): float => (float) ($tenant->total_revenue ?? 0))
                ->take(10)
                ->values()
                ->map(fn (Tenant $tenant): array => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'revenue' => round((float) ($tenant->total_revenue ?? 0), 2),
                    'active_licenses' => (int) ($tenant->active_licenses_count ?? 0),
                ])
                ->all();
        });

        return response()->json(['data' => $tenants]);
    }

    public function licenseTimeline(): JsonResponse
    {
        $days = collect(range(29, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfDay()->subDays($offset));
        $firstDay = CarbonImmutable::now()->startOfDay()->subDays(29);

        $totals = Cache::remember('super-admin:dashboard:license-timeline', now()->addSeconds(60), function () use ($firstDay) {
            return License::query()
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstDay)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m-%d') as day_key, COUNT(*) as count")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m-%d')")
                ->pluck('count', 'day_key');
        });

        return response()->json([
            'data' => $days->map(fn (CarbonImmutable $day): array => [
                'date' => $day->format('Y-m-d'),
                'label' => $day->format('d M'),
                'count' => (int) ($totals[$day->format('Y-m-d')] ?? 0),
            ])->values(),
        ]);
    }

    public function recentActivity(): JsonResponse
    {
        $activities = Cache::remember('super-admin:dashboard:recent-activity', now()->addSeconds(60), function (): array {
            return ActivityLog::query()
                ->select(['id', 'user_id', 'tenant_id', 'action', 'description', 'metadata', 'created_at'])
                ->with(['user:id,name', 'tenant:id,name'])
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (ActivityLog $activity): array => [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'description' => $activity->description,
                    'user' => $activity->user?->name,
                    'tenant' => $activity->tenant?->name,
                    'metadata' => $activity->metadata ?? [],
                    'created_at' => $activity->created_at?->toIso8601String(),
                ])
                ->values()
                ->all();
        });

        return response()->json(['data' => $activities]);
    }
}
