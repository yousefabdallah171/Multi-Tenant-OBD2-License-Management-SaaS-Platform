<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class BiosDetailsService
{
    public function getBiosOverview(string $biosId, ?int $tenantId = null): array
    {
        $query = License::query()
            ->with(['customer:id,name,username,email,phone', 'reseller:id,name,email,phone', 'program:id,name'])
            ->where('bios_id', $biosId);

        $this->applyTenantScope($query, $tenantId);
        $licenses = $query->orderBy('activated_at')->get();

        $blacklist = $this->getBlacklistStatus($biosId, $tenantId);

        if ($licenses->isEmpty()) {
            $latestActivity = ActivityLog::query()
                ->where(function ($query) use ($biosId): void {
                    $query
                        ->where('description', 'like', '%'.$biosId.'%')
                        ->orWhere('metadata->bios_id', $biosId);
                })
                ->when($tenantId !== null, fn (Builder $query) => $query->where('tenant_id', $tenantId))
                ->latest()
                ->first();
            $lastAccessLog = $this->biosAccessLogsQuery($biosId, $tenantId)->latest()->first();
            $lastConflict = $this->biosConflictsQuery($biosId, $tenantId)->latest()->first();

            abort_if(! $lastAccessLog && ! $lastConflict && ! $blacklist && ! $latestActivity, 404, 'BIOS not found.');

            $lastActivity = collect([
                $latestActivity?->created_at?->toIso8601String(),
                $lastAccessLog?->created_at?->toIso8601String(),
                $lastConflict?->created_at?->toIso8601String(),
                $blacklist['date'] ?? null,
            ])->filter()->sortDesc()->first();

            $activityMetadata = $latestActivity?->metadata ?? [];
            $customer = ! empty($activityMetadata['customer_id'])
                ? User::query()->select(['id', 'name', 'username', 'email', 'phone'])->find((int) $activityMetadata['customer_id'])
                : null;
            $reseller = ! empty($latestActivity?->user_id)
                ? User::query()->select(['id', 'name', 'email', 'phone'])->find((int) $latestActivity->user_id)
                : null;
            $program = ! empty($activityMetadata['program_id'])
                ? Program::query()->select(['id', 'name'])->find((int) $activityMetadata['program_id'])
                : null;
            $originalBiosId = $this->splitBiosId($biosId)[1];
            $resolvedUsername = $this->resolveOverviewUsername(null, $customer, $activityMetadata, $biosId);

            return [
                'bios_id' => $biosId,
                'original_bios_id' => $originalBiosId,
                'username' => $resolvedUsername,
                'customer' => $customer ? [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'username' => $customer->username,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                ] : null,
                'reseller' => $reseller ? [
                    'id' => $reseller->id,
                    'name' => $reseller->name,
                    'email' => $reseller->email,
                    'phone' => $reseller->phone,
                ] : null,
                'status' => ($blacklist['is_blacklisted'] ?? false) ? 'blacklisted' : ($activityMetadata['status'] ?? $lastAccessLog?->metadata['status'] ?? $lastAccessLog?->action ?? $latestActivity?->action),
                'first_activation' => null,
                'last_activity' => $lastActivity,
                'total_activations' => 0,
                'total_licenses' => 0,
                'avg_days_between_purchases' => 0,
                'latest_license' => $latestActivity ? [
                    'id' => (int) ($activityMetadata['license_id'] ?? 0),
                    'status' => $activityMetadata['status'] ?? null,
                    'price' => (float) ($activityMetadata['price'] ?? 0),
                    'duration_days' => (int) ($activityMetadata['duration_days'] ?? 0),
                    'activated_at' => $latestActivity->created_at?->toIso8601String(),
                    'expires_at' => null,
                    'external_username' => $activityMetadata['external_username'] ?? null,
                    'program' => $program ? [
                        'id' => $program->id,
                        'name' => $program->name,
                    ] : null,
                    'customer' => $customer ? [
                        'id' => $customer->id,
                        'name' => $customer->name,
                        'email' => $customer->email,
                        'phone' => $customer->phone,
                    ] : null,
                    'reseller' => $reseller ? [
                        'id' => $reseller->id,
                        'name' => $reseller->name,
                        'email' => $reseller->email,
                        'phone' => $reseller->phone,
                    ] : null,
                ] : null,
                'blacklist' => $blacklist,
            ];
        }

        $first = $licenses->first();
        $last = $licenses->sortByDesc('activated_at')->first();
        $originalBiosId = $this->splitBiosId($biosId)[1];
        $resolvedUsername = $this->resolveOverviewUsername($last, $last?->customer, [], $biosId);

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
            'username' => $resolvedUsername,
            'customer' => $first?->customer ? [
                'id' => $first->customer->id,
                'name' => $first->customer->name,
                'username' => $first->customer->username,
                'email' => $first->customer->email,
                'phone' => $first->customer->phone,
            ] : null,
            'reseller' => $first?->reseller ? [
                'id' => $first->reseller->id,
                'name' => $first->reseller->name,
                'email' => $first->reseller->email,
                'phone' => $first->reseller->phone,
            ] : null,
            'status' => $last?->status,
            'first_activation' => $first?->activated_at?->toIso8601String(),
            'last_activity' => $last?->activated_at?->toIso8601String(),
            'total_activations' => $licenses->count(),
            'total_licenses' => $licenses->count(),
            'avg_days_between_purchases' => empty($intervals) ? 0 : (int) round(array_sum($intervals) / count($intervals)),
            'latest_license' => $last ? [
                'id' => $last->id,
                'status' => $last->status,
                'price' => (float) $last->price,
                'duration_days' => (int) $last->duration_days,
                'activated_at' => $last->activated_at?->toIso8601String(),
                'expires_at' => $last->expires_at?->toIso8601String(),
                'external_username' => $last->external_username,
                'program' => $last->program ? [
                    'id' => $last->program->id,
                    'name' => $last->program->name,
                ] : null,
                'customer' => $last->customer ? [
                    'id' => $last->customer->id,
                    'name' => $last->customer->name,
                    'email' => $last->customer->email,
                    'phone' => $last->customer->phone,
                ] : null,
                'reseller' => $last->reseller ? [
                    'id' => $last->reseller->id,
                    'name' => $last->reseller->name,
                    'email' => $last->reseller->email,
                    'phone' => $last->reseller->phone,
                ] : null,
            ] : null,
            'blacklist' => $blacklist,
        ];
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function resolveOverviewUsername(?License $license, ?User $customer, array $metadata, string $biosId): string
    {
        $licenseExternalUsername = is_string($license?->external_username) ? trim((string) $license->external_username) : '';
        $customerUsername = is_string($customer?->username) ? trim((string) $customer->username) : '';
        $customerDisplayName = trim((string) ($customer?->client_name ?: $customer?->name ?: ''));

        if ($licenseExternalUsername !== '') {
            $normalizedExternal = mb_strtolower($licenseExternalUsername);
            $normalizedDisplay = $customerDisplayName !== '' ? mb_strtolower($customerDisplayName) : '';

            if ($customerUsername !== '' && $normalizedExternal === $normalizedDisplay) {
                return $customerUsername;
            }
        }

        $candidates = [
            $licenseExternalUsername !== '' ? $licenseExternalUsername : null,
            $customerUsername !== '' ? $customerUsername : null,
            is_string($metadata['external_username'] ?? null) ? $metadata['external_username'] : null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return $this->splitBiosId($biosId)[0];
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

        $accessLogs = $this->biosAccessLogsQuery($biosId, $tenantId)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (BiosAccessLog $log): array => [
                'id' => 'access-'.$log->id,
                'action' => 'bios.'.$log->action,
                'description' => (string) ($log->metadata['description'] ?? sprintf('BIOS %s action %s.', $log->bios_id, $log->action)),
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        $conflicts = $this->biosConflictsQuery($biosId, $tenantId)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (BiosConflict $conflict): array => [
            'id' => $conflict->id,
            'action' => 'bios.conflict',
            'description' => sprintf('Conflict type: %s', $conflict->conflict_type),
            'created_at' => $conflict->created_at?->toIso8601String(),
        ]);

        $blacklistEvents = $this->biosBlacklistQuery($biosId, $tenantId)
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (BiosBlacklist $entry): array => [
                'id' => 'blacklist-'.$entry->id,
                'action' => 'bios.blacklist',
                'description' => $entry->reason !== '' ? $entry->reason : 'BIOS added to blacklist.',
                'created_at' => $entry->created_at?->toIso8601String(),
            ]);

        return $activities
            ->concat($accessLogs)
            ->concat($conflicts)
            ->concat($blacklistEvents)
            ->sortByDesc(fn (array $row): string => (string) ($row['created_at'] ?? Carbon::now()->toIso8601String()))
            ->values()
            ->all();
    }

    public function searchBiosIds(string $query, ?int $tenantId = null): array
    {
        $licenseIds = License::query()
            ->select('bios_id')
            ->distinct()
            ->where('bios_id', 'like', '%'.$query.'%')
            ->orderByDesc('id')
            ->limit(20);

        if ($tenantId !== null) {
            $licenseIds->where('tenant_id', $tenantId);
        }

        $blacklistIds = $this->biosBlacklistQuery(null, $tenantId)
            ->select('bios_id')
            ->distinct()
            ->where('bios_id', 'like', '%'.$query.'%')
            ->orderByDesc('id')
            ->limit(20)
            ->pluck('bios_id');

        $accessLogIds = $this->biosAccessLogsQuery(null, $tenantId)
            ->select('bios_id')
            ->distinct()
            ->where('bios_id', 'like', '%'.$query.'%')
            ->orderByDesc('id')
            ->limit(20)
            ->pluck('bios_id');

        $conflictIds = $this->biosConflictsQuery(null, $tenantId)
            ->select('bios_id')
            ->distinct()
            ->where('bios_id', 'like', '%'.$query.'%')
            ->orderByDesc('id')
            ->limit(20)
            ->pluck('bios_id');

        return $licenseIds->pluck('bios_id')
            ->concat($blacklistIds)
            ->concat($accessLogIds)
            ->concat($conflictIds)
            ->filter()
            ->unique()
            ->values()
            ->take(20)
            ->all();
    }

    public function getRecentBiosIds(?int $tenantId = null, int $limit = 20): array
    {
        $licenseIds = License::query()
            ->whereNotNull('bios_id')
            ->where('bios_id', '!=', '')
            ->orderByDesc('id')
            ->limit($limit * 5);

        if ($tenantId !== null) {
            $licenseIds->where('tenant_id', $tenantId);
        }

        $blacklistIds = $this->biosBlacklistQuery(null, $tenantId)
            ->whereNotNull('bios_id')
            ->where('bios_id', '!=', '')
            ->orderByDesc('id')
            ->limit($limit * 5)
            ->pluck('bios_id');

        $accessLogIds = $this->biosAccessLogsQuery(null, $tenantId)
            ->whereNotNull('bios_id')
            ->where('bios_id', '!=', '')
            ->orderByDesc('id')
            ->limit($limit * 5)
            ->pluck('bios_id');

        $conflictIds = $this->biosConflictsQuery(null, $tenantId)
            ->whereNotNull('bios_id')
            ->where('bios_id', '!=', '')
            ->orderByDesc('id')
            ->limit($limit * 5)
            ->pluck('bios_id');

        return $licenseIds->pluck('bios_id')
            ->concat($blacklistIds)
            ->concat($accessLogIds)
            ->concat($conflictIds)
            ->filter()
            ->unique()
            ->values()
            ->take($limit)
            ->all();
    }

    public function getBlacklistStatus(string $biosId, ?int $tenantId = null): ?array
    {
        $query = $this->biosBlacklistQuery($biosId, $tenantId)
            ->where('status', 'active')
            ->latest('created_at');

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

    private function biosBlacklistQuery(?string $biosId = null, ?int $tenantId = null): Builder
    {
        $query = BiosBlacklist::query()->withoutGlobalScope('tenant');

        if ($biosId !== null) {
            $query->where('bios_id', $biosId);
        }

        if ($tenantId !== null) {
            $query->where(function (Builder $inner) use ($tenantId): void {
                $inner->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            });
        }

        return $query;
    }

    private function biosAccessLogsQuery(?string $biosId = null, ?int $tenantId = null): Builder
    {
        $query = BiosAccessLog::query();

        if ($biosId !== null) {
            $query->where('bios_id', $biosId);
        }

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        return $query;
    }

    private function biosConflictsQuery(?string $biosId = null, ?int $tenantId = null): Builder
    {
        $query = BiosConflict::query();

        if ($biosId !== null) {
            $query->where('bios_id', $biosId);
        }

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        return $query;
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
