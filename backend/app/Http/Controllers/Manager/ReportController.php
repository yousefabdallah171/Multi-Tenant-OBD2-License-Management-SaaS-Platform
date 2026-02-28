<?php

namespace App\Http\Controllers\Manager;

use App\Models\License;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends BaseManagerController
{
    public function revenue(Request $request): JsonResponse
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

    public function activations(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));
        $grouped = $licenses
            ->filter(fn (License $license): bool => $license->activated_at !== null)
            ->groupBy(fn (License $license): string => $license->activated_at->format('Y-m'));

        return response()->json([
            'data' => $months->map(function (CarbonImmutable $month) use ($grouped): array {
                $bucket = $grouped->get($month->format('Y-m'), collect());

                return [
                    'month' => $month->format('M Y'),
                    'count' => $bucket->count(),
                ];
            })->values(),
        ]);
    }

    public function topResellers(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy('reseller_id')
                ->map(function ($group): array {
                    $first = $group->first();

                    return [
                        'id' => $first?->reseller_id,
                        'reseller' => $first?->reseller?->name ?? 'Unknown',
                        'revenue' => round((float) $group->sum('price'), 2),
                        'activations' => $group->count(),
                        'customers' => $group->pluck('customer_id')->filter()->unique()->count(),
                    ];
                })
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->topResellers($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Reseller', 'Revenue', 'Activations', 'Customers']);

            foreach ($rows as $row) {
                fputcsv($handle, [$row['reseller'], $row['revenue'], $row['activations'], $row['customers']]);
            }

            fclose($handle);
        }, 'manager-team-report.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $rows = $this->topResellers($request)->getData(true)['data'];

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Manager Team Report',
            'columns' => ['Reseller', 'Revenue', 'Activations', 'Customers'],
            'rows' => collect($rows)->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations'], $row['customers']])->all(),
        ])->render());

        return $pdf->download('manager-team-report.pdf');
    }

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['reseller:id,name', 'program:id,name'])
            ->whereIn('reseller_id', $this->teamResellerIds($request))
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }
}
