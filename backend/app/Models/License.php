<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class License extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'customer_id',
        'reseller_id',
        'program_id',
        'bios_id',
        'external_username',
        'external_activation_response',
        'external_deletion_response',
        'duration_days',
        'price',
        'activated_at',
        'expires_at',
        'scheduled_at',
        'scheduled_timezone',
        'scheduled_last_attempt_at',
        'scheduled_failed_at',
        'scheduled_failure_message',
        'is_scheduled',
        'activated_at_scheduled',
        'paused_at',
        'pause_remaining_minutes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'decimal:3',
            'price' => 'decimal:2',
            'activated_at' => 'datetime',
            'expires_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'scheduled_last_attempt_at' => 'datetime',
            'scheduled_failed_at' => 'datetime',
            'is_scheduled' => 'boolean',
            'activated_at_scheduled' => 'datetime',
            'paused_at' => 'datetime',
            'pause_remaining_minutes' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function reseller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reseller_id');
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function effectiveStatus(?CarbonInterface $referenceTime = null): string
    {
        $referenceTime ??= now();

        if ($this->status === 'active' && $this->expires_at !== null && $this->expires_at->lt($this->minuteWindowEnd($referenceTime))) {
            return 'expired';
        }

        return (string) $this->status;
    }

    public function isEffectivelyActive(?CarbonInterface $referenceTime = null): bool
    {
        return $this->effectiveStatus($referenceTime) === 'active';
    }

    public function scopeWhereEffectiveStatus(Builder $query, string $status, ?CarbonInterface $referenceTime = null): Builder
    {
        $referenceTime ??= now();
        $minuteWindowEnd = $this->minuteWindowEnd($referenceTime);

        return match ($status) {
            'active' => $query
                ->where('status', 'active')
                ->where(function (Builder $activeQuery) use ($referenceTime): void {
                    $activeQuery
                        ->whereNull('expires_at')
                        ->orWhere('expires_at', '>=', $this->minuteWindowEnd($referenceTime));
                }),
            'expired' => $query->where(function (Builder $expiredQuery) use ($minuteWindowEnd): void {
                $expiredQuery
                    ->where('status', 'expired')
                    ->orWhere(function (Builder $staleActiveQuery) use ($minuteWindowEnd): void {
                        $staleActiveQuery
                            ->where('status', 'active')
                            ->whereNotNull('expires_at')
                            ->where('expires_at', '<', $minuteWindowEnd);
                    });
            }),
            default => $query->where('status', $status),
        };
    }

    public function scopeWhereEffectivelyActive(Builder $query, ?CarbonInterface $referenceTime = null): Builder
    {
        return $query->whereEffectiveStatus('active', $referenceTime);
    }

    public function scopeWhereEffectivelyExpired(Builder $query, ?CarbonInterface $referenceTime = null): Builder
    {
        return $query->whereEffectiveStatus('expired', $referenceTime);
    }

    private function minuteWindowEnd(CarbonInterface $referenceTime): CarbonInterface
    {
        return $referenceTime->copy()->startOfMinute()->addMinute();
    }
}
