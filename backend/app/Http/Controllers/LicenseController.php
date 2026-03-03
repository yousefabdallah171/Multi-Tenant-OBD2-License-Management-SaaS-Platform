<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\LicenseService;
use Illuminate\Validation\ValidationException;

class LicenseController extends Controller
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function activateLicense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'program_id' => ['required', 'integer'],
            'customer_name' => ['required', 'string', 'max:5000'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9]+$/'],
            'bios_id' => ['required', 'string', 'max:255'],
            'duration_days' => ['required', 'numeric', 'min:0.001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $license = $this->licenseService->activate($validated);
        $licenseKey = Str::upper('LIC-'.$license->id.'-'.Str::random(8));

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
                'price' => (float) $license->price,
                'activated_at' => $license->activated_at?->toIso8601String(),
                'expires_at' => $license->expires_at?->toIso8601String(),
                'status' => $license->status,
                'is_scheduled' => (bool) $license->is_scheduled,
                'scheduled_at' => $license->scheduled_at?->toIso8601String(),
                'scheduled_timezone' => $license->scheduled_timezone,
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
            'duration_days' => ['required', 'numeric', 'min:0.001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $resolved = $this->resolveAccessibleLicense($request, $license);
        $renewed = $this->licenseService->renew($resolved, $validated);

        return response()->json([
            'message' => 'License renewed successfully.',
            'data' => $this->serializeLicense($renewed),
        ]);
    }

    public function deactivate(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveAccessibleLicense($request, $license);
        $deactivated = $this->licenseService->deactivate($resolved);

        return response()->json([
            'message' => 'License deactivated successfully.',
            'data' => $this->serializeLicense($deactivated),
        ]);
    }

    public function bulkRenew(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'duration_days' => ['required', 'numeric', 'min:0.001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
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
            $this->licenseService->renew($license, [
                'duration_days' => (float) $validated['duration_days'],
                'price' => (float) $validated['price'],
            ]);
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
            $this->licenseService->deactivate($license);
        }

        return response()->json([
            'message' => 'Selected licenses deactivated successfully.',
            'count' => $licenses->count(),
        ]);
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_ends_with($email, '@obd2sw.local') ? null : $email;
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
            'price' => (float) $license->price,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'scheduled_at' => $license->scheduled_at?->toIso8601String(),
            'scheduled_timezone' => $license->scheduled_timezone,
            'is_scheduled' => (bool) $license->is_scheduled,
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

        throw ValidationException::withMessages([
            'auth' => 'You are not allowed to manage licenses.',
        ]);
    }

}
