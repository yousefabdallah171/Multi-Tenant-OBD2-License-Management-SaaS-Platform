<?php

namespace App\Http\Controllers\Manager;

use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LicenseController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sellerIds = $this->teamSellerIds($request);
        $query = License::query()
            ->whereIn('reseller_id', $sellerIds)
            ->with(['customer:id,name,email', 'program:id,name', 'reseller:id,name'])
            ->latest('activated_at');

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
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
        $resolved = $this->resolveTeamLicense($request, $license);
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
        $sellerIds = $this->teamSellerIds($request);
        $baseQuery = License::query()
            ->whereIn('reseller_id', $sellerIds)
            ->where('status', 'active')
            ->where('expires_at', '>=', now());

        $day1 = (clone $baseQuery)->where('expires_at', '<=', now()->addDay())->count();
        $day3 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(3))->count();
        $day7 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(7))->count();

        return response()->json([
            'data' => [
                'day1' => $day1,
                'day3' => $day3,
                'day7' => $day7,
            ],
        ]);
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
            'expires_at' => $license->expires_at?->toIso8601String(),
            'status' => $license->status,
        ];
    }
}
