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

        if ($biosId === '') {
            throw ValidationException::withMessages(['bios_id' => 'The BIOS ID field is required.']);
        }

        if ($program->status !== 'active') {
            throw ValidationException::withMessages(['program_id' => 'The selected program is not active.']);
        }

        $this->assertBiosAvailable($reseller, $program, $biosId);

        $apiResponse = $this->externalApiService->activateUser($biosId);

        $this->logBiosAccess($reseller, $biosId, 'activate', [
            'program_id' => $program->id,
            'external' => $apiResponse,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'bios_id' => $this->extractExternalMessage($apiResponse, 'The activation request was rejected by the external service.'),
            ]);
        }

        return DB::transaction(function () use ($data, $reseller, $program, $biosId): License {
            $customer = $this->upsertCustomer($reseller, $data, $biosId);

            $license = License::query()->create([
                'tenant_id' => $reseller->tenant_id,
                'customer_id' => $customer->id,
                'reseller_id' => $reseller->id,
                'program_id' => $program->id,
                'bios_id' => $biosId,
                'duration_days' => (int) $data['duration_days'],
                'price' => (float) $data['price'],
                'activated_at' => now(),
                'expires_at' => now()->addDays((int) $data['duration_days']),
                'status' => 'active',
            ]);

            $this->balanceService->recordRevenue($reseller, (float) $license->price, true);
            $this->logActivity(
                $reseller,
                'license.activated',
                sprintf('Activated %s for BIOS %s.', $program->name, $biosId),
                [
                    'license_id' => $license->id,
                    'customer_id' => $customer->id,
                    'program_id' => $program->id,
                    'price' => (float) $license->price,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            event(new LicenseActivated($license));

            return $license;
        });
    }

    public function renew(License $license, array $data): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);

        $apiResponse = $this->externalApiService->renewUser($license->bios_id);

        $this->logBiosAccess($reseller, $license->bios_id, 'renew', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'license' => $this->extractExternalMessage($apiResponse, 'The renewal request was rejected by the external service.'),
            ]);
        }

        $renewedLicense = DB::transaction(function () use ($license, $data, $reseller): License {
            $anchor = $license->expires_at && $license->expires_at->isFuture() ? $license->expires_at->copy() : now();

            $license->forceFill([
                'duration_days' => (int) $data['duration_days'],
                'price' => (float) $data['price'],
                'expires_at' => $anchor->addDays((int) $data['duration_days']),
                'status' => 'active',
            ])->save();

            $this->balanceService->recordRevenue($reseller, (float) $license->price);
            $this->logActivity(
                $reseller,
                'license.renewed',
                sprintf('Renewed license %d for BIOS %s.', $license->id, $license->bios_id),
                [
                    'license_id' => $license->id,
                    'duration_days' => (int) $data['duration_days'],
                    'price' => (float) $license->price,
                ],
            );

            $license->load(['customer', 'program', 'reseller']);

            event(new LicenseRenewed($license));

            return $license;
        });

        return $renewedLicense;
    }

    public function deactivate(License $license): License
    {
        $actor = $this->currentActor();
        $reseller = $this->resolveReseller($actor, $license->reseller);

        $apiResponse = $this->externalApiService->deleteUser($license->bios_id);

        $this->logBiosAccess($reseller, $license->bios_id, 'deactivate', [
            'license_id' => $license->id,
            'external' => $apiResponse,
        ]);

        if (! $apiResponse['success']) {
            throw ValidationException::withMessages([
                'license' => $this->extractExternalMessage($apiResponse, 'The deactivation request was rejected by the external service.'),
            ]);
        }

        $deactivatedLicense = DB::transaction(function () use ($license, $reseller): License {
            $license->forceFill([
                'status' => 'suspended',
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

            return $license;
        });

        return $deactivatedLicense;
    }

    private function assertBiosAvailable(User $reseller, Program $program, string $biosId): void
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
    }

    private function upsertCustomer(User $reseller, array $data, string $biosId): User
    {
        $customer = User::query()->firstOrNew([
            'tenant_id' => $reseller->tenant_id,
            'email' => $data['customer_email'],
        ]);

        $payload = [
            'tenant_id' => $reseller->tenant_id,
            'name' => $data['customer_name'],
            'email' => $data['customer_email'],
            'phone' => $data['customer_phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $reseller->id,
            'username' => $customer->username ?: $biosId,
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

        if ($role !== UserRole::RESELLER->value) {
            throw ValidationException::withMessages([
                'auth' => 'Only reseller accounts can perform this action.',
            ]);
        }

        return $actor;
    }

    private function extractExternalMessage(array $response, string $fallback): string
    {
        $message = $response['data']['message'] ?? $response['data']['error'] ?? null;

        return is_string($message) && $message !== '' ? $message : $fallback;
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
}
