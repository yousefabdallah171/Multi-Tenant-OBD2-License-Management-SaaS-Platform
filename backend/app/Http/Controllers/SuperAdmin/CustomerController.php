<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use App\Models\BiosUsernameLink;
use App\Models\CustomerNote;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Models\UserIpLog;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use App\Services\ExportTaskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;
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
            'country_name' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // Get all users that have licenses (customer role was removed in Phase 11)
        $customerIds = License::query()
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        $query = User::query()
            ->with('tenant')
            ->whereIn('id', $customerIds)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $tenantId = isset($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);
            });
        }

        if (! empty($validated['country_name'])) {
            $query->where('country_name', $validated['country_name']);
        }

        // Apply pagination at database level first
        $perPage = (int) ($validated['per_page'] ?? 25);
        $page = (int) $request->integer('page', 1);

        // Load all customers (necessary due to complex display filters on licenses)
        // But apply as many filters as possible at database level
        $allCustomers = $query->get();

        // Filter in memory (unavoidable due to license status logic)
        $filtered = $allCustomers->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated));

        // Manual pagination on filtered results
        $total = $filtered->count();
        $items = $filtered->slice(($page - 1) * $perPage, $perPage)->values();
        $biosLinkMap = $this->safeBiosLinkMapForUsers($items, $tenantId);
        $lastPage = max(1, (int) ceil($total / $perPage));

        // Create paginator object
        $customers = new \Illuminate\Pagination\Paginator(
            $items,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
        $customers->lastPage = $lastPage;

        return response()->json([
            'data' => $items->map(fn (User $user): array => $this->serializeCustomer($user, $validated, null, null, $biosLinkMap))->values(),
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => $lastPage,
            ],
        ]);
    }

    public function countries(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'reseller_id' => ['nullable', 'integer', 'exists:users,id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
        ]);

        $customerIds = License::query()
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        $query = User::query()
            ->with('tenant')
            ->whereIn('id', $customerIds)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $tenantId = isset($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);
            });
        }

        $countries = $query->get()
            ->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated))
            ->filter(fn (User $user): bool => filled($user->country_name))
            ->groupBy(fn (User $user): string => trim((string) $user->country_name))
            ->map(fn (Collection $group, string $country): array => [
                'country_name' => $country,
                'count' => $group->unique('id')->count(),
            ])
            ->sortBy('country_name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return response()->json(['data' => $countries]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $task = $exportTaskService->queue(
            $request,
            'xlsx',
            'super-admin-customers.xlsx',
            'Super Admin Customers',
            $this->exportSections($request),
            [],
            null,
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    public function exportPdf(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $task = $exportTaskService->queue(
            $request,
            'pdf',
            'super-admin-customers.pdf',
            'Super Admin Customers',
            $this->exportSections($request),
            [],
            null,
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    public function show(User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $user->load([
            'tenant:id,name,slug,status',
            'customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseDetailColumns())
                ->with(['program:id,name', 'reseller:id,name,email,role']),
            'createdBy:id,name,email',
        ]);
        $displayLicense = $this->resolveDisplayLicense($user);
        $currentBiosByLicense = $user->customerLicenses
            ->mapWithKeys(fn (License $license): array => [$license->id => strtolower((string) $license->bios_id)])
            ->all();

        $resellersSummary = $user->customerLicenses
            ->groupBy('reseller_id')
            ->map(function ($licenses) {
                $latest = $licenses->sortByDesc('activated_at')->first();

                return [
                    'reseller_id' => $latest?->reseller_id,
                    'reseller_name' => $latest?->reseller?->name,
                    'reseller_email' => $latest?->reseller?->email,
                    'reseller_role' => $latest?->reseller?->role?->value ?? ($latest?->reseller ? (string) $latest->reseller->role : null),
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
            ->filter(function (ActivityLog $log) use ($currentBiosByLicense): bool {
                if ($log->action !== 'bios.direct_changed') {
                    return true;
                }

                $licenseId = (int) ($log->metadata['license_id'] ?? 0);
                $newBiosId = strtolower((string) ($log->metadata['new_bios_id'] ?? ''));

                return $licenseId > 0
                    && isset($currentBiosByLicense[$licenseId])
                    && $currentBiosByLicense[$licenseId] === $newBiosId;
            })
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
            ...$this->serializeCustomer($user, [], null, null, $this->safeBiosLinkMapForUsers(collect([$user]), $user->tenant_id)),
                'username' => $this->resolveCustomerUsername($user, $displayLicense),
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
                    'reseller_role' => $license->reseller?->role?->value ?? ($license->reseller ? (string) $license->reseller->role : null),
                    'status' => $license->effectiveStatus(),
                    'duration_days' => (float) $license->duration_days,
                    'price' => CustomerOwnership::displayPriceForLicense($license),
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
                'resellers_summary' => $resellersSummary,
                'ip_logs' => $ipLogs,
                'activity' => $activity,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'seller_id' => ['nullable', 'integer', 'exists:users,id', 'required_with:bios_id,program_id'],
            'bios_id' => ['nullable', 'string', 'min:3', 'required_with:program_id,seller_id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id', 'required_with:bios_id,seller_id'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $username = Str::of((string) $validated['name'])->ascii()->replaceMatches('/[^A-Za-z0-9_]+/', '_')->trim('_')->value();
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
                $query->where('email', $email)->orWhereRaw('LOWER(username) = ?', [Str::lower($username)]);
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
            'country_name' => isset($validated['country_name']) ? trim((string) $validated['country_name']) ?: null : null,
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

        // Create customer note if provided
        if (! empty($validated['notes'])) {
            CustomerNote::create([
                'tenant_id' => (int) $validated['tenant_id'],
                'user_id' => auth()->id(),
                'customer_id' => $customer->id,
                'note' => $validated['notes'],
            ]);
        }

        $customer->load(['tenant', 'customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->select($this->licenseListColumns())
            ->with(['program:id,name', 'reseller:id,name,role'])]);

        return response()->json(['data' => $this->serializeCustomer($customer, [], null, null, $this->safeBiosLinkMapForUsers(collect([$customer]), $customer->tenant_id))], 201);
    }

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'reseller_id' => ['nullable', 'integer', 'exists:users,id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
        ]);

        $query = User::query()
            ->with('tenant')
            ->where('role', UserRole::CUSTOMER->value)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $tenantId = isset($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);
            });
        }

        $allCustomers = $query->get();
        $filteredCustomers = $allCustomers
            ->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated))
            ->values();
        $biosLinkMap = $this->safeBiosLinkMapForUsers($filteredCustomers, $tenantId);
        $rows = $filteredCustomers
            ->map(fn (User $user): array => $this->serializeCustomer($user, $validated, null, null, $biosLinkMap))
            ->values();
        $notesMap = $this->resolveNotesForExport($rows->pluck('id')->filter()->all());

        return [
            [
                'title' => 'Customers',
                'headers' => [
                    'Tenant',
                    'Name',
                    'Username',
                    'Email',
                    'Phone',
                    'BIOS ID',
                    'Program',
                    'Seller',
                    'Seller Role',
                    'Duration (Days)',
                    'Status',
                    'Price (USD)',
                    'Start',
                    'Expiry',
                    'Notes',
                ],
                'rows' => $rows->map(fn (array $row): array => [
                    $row['tenant']['name'] ?? '',
                    $row['name'] ?? '',
                    $row['username'] ?? '',
                    $row['email'] ?? '',
                    $row['phone'] ?? '',
                    $row['bios_id'] ?? '',
                    $row['program'] ?? '',
                    $row['reseller'] ?? '',
                    $row['reseller_role'] ?? '',
                    $this->resolveExportDurationDays($row['duration_days'] ?? null, $row['start_at'] ?? null, $row['expiry'] ?? null),
                    $row['status'] ?? '',
                    $row['price'] ?? null,
                    $row['start_at'] ?? $row['activated_at'] ?? '',
                    $row['expiry'] ?? '',
                    $notesMap[(int) ($row['id'] ?? 0)] ?? '',
                ])->all(),
            ],
        ];
    }

    private function reportLanguage(Request $request): string
    {
        $lang = $request->query('lang', $request->header('Accept-Language', 'en'));

        return str_starts_with((string) $lang, 'ar') ? 'ar' : 'en';
    }

    /**
     * @param  array<int, int>  $customerIds
     * @return array<int, string>
     */
    private function resolveNotesForExport(array $customerIds): array
    {
        if ($customerIds === []) {
            return [];
        }

        $notes = CustomerNote::query()
            ->where('user_id', auth()->id())
            ->whereIn('customer_id', $customerIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('customer_id')
            ->map(fn ($group) => (string) ($group->first()?->note ?? ''))
            ->all();

        return $notes;
    }

    private function resolveExportDurationDays(?float $durationDays, ?string $startAt, ?string $expiryAt): ?float
    {
        if ($startAt && $expiryAt) {
            try {
                $start = Carbon::parse($startAt);
                $expiry = Carbon::parse($expiryAt);
                if ($expiry->greaterThan($start)) {
                    return round($expiry->diffInSeconds($start) / 86400, 2);
                }
            } catch (\Throwable) {
                // fall through to duration_days
            }
        }

        if ($durationDays !== null && is_finite($durationDays) && $durationDays > 0) {
            return round($durationDays, 2);
        }

        return null;
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
            ->with(['program:id,name', 'reseller:id,name,role'])]);

        return response()->json(['data' => $this->serializeCustomer($user, [], null, null, $this->safeBiosLinkMapForUsers(collect([$user]), $user->tenant_id))]);
    }

    public function destroy(User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $licenses = License::query()->where('customer_id', $user->id)->get();

        if ($licenses->contains(fn (License $license): bool => ! $this->canDeleteLicense($license))) {
            return response()->json([
                'message' => 'Only customers with expired or cancelled licenses can be deleted.',
            ], 422);
        }

        \App\Support\CustomerDeletionService::snapshotAndDelete($user, auth()->user());

        return response()->json([
            'message' => 'Customer deleted successfully.',
        ]);
    }

    public function destroyRevenue(User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $deletedCustomer = \App\Models\DeletedCustomer::query()
            ->where('original_customer_id', $user->id)
            ->first();

        // If customer is still in deleted_customers table
        if ($deletedCustomer) {
            $snapshot = $deletedCustomer->snapshot;
            $activityLogIds = $snapshot['activity_log_ids'] ?? [];

            if (! empty($activityLogIds)) {
                DB::transaction(function () use ($deletedCustomer, $activityLogIds): void {
                    DB::table('activity_logs')
                        ->whereIn('id', $activityLogIds)
                        ->delete();

                    $deletedCustomer->update(['revenue_total' => 0]);
                });

                // Invalidate Reports cache
                LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
                if ($deletedCustomer->tenant_id) {
                    LicenseCacheInvalidation::bumpVersion("manager-parent:{$deletedCustomer->tenant_id}:reports:version");
                }
            }

            return response()->json([
                'message' => 'Customer revenue deleted successfully.',
            ]);
        }

        // If customer was deleted long ago and not in deleted_customers table,
        // search for activity logs by customer name from the snapshot or metadata
        $activityLogCount = DB::table('activity_logs')
            ->whereIn('action', ['license.activated', 'license.renewed'])
            ->where(function ($query) use ($user) {
                $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$user->id])
                    ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$user->name]);
            })
            ->count();

        if ($activityLogCount === 0) {
            return response()->json([
                'message' => 'No revenue records found for this customer.',
            ]);
        }

        DB::transaction(function () use ($user): void {
            DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($query) use ($user) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$user->id])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$user->name]);
                })
                ->delete();
        });

        // Invalidate Reports cache
        LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
        if ($user->tenant_id) {
            LicenseCacheInvalidation::bumpVersion("manager-parent:{$user->tenant_id}:reports:version");
        }

        return response()->json([
            'message' => 'Customer revenue deleted successfully.',
        ]);
    }

    private function canDeleteLicense(License $license): bool
    {
        return in_array($license->effectiveStatus(), ['cancelled', 'expired'], true);
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
            'duration_days',
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
    private function serializeCustomer(User $user, array $filters = [], ?array $blacklistCache = null, ?array $activeBiosCache = null, array $biosLinkMap = []): array
    {
        $license = $this->resolveDisplayLicense($user, $filters);
        $linkedBiosId = $this->resolveLinkedBiosId($user, $biosLinkMap);
        $displayBiosId = $linkedBiosId ?: $license?->bios_id;
        $hasActiveLicense = $user->customerLicenses->contains(
            fn ($item) => $item->isEffectivelyActive()
        );
        $resolvedUsername = $this->resolveCustomerUsername($user, $license);

        // Check blacklist from cache instead of database query
        $isBlacklisted = false;
        if ($displayBiosId && $blacklistCache !== null) {
            $cacheKey = strtolower((string) $displayBiosId) . '|' . $user->tenant_id;
            $isBlacklisted = isset($blacklistCache[$cacheKey]);
        } elseif ($displayBiosId) {
            $isBlacklisted = BiosBlacklist::blocksBios((string) $displayBiosId, (int) $user->tenant_id);
        }

        // Check active elsewhere from cache
        $biosActiveElsewhere = false;
        if ($displayBiosId && $activeBiosCache !== null) {
            $cacheKey = strtolower((string) $displayBiosId);
            $biosActiveElsewhere = isset($activeBiosCache[$cacheKey]) && $activeBiosCache[$cacheKey] > 1;
        } elseif ($displayBiosId) {
            $biosActiveElsewhere = CustomerOwnership::hasBlockingOwnershipElsewhere((string) $displayBiosId, $license?->id);
        }

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
            'country_name' => $user->country_name,
            'license_id' => $license?->id,
            'bios_id' => $displayBiosId,
            'external_username' => $license?->external_username,
            'reseller' => $license?->reseller?->name,
            'reseller_role' => $license?->reseller?->role?->value ?? ($license?->reseller ? (string) $license->reseller->role : null),
            'reseller_id' => $license?->reseller_id,
            'duration_days' => $license ? (float) $license->duration_days : null,
            'program' => $license?->program?->name,
            'status' => $license?->effectiveStatus() ?? 'pending',
            'price' => CustomerOwnership::displayPriceForLicense($license),
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
            'is_blacklisted' => $isBlacklisted,
            'bios_active_elsewhere' => $biosActiveElsewhere,
            'license_count' => $user->customerLicenses->count(),
            'has_active_license' => $hasActiveLicense,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function resolveDisplayLicense(User $user, array $filters = []): ?License
    {
        return CustomerOwnership::resolveDisplayLicense(
            $user->customerLicenses,
            fn (License $license): bool => $this->licenseMatchesTenantFilter($license, $filters),
            ! empty($filters['tenant_id']),
        );
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function customerMatchesDisplayFilters(User $user, array $filters): bool
    {
        $status = isset($filters['status']) && is_string($filters['status']) ? $filters['status'] : '';
        $license = $this->resolveDisplayLicense($user, $filters);
        $countryName = isset($filters['country_name']) && is_string($filters['country_name']) ? trim($filters['country_name']) : '';

        if ($countryName !== '' && $user->country_name !== $countryName) {
            return false;
        }

        if (! $license) {
            return in_array($status, ['', 'all', 'pending'], true) && ! $this->hasScopedLicenseFilters($filters);
        }

        return $this->licenseMatchesScopeFilters($license, $filters)
            && $this->displayLicenseMatchesStatus($license, $status);
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
        if (! $this->licenseMatchesTenantFilter($license, $filters)) {
            return false;
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

        return true;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function licenseMatchesTenantFilter(License $license, array $filters): bool
    {
        $tenantId = isset($filters['tenant_id']) ? (int) $filters['tenant_id'] : null;
        if ($tenantId && (int) $license->tenant_id !== $tenantId) {
            return false;
        }

        return true;
    }

    private function displayLicenseMatchesStatus(License $license, string $status): bool
    {
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

    /**
     * @param array<string, mixed> $filters
     */
    private function hasScopedLicenseFilters(array $filters): bool
    {
        return ! empty($filters['program_id']) || ! empty($filters['reseller_id']);
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_starts_with($email, 'no-email+') && str_ends_with($email, '@obd2sw.local') ? null : $email;
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

    /**
     * @return array<int, string>
     */
    private function linkedUsernamesForBiosSearch(string $search, ?int $tenantId): array
    {
        $term = strtolower(trim($search));
        if ($term === '') {
            return [];
        }

        return BiosUsernameLink::query()
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereRaw('LOWER(bios_id) like ?', ['%'.$term.'%'])
            ->pluck('username')
            ->filter()
            ->all();
    }

    /**
     * @param Collection<int, User> $users
     * @return array<string, string>
     */
    private function biosLinkMapForUsers(Collection $users, ?int $tenantId): array
    {
        $usernames = $users
            ->pluck('username')
            ->filter(fn ($username): bool => is_string($username) && $username !== '')
            ->values();

        if ($usernames->isEmpty()) {
            return [];
        }

        return BiosUsernameLink::query()
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereIn('username', $usernames->all())
            ->get(['username', 'bios_id'])
            ->mapWithKeys(fn (BiosUsernameLink $link): array => [strtolower((string) $link->username) => (string) $link->bios_id])
            ->all();
    }

    /**
     * @param Collection<int, User> $users
     * @return array<string, string>
     */
    private function safeBiosLinkMapForUsers(Collection $users, ?int $tenantId): array
    {
        try {
            return $this->biosLinkMapForUsers($users, $tenantId);
        } catch (\Throwable $e) {
            \Log::warning('Failed to resolve BIOS link map for super admin customers.', [
                'tenant_id' => $tenantId,
                'count' => $users->count(),
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * @param array<string, string> $biosLinkMap
     */
    private function resolveLinkedBiosId(User $user, array $biosLinkMap): ?string
    {
        $username = strtolower((string) $user->username);

        return $biosLinkMap[$username] ?? null;
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

        // Duplicate guard: same seller already has a non-expired/cancelled license for this BIOS.
        $existingByThisSeller = License::query()
            ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
            ->where('reseller_id', $seller->id)
            ->whereNotIn('status', ['expired', 'cancelled'])
            ->exists();

        if ($existingByThisSeller) {
            throw ValidationException::withMessages([
                'bios_id' => 'You already have this customer saved with this BIOS ID. Please manage them from your customer list.',
            ]);
        }

        // Enforce permanent BIOS↔username link (both directions)
        $customerName = strtolower(trim((string) request()->input('name', '')));
        $derivedUsername = (string) \Illuminate\Support\Str::of($customerName)->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();

        if ($derivedUsername !== '') {
            $usernameLower = $derivedUsername;

            // Check if customer already exists (re-activation)
            $existingCustomer = User::query()
                ->where('tenant_id', $tenantId)
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

                // Also check historical licenses — covers cases where BiosUsernameLink entry was cleaned up
                $historicalConflict = \App\Models\License::query()
                    ->whereRaw('LOWER(external_username) = ?', [$usernameLower])
                    ->whereRaw('LOWER(bios_id) != ?', [$biosIdLower])
                    ->exists();
                if ($historicalConflict && ! $linkByBios) {
                    throw ValidationException::withMessages([
                        'customer_name' => 'This username was previously activated with a different BIOS ID. Each username is permanently tied to one BIOS ID.',
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

    private function createPendingLicense(User $customer, int $tenantId, string $biosId, int $programId, User $seller): void
    {
        $program = $this->assertPendingLicenseCanBeCreated($tenantId, $biosId, $programId, $seller);
        $normalizedBiosId = trim($biosId);
        $biosIdLower = strtolower($normalizedBiosId);

        DB::transaction(function () use ($customer, $tenantId, $normalizedBiosId, $biosIdLower, $program, $seller): void {
            // Race condition guard: re-check with lock inside transaction.
            // Pending licenses do NOT block — first to activate wins (Rule 2.3).
            $raceConflict = License::query()
                ->whereRaw('LOWER(bios_id) = ?', [$biosIdLower])
                ->whereIn('status', ['active', 'suspended'])
                ->lockForUpdate()
                ->first();

            if ($raceConflict) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID is already active or suspended. Please try a different BIOS ID.',
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
        });
    }
}
