<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
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
        'is_scheduled',
        'activated_at_scheduled',
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
            'is_scheduled' => 'boolean',
            'activated_at_scheduled' => 'datetime',
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
}
