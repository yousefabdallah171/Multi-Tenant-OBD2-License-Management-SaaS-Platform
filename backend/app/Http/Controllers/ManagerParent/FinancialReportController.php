<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Services\SellerAccountingService;
use App\Services\ExportTaskService;
use App\Support\CustomerOwnership;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\RevenueAnalytics;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class FinancialReportController extends BaseManagerParentController
{
    public function __construct(
        private readonly SellerAccountingService $sellerAccountingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);
        $validated = $this->validatedFilters($request);
        $scope = $this->resolveSellerScope($tenantId, $validated);
        $activeCustomers = License::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('reseller_id', $scope['seller_ids'])
            ->whereEffectivelyActive()
            ->whereNotNull('customer_id')
            ->distinct('customer_id')
            ->count('customer_id');
        $baseQuery = $this->baseQuery($tenantId, $validated, $scope);
        $summary = $this->revenueQuery($tenantId, $validated, $scope)
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_revenue'))
            ->selectRaw(RevenueAnalytics::revenueSumExpression('granted', 'activity_logs', 'granted_value'))
            ->first();
        $totalActivations = (int) (clone $baseQuery)->count();
        $totalCustomers = CustomerOwnership::currentOwnedCustomerCount($scope['seller_ids'], $tenantId);
        $revenueByReseller = $this->revenueQuery($tenantId, $validated, $scope)
            ->leftJoin('users as resellers', 'resellers.id', '=', 'activity_logs.user_id')
            ->selectRaw("COALESCE(resellers.name, 'Unknown') as reseller")
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->selectRaw(RevenueAnalytics::revenueCountExpression('earned', 'activity_logs', 'activations'))
            ->groupBy('activity_logs.user_id', 'resellers.name')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row): array => [
                'reseller' => (string) $row->reseller,
                'revenue' => round((float) $row->revenue, 2),
                'activations' => (int) $row->activations,
            ])
            ->values()
            ->all();
        $programRows = $this->revenueQuery($tenantId, $validated, $scope)
            ->selectRaw(RevenueAnalytics::programIdExpression('activity_logs').' as program_id')
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->selectRaw(RevenueAnalytics::revenueCountExpression('earned', 'activity_logs', 'activations'))
            ->groupByRaw(RevenueAnalytics::programIdExpression('activity_logs'))
            ->orderByDesc('revenue')
            ->get()
            ->filter(fn ($row): bool => (int) ($row->program_id ?? 0) > 0)
            ->values();
        $programNames = \App\Models\Program::query()
            ->whereIn('id', $programRows->pluck('program_id')->all())
            ->pluck('name', 'id');
        $revenueByProgram = $programRows
            ->map(fn ($row): array => [
                'program' => (string) ($programNames->get((int) $row->program_id) ?? 'Unknown'),
                'revenue' => round((float) $row->revenue, 2),
                'activations' => (int) $row->activations,
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'summary' => [
                    'total_revenue' => round((float) ($summary?->total_revenue ?? 0), 2),
                    'granted_value' => round((float) ($summary?->granted_value ?? 0), 2),
                    'total_activations' => $totalActivations,
                    'total_customers' => $totalCustomers,
                    'active_customers' => $activeCustomers,
                    'active_licenses' => $activeCustomers,
                ],
                'revenue_by_reseller' => $revenueByReseller,
                'revenue_by_program' => $revenueByProgram,
                'monthly_revenue' => $this->monthlyRevenue($tenantId, $validated, $scope),
                'reseller_balances' => $this->resellerBalances($validated, $scope),
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

    /**
     * @return array{from:?string,to:?string,manager_parent_id:?int,manager_id:?int,reseller_id:?int}
     */
    private function validatedFilters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
        ]);

        return [
            'from' => ! empty($validated['from']) ? (string) $validated['from'] : null,
            'to' => ! empty($validated['to']) ? (string) $validated['to'] : null,
            'manager_parent_id' => ! empty($validated['manager_parent_id']) ? (int) $validated['manager_parent_id'] : null,
            'manager_id' => ! empty($validated['manager_id']) ? (int) $validated['manager_id'] : null,
            'reseller_id' => ! empty($validated['reseller_id']) ? (int) $validated['reseller_id'] : null,
        ];
    }

    private function baseQuery(int $tenantId, array $validated, array $scope): Builder
    {
        return License::query()
            ->where('licenses.tenant_id', $tenantId)
            ->whereIn('licenses.reseller_id', $scope['seller_ids'])
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function monthlyRevenue(int $tenantId, array $validated, array $scope)
    {
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = $this->revenueQuery($tenantId, $validated, $scope)
            ->where('activity_logs.created_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
            ->selectRaw(RevenueAnalytics::monthKeyExpression('activity_logs', 'created_at').' as month_key')
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
            ->groupByRaw(RevenueAnalytics::monthKeyExpression('activity_logs', 'created_at'))
            ->pluck('revenue', 'month_key');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped->get($month->format('Y-m')) ?? 0), 2),
        ])->values();
    }

    private function resellerBalances(array $validated, array $scope)
    {
        $sellers = $scope['sellers'];
        $accountingBySeller = $this->sellerAccountingService->summariesForSellers($sellers);

        return $sellers->map(function (User $seller) use ($validated, $accountingBySeller): array {
            $totals = RevenueAnalytics::baseQuery($validated, (int) $seller->tenant_id, null, $seller->id)
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_revenue'))
                ->first();
            $totalActivations = (int) License::query()
                ->where('tenant_id', $seller->tenant_id)
                ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
                ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']))
                ->where('reseller_id', $seller->id)
                ->count();
            $totalRevenue = round((float) ($totals?->total_revenue ?? 0), 2);
            $accounting = $accountingBySeller[(int) $seller->id] ?? [
                'still_not_paid' => 0.0,
            ];

            return [
                'id' => $seller->id,
                'reseller' => $seller->name,
                'role' => $seller->role?->value ?? (string) $seller->role,
                'total_revenue' => $totalRevenue,
                'total_activations' => $totalActivations,
                'avg_price' => $totalActivations > 0 ? round($totalRevenue / $totalActivations, 2) : 0,
                'still_not_paid' => round((float) $accounting['still_not_paid'], 2),
            ];
        })->sortByDesc('still_not_paid')->values();
    }

    private function revenueQuery(int $tenantId, array $validated, array $scope)
    {
        return RevenueAnalytics::baseQuery($validated, $tenantId, $scope['seller_ids']);
    }

    /**
     * @param  array{manager_parent_id:?int,manager_id:?int,reseller_id:?int}  $validated
     * @return array{seller_ids: array<int, int>, sellers: Collection<int, User>}
     */
    private function resolveSellerScope(int $tenantId, array $validated): array
    {
        $team = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->select(['id', 'tenant_id', 'name', 'role', 'created_by'])
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
                'sellers' => collect([$reseller]),
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
                'sellers' => $scopedSellers,
            ];
        }

        if ($validated['manager_parent_id']) {
            $managerParent = $managerParents->firstWhere('id', $validated['manager_parent_id']);
            if (! $managerParent) {
                throw ValidationException::withMessages(['manager_parent_id' => 'The selected manager parent is invalid for this tenant.']);
            }

            $managedManagers = $managers->where('created_by', $managerParent->id)->values();
            $managedManagerIds = $managedManagers->pluck('id')->all();
            $scopedSellers = collect([$managerParent])
                ->merge($managedManagers)
                ->merge($resellers->where('created_by', $managerParent->id)->values())
                ->merge($resellers->filter(fn (User $reseller): bool => in_array((int) $reseller->created_by, $managedManagerIds, true))->values())
                ->unique('id')
                ->values();

            return [
                'seller_ids' => $scopedSellers->pluck('id')->map(fn ($id): int => (int) $id)->all(),
                'sellers' => $scopedSellers,
            ];
        }

        return [
            'seller_ids' => $team->pluck('id')->map(fn ($id): int => (int) $id)->all(),
            'sellers' => $team->values(),
        ];
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
                'title' => 'Revenue by Seller',
                'headers' => ['Seller', 'Revenue', 'Activations'],
                'rows' => collect($report['revenue_by_reseller'])->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Revenue by Program',
                'headers' => ['Program', 'Revenue', 'Activations'],
                'rows' => collect($report['revenue_by_program'])->map(fn (array $row): array => [$row['program'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Still Not Paid by Seller',
                'headers' => ['Seller', 'Revenue', 'Activations', 'Average Price', 'Still Not Paid'],
                'rows' => collect($report['reseller_balances'])->map(fn (array $row): array => [
                    $row['reseller'],
                    $row['total_revenue'],
                    $row['total_activations'],
                    $row['avg_price'],
                    $row['still_not_paid'],
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
            'Granted Value' => $summary['granted_value'],
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
