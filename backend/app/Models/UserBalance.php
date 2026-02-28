<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBalance extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'user_id',
        'tenant_id',
        'total_revenue',
        'total_activations',
        'pending_balance',
        'last_activity_at',
    ];

    protected function casts(): array
    {
        return [
            'total_revenue' => 'decimal:2',
            'total_activations' => 'integer',
            'pending_balance' => 'decimal:2',
            'last_activity_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
