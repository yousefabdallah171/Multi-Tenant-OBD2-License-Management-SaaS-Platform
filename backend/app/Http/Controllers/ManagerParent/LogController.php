<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\ApiLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['nullable', 'string'],
            'method' => ['nullable', 'string'],
            'status_group' => ['nullable', 'in:2xx,4xx,5xx'],
            'status_from' => ['nullable', 'integer', 'between:100,599'],
            'status_to' => ['nullable', 'integer', 'between:100,599'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ApiLog::query()
            ->with(['tenant:id,name', 'user:id,name'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->latest();

        if (! empty($validated['endpoint'])) {
            $query->where('endpoint', 'like', '%'.$validated['endpoint'].'%');
        }

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

    public function show(Request $request, ApiLog $log): JsonResponse
    {
        abort_unless((int) $log->tenant_id === $this->currentTenantId($request), 403);

        $log->load(['tenant:id,name', 'user:id,name']);

        return response()->json([
            'data' => $this->serializeLog($log, true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLog(ApiLog $log, bool $includePayload = false): array
    {
        return [
            'id' => $log->id,
            'tenant' => $log->tenant?->name,
            'user' => $log->user?->name,
            'endpoint' => $log->endpoint,
            'method' => $log->method,
            'status_code' => $log->status_code,
            'response_time_ms' => $log->response_time_ms,
            'request_body' => $includePayload ? ($log->request_body ?? []) : null,
            'response_body' => $includePayload ? ($log->response_body ?? []) : null,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
}
