<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;
use Carbon\Carbon;

class RestoreMissingActivations extends Command
{
    protected $signature = 'logs:restore-missing-activations';
    protected $description = 'Safely restores missing revenue for zero-priced operations without duplicating activations.';

    public function handle(): int
    {
        $this->info('Step 1: Removing all incorrectly restored script logs...');
        $deleted = ActivityLog::where('metadata->restored_by_script', true)->delete();
        $this->info("Deleted {$deleted} artificially restored logs.");

        $this->info('Step 2: Scanning for completely zero-revenue days to fix...');
        
        $revenueLogs = ActivityLog::query()
            ->whereIn('action', ['license.renewed', 'license.activated'])
            ->orderBy('id', 'asc')
            ->get();

        $logsByBios = $revenueLogs->groupBy(function($log) {
            return $log->metadata['bios_id'] ?? 'UNKNOWN';
        });

        $fixedCount = 0;

        foreach ($logsByBios as $biosId => $logs) {
            if ($biosId === 'UNKNOWN') continue;

            // Find the most recent price override for this BIOS to know the true intended price
            $overrideLog = ActivityLog::query()
                ->where('action', 'customer.price_overridden')
                ->whereJsonContains('metadata->bios_id', $biosId)
                ->orderBy('id', 'desc')
                ->first();

            if (!$overrideLog) continue;
            
            $targetPrice = (float) ($overrideLog->metadata['new_price'] ?? 0);
            if ($targetPrice <= 0) continue;

            // Group the revenue logs by day
            $logsByDay = $logs->groupBy(function($log) {
                return Carbon::parse($log->created_at)->format('Y-m-d');
            });

            foreach ($logsByDay as $day => $dayLogs) {
                $totalRevenueForDay = $dayLogs->sum(function($log) {
                    return (float) ($log->metadata['price'] ?? 0);
                });
                
                // If the entire day yielded $0 revenue despite having operations,
                // and the Super Admin intended the price to be $targetPrice, we fix exactly ONE log.
                if ($totalRevenueForDay == 0) {
                    $logToFix = $dayLogs->first();
                    
                    $meta = is_array($logToFix->metadata) ? $logToFix->metadata : json_decode($logToFix->metadata, true);
                    $meta['price'] = $targetPrice;
                    $meta['fixed_by_script'] = true;
                    
                    $logToFix->metadata = $meta;
                    $logToFix->save();

                    $this->info("Fixed zero-revenue operation for BIOS {$biosId} on {$day} to \${$targetPrice}");
                    $fixedCount++;
                }
            }
        }

        $this->info("Done! Fixed {$fixedCount} zero-revenue operations.");
        return self::SUCCESS;
    }
}
