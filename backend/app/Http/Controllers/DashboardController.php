<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Controllers\ManagerParent\DashboardController as ManagerParentDashboardController;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $usersCount = (clone $usersQuery)->count();
        $teamMembers = (clone $usersQuery)->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])->count();
        $customers = (clone $usersQuery)->where('role', UserRole::CUSTOMER->value)->count();
        $monthlyRevenue = (float) License::query()
            ->whereBetween('activated_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('price');

        return response()->json([
            'stats' => [
                'users' => $usersCount,
                'programs' => Program::query()->count(),
                'licenses' => License::query()->count(),
                'active_licenses' => License::query()->where('status', 'active')->count(),
                'revenue' => (float) License::query()->sum('price'),
                'team_members' => $teamMembers,
                'total_customers' => $customers,
                'monthly_revenue' => round($monthlyRevenue, 2),
            ],
        ]);
    }
}
