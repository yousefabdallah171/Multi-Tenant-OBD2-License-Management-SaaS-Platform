<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
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
            $query->whereDate('activity_logs.created_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->whereDate('activity_logs.created_at', '<=', $filters['to']);
        }

        return $query;
    }

    public static function priceExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "CAST(json_extract({$table}.metadata, '$.price') AS REAL)";
        }

        return "CAST(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.price')) AS DECIMAL(12,2))";
    }

    public static function programIdExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "CAST(json_extract({$table}.metadata, '$.program_id') AS INTEGER)";
        }

        return "CAST(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.program_id')) AS UNSIGNED)";
    }

    public static function attributionTypeExpression(string $table = 'activity_logs'): string
    {
        if (self::isSqlite()) {
            return "COALESCE(json_extract({$table}.metadata, '$.attribution_type'), 'earned')";
        }

        return "COALESCE(JSON_UNQUOTE(JSON_EXTRACT({$table}.metadata, '$.attribution_type')), 'earned')";
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

    private static function isSqlite(): bool
    {
        return DB::connection()->getDriverName() === 'sqlite';
    }
}
