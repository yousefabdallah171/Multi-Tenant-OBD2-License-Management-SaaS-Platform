<?php

namespace App\Http\Controllers\Manager;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $userIds = [$this->currentManager($request)->id, ...$this->teamResellerIds($request)];

        $query = ActivityLog::query()
            ->with('user:id,name')
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('user_id', $userIds)
            ->latest();

        if (! empty($validated['user_id']) && in_array((int) $validated['user_id'], $userIds, true)) {
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
            fputcsv($handle, ['Timestamp', 'User', 'Action', 'Description', 'IP']);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['created_at'],
                    $row['user']['name'] ?? null,
                    $row['action'],
                    $row['description'],
                    $row['ip_address'],
                ]);
            }

            fclose($handle);
        }, 'manager-activity.csv', ['Content-Type' => 'text/csv']);
    }
}
