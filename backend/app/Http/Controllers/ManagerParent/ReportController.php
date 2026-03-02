<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Services\ExportTaskService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
