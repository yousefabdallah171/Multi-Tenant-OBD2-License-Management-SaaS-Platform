<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use App\Models\User;
use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use App\Support\RevenueAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends BaseSuperAdminController
{
    public function revenue(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);

        $data = Cache::remember($this->cacheKey('revenue', $validated), now()->addSeconds(90), function () use ($validated): array {
            return $this->baseRevenueQuery($validated)
                ->leftJoin('tenants', 'tenants.id', '=', 'activity_logs.tenant_id')
                ->selectRaw("COALESCE(tenants.name, 'Unknown') as tenant")
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
                ->groupBy('activity_logs.tenant_id', 'tenants.name')
                ->orderByDesc('revenue')
                ->get()
                ->map(fn ($row): array => [
                    'tenant' => (string) $row->tenant,
                    'revenue' => round((float) $row->revenue, 2),
                ])
                ->values()
                ->all();
        });

        return response()->json(['data' => $data]);
    }

    public function activations(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);

        $data = Cache::remember($this->cacheKey('activations', $validated), now()->addSeconds(90), function () use ($validated): array {
            return $this->baseLicenseQuery($validated)
                ->leftJoin('tenants', 'tenants.id', '=', 'licenses.tenant_id')
                ->selectRaw("COALESCE(tenants.name, 'Unknown') as tenant, COUNT(*) as activations, SUM(CASE WHEN licenses.status = 'active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN licenses.status = 'pending' THEN 1 ELSE 0 END) as pending")
                ->groupBy('licenses.tenant_id', 'tenants.name')
                ->orderByDesc('activations')
                ->get()
                ->map(fn ($row): array => [
                    'tenant' => (string) $row->tenant,
                    'activations' => (int) $row->activations,
                    'active' => (int) $row->active,
                    'pending' => (int) $row->pending,
                ])
                ->values()
                ->all();
        });

        return response()->json(['data' => $data]);
    }

    public function growth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $filters = [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
        ];

        $start = ! empty($filters['from']) ? CarbonImmutable::parse($filters['from'])->startOfMonth() : CarbonImmutable::now()->startOfMonth()->subMonths(11);
        $end = ! empty($filters['to']) ? CarbonImmutable::parse($filters['to'])->endOfMonth() : CarbonImmutable::now()->endOfMonth();

        $months = collect();
        $cursor = $start;

        while ($cursor <= $end) {
            $months->push($cursor);
            $cursor = $cursor->addMonth();
        }

        $users = Cache::remember($this->cacheKey('growth', $filters), now()->addSeconds(90), function () use ($start, $end) {
            return User::query()
                ->whereBetween('created_at', [$start, $end])
                ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as users")
                ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
                ->pluck('users', 'month_key');
        });

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'users' => (int) ($users[$month->format('Y-m')] ?? 0),
            ])->values(),
        ]);
    }

    public function topResellers(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);

        $data = Cache::remember($this->cacheKey('top-resellers', $validated), now()->addSeconds(90), function () use ($validated): array {
            return $this->baseRevenueQuery($validated)
                ->leftJoin('users as resellers', 'resellers.id', '=', 'activity_logs.user_id')
                ->leftJoin('tenants', 'tenants.id', '=', 'activity_logs.tenant_id')
                ->selectRaw("activity_logs.user_id as reseller_id, COALESCE(resellers.name, 'Unknown') as reseller, COALESCE(resellers.role, '') as reseller_role, COALESCE(tenants.name, 'Unknown') as tenant")
                ->selectRaw(RevenueAnalytics::revenueCountExpression('earned', 'activity_logs', 'activations'))
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'revenue'))
                ->groupBy('activity_logs.user_id', 'resellers.name', 'resellers.role', 'tenants.name')
                ->orderByDesc('revenue')
                ->limit(20)
                ->get()
                ->map(fn ($row): array => [
                    'reseller_id' => $row->reseller_id !== null ? (int) $row->reseller_id : null,
                    'reseller' => (string) $row->reseller,
                    'reseller_role' => $row->reseller_role !== '' ? (string) $row->reseller_role : null,
                    'tenant' => (string) $row->tenant,
                    'activations' => (int) $row->activations,
                    'revenue' => round((float) $row->revenue, 2),
                ])
                ->values()
                ->all();
        });

        return response()->json(['data' => $data]);
    }

    public function exportCsv(Request $request, ExportTaskService $exportTaskService): JsonResponse
    {
        $sections = $this->exportSections($request);
        $task = $exportTaskService->queue(
            $request,
            'xlsx',
            'super-admin-reports.xlsx',
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

    private function baseLicenseQuery(array $validated)
    {
        return License::query()
            ->from('licenses')
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    private function baseRevenueQuery(array $validated)
    {
        return RevenueAnalytics::baseQuery($validated);
    }

    private function cacheKey(string $type, array $validated): string
    {
        return sprintf(
            'super-admin:reports:v%d:%s:%s',
            LicenseCacheInvalidation::reportVersion('super-admin:reports:version'),
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
        $growthRows = collect($this->growth($request)->getData(true)['data']);
        $topResellerRows = collect($this->topResellers($request)->getData(true)['data']);

        return [
            [
                'title' => 'Revenue by Tenant',
                'headers' => ['Tenant', 'Revenue (USD)'],
                'rows' => $revenueRows->map(fn (array $row): array => [$row['tenant'], $this->formatMoney($row['revenue'] ?? 0)])->all(),
            ],
            [
                'title' => 'Activations by Tenant',
                'headers' => ['Tenant', 'Activations', 'Active', 'Pending'],
                'rows' => $activationRows->map(fn (array $row): array => [
                    $row['tenant'],
                    $this->formatCount($row['activations'] ?? 0),
                    $this->formatCount($row['active'] ?? 0),
                    $this->formatCount($row['pending'] ?? 0),
                ])->all(),
            ],
            [
                'title' => 'User Growth',
                'headers' => ['Month', 'New Users'],
                'rows' => $growthRows->map(fn (array $row): array => [$row['month'], $this->formatCount($row['users'] ?? 0)])->all(),
            ],
            [
                'title' => 'Top Resellers',
                'headers' => ['Reseller', 'Tenant', 'Activations', 'Revenue (USD)'],
                'rows' => $topResellerRows->map(fn (array $row): array => [
                    $row['reseller'],
                    $row['tenant'],
                    $this->formatCount($row['activations'] ?? 0),
                    $this->formatMoney($row['revenue'] ?? 0),
                ])->all(),
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

    private function formatMoney(float|int $value): string
    {
        return '$'.number_format((float) $value, 2, '.', ',');
    }

    private function formatCount(float|int $value): string
    {
        return number_format((float) $value, 0, '.', ',');
    }
}
