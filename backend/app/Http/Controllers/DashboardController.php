<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Controllers\ManagerParent\DashboardController as ManagerParentDashboardController;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user?->role === UserRole::MANAGER_PARENT) {
            return app(ManagerParentDashboardController::class)->stats($request);
        }

        $tenantId = ($user?->role === UserRole::SUPER_ADMIN || $user?->tenant_id === null) ? null : (int) $user->tenant_id;

        $usersQuery = User::query();

        if ($tenantId !== null) {
            $usersQuery->where('tenant_id', $tenantId);
        }

        $cacheKey = $tenantId === null ? 'dashboard:global:stats' : sprintf('dashboard:tenant:%d:stats', $tenantId);
        $stats = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($usersQuery, $tenantId): array {
            $roleCounts = (clone $usersQuery)
                ->selectRaw('role, COUNT(*) as total')
                ->groupBy('role')
                ->pluck('total', 'role');

            $licensesQuery = License::query();
            $programsQuery = Program::query();

            if ($tenantId !== null) {
                $licensesQuery->where('tenant_id', $tenantId);
                $programsQuery->where('tenant_id', $tenantId);
            }

            $licenseCounts = (clone $licensesQuery)
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status');

            $revenue = $tenantId === null
                ? RevenueAnalytics::totalRevenue()
                : RevenueAnalytics::totalRevenue([], $tenantId);
            $monthlyRevenue = $tenantId === null
                ? RevenueAnalytics::totalRevenue([
                    'from' => now()->startOfMonth()->toDateString(),
                    'to' => now()->endOfMonth()->toDateString(),
                ])
                : RevenueAnalytics::totalRevenue([
                    'from' => now()->startOfMonth()->toDateString(),
                    'to' => now()->endOfMonth()->toDateString(),
                ], $tenantId);

            return [
                'users' => (int) $roleCounts->sum(),
                'programs' => (int) $programsQuery->count(),
                'licenses' => (int) $licenseCounts->sum(),
                'active_licenses' => (int) ($licenseCounts['active'] ?? 0),
                'revenue' => $revenue,
                'team_members' => (int) (($roleCounts[UserRole::MANAGER->value] ?? 0) + ($roleCounts[UserRole::RESELLER->value] ?? 0)),
                'total_customers' => (int) ($roleCounts[UserRole::CUSTOMER->value] ?? 0),
                'monthly_revenue' => $monthlyRevenue,
            ];
        });

        return response()
            ->json(['stats' => $stats])
            ->header('Cache-Control', 'private, max-age=300');
    }
}
