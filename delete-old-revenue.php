<?php
/**
 * DELETE OLD DELETED CUSTOMER REVENUE
 *
 * Usage:
 * php artisan tinker
 * >>> include('delete-old-revenue.php');
 *
 * Or provide customer names as argument:
 * php delete-old-revenue.php eeeeeeeeee TTTT GKGK dasd
 */

use Illuminate\Support\Facades\DB;

$customers = $argv ? array_slice($argv, 1) : [];

if (empty($customers)) {
    echo "Usage: php delete-old-revenue.php customer1 customer2 customer3\n";
    echo "Example: php delete-old-revenue.php eeeeeeeeee TTTT GKGK dasd\n";
    exit(1);
}

echo "=== DELETING REVENUE FOR OLD CUSTOMERS ===\n\n";

$deletedCustomers = [];

foreach ($customers as $customerName) {
    echo "Processing: $customerName\n";

    // Count activity logs
    $count = DB::table('activity_logs')
        ->whereIn('action', ['license.activated', 'license.renewed'])
        ->where(function ($query) use ($customerName) {
            $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customerName])
                ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_id") LIKE ?', ["%$customerName%"]);
        })
        ->count();

    if ($count === 0) {
        echo "  ✗ No revenue found\n\n";
        continue;
    }

    echo "  Found: $count revenue records\n";

    // Delete activity logs
    DB::table('activity_logs')
        ->whereIn('action', ['license.activated', 'license.renewed'])
        ->where(function ($query) use ($customerName) {
            $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customerName])
                ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_id") LIKE ?', ["%$customerName%"]);
        })
        ->delete();

    echo "  ✓ DELETED: $count revenue records\n\n";
    $deletedCustomers[] = $customerName;
}

if (!empty($deletedCustomers)) {
    echo "✓ COMPLETE! Deleted revenue for: " . implode(', ', $deletedCustomers) . "\n";
}
