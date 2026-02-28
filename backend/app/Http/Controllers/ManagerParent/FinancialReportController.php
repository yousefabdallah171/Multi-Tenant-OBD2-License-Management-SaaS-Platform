<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use Barryvdh\DomPDF\Facade\Pdf;
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

        return response()->streamDownload(function () use ($report): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Metric', 'Value']);

            foreach ($report['summary'] as $metric => $value) {
                fputcsv($handle, [$metric, $value]);
            }

            fclose($handle);
        }, 'manager-parent-financial.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $report = $this->index($request)->getData(true)['data'];
        $rows = collect($report['revenue_by_reseller'])->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all();

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Manager Parent Financial Report',
            'columns' => ['Reseller', 'Revenue', 'Activations'],
            'rows' => $rows,
        ])->render());

        return $pdf->download('manager-parent-financial.pdf');
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
}
