<?php

namespace App\Support;

use App\Models\ActivityLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RevenueAnalytics
{
    /**
     * @param  array{from?: ?string, to?: ?string}  $filters
     */
    public static function baseQuery(array $filters = [], ?int $tenantId = null, ?array $sellerIds = null, ?int $sellerId = null): Builder
    {
        $query = ActivityLog::query()
            ->from('activity_logs')
            ->whereIn('activity_logs.action', ['license.activated', 'license.renewed']);

        if ($tenantId !== null) {
            $query->where('activity_logs.tenant_id', $tenantId);
        }

        if ($sellerId !== null) {
            $query->where('activity_logs.user_id', $sellerId);
        } elseif ($sellerIds !== null) {
            if ($sellerIds === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('activity_logs.user_id', $sellerIds);
            }
        }

        if (! empty($filters['from'])) {
            $query->where('activity_logs.created_at', '>=', CarbonImmutable::parse((string) $filters['from'])->startOfDay()->toDateTimeString());
        }

        if (! empty($filters['to'])) {
            $query->where('activity_logs.created_at', '<=', CarbonImmutable::parse((string) $filters['to'])->endOfDay()->toDateTimeString());
        }

        return $query;
    }

    public static function priceExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "CASE WHEN json_valid({$table}.metadata) THEN CAST(json_extract({$table}.metadata, '$.price') AS REAL) ELSE 0 END";
        }

        return "CASE WHEN JSON_VALID({$table}.metadata) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.price')) AS DECIMAL(12,2)) ELSE 0 END";
    }

    public static function programIdExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "CASE WHEN json_valid({$table}.metadata) THEN CAST(json_extract({$table}.metadata, '$.program_id') AS INTEGER) ELSE 0 END";
        }

        return "CASE WHEN JSON_VALID({$table}.metadata) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.program_id')) AS UNSIGNED) ELSE 0 END";
    }

    public static function attributionTypeExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "CASE WHEN json_valid({$table}.metadata) THEN COALESCE(json_extract({$table}.metadata, '$.attribution_type'), 'earned') ELSE 'earned' END";
        }

        return "CASE WHEN JSON_VALID({$table}.metadata) THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.attribution_type')), 'earned') ELSE 'earned' END";
    }

    public static function earnedCondition(string $table = 'activity_logs'): string
    {
        return self::attributionTypeExpression($table)." = 'earned'";
    }

    public static function grantedCondition(string $table = 'activity_logs'): string
    {
        return self::attributionTypeExpression($table)." = 'granted'";
    }

    public static function revenueSumExpression(string $type = 'earned', string $table = 'activity_logs', string $alias = 'revenue'): string
    {
        $condition = $type === 'granted'
            ? self::grantedCondition($table)
            : self::earnedCondition($table);

        return "ROUND(COALESCE(SUM(CASE WHEN {$condition} THEN ".self::priceExpression($table)." ELSE 0 END), 0), 2) as {$alias}";
    }

    public static function revenueCountExpression(string $type = 'earned', string $table = 'activity_logs', string $alias = 'count'): string
    {
        $condition = $type === 'granted'
            ? self::grantedCondition($table)
            : self::earnedCondition($table);

        return "SUM(CASE WHEN {$condition} THEN 1 ELSE 0 END) as {$alias}";
    }

    public static function monthKeyExpression(string $table = 'activity_logs', string $column = 'created_at'): string
    {
        if (self::isSqlite()) {
            return "strftime('%Y-%m', {$table}.{$column})";
        }

        return "DATE_FORMAT({$table}.{$column}, '%Y-%m')";
    }

    public static function totalRevenue(array $filters = [], ?int $tenantId = null, ?array $sellerIds = null, ?int $sellerId = null): float
    {
        $totals = self::baseQuery($filters, $tenantId, $sellerIds, $sellerId)
            ->selectRaw(self::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->first();

        return round((float) ($totals?->revenue ?? 0), 2);
    }

    public static function monthlyRevenueMap(
        int $months = 12,
        array $filters = [],
        ?int $tenantId = null,
        ?array $sellerIds = null,
        ?int $sellerId = null
    ): Collection {
        $start = CarbonImmutable::now()->startOfMonth()->subMonths(max($months - 1, 0));

        return self::baseQuery($filters, $tenantId, $sellerIds, $sellerId)
            ->where('activity_logs.created_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(activity_logs.created_at, '%Y-%m') as month_key")
            ->selectRaw(self::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->groupByRaw("DATE_FORMAT(activity_logs.created_at, '%Y-%m')")
            ->pluck('revenue', 'month_key');
    }

    public static function revenueByTenantIds(array $tenantIds, array $filters = []): Collection
    {
        $tenantIds = array_values(array_unique(array_map('intval', $tenantIds)));

        if ($tenantIds === []) {
            return collect();
        }

        return self::baseQuery($filters)
            ->whereIn('activity_logs.tenant_id', $tenantIds)
            ->selectRaw('activity_logs.tenant_id as tenant_id')
            ->selectRaw(self::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->groupBy('activity_logs.tenant_id')
            ->get()
            ->mapWithKeys(fn ($row): array => [
                (int) $row->tenant_id => round((float) $row->revenue, 2),
            ]);
    }

    public static function revenueBySellerIds(array $sellerIds, ?int $tenantId = null, array $filters = []): Collection
    {
        $sellerIds = array_values(array_unique(array_map('intval', $sellerIds)));

        if ($sellerIds === []) {
            return collect();
        }

        return self::baseQuery($filters, $tenantId, $sellerIds)
            ->selectRaw('activity_logs.user_id as seller_id')
            ->selectRaw(self::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->groupBy('activity_logs.user_id')
            ->get()
            ->mapWithKeys(fn ($row): array => [
                (int) $row->seller_id => round((float) $row->revenue, 2),
            ]);
    }

    public static function revenueByProgramIds(
        array $programIds,
        array $filters = [],
        ?int $tenantId = null,
        ?array $sellerIds = null,
        ?int $sellerId = null
    ): Collection {
        $programIds = array_values(array_unique(array_map('intval', $programIds)));

        if ($programIds === []) {
            return collect();
        }

        return self::baseQuery($filters, $tenantId, $sellerIds, $sellerId)
            ->selectRaw(self::programIdExpression('activity_logs').' as program_id')
            ->selectRaw(self::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->groupByRaw(self::programIdExpression('activity_logs'))
            ->get()
            ->filter(fn ($row): bool => in_array((int) ($row->program_id ?? 0), $programIds, true))
            ->mapWithKeys(fn ($row): array => [
                (int) $row->program_id => round((float) $row->revenue, 2),
            ]);
    }

    private static function isSqlite(): bool
    {
        return DB::connection()->getDriverName() === 'sqlite';
    }
}
