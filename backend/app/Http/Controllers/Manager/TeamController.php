<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
                    ->orWhere('email', 'like', '%'.$validated['search'].'%');
            });
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 10);
        $resellers = $query->get();
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
        $reseller = $this->resolveTeamReseller($request, $user);
        $stats = License::query()->where('reseller_id', $reseller->id)->get();

        $recentLicenses = License::query()
            ->with(['customer:id,name,email', 'program:id,name'])
            ->where('reseller_id', $reseller->id)
            ->latest('activated_at')
            ->limit(5)
            ->get()
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

        return response()->json([
            'data' => [
                ...$this->serializeReseller($reseller, collect([$reseller->id => $stats])),
                'recent_licenses' => $recentLicenses,
                'recent_activity' => ActivityLog::query()
                    ->where('tenant_id', $this->currentTenantId($request))
                    ->where('user_id', $reseller->id)
                    ->whereIn('action', ['license.activated', 'license.renewed', 'license.deactivated', 'license.delete'])
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
                    ->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $user = User::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $validated['name'],
            'username' => null,
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
            'phone' => ['nullable', 'string', 'max:20'],
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

        $hasDependencies = License::query()
            ->where(function ($query) use ($reseller): void {
                $query->where('reseller_id', $reseller->id)->orWhere('customer_id', $reseller->id);
            })
            ->exists();

        if ($hasDependencies) {
            $reseller->update(['status' => 'inactive']);
        } else {
            $reseller->delete();
        }

        $this->logActivity($request, 'team.delete', sprintf('Removed reseller %s.', $reseller->email), [
            'target_user_id' => $reseller->id,
            'soft' => $hasDependencies,
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
            'username' => $reseller->username,
            'email' => $reseller->email,
            'phone' => $reseller->phone,
            'status' => $reseller->status,
            'username_locked' => $reseller->username_locked,
            'customers_count' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses_count' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
            'created_at' => $reseller->created_at?->toIso8601String(),
        ];
    }
}
