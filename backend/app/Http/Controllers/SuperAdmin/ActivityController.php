<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'user_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ActivityLog::query()
            ->with(['tenant:id,name', 'user:id,name'])
            ->latest();

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', (int) $validated['tenant_id']);
        }

        if (! empty($validated['user_id'])) {
            $query->where('user_id', (int) $validated['user_id']);
        }

        if (! empty($validated['action'])) {
            $query->where('action', 'like', '%'.$validated['action'].'%');
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $activities = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($activities->items())->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'tenant_id' => $activity->tenant_id ? (int) $activity->tenant_id : null,
                'tenant_name' => $activity->tenant?->name,
                'action' => $activity->action,
                'description' => $activity->description,
                'metadata' => $activity->metadata ?? [],
                'ip_address' => $activity->ip_address,
                'user' => $activity->user ? ['id' => $activity->user->id, 'name' => $activity->user->name] : null,
                'created_at' => $activity->created_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($activities),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = $this->index($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Timestamp', 'Tenant', 'User', 'Action', 'Description', 'IP']);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['created_at'],
                    $row['tenant_name'] ?? null,
                    $row['user']['name'] ?? null,
                    $row['action'],
                    $row['description'],
                    $row['ip_address'],
                ]);
            }

            fclose($handle);
        }, 'super-admin-activity.csv', ['Content-Type' => 'text/csv']);
    }
}
