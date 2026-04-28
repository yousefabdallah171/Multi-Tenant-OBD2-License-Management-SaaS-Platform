<?php

namespace App\Http\Controllers\Manager;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Models\User;
use App\Services\ResellerCommissionService;
use App\Services\SellerAccountingService;
use App\Support\RevenueAnalytics;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerPaymentController extends BaseManagerController
{
    public function __construct(
        private readonly SellerAccountingService $sellerAccountingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
            'status' => ['nullable', 'in:unpaid,partial,paid'],
        ]);

        $tenantId = $this->currentTenantId($request);
        $period = isset($validated['period']) && is_string($validated['period']) && $validated['period'] !== ''
            ? $validated['period']
            : null;
        $statusFilter = $validated['status'] ?? null;

        $sellerIds = $this->teamSellerIds($request);
        $resellers = User::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $sellerIds)
            ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->select(['id', 'tenant_id', 'role', 'name', 'email', 'created_at', 'created_by'])
            ->orderBy('name')
            ->get();

        $rows = $period === null
            ? $this->allTimeRows($resellers, $statusFilter)
            : $this->periodRows($resellers, $tenantId, $period, $statusFilter);

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_owed' => round((float) $rows->sum('commission_owed'), 2),
                'total_paid' => round((float) $rows->sum('amount_paid'), 2),
                'total_outstanding' => round((float) $rows->sum('outstanding'), 2),
                'total_collectible' => round((float) $rows->sum(fn (array $row): float => max((float) ($row['outstanding'] ?? 0), 0)), 2),
                'period' => $period ?? 'all',
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveManagedSeller($request, $user);

        $commissions = ResellerCommission::query()
            ->with(['manager:id,name,email', 'payments.manager:id,name,email'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('period')
            ->get();

        $payments = ResellerPayment::query()
            ->with(['manager:id,name,email', 'commission:id,period,status'])
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();

        $totalSales = round((float) (RevenueAnalytics::baseQuery([], $reseller->tenant_id, null, $reseller->id)
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
            ->first()?->total_sales ?? 0), 2);
        $totalPaid = round((float) $payments->sum('amount'), 2);
        $commissionsData = $commissions->map(fn (ResellerCommission $commission): array => $this->serializeCommission($commission))->values();

        if ($commissionsData->isEmpty()) {
            $commissionsData = collect([
                [
                    'id' => 0,
                    'reseller_id' => $reseller->id,
                    'reseller_name' => $reseller->name,
                    'period' => 'All Time',
                    'total_sales' => $totalSales,
                    'commission_rate' => 0.0,
                    'commission_owed' => $totalSales,
                    'amount_paid' => $totalPaid,
                    'outstanding' => round($totalSales - $totalPaid, 2),
                    'status' => $this->resolveComputedStatus($totalSales, $totalPaid),
                    'notes' => null,
                    'manager_name' => null,
                    'created_at' => null,
                    'updated_at' => null,
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'reseller' => [
                    'id' => $reseller->id,
                    'name' => $reseller->name,
                    'email' => $reseller->email,
                    'role' => $reseller->role?->value ?? (string) $reseller->role,
                    'created_at' => $reseller->created_at?->toIso8601String(),
                ],
                'summary' => [
                    'total_sales' => $totalSales,
                    'total_owed' => round((float) ($commissions->isEmpty() ? $totalSales : $commissions->sum('commission_owed')), 2),
                    'total_paid' => $totalPaid,
                    'total_outstanding' => round((float) ($commissions->isEmpty() ? ($totalSales - $totalPaid) : $commissions->sum('outstanding')), 2),
                ],
                'commissions' => $commissionsData,
                'payments' => $payments->map(fn (ResellerPayment $payment): array => $this->serializePayment($payment))->values(),
            ],
        ]);
    }

    public function storePayment(Request $request, ResellerCommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'commission_id' => ['nullable', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $validated['payment_date'] = isset($validated['payment_date'])
            ? Carbon::parse((string) $validated['payment_date'])->toDateString()
            : now()->toDateString();
        $validated['payment_method'] = $validated['payment_method'] ?? 'bank_transfer';

        $reseller = $this->resolveManagedSeller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        abort(403, 'Managers cannot record payments.');

        $commission = isset($validated['commission_id'])
            ? $this->resolveCommission($request, ResellerCommission::query()->findOrFail((int) $validated['commission_id']))
            : null;
        $sellerRole = $reseller->role?->value ?? (string) $reseller->role;
        abort_unless($commission === null || $sellerRole === UserRole::RESELLER->value, 422, 'Commission does not belong to the selected reseller.');
        abort_unless($commission === null || (int) $commission->reseller_id === $reseller->id, 422, 'Commission does not belong to the selected reseller.');

        $payment = $commissionService->recordPayment($commission, $this->currentManager($request), $validated);

        $this->logActivity(
            $request,
            'reseller.payment_recorded',
            $commission
                ? sprintf('Recorded payment of $%s for %s (%s).', number_format((float) $payment->amount, 2), $reseller->name, $commission->period)
                : sprintf('Recorded payment of $%s for %s.', number_format((float) $payment->amount, 2), $reseller->name),
            [
                'reseller_id' => $reseller->id,
                'commission_id' => $commission?->id,
                'payment_id' => $payment->id,
                'amount' => round((float) $payment->amount, 2),
                'period' => $commission?->period,
            ],
        );

        return response()->json([
            'data' => $this->serializePayment($payment),
            'message' => 'Payment recorded successfully.',
        ], 201);
    }

    public function updatePayment(Request $request, ResellerPayment $resellerPayment, ResellerCommissionService $commissionService): JsonResponse
    {
        $payment = $this->resolvePayment($request, $resellerPayment);
        abort(403, 'Managers cannot record payments.');

        $validated = $request->validate([
            'commission_id' => ['nullable', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $validated['payment_date'] = isset($validated['payment_date'])
            ? Carbon::parse((string) $validated['payment_date'])->toDateString()
            : ($payment->payment_date?->toDateString() ?: now()->toDateString());
        $validated['payment_method'] = $validated['payment_method'] ?? ($payment->payment_method ?: 'bank_transfer');

        $reseller = $this->resolveManagedSeller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = isset($validated['commission_id'])
            ? $this->resolveCommission($request, ResellerCommission::query()->findOrFail((int) $validated['commission_id']))
            : null;
        $sellerRole = $reseller->role?->value ?? (string) $reseller->role;
        abort_unless($commission === null || $sellerRole === UserRole::RESELLER->value, 422, 'Commission does not belong to the selected reseller.');
        abort_unless($commission === null || (int) $commission->reseller_id === $reseller->id, 422, 'Commission does not belong to the selected reseller.');

        $updatedPayment = $commissionService->updatePayment($payment, $this->currentManager($request), $validated);

        $this->logActivity(
            $request,
            'reseller.payment_updated',
            sprintf('Updated payment #%d for %s.', $updatedPayment->id, $reseller->name),
            [
                'reseller_id' => $reseller->id,
                'commission_id' => $updatedPayment->commission_id,
                'payment_id' => $updatedPayment->id,
                'amount' => round((float) $updatedPayment->amount, 2),
            ],
        );

        return response()->json([
            'data' => $this->serializePayment($updatedPayment),
            'message' => 'Payment updated successfully.',
        ]);
    }

    public function storeCommission(Request $request, ResellerCommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'total_sales' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'commission_owed' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $reseller = $this->resolveTeamReseller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = $commissionService->storeCommission($validated, $this->currentManager($request), $this->currentTenantId($request));

        $this->logActivity(
            $request,
            'reseller.commission_saved',
            sprintf('Saved commission for %s (%s).', $reseller->name, $commission->period),
            [
                'reseller_id' => $reseller->id,
                'commission_id' => $commission->id,
                'period' => $commission->period,
                'commission_owed' => round((float) $commission->commission_owed, 2),
            ],
        );

        return response()->json([
            'data' => $this->serializeCommission($commission),
            'message' => 'Commission saved successfully.',
        ]);
    }

    private function resolveCommission(Request $request, ResellerCommission $commission): ResellerCommission
    {
        abort_unless(
            (int) $commission->tenant_id === $this->currentTenantId($request)
                && in_array((int) $commission->reseller_id, $this->teamResellerIds($request), true),
            404,
        );

        return $commission;
    }

    private function resolvePayment(Request $request, ResellerPayment $payment): ResellerPayment
    {
        $payment->loadMissing('commission');

        abort_unless(
            (
                $payment->commission === null
                || (int) $payment->commission->tenant_id === $this->currentTenantId($request)
            )
                && in_array((int) $payment->reseller_id, $this->teamSellerIds($request), true),
            404,
        );

        return $payment;
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function periodRange(string $period): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m', $period)->startOfMonth();
        $end = $start->endOfMonth();

        return [$start, $end];
    }

    private function resolveComputedStatus(float $commissionOwed, float $amountPaid): string
    {
        if ($amountPaid <= 0) {
            return $commissionOwed > 0 ? 'unpaid' : 'paid';
        }

        return $amountPaid >= $commissionOwed ? 'paid' : 'partial';
    }

    private function serializeCommission(ResellerCommission $commission): array
    {
        return [
            'id' => $commission->id,
            'reseller_id' => $commission->reseller_id,
            'reseller_name' => $commission->reseller?->name,
            'period' => $commission->period,
            'total_sales' => round((float) $commission->total_sales, 2),
            'commission_rate' => round((float) $commission->commission_rate, 2),
            'commission_owed' => round((float) $commission->commission_owed, 2),
            'amount_paid' => round((float) $commission->amount_paid, 2),
            'outstanding' => round((float) $commission->outstanding, 2),
            'status' => (string) $commission->status,
            'notes' => $commission->notes,
            'manager_name' => $commission->manager?->name,
            'created_at' => $commission->created_at?->toIso8601String(),
            'updated_at' => $commission->updated_at?->toIso8601String(),
        ];
    }

    private function serializePayment(ResellerPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'commission_id' => $payment->commission_id,
            'period' => $payment->commission?->period,
            'reseller_id' => $payment->reseller_id,
            'reseller_name' => $payment->reseller?->name,
            'amount' => round((float) $payment->amount, 2),
            'payment_date' => $payment->payment_date?->toDateString(),
            'payment_method' => (string) $payment->payment_method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'manager_name' => $payment->manager?->name,
            'created_at' => $payment->created_at?->toIso8601String(),
            'updated_at' => $payment->updated_at?->toIso8601String(),
        ];
    }

    private function allTimeRows($sellers, ?string $statusFilter)
    {
        $accountingBySeller = $this->sellerAccountingService->summariesForSellers($sellers);
        $paymentsBySeller = ResellerPayment::query()
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->selectRaw('reseller_id, ROUND(COALESCE(SUM(amount), 0), 2) as total_paid')
            ->groupBy('reseller_id')
            ->pluck('total_paid', 'reseller_id');

        return $sellers->map(function (User $seller) use ($accountingBySeller, $paymentsBySeller): array {
            $role = $seller->role?->value ?? (string) $seller->role;
            $accounting = $accountingBySeller[(int) $seller->id] ?? [
                'total_sales' => 0.0,
                'commission_rate' => 0.0,
                'total_owed' => 0.0,
                'total_paid' => 0.0,
                'still_not_paid' => 0.0,
            ];

            $totalSales = round((float) $accounting['total_sales'], 2);
            $commissionRate = round((float) $accounting['commission_rate'], 2);
            $commissionOwed = round((float) $accounting['total_owed'], 2);
            $amountPaid = round((float) ($accounting['total_paid'] ?? 0), 2);
            $outstanding = round((float) $accounting['still_not_paid'], 2);

            if ($role !== UserRole::RESELLER->value) {
                $commissionRate = 0.0;
                $amountPaid = round((float) ($paymentsBySeller->get($seller->id, 0) ?? 0), 2);
                $commissionOwed = $totalSales;
                $outstanding = round($commissionOwed - $amountPaid, 2);
            }

            return [
                'reseller_id' => $seller->id,
                'reseller_name' => $seller->name,
                'reseller_email' => $seller->email,
                'reseller_role' => $role,
                'period' => 'All Time',
                'commission_id' => null,
                'total_sales' => $totalSales,
                'commission_rate' => $commissionRate,
                'commission_owed' => $commissionOwed,
                'amount_paid' => $amountPaid,
                'outstanding' => $outstanding,
                'status' => $this->resolveComputedStatus($commissionOwed, $amountPaid),
                'created_at' => $seller->created_at?->toIso8601String(),
            ];
        })->filter(fn (array $row): bool => $statusFilter ? $row['status'] === $statusFilter : true)->values();
    }

    private function periodRows($sellers, int $tenantId, string $period, ?string $statusFilter)
    {
        $commissions = ResellerCommission::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->where('period', $period)
            ->get()
            ->keyBy('reseller_id');

        [$start, $end] = $this->periodRange($period);
        $paymentsByReseller = ResellerPayment::query()
            ->whereIn('reseller_id', $sellers->pluck('id'))
            ->whereBetween('payment_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('reseller_id, ROUND(COALESCE(SUM(amount), 0), 2) as total_paid')
            ->groupBy('reseller_id')
            ->pluck('total_paid', 'reseller_id');

        return $sellers->map(function (User $seller) use ($commissions, $paymentsByReseller, $period, $tenantId, $start, $end): array {
            $role = $seller->role?->value ?? (string) $seller->role;
            $commission = $commissions->get($seller->id);
            $computedSales = RevenueAnalytics::baseQuery(
                ['from' => $start->toDateString(), 'to' => $end->toDateString()],
                $tenantId,
                null,
                $seller->id
            )
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
                ->first();
            $totalSales = round((float) ($commission?->total_sales ?? ($computedSales?->total_sales ?? 0)), 2);
            $amountPaid = round((float) ($commission?->amount_paid ?? $paymentsByReseller->get($seller->id, 0)), 2);
            $commissionOwed = round((float) ($commission?->commission_owed ?? $totalSales), 2);
            $outstanding = round((float) ($commission?->outstanding ?? ($commissionOwed - $amountPaid)), 2);

            if ($role !== UserRole::RESELLER->value) {
                $amountPaid = round((float) ($paymentsByReseller->get($seller->id, 0) ?? 0), 2);
                $commissionOwed = $totalSales;
                $outstanding = round($commissionOwed - $amountPaid, 2);
            }

            return [
                'reseller_id' => $seller->id,
                'reseller_name' => $seller->name,
                'reseller_email' => $seller->email,
                'reseller_role' => $role,
                'period' => $period,
                'commission_id' => $commission?->id,
                'total_sales' => $totalSales,
                'commission_rate' => round((float) ($commission?->commission_rate ?? 0), 2),
                'commission_owed' => $commissionOwed,
                'amount_paid' => $amountPaid,
                'outstanding' => $outstanding,
                'status' => $commission?->status ?? $this->resolveComputedStatus($commissionOwed, $amountPaid),
                'created_at' => $seller->created_at?->toIso8601String(),
            ];
        })->filter(fn (array $row): bool => $statusFilter ? $row['status'] === $statusFilter : true)->values();
    }
}
