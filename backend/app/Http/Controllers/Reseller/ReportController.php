<?php

namespace App\Http\Controllers\Reseller;

use App\Models\License;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends BaseResellerController
{
    public function revenue(Request $request): JsonResponse
    {
        [$licenses, $period] = $this->filteredLicenses($request);

        return response()->json([
            'data' => $this->groupByPeriod($licenses, $period, fn ($group): float => round((float) $group->sum('price'), 2)),
        ]);
    }

    public function activations(Request $request): JsonResponse
    {
        [$licenses, $period] = $this->filteredLicenses($request);

        return response()->json([
            'data' => $this->groupByPeriod($licenses, $period, fn ($group): int => $group->count()),
        ]);
    }

    public function topPrograms(Request $request): JsonResponse
    {
        [$licenses] = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
                ->map(fn ($group, string $program): array => [
                    'program' => $program,
                    'count' => $group->count(),
                    'revenue' => round((float) $group->sum('price'), 2),
                ])
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->topPrograms($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Program', 'Activations', 'Revenue']);

            foreach ($rows as $row) {
                fputcsv($handle, [$row['program'], $row['count'], $row['revenue']]);
            }

            fclose($handle);
        }, 'reseller-report.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $rows = $this->topPrograms($request)->getData(true)['data'];

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Reseller Report',
            'columns' => ['Program', 'Activations', 'Revenue'],
            'rows' => collect($rows)->map(fn (array $row): array => [$row['program'], $row['count'], $row['revenue']])->all(),
        ])->render());

        return $pdf->download('reseller-report.pdf');
    }

    private function filteredLicenses(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'period' => ['nullable', 'in:daily,weekly,monthly'],
        ]);

        $period = $validated['period'] ?? 'monthly';
        $licenses = $this->licenseQuery($request)
            ->with('program:id,name')
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();

        return [$licenses, $period];
    }

    private function groupByPeriod($licenses, string $period, callable $resolver)
    {
        return $licenses
            ->filter(fn (License $license): bool => $license->activated_at !== null)
            ->groupBy(function (License $license) use ($period): string {
                $date = Carbon::parse($license->activated_at);

                return match ($period) {
                    'daily' => $date->format('Y-m-d'),
                    'weekly' => $date->startOfWeek()->format('Y-m-d'),
                    default => $date->format('Y-m'),
                };
            })
            ->map(function ($group, string $bucket) use ($resolver): array {
                $value = $resolver($group);

                return [
                    'period' => $bucket,
                    'revenue' => $value,
                    'count' => $value,
                ];
            })
            ->values();
    }
}
