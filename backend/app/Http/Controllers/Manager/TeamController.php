<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class TeamController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'search' => ['nullable', 'string'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $this->teamResellersQuery($request)->latest();

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

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 10);
        $resellers = $query->get();
        $resellers->each(fn (User $reseller) => $reseller->ensureUsername());
        $stats = License::query()
            ->whereIn('reseller_id', $resellers->pluck('id')->all())
            ->get()
            ->groupBy('reseller_id');

        $items = $resellers->map(fn (User $reseller): array => $this->serializeReseller($reseller, $stats));
        $paginator = $this->paginateCollection($items, $page, $perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveManagedSeller($request, $user);
        $reseller->ensureUsername();
        $stats = License::query()->where('reseller_id', $reseller->id)->get();

        $memberLicenses = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->where('reseller_id', $reseller->id)
            ->latest('activated_at')
            ->get();

        $recentLicenses = $memberLicenses
            ->take(10)
            ->map(fn (License $license): array => [
                'id' => $license->id,
                'customer' => $license->customer ? ['id' => $license->customer->id, 'name' => $license->customer->name, 'email' => $license->customer->email] : null,
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
            ->where(function ($query) use ($reseller, $memberLicenseIds): void {
                $query
                    ->where('user_id', $reseller->id)
                    ->orWhere('metadata->target_user_id', $reseller->id)
                    ->orWhere('metadata->reseller_id', $reseller->id);

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

        $activityCustomerIds = $activityItems
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['customer_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $activityProgramIds = $activityItems
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['program_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $activityCustomers = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('id', $activityCustomerIds)
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        $activityPrograms = Program::query()
            ->whereIn('id', $activityProgramIds)
            ->get(['id', 'name'])
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
            ->map(function (ActivityLog $activity) use ($activityCustomers, $activityLicenses, $activityPrograms): array {
                $metadata = $activity->metadata ?? [];
                $license = $activityLicenses->get((int) ($metadata['license_id'] ?? 0));
                $customer = $activityCustomers->get((int) ($metadata['customer_id'] ?? 0));
                $program = $activityPrograms->get((int) ($metadata['program_id'] ?? 0));

                return [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'description' => $activity->description,
                    'customer_id' => (int) ($metadata['customer_id'] ?? $license?->customer_id ?? 0) ?: null,
                    'customer_name' => $license?->customer?->name ?? $customer?->name,
                    'customer_email' => $license?->customer?->email ?? $customer?->email,
                    'program_id' => (int) ($metadata['program_id'] ?? $license?->program_id ?? 0) ?: null,
                    'program_name' => $license?->program?->name ?? $program?->name,
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
                ...$this->serializeReseller($reseller, collect([$reseller->id => $stats])),
                'recent_licenses' => $recentLicenses,
                'recent_activity' => $recentActivity,
                'seller_log_history' => $sellerLogHistory,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
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

        $this->logActivity($request, 'team.create', sprintf('Created reseller account for %s.', $user->email), [
            'target_user_id' => $user->id,
            'role' => UserRole::RESELLER->value,
        ]);

        $stats = License::query()->where('reseller_id', $user->id)->get();

        return response()->json([
            'data' => $this->serializeReseller($user, collect([$user->id => $stats])),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveTeamReseller($request, $user);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$reseller->id],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
        ]);

        $reseller->update($validated);

        $this->logActivity($request, 'team.update', sprintf('Updated reseller %s.', $reseller->email), [
            'target_user_id' => $reseller->id,
        ]);

        $stats = License::query()->where('reseller_id', $reseller->id)->get();

        return response()->json([
            'data' => $this->serializeReseller($reseller->fresh(), collect([$reseller->id => $stats])),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveTeamReseller($request, $user);

        if (! $reseller->canBePermanentlyDeleted()) {
            return response()->json([
                'message' => $reseller->permanentDeleteBlockedMessage() ?? 'This reseller cannot be deleted.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $reseller->delete();

        $this->logActivity($request, 'team.delete', sprintf('Removed reseller %s.', $reseller->email), [
            'target_user_id' => $reseller->id,
        ]);

        return response()->json(['message' => 'Reseller removed successfully.']);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveTeamReseller($request, $user);

        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended,inactive'],
        ]);

        $reseller->update(['status' => $validated['status']]);

        $this->logActivity($request, 'team.status', sprintf('Updated status for %s.', $reseller->email), [
            'target_user_id' => $reseller->id,
            'status' => $validated['status'],
        ]);

        $stats = License::query()->where('reseller_id', $reseller->id)->get();

        return response()->json([
            'data' => $this->serializeReseller($reseller->fresh(), collect([$reseller->id => $stats])),
        ]);
    }

    private function serializeReseller(User $reseller, $stats): array
    {
        $licenses = $stats->get($reseller->id, collect());

        return [
            'id' => $reseller->id,
            'name' => $reseller->name,
            'role' => $reseller->role?->value ?? (string) $reseller->role,
            'username' => $reseller->username,
            'email' => $reseller->email,
            'phone' => $reseller->phone,
            'status' => $reseller->status,
            'username_locked' => $reseller->username_locked,
            'customers_count' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses_count' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
            'can_delete' => $licenses->isEmpty(),
            'created_at' => $reseller->created_at?->toIso8601String(),
        ];
    }
}
