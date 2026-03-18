<?php

namespace App\Http\Controllers\Reseller;

use App\Models\BiosBlacklist;
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
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $license = $this->resolveLicense($request, License::query()->findOrFail((int) $validated['license_id']));
        $newBiosId = trim((string) $validated['new_bios_id']);
        $reason = trim((string) ($validated['reason'] ?? ''));

        $existingPendingRequest = BiosChangeRequest::query()
            ->where('license_id', $license->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPendingRequest) {
            return response()->json([
                'message' => 'A pending BIOS change request already exists for this license.',
            ], 422);
        }

        if (mb_strtolower($newBiosId) === mb_strtolower(trim((string) $license->bios_id))) {
            return response()->json([
                'message' => 'This BIOS ID is the same as the current BIOS ID.',
            ], 422);
        }

        $tenantId = $this->currentTenantId($request);
        if (BiosBlacklist::blocksBios($newBiosId, $tenantId)) {
            return response()->json([
                'message' => 'This BIOS ID is blacklisted and cannot be used.',
            ], 422);
        }

        // Global cross-tenant check: new BIOS must not be active or suspended under ANY other license
        $newBiosLower = strtolower($newBiosId);
        $globalConflict = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$newBiosLower])
            ->where('id', '!=', $license->id)
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($globalConflict) {
            return response()->json([
                'message' => 'This BIOS ID is currently active with another reseller and cannot be requested.',
            ], 422);
        }

        // Also block if another pending BIOS change request already targets this new BIOS ID
        $newBiosTargeted = BiosChangeRequest::query()
            ->whereRaw('LOWER(new_bios_id) = ?', [$newBiosLower])
            ->where('license_id', '!=', $license->id)
            ->where('status', 'pending')
            ->exists();

        if ($newBiosTargeted) {
            return response()->json([
                'message' => 'Another pending request is already targeting this BIOS ID.',
            ], 422);
        }

        $biosChangeRequest = BiosChangeRequest::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'license_id' => $license->id,
            'reseller_id' => $this->currentReseller($request)->id,
            'old_bios_id' => (string) $license->bios_id,
            'new_bios_id' => $newBiosId,
            'reason' => $reason !== '' ? $reason : '',
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
            'reason' => $biosChangeRequest->reason !== '' ? $biosChangeRequest->reason : null,
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
            'reason' => $biosChangeRequest->reason !== '' ? $biosChangeRequest->reason : null,
            'status' => $biosChangeRequest->status,
            'reviewer_id' => $biosChangeRequest->reviewer_id,
            'reviewer_name' => $biosChangeRequest->reviewer?->name,
            'reviewer_notes' => $biosChangeRequest->reviewer_notes,
            'reviewed_at' => $biosChangeRequest->reviewed_at?->toIso8601String(),
            'created_at' => $biosChangeRequest->created_at?->toIso8601String(),
        ];
    }
}
