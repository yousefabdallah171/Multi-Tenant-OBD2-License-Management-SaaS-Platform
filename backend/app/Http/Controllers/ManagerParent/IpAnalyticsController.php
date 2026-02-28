<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\UserIpLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IpAnalyticsController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'country' => ['nullable', 'string'],
            'reputation_score' => ['nullable', 'in:low,medium,high'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = UserIpLog::query()->with('user:id,name,email')->latest();

        if (! empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (! empty($validated['country'])) {
            $query->where('country', $validated['country']);
        }

        if (! empty($validated['reputation_score'])) {
            $query->where('reputation_score', $validated['reputation_score']);
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $logs = $query->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => collect($logs->items())->map(fn (UserIpLog $log): array => [
                'id' => $log->id,
                'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name, 'email' => $log->user->email] : null,
                'ip_address' => $log->ip_address,
                'country' => $log->country,
                'city' => $log->city,
                'isp' => $log->isp,
                'reputation_score' => $log->reputation_score,
                'action' => $log->action,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($logs),
        ]);
    }

    public function stats(): JsonResponse
    {
        $logs = UserIpLog::query()->get();

        return response()->json([
            'data' => [
                'countries' => $logs
                    ->groupBy(fn (UserIpLog $log): string => $log->country ?: 'Unknown')
                    ->map(fn ($group, string $country): array => ['country' => $country, 'count' => $group->count()])
                    ->sortByDesc('count')
                    ->values(),
                'suspicious' => $logs
                    ->where('reputation_score', 'high')
                    ->sortByDesc('created_at')
                    ->take(10)
                    ->map(fn (UserIpLog $log): array => [
                        'id' => $log->id,
                        'ip_address' => $log->ip_address,
                        'country' => $log->country,
                        'user_id' => $log->user_id,
                        'created_at' => $log->created_at?->toIso8601String(),
                    ])
                    ->values(),
            ],
        ]);
    }
}
