<?php

namespace App\Console\Commands;

use App\Events\LicenseScheduledActivationExecuted;
use App\Models\ActivityLog;
use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Console\Command;

class ScheduleActivateLicenses extends Command
{
    protected $signature = 'licenses:schedule-activate';

    protected $description = 'Execute pending scheduled license activations.';

    public function __construct(private readonly ExternalApiService $externalApiService)
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
            ->where('scheduled_at', '<=', now())
            ->limit(200)
            ->get();

        $processed = 0;
        $failed = 0;

        foreach ($licenses as $license) {
            $program = $license->program;
            $apiKey = $program?->getDecryptedApiKey();
            if ($apiKey === null) {
                $failed++;
                continue;
            }

            $apiResponse = $this->externalApiService->activateUser(
                $apiKey,
                (string) ($license->external_username ?: $license->bios_id),
                (string) $license->bios_id,
                $program?->external_api_base_url,
            );

            if (! ($apiResponse['success'] ?? false)) {
                $failed++;
                continue;
            }

            $license->forceFill([
                'status' => 'active',
                'activated_at' => now(),
                'activated_at_scheduled' => now(),
                'is_scheduled' => false,
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? $license->external_activation_response),
            ])->save();

            ActivityLog::query()->create([
                'tenant_id' => $license->tenant_id,
                'user_id' => $license->reseller_id,
                'action' => 'license.scheduled_activation_executed',
                'description' => sprintf('Scheduled activation executed for license %d.', $license->id),
                'metadata' => ['license_id' => $license->id],
                'ip_address' => null,
            ]);

            event(new LicenseScheduledActivationExecuted($license->fresh()));
            $processed++;
        }

        $this->info(sprintf('Scheduled activations processed: %d, failed: %d.', $processed, $failed));

        return self::SUCCESS;
    }
}

