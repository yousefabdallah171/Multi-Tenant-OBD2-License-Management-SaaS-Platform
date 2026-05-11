<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LOGICAL FIX - RESTORE ORIGINAL PRICES
 *
 * RULE: Price overrides should ONLY affect the LATEST transaction
 * RULE: The FIRST (oldest) transaction = original price, NEVER change
 *
 * Logic:
 * 1. Find all BIOS+customer+reseller combinations with multiple transactions
 * 2. For each combination:
 *    - FIRST transaction = keep original price (never touched)
 *    - MIDDLE transactions = restore to their actual price before override
 *    - LAST transaction = can have price override
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n" . str_repeat("═", 160);
echo "\nLOGICAL FIX - Restore Original Prices (Only Latest Transaction Can Have Override)";
echo "\n" . str_repeat("═", 160) . "\n";

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 1: FIND ALL COMBINATIONS WITH MULTIPLE TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "[PHASE 1] Finding all customer-BIOS-reseller combinations with multiple transactions...\n";
echo str_repeat("─", 160) . "\n";

$multiTransactions = DB::table('activity_logs as al')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.customer_id')) as customer_id,
         JSON_UNQUOTE(JSON_EXTRACT(al.metadata, '$.bios_id')) as bios_id,
         al.user_id as reseller_id,
         COUNT(*) as total_logs,
         GROUP_CONCAT(al.id ORDER BY al.created_at SEPARATOR ',') as log_ids_chronological,
         MIN(al.created_at) as first_date,
         MAX(al.created_at) as last_date"
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

echo "Found: " . $multiTransactions->count() . " combinations with multiple transactions\n\n";

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 2: ANALYZE AND IDENTIFY RETROACTIVE CHANGES
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "[PHASE 2] Analyzing for retroactive price changes...\n";
echo str_repeat("─", 160) . "\n";

$fixesNeeded = [];
$loadUsers = DB::table('users')->get()->keyBy('id');

foreach ($multiTransactions as $combo) {
    $logIds = explode(',', $combo->log_ids_chronological);
    $logs = DB::table('activity_logs')
        ->whereIn('id', $logIds)
        ->orderBy('created_at')
        ->get();

    if ($logs->count() < 2) continue;

    // Get first and last logs
    $firstLog = $logs->first();
    $lastLog = $logs->last();

    $firstMeta = json_decode($firstLog->metadata, true) ?? [];
    $lastMeta = json_decode($lastLog->metadata, true) ?? [];

    $firstPrice = (float)($firstMeta['price'] ?? 0);
    $lastPrice = (float)($lastMeta['price'] ?? 0);

    // Analyze middle logs for retroactive changes
    $priceHistory = [];
    foreach ($logs as $log) {
        $meta = json_decode($log->metadata, true) ?? [];
        $priceHistory[] = [
            'id' => $log->id,
            'price' => (float)($meta['price'] ?? 0),
            'price_override_previous' => $meta['price_override_previous'] ?? null,
            'price_fixed' => $meta['price_fixed'] ?? false,
            'created_at' => $log->created_at,
        ];
    }

    // Check if earlier logs were affected by price override
    for ($i = 0; $i < count($priceHistory) - 1; $i++) {
        $currentLog = $priceHistory[$i];
        $nextLog = $priceHistory[$i + 1];

        // If next log has price_override_previous and it matches current price,
        // it means current log was retroactively changed
        if ($nextLog['price_override_previous'] !== null) {
            $originalPrice = (float)$nextLog['price_override_previous'];

            // RED FLAG: Current log has been retroactively changed
            if ((float)$currentLog['price'] === (float)$nextLog['price'] &&
                $originalPrice !== (float)$nextLog['price']) {

                // This is a retroactive override - fix it
                $customer = $loadUsers->get($combo->customer_id);
                $reseller = $loadUsers->get($combo->reseller_id);

                $fixesNeeded[] = [
                    'log_id' => $currentLog['id'],
                    'customer_id' => $combo->customer_id,
                    'customer_name' => $customer?->name ?? "ID:{$combo->customer_id}",
                    'reseller_id' => $combo->reseller_id,
                    'reseller_name' => $reseller?->name ?? "ID:{$combo->reseller_id}",
                    'bios_id' => $combo->bios_id,
                    'current_price' => (float)$currentLog['price'],
                    'original_price' => $originalPrice,
                    'transaction_date' => $currentLog['created_at'],
                    'is_first_transaction' => ($i === 0),
                    'reason' => 'Retroactively changed by price override on later transaction',
                ];
            }
        }
    }

    // SPECIAL CASE: First transaction with wrong price (should be original)
    // Check if the first log's price doesn't match what price_override_previous says
    if ($firstLog && count($logs) > 1) {
        $firstMeta = json_decode($firstLog->metadata, true) ?? [];
        $secondLog = $logs[1];
        $secondMeta = json_decode($secondLog->metadata, true) ?? [];

        // If second log shows override_previous and it's different from first log price,
        // first log was changed
        if (isset($secondMeta['price_override_previous']) &&
            $secondMeta['price_override_previous'] !== null) {

            $claimedOriginal = (float)$secondMeta['price_override_previous'];
            $firstCurrentPrice = (float)$firstMeta['price'];

            // If they don't match, first log was wrongly changed
            if ($claimedOriginal !== $firstCurrentPrice && !$firstMeta['price_fixed']) {
                $customer = $loadUsers->get($combo->customer_id);
                $reseller = $loadUsers->get($combo->reseller_id);

                // Check if this fix is already in the list
                $exists = collect($fixesNeeded)->contains(function($fix) use ($firstLog) {
                    return $fix['log_id'] === $firstLog->id;
                });

                if (!$exists) {
                    $fixesNeeded[] = [
                        'log_id' => $firstLog->id,
                        'customer_id' => $combo->customer_id,
                        'customer_name' => $customer?->name ?? "ID:{$combo->customer_id}",
                        'reseller_id' => $combo->reseller_id,
                        'reseller_name' => $reseller?->name ?? "ID:{$combo->reseller_id}",
                        'bios_id' => $combo->bios_id,
                        'current_price' => $firstCurrentPrice,
                        'original_price' => $claimedOriginal,
                        'transaction_date' => $firstLog->created_at,
                        'is_first_transaction' => true,
                        'reason' => 'Original price retroactively overwritten by later price override',
                    ];
                }
            }
        }
    }
}

