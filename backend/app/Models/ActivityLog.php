<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class ActivityLog extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'action',
        'description',
        'metadata',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeWhereMetadataLicenseId(Builder $query, int $licenseId): Builder
    {
        $needle = (string) $licenseId;
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return $query->whereRaw("CAST(json_extract(metadata, '$.license_id') AS TEXT) = ?", [$needle]);
        }

        // Handle both numeric and string JSON types for license_id
        return $query->whereRaw(
            "(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id')) = ? OR JSON_EXTRACT(metadata, '$.license_id') = ?)",
            [$needle, (int) $licenseId]
        );
    }
}
