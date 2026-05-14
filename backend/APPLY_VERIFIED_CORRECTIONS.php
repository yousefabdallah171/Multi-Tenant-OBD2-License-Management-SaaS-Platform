<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * APPLY VERIFIED CORRECTIONS
 *
 * Takes customer-verified prices and applies them logically with full audit trail
 * No hardcoding - all prices come from customer verification
 *
 * Usage:
 * 1. Run IDENTIFY_CORRUPTED_NEED_VERIFICATION.php to find entries
 * 2. Contact customers and collect verified original prices
 * 3. Add entries to $verifiedCorrections below
 * 4. Run this script to apply them logically
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// ═══════════════════════════════════════════════════════════════════════════════════════
// CUSTOMER-VERIFIED CORRECTIONS
// Add entries here as you collect verified prices from customers
// Format: 'log_id' => ['correct_price' => X, 'customer_verification' => 'note']
// ═══════════════════════════════════════════════════════════════════════════════════════

$verifiedCorrections = [
    1724 => [
        'correct_price' => 85,
        'customer_verification' => 'ANGELO verified: original price was $85 before retroactive override',
    ],
];

echo "\n" . str_repeat("═", 160);
echo "\nAPPLY VERIFIED CORRECTIONS - Customer-Verified Price Restoration";
echo "\n" . str_repeat("═", 160) . "\n";

if (empty($verifiedCorrections)) {
    echo "✅ No verified corrections to apply yet.\n";
    echo "   Run IDENTIFY_CORRUPTED_NEED_VERIFICATION.php to find entries needing verification.\n";
    exit(0);
}

echo "[PHASE 1] Validating " . count($verifiedCorrections) . " verified corrections...\n";
echo str_repeat("─", 160) . "\n\n";

$validCorrections = [];

foreach ($verifiedCorrections as $logId => $correction) {
    $log = DB::table('activity_logs')->find($logId);

    if (!$log) {
        echo "❌ Log {$logId}: NOT FOUND in database\n";
        continue;
    }

    $meta = json_decode($log->metadata, true) ?? [];
    $currentPrice = (float)($meta['price'] ?? 0);
    $correctPrice = (float)$correction['correct_price'];

    if ($currentPrice === $correctPrice) {
        echo "⚠️  Log {$logId}: Already at correct price (\${$currentPrice})\n";
        continue;
    }

    if ($correctPrice <= 0) {
        echo "❌ Log {$logId}: Invalid correction price (\${$correctPrice})\n";
        continue;
    }

    echo "✅ Log {$logId}: Valid - will correct \${$currentPrice} → \${$correctPrice}\n";

    $validCorrections[] = [
        'log_id' => $logId,
        'log_object' => $log,
        'current_price' => $currentPrice,
        'correct_price' => $correctPrice,
        'verification' => $correction['customer_verification'],
    ];
}

echo "\n";

if (empty($validCorrections)) {
    echo "✅ No corrections needed\n";
    exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 2: APPLY CORRECTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "[PHASE 2] APPLYING " . count($validCorrections) . " CORRECTIONS WITH AUDIT TRAIL\n";
echo str_repeat("─", 160) . "\n\n";

$applied = 0;
$failed = 0;

foreach ($validCorrections as $correction) {
    try {
        $log = $correction['log_object'];
        $metadata = is_array($log->metadata) ? $log->metadata : json_decode($log->metadata, true);

        // Add comprehensive audit trail
        $metadata['price_verified_corrected'] = true;
        $metadata['price_verified_corrected_date'] = now()->toIso8601String();
        $metadata['price_verified_corrected_from'] = $correction['current_price'];
        $metadata['price_verified_corrected_to'] = $correction['correct_price'];
        $metadata['price_verified_corrected_reason'] = $correction['verification'];
        $metadata['price_verified_corrected_by'] = 'customer_verification_process';

        // Apply the correct price
        $metadata['price'] = $correction['correct_price'];

        // Update database
        DB::table('activity_logs')
            ->where('id', $correction['log_id'])
            ->update(['metadata' => json_encode($metadata), 'updated_at' => now()]);

        echo "✅ APPLIED Log {$correction['log_id']}: \${$correction['current_price']} → \${$correction['correct_price']}\n";
        echo "   Verification: {$correction['verification']}\n\n";

        $applied++;
    } catch (\Exception $e) {
        echo "❌ FAILED Log {$correction['log_id']}: " . $e->getMessage() . "\n\n";
        $failed++;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 3: VERIFY CORRECTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\n[PHASE 3] VERIFICATION";
echo "\n" . str_repeat("═", 160) . "\n\n";

$verified = 0;
foreach ($validCorrections as $correction) {
    $log = DB::table('activity_logs')->find($correction['log_id']);
    $meta = json_decode($log->metadata, true) ?? [];
    $currentPrice = (float)($meta['price'] ?? 0);

    if ($currentPrice === $correction['correct_price']) {
        echo "✅ VERIFIED Log {$correction['log_id']} = \${$correction['correct_price']}\n";
        $verified++;
    } else {
        echo "❌ FAILED Log {$correction['log_id']} - shows \${$currentPrice} (expected \${$correction['correct_price']})\n";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n" . str_repeat("═", 160);
echo "\nCORRECTION SUMMARY";
echo "\n" . str_repeat("═", 160) . "\n";
echo "Total Applied: {$applied}\n";
echo "Total Failed: {$failed}\n";
echo "Total Verified: {$verified}\n";
echo "Success Rate: " . ($applied > 0 ? round(($applied / ($applied + $failed)) * 100) : 0) . "%\n";

if ($applied > 0) {
    echo "\n✅ All verified corrections applied successfully!\n";
    echo "   Each correction is documented with customer verification reason.\n";
}

echo "\n" . str_repeat("═", 160) . "\n\n";
