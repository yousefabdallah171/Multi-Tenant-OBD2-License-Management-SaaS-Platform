<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\Response;

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

        $perPage = (int) ($validated['per_page'] ?? 10);

        $paginator = User::query()
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
            ->paginate($perPage);

        $items = collect($paginator->items());
        $items->each(fn (User $user) => $user->ensureUsername());
        $stats = $this->memberStatsMap($items->pluck('id')->all());

        return response()->json([
            'data' => $items->map(fn (User $user): array => $this->serializeUser($user, $stats))->values(),
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
            'role' => ['required', 'in:reseller'],
        ]);

        $user = User::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $validated['name'],
            'username' => User::generateUniqueUsername($validated['email'] ?? $validated['name']),
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'role' => UserRole::RESELLER->value,
            'status' => 'active',
            'created_by' => $request->user()?->id,
            'username_locked' => false,
        ]);

        $this->logActivity($request, 'team.create', sprintf('Created %s account for %s.', UserRole::RESELLER->value, $user->email), [
            'target_user_id' => $user->id,
            'role' => UserRole::RESELLER->value,
        ]);

        return response()->json(['data' => $this->serializeUser($user, collect([$user->id => $this->memberStats($user)]))], 201);
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

        return response()->json(['data' => $this->serializeUser($user->fresh(), collect([$user->id => $this->memberStats($user)]))]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTeamUser($request, $user);

        if (! $user->canBePermanentlyDeleted()) {
            return response()->json([
                'message' => $user->permanentDeleteBlockedMessage() ?? 'This team member cannot be deleted.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->delete();

        $this->logActivity($request, 'team.delete', sprintf('Removed team member %s.', $user->email), [
            'target_user_id' => $user->id,
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

        return response()->json(['data' => $this->serializeUser($user->fresh(), collect([$user->id => $this->memberStats($user)]))]);
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
        $stats = $this->memberStats($member);

        $memberLicensesQuery = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->where('reseller_id', $member->id)
            ->latest('activated_at');

        $memberLicenses = (clone $memberLicensesQuery)
            ->limit(10)
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

        $memberLicenseIds = License::query()
            ->where('reseller_id', $member->id)
            ->pluck('id')
            ->filter()
            ->values()
            ->all();

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
                ...$this->serializeUser($member, collect([$member->id => $stats])),
                'recent_licenses' => $recentLicenses,
                'recent_activity' => $recentActivity,
                'seller_log_history' => $sellerLogHistory,
            ],
        ]);
    }

    private function memberStats(User $user): array
    {
        $stats = $this->memberStatsMap([$user->id])->get($user->id);

        return is_array($stats)
            ? [
                'customers' => (int) ($stats['customers'] ?? 0),
                'active_licenses' => (int) ($stats['active_licenses'] ?? 0),
                'revenue' => round((float) ($stats['revenue'] ?? 0), 2),
                'licenses_count' => (int) ($stats['licenses_count'] ?? 0),
            ]
            : [
                'customers' => 0,
                'active_licenses' => 0,
                'revenue' => 0,
                'licenses_count' => 0,
            ];
    }

    private function serializeUser(User $user, ?Collection $statsMap = null): array
    {
        $stats = $statsMap?->get($user->id);
        if (! is_array($stats)) {
            $stats = $this->memberStats($user);
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role?->value ?? (string) $user->role,
            'status' => $user->status,
            'username_locked' => $user->username_locked,
            'customers_count' => (int) ($stats['customers'] ?? 0),
            'active_licenses_count' => (int) ($stats['active_licenses'] ?? 0),
            'revenue' => round((float) ($stats['revenue'] ?? 0), 2),
            'can_delete' => $user->canBePermanentlyDeleted() && ((int) ($stats['licenses_count'] ?? 0) === 0),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function memberStatsMap(array $userIds): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        return License::query()
            ->whereIn('reseller_id', $userIds)
            ->selectRaw('reseller_id, COUNT(*) as licenses_count, COUNT(DISTINCT customer_id) as customers, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active_licenses, ROUND(COALESCE(SUM(price), 0), 2) as revenue', ['active'])
            ->groupBy('reseller_id')
            ->get()
            ->mapWithKeys(fn (License $license): array => [
                (int) $license->reseller_id => [
                    'licenses_count' => (int) ($license->licenses_count ?? 0),
                    'customers' => (int) ($license->customers ?? 0),
                    'active_licenses' => (int) ($license->active_licenses ?? 0),
                    'revenue' => round((float) ($license->revenue ?? 0), 2),
                ],
            ]);
    }
}
