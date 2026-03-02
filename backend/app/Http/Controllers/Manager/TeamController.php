<?php

namespace App\Http\Controllers\Manager;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    private function serializeReseller(User $reseller, $stats): array
    {
        $licenses = $stats->get($reseller->id, collect());

        return [
            'id' => $reseller->id,
            'name' => $reseller->name,
            'email' => $reseller->email,
            'phone' => $reseller->phone,
            'status' => $reseller->status,
            'customers_count' => $licenses->pluck('customer_id')->filter()->unique()->count(),
            'active_licenses_count' => $licenses->where('status', 'active')->count(),
            'revenue' => round((float) $licenses->sum('price'), 2),
            'created_at' => $reseller->created_at?->toIso8601String(),
        ];
    }
}
