<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\License;

class LicenseExpiryService
{
    public function __construct(
        private readonly ExternalApiService $externalApiService,
        private readonly MandiagApiService $mandiagApiService,
    ) {
    }

    public function expireDue(?int $tenantId = null, bool $deactivateExternal = true, int $limit = 500): int
    {
        $minuteWindowEnd = now()->startOfMinute()->addMinute();

        $query = License::query()
            ->where(function ($query) use ($minuteWindowEnd): void {
                $query
                    ->where(function ($active) use ($minuteWindowEnd): void {
                        $active
                            ->where('status', 'active')
                            ->whereNotNull('expires_at')
                            ->where('expires_at', '<', $minuteWindowEnd);
                    })
                    ->orWhere(function ($paused) use ($minuteWindowEnd): void {
                        $paused
                            ->where('status', 'pending')
                            ->where(function ($plainPending): void {
                                $plainPending
                                    ->where('is_scheduled', false)
                                    ->orWhereNull('is_scheduled');
                            })
                            ->whereNotNull('paused_at')
                            ->where('pause_remaining_minutes', '>', 0)
                            ->whereNotNull('expires_at')
                            ->where('expires_at', '<', $minuteWindowEnd);
                    });
            })
            ->whereNotNull('expires_at')
            ->limit($limit);

        if ($deactivateExternal) {
            $query->with([
                'program:id,api_type,external_api_key_encrypted,external_api_base_url',
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
                if ($deactivateExternal && $license->status === 'active') {
                    $program = $license->program;
                    if ($program?->isMandiag() && $license->mandiag_license_id) {
                        $this->mandiagApiService->disableLicense(
                            (int) $license->mandiag_license_id,
                            'License expired'
                        );
                        $apiResponseText = 'Disabled on Mandiag (auto-expired).';
                    } elseif ($program) {
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
                } elseif ($license->status === 'pending') {
                    $apiResponseText = 'Auto-expired while paused; external access was already disabled.';
                }
            } catch (\Throwable $exception) {
                report($exception);
                $apiResponseText = $exception->getMessage();
            }

            $expiredData = [
                'status' => 'expired',
                'external_deletion_response' => $apiResponseText,
            ];

            if ($license->paused_at !== null) {
                $expiredData['paused_at'] = null;
                $expiredData['pause_remaining_minutes'] = null;
                $expiredData['pause_reason'] = null;
                $expiredData['paused_by_role'] = null;
            }

            $license->forceFill($expiredData)->save();

            ActivityLog::query()->create([
                'tenant_id' => $license->tenant_id,
                'user_id' => null,
                'action' => 'license.auto_expired',
                'description' => sprintf('License for BIOS %s expired automatically.', $license->bios_id),
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
