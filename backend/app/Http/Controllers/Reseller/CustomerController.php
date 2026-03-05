<?php

namespace App\Http\Controllers\Reseller;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'program_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $resellerId = $this->currentReseller($request)->id;

        $query = $this->customerQuery($request)
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->where('reseller_id', $resellerId)
                ->with(['program:id,name'])
                ->latest('activated_at')])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated, $resellerId): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->where('reseller_id', $resellerId)
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['status'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->where('reseller_id', $resellerId)
                ->where('status', $validated['status']));
        }

        if (! empty($validated['program_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->where('reseller_id', $resellerId)
                ->where('program_id', $validated['program_id']));
        }

        $customers = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($customers->items())->map(fn (User $user): array => $this->serializeCustomer($user))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $customer = User::query()->firstOrNew([
            'tenant_id' => $this->currentTenantId($request),
            'email' => $validated['email'],
        ]);

        if ($customer->exists && ($customer->role?->value ?? (string) $customer->role) !== UserRole::CUSTOMER->value) {
            throw ValidationException::withMessages([
                'email' => 'The provided email belongs to a non-customer account.',
            ]);
        }

        $customer->fill([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $this->currentReseller($request)->id,
        ]);

        if (! $customer->exists) {
            $customer->password = Hash::make(Str::password(16));
        }

        $customer->save();

        $this->logActivity($request, 'customer.created', sprintf('Created customer profile for %s.', $customer->email), [
            'customer_id' => $customer->id,
        ]);

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->where('reseller_id', $this->currentReseller($request)->id)
            ->with(['program:id,name'])
            ->latest('activated_at')]);

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveCustomer($request, $user);

        $validated = $request->validate([
            'client_name' => ['required', 'string', 'min:1', 'max:255'],
        ]);

        $customer->fill([
            'client_name' => $validated['client_name'],
            'name' => $validated['client_name'],
        ])->save();

        $this->logActivity($request, 'customer.updated', sprintf('Updated client name for customer %d.', $customer->id), [
            'customer_id' => $customer->id,
        ]);

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->where('reseller_id', $this->currentReseller($request)->id)
            ->with(['program:id,name'])
            ->latest('activated_at')]);

        return response()->json(['data' => $this->serializeCustomer($customer)]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveCustomer($request, $user);
        $resellerId = $this->currentReseller($request)->id;

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->where('reseller_id', $resellerId)
            ->with(['program:id,name'])
            ->latest('activated_at')]);

        return response()->json([
            'data' => [
                ...$this->serializeCustomer($customer),
                'licenses' => $customer->customerLicenses->map(fn ($license): array => [
                    'id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'program' => $license->program?->name,
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
            'client_name' => $user->client_name,
            'username' => $user->username,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'external_username' => $license?->external_username,
            'program' => $license?->program?->name,
            'program_id' => $license?->program_id,
            'status' => $license?->status ?? 'pending',
            'price' => $license ? (float) $license->price : 0,
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
