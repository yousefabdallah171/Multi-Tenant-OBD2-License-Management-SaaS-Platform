<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class LicenseCacheInvalidation
{
    public static function invalidateForLicense(License $license): void
    {
        $license->loadMissing(['reseller:id,tenant_id,created_by']);

        $resellerId = (int) ($license->reseller_id ?? 0);
        $tenantId = (int) ($license->tenant_id ?? 0);

        if ($resellerId > 0) {
            self::forgetMany([
                "reseller:{$resellerId}:dashboard:stats",
                "reseller:{$resellerId}:dashboard:activations-chart",
                "reseller:{$resellerId}:dashboard:revenue-chart",
                "reseller:{$resellerId}:dashboard:recent-activity",
            ]);

            self::bumpVersion("reseller:{$resellerId}:reports:version");
        }

        if ($tenantId > 0) {
            self::forgetMany([
                "dashboard:manager-parent:tenant:{$tenantId}:stats",
                "dashboard:manager-parent:tenant:{$tenantId}:revenue-chart",
                "dashboard:manager-parent:tenant:{$tenantId}:expiry-forecast",
                "dashboard:manager-parent:tenant:{$tenantId}:team-performance",
                "dashboard:manager-parent:tenant:{$tenantId}:conflict-rate",
            ]);

            self::bumpVersion("manager-parent:{$tenantId}:reports:version");

            $managerIds = User::query()
                ->where('tenant_id', $tenantId)
                ->where('role', UserRole::MANAGER->value)
                ->pluck('id');

            foreach ($managerIds as $managerId) {
                self::forgetMany([
                    sprintf('dashboard:manager:%d:stats', $managerId),
                    sprintf('dashboard:manager:%d:activations-chart', $managerId),
                    sprintf('dashboard:manager:%d:revenue-chart', $managerId),
                    sprintf('dashboard:manager:%d:recent-activity', $managerId),
                ]);

                self::bumpVersion(sprintf('manager:%d:reports:version', $managerId));
            }
        }

        self::forgetMany([
            'super-admin:dashboard:stats',
            'super-admin:dashboard:revenue-trend',
            'super-admin:dashboard:tenant-comparison',
            'super-admin:dashboard:license-timeline',
            'super-admin:dashboard:recent-activity',
        ]);

        self::bumpVersion('super-admin:reports:version');
    }

    public static function reportVersion(string $scope): int
    {
        return max(1, (int) Cache::get($scope, 1));
    }

    private static function bumpVersion(string $key): void
    {
        Cache::forever($key, self::reportVersion($key) + 1);
    }

    /**
     * @param  array<int, string>  $keys
     */
    private static function forgetMany(array $keys): void
    {
        foreach ($keys as $key) {
            Cache::forget($key);
        }
    }
}
