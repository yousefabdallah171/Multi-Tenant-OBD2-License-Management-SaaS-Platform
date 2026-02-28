<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ActivityLog::query()
            ->where('user_id', $this->currentReseller($request)->id)
            ->latest();

        if (! empty($validated['action'])) {
            $query->where('action', 'like', '%'.$validated['action'].'%');
        }

        $activities = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($activities->items())->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'action' => $activity->action,
                'description' => $activity->description,
                'metadata' => $activity->metadata ?? [],
                'ip_address' => $activity->ip_address,
                'created_at' => $activity->created_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($activities),
        ]);
    }
}
