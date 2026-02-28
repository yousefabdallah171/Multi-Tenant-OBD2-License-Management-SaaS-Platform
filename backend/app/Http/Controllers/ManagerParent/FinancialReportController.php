<?php

namespace App\Http\Controllers\ManagerParent;

use App\Exports\ReportExporter;
use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinancialReportController extends BaseManagerParentController
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
                    ->map(fn ($group, string $reseller): array => ['reseller' => $reseller, 'revenue' => round((float) $group->sum('price'), 2), 'activations' => $group->count()])
                    ->sortByDesc('revenue')
                    ->values(),
                'revenue_by_program' => $licenses
                    ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
                    ->map(fn ($group, string $program): array => ['program' => $program, 'revenue' => round((float) $group->sum('price'), 2), 'activations' => $group->count()])
                    ->sortByDesc('revenue')
                    ->values(),
                'monthly_revenue' => $this->monthlyRevenue($licenses),
                'reseller_balances' => $this->resellerBalances($licenses, $request),
            ],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $report = $this->index($request)->getData(true)['data'];

        return app(ReportExporter::class)->toCsv('manager-parent-financial.csv', $this->exportSections($report));
    }

    public function exportPdf(Request $request)
    {
        $report = $this->index($request)->getData(true)['data'];

        return app(ReportExporter::class)->toPdf(
            'manager-parent-financial.pdf',
            'Manager Parent Financial Report',
            $this->exportSections($report),
            $this->summaryLabels($report['summary']),
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );
    }

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['program:id,name', 'reseller:id,name'])
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
            ->whereHas('user', fn ($query) => $query->where('role', UserRole::RESELLER->value)->where('tenant_id', $this->currentTenantId($request)))
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
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->get();

        return $resellers->map(function (User $reseller) use ($licenses): array {
            $group = $licenses->where('reseller_id', $reseller->id);

            return [
                'id' => $reseller->id,
                'reseller' => $reseller->name,
                'total_revenue' => round((float) $group->sum('price'), 2),
                'total_activations' => $group->count(),
                'avg_price' => $group->count() > 0 ? round((float) $group->sum('price') / $group->count(), 2) : 0,
                'commission' => round((float) $group->sum('price') * 0.1, 2),
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
