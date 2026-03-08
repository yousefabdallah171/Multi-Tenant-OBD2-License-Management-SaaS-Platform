<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Exports\ReportExporter;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BiosBlacklistController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,removed'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = BiosBlacklist::query()->whereNull('tenant_id')->with('addedBy:id,name')->latest();

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

        $entries = BiosBlacklist::query()->whereNull('tenant_id')->get();
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

        $entry = BiosBlacklist::query()->updateOrCreate(
            ['tenant_id' => null, 'bios_id' => $biosId],
            [
                'added_by' => $request->user()?->id,
                'reason' => $reason,
                'status' => 'active',
            ],
        );

        $this->logActivity($request, 'bios.blacklist.add', sprintf('Added BIOS %s to blacklist.', $entry->bios_id), [
            'bios_id' => $entry->bios_id,
        ]);

        return response()->json(['data' => $this->serializeEntry($entry->fresh('addedBy'))], 201);
    }

    public function remove(Request $request, BiosBlacklist $biosBlacklist): JsonResponse
    {
        $biosBlacklist->update(['status' => 'removed']);

        $this->logActivity($request, 'bios.blacklist.remove', sprintf('Removed BIOS %s from blacklist.', $biosBlacklist->bios_id), [
            'bios_id' => $biosBlacklist->bios_id,
        ]);

        return response()->json(['message' => 'Blacklist entry updated successfully.']);
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

            if (blank($biosId)) {
                continue;
            }

            BiosBlacklist::query()->updateOrCreate(
                ['tenant_id' => null, 'bios_id' => trim((string) $biosId)],
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

    public function export(): StreamedResponse
    {
        $entries = BiosBlacklist::query()->whereNull('tenant_id')->with('addedBy:id,name')->latest()->get();

        return app(ReportExporter::class)->toCsv('bios-blacklist.csv', [[
            'headers' => ['BIOS ID', 'Reason', 'Status', 'Added By', 'Created At'],
            'rows' => $entries->map(fn (BiosBlacklist $entry): array => [
                $entry->bios_id,
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
            'reason' => $entry->reason,
            'status' => $entry->status,
            'added_by' => $entry->addedBy?->name,
            'created_at' => $entry->created_at?->toIso8601String(),
        ];
    }
}
