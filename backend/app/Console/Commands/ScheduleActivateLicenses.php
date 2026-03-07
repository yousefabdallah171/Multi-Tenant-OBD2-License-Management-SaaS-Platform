<?php

namespace App\Console\Commands;

use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Console\Command;

class ScheduleActivateLicenses extends Command
{
    protected $signature = 'licenses:schedule-activate';

    protected $description = 'Execute pending scheduled license activations.';

    public function __construct(private readonly LicenseService $licenseService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $licenses = License::query()
            ->with(['program:id,external_api_key_encrypted,external_api_base_url'])
            ->where('is_scheduled', true)
            ->where('status', 'pending')
            ->whereNotNull('scheduled_at')
            ->whereNull('scheduled_failed_at')
            ->where('scheduled_at', '<=', now())
            ->limit(200)
            ->get();

        $processed = 0;
        $failed = 0;

        foreach ($licenses as $license) {
            $result = $this->licenseService->executeScheduledActivation($license);
            if (! $result['success']) {
                $failed++;
                continue;
            }
            $processed++;
        }

        $this->info(sprintf('Scheduled activations processed: %d, failed: %d.', $processed, $failed));

        return self::SUCCESS;
    }
}
