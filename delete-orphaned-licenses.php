<?php
/**
 * DELETE ORPHANED LICENSES FOR DELETED CUSTOMERS
 *
 * Finds licenses where the customer user no longer exists
 * and removes them so they don't show in reports
 *
 * Usage: php artisan tinker
 * >>> include('delete-orphaned-licenses.php');
 */

use Illuminate\Support\Facades\DB;

echo "=== FINDING AND DELETING ORPHANED LICENSES ===\n\n";

// Find orphaned licenses
$orphaned = DB::table('licenses')
    ->leftJoin('users', 'licenses.customer_id', '=', 'users.id')
    ->whereNull('users.id')
    ->select('licenses.id', 'licenses.customer_id', 'licenses.price')
    ->get();

echo "Found " . count($orphaned) . " orphaned licenses:\n\n";

if (count($orphaned) === 0) {
    echo "✓ No orphaned licenses found!\n";
    exit(0);
}

$totalRevenue = 0;
foreach ($orphaned as $license) {
    echo "  License ID: {$license->id}, Customer ID: {$license->customer_id}, Price: \${$license->price}\n";
    $totalRevenue += (float) $license->price;
}

echo "\nTotal orphaned revenue: \$$totalRevenue\n\n";

// Delete orphaned licenses
echo "Deleting orphaned licenses...\n";
$deleted = DB::table('licenses')
    ->leftJoin('users', 'licenses.customer_id', '=', 'users.id')
    ->whereNull('users.id')
    ->delete();

echo "✓ Deleted $deleted orphaned licenses\n";
echo "✓ Reports will now be updated without this revenue\n";
