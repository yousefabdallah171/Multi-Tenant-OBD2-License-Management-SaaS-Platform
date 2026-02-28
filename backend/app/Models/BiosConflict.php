<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiosConflict extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'bios_id',
        'attempted_by',
        'tenant_id',
        'program_id',
        'conflict_type',
        'resolved',
    ];

    protected function casts(): array
    {
        return [
            'resolved' => 'boolean',
        ];
    }

    public function attemptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'attempted_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }
}
