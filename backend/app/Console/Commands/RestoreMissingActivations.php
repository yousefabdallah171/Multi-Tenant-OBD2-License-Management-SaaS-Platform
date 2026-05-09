<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\License;
use App\Support\BalanceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RestoreMissingActivations extends Command
{
    protected $signature = 'logs:restore-missing-activations';
    protected $description = 'Restores deleted license.activated logs caused by the super_admin_override bug.';

    public function handle(): int
    {
        $this->info('Scanning licenses for missing activation logs...');

        // Get all licenses that have a reseller (to restore earned revenue)
        $licenses = License::query()
            ->with(['customer', 'program'])
            ->whereNotNull('reseller_id')
            ->whereNotNull('activated_at')
            ->get();

        $restoredCount = 0;

        foreach ($licenses as $license) {
            // Check if this license has an activation log
            $hasActivation = ActivityLog::query()
                ->where('action', 'license.activated')
                ->whereMetadataLicenseId((int) $license->id)
                ->exists();

            if (! $hasActivation) {
                // Determine the price to restore. If there's an override log, we might use the old price,
                // but if not, we'll restore using the current license price or base program price.
                $latestLog = ActivityLog::query()
                    ->whereIn('action', ['license.renewed', 'license.scheduled_activation_executed'])
                    ->whereMetadataLicenseId((int) $license->id)
                    ->orderByDesc('id')
                    ->first();

                $restorePrice = $license->price;
                if ($latestLog && isset($latestLog->metadata['price_override_previous'])) {
                    $restorePrice = $latestLog->metadata['price_override_previous'];
                }

                // Create the missing activation log
                ActivityLog::query()->create([
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
                        'price' => $restorePrice,
                        'country_name' => $license->customer?->country_name,
                        'attribution_type' => BalanceService::TYPE_EARNED,
                        'restored_by_script' => true,
                    ],
                    'ip_address' => '127.0.0.1', // System restored
                    'created_at' => $license->activated_at, // Very important: restore the original date!
                    'updated_at' => now(),
                ]);

                $restoredCount++;
                $this->line("Restored activation for BIOS: {$license->bios_id} at {$license->activated_at}");
            }
        }

        $this->info("Done! Restored {$restoredCount} missing activation logs.");

        return 0;
    }
}
