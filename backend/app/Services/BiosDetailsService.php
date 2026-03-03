<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\License;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class BiosDetailsService
{
    public function getBiosOverview(string $biosId, ?int $tenantId = null): array
    {
        $query = License::query()
            ->with(['customer:id,name,email', 'reseller:id,name,email'])
            ->where('bios_id', $biosId);

        $this->applyTenantScope($query, $tenantId);
        $licenses = $query->orderBy('activated_at')->get();

        abort_if($licenses->isEmpty(), 404, 'BIOS not found.');

        $first = $licenses->first();
        $last = $licenses->sortByDesc('activated_at')->first();
        [$username, $originalBiosId] = $this->splitBiosId($biosId);

        $intervals = [];
        $sorted = $licenses->sortBy('activated_at')->values();
        for ($i = 1; $i < $sorted->count(); $i++) {
            $prev = $sorted[$i - 1]->activated_at;
            $curr = $sorted[$i]->activated_at;
            if ($prev && $curr) {
                $intervals[] = $prev->diffInDays($curr);
            }
        }

        return [
            'bios_id' => $biosId,
            'original_bios_id' => $originalBiosId,
            'username' => $username,
            'customer' => $first?->customer ? [
                'id' => $first->customer->id,
                'name' => $first->customer->name,
                'email' => $first->customer->email,
            ] : null,
            'reseller' => $first?->reseller ? [
                'id' => $first->reseller->id,
                'name' => $first->reseller->name,
                'email' => $first->reseller->email,
            ] : null,
            'status' => $last?->status,
            'first_activation' => $first?->activated_at?->toIso8601String(),
            'last_activity' => $last?->activated_at?->toIso8601String(),
            'total_activations' => $licenses->count(),
            'total_licenses' => $licenses->count(),
            'avg_days_between_purchases' => empty($intervals) ? 0 : (int) round(array_sum($intervals) / count($intervals)),
            'blacklist' => $this->getBlacklistStatus($biosId, $tenantId),
        ];
    }

    public function getBiosLicenseHistory(string $biosId, ?int $tenantId = null, array $filters = []): LengthAwarePaginator
    {
        $query = License::query()
            ->with(['program:id,name', 'reseller:id,name,email'])
            ->where('bios_id', $biosId)
            ->orderByDesc('activated_at');

        $this->applyTenantScope($query, $tenantId);

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (! empty($filters['program_id'])) {
            $query->where('program_id', (int) $filters['program_id']);
        }

        $perPage = (int) ($filters['per_page'] ?? 10);

        return $query->paginate($perPage);
    }

    public function getResellerBreakdown(string $biosId, ?int $tenantId = null): array
    {
        $query = License::query()
            ->with('reseller:id,name,email')
            ->where('bios_id', $biosId);

        $this->applyTenantScope($query, $tenantId);

        return $query->get()
            ->groupBy('reseller_id')
            ->map(function ($licenses) {
                $first = $licenses->first();

                return [
                    'id' => $first?->reseller_id,
                    'name' => $first?->reseller?->name,
                    'email' => $first?->reseller?->email,
                    'activation_count' => $licenses->count(),
                    'total_revenue' => (float) $licenses->sum('price'),
                ];
            })
            ->values()
            ->all();
    }

    public function getIpAnalytics(string $biosId, ?int $tenantId = null): array
    {
        $query = BiosAccessLog::query()
            ->where('bios_id', $biosId)
            ->orderByDesc('created_at');

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->limit(200)->get()->map(fn (BiosAccessLog $log): array => [
            'ip_address' => $log->ip_address,
            'action' => $log->action,
            'created_at' => $log->created_at?->toIso8601String(),
        ])->all();
    }

    public function getBiosActivity(string $biosId, ?int $tenantId = null): array
    {
        $activityQuery = ActivityLog::query()
            ->where(function ($query) use ($biosId): void {
                $query
                    ->where('description', 'like', '%'.$biosId.'%')
                    ->orWhere('metadata->bios_id', $biosId);
            })
            ->latest()
            ->limit(200);

        if ($tenantId !== null) {
            $activityQuery->where('tenant_id', $tenantId);
        }

        $activities = $activityQuery->get()->map(fn (ActivityLog $log): array => [
            'id' => $log->id,
            'action' => $log->action,
            'description' => $log->description,
            'created_at' => $log->created_at?->toIso8601String(),
        ]);

        $conflictsQuery = BiosConflict::query()->where('bios_id', $biosId)->latest()->limit(100);
        if ($tenantId !== null) {
            $conflictsQuery->where('tenant_id', $tenantId);
        }
        $conflicts = $conflictsQuery->get()->map(fn (BiosConflict $conflict): array => [
            'id' => $conflict->id,
            'action' => 'bios.conflict',
            'description' => sprintf('Conflict type: %s', $conflict->conflict_type),
            'created_at' => $conflict->created_at?->toIso8601String(),
        ]);

        return $activities
            ->concat($conflicts)
            ->sortByDesc(fn (array $row): string => (string) ($row['created_at'] ?? Carbon::now()->toIso8601String()))
            ->values()
            ->all();
    }

    public function searchBiosIds(string $query, ?int $tenantId = null): array
    {
        $biosQuery = License::query()
            ->select('bios_id')
            ->distinct()
            ->where('bios_id', 'like', '%'.$query.'%')
            ->orderByDesc('id')
            ->limit(20);

        if ($tenantId !== null) {
            $biosQuery->where('tenant_id', $tenantId);
        }

        return $biosQuery->pluck('bios_id')->values()->all();
    }

    public function getBlacklistStatus(string $biosId, ?int $tenantId = null): ?array
    {
        $query = BiosBlacklist::query()
            ->where('bios_id', $biosId)
            ->where('status', 'active')
            ->latest('created_at');

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        $row = $query->first();
        if (! $row) {
            return null;
        }

        return [
            'is_blacklisted' => true,
            'reason' => $row->reason,
            'blacklisted_by' => $row->created_by,
            'date' => $row->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param Builder<License> $query
     */
    private function applyTenantScope(Builder $query, ?int $tenantId): void
    {
        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }
    }

    /**
     * @return array{0:string,1:string}
     */
    private function splitBiosId(string $biosId): array
    {
        $position = strpos($biosId, '-');
        if ($position === false) {
            return ['', $biosId];
        }

        $username = substr($biosId, 0, $position);
        $original = substr($biosId, $position + 1);

        return [$username, $original];
    }
}

