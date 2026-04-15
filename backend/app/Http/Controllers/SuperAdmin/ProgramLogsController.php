<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Services\ExternalApiService;
use App\Support\CustomerOwnership;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgramLogsController extends BaseSuperAdminController
{
    private const TRACKED_ACTIONS = [
        'license.activated',
        'license.scheduled',
        'license.renewed',
        'license.deactivated',
        'license.delete',
        'license.paused',
        'license.resumed',
        'license.scheduled_activation_executed',
        'license.scheduled_activation_failed',
        'manager.program.activate',
    ];

    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function programs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $programs = Program::query()
            ->with('tenant:id,name')
            ->when(! empty($validated['tenant_id']), fn ($query) => $query->where('tenant_id', (int) $validated['tenant_id']))
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->where('has_external_api', true)
            ->whereNotNull('external_software_id')
            ->where('external_software_id', '>', 0)
            ->orderBy('name')
            ->paginate((int) ($validated['per_page'] ?? 100));

        return response()->json([
            'data' => collect($programs->items())->map(fn (Program $program): array => [
                'id' => $program->id,
                'tenant_id' => $program->tenant_id,
                'tenant_name' => $program->tenant?->name,
                'name' => $program->name,
                'description' => $program->description,
                'version' => $program->version,
                'download_link' => $program->download_link,
                'trial_days' => $program->trial_days,
                'base_price' => round((float) $program->base_price, 2),
                'icon' => $program->icon,
                'has_external_api' => (bool) $program->has_external_api,
                'external_software_id' => $program->external_software_id,
                'external_api_base_url' => $program->external_api_base_url,
                'external_logs_endpoint' => $program->external_logs_endpoint,
                'status' => $program->status,
                'licenses_sold' => 0,
                'active_licenses_count' => 0,
                'revenue' => 0,
                'created_at' => $program->created_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($programs),
        ]);
    }

    public function sellers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'role' => ['nullable', 'in:manager_parent,manager,reseller'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $sellers = User::query()
            ->with('tenant:id,name')
            ->when(! empty($validated['tenant_id']), fn ($query) => $query->where('tenant_id', (int) $validated['tenant_id']))
            ->when(! empty($validated['role']), fn ($query) => $query->where('role', $validated['role']))
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->orderBy('name')
            ->paginate((int) ($validated['per_page'] ?? 100));

        return response()->json([
            'data' => collect($sellers->items())->map(fn (User $user): array => [
                'id' => (int) $user->id,
                'tenant_id' => $user->tenant_id ? (int) $user->tenant_id : null,
                'tenant_name' => $user->tenant?->name,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? (string) $user->role,
            ])->values(),
            'meta' => $this->paginationMeta($sellers),
        ]);
    }

    public function show(Request $request, Program $program): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'seller_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string', Rule::in(self::TRACKED_ACTIONS)],
        ]);
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 100);
        $tenantId = (int) $program->tenant_id;

        $guard = $this->guardExternalApi($program);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getProgramLogs(
            (int) $program->external_software_id,
            $program->external_api_base_url,
            (string) ($program->external_logs_endpoint ?: 'apilogs'),
        );
        $externalOk = (bool) ($response['success'] ?? false);
        $licenses = License::query()
            ->where('tenant_id', $tenantId)
            ->where('program_id', $program->id)
            ->with(['reseller:id,name,email', 'customer:id,name,email,username'])
            ->get();
        $licensesMap = $licenses
            ->filter(fn (License $license): bool => filled($license->external_username))
            ->mapWithKeys(fn (License $license): array => [
                (string) $license->external_username => [[
                    'license_id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'customer_id' => $license->customer_id,
                    'customer_name' => $license->customer?->name,
                    'customer_username' => $license->customer?->username,
                    'reseller_id' => $license->reseller_id,
                    'reseller_name' => $license->reseller?->name,
                    'reseller_email' => $license->reseller?->email,
                ]],
            ]);
        $licensesById = $licenses->keyBy('id');
        $licenseIds = $licensesById->keys()->map(fn ($id): int => (int) $id)->all();
        $activityQuery = $this->programActivityQuery($tenantId, (int) $program->id, $licenseIds);
        $actorIds = (clone $activityQuery)->select('user_id')->distinct()->pluck('user_id')->filter()->map(fn ($id): int => (int) $id)->all();

        if (! empty($validated['seller_id'])) {
            $allowedActor = User::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
                ->whereKey((int) $validated['seller_id'])
                ->exists();

            $allowedActor ? $activityQuery->where('user_id', (int) $validated['seller_id']) : $activityQuery->whereRaw('1 = 0');
        }

        if (! empty($validated['action'])) {
            $activityQuery->where('action', $validated['action']);
        }

        $summaryQuery = clone $activityQuery;
        $activities = $activityQuery->latest()->paginate($perPage, ['*'], 'page', $page);
        $raw = (string) ($response['data']['raw'] ?? '');
        $lines = preg_split('/\r\n|\r|\n/', $raw) ?: [];
        $rows = [];

        foreach ($lines as $line) {
            $trimmed = trim((string) $line);
            if ($trimmed === '') {
                continue;
            }

            if (preg_match('/new user added - (.+?) with bios - (.+?) at time (.+)$/i', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'add',
                    'username' => $username,
                    'bios_id' => trim($matches[2]),
                    'timestamp' => trim($matches[3]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
                continue;
            }

            if (preg_match('/user deleted - (.+?) at time (.+)$/i', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'delete',
                    'username' => $username,
                    'timestamp' => trim($matches[2]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
                continue;
            }

            if (preg_match('/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'login',
                    'username' => $username,
                    'timestamp' => trim($matches[2]),
                    'ip' => trim($matches[3]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
            }
        }

        $users = User::query()
            ->select(['id', 'name', 'role'])
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $actorIds)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role?->value ?? (string) $user->role,
            ])
            ->values();

        return response()->json([
            'data' => [
                'raw' => $raw,
                'rows' => $rows,
                'user_rows' => collect($activities->items())->map(fn (ActivityLog $activity): array => $this->serializeActivity($activity, $licensesById, $program))->values(),
                'users' => $users,
                'summary' => $this->activitySummary($summaryQuery),
                'external_available' => $externalOk,
                'meta' => [
                    'page' => $activities->currentPage(),
                    'per_page' => $activities->perPage(),
                    'total' => $activities->total(),
                    'last_page' => $activities->lastPage(),
                    'has_next_page' => $activities->hasMorePages(),
                    'next_page' => $activities->hasMorePages() ? $activities->currentPage() + 1 : null,
                ],
            ],
            'message' => $externalOk ? null : 'External API is currently unavailable. Showing cached/empty logs.',
        ], 200);
    }

    public function activeUsers(Request $request, Program $program): JsonResponse
    {
        $guard = $this->guardExternalApi($program);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getActiveUsers((int) $program->external_software_id, $program->external_api_base_url);
        $externalOk = (bool) ($response['success'] ?? false);

        return response()->json([
            'data' => $response['data'],
            'external_available' => $externalOk,
            'message' => $externalOk ? null : 'External API is currently unavailable.',
        ], 200);
    }

    public function stats(Request $request, Program $program): JsonResponse
    {
        $guard = $this->guardExternalApi($program);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getSoftwareStats((int) $program->external_software_id, $program->external_api_base_url);
        $externalOk = (bool) ($response['success'] ?? false);

        return response()->json([
            'data' => $response['data'],
            'external_available' => $externalOk,
            'message' => $externalOk ? null : 'External API is currently unavailable.',
        ], 200);
    }

    private function programActivityQuery(int $tenantId, int $programId, array $licenseIds): Builder
    {
        return ActivityLog::query()
            ->with('user:id,name,role')
            ->where('tenant_id', $tenantId)
            ->whereIn('action', self::TRACKED_ACTIONS)
            ->where(function (Builder $builder) use ($programId, $licenseIds): void {
                $builder->where('metadata->program_id', $programId);

                foreach (array_chunk($licenseIds, 200) as $chunk) {
                    $placeholders = implode(', ', array_fill(0, count($chunk), '?'));
                    $builder->orWhereRaw("CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id')) AS UNSIGNED) IN ({$placeholders})", $chunk);
                }
            });
    }

    private function guardExternalApi(Program $program): ?JsonResponse
    {
        if (! $program->has_external_api || ! $program->external_software_id) {
            return response()->json([
                'message' => 'No external API configured for this program.',
            ], 422);
        }

        return null;
    }

    private function serializeActivity(ActivityLog $activity, $licensesById, Program $program): array
    {
        $metadata = $activity->metadata ?? [];
        $licenseId = (int) ($metadata['license_id'] ?? 0);
        $license = $licenseId > 0 ? $licensesById->get($licenseId) : null;
        $actorRole = $activity->user?->role?->value ?? (string) $activity->user?->role;
        $customerId = (int) ($metadata['customer_id'] ?? $license?->customer_id ?? 0);

        return [
            'id' => $activity->id,
            'tenant_id' => (int) $program->tenant_id,
            'action' => $activity->action,
            'actor' => $activity->user ? [
                'id' => $activity->user->id,
                'name' => $activity->user->name,
                'role' => $actorRole,
            ] : null,
            'license_id' => $license?->id ?? ($licenseId > 0 ? $licenseId : null),
            'customer_id' => $customerId > 0 ? $customerId : null,
            'customer_name' => $license?->customer?->name,
            'customer_username' => $license?->customer?->username,
            'bios_id' => (string) ($metadata['bios_id'] ?? $license?->bios_id ?? ''),
            'external_username' => (string) ($metadata['external_username'] ?? $license?->external_username ?? $license?->customer?->username ?? ''),
            'program_id' => (int) ($metadata['program_id'] ?? $program->id),
            'program_name' => $program->name,
            'price' => CustomerOwnership::displayPriceFromMetadataOrLicense($metadata, $license),
            'license_status' => $license?->status,
            'created_at' => $activity->created_at?->toIso8601String(),
        ];
    }

    private function activitySummary(Builder $query): array
    {
        return [
            'total_entries' => (clone $query)->count(),
            'activations' => (clone $query)->whereIn('action', ['license.activated', 'manager.program.activate'])->count(),
            'scheduled' => (clone $query)->where('action', 'license.scheduled')->count(),
            'executed' => (clone $query)->where('action', 'license.scheduled_activation_executed')->count(),
            'renewals' => (clone $query)->where('action', 'license.renewed')->count(),
            'deactivations' => (clone $query)->where('action', 'license.deactivated')->count(),
            'failures' => (clone $query)->where('action', 'license.scheduled_activation_failed')->count(),
        ];
    }
}
