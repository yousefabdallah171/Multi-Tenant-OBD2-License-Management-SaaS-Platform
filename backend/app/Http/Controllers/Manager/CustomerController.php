<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\Program;
use App\Models\UserIpLog;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerController extends BaseManagerController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sellerIds = $this->teamSellerIds($request);

        $query = $this->teamCustomersQuery($request)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $sellerIds)
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name'])])
            ->latest();

        if (! empty($validated['manager_id'])) {
            $query->where('created_by', (int) $validated['manager_id']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated, $sellerIds): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->whereIn('reseller_id', $sellerIds)
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['reseller_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $sellerIds)
                ->where('reseller_id', $validated['reseller_id']));
        }

        if (! empty($validated['program_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $sellerIds)
                ->where('program_id', $validated['program_id']));
        }

        if (! empty($validated['status'])) {
            if ($validated['status'] === 'pending') {
                $query->where(function ($statusQuery) use ($sellerIds): void {
                    $statusQuery
                        ->whereDoesntHave('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $sellerIds))
                        ->orWhereHas('customerLicenses', function ($licenseQuery) use ($sellerIds): void {
                            $licenseQuery->whereIn('reseller_id', $sellerIds);

                            if (! $this->supportsScheduledLicenses()) {
                                $licenseQuery->where('status', 'pending');
                                return;
                            }

                            $licenseQuery->where('status', 'pending')->where(function ($pendingQuery): void {
                                $pendingQuery->where('is_scheduled', false)->orWhereNull('is_scheduled');
                            });
                        });
                });
            } else {
                $query->whereHas('customerLicenses', function ($licenseQuery) use ($sellerIds, $validated): void {
                    $licenseQuery->whereIn('reseller_id', $sellerIds);

                    if (! $this->supportsScheduledLicenses()) {
                        if ($validated['status'] === 'scheduled') {
                            $licenseQuery->whereRaw('1 = 0');
                            return;
                        }

                        $licenseQuery->where('status', $validated['status']);
                        return;
                    }

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

    public function licenseHistory(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);
        $sellerIds = $this->teamSellerIds($request);

        $licenses = License::query()
            ->with(['program:id,name', 'reseller:id,name,email'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->whereIn('reseller_id', $sellerIds)
            ->orderByDesc('activated_at')
            ->get()
            ->map(fn (License $license): array => $this->serializeLicenseHistoryEntry($license))
            ->values();

        return response()->json([
            'data' => $licenses,
        ]);
    }

    public function biosChangeHistory(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);

        $changes = \App\Models\BiosChangeRequest::query()
            ->with(['license:id,customer_id', 'reseller:id,name', 'reviewer:id,name'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereHas('license', fn ($q) => $q->where('customer_id', $customer->id))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($change): array => [
                'id' => $change->id,
                'old_bios_id' => $change->old_bios_id,
                'new_bios_id' => $change->new_bios_id,
                'reason' => $change->reason,
                'status' => $change->status === 'approved_pending_sync' ? 'approved' : $change->status,
                'requested_by' => $change->reseller?->name,
                'reviewed_by' => $change->reviewer?->name,
                'created_at' => $change->created_at?->toIso8601String(),
                'reviewed_at' => $change->reviewed_at?->toIso8601String(),
            ])
            ->values();

        return response()->json(['data' => $changes]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);
        $sellerIds = $this->teamSellerIds($request);

        $customer->load([
            'customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $sellerIds)
                ->select($this->licenseDetailColumns())
                ->with(['program:id,name', 'reseller:id,name,email']),
            'createdBy:id,name,email',
        ]);

        $sellersSummary = $customer->customerLicenses
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
            ->where('user_id', $customer->id)
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
            ->where(function ($query) use ($customer, $sellerIds): void {
                $query
                    ->where('user_id', $customer->id)
                    ->orWhere(function ($sellerQuery) use ($customer, $sellerIds): void {
                        $sellerQuery
                            ->whereIn('user_id', $sellerIds)
                            ->where('metadata->customer_id', $customer->id);
                    });
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
                ...$this->serializeCustomer($customer),
                'username' => $customer->customerLicenses->sortByDesc('activated_at')->first()?->external_username ?: $customer->username,
                'phone' => $customer->phone,
                'created_by' => $customer->createdBy ? [
                    'id' => $customer->createdBy->id,
                    'name' => $customer->createdBy->name,
                    'email' => $customer->createdBy->email,
                ] : null,
                'created_at' => $customer->created_at?->toIso8601String(),
                'licenses' => $customer->customerLicenses->map(fn ($license): array => [
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
                    'is_blacklisted' => BiosBlacklist::blocksBios((string) $license->bios_id, (int) $license->tenant_id),
                ])->values(),
                'resellers_summary' => $sellersSummary,
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

        if (! empty($validated['bios_id']) && ! empty($validated['program_id'])) {
            $this->assertPendingLicenseCanBeCreated(
                $request,
                (string) $validated['bios_id'],
                (int) $validated['program_id'],
                $this->currentManager($request),
            );
        }

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
            'created_by' => $this->currentManager($request)->id,
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
                $this->currentManager($request),
            );
        }

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->whereIn('reseller_id', $this->teamSellerIds($request))
            ->with(['program:id,name', 'reseller:id,name'])]);

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);

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
            ->whereIn('reseller_id', $this->teamSellerIds($request))
            ->with(['program:id,name', 'reseller:id,name'])]);

        $this->logActivity($request, 'customer.updated', sprintf('Updated customer %d.', $customer->id), [
            'customer_id' => $customer->id,
        ]);

        return response()->json(['data' => $this->serializeCustomer($customer)]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTeamUser($request, $user);
        $sellerIds = $this->teamSellerIds($request);

        $licenses = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->whereIn('reseller_id', $sellerIds)
            ->get();

        if ($licenses->contains(fn (License $license): bool => ! $this->canDeleteLicense($license))) {
            return response()->json([
                'message' => 'Only customers with expired or cancelled licenses can be deleted.',
            ], 422);
        }

        $customerName = $customer->name;
        $customerId = $customer->id;
        $licensesCount = $licenses->count();

        foreach ($licenses as $license) {
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

    private function canDeleteLicense(License $license): bool
    {
        return in_array($license->effectiveStatus(), ['cancelled', 'expired'], true);
    }

    private function createPendingLicense(Request $request, User $customer, string $biosId, int $programId, User $seller): void
    {
        $program = $this->assertPendingLicenseCanBeCreated($request, $biosId, $programId, $seller);
        $normalizedBiosId = trim($biosId);
        $biosIdLower = strtolower($normalizedBiosId);

        DB::transaction(function () use ($request, $customer, $normalizedBiosId, $biosIdLower, $program, $seller): void {
            // Race condition guard: re-check with lock inside transaction
            $raceConflict = License::query()
                ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
                ->whereIn('status', ['active', 'suspended', 'pending'])
                ->lockForUpdate()
                ->first();

            if ($raceConflict) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID was just claimed by another user. Please try a different BIOS ID.',
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
                ...($this->supportsScheduledLicenses() ? ['is_scheduled' => false] : []),
            ]);
        });
    }

    private function assertPendingLicenseCanBeCreated(Request $request, string $biosId, int $programId, User $seller): Program
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

        // GLOBAL cross-tenant check: BIOS must not be active or suspended in ANY tenant
        $biosIdLower = strtolower($normalizedBiosId);
        $globalActive = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($globalActive) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID is currently active with another reseller.',
            ]);
        }

        // Enforce permanent BIOS↔username link (both directions)
        $customerName = strtolower(trim((string) $request->input('name', '')));
        $derivedUsername = (string) \Illuminate\Support\Str::of($customerName)->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();

        if ($derivedUsername !== '') {
            $usernameLower = $derivedUsername;

            // Check if customer already exists (re-activation)
            $existingCustomer = User::query()
                ->where('tenant_id', $this->currentTenantId($request))
                ->whereRaw('LOWER(username) = ?', [$usernameLower])
                ->where('role', UserRole::CUSTOMER->value)
                ->first();

            // BIOS → username: this BIOS must not be linked to a different username
            $linkByBios = BiosUsernameLink::where('bios_id', $biosIdLower)->first();
            if ($linkByBios && strtolower((string) $linkByBios->username) !== $usernameLower) {
                throw ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID is permanently linked to a different username (' . $linkByBios->username . ').',
                ]);
            }

            // Username → BIOS: only block for new customers (existing may have had BIOS changed)
            if (! $existingCustomer) {
                $linkByUsername = BiosUsernameLink::where('username', $usernameLower)
                    ->where('bios_id', '!=', $biosIdLower)
                    ->first();
                if ($linkByUsername) {
                    throw ValidationException::withMessages([
                        'customer_name' => 'This username is permanently linked to a different BIOS ID (' . $linkByUsername->bios_id . ').',
                    ]);
                }
            }
        } else {
            // No derived username — still check BIOS→username link
            $linkByBios = BiosUsernameLink::where('bios_id', $biosIdLower)->first();
            if ($linkByBios) {
                throw ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID is permanently linked to a specific username. Please provide the correct customer name.',
                ]);
            }
        }

        // Pending licenses do NOT block — any role may create a pending license for this BIOS.
        // Only block if there's a suspended license (active/suspended already caught globally above).
        $existingSuspended = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
            ->where('status', 'suspended')
            ->first();

        if ($existingSuspended) {
            throw ValidationException::withMessages([
                'bios_id' => 'This BIOS ID belongs to a suspended license and cannot be used.',
            ]);
        }

        return $program;
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
            'price',
            'activated_at',
            'expires_at',
            ...$this->optionalScheduledColumns(),
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
            ...$this->optionalScheduledColumns(),
        ];
    }

    /**
     * @return list<string>
     */
    private function optionalScheduledColumns(): array
    {
        $columns = [];

        foreach (['scheduled_at', 'scheduled_timezone', 'scheduled_last_attempt_at', 'scheduled_failed_at', 'scheduled_failure_message', 'is_scheduled', 'paused_at', 'pause_remaining_minutes', 'pause_reason'] as $column) {
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

    /**
     * @param array<string, mixed> $filters
     */
    private function serializeCustomer(User $user, array $filters = []): array
    {
        $license = $this->resolveDisplayLicense($user, $filters);
        $hasActiveLicense = $user->customerLicenses->contains(
            fn ($item) => $item->isEffectivelyActive()
        );

        return [
            'id' => $user->id,
            'name' => $user->name,
            'client_name' => $user->client_name,
            'username' => $license?->external_username ?: $user->username,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'external_username' => $license?->external_username,
            'reseller' => $license?->reseller?->name,
            'reseller_id' => $license?->reseller?->id,
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
            'is_blacklisted' => $license ? BiosBlacklist::blocksBios((string) $license->bios_id, (int) $license->tenant_id) : false,
            'bios_active_elsewhere' => $license && $license->bios_id
                ? License::query()
                    ->whereRaw('LOWER(bios_id) = ?', [strtolower((string) $license->bios_id)])
                    ->where('id', '!=', $license->id)
                    ->whereIn('status', ['active', 'suspended'])
                    ->exists()
                : false,
            'license_count' => $user->customerLicenses->count(),
            'has_active_license' => $hasActiveLicense,
        ];
    }

    private function serializeLicenseHistoryEntry(License $license): array
    {
        return [
            'id' => $license->id,
            'program_name' => $license->program?->name,
            'reseller_id' => $license->reseller_id,
            'reseller_name' => $license->reseller?->name,
            'reseller_email' => $license->reseller?->email,
            'bios_id' => $license->bios_id,
            'external_username' => $license->external_username,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'start_at' => ($license->scheduled_at ?? $license->activated_at)?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'duration_days' => (float) $license->duration_days,
            'price' => (float) $license->price,
            'status' => $license->effectiveStatus(),
            'paused_at' => $license->paused_at?->toIso8601String(),
            'pause_reason' => $license->pause_reason,
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
}
