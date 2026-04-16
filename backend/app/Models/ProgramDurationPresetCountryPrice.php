<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramDurationPresetCountryPrice extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_duration_preset_id',
        'country_name',
        'country_key',
        'price',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function preset(): BelongsTo
    {
        return $this->belongsTo(ProgramDurationPreset::class, 'program_duration_preset_id');
    }

    public static function normalizeCountryName(?string $value): ?string
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return null;
        }

        return preg_replace('/\s+/', ' ', $trimmed);
    }

    public static function normalizeCountryKey(?string $value): ?string
    {
        $name = self::normalizeCountryName($value);
        if ($name === null) {
            return null;
        }

        return mb_strtolower($name);
    }
}

