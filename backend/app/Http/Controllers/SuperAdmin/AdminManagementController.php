<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AdminManagementController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['nullable', 'in:super_admin,manager_parent,manager,reseller'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = User::query()
            ->with('tenant')
            ->where('role', '!=', UserRole::CUSTOMER->value)
            ->latest();

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
                    ->orWhere('email', 'like', '%'.$validated['search'].'%');
            });
        }

        $admins = $query->paginate($perPage);

        return response()->json([
            'data' => collect($admins->items())->map(fn (User $user): array => $this->serializeAdmin($user))->values(),
            'meta' => $this->paginationMeta($admins),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'in:super_admin,manager_parent,manager,reseller'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        if ($validated['role'] !== UserRole::SUPER_ADMIN->value && empty($validated['tenant_id'])) {
            return response()->json(['message' => 'Tenant assignment is required for non-super-admin accounts.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $admin = DB::transaction(function () use ($request, $validated): User {
            $user = User::query()->create([
                'tenant_id' => $validated['role'] === UserRole::SUPER_ADMIN->value ? null : $validated['tenant_id'],
                'name' => $validated['name'],
                'username' => Str::slug($validated['name']).'-'.Str::lower(Str::random(4)),
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password']),
                'role' => $validated['role'],
                'status' => 'active',
                'created_by' => $request->user()?->id,
                'username_locked' => false,
            ]);

            $this->logActivity($request, 'admin.create', sprintf('Created admin account for %s.', $user->email), [
                'target_user_id' => $user->id,
                'role' => $validated['role'],
            ]);

            return $user->fresh('tenant');
        });

        return response()->json(['data' => $this->serializeAdmin($admin)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['sometimes', 'in:super_admin,manager_parent,manager,reseller'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'status' => ['sometimes', 'in:active,suspended,inactive'],
        ]);

        $user->update([
            ...$validated,
            'tenant_id' => ($validated['role'] ?? ($user->role?->value ?? $user->role)) === UserRole::SUPER_ADMIN->value
                ? null
                : ($validated['tenant_id'] ?? $user->tenant_id),
        ]);

        $this->logActivity($request, 'admin.update', sprintf('Updated admin account for %s.', $user->email), [
            'target_user_id' => $user->id,
        ]);

        return response()->json(['data' => $this->serializeAdmin($user->fresh('tenant'))]);
    }

    public function show(User $user): JsonResponse
    {
        abort_if(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, Response::HTTP_NOT_FOUND);

        $member = $user->load('tenant');
        $stats = $this->memberStats($member);

        $recentLicenses = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->when($member->tenant_id, fn ($query) => $query->where('tenant_id', $member->tenant_id))
            ->where('reseller_id', $member->id)
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
            ->where('user_id', $member->id)
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
                ...$this->serializeAdmin($member),
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
            return response()->json(['message' => 'You cannot delete the current authenticated user.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $email = $user->email;
        $user->delete();

        $this->logActivity($request, 'admin.delete', sprintf('Deleted admin account for %s.', $email), [
            'target_email' => $email,
        ]);

        return response()->json(['message' => 'Admin deleted successfully.']);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'new_password' => ['nullable', 'string', 'min:8'],
        ]);

        $newPassword = $validated['new_password'] ?? Str::password(12, true, true, true, false);
        $user->update(['password' => Hash::make($newPassword)]);

        $this->logActivity($request, 'admin.reset_password', sprintf('Reset password for %s.', $user->email), [
            'target_user_id' => $user->id,
        ]);

        return response()->json([
            'message' => 'Password reset successfully.',
            'temporary_password' => $newPassword,
        ]);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }

    /**
     * @return array{customers:int,active_licenses:int,revenue:float}
     */
    private function memberStats(User $user): array
    {
        $licenses = License::query()
            ->when($user->tenant_id, fn ($query) => $query->where('tenant_id', $user->tenant_id))
            ->where('reseller_id', $user->id)
            ->get();

        return [
            'customers' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeAdmin(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role?->value ?? (string) $user->role,
            'status' => $user->status,
            'username_locked' => $user->username_locked,
            'tenant' => $user->tenant ? [
                'id' => $user->tenant->id,
                'name' => $user->tenant->name,
            ] : null,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
