<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Program;
use App\Models\ProgramDurationPreset;
use App\Models\User;
use App\Support\ExternalApiSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

class ProgramController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,inactive'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Program::query()->withCount([
            'licenses as active_licenses_count' => fn ($builder) => $builder->where('status', 'active'),
            'licenses as total_licenses_count',
        ])->withSum('licenses as total_revenue', 'price')->with('durationPresets')->latest();

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $query->where('name', 'like', '%'.$validated['search'].'%');
        }

        $programs = $query->paginate((int) ($validated['per_page'] ?? 12));

        return response()->json([
            'data' => collect($programs->items())->map(fn (Program $program): array => $this->serializeProgram($program, $request))->values(),
            'meta' => $this->paginationMeta($programs),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'description' => ['nullable', 'string'],
            'version' => ['nullable', 'string', 'max:50'],
            'download_link' => ['required', 'url', 'max:1000'],
            'file_size' => ['nullable', 'string', 'max:100'],
            'system_requirements' => ['nullable', 'string'],
            'installation_guide_url' => ['nullable', 'url', 'max:1000'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'icon' => ['nullable', 'image', 'max:2048'],
            'status' => ['nullable', 'in:active,inactive'],
            'external_api_key' => ['nullable', 'string', 'max:100'],
            'external_software_id' => ['nullable', 'integer', 'min:1'],
            'external_api_base_url' => ['nullable', 'url', 'max:1000', function (string $attribute, mixed $value, \Closure $fail): void {
                $normalized = trim((string) $value);
                if ($normalized === '') {
                    return;
                }

                try {
                    ExternalApiSecurity::assertSafeBaseUrl($normalized);
                } catch (InvalidArgumentException $exception) {
                    $fail($exception->getMessage());
                }
            }],
            'external_logs_endpoint' => ['nullable', 'string', 'max:100'],
            'presets' => ['nullable', 'array'],
            'presets.*.id' => ['nullable', 'integer'],
            'presets.*.label' => ['required', 'string', 'min:1', 'max:50'],
            'presets.*.duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'presets.*.price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'presets.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'presets.*.is_active' => ['nullable', 'boolean'],
        ]);

        $iconPath = $request->hasFile('icon')
            ? $request->file('icon')->store('program-icons', 'public')
            : null;

        $program = DB::transaction(function () use ($validated, $iconPath): Program {
            $program = Program::query()->create([
                'version' => $validated['version'] ?? '1.0',
                'trial_days' => $validated['trial_days'] ?? 0,
                'status' => $validated['status'] ?? 'active',
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'download_link' => $validated['download_link'],
                'file_size' => $validated['file_size'] ?? null,
                'system_requirements' => $validated['system_requirements'] ?? null,
                'installation_guide_url' => $validated['installation_guide_url'] ?? null,
                'base_price' => $validated['base_price'],
                'icon' => $iconPath,
                'external_software_id' => $validated['external_software_id'] ?? null,
                'external_api_base_url' => ExternalApiSecurity::normalizeBaseUrl($validated['external_api_base_url'] ?? null),
                'external_logs_endpoint' => $this->normalizeExternalLogsEndpoint($validated['external_logs_endpoint'] ?? null),
                'has_external_api' => ! empty($validated['external_api_key']),
            ]);

            if (! empty($validated['external_api_key'])) {
                $program->setExternalApiKeyAttribute($validated['external_api_key']);
                $program->save();
            }

            $this->syncDurationPresets($program, $validated['presets'] ?? null);

            return $program->load('durationPresets');
        });

        $this->logActivity($request, 'program.create', sprintf('Created program %s.', $program->name), [
            'program_id' => $program->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($program)], 201);
    }

    public function show(Program $program, Request $request): JsonResponse
    {
        return response()->json(['data' => $this->serializeProgram($program->loadCount('licenses')->load('durationPresets'), $request)]);
    }

    public function update(Request $request, Program $program): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'description' => ['nullable', 'string'],
            'version' => ['sometimes', 'string', 'max:50'],
            'download_link' => ['sometimes', 'url', 'max:1000'],
            'file_size' => ['nullable', 'string', 'max:100'],
            'system_requirements' => ['nullable', 'string'],
            'installation_guide_url' => ['nullable', 'url', 'max:1000'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'base_price' => ['sometimes', 'numeric', 'min:0'],
            'icon' => ['nullable', 'image', 'max:2048'],
            'status' => ['sometimes', 'in:active,inactive'],
            'external_api_key' => ['nullable', 'string', 'max:100'],
            'external_software_id' => ['nullable', 'integer', 'min:1'],
            'external_api_base_url' => ['nullable', 'url', 'max:1000', function (string $attribute, mixed $value, \Closure $fail): void {
                $normalized = trim((string) $value);
                if ($normalized === '') {
                    return;
                }

                try {
                    ExternalApiSecurity::assertSafeBaseUrl($normalized);
                } catch (InvalidArgumentException $exception) {
                    $fail($exception->getMessage());
                }
            }],
            'external_logs_endpoint' => ['nullable', 'string', 'max:100'],
            'presets' => ['nullable', 'array'],
            'presets.*.id' => ['nullable', 'integer'],
            'presets.*.label' => ['required', 'string', 'min:1', 'max:50'],
            'presets.*.duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'presets.*.price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'presets.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'presets.*.is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('icon')) {
            if ($program->icon) {
                Storage::disk('public')->delete($program->icon);
            }

            $validated['icon'] = $request->file('icon')->store('program-icons', 'public');
        } else {
            unset($validated['icon']);
        }

        if (array_key_exists('external_software_id', $validated)) {
            $program->external_software_id = $validated['external_software_id'];
        }

        if (array_key_exists('external_api_base_url', $validated)) {
            $program->external_api_base_url = ExternalApiSecurity::normalizeBaseUrl($validated['external_api_base_url']);
        }

        if (array_key_exists('external_logs_endpoint', $validated)) {
            $program->external_logs_endpoint = $this->normalizeExternalLogsEndpoint($validated['external_logs_endpoint']);
        }

        if (! empty($validated['external_api_key'])) {
            $program->setExternalApiKeyAttribute($validated['external_api_key']);
            $program->has_external_api = true;
        }

        unset($validated['external_api_key'], $validated['external_software_id'], $validated['external_api_base_url'], $validated['external_logs_endpoint']);

        DB::transaction(function () use ($program, $validated): void {
            $program->update($validated);
            $program->save();
            if (array_key_exists('presets', $validated)) {
                $this->syncDurationPresets($program, $validated['presets']);
            }
        });

        $this->logActivity($request, 'program.update', sprintf('Updated program %s.', $program->name), [
            'program_id' => $program->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($program->fresh()->load('durationPresets'))]);
    }

    public function destroy(Request $request, Program $program): JsonResponse
    {
        $programId = $program->id;
        $programName = $program->name;

        if ($program->icon) {
            Storage::disk('public')->delete($program->icon);
        }

        $program->delete();

        $this->logActivity($request, 'program.delete', sprintf('Deleted program %s.', $programName), [
            'program_id' => $programId,
        ]);

        return response()->json(['message' => 'Program deleted successfully.']);
    }

    public function stats(Program $program): JsonResponse
    {
        return response()->json([
            'data' => [
                'licenses_sold' => $program->licenses()->count(),
                'active_licenses' => $program->licenses()->where('status', 'active')->count(),
                'expired_licenses' => $program->licenses()->where('status', 'expired')->count(),
                'revenue' => round((float) $program->licenses()->sum('price'), 2),
            ],
        ]);
    }

    private function serializeProgram(Program $program, Request $request = null): array
    {
        $licensesSold = (int) ($program->total_licenses_count ?? 0);

        // Scope licenses_sold based on user role
        if ($request && $request->user()) {
            $user = $request->user();

            if ($user->role === 'reseller') {
                // Reseller sees only their own licenses
                $licensesSold = (int) $program->licenses()->where('reseller_id', $user->id)->count();
            } elseif ($user->role === 'manager') {
                // Manager sees licenses from their team resellers only
                $tenantId = $user->tenant_id;
                $teamResellerIds = User::where('tenant_id', $tenantId)
                    ->where('role', 'reseller')
                    ->pluck('id');
                $licensesSold = (int) $program->licenses()->whereIn('reseller_id', $teamResellerIds)->count();
            } elseif ($user->role === 'manager_parent') {
                // Manager-Parent sees licenses from their tenant only
                $licensesSold = (int) $program->licenses()->where('tenant_id', $user->tenant_id)->count();
            }
            // Super admin sees all licenses (use total_licenses_count)
        }

        return [
            'id' => $program->id,
            'name' => $program->name,
            'description' => $program->description,
            'version' => $program->version,
            'download_link' => $program->download_link,
            'file_size' => $program->file_size,
            'system_requirements' => $program->system_requirements,
            'installation_guide_url' => $program->installation_guide_url,
            'trial_days' => $program->trial_days,
            'base_price' => (float) $program->base_price,
            'icon' => $program->icon ? Storage::disk('public')->url($program->icon) : null,
            'has_external_api' => (bool) $program->has_external_api,
            'external_software_id' => $program->external_software_id,
            'external_api_base_url' => null,
            'external_logs_endpoint' => $this->normalizeExternalLogsEndpoint($program->external_logs_endpoint),
            'status' => $program->status,
            'licenses_sold' => $licensesSold,
            'active_licenses_count' => (int) ($program->active_licenses_count ?? 0),
            'revenue' => round((float) ($program->total_revenue ?? 0), 2),
            'created_at' => $program->created_at?->toIso8601String(),
            'duration_presets' => $this->serializeDurationPresets($program),
        ];
    }

    /**
     * @param array<int, array<string, mixed>>|null $presets
     */
    private function syncDurationPresets(Program $program, ?array $presets): void
    {
        $normalizedPresets = $this->normalizePresetPayload($presets);

        if ($normalizedPresets->isEmpty()) {
            $normalizedPresets = collect($this->defaultDurationPresets());
        }

        $existingIds = $program->durationPresets()->pluck('id');
        $incomingIds = $normalizedPresets->pluck('id')->filter()->map(fn ($id) => (int) $id);
        $idsToDelete = $existingIds->diff($incomingIds);

        if ($idsToDelete->isNotEmpty()) {
            $program->durationPresets()->whereIn('id', $idsToDelete)->delete();
        }

        foreach ($normalizedPresets->values() as $index => $preset) {
            $payload = [
                'label' => (string) $preset['label'],
                'duration_days' => (float) $preset['duration_days'],
                'price' => (float) $preset['price'],
                'sort_order' => (int) ($preset['sort_order'] ?? $index + 1),
                'is_active' => (bool) ($preset['is_active'] ?? true),
            ];

            $presetId = isset($preset['id']) ? (int) $preset['id'] : 0;

            if ($presetId > 0) {
                $program->durationPresets()->whereKey($presetId)->update($payload);
                continue;
            }

            $program->durationPresets()->create($payload);
        }
    }

    /**
     * @param array<int, array<string, mixed>>|null $presets
     * @return Collection<int, array<string, mixed>>
     */
    private function normalizePresetPayload(?array $presets): Collection
    {
        return collect($presets ?? [])
            ->filter(fn ($preset) => is_array($preset) && trim((string) ($preset['label'] ?? '')) !== '')
            ->map(fn (array $preset): array => [
                'id' => isset($preset['id']) ? (int) $preset['id'] : null,
                'label' => trim((string) $preset['label']),
                'duration_days' => round((float) $preset['duration_days'], 4),
                'price' => round((float) $preset['price'], 2),
                'sort_order' => isset($preset['sort_order']) ? (int) $preset['sort_order'] : null,
                'is_active' => array_key_exists('is_active', $preset) ? filter_var($preset['is_active'], FILTER_VALIDATE_BOOLEAN) : true,
            ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function defaultDurationPresets(): array
    {
        return [
            ['label' => '2 Hours', 'duration_days' => 0.0833, 'price' => 60.00, 'sort_order' => 1, 'is_active' => true],
            ['label' => 'Day', 'duration_days' => 1, 'price' => 85.00, 'sort_order' => 2, 'is_active' => true],
            ['label' => 'Week', 'duration_days' => 7, 'price' => 150.00, 'sort_order' => 3, 'is_active' => true],
            ['label' => 'Month', 'duration_days' => 30, 'price' => 250.00, 'sort_order' => 4, 'is_active' => true],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function serializeDurationPresets(Program $program): array
    {
        $presets = $program->relationLoaded('durationPresets')
            ? $program->durationPresets
            : $program->durationPresets()->get();

        return $presets
            ->map(fn (ProgramDurationPreset $preset): array => [
                'id' => $preset->id,
                'program_id' => $preset->program_id,
                'label' => $preset->label,
                'duration_days' => (float) $preset->duration_days,
                'price' => (float) $preset->price,
                'sort_order' => (int) $preset->sort_order,
                'is_active' => (bool) $preset->is_active,
            ])
            ->values()
            ->all();
    }

    private function normalizeExternalLogsEndpoint(?string $value): string
    {
        $normalized = trim((string) $value, " \t\n\r\0\x0B/");

        if ($normalized === '') {
            return 'apilogs';
        }

        return preg_match('/^[A-Za-z0-9_-]+$/', $normalized) === 1 ? $normalized : 'apilogs';
    }
}
