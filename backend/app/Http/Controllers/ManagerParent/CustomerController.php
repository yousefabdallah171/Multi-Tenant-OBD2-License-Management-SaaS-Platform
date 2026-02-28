<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends BaseManagerParentController
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

        $query = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::CUSTOMER->value)
            ->with(['customerLicenses.program:id,name', 'customerLicenses.reseller:id,name'])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['reseller_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('reseller_id', $validated['reseller_id']));
        }

        if (! empty($validated['program_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('program_id', $validated['program_id']));
        }

        if (! empty($validated['status'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('status', $validated['status']));
        }

        $customers = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($customers->items())->map(fn (User $user): array => $this->serializeCustomer($user))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTenantUser($request, $user);
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $user->load(['customerLicenses.program:id,name', 'customerLicenses.reseller:id,name']);

        return response()->json([
            'data' => [
                ...$this->serializeCustomer($user),
                'licenses' => $user->customerLicenses->map(fn ($license): array => [
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
            'email' => $user->email,
            'bios_id' => $license?->bios_id,
            'reseller' => $license?->reseller?->name,
            'program' => $license?->program?->name,
            'status' => $license?->status,
            'expiry' => $license?->expires_at?->toIso8601String(),
            'license_count' => $user->customerLicenses->count(),
        ];
    }
}
