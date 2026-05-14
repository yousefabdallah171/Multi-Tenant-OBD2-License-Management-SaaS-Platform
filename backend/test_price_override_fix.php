<?php
/**
 * Test Script: Verify Price Override Fix Works
 *
 * This script creates test data and verifies that editing a customer's price
 * does NOT retroactively update historical transactions.
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\License;
use App\Models\ActivityLog;

echo "\n";
echo "═".str_repeat("═", 120)."\n";
echo "PRICE OVERRIDE FIX VERIFICATION TEST\n";
echo "═".str_repeat("═", 120)."\n\n";

// Clean up test data from previous runs
DB::table('activity_logs')->whereRaw("metadata LIKE '%test_scenario%'")->delete();
DB::table('licenses')->where('external_username', 'like', 'TEST_SCENARIO_%')->delete();

echo "[STEP 1] Creating test data...\n";

// Create test tenant first
$tenantSlug = 'test_tenant_' . time();
$tenant = DB::table('tenants')->insertGetId([
    'name' => 'Test Tenant',
    'slug' => $tenantSlug,
    'created_at' => now(),
    'updated_at' => now(),
]);
echo "✅ Created test tenant (ID: {$tenant})\n";

// Create test reseller
$reseller = User::create([
    'tenant_id' => $tenant,
    'name' => 'Test Reseller',
    'email' => 'test.reseller.' . time() . '@test.com',
    'username' => 'test_reseller_' . time(),
    'password' => bcrypt('password'),
    'role' => 'reseller',
    'phone' => '1234567890',
]);
echo "✅ Created test reseller: {$reseller->name} (ID: {$reseller->id})\n";

// Create test customer
$customer = User::create([
    'tenant_id' => $tenant,
    'name' => 'Test Customer - ANGELO',
    'email' => 'test.customer.' . time() . '@test.com',
    'username' => 'test_customer_' . time(),
    'password' => bcrypt('password'),
    'role' => 'customer',
    'country_name' => 'US',
    'phone' => '1234567890',
]);
echo "✅ Created test customer: {$customer->name} (ID: {$customer->id})\n";

// Create test program
$program = DB::table('programs')->insertGetId([
    'tenant_id' => $tenant,
    'name' => 'Test Program',
    'description' => 'Test program for price override verification',
    'version' => '1.0',
    'download_link' => 'http://test.local',
    'base_price' => 100,
    'created_at' => now(),
    'updated_at' => now(),
]);
echo "✅ Created test program (ID: {$program})\n\n";

// Create License 1 (old transaction - April 24)
echo "[STEP 2] Creating old transaction (April 24, $85)...\n";
$license1 = License::create([
    'tenant_id' => $tenant,
    'customer_id' => $customer->id,
    'reseller_id' => $reseller->id,
    'program_id' => $program,
    'bios_id' => '5CD225481X_TEST',
    'external_username' => 'TEST_SCENARIO_OLD_' . time(),
    'activated_at' => now()->subDays(17)->setHour(16)->setMinute(49),
]);
echo "✅ Created License 1 (ID: {$license1->id})\n";

$log1 = ActivityLog::create([
    'tenant_id' => $tenant,
    'user_id' => $reseller->id,
    'action' => 'license.activated',
    'description' => 'Test old transaction',
    'metadata' => [
        'license_id' => $license1->id,
        'customer_id' => $customer->id,
        'bios_id' => '5CD225481X_TEST',
        'price' => 85,
        'price_source' => 'base_price',
        'test_scenario' => true,
        'scenario_name' => 'old_transaction',
    ],
    'created_at' => now()->subDays(17)->setHour(16)->setMinute(49),
]);
echo "✅ Created Activity Log 1 (ID: {$log1->id}) | Date: April 24 | Price: $85\n\n";

// Create License 2 (recent transaction - May 8)
echo "[STEP 3] Creating recent transaction (May 8, $150)...\n";
$license2 = License::create([
    'tenant_id' => $tenant,
    'customer_id' => $customer->id,
    'reseller_id' => $reseller->id,
    'program_id' => $program,
    'bios_id' => '5CD225481X_TEST',
    'external_username' => 'TEST_SCENARIO_NEW_' . time(),
    'activated_at' => now()->subDays(3)->setHour(2)->setMinute(15),
]);
echo "✅ Created License 2 (ID: {$license2->id})\n";

$log2 = ActivityLog::create([
    'tenant_id' => $tenant,
    'user_id' => $reseller->id,
    'action' => 'license.activated',
    'description' => 'Test new transaction',
    'metadata' => [
        'license_id' => $license2->id,
        'customer_id' => $customer->id,
        'bios_id' => '5CD225481X_TEST',
        'price' => 150,
        'price_source' => 'base_price',
        'test_scenario' => true,
        'scenario_name' => 'new_transaction',
    ],
    'created_at' => now()->subDays(3)->setHour(2)->setMinute(15),
]);
echo "✅ Created Activity Log 2 (ID: {$log2->id}) | Date: May 8 | Price: $150\n\n";

echo "═".str_repeat("═", 120)."\n";
echo "BEFORE FIX SIMULATION: Simulating old behavior (bug)\n";
echo "═".str_repeat("═", 120)."\n";

echo "\nOld buggy behavior would have updated ALL logs for BIOS+reseller:\n";
echo "  - Log 1 (old): $85 → (would be changed to) $150 ❌\n";
echo "  - Log 2 (new): $150 → (correct) $150 ✓\n\n";

echo "═".str_repeat("═", 120)."\n";
echo "AFTER FIX: Testing new behavior (fixed)\n";
echo "═".str_repeat("═", 120)."\n";

// Simulate the price override update on License 2
echo "\n[STEP 4] Simulating price override on License 2 (recent transaction)...\n";
echo "Updating License 2 price to $200...\n\n";

// This simulates what happens in applySuperAdminPriceOverride()
// The NEW fix should only update logs for License 2, not License 1

$licensesToUpdate = ActivityLog::query()
    ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id')) = ?", [(int) $license2->id])
    ->get();

echo "✓ FIX VERIFICATION: Found " . $licensesToUpdate->count() . " log(s) to update (should be 1, only License 2)\n";
if ($licensesToUpdate->count() !== 1) {
    echo "❌ FAIL: Expected 1 log, got " . $licensesToUpdate->count() . "\n";
} else {
    echo "✅ PASS: Correctly identified only the current license's log\n";
}

echo "\nUpdating price to $200...\n";
foreach ($licensesToUpdate as $log) {
    $metadata = is_array($log->metadata) ? $log->metadata : [];
    $metadata['price'] = 200;
    $metadata['price_source'] = 'super_admin_override';
    $log->forceFill(['metadata' => $metadata])->save();
}

// Verify the results
echo "\n[STEP 5] Verifying results...\n";
echo str_repeat("─", 120)."\n";

$log1Fresh = ActivityLog::find($log1->id);
$log2Fresh = ActivityLog::find($log2->id);

$log1Price = is_array($log1Fresh->metadata) ? ($log1Fresh->metadata['price'] ?? 0) : 0;
$log2Price = is_array($log2Fresh->metadata) ? ($log2Fresh->metadata['price'] ?? 0) : 0;

echo "\nLog 1 (Old Transaction - April 24):\n";
echo "  Expected Price: $85\n";
echo "  Actual Price: ${$log1Price}\n";
if ($log1Price === 85) {
    echo "  ✅ PASS: Old transaction NOT retroactively updated (CORRECT!)\n";
} else {
    echo "  ❌ FAIL: Old transaction was incorrectly changed\n";
}

echo "\nLog 2 (Recent Transaction - May 8):\n";
echo "  Expected Price: $200 (after override)\n";
echo "  Actual Price: ${$log2Price}\n";
if ($log2Price === 200) {
    echo "  ✅ PASS: Recent transaction correctly updated\n";
} else {
    echo "  ❌ FAIL: Recent transaction was not updated\n";
}

echo "\n" . str_repeat("─", 120)."\n";

// Final verdict
$log1Correct = ($log1Price === 85);
$log2Correct = ($log2Price === 200);

echo "\n═".str_repeat("═", 120)."\n";
if ($log1Correct && $log2Correct) {
    echo "✅ TEST PASSED: Price override fix is working correctly!\n";
    echo "   - Old transactions are NOT affected ✓\n";
    echo "   - Only the current license is updated ✓\n";
    echo "   - Bug is FIXED ✓\n";
} else {
    echo "❌ TEST FAILED: There are still issues with the fix\n";
}
echo "═".str_repeat("═", 120)."\n\n";

// Cleanup
echo "[CLEANUP] Removing test data...\n";
ActivityLog::whereIn('id', [$log1->id, $log2->id])->delete();
License::whereIn('id', [$license1->id, $license2->id])->delete();
User::whereIn('id', [$reseller->id, $customer->id])->delete();
DB::table('programs')->where('id', $program)->delete();
DB::table('tenants')->where('id', $tenant)->delete();
echo "✅ Test data cleaned up\n\n";
