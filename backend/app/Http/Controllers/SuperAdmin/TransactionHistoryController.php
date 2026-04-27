<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Program;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TransactionHistoryController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'role' => ['nullable', 'in:manager_parent,manager,reseller'],
            'seller_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sellers = User::query()
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->when(!empty($validated['tenant_id']), fn ($query) => $query->where('tenant_id', (int) $validated['tenant_id']))
            ->when(!empty($validated['role']), fn ($query) => $query->where('role', (string) $validated['role']))
            ->when(!empty($validated['seller_id']), fn ($query) => $query->whereKey((int) $validated['seller_id']))
            ->with('tenant:id,name')
            ->select(['id', 'name', 'email', 'role', 'tenant_id'])
            ->get()
            ->keyBy('id');

        if ($sellers->isEmpty()) {
            return response()->json([
                'data' => [],
                'summary' => [
                    'total_sales' => 0.0,
                    'total_events' => 0,
                    'total_sellers' => 0,
                    'total_customers' => 0,
                ],
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => (int) ($validated['per_page'] ?? 25),
                    'total' => 0,
                    'from' => null,
                    'to' => null,
                ],
            ]);
        }

        $sellerIds = $sellers->keys()->all();

        $events = ActivityLog::query()
            ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
            ->whereIn('user_id', $sellerIds)
            ->when(!empty($validated['tenant_id']), fn ($query) => $query->where('tenant_id', (int) $validated['tenant_id']))
            ->when(!empty($validated['from']), fn ($query) => $query->whereDate('created_at', '>=', (string) $validated['from']))
            ->when(!empty($validated['to']), fn ($query) => $query->whereDate('created_at', '<=', (string) $validated['to']))
            ->select(['id', 'user_id', 'tenant_id', 'action', 'metadata', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        $rows = $events
            ->map(fn (ActivityLog $event): array => $this->serializeEventRow($event, $sellers))
            ->filter(fn (array $row): bool => $row['sale_amount'] > 0)
            ->values();

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
                ->whereIn('id', $customerIds)
                ->select(['id', 'name', 'username'])
                ->get()
                ->keyBy('id');

        $programsById = $programIds === []
            ? collect()
            : Program::query()
                ->whereIn('id', $programIds)
                ->select(['id', 'name'])
                ->get()
                ->keyBy('id');

        $hydratedRows = $rows->map(function (array $row) use ($customersById, $programsById): array {
            $customer = (int) ($row['customer_id'] ?? 0) > 0 ? $customersById->get((int) $row['customer_id']) : null;
            $program = (int) ($row['program_id'] ?? 0) > 0 ? $programsById->get((int) $row['program_id']) : null;

            return [
                'id' => $row['id'],
                'action' => $row['action'],
                'seller_id' => $row['seller_id'],
                'seller_name' => $row['seller_name'],
                'seller_email' => $row['seller_email'],
                'seller_role' => $row['seller_role'],
                'tenant_id' => $row['tenant_id'],
                'tenant_name' => $row['tenant_name'],
                'customer_id' => $row['customer_id'],
                'customer_name' => $customer?->name ?? $row['customer_name'],
                'customer_username' => $customer?->username ?? $row['customer_username'],
                'bios_id' => $row['bios_id'],
                'program_id' => $row['program_id'],
                'program_name' => $program?->name ?? $row['program_name'],
                'country_name' => $row['country_name'],
                'sale_amount' => $row['sale_amount'],
                'attribution_type' => $row['attribution_type'],
                'sale_date' => $row['sale_date'],
                'license_id' => $row['license_id'],
            ];
        })->values();

        if (!empty($validated['search'])) {
            $search = mb_strtolower(trim((string) $validated['search']));
            $hydratedRows = $hydratedRows->filter(function (array $row) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['seller_name'] ?? ''),
                    (string) ($row['seller_email'] ?? ''),
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['customer_username'] ?? ''),
                    (string) ($row['bios_id'] ?? ''),
                    (string) ($row['program_name'] ?? ''),
                ]));

                return $haystack !== '' && str_contains($haystack, $search);
            })->values();
        }

        $totalSales = round((float) $hydratedRows->sum('sale_amount'), 2);
        $totalEvents = $hydratedRows->count();
        $totalSellers = $hydratedRows->pluck('seller_id')->unique()->count();
        $totalCustomers = $this->countDistinctCustomers($hydratedRows);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $paginator = $this->paginateCollection($hydratedRows, $page, $perPage);

        return response()->json([
            'data' => $paginator->getCollection()->values(),
            'summary' => [
                'total_sales' => $totalSales,
                'total_events' => $totalEvents,
                'total_sellers' => $totalSellers,
                'total_customers' => $totalCustomers,
            ],
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    private function serializeEventRow(ActivityLog $event, Collection $sellers): array
    {
        $seller = $sellers->get((int) $event->user_id);
        $role = $seller?->role?->value ?? (string) $seller?->role;

        return [
            'id' => $event->id,
            'action' => $event->action,
            'seller_id' => $seller?->id ?? 0,
            'seller_name' => $seller?->name ?? 'Unknown',
            'seller_email' => $seller?->email ?? '',
            'seller_role' => $role,
            'tenant_id' => $event->tenant_id,
            'tenant_name' => $seller?->tenant?->name,
            'customer_id' => $this->intOrNull($event->metadata['customer_id'] ?? null),
            'customer_name' => null,
            'customer_username' => (string) ($event->metadata['external_username'] ?? ''),
            'bios_id' => (string) ($event->metadata['bios_id'] ?? ''),
            'program_id' => $this->intOrNull($event->metadata['program_id'] ?? null),
            'program_name' => null,
            'country_name' => (string) ($event->metadata['country_name'] ?? ''),
            'sale_amount' => round((float) ($event->metadata['price'] ?? 0), 2),
            'attribution_type' => (string) ($event->metadata['attribution_type'] ?? 'earned'),
            'sale_date' => $event->created_at?->toIso8601String(),
            'license_id' => $this->intOrNull($event->metadata['license_id'] ?? null),
        ];
    }

    private function countDistinctCustomers(Collection $rows): int
    {
        return $rows->map(function (array $row): string {
            $customerId = (int) ($row['customer_id'] ?? 0);
            if ($customerId > 0) {
                return 'id:' . $customerId;
            }

            return 'fallback:' . mb_strtolower(trim((string) ($row['customer_username'] ?? ''))) . '|' . mb_strtolower(trim((string) ($row['bios_id'] ?? '')));
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
}
