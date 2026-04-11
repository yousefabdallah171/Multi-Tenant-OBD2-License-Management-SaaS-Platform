<?php

namespace App\Http\Controllers\Reseller;

use App\Services\ExportTaskService;
use App\Support\CustomerOwnership;
use App\Support\LicenseCacheInvalidation;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends BaseResellerController
{
    public function summary(Request $request): JsonResponse
    {
        try {
            $validated = $this->validatedFilters($request);
            $resellerId = $this->currentReseller($request)->id;
            $cacheKey = $this->cacheKey($resellerId, 'summary', $validated);

            return response()->json([
                'data' => Cache::remember($cacheKey, now()->addSeconds(90), function () use ($request, $validated, $resellerId): array {
                    $summary = $this->revenueQuery($request, $validated)
                        ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_revenue'))
                        ->first();

                    $totalRevenue = round((float) ($summary?->total_revenue ?? 0), 2);
                    $totalActivations = (int) $this->baseQuery($request, $validated)->count();
                    $activeCustomers = (int) $this->licenseQuery($request)
                        ->whereEffectivelyActive()
                        ->whereNotNull('customer_id')
                        ->distinct('customer_id')
                        ->count('customer_id');

                    return [
                        'total_revenue' => $totalRevenue,
                        'total_activations' => $totalActivations,
                        'total_customers' => CustomerOwnership::currentOwnedCustomerCount([$resellerId], $this->currentTenantId($request)),
                        'active_customers' => $activeCustomers,
                        'active_licenses' => $activeCustomers,
                        'avg_price' => $totalActivations > 0 ? round($totalRevenue / $totalActivations, 2) : 0,
                    ];
                }),
            ]);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json([
                'data' => [
                    'total_revenue' => 0.0,
                    'total_activations' => 0,
                    'total_customers' => 0,
                    'active_customers' => 0,
                    'active_licenses' => 0,
                    'avg_price' => 0.0,
                ],
            ]);
        }
    }

    public function revenue(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $cacheKey = $this->cacheKey($this->currentReseller($request)->id, 'revenue', $validated);

        return response()->json([
            'data' => Cache::remember($cacheKey, now()->addSeconds(90), function () use ($request, $validated): array {
                $periodExpression = $this->periodExpression($validated['period']);

                return $this->revenueQuery($request, $validated)
                    ->selectRaw("{$periodExpression} as period")
                    ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
                    ->selectRaw('MIN(activity_logs.created_at) as sort_at')
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
                $periodExpression = $this->periodExpression($validated['period'], 'licenses.activated_at');

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
                $rows = $this->revenueQuery($request, $validated)
                    ->selectRaw(RevenueAnalytics::programIdExpression('activity_logs').' as program_id')
                    ->selectRaw(RevenueAnalytics::revenueCountExpression('earned', 'activity_logs', 'count'))
                    ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
                    ->groupByRaw(RevenueAnalytics::programIdExpression('activity_logs'))
                    ->orderByDesc('revenue')
                    ->get()
                    ->filter(fn ($row): bool => (int) ($row->program_id ?? 0) > 0)
                    ->values();

                $programs = \App\Models\Program::query()
                    ->whereIn('id', $rows->pluck('program_id')->all())
                    ->pluck('name', 'id');

                return $rows->map(fn ($row): array => [
                    'program' => (string) ($programs->get((int) $row->program_id) ?? 'Unknown'),
                    'count' => (int) $row->count,
                    'revenue' => round((float) $row->revenue, 2),
                ])->values()->all();
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

    private function revenueQuery(Request $request, array $validated)
    {
        return RevenueAnalytics::baseQuery($validated, $this->currentTenantId($request), null, $this->currentReseller($request)->id);
    }

    private function periodExpression(string $period, string $column = 'activity_logs.created_at'): string
    {
        return match ($period) {
            'daily' => "DATE_FORMAT({$column}, '%Y-%m-%d')",
            'weekly' => "DATE_FORMAT(DATE_SUB({$column}, INTERVAL WEEKDAY({$column}) DAY), '%Y-%m-%d')",
            default => "DATE_FORMAT({$column}, '%Y-%m')",
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
        $summary = $this->summary($request)->getData(true)['data'];
        $revenueRows = collect($this->revenue($request)->getData(true)['data']);
        $activationRows = collect($this->activations($request)->getData(true)['data']);
        $programRows = collect($this->topPrograms($request)->getData(true)['data']);

        return [
            [
                'title' => 'Summary',
                'headers' => ['Metric', 'Value'],
                'rows' => collect($this->summaryLabels($summary))
                    ->map(fn ($value, $label): array => [$label, $value])
                    ->values()
                    ->all(),
            ],
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

    /**
     * @param array<string, int|float> $summary
     * @return array<string, int|float>
     */
    private function summaryLabels(array $summary): array
    {
        return [
            'Total Revenue' => $summary['total_revenue'],
            'Total Customers' => $summary['total_customers'],
            'Active Customers' => $summary['active_customers'],
            'Total Activations' => $summary['total_activations'],
            'Average Price' => $summary['avg_price'],
        ];
    }

    private function reportLanguage(Request $request): string
    {
        $lang = $request->query('lang', $request->header('Accept-Language', 'en'));

        return str_starts_with((string) $lang, 'ar') ? 'ar' : 'en';
    }
}
