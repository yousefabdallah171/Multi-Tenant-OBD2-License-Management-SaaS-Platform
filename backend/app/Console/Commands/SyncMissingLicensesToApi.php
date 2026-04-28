<?php

namespace App\Console\Commands;

use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncMissingLicensesToApi extends Command
{
    protected $signature = 'licenses:sync-missing-to-api {--dry-run : Show what would be synced without actually syncing}';

    protected $description = 'Activate all active licenses that are missing from external API';

    public function __construct(private readonly ExternalApiService $externalApiService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        $this->info('Starting sync of missing licenses to external API...');
        if ($dryRun) {
            $this->warn('DRY RUN MODE - No changes will be made');
        }

        // Get all active licenses with required relationships
        $activeLicenses = License::query()
            ->where('status', 'active')
            ->with(['program', 'customer'])
            ->whereNotNull('external_username')
            ->get();

        $this->info("Found {$activeLicenses->count()} active licenses in DB");

        $synced = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($activeLicenses as $license) {
            try {
                $program = $license->program;
                $apiKey = $program?->getDecryptedApiKey();

                if (!$apiKey || !$program?->external_api_base_url) {
                    $this->warn("Skipping license {$license->id}: No API key for program {$program?->id}");
                    $skipped++;
                    continue;
                }

                // Check if user exists in external API
                $apiUsersResponse = $this->externalApiService->getActiveUsers(
                    (int) $program->id,
                    $program->external_api_base_url,
                );

                $usersMap = $apiUsersResponse['data']['users'] ?? [];
                $existsInApi = false;

                // Check if username exists in API (case-insensitive)
                foreach (array_keys($usersMap) as $apiUsername) {
                    if (strtolower($apiUsername) === strtolower($license->external_username)) {
                        $existsInApi = true;
                        break;
                    }
                }

                if ($existsInApi) {
                    $this->line("✓ License {$license->id} ({$license->external_username}) already in API");
                    $skipped++;
                    continue;
                }

                if ($dryRun) {
                    $this->line("DRY RUN: Would activate {$license->external_username} (BIOS: {$license->bios_id})");
                    $synced++;
                    continue;
                }

                // Activate in external API
                $this->line("Activating {$license->external_username} (BIOS: {$license->bios_id})...");

                $response = $this->externalApiService->activateUser(
                    $apiKey,
                    $license->external_username,
                    $license->bios_id,
                    $program->external_api_base_url,
                );

                if ($response['success'] ?? false) {
                    $this->info("✓ Activated {$license->external_username}");
                    $synced++;
                } else {
                    $this->error("✗ Failed to activate {$license->external_username}: " . ($response['message'] ?? 'Unknown error'));
                    $failed++;
                }
            } catch (\Throwable $e) {
                $this->error("✗ Error syncing license {$license->id}: " . $e->getMessage());
                Log::error('License sync error', [
                    'license_id' => $license->id,
                    'username' => $license->external_username,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        $this->newLine();
        $this->info("=== Sync Complete ===");
        $this->info("Synced: $synced");
        $this->info("Failed: $failed");
        $this->info("Skipped: $skipped");

        if ($failed > 0) {
            $this->warn("Some licenses failed to sync. Check storage/logs/laravel.log for details.");
            return 1;
        }

        return 0;
    }
}
