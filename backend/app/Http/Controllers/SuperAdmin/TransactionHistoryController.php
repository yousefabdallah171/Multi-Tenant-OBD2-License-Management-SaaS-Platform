<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\Program;
use App\Models\User;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionHistoryController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search'    => ['nullable', 'string', 'max:255'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'seller_id' => ['nullable', 'integer'],
            'role'      => ['nullable', 'in:manager_parent,manager,reseller'],
            'from'      => ['nullable', 'date'],
            'to'        => ['nullable', 'date'],
            'page'      => ['nullable', 'integer', 'min:1'],
            'per_page'  => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $filters  = ['from' => $validated['from'] ?? null, 'to' => $validated['to'] ?? null];
        $tenantId = ! empty($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;

        $sellerIds = null;
        if (! empty($validated['seller_id'])) {
            $sellerIds = [(int) $validated['seller_id']];
        } elseif (! empty($validated['role'])) {
            $sellerIds = User::query()
                ->where('role', $validated['role'])
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        $events = RevenueAnalytics::baseQuery($filters, $tenantId, $sellerIds)
            ->leftJoin('users as sellers', 'sellers.id', '=', 'activity_logs.user_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'activity_logs.tenant_id')
            ->select([
                'activity_logs.id',
                'activity_logs.action',
                'activity_logs.metadata',
                'activity_logs.created_at',
                'activity_logs.user_id as seller_id',
                DB::raw("COALESCE(sellers.name, 'Unknown') as seller_name"),
                DB::raw("COALESCE(sellers.email, '') as seller_email"),
                DB::raw("COALESCE(sellers.role, '') as seller_role"),
                DB::raw("COALESCE(tenants.name, '') as tenant_name"),
            ])
            ->orderByDesc('activity_logs.created_at')
            ->limit(5000)
            ->get();

        $rows = $events->map(fn ($event): array => $this->serializeRow($event))->values();

        // Hydrate program names from DB
        $programIds = $rows->pluck('program_id')->filter(fn ($id): bool => (int) $id > 0)->map(fn ($id): int => (int) $id)->unique()->values()->all();
        $programsById = $programIds !== []
            ? Program::query()->whereIn('id', $programIds)->select(['id', 'name'])->get()->keyBy('id')
            : collect();

        // Hydrate customer names from DB
        $customerIds = $rows->pluck('customer_id')->filter(fn ($id): bool => (int) $id > 0)->map(fn ($id): int => (int) $id)->unique()->values()->all();
        $customersById = $customerIds !== []
            ? User::query()->whereIn('id', $customerIds)->select(['id', 'name', 'username'])->get()->keyBy('id')
            : collect();

        $rows = $rows->map(function (array $row) use ($programsById, $customersById): array {
            if ($row['program_id'] > 0 && $programsById->has($row['program_id'])) {
                $row['program_name'] = (string) $programsById->get($row['program_id'])->name;
            }
            if ($row['customer_id'] > 0 && $customersById->has($row['customer_id'])) {
                $customer = $customersById->get($row['customer_id']);
                $row['customer_name']     = (string) $customer->name;
                $row['customer_username'] = (string) ($customer->username ?? $row['customer_username']);
            }

            return $row;
        })->values();

        // PHP-level search
        if (! empty($validated['search'])) {
            $search = mb_strtolower(trim((string) $validated['search']));
            $rows   = $rows->filter(function (array $row) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['customer_name'] ?? ''),
                    (string) ($row['customer_username'] ?? ''),
                    (string) ($row['bios_id'] ?? ''),
                    (string) ($row['program_name'] ?? ''),
                ]));

                return $haystack !== '' && str_contains($haystack, $search);
            })->values();
        }

        $totalSales   = round((float) $rows->sum('amount'), 2);
        $totalEvents  = $rows->count();
        $totalSellers = $rows->pluck('seller_id')->filter()->unique()->count();

        $page      = (int) ($validated['page'] ?? 1);
        $perPage   = (int) ($validated['per_page'] ?? 25);
        $paginator = $this->paginateCollection($rows, $page, $perPage);

        return response()->json([
            'data'    => $paginator->getCollection()->values(),
            'summary' => [
                'total_events'  => $totalEvents,
                'total_sales'   => $totalSales,
                'total_sellers' => $totalSellers,
            ],
            'meta'    => $this->paginationMeta($paginator),
        ]);
    }

    public function sellers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'from'      => ['nullable', 'date'],
            'to'        => ['nullable', 'date'],
        ]);

        $filters  = ['from' => $validated['from'] ?? null, 'to' => $validated['to'] ?? null];
        $tenantId = ! empty($validated['tenant_id']) ? (int) $validated['tenant_id'] : null;

        $sellerIds = RevenueAnalytics::baseQuery($filters, $tenantId)
            ->whereNotNull('activity_logs.user_id')
            ->pluck('activity_logs.user_id')
            ->unique()
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->all();

        if ($sellerIds === []) {
            return response()->json(['data' => []]);
        }

        $sellers = User::query()
            ->whereIn('id', $sellerIds)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->select(['id', 'name', 'email', 'role'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => [
                'id'   => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? (string) $user->role,
            ]);

        return response()->json(['data' => $sellers]);
    }

    private function serializeRow(object $event): array
    {
        $metadata    = is_array($event->metadata) ? $event->metadata : (array) json_decode((string) ($event->metadata ?? '{}'), true);
        $programId   = (int) ($metadata['program_id'] ?? 0);
        $customerId  = $this->intOrNull($metadata['customer_id'] ?? null);

        return [
            'id'               => $event->id,
            'seller_id'        => $event->seller_id ? (int) $event->seller_id : null,
            'seller_name'      => (string) $event->seller_name,
            'seller_email'     => (string) $event->seller_email,
            'seller_role'      => (string) $event->seller_role,
            'tenant_name'      => (string) $event->tenant_name,
            'customer_id'      => $customerId,
            'customer_name'    => (string) ($metadata['customer_name'] ?? ''),
            'customer_username' => (string) ($metadata['external_username'] ?? ''),
            'bios_id'          => (string) ($metadata['bios_id'] ?? ''),
            'program_id'       => $programId,
            'program_name'     => (string) ($metadata['program_name'] ?? ''),
            'country_name'     => (string) ($metadata['country_name'] ?? ''),
            'country_code'     => $this->resolveCountryCode((string) ($metadata['country_name'] ?? '')),
            'amount'           => round((float) ($metadata['price'] ?? 0), 2),
            'type'             => $event->action === 'license.renewed' ? 'Renewal' : 'Activation',
            'sale_date'        => $event->created_at?->toIso8601String(),
            'license_id'       => $this->intOrNull($metadata['license_id'] ?? null),
        ];
    }

    private function intOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $parsed = (int) $value;

        return $parsed > 0 ? $parsed : null;
    }

    private function resolveCountryCode(string $name): string
    {
        if ($name === '') {
            return '';
        }
        $map = [
            'Iraq' => 'iq', 'Russia' => 'ru', 'United Arab Emirates' => 'ae',
            'Saudi Arabia' => 'sa', 'Lebanon' => 'lb', 'Dominican Republic' => 'do',
            'Panama' => 'pa', 'Ukraine' => 'ua', 'Belarus' => 'by',
            'United States' => 'us', 'USA' => 'us', 'Gambia' => 'gm',
            'Kuwait' => 'kw', 'Jordan' => 'jo', 'Egypt' => 'eg',
            'Turkey' => 'tr', 'Germany' => 'de', 'United Kingdom' => 'gb',
            'France' => 'fr', 'Spain' => 'es', 'Italy' => 'it',
            'Canada' => 'ca', 'Australia' => 'au', 'India' => 'in',
            'Pakistan' => 'pk', 'China' => 'cn', 'Japan' => 'jp',
            'South Korea' => 'kr', 'Brazil' => 'br', 'Mexico' => 'mx',
            'Argentina' => 'ar', 'Colombia' => 'co', 'Chile' => 'cl',
            'Nigeria' => 'ng', 'Ghana' => 'gh', 'Kenya' => 'ke',
            'South Africa' => 'za', 'Morocco' => 'ma', 'Algeria' => 'dz',
            'Tunisia' => 'tn', 'Libya' => 'ly', 'Yemen' => 'ye',
            'Oman' => 'om', 'Bahrain' => 'bh', 'Qatar' => 'qa',
            'Syria' => 'sy', 'Iran' => 'ir', 'Afghanistan' => 'af',
            'Kazakhstan' => 'kz', 'Uzbekistan' => 'uz', 'Azerbaijan' => 'az',
            'Georgia' => 'ge', 'Armenia' => 'am', 'Romania' => 'ro',
            'Bulgaria' => 'bg', 'Serbia' => 'rs', 'Croatia' => 'hr',
            'Poland' => 'pl', 'Hungary' => 'hu', 'Austria' => 'at',
            'Switzerland' => 'ch', 'Netherlands' => 'nl', 'Belgium' => 'be',
            'Portugal' => 'pt', 'Greece' => 'gr', 'Sweden' => 'se',
            'Norway' => 'no', 'Denmark' => 'dk', 'Finland' => 'fi',
            'Indonesia' => 'id', 'Malaysia' => 'my', 'Philippines' => 'ph',
            'Thailand' => 'th', 'Vietnam' => 'vn', 'Bangladesh' => 'bd',
            'Singapore' => 'sg', 'Israel' => 'il', 'Palestine' => 'ps',
            'Czech Republic' => 'cz', 'Slovakia' => 'sk', 'Lithuania' => 'lt',
            'Latvia' => 'lv', 'Estonia' => 'ee', 'Ireland' => 'ie',
            'Cyprus' => 'cy', 'New Zealand' => 'nz', 'Taiwan' => 'tw',
            'Hong Kong' => 'hk', 'Mongolia' => 'mn', 'Nepal' => 'np',
        ];

        return $map[$name] ?? '';
    }
}
