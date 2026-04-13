<?php

namespace App\Http\Controllers\Reseller;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

abstract class BaseResellerController extends Controller
{
    protected function currentTenantId(Request $request): int
    {
        return (int) $request->user()?->tenant_id;
    }

    protected function currentReseller(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    protected function customerQuery(Request $request)
    {
        $resellerId = $this->currentReseller($request)->id;

        $customerIds = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('reseller_id', $resellerId)
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('id', $customerIds);
    }

    protected function licenseQuery(Request $request)
    {
        return License::query()->where('reseller_id', $this->currentReseller($request)->id);
    }

    protected function resolveCustomer(Request $request, User $user): User
    {
        abort_unless(
            $user->tenant_id === $this->currentTenantId($request)
                && ($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value
                && $this->customerQuery($request)->whereKey($user->id)->exists(),
            404,
        );

        return $user;
    }

    protected function resolveLicense(Request $request, License $license): License
    {
        abort_unless($license->reseller_id === $this->currentReseller($request)->id, 404);

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
