<?php

namespace App\Http\Controllers\Reseller;

use App\Http\Requests\ActivateLicenseRequest;
use App\Http\Requests\RenewLicenseRequest;
use App\Models\ActivityLog;
use App\Models\License;
use App\Services\LicenseService;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LicenseController extends BaseResellerController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'program_id' => ['nullable', 'integer', 'min:1'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = $this->licenseQuery($request)
            ->with(['customer:id,name,email', 'program:id,name'])
            ->latest('activated_at');

        if (! empty($validated['status'])) {
            if ($validated['status'] === 'scheduled') {
                $query->where('status', 'pending')->where('is_scheduled', true);
            } elseif ($validated['status'] === 'pending') {
                $query->where('status', 'pending')->where(function ($pendingQuery): void {
                    $pendingQuery->where('is_scheduled', false)->orWhereNull('is_scheduled');
                });
            } else {
                $query->whereEffectiveStatus($validated['status']);
            }
        }

        if (! empty($validated['program_id'])) {
            $query->where('program_id', $validated['program_id']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('bios_id', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customer', function ($customerQuery) use ($validated): void {
                        $customerQuery
                            ->where('name', 'like', '%'.$validated['search'].'%')
                            ->orWhere('email', 'like', '%'.$validated['search'].'%');
                    })
                    ->orWhereHas('program', fn ($programQuery) => $programQuery->where('name', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['from'])) {
            $query->whereDate('activated_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('activated_at', '<=', $validated['to']);
        }

        $licenses = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($licenses->items())->map(fn (License $license): array => $this->serializeLicense($license))->values(),
            'meta' => $this->paginationMeta($licenses),
        ]);
    }

    public function show(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $resolved->load(['customer:id,name,email,phone', 'program:id,name,version,download_link']);

        $activity = ActivityLog::query()
            ->where('user_id', $this->currentReseller($request)->id)
            ->where(function ($builder) use ($resolved): void {
                $builder
                    ->where('metadata->license_id', $resolved->id)
                    ->orWhere('metadata->bios_id', $resolved->bios_id);
            })
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeLicense($resolved),
                'customer' => $resolved->customer ? [
                    'id' => $resolved->customer->id,
                    'name' => $resolved->customer->name,
                    'email' => $resolved->customer->email,
                    'phone' => $resolved->customer->phone,
                ] : null,
                'program_version' => $resolved->program?->version,
                'download_link' => $resolved->program?->download_link,
                'activity' => $activity,
            ],
        ]);
    }

    public function activate(ActivateLicenseRequest $request): JsonResponse
    {
        $license = $this->licenseService->activate($request->validated());
        LicenseCacheInvalidation::invalidateForLicense($license);

        return response()->json([
            'message' => 'License activated successfully.',
            'data' => $this->serializeLicense($license),
        ], 201);
    }

    public function renew(Request $request, License $license, RenewLicenseRequest $renewLicenseRequest): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $renewed = $this->licenseService->renew($resolved, $renewLicenseRequest->validated());
        LicenseCacheInvalidation::invalidateForLicense($renewed);

        return response()->json([
            'message' => 'License renewed successfully.',
            'data' => $this->serializeLicense($renewed),
        ]);
    }

    public function deactivate(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $deactivated = $this->licenseService->deactivate($resolved);

        return response()->json([
            'message' => 'License deactivated successfully.',
            'data' => $this->serializeLicense($deactivated),
        ]);
    }

    public function destroy(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        if (! $this->canDeleteLicense($resolved)) {
            return response()->json([
                'message' => 'Only expired or cancelled licenses can be deleted.',
            ], 422);
        }

        LicenseCacheInvalidation::invalidateForLicense($resolved);
        $resolved->delete();

        return response()->json([
            'message' => 'License deleted successfully.',
        ]);
    }

    public function cancelPending(Request $request, License $license): JsonResponse
    {
        $resolved   = $this->resolveLicense($request, $license);
        $cancelled  = $this->licenseService->cancelPending($resolved);

        return response()->json([
            'message' => 'Pending license cancelled successfully.',
            'data'    => $this->serializeLicense($cancelled),
        ]);
    }

    public function pause(Request $request, License $license): JsonResponse
    {
        $validated = $request->validate([
            'pause_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $resolved = $this->resolveLicense($request, $license);
        $paused = $this->licenseService->pause($resolved, $validated);
        LicenseCacheInvalidation::invalidateForLicense($paused);

        return response()->json([
            'message' => 'License paused successfully.',
            'data' => $this->serializeLicense($paused),
        ]);
    }

    public function resume(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);

        if (\Illuminate\Support\Facades\Schema::hasColumn('licenses', 'paused_by_role')
            && $resolved->paused_by_role !== null
            && $resolved->paused_by_role !== 'reseller') {
            return response()->json([
                'message' => 'This license was paused by a higher role and cannot be resumed by you.',
            ], 403);
        }

        $resumed = $this->licenseService->resume($resolved);
        LicenseCacheInvalidation::invalidateForLicense($resumed);

        return response()->json([
            'message' => 'License resumed successfully.',
            'data' => $this->serializeLicense($resumed),
        ]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $days = (int) ($validated['days'] ?? 7);
        $licenses = $this->licenseQuery($request)
            ->with(['customer:id,name,email', 'program:id,name'])
            ->whereEffectivelyActive()
            ->whereBetween('expires_at', [now(), now()->addDays($days)])
            ->orderBy('expires_at')
            ->get();

        $expired = $this->licenseQuery($request)
            ->whereEffectivelyExpired()
            ->count();

        return response()->json([
            'data' => $licenses->map(fn (License $license): array => $this->serializeLicense($license))->values(),
            'summary' => [
                'day1' => $licenses->filter(fn (License $license): bool => $license->expires_at !== null && $license->expires_at->lte(now()->copy()->addDay()))->count(),
                'day3' => $licenses->filter(fn (License $license): bool => $license->expires_at !== null && $license->expires_at->lte(now()->copy()->addDays(3)))->count(),
                'day7' => $licenses->count(),
                'expired' => $expired,
            ],
        ]);
    }

    public function bulkRenew(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $licenses = $this->licenseQuery($request)->whereIn('id', $validated['ids'])->get();

        foreach ($licenses as $license) {
            $updated = $this->licenseService->renew($license, [
                'duration_days' => (int) $validated['duration_days'],
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
            'ids.*' => ['integer'],
        ]);

        $licenses = $this->licenseQuery($request)->whereIn('id', $validated['ids'])->get();

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
            'ids.*' => ['integer'],
        ]);

        $licenses = $this->licenseQuery($request)
            ->whereIn('id', $validated['ids'])
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

    private function canDeleteLicense(License $license): bool
    {
        return in_array($license->effectiveStatus(), ['cancelled', 'expired'], true);
    }

    private function serializeLicense(License $license): array
    {
        $license->loadMissing(['customer:id,name,email', 'program:id,name']);

        return [
            'id' => $license->id,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'customer_email' => $license->customer?->email,
            'bios_id' => $license->bios_id,
            'external_username' => $license->external_username ?: $license->customer?->username,
            'program' => $license->program?->name,
            'program_id' => $license->program_id,
            'duration_days' => $license->duration_days,
            'price' => (float) $license->price,
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
            'status' => $license->effectiveStatus(),
        ];
    }
}
