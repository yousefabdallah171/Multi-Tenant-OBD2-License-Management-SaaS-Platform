<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\BiosConflict;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends BaseManagerParentController
{
    public function dashboard(Request $request): JsonResponse
    {
        return response()
            ->json([
                'stats' => $this->statsData($request),
                'revenueChart' => $this->revenueChartData($request),
                'expiryForecast' => $this->expiryForecastData($request),
                'teamPerformance' => $this->teamPerformanceData($request),
                'conflictRate' => $this->conflictRateData($request),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function stats(Request $request): JsonResponse
    {
        return response()
            ->json(['stats' => $this->statsData($request)])
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function revenueChart(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => $this->revenueChartData($request)])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function expiryForecast(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => $this->expiryForecastData($request)])
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function teamPerformance(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => $this->teamPerformanceData($request)])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function conflictRate(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => $this->conflictRateData($request)])
            ->header('Cache-Control', 'private, max-age=60');
    }

    /**
     * @return array<string, int|float>
     */
    private function statsData(Request $request): array
    {
        $tenantId = $this->currentTenantId($request);

        return Cache::remember($this->cacheKey($tenantId, 'stats'), now()->addMinutes(5), function () use ($tenantId): array {
            $roleCounts = User::query()
                ->where('tenant_id', $tenantId)
                ->selectRaw('role, COUNT(*) as total')
                ->groupBy('role')
                ->pluck('total', 'role');

            $licenseStats = License::query()
                ->where('tenant_id', $tenantId)
                ->selectRaw('status, COUNT(*) as total, COALESCE(SUM(price), 0) as revenue')
                ->groupBy('status')
                ->get();

            $licenseTotals = $licenseStats->sum(fn ($row): int => (int) $row->total);
            $activeLicenses = (int) ($licenseStats->firstWhere('status', 'active')?->total ?? 0);
            $revenue = (float) $licenseStats->sum(fn ($row): float => (float) $row->revenue);

            $monthlyRevenue = (float) License::query()
                ->where('tenant_id', $tenantId)
                ->whereBetween('activated_at', [now()->startOfMonth(), now()->endOfMonth()])
                ->sum('price');

            return [
                'users' => (int) $roleCounts->sum(),
                'programs' => (int) Program::query()->where('tenant_id', $tenantId)->count(),
                'licenses' => $licenseTotals,
                'active_licenses' => $activeLicenses,
                'revenue' => round($revenue, 2),
                'team_members' => (int) (($roleCounts[UserRole::MANAGER->value] ?? 0) + ($roleCounts[UserRole::RESELLER->value] ?? 0)),
                'total_customers' => (int) ($roleCounts[UserRole::CUSTOMER->value] ?? 0),
                'monthly_revenue' => round($monthlyRevenue, 2),
            ];
        });
    }

    /**
     * @return array<int, array{month: string, revenue: float}>
     */
    private function revenueChartData(Request $request): array
    {
        $tenantId = $this->currentTenantId($request);
        $firstMonth = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        return Cache::remember($this->cacheKey($tenantId, 'revenue-chart'), now()->addSeconds(60), function () use ($tenantId, $firstMonth): array {
            $months = collect(range(11, 0))
                ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

            $totals = License::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m') as month_key, COALESCE(SUM(price), 0) as revenue")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m')")
                ->pluck('revenue', 'month_key');

            return $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'revenue' => round((float) ($totals[$month->format('Y-m')] ?? 0), 2),
            ])->values()->all();
        });
    }

    /**
     * @return array<int, array{range: string, count: int}>
     */
    private function expiryForecastData(Request $request): array
    {
        $tenantId = $this->currentTenantId($request);

        return Cache::remember($this->cacheKey($tenantId, 'expiry-forecast'), now()->addMinutes(5), function () use ($tenantId): array {
            $today = now()->startOfDay();
            $day30 = $today->copy()->addDays(30)->endOfDay();
            $day60 = $today->copy()->addDays(60)->endOfDay();
            $day90 = $today->copy()->addDays(90)->endOfDay();

            $forecast = License::query()
                ->where('tenant_id', $tenantId)
                ->whereBetween('expires_at', [$today, $day90])
                ->selectRaw("
                    SUM(CASE WHEN expires_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as range_0_30,
                    SUM(CASE WHEN expires_at > ? AND expires_at <= ? THEN 1 ELSE 0 END) as range_31_60,
                    SUM(CASE WHEN expires_at > ? AND expires_at <= ? THEN 1 ELSE 0 END) as range_61_90
                ", [$today, $day30, $day30, $day60, $day60, $day90])
                ->first();

            return [
                ['range' => '0-30', 'count' => (int) ($forecast?->range_0_30 ?? 0)],
                ['range' => '31-60', 'count' => (int) ($forecast?->range_31_60 ?? 0)],
                ['range' => '61-90', 'count' => (int) ($forecast?->range_61_90 ?? 0)],
            ];
        });
    }

    /**
     * @return array<int, array{id: int, name: string, role: string, activations: int, revenue: float, customers: int}>
     */
    private function teamPerformanceData(Request $request): array
    {
        $tenantId = $this->currentTenantId($request);

        return Cache::remember($this->cacheKey($tenantId, 'team-performance'), now()->addSeconds(60), function () use ($tenantId): array {
            $team = User::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])
                ->select(['id', 'name', 'role'])
                ->get();

            $resellerIds = $team->pluck('id')->all();
            if ($resellerIds === []) {
                return [];
            }

            $metrics = License::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('reseller_id', $resellerIds)
                ->selectRaw('reseller_id, COUNT(*) as activations, COALESCE(SUM(price), 0) as revenue, COUNT(DISTINCT customer_id) as customers')
                ->groupBy('reseller_id')
                ->get()
                ->keyBy('reseller_id');

            return $team
                ->map(function (User $user) use ($metrics): array {
                    $entry = $metrics->get($user->id);

                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'role' => $user->role?->value ?? (string) $user->role,
                        'activations' => (int) ($entry?->activations ?? 0),
                        'revenue' => round((float) ($entry?->revenue ?? 0), 2),
                        'customers' => (int) ($entry?->customers ?? 0),
                    ];
                })
                ->sortByDesc('revenue')
                ->values()
                ->all();
        });
    }

    /**
     * @return array<int, array{month: string, count: int}>
     */
    private function conflictRateData(Request $request): array
    {
        $tenantId = $this->currentTenantId($request);
        $firstMonth = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        return Cache::remember($this->cacheKey($tenantId, 'conflict-rate'), now()->addSeconds(60), function () use ($tenantId, $firstMonth): array {
            $months = collect(range(11, 0))
                ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

            $conflicts = BiosConflict::query()
                ->where('tenant_id', $tenantId)
                ->where('created_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as total")
                ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
                ->pluck('total', 'month_key');

            return $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'count' => (int) ($conflicts[$month->format('Y-m')] ?? 0),
            ])->values()->all();
        });
    }

    private function cacheKey(int $tenantId, string $suffix): string
    {
        return sprintf('dashboard:manager-parent:tenant:%d:%s', $tenantId, $suffix);
    }
}
