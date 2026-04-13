<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
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
        'client_name',
        'username',
        'email',
        'phone',
        'country_name',
        'timezone',
        'password',
        'role',
        'status',
        'created_by',
        'username_locked',
        'last_seen_at',
        'branding',
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
            'branding' => 'json',
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

    public function biosChangeRequests(): HasMany
    {
        return $this->hasMany(BiosChangeRequest::class, 'reseller_id');
    }

    public function reviewedBiosChangeRequests(): HasMany
    {
        return $this->hasMany(BiosChangeRequest::class, 'reviewer_id');
    }

    public function resellerCommissions(): HasMany
    {
        return $this->hasMany(ResellerCommission::class, 'reseller_id');
    }

    public function managedResellerCommissions(): HasMany
    {
        return $this->hasMany(ResellerCommission::class, 'manager_id');
    }

    public function resellerPayments(): HasMany
    {
        return $this->hasMany(ResellerPayment::class, 'reseller_id');
    }

    public function managedResellerPayments(): HasMany
    {
        return $this->hasMany(ResellerPayment::class, 'manager_id');
    }

    public function balance(): HasOne
    {
        return $this->hasOne(UserBalance::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SUPER_ADMIN;
    }

    public static function generateUniqueUsername(?string $seed, ?int $ignoreId = null): string
    {
        $value = trim((string) $seed);

        if ($value !== '' && filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $value = Str::before($value, '@');
        }

        $base = Str::of($value)->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();
        $base = $base !== '' ? $base : 'user';
        $username = $base;
        $counter = 2;

        while (static::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('username', $username)
            ->exists()) {
            $username = $base.'_'.$counter;
            $counter++;
        }

        return $username;
    }

    public function ensureUsername(?string $seed = null): string
    {
        if (! empty($this->username)) {
            return (string) $this->username;
        }

        $username = static::generateUniqueUsername($seed ?? $this->email ?? $this->name, $this->id);
        $this->forceFill(['username' => $username])->save();
        $this->username = $username;

        return $username;
    }

    public function revokeAuthTokens(?int $exceptTokenId = null): int
    {
        $query = $this->tokens();

        if ($exceptTokenId) {
            $query->whereKeyNot($exceptTokenId);
        }

        return $query->delete();
    }

    public function hasLicenseDependencies(): bool
    {
        return License::query()
            ->where(function ($query): void {
                $query
                    ->where('reseller_id', $this->id)
                    ->orWhere('customer_id', $this->id);
            })
            ->exists();
    }

    public function hasManagedAccountDependencies(): bool
    {
        return $this->createdUsers()
            ->whereIn('role', [
                UserRole::MANAGER_PARENT->value,
                UserRole::MANAGER->value,
                UserRole::RESELLER->value,
            ])
            ->exists();
    }

    public function canBePermanentlyDeleted(): bool
    {
        return ! $this->hasLicenseDependencies() && ! $this->hasManagedAccountDependencies();
    }

    public function permanentDeleteBlockedMessage(): ?string
    {
        if ($this->hasLicenseDependencies()) {
            return 'This account has existing customer or license history and cannot be deleted. Deactivate it instead.';
        }

        if ($this->hasManagedAccountDependencies()) {
            return 'This account still manages team members and cannot be deleted. Deactivate it instead.';
        }

        return null;
    }
}
