<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PricingHistory extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'reseller_id',
        'program_id',
        'old_price',
        'new_price',
        'commission_rate',
        'change_type',
        'metadata',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'old_price' => 'decimal:2',
            'new_price' => 'decimal:2',
            'commission_rate' => 'decimal:2',
            'metadata' => 'array',
        ];
    }

    public function reseller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reseller_id');
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
