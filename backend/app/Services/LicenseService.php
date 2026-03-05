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
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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
        $reseller = $this->resolveReseller($actor);
        $program = Program::query()->findOrFail($data['program_id']);
        $biosId = trim((string) $data['bios_id']);
        $customerName = trim((string) ($data['customer_name'] ?? ''));
        $apiKey = $program->getDecryptedApiKey();

        if ($biosId === '') {
            throw ValidationException::withMessages(['bios_id' => 'The BIOS ID field is required.']);
        }

        if ($customerName === '') {
            throw ValidationException::withMessages(['customer_name' => 'The customer name field is required.']);
        }

        $externalUsername = $this->normalizeExternalUsername($customerName, $biosId);
        $isScheduled = (bool) ($data['is_scheduled'] ?? false);
        $scheduledTimezone = $this->normalizeTimezone((string) ($data['scheduled_timezone'] ?? config('app.timezone', 'UTC')));
        $scheduledAt = $isScheduled ? Carbon::parse((string) ($data['scheduled_date_time'] ?? ''), $scheduledTimezone)->utc() : null;

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

        $this->logBiosAccess($reseller, $biosId, $isScheduled ? 'schedule_activate' : 'activate', [
            'program_id' => $program->id,
            'external' => $apiResponse,
            'is_scheduled' => $isScheduled,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'bios_id' => $this->extractExternalMessage($apiResponse, 'The activation request was rejected by the external service.'),
            ]);
        }

        return DB::transaction(function () use ($data, $externalUsername, $reseller, $program, $biosId, $apiResponse, $isScheduled, $scheduledTimezone, $scheduledAt): License {
            $customer = $this->upsertCustomer($reseller, $data, $externalUsername);
            $durationDays = (float) $data['duration_days'];
            $durationMinutes = (int) max(1, round($durationDays * 1440));
            $activationAnchor = $scheduledAt ?? now();

            $license = License::query()->create([
                'tenant_id' => $reseller->tenant_id,
                'customer_id' => $customer->id,
                'reseller_id' => $reseller->id,
                'program_id' => $program->id,
                'bios_id' => $biosId,
                'external_username' => $externalUsername,
                'external_activation_response' => (string) ($apiResponse['data']['response'] ?? ''),
                'duration_days' => $durationDays,
                'price' => (float) $data['price'],
                'activated_at' => $isScheduled ? null : now(),
                'expires_at' => $activationAnchor->copy()->addMinutes($durationMinutes),
                'scheduled_at' => $scheduledAt,
                'scheduled_timezone' => $isScheduled ? $scheduledTimezone : null,
                'is_scheduled' => $isScheduled,
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
                    'price' => (float) $license->price,
                    'is_scheduled' => $isScheduled,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

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
        $this->logBiosAccess($reseller, $license->bios_id, 'renew', ['license_id' => $license->id]);

        $renewedLicense = DB::transaction(function () use ($license, $data, $reseller): License {
            $anchor = $license->expires_at && $license->expires_at->isFuture() ? $license->expires_at->copy() : now();
            $durationDays = (float) $data['duration_days'];
            $durationMinutes = (int) max(1, round($durationDays * 1440));
            $isScheduled = (bool) ($data['is_scheduled'] ?? false);
            $scheduledTimezone = $this->normalizeTimezone((string) ($data['scheduled_timezone'] ?? config('app.timezone', 'UTC')));
            $scheduledAt = $isScheduled ? Carbon::parse((string) ($data['scheduled_date_time'] ?? ''), $scheduledTimezone)->utc() : null;

            $license->forceFill([
                'duration_days' => $durationDays,
                'price' => (float) $data['price'],
                'expires_at' => ($scheduledAt ?? $anchor)->addMinutes($durationMinutes),
                'status' => $isScheduled ? 'pending' : 'active',
                'scheduled_at' => $scheduledAt,
                'scheduled_timezone' => $isScheduled ? $scheduledTimezone : null,
                'is_scheduled' => $isScheduled,
            ])->save();

            $this->balanceService->recordRevenue($reseller, (float) $license->price);
            $this->logActivity(
                $reseller,
                'license.renewed',
                sprintf('Renewed license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
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
            $deactivationIdentifier = $license->bios_id;
            $apiResponse = $this->externalApiService->deactivateUser($apiKey, $deactivationIdentifier, $program?->external_api_base_url);
        }

        $this->logBiosAccess($reseller, $license->bios_id, 'deactivate', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        $deactivatedLicense = DB::transaction(function () use ($license, $reseller, $apiResponse): License {
            $license->forceFill([
                'status' => 'suspended',
                'external_deletion_response' => (string) ($apiResponse['data']['response'] ?? 'Local-only deactivation.'),
            ])->save();

            $this->logActivity(
                $reseller,
                'license.deactivated',
                sprintf('Deactivated license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            event(new LicenseDeactivated($license));
            $this->forgetDashboardCaches((int) $reseller->tenant_id, (int) $reseller->id);

            return $license;
        });

        return $deactivatedLicense;
    }

    private function assertBiosAvailable(User $reseller, Program $program, string $biosId, string $externalUsername): void
    {
        if (BiosBlacklist::query()->where('bios_id', $biosId)->where('status', 'active')->exists()) {
            $this->logBiosAccess($reseller, $biosId, 'blocked', ['reason' => 'blacklisted', 'program_id' => $program->id]);

            throw ValidationException::withMessages(['bios_id' => 'This BIOS ID is blacklisted.']);
        }

        $duplicate = License::query()
            ->where('bios_id', $biosId)
            ->where('program_id', $program->id)
            ->where('status', 'active')
            ->first();

        if ($duplicate) {
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
                'license_id' => $duplicate->id,
            ]);

            throw ValidationException::withMessages(['bios_id' => 'An active license already exists for this BIOS ID and program.']);
        }

        $usernameConflict = License::query()
            ->where('tenant_id', $reseller->tenant_id)
            ->where('program_id', $program->id)
            ->where('external_username', $externalUsername)
            ->where('bios_id', '!=', $biosId)
            ->where('status', 'active')
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
            'client_name' => $clientName !== '' ? $clientName : null,
            'email' => $email,
            'phone' => $data['customer_phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $reseller->id,
            'username' => $customer->username_locked ? $customer->username : $externalUsername,
            'username_locked' => true,
        ];

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

    private function normalizeTimezone(string $timezone): string
    {
        $trimmed = trim($timezone);
        if ($trimmed === '') {
            return (string) config('app.timezone', 'UTC');
        }

        if (in_array($trimmed, timezone_identifiers_list(), true)) {
            return $trimmed;
        }

        if (preg_match('/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i', $trimmed, $matches)) {
            $hours = str_pad((string) min(23, (int) $matches[2]), 2, '0', STR_PAD_LEFT);
            $minutes = str_pad((string) min(59, (int) ($matches[3] ?? 0)), 2, '0', STR_PAD_LEFT);

            return sprintf('%s%s:%s', $matches[1], $hours, $minutes);
        }

        if (preg_match('/^([+-])(\d{1,2})(?::?(\d{2}))$/', $trimmed, $matches)) {
            $hours = str_pad((string) min(23, (int) $matches[2]), 2, '0', STR_PAD_LEFT);
            $minutes = str_pad((string) min(59, (int) $matches[3]), 2, '0', STR_PAD_LEFT);

            return sprintf('%s%s:%s', $matches[1], $hours, $minutes);
        }

        return (string) config('app.timezone', 'UTC');
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
}
