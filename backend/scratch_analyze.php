<?php
$logs = App\Models\ActivityLog::whereJsonContains('metadata->bios_id', 'C2503N0022948')->where('action', 'customer.price_overridden')->orderBy('id', 'asc')->get();
foreach($logs as $log) {
    echo "Date: {$log->created_at} | Action: {$log->action} | Old: " . ($log->metadata['old_price'] ?? 'N/A') . " | New: " . ($log->metadata['price'] ?? 'N/A') . PHP_EOL;
}
