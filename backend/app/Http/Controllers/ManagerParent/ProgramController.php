<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Program;
use App\Support\ExternalApiSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        ])->withSum('licenses as total_revenue', 'price')->latest();

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $query->where('name', 'like', '%'.$validated['search'].'%');
        }

        $programs = $query->paginate((int) ($validated['per_page'] ?? 12));

        return response()->json([
            'data' => collect($programs->items())->map(fn (Program $program): array => $this->serializeProgram($program))->values(),
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
        ]);

        $iconPath = $request->hasFile('icon')
            ? $request->file('icon')->store('program-icons', 'public')
            : null;

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

        $this->logActivity($request, 'program.create', sprintf('Created program %s.', $program->name), [
            'program_id' => $program->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($program)], 201);
    }

    public function show(Program $program): JsonResponse
    {
        return response()->json(['data' => $this->serializeProgram($program->loadCount('licenses'))]);
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

        $program->update($validated);
        $program->save();

        $this->logActivity($request, 'program.update', sprintf('Updated program %s.', $program->name), [
            'program_id' => $program->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($program->fresh())]);
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

    private function serializeProgram(Program $program): array
    {
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
            'licenses_sold' => (int) ($program->total_licenses_count ?? 0),
            'active_licenses_count' => (int) ($program->active_licenses_count ?? 0),
            'revenue' => round((float) ($program->total_revenue ?? 0), 2),
            'created_at' => $program->created_at?->toIso8601String(),
        ];
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
