<?php

namespace App\Http\Controllers\Reseller;

use App\Models\License;
use App\Services\ExportTaskService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'reseller-report.csv',
            'Reseller Report',
            $this->exportSections($request),
            [],
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    public function exportPdf(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $task = $exportTaskService->queue(
            $request,
            'pdf',
            'reseller-report.pdf',
            'Reseller Report',
            $this->exportSections($request),
            [],
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
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

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $revenueRows = collect($this->revenue($request)->getData(true)['data']);
        $activationRows = collect($this->activations($request)->getData(true)['data']);
        $programRows = collect($this->topPrograms($request)->getData(true)['data']);

        return [
            [
                'title' => 'Revenue',
                'headers' => ['Period', 'Revenue'],
                'rows' => $revenueRows->map(fn (array $row): array => [$row['period'], $row['revenue']])->all(),
            ],
            [
                'title' => 'Activations',
                'headers' => ['Period', 'Activations'],
                'rows' => $activationRows->map(fn (array $row): array => [$row['period'], $row['count']])->all(),
            ],
            [
                'title' => 'Top Programs',
                'headers' => ['Program', 'Activations', 'Revenue'],
                'rows' => $programRows->map(fn (array $row): array => [$row['program'], $row['count'], $row['revenue']])->all(),
            ],
        ];
    }

    private function dateRangeLabel(Request $request): string
    {
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();
        $period = $request->string('period')->toString();

        $range = 'All time';

        if ($from !== '' && $to !== '') {
            $range = sprintf('Date range: %s to %s', $from, $to);
        } elseif ($from !== '') {
            $range = sprintf('From %s', $from);
        } elseif ($to !== '') {
            $range = sprintf('Until %s', $to);
        }

        return $period !== '' ? sprintf('%s | Period: %s', $range, $period) : $range;
    }

    private function reportLanguage(Request $request): string
    {
        $lang = $request->query('lang', $request->header('Accept-Language', 'en'));

        return str_starts_with((string) $lang, 'ar') ? 'ar' : 'en';
    }
}
