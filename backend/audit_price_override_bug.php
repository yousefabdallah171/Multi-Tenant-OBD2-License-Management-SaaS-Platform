<?php
/**
 * Audit Script: Find all customers/resellers affected by price override bug
 *
 * Bug: When editing a customer price, ALL transactions for same BIOS+reseller are updated
 * instead of just the latest one
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n";
echo "=".str_repeat("=", 120)."\n";
echo "PRICE OVERRIDE BUG AUDIT - Finding ALL Affected Customers & Resellers\n";
echo "=".str_repeat("=", 120)."\n\n";

// Query 1: Find all customers with multiple transactions for same BIOS + reseller
echo "[PHASE 1] Finding customers with multiple transactions for same BIOS...\n";
echo str_repeat("-", 130)."\n";

$multiTransactions = DB::table('activity_logs as al')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) as customer_id,
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) as bios_id,
         al.user_id as reseller_id,
         COUNT(*) as transaction_count,
         GROUP_CONCAT(DISTINCT al.id ORDER BY al.id SEPARATOR ',') as activity_log_ids,
         GROUP_CONCAT(DISTINCT DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') ORDER BY al.created_at SEPARATOR ' | ') as transaction_dates,
         GROUP_CONCAT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price')) ORDER BY JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price')) DESC SEPARATOR ', ') as prices_found,
         GROUP_CONCAT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price_source')) SEPARATOR ', ') as price_sources,
         GROUP_CONCAT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.price_override_previous')) SEPARATOR ', ') as prev_prices"
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
    ->limit(200)
    ->get();

echo "Found: {$multiTransactions->count()} customer-BIOS-reseller combinations with multiple transactions\n\n";

// Enrich with user data
$customerIds = $multiTransactions->pluck('customer_id')->unique()->values();
$resellerIds = $multiTransactions->pluck('reseller_id')->unique()->values();

$customers = DB::table('users')->whereIn('id', $customerIds)->get()->keyBy('id');
$resellers = DB::table('users')->whereIn('id', $resellerIds)->get()->keyBy('id');

echo "RESULTS:\n";
echo str_repeat("-", 130)."\n";

$affectedCount = 0;
$totalImpact = 0;

foreach ($multiTransactions as $row) {
    $customer = $customers->get($row->customer_id);
    $reseller = $resellers->get($row->reseller_id);
    $hasPriceOverride = strpos($row->price_sources, 'super_admin_override') !== false;

    if (!$hasPriceOverride) {
        continue; // Only show ones with price overrides
    }

    $affectedCount++;

    echo "\n[AFFECTED #{$affectedCount}]\n";
    echo "Customer: ID={$row->customer_id} | Name={$customer?->name} | Username={$customer?->username}\n";
    echo "Reseller:  ID={$row->reseller_id} | Name={$reseller?->name}\n";
    echo "BIOS ID:   {$row->bios_id}\n";
    echo "Transactions: {$row->transaction_count}\n";
    echo "Activity Log IDs: {$row->activity_log_ids}\n";
    echo "Dates: {$row->transaction_dates}\n";
    echo "Prices Now: {$row->prices_found}\n";
    echo "Previous Prices: {$row->prev_prices}\n";
    echo "Price Sources: {$row->price_sources}\n";
    echo str_repeat("-", 130)."\n";

    $totalImpact++;
}

echo "\n";
echo "=".str_repeat("=", 130)."\n";
echo "SUMMARY\n";
echo "=".str_repeat("=", 130)."\n";
echo "Total customer-BIOS-reseller combinations: {$multiTransactions->count()}\n";
echo "Combinations with PRICE OVERRIDES applied: {$affectedCount}\n";
echo "\n";

// Query 2: Find activity logs with super_admin_override price_source
echo "\n[PHASE 2] Detailed breakdown of all super_admin_override transactions...\n";
echo str_repeat("-", 130)."\n";

$overrideLogs = DB::table('activity_logs')
    ->select(
        'id',
        'created_at',
        'user_id',
        'metadata'
    )
    ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.price_source')) = 'super_admin_override'")
    ->orderByDesc('created_at')
    ->limit(500)
    ->get();

echo "Total activity logs with super_admin_override: {$overrideLogs->count()}\n\n";

foreach ($overrideLogs as $log) {
    $meta = json_decode($log->metadata, true) ?? [];
    $customerId = $meta['customer_id'] ?? 'N/A';
    $biosId = $meta['bios_id'] ?? 'N/A';
    $price = $meta['price'] ?? 0;
    $prevPrice = $meta['price_override_previous'] ?? 'unknown';
    $customer = $customers->get($customerId);
    $reseller = $resellers->get($log->user_id);

    echo "Log ID: {$log->id} | Date: {$log->created_at}\n";
    echo "  Customer: {$customer?->name} (ID: {$customerId})\n";
    echo "  Reseller: {$reseller?->name} (ID: {$log->user_id})\n";
    echo "  BIOS: {$biosId} | Price: {$price} | Previous: {$prevPrice}\n";
    echo str_repeat("-", 130)."\n";
}

echo "\n";
echo "=".str_repeat("=", 130)."\n";
echo "AFFECTED CUSTOMERS WITH MULTIPLE SAME-BIOS TRANSACTIONS\n";
echo "=".str_repeat("=", 130)."\n";

$summary = [];
foreach ($multiTransactions as $row) {
    $key = "{$row->customer_id}|{$row->bios_id}|{$row->reseller_id}";
    $customer = $customers->get($row->customer_id);
    $reseller = $resellers->get($row->reseller_id);

    if (!isset($summary[$customer?->name])) {
        $summary[$customer?->name] = [];
    }

    $summary[$customer?->name][] = [
        'bios' => $row->bios_id,
        'reseller' => $reseller?->name,
        'transactions' => $row->transaction_count,
        'prices' => $row->prices_found,
        'prev_prices' => $row->prev_prices,
        'has_override' => strpos($row->price_sources, 'super_admin_override') !== false,
    ];
}

ksort($summary);

foreach ($summary as $customerName => $entries) {
    echo "\n{$customerName}:\n";
    foreach ($entries as $entry) {
        $override = $entry['has_override'] ? " ⚠️  HAS PRICE OVERRIDE" : "";
        echo "  - BIOS: {$entry['bios']} | Reseller: {$entry['reseller']} | Transactions: {$entry['transactions']}{$override}\n";
        echo "    Current Prices: {$entry['prices']}\n";
        if (!empty($entry['prev_prices']) && $entry['prev_prices'] !== 'unknown') {
            echo "    Previous Prices: {$entry['prev_prices']}\n";
        }
    }
}

echo "\n";
echo "=".str_repeat("=", 130)."\n";
echo "AUDIT COMPLETE\n";
echo "=".str_repeat("=", 130)."\n\n";
