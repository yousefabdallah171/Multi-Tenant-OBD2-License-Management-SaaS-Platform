<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UserController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['nullable', 'in:'.implode(',', UserRole::values())],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = User::query()->with('tenant')->latest();

        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', $validated['tenant_id']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%');
            });
        }

        $users = $query->paginate($perPage);

        $roleCounts = collect(UserRole::cases())
            ->mapWithKeys(fn (UserRole $role): array => [$role->value => User::query()->where('role', $role->value)->count()]);

        return response()->json([
            'data' => collect($users->items())->map(fn (User $user): array => $this->serializeUser($user))->values(),
            'meta' => $this->paginationMeta($users),
            'role_counts' => $roleCounts,
        ]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended,inactive'],
        ]);

        $user->update(['status' => $validated['status']]);

        return response()->json([
            'data' => $this->serializeUser($user->fresh('tenant')),
        ]);
    }

    public function show(User $user): JsonResponse
    {
        $member = $user->load('tenant');
        $stats = $this->memberStats($member);

        $recentLicensesQuery = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->when($member->tenant_id, fn ($query) => $query->where('tenant_id', $member->tenant_id));

        if (($member->role?->value ?? (string) $member->role) === UserRole::CUSTOMER->value) {
            $recentLicensesQuery->where('customer_id', $member->id);
        } else {
            $recentLicensesQuery->where('reseller_id', $member->id);
        }

        $recentLicenses = $recentLicensesQuery
            ->latest('activated_at')
            ->limit(10)
            ->get()
            ->map(fn (License $license): array => [
                'id' => $license->id,
                'customer' => $license->customer ? [
                    'id' => $license->customer->id,
                    'name' => $license->customer->name,
                    'email' => $license->customer->email,
                ] : null,
                'program' => $license->program?->name,
                'bios_id' => $license->bios_id,
                'status' => $license->status,
                'price' => (float) $license->price,
                'expires_at' => $license->expires_at?->toIso8601String(),
            ])
            ->values();

        $recentActivity = ActivityLog::query()
            ->when($member->tenant_id, fn ($query) => $query->where('tenant_id', $member->tenant_id))
            ->where(function ($query) use ($member): void {
                $query->where('user_id', $member->id)
                    ->orWhere('metadata->customer_id', $member->id)
                    ->orWhere('metadata->target_user_id', $member->id);
            })
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'action' => $activity->action,
                'description' => $activity->description,
                'metadata' => $activity->metadata ?? [],
                'created_at' => $activity->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeUser($member),
                'customers_count' => $stats['customers'],
                'active_licenses_count' => $stats['active_licenses'],
                'revenue' => $stats['revenue'],
                'recent_licenses' => $recentLicenses,
                'recent_activity' => $recentActivity,
            ],
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()?->is($user)) {
            return response()->json([
                'message' => 'You cannot delete the current authenticated user.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'phone' => $user->phone,
            'role' => $user->role?->value ?? (string) $user->role,
            'status' => $user->status,
            'tenant' => $user->tenant ? [
                'id' => $user->tenant->id,
                'name' => $user->tenant->name,
                'slug' => $user->tenant->slug,
                'status' => $user->tenant->status,
            ] : null,
            'username_locked' => $user->username_locked,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array{customers:int,active_licenses:int,revenue:float}
     */
    private function memberStats(User $user): array
    {
        $query = License::query()->when($user->tenant_id, fn ($builder) => $builder->where('tenant_id', $user->tenant_id));

        if (($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value) {
            $licenses = $query->where('customer_id', $user->id)->get();

            return [
                'customers' => 0,
                'active_licenses' => $licenses->where('status', 'active')->count(),
                'revenue' => round((float) $licenses->sum('price'), 2),
            ];
        }

        $licenses = $query->where('reseller_id', $user->id)->get();

        return [
            'customers' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
        ];
    }
}
