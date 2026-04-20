<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserUsernameHistory extends Model
{
    use BelongsToTenant, HasFactory;

    protected $table = 'user_username_history';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'old_username',
        'new_username',
        'changed_by_user_id',
        'reason',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}

