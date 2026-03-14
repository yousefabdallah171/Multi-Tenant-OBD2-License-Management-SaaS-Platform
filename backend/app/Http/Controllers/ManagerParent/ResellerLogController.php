<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerLogController extends BaseManagerParentController
{
    private const TRACKED_ACTIONS = [
        'license.activated',
        'license.renewed',
        'license.deactivated',
        'license.delete',
        'bios.change_requested',
        'bios.change_approved',
        'bios.change_rejected',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seller_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $tenantId = $this->currentTenantId($request);
        $sellerIds = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->pluck('id')
            ->all();

        if ($sellerIds === []) {
            return response()->json([
                'data' => [],
                'summary' => $this->emptySummary(),
                'meta' => [
                    'page' => 1,
                    'per_page' => (int) ($validated['per_page'] ?? 15),
                    'total' => 0,
                    'last_page' => 1,
                    'has_next_page' => false,
                    'next_page' => null,
                ],
            ]);
        }

        $query = ActivityLog::query()
            ->with('user:id,name,role')
            ->where('tenant_id', $tenantId)
            ->whereIn('action', self::TRACKED_ACTIONS)
            ->where(function ($builder) use ($sellerIds): void {
                $builder->whereIn('user_id', $sellerIds);

                foreach ($sellerIds as $sellerId) {
                    $builder->orWhere('metadata->reseller_id', $sellerId);
                }
            })
            ->latest();

        if (! empty($validated['seller_id'])) {
            if (! in_array((int) $validated['seller_id'], $sellerIds, true)) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where(function ($builder) use ($validated): void {
                    $builder
                        ->where('user_id', (int) $validated['seller_id'])
                        ->orWhere('metadata->reseller_id', (int) $validated['seller_id']);
                });
            }
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $summaryQuery = clone $query;

        if (! empty($validated['action'])) {
            $query->where('action', $validated['action']);
        }

        $activities = $query->paginate((int) ($validated['per_page'] ?? 15));
        $licenseIds = collect($activities->items())
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['license_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $licenses = License::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $licenseIds)
            ->with(['customer:id,name', 'program:id,name'])
            ->get()
            ->keyBy('id');

        return response()->json([
            'data' => collect($activities->items())->map(fn (ActivityLog $activity): array => $this->serializeActivity($activity, $licenses))->values(),
            'summary' => $this->summary($summaryQuery),
            'meta' => [
                'page' => $activities->currentPage(),
                'per_page' => $activities->perPage(),
                'total' => $activities->total(),
                'last_page' => $activities->lastPage(),
                'has_next_page' => $activities->hasMorePages(),
                'next_page' => $activities->hasMorePages() ? $activities->currentPage() + 1 : null,
            ],
        ]);
    }

    private function serializeActivity(ActivityLog $activity, $licenses): array
    {
        $metadata = $activity->metadata ?? [];
        $license = $licenses->get((int) ($metadata['license_id'] ?? 0));
        $sellerRole = $activity->user?->role?->value ?? (string) $activity->user?->role;

        return [
            'id' => $activity->id,
            'action' => $activity->action,
            'description' => $activity->description,
            'ip_address' => $activity->ip_address,
            'seller' => $activity->user ? [
                'id' => $activity->user->id,
                'name' => $activity->user->name,
                'role' => $sellerRole,
            ] : null,
            'customer_id' => (int) ($metadata['customer_id'] ?? $license?->customer_id ?? 0) ?: null,
            'customer_name' => $license?->customer?->name,
            'program_id' => (int) ($metadata['program_id'] ?? $license?->program_id ?? 0) ?: null,
            'program_name' => $license?->program?->name,
            'bios_id' => $license?->bios_id,
            'license_id' => $license?->id ?? ((int) ($metadata['license_id'] ?? 0) ?: null),
            'license_status' => $license?->status,
            'price' => array_key_exists('price', $metadata) ? (float) $metadata['price'] : ($license ? (float) $license->price : null),
            'metadata' => $metadata,
            'created_at' => $activity->created_at?->toIso8601String(),
        ];
    }

    private function summary($query): array
    {
        return [
            'total_entries' => (clone $query)->count(),
            'activations' => (clone $query)->where('action', 'license.activated')->count(),
            'renewals' => (clone $query)->where('action', 'license.renewed')->count(),
            'deactivations' => (clone $query)->where('action', 'license.deactivated')->count(),
            'deletions' => (clone $query)->where('action', 'license.delete')->count(),
            'revenue' => round((float) (clone $query)
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->get()
                ->sum(fn (ActivityLog $activity): float => (float) (($activity->metadata ?? [])['price'] ?? 0)), 2),
        ];
    }

    private function emptySummary(): array
    {
        return [
            'total_entries' => 0,
            'activations' => 0,
            'renewals' => 0,
            'deactivations' => 0,
            'deletions' => 0,
            'revenue' => 0,
        ];
    }
}
