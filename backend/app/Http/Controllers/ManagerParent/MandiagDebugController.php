<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\ApiLog;
use App\Models\License;
use App\Models\MandiagWebhookEvent;
use App\Models\User;
use App\Services\MandiagApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class MandiagDebugController extends BaseManagerParentController
{
    public function __construct(private readonly MandiagApiService $mandiagApiService)
    {
    }

    public function apiLogs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'method' => ['nullable', 'string'],
            'status_group' => ['nullable', 'in:2xx,4xx,5xx'],
            'status_from' => ['nullable', 'integer', 'between:100,599'],
            'status_to' => ['nullable', 'integer', 'between:100,599'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ApiLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'endpoint', 'method', 'status_code', 'response_time_ms', 'created_at'])
            ->with(['tenant:id,name', 'user:id,name'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('endpoint', 'like', 'mandiag:%')
            ->latest('id');

        if (! empty($validated['method'])) {
            $query->where('method', strtoupper((string) $validated['method']));
        }

        if (! empty($validated['status_group'])) {
            $range = match ($validated['status_group']) {
                '2xx' => [200, 299],
                '4xx' => [400, 499],
                '5xx' => [500, 599],
            };
            $query->whereBetween('status_code', $range);
        }

        $statusFrom = $validated['status_from'] ?? null;
        $statusTo = $validated['status_to'] ?? null;

        if ($statusFrom !== null || $statusTo !== null) {
            $query->whereBetween('status_code', [
                $statusFrom ?? 100,
                $statusTo ?? 599,
            ]);
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $logs = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($logs->items())->map(fn (ApiLog $log): array => $this->serializeLog($log))->values(),
            'meta' => $this->paginationMeta($logs),
        ]);
    }

    public function apiLogDetail(Request $request, ApiLog $log): JsonResponse
    {
        abort_unless((int) $log->tenant_id === $this->currentTenantId($request), 403);
        abort_unless(str_starts_with((string) $log->endpoint, 'mandiag:'), 404);

        $log->load(['tenant:id,name', 'user:id,name']);

        return response()->json([
            'data' => $this->serializeLog($log, true),
        ]);
    }

    public function localLicenses(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = License::query()
            ->select([
                'licenses.id',
                'licenses.mandiag_license_id',
                'licenses.status',
                'licenses.bios_id',
                'licenses.external_username',
                'licenses.duration_days',
                'licenses.activated_at',
                'licenses.expires_at',
                'licenses.program_id',
                'licenses.reseller_id',
            ])
            ->with(['program:id,name,mandiag_software_key', 'reseller:id,name'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereNotNull('mandiag_license_id')
            ->latest('id');

        if (! empty($validated['status'])) {
            $query->where('status', (string) $validated['status']);
        }

        if (! empty($validated['search'])) {
            $search = '%'.$validated['search'].'%';
            $query->where(function ($q) use ($search) {
                $q->where('bios_id', 'like', $search)
                    ->orWhere('external_username', 'like', $search);
            });
        }

        $licenses = $query->paginate((int) ($validated['per_page'] ?? 25));

        return response()->json([
            'data' => collect($licenses->items())->map(fn (License $license): array => [
                'id' => $license->id,
                'mandiag_license_id' => $license->mandiag_license_id,
                'status' => $license->status,
                'bios_id' => $license->bios_id,
                'external_username' => $license->external_username,
                'duration_days' => $license->duration_days,
                'activated_at' => $license->activated_at?->toIso8601String(),
                'expires_at' => $license->expires_at?->toIso8601String(),
                'reseller_name' => $license->reseller?->name,
                'program_name' => $license->program?->name,
                'software_key' => $license->program?->mandiag_software_key,
            ])->values(),
            'meta' => $this->paginationMeta($licenses),
        ]);
    }

    public function localResellers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $resellers = User::query()
            ->select(['id', 'name', 'username', 'mandiag_sub_id', 'mandiag_priced_software_keys', 'status', 'created_at'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', 'reseller')
            ->whereNotNull('mandiag_sub_id')
            ->latest('created_at')
            ->paginate((int) ($validated['per_page'] ?? 25));

        return response()->json([
            'data' => collect($resellers->items())->map(fn (User $reseller): array => [
                'id' => $reseller->id,
                'name' => $reseller->name,
                'username' => $reseller->username,
                'mandiag_sub_id' => $reseller->mandiag_sub_id,
                'mandiag_priced_software_keys' => $reseller->mandiag_priced_software_keys ?? [],
                'status' => $reseller->status,
                'created_at' => $reseller->created_at->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($resellers),
        ]);
    }

    public function webhookEvents(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_type' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $tenantId = $this->currentTenantId($request);

        // MandiagWebhookEvent has no tenant_id — scope by mandiag_license_ids belonging to this tenant
        $tenantMandiagLicenseIds = License::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('mandiag_license_id')
            ->pluck('mandiag_license_id')
            ->map(fn ($v): string => (string) $v)
            ->all();

        $query = MandiagWebhookEvent::query()
            ->select(['id', 'event_id', 'event_type', 'payload', 'occurred_at', 'processed_at'])
            ->where(function ($q) use ($tenantMandiagLicenseIds): void {
                if (! empty($tenantMandiagLicenseIds)) {
                    $placeholders = implode(',', array_fill(0, count($tenantMandiagLicenseIds), '?'));
                    // Events whose license_id is in tenant's licenses, or events with no license_id
                    $q->whereRaw(
                        "CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.data.license_id')) AS CHAR) IN ({$placeholders})",
                        $tenantMandiagLicenseIds
                    )->orWhereRaw("JSON_EXTRACT(payload, '$.data.license_id') IS NULL");
                } else {
                    // Tenant has no Mandiag licenses — only show events not tied to a license
                    $q->whereRaw("JSON_EXTRACT(payload, '$.data.license_id') IS NULL");
                }
            })
            ->latest('id');

        if (! empty($validated['event_type'])) {
            $query->where('event_type', (string) $validated['event_type']);
        }

        $events = $query->paginate((int) ($validated['per_page'] ?? 25));

        return response()->json([
            'data' => collect($events->items())->map(fn (MandiagWebhookEvent $event): array => [
                'id' => $event->id,
                'event_id' => $event->event_id,
                'event_type' => $event->event_type,
                'payload' => $event->payload,
                'occurred_at' => $event->occurred_at?->toIso8601String(),
                'processed_at' => $event->processed_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($events),
        ]);
    }

    public function testWebhook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_type' => ['required', 'string', 'in:license_expired,license_renewed,license_disabled,license_enabled,balance_low'],
            'data' => ['nullable', 'array'],
        ]);

        $secret = (string) config('mandiag.webhook_secret');

        if ($secret === '') {
            return response()->json(['error' => 'webhook_secret_not_configured'], 503);
        }

        $ts = (string) time();
        $payload = [
            'event_id' => 'test-'.Str::uuid(),
            'event' => $validated['event_type'],
            'data' => $validated['data'] ?? [],
            'occurred_at' => now()->toIso8601String(),
        ];
        $body = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $sig = hash_hmac('sha256', $ts.'.'.$body, $secret);

        try {
            $response = Http::withHeaders([
                'X-Mandiag-Timestamp' => $ts,
                'X-Mandiag-Signature' => $sig,
                'Content-Type' => 'application/json',
            ])->post(url('/api/mandiag/webhook'), $payload);

            return response()->json([
                'success' => $response->successful(),
                'status_code' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    public function pingMandiag(Request $request): JsonResponse
    {
        $startedAt = microtime(true);

        try {
            $result = $this->mandiagApiService->ping();
            $latency = (int) round((microtime(true) - $startedAt) * 1000);

            return response()->json([
                'success' => (bool) ($result['success'] ?? false),
                'latency_ms' => $latency,
                'status_code' => (int) ($result['status_code'] ?? 0),
                'error_code' => $result['error_code'] ?? null,
                'error_message' => $result['error_message'] ?? null,
            ]);
        } catch (Throwable $exception) {
            $latency = (int) round((microtime(true) - $startedAt) * 1000);

            return response()->json([
                'success' => false,
                'latency_ms' => $latency,
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLog(ApiLog $log, bool $includePayload = false): array
    {
        return [
            'id' => $log->id,
            'user' => $log->user?->name,
            'endpoint' => (string) $log->endpoint,
            'method' => $log->method,
            'status_code' => $log->status_code,
            'response_time_ms' => $log->response_time_ms,
            'request_body' => $includePayload ? $this->redactSensitiveData($log->request_body ?? []) : null,
            'response_body' => $includePayload ? $this->redactSensitiveData($log->response_body ?? []) : null,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    private function redactSensitiveData(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $redacted = [];
        foreach ($value as $key => $item) {
            $keyAsString = strtolower((string) $key);
            if (in_array($keyAsString, ['api_key', 'key', 'token', 'authorization'], true)) {
                $redacted[$key] = '[REDACTED]';
                continue;
            }

            $redacted[$key] = $this->redactSensitiveData($item);
        }

        return $redacted;
    }
}
