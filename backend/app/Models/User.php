<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'username',
        'email',
        'phone',
        'password',
        'role',
        'status',
        'created_by',
        'username_locked',
        'last_seen_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'username_locked' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'created_by');
    }

    public function createdUsers(): HasMany
    {
        return $this->hasMany(self::class, 'created_by');
    }

    public function customerLicenses(): HasMany
    {
        return $this->hasMany(License::class, 'customer_id');
    }

    public function resellerLicenses(): HasMany
    {
        return $this->hasMany(License::class, 'reseller_id');
    }

    public function apiLogs(): HasMany
    {
        return $this->hasMany(ApiLog::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function ipLogs(): HasMany
    {
        return $this->hasMany(UserIpLog::class);
    }

    public function biosBlacklistEntries(): HasMany
    {
        return $this->hasMany(BiosBlacklist::class, 'added_by');
    }

    public function biosConflicts(): HasMany
    {
        return $this->hasMany(BiosConflict::class, 'attempted_by');
    }

    public function biosAccessLogs(): HasMany
    {
        return $this->hasMany(BiosAccessLog::class);
    }

    public function balance(): HasOne
    {
        return $this->hasOne(UserBalance::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SUPER_ADMIN;
    }
}
