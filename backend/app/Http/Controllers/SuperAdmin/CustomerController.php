<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Models\UserIpLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'reseller_id' => ['nullable', 'integer', 'exists:users,id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()
            ->with('tenant')
            ->where('role', UserRole::CUSTOMER->value)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name'])])
            ->latest();

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', (int) $validated['tenant_id']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
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
            if ($validated['status'] === 'pending') {
                $query->where(function ($statusQuery): void {
                    $statusQuery
                        ->whereDoesntHave('customerLicenses')
                        ->orWhereHas('customerLicenses', function ($licenseQuery): void {
                            $licenseQuery->where('status', 'pending')->where(function ($pendingQuery): void {
                                $pendingQuery->where('is_scheduled', false)->orWhereNull('is_scheduled');
                            });
                        });
                });
            } else {
                $query->whereHas('customerLicenses', function ($licenseQuery) use ($validated): void {
                    if ($validated['status'] === 'scheduled') {
                        $licenseQuery->where('status', 'pending')->where('is_scheduled', true);
                        return;
                    }

                    $licenseQuery->whereEffectiveStatus($validated['status']);
                });
            }
        }

        $customers = $query->paginate((int) ($validated['per_page'] ?? 25));

        return response()->json([
            'data' => collect($customers->items())->map(fn (User $user): array => $this->serializeCustomer($user, $validated))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function show(User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $user->load([
            'tenant:id,name,slug,status',
            'customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseDetailColumns())
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

        $userIpLogColumns = $this->userIpLogColumns();

        $ipLogs = UserIpLog::query()
            ->select($userIpLogColumns)
            ->where('user_id', $user->id)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (UserIpLog $log): array => [
                'id' => $log->id,
                'ip_address' => $log->ip_address,
                'country' => $log->country,
                'country_code' => $this->columnExists($userIpLogColumns, 'country_code') ? $log->country_code : null,
                'city' => $this->columnExists($userIpLogColumns, 'city') ? $log->city : null,
                'isp' => $this->columnExists($userIpLogColumns, 'isp') ? $log->isp : null,
                'reputation_score' => $this->columnExists($userIpLogColumns, 'reputation_score') ? (string) $log->reputation_score : null,
                'action' => $this->columnExists($userIpLogColumns, 'action') ? $log->action : null,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        $activity = ActivityLog::query()
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
                'username' => $this->resolveCustomerUsername($user, $user->customerLicenses->sortByDesc('activated_at')->first()),
                'phone' => $user->phone,
                'tenant' => $user->tenant ? [
                    'id' => $user->tenant->id,
                    'name' => $user->tenant->name,
                    'slug' => $user->tenant->slug,
                    'status' => $user->tenant->status,
                ] : null,
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
                    'status' => $license->effectiveStatus(),
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
                    'pause_reason' => $license->pause_reason,
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
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'seller_id' => ['nullable', 'integer', 'exists:users,id', 'required_with:bios_id,program_id'],
            'bios_id' => ['nullable', 'string', 'min:3', 'max:255', 'required_with:program_id,seller_id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id', 'required_with:bios_id,seller_id'],
        ]);

        $username = Str::of((string) $validated['name'])->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();
        $username = $username !== '' ? $username : 'customer_'.Str::lower(Str::random(6));
        $email = isset($validated['email']) && is_string($validated['email']) && trim($validated['email']) !== ''
            ? strtolower(trim($validated['email']))
            : sprintf('no-email+tenant%s-%s@obd2sw.local', (string) $validated['tenant_id'], $username);

        $seller = null;
        if (! empty($validated['seller_id']) && ! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $seller = $this->resolvePendingLicenseSeller((int) $validated['seller_id'], (int) $validated['tenant_id']);
            $this->assertPendingLicenseCanBeCreated(
                (int) $validated['tenant_id'],
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $seller,
            );
        }

        $customer = User::query()
            ->where(function ($query) use ($email, $username): void {
                $query->where('email', $email)->orWhere('username', $username);
            })
            ->first();

        if ($customer && ((int) $customer->tenant_id !== (int) $validated['tenant_id'])) {
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
            'tenant_id' => (int) $validated['tenant_id'],
            'name' => $displayName,
            'client_name' => $clientName !== '' ? $clientName : null,
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $request->user()?->id,
            'username' => $customer->username_locked ? $customer->username : $username,
            'username_locked' => true,
        ]);

        if (! $customer->exists) {
            $customer->password = Hash::make(Str::password(16));
        }

        $customer->save();

        if ($seller && ! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $this->createPendingLicense(
                $customer,
                (int) $validated['tenant_id'],
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $seller,
            );
        }

        $customer->load(['tenant', 'customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->select($this->licenseListColumns())
            ->with(['program:id,name', 'reseller:id,name'])]);

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $validated = $request->validate([
            'client_name' => ['required', 'string', 'min:1', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
        ]);

        $email = $this->resolveCustomerEmail($user, $validated['email'] ?? null, (int) $user->tenant_id);
        $this->ensureEmailAvailable($user, $email);

        $user->fill([
            'client_name' => $validated['client_name'],
            'name' => $validated['client_name'],
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
        ])->save();

        $user->load(['tenant', 'customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->select($this->licenseListColumns())
            ->with(['program:id,name', 'reseller:id,name'])]);

        return response()->json(['data' => $this->serializeCustomer($user)]);
    }

    public function destroy(User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $licenses = License::query()->where('customer_id', $user->id)->get();

        foreach ($licenses as $license) {
            $license->delete();
        }

        $user->delete();

        return response()->json([
            'message' => 'Customer deleted successfully.',
        ]);
    }

    /**
     * @return list<string>
     */
    private function licenseListColumns(): array
    {
        return [
            'id',
            'tenant_id',
            'customer_id',
            'reseller_id',
            'program_id',
            'bios_id',
            'status',
            'activated_at',
            'expires_at',
            'price',
            'scheduled_at',
            'scheduled_timezone',
            'scheduled_last_attempt_at',
            'scheduled_failed_at',
            'scheduled_failure_message',
            'is_scheduled',
            'paused_at',
            'pause_remaining_minutes',
            'pause_reason',
            'external_username',
        ];
    }

    /**
     * @return list<string>
     */
    private function licenseDetailColumns(): array
    {
        return [
            'id',
            'tenant_id',
            'customer_id',
            'reseller_id',
            'program_id',
            'bios_id',
            'external_username',
            'status',
            'duration_days',
            'price',
            'activated_at',
            'expires_at',
            'scheduled_at',
            'scheduled_timezone',
            'scheduled_last_attempt_at',
            'scheduled_failed_at',
            'scheduled_failure_message',
            'is_scheduled',
            'paused_at',
            'pause_remaining_minutes',
            'pause_reason',
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function serializeCustomer(User $user, array $filters = []): array
    {
        $license = $this->resolveDisplayLicense($user, $filters);
        $hasActiveLicense = $user->customerLicenses->contains(
            fn ($item) => $item->isEffectivelyActive()
        );
        $resolvedUsername = $this->resolveCustomerUsername($user, $license);

        return [
            'id' => $user->id,
            'tenant' => $user->tenant ? [
                'id' => $user->tenant->id,
                'name' => $user->tenant->name,
                'slug' => $user->tenant->slug,
                'status' => $user->tenant->status,
            ] : null,
            'name' => $user->name,
            'client_name' => $user->client_name,
            'username' => $resolvedUsername,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'external_username' => $license?->external_username,
            'reseller' => $license?->reseller?->name,
            'reseller_id' => $license?->reseller_id,
            'program' => $license?->program?->name,
            'status' => $license?->effectiveStatus() ?? 'pending',
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
            'pause_reason' => $license?->pause_reason,
            'license_count' => $user->customerLicenses->count(),
            'has_active_license' => $hasActiveLicense,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function resolveDisplayLicense(User $user, array $filters = []): ?License
    {
        $licenses = $user->customerLicenses->sortByDesc(
            fn (License $license) => ($license->scheduled_at ?? $license->activated_at ?? $license->expires_at)?->getTimestamp() ?? 0
        );

        $filtered = $licenses->filter(fn (License $license): bool => $this->licenseMatchesDisplayFilters($license, $filters));

        return $filtered->first() ?? $licenses->first();
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function licenseMatchesDisplayFilters(License $license, array $filters): bool
    {
        $tenantId = isset($filters['tenant_id']) ? (int) $filters['tenant_id'] : null;
        if ($tenantId) {
            if ((int) $license->tenant_id !== $tenantId) {
                return false;
            }
        }

        $resellerId = isset($filters['reseller_id']) ? (int) $filters['reseller_id'] : null;
        if ($resellerId) {
            if ((int) $license->reseller_id !== $resellerId) {
                return false;
            }
        }

        $programId = isset($filters['program_id']) ? (int) $filters['program_id'] : null;
        if ($programId) {
            if ((int) $license->program_id !== $programId) {
                return false;
            }
        }

        $status = isset($filters['status']) && is_string($filters['status']) ? $filters['status'] : '';
        if ($status === '' || $status === 'all') {
            return true;
        }

        if ($status === 'scheduled') {
            return $license->status === 'pending' && (bool) $license->is_scheduled;
        }

        if ($status === 'pending') {
            return $license->status === 'pending' && ! (bool) $license->is_scheduled;
        }

        return $license->effectiveStatus() === $status;
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_ends_with($email, '@obd2sw.local') ? null : $email;
    }

    private function resolveCustomerUsername(User $user, ?License $license): ?string
    {
        $externalUsername = is_string($license?->external_username) ? trim((string) $license->external_username) : '';
        $storedUsername = is_string($user->username) ? trim((string) $user->username) : '';
        $displayName = trim((string) ($user->client_name ?: $user->name ?: ''));

        if ($externalUsername !== '') {
            $normalizedExternal = mb_strtolower($externalUsername);
            $normalizedDisplay = $displayName !== '' ? mb_strtolower($displayName) : '';

            if ($storedUsername !== '' && $normalizedExternal === $normalizedDisplay) {
                return $storedUsername;
            }

            return $externalUsername;
        }

        return $storedUsername !== '' ? $storedUsername : null;
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

    /**
     * @return list<string>
     */
    private function userIpLogColumns(): array
    {
        $columns = ['id', 'tenant_id', 'user_id', 'ip_address', 'country', 'created_at'];

        foreach (['country_code', 'city', 'isp', 'reputation_score', 'action'] as $column) {
            if (Schema::hasColumn('user_ip_logs', $column)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    /**
     * @param list<string> $columns
     */
    private function columnExists(array $columns, string $column): bool
    {
        return in_array($column, $columns, true);
    }

    private function resolvePendingLicenseSeller(int $sellerId, int $tenantId): User
    {
        $seller = User::query()->findOrFail($sellerId);
        $sellerRole = $seller->role?->value ?? (string) $seller->role;

        if (! in_array($sellerRole, [UserRole::RESELLER->value, UserRole::MANAGER->value, UserRole::MANAGER_PARENT->value], true)) {
            throw ValidationException::withMessages([
                'seller_id' => 'The selected seller is not allowed to activate licenses.',
            ]);
        }

        if ((int) $seller->tenant_id !== $tenantId) {
            throw ValidationException::withMessages([
                'seller_id' => 'The selected seller does not belong to the chosen tenant.',
            ]);
        }

        return $seller;
    }

    private function createPendingLicense(User $customer, int $tenantId, string $biosId, int $programId, User $seller): void
    {
        $program = $this->assertPendingLicenseCanBeCreated($tenantId, $biosId, $programId, $seller);
        $normalizedBiosId = trim($biosId);

        License::query()->create([
            'tenant_id' => $tenantId,
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

    private function assertPendingLicenseCanBeCreated(int $tenantId, string $biosId, int $programId, User $seller): Program
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

        if (BiosBlacklist::blocksBios($normalizedBiosId, $tenantId)) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID is blacklisted.',
            ]);
        }

        $existingLicense = License::query()
            ->where('tenant_id', $tenantId)
            ->where('bios_id', $normalizedBiosId)
            ->where(function ($query): void {
                $query
                    ->whereEffectivelyActive()
                    ->orWhereIn('status', ['pending', 'suspended']);
            })
            ->first();

        if ($existingLicense) {
            throw ValidationException::withMessages([
                'bios_id' => 'A license already exists for this BIOS ID.',
            ]);
        }

        return $program;
    }
}
