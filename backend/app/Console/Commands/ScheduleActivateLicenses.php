<?php

namespace App\Console\Commands;

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
        $result = $this->licenseService->processDueScheduledActivations(200);
        $processed = $result['processed'];
        $failed = $result['failed'];

        $this->info(sprintf('Scheduled activations processed: %d, failed: %d.', $processed, $failed));

        return self::SUCCESS;
    }
}
