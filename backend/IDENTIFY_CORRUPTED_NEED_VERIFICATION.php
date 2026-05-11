<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * IDENTIFY CORRUPTED PRICES NEEDING CUSTOMER VERIFICATION
 *
 * This script identifies first transactions where:
 * 1. price_override_previous exists (suggests retroactive change)
 * 2. Current price doesn't match what we'd expect from logical analysis
 * 3. Needs customer verification to restore original price
 *
 * Output: List of entries needing verification (for manual customer contact)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n" . str_repeat("═", 160);
echo "\nIDENTIFY CORRUPTED PRICES - Entries Needing Customer Verification";
echo "\n" . str_repeat("═", 160) . "\n";

// Find all combinations with multiple transactions
$multiTransactions = DB::table('activity_logs as al')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) as customer_id,
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) as bios_id,
         al.user_id as reseller_id,
         COUNT(*) as total_logs,
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
    ->get();

$needsVerification = [];
$loadUsers = DB::table('users')->get()->keyBy('id');

foreach ($multiTransactions as $combo) {
    $logIds = explode(',', $combo->log_ids_chronological);
    $logs = DB::table('activity_logs')
        ->whereIn('id', $logIds)
        ->orderBy('created_at')
        ->get();

    if ($logs->count() < 2) continue;

    $firstLog = $logs->first();
    $firstMeta = json_decode($firstLog->metadata, true) ?? [];

    $secondLog = $logs[1];
    $secondMeta = json_decode($secondLog->metadata, true) ?? [];

    // Check if first transaction shows signs of corruption
    // Signs: price_override_previous exists AND first price doesn't match logical pattern
    if (isset($secondMeta['price_override_previous']) && $secondMeta['price_override_previous'] !== null) {
        $claimedPrevious = (float)$secondMeta['price_override_previous'];
        $firstCurrentPrice = (float)($firstMeta['price'] ?? 0);
        $secondPrice = (float)($secondMeta['price'] ?? 0);

        // RED FLAG: First transaction price was changed retroactively
        // This means: the original price is UNKNOWN and needs customer verification
        if ($firstCurrentPrice !== $claimedPrevious && !($firstMeta['price_fixed'] ?? false) && !($firstMeta['price_verified_corrected'] ?? false)) {
            $customer = $loadUsers->get($combo->customer_id);
            $reseller = $loadUsers->get($combo->reseller_id);

            $needsVerification[] = [
                'log_id' => $firstLog->id,
                'customer_id' => $combo->customer_id,
                'customer_name' => $customer?->name ?? "ID:{$combo->customer_id}",
                'reseller_id' => $combo->reseller_id,
                'reseller_name' => $reseller?->name ?? "ID:{$combo->reseller_id}",
                'bios_id' => $combo->bios_id,
                'transaction_date' => $firstLog->created_at,
                'current_price' => $firstCurrentPrice,
                'metadata_says_previous_was' => $claimedPrevious,
                'latest_price' => $secondPrice,
                'reason' => 'First transaction retroactively changed - original price unknown',
            ];
        }
    }
}

echo "Found: " . count($needsVerification) . " entries needing customer verification\n\n";

if (empty($needsVerification)) {
    echo "✅ All corrupted entries have been verified or fixed!\n";
    exit(0);
}

echo str_repeat("═", 160) . "\n";
echo "ENTRIES NEEDING VERIFICATION\n";
echo str_repeat("═", 160) . "\n\n";

foreach ($needsVerification as $idx => $entry) {
    echo "[ENTRY " . ($idx + 1) . "]\n";
    echo "  Log ID: {$entry['log_id']}\n";
    echo "  Customer: {$entry['customer_name']}\n";
    echo "  Reseller: {$entry['reseller_name']}\n";
    echo "  BIOS: {$entry['bios_id']}\n";
    echo "  Transaction Date: {$entry['transaction_date']}\n";
    echo "  Current Price: \${$entry['current_price']}\n";
    echo "  Metadata Hint: \${$entry['metadata_says_previous_was']}\n";
    echo "  Latest Price for this BIOS: \${$entry['latest_price']}\n";
    echo "  Status: NEEDS CUSTOMER VERIFICATION\n";
    echo "  ACTION: Contact customer and ask: 'What was your original price on {$entry['transaction_date']}?'\n\n";
}

echo str_repeat("═", 160) . "\n";
echo "NEXT STEP: Contact customers and collect verified prices, then run APPLY_VERIFIED_CORRECTIONS.php\n";
echo str_repeat("═", 160) . "\n\n";
