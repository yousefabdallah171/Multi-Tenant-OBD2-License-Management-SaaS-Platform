<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiosBlacklist extends Model
{
    use BelongsToTenant, HasFactory;

    protected $table = 'bios_blacklist';

    protected $fillable = [
        'tenant_id',
        'bios_id',
        'added_by',
        'reason',
        'status',
    ];

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
