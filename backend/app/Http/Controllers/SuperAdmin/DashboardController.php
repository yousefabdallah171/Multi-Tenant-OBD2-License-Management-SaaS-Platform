<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserIpLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class DashboardController extends BaseSuperAdminController
{
    public function stats(): JsonResponse
    {
        $countries = UserIpLog::query()
            ->whereNotNull('country')
            ->get()
            ->groupBy(fn (UserIpLog $log): string => (string) $log->country)
            ->map(fn ($group, string $country): array => [
                'country' => $country,
                'count' => $group->count(),
            ])
            ->sortByDesc('count')
            ->take(5)
            ->values();

        return response()->json([
            'data' => [
                'stats' => [
                    'total_tenants' => Tenant::query()->count(),
                    'total_revenue' => (float) License::query()->sum('price'),
                    'active_licenses' => License::query()->where('status', 'active')->count(),
                    'total_users' => User::query()->count(),
                    'ip_country_map' => $countries,
                ],
            ],
        ]);
    }

    public function revenueTrend(): JsonResponse
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $totals = License::query()
            ->whereNotNull('activated_at')
            ->get()
            ->groupBy(fn (License $license): string => $license->activated_at->format('Y-m'))
            ->map(fn ($group): float => (float) $group->sum('price'));

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
        $tenants = Tenant::query()
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
            ]);

        return response()->json(['data' => $tenants]);
    }

    public function licenseTimeline(): JsonResponse
    {
        $days = collect(range(29, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfDay()->subDays($offset));

        $totals = License::query()
            ->whereNotNull('activated_at')
            ->get()
            ->groupBy(fn (License $license): string => $license->activated_at->format('Y-m-d'))
            ->map(fn ($group): int => $group->count());

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
        $activities = ActivityLog::query()
            ->with(['user:id,name', 'tenant:id,name'])
            ->latest()
            ->take(20)
            ->get()
            ->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'action' => $activity->action,
                'description' => $activity->description,
                'user' => $activity->user?->name,
                'tenant' => $activity->tenant?->name,
                'metadata' => $activity->metadata ?? [],
                'created_at' => $activity->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $activities]);
    }
}
