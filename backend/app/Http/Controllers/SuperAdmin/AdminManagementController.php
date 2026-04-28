<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Http\Controllers\ManagerParent\NetworkController as ManagerParentNetworkController;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use App\Support\RevenueAnalytics;
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
            'status' => ['nullable', 'in:active,suspended,inactive,deactive'],
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
            if ($validated['status'] === 'deactive') {
                $query->whereIn('status', ['suspended', 'inactive']);
            } else {
                $query->where('status', $validated['status']);
            }
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%');
            });
        }

        $admins = $query->paginate($perPage);
        collect($admins->items())->each(fn (User $user) => $user->ensureUsername());

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
            'assign_to_id' => ['nullable', 'integer', 'exists:users,id'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'status' => ['nullable', 'in:active,suspended,inactive,deactive'],
        ]);

        if (($validated['status'] ?? null) === 'deactive') {
            $validated['status'] = 'inactive';
        }

        if ($validated['role'] !== UserRole::SUPER_ADMIN->value && empty($validated['tenant_id'])) {
            return response()->json(['message' => 'Tenant assignment is required for non-super-admin accounts.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $assignedManager = null;
        if (($validated['role'] ?? null) === UserRole::RESELLER->value) {
            if (empty($validated['assign_to_id'])) {
                return response()->json([
                    'message' => 'Reseller assignment is required.',
                    'errors' => ['assign_to_id' => ['Select a manager parent or manager for this reseller.']],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $assignedManager = User::query()->find($validated['assign_to_id']);

            if (! $assignedManager
                || (int) $assignedManager->tenant_id !== (int) $validated['tenant_id']
                || ! in_array($assignedManager->role?->value ?? (string) $assignedManager->role, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value], true)
            ) {
                return response()->json([
                    'message' => 'Assigned manager must belong to the same tenant and have a manager role.',
                    'errors' => ['assign_to_id' => ['Assigned manager must belong to the same tenant and have a manager role.']],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $admin = DB::transaction(function () use ($request, $validated, $assignedManager): User {
            $createdBy = $request->user()?->id;
            if ($validated['role'] === UserRole::RESELLER->value) {
                $createdBy = $assignedManager?->id;
            }

            $user = User::query()->create([
                'tenant_id' => $validated['role'] === UserRole::SUPER_ADMIN->value ? null : $validated['tenant_id'],
                'name' => $validated['name'],
                'username' => User::generateUniqueUsername($validated['email'] ?? $validated['name']),
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password']),
                'role' => $validated['role'],
                'status' => $validated['status'] ?? 'active',
                'created_by' => $createdBy,
                'username_locked' => false,
            ]);

            $this->logActivity($request, 'admin.create', sprintf('Created admin account for %s.', $user->email), [
                'target_user_id' => $user->id,
                'role' => $validated['role'],
                'assign_to_id' => $assignedManager?->id,
            ]);

            return $user->fresh('tenant');
        });

        if ($admin->tenant_id !== null) {
            ManagerParentNetworkController::forgetTenantCache((int) $admin->tenant_id);
        }

        return response()->json(['data' => $this->serializeAdmin($admin)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'role' => ['sometimes', 'in:super_admin,manager_parent,manager,reseller'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'status' => ['sometimes', 'in:active,suspended,inactive,deactive'],
        ]);

        if (($validated['status'] ?? null) === 'deactive') {
            $validated['status'] = 'inactive';
        }

        $this->guardSuperAdminMutation($request, $user, $validated['status'] ?? null, false);

        $originalTenantId = $user->tenant_id;

        $user->update([
            ...$validated,
            'tenant_id' => ($validated['role'] ?? ($user->role?->value ?? $user->role)) === UserRole::SUPER_ADMIN->value
                ? null
                : ($validated['tenant_id'] ?? $user->tenant_id),
        ]);

        if ($originalTenantId !== null) {
            ManagerParentNetworkController::forgetTenantCache((int) $originalTenantId);
        }
        if ($user->tenant_id !== null) {
            ManagerParentNetworkController::forgetTenantCache((int) $user->tenant_id);
        }

        $this->logActivity($request, 'admin.update', sprintf('Updated admin account for %s.', $user->email), [
            'target_user_id' => $user->id,
        ]);

        return response()->json(['data' => $this->serializeAdmin($user->fresh('tenant'))]);
    }

    public function show(User $user): JsonResponse
    {
        abort_if(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, Response::HTTP_NOT_FOUND);

        $member = $user->load('tenant');
        $member->ensureUsername();
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
                'price' => CustomerOwnership::displayPriceForLicense($license),
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
        $this->guardSuperAdminMutation($request, $user, null, true);

        if (! $user->canBePermanentlyDeleted()) {
            return response()->json([
                'message' => $user->permanentDeleteBlockedMessage() ?? 'This account cannot be deleted.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
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
            'revoke_tokens' => ['nullable', 'boolean'],
        ]);

        $newPassword = $validated['new_password'] ?? Str::password(12, true, true, true, false);
        $user->update(['password' => Hash::make($newPassword)]);

        if (($validated['revoke_tokens'] ?? false) === true) {
            $exceptTokenId = $request->user()?->is($user) ? $request->user()?->currentAccessToken()?->getKey() : null;
            $user->revokeAuthTokens($exceptTokenId);
        }

        $this->logActivity($request, 'admin.reset_password', sprintf('Reset password for %s.', $user->email), [
            'target_user_id' => $user->id,
            'revoke_tokens' => $validated['revoke_tokens'] ?? false,
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
        $query = License::query()
            ->when($user->tenant_id, fn ($query) => $query->where('tenant_id', $user->tenant_id))
            ->where('reseller_id', $user->id);

        $stats = $query
            ->selectRaw('COUNT(DISTINCT customer_id) as customers, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active_licenses', ['active'])
            ->first();

        return [
            'customers' => (int) ($stats?->customers ?? 0),
            'active_licenses' => (int) ($stats?->active_licenses ?? 0),
            'revenue' => RevenueAnalytics::totalRevenue([], $user->tenant_id ? (int) $user->tenant_id : null, null, $user->id),
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
            'can_delete' => $user->canBePermanentlyDeleted(),
            'tenant' => $user->tenant ? [
                'id' => $user->tenant->id,
                'name' => $user->tenant->name,
            ] : null,
            'created_by' => $user->createdBy ? [
                'id' => $user->createdBy->id,
                'name' => $user->createdBy->name,
                'email' => $user->createdBy->email,
                'role' => $user->createdBy->role?->value ?? (string) $user->createdBy->role,
            ] : null,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function guardSuperAdminMutation(Request $request, User $target, ?string $nextStatus, bool $isDelete): void
    {
        $role = $target->role?->value ?? (string) $target->role;
        if ($role !== UserRole::SUPER_ADMIN->value) {
            return;
        }

        if ($request->user()?->is($target)) {
            $message = $isDelete
                ? 'You cannot delete the current authenticated super admin.'
                : 'You cannot deactivate the current authenticated super admin.';

            abort(response()->json(['message' => $message], Response::HTTP_UNPROCESSABLE_ENTITY));
        }

        $willDeactivate = $isDelete || in_array($nextStatus, ['suspended', 'inactive', 'deactive'], true);
        if (! $willDeactivate) {
            return;
        }

        $activeSuperAdmins = User::query()
            ->where('role', UserRole::SUPER_ADMIN->value)
            ->where('status', 'active')
            ->count();

        if ($target->status === 'active' && $activeSuperAdmins <= 1) {
            $message = $isDelete
                ? 'You cannot delete the last active super admin account.'
                : 'You cannot deactivate the last active super admin account.';

            abort(response()->json(['message' => $message], Response::HTTP_UNPROCESSABLE_ENTITY));
        }
    }
}
