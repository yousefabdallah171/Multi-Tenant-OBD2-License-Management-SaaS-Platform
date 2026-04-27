<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use App\Services\BalanceService;
use App\Support\CustomerOwnership;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class BackfillCustomerPriceOverridesCommand extends Command
{
    protected $signature = 'customers:backfill-price-overrides {--customer= : Limit to a specific customer id} {--dry-run : Preview without writing changes}';

    protected $description = 'Backfill revenue events and balances for legacy super-admin customer price overrides.';

    public function handle(): int
    {
        $customerId = $this->option('customer');
        $dryRun = (bool) $this->option('dry-run');

        $overrideLogs = ActivityLog::query()
            ->where('action', 'customer.price_overridden')
            ->when($customerId, fn ($query) => $query->where('metadata->customer_id', (int) $customerId))
            ->orderBy('id')
            ->get();

        if ($overrideLogs->isEmpty()) {
            $this->info('No customer price override logs found.');

            return self::SUCCESS;
        }

        $processed = 0;
        $created = 0;
        $updated = 0;
        $skipped = 0;
        $rows = [];

        /** @var Collection<int, ActivityLog> $group */
        foreach ($overrideLogs->groupBy(fn (ActivityLog $log): string => ($log->metadata['license_id'] ?? '0').':'.($log->metadata['customer_id'] ?? '0')) as $group) {
            $latestOverride = $group->sortByDesc('id')->first();
            if (! $latestOverride) {
                continue;
            }

            $metadata = is_array($latestOverride->metadata) ? $latestOverride->metadata : [];
            $licenseId = (int) ($metadata['license_id'] ?? 0);
            $customerIdFromLog = (int) ($metadata['customer_id'] ?? 0);

            $license = $licenseId > 0 ? License::query()->with('reseller')->find($licenseId) : null;
            $customer = $customerIdFromLog > 0 ? User::query()->find($customerIdFromLog) : null;

            if (! $license || ! $customer || (int) $license->customer_id !== (int) $customer->id) {
                $rows[] = [$customerIdFromLog, $licenseId, 'SKIPPED', 'Missing customer/license'];
                $skipped++;
                continue;
            }

            $targetPrice = round(CustomerOwnership::sanitizeDisplayPrice($license->price ?? ($metadata['new_price'] ?? 0)), 2);
            $revenueLog = ActivityLog::query()
                ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
                ->whereMetadataLicenseId((int) $license->id)
                ->latest()
                ->first();

            if ($revenueLog) {
                $revenueMetadata = is_array($revenueLog->metadata) ? $revenueLog->metadata : [];
                $oldPrice = round(CustomerOwnership::sanitizeDisplayPrice($revenueMetadata['price'] ?? 0), 2);

                if ($oldPrice === $targetPrice && ($revenueMetadata['country_name'] ?? null) === $customer->country_name) {
                    $rows[] = [$customer->id, $license->id, 'UNCHANGED', 'Revenue event already aligned'];
                    $processed++;
                    continue;
                }

                $rows[] = [$customer->id, $license->id, $dryRun ? 'WOULD UPDATE' : 'UPDATED', sprintf('%.2f -> %.2f', $oldPrice, $targetPrice)];

                if (! $dryRun) {
                    $revenueMetadata['price'] = $targetPrice;
                    $revenueMetadata['country_name'] = $customer->country_name;
                    $revenueMetadata['price_source'] = 'super_admin_override_backfill';
                    $revenueMetadata['price_override_previous'] = $oldPrice;
                    $revenueLog->forceFill(['metadata' => $revenueMetadata])->save();

                    $this->applyBalanceDifference($revenueLog, round($targetPrice - $oldPrice, 2));
                }

                $updated++;
                $processed++;
                continue;
            }

            if (! $license->activated_at) {
                $rows[] = [$customer->id, $license->id, 'SKIPPED', 'No activation date to backfill from'];
                $skipped++;
                continue;
            }

            $rows[] = [$customer->id, $license->id, $dryRun ? 'WOULD CREATE' : 'CREATED', sprintf('%.2f', $targetPrice)];

            if (! $dryRun) {
                $synthetic = $this->createSyntheticRevenueLogForLicense($customer, $license, $targetPrice);
                if ($synthetic) {
                    $this->applyBalanceDifference($synthetic, $targetPrice);
                }
            }

            $created++;
            $processed++;
        }

        $this->table(['Customer ID', 'License ID', 'Result', 'Details'], $rows);
        $this->info(sprintf(
            '%s complete. Processed: %d, created: %d, updated: %d, skipped: %d.',
            $dryRun ? 'Dry run' : 'Backfill',
            $processed,
            $created,
            $updated,
            $skipped
        ));

        return self::SUCCESS;
    }

    private function createSyntheticRevenueLogForLicense(User $customer, License $license, float $price): ?ActivityLog
    {
        $seller = $license->reseller;
        $sellerRole = $seller?->role?->value ?? ($seller ? (string) $seller->role : null);

        $log = new ActivityLog([
            'tenant_id' => $license->tenant_id,
            'user_id' => $seller?->id,
            'action' => 'license.activated',
            'description' => sprintf('Backfilled activation revenue for BIOS %s.', $license->bios_id),
            'metadata' => [
                'license_id' => $license->id,
                'customer_id' => $customer->id,
                'program_id' => $license->program_id,
                'bios_id' => $license->bios_id,
                'external_username' => $license->external_username,
                'price' => $price,
                'country_name' => $customer->country_name,
                'price_source' => 'super_admin_override_backfill',
                'seller_id' => $seller?->id,
                'seller_role' => $sellerRole,
                'owner_user_id' => $seller?->id,
                'owner_role' => $sellerRole,
                'actor_id' => $seller?->id,
                'actor_role' => $sellerRole,
                'attribution_type' => BalanceService::TYPE_EARNED,
            ],
            'ip_address' => null,
            'created_at' => $license->activated_at,
            'updated_at' => now(),
        ]);
        $log->save();

        return $log->fresh();
    }

    private function applyBalanceDifference(ActivityLog $revenueLog, float $difference): void
    {
        if ($difference === 0.0 || (int) $revenueLog->user_id <= 0) {
            return;
        }

        $balance = UserBalance::query()->firstOrCreate(
            [
                'user_id' => (int) $revenueLog->user_id,
            ],
            [
                'tenant_id' => (int) $revenueLog->tenant_id,
            ]
        );

        if ((int) $balance->tenant_id !== (int) $revenueLog->tenant_id) {
            $balance->tenant_id = (int) $revenueLog->tenant_id;
        }

        $metadata = is_array($revenueLog->metadata) ? $revenueLog->metadata : [];
        $isGranted = ($metadata['attribution_type'] ?? BalanceService::TYPE_EARNED) === BalanceService::TYPE_GRANTED;

        if ($isGranted) {
            $balance->granted_value = round((float) $balance->granted_value + $difference, 2);
        } else {
            $balance->total_revenue = round((float) $balance->total_revenue + $difference, 2);
            $balance->pending_balance = round((float) $balance->pending_balance + $difference, 2);
        }

        $balance->last_activity_at = now();
        $balance->save();
    }
}
