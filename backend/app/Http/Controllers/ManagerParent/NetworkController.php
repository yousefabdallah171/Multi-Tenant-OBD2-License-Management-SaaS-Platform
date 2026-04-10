<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserBalance;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class NetworkController extends BaseManagerParentController
{
    private const TEAM_NETWORK_TTL_SECONDS = 15;

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);
        $managerParent = $this->currentManagerParent($request);

        $payload = Cache::remember(
            self::cacheKey($tenantId),
            now()->addSeconds(self::TEAM_NETWORK_TTL_SECONDS),
            function () use ($managerParent, $tenantId): array {
                $tenant = Tenant::query()->findOrFail($tenantId);
                $team = User::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
                    ->select(['id', 'tenant_id', 'name', 'role', 'status', 'created_by'])
                    ->get();

                $managerParents = $team
                    ->filter(fn (User $user): bool => ($user->role?->value ?? (string) $user->role) === UserRole::MANAGER_PARENT->value)
                    ->values();
                $managers = $team
                    ->filter(fn (User $user): bool => ($user->role?->value ?? (string) $user->role) === UserRole::MANAGER->value)
                    ->values();
                $resellers = $team
                    ->filter(fn (User $user): bool => ($user->role?->value ?? (string) $user->role) === UserRole::RESELLER->value)
                    ->values();

                $managerParentIdSet = $managerParents
                    ->pluck('id')
                    ->mapWithKeys(fn (int $id): array => [$id => true])
                    ->all();

                $managersByParent = $managers
                    ->filter(fn (User $manager): bool => isset($managerParentIdSet[(int) $manager->created_by]))
                    ->groupBy(fn (User $manager): int => (int) $manager->created_by);

                $managerIdSet = $managers
                    ->pluck('id')
                    ->mapWithKeys(fn (int $id): array => [$id => true])
                    ->all();

                $directResellersByParent = $resellers
                    ->filter(fn (User $reseller): bool => isset($managerParentIdSet[(int) $reseller->created_by]))
                    ->groupBy(fn (User $reseller): int => (int) $reseller->created_by);

                $resellersByManager = $resellers
                    ->filter(fn (User $reseller): bool => isset($managerIdSet[(int) $reseller->created_by]))
                    ->groupBy(fn (User $reseller): int => (int) $reseller->created_by);

                $resellerIds = $resellers->pluck('id')->map(fn (int $id): int => (int) $id)->all();
                $sellerIds = collect([
                    ...$managerParents->pluck('id')->all(),
                    ...$managers->pluck('id')->all(),
                    ...$resellerIds,
                ])->map(fn (int $id): int => (int) $id)->unique()->values()->all();

                $sellerMetrics = $this->sellerMetrics($tenantId, $sellerIds);
                $licenseStats = $sellerMetrics['stats'];
                $customerIdsBySeller = $sellerMetrics['customer_ids'];
                $activationCountsBySeller = $sellerMetrics['activation_counts'];

                $managerParentRevenues = RevenueAnalytics::revenueBySellerIds($managerParents->pluck('id')->all(), $tenantId);
                $managerRevenues = RevenueAnalytics::revenueBySellerIds($managers->pluck('id')->all(), $tenantId);
                $resellerRevenues = RevenueAnalytics::revenueBySellerIds($resellerIds, $tenantId);
                $totalRevenue = RevenueAnalytics::totalRevenue([], $tenantId);
                $balancesByManagerParent = $this->balancesByManagerParent($managerParents->pluck('id')->all());
                $totalBalance = (float) $balancesByManagerParent->sum();

                return [
                    'root' => [
                        'id' => (int) $tenant->id,
                        'name' => $tenant->name,
                        'role' => 'tenant',
                        'total_revenue' => round($totalRevenue, 2),
                        'balance' => round($totalBalance, 2),
                        'manager_parents_count' => (int) $managerParents->count(),
                        'managers_count' => (int) $managers->count(),
                        'resellers_count' => (int) $resellers->count(),
                        'total_customers' => (int) $this->countDistinctCustomers($customerIdsBySeller, $sellerIds),
                    ],
                    'manager_parents' => $managerParents
                        ->map(fn (User $parent): array => $this->serializeManagerParent(
                            $parent,
                            $managerParent,
                            $managersByParent,
                            $directResellersByParent,
                            $resellersByManager,
                            $managerParentRevenues,
                            $managerRevenues,
                            $resellerRevenues,
                            $balancesByManagerParent,
                            $customerIdsBySeller,
                        ))
                        ->values()
                        ->all(),
                    'managers' => $managers
                        ->map(fn (User $manager): array => $this->serializeManager(
                            $manager,
                            $managerParentIdSet,
                            $resellersByManager,
                            $customerIdsBySeller,
                            $activationCountsBySeller,
                            $managerRevenues,
                            $resellerRevenues,
                        ))
                        ->values()
                        ->all(),
                    'resellers' => $resellers
                        ->map(fn (User $reseller): array => $this->serializeReseller(
                            $reseller,
                            $managerIdSet,
                            $managerParentIdSet,
                            $licenseStats,
                            $resellerRevenues,
                        ))
                        ->values()
                        ->all(),
                ];
            },
        );

        return response()->json(['data' => $payload]);
    }

    private function serializeManagerParent(
        User $managerParent,
        User $currentManagerParent,
        Collection $managersByParent,
        Collection $directResellersByParent,
        Collection $resellersByManager,
        Collection $managerParentRevenues,
        Collection $managerRevenues,
        Collection $resellerRevenues,
        Collection $balancesByManagerParent,
        Collection $customerIdsBySeller,
    ): array {
        $managedManagers = $managersByParent->get((int) $managerParent->id, collect());
        $directResellers = $directResellersByParent->get((int) $managerParent->id, collect());
        $managedResellers = $managedManagers
            ->flatMap(fn (User $manager) => $resellersByManager->get((int) $manager->id, collect()))
            ->values();

        $subtreeSellerIds = collect([
            (int) $managerParent->id,
            ...$managedManagers->pluck('id')->all(),
            ...$directResellers->pluck('id')->all(),
            ...$managedResellers->pluck('id')->all(),
        ])->unique()->values()->all();

        $revenue = (float) ($managerParentRevenues->get((int) $managerParent->id) ?? 0)
            + (float) $managedManagers->sum(fn (User $manager): float => (float) ($managerRevenues->get((int) $manager->id) ?? 0))
            + (float) $directResellers->sum(fn (User $reseller): float => (float) ($resellerRevenues->get((int) $reseller->id) ?? 0))
            + (float) $managedResellers->sum(fn (User $reseller): float => (float) ($resellerRevenues->get((int) $reseller->id) ?? 0));

        return [
            'id' => (int) $managerParent->id,
            'name' => $managerParent->name,
            'role' => UserRole::MANAGER_PARENT->value,
            'status' => (string) $managerParent->status,
            'revenue' => round($revenue, 2),
            'balance' => round((float) ($balancesByManagerParent->get((int) $managerParent->id) ?? 0), 2),
            'managers_count' => (int) $managedManagers->count(),
            'resellers_count' => (int) ($directResellers->count() + $managedResellers->count()),
            'customers_count' => (int) $this->countDistinctCustomers($customerIdsBySeller, $subtreeSellerIds),
            'is_current' => (int) $managerParent->id === (int) $currentManagerParent->id,
        ];
    }

    private function serializeManager(
        User $manager,
        array $managerParentIdSet,
        Collection $resellersByManager,
        Collection $customerIdsBySeller,
        Collection $activationCountsBySeller,
        Collection $managerRevenues,
        Collection $resellerRevenues,
    ): array {
        $managedResellers = $resellersByManager->get((int) $manager->id, collect());
        $managedResellerIds = $managedResellers->pluck('id')->all();
        $subtreeSellerIds = [(int) $manager->id, ...$managedResellerIds];

        $activationsCount = (int) ($activationCountsBySeller->get((int) $manager->id) ?? 0)
            + (int) collect($managedResellerIds)->sum(fn (int $resellerId): int => (int) ($activationCountsBySeller->get($resellerId) ?? 0));

        $revenue = (float) ($managerRevenues->get((int) $manager->id) ?? 0)
            + (float) collect($managedResellerIds)->sum(fn (int $resellerId): float => (float) ($resellerRevenues->get($resellerId) ?? 0));

        return [
            'id' => (int) $manager->id,
            'name' => $manager->name,
            'role' => UserRole::MANAGER->value,
            'status' => (string) $manager->status,
            'manager_parent_id' => isset($managerParentIdSet[(int) $manager->created_by]) ? (int) $manager->created_by : null,
            'revenue' => round($revenue, 2),
            'resellers_count' => (int) $managedResellers->count(),
            'customers_count' => (int) $this->countDistinctCustomers($customerIdsBySeller, $subtreeSellerIds),
            'activations_count' => (int) $activationsCount,
        ];
    }

    private function serializeReseller(
        User $reseller,
        array $managerIdSet,
        array $managerParentIdSet,
        Collection $licenseStats,
        Collection $resellerRevenues,
    ): array {
        $managerId = isset($managerIdSet[(int) $reseller->created_by]) ? (int) $reseller->created_by : null;
        $managerParentId = $managerId === null && isset($managerParentIdSet[(int) $reseller->created_by]) ? (int) $reseller->created_by : null;
        $stats = $licenseStats->get((int) $reseller->id);

        return [
            'id' => (int) $reseller->id,
            'name' => $reseller->name,
            'role' => UserRole::RESELLER->value,
            'status' => (string) $reseller->status,
            'manager_id' => $managerId,
            'manager_parent_id' => $managerParentId,
            'revenue' => round((float) ($resellerRevenues->get((int) $reseller->id) ?? 0), 2),
            'activations_count' => (int) ($stats?->activations ?? 0),
            'customers_count' => (int) ($stats?->customers ?? 0),
        ];
    }

    private function sellerMetrics(int $tenantId, array $sellerIds): array
    {
        if ($sellerIds === []) {
            return [
                'stats' => collect(),
                'customer_ids' => collect(),
                'activation_counts' => collect(),
            ];
        }

        $licenseRows = License::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('reseller_id', $sellerIds)
            ->get(['reseller_id', 'customer_id']);

        $activationCounts = $licenseRows
            ->groupBy('reseller_id')
            ->map(fn (Collection $rows): int => $rows->count());

        $customerIdsBySeller = $licenseRows
            ->groupBy('reseller_id')
            ->map(fn (Collection $rows): array => $rows->pluck('customer_id')->filter()->unique()->map(fn ($id): int => (int) $id)->values()->all());

        $stats = collect($sellerIds)
            ->mapWithKeys(fn (int $sellerId): array => [
                $sellerId => (object) [
                    'activations' => (int) ($activationCounts->get($sellerId) ?? 0),
                    'customers' => count($customerIdsBySeller->get($sellerId, [])),
                ],
            ]);

        return [
            'stats' => $stats,
            'customer_ids' => $customerIdsBySeller,
            'activation_counts' => $activationCounts,
        ];
    }

    private function balancesByManagerParent(array $managerParentIds): Collection
    {
        if ($managerParentIds === []) {
            return collect();
        }

        return UserBalance::query()
            ->whereIn('user_id', $managerParentIds)
            ->pluck('pending_balance', 'user_id')
            ->map(fn ($value): float => round((float) $value, 2));
    }

    private function countDistinctCustomers(Collection $customerIdsBySeller, array $sellerIds): int
    {
        return collect($sellerIds)
            ->flatMap(fn (int $sellerId): array => $customerIdsBySeller->get($sellerId, []))
            ->unique()
            ->count();
    }
    public static function forgetTenantCache(int $tenantId): void
    {
        Cache::forget(self::cacheKey($tenantId));
    }

    private static function cacheKey(int $tenantId): string
    {
        return "team-network:{$tenantId}";
    }
}
