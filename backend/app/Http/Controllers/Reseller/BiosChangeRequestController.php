<?php

namespace App\Http\Controllers\Reseller;

use App\Models\BiosChangeRequest;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosChangeRequestController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,approved_pending_sync'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = BiosChangeRequest::query()
            ->with([
                'license.customer:id,name',
                'license.program:id,name',
                'reviewer:id,name',
            ])
            ->where('reseller_id', $this->currentReseller($request)->id)
            ->latest();

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $requests = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($requests->items())
                ->map(fn (BiosChangeRequest $biosChangeRequest): array => $this->serialize($biosChangeRequest))
                ->values(),
            'meta' => $this->paginationMeta($requests),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'license_id' => ['required', 'integer'],
            'new_bios_id' => ['required', 'string', 'min:5', 'max:255'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $license = $this->resolveLicense($request, License::query()->findOrFail((int) $validated['license_id']));

        $existingPendingRequest = BiosChangeRequest::query()
            ->where('license_id', $license->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPendingRequest) {
            return response()->json([
                'message' => 'A pending BIOS change request already exists for this license.',
            ], 422);
        }

        $biosChangeRequest = BiosChangeRequest::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'license_id' => $license->id,
            'reseller_id' => $this->currentReseller($request)->id,
            'old_bios_id' => (string) $license->bios_id,
            'new_bios_id' => trim((string) $validated['new_bios_id']),
            'reason' => trim((string) $validated['reason']),
            'status' => 'pending',
        ]);

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reviewer:id,name']);

        $this->logActivity($request, 'bios.change_requested', sprintf('Requested BIOS change for license %d.', $license->id), [
            'request_id' => $biosChangeRequest->id,
            'license_id' => $license->id,
            'customer_id' => $license->customer_id,
            'program_id' => $license->program_id,
            'reseller_id' => $this->currentReseller($request)->id,
            'bios_id' => $license->bios_id,
            'old_bios_id' => $license->bios_id,
            'new_bios_id' => $biosChangeRequest->new_bios_id,
            'reason' => $biosChangeRequest->reason,
        ]);

        return response()->json([
            'data' => $this->serialize($biosChangeRequest),
            'message' => 'BIOS change request submitted.',
        ], 201);
    }

    private function serialize(BiosChangeRequest $biosChangeRequest): array
    {
        return [
            'id' => $biosChangeRequest->id,
            'license_id' => $biosChangeRequest->license_id,
            'customer_id' => $biosChangeRequest->license?->customer_id,
            'customer_name' => $biosChangeRequest->license?->customer?->name,
            'program_name' => $biosChangeRequest->license?->program?->name,
            'old_bios_id' => $biosChangeRequest->old_bios_id,
            'new_bios_id' => $biosChangeRequest->new_bios_id,
            'reason' => $biosChangeRequest->reason,
            'status' => $biosChangeRequest->status,
            'reviewer_id' => $biosChangeRequest->reviewer_id,
            'reviewer_name' => $biosChangeRequest->reviewer?->name,
            'reviewer_notes' => $biosChangeRequest->reviewer_notes,
            'reviewed_at' => $biosChangeRequest->reviewed_at?->toIso8601String(),
            'created_at' => $biosChangeRequest->created_at?->toIso8601String(),
        ];
    }
}
