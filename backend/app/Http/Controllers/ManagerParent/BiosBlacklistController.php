<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\BiosBlacklist;
use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BiosBlacklistController extends BaseManagerParentController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

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
            'reason' => ['nullable', 'string'],
        ]);

        $biosId = trim((string) $validated['bios_id']);
        $reason = trim((string) ($validated['reason'] ?? ''));

        if ($biosId === '') {
            throw ValidationException::withMessages([
                'bios_id' => 'The BIOS ID field is required.',
            ]);
        }

        $entry = BiosBlacklist::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('bios_id', $biosId)
            ->first();

        if ($entry && $entry->status === 'active') {
            return response()->json([
                'data' => $this->serializeEntry($entry->fresh('addedBy')),
                'message' => 'This BIOS is already blacklisted.',
            ]);
        }

        if ($entry) {
            $entry->forceFill([
                'added_by' => $request->user()?->id,
                'reason' => $reason,
                'status' => 'active',
            ])->save();
        } else {
            $entry = BiosBlacklist::query()->create([
                'tenant_id' => $this->currentTenantId($request),
                'bios_id' => $biosId,
                'added_by' => $request->user()?->id,
                'reason' => $reason,
                'status' => 'active',
            ]);
        }

        $affectedLicenses = $this->deactivateMatchingLicenses($biosId);

        $this->logActivity(
            $request,
            'bios.blacklist.add',
            sprintf('Added BIOS %s to the tenant blacklist.', $entry->bios_id),
            [
                'bios_id' => $entry->bios_id,
                'affected_licenses' => $affectedLicenses,
            ],
        );

        return response()->json([
            'data' => $this->serializeEntry($entry->fresh('addedBy')),
            'message' => empty($affectedLicenses)
                ? 'BIOS added to blacklist.'
                : 'BIOS added to blacklist and matching active licenses were cancelled.',
        ], 201);
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

    /**
     * @return array<int, array<string, mixed>>
     */
    private function deactivateMatchingLicenses(string $biosId): array
    {
        return License::query()
            ->where('tenant_id', auth()->user()?->tenant_id)
            ->where('bios_id', $biosId)
            ->whereEffectiveStatus('active')
            ->get()
            ->map(function (License $license): array {
                $updated = $this->licenseService->deactivate($license);

                return [
                    'license_id' => $updated->id,
                    'tenant_id' => $updated->tenant_id,
                    'customer_id' => $updated->customer_id,
                    'reseller_id' => $updated->reseller_id,
                    'external_username' => $updated->external_username,
                    'external_delete_result' => $updated->external_deletion_response,
                    'status' => $updated->status,
                ];
            })
            ->values()
            ->all();
    }
}
