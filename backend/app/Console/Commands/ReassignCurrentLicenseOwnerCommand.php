<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReassignCurrentLicenseOwnerCommand extends Command
{
    protected $signature = 'licenses:reassign-current-owner
        {bios_id : BIOS ID to repair}
        {owner_email : Email of the correct current owner}
        {--tenant= : Require a specific tenant id}
        {--preserve-history : Create or update an expired historical row for the previous owner}
        {--historical-owner-email= : Override which seller should own the historical row}
        {--current-price= : Override current owner price}
        {--current-started-at= : Override current activated_at timestamp}
        {--current-expires-at= : Override current expires_at timestamp}
        {--historical-price= : Override historical row price}
        {--historical-started-at= : Override historical activated_at timestamp}
        {--historical-expires-at= : Override historical expires_at timestamp}
        {--dry-run : Preview the matching row without changing it}
        {--force : Apply without interactive confirmation}';

    protected $description = 'Repair an already-corrupted current license owner for a BIOS ID, with optional price/date corrections.';

    public function handle(): int
    {
        $biosId = trim((string) $this->argument('bios_id'));
        $ownerEmail = strtolower(trim((string) $this->argument('owner_email')));
        $tenantId = $this->option('tenant') !== null ? (int) $this->option('tenant') : null;
        $isDryRun = (bool) $this->option('dry-run');

        $owner = $this->resolveOwner($ownerEmail, $tenantId);
        if (! $owner) {
            $this->error('Owner not found for the provided email and tenant scope.');
            return self::FAILURE;
        }

        $ownerRole = $owner->role?->value ?? (string) $owner->role;
        if (! in_array($ownerRole, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value], true)) {
            $this->error('Owner must be a manager parent, manager, or reseller.');
            return self::FAILURE;
        }

        if ($owner->tenant_id === null) {
            $this->error('Owner must belong to a tenant.');
            return self::FAILURE;
        }

        $license = CustomerOwnership::applyBlockingOwnershipScope(
            License::query()
                ->with(['reseller:id,name,email,role', 'customer:id,name,username,email', 'program:id,name'])
                ->whereRaw('LOWER(bios_id) = ?', [strtolower($biosId)])
                ->where('tenant_id', (int) $owner->tenant_id)
        )
            ->latest('activated_at')
            ->latest('id')
            ->first();

        if (! $license) {
            $this->error('No current/blocking license found for this BIOS ID in the owner tenant.');
            return self::FAILURE;
        }

        $historicalOwner = $this->resolveHistoricalOwner($license, $owner);
        if ($historicalOwner === null && (bool) $this->option('preserve-history')) {
            $this->error('Historical owner could not be resolved.');
            return self::FAILURE;
        }

        $currentActivatedAt = $this->resolveDateOption('current-started-at', $license->activated_at);
        $currentExpiresAt = $this->resolveDateOption('current-expires-at', $license->expires_at);
        $currentPrice = $this->resolvePriceOption('current-price', (float) $license->price);

        $historicalSeed = $this->findHistoricalSeed($license, $historicalOwner?->id);
        $historicalActivatedAt = $this->resolveDateOption('historical-started-at', $historicalSeed?->activated_at ?? $license->activated_at);
        $historicalExpiresAt = $this->resolveDateOption('historical-expires-at', $historicalSeed?->expires_at ?? now()->subMinute());
        $historicalPrice = $this->resolvePriceOption('historical-price', (float) ($historicalSeed?->price ?? $license->price));

        $this->table(
            ['License ID', 'BIOS ID', 'Customer', 'Current Owner', 'New Owner', 'Status', 'Current Price', 'Current Expires', 'History Owner', 'History Price', 'History Expires'],
            [[
                $license->id,
                $license->bios_id,
                $license->customer?->name ?? '-',
                sprintf('%s <%s>', $license->reseller?->name ?? '-', $license->reseller?->email ?? '-'),
                sprintf('%s <%s>', $owner->name, $owner->email),
                $license->effectiveStatus(),
                number_format($currentPrice, 2, '.', ''),
                $currentExpiresAt?->toDateTimeString() ?? '-',
                $historicalOwner ? sprintf('%s <%s>', $historicalOwner->name, $historicalOwner->email) : '-',
                number_format($historicalPrice, 2, '.', ''),
                $historicalExpiresAt?->toDateTimeString() ?? '-',
            ]]
        );

        if ($isDryRun) {
            $this->info('Dry run complete. No changes were written.');
            return self::SUCCESS;
        }

        if (! (bool) $this->option('force') && ! $this->confirm('Apply this license ownership/value repair now?')) {
            $this->warn('Aborted.');
            return self::FAILURE;
        }

        DB::transaction(function () use (
            $license,
            $owner,
            $historicalOwner,
            $currentActivatedAt,
            $currentExpiresAt,
            $currentPrice,
            $historicalActivatedAt,
            $historicalExpiresAt,
            $historicalPrice
        ): void {
            $previousOwnerId = (int) $license->reseller_id;
            $historicalLicenseId = null;

            if ((bool) $this->option('preserve-history') && $historicalOwner) {
                $historicalLicense = $this->findHistoricalSeed($license, (int) $historicalOwner->id)
                    ?? $license->replicate([
                        'external_activation_response',
                        'scheduled_at',
                        'scheduled_timezone',
                        'scheduled_last_attempt_at',
                        'scheduled_failed_at',
                        'scheduled_failure_message',
                        'is_scheduled',
                        'activated_at_scheduled',
                        'paused_at',
                        'pause_remaining_minutes',
                        'pause_reason',
                        'paused_by_role',
                        'status',
                        'created_at',
                        'updated_at',
                    ]);

                $historicalLicense->forceFill([
                    'tenant_id' => $historicalOwner->tenant_id,
                    'customer_id' => $license->customer_id,
                    'reseller_id' => $historicalOwner->id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'external_activation_response' => 'Historical copy created during owner repair.',
                    'duration_days' => $this->resolveDurationDays($historicalActivatedAt, $historicalExpiresAt, (float) $license->duration_days),
                    'price' => $historicalPrice,
                    'activated_at' => $historicalActivatedAt,
                    'expires_at' => $historicalExpiresAt,
                    'scheduled_at' => null,
                    'scheduled_timezone' => null,
                    'scheduled_last_attempt_at' => null,
                    'scheduled_failed_at' => null,
                    'scheduled_failure_message' => null,
                    'is_scheduled' => false,
                    'activated_at_scheduled' => null,
                    'paused_at' => null,
                    'pause_remaining_minutes' => null,
                    'pause_reason' => null,
                    'paused_by_role' => null,
                    'status' => 'expired',
                ])->save();

                $historicalLicenseId = (int) $historicalLicense->id;
                LicenseCacheInvalidation::invalidateForLicense($historicalLicense->fresh());
            }

            $license->forceFill([
                'reseller_id' => $owner->id,
                'tenant_id' => $owner->tenant_id,
                'duration_days' => $this->resolveDurationDays($currentActivatedAt, $currentExpiresAt, (float) $license->duration_days),
                'price' => $currentPrice,
                'activated_at' => $currentActivatedAt,
                'expires_at' => $currentExpiresAt,
                'status' => 'active',
            ])->save();

            ActivityLog::query()->create([
                'tenant_id' => $owner->tenant_id,
                'user_id' => $owner->id,
                'action' => 'license.owner_reassigned',
                'description' => sprintf('Reassigned current license owner for BIOS %s.', $license->bios_id),
                'metadata' => [
                    'license_id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'previous_owner_id' => $previousOwnerId,
                    'new_owner_id' => $owner->id,
                    'new_owner_role' => $owner->role?->value ?? (string) $owner->role,
                    'current_price' => $currentPrice,
                    'historical_owner_id' => $historicalOwner?->id,
                    'historical_license_id' => $historicalLicenseId,
                    'historical_price' => $historicalPrice,
                ],
            ]);
        });

        LicenseCacheInvalidation::invalidateForLicense($license->fresh());

        $this->info('Current license ownership and values repaired.');

        return self::SUCCESS;
    }

    private function resolveOwner(string $email, ?int $tenantId): ?User
    {
        return User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', $tenantId))
            ->first();
    }

    private function resolveHistoricalOwner(License $license, User $owner): ?User
    {
        $historicalOwnerEmail = $this->option('historical-owner-email');

        if (is_string($historicalOwnerEmail) && trim($historicalOwnerEmail) !== '') {
            return $this->resolveOwner(strtolower(trim($historicalOwnerEmail)), (int) $owner->tenant_id);
        }

        return $license->reseller_id === $owner->id ? null : $license->reseller;
    }

    private function findHistoricalSeed(License $license, ?int $historicalOwnerId): ?License
    {
        if (! $historicalOwnerId) {
            return null;
        }

        return License::query()
            ->where('tenant_id', $license->tenant_id)
            ->where('customer_id', $license->customer_id)
            ->where('program_id', $license->program_id)
            ->whereRaw('LOWER(bios_id) = ?', [strtolower((string) $license->bios_id)])
            ->where('reseller_id', $historicalOwnerId)
            ->whereKeyNot($license->id)
            ->latest('activated_at')
            ->latest('id')
            ->first();
    }

    private function resolveDateOption(string $key, mixed $fallback): ?Carbon
    {
        $value = $this->option($key);

        if (! is_string($value) || trim($value) === '') {
            return $fallback ? Carbon::parse((string) $fallback) : null;
        }

        return Carbon::parse(trim($value));
    }

    private function resolvePriceOption(string $key, float $fallback): float
    {
        $value = $this->option($key);

        if ($value === null) {
            return round($fallback, 2);
        }

        if (is_string($value) && trim($value) === '') {
            return round($fallback, 2);
        }

        if (! is_numeric($value)) {
            throw new \InvalidArgumentException(sprintf('Option --%s must be numeric.', $key));
        }

        $price = round((float) $value, 2);

        if ($price < 0 || $price > CustomerOwnership::MAX_REASONABLE_PRICE) {
            throw new \InvalidArgumentException(sprintf('Option --%s must be between 0 and %.2f.', $key, CustomerOwnership::MAX_REASONABLE_PRICE));
        }

        return $price;
    }

    private function resolveDurationDays(?Carbon $activatedAt, ?Carbon $expiresAt, float $fallback): float
    {
        if (! $activatedAt || ! $expiresAt || $expiresAt->lessThanOrEqualTo($activatedAt)) {
            return round($fallback, 3);
        }

        return round(max(1, $activatedAt->diffInMinutes($expiresAt)) / 1440, 3);
    }
}
