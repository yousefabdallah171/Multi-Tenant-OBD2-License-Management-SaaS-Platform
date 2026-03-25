<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerLogController extends BaseResellerController
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
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $reseller = $this->currentReseller($request);
        $query = ActivityLog::query()
            ->with('user:id,name,role')
            ->where('tenant_id', $reseller->tenant_id)
            ->where('user_id', $reseller->id)
            ->whereIn('action', self::TRACKED_ACTIONS)
            ->latest();

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
            ->where('tenant_id', $reseller->tenant_id)
            ->whereIn('id', $licenseIds)
            ->with(['customer:id,name', 'program:id,name'])
            ->get()
            ->keyBy('id');

        $customerIds = collect($activities->items())
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['customer_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $programIds = collect($activities->items())
            ->map(fn (ActivityLog $activity): int => (int) (($activity->metadata ?? [])['program_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $customers = User::query()
            ->where('tenant_id', $reseller->tenant_id)
            ->whereIn('id', $customerIds)
            ->get(['id', 'name'])
            ->keyBy('id');

        $programs = Program::query()
            ->where('tenant_id', $reseller->tenant_id)
            ->whereIn('id', $programIds)
            ->get(['id', 'name'])
            ->keyBy('id');

        return response()->json([
            'data' => collect($activities->items())
                ->map(fn (ActivityLog $activity): array => $this->serializeActivity($activity, $licenses, $customers, $programs))
                ->values(),
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

    private function serializeActivity(ActivityLog $activity, $licenses, $customers, $programs): array
    {
        $metadata = $activity->metadata ?? [];
        $license = $licenses->get((int) ($metadata['license_id'] ?? 0));
        $sellerRole = $activity->user?->role?->value ?? (string) $activity->user?->role;
        $customer = $customers->get((int) ($metadata['customer_id'] ?? 0));
        $program = $programs->get((int) ($metadata['program_id'] ?? 0));

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
            'customer_name' => $license?->customer?->name ?? $customer?->name,
            'program_id' => (int) ($metadata['program_id'] ?? $license?->program_id ?? 0) ?: null,
            'program_name' => $license?->program?->name ?? $program?->name,
            'bios_id' => $license?->bios_id ?? ($metadata['bios_id'] ?? null),
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
                ->sum(function (ActivityLog $activity): float {
                    $metadata = $activity->metadata ?? [];

                    return (($metadata['attribution_type'] ?? 'earned') === 'granted')
                        ? 0.0
                        : (float) ($metadata['price'] ?? 0);
                }), 2),
        ];
    }
}
