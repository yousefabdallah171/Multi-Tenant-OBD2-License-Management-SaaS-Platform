<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;

class FixPriceOverrideBug extends Command
{
    protected $signature = 'logs:fix-price-override-bug';
    protected $description = 'Fixes missing revenue caused by zero-priced renewals and cleans up fake restored logs.';

    public function handle(): int
    {
        $this->info('Step 1: Removing incorrectly restored logs...');
        $deleted = ActivityLog::where('metadata->restored_by_script', true)->delete();
        $this->info("Deleted {$deleted} artificially restored logs.");

        $this->info('Step 2: Fixing $0.00 operations that should have been updated by Super Admin...');
        
        // Find all renewals or activations that currently have a price of 0
        $zeroPriceLogs = ActivityLog::query()
            ->whereIn('action', ['license.renewed', 'license.activated'])
            ->where(function($q) {
                $q->whereJsonContains('metadata->price', 0)
                  ->orWhereJsonContains('metadata->price', 0.0)
                  ->orWhereJsonContains('metadata->price', '0')
                  ->orWhereJsonContains('metadata->price', '0.00');
            })
            ->get();

        $fixedCount = 0;

        foreach ($zeroPriceLogs as $log) {
            $biosId = $log->metadata['bios_id'] ?? null;
            if (!$biosId) continue;

            // Find the closest Price Overridden log that occurred AFTER this $0 operation
            $overrideLog = ActivityLog::query()
                ->where('action', 'customer.price_overridden')
                ->whereJsonContains('metadata->bios_id', $biosId)
                ->where('created_at', '>=', $log->created_at)
                ->orderBy('created_at', 'asc')
                ->first();

            if ($overrideLog && isset($overrideLog->metadata['new_price'])) {
                $newPrice = (float) $overrideLog->metadata['new_price'];
                
                // If the super admin set a real price, we update this $0 log
                if ($newPrice > 0) {
                    $metadata = is_array($log->metadata) ? $log->metadata : json_decode($log->metadata, true);
                    $metadata['price'] = $newPrice;
                    $metadata['fixed_by_script'] = true;
                    
                    $log->metadata = $metadata;
                    $log->save();
                    
                    $this->info("Fixed {$log->action} for BIOS {$biosId} from 0 to {$newPrice}");
                    $fixedCount++;
                }
            }
        }

        $this->info("Done! Fixed {$fixedCount} operations.");
        return self::SUCCESS;
    }
}
