<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class BiosHistoryController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bios_id' => ['nullable', 'string'],
            'action' => ['nullable', 'string'],
            'reseller_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $items = $this->buildEvents()
            ->when(! empty($validated['bios_id']), fn (Collection $events) => $events->filter(fn (array $event): bool => str_contains(strtolower($event['bios_id']), strtolower($validated['bios_id']))))
            ->when(! empty($validated['action']), fn (Collection $events) => $events->filter(fn (array $event): bool => str_contains(strtolower($event['action']), strtolower($validated['action']))))
            ->when(! empty($validated['reseller_id']), fn (Collection $events) => $events->filter(fn (array $event): bool => (int) ($event['reseller_id'] ?? 0) === (int) $validated['reseller_id']))
            ->when(! empty($validated['from']), fn (Collection $events) => $events->filter(fn (array $event): bool => ! empty($event['occurred_at']) && $event['occurred_at'] >= $validated['from']))
            ->when(! empty($validated['to']), fn (Collection $events) => $events->filter(fn (array $event): bool => ! empty($event['occurred_at']) && $event['occurred_at'] <= $validated['to'].'T23:59:59'))
            ->sortByDesc('occurred_at')
            ->values();

        $paginator = $this->paginateCollection($items, (int) ($validated['page'] ?? 1), (int) ($validated['per_page'] ?? 15));

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
                'events' => $this->buildEvents()
                    ->filter(fn (array $event): bool => $event['bios_id'] === $biosId)
                    ->sortByDesc('occurred_at')
                    ->values(),
            ],
        ]);
    }

    private function buildEvents(): Collection
    {
        $events = collect();

        foreach (License::query()->with(['customer:id,name', 'reseller:id,name'])->get() as $license) {
            $events->push([
                'id' => 'license-'.$license->id,
                'bios_id' => $license->bios_id,
                'customer' => $license->customer?->name,
                'reseller' => $license->reseller?->name,
                'reseller_id' => $license->reseller_id,
                'action' => 'activation',
                'status' => $license->status,
                'description' => sprintf('License activation for %s.', $license->customer?->name ?? 'Unknown customer'),
                'occurred_at' => $license->activated_at?->toIso8601String(),
            ]);
        }

        foreach (BiosAccessLog::query()->with('user:id,name')->get() as $log) {
            $events->push([
                'id' => 'access-'.$log->id,
                'bios_id' => $log->bios_id,
                'customer' => $log->user?->name,
                'reseller' => null,
                'reseller_id' => null,
                'action' => $log->action,
                'status' => 'active',
                'description' => sprintf('BIOS %s action recorded.', $log->action),
                'occurred_at' => $log->created_at?->toIso8601String(),
            ]);
        }

        foreach (BiosConflict::query()->with('attemptedBy:id,name')->get() as $conflict) {
            $events->push([
                'id' => 'conflict-'.$conflict->id,
                'bios_id' => $conflict->bios_id,
                'customer' => null,
                'reseller' => $conflict->attemptedBy?->name,
                'reseller_id' => $conflict->attempted_by,
                'action' => 'conflict',
                'status' => $conflict->resolved ? 'active' : 'suspended',
                'description' => sprintf('Conflict type: %s.', $conflict->conflict_type),
                'occurred_at' => $conflict->created_at?->toIso8601String(),
            ]);
        }

        foreach (BiosBlacklist::query()->with('addedBy:id,name')->get() as $entry) {
            $events->push([
                'id' => 'blacklist-'.$entry->id,
                'bios_id' => $entry->bios_id,
                'customer' => null,
                'reseller' => $entry->addedBy?->name,
                'reseller_id' => $entry->added_by,
                'action' => 'blacklist',
                'status' => $entry->status,
                'description' => $entry->reason,
                'occurred_at' => $entry->created_at?->toIso8601String(),
            ]);
        }

        return $events;
    }
}
