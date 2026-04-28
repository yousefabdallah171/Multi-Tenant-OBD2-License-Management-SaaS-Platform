<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\BiosUsernameLink;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Services\ExternalApiService;
use App\Services\LicenseService;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class LicenseController extends BaseSuperAdminController
{
    public function __construct(
        private LicenseService $licenseService,
        private ExternalApiService $externalApiService,
    ) {}

    public function expiring(): JsonResponse
    {
        $baseQuery = License::query()
            ->whereEffectivelyActive()
            ->where('expires_at', '>=', now());

        $day1 = (clone $baseQuery)->where('expires_at', '<=', now()->addDay())->count();
        $day3 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(3))->count();
        $day7 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(7))->count();
        $expired = License::query()->whereEffectivelyExpired()->count();

        return response()->json([
            'data' => [
                'day1' => $day1,
                'day3' => $day3,
                'day7' => $day7,
                'expired' => $expired,
            ],
        ]);
    }

    public function forceActivate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:users,id'],
            'seller_id' => ['required', 'integer', 'exists:users,id'],
            'bios_id' => ['required', 'string', 'min:5'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'license_type' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
            'duration_months' => ['required', 'integer', 'min:1'],
        ]);

        $biosId = trim($validated['bios_id']);
        $customer = User::query()->find($validated['customer_id']);
        $program = Program::query()->find($validated['program_id']);
        $seller = User::query()->find($validated['seller_id']);

        if (! $customer) {
            throw ValidationException::withMessages(['customer_id' => 'Customer not found']);
        }

        if (! $seller) {
            throw ValidationException::withMessages(['seller_id' => 'Seller not found']);
        }

        if (! $program) {
            throw ValidationException::withMessages(['program_id' => 'Program not found']);
        }

        if ((int) $seller->tenant_id !== (int) $customer->tenant_id) {
            throw ValidationException::withMessages(['seller_id' => 'Seller must belong to the same tenant as the customer.']);
        }

        $sellerRole = $seller->role?->value ?? (string) $seller->role;
        if (! in_array($sellerRole, ['reseller', 'manager', 'manager_parent'], true)) {
            throw ValidationException::withMessages(['seller_id' => 'The selected seller cannot own licenses.']);
        }

        $usernameLower = strtolower((string) $customer->username);
        $biosLink = BiosUsernameLink::query()
            ->where(function ($query) use ($customer): void {
                $query->whereNull('tenant_id')->orWhere('tenant_id', $customer->tenant_id);
            })
            ->whereRaw('LOWER(bios_id) = ?', [$biosId])
            ->first();
        if ($biosLink && strtolower((string) $biosLink->username) !== $usernameLower) {
            throw ValidationException::withMessages([
                'bios_id' => sprintf('This BIOS ID is permanently linked to username %s and cannot be force-assigned.', $biosLink->username),
            ]);
        }

        $usernameLink = $usernameLower !== ''
            ? BiosUsernameLink::query()
                ->where(function ($query) use ($customer): void {
                    $query->whereNull('tenant_id')->orWhere('tenant_id', $customer->tenant_id);
                })
                ->whereRaw('LOWER(username) = ?', [$usernameLower])
                ->first()
            : null;
        if ($usernameLink && strtolower((string) $usernameLink->bios_id) !== $biosId) {
            throw ValidationException::withMessages([
                'customer_id' => sprintf('This username is permanently linked to BIOS ID %s and cannot be force-assigned to another BIOS.', $usernameLink->bios_id),
            ]);
        }

        $existingProgramUsername = License::query()
            ->where('program_id', $program->id)
            ->whereRaw('LOWER(external_username) = ?', [$usernameLower])
            ->whereRaw('LOWER(bios_id) != ?', [$biosId])
            ->where(function ($q): void {
                $q->whereIn('status', ['active', 'suspended'])
                    ->orWhere(function ($q2): void {
                        $q2->where('status', 'pending')->where('is_scheduled', true);
                    })
                    ->orWhere(function ($q2): void {
                        $q2->where('status', 'pending')
                            ->where(function ($q3): void {
                                $q3->where('is_scheduled', false)->orWhereNull('is_scheduled');
                            })
                            ->whereNotNull('paused_at')
                            ->where('pause_remaining_minutes', '>', 0);
                    });
            })
            ->exists();

        if ($existingProgramUsername) {
            throw ValidationException::withMessages([
                'customer_id' => 'This username is already active on the selected program with a different BIOS ID.',
            ]);
        }

        // Find and deactivate existing active license with same BIOS ID (any tenant)
        $existing = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosId])
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($existing) {
            try {
                $this->externalApiService->deleteUser($existing->bios_id);
            } catch (\Exception $e) {
                \Log::warning("Force-activate: Failed to deactivate old BIOS {$existing->bios_id}: {$e->getMessage()}");
            }
            $existing->update(['status' => 'cancelled']);
        }

        $tenantId = $customer->tenant_id;
        $license = DB::transaction(function () use ($customer, $seller, $validated, $biosId, $tenantId) {
            $durationMonths = (int) $validated['duration_months'];
            $license = License::create([
                'customer_id' => $customer->id,
                'reseller_id' => $seller->id,
                'created_by_reseller_id' => $seller->id,
                'program_id' => $validated['program_id'],
                'bios_id' => $biosId,
                'external_username' => $customer->username,
                'status' => 'active',
                'price' => $validated['price'],
                'license_type' => $validated['license_type'] ?? null,
                'duration_days' => $durationMonths * 30,
                'starts_at' => now(),
                'expires_at' => now()->addMonths($durationMonths),
                'tenant_id' => $tenantId,
            ]);

            BiosUsernameLink::updateOrCreate(
                ['bios_id' => $biosId],
                ['username' => $customer->username, 'tenant_id' => $tenantId]
            );

            $customer->update(['username_locked' => true]);

            return $license;
        });

        return response()->json([
            'message' => 'License activated successfully',
            'data' => $license,
        ], 201);
    }

    public function forceExpire(Request $request, License $license): JsonResponse
    {
        $license->loadMissing(['program', 'customer', 'reseller']);
        $program = $license->program;
        $apiKey = $program?->getDecryptedApiKey();
        $externalResponse = 'Local-only force expiration.';

        if ($apiKey !== null && $license->external_username) {
            try {
                $response = $this->externalApiService->deactivateUser(
                    $apiKey,
                    (string) $license->external_username,
                    $program?->external_api_base_url,
                );
                $externalResponse = (string) ($response['data']['response'] ?? $externalResponse);
            } catch (\Throwable $exception) {
                Log::warning('Super admin force-expire external deactivation failed.', [
                    'license_id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'message' => $exception->getMessage(),
                ]);
                $externalResponse = 'External deactivation failed; license expired locally.';
            }
        }

        $expired = DB::transaction(function () use ($license, $request, $externalResponse): License {
            $previousStatus = (string) $license->status;

            $license->forceFill([
                'status' => 'expired',
                'expires_at' => now(),
                'external_deletion_response' => $externalResponse,
                'scheduled_at' => null,
                'scheduled_timezone' => null,
                'scheduled_last_attempt_at' => null,
                'scheduled_failed_at' => null,
                'scheduled_failure_message' => null,
                'is_scheduled' => false,
                'paused_at' => null,
                'pause_remaining_minutes' => null,
                'pause_reason' => null,
            ])->save();

            ActivityLog::create([
                'tenant_id' => $license->tenant_id,
                'user_id' => $request->user()?->id,
                'action' => 'license.force_expired',
                'description' => sprintf('Super admin marked license for BIOS %s as expired.', $license->bios_id),
                'metadata' => [
                    'license_id' => $license->id,
                    'customer_id' => $license->customer_id,
                    'program_id' => $license->program_id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'previous_status' => $previousStatus,
                ],
                'ip_address' => $request->ip(),
            ]);

            $license->load(['customer', 'program', 'reseller']);

            return $license;
        });

        LicenseCacheInvalidation::invalidateForLicense($expired);

        return response()->json([
            'message' => 'License marked as expired successfully.',
            'data' => $expired,
        ]);
    }
}
