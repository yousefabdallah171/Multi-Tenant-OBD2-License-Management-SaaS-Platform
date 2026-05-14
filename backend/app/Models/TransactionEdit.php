<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionEdit extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'license_id',
        'activity_log_id',
        'super_admin_id',
        'action',
        'previous_values',
        'new_values',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'previous_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function license(): BelongsTo
    {
        return $this->belongsTo(License::class);
    }

    public function activityLog(): BelongsTo
    {
        return $this->belongsTo(ActivityLog::class);
    }

    public function superAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'super_admin_id');
    }

    public function getDiffsAttribute(): array
    {
        $diffs = [];
        $fields = [
            'price' => 'Price',
            'customer_id' => 'Customer ID',
            'activated_at' => 'Activation Date',
            'duration_days' => 'Duration (days)',
            'program_id' => 'Program ID',
        ];

        foreach ($fields as $field => $label) {
            $prev = $this->previous_values[$field] ?? null;
            $new = $this->new_values[$field] ?? null;

            if ($prev !== $new) {
                $diffs[$field] = [
                    'label' => $label,
                    'from' => $prev,
                    'to' => $new,
                ];
            }
        }

        return $diffs;
    }
}
