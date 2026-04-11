<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReassignCurrentLicenseOwnerCommand extends Command
{
    protected $signature = 'licenses:reassign-current-owner
        {bios_id : BIOS ID to repair}
        {owner_email : Email of the correct current owner}
        {--tenant= : Require a specific tenant id}
        {--dry-run : Preview the matching row without changing it}
        {--force : Apply without interactive confirmation}';

    protected $description = 'Repair an already-corrupted current license owner for a BIOS ID.';

    public function handle(): int
    {
        $biosId = trim((string) $this->argument('bios_id'));
        $ownerEmail = strtolower(trim((string) $this->argument('owner_email')));
        $tenantId = $this->option('tenant') !== null ? (int) $this->option('tenant') : null;
        $isDryRun = (bool) $this->option('dry-run');

        $owner = User::query()
            ->whereRaw('LOWER(email) = ?', [$ownerEmail])
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', $tenantId))
            ->first();

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

        $this->table(
            ['License ID', 'BIOS ID', 'Customer', 'Current Owner', 'New Owner', 'Status', 'Expires At'],
            [[
                $license->id,
                $license->bios_id,
                $license->customer?->name ?? '-',
                sprintf('%s <%s>', $license->reseller?->name ?? '-', $license->reseller?->email ?? '-'),
                sprintf('%s <%s>', $owner->name, $owner->email),
                $license->effectiveStatus(),
                $license->expires_at?->toDateTimeString() ?? '-',
            ]]
        );

        if ((int) $license->reseller_id === (int) $owner->id) {
            $this->info('License is already assigned to this owner.');
            return self::SUCCESS;
        }

        if ($isDryRun) {
            $this->info('Dry run complete. No changes were written.');
            return self::SUCCESS;
        }

        if (! (bool) $this->option('force') && ! $this->confirm('Reassign this current license owner now?')) {
            $this->warn('Aborted.');
            return self::FAILURE;
        }

        DB::transaction(function () use ($license, $owner): void {
            $previousOwnerId = (int) $license->reseller_id;

            $license->forceFill([
                'reseller_id' => $owner->id,
                'tenant_id' => $owner->tenant_id,
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
                ],
            ]);
        });

        LicenseCacheInvalidation::invalidateForLicense($license->fresh());

        $this->info('Current license owner reassigned.');

        return self::SUCCESS;
    }
}
