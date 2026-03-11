<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class TeamController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['nullable', 'in:manager,reseller'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'search' => ['nullable', 'string'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 10);

        $items = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->when(! empty($validated['role']), fn ($query) => $query->where('role', $validated['role']))
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['search']), function ($query) use ($validated): void {
                $query->where(function ($builder) use ($validated): void {
                    $builder
                        ->where('name', 'like', '%'.$validated['search'].'%')
                        ->orWhere('email', 'like', '%'.$validated['search'].'%')
                        ->orWhere('username', 'like', '%'.$validated['search'].'%');
                });
            })
            ->latest()
            ->get()
            ->each(fn (User $user) => $user->ensureUsername())
            ->map(fn (User $user): array => $this->serializeUser($user));

        $paginator = $this->paginateCollection($items, $page, $perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'role' => ['required', 'in:manager,reseller'],
        ]);

        $user = User::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $validated['name'],
            'username' => User::generateUniqueUsername($validated['email'] ?? $validated['name']),
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'status' => 'active',
            'created_by' => $request->user()?->id,
            'username_locked' => false,
        ]);

        $this->logActivity($request, 'team.create', sprintf('Created %s account for %s.', $validated['role'], $user->email), [
            'target_user_id' => $user->id,
            'role' => $validated['role'],
        ]);

        return response()->json(['data' => $this->serializeUser($user)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTeamUser($request, $user);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'status' => ['sometimes', 'in:active,suspended,inactive'],
        ]);

        $user->update($validated);

        $this->logActivity($request, 'team.update', sprintf('Updated team member %s.', $user->email), [
            'target_user_id' => $user->id,
        ]);

        return response()->json(['data' => $this->serializeUser($user->fresh())]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTeamUser($request, $user);

        $hasDependencies = License::query()
            ->where(function ($query) use ($user): void {
                $query->where('reseller_id', $user->id)->orWhere('customer_id', $user->id);
            })
            ->exists();

        if ($hasDependencies) {
            $user->update(['status' => 'inactive']);
        } else {
            $user->delete();
        }

        $this->logActivity($request, 'team.delete', sprintf('Removed team member %s.', $user->email), [
            'target_user_id' => $user->id,
            'soft' => $hasDependencies,
        ]);

        return response()->json(['message' => 'Team member removed successfully.']);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTeamUser($request, $user);

        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended,inactive'],
        ]);

        $user->update(['status' => $validated['status']]);

        $this->logActivity($request, 'team.status', sprintf('Updated status for %s.', $user->email), [
            'target_user_id' => $user->id,
            'status' => $validated['status'],
        ]);

        return response()->json(['data' => $this->serializeUser($user->fresh())]);
    }

    public function stats(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTeamUser($request, $user);

        return response()->json([
            'data' => $this->memberStats($user),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $member = $this->resolveTeamUser($request, $user);
        $member->ensureUsername();

        $memberLicenses = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->where('reseller_id', $member->id)
            ->latest('activated_at')
            ->get();

        $recentLicenses = $memberLicenses
            ->take(10)
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

        $memberLicenseIds = $memberLicenses->pluck('id')->filter()->values()->all();

        $activityQuery = ActivityLog::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where(function ($query) use ($member, $memberLicenseIds): void {
                $query
                    ->where('user_id', $member->id)
                    ->orWhere('metadata->target_user_id', $member->id)
                    ->orWhere('metadata->reseller_id', $member->id);

                if ($memberLicenseIds !== []) {
                    $query->orWhereIn('metadata->license_id', $memberLicenseIds);
                }
            })
            ->latest()
            ->limit(100);

        $activityItems = $activityQuery->get();

        $activityLicenseIds = $activityItems
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['license_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $activityLicenses = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('id', $activityLicenseIds)
            ->with(['customer:id,name,email', 'program:id,name'])
            ->get()
            ->keyBy('id');

        $recentActivity = $activityItems
            ->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'action' => $activity->action,
                'description' => $activity->description,
                'metadata' => $activity->metadata ?? [],
                'created_at' => $activity->created_at?->toIso8601String(),
            ])
            ->values();

        $sellerLogHistory = $activityItems
            ->map(function (ActivityLog $activity) use ($activityLicenses): array {
                $metadata = $activity->metadata ?? [];
                $license = $activityLicenses->get((int) ($metadata['license_id'] ?? 0));

                return [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'description' => $activity->description,
                    'customer_id' => (int) ($metadata['customer_id'] ?? $license?->customer_id ?? 0) ?: null,
                    'customer_name' => $license?->customer?->name,
                    'customer_email' => $license?->customer?->email,
                    'program_id' => (int) ($metadata['program_id'] ?? $license?->program_id ?? 0) ?: null,
                    'program_name' => $license?->program?->name,
                    'bios_id' => $license?->bios_id ?? ($metadata['bios_id'] ?? null),
                    'license_id' => $license?->id ?? ((int) ($metadata['license_id'] ?? 0) ?: null),
                    'license_status' => $license?->status,
                    'price' => array_key_exists('price', $metadata) ? (float) $metadata['price'] : ($license ? (float) $license->price : null),
                    'ip_address' => $activity->ip_address,
                    'created_at' => $activity->created_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeUser($member),
                'recent_licenses' => $recentLicenses,
                'recent_activity' => $recentActivity,
                'seller_log_history' => $sellerLogHistory,
            ],
        ]);
    }

    private function memberStats(User $user): array
    {
        $licenses = License::query()->where('reseller_id', $user->id)->get();

        return [
            'customers' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
        ];
    }

    private function serializeUser(User $user): array
    {
        $stats = $this->memberStats($user);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role?->value ?? (string) $user->role,
            'status' => $user->status,
            'username_locked' => $user->username_locked,
            'customers_count' => $stats['customers'],
            'active_licenses_count' => $stats['active_licenses'],
            'revenue' => $stats['revenue'],
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
