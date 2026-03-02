<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\Program;
use App\Models\User;
use App\Services\BiosActivationService;
use App\Support\ExternalApiSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Illuminate\Validation\ValidationException;

class SoftwareController extends BaseManagerController
{
    public function __construct(private readonly BiosActivationService $biosActivationService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,inactive'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Program::query()
            ->withCount([
                'licenses as active_licenses_count' => fn ($builder) => $builder->where('status', 'active'),
                'licenses as total_licenses_count',
            ])
            ->withSum('licenses as total_revenue', 'price')
            ->latest();

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
            'download_link' => ['required', 'url', 'max:1000'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'icon' => ['nullable', 'url', 'max:1000'],
            'description' => ['nullable', 'string'],
            'version' => ['nullable', 'string', 'max:50'],
            'file_size' => ['nullable', 'string', 'max:100'],
            'system_requirements' => ['nullable', 'string'],
            'installation_guide_url' => ['nullable', 'url', 'max:1000'],
            'active' => ['nullable', 'boolean'],
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

        $program = Program::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'version' => $validated['version'] ?? '1.0',
            'download_link' => $validated['download_link'],
            'file_size' => $validated['file_size'] ?? null,
            'system_requirements' => $validated['system_requirements'] ?? null,
            'installation_guide_url' => $validated['installation_guide_url'] ?? null,
            'trial_days' => $validated['trial_days'] ?? 7,
            'base_price' => $validated['base_price'],
            'icon' => $validated['icon'] ?? null,
            'status' => $this->resolveStatus($validated),
            'external_software_id' => $validated['external_software_id'] ?? null,
            'external_api_base_url' => $validated['external_api_base_url'] ?? null,
            'external_logs_endpoint' => $this->normalizeExternalLogsEndpoint($validated['external_logs_endpoint'] ?? null),
            'has_external_api' => ! empty($validated['external_api_key']),
        ]);

        if (! empty($validated['external_api_key'])) {
            $program->setExternalApiKeyAttribute($validated['external_api_key']);
            $program->save();
        }

