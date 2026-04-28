<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Http\Controllers\ManagerParent\NetworkController as ManagerParentNetworkController;
use App\Models\User;
use Illuminate\Console\Command;

class BackfillResellerAssignmentsCommand extends Command
{
    protected $signature = 'resellers:backfill-assignments {--tenant= : Limit the backfill to a specific tenant id} {--dry-run : Preview changes without writing them}';

    protected $description = 'Assign old reseller rows without a valid owner to the first manager parent in their tenant, or the first manager if no manager parent exists.';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $isDryRun = (bool) $this->option('dry-run');

        $query = User::query()
            ->with(['createdBy:id,tenant_id,role', 'tenant:id,name'])
            ->where('role', UserRole::RESELLER->value)
            ->whereNotNull('tenant_id')
            ->when($tenantId, fn ($builder) => $builder->where('tenant_id', (int) $tenantId))
            ->orderBy('tenant_id')
            ->orderBy('id');

        $resellers = $query->get()->filter(fn (User $reseller): bool => $this->needsBackfill($reseller))->values();

        if ($resellers->isEmpty()) {
            $this->info('No reseller rows require backfill.');
            return self::SUCCESS;
        }

        $assignableOwnersByTenant = User::query()
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
            ->whereNotNull('tenant_id')
            ->when($tenantId, fn ($builder) => $builder->where('tenant_id', (int) $tenantId))
            ->orderByRaw("CASE role WHEN 'manager_parent' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END")
            ->orderBy('tenant_id')
            ->orderBy('id')
            ->get(['id', 'tenant_id', 'name', 'email', 'role'])
            ->groupBy('tenant_id');

        $affectedTenantIds = collect();
        $rows = [];
        $updated = 0;
        $skipped = 0;

        /** @var User $reseller */
        foreach ($resellers as $reseller) {
            $owner = $assignableOwnersByTenant->get($reseller->tenant_id)?->first();

            if (! $owner) {
                $rows[] = [
                    $reseller->id,
                    $reseller->tenant_id,
                    $reseller->email ?? $reseller->name,
                    'SKIPPED',
                    'No manager parent or manager exists in this tenant',
                ];
                $skipped++;
                continue;
            }

            $rows[] = [
                $reseller->id,
                $reseller->tenant_id,
                $reseller->email ?? $reseller->name,
                $isDryRun ? 'WOULD ASSIGN' : 'ASSIGNED',
                sprintf('%s: %s <%s>', $owner->role === UserRole::MANAGER_PARENT ? 'Manager Parent' : 'Manager', $owner->name, $owner->email ?? '-'),
            ];

            if (! $isDryRun) {
                $reseller->forceFill(['created_by' => $owner->id])->save();
                $affectedTenantIds->push((int) $reseller->tenant_id);
                $updated++;
            }
        }

        $this->table(['Reseller ID', 'Tenant ID', 'Reseller', 'Result', 'Owner'], $rows);

        if (! $isDryRun) {
            $affectedTenantIds
                ->unique()
                ->each(fn (int $id) => ManagerParentNetworkController::forgetTenantCache($id));
        }

        $summary = $isDryRun
            ? sprintf('Dry run complete. %d reseller(s) would be assigned, %d skipped.', $rows ? count(array_filter($rows, fn (array $row): bool => $row[3] === 'WOULD ASSIGN')) : 0, $skipped)
            : sprintf('Backfill complete. %d reseller(s) assigned, %d skipped.', $updated, $skipped);

        $this->info($summary);

        return self::SUCCESS;
    }

    private function needsBackfill(User $reseller): bool
    {
        $owner = $reseller->createdBy;

        if (! $owner) {
            return true;
        }

        if ((int) $owner->tenant_id !== (int) $reseller->tenant_id) {
            return true;
        }

        $ownerRole = $owner->role?->value ?? (string) $owner->role;

        return ! in_array($ownerRole, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value], true);
    }
}
