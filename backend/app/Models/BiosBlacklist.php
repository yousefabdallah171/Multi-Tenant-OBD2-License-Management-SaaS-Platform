<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiosBlacklist extends Model
{
    use HasFactory;

    protected $table = 'bios_blacklist';

    protected $fillable = [
        'bios_id',
        'added_by',
        'reason',
        'status',
    ];

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }
}
