<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTablePreference extends Model
{
    protected $fillable = [
        'user_id',
        'table_key',
        'visible_columns',
        'per_page',
    ];

    protected function casts(): array
    {
        return [
            'visible_columns' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
