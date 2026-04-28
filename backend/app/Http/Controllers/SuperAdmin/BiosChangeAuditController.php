<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BiosChangeRequest;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class BiosChangeAuditController extends BaseSuperAdminController
{
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
        ]);

        $tenantId = ! empty($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;
        $managerIds = $this->managerIds($tenantId);
        $requestQuery = BiosChangeRequest::query()
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId));

        return response()->json([
            'total_requests' => (int) (clone $requestQuery)->count(),
            'approved' => (int) (clone $requestQuery)->whereIn('status', ['approved', 'approved_pending_sync'])->count(),
            'rejected' => (int) (clone $requestQuery)->where('status', 'rejected')->count(),
            'pending' => (int) (clone $requestQuery)->where('status', 'pending')->count(),
            'direct_changes' => (int) ActivityLog::query()
                ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
                ->whereIn('user_id', $managerIds)
                ->whereIn('action', ['bios.direct_changed', 'bios.direct_change_failed'])
                ->count(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
            'type' => ['nullable', 'in:request,direct_change'],
            'status' => ['nullable', 'in:pending,approved,rejected,completed,failed'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $tenantId = ! empty($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;
        $managerIds = $this->managerIds($tenantId);
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 15);
        $requestStatuses = ['pending', 'approved', 'rejected'];
        $directStatuses = ['completed', 'failed'];
        $statusFilter = $validated['status'] ?? null;
        $items = collect();

        if (($validated['type'] ?? null) !== 'direct_change' && ! in_array($statusFilter, $directStatuses, true)) {
            $items = $items->merge($this->requestRows($tenantId, $validated));
        }

        if (($validated['type'] ?? null) !== 'request' && ! in_array($statusFilter, $requestStatuses, true)) {
            $items = $items->merge($this->directChangeRows($tenantId, $managerIds, $validated));
        }

        $paginator = $this->paginateCollection($items->sortByDesc('occurred_at')->values(), $page, $perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    private function requestRows(?int $tenantId, array $validated): Collection
    {
        $status = $validated['status'] ?? null;

        $rows = BiosChangeRequest::query()
            ->select(['id', 'tenant_id', 'license_id', 'reseller_id', 'reviewer_id', 'old_bios_id', 'new_bios_id', 'status', 'reason', 'reviewer_notes', 'created_at'])
            ->with([
                'license:id,tenant_id,customer_id,program_id',
                'license.customer:id,name',
                'license.program:id,name',
                'reseller:id,name',
                'reviewer:id,name',
            ])
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->when(! empty($validated['manager_id']), fn ($query) => $query->where('reviewer_id', (int) $validated['manager_id']))
            ->when(! empty($validated['reseller_id']), fn ($query) => $query->where('reseller_id', (int) $validated['reseller_id']))
            ->when($status === 'approved', fn ($query) => $query->whereIn('status', ['approved', 'approved_pending_sync']))
            ->when($status !== null && in_array($status, ['pending', 'rejected'], true), fn ($query) => $query->where('status', $status))
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('created_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('created_at', '<=', $validated['to']))
            ->get();

        $tenantNames = Tenant::query()
            ->whereIn('id', $rows->pluck('tenant_id')->filter()->unique()->values())
            ->pluck('name', 'id');

        return $rows->map(fn (BiosChangeRequest $entry): array => $this->serializeRequestRow(
            $entry,
            $entry->tenant_id ? $tenantNames->get((int) $entry->tenant_id) : null,
        ));
    }

    private function directChangeRows(?int $tenantId, Collection $managerIds, array $validated): Collection
    {
        $logs = ActivityLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'action', 'metadata', 'created_at'])
            ->with(['tenant:id,name', 'user:id,name'])
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereIn('user_id', $managerIds)
            ->when(
                ($validated['status'] ?? null) === 'completed',
                fn ($query) => $query->where('action', 'bios.direct_changed'),
                fn ($query) => $query->when(
                    ($validated['status'] ?? null) === 'failed',
                    fn ($statusQuery) => $statusQuery->where('action', 'bios.direct_change_failed'),
                    fn ($statusQuery) => $statusQuery->whereIn('action', ['bios.direct_changed', 'bios.direct_change_failed'])
                )
            )
            ->when(! empty($validated['manager_id']), fn ($query) => $query->where('user_id', (int) $validated['manager_id']))
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('created_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('created_at', '<=', $validated['to']))
            ->get();

        if ($logs->isEmpty()) {
            return collect();
        }

        $licenseIds = $logs->map(fn (ActivityLog $log): int => (int) ($log->metadata['license_id'] ?? 0))->filter()->unique()->values();
        $customerIds = $logs->map(fn (ActivityLog $log): int => (int) ($log->metadata['customer_id'] ?? 0))->filter()->unique()->values();
        $programIds = $logs->map(fn (ActivityLog $log): int => (int) ($log->metadata['program_id'] ?? 0))->filter()->unique()->values();
        $resellerIds = $logs->map(fn (ActivityLog $log): int => (int) ($log->metadata['reseller_id'] ?? 0))->filter()->unique()->values();

        $licenses = License::query()
            ->select(['id', 'tenant_id', 'customer_id', 'program_id', 'reseller_id'])
            ->with(['tenant:id,name', 'customer:id,name', 'program:id,name', 'reseller:id,name'])
            ->whereIn('id', $licenseIds)
            ->get()
            ->keyBy('id');

        $customers = User::query()->whereIn('id', $customerIds)->get(['id', 'name'])->keyBy('id');
        $programs = Program::query()->whereIn('id', $programIds)->get(['id', 'name'])->keyBy('id');
        $resellers = User::query()->whereIn('id', $resellerIds)->get(['id', 'name'])->keyBy('id');

        return $logs
            ->map(function (ActivityLog $log) use ($licenses, $customers, $programs, $resellers): array {
                $metadata = is_array($log->metadata) ? $log->metadata : [];

                return $this->serializeDirectRow(
                    $log,
                    $licenses->get((int) ($metadata['license_id'] ?? 0)),
                    $customers->get((int) ($metadata['customer_id'] ?? 0)),
                    $programs->get((int) ($metadata['program_id'] ?? 0)),
                    $resellers->get((int) ($metadata['reseller_id'] ?? 0)),
                );
            })
            ->when(! empty($validated['reseller_id']), fn (Collection $collection) => $collection->filter(
                fn (array $row): bool => (int) ($row['reseller_id'] ?? 0) === (int) $validated['reseller_id']
            )->values());
    }

    private function serializeRequestRow(BiosChangeRequest $entry, ?string $tenantName): array
    {
        return [
            'id' => 'request-'.$entry->id,
            'tenant_id' => $entry->tenant_id ? (int) $entry->tenant_id : null,
            'tenant_name' => $tenantName,
            'type' => 'request',
            'reseller_id' => $entry->reseller_id ? (int) $entry->reseller_id : null,
            'reseller_name' => $entry->reseller?->name,
            'manager_id' => $entry->reviewer_id ? (int) $entry->reviewer_id : null,
            'manager_name' => $entry->reviewer?->name,
            'old_bios_id' => $entry->old_bios_id,
            'new_bios_id' => $entry->new_bios_id,
            'status' => $entry->status === 'approved_pending_sync' ? 'approved' : $entry->status,
            'reason' => $entry->reason,
            'reviewer_notes' => $entry->reviewer_notes,
            'customer_name' => $entry->license?->customer?->name,
            'program_name' => $entry->license?->program?->name,
            'license_id' => $entry->license_id ? (int) $entry->license_id : null,
            'occurred_at' => $entry->created_at?->toIso8601String(),
        ];
    }

    private function serializeDirectRow(ActivityLog $log, ?License $license, ?User $customer, ?Program $program, ?User $reseller): array
    {
        $metadata = is_array($log->metadata) ? $log->metadata : [];

        return [
            'id' => 'direct-'.$log->id,
            'tenant_id' => $log->tenant_id ? (int) $log->tenant_id : null,
            'tenant_name' => $log->tenant?->name ?? $license?->tenant?->name,
            'type' => 'direct_change',
            'reseller_id' => $this->intOrNull($metadata['reseller_id'] ?? $license?->reseller_id),
            'reseller_name' => $reseller?->name ?? $license?->reseller?->name,
            'manager_id' => $log->user_id ? (int) $log->user_id : null,
            'manager_name' => $log->user?->name,
            'old_bios_id' => (string) ($metadata['old_bios_id'] ?? ''),
            'new_bios_id' => (string) ($metadata['new_bios_id'] ?? ''),
            'status' => $log->action === 'bios.direct_change_failed' ? 'failed' : 'completed',
            'reason' => null,
            'reviewer_notes' => null,
            'customer_name' => $customer?->name ?? $license?->customer?->name,
            'program_name' => $program?->name ?? $license?->program?->name,
            'license_id' => $this->intOrNull($metadata['license_id'] ?? $license?->id),
            'occurred_at' => $log->created_at?->toIso8601String(),
        ];
    }

    private function managerIds(?int $tenantId): Collection
    {
        return User::query()
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->where('role', UserRole::MANAGER->value)
            ->pluck('id');
    }

    private function intOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
