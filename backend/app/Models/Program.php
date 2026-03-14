<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'description',
        'version',
        'download_link',
        'file_size',
        'system_requirements',
        'installation_guide_url',
        'trial_days',
        'base_price',
        'icon',
        'external_api_key_encrypted',
        'external_software_id',
        'external_api_base_url',
        'external_logs_endpoint',
        'has_external_api',
        'status',
    ];

    protected $hidden = [
        'external_api_key_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'trial_days' => 'integer',
            'base_price' => 'decimal:2',
            'external_software_id' => 'integer',
            'external_api_base_url' => 'string',
            'external_logs_endpoint' => 'string',
            'has_external_api' => 'boolean',
        ];
    }

    public function setExternalApiKeyAttribute(?string $value): void
    {
        if ($value === null || trim($value) === '') {
            return;
        }

        $this->attributes['external_api_key_encrypted'] = encrypt(trim($value));
    }

    public function getDecryptedApiKey(): ?string
    {
        if (! $this->external_api_key_encrypted) {
            return null;
        }

        try {
            return decrypt($this->external_api_key_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function licenses(): HasMany
    {
        return $this->hasMany(License::class);
    }

    public function durationPresets(): HasMany
    {
        return $this->hasMany(ProgramDurationPreset::class)->orderBy('sort_order');
    }

    public function activeDurationPresets(): HasMany
    {
        return $this->hasMany(ProgramDurationPreset::class)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }
}
