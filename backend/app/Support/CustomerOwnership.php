<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\License;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class CustomerOwnership
{
    public const MAX_REASONABLE_PRICE = 9999.99;

    public static function applyBlockingOwnershipScope(Builder $query, string $table = 'licenses'): Builder
    {
        return $query->where(function (Builder $blocking) use ($table): void {
            $blocking
                ->where("{$table}.status", 'suspended')
                ->orWhere(function (Builder $active) use ($table): void {
                    $active
                        ->where("{$table}.status", 'active')
                        ->where(function (Builder $notExpired) use ($table): void {
                            $notExpired
                                ->whereNull("{$table}.expires_at")
                                ->orWhere("{$table}.expires_at", '>=', now()->copy()->startOfMinute()->addMinute());
                        });
                })
                ->orWhere(function (Builder $scheduled) use ($table): void {
                    $scheduled
                        ->where("{$table}.status", 'pending')
                        ->where("{$table}.is_scheduled", true);
                })
                ->orWhere(function (Builder $paused) use ($table): void {
                    $paused
                        ->where("{$table}.status", 'pending')
                        ->where(function (Builder $plainPending) use ($table): void {
                            $plainPending
                                ->where("{$table}.is_scheduled", false)
                                ->orWhereNull("{$table}.is_scheduled");
                        })
                        ->whereNotNull("{$table}.paused_at")
                        ->where("{$table}.pause_remaining_minutes", '>', 0);
                });
        });
    }

    public static function isBlockingOwnershipLicense(License $license): bool
    {
        if (in_array($license->effectiveStatus(), ['active', 'suspended'], true)) {
            return true;
        }

        if ($license->status !== 'pending') {
            return false;
        }

        if ((bool) $license->is_scheduled) {
            return true;
        }

        return $license->paused_at !== null && (int) ($license->pause_remaining_minutes ?? 0) > 0;
    }

    /**
     * @param  Collection<int, License>  $licenses
     * @param  callable(License): bool  $matchesScope
     */
    public static function resolveDisplayLicense(Collection $licenses, callable $matchesScope, bool $hasScopedFilters): ?License
    {
        $ordered = $licenses
            ->sortByDesc(fn (License $license): int => self::sortTimestamp($license))
            ->values();

        $scoped = $ordered->filter($matchesScope)->values();

        if ($scoped->isEmpty()) {
            return $hasScopedFilters ? null : $ordered->first();
        }

        return $scoped->first(fn (License $license): bool => self::isBlockingOwnershipLicense($license))
            ?? $scoped->first();
    }

    public static function hasBlockingOwnershipElsewhere(string $biosId, ?int $excludeLicenseId = null, ?int $excludeSellerId = null): bool
    {
        $normalizedBiosId = strtolower(trim($biosId));

        if ($normalizedBiosId === '') {
            return false;
        }

        return self::applyBlockingOwnershipScope(
            License::query()
                ->whereRaw('LOWER(bios_id) = ?', [$normalizedBiosId])
                ->when($excludeLicenseId !== null, fn (Builder $query) => $query->where('id', '!=', $excludeLicenseId))
                ->when($excludeSellerId !== null, fn (Builder $query) => $query->where('reseller_id', '!=', $excludeSellerId))
        )->exists();
    }

    public static function currentOwnedCustomerCount(array $sellerIds, ?int $tenantId = null): int
    {
        if ($sellerIds === []) {
            return 0;
        }

        return (int) self::applyBlockingOwnershipScope(
            License::query()
                ->when($tenantId !== null, fn (Builder $query) => $query->where('tenant_id', $tenantId))
                ->whereIn('reseller_id', $sellerIds)
                ->whereNotNull('customer_id')
        )
            ->distinct('customer_id')
            ->count('customer_id');
    }

    public static function sanitizeDisplayPrice(mixed $price): float
    {
        $numeric = round((float) $price, 2);

        if ($numeric < 0 || $numeric > self::MAX_REASONABLE_PRICE) {
            return 0.0;
        }

        return $numeric;
    }

    public static function displayPriceForLicense(?License $license): float
    {
        if (! $license) {
            return 0.0;
        }

        $price = round((float) $license->price, 2);
        if ($price >= 0 && $price <= self::MAX_REASONABLE_PRICE) {
            return $price;
        }

        $activity = ActivityLog::query()
            ->whereIn('action', ['license.activated', 'license.renewed'])
            ->where('metadata->license_id', $license->id)
            ->latest()
            ->limit(10)
            ->get()
            ->first(function (ActivityLog $log): bool {
                $price = round((float) ($log->metadata['price'] ?? -1), 2);

                return $price >= 0 && $price <= self::MAX_REASONABLE_PRICE;
            });

        return $activity ? round((float) ($activity->metadata['price'] ?? 0), 2) : 0.0;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function displayPriceFromMetadataOrLicense(array $metadata, ?License $license): ?float
    {
        if (array_key_exists('price', $metadata)) {
            $price = round((float) $metadata['price'], 2);

            if ($price >= 0 && $price <= self::MAX_REASONABLE_PRICE) {
                return $price;
            }
        }

        return $license ? self::displayPriceForLicense($license) : null;
    }

    private static function sortTimestamp(License $license): int
    {
        return ($license->scheduled_at ?? $license->activated_at ?? $license->expires_at)?->getTimestamp() ?? 0;
    }
}
