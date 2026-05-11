<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * FIX WRONG RESTORATIONS SCRIPT
 *
 * Corrects prices that were restored to wrong values by SMART_RESTORE_CORRUPTED_PRICES.php
 * Uses verified customer data to set correct original prices
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n" . str_repeat("═", 160);
echo "\nFIX WRONG RESTORATIONS - Correcting Prices Back to Original Values";
echo "\n" . str_repeat("═", 160) . "\n";

// ═══════════════════════════════════════════════════════════════════════════════════════
// KNOWN WRONG RESTORATIONS TO FIX
// ═══════════════════════════════════════════════════════════════════════════════════════

$fixes = [
    [
        'customer_name' => 'ANGELO',
        'bios_id' => '5CD225481X',
        'transaction_date' => '2026-04-24',
        'current_wrong_price' => 140,
        'correct_original_price' => 85,
        'reason' => 'Verified with customer - original price was $85',
    ],
];

echo "[PHASE 1] Finding activity logs that need fixing...\n";
echo str_repeat("─", 160) . "\n\n";

$logsToFix = [];

foreach ($fixes as $fix) {
    echo "🔍 Looking for: {$fix['customer_name']} | BIOS: {$fix['bios_id']} | Date: {$fix['transaction_date']}\n";

    // Find the activity log entry
    $log = DB::table('activity_logs')
        ->whereRaw("DATE(created_at) = ?", [$fix['transaction_date']])
        ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.bios_id')) = ?", [$fix['bios_id']])
        ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
        ->first();

    if ($log) {
        $meta = json_decode($log->metadata, true) ?? [];
        $currentPrice = $meta['price'] ?? 0;

        if ((float)$currentPrice === (float)$fix['current_wrong_price']) {
            echo "   ✅ FOUND: Log ID {$log->id} | Current Price: \${$currentPrice}\n";
            echo "   → Will fix to: \${$fix['correct_original_price']}\n\n";

            $logsToFix[] = [
                'log_id' => $log->id,
                'log_object' => $log,
                'fix' => $fix,
            ];
        } else {
            echo "   ⚠️  FOUND but price mismatch:\n";
            echo "      Expected wrong price: \${$fix['current_wrong_price']}\n";
            echo "      Actual current price: \${$currentPrice}\n";
            echo "      Skipping this entry\n\n";
        }
    } else {
        echo "   ❌ NOT FOUND - Could not locate this entry\n\n";
    }
}

if (empty($logsToFix)) {
    echo "\n✅ No entries found that need fixing\n";
    exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 2: APPLY FIXES
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 2] APPLYING CORRECTIONS WITH AUDIT TRAIL";
echo "\n" . str_repeat("═", 160) . "\n";

$fixed = 0;
$failed = 0;

foreach ($logsToFix as $item) {
    try {
        $log = $item['log_object'];
        $fix = $item['fix'];

        $metadata = is_array($log->metadata) ? $log->metadata : json_decode($log->metadata, true);

        // Store what we're changing from
        $previousPrice = $metadata['price'] ?? 0;

        // Update to the correct original price
        $metadata['price'] = (float)$fix['correct_original_price'];
        $metadata['price_fixed'] = true;
        $metadata['price_fixed_date'] = now()->toIso8601String();
        $metadata['price_fixed_from'] = (float)$previousPrice;
        $metadata['price_fixed_to'] = (float)$fix['correct_original_price'];
        $metadata['price_fixed_reason'] = $fix['reason'];

        // Execute the fix
        DB::table('activity_logs')
            ->where('id', $log->id)
            ->update(['metadata' => json_encode($metadata), 'updated_at' => now()]);

        echo "✅ FIXED Log {$log->id}: \${$previousPrice} → \${$fix['correct_original_price']}\n";
        echo "   Customer: {$fix['customer_name']} | BIOS: {$fix['bios_id']} | Date: {$fix['transaction_date']}\n";
        echo "   Reason: {$fix['reason']}\n\n";

        $fixed++;
    } catch (\Exception $e) {
        echo "❌ Failed to fix Log {$item['log_id']}: " . $e->getMessage() . "\n";
        $failed++;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 3: VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 3] VERIFICATION - Confirming all fixes applied correctly";
echo "\n" . str_repeat("═", 160) . "\n";

foreach ($logsToFix as $item) {
    $log = DB::table('activity_logs')->find($item['log_id']);
    $meta = json_decode($log->metadata, true) ?? [];
    $currentPrice = $meta['price'] ?? 0;
    $fix = $item['fix'];

    if ((float)$currentPrice === (float)$fix['correct_original_price']) {
        echo "✅ VERIFIED: Log {$item['log_id']} correctly updated to \${$fix['correct_original_price']}\n";
    } else {
        echo "❌ FAILED: Log {$item['log_id']} shows \${$currentPrice} (expected \${$fix['correct_original_price']})\n";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\nCORRECTION SUMMARY";
echo "\n" . str_repeat("═", 160) . "\n";
echo "Total Corrections Applied: {$fixed}\n";
echo "Total Failures: {$failed}\n";
echo "Success Rate: " . ($fixed > 0 ? round(($fixed / ($fixed + $failed)) * 100) : 0) . "%\n";

echo "\n" . str_repeat("═", 160);
echo "\nCORRECTION COMPLETE - Prices restored to verified original values";
echo "\n" . str_repeat("═", 160) . "\n";
