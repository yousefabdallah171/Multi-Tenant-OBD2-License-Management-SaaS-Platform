<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
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

    protected function teamResellersQuery(Request $request)
    {
        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->where('created_by', $this->currentManager($request)->id);
    }

    protected function teamCustomersQuery(Request $request)
    {
        $resellerIds = $this->teamResellerIds($request);

        $query = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::CUSTOMER->value);

        if ($resellerIds === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($builder) use ($resellerIds): void {
            $builder
                ->whereIn('created_by', $resellerIds)
                ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $resellerIds));
        });
    }

    protected function teamUsersQuery(Request $request)
    {
        $resellerIds = $this->teamResellerIds($request);

        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where(function ($builder) use ($resellerIds): void {
                if ($resellerIds !== []) {
                    $builder
                        ->whereIn('id', $resellerIds)
                        ->orWhere(function ($customerBuilder) use ($resellerIds): void {
                            $customerBuilder
                                ->where('role', UserRole::CUSTOMER->value)
                                ->where(function ($teamCustomerBuilder) use ($resellerIds): void {
                                    $teamCustomerBuilder
                                        ->whereIn('created_by', $resellerIds)
                                        ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $resellerIds));
                                });
                        });
                } else {
                    $builder->whereRaw('1 = 0');
                }
            });
    }

    protected function resolveTeamReseller(Request $request, User $user): User
    {
        abort_unless(
            $user->tenant_id === $this->currentTenantId($request)
                && ($user->role?->value ?? (string) $user->role) === UserRole::RESELLER->value
                && $user->created_by === $this->currentManager($request)->id,
            404,
        );

        return $user;
    }

    protected function resolveTeamUser(Request $request, User $user): User
    {
        $role = $user->role?->value ?? (string) $user->role;

        if ($role === UserRole::RESELLER->value) {
            return $this->resolveTeamReseller($request, $user);
        }

        abort_unless(
            $role === UserRole::CUSTOMER->value
                && $this->teamCustomersQuery($request)->whereKey($user->id)->exists(),
            404,
        );

        return $user;
    }

    protected function resolveTeamLicense(Request $request, License $license): License
    {
        abort_unless(in_array($license->reseller_id, $this->teamResellerIds($request), true), 404);

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
