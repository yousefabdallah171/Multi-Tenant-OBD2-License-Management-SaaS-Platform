<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use App\Services\ExportTaskService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => [
                'summary' => [
                    'total_revenue' => round((float) $licenses->sum('price'), 2),
                    'total_activations' => $licenses->count(),
                    'active_licenses' => $licenses->where('status', 'active')->count(),
                ],
                'revenue_by_reseller' => $licenses
                    ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
                    ->map(fn ($group, string $reseller): array => [
                        'reseller' => $reseller,
                        'revenue' => round((float) $group->sum('price'), 2),
                        'activations' => $group->count(),
                    ])
                    ->sortByDesc('revenue')
                    ->values(),
                'revenue_by_program' => $licenses
                    ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
                    ->map(fn ($group, string $program): array => [
                        'program' => $program,
                        'revenue' => round((float) $group->sum('price'), 2),
                        'activations' => $group->count(),
                    ])
                    ->sortByDesc('revenue')
                    ->values(),
                'monthly_revenue' => $this->monthlyRevenue($licenses),
                'reseller_balances' => $this->resellerBalances($licenses, $request),
            ],
        ]);
    }

    public function activationRate(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);
        $total = max($licenses->count(), 1);
        $success = $licenses->where('status', 'active')->count();
        $failure = $licenses->whereIn('status', ['pending', 'suspended'])->count();

        return response()->json([
            'data' => [
                ['label' => 'Success', 'count' => $success, 'percentage' => round(($success / $total) * 100, 2)],
                ['label' => 'Failure', 'count' => $failure, 'percentage' => round(($failure / $total) * 100, 2)],
            ],
        ]);
    }

    public function retention(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        return response()->json([
            'data' => $months->map(function (CarbonImmutable $month) use ($licenses): array {
                $monthly = $licenses->filter(fn (License $license): bool => $license->activated_at?->format('Y-m') === $month->format('Y-m'));

                return [
                    'month' => $month->format('M Y'),
                    'customers' => $monthly->pluck('customer_id')->filter()->unique()->count(),
                    'activations' => $monthly->count(),
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

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['reseller:id,name', 'program:id,name'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }

    private function monthlyRevenue($licenses)
    {
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = $licenses->groupBy(fn (License $license): string => $license->activated_at?->format('Y-m') ?? '');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped->get($month->format('Y-m'))?->sum('price') ?? 0), 2),
        ])->values();
    }

    private function resellerBalances($licenses, Request $request)
    {
        $balances = UserBalance::query()
            ->with('user:id,name')
            ->whereHas('user', fn ($query) => $query
                ->whereIn('role', ['manager_parent', 'manager', 'reseller'])
                ->where('tenant_id', $this->currentTenantId($request)))
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

        return User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->get()
            ->map(function ($seller) use ($licenses): array {
                $group = $licenses->where('reseller_id', $seller->id);

                return [
                    'id' => $seller->id,
                    'reseller' => $seller->name,
                    'total_revenue' => round((float) $group->sum('price'), 2),
                    'total_activations' => $group->count(),
                    'avg_price' => $group->count() > 0 ? round((float) $group->sum('price') / $group->count(), 2) : 0,
                    'commission' => round((float) $group->sum('price') * 0.1, 2),
                ];
            })
            ->sortByDesc('total_revenue')
            ->values();
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
            'Total Activations' => $summary['total_activations'],
            'Active Licenses' => $summary['active_licenses'],
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
