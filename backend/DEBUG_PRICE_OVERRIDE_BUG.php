<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE DEBUG SCRIPT - PRICE OVERRIDE BUG
 *
 * READ-ONLY SCRIPT - NO DATA MODIFICATION
 * Gathers ALL information needed to understand the bug before fixing
 *
 * Run on live server: php DEBUG_PRICE_OVERRIDE_BUG.php > debug_results.txt
 * Send debug_results.txt to developer for analysis
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$output = [];

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 1: SYSTEM INFO
// ═══════════════════════════════════════════════════════════════════════════════════════
$output[] = "\n" . str_repeat("═", 160);
$output[] = "PHASE 1: SYSTEM INFORMATION";
$output[] = str_repeat("═", 160);

$output[] = "\nDatabase: " . config('database.connections.mysql.database');
$output[] = "Server Time: " . now();
$output[] = "App Debug: " . (config('app.debug') ? 'ON' : 'OFF');

// Count totals
$totalUsers = DB::table('users')->count();
$totalLicenses = DB::table('licenses')->count();
$totalActivityLogs = DB::table('activity_logs')->count();

$output[] = "\nDatabase Totals:";
$output[] = "  - Total Users: $totalUsers";
$output[] = "  - Total Licenses: $totalLicenses";
$output[] = "  - Total Activity Logs: $totalActivityLogs";

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 2: FIND ALL COMBINATIONS WITH MULTIPLE TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════
$output[] = "\n\n" . str_repeat("═", 160);
$output[] = "PHASE 2: FIND ALL CUSTOMER-BIOS-RESELLER COMBINATIONS WITH MULTIPLE TRANSACTIONS";
$output[] = str_repeat("═", 160);

$multiTransactions = DB::table('activity_logs as al')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) as customer_id,
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) as bios_id,
         al.user_id as reseller_id,
         COUNT(*) as total_logs,
         COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.license_id'))) as unique_licenses,
         COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price'))) as unique_prices,
         GROUP_CONCAT(DISTINCT al.id ORDER BY al.id SEPARATOR ',') as all_log_ids,
         GROUP_CONCAT(al.id ORDER BY al.created_at SEPARATOR ',') as log_ids_chronological"
    )
    ->whereIn('al.action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) IS NOT NULL")
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) IS NOT NULL")
    ->groupByRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')),
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')),
         al.user_id"
    )
    ->havingRaw('COUNT(*) > 1')
    ->orderByDesc('total_logs')
    ->get();

$output[] = "\nFound: " . $multiTransactions->count() . " combinations with multiple transactions";

