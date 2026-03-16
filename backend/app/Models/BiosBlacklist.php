<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiosBlacklist extends Model
{
    use BelongsToTenant, HasFactory;

    protected $table = 'bios_blacklist';

    protected $fillable = [
        'tenant_id',
        'bios_id',
        'added_by',
        'reason',
        'status',
    ];

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function activeForTenant(string $biosId, ?int $tenantId): Builder
    {
        $normalizedBiosId = trim($biosId);

        return static::query()
            ->withoutGlobalScope('tenant')
            ->where('bios_id', $normalizedBiosId)
            ->where('status', 'active')
            ->where(function (Builder $query) use ($tenantId): void {
                $query->whereNull('tenant_id');

                if ($tenantId !== null) {
                    $query->orWhere('tenant_id', $tenantId);
                }
            });
    }

    public static function blocksBios(string $biosId, ?int $tenantId): bool
    {
        $normalizedBiosId = trim($biosId);

        if ($normalizedBiosId === '') {
            return false;
        }

        return static::activeForTenant($normalizedBiosId, $tenantId)->exists();
    }

    /**
     * @param array<int, string|null> $biosIds
     */
    public static function activeRowsForBiosIds(array $biosIds): Collection
    {
        $normalizedBiosIds = collect($biosIds)
            ->map(fn (?string $biosId): string => trim((string) $biosId))
            ->filter()
            ->unique()
            ->values();

        if ($normalizedBiosIds->isEmpty()) {
            return new Collection();
        }

        return static::query()
            ->withoutGlobalScope('tenant')
            ->whereIn('bios_id', $normalizedBiosIds->all())
            ->where('status', 'active')
            ->get(['id', 'tenant_id', 'bios_id', 'status']);
    }
}
