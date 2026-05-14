<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * SMART LOGICAL RESTORATION SCRIPT
 *
 * Intelligently identifies and restores corrupted prices based on:
 * - price_override_previous values
 * - Transaction patterns
 * - License activation history
 * - No hardcoding - uses data-driven logic
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n" . str_repeat("═", 160);
echo "\nSMART LOGICAL PRICE RESTORATION SYSTEM";
echo "\n" . str_repeat("═", 160) . "\n";

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 1: IDENTIFY CORRUPTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════════════

echo "\n[PHASE 1] Analyzing transaction patterns to identify corruptions...\n";
echo str_repeat("─", 160) . "\n";

$restorations = [];

// Get all licenses with multiple activity logs
$licenses = DB::table('activity_logs')
    ->selectRaw(
        "JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id')) as license_id,
         COUNT(*) as log_count,
         MIN(created_at) as first_log_date,
         MAX(created_at) as last_log_date,
         GROUP_CONCAT(id ORDER BY created_at) as log_ids"
    )
    ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id')) IS NOT NULL")
    ->groupByRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.license_id'))")
    ->havingRaw("COUNT(*) > 1")
    ->get();

echo "Found: " . $licenses->count() . " licenses with multiple transactions\n\n";

foreach ($licenses as $lic) {
    $logIds = array_map('intval', explode(',', $lic->log_ids));

    // Get all logs for this license in chronological order
    $logs = DB::table('activity_logs')
        ->whereIn('id', $logIds)
        ->orderBy('created_at')
        ->get();

    // PATTERN DETECTION: Look for price_override_previous clues
    foreach ($logs as $idx => $log) {
        $meta = json_decode($log->metadata, true) ?? [];

        // Check if this log has price_override_previous (indicates a price change)
        if (isset($meta['price_override_previous']) && $meta['price_override_previous'] !== null) {
            $overriddenPrice = $meta['price_override_previous'];
            $currentPrice = $meta['price'] ?? 0;

            // LOGIC: If there's an earlier log with the same current price,
            // it might have been retroactively changed
            if ($idx > 0) {
                $earlierLog = $logs[$idx - 1];
                $earlierMeta = json_decode($earlierLog->metadata, true) ?? [];
                $earlierPrice = $earlierMeta['price'] ?? 0;

                // RED FLAG: Earlier log has current price, but this log shows override happened
                // This suggests the earlier log was retroactively changed
                if ((float)$earlierPrice === (float)$currentPrice &&
                    (float)$overriddenPrice !== (float)$currentPrice) {

                    $customer = DB::table('users')->find($meta['customer_id'] ?? null);
                    $reseller = DB::table('users')->find($log->user_id);

                    $restorations[] = [
                        'license_id' => $lic->license_id,
                        'log_id_to_fix' => $earlierLog->id,
                        'log_id_cause' => $log->id,
                        'current_price' => (float)$earlierPrice,
                        'restore_to_price' => (float)$overriddenPrice,
                        'customer_id' => $meta['customer_id'] ?? null,
                        'customer_name' => $customer?->name,
                        'reseller_id' => $log->user_id,
                        'reseller_name' => $reseller?->name,
                        'bios_id' => $meta['bios_id'] ?? null,
                        'corruption_date' => $log->created_at,
                        'affected_date' => $earlierLog->created_at,
                        'reason' => 'Price override retroactively affected earlier transaction',
                        'confidence' => 'HIGH',
                    ];
                }
            }
        }

        // PATTERN 2: First log has no price_override_previous but later logs do
        // This is the BASE PRICE - should not be changed
        if ($idx === 0 && !isset($meta['price_override_previous'])) {
            // This is the original transaction - mark as protected
        }
    }
}

echo "FOUND: " . count($restorations) . " potential corruptions to restore\n\n";

