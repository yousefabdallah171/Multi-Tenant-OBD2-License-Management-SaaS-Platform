<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Controllers\ManagerParent\BiosBlacklistController as ManagerParentBiosBlacklistController;
use App\Models\BiosBlacklist;
use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class BiosBlacklistController extends Controller
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        if ($request->user()?->role === UserRole::MANAGER_PARENT) {
            return app(ManagerParentBiosBlacklistController::class)->index($request);
        }

        $validated = $request->validate([
            'search' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,removed'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = BiosBlacklist::query()->with('addedBy:id,name')->latest();

        if (! empty($validated['search'])) {
            $query->where('bios_id', 'like', '%'.$validated['search'].'%');
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $entries = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($entries->items())->map(fn (BiosBlacklist $entry): array => $this->serializeEntry($entry))->values(),
            'meta' => $this->paginationMeta($entries),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->user()?->role === UserRole::MANAGER_PARENT) {
            return app(ManagerParentBiosBlacklistController::class)->store($request);
        }

        $validated = $request->validate([
            'bios_id' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
        ]);

        $entry = BiosBlacklist::query()->updateOrCreate(
            [
                'tenant_id' => $request->user()?->tenant_id,
                'bios_id' => $validated['bios_id'],
            ],
            [
                'added_by' => $request->user()?->id,
                'reason' => $validated['reason'],
                'status' => 'active',
            ],
        );

        // Deactivate any matching active licenses immediately
        $this->deactivateMatchingLicenses($validated['bios_id'], (int) $request->user()?->tenant_id);

        return response()->json(['data' => $this->serializeEntry($entry->fresh('addedBy'))], 201);
    }

    public function destroy(BiosBlacklist $biosBlacklist): JsonResponse
    {
        if (request()->user()?->role === UserRole::MANAGER_PARENT) {
            return app(ManagerParentBiosBlacklistController::class)->destroy(request(), $biosBlacklist);
        }

        $biosBlacklist->update(['status' => 'removed']);

        return response()->json(['message' => 'Blacklist entry removed.']);
    }

    private function deactivateMatchingLicenses(string $biosId, int $tenantId): void
    {
        $licenses = License::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(bios_id) = ?', [strtolower($biosId)])
            ->whereIn('status', ['active', 'pending', 'suspended'])
            ->with('program:id,external_api_key_encrypted,external_api_base_url')
            ->get();

        foreach ($licenses as $license) {
            try {
                $program = $license->program;
                if ($program) {
                    $apiKey = $program->getDecryptedApiKey();
                    if ($apiKey !== null) {
                        $username = $license->external_username ?: $license->bios_id;
                        $this->externalApiService->deactivateUser($apiKey, $username, $program->external_api_base_url);
                    }
                }
            } catch (\Throwable $e) {
                report($e);
            }

            $license->forceFill(['status' => 'cancelled'])->save();
        }
    }

    private function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
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
