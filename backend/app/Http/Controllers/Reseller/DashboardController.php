<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ActivityLog;
use App\Models\License;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends BaseResellerController
{
    public function stats(Request $request): JsonResponse
    {
        $licenses = $this->licenseQuery($request)->get();

        return response()->json([
            'stats' => [
                'customers' => $licenses->pluck('customer_id')->filter()->unique()->count(),
                'active_licenses' => $licenses->where('status', 'active')->count(),
                'revenue' => round((float) $licenses->sum('price'), 2),
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
                $this->licenseQuery($request)->get(),
                fn ($bucket): int => $bucket->count(),
            ),
        ]);
    }

    public function revenueChart(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->monthlySeries(
                $this->licenseQuery($request)->get(),
                fn ($bucket): float => round((float) $bucket->sum('price'), 2),
            ),
        ]);
    }

    public function recentActivity(Request $request): JsonResponse
    {
        $activity = ActivityLog::query()
            ->where('user_id', $this->currentReseller($request)->id)
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'metadata' => $entry->metadata ?? [],
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
