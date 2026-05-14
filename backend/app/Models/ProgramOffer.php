<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramOffer extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'program_id',
        'user_id',
        'discount_percentage',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'discount_percentage' => 'float',
        'is_active' => 'bool',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
