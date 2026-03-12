<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);

        return response()->json([
            'data' => Cache::remember($this->cacheKey($managerId, 'index', $validated), now()->addSeconds(90), function () use ($request, $tenantId, $sellerIds, $validated): array {
                $summary = $this->baseQuery($tenantId, $sellerIds, $validated)
                    ->selectRaw('ROUND(COALESCE(SUM(price), 0), 2) as total_revenue, COUNT(*) as total_activations')
                    ->first();

                $activeCustomers = (int) License::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('reseller_id', $sellerIds)
                    ->whereEffectivelyActive()
                    ->whereNotNull('customer_id')
                    ->distinct('customer_id')
                    ->count('customer_id');

                $revenueByReseller = $this->baseQuery($tenantId, $sellerIds, $validated)
                    ->leftJoin('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
                    ->selectRaw("COALESCE(resellers.name, 'Unknown') as reseller, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
                    ->groupBy('licenses.reseller_id', 'resellers.name')
                    ->orderByDesc('revenue')
                    ->get()
                    ->map(fn ($row): array => [
                        'reseller' => (string) $row->reseller,
                        'revenue' => round((float) $row->revenue, 2),
                        'activations' => (int) $row->activations,
                    ])
                    ->values()
                    ->all();

                $revenueByProgram = $this->baseQuery($tenantId, $sellerIds, $validated)
                    ->leftJoin('programs', 'programs.id', '=', 'licenses.program_id')
                    ->selectRaw("COALESCE(programs.name, 'Unknown') as program, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
                    ->groupBy('licenses.program_id', 'programs.name')
                    ->orderByDesc('revenue')
                    ->get()
                    ->map(fn ($row): array => [
                        'program' => (string) $row->program,
                        'revenue' => round((float) $row->revenue, 2),
                        'activations' => (int) $row->activations,
                    ])
                    ->values()
                    ->all();

                return [
                    'summary' => [
                        'total_revenue' => round((float) ($summary?->total_revenue ?? 0), 2),
                        'total_activations' => (int) ($summary?->total_activations ?? 0),
                        'total_customers' => $this->teamCustomersQuery($request)->count(),
                        'active_customers' => $activeCustomers,
                        'active_licenses' => $activeCustomers,
                    ],
                    'revenue_by_reseller' => $revenueByReseller,
                    'revenue_by_program' => $revenueByProgram,
                    'monthly_revenue' => $this->monthlyRevenue($tenantId, $sellerIds, $validated),
                    'reseller_balances' => $this->resellerBalances($tenantId, $sellerIds, $validated),
                ];
            }),
        ]);
    }

    public function activationRate(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);

        $totals = Cache::remember($this->cacheKey($managerId, 'activation-rate', $validated), now()->addSeconds(90), function () use ($tenantId, $sellerIds, $validated) {
            return $this->baseQuery($tenantId, $sellerIds, $validated)
                ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as success, SUM(CASE WHEN status IN ('pending', 'suspended') THEN 1 ELSE 0 END) as failure")
                ->first();
        });

        $total = max((int) ($totals?->total ?? 0), 1);
        $success = (int) ($totals?->success ?? 0);
        $failure = (int) ($totals?->failure ?? 0);

        return response()->json([
            'data' => [
                ['label' => 'Success', 'count' => $success, 'percentage' => round(($success / $total) * 100, 2)],
                ['label' => 'Failure', 'count' => $failure, 'percentage' => round(($failure / $total) * 100, 2)],
            ],
        ]);
    }

    public function retention(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);
        $managerId = $this->currentManager($request)->id;
        $sellerIds = $this->teamSellerIds($request);
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = Cache::remember($this->cacheKey($managerId, 'retention', $validated), now()->addSeconds(90), function () use ($tenantId, $sellerIds, $validated): array {
            return $this->baseQuery($tenantId, $sellerIds, $validated)
                ->whereNotNull('licenses.activated_at')
                ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
                ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, COUNT(DISTINCT licenses.customer_id) as customers, COUNT(*) as activations")
                ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
                ->get()
                ->mapWithKeys(fn ($row): array => [
                    (string) $row->month_key => [
                        'customers' => (int) $row->customers,
                        'activations' => (int) $row->activations,
                    ],
                ])
                ->all();
        });

        return response()->json([
            'data' => $months->map(function (CarbonImmutable $month) use ($grouped): array {
                $key = $month->format('Y-m');

                return [
                    'month' => $month->format('M Y'),
                    'customers' => (int) ($grouped[$key]['customers'] ?? 0),
                    'activations' => (int) ($grouped[$key]['activations'] ?? 0),
                ];
            })->values(),
        ]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $report = $this->index($request)->getData(true)['data'];
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'manager-tenant-financial.csv',
            'Manager Tenant Financial Report',
            $this->exportSections($report),
            $this->summaryLabels($report['summary']),
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    public function exportPdf(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $report = $this->index($request)->getData(true)['data'];
        $task = $exportTaskService->queue(
            $request,
            'pdf',
            'manager-tenant-financial.pdf',
            'Manager Tenant Financial Report',
            $this->exportSections($report),
            $this->summaryLabels($report['summary']),
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    /**
     * @return array{from:?string,to:?string}
     */
    private function validatedFilters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
        ];
    }

    private function baseQuery(int $tenantId, array $sellerIds, array $validated)
    {
        return License::query()
            ->from('licenses')
            ->where('licenses.tenant_id', $tenantId)
            ->whereIn('licenses.reseller_id', $sellerIds)
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function monthlyRevenue(int $tenantId, array $sellerIds, array $validated): array
    {
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = $this->baseQuery($tenantId, $sellerIds, $validated)
            ->whereNotNull('licenses.activated_at')
            ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
            ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
            ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
            ->pluck('revenue', 'month_key');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped[$month->format('Y-m')] ?? 0), 2),
        ])->values()->all();
    }

    private function resellerBalances(int $tenantId, array $sellerIds, array $validated): array
    {
        $balances = UserBalance::query()
            ->with('user:id,name')
            ->where('tenant_id', $tenantId)
            ->whereIn('user_id', $sellerIds)
            ->get();

        if ($balances->isNotEmpty()) {
            return $balances->map(fn (UserBalance $balance): array => [
                'id' => $balance->id,
                'reseller' => $balance->user?->name,
                'total_revenue' => round((float) $balance->total_revenue, 2),
                'total_activations' => $balance->total_activations,
                'avg_price' => $balance->total_activations > 0 ? round((float) $balance->total_revenue / $balance->total_activations, 2) : 0,
                'commission' => round((float) $balance->pending_balance, 2),
            ])->values()->all();
        }

        return User::query()
            ->whereIn('id', $sellerIds)
            ->get()
            ->map(function (User $seller) use ($tenantId, $validated): array {
                $totals = $this->baseQuery($tenantId, [$seller->id], $validated)
                    ->where('licenses.reseller_id', $seller->id)
                    ->selectRaw('ROUND(COALESCE(SUM(licenses.price), 0), 2) as total_revenue, COUNT(*) as total_activations')
                    ->first();

                $totalRevenue = round((float) ($totals?->total_revenue ?? 0), 2);
                $totalActivations = (int) ($totals?->total_activations ?? 0);

                return [
                    'id' => $seller->id,
                    'reseller' => $seller->name,
                    'total_revenue' => $totalRevenue,
                    'total_activations' => $totalActivations,
                    'avg_price' => $totalActivations > 0 ? round($totalRevenue / $totalActivations, 2) : 0,
                    'commission' => round($totalRevenue * 0.1, 2),
                ];
            })
            ->sortByDesc('total_revenue')
            ->values()
            ->all();
    }

    private function cacheKey(int $managerId, string $type, array $validated): string
    {
        return sprintf(
            'manager:%d:reports:v%d:%s:%s',
            $managerId,
            LicenseCacheInvalidation::reportVersion("manager:{$managerId}:reports:version"),
            $type,
            md5(json_encode($validated))
        );
    }

    /**
     * @param array<string, mixed> $report
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(array $report): array
    {
        return [
            [
                'title' => 'Summary',
                'headers' => ['Metric', 'Value'],
                'rows' => collect($this->summaryLabels($report['summary']))
                    ->map(fn ($value, $label): array => [$label, $value])
                    ->values()
                    ->all(),
            ],
            [
                'title' => 'Revenue by Reseller',
                'headers' => ['Reseller', 'Revenue', 'Activations'],
                'rows' => collect($report['revenue_by_reseller'])->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Revenue by Program',
                'headers' => ['Program', 'Revenue', 'Activations'],
                'rows' => collect($report['revenue_by_program'])->map(fn (array $row): array => [$row['program'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Reseller Balances',
                'headers' => ['Reseller', 'Revenue', 'Activations', 'Average Price', 'Commission'],
                'rows' => collect($report['reseller_balances'])->map(fn (array $row): array => [
                    $row['reseller'],
                    $row['total_revenue'],
                    $row['total_activations'],
                    $row['avg_price'],
                    $row['commission'],
                ])->all(),
            ],
        ];
    }

    /**
     * @param array<string, int|float> $summary
     * @return array<string, int|float>
     */
    private function summaryLabels(array $summary): array
    {
        return [
            'Total Revenue' => $summary['total_revenue'],
            'Total Customers' => $summary['total_customers'],
            'Active Customers' => $summary['active_customers'],
            'Total Activations' => $summary['total_activations'],
        ];
    }

    private function dateRangeLabel(Request $request): string
    {
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();

        if ($from !== '' && $to !== '') {
            return sprintf('Date range: %s to %s', $from, $to);
        }

        if ($from !== '') {
            return sprintf('From %s', $from);
        }

        if ($to !== '') {
            return sprintf('Until %s', $to);
        }

        return 'All time';
    }

    private function reportLanguage(Request $request): string
    {
        $lang = $request->query('lang', $request->header('Accept-Language', 'en'));

        return str_starts_with((string) $lang, 'ar') ? 'ar' : 'en';
    }
}
