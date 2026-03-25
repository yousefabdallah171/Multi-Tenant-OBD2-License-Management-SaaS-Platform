<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends BaseManagerParentController
{
    public function revenueByReseller(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);

        return response()->json([
            'data' => Cache::remember($this->cacheKey($tenantId, 'revenue-by-reseller', $validated), now()->addSeconds(90), function () use ($tenantId, $validated): array {
                return $this->baseQuery($tenantId, $validated)
                    ->leftJoin('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
                    ->selectRaw("COALESCE(resellers.name, 'Unknown') as reseller, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
                    ->groupBy('licenses.reseller_id', 'resellers.name')
                    ->orderByDesc('revenue')
                    ->get()
                    ->map(fn ($row): array => [
                        'reseller' => (string) $row->reseller,
                        'revenue' => round((float) $row->revenue, 2),
                        'activations' => (int) $row->activations,
                    ])
                    ->values()
                    ->all();
            }),
        ]);
    }

    public function revenueByProgram(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);

        return response()->json([
            'data' => Cache::remember($this->cacheKey($tenantId, 'revenue-by-program', $validated), now()->addSeconds(90), function () use ($tenantId, $validated): array {
                return $this->baseQuery($tenantId, $validated)
                    ->leftJoin('programs', 'programs.id', '=', 'licenses.program_id')
                    ->selectRaw("COALESCE(programs.name, 'Unknown') as program, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
                    ->groupBy('licenses.program_id', 'programs.name')
                    ->orderByDesc('revenue')
                    ->get()
                    ->map(fn ($row): array => [
                        'program' => (string) $row->program,
                        'revenue' => round((float) $row->revenue, 2),
                        'activations' => (int) $row->activations,
                    ])
                    ->values()
                    ->all();
            }),
        ]);
    }

    public function activationRate(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);

        $totals = Cache::remember($this->cacheKey($tenantId, 'activation-rate', $validated), now()->addSeconds(90), function () use ($tenantId, $validated) {
            return $this->baseQuery($tenantId, $validated)
                ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as success, SUM(CASE WHEN status IN ('pending', 'suspended') THEN 1 ELSE 0 END) as failure")
                ->first();
        });

        $total = max((int) ($totals?->total ?? 0), 1);
        $success = (int) ($totals?->success ?? 0);
        $failure = (int) ($totals?->failure ?? 0);

        return response()->json([
            'data' => [
                ['label' => 'Success', 'count' => $success, 'percentage' => round(($success / $total) * 100, 2)],
                ['label' => 'Failure', 'count' => $failure, 'percentage' => round(($failure / $total) * 100, 2)],
            ],
        ]);
    }

    public function retention(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = Cache::remember($this->cacheKey($tenantId, 'retention', $validated), now()->addSeconds(90), function () use ($tenantId, $validated): array {
            return $this->baseQuery($tenantId, $validated)
                ->whereNotNull('licenses.activated_at')
                ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
                ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, COUNT(DISTINCT licenses.customer_id) as customers, COUNT(*) as activations")
                ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
                ->get()
                ->mapWithKeys(fn ($row): array => [
                    (string) $row->month_key => [
                        'customers' => (int) $row->customers,
                        'activations' => (int) $row->activations,
                    ],
                ])
                ->all();
        });

        return response()->json([
            'data' => $months->map(function (CarbonImmutable $month) use ($grouped): array {
                $key = $month->format('Y-m');

                return [
                    'month' => $month->format('M Y'),
                    'customers' => (int) ($grouped[$key]['customers'] ?? 0),
                    'activations' => (int) ($grouped[$key]['activations'] ?? 0),
                ];
            })->values(),
        ]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'manager-parent-reports.csv',
            'Manager Parent Reports',
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
            'manager-parent-reports.pdf',
            'Manager Parent Reports',
            $this->exportSections($request),
            [],
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );

        return response()->json(['export_id' => $task->id, 'status' => $task->status], 202);
    }

    /**
     * @return array{from:?string,to:?string}
     */
    private function validatedFilters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
        ];
    }

    private function baseQuery(int $tenantId, array $validated)
    {
        return License::query()
            ->from('licenses')
            ->where('licenses.tenant_id', $tenantId)
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function cacheKey(int $tenantId, string $type, array $validated): string
    {
        return sprintf(
            'manager-parent:%d:reports:v%d:%s:%s',
            $tenantId,
            LicenseCacheInvalidation::reportVersion("manager-parent:{$tenantId}:reports:version"),
            $type,
            md5(json_encode($validated))
        );
    }

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $revenueRows = collect($this->revenueByReseller($request)->getData(true)['data']);
        $programRows = collect($this->revenueByProgram($request)->getData(true)['data']);
        $activationRows = collect($this->activationRate($request)->getData(true)['data']);
        $retentionRows = collect($this->retention($request)->getData(true)['data']);

        return [
            [
                'title' => 'Revenue by Reseller',
                'headers' => ['Reseller', 'Revenue', 'Activations'],
                'rows' => $revenueRows->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Revenue by Program',
                'headers' => ['Program', 'Revenue', 'Activations'],
                'rows' => $programRows->map(fn (array $row): array => [$row['program'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Activation Rate',
                'headers' => ['Label', 'Count', 'Percentage'],
                'rows' => $activationRows->map(fn (array $row): array => [$row['label'], $row['count'], $row['percentage']])->all(),
            ],
            [
                'title' => 'Retention',
                'headers' => ['Month', 'Customers', 'Activations'],
                'rows' => $retentionRows->map(fn (array $row): array => [$row['month'], $row['customers'], $row['activations']])->all(),
            ],
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
