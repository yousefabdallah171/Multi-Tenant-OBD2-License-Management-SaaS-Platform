<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\BiosBlacklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosBlacklistController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,removed'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = BiosBlacklist::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->with('addedBy:id,name')
            ->latest();

        if (! empty($validated['search'])) {
            $query->where('bios_id', 'like', '%'.$validated['search'].'%');
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $entries = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($entries->items())
                ->map(fn (BiosBlacklist $entry): array => $this->serializeEntry($entry))
                ->values(),
            'meta' => $this->paginationMeta($entries),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bios_id' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
        ]);

        $entry = BiosBlacklist::query()->updateOrCreate(
            [
                'tenant_id' => $this->currentTenantId($request),
                'bios_id' => $validated['bios_id'],
            ],
            [
                'added_by' => $request->user()?->id,
                'reason' => $validated['reason'],
                'status' => 'active',
            ],
        );

        $this->logActivity(
            $request,
            'bios.blacklist.add',
            sprintf('Added BIOS %s to the tenant blacklist.', $entry->bios_id),
            ['bios_id' => $entry->bios_id],
        );

        return response()->json(['data' => $this->serializeEntry($entry->fresh('addedBy'))], 201);
    }

    public function destroy(Request $request, BiosBlacklist $biosBlacklist): JsonResponse
    {
        abort_unless($biosBlacklist->tenant_id === $this->currentTenantId($request), 404);

        $biosBlacklist->update(['status' => 'removed']);

        $this->logActivity(
            $request,
            'bios.blacklist.remove',
            sprintf('Removed BIOS %s from the tenant blacklist.', $biosBlacklist->bios_id),
            ['bios_id' => $biosBlacklist->bios_id],
        );

        return response()->json(['message' => 'Blacklist entry removed.']);
    }

    private function serializeEntry(BiosBlacklist $entry): array
    {
        return [
            'id' => $entry->id,
            'bios_id' => $entry->bios_id,
            'reason' => $entry->reason,
            'status' => $entry->status,
            'added_by' => $entry->addedBy?->name,
            'created_at' => $entry->created_at?->toIso8601String(),
        ];
    }
}
