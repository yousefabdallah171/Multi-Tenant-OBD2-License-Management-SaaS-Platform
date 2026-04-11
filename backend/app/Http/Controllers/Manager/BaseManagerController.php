<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

abstract class BaseManagerController extends Controller
{
    protected function currentTenantId(Request $request): int
    {
        return (int) $request->user()?->tenant_id;
    }

    protected function currentManager(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /**
     * @return list<int>
     */
    protected function teamResellerIds(Request $request): array
    {
        return $this->teamResellersQuery($request)->pluck('id')->all();
    }

    /**
     * @return list<int>
     */
    protected function teamSellerIds(Request $request): array
    {
        return [
            $this->currentManager($request)->id,
            ...$this->teamResellerIds($request),
        ];
    }

    protected function teamResellersQuery(Request $request)
    {
        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->where('created_by', $this->currentManager($request)->id);
    }

    protected function teamCustomersQuery(Request $request)
    {
        $sellerIds = $this->teamSellerIds($request);
        $customerIds = License::query()
            ->whereIn('reseller_id', $sellerIds)
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('id', $customerIds);
    }

    protected function currentOwnedCustomerCount(Request $request): int
    {
        return CustomerOwnership::currentOwnedCustomerCount($this->teamSellerIds($request), $this->currentTenantId($request));
    }

    protected function teamUsersQuery(Request $request)
    {
        $sellerIds = $this->teamSellerIds($request);
        $customerIds = License::query()
            ->whereIn('reseller_id', $sellerIds)
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where(function ($builder) use ($sellerIds, $customerIds): void {
                $builder
                    ->whereIn('id', $sellerIds)
                    ->orWhereIn('id', $customerIds);
            });
    }

    protected function resolveTeamReseller(Request $request, User $user): User
    {
        abort_unless(
            $user->tenant_id === $this->currentTenantId($request)
                && ($user->role?->value ?? (string) $user->role) === UserRole::RESELLER->value
                && (int) $user->created_by === $this->currentManager($request)->id,
            404,
        );

        return $user;
    }

    protected function resolveManagedSeller(Request $request, User $user): User
    {
        $role = $user->role?->value ?? (string) $user->role;

        abort_unless($user->tenant_id === $this->currentTenantId($request), 404);

        if ($user->id === $this->currentManager($request)->id && $role === UserRole::MANAGER->value) {
            return $user;
        }

        return $this->resolveTeamReseller($request, $user);
    }

    protected function resolveTeamUser(Request $request, User $user): User
    {
        $role = $user->role?->value ?? (string) $user->role;

        if ($role === UserRole::RESELLER->value) {
            return $this->resolveTeamReseller($request, $user);
        }

        $sellerIds = $this->teamSellerIds($request);

        abort_unless(
            License::query()
                ->whereIn('reseller_id', $sellerIds)
                ->where('customer_id', $user->id)
                ->exists(),
            404,
        );

        return $user;
    }

    protected function resolveTeamLicense(Request $request, License $license): License
    {
        abort_unless(in_array($license->reseller_id, $this->teamSellerIds($request), true), 404);

        return $license;
    }

    protected function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    protected function paginateCollection(Collection $items, int $page, int $perPage): LengthAwarePaginator
    {
        return new LengthAwarePaginator(
            $items->forPage($page, $perPage)->values(),
            $items->count(),
            $perPage,
            $page,
            [
                'path' => request()->url(),
                'query' => request()->query(),
            ],
        );
    }

    protected function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }
}
