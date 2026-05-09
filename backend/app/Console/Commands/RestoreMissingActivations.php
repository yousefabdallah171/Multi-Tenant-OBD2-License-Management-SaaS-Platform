<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\License;
use App\Services\BalanceService;
use Illuminate\Console\Command;

class RestoreMissingActivations extends Command
{
    protected $signature = 'logs:restore-missing-activations';
    protected $description = 'Restores deleted license.activated logs caused by the super_admin_override bug.';

    public function handle(): int
    {
        $this->info('Scanning licenses for strictly missing activation logs caused by the renewal bug...');

        $licenses = License::query()
            ->with(['customer', 'program'])
            ->whereNotNull('reseller_id')
            ->whereNotNull('activated_at')
            ->get();

        $restoredCount = 0;

        foreach ($licenses as $license) {
            // 1. Check if this license has a renewal log
            $renewalLogs = ActivityLog::query()
                ->where('action', 'license.renewed')
                ->where('metadata->license_id', (int) $license->id)
                ->orderBy('id', 'asc')
                ->get();

            if ($renewalLogs->isEmpty()) {
                continue; // Only targeting licenses that were renewed
            }

            // 2. Check if there was a price override AFTER the first renewal
            $firstRenewal = $renewalLogs->first();
            $overrideAfterRenewal = ActivityLog::query()
                ->where('action', 'customer.price_overridden')
                ->where('metadata->license_id', (int) $license->id)
                ->where('id', '>', $firstRenewal->id)
                ->first();

            if (!$overrideAfterRenewal) {
                continue; // Bug wasn't triggered after renewal
            }

            // 3. Check if it already has an activation log
            $hasActivation = ActivityLog::query()
                ->where('action', 'license.activated')
                ->where('metadata->license_id', (int) $license->id)
                ->exists();

            if ($hasActivation) {
                continue;
            }

            // 4. Determine the original price before the override if possible
            $restorePrice = $license->price;
            $firstOverride = ActivityLog::query()
                ->where('action', 'customer.price_overridden')
                ->where('metadata->license_id', (int) $license->id)
                ->orderBy('id', 'asc')
                ->first();

            if ($firstOverride && isset($firstOverride->metadata['old_price'])) {
                $restorePrice = $firstOverride->metadata['old_price'];
            }

            // Create the missing activation log
            $createdAt = $license->customer->created_at ?? $license->created_at;

            $log = new ActivityLog([
                'tenant_id' => $license->tenant_id,
                'user_id' => $license->reseller_id,
                'action' => 'license.activated',
                'description' => sprintf('Activated license for BIOS %s. (Restored)', $license->bios_id),
                'metadata' => [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'target_user_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'price' => (float) $restorePrice,
                    'country_name' => $license->customer->country_name ?? null,
                    'restored_by_script' => true,
                    'attribution_type' => 'earned',
                    'actor_id' => $license->reseller_id,
                    'actor_role' => 'reseller',
                    'seller_id' => $license->reseller_id,
                    'seller_role' => 'reseller',
                ],
            ]);

            $log->timestamps = false;
            $log->created_at = $createdAt;
            $log->updated_at = $createdAt;
            $log->save();

            $this->info("Restored activation for BIOS: {$license->bios_id} at {$createdAt}");
            $restoredCount++;
        }

        $this->info("Done! Restored {$restoredCount} missing activation logs.");

        return self::SUCCESS;
    }
}
