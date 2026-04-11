<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\LicenseService;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LicenseController extends Controller
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function activateLicense(Request $request): JsonResponse
    {
        $role = $request->user()?->role?->value ?? (string) $request->user()?->role;
        $isReseller = in_array($role, [UserRole::RESELLER->value, UserRole::MANAGER->value], true);
        // duration_days is also nullable when a preset_id is explicitly provided (e.g. manager_parent in preset mode)
        $durationNullable = $isReseller || !empty($request->input('preset_id'));

        $validated = $request->validate([
            'program_id' => ['required', 'integer'],
            'seller_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['required', 'string', 'max:5000'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'bios_id' => ['required', 'string', 'max:255'],
            'preset_id' => [
                Rule::requiredIf($isReseller),
                'nullable',
                'integer',
                Rule::exists('program_duration_presets', 'id')->where(function ($query) use ($request): void {
                    $query
                        ->where('program_id', (int) $request->input('program_id'))
                        ->where('is_active', true);
                }),
            ],
            'duration_days' => [$durationNullable ? 'nullable' : 'required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => [$durationNullable ? 'nullable' : 'required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
        ]);

        $license = $this->licenseService->activate($validated);
        $licenseKey = Str::upper('LIC-'.$license->id.'-'.Str::random(8));
        $this->invalidateLicenseCachesSafely($license);

        return response()->json([
            'message' => 'License activated.',
            'license_key' => $licenseKey,
            'customer_id' => $license->customer_id,
            'expires_at' => $license->expires_at?->toIso8601String(),
            'data' => [
                'id' => $license->id,
                'customer_id' => $license->customer_id,
                'customer_name' => $license->customer?->name,
                'customer_email' => $this->visibleEmail($license->customer?->email),
                'customer_phone' => $license->customer?->phone,
                'bios_id' => $license->bios_id,
                'program' => $license->program?->name,
                'program_id' => $license->program_id,
                'duration_days' => $license->duration_days,
                'price' => CustomerOwnership::displayPriceForLicense($license),
                'activated_at' => $license->activated_at?->toIso8601String(),
                'expires_at' => $license->expires_at?->toIso8601String(),
                'status' => $license->status,
                'is_scheduled' => (bool) $license->is_scheduled,
                'scheduled_at' => $license->scheduled_at?->toIso8601String(),
                'scheduled_timezone' => $license->scheduled_timezone,
                'scheduled_last_attempt_at' => $license->scheduled_last_attempt_at?->toIso8601String(),
                'scheduled_failed_at' => $license->scheduled_failed_at?->toIso8601String(),
                'scheduled_failure_message' => $license->scheduled_failure_message,
                'paused_at' => $license->paused_at?->toIso8601String(),
                'pause_remaining_minutes' => $license->pause_remaining_minutes !== null ? (int) $license->pause_remaining_minutes : null,
                'pause_reason' => $license->pause_reason,
            ],
        ], 201);
    }

    public function show(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);

        return response()->json([
            'data' => $this->serializeLicense($resolved),
        ]);
    }

    public function renew(Request $request, License $license): JsonResponse
    {
        $validated = $request->validate([
            'duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
        ]);

        $resolved = $this->resolveAccessibleLicense($request, $license);
        $renewed = $this->licenseService->renew($resolved, $validated);
        $this->invalidateLicenseCachesSafely($renewed);

        return response()->json([
            'message' => 'License renewed successfully.',
            'data' => $this->serializeLicense($renewed),
        ]);
    }

    public function deactivate(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);
        $deactivated = $this->licenseService->deactivate($resolved);
        $this->invalidateLicenseCachesSafely($deactivated);

        return response()->json([
            'message' => 'License deactivated successfully.',
            'data' => $this->serializeLicense($deactivated),
        ]);
    }

    public function destroy(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);
        if (! $this->canDeleteLicense($resolved)) {
            return response()->json([
                'message' => 'Only expired or cancelled licenses can be deleted.',
            ], 422);
        }

        $this->invalidateLicenseCachesSafely($resolved);
        $resolved->delete();

        return response()->json([
            'message' => 'License deleted successfully.',
        ]);
    }

    public function pause(Request $request, License $license): JsonResponse
    {
        $validated = $request->validate([
            'pause_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $resolved = $this->resolveAccessibleLicense($request, $license);
        $paused = $this->licenseService->pause($resolved, $validated);
        $this->invalidateLicenseCachesSafely($paused);

        return response()->json([
            'message' => 'License paused successfully.',
            'data' => $this->serializeLicense($paused),
        ]);
    }

    public function resume(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);
        $resumed = $this->licenseService->resume($resolved);
        $this->invalidateLicenseCachesSafely($resumed);

        return response()->json([
            'message' => 'License resumed successfully.',
            'data' => $this->serializeLicense($resumed),
        ]);
    }

    public function cancelPending(Request $request, License $license): JsonResponse
    {
        $resolved  = $this->resolveAccessibleLicense($request, $license);
        $cancelled = $this->licenseService->cancelPending($resolved);
        $this->invalidateLicenseCachesSafely($cancelled);

        return response()->json([
            'message' => 'Pending license cancelled successfully.',
            'data'    => $this->serializeLicense($cancelled),
        ]);
    }

    public function retryScheduled(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);
        $retried = $this->licenseService->retryScheduledActivation($resolved);
        $this->invalidateLicenseCachesSafely($retried);

        return response()->json([
            'message' => 'Scheduled activation retried successfully.',
            'data' => $this->serializeLicense($retried),
        ]);
    }

    public function bulkRenew(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
        ]);

        $ids = collect($validated['ids'])
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'ids' => 'At least one valid license id is required.',
            ]);
        }

        $licenses = $this->accessibleLicenseQuery($request)
            ->whereIn('id', $ids->all())
            ->get();

        foreach ($licenses as $license) {
            $updated = $this->licenseService->renew($license, [
                'duration_days' => (float) $validated['duration_days'],
                'price' => (float) $validated['price'],
            ]);
            LicenseCacheInvalidation::invalidateForLicense($updated);
        }

        return response()->json([
            'message' => 'Selected licenses renewed successfully.',
            'count' => $licenses->count(),
        ]);
    }

    public function bulkDeactivate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
        ]);

        $ids = collect($validated['ids'])
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'ids' => 'At least one valid license id is required.',
            ]);
        }

        $licenses = $this->accessibleLicenseQuery($request)
            ->whereIn('id', $ids->all())
            ->get();

        foreach ($licenses as $license) {
            $updated = $this->licenseService->deactivate($license);
            LicenseCacheInvalidation::invalidateForLicense($updated);
        }

        return response()->json([
            'message' => 'Selected licenses deactivated successfully.',
            'count' => $licenses->count(),
        ]);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
        ]);

        $ids = collect($validated['ids'])
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'ids' => 'At least one valid license id is required.',
            ]);
        }

        $licenses = $this->accessibleLicenseQuery($request)
            ->whereIn('id', $ids->all())
            ->get();

        $deletableLicenses = $licenses->filter(fn (License $license): bool => $this->canDeleteLicense($license));
        $count = $deletableLicenses->count();

        foreach ($deletableLicenses as $license) {
            LicenseCacheInvalidation::invalidateForLicense($license);
            $license->delete();
        }

        return response()->json([
            'message' => $count > 0 ? 'Selected licenses deleted successfully.' : 'No deletable licenses selected.',
            'count' => $count,
        ]);
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_starts_with($email, 'no-email+') && str_ends_with($email, '@obd2sw.local') ? null : $email;
    }

    private function serializeLicense(License $license): array
    {
        $license->loadMissing(['customer:id,name,email', 'program:id,name']);

        return [
            'id' => $license->id,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'customer_email' => $this->visibleEmail($license->customer?->email),
            'bios_id' => $license->bios_id,
            'external_username' => $license->external_username ?: $license->customer?->username,
            'program' => $license->program?->name,
            'program_id' => $license->program_id,
            'duration_days' => $license->duration_days,
            'price' => CustomerOwnership::displayPriceForLicense($license),
            'activated_at' => $license->activated_at?->toIso8601String(),
            'start_at' => ($license->scheduled_at ?? $license->activated_at)?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'scheduled_at' => $license->scheduled_at?->toIso8601String(),
            'scheduled_timezone' => $license->scheduled_timezone,
            'is_scheduled' => (bool) $license->is_scheduled,
            'scheduled_last_attempt_at' => $license->scheduled_last_attempt_at?->toIso8601String(),
            'scheduled_failed_at' => $license->scheduled_failed_at?->toIso8601String(),
            'scheduled_failure_message' => $license->scheduled_failure_message,
            'paused_at' => $license->paused_at?->toIso8601String(),
            'pause_remaining_minutes' => $license->pause_remaining_minutes !== null ? (int) $license->pause_remaining_minutes : null,
            'pause_reason' => $license->pause_reason,
            'paused_by_role' => $license->paused_by_role,
            'status' => $license->status,
        ];
    }

    private function resolveAccessibleLicense(Request $request, License $license): License
    {
        $exists = $this->accessibleLicenseQuery($request)->whereKey($license->id)->exists();
        if (! $exists) {
            abort(404);
        }

        return $license;
    }

    private function canDeleteLicense(License $license): bool
    {
        return in_array($license->effectiveStatus(), ['cancelled', 'expired'], true);
    }

    private function invalidateLicenseCachesSafely(License $license): void
    {
        try {
            LicenseCacheInvalidation::invalidateForLicense($license);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function accessibleLicenseQuery(Request $request)
    {
        /** @var User|null $actor */
        $actor = $request->user();
        if (! $actor) {
            throw ValidationException::withMessages([
                'auth' => 'Authentication is required.',
            ]);
        }

        $role = $actor->role?->value ?? (string) $actor->role;

        if ($role === UserRole::RESELLER->value) {
            return License::query()->where('reseller_id', $actor->id);
        }

        if ($role === UserRole::MANAGER->value) {
            $resellerIds = User::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('role', UserRole::RESELLER->value)
                ->where('created_by', $actor->id)
                ->pluck('id')
                ->all();

            return License::query()->whereIn('reseller_id', [$actor->id, ...$resellerIds]);
        }

        if ($role === UserRole::MANAGER_PARENT->value) {
            return License::query()->where('tenant_id', $actor->tenant_id);
        }

        if ($role === UserRole::SUPER_ADMIN->value) {
            return License::query();
        }

        throw ValidationException::withMessages([
            'auth' => 'You are not allowed to manage licenses.',
        ]);
    }

}
