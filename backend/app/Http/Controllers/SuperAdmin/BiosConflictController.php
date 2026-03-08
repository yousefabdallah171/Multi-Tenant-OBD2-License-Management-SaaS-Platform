<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\BiosConflict;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosConflictController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:open,resolved'],
            'conflict_type' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = BiosConflict::query()
            ->with(['attemptedBy:id,name', 'program:id,name', 'tenant:id,name'])
            ->latest();

        if (! empty($validated['status'])) {
            $query->where('resolved', $validated['status'] === 'resolved');
        }

        if (! empty($validated['conflict_type'])) {
            $query->where('conflict_type', $validated['conflict_type']);
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $conflicts = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($conflicts->items())->map(fn (BiosConflict $conflict): array => $this->serializeConflict($conflict))->values(),
            'meta' => $this->paginationMeta($conflicts),
        ]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'resolution_notes' => ['required', 'string', 'max:1000'],
        ]);

        $conflict = BiosConflict::query()->findOrFail($id);

        $conflict->update([
            'resolved' => true,
        ]);

        return response()->json([
            'data' => $this->serializeConflict($conflict->fresh(['attemptedBy:id,name', 'program:id,name', 'tenant:id,name'])),
            'meta' => [
                'resolution_notes' => $validated['resolution_notes'],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeConflict(BiosConflict $conflict): array
    {
        $affectedCustomers = License::query()
            ->withoutGlobalScopes()
            ->with('customer:id,name,username,email')
            ->where('bios_id', $conflict->bios_id)
            ->when($conflict->tenant_id, fn ($query) => $query->where('tenant_id', $conflict->tenant_id))
            ->when($conflict->program_id, fn ($query) => $query->where('program_id', $conflict->program_id))
            ->get()
            ->map(fn (License $license): array => [
                'id' => $license->customer?->id,
                'name' => $license->customer?->name ?: ($license->customer?->username ?: ($license->customer?->email ?: 'Unknown customer')),
                'username' => $license->customer?->username,
            ])
            ->filter()
            ->unique(fn (array $customer): string => (string) ($customer['id'] ?? $customer['name']))
            ->values()
            ->all();

        return [
            'id' => $conflict->id,
            'bios_id' => $conflict->bios_id,
            'tenant_name' => $conflict->tenant?->name,
            'conflict_type' => $conflict->conflict_type,
            'attempted_by_name' => $conflict->attemptedBy?->name,
            'program_name' => $conflict->program?->name,
            'affected_customers' => $affectedCustomers,
            'status' => $conflict->resolved ? 'resolved' : 'open',
            'resolved' => (bool) $conflict->resolved,
            'created_at' => $conflict->created_at?->toIso8601String(),
            'updated_at' => $conflict->updated_at?->toIso8601String(),
        ];
    }
}
