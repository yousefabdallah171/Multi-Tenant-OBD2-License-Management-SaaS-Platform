<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\License;

class LicenseExpiryService
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function expireDue(?int $tenantId = null, bool $deactivateExternal = true, int $limit = 500): int
    {
        $minuteWindowEnd = now()->startOfMinute()->addMinute();

        $query = License::query()
            ->where('status', 'active')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', $minuteWindowEnd)
            ->limit($limit);

        if ($deactivateExternal) {
            $query->with([
                'program:id,external_api_key_encrypted,external_api_base_url',
                'customer:id,username',
            ]);
        }

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        $expiredLicenses = $query->get();
        $processed = 0;

        foreach ($expiredLicenses as $license) {
            $apiResponseText = 'Auto-expired locally.';

            try {
                if ($deactivateExternal) {
                    $program = $license->program;
                    if ($program) {
                        $apiKey = $program->getDecryptedApiKey();
                        if ($apiKey !== null) {
                            $username = $license->external_username ?: $license->customer?->username ?: $license->bios_id;
                            $response = $this->externalApiService->deactivateUser(
                                $apiKey,
                                $username,
                                $program->external_api_base_url
                            );
                            $apiResponseText = (string) ($response['data']['response'] ?? $response['data']['message'] ?? $apiResponseText);
                        }
                    }
                }
            } catch (\Throwable $exception) {
                report($exception);
                $apiResponseText = $exception->getMessage();
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

        return $processed;
    }
}
