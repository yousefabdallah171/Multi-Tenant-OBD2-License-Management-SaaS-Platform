<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\BiosConflict;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Support\RevenueAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class DashboardController extends BaseManagerParentController
{
    public function dashboard(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'stats' => $this->safeResolve(
                    fn (): array => $this->statsData($request),
                    $this->defaultStatsData(),
                    'stats',
                    $tenantId,
                ),
                'revenueChart' => $this->safeResolve(
                    fn (): array => $this->revenueChartData($request),
                    $this->defaultRevenueChartData(),
                    'revenue_chart',
                    $tenantId,
                ),
                'expiryForecast' => $this->safeResolve(
                    fn (): array => $this->expiryForecastData($request),
                    $this->defaultExpiryForecastData(),
                    'expiry_forecast',
                    $tenantId,
                ),
                'teamPerformance' => $this->safeResolve(
                    fn (): array => $this->teamPerformanceData($request),
                    [],
                    'team_performance',
                    $tenantId,
                ),
                'conflictRate' => $this->safeResolve(
                    fn (): array => $this->conflictRateData($request),
                    $this->defaultConflictRateData(),
                    'conflict_rate',
                    $tenantId,
                ),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'stats' => $this->safeResolve(
                    fn (): array => $this->statsData($request),
                    $this->defaultStatsData(),
                    'stats',
                    $tenantId,
                ),
            ])
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function revenueChart(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'data' => $this->safeResolve(
                    fn (): array => $this->revenueChartData($request),
                    $this->defaultRevenueChartData(),
                    'revenue_chart',
                    $tenantId,
                ),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function expiryForecast(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'data' => $this->safeResolve(
                    fn (): array => $this->expiryForecastData($request),
                    $this->defaultExpiryForecastData(),
                    'expiry_forecast',
                    $tenantId,
                ),
            ])
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function teamPerformance(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'data' => $this->safeResolve(
                    fn (): array => $this->teamPerformanceData($request),
                    [],
                    'team_performance',
                    $tenantId,
                ),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function conflictRate(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()
            ->json([
                'data' => $this->safeResolve(
                    fn (): array => $this->conflictRateData($request),
                    $this->defaultConflictRateData(),
                    'conflict_rate',
                    $tenantId,
                ),
            ])
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

            $licenseQuery = License::query()->where('tenant_id', $tenantId);
            $licenseTotals = (int) (clone $licenseQuery)->count();
            $activeLicenses = (int) (clone $licenseQuery)
                ->whereEffectivelyActive()
                ->whereNotNull('customer_id')
                ->distinct('customer_id')
                ->count('customer_id');
            $revenue = RevenueAnalytics::totalRevenue([], $tenantId);
            $monthlyRevenue = RevenueAnalytics::totalRevenue([
                'from' => now()->startOfMonth()->toDateString(),
                'to' => now()->endOfMonth()->toDateString(),
            ], $tenantId);

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

            $totals = RevenueAnalytics::monthlyRevenueMap(12, [], $tenantId);

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
                ->selectRaw('reseller_id, COUNT(*) as activations, COUNT(DISTINCT customer_id) as customers')
                ->groupBy('reseller_id')
                ->get()
                ->keyBy('reseller_id');
            $revenueBySeller = RevenueAnalytics::revenueBySellerIds($resellerIds, $tenantId);

            return $team
                ->map(function (User $user) use ($metrics, $revenueBySeller): array {
                    $entry = $metrics->get($user->id);

                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'role' => $user->role?->value ?? (string) $user->role,
                        'activations' => (int) ($entry?->activations ?? 0),
                        'revenue' => round((float) ($revenueBySeller->get($user->id) ?? 0), 2),
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

    /**
     * @template T
     *
     * @param  callable(): T  $resolver
     * @param  T  $fallback
     * @return T
     */
    private function safeResolve(callable $resolver, mixed $fallback, string $section, int $tenantId): mixed
    {
        try {
            return $resolver();
        } catch (Throwable $exception) {
            Log::warning('manager-parent-dashboard-fallback', [
                'tenant_id' => $tenantId,
                'section' => $section,
                'error' => $exception->getMessage(),
            ]);

            return $fallback;
        }
    }

    /**
     * @return array<string, int|float>
     */
    private function defaultStatsData(): array
    {
        return [
            'users' => 0,
            'programs' => 0,
            'licenses' => 0,
            'active_licenses' => 0,
            'revenue' => 0,
            'team_members' => 0,
            'total_customers' => 0,
            'monthly_revenue' => 0,
        ];
    }

    /**
     * @return array<int, array{month: string, revenue: float}>
     */
    private function defaultRevenueChartData(): array
    {
        return collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset))
            ->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'revenue' => 0,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{range: string, count: int}>
     */
    private function defaultExpiryForecastData(): array
    {
        return [
            ['range' => '0-30', 'count' => 0],
            ['range' => '31-60', 'count' => 0],
            ['range' => '61-90', 'count' => 0],
        ];
    }

    /**
     * @return array<int, array{month: string, count: int}>
     */
    private function defaultConflictRateData(): array
    {
        return collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset))
            ->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'count' => 0,
            ])
            ->values()
            ->all();
    }
}
