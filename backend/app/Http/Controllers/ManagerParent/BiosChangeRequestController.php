<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\BiosBlacklist;
use App\Models\BiosChangeRequest;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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
        ]);

        $query = $this->query($request);

        if (! empty($validated['status'])) {
            if ($validated['status'] === 'approved') {
                $query->whereIn('status', ['approved', 'approved_pending_sync']);
            } else {
                $query->where('status', $validated['status']);
            }
        }

        if ($request->boolean('count_only')) {
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

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'license_id' => ['required', 'integer'],
            'new_bios_id' => ['required', 'string', 'min:3', 'max:10'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $tenantId = $this->currentTenantId($request);

        $license = License::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail((int) $validated['license_id']);

        $newBiosId = trim((string) $validated['new_bios_id']);
        $reason = trim((string) ($validated['reason'] ?? ''));

        $existingPendingRequest = BiosChangeRequest::query()
            ->where('license_id', $license->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPendingRequest) {
            return response()->json(['message' => 'A pending BIOS change request already exists for this license.'], 422);
        }

        if (mb_strtolower($newBiosId) === mb_strtolower(trim((string) $license->bios_id))) {
            return response()->json(['message' => 'This BIOS ID is the same as the current BIOS ID.'], 422);
        }

        if (BiosBlacklist::blocksBios($newBiosId, $tenantId)) {
            return response()->json(['message' => 'This BIOS ID is blacklisted and cannot be used.'], 422);
        }

        $newBiosLower = strtolower($newBiosId);
        $globalConflict = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$newBiosLower])
            ->where('id', '!=', $license->id)
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($globalConflict) {
            return response()->json(['message' => 'This BIOS ID is currently active with another reseller and cannot be requested.'], 422);
        }

        $newBiosTargeted = BiosChangeRequest::query()
            ->whereRaw('LOWER(new_bios_id) = ?', [$newBiosLower])
            ->where('license_id', '!=', $license->id)
            ->where('status', 'pending')
            ->exists();

        if ($newBiosTargeted) {
            return response()->json(['message' => 'Another pending request is already targeting this BIOS ID.'], 422);
        }

        $biosChangeRequest = BiosChangeRequest::query()->create([
            'tenant_id' => $tenantId,
            'license_id' => $license->id,
            'reseller_id' => $license->reseller_id,
            'old_bios_id' => (string) $license->bios_id,
            'new_bios_id' => $newBiosId,
            'reason' => $reason !== '' ? $reason : '',
            'status' => 'pending',
        ]);

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reviewer:id,name']);

        $this->logActivity($request, 'bios.change_requested', sprintf('Requested BIOS change for BIOS %s.', $license->bios_id), [
            'request_id' => $biosChangeRequest->id,
            'license_id' => $license->id,
            'customer_id' => $license->customer_id,
            'program_id' => $license->program_id,
            'reseller_id' => $license->reseller_id,
            'bios_id' => $license->bios_id,
            'old_bios_id' => $license->bios_id,
            'new_bios_id' => $biosChangeRequest->new_bios_id,
            'reason' => $biosChangeRequest->reason !== '' ? $biosChangeRequest->reason : null,
        ]);

        return response()->json([
            'data' => $this->serialize($biosChangeRequest),
            'message' => 'BIOS change request submitted successfully.',
        ], 201);
    }

    public function directChange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'license_id' => ['required', 'integer'],
            'new_bios_id' => ['required', 'string', 'min:3', 'max:10'],
        ]);

        $tenantId = $this->currentTenantId($request);

        $license = License::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail((int) $validated['license_id']);

        $license->load(['customer', 'reseller', 'program']);

        $oldBiosId = (string) $license->bios_id;

        try {
            $result = $this->licenseService->changeBiosId($license, trim((string) $validated['new_bios_id']));
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
                'errors' => $exception->errors(),
            ], 422);
        } catch (\Throwable $exception) {
            \Log::error('Manager Parent direct BIOS change failed.', [
                'license_id' => $license->id,
                'customer_id' => $license->customer_id,
                'old_bios_id' => $oldBiosId,
                'new_bios_id' => (string) $validated['new_bios_id'],
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'The BIOS change could not be completed right now.',
            ], 500);
        }

        if (! ($result['success'] ?? false)) {
            $message = (string) ($result['message'] ?? 'The BIOS change was rejected by the external service.');

            $this->logActivity($request, 'bios.direct_change_failed', sprintf('Direct BIOS change from %s to %s was not applied.', $oldBiosId, $validated['new_bios_id']), [
                'license_id' => $license->id,
                'customer_id' => $license->customer_id,
                'program_id' => $license->program_id,
                'reseller_id' => $license->reseller_id,
                'old_bios_id' => $oldBiosId,
                'new_bios_id' => $validated['new_bios_id'],
                'sync_status' => 'failed',
                'response' => $result['response'] ?? [],
            ]);

            return response()->json([
                'success' => false,
                'message' => $message,
            ], 422);
        }

        $license->refresh();

        $this->logActivity($request, 'bios.direct_changed', sprintf('Directly changed BIOS ID from %s to %s.', $oldBiosId, $license->bios_id), [
            'license_id' => $license->id,
            'old_bios_id' => $oldBiosId,
            'new_bios_id' => $license->bios_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => $result['message'] ?? 'BIOS ID changed successfully.',
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

        $tenantId = $biosChangeRequest->tenant_id;
        if (BiosBlacklist::blocksBios($biosChangeRequest->new_bios_id, $tenantId)) {
            return response()->json([
                'message' => 'The requested new BIOS ID is blacklisted and cannot be approved.',
            ], 422);
        }

        // Global cross-tenant check: new BIOS must not be active/suspended under any OTHER license
        $newBiosLower = strtolower($biosChangeRequest->new_bios_id);
        $globalConflict = \App\Models\License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$newBiosLower])
            ->where('id', '!=', $biosChangeRequest->license_id)
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($globalConflict) {
            return response()->json([
                'message' => 'This BIOS ID is currently active with another reseller. Cannot approve — it would create a duplicate.',
            ], 422);
        }

        $biosChangeRequest->forceFill([
            'status' => 'approved',
            'reviewer_id' => $request->user()?->id,
            'reviewer_notes' => null,
            'reviewed_at' => now(),
        ])->save();

        $oldBiosLower = strtolower($biosChangeRequest->old_bios_id);
        $newBiosLower = strtolower($biosChangeRequest->new_bios_id);
        $customerUsername = $biosChangeRequest->license->customer->username;

        try {
            $result = $this->licenseService->changeBiosId($biosChangeRequest->license, $biosChangeRequest->new_bios_id);

            \Log::info('BIOS change result:', [
                'request_id' => $biosChangeRequest->id,
                'license_id' => $biosChangeRequest->license_id,
                'old_bios' => $biosChangeRequest->old_bios_id,
                'new_bios' => $biosChangeRequest->new_bios_id,
                'result' => $result,
            ]);

            if (! ($result['success'] ?? false)) {
                $biosChangeRequest->forceFill([
                    'status' => 'approved_pending_sync',
                    'reviewer_notes' => $result['message'] ?? 'External sync pending.',
                ])->save();
            }
            // BiosUsernameLink is now updated atomically inside changeBiosId() transaction
        } catch (\Throwable $e) {
            \Log::error('BIOS change exception:', [
                'request_id' => $biosChangeRequest->id,
                'error' => $e->getMessage(),
            ]);
            $biosChangeRequest->forceFill([
                'status' => 'approved_pending_sync',
                'reviewer_notes' => 'Error: ' . $e->getMessage(),
            ])->save();
        }

        // Reload license to get the updated BIOS ID
        $biosChangeRequest->license->refresh();
        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email,role', 'reviewer:id,name']);

        \Log::info('BIOS after change:', [
            'license_id' => $biosChangeRequest->license_id,
            'bios_id' => $biosChangeRequest->license->bios_id,
        ]);

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
            'reviewer_notes' => ['nullable', 'string', 'max:1000'],
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

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email,role', 'reviewer:id,name']);

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

        $visible->loadMissing(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email,role', 'reviewer:id,name']);

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
            'status' => $biosChangeRequest->status === 'approved_pending_sync' ? 'approved' : $biosChangeRequest->status,
            'reseller_id' => $biosChangeRequest->reseller_id,
            'reseller_name' => $biosChangeRequest->reseller?->name,
            'reseller_email' => $biosChangeRequest->reseller?->email,
            'reseller_role' => $biosChangeRequest->reseller?->role?->value ?? ($biosChangeRequest->reseller ? (string) $biosChangeRequest->reseller->role : null),
            'reviewer_id' => $biosChangeRequest->reviewer_id,
            'reviewer_name' => $biosChangeRequest->reviewer?->name,
            'reviewer_notes' => $biosChangeRequest->reviewer_notes,
            'reviewed_at' => $biosChangeRequest->reviewed_at?->toIso8601String(),
            'created_at' => $biosChangeRequest->created_at?->toIso8601String(),
        ];
    }
}
