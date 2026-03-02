<?php

namespace App\Console\Commands;

use App\Services\LicenseExpiryService;
use Illuminate\Console\Command;

class ExpireLicensesCommand extends Command
{
    protected $signature = 'licenses:expire';

    protected $description = 'Mark expired active licenses and deactivate them on external providers.';

    public function __construct(private readonly LicenseExpiryService $licenseExpiryService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $processed = $this->licenseExpiryService->expireDue();

        $this->info(sprintf('Processed %d expired license(s).', $processed));

        return self::SUCCESS;
    }
}
