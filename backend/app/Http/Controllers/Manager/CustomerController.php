<?php

namespace App\Http\Controllers\Manager;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,expired,suspended,pending'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $resellerIds = $this->teamResellerIds($request);

        $query = $this->teamCustomersQuery($request)
            ->select(['id', 'tenant_id', 'name', 'email', 'phone', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $resellerIds)
                ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'status', 'price', 'activated_at', 'expires_at'])
                ->with(['program:id,name', 'reseller:id,name'])])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated, $resellerIds): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->whereIn('reseller_id', $resellerIds)
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['reseller_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $resellerIds)
                ->where('reseller_id', $validated['reseller_id']));
        }

        if (! empty($validated['program_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $resellerIds)
                ->where('program_id', $validated['program_id']));
        }

        if (! empty($validated['status'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $resellerIds)
                ->where('status', $validated['status']));
        }

        $customers = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($customers->items())->map(fn (User $user): array => $this->serializeCustomer($user))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);
        $resellerIds = $this->teamResellerIds($request);

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->whereIn('reseller_id', $resellerIds)
            ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'status', 'price', 'activated_at', 'expires_at'])
            ->with(['program:id,name', 'reseller:id,name'])]);

        return response()->json([
            'data' => [
                ...$this->serializeCustomer($customer),
                'licenses' => $customer->customerLicenses->map(fn ($license): array => [
                    'id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'program' => $license->program?->name,
                    'reseller' => $license->reseller?->name,
                    'status' => $license->status,
                    'price' => (float) $license->price,
                    'activated_at' => $license->activated_at?->toIso8601String(),
                    'expires_at' => $license->expires_at?->toIso8601String(),
                ])->values(),
            ],
        ]);
    }

    private function serializeCustomer(User $user): array
    {
        $license = $user->customerLicenses->sortByDesc('activated_at')->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'reseller' => $license?->reseller?->name,
            'reseller_id' => $license?->reseller?->id,
            'program' => $license?->program?->name,
            'status' => $license?->status,
            'expiry' => $license?->expires_at?->toIso8601String(),
            'license_count' => $user->customerLicenses->count(),
        ];
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_ends_with($email, '@obd2sw.local') ? null : $email;
    }
}
