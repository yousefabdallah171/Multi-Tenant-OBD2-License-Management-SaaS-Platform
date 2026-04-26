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
use App\Models\UserBalance;
use App\Models\UserIpLog;
use App\Models\UserUsernameHistory;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use App\Services\BalanceService;
use App\Services\ExportTaskService;
use App\Services\ExternalApiService;
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
    private ?bool $supportsUserCountryName = null;

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
            ->select($this->customerUserListColumns())
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
            $historyUserIds = $this->userIdsFromUsernameHistorySearch((string) $validated['search'], $tenantId);
            $supportsCountryName = $this->supportsUserCountryName();
            $query->where(function ($builder) use ($validated, $linkedUsernames, $supportsCountryName, $historyUserIds): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%');

                if ($supportsCountryName) {
                    $builder->orWhere('country_name', 'like', '%'.$validated['search'].'%');
                }

                $builder
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);

                if (! empty($historyUserIds)) {
                    $builder->orWhereIn('id', $historyUserIds);
                }
            });
        }

        if ($this->supportsUserCountryName() && ! empty($validated['country_name'])) {
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
            ->select($this->customerUserListColumns())
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
            $supportsCountryName = $this->supportsUserCountryName();
            $historyUserIds = $this->userIdsFromUsernameHistorySearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $linkedUsernames, $supportsCountryName, $historyUserIds): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%');

                if ($supportsCountryName) {
                    $builder->orWhere('country_name', 'like', '%'.$validated['search'].'%');
                }

                $builder
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);

                if (! empty($historyUserIds)) {
                    $builder->orWhereIn('id', $historyUserIds);
                }
            });
        }

        $countries = $query->get()
            ->filter(fn (User $user): bool => $this->customerMatchesDisplayFilters($user, $validated))
            ->filter(fn (User $user): bool => $this->supportsUserCountryName() && filled($user->country_name))
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

    public function renameUsername(Request $request, User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $tenantId = $user->tenant_id !== null ? (int) $user->tenant_id : null;
        if ($tenantId === null) {
            throw ValidationException::withMessages([
                'username' => 'This customer does not belong to a tenant.',
            ]);
        }

        $hasLicenses = License::query()
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $user->id)
            ->exists();

        if (! $hasLicenses) {
            throw ValidationException::withMessages([
                'username' => 'This user is not a customer record (no licenses found).',
            ]);
        }

        $oldUsername = $this->normalizeUsername((string) ($user->username ?? ''));
        $newUsername = $this->normalizeUsername((string) $validated['username']);

        if ($newUsername === '') {
            throw ValidationException::withMessages([
                'username' => 'The username is invalid after normalization.',
            ]);
        }

        if ($oldUsername === '') {
            throw ValidationException::withMessages([
                'username' => 'This customer has no current username set and cannot be renamed.',
            ]);
        }

        if ($newUsername === $oldUsername) {
            return response()->json([
                'message' => 'Username is already up to date.',
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'username_locked' => (bool) $user->username_locked,
                    'username_history' => $this->usernameHistoryPayload($tenantId, (int) $user->id),
                ],
            ]);
        }

        $existsInUsers = User::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(username) = ?', [strtolower($newUsername)])
            ->whereKeyNot($user->id)
            ->exists();

        if ($existsInUsers) {
            throw ValidationException::withMessages([
                'username' => 'This username is already in use in the tenant.',
            ]);
        }

        // Block reuse only if a *different* customer previously held this username.
        // Allows reverting a customer to their own prior username (undo scenario).
        $existsInHistory = UserUsernameHistory::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(old_username) = ?', [strtolower($newUsername)])
            ->where('user_id', '!=', $user->id)
            ->exists();

        if ($existsInHistory) {
            throw ValidationException::withMessages([
                'username' => 'This username was previously used and cannot be reused.',
            ]);
        }

        $biosIds = License::query()
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $user->id)
            ->whereNotNull('bios_id')
            ->pluck('bios_id')
            ->filter(fn ($biosId): bool => is_string($biosId) && trim($biosId) !== '')
            ->map(fn (string $biosId): string => strtolower(trim($biosId)))
            ->unique()
            ->values();

        if ($biosIds->isEmpty()) {
            throw ValidationException::withMessages([
                'username' => 'This customer has no BIOS IDs and cannot be renamed safely.',
            ]);
        }

        $existingBiosLinks = BiosUsernameLink::query()
            ->whereIn('bios_id', $biosIds->all())
            ->get(['id', 'bios_id', 'username', 'tenant_id']);

        $crossTenantLink = $existingBiosLinks->first(function (BiosUsernameLink $link) use ($tenantId): bool {
            return $link->tenant_id !== null && (int) $link->tenant_id !== (int) $tenantId;
        });
        if ($crossTenantLink) {
            throw ValidationException::withMessages([
                'username' => 'This customer has BIOS links assigned to a different tenant. Manual data fix required.',
            ]);
        }

        $mismatchedLink = $existingBiosLinks->first(function (BiosUsernameLink $link) use ($oldUsername): bool {
            $linked = $this->normalizeUsername((string) ($link->username ?? ''));
            return $linked !== '' && strtolower($linked) !== strtolower($oldUsername);
        });
        if ($mismatchedLink) {
            throw ValidationException::withMessages([
                'username' => 'This customer has a BIOS link assigned to a different username. Manual data fix required.',
            ]);
        }

        $newUsernameLink = BiosUsernameLink::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(username) = ?', [strtolower($newUsername)])
            ->first(['bios_id', 'username', 'tenant_id']);

        if ($newUsernameLink && ! $biosIds->contains(strtolower((string) $newUsernameLink->bios_id))) {
            throw ValidationException::withMessages([
                'username' => sprintf('This username is permanently linked to BIOS ID %s and cannot be reassigned.', (string) $newUsernameLink->bios_id),
            ]);
        }

        $activeLicenses = License::query()
            ->with(['program:id,external_api_key_encrypted,external_api_base_url,external_software_id,tenant_id'])
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $user->id)
            ->whereIn('status', ['active', 'suspended'])
            ->whereNotNull('bios_id')
            ->get();

        $externalCandidates = $activeLicenses
            ->filter(function (License $license): bool {
                $program = $license->program;
                return $program !== null
                    && $program->external_software_id !== null
                    && $program->getDecryptedApiKey() !== null;
            })
            ->values();

        $activeDistinctBios = $externalCandidates
            ->pluck('bios_id')
            ->filter(fn ($biosId): bool => is_string($biosId) && trim($biosId) !== '')
            ->map(fn (string $biosId): string => strtolower(trim($biosId)))
            ->unique()
            ->values();

        if ($activeDistinctBios->count() > 1) {
            throw ValidationException::withMessages([
                'username' => 'This customer has multiple active BIOS IDs. Rename is blocked to avoid ambiguous external state.',
            ]);
        }

        $externalBiosIdLower = $activeDistinctBios->first();
        $externalBiosIdRaw = $externalCandidates->first()?->bios_id;
        $externalBiosIdRaw = is_string($externalBiosIdRaw) ? trim($externalBiosIdRaw) : '';

        if ($externalBiosIdLower !== null && ! $biosIds->contains($externalBiosIdLower)) {
            throw ValidationException::withMessages([
                'username' => 'External BIOS context could not be verified.',
            ]);
        }

        if ($externalBiosIdLower !== null && $externalBiosIdRaw === '') {
            throw ValidationException::withMessages([
                'username' => 'External BIOS context could not be verified.',
            ]);
        }

        /** @var ExternalApiService $externalApi */
        $externalApi = app(ExternalApiService::class);

        $softwareConfigs = $externalCandidates
            ->groupBy(fn (License $license): int => (int) $license->program->external_software_id)
            ->map(function ($licenses) use ($tenantId): array {
                /** @var License $first */
                $first = $licenses->first();
                $program = $first->program;

                return [
                    'software_id' => (int) $program->external_software_id,
                    'api_key' => (string) $program->getDecryptedApiKey(),
                    'base_url' => is_string($program->external_api_base_url) && trim($program->external_api_base_url) !== '' ? trim($program->external_api_base_url) : null,
                    'license_ids' => $licenses->pluck('id')->map(fn ($id): int => (int) $id)->values()->all(),
                    'program_ids' => $licenses->pluck('program_id')->map(fn ($id): int => (int) $id)->unique()->values()->all(),
                    'tenant_id' => (int) $tenantId,
                ];
            })
            ->values()
            ->all();

        $successfulRenames = [];
        $externalSummary = [];
        foreach ($softwareConfigs as $config) {
            $softwareId = (int) $config['software_id'];
            $apiKey = (string) $config['api_key'];
            $baseUrl = $config['base_url'];

            $activeUsers = $externalApi->getActiveUsers($softwareId, $baseUrl);
            if (! ($activeUsers['success'] ?? false)) {
                return response()->json([
                    'message' => 'External API verification failed. Operation canceled.',
                    'error' => [
                        'software_id' => $softwareId,
                        'step' => 'getActiveUsers',
                        'response' => $activeUsers,
                    ],
                ], 422);
            }

            $usersMap = is_array($activeUsers['data']['users'] ?? null) ? $activeUsers['data']['users'] : [];

            // Case-insensitive lookups: external API may store usernames in different casing
            // than what we have in DB (e.g. 'IRAQ26' vs 'iraq26'). Collect ALL matching keys.
            $oldUsernameVariants = array_values(array_filter(
                array_keys($usersMap),
                fn (string $k): bool => strtolower($k) === strtolower($oldUsername)
            ));
            $newUsernameMatchKey = null;
            foreach (array_keys($usersMap) as $k) {
                if (strtolower($k) === strtolower($newUsername)) {
                    $newUsernameMatchKey = $k;
                    break;
                }
            }

            $oldExternalBios = count($oldUsernameVariants) > 0 ? (string) $usersMap[$oldUsernameVariants[0]] : null;
            $existingBios = $newUsernameMatchKey !== null ? (string) $usersMap[$newUsernameMatchKey] : null;

            if ($existingBios !== null && strtolower(trim($existingBios)) !== (string) $externalBiosIdLower) {
                return response()->json([
                    'message' => 'New username already exists in external software. Operation canceled.',
                    'error' => [
                        'software_id' => $softwareId,
                        'step' => 'precheck',
                        'existing_bios_id' => $existingBios,
                        'expected_bios_id' => $externalBiosIdRaw,
                    ],
                ], 422);
            }

            $oldExistsExternally = $oldExternalBios !== null
                && strtolower(trim($oldExternalBios)) === (string) $externalBiosIdLower;

            // Deactivate every case-variant of the old username so no stale entries remain.
            $deactivate = ['success' => true, 'status_code' => 200, 'data' => ['response' => 'skipped_missing_old_username']];
            if ($oldExistsExternally) {
                foreach ($oldUsernameVariants as $variantKey) {
                    $deactivate = $externalApi->deactivateUser($apiKey, $variantKey, $baseUrl);
                    if (! ($deactivate['success'] ?? false)) {
                        $rollbackPrior = $this->rollbackExternalRenames($externalApi, $successfulRenames, $oldUsername, $newUsername, (string) $externalBiosIdRaw);

                        return response()->json([
                            'message' => 'External API rename failed. Operation canceled.',
                            'error' => [
                                'software_id' => $softwareId,
                                'step' => 'deactivateUser',
                                'variant' => $variantKey,
                                'old_username_exists' => $oldExistsExternally,
                                'response' => $deactivate,
                                'rollback_prior' => $rollbackPrior,
                            ],
                        ], 422);
                    }
                }
            }

            $activate = $externalApi->activateUser($apiKey, $newUsername, (string) $externalBiosIdRaw, $baseUrl);
            if (! ($activate['success'] ?? false)) {
                $rollbackSelf = $externalApi->activateUser($apiKey, $oldUsername, (string) $externalBiosIdRaw, $baseUrl);
                $rollbackPrior = $this->rollbackExternalRenames($externalApi, $successfulRenames, $oldUsername, $newUsername, (string) $externalBiosIdRaw);

                return response()->json([
                    'message' => 'External API rename failed. Operation canceled.',
                    'error' => [
                        'software_id' => $softwareId,
                        'step' => 'activateUser',
                        'response' => $activate,
                        'rollback_self' => $rollbackSelf,
                        'rollback_prior' => $rollbackPrior,
                    ],
                ], 422);
            }

            $successfulRenames[] = [
                'software_id' => $softwareId,
                'api_key' => $apiKey,
                'base_url' => $baseUrl,
            ];
            $externalSummary[] = [
                'software_id' => $softwareId,
                'deactivate' => $deactivate,
                'activate' => $activate,
            ];
        }

        DB::transaction(function () use ($request, $validated, $tenantId, $user, $oldUsername, $newUsername, $biosIds, $softwareConfigs, $externalSummary): void {
            UserUsernameHistory::query()->create([
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'old_username' => $oldUsername,
                'new_username' => $newUsername,
                'changed_by_user_id' => $request->user()?->id,
                'reason' => $validated['reason'] ?? null,
            ]);

            $user->forceFill([
                'username' => $newUsername,
                'username_locked' => true,
            ])->save();

            License::query()
                ->where('tenant_id', $tenantId)
                ->where('customer_id', $user->id)
                ->update(['external_username' => $newUsername]);

            foreach ($biosIds as $biosId) {
                BiosUsernameLink::updateOrCreate(
                    ['bios_id' => (string) $biosId],
                    ['tenant_id' => $tenantId, 'username' => $newUsername],
                );
            }

            ActivityLog::query()->create([
                'tenant_id' => $tenantId,
                'user_id' => $request->user()?->id,
                'action' => 'username.change',
                'description' => sprintf('Changed customer username from %s to %s.', $oldUsername, $newUsername),
                'metadata' => [
                    'customer_id' => $user->id,
                    'target_user_id' => $user->id,
                    'old_username' => $oldUsername,
                    'new_username' => $newUsername,
                    'reason' => $validated['reason'] ?? null,
                    'affected_license_ids' => collect($softwareConfigs)->flatMap(fn ($row) => $row['license_ids'] ?? [])->values()->all(),
                    'affected_program_ids' => collect($softwareConfigs)->flatMap(fn ($row) => $row['program_ids'] ?? [])->unique()->values()->all(),
                    'affected_software_ids' => collect($softwareConfigs)->pluck('software_id')->values()->all(),
                    'external' => $externalSummary,
                ],
                'ip_address' => $request->ip(),
            ]);
        });

        return response()->json([
            'message' => 'Username changed successfully.',
            'data' => [
                'id' => $user->id,
                'username' => $newUsername,
                'username_locked' => true,
                'username_history' => $this->usernameHistoryPayload($tenantId, (int) $user->id),
            ],
        ]);
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
                $query
                    ->where('user_id', $user->id)
                    ->orWhere('metadata->customer_id', $user->id)
                    ->orWhere('metadata->target_user_id', $user->id);
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
                'username_history' => $this->usernameHistoryPayload((int) $user->tenant_id, (int) $user->id),
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

        $customerPayload = [
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
        ];

        if ($this->supportsUserCountryName()) {
            $customerPayload['country_name'] = isset($validated['country_name']) ? trim((string) $validated['country_name']) ?: null : null;
        }

        $customer->fill($customerPayload);

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

        $customerIds = License::query()
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');

        $query = User::query()
            ->with('tenant')
            ->whereIn('id', $customerIds)
            ->select($this->customerUserListColumns())
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
            $supportsCountryName = $this->supportsUserCountryName();
            $historyUserIds = $this->userIdsFromUsernameHistorySearch((string) $validated['search'], $tenantId);
            $query->where(function ($builder) use ($validated, $linkedUsernames, $supportsCountryName, $historyUserIds): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%');

                if ($supportsCountryName) {
                    $builder->orWhere('country_name', 'like', '%'.$validated['search'].'%');
                }

                $builder
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery
                        ->where('bios_id', 'like', '%'.$validated['search'].'%'))
                    ->orWhereIn('username', $linkedUsernames);

                if (! empty($historyUserIds)) {
                    $builder->orWhereIn('id', $historyUserIds);
                }
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

    private function resolveExportDurationDays(?float $durationDays, ?string $startAt, ?string $expiryAt): string
    {
        $seconds = null;

        if ($startAt && $expiryAt) {
            try {
                $start = Carbon::parse($startAt);
                $expiry = Carbon::parse($expiryAt);
                if ($expiry->greaterThan($start)) {
                    $seconds = $expiry->diffInSeconds($start);
                }
            } catch (\Throwable) {
                // fall through to duration_days
            }
        }

        if ($seconds === null && $durationDays !== null && is_finite($durationDays) && $durationDays > 0) {
            $seconds = (int) ($durationDays * 86400);
        }

        if ($seconds === null || $seconds <= 0) {
            return '-';
        }

        $days = (int) ($seconds / 86400);
        $hours = (int) (($seconds % 86400) / 3600);

        if ($days > 0) {
            return "{$days} " . ($days === 1 ? 'Day' : 'Days');
        }

        if ($hours > 0) {
            return "{$hours} " . ($hours === 1 ? 'Hour' : 'Hours');
        }

        return '< 1 Hour';
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $validated = $request->validate([
            'client_name' => ['required', 'string', 'min:1', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'license_id' => ['nullable', 'integer', 'exists:licenses,id'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
        ]);

        $email = $this->resolveCustomerEmail($user, $validated['email'] ?? null, (int) $user->tenant_id);
        $this->ensureEmailAvailable($user, $email);

        DB::transaction(function () use ($user, $validated, $email): void {
            $user->fill([
                'client_name' => $validated['client_name'],
                'name' => $validated['client_name'],
                'email' => $email,
                'phone' => $this->normalizeCustomerPhone($validated['phone'] ?? null),
                'country_name' => $this->supportsUserCountryName()
                    ? (isset($validated['country_name']) ? trim((string) $validated['country_name']) ?: null : $user->country_name)
                    : $user->country_name,
            ])->save();

            if (array_key_exists('price', $validated)) {
                $license = $this->resolveEditableLicenseForPrice($user, isset($validated['license_id']) ? (int) $validated['license_id'] : null);
                $this->applySuperAdminPriceOverride($user, $license, round((float) $validated['price'], 2));
            } elseif (isset($validated['license_id'])) {
                $license = License::query()->find((int) $validated['license_id']);
                if ($license && (int) $license->customer_id === (int) $user->id) {
                    $this->refreshEditableLicenseCountry($user, $license);
                    LicenseCacheInvalidation::invalidateForLicense($license->fresh(['reseller:id,tenant_id,created_by']));
                }
            }
        });

        $user->load(['tenant', 'customerLicenses' => fn ($licenseQuery) => $licenseQuery
            ->select($this->licenseListColumns())
            ->with(['program:id,name', 'reseller:id,name,role'])]);

        return response()->json(['data' => $this->serializeCustomer($user, [], null, null, $this->safeBiosLinkMapForUsers(collect([$user]), $user->tenant_id))]);
    }

    private function resolveEditableLicenseForPrice(User $user, ?int $licenseId): License
    {
        $license = $licenseId !== null
            ? License::query()->find($licenseId)
            : License::query()
                ->where('customer_id', $user->id)
                ->orderByDesc('activated_at')
                ->orderByDesc('expires_at')
                ->first();

        if (! $license || (int) $license->customer_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'price' => 'The selected license does not belong to this customer.',
            ]);
        }

        return $license;
    }

    private function applySuperAdminPriceOverride(User $customer, License $license, float $newPrice): void
    {
        $oldPrice = CustomerOwnership::displayPriceForLicense($license);
        $license->loadMissing(['reseller']);

        $license->forceFill(['price' => $newPrice])->save();
        $revenueLogs = $this->resolveEditableRevenueLogs($license);

        if ($revenueLogs->isNotEmpty()) {
            $revenueLogs->each(function (ActivityLog $revenueLog) use ($customer, $newPrice, $oldPrice): void {
                $metadata = is_array($revenueLog->metadata) ? $revenueLog->metadata : [];
                $oldLoggedPrice = CustomerOwnership::sanitizeDisplayPrice($metadata['price'] ?? $oldPrice);
                $metadata['price'] = $newPrice;
                $metadata['country_name'] = $customer->country_name;
                $metadata['price_source'] = 'super_admin_override';
                $metadata['price_override_previous'] = $oldLoggedPrice;
                $revenueLog->forceFill(['metadata' => $metadata])->save();

                $this->applyBalanceDifference($revenueLog, round($newPrice - $oldLoggedPrice, 2));
            });

            // Clean up any duplicate synthetic logs that may have been created as fallbacks
            ActivityLog::query()
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($q) use ($license): void {
                    $q->whereJsonContains('metadata->license_id', $license->id)
                        ->orWhereRaw("JSON_EXTRACT(metadata, '$.license_id') = ?", [(int) $license->id]);
                })
                ->where('metadata->price_source', 'super_admin_override')
                ->where('id', '!=', $revenueLogs->max('id'))
                ->delete();
        } else {
            $syntheticRevenueLog = $this->createSyntheticRevenueLogForLicense($customer, $license, $newPrice);
            if ($syntheticRevenueLog) {
                $this->applyBalanceDifference($syntheticRevenueLog, $newPrice);
            }
        }

        $this->refreshEditableLicenseCountry($customer, $license);
        $this->recordSuperAdminCustomerActivity(
            auth()->user(),
            (int) $license->tenant_id,
            'customer.price_overridden',
            sprintf('Updated customer %s price for BIOS %s.', $customer->id, $license->bios_id),
            [
                'customer_id' => $customer->id,
                'license_id' => $license->id,
                'bios_id' => $license->bios_id,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
                'country_name' => $customer->country_name,
            ],
        );

        LicenseCacheInvalidation::invalidateForLicense($license->fresh(['reseller:id,tenant_id,created_by']));
    }

    /**
     * @return Collection<int, ActivityLog>
     */
    private function resolveEditableRevenueLogs(License $license): Collection
    {
        $earnedRevenueLogs = ActivityLog::query()
            ->whereIn('action', ['license.activated', 'license.renewed'])
            ->whereMetadataLicenseId((int) $license->id)
            ->where('metadata->attribution_type', BalanceService::TYPE_EARNED)
            ->orderBy('id')
            ->get();

        if ($earnedRevenueLogs->isNotEmpty()) {
            return $earnedRevenueLogs;
        }

        return ActivityLog::query()
            ->whereIn('action', ['license.activated', 'license.renewed'])
            ->whereMetadataLicenseId((int) $license->id)
            ->orderBy('id')
            ->get();
    }

    private function createSyntheticRevenueLogForLicense(User $customer, License $license, float $price): ?ActivityLog
    {
        if (! $license->activated_at) {
            return null;
        }

        $seller = $license->reseller;
        $sellerRole = $seller?->role?->value ?? ($seller ? (string) $seller->role : null);

        $log = new ActivityLog([
            'tenant_id' => $license->tenant_id,
            'user_id' => $seller?->id,
            'action' => 'license.activated',
            'description' => sprintf('Backfilled activation revenue for BIOS %s.', $license->bios_id),
            'metadata' => [
                'license_id' => $license->id,
                'customer_id' => $customer->id,
                'program_id' => $license->program_id,
                'bios_id' => $license->bios_id,
                'external_username' => $license->external_username,
                'price' => $price,
                'country_name' => $customer->country_name,
                'price_source' => 'super_admin_override_backfill',
                'seller_id' => $seller?->id,
                'seller_role' => $sellerRole,
                'owner_user_id' => $seller?->id,
                'owner_role' => $sellerRole,
                'actor_id' => $seller?->id,
                'actor_role' => $sellerRole,
                'attribution_type' => BalanceService::TYPE_EARNED,
            ],
            'ip_address' => request()?->ip(),
            'created_at' => $license->activated_at,
            'updated_at' => now(),
        ]);
        $log->save();

        return $log->fresh();
    }

    private function refreshEditableLicenseCountry(User $customer, License $license): void
    {
        ActivityLog::query()
            ->whereMetadataLicenseId((int) $license->id)
            ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled'])
            ->get()
            ->each(function (ActivityLog $log) use ($customer): void {
                $metadata = is_array($log->metadata) ? $log->metadata : [];
                $metadata['country_name'] = $customer->country_name;
                $log->forceFill(['metadata' => $metadata])->save();
            });
    }

    private function applyBalanceDifference(ActivityLog $revenueLog, float $difference): void
    {
        if ($difference === 0.0 || (int) $revenueLog->user_id <= 0) {
            return;
        }

        $balance = UserBalance::query()->firstOrCreate(
            [
                'user_id' => (int) $revenueLog->user_id,
            ],
            [
                'tenant_id' => (int) $revenueLog->tenant_id,
            ]
        );

        if ((int) $balance->tenant_id !== (int) $revenueLog->tenant_id) {
            $balance->tenant_id = (int) $revenueLog->tenant_id;
        }

        $metadata = is_array($revenueLog->metadata) ? $revenueLog->metadata : [];
        $isGranted = ($metadata['attribution_type'] ?? BalanceService::TYPE_EARNED) === BalanceService::TYPE_GRANTED;

        if ($isGranted) {
            $balance->granted_value = round((float) $balance->granted_value + $difference, 2);
        } else {
            $balance->total_revenue = round((float) $balance->total_revenue + $difference, 2);
            $balance->pending_balance = round((float) $balance->pending_balance + $difference, 2);
        }

        $balance->last_activity_at = now();
        $balance->save();
    }

    private function normalizeCustomerPhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $trimmed = trim($phone);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function recordSuperAdminCustomerActivity(?User $actor, int $tenantId, string $action, string $description, array $metadata = []): void
    {
        if (! $actor) {
            return;
        }

        ActivityLog::query()->create([
            'tenant_id' => $tenantId > 0 ? $tenantId : null,
            'user_id' => $actor->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => request()?->ip(),
        ]);
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
    private function customerUserListColumns(): array
    {
        $columns = ['id', 'tenant_id', 'name', 'client_name', 'username', 'email', 'phone', 'role', 'created_at'];

        if ($this->supportsUserCountryName()) {
            $columns[] = 'country_name';
        }

        return $columns;
    }

    private function supportsUserCountryName(): bool
    {
        return $this->supportsUserCountryName ??= Schema::hasColumn('users', 'country_name');
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
            'country_name' => $this->supportsUserCountryName() ? $user->country_name : null,
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

        if ($countryName !== '' && $this->supportsUserCountryName() && $user->country_name !== $countryName) {
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

    private function normalizeUsername(string $value): string
    {
        return Str::of($value)
            ->replaceMatches('/[^a-zA-Z0-9_]+/', '_')
            ->replaceMatches('/_+/', '_')
            ->trim('_')
            ->value();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function usernameHistoryPayload(int $tenantId, int $userId, int $limit = 25): array
    {
        return UserUsernameHistory::query()
            ->with(['changedBy:id,name,email'])
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (UserUsernameHistory $row): array => [
                'id' => $row->id,
                'old_username' => $row->old_username,
                'new_username' => $row->new_username,
                'reason' => $row->reason,
                'created_at' => $row->created_at?->toIso8601String(),
                'changed_by' => $row->changedBy ? [
                    'id' => $row->changedBy->id,
                    'name' => $row->changedBy->name,
                    'email' => $row->changedBy->email,
                ] : null,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, int>
     */
    private function userIdsFromUsernameHistorySearch(string $search, ?int $tenantId): array
    {
        $term = strtolower(trim($search));
        if ($term === '') {
            return [];
        }

        return UserUsernameHistory::query()
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereRaw('LOWER(old_username) like ?', ['%'.$term.'%'])
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param array<int, array{software_id:int, api_key:string, base_url:?string}> $successfulRenames
     * @return array<int, array<string, mixed>>
     */
    private function rollbackExternalRenames(ExternalApiService $externalApi, array $successfulRenames, string $oldUsername, string $newUsername, string $biosId): array
    {
        $results = [];
        foreach ($successfulRenames as $rename) {
            $apiKey = (string) ($rename['api_key'] ?? '');
            $baseUrl = $rename['base_url'] ?? null;
            $softwareId = (int) ($rename['software_id'] ?? 0);

            $results[] = [
                'software_id' => $softwareId,
                'deactivate_new' => $externalApi->deactivateUser($apiKey, $newUsername, $baseUrl),
                'activate_old' => $externalApi->activateUser($apiKey, $oldUsername, $biosId, $baseUrl),
            ];
        }

        return $results;
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
            $linkByBios = BiosUsernameLink::where('tenant_id', $tenantId)->where('bios_id', $biosIdLower)->first();
            if ($linkByBios && strtolower((string) $linkByBios->username) !== $usernameLower) {
                throw ValidationException::withMessages([
                    'bios_id' => 'This BIOS ID is permanently linked to a different username (' . $linkByBios->username . ').',
                ]);
            }

            // Username → BIOS: only block for new customers (existing may have had BIOS changed)
            if (! $existingCustomer) {
                $linkByUsername = BiosUsernameLink::where('tenant_id', $tenantId)->where('username', $usernameLower)
                    ->where('bios_id', '!=', $biosIdLower)
                    ->first();
                if ($linkByUsername) {
                    throw ValidationException::withMessages([
                        'customer_name' => 'This username is permanently linked to a different BIOS ID (' . $linkByUsername->bios_id . ').',
                    ]);
                }

                // Also check historical licenses — covers cases where BiosUsernameLink entry was cleaned up
                $historicalConflict = \App\Models\License::query()
                    ->where('tenant_id', $tenantId)
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
            $linkByBios = BiosUsernameLink::where('tenant_id', $tenantId)->where('bios_id', $biosIdLower)->first();
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
