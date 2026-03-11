<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LicenseController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'reseller_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->with(['customer:id,name,email', 'program:id,name', 'reseller:id,name'])
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

        if (! empty($validated['reseller_id'])) {
            $query->where('reseller_id', $validated['reseller_id']);
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

        $licenses = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($licenses->items())->map(fn (License $license): array => $this->serializeLicense($license))->values(),
            'meta' => $this->paginationMeta($licenses),
        ]);
    }

    public function show(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveTenantLicense($request, $license);
        $resolved->load(['customer:id,name,email,phone', 'program:id,name,version,download_link']);

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
            ],
        ]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $baseQuery = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereEffectivelyActive()
            ->where('expires_at', '>=', now());

        $day1 = (clone $baseQuery)->where('expires_at', '<=', now()->addDay())->count();
        $day3 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(3))->count();
        $day7 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(7))->count();
        $expired = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereEffectivelyExpired()
            ->count();

        return response()->json([
            'data' => [
                'day1' => $day1,
                'day3' => $day3,
                'day7' => $day7,
                'expired' => $expired,
            ],
        ]);
    }

    public function destroy(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveTenantLicense($request, $license);

        if ($resolved->isEffectivelyActive()) {
            return response()->json([
                'message' => 'Cannot delete an active license. Deactivate it first.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $licenseId = $resolved->id;
        $biosId = $resolved->bios_id;
        $customerId = $resolved->customer_id;
        $programId = $resolved->program_id;

        LicenseCacheInvalidation::invalidateForLicense($resolved);
        $resolved->delete();

        $this->logActivity(
            $request,
            'license.delete',
            sprintf('Deleted license #%d for BIOS %s.', $licenseId, $biosId),
            [
                'license_id' => $licenseId,
                'customer_id' => $customerId,
                'program_id' => $programId,
                'bios_id' => $biosId,
            ],
        );

        return response()->json([
            'message' => 'License deleted successfully.',
        ]);
    }

    private function resolveTenantLicense(Request $request, License $license): License
    {
        abort_unless((int) $license->tenant_id === $this->currentTenantId($request), 404);

        return $license;
    }

    private function serializeLicense(License $license): array
    {
        $license->loadMissing(['customer:id,name,email', 'program:id,name', 'reseller:id,name']);

        return [
            'id' => $license->id,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'customer_email' => $license->customer?->email,
            'bios_id' => $license->bios_id,
            'external_username' => $license->external_username ?: $license->customer?->username,
            'program' => $license->program?->name,
            'program_id' => $license->program_id,
            'reseller_id' => $license->reseller_id,
            'reseller_name' => $license->reseller?->name,
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
            'status' => $license->effectiveStatus(),
        ];
    }
}
