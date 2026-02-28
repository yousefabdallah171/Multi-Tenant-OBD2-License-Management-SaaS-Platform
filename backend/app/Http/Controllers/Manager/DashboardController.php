<?php

namespace App\Http\Controllers\Manager;

use App\Models\ActivityLog;
use App\Models\License;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends BaseManagerController
{
    public function stats(Request $request): JsonResponse
    {
        $resellerIds = $this->teamResellerIds($request);
        $licenses = License::query()->whereIn('reseller_id', $resellerIds)->get();

        return response()->json([
            'stats' => [
                'team_resellers' => count($resellerIds),
                'team_customers' => $this->teamCustomersQuery($request)->count(),
                'active_licenses' => $licenses->where('status', 'active')->count(),
                'team_revenue' => round((float) $licenses->sum('price'), 2),
                'monthly_activations' => $licenses
                    ->filter(fn (License $license): bool => $license->activated_at?->isCurrentMonth() ?? false)
                    ->count(),
            ],
        ]);
    }

    public function activationsChart(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->monthlySeries(
                License::query()->whereIn('reseller_id', $this->teamResellerIds($request))->get(),
                fn ($bucket): int => $bucket->count(),
            ),
        ]);
    }

    public function revenueChart(Request $request): JsonResponse
    {
        $resellers = $this->teamResellersQuery($request)->get();

        return response()->json([
            'data' => $resellers
                ->map(function ($reseller): array {
                    $licenses = License::query()->where('reseller_id', $reseller->id)->get();

                    return [
                        'reseller' => $reseller->name,
                        'revenue' => round((float) $licenses->sum('price'), 2),
                        'activations' => $licenses->count(),
                    ];
                })
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function recentActivity(Request $request): JsonResponse
    {
        $userIds = [$this->currentManager($request)->id, ...$this->teamResellerIds($request)];

        $activity = ActivityLog::query()
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
            ->values();

        return response()->json(['data' => $activity]);
    }

    private function monthlySeries($licenses, callable $resolver)
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));
        $grouped = $licenses
            ->filter(fn (License $license): bool => $license->activated_at !== null)
            ->groupBy(fn (License $license): string => $license->activated_at->format('Y-m'));

        return $months->map(function (CarbonImmutable $month) use ($grouped, $resolver): array {
            $bucket = $grouped->get($month->format('Y-m'), collect());
            $value = $resolver($bucket);

            return [
                'month' => $month->format('M Y'),
                'count' => $value,
                'revenue' => $value,
            ];
        })->values();
    }
}
