<?php

namespace App\Http\Controllers\Reseller;

use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends BaseResellerController
{
    public function revenue(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $cacheKey = $this->cacheKey($this->currentReseller($request)->id, 'revenue', $validated);

        return response()->json([
            'data' => Cache::remember($cacheKey, now()->addSeconds(90), function () use ($request, $validated): array {
                $periodExpression = $this->periodExpression($validated['period']);

                return $this->baseQuery($request, $validated)
                    ->whereNotNull('licenses.activated_at')
                    ->selectRaw("{$periodExpression} as period, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, MIN(licenses.activated_at) as sort_at")
                    ->groupByRaw($periodExpression)
                    ->orderBy('sort_at')
                    ->get()
                    ->map(fn ($row): array => [
                        'period' => (string) $row->period,
                        'revenue' => round((float) $row->revenue, 2),
                    ])
                    ->values()
                    ->all();
            }),
        ]);
    }

    public function activations(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $cacheKey = $this->cacheKey($this->currentReseller($request)->id, 'activations', $validated);

        return response()->json([
            'data' => Cache::remember($cacheKey, now()->addSeconds(90), function () use ($request, $validated): array {
                $periodExpression = $this->periodExpression($validated['period']);

                return $this->baseQuery($request, $validated)
                    ->whereNotNull('licenses.activated_at')
                    ->selectRaw("{$periodExpression} as period, COUNT(*) as count, MIN(licenses.activated_at) as sort_at")
                    ->groupByRaw($periodExpression)
                    ->orderBy('sort_at')
                    ->get()
                    ->map(fn ($row): array => [
                        'period' => (string) $row->period,
                        'count' => (int) $row->count,
                    ])
                    ->values()
                    ->all();
            }),
        ]);
    }

    public function topPrograms(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $cacheKey = $this->cacheKey($this->currentReseller($request)->id, 'top-programs', $validated);

        return response()->json([
            'data' => Cache::remember($cacheKey, now()->addSeconds(90), function () use ($request, $validated): array {
                return $this->baseQuery($request, $validated)
                    ->leftJoin('programs', 'programs.id', '=', 'licenses.program_id')
                    ->selectRaw("COALESCE(programs.name, 'Unknown') as program, COUNT(*) as count, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
                    ->groupBy('licenses.program_id', 'programs.name')
                    ->orderByDesc('revenue')
                    ->get()
                    ->map(fn ($row): array => [
                        'program' => (string) $row->program,
                        'count' => (int) $row->count,
                        'revenue' => round((float) $row->revenue, 2),
                    ])
                    ->values()
                    ->all();
            }),
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

    /**
     * @return array{from:?string,to:?string,period:string}
     */
    private function validatedFilters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'period' => ['nullable', 'in:daily,weekly,monthly'],
        ]);

        return [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
            'period' => $validated['period'] ?? 'monthly',
        ];
    }

    private function baseQuery(Request $request, array $validated)
    {
        return $this->licenseQuery($request)
            ->from('licenses')
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']));
    }

    private function periodExpression(string $period): string
    {
        return match ($period) {
            'daily' => "DATE_FORMAT(licenses.activated_at, '%Y-%m-%d')",
            'weekly' => "DATE_FORMAT(DATE_SUB(licenses.activated_at, INTERVAL WEEKDAY(licenses.activated_at) DAY), '%Y-%m-%d')",
            default => "DATE_FORMAT(licenses.activated_at, '%Y-%m')",
        };
    }

    private function cacheKey(int $resellerId, string $type, array $validated): string
    {
        return sprintf(
            'reseller:%d:reports:v%d:%s:%s',
            $resellerId,
            LicenseCacheInvalidation::reportVersion("reseller:{$resellerId}:reports:version"),
            $type,
            md5(json_encode($validated))
        );
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
