<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Exports\ReportExporter;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use App\Models\License;
use App\Services\ExternalApiService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BiosBlacklistController extends BaseSuperAdminController
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,removed'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = BiosBlacklist::query()
            ->withoutGlobalScope('tenant')
            ->with(['addedBy:id,name', 'tenant:id,name'])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where('bios_id', 'like', '%'.$validated['search'].'%');
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $entries = $query->paginate($perPage);

        return response()->json([
            'data' => collect($entries->items())->map(fn (BiosBlacklist $entry): array => $this->serializeEntry($entry))->values(),
            'meta' => $this->paginationMeta($entries),
        ]);
    }

    public function stats(): JsonResponse
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $entries = BiosBlacklist::query()->withoutGlobalScope('tenant')->get();
        $created = $entries
            ->groupBy(fn (BiosBlacklist $entry): string => $entry->created_at?->format('Y-m') ?? '');
        $removed = $entries
            ->where('status', 'removed')
            ->groupBy(fn (BiosBlacklist $entry): string => $entry->updated_at?->format('Y-m') ?? '');

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'additions' => $created->get($month->format('Y-m'))?->count() ?? 0,
                'removals' => $removed->get($month->format('Y-m'))?->count() ?? 0,
            ])->values(),
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
            ->withoutGlobalScope('tenant')
            ->whereNull('tenant_id')
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
                'tenant_id' => null,
                'bios_id' => $biosId,
                'added_by' => $request->user()?->id,
                'reason' => $reason,
                'status' => 'active',
            ]);
        }

        $affectedLicenses = $this->deactivateMatchingLicenses($biosId);

        $this->logActivity($request, 'bios.blacklist.add', sprintf('Added BIOS %s to blacklist.', $entry->bios_id), [
            'bios_id' => $entry->bios_id,
            'affected_licenses' => $affectedLicenses,
        ]);

        return response()->json([
            'data' => $this->serializeEntry($entry->fresh('addedBy')),
            'message' => empty($affectedLicenses)
                ? 'BIOS added to blacklist.'
                : 'BIOS added to blacklist and matching active licenses were cancelled.',
        ], 201);
    }

    public function remove(Request $request, BiosBlacklist $biosBlacklist): JsonResponse
    {
        $biosBlacklist->update(['status' => 'removed']);

        $this->logActivity($request, 'bios.blacklist.remove', sprintf('Removed BIOS %s from blacklist.', $biosBlacklist->bios_id), [
            'bios_id' => $biosBlacklist->bios_id,
        ]);

        return response()->json(['message' => 'Blacklist entry updated successfully.']);
    }

    public function destroy(Request $request, BiosBlacklist $biosBlacklist): JsonResponse
    {
        abort_unless($biosBlacklist->status === 'removed', 422, 'Only removed entries can be permanently deleted.');

        $biosId = $biosBlacklist->bios_id;
        $biosBlacklist->delete();

        $this->logActivity($request, 'bios.blacklist.purge', sprintf('Permanently deleted blacklist entry for BIOS %s.', $biosId), [
            'bios_id' => $biosId,
        ]);

        return response()->json(['message' => 'Blacklist entry permanently deleted.']);
    }

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $lines = preg_split('/\r\n|\r|\n/', (string) file_get_contents($validated['file']->getRealPath())) ?: [];
        $created = 0;

        foreach ($lines as $line) {
            if (blank($line)) {
                continue;
            }

            [$biosId, $reason] = array_pad(str_getcsv($line), 2, null);
            $normalizedBiosId = trim((string) $biosId);

            if ($normalizedBiosId === '' || $this->isHeaderRow($normalizedBiosId, $reason)) {
                continue;
            }

            BiosBlacklist::query()->updateOrCreate(
                ['tenant_id' => null, 'bios_id' => $normalizedBiosId],
                [
                    'added_by' => $request->user()?->id,
                    'reason' => trim((string) ($reason ?: 'Imported entry')),
                    'status' => 'active',
                ],
            );

            $created++;
        }

        $this->logActivity($request, 'bios.blacklist.import', 'Imported BIOS blacklist CSV.', ['created' => $created]);

        return response()->json([
            'message' => 'Blacklist imported successfully.',
            'created' => $created,
        ]);
    }

    private function isHeaderRow(string $biosId, ?string $reason): bool
    {
        $normalizedBiosId = strtolower(trim($biosId));
        $normalizedReason = strtolower(trim((string) $reason));

        return in_array($normalizedBiosId, ['bios id', 'bios_id'], true)
            && in_array($normalizedReason, ['', 'reason', 'notes'], true);
    }

    public function export(): StreamedResponse
    {
        $entries = BiosBlacklist::query()
            ->withoutGlobalScope('tenant')
            ->with(['addedBy:id,name', 'tenant:id,name'])
            ->latest()
            ->get();

        return app(ReportExporter::class)->toCsv('bios-blacklist.csv', [[
            'headers' => ['BIOS ID', 'Tenant', 'Reason', 'Status', 'Added By', 'Created At'],
            'rows' => $entries->map(fn (BiosBlacklist $entry): array => [
                $entry->bios_id,
                $entry->tenant?->name ?? 'Global',
                $entry->reason,
                $entry->status,
                $entry->addedBy?->name,
                $entry->created_at?->toDateTimeString(),
            ])->all(),
        ]]);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEntry(BiosBlacklist $entry): array
    {
        return [
            'id' => $entry->id,
            'bios_id' => $entry->bios_id,
            'tenant' => $entry->tenant ? [
                'id' => $entry->tenant->id,
                'name' => $entry->tenant->name,
            ] : null,
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
        $licenses = License::query()
            ->withoutGlobalScope('tenant')
            ->whereRaw('LOWER(bios_id) = ?', [strtolower($biosId)])
            ->whereIn('status', ['active', 'pending', 'suspended'])
            ->with('program:id,external_api_key_encrypted,external_api_base_url')
            ->get();

        return $licenses->map(function (License $license): array {
            $apiResponse = 'Blacklisted — no external deactivation.';

            try {
                $program = $license->program;
                if ($program) {
                    $apiKey = $program->getDecryptedApiKey();
                    if ($apiKey !== null) {
                        $username = $license->external_username ?: $license->bios_id;
                        $response = $this->externalApiService->deactivateUser(
                            $apiKey,
                            $username,
                            $program->external_api_base_url
                        );
                        $apiResponse = (string) ($response['data']['response'] ?? $response['data']['message'] ?? $apiResponse);
                    }
                }
            } catch (\Throwable $e) {
                report($e);
                $apiResponse = $e->getMessage();
            }

            $license->forceFill([
                'status' => 'cancelled',
                'external_deletion_response' => $apiResponse,
            ])->save();

            return [
                'license_id' => $license->id,
                'tenant_id' => $license->tenant_id,
                'customer_id' => $license->customer_id,
                'reseller_id' => $license->reseller_id,
                'external_username' => $license->external_username,
                'external_delete_result' => $apiResponse,
                'status' => $license->status,
            ];
        })->values()->all();
    }
}