echo "Found: " . count($fixesNeeded) . " retroactively changed transactions that need fixing\n\n";

if (empty($fixesNeeded)) {
    echo "✅ No retroactive price changes detected. System is clean!\n";
    exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 3: DISPLAY FIXES
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 3] FIXES TO BE APPLIED";
echo "\n" . str_repeat("═", 160) . "\n";

foreach ($fixesNeeded as $idx => $fix) {
    echo "[FIX " . ($idx + 1) . "]\n";
    echo "  Log ID: {$fix['log_id']}\n";
    echo "  Customer: {$fix['customer_name']}\n";
    echo "  Reseller: {$fix['reseller_name']}\n";
    echo "  BIOS: {$fix['bios_id']}\n";
    echo "  Date: {$fix['transaction_date']}\n";
    echo "  Current (Wrong) Price: \${$fix['current_price']}\n";
    echo "  Original (Correct) Price: \${$fix['original_price']}\n";
    echo "  Is First Transaction: " . ($fix['is_first_transaction'] ? 'YES (Original)' : 'NO') . "\n";
    echo "  Reason: {$fix['reason']}\n\n";
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 4: APPLY FIXES
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 4] APPLYING FIXES WITH AUDIT TRAIL";
echo "\n" . str_repeat("═", 160) . "\n";

$fixed = 0;
$failed = 0;

foreach ($fixesNeeded as $fix) {
    try {
        $log = DB::table('activity_logs')->find($fix['log_id']);

        if ($log) {
            $metadata = is_array($log->metadata) ? $log->metadata : json_decode($log->metadata, true);

            // Store audit trail
            $metadata['price_logical_fixed'] = true;
            $metadata['price_logical_fixed_date'] = now()->toIso8601String();
            $metadata['price_logical_fixed_from'] = $metadata['price'] ?? 0;
            $metadata['price_logical_fixed_to'] = (float)$fix['original_price'];
            $metadata['price_logical_fixed_reason'] = $fix['reason'];

            // Apply fix
            $metadata['price'] = (float)$fix['original_price'];

            // Update database
            DB::table('activity_logs')
                ->where('id', $fix['log_id'])
                ->update(['metadata' => json_encode($metadata), 'updated_at' => now()]);

            echo "✅ FIXED Log {$fix['log_id']}: \${$fix['current_price']} → \${$fix['original_price']}\n";
            echo "   {$fix['customer_name']} | {$fix['bios_id']} | {$fix['transaction_date']}\n\n";

            $fixed++;
        }
    } catch (\Exception $e) {
        echo "❌ Failed to fix Log {$fix['log_id']}: " . $e->getMessage() . "\n";
        $failed++;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 5: VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 5] VERIFICATION - Confirming all fixes applied";
echo "\n" . str_repeat("═", 160) . "\n";

$verified = 0;
foreach ($fixesNeeded as $fix) {
    $log = DB::table('activity_logs')->find($fix['log_id']);
    $meta = json_decode($log->metadata, true) ?? [];
    $currentPrice = (float)($meta['price'] ?? 0);

    if ($currentPrice === (float)$fix['original_price']) {
        echo "✅ VERIFIED: Log {$fix['log_id']} = \${$fix['original_price']}\n";
        $verified++;
    } else {
        echo "❌ FAILED: Log {$fix['log_id']} shows \${$currentPrice} (expected \${$fix['original_price']})\n";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\nFIX SUMMARY";
echo "\n" . str_repeat("═", 160) . "\n";
echo "Total Fixes Applied: {$fixed}\n";
echo "Total Failures: {$failed}\n";
echo "Total Verified: {$verified}\n";
echo "Success Rate: " . ($fixed > 0 ? round(($fixed / ($fixed + $failed)) * 100) : 0) . "%\n";

echo "\n" . str_repeat("═", 160);
echo "\nLOGICAL FIX COMPLETE - Restored original prices to first transactions";
echo "\nNew Rule: Only LATEST transaction can have price overrides";
echo "\n" . str_repeat("═", 160) . "\n";
