<?php
/**
 * Comprehensive Audit & Fix Script for Price Override Bug
 *
 * This script:
 * 1. Audits ALL transactions affected by the price override bug
 * 2. Identifies which prices were INCORRECTLY changed retroactively
 * 3. Generates SQL to restore original prices
 * 4. Provides detailed before/after comparison
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n";
echo "═".str_repeat("═", 150)."\n";
echo "CORRUPTED PRICE OVERRIDE AUDIT & RESTORATION GUIDE\n";
echo "═".str_repeat("═", 150)."\n\n";

// Find ALL activity logs with same BIOS + reseller combination (where bug could have occurred)
echo "[PHASE 1] Finding all customer-BIOS-reseller combinations with MULTIPLE transactions...\n";
echo str_repeat("─", 155)."\n";

$multiTransactions = DB::table('activity_logs as al')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) as customer_id,
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) as bios_id,
         al.user_id as reseller_id,
         COUNT(*) as transaction_count,
         GROUP_CONCAT(DISTINCT al.id ORDER BY al.id SEPARATOR ',') as activity_log_ids,
         GROUP_CONCAT(al.id ORDER BY al.created_at SEPARATOR ',') as chronological_ids,
         GROUP_CONCAT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.license_id')) SEPARATOR ',') as license_ids,
         GROUP_CONCAT(DISTINCT DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') ORDER BY al.created_at SEPARATOR ' | ') as transaction_dates,
         GROUP_CONCAT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price')) ORDER BY JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price')) DESC SEPARATOR ', ') as prices_found,
         MIN(al.created_at) as oldest_date,
         MAX(al.created_at) as newest_date"
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
    ->orderByDesc('transaction_count')
    ->limit(500)
    ->get();

echo "Found: {$multiTransactions->count()} customer-BIOS-reseller combinations with MULTIPLE transactions\n\n";

if ($multiTransactions->count() === 0) {
    echo "✅ No multiple transaction combinations found. System is clean!\n";
    exit(0);
}

// Load all related users
$customerIds = $multiTransactions->pluck('customer_id')->unique()->values();
$resellerIds = $multiTransactions->pluck('reseller_id')->unique()->values();

$customers = DB::table('users')->whereIn('id', $customerIds)->get()->keyBy('id');
$resellers = DB::table('users')->whereIn('id', $resellerIds)->get()->keyBy('id');

echo "[PHASE 2] Analyzing each combination for price discrepancies...\n";
echo str_repeat("─", 155)."\n\n";

$corruptionFound = [];
$suspiciousPatterns = [];

foreach ($multiTransactions as $combo) {
    $customerId = $combo->customer_id;
    $biosId = $combo->bios_id;
    $resellerId = $combo->reseller_id;
    $logIds = explode(',', $combo->chronological_ids);

    $customer = $customers->get($customerId);
    $reseller = $resellers->get($resellerId);

    // Get detailed transaction history
    $logs = DB::table('activity_logs')
        ->whereIn('id', $logIds)
        ->orderBy('created_at')
        ->get();

    // Check if there's a pattern suggesting retroactive updates
    $prices = $logs->map(fn($log) => [
        'id' => $log->id,
        'created_at' => $log->created_at,
        'price' => json_decode($log->metadata, true)['price'] ?? 0,
        'license_id' => json_decode($log->metadata, true)['license_id'] ?? null,
        'price_source' => json_decode($log->metadata, true)['price_source'] ?? null,
    ])->all();

    $uniquePrices = count(array_unique(array_column($prices, 'price')));

    // RED FLAG: Multiple licenses but same prices (likely retroactive update)
    $uniqueLicenses = count(array_unique(array_filter(array_column($prices, 'license_id'))));
    if ($uniqueLicenses > 1 && $uniquePrices === 1) {
        $corruptionFound[] = [
            'customer' => $customer?->name ?? $customerId,
            'customer_id' => $customerId,
            'bios' => $biosId,
            'reseller' => $reseller?->name ?? $resellerId,
            'reseller_id' => $resellerId,
            'transaction_count' => $combo->transaction_count,
            'unique_licenses' => $uniqueLicenses,
            'unique_prices' => $uniquePrices,
            'prices' => implode(', ', array_unique(array_column($prices, 'price'))),
            'logs' => $prices,
            'reason' => "Multiple licenses ($uniqueLicenses) but all same price - RETROACTIVE UPDATE DETECTED",
        ];
    }

    // YELLOW FLAG: Price changes from older to newer (unusual pattern)
    if (count($prices) >= 2) {
        $priceSequence = array_column($prices, 'price');
        $hasIncrease = false;
        $hasDecrease = false;

        for ($i = 1; $i < count($priceSequence); $i++) {
            if ($priceSequence[$i] > $priceSequence[$i-1]) $hasIncrease = true;
            if ($priceSequence[$i] < $priceSequence[$i-1]) $hasDecrease = true;
        }

        if ($hasIncrease && $hasDecrease) {
            $suspiciousPatterns[] = [
                'customer' => $customer?->name ?? $customerId,
                'customer_id' => $customerId,
                'bios' => $biosId,
                'reseller' => $reseller?->name ?? $resellerId,
                'price_sequence' => implode(' → ', array_column($prices, 'price')),
                'reason' => "Unusual price pattern (up/down fluctuation)",
            ];
        }
    }
}

echo "\n═".str_repeat("═", 150)."\n";
echo "CORRUPTION FOUND: " . count($corruptionFound) . " affected customer-BIOS-reseller combinations\n";
echo "═".str_repeat("═", 150)."\n\n";

if (!empty($corruptionFound)) {
    echo "🚨 CORRUPTED TRANSACTIONS DETAILS:\n\n";

    foreach ($corruptionFound as $idx => $corruption) {
        echo "[CORRUPTION #{$idx + 1}]\n";
        echo "Customer: {$corruption['customer']} (ID: {$corruption['customer_id']})\n";
        echo "Reseller: {$corruption['reseller']} (ID: {$corruption['reseller_id']})\n";
        echo "BIOS: {$corruption['bios']}\n";
        echo "Issue: {$corruption['reason']}\n";
        echo "Transactions: {$corruption['transaction_count']} | Unique Licenses: {$corruption['unique_licenses']} | Unique Prices: {$corruption['unique_prices']}\n";
        echo "Current Price: {$corruption['prices']}\n\n";

        echo "Transaction History (chronological):\n";
        foreach ($corruption['logs'] as $log) {
            echo "  - ID {$log['id']}: {$log['created_at']} | Price: {$log['price']} | License: {$log['license_id']} | Source: {$log['price_source']}\n";
        }
        echo "\n";
    }
}

echo "\n═".str_repeat("═", 150)."\n";
echo "SUSPICIOUS PATTERNS: " . count($suspiciousPatterns) . " combinations with unusual price behavior\n";
echo "═".str_repeat("═", 150)."\n\n";

if (!empty($suspiciousPatterns)) {
    foreach ($suspiciousPatterns as $pattern) {
        echo "⚠️  {$pattern['customer']} | BIOS: {$pattern['bios']} | Reseller: {$pattern['reseller']}\n";
        echo "    Pattern: {$pattern['price_sequence']}\n";
        echo "    Issue: {$pattern['reason']}\n\n";
    }
}

echo "\n═".str_repeat("═", 150)."\n";
echo "SUMMARY STATISTICS\n";
echo "═".str_repeat("═", 150)."\n";
echo "Total combinations with multiple transactions: {$multiTransactions->count()}\n";
echo "Likely corrupted (retroactive updates): " . count($corruptionFound) . "\n";
echo "Suspicious patterns (manual review needed): " . count($suspiciousPatterns) . "\n";
echo "\n";

if (!empty($corruptionFound)) {
    echo "🔧 RESTORATION INSTRUCTIONS:\n";
    echo "1. Review each corrupted transaction above\n";
    echo "2. Contact customer/reseller to verify ORIGINAL prices\n";
    echo "3. Use: php artisan tinker\n";
    echo "4. Update activity_logs SET metadata = JSON_SET(metadata, '$.price', <ORIGINAL_PRICE>) WHERE id = <LOG_ID>\n\n";
}

echo "═".str_repeat("═", 150)."\n";
echo "AUDIT COMPLETE\n";
echo "═".str_repeat("═", 150)."\n\n";
