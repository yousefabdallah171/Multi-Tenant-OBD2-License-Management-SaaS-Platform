<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Program;
use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Models\User;
use App\Services\ResellerCommissionService;
use App\Services\SellerAccountingService;
use App\Support\RevenueAnalytics;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ResellerPaymentController extends BaseSuperAdminController
{
    public function __construct(private readonly SellerAccountingService $sellerAccountingService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
            'status' => ['nullable', 'in:unpaid,partial,paid'],
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
        ]);

        $period = isset($validated['period']) && is_string($validated['period']) && $validated['period'] !== '' ? $validated['period'] : null;
        $statusFilter = $validated['status'] ?? null;
        $sellerIds = $this->resolveScopedSellerIds($validated);
        $sellers = User::query()
            ->with('tenant:id,name')
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->whereIn('id', $sellerIds)
            ->select(['id', 'tenant_id', 'role', 'name', 'email', 'created_at', 'created_by'])
            ->orderBy('name')
            ->get();

        $rows = $period === null ? $this->allTimeRows($sellers, $statusFilter) : $this->periodRows($sellers, $period, $statusFilter);

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_owed' => round((float) $rows->sum('commission_owed'), 2),
                'total_outstanding' => round((float) $rows->sum(fn (array $row): float => min((float) ($row['outstanding'] ?? 0), 0)), 2),
                'total_collectible' => round((float) $rows->sum(fn (array $row): float => max((float) ($row['outstanding'] ?? 0), 0)), 2),
                'total_collected' => round(max(0, (float) $rows->sum('commission_owed') - (float) $rows->sum(fn (array $row): float => max((float) ($row['outstanding'] ?? 0), 0))), 2),
                'period' => $period ?? 'all',
            ],
        ]);
    }

    private function resolveScopedSellerIds(array $validated): array
    {
        $tenantId = ! empty($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;
        $base = User::query()
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId));

        if (! empty($validated['reseller_id'])) {
            $seller = (clone $base)
                ->whereKey((int) $validated['reseller_id'])
                ->select(['id', 'role'])
                ->first();
            $role = $seller?->role?->value ?? (string) $seller?->role;
            if (! $seller || ! in_array($role, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value], true)) {
                throw ValidationException::withMessages(['reseller_id' => 'The selected seller is invalid.']);
            }

            return [(int) $validated['reseller_id']];
        }

        if (! empty($validated['manager_id'])) {
            $manager = (clone $base)->where('role', UserRole::MANAGER->value)->find((int) $validated['manager_id']);
            if (! $manager) {
                throw ValidationException::withMessages(['manager_id' => 'The selected manager is invalid.']);
            }

            $resellerIds = (clone $base)
                ->where('role', UserRole::RESELLER->value)
                ->where('created_by', (int) $manager->id)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            return array_values(array_unique([(int) $manager->id, ...$resellerIds]));
        }

        if (! empty($validated['manager_parent_id'])) {
            $managerParent = (clone $base)->where('role', UserRole::MANAGER_PARENT->value)->find((int) $validated['manager_parent_id']);
            if (! $managerParent) {
                throw ValidationException::withMessages(['manager_parent_id' => 'The selected manager parent is invalid.']);
            }

            $managedManagerIds = (clone $base)
                ->where('role', UserRole::MANAGER->value)
                ->where('created_by', (int) $managerParent->id)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
            $resellerIds = (clone $base)
                ->where('role', UserRole::RESELLER->value)
                ->where(function ($query) use ($managerParent, $managedManagerIds): void {
                    $query->where('created_by', (int) $managerParent->id);

                    if ($managedManagerIds !== []) {
                        $query->orWhereIn('created_by', $managedManagerIds);
                    }
                })
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            return array_values(array_unique([(int) $managerParent->id, ...$managedManagerIds, ...$resellerIds]));
        }

        return User::query()
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $seller = $this->resolveSeller($user);
        $commissions = ResellerCommission::query()
            ->with(['manager:id,name,email', 'payments.manager:id,name,email', 'reseller:id,name,email'])
            ->where('tenant_id', $seller->tenant_id)
            ->where('reseller_id', $seller->id)
            ->orderByDesc('period')
            ->get();
        $payments = ResellerPayment::query()
            ->with(['manager:id,name,email', 'commission:id,period,status', 'reseller:id,name,email'])
            ->where('reseller_id', $seller->id)
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();
        $totalSales = round((float) (RevenueAnalytics::baseQuery([], $seller->tenant_id, null, $seller->id)
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
            ->first()?->total_sales ?? 0), 2);
        $totalPaid = round((float) $payments->sum('amount'), 2);
        $commissionsData = $commissions->map(fn (ResellerCommission $commission): array => $this->serializeCommission($commission))->values();

        if ($commissionsData->isEmpty()) {
            $commissionsData = collect([[
                'id' => 0,
                'reseller_id' => $seller->id,
                'reseller_name' => $seller->name,
                'period' => 'All Time',
                'total_sales' => $totalSales,
                'commission_rate' => 0.0,
                'commission_owed' => $totalSales,
                'amount_paid' => $totalPaid,
                'outstanding' => round($totalSales - $totalPaid, 2),
                'status' => $this->resolveComputedStatus($totalSales, $totalPaid),
                'notes' => null,
                'manager_name' => null,
                'created_at' => null,
                'updated_at' => null,
            ]]);
        }

        return response()->json([
            'data' => [
                'reseller' => [
                    'id' => $seller->id,
                    'tenant_id' => $seller->tenant_id,
                    'tenant_name' => $seller->tenant?->name,
                    'name' => $seller->name,
                    'email' => $seller->email,
                    'role' => $seller->role?->value ?? (string) $seller->role,
                    'created_at' => $seller->created_at?->toIso8601String(),
                ],
                'summary' => [
                    'total_sales' => $totalSales,
                    'total_owed' => round((float) ($commissions->isEmpty() ? $totalSales : $commissions->sum('commission_owed')), 2),
                    'total_paid' => $totalPaid,
                    'total_outstanding' => round((float) ($commissions->isEmpty() ? ($totalSales - $totalPaid) : $commissions->sum('outstanding')), 2),
                ],
                'commissions' => $commissionsData,
                'payments' => $payments->map(fn (ResellerPayment $payment): array => $this->serializePayment($payment))->values(),
            ],
        ]);
    }

    public function managerParentCustomers(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $managerParent = $this->resolveManagerParent($user);
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'program_id' => ['nullable', 'integer'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $filters = [
            'from' => ! empty($validated['from']) ? (string) $validated['from'] : null,
            'to' => ! empty($validated['to']) ? (string) $validated['to'] : null,
        ];

        $events = RevenueAnalytics::baseQuery($filters, (int) $managerParent->tenant_id, null, (int) $managerParent->id)
            ->whereRaw(RevenueAnalytics::earnedCondition())
            ->select(['activity_logs.metadata', 'activity_logs.created_at'])
            ->orderByDesc('activity_logs.created_at')
            ->get();

        $rows = $events
            ->map(fn ($event) => $this->serializeManagerParentEventRow(
                (array) ($event->metadata ?? []),
                $event->created_at?->toIso8601String()
            ))
            ->filter(fn (array $row): bool => $row['sale_amount'] > 0)
            ->values();

        if (! empty($validated['program_id'])) {
            $programId = (int) $validated['program_id'];
            $rows = $rows->filter(fn (array $row): bool => (int) ($row['program_id'] ?? 0) === $programId)->values();
        }

        $customerIds = $rows->pluck('customer_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
        $programIds = $rows->pluck('program_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $customersById = $customerIds === []
            ? collect()
            : User::query()
                ->where('tenant_id', $managerParent->tenant_id)
                ->whereIn('id', $customerIds)
                ->select(['id', 'name', 'username', 'country_name'])
                ->get()
                ->keyBy('id');
        $programsById = $programIds === []
            ? collect()
            : Program::query()
                ->where('tenant_id', $managerParent->tenant_id)
                ->whereIn('id', $programIds)
                ->select(['id', 'name'])
                ->get()
                ->keyBy('id');

        $hydratedRows = $rows->map(function (array $row) use ($customersById, $programsById): array {
            /** @var User|null $customer */
            $customer = (int) ($row['customer_id'] ?? 0) > 0
                ? $customersById->get((int) $row['customer_id'])
                : null;
            /** @var Program|null $program */
            $program = (int) ($row['program_id'] ?? 0) > 0
                ? $programsById->get((int) $row['program_id'])
                : null;

            return [
                'customer_id' => $row['customer_id'],
                'customer_name' => $customer?->name ?? $row['customer_name'],
                'customer_username' => $customer?->username ?? $row['customer_username'],
                'bios_id' => $row['bios_id'],
                'program_id' => $row['program_id'],
                'program_name' => $program?->name ?? $row['program_name'],
                'country_name' => $customer?->country_name ?? $row['country_name'],
                'sale_amount' => $row['sale_amount'],
                'sale_date' => $row['sale_date'],
                'license_id' => $row['license_id'],
            ];
        })->values();

        if (! empty($validated['country_name'])) {
            $countryFilter = mb_strtolower(trim((string) $validated['country_name']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($countryFilter): bool {
                $country = mb_strtolower(trim((string) ($row['country_name'] ?? '')));

                return $country !== '' && str_contains($country, $countryFilter);
            })->values();
        }

        if (! empty($validated['search'])) {
            $search = mb_strtolower(trim((string) $validated['search']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['customer_username'] ?? ''),
                    (string) ($row['bios_id'] ?? ''),
                    (string) ($row['program_name'] ?? ''),
                    (string) ($row['country_name'] ?? ''),
                ]));

                return $haystack !== '' && str_contains($haystack, $search);
            })->values();
        }

        $totalSales = round((float) $hydratedRows->sum('sale_amount'), 2);
        $totalEvents = $hydratedRows->count();
        $totalCustomers = $this->countDistinctCustomers($hydratedRows);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $paginator = $this->paginateCollection($hydratedRows, $page, $perPage);

        return response()->json([
            'data' => $paginator->getCollection()->values(),
            'summary' => [
                'total_sales' => $totalSales,
                'total_events' => $totalEvents,
                'total_customers' => $totalCustomers,
                'manager_parent' => [
                    'id' => (int) $managerParent->id,
                    'name' => (string) $managerParent->name,
                    'email' => (string) $managerParent->email,
                ],
            ],
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function managerCustomers(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $manager = $this->resolveSeller($user);
        $role = $manager->role?->value ?? (string) $manager->role;
        if ($role !== UserRole::MANAGER->value) {
            throw ValidationException::withMessages(['user' => 'The selected user is not a manager.']);
        }

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'program_id' => ['nullable', 'integer'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $filters = [
            'from' => ! empty($validated['from']) ? (string) $validated['from'] : null,
            'to' => ! empty($validated['to']) ? (string) $validated['to'] : null,
        ];

        $events = RevenueAnalytics::baseQuery($filters, (int) $manager->tenant_id, null, (int) $manager->id)
            ->whereRaw(RevenueAnalytics::earnedCondition())
            ->select(['activity_logs.metadata', 'activity_logs.created_at'])
            ->orderByDesc('activity_logs.created_at')
            ->get();

        $rows = $events
            ->map(fn ($event) => $this->serializeManagerParentEventRow(
                (array) ($event->metadata ?? []),
                $event->created_at?->toIso8601String()
            ))
            ->filter(fn (array $row): bool => $row['sale_amount'] > 0)
            ->values();

        if (! empty($validated['program_id'])) {
            $programId = (int) $validated['program_id'];
            $rows = $rows->filter(fn (array $row): bool => (int) ($row['program_id'] ?? 0) === $programId)->values();
        }

        $customerIds = $rows->pluck('customer_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
        $programIds = $rows->pluck('program_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $customersById = $customerIds === []
            ? collect()
            : User::query()
                ->where('tenant_id', $manager->tenant_id)
                ->whereIn('id', $customerIds)
                ->select(['id', 'name', 'username', 'country_name'])
                ->get()
                ->keyBy('id');
        $programsById = $programIds === []
            ? collect()
            : Program::query()
                ->where('tenant_id', $manager->tenant_id)
                ->whereIn('id', $programIds)
                ->select(['id', 'name'])
                ->get()
                ->keyBy('id');

        $hydratedRows = $rows->map(function (array $row) use ($customersById, $programsById): array {
            $customer = (int) ($row['customer_id'] ?? 0) > 0
                ? $customersById->get((int) $row['customer_id'])
                : null;
            $program = (int) ($row['program_id'] ?? 0) > 0
                ? $programsById->get((int) $row['program_id'])
                : null;

            return [
                'customer_id' => $row['customer_id'],
                'customer_name' => $customer?->name ?? $row['customer_name'],
                'customer_username' => $customer?->username ?? $row['customer_username'],
                'bios_id' => $row['bios_id'],
                'program_id' => $row['program_id'],
                'program_name' => $program?->name ?? $row['program_name'],
                'country_name' => $customer?->country_name ?? $row['country_name'],
                'sale_amount' => $row['sale_amount'],
                'sale_date' => $row['sale_date'],
                'license_id' => $row['license_id'],
            ];
        })->values();

        if (! empty($validated['country_name'])) {
            $countryFilter = mb_strtolower(trim((string) $validated['country_name']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($countryFilter): bool {
                $country = mb_strtolower(trim((string) ($row['country_name'] ?? '')));

                return $country !== '' && str_contains($country, $countryFilter);
            })->values();
        }

        if (! empty($validated['search'])) {
            $search = mb_strtolower(trim((string) $validated['search']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['customer_username'] ?? ''),
                    (string) ($row['bios_id'] ?? ''),
                    (string) ($row['program_name'] ?? ''),
                    (string) ($row['country_name'] ?? ''),
                ]));

                return $haystack !== '' && str_contains($haystack, $search);
            })->values();
        }

        $totalSales = round((float) $hydratedRows->sum('sale_amount'), 2);
        $totalEvents = $hydratedRows->count();
        $totalCustomers = $this->countDistinctCustomers($hydratedRows);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $paginator = $this->paginateCollection($hydratedRows, $page, $perPage);

        return response()->json([
            'data' => $paginator->getCollection()->values(),
            'summary' => [
                'total_sales' => $totalSales,
                'total_events' => $totalEvents,
                'total_customers' => $totalCustomers,
                'manager' => [
                    'id' => (int) $manager->id,
                    'name' => (string) $manager->name,
                    'email' => (string) $manager->email,
                ],
            ],
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function resellerCustomers(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $reseller = $this->resolveSeller($user);
        $role = $reseller->role?->value ?? (string) $reseller->role;
        if ($role !== UserRole::RESELLER->value) {
            throw ValidationException::withMessages(['user' => 'The selected user is not a reseller.']);
        }

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'program_id' => ['nullable', 'integer'],
            'country_name' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $filters = [
            'from' => ! empty($validated['from']) ? (string) $validated['from'] : null,
            'to' => ! empty($validated['to']) ? (string) $validated['to'] : null,
        ];

        $events = RevenueAnalytics::baseQuery($filters, (int) $reseller->tenant_id, null, (int) $reseller->id)
            ->whereRaw(RevenueAnalytics::earnedCondition())
            ->select(['activity_logs.metadata', 'activity_logs.created_at'])
            ->orderByDesc('activity_logs.created_at')
            ->get();

        $rows = $events
            ->map(fn ($event) => $this->serializeManagerParentEventRow(
                (array) ($event->metadata ?? []),
                $event->created_at?->toIso8601String()
            ))
            ->filter(fn (array $row): bool => $row['sale_amount'] > 0)
            ->values();

        if (! empty($validated['program_id'])) {
            $programId = (int) $validated['program_id'];
            $rows = $rows->filter(fn (array $row): bool => (int) ($row['program_id'] ?? 0) === $programId)->values();
        }

        $customerIds = $rows->pluck('customer_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
        $programIds = $rows->pluck('program_id')
            ->filter(fn ($id): bool => (int) $id > 0)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $customersById = $customerIds === []
            ? collect()
            : User::query()
                ->where('tenant_id', $reseller->tenant_id)
                ->whereIn('id', $customerIds)
                ->select(['id', 'name', 'username', 'country_name'])
                ->get()
                ->keyBy('id');
        $programsById = $programIds === []
            ? collect()
            : Program::query()
                ->where('tenant_id', $reseller->tenant_id)
                ->whereIn('id', $programIds)
                ->select(['id', 'name'])
                ->get()
                ->keyBy('id');

        $hydratedRows = $rows->map(function (array $row) use ($customersById, $programsById): array {
            $customer = (int) ($row['customer_id'] ?? 0) > 0
                ? $customersById->get((int) $row['customer_id'])
                : null;
            $program = (int) ($row['program_id'] ?? 0) > 0
                ? $programsById->get((int) $row['program_id'])
                : null;

            return [
                'customer_id' => $row['customer_id'],
                'customer_name' => $customer?->name ?? $row['customer_name'],
                'customer_username' => $customer?->username ?? $row['customer_username'],
                'bios_id' => $row['bios_id'],
                'program_id' => $row['program_id'],
                'program_name' => $program?->name ?? $row['program_name'],
                'country_name' => $customer?->country_name ?? $row['country_name'],
                'sale_amount' => $row['sale_amount'],
                'sale_date' => $row['sale_date'],
                'license_id' => $row['license_id'],
            ];
        })->values();

        if (! empty($validated['country_name'])) {
            $countryFilter = mb_strtolower(trim((string) $validated['country_name']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($countryFilter): bool {
                $country = mb_strtolower(trim((string) ($row['country_name'] ?? '')));

                return $country !== '' && str_contains($country, $countryFilter);
            })->values();
        }

        if (! empty($validated['search'])) {
            $search = mb_strtolower(trim((string) $validated['search']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['customer_username'] ?? ''),
                    (string) ($row['bios_id'] ?? ''),
                    (string) ($row['program_name'] ?? ''),
                    (string) ($row['country_name'] ?? ''),
                ]));

                return $haystack !== '' && str_contains($haystack, $search);
            })->values();
        }

        $totalSales = round((float) $hydratedRows->sum('sale_amount'), 2);
        $totalEvents = $hydratedRows->count();
        $totalCustomers = $this->countDistinctCustomers($hydratedRows);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $paginator = $this->paginateCollection($hydratedRows, $page, $perPage);

        return response()->json([
            'data' => $paginator->getCollection()->values(),
            'summary' => [
                'total_sales' => $totalSales,
                'total_events' => $totalEvents,
                'total_customers' => $totalCustomers,
                'reseller' => [
                    'id' => (int) $reseller->id,
                    'name' => (string) $reseller->name,
                    'email' => (string) $reseller->email,
                ],
            ],
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function storePayment(Request $request, ResellerCommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'commission_id' => ['nullable', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);
        $validated['payment_date'] = isset($validated['payment_date']) ? Carbon::parse((string) $validated['payment_date'])->toDateString() : now()->toDateString();
        $validated['payment_method'] = $validated['payment_method'] ?? 'bank_transfer';
        $seller = $this->resolveSeller(User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = isset($validated['commission_id']) ? $this->resolveCommission(ResellerCommission::query()->findOrFail((int) $validated['commission_id']), $seller) : null;

        $payment = $commissionService->recordPayment($commission, $request->user(), $validated);
        $this->logActivity($request, $seller, 'reseller.payment_recorded', sprintf('Super Admin recorded payment of $%s for %s.', number_format((float) $payment->amount, 2), $seller->name), $payment, $commission);

        return response()->json([
            'data' => $this->serializePayment($payment),
            'message' => 'Payment recorded successfully.',
        ], 201);
    }

    public function updatePayment(Request $request, ResellerPayment $resellerPayment, ResellerCommissionService $commissionService): JsonResponse
    {
        $payment = $this->resolvePayment($resellerPayment);
        $validated = $request->validate([
            'commission_id' => ['nullable', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);
        $validated['payment_date'] = isset($validated['payment_date']) ? Carbon::parse((string) $validated['payment_date'])->toDateString() : ($payment->payment_date?->toDateString() ?: now()->toDateString());
        $validated['payment_method'] = $validated['payment_method'] ?? ($payment->payment_method ?: 'bank_transfer');
        $seller = $this->resolveSeller(User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = isset($validated['commission_id']) ? $this->resolveCommission(ResellerCommission::query()->findOrFail((int) $validated['commission_id']), $seller) : null;
        abort_unless((int) $payment->reseller?->tenant_id === (int) $seller->tenant_id, 422, 'Payment and selected seller must belong to the same tenant.');

        $updatedPayment = $commissionService->updatePayment($payment, $request->user(), $validated);
        $this->logActivity($request, $seller, 'reseller.payment_updated', sprintf('Super Admin updated payment #%d for %s.', $updatedPayment->id, $seller->name), $updatedPayment, $commission);

        return response()->json([
            'data' => $this->serializePayment($updatedPayment),
            'message' => 'Payment updated successfully.',
        ]);
    }

    public function destroyPayment(Request $request, ResellerPayment $resellerPayment, ResellerCommissionService $commissionService): JsonResponse
    {
        $payment = $this->resolvePayment($resellerPayment);
        $payment->loadMissing('reseller:id,name,email,tenant_id');
        $seller = $this->resolveSeller($payment->reseller);
        $this->logActivity($request, $seller, 'reseller.payment_deleted', sprintf('Super Admin deleted payment #%d for %s.', $payment->id, $seller->name), $payment, $payment->commission);
        $commissionService->deletePayment($payment);

        return response()->json(['message' => 'Payment deleted successfully.']);
    }

    public function storeCommission(Request $request, ResellerCommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'total_sales' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'commission_owed' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);
        $seller = $this->resolveReseller(User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = $commissionService->storeCommission($validated, $request->user(), (int) $seller->tenant_id);
        $this->logActivity($request, $seller, 'reseller.commission_saved', sprintf('Super Admin saved commission for %s (%s).', $seller->name, $commission->period), null, $commission);

        return response()->json([
            'data' => $this->serializeCommission($commission),
            'message' => 'Commission saved successfully.',
        ]);
    }

    private function resolveSeller(?User $user): User
    {
        $role = $user?->role?->value ?? (string) $user?->role;
        abort_unless($user && in_array($role, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value], true), 404);

        return $user;
    }

    private function resolveReseller(User $user): User
    {
        $seller = $this->resolveSeller($user);
        abort_unless(($seller->role?->value ?? (string) $seller->role) === UserRole::RESELLER->value, 404);

        return $seller;
    }

    private function resolveManagerParent(User $user): User
    {
        $seller = $this->resolveSeller($user);
        abort_unless(($seller->role?->value ?? (string) $seller->role) === UserRole::MANAGER_PARENT->value, 404);

        return $seller;
    }

    private function resolveCommission(ResellerCommission $commission, User $seller): ResellerCommission
    {
        $commission->loadMissing('reseller:id,name,email,tenant_id,role');
        abort_unless((int) $commission->tenant_id === (int) $seller->tenant_id, 422, 'Commission tenant does not match selected seller.');
        abort_unless((int) $commission->reseller_id === (int) $seller->id, 422, 'Commission does not belong to the selected seller.');

        return $commission;
    }

    private function resolvePayment(ResellerPayment $payment): ResellerPayment
    {
        $payment->loadMissing('commission', 'reseller:id,name,email,tenant_id,role');
        $this->resolveSeller($payment->reseller);

        return $payment;
    }

    private function periodRange(string $period): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m', $period)->startOfMonth();

        return [$start, $start->endOfMonth()];
    }

    private function resolveComputedStatus(float $commissionOwed, float $amountPaid): string
    {
        if ($amountPaid <= 0) {
            return $commissionOwed > 0 ? 'unpaid' : 'paid';
        }

        return $amountPaid >= $commissionOwed ? 'paid' : 'partial';
    }

    private function serializeCommission(ResellerCommission $commission): array
    {
        return [
            'id' => $commission->id,
            'reseller_id' => $commission->reseller_id,
            'reseller_name' => $commission->reseller?->name,
            'period' => $commission->period,
            'total_sales' => round((float) $commission->total_sales, 2),
            'commission_rate' => round((float) $commission->commission_rate, 2),
            'commission_owed' => round((float) $commission->commission_owed, 2),
            'amount_paid' => round((float) $commission->amount_paid, 2),
            'outstanding' => round((float) $commission->outstanding, 2),
            'status' => (string) $commission->status,
            'notes' => $commission->notes,
            'manager_name' => $commission->manager?->name,
            'created_at' => $commission->created_at?->toIso8601String(),
            'updated_at' => $commission->updated_at?->toIso8601String(),
        ];
    }

    private function serializePayment(ResellerPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'commission_id' => $payment->commission_id,
            'period' => $payment->commission?->period,
            'reseller_id' => $payment->reseller_id,
            'reseller_name' => $payment->reseller?->name,
            'amount' => round((float) $payment->amount, 2),
            'payment_date' => $payment->payment_date?->toDateString(),
            'payment_method' => (string) $payment->payment_method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'manager_name' => $payment->manager?->name,
            'created_at' => $payment->created_at?->toIso8601String(),
            'updated_at' => $payment->updated_at?->toIso8601String(),
        ];
    }

    private function allTimeRows($sellers, ?string $statusFilter)
    {
        $accountingBySeller = $this->sellerAccountingService->summariesForSellers($sellers);
        $paymentsBySeller = ResellerPayment::query()
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->selectRaw('reseller_id, ROUND(COALESCE(SUM(amount), 0), 2) as total_paid')
            ->groupBy('reseller_id')
            ->pluck('total_paid', 'reseller_id');

        return $sellers->map(function (User $seller) use ($accountingBySeller, $paymentsBySeller): array {
            $role = $seller->role?->value ?? (string) $seller->role;
            $accounting = $accountingBySeller[(int) $seller->id] ?? ['total_sales' => 0.0, 'commission_rate' => 0.0, 'total_owed' => 0.0, 'total_paid' => 0.0, 'still_not_paid' => 0.0];
            $totalSales = round((float) $accounting['total_sales'], 2);
            $commissionRate = round((float) $accounting['commission_rate'], 2);
            $commissionOwed = round((float) $accounting['total_owed'], 2);
            $amountPaid = round((float) ($accounting['total_paid'] ?? 0), 2);
            $outstanding = round((float) $accounting['still_not_paid'], 2);

            if ($role !== UserRole::RESELLER->value) {
                $commissionRate = 0.0;
                $amountPaid = round((float) ($paymentsBySeller->get($seller->id, 0) ?? 0), 2);
                $commissionOwed = $totalSales;
                $outstanding = round($commissionOwed - $amountPaid, 2);
            }

            return [
                'tenant_id' => $seller->tenant_id,
                'tenant_name' => $seller->tenant?->name,
                'reseller_id' => $seller->id,
                'reseller_name' => $seller->name,
                'reseller_email' => $seller->email,
                'reseller_role' => $role,
                'period' => 'All Time',
                'commission_id' => null,
                'total_sales' => $totalSales,
                'commission_rate' => $commissionRate,
                'commission_owed' => $commissionOwed,
                'amount_paid' => $amountPaid,
                'outstanding' => $outstanding,
                'status' => $this->resolveComputedStatus($commissionOwed, $amountPaid),
                'created_at' => $seller->created_at?->toIso8601String(),
            ];
        })->filter(fn (array $row): bool => $statusFilter ? $row['status'] === $statusFilter : true)->values();
    }

    private function serializeManagerParentEventRow(array $metadata, ?string $saleDate): array
    {
        return [
            'customer_id' => $this->intOrNull($metadata['customer_id'] ?? null),
            'customer_name' => null,
            'customer_username' => (string) ($metadata['external_username'] ?? ''),
            'bios_id' => (string) ($metadata['bios_id'] ?? ''),
            'program_id' => $this->intOrNull($metadata['program_id'] ?? null),
            'program_name' => null,
            'country_name' => (string) ($metadata['country_name'] ?? ''),
            'sale_amount' => round((float) ($metadata['price'] ?? 0), 2),
            'sale_date' => $saleDate,
            'license_id' => $this->intOrNull($metadata['license_id'] ?? null),
        ];
    }

    private function countDistinctCustomers(Collection $rows): int
    {
        return $rows->map(function (array $row): string {
            $customerId = (int) ($row['customer_id'] ?? 0);
            if ($customerId > 0) {
                return 'id:'.$customerId;
            }

            return 'fallback:'.mb_strtolower(trim((string) ($row['customer_username'] ?? ''))).'|'.mb_strtolower(trim((string) ($row['bios_id'] ?? '')));
        })->filter(fn (string $key): bool => $key !== 'fallback:|')->unique()->count();
    }

    private function intOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $parsed = (int) $value;

        return $parsed > 0 ? $parsed : null;
    }

    private function periodRows($sellers, string $period, ?string $statusFilter)
    {
        [$start, $end] = $this->periodRange($period);
        $commissions = ResellerCommission::query()
            ->whereIn('tenant_id', $sellers->pluck('tenant_id')->unique())
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->where('period', $period)
            ->get()
            ->keyBy('reseller_id');
        $paymentsByReseller = ResellerPayment::query()
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->whereBetween('payment_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('reseller_id, ROUND(COALESCE(SUM(amount), 0), 2) as total_paid')
            ->groupBy('reseller_id')
            ->pluck('total_paid', 'reseller_id');

        return $sellers->map(function (User $seller) use ($commissions, $paymentsByReseller, $period, $start, $end): array {
            $role = $seller->role?->value ?? (string) $seller->role;
            $commission = $commissions->get($seller->id);
            $computedSales = RevenueAnalytics::baseQuery(['from' => $start->toDateString(), 'to' => $end->toDateString()], (int) $seller->tenant_id, null, (int) $seller->id)
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
                ->first();
            $totalSales = round((float) ($commission?->total_sales ?? ($computedSales?->total_sales ?? 0)), 2);
            $amountPaid = round((float) ($commission?->amount_paid ?? $paymentsByReseller->get($seller->id, 0)), 2);
            $commissionOwed = round((float) ($commission?->commission_owed ?? $totalSales), 2);
            $outstanding = round((float) ($commission?->outstanding ?? ($commissionOwed - $amountPaid)), 2);

            if ($role !== UserRole::RESELLER->value) {
                $amountPaid = round((float) ($paymentsByReseller->get($seller->id, 0) ?? 0), 2);
                $commissionOwed = $totalSales;
                $outstanding = round($commissionOwed - $amountPaid, 2);
            }

            return [
                'tenant_id' => $seller->tenant_id,
                'tenant_name' => $seller->tenant?->name,
                'reseller_id' => $seller->id,
                'reseller_name' => $seller->name,
                'reseller_email' => $seller->email,
                'reseller_role' => $role,
                'period' => $period,
                'commission_id' => $commission?->id,
                'total_sales' => $totalSales,
                'commission_rate' => round((float) ($commission?->commission_rate ?? 0), 2),
                'commission_owed' => $commissionOwed,
                'amount_paid' => $amountPaid,
                'outstanding' => $outstanding,
                'status' => $commission?->status ?? $this->resolveComputedStatus($commissionOwed, $amountPaid),
                'created_at' => $seller->created_at?->toIso8601String(),
            ];
        })->filter(fn (array $row): bool => $statusFilter ? $row['status'] === $statusFilter : true)->values();
    }

    private function logActivity(Request $request, User $seller, string $action, string $description, ?ResellerPayment $payment, ?ResellerCommission $commission): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $seller->tenant_id,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => [
                'reseller_id' => $seller->id,
                'commission_id' => $commission?->id,
                'payment_id' => $payment?->id,
                'amount' => $payment ? round((float) $payment->amount, 2) : null,
                'period' => $commission?->period,
                'source' => 'super_admin',
            ],
            'ip_address' => $request->ip(),
        ]);
    }
}
