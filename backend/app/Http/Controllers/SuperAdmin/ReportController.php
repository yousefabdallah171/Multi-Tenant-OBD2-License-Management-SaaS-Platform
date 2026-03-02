<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use App\Models\User;
use App\Services\ExportTaskService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends BaseSuperAdminController
{
    public function revenue(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->tenant?->name ?? 'Unknown')
            ->map(fn ($group, string $tenant): array => [
                'tenant' => $tenant,
                'revenue' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('revenue')
            ->values();

        return response()->json(['data' => $data]);
    }

    public function activations(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->tenant?->name ?? 'Unknown')
            ->map(fn ($group, string $tenant): array => [
                'tenant' => $tenant,
                'activations' => $group->count(),
                'active' => $group->where('status', 'active')->count(),
                'pending' => $group->where('status', 'pending')->count(),
            ])
            ->sortByDesc('activations')
            ->values();

        return response()->json(['data' => $data]);
    }

    public function growth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $start = ! empty($validated['from']) ? CarbonImmutable::parse($validated['from'])->startOfMonth() : CarbonImmutable::now()->startOfMonth()->subMonths(11);
        $end = ! empty($validated['to']) ? CarbonImmutable::parse($validated['to'])->endOfMonth() : CarbonImmutable::now()->endOfMonth();

        $months = collect();
        $cursor = $start;

        while ($cursor <= $end) {
            $months->push($cursor);
            $cursor = $cursor->addMonth();
        }

        $users = User::query()
            ->whereBetween('created_at', [$start, $end])
            ->get()
            ->groupBy(fn (User $user): string => $user->created_at?->format('Y-m') ?? '');

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'users' => $users->get($month->format('Y-m'))?->count() ?? 0,
            ])->values(),
        ]);
    }

    public function topResellers(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
            ->map(fn ($group, string $reseller): array => [
                'reseller' => $reseller,
                'tenant' => $group->first()?->tenant?->name,
                'activations' => $group->count(),
                'revenue' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('revenue')
            ->take(20)
            ->values();

        return response()->json(['data' => $data]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $sections = $this->exportSections($request);
        $task = $exportTaskService->queue(
            $request,
            'csv',
            'super-admin-reports.csv',
            'Super Admin Reports',
            $sections,
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
            'super-admin-reports.pdf',
            'Super Admin Reports',
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
            ->with(['tenant:id,name', 'reseller:id,name'])
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $revenueRows = collect($this->revenue($request)->getData(true)['data']);
        $activationRows = collect($this->activations($request)->getData(true)['data']);
        $growthRows = collect($this->growth($request)->getData(true)['data']);
        $topResellerRows = collect($this->topResellers($request)->getData(true)['data']);

        return [
            [
                'title' => 'Revenue by Tenant',
                'headers' => ['Tenant', 'Revenue'],
                'rows' => $revenueRows->map(fn (array $row): array => [$row['tenant'], $row['revenue']])->all(),
            ],
            [
                'title' => 'Activations by Tenant',
                'headers' => ['Tenant', 'Activations', 'Active', 'Pending'],
                'rows' => $activationRows->map(fn (array $row): array => [$row['tenant'], $row['activations'], $row['active'], $row['pending']])->all(),
            ],
            [
                'title' => 'User Growth',
                'headers' => ['Month', 'New Users'],
                'rows' => $growthRows->map(fn (array $row): array => [$row['month'], $row['users']])->all(),
            ],
            [
                'title' => 'Top Resellers',
                'headers' => ['Reseller', 'Tenant', 'Activations', 'Revenue'],
                'rows' => $topResellerRows->map(fn (array $row): array => [$row['reseller'], $row['tenant'], $row['activations'], $row['revenue']])->all(),
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
