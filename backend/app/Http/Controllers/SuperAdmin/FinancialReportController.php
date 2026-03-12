<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class FinancialReportController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $data = Cache::remember($this->cacheKey('financial-reports', $validated), now()->addSeconds(90), function () use ($validated): array {
            $tenantCount = max(Tenant::query()->count(), 1);
            $totalCustomers = User::query()
                ->where('role', UserRole::CUSTOMER->value)
                ->count();
            $activeCustomers = License::query()
                ->whereEffectivelyActive()
                ->whereNotNull('customer_id')
                ->distinct('customer_id')
                ->count('customer_id');
            $baseQuery = $this->baseQuery($validated);
            $summary = (clone $baseQuery)
                ->selectRaw('ROUND(COALESCE(SUM(licenses.price), 0), 2) as total_platform_revenue, COUNT(*) as total_activations')
                ->first();
            $revenueByTenant = (clone $baseQuery)
                ->leftJoin('tenants', 'tenants.id', '=', 'licenses.tenant_id')
                ->selectRaw("COALESCE(tenants.name, 'Unknown') as tenant, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
                ->groupBy('licenses.tenant_id', 'tenants.name')
                ->orderByDesc('revenue')
                ->get()
                ->map(fn ($row): array => [
                    'tenant' => (string) $row->tenant,
                    'revenue' => round((float) $row->revenue, 2),
                ])
                ->values()
                ->all();
            $revenueByProgram = (clone $baseQuery)
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
            $revenueBreakdownRows = (clone $baseQuery)
                ->leftJoin('tenants', 'tenants.id', '=', 'licenses.tenant_id')
                ->leftJoin('programs', 'programs.id', '=', 'licenses.program_id')
                ->selectRaw("COALESCE(tenants.name, 'Unknown') as tenant, COALESCE(programs.name, 'Unknown') as program, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
                ->groupBy('licenses.tenant_id', 'tenants.name', 'licenses.program_id', 'programs.name')
                ->orderBy('tenant')
                ->orderBy('program')
                ->get();
            $breakdownPrograms = $revenueBreakdownRows
                ->pluck('program')
                ->unique()
                ->values()
                ->all();
            $revenueBreakdown = $revenueBreakdownRows
                ->groupBy('tenant')
                ->map(function ($group, string $tenant) use ($breakdownPrograms): array {
                    $row = ['tenant' => $tenant];

                    foreach ($breakdownPrograms as $program) {
                        $programRow = $group->firstWhere('program', $program);
                        $row[$program] = round((float) ($programRow->revenue ?? 0), 2);
                    }

                    return $row;
                })
                ->values()
                ->all();

            return [
                'summary' => [
                    'total_platform_revenue' => round((float) ($summary?->total_platform_revenue ?? 0), 2),
                    'total_customers' => $totalCustomers,
                    'total_activations' => (int) ($summary?->total_activations ?? 0),
                    'active_licenses' => $activeCustomers,
                    'avg_revenue_per_tenant' => round((float) ($summary?->total_platform_revenue ?? 0) / $tenantCount, 2),
                ],
                'revenue_by_tenant' => $revenueByTenant,
                'revenue_by_program' => $revenueByProgram,
                'revenue_breakdown' => $revenueBreakdown,
                'revenue_breakdown_series' => $breakdownPrograms,
                'monthly_revenue' => $this->monthlyRevenue($this->baseQuery($validated)),
                'reseller_balances' => $this->resellerBalances($this->baseQuery($validated)),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $report = $this->index($request)->getData(true)['data'];
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'super-admin-financial-report.csv',
            'Super Admin Financial Report',
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
            'super-admin-financial-report.pdf',
            'Super Admin Financial Report',
            $this->exportSections($report),
            $this->summaryLabels($report['summary']),
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    private function baseQuery(array $validated): Builder
    {
        return License::query()
            ->from('licenses')
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function monthlyRevenue(Builder $baseQuery)
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = (clone $baseQuery)
            ->whereNotNull('licenses.activated_at')
            ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(11))
            ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
            ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
            ->pluck('revenue', 'month_key');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped->get($month->format('Y-m')) ?? 0), 2),
        ])->values();
    }

    private function resellerBalances(Builder $baseQuery)
    {
        return (clone $baseQuery)
            ->leftJoin('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'licenses.tenant_id')
            ->selectRaw("COALESCE(resellers.id, 0) as seller_id, COALESCE(resellers.name, 'Unassigned') as reseller, COALESCE(tenants.name, 'Unknown') as tenant, ROUND(COALESCE(SUM(licenses.price), 0), 2) as total_revenue, COUNT(*) as total_activations")
            ->groupBy('licenses.reseller_id', 'resellers.id', 'resellers.name', 'licenses.tenant_id', 'tenants.name')
            ->orderByDesc('total_revenue')
            ->get()
            ->map(fn ($row): array => [
                'id' => (int) $row->seller_id > 0 ? (int) $row->seller_id : md5(sprintf('%s|%s', $row->reseller, $row->tenant)),
                'reseller' => (string) $row->reseller,
                'tenant' => (string) $row->tenant,
                'total_revenue' => round((float) $row->total_revenue, 2),
                'total_activations' => (int) $row->total_activations,
                'avg_price' => (int) $row->total_activations > 0 ? round((float) $row->total_revenue / (int) $row->total_activations, 2) : 0,
                'balance' => round((float) $row->total_revenue, 2),
            ])
            ->values()
            ->all();
    }

    private function cacheKey(string $type, array $validated): string
    {
        return sprintf(
            'super-admin:%s:v%d:%s',
            $type,
            LicenseCacheInvalidation::reportVersion('super-admin:reports:version'),
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
                'title' => 'Revenue by Tenant',
                'headers' => ['Tenant', 'Revenue'],
                'rows' => collect($report['revenue_by_tenant'])->map(fn (array $row): array => [$row['tenant'], $row['revenue']])->all(),
            ],
            [
                'title' => 'Revenue by Program',
                'headers' => ['Program', 'Revenue', 'Activations'],
                'rows' => collect($report['revenue_by_program'])->map(fn (array $row): array => [$row['program'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Reseller Balances',
                'headers' => ['Reseller', 'Tenant', 'Revenue', 'Activations', 'Average Price', 'Balance'],
                'rows' => collect($report['reseller_balances'])->map(fn (array $row): array => [
                    $row['reseller'],
                    $row['tenant'],
                    $row['total_revenue'],
                    $row['total_activations'],
                    $row['avg_price'],
                    $row['balance'],
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
            'Total Platform Revenue' => $summary['total_platform_revenue'],
            'Total Customers' => $summary['total_customers'],
            'Total Activations' => $summary['total_activations'],
            'Active Customers' => $summary['active_licenses'],
            'Average Revenue per Tenant' => $summary['avg_revenue_per_tenant'],
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
