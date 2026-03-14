<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ResellerCommission extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'reseller_id',
        'manager_id',
        'tenant_id',
        'period',
        'total_sales',
        'commission_rate',
        'commission_owed',
        'amount_paid',
        'outstanding',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'total_sales' => 'decimal:2',
            'commission_rate' => 'decimal:2',
            'commission_owed' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'outstanding' => 'decimal:2',
        ];
    }

    public function reseller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reseller_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ResellerPayment::class, 'commission_id');
    }

    public function scopeUnpaid($query)
    {
        return $query->where('status', 'unpaid');
    }

    public function scopeForPeriod($query, string $period)
    {
        return $query->where('period', $period);
    }

    public function scopeForReseller($query, int $resellerId)
    {
        return $query->where('reseller_id', $resellerId);
    }
}
