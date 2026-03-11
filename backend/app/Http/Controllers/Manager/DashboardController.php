<?php

namespace App\Http\Controllers\Manager;

use App\Models\ActivityLog;
use App\Models\License;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class DashboardController extends BaseManagerController
{
    public function dashboard(Request $request): JsonResponse
    {
        $managerId = $this->currentManager($request)->id;

        return response()
            ->json([
                'stats' => $this->safeResolve(fn (): array => $this->statsData($request), $this->defaultStatsData(), 'stats', $managerId),
                'activationsChart' => $this->safeResolve(fn (): array => $this->activationsChartData($request), $this->defaultActivationsChartData(), 'activations_chart', $managerId),
                'revenueChart' => $this->safeResolve(fn (): array => $this->revenueChartData($request), [], 'revenue_chart', $managerId),
                'recentActivity' => $this->safeResolve(fn (): array => $this->recentActivityData($request), [], 'recent_activity', $managerId),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function stats(Request $request): JsonResponse
    {
        $managerId = $this->currentManager($request)->id;

        return response()
            ->json([
                'stats' => $this->safeResolve(fn (): array => $this->statsData($request), $this->defaultStatsData(), 'stats', $managerId),
            ])
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function activationsChart(Request $request): JsonResponse
    {
        $managerId = $this->currentManager($request)->id;

        return response()
            ->json([
                'data' => $this->safeResolve(fn (): array => $this->activationsChartData($request), $this->defaultActivationsChartData(), 'activations_chart', $managerId),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function revenueChart(Request $request): JsonResponse
    {
        $managerId = $this->currentManager($request)->id;

        return response()
            ->json([
                'data' => $this->safeResolve(fn (): array => $this->revenueChartData($request), [], 'revenue_chart', $managerId),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    public function recentActivity(Request $request): JsonResponse
    {
        $managerId = $this->currentManager($request)->id;

        return response()
            ->json([
                'data' => $this->safeResolve(fn (): array => $this->recentActivityData($request), [], 'recent_activity', $managerId),
            ])
            ->header('Cache-Control', 'private, max-age=60');
    }

    /**
     * @return array<string, int|float>
     */
    private function statsData(Request $request): array
    {
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);
        $resellerIds = $this->teamResellerIds($request);

        return Cache::remember($this->cacheKey($managerId, 'stats'), now()->addMinutes(5), function () use ($request, $sellerIds, $resellerIds): array {
            if ($sellerIds === []) {
                return [
                    'team_resellers' => 0,
                    'team_customers' => 0,
                    'active_licenses' => 0,
                    'team_revenue' => 0,
                    'monthly_activations' => 0,
                ];
            }

            $stats = License::query()
                ->whereIn('reseller_id', $sellerIds)
                ->selectRaw(
                    "SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_licenses,
                    COALESCE(SUM(price), 0) as team_revenue,
                    SUM(CASE WHEN activated_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as monthly_activations",
                    [now()->startOfMonth(), now()->endOfMonth()],
                )
                ->first();

            return [
                'team_resellers' => count($resellerIds),
                'team_customers' => $this->teamCustomersQuery($request)->count(),
                'active_licenses' => (int) ($stats?->active_licenses ?? 0),
                'team_revenue' => round((float) ($stats?->team_revenue ?? 0), 2),
                'monthly_activations' => (int) ($stats?->monthly_activations ?? 0),
            ];
        });
    }

    /**
     * @return array<int, array{month: string, count: int, revenue: int}>
     */
    private function activationsChartData(Request $request): array
    {
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);
        $firstMonth = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        return Cache::remember($this->cacheKey($managerId, 'activations-chart'), now()->addSeconds(60), function () use ($sellerIds, $firstMonth): array {
            $months = collect(range(11, 0))
                ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

            if ($sellerIds === []) {
                return $months->map(fn (CarbonImmutable $month): array => [
                    'month' => $month->format('M Y'),
                    'count' => 0,
                    'revenue' => 0,
                ])->values()->all();
            }

            $counts = License::query()
                ->whereIn('reseller_id', $sellerIds)
                ->whereNotNull('activated_at')
                ->where('activated_at', '>=', $firstMonth)
                ->selectRaw("DATE_FORMAT(activated_at, '%Y-%m') as month_key, COUNT(*) as total")
                ->groupByRaw("DATE_FORMAT(activated_at, '%Y-%m')")
                ->pluck('total', 'month_key');

            return $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'count' => (int) ($counts[$month->format('Y-m')] ?? 0),
                'revenue' => (int) ($counts[$month->format('Y-m')] ?? 0),
            ])->values()->all();
        });
    }

    /**
     * @return array<int, array{reseller: string, revenue: float, activations: int}>
     */
    private function revenueChartData(Request $request): array
    {
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);

        return Cache::remember($this->cacheKey($managerId, 'revenue-chart'), now()->addSeconds(60), function () use ($sellerIds): array {
            if ($sellerIds === []) {
                return [];
            }

            return License::query()
                ->join('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
                ->whereIn('licenses.reseller_id', $sellerIds)
                ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(11))
                ->selectRaw('licenses.reseller_id, resellers.name as reseller, COUNT(*) as activations, COALESCE(SUM(licenses.price), 0) as revenue')
                ->groupBy('licenses.reseller_id', 'resellers.name')
                ->orderByDesc('revenue')
                ->get()
                ->map(fn ($row): array => [
                    'reseller' => (string) $row->reseller,
                    'revenue' => round((float) $row->revenue, 2),
                    'activations' => (int) $row->activations,
                ])
                ->values()
                ->all();
        });
    }

    /**
     * @return array<int, array{id: int, action: string, description: string|null, metadata: array<string, mixed>, user: array{id: int, name: string}|null, created_at: string|null}>
     */
    private function recentActivityData(Request $request): array
    {
        $managerId = $this->currentManager($request)->id;
        $userIds = [$this->currentManager($request)->id, ...$this->teamResellerIds($request)];

        return Cache::remember($this->cacheKey($managerId, 'recent-activity'), now()->addSeconds(60), function () use ($userIds): array {
            return ActivityLog::query()
                ->select(['id', 'user_id', 'action', 'description', 'metadata', 'created_at'])
                ->with('user:id,name')
                ->whereIn('user_id', $userIds)
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
    }

    private function cacheKey(int $managerId, string $suffix): string
    {
        return sprintf('dashboard:manager:%d:%s', $managerId, $suffix);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $resolver
     * @param  T  $fallback
     * @return T
     */
    private function safeResolve(callable $resolver, mixed $fallback, string $section, int $managerId): mixed
    {
        try {
            return $resolver();
        } catch (Throwable $exception) {
            Log::warning('manager-dashboard-fallback', [
                'manager_id' => $managerId,
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
            'team_resellers' => 0,
            'team_customers' => 0,
            'active_licenses' => 0,
            'team_revenue' => 0,
            'monthly_activations' => 0,
        ];
    }

    /**
     * @return array<int, array{month: string, count: int, revenue: int}>
     */
    private function defaultActivationsChartData(): array
    {
        return collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset))
            ->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'count' => 0,
                'revenue' => 0,
            ])
            ->values()
            ->all();
    }
}
