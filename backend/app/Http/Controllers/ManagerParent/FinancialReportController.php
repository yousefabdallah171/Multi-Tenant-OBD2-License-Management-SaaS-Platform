<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use App\Services\ExportTaskService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialReportController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $activeCustomers = License::query()
            ->where('tenant_id', $tenantId)
            ->whereEffectivelyActive()
            ->whereNotNull('customer_id')
            ->distinct('customer_id')
            ->count('customer_id');
        $baseQuery = $this->baseQuery($tenantId, $validated);
        $summary = (clone $baseQuery)
            ->selectRaw('ROUND(COALESCE(SUM(licenses.price), 0), 2) as total_revenue, COUNT(*) as total_activations')
            ->first();
        $totalCustomers = User::query()
            ->where('tenant_id', $tenantId)
            ->where('role', UserRole::CUSTOMER->value)
            ->count();
        $revenueByReseller = (clone $baseQuery)
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

        return response()->json([
            'data' => [
                'summary' => [
                    'total_revenue' => round((float) ($summary?->total_revenue ?? 0), 2),
                    'total_activations' => (int) ($summary?->total_activations ?? 0),
                    'total_customers' => $totalCustomers,
                    'active_customers' => $activeCustomers,
                    'active_licenses' => $activeCustomers,
                ],
                'revenue_by_reseller' => $revenueByReseller,
                'revenue_by_program' => $revenueByProgram,
                'monthly_revenue' => $this->monthlyRevenue($this->baseQuery($tenantId, $validated)),
                'reseller_balances' => $this->resellerBalances($tenantId),
            ],
        ]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $report = $this->index($request)->getData(true)['data'];
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'manager-parent-financial.csv',
            'Manager Parent Financial Report',
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
            'manager-parent-financial.pdf',
            'Manager Parent Financial Report',
            $this->exportSections($report),
            $this->summaryLabels($report['summary']),
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    private function baseQuery(int $tenantId, array $validated): Builder
    {
        return License::query()
            ->where('licenses.tenant_id', $tenantId)
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function monthlyRevenue(Builder $baseQuery)
    {
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = (clone $baseQuery)
            ->whereNotNull('licenses.activated_at')
            ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
            ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
            ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
            ->pluck('revenue', 'month_key');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped->get($month->format('Y-m')) ?? 0), 2),
        ])->values();
    }

    private function resellerBalances(int $tenantId)
    {
        $balances = UserBalance::query()
            ->with('user:id,name')
            ->whereHas('user', fn ($query) => $query
                ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
                ->where('tenant_id', $tenantId))
            ->get();

        if ($balances->isNotEmpty()) {
            return $balances->map(fn (UserBalance $balance): array => [
                'id' => $balance->id,
                'reseller' => $balance->user?->name,
                'total_revenue' => round((float) $balance->total_revenue, 2),
                'total_activations' => $balance->total_activations,
                'avg_price' => $balance->total_activations > 0 ? round((float) $balance->total_revenue / $balance->total_activations, 2) : 0,
                'commission' => round((float) $balance->pending_balance, 2),
            ])->values();
        }

        $resellers = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->get();

        return $resellers->map(function (User $reseller): array {
            $totals = License::query()
                ->where('tenant_id', $reseller->tenant_id)
                ->where('reseller_id', $reseller->id)
                ->selectRaw('ROUND(COALESCE(SUM(price), 0), 2) as total_revenue, COUNT(*) as total_activations')
                ->first();
            $totalRevenue = round((float) ($totals?->total_revenue ?? 0), 2);
            $totalActivations = (int) ($totals?->total_activations ?? 0);

            return [
                'id' => $reseller->id,
                'reseller' => $reseller->name,
                'total_revenue' => $totalRevenue,
                'total_activations' => $totalActivations,
                'avg_price' => $totalActivations > 0 ? round($totalRevenue / $totalActivations, 2) : 0,
                'commission' => round($totalRevenue * 0.1, 2),
            ];
        })->sortByDesc('total_revenue')->values();
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
