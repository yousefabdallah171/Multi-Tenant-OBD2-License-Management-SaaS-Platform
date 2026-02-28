<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Tenant;
use App\Models\UserBalance;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinancialReportController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);
        $tenantCount = max(Tenant::query()->count(), 1);

        $summary = [
            'total_platform_revenue' => round((float) $licenses->sum('price'), 2),
            'total_activations' => $licenses->count(),
            'active_licenses' => $licenses->where('status', 'active')->count(),
            'avg_revenue_per_tenant' => round((float) $licenses->sum('price') / $tenantCount, 2),
        ];

        $revenueByTenant = $licenses
            ->groupBy(fn (License $license): string => $license->tenant?->name ?? 'Unknown')
            ->map(fn ($group, string $tenant): array => [
                'tenant' => $tenant,
                'revenue' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('revenue')
            ->values();

        $revenueByProgram = $licenses
            ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
            ->map(fn ($group, string $program): array => [
                'program' => $program,
                'revenue' => round((float) $group->sum('price'), 2),
                'activations' => $group->count(),
            ])
            ->sortByDesc('revenue')
            ->values();

        return response()->json([
            'data' => [
                'summary' => $summary,
                'revenue_by_tenant' => $revenueByTenant,
                'revenue_by_program' => $revenueByProgram,
                'monthly_revenue' => $this->monthlyRevenue($licenses),
                'reseller_balances' => $this->resellerBalances($licenses),
            ],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $report = $this->index($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($report): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Metric', 'Value']);

            foreach ($report['summary'] as $metric => $value) {
                fputcsv($handle, [$metric, $value]);
            }

            fputcsv($handle, []);
            fputcsv($handle, ['Tenant', 'Revenue']);

            foreach ($report['revenue_by_tenant'] as $row) {
                fputcsv($handle, [$row['tenant'], $row['revenue']]);
            }

            fclose($handle);
        }, 'super-admin-financial-report.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $report = $this->index($request)->getData(true)['data'];
        $rows = collect($report['revenue_by_tenant'])->map(fn (array $row): array => [$row['tenant'], $row['revenue']])->all();

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Super Admin Financial Report',
            'columns' => ['Tenant', 'Revenue'],
            'rows' => $rows,
        ])->render());

        return $pdf->download('super-admin-financial-report.pdf');
    }

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['tenant:id,name', 'program:id,name', 'reseller:id,name'])
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }

    private function monthlyRevenue($licenses)
    {
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = $licenses
            ->groupBy(fn (License $license): string => $license->activated_at?->format('Y-m') ?? '');

        return $months->map(fn (CarbonImmutable $month): array => [
            'month' => $month->format('M Y'),
            'revenue' => round((float) ($grouped->get($month->format('Y-m'))?->sum('price') ?? 0), 2),
        ])->values();
    }

    private function resellerBalances($licenses)
    {
        $balances = UserBalance::query()
            ->with(['user:id,name,role', 'tenant:id,name'])
            ->whereHas('user', fn ($query) => $query->where('role', UserRole::RESELLER->value))
            ->get();

        if ($balances->isNotEmpty()) {
            return $balances->map(fn (UserBalance $balance): array => [
                'id' => $balance->id,
                'reseller' => $balance->user?->name,
                'tenant' => $balance->tenant?->name,
                'total_revenue' => round((float) $balance->total_revenue, 2),
                'total_activations' => $balance->total_activations,
                'avg_price' => $balance->total_activations > 0 ? round((float) $balance->total_revenue / $balance->total_activations, 2) : 0,
                'balance' => round((float) $balance->pending_balance, 2),
            ])->values();
        }

        return $licenses
            ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
            ->map(fn ($group, string $reseller): array => [
                'id' => md5($reseller),
                'reseller' => $reseller,
                'tenant' => $group->first()?->tenant?->name,
                'total_revenue' => round((float) $group->sum('price'), 2),
                'total_activations' => $group->count(),
                'avg_price' => $group->count() > 0 ? round((float) $group->sum('price') / $group->count(), 2) : 0,
                'balance' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('total_revenue')
            ->values();
    }
}
