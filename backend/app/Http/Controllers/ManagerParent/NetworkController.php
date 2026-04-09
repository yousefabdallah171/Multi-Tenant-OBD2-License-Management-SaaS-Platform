<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class NetworkController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        // HIERARCHY NOTE: There is no manager_id column on users.
        // Reseller-to-manager grouping is derived at display time from users.created_by.
        // A reseller belongs to a manager only if its created_by value points to a user
        // with role=manager in the same tenant. This is not a durable assignment model.
        // If persistent manager assignment is needed in future, add a manager_id column.
        $tenantId = $this->currentTenantId($request);
        $managerParent = $this->currentManagerParent($request);

        $payload = Cache::remember(
            "team-network:{$tenantId}",
            now()->addSeconds(60),
            function () use ($managerParent, $tenantId): array {
                $team = User::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])
                    ->select(['id', 'tenant_id', 'name', 'role', 'status', 'created_by'])
                    ->get();

                $managers = $team
                    ->filter(fn (User $user): bool => ($user->role?->value ?? (string) $user->role) === UserRole::MANAGER->value)
                    ->values();
                $resellers = $team
                    ->filter(fn (User $user): bool => ($user->role?->value ?? (string) $user->role) === UserRole::RESELLER->value)
                    ->values();

                $managerIdSet = $managers
                    ->pluck('id')
                    ->mapWithKeys(fn (int $id): array => [$id => true])
                    ->all();

                $resellersByManager = $resellers
                    ->filter(fn (User $reseller): bool => isset($managerIdSet[(int) $reseller->created_by]))
                    ->groupBy(fn (User $reseller): int => (int) $reseller->created_by);

                $resellerIds = $resellers->pluck('id')->map(fn (int $id): int => (int) $id)->all();
                $licenseStats = $this->licenseStatsByReseller($resellerIds);
                $managerRevenues = RevenueAnalytics::revenueBySellerIds($managers->pluck('id')->all(), $tenantId);
                $resellerRevenues = RevenueAnalytics::revenueBySellerIds($resellerIds, $tenantId);
                $rootMetrics = $this->rootMetrics($managerParent->id);
                $totalRevenue = RevenueAnalytics::totalRevenue([], $tenantId);

                return [
                    'root' => [
                        'id' => (int) $managerParent->id,
                        'name' => $managerParent->name,
                        'role' => UserRole::MANAGER_PARENT->value,
                        'status' => (string) $managerParent->status,
                        'total_revenue' => round($totalRevenue, 2),
                        'balance' => round((float) ($rootMetrics->balance ?? 0), 2),
                        'managers_count' => (int) $managers->count(),
                        'resellers_count' => (int) $resellers->count(),
                        'total_customers' => (int) ($rootMetrics->total_customers ?? 0),
                    ],
                    'managers' => $managers
                        ->map(fn (User $manager): array => $this->serializeManager($manager, $resellersByManager, $licenseStats, $managerRevenues))
                        ->values()
                        ->all(),
                    'resellers' => $resellers
                        ->map(fn (User $reseller): array => $this->serializeReseller($reseller, $managerIdSet, $licenseStats, $resellerRevenues))
                        ->values()
                        ->all(),
                ];
            },
        );

        return response()->json(['data' => $payload]);
    }

    private function rootMetrics(int $managerParentId): User
    {
        /** @var User $user */
        $user = User::query()
            ->whereKey($managerParentId)
            ->select(['id', 'tenant_id'])
            ->selectSub(
                UserBalance::query()
                    ->selectRaw('COALESCE(pending_balance, 0)')
                    ->whereColumn('user_id', 'users.id')
                    ->limit(1),
                'balance',
            )
            ->selectSub(
                License::query()
                    ->selectRaw('COUNT(DISTINCT customer_id)')
                    ->whereColumn('tenant_id', 'users.tenant_id'),
                'total_customers',
            )
            ->firstOrFail();

        return $user;
    }

    private function licenseStatsByReseller(array $resellerIds): Collection
    {
        if ($resellerIds === []) {
            return collect();
        }

        return License::query()
            ->whereIn('reseller_id', $resellerIds)
            ->selectRaw('reseller_id, COUNT(*) as activations, COUNT(DISTINCT customer_id) as customers')
            ->groupBy('reseller_id')
            ->get()
            ->keyBy('reseller_id');
    }

    private function serializeManager(User $manager, Collection $resellersByManager, Collection $licenseStats, Collection $managerRevenues): array
    {
        $managedResellers = $resellersByManager->get((int) $manager->id, collect());
        $managedResellerIds = $managedResellers->pluck('id')->all();

        $activationsCount = collect($managedResellerIds)
            ->sum(fn (int $resellerId): int => (int) ($licenseStats->get($resellerId)?->activations ?? 0));
        $customersCount = collect($managedResellerIds)
            ->sum(fn (int $resellerId): int => (int) ($licenseStats->get($resellerId)?->customers ?? 0));

        return [
            'id' => (int) $manager->id,
            'name' => $manager->name,
            'role' => UserRole::MANAGER->value,
            'status' => (string) $manager->status,
            'revenue' => round((float) ($managerRevenues->get((int) $manager->id) ?? 0), 2),
            'resellers_count' => (int) $managedResellers->count(),
            'customers_count' => (int) $customersCount,
            'activations_count' => (int) $activationsCount,
        ];
    }

    private function serializeReseller(User $reseller, array $managerIdSet, Collection $licenseStats, Collection $resellerRevenues): array
    {
        $managerId = isset($managerIdSet[(int) $reseller->created_by]) ? (int) $reseller->created_by : null;
        $stats = $licenseStats->get((int) $reseller->id);

        return [
            'id' => (int) $reseller->id,
            'name' => $reseller->name,
            'role' => UserRole::RESELLER->value,
            'status' => (string) $reseller->status,
            'manager_id' => $managerId,
            'revenue' => round((float) ($resellerRevenues->get((int) $reseller->id) ?? 0), 2),
            'activations_count' => (int) ($stats?->activations ?? 0),
            'customers_count' => (int) ($stats?->customers ?? 0),
        ];
    }
}
