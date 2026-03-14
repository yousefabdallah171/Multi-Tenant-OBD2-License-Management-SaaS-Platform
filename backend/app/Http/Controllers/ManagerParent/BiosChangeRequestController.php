<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\BiosChangeRequest;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosChangeRequestController extends BaseManagerParentController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,approved_pending_sync'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'count_only' => ['nullable', 'boolean'],
        ]);

        $query = $this->query($request);

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if ((bool) ($validated['count_only'] ?? false)) {
            return response()->json([
                'count' => $query->count(),
            ]);
        }

        $requests = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($requests->items())->map(fn (BiosChangeRequest $biosChangeRequest): array => $this->serialize($biosChangeRequest))->values(),
            'meta' => $this->paginationMeta($requests),
        ]);
    }

    public function approve(Request $request, BiosChangeRequest $biosChangeRequest): JsonResponse
    {
        $biosChangeRequest = $this->resolveRequest($request, $biosChangeRequest);

        if (! in_array($biosChangeRequest->status, ['pending', 'approved_pending_sync'], true)) {
            return response()->json([
                'message' => 'Only pending BIOS change requests can be approved.',
            ], 422);
        }

        $biosChangeRequest->forceFill([
            'status' => 'approved',
            'reviewer_id' => $request->user()?->id,
            'reviewer_notes' => null,
            'reviewed_at' => now(),
        ])->save();

        $result = $this->licenseService->changeBiosId($biosChangeRequest->license, $biosChangeRequest->new_bios_id);

        if (! ($result['success'] ?? false)) {
            $biosChangeRequest->forceFill([
                'status' => 'approved_pending_sync',
                'reviewer_notes' => $result['message'] ?? 'External sync pending.',
            ])->save();
        }

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email', 'reviewer:id,name']);

        $this->logActivity($request, 'bios.change_approved', sprintf('Approved BIOS change request %d.', $biosChangeRequest->id), [
            'request_id' => $biosChangeRequest->id,
            'license_id' => $biosChangeRequest->license_id,
            'customer_id' => $biosChangeRequest->license?->customer_id,
            'program_id' => $biosChangeRequest->license?->program_id,
            'reseller_id' => $biosChangeRequest->reseller_id,
            'bios_id' => $biosChangeRequest->new_bios_id,
            'old_bios_id' => $biosChangeRequest->old_bios_id,
            'new_bios_id' => $biosChangeRequest->new_bios_id,
            'reviewer' => $request->user()?->name,
            'sync_status' => $biosChangeRequest->status,
        ]);

        return response()->json([
            'data' => $this->serialize($biosChangeRequest),
            'message' => $biosChangeRequest->status === 'approved_pending_sync'
                ? 'BIOS change approved but external sync is pending.'
                : 'BIOS change approved successfully.',
        ]);
    }

    public function reject(Request $request, BiosChangeRequest $biosChangeRequest): JsonResponse
    {
        $validated = $request->validate([
            'reviewer_notes' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        $biosChangeRequest = $this->resolveRequest($request, $biosChangeRequest);

        if ($biosChangeRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending BIOS change requests can be rejected.',
            ], 422);
        }

        $biosChangeRequest->forceFill([
            'status' => 'rejected',
            'reviewer_id' => $request->user()?->id,
            'reviewer_notes' => trim((string) $validated['reviewer_notes']),
            'reviewed_at' => now(),
        ])->save();

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email', 'reviewer:id,name']);

        $this->logActivity($request, 'bios.change_rejected', sprintf('Rejected BIOS change request %d.', $biosChangeRequest->id), [
            'request_id' => $biosChangeRequest->id,
            'license_id' => $biosChangeRequest->license_id,
            'customer_id' => $biosChangeRequest->license?->customer_id,
            'program_id' => $biosChangeRequest->license?->program_id,
            'reseller_id' => $biosChangeRequest->reseller_id,
            'bios_id' => $biosChangeRequest->old_bios_id,
            'old_bios_id' => $biosChangeRequest->old_bios_id,
            'new_bios_id' => $biosChangeRequest->new_bios_id,
            'reviewer' => $request->user()?->name,
            'rejection_reason' => $biosChangeRequest->reviewer_notes,
        ]);

        return response()->json([
            'data' => $this->serialize($biosChangeRequest),
            'message' => 'BIOS change request rejected.',
        ]);
    }

    private function query(Request $request)
    {
        return BiosChangeRequest::query()
            ->with([
                'license.customer:id,name',
                'license.program:id,name',
                'reseller:id,name,email,tenant_id,role',
                'reviewer:id,name',
            ])
            ->whereHas('reseller', function ($query) use ($request): void {
                $query
                    ->where('tenant_id', $this->currentTenantId($request))
                    ->where('role', UserRole::RESELLER->value);
            })
            ->latest();
    }

    private function resolveRequest(Request $request, BiosChangeRequest $biosChangeRequest): BiosChangeRequest
    {
        $visible = $this->query($request)->whereKey($biosChangeRequest->id)->firstOrFail();

        $visible->loadMissing(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email', 'reviewer:id,name']);

        return $visible;
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
            'reseller_id' => $biosChangeRequest->reseller_id,
            'reseller_name' => $biosChangeRequest->reseller?->name,
            'reseller_email' => $biosChangeRequest->reseller?->email,
            'reviewer_id' => $biosChangeRequest->reviewer_id,
            'reviewer_name' => $biosChangeRequest->reviewer?->name,
            'reviewer_notes' => $biosChangeRequest->reviewer_notes,
            'reviewed_at' => $biosChangeRequest->reviewed_at?->toIso8601String(),
            'created_at' => $biosChangeRequest->created_at?->toIso8601String(),
        ];
    }
}
