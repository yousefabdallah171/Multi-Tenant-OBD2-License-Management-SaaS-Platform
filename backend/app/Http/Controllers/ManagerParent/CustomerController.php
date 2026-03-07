<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\UserIpLog;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerController extends BaseManagerParentController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::CUSTOMER->value)
            ->select(['id', 'tenant_id', 'name', 'email', 'phone', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'status', 'activated_at', 'expires_at', 'price', 'scheduled_at', 'scheduled_timezone', 'scheduled_last_attempt_at', 'scheduled_failed_at', 'scheduled_failure_message', 'is_scheduled', 'paused_at', 'pause_remaining_minutes'])
                ->with(['program:id,name', 'reseller:id,name'])])
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
            $query->whereHas('customerLicenses', function ($licenseQuery) use ($validated): void {
                if ($validated['status'] === 'scheduled') {
                    $licenseQuery->where('status', 'pending')->where('is_scheduled', true);
                    return;
                }

                if ($validated['status'] === 'pending') {
                    $licenseQuery->where('status', 'pending')->where(function ($pendingQuery): void {
                        $pendingQuery->where('is_scheduled', false)->orWhereNull('is_scheduled');
                    });
                    return;
                }

                $licenseQuery->where('status', $validated['status']);
            });
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

        $user->load([
            'customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'external_username', 'status', 'duration_days', 'price', 'activated_at', 'expires_at', 'scheduled_at', 'scheduled_timezone', 'scheduled_last_attempt_at', 'scheduled_failed_at', 'scheduled_failure_message', 'is_scheduled', 'paused_at', 'pause_remaining_minutes'])
                ->with(['program:id,name', 'reseller:id,name,email']),
            'createdBy:id,name,email',
        ]);

        $resellersSummary = $user->customerLicenses
            ->groupBy('reseller_id')
            ->map(function ($licenses) {
                $latest = $licenses->sortByDesc('activated_at')->first();

                return [
                    'reseller_id' => $latest?->reseller_id,
                    'reseller_name' => $latest?->reseller?->name,
                    'reseller_email' => $latest?->reseller?->email,
                    'activations_count' => $licenses->count(),
                    'last_activation_at' => $latest?->activated_at?->toIso8601String(),
                ];
            })
            ->values();

        $ipLogs = UserIpLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'ip_address', 'country', 'city', 'isp', 'reputation_score', 'action', 'created_at'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('user_id', $user->id)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (UserIpLog $log): array => [
                'id' => $log->id,
                'ip_address' => $log->ip_address,
                'country' => $log->country,
                'city' => $log->city,
                'isp' => $log->isp,
                'reputation_score' => $log->reputation_score,
                'action' => $log->action,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        $activity = ActivityLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'action', 'description', 'metadata', 'ip_address', 'created_at'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where(function ($query) use ($user): void {
                $query->where('user_id', $user->id)->orWhere('metadata->customer_id', $user->id);
            })
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (ActivityLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'metadata' => $log->metadata ?? [],
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeCustomer($user),
                'username' => $user->username,
                'phone' => $user->phone,
                'created_by' => $user->createdBy ? [
                    'id' => $user->createdBy->id,
                    'name' => $user->createdBy->name,
                    'email' => $user->createdBy->email,
                ] : null,
                'created_at' => $user->created_at?->toIso8601String(),
                'licenses' => $user->customerLicenses->map(fn ($license): array => [
                    'id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'program' => $license->program?->name,
                    'reseller' => $license->reseller?->name,
                    'reseller_id' => $license->reseller_id,
                    'reseller_email' => $license->reseller?->email,
                    'status' => $license->status,
                    'duration_days' => (float) $license->duration_days,
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
                ])->values(),
                'resellers_summary' => $resellersSummary,
                'ip_logs' => $ipLogs,
                'activity' => $activity,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'bios_id' => ['nullable', 'string', 'min:3', 'max:255', 'required_with:program_id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id', 'required_with:bios_id'],
        ]);

        $username = Str::of((string) $validated['name'])->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();
        $username = $username !== '' ? $username : 'customer_'.Str::lower(Str::random(6));
        $email = isset($validated['email']) && is_string($validated['email']) && trim($validated['email']) !== ''
            ? strtolower(trim($validated['email']))
            : sprintf('no-email+tenant%s-%s@obd2sw.local', (string) $this->currentTenantId($request), $username);

        $customer = User::query()
            ->where(function ($query) use ($email, $username): void {
                $query->where('email', $email)->orWhere('username', $username);
            })
            ->first();

        if ($customer && ($customer->tenant_id !== $this->currentTenantId($request))) {
            throw ValidationException::withMessages([
                'email' => 'The provided email or username is already used by another tenant.',
            ]);
        }

        if (! $customer) {
            $customer = new User();
        }

        if ($customer->exists && ($customer->role?->value ?? (string) $customer->role) !== UserRole::CUSTOMER->value) {
            throw ValidationException::withMessages([
                'email' => 'The provided email belongs to a non-customer account.',
            ]);
        }

        $clientName = trim((string) ($validated['client_name'] ?? ''));
        $displayName = $clientName !== '' ? $clientName : $validated['name'];

        $customer->fill([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $displayName,
            'client_name' => $clientName !== '' ? $clientName : null,
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $this->currentManagerParent($request)->id,
            'username' => $customer->username_locked ? $customer->username : $username,
            'username_locked' => true,
        ]);

        if (! $customer->exists) {
            $customer->password = Hash::make(Str::password(16));
        }

        $customer->save();

        if (! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $this->createPendingLicense(
                $request,
                $customer,
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $this->currentManagerParent($request),
            );
        }

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->with(['program:id,name', 'reseller:id,name'])]);

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

        $validated = $request->validate([
            'client_name' => ['required', 'string', 'min:1', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
        ]);

        $email = $this->resolveCustomerEmail($customer, $validated['email'] ?? null, $this->currentTenantId($request));
        $this->ensureEmailAvailable($customer, $email);

        $customer->fill([
            'client_name' => $validated['client_name'],
            'name' => $validated['client_name'],
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
        ])->save();

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->with(['program:id,name', 'reseller:id,name'])]);

        $this->logActivity($request, 'customer.updated', sprintf('Updated customer %d.', $customer->id), [
            'customer_id' => $customer->id,
        ]);

        return response()->json(['data' => $this->serializeCustomer($customer)]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

        $licenses = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->get();

        $customerName = $customer->name;
        $customerId = $customer->id;
        $licensesCount = $licenses->count();

        foreach ($licenses as $license) {
            if ($license->status === 'active') {
                $this->licenseService->deactivate($license);
            }
            $license->delete();
        }

        $customer->delete();

        $this->logActivity(
            $request,
            'customer.delete',
            sprintf('Deleted customer %s.', $customerName),
            [
                'customer_id' => $customerId,
                'licenses_deleted' => $licensesCount,
            ],
        );

        return response()->json([
            'message' => 'Customer deleted successfully.',
        ]);
    }

    private function createPendingLicense(Request $request, User $customer, string $biosId, int $programId, User $seller): void
    {
        $program = Program::query()
            ->whereKey($programId)
            ->where('status', 'active')
            ->first();

        if (! $program) {
            throw ValidationException::withMessages([
                'program_id' => 'The selected program is not active.',
            ]);
        }

        $normalizedBiosId = trim($biosId);
        if ($normalizedBiosId === '') {
            throw ValidationException::withMessages([
                'bios_id' => 'The BIOS ID field is required.',
            ]);
        }

        $existingLicense = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('reseller_id', $seller->id)
            ->where('program_id', $program->id)
            ->where('bios_id', $normalizedBiosId)
            ->whereIn('status', ['active', 'pending', 'suspended'])
            ->first();

        if ($existingLicense) {
            throw ValidationException::withMessages([
                'bios_id' => 'A license already exists for this BIOS ID and program.',
            ]);
        }

        License::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'customer_id' => $customer->id,
            'reseller_id' => $seller->id,
            'program_id' => $program->id,
            'bios_id' => $normalizedBiosId,
            'external_username' => $customer->username,
            'external_activation_response' => 'Pending activation.',
            'duration_days' => 0,
            'price' => 0,
            'activated_at' => now(),
            'expires_at' => now(),
            'status' => 'pending',
            'is_scheduled' => false,
        ]);
    }

    private function serializeCustomer(User $user): array
    {
        $license = $user->customerLicenses->sortByDesc('activated_at')->first();
        $hasActiveLicense = $user->customerLicenses->contains(
            fn ($item) => ($item->status ?? null) === 'active'
        );

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'reseller' => $license?->reseller?->name,
            'program' => $license?->program?->name,
            'status' => $license?->status,
            'activated_at' => $license?->activated_at?->toIso8601String(),
            'start_at' => ($license?->scheduled_at ?? $license?->activated_at)?->toIso8601String(),
            'expiry' => $license?->expires_at?->toIso8601String(),
            'scheduled_at' => $license?->scheduled_at?->toIso8601String(),
            'scheduled_timezone' => $license?->scheduled_timezone,
            'is_scheduled' => (bool) ($license?->is_scheduled ?? false),
            'scheduled_last_attempt_at' => $license?->scheduled_last_attempt_at?->toIso8601String(),
            'scheduled_failed_at' => $license?->scheduled_failed_at?->toIso8601String(),
            'scheduled_failure_message' => $license?->scheduled_failure_message,
            'paused_at' => $license?->paused_at?->toIso8601String(),
            'pause_remaining_minutes' => $license?->pause_remaining_minutes !== null ? (int) $license->pause_remaining_minutes : null,
            'license_count' => $user->customerLicenses->count(),
            'has_active_license' => $hasActiveLicense,
        ];
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_ends_with($email, '@obd2sw.local') ? null : $email;
    }

    private function resolveCustomerEmail(User $customer, ?string $email, int $tenantId): string
    {
        $normalized = is_string($email) ? strtolower(trim($email)) : '';
        if ($normalized !== '') {
            return $normalized;
        }

        $currentEmail = (string) ($customer->email ?? '');
        if ($currentEmail !== '' && str_ends_with($currentEmail, '@obd2sw.local')) {
            return $currentEmail;
        }

        return sprintf('no-email+tenant%s-%s@obd2sw.local', (string) $tenantId, (string) ($customer->username ?: 'customer-'.$customer->id));
    }

    private function ensureEmailAvailable(User $customer, string $email): void
    {
        if ($customer->email === $email) {
            return;
        }

        $existing = User::query()
            ->where('email', $email)
            ->whereKeyNot($customer->id)
            ->first();

        if (! $existing) {
            return;
        }

        if (($existing->role?->value ?? (string) $existing->role) !== UserRole::CUSTOMER->value) {
            throw ValidationException::withMessages([
                'email' => 'The provided email belongs to a non-customer account.',
            ]);
        }

        throw ValidationException::withMessages([
            'email' => 'The provided email is already in use.',
        ]);
    }
}
