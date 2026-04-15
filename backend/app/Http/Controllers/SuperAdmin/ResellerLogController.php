<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerLogController extends BaseSuperAdminController
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
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'seller_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sellerQuery = User::query()
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value]);

        if (! empty($validated['tenant_id'])) {
            $sellerQuery->where('tenant_id', (int) $validated['tenant_id']);
        }

        $sellerIds = $sellerQuery->pluck('id')->map(fn ($id): int => (int) $id)->all();

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
            ->with(['tenant:id,name', 'user:id,name,role'])
            ->whereIn('action', self::TRACKED_ACTIONS)
            ->whereIn('user_id', $sellerIds)
            ->latest();

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', (int) $validated['tenant_id']);
        }

        if (! empty($validated['seller_id'])) {
            if (! in_array((int) $validated['seller_id'], $sellerIds, true)) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where('user_id', (int) $validated['seller_id']);
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
            ->whereIn('id', $licenseIds)
            ->with(['tenant:id,name', 'customer:id,name', 'program:id,name'])
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
            'tenant_id' => $activity->tenant_id ? (int) $activity->tenant_id : null,
            'tenant_name' => $activity->tenant?->name ?? $license?->tenant?->name,
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
            'price' => CustomerOwnership::displayPriceFromMetadataOrLicense($metadata, $license),
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
                ->sum(function (ActivityLog $activity): float {
                    $metadata = $activity->metadata ?? [];

                    return (($metadata['attribution_type'] ?? 'earned') === 'granted')
                        ? 0.0
                        : CustomerOwnership::sanitizeDisplayPrice($metadata['price'] ?? 0);
                }), 2),
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