if ($multiTransactions->count() === 0) {
    $output[] = "✅ NO MULTIPLE TRANSACTION COMBINATIONS FOUND - System appears clean!";
} else {
    // Load user data
    $customerIds = $multiTransactions->pluck('customer_id')->unique()->values();
    $resellerIds = $multiTransactions->pluck('reseller_id')->unique()->values();

    $customers = DB::table('users')->whereIn('id', $customerIds)->get()->keyBy('id');
    $resellers = DB::table('users')->whereIn('id', $resellerIds)->get()->keyBy('id');

    $output[] = "\n" . str_repeat("─", 160);
    $output[] = "COMBINATIONS SUMMARY:";
    $output[] = str_repeat("─", 160);

    foreach ($multiTransactions as $idx => $combo) {
        $customer = $customers->get($combo->customer_id);
        $reseller = $resellers->get($combo->reseller_id);

        $output[] = "\n[COMBO " . ($idx + 1) . "]";
        $output[] = "  Customer: {$customer?->name} (ID: {$combo->customer_id}) | Username: {$customer?->username}";
        $output[] = "  Reseller: {$reseller?->name} (ID: {$combo->reseller_id}) | Username: {$reseller?->username}";
        $output[] = "  BIOS ID: {$combo->bios_id}";
        $output[] = "  Total Logs: {$combo->total_logs} | Unique Licenses: {$combo->unique_licenses} | Unique Prices: {$combo->unique_prices}";
        $output[] = "  Log IDs (Chronological): {$combo->log_ids_chronological}";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 3: DETAILED ANALYSIS OF EACH COMBINATION
// ═══════════════════════════════════════════════════════════════════════════════════════
if ($multiTransactions->count() > 0) {
    $output[] = "\n\n" . str_repeat("═", 160);
    $output[] = "PHASE 3: DETAILED TRANSACTION HISTORY FOR EACH COMBINATION";
    $output[] = str_repeat("═", 160);

    foreach ($multiTransactions as $idx => $combo) {
        $customer = $customers->get($combo->customer_id);
        $reseller = $resellers->get($combo->reseller_id);

        $logIds = array_map('intval', explode(',', $combo->log_ids_chronological));

        $output[] = "\n\n" . str_repeat("─", 160);
        $output[] = "[DETAILED COMBO " . ($idx + 1) . "] Customer: {$customer?->name} | BIOS: {$combo->bios_id} | Reseller: {$reseller?->name}";
        $output[] = str_repeat("─", 160);

        $logs = DB::table('activity_logs')
            ->whereIn('id', $logIds)
            ->orderBy('created_at')
            ->get();

        $output[] = "\nTransaction Timeline (Oldest to Newest):";

        foreach ($logs as $logIdx => $log) {
            $meta = json_decode($log->metadata, true) ?? [];

            $output[] = "\n  ┌─ Log #" . ($logIdx + 1);
            $output[] = "  │  ID: {$log->id}";
            $output[] = "  │  Created: {$log->created_at}";
            $output[] = "  │  Action: {$log->action}";
            $output[] = "  │  License ID: " . ($meta['license_id'] ?? 'N/A');
            $output[] = "  │  Price: $" . ($meta['price'] ?? 'N/A');
            $output[] = "  │  Price Source: " . ($meta['price_source'] ?? 'N/A');
            $output[] = "  │  Price Override Previous: " . ($meta['price_override_previous'] ?? 'N/A');
            $output[] = "  │  Attribution Type: " . ($meta['attribution_type'] ?? 'N/A');
            $output[] = "  └─ Full Metadata Keys: " . implode(', ', array_keys($meta));
        }

        // ANALYZE PATTERN
        $output[] = "\n\n  🔍 ANALYSIS:";

        $priceSequence = [];
        $licenseSequence = [];
        foreach ($logs as $log) {
            $meta = json_decode($log->metadata, true) ?? [];
            $priceSequence[] = $meta['price'] ?? null;
            $licenseSequence[] = $meta['license_id'] ?? null;
        }

        $uniquePrices = count(array_unique(array_filter($priceSequence)));
        $uniqueLicenses = count(array_unique(array_filter($licenseSequence)));

        $output[] = "     Price Sequence: " . implode(' → ', $priceSequence);
        $output[] = "     License Sequence: " . implode(' → ', $licenseSequence);
        $output[] = "     Unique Prices: {$uniquePrices}";
        $output[] = "     Unique Licenses: {$uniqueLicenses}";

        // RED FLAG DETECTION
        if ($uniqueLicenses > 1 && $uniquePrices === 1) {
            $output[] = "\n     🚨 RED FLAG: Multiple licenses but ALL same price";
            $output[] = "        This suggests RETROACTIVE UPDATE - the bug likely occurred here!";
            $output[] = "        All older licenses were changed to match the latest override price.";
        } else if ($uniquePrices > 1) {
            $output[] = "\n     ⚠️  YELLOW FLAG: Different prices found across transactions";
            $output[] = "        Need manual review to determine if this is corruption or expected variation.";
        } else {
            $output[] = "\n     ✅ GREEN: All transactions have same price (expected for same BIOS+reseller)";
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 4: ACTIVITY LOG METADATA ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════════════
$output[] = "\n\n" . str_repeat("═", 160);
$output[] = "PHASE 4: PRICE OVERRIDE HISTORY (price_source = 'super_admin_override')";
$output[] = str_repeat("═", 160);

$overrides = DB::table('activity_logs')
    ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.price_source')) = 'super_admin_override'")
    ->orderByDesc('created_at')
    ->limit(100)
    ->get();

$output[] = "\nFound: " . $overrides->count() . " activity logs with super_admin_override (last 100)";

if ($overrides->count() === 0) {
    $output[] = "✅ NO PRICE OVERRIDES FOUND - No admin changes made";
} else {
    $output[] = "\n" . str_repeat("─", 160);

    foreach ($overrides as $idx => $log) {
        $meta = json_decode($log->metadata, true) ?? [];
        $customer = DB::table('users')->find($meta['customer_id'] ?? null);
        $reseller = DB::table('users')->find($log->user_id);

        $output[] = "\n[OVERRIDE " . ($idx + 1) . "]";
        $output[] = "  Log ID: {$log->id}";
        $output[] = "  Date: {$log->created_at}";
        $output[] = "  Customer: {$customer?->name} (ID: {$meta['customer_id']}) | Username: {$customer?->username}";
        $output[] = "  Reseller: {$reseller?->name} (ID: {$log->user_id}) | Username: {$reseller?->username}";
        $output[] = "  BIOS: " . ($meta['bios_id'] ?? 'N/A');
        $output[] = "  Current Price: $" . ($meta['price'] ?? 'N/A');
        $output[] = "  Previous Price (before this override): " . ($meta['price_override_previous'] ?? 'N/A');
        $output[] = "  License ID: " . ($meta['license_id'] ?? 'N/A');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 5: SUSPECT TRANSACTIONS (Multiple licenses, same price, recent overrides)
// ═══════════════════════════════════════════════════════════════════════════════════════
$output[] = "\n\n" . str_repeat("═", 160);
$output[] = "PHASE 5: CORRUPTION SUSPECTS (Red Flags)";
$output[] = str_repeat("═", 160);

$suspects = [];

foreach ($multiTransactions as $combo) {
    $logIds = array_map('intval', explode(',', $combo->log_ids_chronological));
    $logs = DB::table('activity_logs')->whereIn('id', $logIds)->orderBy('created_at')->get();

    $priceSequence = [];
    $licenseSequence = [];
    foreach ($logs as $log) {
        $meta = json_decode($log->metadata, true) ?? [];
        $priceSequence[] = $meta['price'] ?? null;
        $licenseSequence[] = $meta['license_id'] ?? null;
    }

    $uniquePrices = count(array_unique(array_filter($priceSequence)));
    $uniqueLicenses = count(array_unique(array_filter($licenseSequence)));

    // Flag suspicious pattern
    if ($uniqueLicenses > 1 && $uniquePrices === 1) {
        $customer = $customers->get($combo->customer_id);
        $reseller = $resellers->get($combo->reseller_id);

        $suspects[] = [
            'customer_id' => $combo->customer_id,
            'customer_name' => $customer?->name,
            'reseller_id' => $combo->reseller_id,
            'reseller_name' => $reseller?->name,
            'bios_id' => $combo->bios_id,
            'unique_licenses' => $uniqueLicenses,
            'unique_prices' => $uniquePrices,
            'current_price' => end($priceSequence),
            'log_ids' => $logIds,
        ];
    }
}

if (empty($suspects)) {
    $output[] = "\n✅ NO CORRUPTION SUSPECTS FOUND";
} else {
    $output[] = "\n🚨 FOUND " . count($suspects) . " POTENTIALLY CORRUPTED TRANSACTIONS:\n";

    foreach ($suspects as $idx => $suspect) {
        $output[] = "\n[SUSPECT " . ($idx + 1) . "]";
        $output[] = "  Customer: {$suspect['customer_name']} (ID: {$suspect['customer_id']})";
        $output[] = "  Reseller: {$suspect['reseller_name']} (ID: {$suspect['reseller_id']})";
        $output[] = "  BIOS: {$suspect['bios_id']}";
        $output[] = "  Pattern: {$suspect['unique_licenses']} licenses, all price: \${$suspect['current_price']}";
        $output[] = "  Affected Log IDs: " . implode(', ', $suspect['log_ids']);
        $output[] = "  STATUS: ⚠️  Likely bug victim - older transactions may have been retroactively changed";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 6: SUMMARY & RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════════════
$output[] = "\n\n" . str_repeat("═", 160);
$output[] = "PHASE 6: SUMMARY & NEXT STEPS";
$output[] = str_repeat("═", 160);

$output[] = "\n📊 SUMMARY:";
$output[] = "  • Total combinations checked: " . $multiTransactions->count();
$output[] = "  • Corruption suspects found: " . count($suspects);
$output[] = "  • Price overrides made: " . $overrides->count();

$output[] = "\n✅ THE FIX:";
$output[] = "  • Code has been fixed - no more retroactive updates will happen";
$output[] = "  • Only current license prices will be updated going forward";
$output[] = "  • Historical transactions will NOT be affected by future price changes";

$output[] = "\n📝 NEXT STEPS:";
$output[] = "  1. Review the suspects above";
$output[] = "  2. For each suspect, contact customer to verify ORIGINAL price";
$output[] = "  3. Send this debug output to developer";
$output[] = "  4. Developer will create restoration script with correct original prices";

$output[] = "\n" . str_repeat("═", 160);
$output[] = "DEBUG COMPLETE - " . now();
$output[] = str_repeat("═", 160) . "\n";

// Output everything
echo implode("\n", $output);