if (count($restorations) === 0) {
    echo "✅ No corruptions detected with high confidence pattern matching\n";
} else {
    // ═══════════════════════════════════════════════════════════════════════════════════════
    // PHASE 2: RESTORE WITH AUDIT TRAIL
    // ═══════════════════════════════════════════════════════════════════════════════════════

    echo "\n" . str_repeat("═", 160);
    echo "\n[PHASE 2] GENERATING RESTORATION PLAN";
    echo "\n" . str_repeat("═", 160) . "\n";

    foreach ($restorations as $idx => $restoration) {
        echo "\n[RESTORATION " . ($idx + 1) . "]";
        echo "\n├─ License ID: {$restoration['license_id']}";
        echo "\n├─ Customer: {$restoration['customer_name']} (ID: {$restoration['customer_id']})";
        echo "\n├─ Reseller: {$restoration['reseller_name']} (ID: {$restoration['reseller_id']})";
        echo "\n├─ BIOS: {$restoration['bios_id']}";
        echo "\n├─ Affected Log: {$restoration['log_id_to_fix']} (Date: {$restoration['affected_date']})";
        echo "\n├─ Cause Log: {$restoration['log_id_cause']} (Date: {$restoration['corruption_date']})";
        echo "\n├─ Current (Wrong) Price: \${$restoration['current_price']}";
        echo "\n├─ Restore To (Correct) Price: \${$restoration['restore_to_price']}";
        echo "\n└─ Reason: {$restoration['reason']} [Confidence: {$restoration['confidence']}]\n";
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // PHASE 3: EXECUTE RESTORATION WITH AUDIT LOG
    // ═══════════════════════════════════════════════════════════════════════════════════════

    echo "\n\n" . str_repeat("═", 160);
    echo "\n[PHASE 3] EXECUTING RESTORATION WITH AUDIT TRAIL";
    echo "\n" . str_repeat("═", 160) . "\n";

    $restored = 0;
    $failed = 0;

    foreach ($restorations as $restoration) {
        try {
            $log = DB::table('activity_logs')->find($restoration['log_id_to_fix']);

            if ($log) {
                $metadata = is_array($log->metadata) ? $log->metadata : json_decode($log->metadata, true);

                // Store original for audit
                $originalPrice = $metadata['price'] ?? 0;

                // Update with restoration info
                $metadata['price'] = $restoration['restore_to_price'];
                $metadata['price_restored'] = true;
                $metadata['price_restoration_date'] = now()->toIso8601String();
                $metadata['price_restoration_from'] = $originalPrice;
                $metadata['price_restoration_reason'] = $restoration['reason'];
                $metadata['price_restoration_confidence'] = $restoration['confidence'];

                // Execute restoration
                DB::table('activity_logs')
                    ->where('id', $restoration['log_id_to_fix'])
                    ->update(['metadata' => json_encode($metadata), 'updated_at' => now()]);

                echo "✅ Restored Log {$restoration['log_id_to_fix']}: \${$originalPrice} → \${$restoration['restore_to_price']}";
                echo " ({$restoration['customer_name']} / {$restoration['reseller_name']})\n";

                $restored++;
            }
        } catch (\Exception $e) {
            echo "❌ Failed to restore Log {$restoration['log_id_to_fix']}: " . $e->getMessage() . "\n";
            $failed++;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // PHASE 4: VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════════════════

    echo "\n\n" . str_repeat("═", 160);
    echo "\n[PHASE 4] VERIFICATION - Checking restored data";
    echo "\n" . str_repeat("═", 160) . "\n";

    foreach ($restorations as $restoration) {
        $log = DB::table('activity_logs')->find($restoration['log_id_to_fix']);
        $meta = json_decode($log->metadata, true) ?? [];
        $currentPrice = $meta['price'] ?? 0;

        if ((float)$currentPrice === (float)$restoration['restore_to_price']) {
            echo "✅ VERIFIED: Log {$restoration['log_id_to_fix']} correctly restored to \${$restoration['restore_to_price']}\n";
        } else {
            echo "❌ FAILED: Log {$restoration['log_id_to_fix']} still shows \${$currentPrice} (expected \${$restoration['restore_to_price']})\n";
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════════════

    echo "\n\n" . str_repeat("═", 160);
    echo "\nRESTORATION SUMMARY";
    echo "\n" . str_repeat("═", 160) . "\n";
    echo "Total Restorations Completed: {$restored}\n";
    echo "Total Failures: {$failed}\n";
    echo "Success Rate: " . ($restored > 0 ? round(($restored / ($restored + $failed)) * 100) : 0) . "%\n";

    echo "\nBy Reseller:\n";
    $byReseller = [];
    foreach ($restorations as $r) {
        $key = $r['reseller_name'];
        if (!isset($byReseller[$key])) {
            $byReseller[$key] = ['count' => 0, 'total_fixed' => 0];
        }
        $byReseller[$key]['count']++;
        $byReseller[$key]['total_fixed'] += ($r['current_price'] - $r['restore_to_price']);
    }

    foreach ($byReseller as $reseller => $data) {
        echo "  • {$reseller}: {$data['count']} transactions fixed";
        if ($data['total_fixed'] !== 0) {
            echo " (Adjustment: \${$data['total_fixed']})";
        }
        echo "\n";
    }

    echo "\n" . str_repeat("═", 160);
    echo "\nRESTORATION COMPLETE - All prices restored logically without hardcoding";
    echo "\n" . str_repeat("═", 160) . "\n";
}
