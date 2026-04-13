<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BiosBlacklist;
use App\Models\BiosUsernameLink;
use App\Models\CustomerNote;
use App\Models\License;
use App\Models\Program;
use App\Models\UserIpLog;
use App\Models\User;
use App\Services\LicenseService;
use App\Services\ExportTaskService;
use App\Support\CustomerOwnership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;
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
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $tenantId = $this->currentTenantId($request);
        $scope = $this->resolveSellerScope($tenantId, [
            'manager_parent_id' => ! empty($validated['manager_parent_id']) ? (int) $validated['manager_parent_id'] : null,
            'manager_id' => ! empty($validated['manager_id']) ? (int) $validated['manager_id'] : null,
            'reseller_id' => ! empty($validated['reseller_id']) ? (int) $validated['reseller_id'] : null,
        ]);

        $query = User::query()
            ->where('tenant_id', $tenantId)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $scope['seller_ids'])
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $scope['seller_ids']));

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $scope, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->whereIn('reseller_id', $scope['seller_ids'])
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);
            });
        }

        if (! empty($validated['country_name'])) {
            $query->where('country_name', $validated['country_name']);
        }

        $allCustomers = $query->get();
        $customers = $this->paginateCollection(
            $allCustomers->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated)),
            (int) $request->integer('page', 1),
            (int) ($validated['per_page'] ?? 25),
        );

        $customerItems = collect($customers->items());
        $biosLinkMap = $this->biosLinkMapForUsers($customerItems, $tenantId);

        return response()->json([
            'data' => $customerItems->map(fn (User $user): array => $this->serializeCustomer($user, $validated, $biosLinkMap))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function countries(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
        ]);
        $tenantId = $this->currentTenantId($request);
        $scope = $this->resolveSellerScope($tenantId, [
            'manager_parent_id' => ! empty($validated['manager_parent_id']) ? (int) $validated['manager_parent_id'] : null,
            'manager_id' => ! empty($validated['manager_id']) ? (int) $validated['manager_id'] : null,
            'reseller_id' => ! empty($validated['reseller_id']) ? (int) $validated['reseller_id'] : null,
        ]);

        $query = User::query()
            ->where('tenant_id', $tenantId)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $scope['seller_ids'])
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $scope['seller_ids']));

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $scope, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->whereIn('reseller_id', $scope['seller_ids'])
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'))
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
            'manager-parent-customers.xlsx',
            'Manager Parent Customers',
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
            'manager-parent-customers.pdf',
            'Manager Parent Customers',
            $this->exportSections($request),
            [],
            null,
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    public function licenseHistory(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

        $licenses = License::query()
            ->with(['program:id,name', 'reseller:id,name,email,role'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
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
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

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

        return response()->json([
            'data' => $changes,
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTenantUser($request, $user);
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $user->load([
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
            ->with('user:id,name')
            ->where('tenant_id', $this->currentTenantId($request))
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
                'performed_by' => $log->user?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
            ...$this->serializeCustomer($user, [], $this->biosLinkMapForUsers(collect([$user]), $this->currentTenantId($request))),
                'username' => $displayLicense?->external_username ?: $user->username,
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
            'bios_id' => ['nullable', 'string', 'min:3', 'required_with:program_id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id', 'required_with:bios_id'],
            'notes' => ['nullable', 'string', 'max:5000'],
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
                $this->currentManagerParent($request),
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

        $clientName = trim((string) ($validated['client_name'] ?? ''));
        $displayName = $clientName !== '' ? $clientName : $validated['name'];

        $customer->fill([
            'tenant_id' => $this->currentTenantId($request),
            'name' => $displayName,
            'client_name' => $clientName !== '' ? $clientName : null,
            'email' => $email,
            'phone' => $validated['phone'] ?? null,
            'country_name' => isset($validated['country_name']) ? trim((string) $validated['country_name']) ?: null : null,
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

        // Create customer note if provided
        if (! empty($validated['notes'])) {
            CustomerNote::create([
                'tenant_id' => $this->currentTenantId($request),
                'user_id' => auth()->id(),
                'customer_id' => $customer->id,
                'note' => $validated['notes'],
            ]);
        }

        $customer->load(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->with(['program:id,name', 'reseller:id,name,role'])]);

        return response()->json(['data' => $this->serializeCustomer($customer, [], $this->biosLinkMapForUsers(collect([$customer]), $this->currentTenantId($request)))], 201);
    }

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $validated = $request->validate([
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending,scheduled'],
            'search' => ['nullable', 'string'],
        ]);
        $tenantId = $this->currentTenantId($request);
        $scope = $this->resolveSellerScope($tenantId, [
            'manager_parent_id' => ! empty($validated['manager_parent_id']) ? (int) $validated['manager_parent_id'] : null,
            'manager_id' => ! empty($validated['manager_id']) ? (int) $validated['manager_id'] : null,
            'reseller_id' => ! empty($validated['reseller_id']) ? (int) $validated['reseller_id'] : null,
        ]);

        $query = User::query()
            ->where('tenant_id', $tenantId)
            ->select(['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'country_name', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->whereIn('reseller_id', $scope['seller_ids'])
                ->select($this->licenseListColumns())
                ->with(['program:id,name', 'reseller:id,name,role'])])
            ->latest();

        $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->whereIn('reseller_id', $scope['seller_ids']));

        if (! empty($validated['search'])) {
            $linkedUsernames = $this->linkedUsernamesForBiosSearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $scope, $linkedUsernames): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('country_name', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->whereIn('reseller_id', $scope['seller_ids'])
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);
            });
        }

        $allCustomers = $query->get();
        $filteredCustomers = $allCustomers
            ->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated))
            ->values();
        $biosLinkMap = $this->biosLinkMapForUsers($filteredCustomers, $tenantId);
        $rows = $filteredCustomers
            ->map(fn (User $user): array => $this->serializeCustomer($user, $validated, $biosLinkMap))
            ->values();
        $notesMap = $this->resolveNotesForExport($rows->pluck('id')->filter()->all());

        return [
            [
                'title' => 'Customers',
                'headers' => [
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
            ->with(['program:id,name', 'reseller:id,name,role'])]);

        $this->logActivity($request, 'customer.updated', sprintf('Updated customer %d.', $customer->id), [
            'customer_id' => $customer->id,
        ]);

        return response()->json(['data' => $this->serializeCustomer($customer, [], $this->biosLinkMapForUsers(collect([$customer]), $this->currentTenantId($request)))]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

        $licenses = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->get();

        if ($licenses->contains(fn (License $license): bool => ! $this->canDeleteLicense($license))) {
            return response()->json([
                'message' => 'Only customers with expired or cancelled licenses can be deleted.',
            ], 422);
        }

        $customerName = $customer->name;
        $customerId = $customer->id;
        $licensesCount = $licenses->count();

        \App\Support\CustomerDeletionService::snapshotAndDelete($customer, $request->user());

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
        $customerName = strtolower(trim((string) $request->input('name', '')));
        $derivedUsername = (string) \Illuminate\Support\Str::of($customerName)->lower()->replaceMatches('/[^a-z0-9_]+/', '_')->trim('_')->value();

        if ($derivedUsername !== '') {
            $usernameLower = $derivedUsername;

            // Check if customer already exists (re-activation)
            $existingCustomer = User::query()
                ->where('tenant_id', $this->currentTenantId($request))
                ->whereRaw('LOWER(username) = ?', [$usernameLower])

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
    private function serializeCustomer(User $user, array $filters = [], array $biosLinkMap = []): array
    {
        $license = $this->resolveDisplayLicense($user, $filters);
        $linkedBiosId = $this->resolveLinkedBiosId($user, $biosLinkMap);
        $displayBiosId = $linkedBiosId ?: $license?->bios_id;
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
            'country_name' => $user->country_name,
            'license_id' => $license?->id,
            'bios_id' => $displayBiosId,
            'external_username' => $license?->external_username,
            'reseller' => $license?->reseller?->name,
            'reseller_role' => $license?->reseller?->role?->value ?? ($license?->reseller ? (string) $license->reseller->role : null),
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
            'is_blacklisted' => $displayBiosId ? BiosBlacklist::blocksBios((string) $displayBiosId, (int) $user->tenant_id) : false,
            'bios_active_elsewhere' => $displayBiosId
                ? CustomerOwnership::hasBlockingOwnershipElsewhere((string) $displayBiosId, $license?->id)
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
            'reseller_role' => $license->reseller?->role?->value ?? ($license->reseller ? (string) $license->reseller->role : null),
            'bios_id' => $license->bios_id,
            'external_username' => $license->external_username,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'start_at' => ($license->scheduled_at ?? $license->activated_at)?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'duration_days' => (float) $license->duration_days,
            'price' => CustomerOwnership::displayPriceForLicense($license),
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
        $countryName = isset($filters['country_name']) && is_string($filters['country_name']) ? trim($filters['country_name']) : '';

        if ($countryName !== '' && $user->country_name !== $countryName) {
            return false;
        }

        if (! $license) {
            return in_array($status, ['', 'all', 'pending'], true) && ! $this->hasScopedLicenseFilters($filters);
        }

        if ($status === '' || $status === 'all') {
            return true;
        }

        return $this->displayLicenseMatchesStatus($license, $status);
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
        return ! empty($filters['program_id']) || ! empty($filters['reseller_id']);
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

    /**
     * @return array<int, string>
     */
    private function linkedUsernamesForBiosSearch(string $search, int $tenantId): array
    {
        $term = strtolower(trim($search));
        if ($term === '') {
            return [];
        }

        return BiosUsernameLink::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(bios_id) like ?', ['%'.$term.'%'])
            ->pluck('username')
            ->filter()
            ->all();
    }

    /**
     * @param Collection<int, User> $users
     * @return array<string, string>
     */
    private function biosLinkMapForUsers(Collection $users, int $tenantId): array
    {
        $usernames = $users
            ->pluck('username')
            ->filter(fn ($username): bool => is_string($username) && $username !== '')
            ->values();

        if ($usernames->isEmpty()) {
            return [];
        }

        return BiosUsernameLink::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('username', $usernames->all())
            ->get(['username', 'bios_id'])
            ->mapWithKeys(fn (BiosUsernameLink $link): array => [strtolower((string) $link->username) => (string) $link->bios_id])
            ->all();
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
     * @param  array{manager_parent_id:?int,manager_id:?int,reseller_id:?int}  $validated
     * @return array{seller_ids: array<int, int>}
     */
    private function resolveSellerScope(int $tenantId, array $validated): array
    {
        $team = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->select(['id', 'role', 'created_by'])
            ->get();

        $managerParents = $team->where('role', UserRole::MANAGER_PARENT->value)->values();
        $managers = $team->where('role', UserRole::MANAGER->value)->values();
        $resellers = $team->where('role', UserRole::RESELLER->value)->values();

        if ($validated['reseller_id']) {
            $reseller = $resellers->firstWhere('id', $validated['reseller_id']);
            if (! $reseller) {
                throw ValidationException::withMessages(['reseller_id' => 'The selected reseller is invalid for this tenant.']);
            }

            return [
                'seller_ids' => [(int) $reseller->id],
            ];
        }

        if ($validated['manager_id']) {
            $manager = $managers->firstWhere('id', $validated['manager_id']);
            if (! $manager) {
                throw ValidationException::withMessages(['manager_id' => 'The selected manager is invalid for this tenant.']);
            }

            $scopedSellers = collect([$manager])
                ->merge($resellers->where('created_by', $manager->id)->values())
                ->unique('id')
                ->values();

            return [
                'seller_ids' => $scopedSellers->pluck('id')->map(fn ($id): int => (int) $id)->all(),
            ];
        }

        if ($validated['manager_parent_id']) {
            $managerParent = $managerParents->firstWhere('id', $validated['manager_parent_id']);
            if (! $managerParent) {
                throw ValidationException::withMessages(['manager_parent_id' => 'The selected manager parent is invalid for this tenant.']);
            }

            $managedManagers = $managers->where('created_by', $managerParent->id)->values();
            $managedManagerIds = $managedManagers->pluck('id')->map(fn ($id): int => (int) $id)->all();
            $scopedSellers = collect([$managerParent])
                ->merge($managedManagers)
                ->merge($resellers->where('created_by', $managerParent->id)->values())
                ->merge($resellers->filter(fn (User $reseller): bool => in_array((int) $reseller->created_by, $managedManagerIds, true))->values())
                ->unique('id')
                ->values();

            return [
                'seller_ids' => $scopedSellers->pluck('id')->map(fn ($id): int => (int) $id)->all(),
            ];
        }

        return [
            'seller_ids' => $team->pluck('id')->map(fn ($id): int => (int) $id)->all(),
        ];
    }
}
