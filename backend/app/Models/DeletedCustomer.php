<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeletedCustomer extends Model
{
    protected $fillable = [
        'original_customer_id',
        'tenant_id',
        'name',
        'email',
        'username',
        'phone',
        'deleted_by',
        'deleted_at',
        'snapshot',
        'licenses_count',
        'revenue_total',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'deleted_at' => 'datetime',
        'revenue_total' => 'decimal:2',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
