<?php

namespace App\Http\Controllers\Reseller;

use App\Enums\UserRole;
use App\Models\BiosBlacklist;
use App\Models\BiosChangeRequest;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Services\LicenseService;
use App\Support\CustomerOwnership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerController extends BaseResellerController
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
        ]);

        $resellerId = $this->currentReseller($request)->id;

        $query = $this->customerQuery($request)
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->where('reseller_id', $resellerId)
                ->select($this->licenseColumns())
                ->with(['program:id,name'])
                ->latest('activated_at')])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated, $resellerId): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->where('reseller_id', $resellerId)
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        // Apply pagination at database level first
        $perPage = (int) ($validated['per_page'] ?? 25);
        $page = (int) $request->integer('page', 1);

        $allCustomers = $query->get();
        $filtered = $allCustomers->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated));

        // Manual pagination on filtered results
        $total = $filtered->count();
        $items = $filtered->slice(($page - 1) * $perPage, $perPage)->values();
        $lastPage = max(1, (int) ceil($total / $perPage));

        return response()->json([
            'data' => $items->map(fn (User $user): array => $this->serializeCustomer($user, $validated, $resellerId))->values(),
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => $lastPage,
            ],
        ]);
    }

    /**
     * @return list<string>
     */
    private function licenseColumns(): array
    {
        return [
            'id',
            'tenant_id',
            'customer_id',
            'reseller_id',
            'program_id',
            'bios_id',
            'status',
            'duration_days',
            'price',
            'activated_at',
            'expires_at',
            ...$this->optionalScheduledColumns(),
        ];
    }

    /**
     * @return list<string>
     */
    private function optionalScheduledColumns(): array
    {
        $columns = [];

        foreach (['scheduled_at', 'scheduled_timezone', 'scheduled_last_attempt_at', 'scheduled_failed_at', 'scheduled_failure_message', 'is_scheduled', 'paused_at', 'pause_remaining_minutes', 'pause_reason', 'paused_by_role'] as $column) {
            if (Schema::hasColumn('licenses', $column)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    private function supportsScheduledLicenses(): bool
    {
        return Schema::hasColumn('licenses', 'is_scheduled');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:10'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'bios_id' => ['nullable', 'string', 'min:3', 'max:10', 'required_with:program_id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id', 'required_with:bios_id'],
        ]);

        $username = Str::of((string) $validated['name'])->ascii()->replaceMatches('/[^A-Za-z0-9_]+/', '_')->trim('_')->value();
        $username = $username !== '' ? $username : 'customer_'.Str::lower(Str::random(6));
        $email = isset($validated['email']) && is_string($validated['email']) && trim($validated['email']) !== ''
            ? strtolower(trim($validated['email']))
            : sprintf('no-email+tenant%s-%s@obd2sw.local', (string) $this->currentTenantId($request), $username);

        if (! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $this->assertPendingLicenseCanBeCreated(
                $request,
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $this->currentReseller($request),
                $username,
            );
        }

        $customer = User::query()
            ->where(function ($query) use ($email, $username): void {
                $query->where('email', $email)->orWhereRaw('LOWER(username) = ?', [Str::lower($username)]);
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

        $customer->fill([
            'tenant_id' => $this->currentTenantId($request),
            'name' => trim((string) ($validated['client_name'] ?? '')) !== '' ? trim((string) $validated['client_name']) : $validated['name'],
            'client_name' => trim((string) ($validated['client_name'] ?? '')) !== '' ? trim((string) $validated['client_name']) : null,
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $this->currentReseller($request)->id,
            'username' => $customer->username_locked ? $customer->username : $username,
            'username_locked' => true,
        ]);

        if (! $customer->exists) {
            $customer->password = Hash::make(Str::password(16));
        }

        try {
            $customer->save();
        } catch (QueryException $exception) {
            $message = $exception->getMessage();
            if (str_contains($message, 'users_tenant_id_username_unique')) {
                throw ValidationException::withMessages([
                    'name' => 'This username is already used in this tenant. Please choose a different username.',
                ]);
            }

            if (str_contains($message, 'users_tenant_id_email_unique')) {
                throw ValidationException::withMessages([
                    'email' => 'This email is already used in this tenant.',
                ]);
            }

            throw $exception;
        }

        if (! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $this->createPendingLicense(
                $request,
                $customer,
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $this->currentReseller($request),
            );
        }

        $this->logActivity($request, 'customer.created', sprintf('Created customer profile for %s.', $customer->email), [
            'customer_id' => $customer->id,
        ]);

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->where('reseller_id', $this->currentReseller($request)->id)
            ->with(['program:id,name'])
            ->latest('activated_at')]);

        return response()->json(['data' => $this->serializeCustomer($customer, [], $this->currentReseller($request)->id)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveCustomer($request, $user);

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

        $this->logActivity($request, 'customer.updated', sprintf('Updated client name for customer %d.', $customer->id), [
            'customer_id' => $customer->id,
        ]);

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->where('reseller_id', $this->currentReseller($request)->id)
            ->with(['program:id,name'])
            ->latest('activated_at')]);

        return response()->json(['data' => $this->serializeCustomer($customer, [], $this->currentReseller($request)->id)]);
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
                ...$this->serializeCustomer($customer, [], $resellerId),
                'licenses' => $customer->customerLicenses->map(fn ($license): array => [
                    'id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'program' => $license->program?->name,
                    'status' => $license->effectiveStatus(),
                    'price' => CustomerOwnership::sanitizeDisplayPrice($license->price),
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
                    'is_blacklisted' => BiosBlacklist::blocksBios((string) $license->bios_id, (int) $license->tenant_id),
                ])->values(),
            ],
        ]);
    }

    public function biosChangeHistory(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveCustomer($request, $user);
        $resellerId = $this->currentReseller($request)->id;

        $changes = BiosChangeRequest::query()
            ->where('reseller_id', $resellerId)
            ->whereHas('license', fn ($q) => $q->where('customer_id', $customer->id))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (BiosChangeRequest $change): array => [
                'id' => $change->id,
                'old_bios_id' => $change->old_bios_id,
                'new_bios_id' => $change->new_bios_id,
                'reason' => $change->reason !== '' ? $change->reason : null,
                'status' => $change->status === 'approved_pending_sync' ? 'approved' : $change->status,
                'reviewed_by' => null,
                'reviewer_notes' => $change->reviewer_notes,
                'created_at' => $change->created_at?->toIso8601String(),
                'reviewed_at' => $change->reviewed_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => $changes,
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveCustomer($request, $user);
        $resellerId = $this->currentReseller($request)->id;

        $licenses = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->where('reseller_id', $resellerId)
            ->get();

        if ($licenses->contains(fn (License $license): bool => ! $this->canDeleteLicense($license))) {
            return response()->json([
                'message' => 'Only customers with expired or cancelled licenses can be deleted.',
            ], 422);
        }

        $licensesCount = $licenses->count();
        foreach ($licenses as $license) {
            $license->delete();
        }

        $customerName = $customer->name;
        $customerId = $customer->id;
        $customer->delete();

        $this->logActivity(
            $request,
            'customer.deleted',
            sprintf('Deleted customer profile for %s.', $customerName),
            [
                'customer_id' => $customerId,
                'licenses_deleted' => $licensesCount,
            ],
        );

        return response()->json([
            'message' => 'Customer deleted successfully.',
        ]);
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function serializeCustomer(User $user, array $filters = [], ?int $currentResellerId = null): array
    {
        $license = $this->resolveDisplayLicense($user, $filters);

        // Check if this customer's BIOS is owned by a DIFFERENT reseller
        // (active, suspended, scheduled, or paused — all block others from taking it)
        $biosActiveElsewhere = $license && $license->bios_id && $currentResellerId !== null
            ? CustomerOwnership::hasBlockingOwnershipElsewhere((string) $license->bios_id, $license->id, $currentResellerId)
            : false;

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
            'duration_days' => $license ? (float) $license->duration_days : null,
            'status' => $license?->effectiveStatus() ?? 'pending',
            'price' => $license ? CustomerOwnership::sanitizeDisplayPrice($license->price) : 0,
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
            'paused_by_role' => $license?->paused_by_role ?? null,
            'is_blacklisted' => $license ? BiosBlacklist::blocksBios((string) $license->bios_id, (int) $license->tenant_id) : false,
            'bios_active_elsewhere' => $biosActiveElsewhere,
            'license_count' => $user->customerLicenses->count(),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function resolveDisplayLicense(User $user, array $filters = []): ?License
    {
        return CustomerOwnership::resolveDisplayLicense(
            $user->customerLicenses,
            fn (License $license): bool => $this->licenseMatchesScopeFilters($license, $filters),
            $this->hasScopedLicenseFilters($filters),
        );
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function customerMatchesDisplayFilters(User $user, array $filters): bool
    {
        $status = isset($filters['status']) && is_string($filters['status']) ? $filters['status'] : '';
        $license = $this->resolveDisplayLicense($user, $filters);

        if (! $license) {
            return in_array($status, ['', 'all', 'pending'], true) && ! $this->hasScopedLicenseFilters($filters);
        }

        if ($status === '' || $status === 'all') {
            return true;
        }

        return $this->displayLicenseMatchesStatus($license, $status);
    }

    private function canDeleteLicense(License $license): bool
    {
        return in_array($license->effectiveStatus(), ['cancelled', 'expired'], true);
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function licenseMatchesDisplayFilters(License $license, array $filters): bool
    {
        return $this->licenseMatchesScopeFilters($license, $filters)
            && $this->displayLicenseMatchesStatus($license, isset($filters['status']) && is_string($filters['status']) ? $filters['status'] : '');
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function licenseMatchesScopeFilters(License $license, array $filters): bool
    {
        $programId = isset($filters['program_id']) ? (int) $filters['program_id'] : null;
        if ($programId) {
            if ((int) $license->program_id !== $programId) {
                return false;
            }
        }

        return true;
    }

    private function displayLicenseMatchesStatus(License $license, string $status): bool
    {
        if ($status === '' || $status === 'all') {
            return true;
        }

        if ($status === 'scheduled') {
            return $this->supportsScheduledLicenses()
                && $license->status === 'pending'
                && (bool) $license->is_scheduled;
        }

        if ($status === 'pending') {
            if (! $this->supportsScheduledLicenses()) {
                return $license->status === 'pending';
            }

            return $license->status === 'pending' && ! (bool) $license->is_scheduled;
        }

        return $license->effectiveStatus() === $status;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function hasScopedLicenseFilters(array $filters): bool
    {
        return ! empty($filters['program_id']);
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_starts_with($email, 'no-email+') && str_ends_with($email, '@obd2sw.local') ? null : $email;
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

    private function createPendingLicense(Request $request, User $customer, string $biosId, int $programId, User $seller): void
    {
        $program = $this->assertPendingLicenseCanBeCreated($request, $biosId, $programId, $seller, (string) $customer->username);
        $normalizedBiosId = trim($biosId);
        $biosIdLower = strtolower($normalizedBiosId);

        DB::transaction(function () use ($request, $customer, $normalizedBiosId, $biosIdLower, $program, $seller): void {
            // Race condition guard: re-check with lock inside transaction.
            // Block active/suspended by anyone, and same-seller duplicate pending.
            $raceConflict = License::query()
                ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
                ->whereIn('status', ['active', 'suspended'])
                ->lockForUpdate()
                ->first();

            if ($raceConflict) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID was just activated by another reseller.',
                ]);
            }

            $sellerDuplicate = License::query()
                ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
                ->where('reseller_id', $seller->id)
                ->whereNotIn('status', ['expired', 'cancelled'])
                ->lockForUpdate()
                ->exists();

            if ($sellerDuplicate) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'bios_id' => 'You already have this customer saved with this BIOS ID.',
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
        });
    }

    private function assertPendingLicenseCanBeCreated(Request $request, string $biosId, int $programId, User $seller, string $username = ''): Program
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

        if (BiosBlacklist::blocksBios($normalizedBiosId, $this->currentTenantId($request))) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID is blacklisted.',
            ]);
        }

        // GLOBAL cross-tenant check: BIOS must not be owned (active, suspended, scheduled, or paused)
        $biosIdLowerGlobal = strtolower($normalizedBiosId);
        $globalActive = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLowerGlobal])
            ->where(function ($q): void {
                $q->whereIn('status', ['active', 'suspended'])
                  ->orWhere(function ($q2): void {
                      $q2->where('status', 'pending')->where('is_scheduled', true);
                  })
                  ->orWhere(function ($q2): void {
                      $q2->where('status', 'pending')
                         ->where(function ($q3): void {
                             $q3->where('is_scheduled', false)->orWhereNull('is_scheduled');
                         })
                         ->whereNotNull('paused_at')
                         ->where('pause_remaining_minutes', '>', 0);
                  });
            })
            ->first();
        if ($globalActive) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID is currently active with another reseller.',
            ]);
        }

        // Duplicate guard: same seller already has a non-expired/cancelled license for this BIOS.
        // This prevents the same reseller from saving the same customer twice.
        $existingByThisSeller = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLowerGlobal])
            ->where('reseller_id', $seller->id)
            ->whereNotIn('status', ['expired', 'cancelled'])
            ->exists();

        if ($existingByThisSeller) {
            throw ValidationException::withMessages([
                'bios_id' => 'You already have this customer saved with this BIOS ID. Please manage them from your customer list.',
            ]);
        }

        // Enforce permanent BIOS-username link (both directions)
        if ($username !== '') {
            $biosIdLower = strtolower($normalizedBiosId);
            $usernameLower = strtolower($username);

            // Check if this customer already exists in the system (re-activation scenario)
            $existingCustomer = User::query()
                ->where('tenant_id', $this->currentTenantId($request))
                ->whereRaw('LOWER(username) = ?', [$usernameLower])
                ->where('role', UserRole::CUSTOMER->value)
                ->first();

            // BIOS → username: this BIOS must not be linked to a different username
            // (only applies when activating for a brand-new username, not an existing customer)
            $linkByBios = BiosUsernameLink::where('bios_id', $biosIdLower)->first();
            if ($linkByBios && strtolower((string) $linkByBios->username) !== $usernameLower) {
                // If the existing customer owns this BIOS link's username, skip — different customer's BIOS
                throw ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID is permanently linked to a different username and cannot be assigned to a new customer.',
                ]);
            }

            // Username → BIOS: only block if this is a NEW customer (not an existing one being re-activated)
            // Existing customers may have had their BIOS changed via an approved BIOS change request
            if (! $existingCustomer) {
                $linkByUsername = BiosUsernameLink::where('username', $usernameLower)
                    ->where('bios_id', '!=', $biosIdLower)
                    ->first();
                if ($linkByUsername) {
                    throw ValidationException::withMessages([
                        'customer_name' => 'This username is permanently linked to a different BIOS ID (' . $linkByUsername->bios_id . '). You cannot change the BIOS ID for an existing username.',
                    ]);
                }

                // Also check historical licenses for truly new customers
                $historicalConflict = License::query()
                    ->whereRaw('LOWER(external_username) = ?', [$usernameLower])
                    ->whereRaw('LOWER(bios_id) != ?', [$biosIdLower])
                    ->exists();
                if ($historicalConflict && ! $linkByBios) {
                    throw ValidationException::withMessages([
                        'customer_name' => 'This username was previously activated with a different BIOS ID. Each username is permanently tied to one BIOS ID.',
                    ]);
                }
            }
        }

        // Block only if there's an active or suspended license for this BIOS (already caught above globally,
        // but also check locally for suspended within-tenant). Pending licenses do NOT block —
        // any reseller may create/activate a pending BIOS (first one to activate wins).
        $existingSuspended = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [strtolower($normalizedBiosId)])
            ->where('status', 'suspended')
            ->first();

        if ($existingSuspended) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID belongs to a suspended license and cannot be used.',
            ]);
        }

        return $program;
    }
}
