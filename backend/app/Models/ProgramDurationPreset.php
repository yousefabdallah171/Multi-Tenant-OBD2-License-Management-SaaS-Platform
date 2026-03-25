<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class ProgramDurationPreset extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'label',
        'duration_days',
        'price',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'decimal:4',
            'price' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
