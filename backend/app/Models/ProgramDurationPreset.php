<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    public function countryPrices(): HasMany
    {
        return $this->hasMany(ProgramDurationPresetCountryPrice::class, 'program_duration_preset_id');
    }

    /**
     * @return array{
     *     price: float,
     *     source: 'country_override'|'preset_default',
     *     country_name: string|null,
     *     country_override_price: float|null
     * }
     */
    public function resolveEffectivePriceByCountry(?string $countryName): array
    {
        $countryKey = ProgramDurationPresetCountryPrice::normalizeCountryKey($countryName);
        $basePrice = (float) $this->price;

        if ($countryKey === null) {
            return [
                'price' => $basePrice,
                'source' => 'preset_default',
                'country_name' => null,
                'country_override_price' => null,
            ];
        }

        $match = $this->relationLoaded('countryPrices')
            ? $this->countryPrices
                ->first(fn (ProgramDurationPresetCountryPrice $row): bool => (bool) $row->is_active && (string) $row->country_key === $countryKey)
            : $this->countryPrices()
                ->where('country_key', $countryKey)
                ->where('is_active', true)
                ->first();

        if (! $match) {
            return [
                'price' => $basePrice,
                'source' => 'preset_default',
                'country_name' => ProgramDurationPresetCountryPrice::normalizeCountryName($countryName),
                'country_override_price' => null,
            ];
        }

        return [
            'price' => (float) $match->price,
            'source' => 'country_override',
            'country_name' => $match->country_name,
            'country_override_price' => (float) $match->price,
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
