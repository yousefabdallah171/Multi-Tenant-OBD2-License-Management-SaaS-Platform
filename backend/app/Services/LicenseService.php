<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Events\LicenseActivated;
use App\Events\LicenseDeactivated;
use App\Events\LicenseRenewed;
use App\Models\ActivityLog;
use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\Program;
use App\Models\ProgramDurationPreset;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LicenseService
{
    public function __construct(
        private readonly ExternalApiService $externalApiService,
        private readonly BalanceService $balanceService,
    ) {
    }

    public function activate(array $data): License
    {
        $actor = $this->currentActor();
        $relatedSeller = ! empty($data['seller_id']) ? User::query()->find((int) $data['seller_id']) : null;
        $reseller = $this->resolveReseller($actor, $relatedSeller);
        $program = $this->resolveAccessibleProgram($actor, (int) $data['program_id'], $reseller);
        $biosId = trim((string) $data['bios_id']);
        $customerName = trim((string) ($data['customer_name'] ?? ''));
        $apiKey = $program->getDecryptedApiKey();

        if ($biosId === '') {
            throw ValidationException::withMessages(['bios_id' => 'The BIOS ID field is required.']);
        }

        if ($customerName === '') {
            throw ValidationException::withMessages(['customer_name' => 'The customer name field is required.']);
        }

        if (preg_match('/[\/:?#]/', $biosId) === 1) {
            throw ValidationException::withMessages([
                'bios_id' => 'The BIOS ID contains unsupported reserved characters.',
            ]);
        }

        $externalUsername = $this->normalizeExternalUsername($customerName, $biosId);
        $isScheduled = (bool) ($data['is_scheduled'] ?? false);
        $scheduledTimezone = $this->normalizeTimezone((string) ($data['scheduled_timezone'] ?? config('app.timezone', 'UTC')));
        $scheduledAt = $isScheduled ? $this->normalizeToMinute(Carbon::parse((string) ($data['scheduled_date_time'] ?? ''), $scheduledTimezone)->utc()) : null;

        if ($program->status !== 'active') {
            throw ValidationException::withMessages(['program_id' => 'The selected program is not active.']);
        }

        if ($apiKey === null) {
            throw ValidationException::withMessages([
                'program_id' => 'This program is not configured for external activation. Contact your manager.',
            ]);
        }

        $this->assertBiosAvailable($reseller, $program, $biosId, $externalUsername);

        $apiResponse = [
            'success' => true,
            'data' => ['response' => 'Scheduled activation pending.'],
            'status_code' => 202,
        ];

        if (! $isScheduled) {
            $apiResponse = $this->externalApiService->activateUser($apiKey, $externalUsername, $biosId, $program->external_api_base_url);
        }

        $this->logBiosAccess($reseller, $biosId, 'activate', [
            'program_id' => $program->id,
            'external' => $apiResponse,
            'is_scheduled' => $isScheduled,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'bios_id' => $this->extractExternalMessage($apiResponse, 'The activation request was rejected by the external service.'),
            ]);
        }

        return DB::transaction(function () use ($actor, $data, $externalUsername, $reseller, $program, $biosId, $apiResponse, $isScheduled, $scheduledTimezone, $scheduledAt): License {
            $customer = $this->upsertCustomer($reseller, $data, $externalUsername);
            $preset = $this->resolveActivationPreset($actor, $program, $data);
            $durationDays = $preset ? (float) $preset->duration_days : (float) $data['duration_days'];
            $durationMinutes = (int) max(1, round($durationDays * 1440));
            $price = $preset ? (float) $preset->price : (float) $data['price'];
            $activationAnchor = $scheduledAt ?? $this->currentMinute();
            $activatedAt = $isScheduled ? null : $this->currentMinute();

            $license = License::query()->create([
                'tenant_id' => $reseller->tenant_id,
                'customer_id' => $customer->id,
                'reseller_id' => $reseller->id,
                'created_by_reseller_id' => $reseller->id,
                'program_id' => $program->id,
                'bios_id' => $biosId,
                'external_username' => $externalUsername,
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? ''),
                'duration_days' => $durationDays,
                'price' => $price,
                'activated_at' => $activatedAt,
                'expires_at' => $activationAnchor->copy()->addMinutes($durationMinutes),
                'scheduled_at' => $scheduledAt,
                'scheduled_timezone' => $isScheduled ? $scheduledTimezone : null,
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'is_scheduled' => $isScheduled,
                'activated_at_scheduled' => null,
                'paused_at' => null,
                'pause_remaining_minutes' => null,
                'pause_reason' => null,
                'status' => $isScheduled ? 'pending' : 'active',
            ]);

            $this->balanceService->recordRevenue($reseller, (float) $license->price, true);
            $this->logActivity(
                $reseller,
                $isScheduled ? 'license.scheduled' : 'license.activated',
                $isScheduled
                    ? sprintf('Scheduled %s for BIOS %s at %s.', $program->name, $biosId, $scheduledAt?->toIso8601String() ?? '')
                    : sprintf('Activated %s for BIOS %s.', $program->name, $biosId),
                [
                    'license_id' => $license->id,
                    'customer_id' => $customer->id,
                    'program_id' => $program->id,
                    'bios_id' => $biosId,
                    'external_username' => $externalUsername,
                    'price' => (float) $license->price,
                    'preset_id' => $preset?->id,
                    'is_scheduled' => $isScheduled,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            // Link BIOS ID to username in bios_username_links table
            BiosUsernameLink::updateOrCreate(
                ['bios_id' => strtolower($biosId)],
                ['username' => $customer->username, 'tenant_id' => $reseller->tenant_id]
            );

            // Lock the username on the customer
            $customer->update(['username_locked' => true]);

            if (! $isScheduled) {
                event(new LicenseActivated($license));
            }
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });
    }

    public function renew(License $license, array $data): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);
        $license->loadMissing(['program', 'customer', 'reseller']);

        $isScheduled = (bool) ($data['is_scheduled'] ?? false);
        $apiResponse = [
            'success' => true,
            'data' => ['response' => $isScheduled ? 'Scheduled renewal pending.' : 'Renewed locally.'],
            'status_code' => $isScheduled ? 202 : 200,
        ];

        if (! $isScheduled) {
            $program = $license->program;
            $apiKey = $program?->getDecryptedApiKey();

            if ($program && $apiKey !== null) {
                $externalUsername = (string) ($license->external_username ?: $license->customer?->username ?: $license->bios_id);
                $apiResponse = $this->externalApiService->activateUser(
                    $apiKey,
                    $externalUsername,
                    (string) $license->bios_id,
                    $program->external_api_base_url
                );

                if (! $apiResponse['success']) {
                    throw ValidationException::withMessages([
                        'license' => $this->extractExternalMessage($apiResponse, 'The renewal request was rejected by the external service.'),
                    ]);
                }
            }
        }

        $this->logBiosAccess($reseller, $license->bios_id, 'renew', [
            'license_id' => $license->id,
            'external' => $apiResponse,
            'is_scheduled' => $isScheduled,
        ]);

        $renewedLicense = DB::transaction(function () use ($license, $data, $reseller, $apiResponse, $isScheduled): License {
            $anchor = $license->expires_at && $license->expires_at->isFuture() ? $this->normalizeToMinute($license->expires_at->copy()) : $this->currentMinute();
            $durationDays = (float) $data['duration_days'];
            $durationMinutes = (int) max(1, round($durationDays * 1440));
            $scheduledTimezone = $this->normalizeTimezone((string) ($data['scheduled_timezone'] ?? config('app.timezone', 'UTC')));
            $scheduledAt = $isScheduled ? $this->normalizeToMinute(Carbon::parse((string) ($data['scheduled_date_time'] ?? ''), $scheduledTimezone)->utc()) : null;
            $expiresAt = ($scheduledAt?->copy() ?? $anchor->copy())->addMinutes($durationMinutes);
            $activatedAt = $license->activated_at;

            if ($isScheduled) {
                if ($license->status !== 'active' || ! $license->activated_at) {
                    $activatedAt = null;
                }
            } elseif (! $license->expires_at || ! $license->expires_at->isFuture() || $license->status !== 'active') {
                $activatedAt = $this->currentMinute();
            }

            $license->forceFill([
                'duration_days' => $durationDays,
                'price' => (float) $data['price'],
                'activated_at' => $activatedAt,
                'expires_at' => $expiresAt,
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? $license->external_activation_response),
                'status' => $isScheduled ? 'pending' : 'active',
                'scheduled_at' => $scheduledAt,
                'scheduled_timezone' => $isScheduled ? $scheduledTimezone : null,
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'is_scheduled' => $isScheduled,
                'activated_at_scheduled' => $isScheduled ? null : $license->activated_at_scheduled,
                'paused_at' => null,
                'pause_remaining_minutes' => null,
                'pause_reason' => null,
            ])->save();

            $this->balanceService->recordRevenue($reseller, (float) $license->price);
            $this->logActivity(
                $reseller,
                'license.renewed',
                sprintf('Renewed license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'duration_days' => $durationDays,
                    'price' => (float) $license->price,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            event(new LicenseRenewed($license));
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });

        return $renewedLicense;
    }

    public function deactivate(License $license): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);
        $program = $license->program()->first();
        $apiKey = $program?->getDecryptedApiKey();
        $apiResponse = [
            'success' => false,
            'data' => ['response' => null],
            'status_code' => 0,
        ];

        if ($apiKey !== null) {
            $apiResponse = $this->externalApiService->deactivateUser($apiKey, (string) $license->external_username, $program?->external_api_base_url);
        }

        $this->logBiosAccess($reseller, $license->bios_id, 'deactivate', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        $deactivatedLicense = DB::transaction(function () use ($license, $reseller, $apiResponse): License {
            $license->forceFill([
                'status' => 'cancelled',
                'external_deletion_response' => (string) ($apiResponse['data']['response'] ?? 'Local-only deactivation.'),
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'paused_at' => null,
                'pause_remaining_minutes' => null,
                'pause_reason' => null,
            ])->save();

            $this->logActivity(
                $reseller,
                'license.deactivated',
                sprintf('Deactivated license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            event(new LicenseDeactivated($license));
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });

        return $deactivatedLicense;
    }

    public function pause(License $license, array $data = []): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);
        if ($license->status !== 'active') {
            throw ValidationException::withMessages([
                'license' => 'Only active licenses can be paused.',
            ]);
        }

        if (! $license->expires_at || ! $license->expires_at->isFuture()) {
            throw ValidationException::withMessages([
                'license' => 'This license no longer has remaining time to pause.',
            ]);
        }

        $program = $license->program()->first();
        $apiKey = $program?->getDecryptedApiKey();
        $apiResponse = [
            'success' => false,
            'data' => ['response' => null],
            'status_code' => 0,
        ];

        if ($apiKey !== null) {
            $apiResponse = $this->externalApiService->deactivateUser($apiKey, (string) $license->external_username, $program?->external_api_base_url);
        }

        $this->logBiosAccess($reseller, $license->bios_id, 'pause', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        return DB::transaction(function () use ($license, $reseller, $apiResponse, $data): License {
            $remainingMinutes = max(1, $this->currentMinute()->diffInMinutes($license->expires_at, false));
            $pauseReason = Str::limit(trim((string) ($data['pause_reason'] ?? '')), 500, '...');

            $license->forceFill([
                'status' => 'pending',
                'external_deletion_response' => (string) ($apiResponse['data']['response'] ?? 'Paused locally.'),
                'paused_at' => $this->currentMinute(),
                'pause_remaining_minutes' => $remainingMinutes,
                'pause_reason' => $pauseReason !== '' ? $pauseReason : null,
                'scheduled_at' => null,
                'scheduled_timezone' => null,
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'is_scheduled' => false,
            ])->save();

            $this->logActivity(
                $reseller,
                'license.paused',
                sprintf('Paused license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'pause_reason' => $pauseReason !== '' ? $pauseReason : null,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });
    }

    public function resume(License $license): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);
        $isPausedPending = $this->isPausedPending($license);

        if ($license->status === 'pending' && ! $isPausedPending && ! $license->is_scheduled) {
            throw ValidationException::withMessages([
                'license' => 'This customer is pending only. Renew the license to activate it.',
            ]);
        }

        if ($license->status === 'pending' && $license->is_scheduled) {
            throw ValidationException::withMessages([
                'license' => 'This license is scheduled. Edit the schedule or renew it instead of reactivating it.',
            ]);
        }

        $program = $license->program()->first();
        $apiKey = $program?->getDecryptedApiKey();
        $apiResponse = [
            'success' => true,
            'data' => ['response' => 'Resumed locally.'],
            'status_code' => 200,
        ];

        if ($apiKey !== null) {
            $apiResponse = $this->externalApiService->activateUser(
                $apiKey,
                (string) $license->external_username,
                (string) $license->bios_id,
                $program?->external_api_base_url
            );
        }

        $this->logBiosAccess($reseller, $license->bios_id, 'resume', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'license' => $this->extractExternalMessage($apiResponse, 'The resume request was rejected by the external service.'),
            ]);
        }

        return DB::transaction(function () use ($license, $reseller, $apiResponse, $isPausedPending): License {
            $remainingMinutes = $isPausedPending
                ? max(1, (int) ($license->pause_remaining_minutes ?? 0))
                : null;

            $license->forceFill([
                'status' => 'active',
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? ''),
                'expires_at' => $remainingMinutes !== null ? $this->currentMinute()->addMinutes($remainingMinutes) : $license->expires_at,
                'paused_at' => null,
                'pause_remaining_minutes' => null,
                'pause_reason' => null,
                'scheduled_at' => null,
                'scheduled_timezone' => null,
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'is_scheduled' => false,
            ])->save();

            $this->logActivity(
                $reseller,
                'license.resumed',
                sprintf('Resumed license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });
    }

    /**
     * @return array{success: bool, license: License, message: string|null}
     */
    public function executeScheduledActivation(License $license): array
    {
        $license->loadMissing(['program', 'reseller']);
        $attemptedAt = $this->currentMinute();
        $reseller = $license->reseller;

        if (! $license->is_scheduled || $license->status !== 'pending' || $license->scheduled_at === null) {
            return [
                'success' => false,
                'license' => $license,
                'message' => 'Only pending scheduled licenses can be executed.',
            ];
        }

        if (! $reseller) {
            return $this->markScheduledActivationFailure($license, 'The scheduled activation does not have a valid reseller owner.', $attemptedAt);
        }

        $program = $license->program;
        $apiKey = $program?->getDecryptedApiKey();

        if ($apiKey === null) {
            return $this->markScheduledActivationFailure($license, 'This program is not configured for external activation.', $attemptedAt, $reseller);
        }

        $apiResponse = $this->externalApiService->activateUser(
            $apiKey,
            (string) ($license->external_username ?: $license->bios_id),
            (string) $license->bios_id,
            $program?->external_api_base_url,
        );

        if (! ($apiResponse['success'] ?? false)) {
            return $this->markScheduledActivationFailure(
                $license,
                $this->extractExternalMessage($apiResponse, 'The scheduled activation request was rejected by the external service.'),
                $attemptedAt,
                $reseller,
            );
        }

        $durationMinutes = (int) max(1, round(((float) $license->duration_days) * 1440));

        $activatedLicense = DB::transaction(function () use ($attemptedAt, $apiResponse, $durationMinutes, $license, $program, $reseller): License {
            $license->forceFill([
                'status' => 'active',
                'activated_at' => $attemptedAt,
                'activated_at_scheduled' => $attemptedAt,
                'expires_at' => $attemptedAt->copy()->addMinutes($durationMinutes),
                'is_scheduled' => false,
                'scheduled_at' => null,
                'scheduled_timezone' => null,
                'scheduled_last_attempt_at' => $attemptedAt,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? $license->external_activation_response),
            ])->save();

            $this->logActivity(
                $reseller,
                'license.scheduled_activation_executed',
                sprintf('Scheduled activation executed for license %d.', $license->id),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $program?->id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'executed_at' => $attemptedAt->toIso8601String(),
                ],
            );

            $license->load(['customer', 'program', 'reseller']);
            event(new LicenseActivated($license));
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });

        return [
            'success' => true,
            'license' => $activatedLicense,
            'message' => null,
        ];
    }

    /**
     * @return array{processed: int, failed: int}
     */
    public function processDueScheduledActivations(int $limit = 200): array
    {
        if (! Schema::hasColumns('licenses', ['is_scheduled', 'scheduled_at', 'scheduled_failed_at'])) {
            return [
                'processed' => 0,
                'failed' => 0,
            ];
        }

        if (! Schema::hasColumns('programs', ['external_api_key_encrypted', 'external_api_base_url'])) {
            return [
                'processed' => 0,
                'failed' => 0,
            ];
        }

        $licenses = License::query()
            ->with(['program:id,external_api_key_encrypted,external_api_base_url', 'reseller:id,tenant_id'])
            ->where('is_scheduled', true)
            ->where('status', 'pending')
            ->whereNotNull('scheduled_at')
            ->whereNull('scheduled_failed_at')
            ->where('scheduled_at', '<=', now())
            ->limit($limit)
            ->get();

        $processed = 0;
        $failed = 0;

        foreach ($licenses as $license) {
            $result = $this->executeScheduledActivation($license);

            if (! $result['success']) {
                $failed++;
                continue;
            }

            $processed++;
        }

        return [
            'processed' => $processed,
            'failed' => $failed,
        ];
    }

    public function retryScheduledActivation(License $license): License
    {
        $actor = $this->currentActor();
        $this->resolveReseller($actor, $license->reseller);

        $result = $this->executeScheduledActivation($license);

        if (! $result['success']) {
            throw ValidationException::withMessages([
                'license' => $result['message'] ?? 'The scheduled activation could not be retried.',
            ]);
        }

        return $result['license'];
    }

    /**
     * @return array{success: bool, message: string|null, response: array<string, mixed>}
     */
    public function changeBiosId(License $license, string $newBiosId): array
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);
        $license->loadMissing(['customer', 'reseller']);
        $program = Program::query()->find($license->program_id);
        $apiKey = $program?->getDecryptedApiKey();
        $trimmedBiosId = trim($newBiosId);

        if ($trimmedBiosId === '') {
            throw ValidationException::withMessages([
                'new_bios_id' => 'The new BIOS ID field is required.',
            ]);
        }

        if ($trimmedBiosId === (string) $license->bios_id) {
            throw ValidationException::withMessages([
                'new_bios_id' => 'The new BIOS ID must be different from the current BIOS ID.',
            ]);
        }

        // For non-active licenses or when no API key, update locally without external API
        if ($apiKey === null || $license->status !== 'active') {
            return DB::transaction(function () use ($license, $trimmedBiosId, $reseller): array {
                $oldBiosId = (string) $license->bios_id;

                $license->forceFill([
                    'bios_id' => $trimmedBiosId,
                ])->save();

                $this->logActivity(
                    $reseller,
                    'license.bios_changed',
                    sprintf('Changed BIOS ID on license %d from %s to %s.', $license->id, $oldBiosId, $trimmedBiosId),
                    [
                        'license_id' => $license->id,
                        'customer_id' => $license->customer_id,
                        'program_id' => $license->program_id,
                        'bios_id' => $trimmedBiosId,
                        'old_bios_id' => $oldBiosId,
                        'new_bios_id' => $trimmedBiosId,
                        'external_username' => $license->external_username,
                    ],
                );

                $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

                return [
                    'success' => true,
                    'message' => null,
                    'response' => ['response' => $license->status === 'active' ? 'BIOS updated locally.' : 'BIOS updated (license is not active).'],
                ];
            });
        }

        $externalUsername = (string) ($license->external_username ?: $license->customer?->username ?: $license->bios_id);
        $apiResponse = $this->externalApiService->changeBiosId($apiKey, $externalUsername, (string) $license->bios_id, $trimmedBiosId, $program?->external_api_base_url);

        $this->logBiosAccess($reseller, $trimmedBiosId, 'change', [
            'license_id' => $license->id,
            'old_bios_id' => $license->bios_id,
            'new_bios_id' => $trimmedBiosId,
            'external' => $apiResponse,
        ]);

        if (! ($apiResponse['success'] ?? false)) {
            return [
                'success' => false,
                'message' => $this->extractExternalMessage($apiResponse, 'The external service rejected the BIOS change request.'),
                'response' => $apiResponse['data'] ?? [],
            ];
        }

        // Only verify BIOS change for active licenses (expired licenses won't be in getActiveUsers)
        if ($program?->external_software_id && $license->status === 'active') {
            $verification = $this->externalApiService->getActiveUsers((int) $program->external_software_id, $program->external_api_base_url);
            $verifiedUsers = is_array($verification['data']['users'] ?? null) ? $verification['data']['users'] : [];
            $verifiedBiosId = $verifiedUsers[$externalUsername] ?? null;

            if (! ($verification['success'] ?? false) || $verifiedBiosId !== $trimmedBiosId) {
                return [
                    'success' => false,
                    'message' => ! ($verification['success'] ?? false)
                        ? 'The BIOS change was sent, but the external API could not be verified yet.'
                        : 'The BIOS change was sent, but the external API still reports the old BIOS ID.',
                    'response' => [
                        ...($apiResponse['data'] ?? []),
                        'verification' => $verification['data'] ?? [],
                    ],
                ];
            }
        }

        DB::transaction(function () use ($license, $trimmedBiosId, $reseller): void {
            $oldBiosId = (string) $license->bios_id;

            $license->forceFill([
                'bios_id' => $trimmedBiosId,
            ])->save();

            $this->logActivity(
                $reseller,
                'license.bios_changed',
                sprintf('Changed BIOS ID on license %d from %s to %s.', $license->id, $oldBiosId, $trimmedBiosId),
                [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $trimmedBiosId,
                    'old_bios_id' => $oldBiosId,
                    'new_bios_id' => $trimmedBiosId,
                    'external_username' => $license->external_username,
                ],
            );

            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);
        });

        return [
            'success' => true,
            'message' => null,
            'response' => $apiResponse['data'] ?? [],
        ];
    }

    private function assertBiosAvailable(User $reseller, Program $program, string $biosId, string $externalUsername): void
    {
        if (BiosBlacklist::blocksBios($biosId, $reseller->tenant_id)) {
            BiosConflict::query()->create([
                'bios_id' => $biosId,
                'attempted_by' => $reseller->id,
                'tenant_id' => $reseller->tenant_id,
                'program_id' => $program->id,
                'conflict_type' => 'blacklisted_bios',
                'resolved' => false,
            ]);

            $this->logBiosAccess($reseller, $biosId, 'blacklist', [
                'reason' => 'blacklisted',
                'status' => 'blocked',
                'description' => sprintf('Blocked activation for blacklisted BIOS %s.', $biosId),
                'program_id' => $program->id,
            ]);

            throw ValidationException::withMessages(['bios_id' => 'This BIOS ID is blacklisted.']);
        }

        // GLOBAL CROSS-TENANT CHECK: check if BIOS is active in ANY tenant
        $biosIdLower = strtolower($biosId);
        $globalDuplicate = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
            ->whereIn('status', ['active', 'pending', 'suspended'])
            ->first();

        if ($globalDuplicate) {
            BiosConflict::query()->create([
                'bios_id' => $biosId,
                'attempted_by' => $reseller->id,
                'tenant_id' => $reseller->tenant_id,
                'program_id' => $program->id,
                'conflict_type' => 'duplicate_activation',
                'resolved' => false,
            ]);

            $this->logBiosAccess($reseller, $biosId, 'conflict', [
                'program_id' => $program->id,
                'license_id' => $globalDuplicate->id,
            ]);

            throw ValidationException::withMessages(['bios_id' => 'BIOS ID is already working with another reseller']);
        }

        // BIOS-USERNAME LINK CHECK: if this BIOS already has a permanent username link, enforce it
        $existingLink = BiosUsernameLink::where('bios_id', $biosIdLower)->first();
        if ($existingLink && strtolower((string) $existingLink->username) !== strtolower($externalUsername)) {
            throw ValidationException::withMessages([
                'customer_name' => 'This BIOS ID is permanently linked to a different username. Please use the linked username.',
            ]);
        }

        $usernameConflict = License::query()
            ->where('program_id', $program->id)
            ->where('external_username', $externalUsername)
            ->where('bios_id', '!=', $biosId)
            ->whereEffectivelyActive()
            ->exists();

        if ($usernameConflict) {
            $this->logBiosAccess($reseller, $biosId, 'conflict', [
                'program_id' => $program->id,
                'conflict_type' => 'username_bios_mismatch',
                'external_username' => $externalUsername,
            ]);

            throw ValidationException::withMessages(['customer_name' => 'This username is already registered to a different BIOS ID on this program.']);
        }
    }

    private function isPausedPending(License $license): bool
    {
        return $license->status === 'pending'
            && ! $license->is_scheduled
            && $license->paused_at !== null
            && (int) ($license->pause_remaining_minutes ?? 0) > 0;
    }

    private function upsertCustomer(User $reseller, array $data, string $externalUsername): User
    {
        $email = $this->resolveCustomerEmail($reseller, $externalUsername, $data['customer_email'] ?? null);

        $customer = User::query()
            ->where('tenant_id', $reseller->tenant_id)
            ->where(function ($query) use ($email, $externalUsername): void {
                $query
                    ->where('email', $email)
                    ->orWhere('username', $externalUsername);
            })
            ->where('role', UserRole::CUSTOMER->value)
            ->first();

        if (! $customer) {
            $customer = new User();
        }

        $clientName = trim((string) ($data['client_name'] ?? ''));
        $displayName = $clientName !== '' ? $clientName : $data['customer_name'];

        $payload = [
            'tenant_id' => $reseller->tenant_id,
            'name' => $displayName,
            'email' => $email,
            'phone' => $data['customer_phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $reseller->id,
            'username' => $customer->username_locked ? $customer->username : $externalUsername,
            'username_locked' => true,
        ];

        if (Schema::hasColumn('users', 'client_name')) {
            $payload['client_name'] = $clientName !== '' ? $clientName : null;
        }

        if (! $customer->exists) {
            $payload['password'] = Hash::make(Str::password(16));
        }

        $customer->fill($payload);

        if (($customer->role?->value ?? (string) $customer->role) !== UserRole::CUSTOMER->value) {
            throw ValidationException::withMessages([
                'customer_email' => 'The provided email belongs to a non-customer account.',
            ]);
        }

        $customer->save();

        return $customer->fresh();
    }

    private function resolveCustomerEmail(User $reseller, string $biosId, mixed $rawEmail): string
    {
        $email = is_string($rawEmail) ? trim($rawEmail) : '';

        if ($email !== '') {
            return strtolower($email);
        }

        $normalizedBios = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $biosId) ?? 'bios');
        $normalizedBios = trim($normalizedBios, '-');
        $normalizedBios = $normalizedBios !== '' ? $normalizedBios : 'bios';

        return sprintf('no-email+tenant%s-%s@obd2sw.local', (string) ($reseller->tenant_id ?? '0'), $normalizedBios);
    }

    private function currentActor(): User
    {
        /** @var User|null $user */
        $user = auth()->user();

        if (! $user) {
            throw ValidationException::withMessages([
                'auth' => 'An authenticated user is required to manage licenses.',
            ]);
        }

        return $user;
    }

    private function resolveReseller(User $actor, ?User $relatedReseller = null): User
    {
        if ($relatedReseller) {
            $actorRole = $actor->role?->value ?? (string) $actor->role;

            // For non-super-admin actors, verify the related reseller belongs to the same tenant
            if ($actorRole !== UserRole::SUPER_ADMIN->value) {
                if ($relatedReseller->tenant_id !== $actor->tenant_id) {
                    throw ValidationException::withMessages([
                        'seller_id' => ['Reseller does not belong to your organization.'],
                    ]);
                }
                if ($relatedReseller->role !== UserRole::RESELLER->value) {
                    throw ValidationException::withMessages([
                        'seller_id' => ['The specified user is not a reseller.'],
                    ]);
                }
            }

            return $relatedReseller;
        }

        $role = $actor->role?->value ?? (string) $actor->role;

        if ($role === UserRole::RESELLER->value) {
            return $actor;
        }

        if ($role === UserRole::MANAGER->value) {
            return $actor;
        }

        if ($role === UserRole::MANAGER_PARENT->value) {
            return $actor;
        }

        if ($role === UserRole::SUPER_ADMIN->value) {
            if (! $relatedReseller) {
                throw ValidationException::withMessages([
                    'seller_id' => 'A seller is required for super admin activations.',
                ]);
            }

            $sellerRole = $relatedReseller->role?->value ?? (string) $relatedReseller->role;
            if (! in_array($sellerRole, [UserRole::RESELLER->value, UserRole::MANAGER->value, UserRole::MANAGER_PARENT->value], true)) {
                throw ValidationException::withMessages([
                    'seller_id' => 'The selected seller is not allowed to activate licenses.',
                ]);
            }

            return $relatedReseller;
        }

        throw ValidationException::withMessages([
            'auth' => 'No active seller account is available for activation.',
        ]);
    }

    private function extractExternalMessage(array $response, string $fallback): string
    {
        $message = $response['data']['message'] ?? $response['data']['error'] ?? $response['data']['response'] ?? null;
        $statusCode = (int) ($response['status_code'] ?? 0);

        if (is_string($message) && $message !== '') {
            $cleaned = trim(strip_tags($message));
            if ($cleaned !== '') {
                return Str::limit($cleaned, 220, '...');
            }
        }

        if ($statusCode >= 500) {
            return 'The external license server returned an internal error. Check External API Base URL, API Key, and the generated username format.';
        }

        return $fallback;
    }

    private function normalizeExternalUsername(string $customerName, string $biosId): string
    {
        $candidate = Str::of($customerName)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->limit(50, '')
            ->value();

        if ($candidate !== '') {
            return $candidate;
        }

        return Str::of($biosId)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->limit(50, '')
            ->value() ?: 'user_'.Str::lower(Str::random(8));
    }

    private function resolveAccessibleProgram(User $actor, int $programId, User $reseller): Program
    {
        $query = Program::query()->whereKey($programId);
        $role = $actor->role?->value ?? (string) $actor->role;

        if ($role === UserRole::SUPER_ADMIN->value) {
            $query->where('tenant_id', $reseller->tenant_id);
        } else {
            $query->where('tenant_id', $actor->tenant_id);
        }

        $program = $query->first();

        if (! $program) {
            throw ValidationException::withMessages([
                'program_id' => 'The selected program is invalid.',
            ]);
        }

        return $program;
    }

    private function normalizeTimezone(string $timezone): string
    {
        $trimmed = trim($timezone);
        if ($trimmed === '') {
            return (string) config('app.timezone', 'UTC');
        }

        if (in_array($trimmed, timezone_identifiers_list(), true)) {
            return $trimmed;
        }

        return (string) config('app.timezone', 'UTC');
    }

    private function currentMinute(): Carbon
    {
        return now()->startOfMinute();
    }

    private function normalizeToMinute(Carbon $value): Carbon
    {
        return $value->copy()->startOfMinute();
    }

    /**
     * @return array{success: false, license: License, message: string}
     */
    private function markScheduledActivationFailure(License $license, string $message, Carbon $attemptedAt, ?User $reseller = null): array
    {
        $cleanMessage = Str::limit(trim($message), 1000, '...');

        DB::transaction(function () use ($attemptedAt, $cleanMessage, $license, $reseller): void {
            $license->forceFill([
                'scheduled_last_attempt_at' => $attemptedAt,
                'scheduled_failed_at' => $attemptedAt,
                'scheduled_failure_message' => $cleanMessage,
            ])->save();

            if ($reseller) {
                $this->logActivity(
                    $reseller,
                    'license.scheduled_activation_failed',
                    sprintf('Scheduled activation failed for license %d.', $license->id),
                    [
                        'license_id' => $license->id,
                        'customer_id' => $license->customer_id,
                        'program_id' => $license->program_id,
                        'bios_id' => $license->bios_id,
                        'external_username' => $license->external_username,
                        'failed_at' => $attemptedAt->toIso8601String(),
                        'message' => $cleanMessage,
                    ],
                );
                $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);
            }
        });

        return [
            'success' => false,
            'license' => $license->fresh(['customer', 'program', 'reseller']),
            'message' => $cleanMessage,
        ];
    }

    private function logActivity(User $user, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
        ]);
    }

    private function logBiosAccess(User $user, string $biosId, string $action, array $metadata = []): void
    {
        BiosAccessLog::query()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'bios_id' => $biosId,
            'action' => $action,
            'ip_address' => request()->ip(),
            'metadata' => $metadata,
        ]);
    }

    private function forgetDashboardCaches(int $tenantId, int $resellerId): void
    {
        $seller = User::query()->select(['id', 'role', 'created_by'])->find($resellerId);
        $sellerRole = $seller?->role?->value ?? (string) $seller?->role;
        $managerId = $sellerRole === UserRole::MANAGER->value
            ? (int) $seller?->id
            : (int) ($seller?->created_by ?? 0);

        foreach ([
            "dashboard:manager-parent:tenant:{$tenantId}:stats",
            "dashboard:manager-parent:tenant:{$tenantId}:revenue-chart",
            "dashboard:manager-parent:tenant:{$tenantId}:expiry-forecast",
            "dashboard:manager-parent:tenant:{$tenantId}:team-performance",
            "dashboard:manager-parent:tenant:{$tenantId}:conflict-rate",
            "dashboard:global:stats",
            "dashboard:tenant:{$tenantId}:stats",
        ] as $key) {
            Cache::forget($key);
        }

        if ($managerId > 0) {
            foreach ([
                "dashboard:manager:{$managerId}:stats",
                "dashboard:manager:{$managerId}:activations-chart",
                "dashboard:manager:{$managerId}:revenue-chart",
                "dashboard:manager:{$managerId}:recent-activity",
            ] as $key) {
                Cache::forget($key);
            }
        }
    }

    private function resolveActivationPreset(User $actor, Program $program, array $data): ?ProgramDurationPreset
    {
        $role = $actor->role?->value ?? (string) $actor->role;

        if ($role !== UserRole::RESELLER->value) {
            return null;
        }

        $presetId = (int) ($data['preset_id'] ?? 0);

        if ($presetId <= 0) {
            throw ValidationException::withMessages([
                'preset_id' => 'A valid duration preset is required.',
            ]);
        }

        $preset = ProgramDurationPreset::query()
            ->where('program_id', $program->id)
            ->where('is_active', true)
            ->find($presetId);

        if (! $preset) {
            throw ValidationException::withMessages([
                'preset_id' => 'The selected duration preset is invalid.',
            ]);
        }

        return $preset;
    }
}
