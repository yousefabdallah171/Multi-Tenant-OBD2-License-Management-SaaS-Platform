<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends BaseManagerParentController
{
    public function revenueByReseller(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
                ->map(fn ($group, string $reseller): array => [
                    'reseller' => $reseller,
                    'revenue' => round((float) $group->sum('price'), 2),
                    'activations' => $group->count(),
                ])
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function revenueByProgram(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
                ->map(fn ($group, string $program): array => [
                    'program' => $program,
                    'revenue' => round((float) $group->sum('price'), 2),
                    'activations' => $group->count(),
                ])
                ->sortByDesc('revenue')
                ->values(),
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

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->revenueByReseller($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Reseller', 'Revenue', 'Activations']);

            foreach ($rows as $row) {
                fputcsv($handle, [$row['reseller'], $row['revenue'], $row['activations']]);
            }

            fclose($handle);
        }, 'manager-parent-reports.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $rows = $this->revenueByReseller($request)->getData(true)['data'];

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Manager Parent Revenue Report',
            'columns' => ['Reseller', 'Revenue', 'Activations'],
            'rows' => collect($rows)->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all(),
        ])->render());

        return $pdf->download('manager-parent-reports.pdf');
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
}