        $this->logActivity($request, 'manager.program.create', sprintf('Created program %s.', $program->name), [
            'program_id' => $program->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($program)], 201);
    }

    public function update(Request $request, Program $program): JsonResponse
    {
        $target = $this->resolveProgram($request, $program);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'download_link' => ['sometimes', 'url', 'max:1000'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'base_price' => ['sometimes', 'numeric', 'min:0'],
            'icon' => ['nullable', 'url', 'max:1000'],
            'description' => ['nullable', 'string'],
            'version' => ['nullable', 'string', 'max:50'],
            'file_size' => ['nullable', 'string', 'max:100'],
            'system_requirements' => ['nullable', 'string'],
            'installation_guide_url' => ['nullable', 'url', 'max:1000'],
            'active' => ['nullable', 'boolean'],
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

        if (array_key_exists('active', $validated) || array_key_exists('status', $validated)) {
            $validated['status'] = $this->resolveStatus($validated, $target->status);
        }

        if (array_key_exists('external_software_id', $validated)) {
            $target->external_software_id = $validated['external_software_id'];
        }

        if (array_key_exists('external_api_base_url', $validated)) {
            $target->external_api_base_url = $validated['external_api_base_url'];
        }

        if (array_key_exists('external_logs_endpoint', $validated)) {
            $target->external_logs_endpoint = $this->normalizeExternalLogsEndpoint($validated['external_logs_endpoint']);
        }

        if (! empty($validated['external_api_key'])) {
            $target->setExternalApiKeyAttribute($validated['external_api_key']);
            $target->has_external_api = true;
        }

        unset($validated['external_api_key'], $validated['external_software_id'], $validated['external_api_base_url'], $validated['external_logs_endpoint']);
        unset($validated['active']);

        $target->update($validated);
        $target->save();

        $this->logActivity($request, 'manager.program.update', sprintf('Updated program %s.', $target->name), [
            'program_id' => $target->id,
        ]);

        return response()->json(['data' => $this->serializeProgram($target->fresh())]);
    }

    public function destroy(Request $request, Program $program): JsonResponse
    {
        $target = $this->resolveProgram($request, $program);
        $programId = $target->id;
        $programName = $target->name;

        $target->delete();

        $this->logActivity($request, 'manager.program.delete', sprintf('Deleted program %s.', $programName), [
            'program_id' => $programId,
        ]);

        return response()->json(['message' => 'Program deleted successfully.']);
    }

    public function activate(Request $request, Program $program): JsonResponse
    {
        $target = $this->resolveProgram($request, $program);

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'bios_id' => ['required', 'string', 'max:255'],
        ]);

        $customer = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::CUSTOMER->value)
            ->where('username', $validated['username'])
            ->first();

        if (! $customer) {
            throw ValidationException::withMessages([
                'username' => 'Customer username was not found.',
            ]);
        }

        $customer = $this->resolveTeamUser($request, $customer);
        $reseller = $this->resolveActivationReseller($request, $customer);

        $activation = $this->biosActivationService->activate(
            $customer,
            $reseller,
            $target,
            $validated['bios_id'],
            max((int) $target->trial_days, 7),
        );

        if (! $activation['success']) {
            return response()->json($activation['data'], $activation['status_code']);
        }

        if ($target->status !== 'active') {
            $target->update(['status' => 'active']);
        }

        $this->logActivity($request, 'manager.program.activate', sprintf('Activated program %s for %s.', $target->name, $customer->username ?? $customer->email), [
            'program_id' => $target->id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'bios_id' => $validated['bios_id'],
        ]);

        return response()->json([
            'data' => $this->serializeProgram($target->fresh()->loadCount([
                'licenses as active_licenses_count' => fn ($builder) => $builder->where('status', 'active'),
                'licenses as total_licenses_count',
            ])->loadSum('licenses as total_revenue', 'price')),
        ]);
    }

    private function resolveProgram(Request $request, Program $program): Program
    {
        abort_unless((int) $program->tenant_id === $this->currentTenantId($request), 403);

        return $program;
    }

    private function resolveActivationReseller(Request $request, User $customer): User
    {
        $resellerIds = $this->teamResellerIds($request);

        $resellerId = $customer->customerLicenses()
            ->whereIn('reseller_id', $resellerIds)
            ->latest('activated_at')
            ->value('reseller_id');

        if (! $resellerId && in_array((int) $customer->created_by, $resellerIds, true)) {
            $resellerId = (int) $customer->created_by;
        }

        if (! $resellerId) {
            throw ValidationException::withMessages([
                'username' => 'Customer must belong to a reseller under this manager.',
            ]);
        }

        $reseller = User::query()->findOrFail($resellerId);

        return $this->resolveTeamReseller($request, $reseller);
    }

    /**
     * @param array<string, mixed> $validated
     */
    private function resolveStatus(array $validated, string $fallback = 'inactive'): string
    {
        if (array_key_exists('status', $validated) && $validated['status']) {
            return (string) $validated['status'];
        }

        if (array_key_exists('active', $validated)) {
            return (bool) $validated['active'] ? 'active' : 'inactive';
        }

        return $fallback;
    }

    /**
     * @return array<string, mixed>
     */
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
            'icon' => $program->icon,
            'has_external_api' => (bool) $program->has_external_api,
            'external_software_id' => $program->external_software_id,
            'external_api_base_url' => null,
            'external_logs_endpoint' => $this->normalizeExternalLogsEndpoint($program->external_logs_endpoint),
            'status' => $program->status,
            'licenses_sold' => (int) ($program->total_licenses_count ?? $program->licenses()->count()),
            'active_licenses_count' => (int) ($program->active_licenses_count ?? $program->licenses()->where('status', 'active')->count()),
            'revenue' => round((float) ($program->total_revenue ?? $program->licenses()->sum('price')), 2),
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
