<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\User;
use App\Services\ExportTaskService;
use App\Support\LicenseCacheInvalidation;
use App\Support\RevenueAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class ReportController extends BaseManagerParentController
{
    public function revenueByReseller(Request $request): JsonResponse
    {
        $validated = $this->validatedFilters($request);
        $tenantId = $this->currentTenantId($request);
        $scope = $this->resolveSellerScope($tenantId, $validated);

        return response()->json([
            'data' => Cache::remember($this->cacheKey($tenantId, 'revenue-by-reseller', $validated), now()->addSeconds(90), function () use ($tenantId, $validated, $scope): array {
                return $this->baseQuery($tenantId, $validated, $scope)
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
        $scope = $this->resolveSellerScope($tenantId, $validated);

        return response()->json([
            'data' => Cache::remember($this->cacheKey($tenantId, 'revenue-by-program', $validated), now()->addSeconds(90), function () use ($tenantId, $validated, $scope): array {
                return $this->baseQuery($tenantId, $validated, $scope)
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
        $scope = $this->resolveSellerScope($tenantId, $validated);

        $totals = Cache::remember($this->cacheKey($tenantId, 'activation-rate', $validated), now()->addSeconds(90), function () use ($tenantId, $validated, $scope) {
            return $this->baseQuery($tenantId, $validated, $scope)
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
        $scope = $this->resolveSellerScope($tenantId, $validated);
        $months = collect(range(5, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

        $grouped = Cache::remember($this->cacheKey($tenantId, 'retention', $validated), now()->addSeconds(90), function () use ($tenantId, $validated, $scope): array {
            return $this->baseQuery($tenantId, $validated, $scope)
                ->whereNotNull('licenses.activated_at')
                ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
                ->selectRaw(RevenueAnalytics::monthKeyExpression('licenses', 'activated_at')." as month_key, COUNT(DISTINCT licenses.customer_id) as customers, COUNT(*) as activations")
                ->groupByRaw(RevenueAnalytics::monthKeyExpression('licenses', 'activated_at'))
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
            'xlsx',
            'manager-parent-reports.xlsx',
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
     * @return array{from:?string,to:?string,manager_parent_id:?int,manager_id:?int,reseller_id:?int}
     */
    private function validatedFilters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'manager_parent_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'reseller_id' => ['nullable', 'integer'],
        ]);

        return [
            'from' => ! empty($validated['from']) ? (string) $validated['from'] : null,
            'to' => ! empty($validated['to']) ? (string) $validated['to'] : null,
            'manager_parent_id' => ! empty($validated['manager_parent_id']) ? (int) $validated['manager_parent_id'] : null,
            'manager_id' => ! empty($validated['manager_id']) ? (int) $validated['manager_id'] : null,
            'reseller_id' => ! empty($validated['reseller_id']) ? (int) $validated['reseller_id'] : null,
        ];
    }

    private function baseQuery(int $tenantId, array $validated, array $scope)
    {
        return License::query()
            ->from('licenses')
            ->where('licenses.tenant_id', $tenantId)
            ->whereIn('licenses.reseller_id', $scope['seller_ids'])
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('licenses.activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('licenses.activated_at', '<=', $validated['to']));
    }

    /**
     * @param  array{manager_parent_id:?int,manager_id:?int,reseller_id:?int}  $validated
     * @return array{seller_ids: array<int, int>}
     */
    private function resolveSellerScope(int $tenantId, array $validated): array
    {
        $team = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->select(['id', 'role', 'created_by'])
            ->get();

        $managerParents = $team->where('role', UserRole::MANAGER_PARENT->value)->values();
        $managers = $team->where('role', UserRole::MANAGER->value)->values();
        $resellers = $team->where('role', UserRole::RESELLER->value)->values();

        if ($validated['reseller_id']) {
            if (! $resellers->firstWhere('id', $validated['reseller_id'])) {
                throw ValidationException::withMessages(['reseller_id' => 'The selected reseller is invalid for this tenant.']);
            }

            return ['seller_ids' => [(int) $validated['reseller_id']]];
        }

        if ($validated['manager_id']) {
            $manager = $managers->firstWhere('id', $validated['manager_id']);
            if (! $manager) {
                throw ValidationException::withMessages(['manager_id' => 'The selected manager is invalid for this tenant.']);
            }

            return [
                'seller_ids' => collect([$manager->id])
                    ->merge($resellers->where('created_by', $manager->id)->pluck('id'))
                    ->map(fn ($id): int => (int) $id)
                    ->values()
                    ->all(),
            ];
        }

        if ($validated['manager_parent_id']) {
            $managerParent = $managerParents->firstWhere('id', $validated['manager_parent_id']);
            if (! $managerParent) {
                throw ValidationException::withMessages(['manager_parent_id' => 'The selected manager parent is invalid for this tenant.']);
            }

            $managedManagerIds = $managers->where('created_by', $managerParent->id)->pluck('id')->map(fn ($id): int => (int) $id)->all();

            return [
                'seller_ids' => collect([(int) $managerParent->id])
                    ->merge($managedManagerIds)
                    ->merge($resellers->where('created_by', $managerParent->id)->pluck('id'))
                    ->merge($resellers->filter(fn (User $reseller): bool => in_array((int) $reseller->created_by, $managedManagerIds, true))->pluck('id'))
                    ->map(fn ($id): int => (int) $id)
                    ->unique()
                    ->values()
                    ->all(),
            ];
        }

        return [
            'seller_ids' => $team->pluck('id')->map(fn ($id): int => (int) $id)->all(),
        ];
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
                'headers' => ['Reseller', 'Revenue (USD)', 'Activations'],
                'rows' => $revenueRows->map(fn (array $row): array => [
                    $row['reseller'],
                    $this->formatMoney($row['revenue'] ?? 0),
                    $this->formatCount($row['activations'] ?? 0),
                ])->all(),
            ],
            [
                'title' => 'Revenue by Program',
                'headers' => ['Program', 'Revenue (USD)', 'Activations'],
                'rows' => $programRows->map(fn (array $row): array => [
                    $row['program'],
                    $this->formatMoney($row['revenue'] ?? 0),
                    $this->formatCount($row['activations'] ?? 0),
                ])->all(),
            ],
            [
                'title' => 'Activation Rate',
                'headers' => ['Label', 'Count', 'Percentage'],
                'rows' => $activationRows->map(fn (array $row): array => [
                    $row['label'],
                    $this->formatCount($row['count'] ?? 0),
                    $this->formatPercent($row['percentage'] ?? 0),
                ])->all(),
            ],
            [
                'title' => 'Retention',
                'headers' => ['Month', 'Customers', 'Activations'],
                'rows' => $retentionRows->map(fn (array $row): array => [
                    $row['month'],
                    $this->formatCount($row['customers'] ?? 0),
                    $this->formatCount($row['activations'] ?? 0),
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

    private function formatPercent(float|int $value): string
    {
        return number_format((float) $value, 2, '.', ',').'%';
    }
}
