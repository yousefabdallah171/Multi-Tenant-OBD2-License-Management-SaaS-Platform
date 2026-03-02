<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Console\Command;

class ExpireLicensesCommand extends Command
{
    protected $signature = 'licenses:expire';

    protected $description = 'Mark expired active licenses and deactivate them on external providers.';

    public function __construct(private readonly ExternalApiService $externalApiService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $expiredLicenses = License::query()
            ->with(['program:id,external_api_key_encrypted,external_api_base_url'])
            ->where('status', 'active')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->limit(500)
            ->get();

        $processed = 0;

        foreach ($expiredLicenses as $license) {
            $program = $license->program;
            $apiResponseText = 'Auto-expired locally.';

            if ($program) {
                $apiKey = $program->getDecryptedApiKey();
                if ($apiKey !== null) {
                    $username = $license->external_username ?: $license->bios_id;
                    $response = $this->externalApiService->deactivateUser(
                        $apiKey,
                        $username,
                        $program->external_api_base_url
                    );
                    $apiResponseText = (string) ($response['data']['response'] ?? $response['data']['message'] ?? $apiResponseText);
                }
            }

            $license->forceFill([
                'status' => 'expired',
                'external_deletion_response' => $apiResponseText,
            ])->save();

            ActivityLog::query()->create([
                'tenant_id' => $license->tenant_id,
                'user_id' => null,
                'action' => 'license.auto_expired',
                'description' => sprintf('License #%d expired automatically.', $license->id),
                'metadata' => [
                    'license_id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                ],
                'ip_address' => null,
            ]);

            $processed++;
        }

        $this->info(sprintf('Processed %d expired license(s).', $processed));

        return self::SUCCESS;
    }
}

