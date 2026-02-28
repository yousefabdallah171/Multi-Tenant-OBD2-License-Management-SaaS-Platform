<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class BiosHistoryController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bios_id' => ['nullable', 'string'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $timeline = $this->compileTimeline($validated['bios_id'] ?? null)
            ->when(! empty($validated['tenant_id']), fn (Collection $items): Collection => $items->where('tenant_id', (int) $validated['tenant_id'])->values())
            ->when(! empty($validated['action']), fn (Collection $items): Collection => $items->filter(fn (array $item): bool => str_contains($item['action'], (string) $validated['action']))->values())
            ->when(! empty($validated['from']), fn (Collection $items): Collection => $items->filter(fn (array $item): bool => $item['occurred_at'] >= $validated['from'])->values())
            ->when(! empty($validated['to']), fn (Collection $items): Collection => $items->filter(fn (array $item): bool => $item['occurred_at'] <= $validated['to'].'T23:59:59')->values());

        $paginator = $this->paginateCollection($timeline, (int) $request->integer('page', 1), (int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => $paginator->items(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function show(string $biosId): JsonResponse
    {
        return response()->json([
            'data' => [
                'bios_id' => $biosId,
                'events' => $this->compileTimeline($biosId)->values(),
            ],
        ]);
    }

    private function compileTimeline(?string $biosId = null): Collection
    {
        $licenses = License::query()
            ->with(['tenant:id,name', 'customer:id,name'])
            ->when($biosId, fn ($query) => $query->where('bios_id', $biosId))
            ->get()
            ->map(fn (License $license): array => [
                'id' => 'license-'.$license->id,
                'bios_id' => $license->bios_id,
                'tenant_id' => $license->tenant_id,
                'tenant' => $license->tenant?->name,
                'customer' => $license->customer?->name,
                'action' => 'activation',
                'status' => $license->status,
                'description' => sprintf('License %s recorded for %s.', $license->status, $license->customer?->name ?? 'unknown customer'),
                'occurred_at' => $license->activated_at?->toIso8601String() ?? $license->created_at?->toIso8601String(),
            ]);

        $accessLogs = BiosAccessLog::query()
            ->with(['tenant:id,name', 'user:id,name'])
            ->when($biosId, fn ($query) => $query->where('bios_id', $biosId))
            ->get()
            ->map(fn (BiosAccessLog $log): array => [
                'id' => 'access-'.$log->id,
                'bios_id' => $log->bios_id,
                'tenant_id' => $log->tenant_id,
                'tenant' => $log->tenant?->name,
                'customer' => $log->user?->name,
                'action' => $log->action,
                'status' => (string) ($log->metadata['status'] ?? 'recorded'),
                'description' => (string) ($log->metadata['description'] ?? sprintf('BIOS %s action %s.', $log->bios_id, $log->action)),
                'occurred_at' => $log->created_at?->toIso8601String(),
            ]);

        $conflicts = BiosConflict::query()
            ->with(['tenant:id,name', 'attemptedBy:id,name'])
            ->when($biosId, fn ($query) => $query->where('bios_id', $biosId))
            ->get()
            ->map(fn (BiosConflict $conflict): array => [
                'id' => 'conflict-'.$conflict->id,
                'bios_id' => $conflict->bios_id,
                'tenant_id' => $conflict->tenant_id,
                'tenant' => $conflict->tenant?->name,
                'customer' => $conflict->attemptedBy?->name,
                'action' => 'conflict-'.$conflict->conflict_type,
                'status' => $conflict->resolved ? 'resolved' : 'open',
                'description' => sprintf('Conflict detected: %s.', $conflict->conflict_type),
                'occurred_at' => $conflict->created_at?->toIso8601String(),
            ]);

        $blacklist = BiosBlacklist::query()
            ->with('addedBy:id,name')
            ->when($biosId, fn ($query) => $query->where('bios_id', $biosId))
            ->get()
            ->map(fn (BiosBlacklist $entry): array => [
                'id' => 'blacklist-'.$entry->id,
                'bios_id' => $entry->bios_id,
                'tenant_id' => null,
                'tenant' => null,
                'customer' => $entry->addedBy?->name,
                'action' => 'blacklist',
                'status' => $entry->status,
                'description' => $entry->reason,
                'occurred_at' => $entry->created_at?->toIso8601String(),
            ]);

        return collect()
            ->concat($licenses)
            ->concat($accessLogs)
            ->concat($conflicts)
            ->concat($blacklist)
            ->filter(fn (array $event): bool => ! empty($event['occurred_at']))
            ->sortByDesc('occurred_at')
            ->values();
    }
}
