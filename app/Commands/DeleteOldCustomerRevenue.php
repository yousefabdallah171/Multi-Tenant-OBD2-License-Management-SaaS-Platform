<?php

namespace App\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeleteOldCustomerRevenue extends Command
{
    protected $signature = 'delete-old-revenue {customers*}';
    protected $description = 'Delete revenue (activity logs) for old deleted customers by name';

    public function handle(): int
    {
        $customerNames = $this->argument('customers');

        if (empty($customerNames)) {
            $this->error('Please provide customer names to delete revenue for.');
            return 1;
        }

        foreach ($customerNames as $customerName) {
            $this->info("Processing: {$customerName}");

            $count = DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($query) use ($customerName) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customerName])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_id") LIKE ?', ["%{$customerName}%"]);
                })
                ->count();

            if ($count === 0) {
                $this->warn("  ✗ No revenue found for: {$customerName}");
                continue;
            }

            $this->info("  Found {$count} revenue records");

            DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($query) use ($customerName) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customerName])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_id") LIKE ?', ["%{$customerName}%"]);
                })
                ->delete();

            $this->info("  ✓ Deleted revenue for: {$customerName}");
        }

        $this->info("\n✓ All revenue cleanup complete!");
        return 0;
    }
}
