<?php

namespace App\Services;

use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class BiosActivationService
{
    public function __construct(
        private readonly ExternalApiService $externalApiService,
        private readonly BalanceService $balanceService,
    ) {
    }

    /**
     * @return array{success: bool, data: array<string, mixed>, status_code: int}
     */
    public function activate(User $customer, User $reseller, Program $program, string $biosId, int $durationDays): array
    {
        $apiKey = $program->getDecryptedApiKey();

        if ($apiKey === null) {
            throw ValidationException::withMessages(['program_id' => 'Program has no external API configured.']);
        }

        if (BiosBlacklist::query()->where('bios_id', $biosId)->where('status', 'active')->exists()) {
            throw ValidationException::withMessages(['bios_id' => 'The BIOS ID is blacklisted.']);
        }

        if (License::query()->where('bios_id', $biosId)->where('program_id', $program->id)->where('status', 'active')->exists()) {
            BiosConflict::query()->create([
                'bios_id' => $biosId,
                'attempted_by' => $reseller->id,
                'tenant_id' => $reseller->tenant_id,
                'program_id' => $program->id,
                'conflict_type' => 'duplicate_activation',
                'resolved' => false,
            ]);

            throw ValidationException::withMessages(['bios_id' => 'An active license already exists for this BIOS ID.']);
        }

        $externalUsername = trim((string) ($customer->name ?? ''));
        if ($externalUsername === '') {
            $externalUsername = $biosId;
        }

        $response = $this->externalApiService->activateUser($apiKey, $externalUsername, $biosId, $program->external_api_base_url);

        BiosAccessLog::query()->create([
            'bios_id' => $biosId,
            'user_id' => $reseller->id,
            'tenant_id' => $reseller->tenant_id,
            'action' => 'activate',
            'ip_address' => request()->ip(),
            'metadata' => ['external' => $response],
        ]);

        if (! $response['success']) {
            return $response;
        }

        $license = License::query()->create([
            'tenant_id' => $reseller->tenant_id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'program_id' => $program->id,
            'bios_id' => $biosId,
            'external_username' => $externalUsername,
            'external_activation_response' => (string) ($response['data']['response'] ?? ''),
            'duration_days' => $durationDays,
            'price' => $program->base_price,
            'activated_at' => now(),
            'expires_at' => now()->addDays($durationDays),
            'status' => 'active',
        ]);

        $this->balanceService->credit($reseller, (float) $license->price);

        return [
            'success' => true,
            'data' => [
                'license' => $license->load(['customer', 'reseller', 'program']),
                'external' => $response['data'],
            ],
            'status_code' => 201,
        ];
    }
}
