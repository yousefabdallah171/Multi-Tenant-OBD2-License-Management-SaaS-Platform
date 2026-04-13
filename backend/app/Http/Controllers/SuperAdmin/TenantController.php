<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\DeletedCustomer;
use App\Models\Tenant;
use App\Models\User;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class TenantController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = Tenant::query()
            ->withCount([
                'users as users_count',
                'users as managers_count' => fn ($builder) => $builder->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value]),
                'users as resellers_count' => fn ($builder) => $builder->where('role', UserRole::RESELLER->value),
                'users as customers_count' => fn ($builder) => $builder->where('role', UserRole::CUSTOMER->value),
                'licenses as active_licenses_count' => fn ($builder) => $builder->where('status', 'active'),
            ])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where('name', 'like', '%'.$validated['search'].'%');
        }

        $statusCountsQuery = clone $query;

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $tenants = $query->paginate($perPage);

        $revenueByTenant = RevenueAnalytics::revenueByTenantIds(collect($tenants->items())->pluck('id')->all());

        return response()->json([
            'data' => collect($tenants->items())->map(fn (Tenant $tenant): array => $this->serializeTenant($tenant, $revenueByTenant))->values(),
            'meta' => $this->paginationMeta($tenants),
            'status_counts' => [
                'all' => (clone $statusCountsQuery)->count(),
                'active' => (clone $statusCountsQuery)->where('status', 'active')->count(),
                'suspended' => (clone $statusCountsQuery)->where('status', 'suspended')->count(),
                'inactive' => (clone $statusCountsQuery)->where('status', 'inactive')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'manager_name' => ['required', 'string', 'max:255'],
            'manager_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'manager_password' => ['required', 'string', 'min:8'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
        ]);

        $result = DB::transaction(function () use ($request, $validated): array {
            $tenant = Tenant::query()->create([
                'name' => $validated['name'],
                'slug' => $this->resolveUniqueSlug($validated['name']),
                'status' => $validated['status'] ?? 'active',
                'settings' => ['currency' => 'USD'],
            ]);

            $manager = User::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $validated['manager_name'],
                'username' => Str::slug($validated['manager_name']),
                'email' => $validated['manager_email'],
                'password' => Hash::make($validated['manager_password']),
                'role' => UserRole::MANAGER_PARENT,
                'status' => 'active',
                'created_by' => $request->user()?->id,
                'username_locked' => false,
            ]);

            return [
                'tenant' => $tenant->fresh(),
                'manager' => $manager->fresh('tenant'),
            ];
        });

        return response()->json([
            'data' => [
                'tenant' => $this->serializeTenant($result['tenant']),
                'manager' => $result['manager'],
            ],
        ], 201);
    }

    public function show(Tenant $tenant): JsonResponse
    {
        $tenant->loadCount([
            'users as users_count',
            'users as managers_count' => fn ($builder) => $builder->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value]),
            'users as resellers_count' => fn ($builder) => $builder->where('role', UserRole::RESELLER->value),
            'users as customers_count' => fn ($builder) => $builder->where('role', UserRole::CUSTOMER->value),
            'licenses as active_licenses_count' => fn ($builder) => $builder->where('status', 'active'),
        ]);

        return response()->json([
            'data' => $this->serializeTenant($tenant, collect([$tenant->id => RevenueAnalytics::totalRevenue([], $tenant->id)])),
        ]);
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:active,suspended,inactive'],
            'settings' => ['sometimes', 'array'],
        ]);

        $tenant->update($validated);

        return response()->json([
            'data' => $this->serializeTenant($tenant->fresh()),
        ]);
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        $tenant->update(['status' => 'inactive']);

        return response()->json([
            'message' => 'Tenant marked as inactive.',
        ]);
    }

    public function stats(Tenant $tenant): JsonResponse
    {
        return response()->json([
            'data' => [
                'users' => $tenant->users()->count(),
                'managers' => $tenant->users()->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])->count(),
                'resellers' => $tenant->users()->where('role', UserRole::RESELLER->value)->count(),
                'customers' => $tenant->users()->where('role', UserRole::CUSTOMER->value)->count(),
                'licenses' => $tenant->licenses()->count(),
                'active_licenses' => $tenant->licenses()->where('status', 'active')->count(),
                'revenue' => RevenueAnalytics::totalRevenue([], $tenant->id),
                'deleted_customers' => DeletedCustomer::query()->where('tenant_id', $tenant->id)->count(),
            ],
        ]);
    }

    public function assignableManagers(Request $request, Tenant $tenant): JsonResponse
    {
        $managers = User::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
            ->orderByRaw('FIELD(role, ?, ?)', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        return response()->json([
            'data' => $managers->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? (string) $user->role,
            ])->values(),
        ]);
    }

    private function resolveUniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $counter = 2;

        while (Tenant::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTenant(Tenant $tenant, ?Collection $revenueByTenant = null): array
    {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'status' => $tenant->status,
            'settings' => $tenant->settings,
            'users_count' => (int) ($tenant->users_count ?? 0),
            'managers_count' => (int) ($tenant->managers_count ?? 0),
            'resellers_count' => (int) ($tenant->resellers_count ?? 0),
            'customers_count' => (int) ($tenant->customers_count ?? 0),
            'active_licenses_count' => (int) ($tenant->active_licenses_count ?? 0),
            'revenue' => round((float) ($revenueByTenant?->get($tenant->id) ?? 0), 2),
            'created_at' => $tenant->created_at?->toIso8601String(),
        ];
    }
}
