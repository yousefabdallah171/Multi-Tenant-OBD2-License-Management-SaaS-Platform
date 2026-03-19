<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\BiosBlacklist;
use App\Models\BiosChangeRequest;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BiosChangeRequestController extends Controller
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status'   => ['nullable', 'in:pending,approved,rejected,approved_pending_sync'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = BiosChangeRequest::query()
            ->with([
                'license.customer:id,name',
                'license.program:id,name',
                'reseller:id,name,email',
                'reviewer:id,name',
            ])
            ->latest();

        if (! empty($validated['status'])) {
            if ($validated['status'] === 'approved') {
                $query->whereIn('status', ['approved', 'approved_pending_sync']);
            } else {
                $query->where('status', $validated['status']);
            }
        }

        if ($request->boolean('count_only')) {
            return response()->json(['count' => $query->count()]);
        }

        $requests = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($requests->items())->map(fn (BiosChangeRequest $r): array => $this->serialize($r))->values(),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'last_page'    => $requests->lastPage(),
                'per_page'     => $requests->perPage(),
                'total'        => $requests->total(),
            ],
        ]);
    }

    public function approve(Request $request, BiosChangeRequest $biosChangeRequest): JsonResponse
    {
        if (! in_array($biosChangeRequest->status, ['pending', 'approved_pending_sync'], true)) {
            return response()->json(['message' => 'Only pending BIOS change requests can be approved.'], 422);
        }

        if (BiosBlacklist::blocksBios($biosChangeRequest->new_bios_id, $biosChangeRequest->tenant_id)) {
            return response()->json(['message' => 'The requested new BIOS ID is blacklisted and cannot be approved.'], 422);
        }

        $newBiosLower   = strtolower($biosChangeRequest->new_bios_id);
        $globalConflict = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$newBiosLower])
            ->where('id', '!=', $biosChangeRequest->license_id)
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($globalConflict) {
            return response()->json(['message' => 'This BIOS ID is currently active with another reseller. Cannot approve.'], 422);
        }

        $biosChangeRequest->forceFill([
            'status'         => 'approved',
            'reviewer_id'    => Auth::id(),
            'reviewer_notes' => null,
            'reviewed_at'    => now(),
        ])->save();

        $oldBiosLower      = strtolower($biosChangeRequest->old_bios_id);
        $customerUsername  = $biosChangeRequest->license->customer->username ?? null;

        try {
            $result = $this->licenseService->changeBiosId($biosChangeRequest->license, $biosChangeRequest->new_bios_id);

            if (! ($result['success'] ?? false)) {
                $biosChangeRequest->forceFill([
                    'status'         => 'approved_pending_sync',
                    'reviewer_notes' => $result['message'] ?? 'External sync pending.',
                ])->save();
            } else {
                BiosUsernameLink::where('bios_id', $oldBiosLower)->delete();
                if ($customerUsername) {
                    BiosUsernameLink::updateOrCreate(
                        ['bios_id' => $newBiosLower],
                        ['username' => $customerUsername, 'tenant_id' => $biosChangeRequest->license->tenant_id]
                    );
                }
            }
        } catch (\Throwable $e) {
            $biosChangeRequest->forceFill([
                'status'         => 'approved_pending_sync',
                'reviewer_notes' => 'Error: ' . $e->getMessage(),
            ])->save();
        }

        $biosChangeRequest->license->refresh();
        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email', 'reviewer:id,name']);

        return response()->json([
            'data'    => $this->serialize($biosChangeRequest),
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

        if ($biosChangeRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending BIOS change requests can be rejected.'], 422);
        }

        $biosChangeRequest->forceFill([
            'status'         => 'rejected',
            'reviewer_id'    => Auth::id(),
            'reviewer_notes' => trim((string) ($validated['reviewer_notes'] ?? '')),
            'reviewed_at'    => now(),
        ])->save();

        $biosChangeRequest->load(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name,email', 'reviewer:id,name']);

        return response()->json([
            'data'    => $this->serialize($biosChangeRequest),
            'message' => 'BIOS change request rejected.',
        ]);
    }

    private function serialize(BiosChangeRequest $r): array
    {
        return [
            'id'             => $r->id,
            'license_id'     => $r->license_id,
            'customer_id'    => $r->license?->customer_id,
            'customer_name'  => $r->license?->customer?->name,
            'program_name'   => $r->license?->program?->name,
            'old_bios_id'    => $r->old_bios_id,
            'new_bios_id'    => $r->new_bios_id,
            'reason'         => $r->reason,
            'status'         => $r->status === 'approved_pending_sync' ? 'approved' : $r->status,
            'reseller_id'    => $r->reseller_id,
            'reseller_name'  => $r->reseller?->name,
            'reseller_email' => $r->reseller?->email,
            'reviewer_id'    => $r->reviewer_id,
            'reviewer_name'  => $r->reviewer?->name,
            'reviewer_notes' => $r->reviewer_notes,
            'reviewed_at'    => $r->reviewed_at?->toIso8601String(),
            'created_at'     => $r->created_at?->toIso8601String(),
        ];
    }
}
