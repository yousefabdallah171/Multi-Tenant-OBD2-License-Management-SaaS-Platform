<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Services\ExternalApiService;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'bios_id' => ['required', 'string', 'min:5'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'license_type' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'duration_months' => ['required', 'integer', 'min:1'],
        ]);

        $biosId = strtolower($validated['bios_id']);

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

        // Proceed with normal activation
        $customer = \App\Models\User::find($validated['customer_id']);
        if (!$customer) {
            throw ValidationException::withMessages(['customer_id' => 'Customer not found']);
        }

        // Create license
        $tenantId = $customer->tenant_id;
        $license = License::create([
            'customer_id' => $customer->id,
            'program_id' => $validated['program_id'],
            'bios_id' => $biosId,
            'status' => 'active',
            'price' => $validated['price'],
            'license_type' => $validated['license_type'],
            'starts_at' => now(),
            'expires_at' => now()->addMonths($validated['duration_months']),
            'tenant_id' => $tenantId,
        ]);

        // Link BIOS ID to username
        BiosUsernameLink::updateOrCreate(
            ['bios_id' => $biosId],
            ['username' => $customer->username, 'tenant_id' => $tenantId]
        );

        // Lock the username
        $customer->update(['username_locked' => true]);

        return response()->json([
            'message' => 'License activated successfully',
            'data' => $license,
        ], 201);
    }
}
