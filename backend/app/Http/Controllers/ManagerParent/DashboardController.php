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

class DashboardController extends BaseManagerParentController
{
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);
        $usersQuery = User::query()->where('tenant_id', $tenantId);

        return response()->json([
            'stats' => [
                'users' => (clone $usersQuery)->count(),
                'programs' => Program::query()->count(),
                'licenses' => License::query()->count(),
                'active_licenses' => License::query()->where('status', 'active')->count(),
                'revenue' => round((float) License::query()->sum('price'), 2),
                'team_members' => (clone $usersQuery)->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])->count(),
                'total_customers' => (clone $usersQuery)->where('role', UserRole::CUSTOMER->value)->count(),
                'monthly_revenue' => round((float) License::query()
                    ->whereBetween('activated_at', [now()->startOfMonth(), now()->endOfMonth()])
                    ->sum('price'), 2),
            ],
        ]);
    }

    public function revenueChart(): JsonResponse
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
                'revenue' => round((float) ($totals[$month->format('Y-m')] ?? 0), 2),
            ])->values(),
        ]);
    }

    public function expiryForecast(): JsonResponse
    {
        $today = now();

        return response()->json([
            'data' => [
                ['range' => '0-30', 'count' => License::query()->whereBetween('expires_at', [$today, $today->copy()->addDays(30)])->count()],
                ['range' => '31-60', 'count' => License::query()->whereBetween('expires_at', [$today->copy()->addDays(31), $today->copy()->addDays(60)])->count()],
                ['range' => '61-90', 'count' => License::query()->whereBetween('expires_at', [$today->copy()->addDays(61), $today->copy()->addDays(90)])->count()],
            ],
        ]);
    }

    public function teamPerformance(Request $request): JsonResponse
    {
        $team = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->get()
            ->map(function (User $user): array {
                $licenses = License::query()->where('reseller_id', $user->id)->get();

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role?->value ?? (string) $user->role,
                    'activations' => $licenses->count(),
                    'revenue' => round((float) $licenses->sum('price'), 2),
                    'customers' => $licenses->pluck('customer_id')->filter()->unique()->count(),
                ];
            })
            ->sortByDesc('revenue')
            ->values();

        return response()->json(['data' => $team]);
    }

    public function conflictRate(): JsonResponse
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $conflicts = BiosConflict::query()
            ->get()
            ->groupBy(fn (BiosConflict $conflict): string => $conflict->created_at?->format('Y-m') ?? '');

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'count' => $conflicts->get($month->format('Y-m'))?->count() ?? 0,
            ])->values(),
        ]);
    }
}
