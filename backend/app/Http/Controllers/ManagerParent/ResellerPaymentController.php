<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Models\User;
use App\Services\ResellerCommissionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerPaymentController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
            'status' => ['nullable', 'in:unpaid,partial,paid'],
        ]);

        $tenantId = $this->currentTenantId($request);
        $period = (string) ($validated['period'] ?? CarbonImmutable::now()->format('Y-m'));
        $statusFilter = $validated['status'] ?? null;

        $resellers = User::query()
            ->where('tenant_id', $tenantId)
            ->where('role', UserRole::RESELLER->value)
            ->select(['id', 'name', 'email', 'created_at'])
            ->orderBy('name')
            ->get();

        $commissions = ResellerCommission::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('reseller_id', $resellers->pluck('id'))
            ->where('period', $period)
            ->get()
            ->keyBy('reseller_id');

        [$start, $end] = $this->periodRange($period);
        $salesByReseller = License::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('reseller_id', $resellers->pluck('id'))
            ->whereBetween('activated_at', [$start, $end])
            ->selectRaw('reseller_id, ROUND(COALESCE(SUM(price), 0), 2) as total_sales')
            ->groupBy('reseller_id')
            ->pluck('total_sales', 'reseller_id');

        $rows = $resellers->map(function (User $reseller) use ($commissions, $salesByReseller, $period): array {
            $commission = $commissions->get($reseller->id);
            $totalSales = round((float) ($commission?->total_sales ?? $salesByReseller->get($reseller->id, 0)), 2);
            $commissionOwed = round((float) ($commission?->commission_owed ?? 0), 2);
            $amountPaid = round((float) ($commission?->amount_paid ?? 0), 2);
            $outstanding = round((float) ($commission?->outstanding ?? max($commissionOwed - $amountPaid, 0)), 2);

            return [
                'reseller_id' => $reseller->id,
                'reseller_name' => $reseller->name,
                'reseller_email' => $reseller->email,
                'period' => $period,
                'commission_id' => $commission?->id,
                'total_sales' => $totalSales,
                'commission_rate' => round((float) ($commission?->commission_rate ?? 0), 2),
                'commission_owed' => $commissionOwed,
                'amount_paid' => $amountPaid,
                'outstanding' => $outstanding,
                'status' => $commission?->status ?? ($commissionOwed > 0 ? 'unpaid' : 'paid'),
                'created_at' => $reseller->created_at?->toIso8601String(),
            ];
        })->filter(fn (array $row): bool => $statusFilter ? $row['status'] === $statusFilter : true)->values();

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_owed' => round((float) $rows->sum('commission_owed'), 2),
                'total_paid' => round((float) $rows->sum('amount_paid'), 2),
                'total_outstanding' => round((float) $rows->sum('outstanding'), 2),
                'period' => $period,
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $reseller = $this->resolveReseller($request, $user);

        $commissions = ResellerCommission::query()
            ->with(['manager:id,name,email', 'payments.manager:id,name,email', 'reseller:id,name,email'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('period')
            ->get();

        $payments = ResellerPayment::query()
            ->with(['manager:id,name,email', 'commission:id,period,status', 'reseller:id,name,email'])
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();

        $totalSales = round((float) License::where('reseller_id', $reseller->id)->sum('price'), 2);

        return response()->json([
            'data' => [
                'reseller' => [
                    'id' => $reseller->id,
                    'name' => $reseller->name,
                    'email' => $reseller->email,
                    'created_at' => $reseller->created_at?->toIso8601String(),
                ],
                'summary' => [
                    'total_sales' => $totalSales,
                    'total_owed' => round((float) $commissions->sum('commission_owed'), 2),
                    'total_paid' => round((float) $payments->sum('amount'), 2),
                    'total_outstanding' => round((float) $commissions->sum('outstanding'), 2),
                ],
                'commissions' => $commissions->map(fn (ResellerCommission $commission): array => $this->serializeCommission($commission))->values(),
                'payments' => $payments->map(fn (ResellerPayment $payment): array => $this->serializePayment($payment))->values(),
            ],
        ]);
    }

    public function storePayment(Request $request, ResellerCommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'commission_id' => ['required', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['required', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $reseller = $this->resolveReseller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = $this->resolveCommission($request, ResellerCommission::query()->findOrFail((int) $validated['commission_id']));
        abort_unless((int) $commission->reseller_id === $reseller->id, 422, 'Commission does not belong to the selected reseller.');

        $payment = $commissionService->recordPayment($commission, $this->currentManagerParent($request), $validated);

        $this->logActivity(
            $request,
            'reseller.payment_recorded',
            sprintf('Recorded %s payment of $%s for %s (%s).', $payment->payment_method, number_format((float) $payment->amount, 2), $reseller->name, $commission->period),
            [
                'reseller_id' => $reseller->id,
                'commission_id' => $commission->id,
                'payment_id' => $payment->id,
                'amount' => round((float) $payment->amount, 2),
                'period' => $commission->period,
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

        $validated = $request->validate([
            'commission_id' => ['required', 'integer', 'exists:reseller_commissions,id'],
            'reseller_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['required', 'in:bank_transfer,cash,other'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $reseller = $this->resolveReseller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = $this->resolveCommission($request, ResellerCommission::query()->findOrFail((int) $validated['commission_id']));
        abort_unless((int) $commission->reseller_id === $reseller->id, 422, 'Commission does not belong to the selected reseller.');

        $updatedPayment = $commissionService->updatePayment($payment, $this->currentManagerParent($request), $validated);

        $this->logActivity(
            $request,
            'reseller.payment_updated',
            sprintf('Updated payment #%d for %s.', $updatedPayment->id, $reseller->name),
            [
                'reseller_id' => $reseller->id,
                'commission_id' => (int) $updatedPayment->commission_id,
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

        $reseller = $this->resolveReseller($request, User::query()->findOrFail((int) $validated['reseller_id']));
        $commission = $commissionService->storeCommission($validated, $this->currentManagerParent($request), $this->currentTenantId($request));

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

    private function resolveReseller(Request $request, User $user): User
    {
        abort_unless(
            (int) $user->tenant_id === $this->currentTenantId($request)
                && ($user->role?->value ?? (string) $user->role) === UserRole::RESELLER->value,
            404,
        );

        return $user;
    }

    private function resolveCommission(Request $request, ResellerCommission $commission): ResellerCommission
    {
        abort_unless(
            (int) $commission->tenant_id === $this->currentTenantId($request)
                && $this->resolveReseller($request, User::query()->findOrFail((int) $commission->reseller_id)),
            404,
        );

        return $commission;
    }

    private function resolvePayment(Request $request, ResellerPayment $payment): ResellerPayment
    {
        $payment->loadMissing('commission', 'reseller');

        abort_unless(
            $payment->commission !== null
                && (int) $payment->commission->tenant_id === $this->currentTenantId($request)
                && ($payment->reseller?->role?->value ?? (string) $payment->reseller?->role) === UserRole::RESELLER->value,
            404,
        );

        return $payment;
    }

    private function periodRange(string $period): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m', $period)->startOfMonth();
        $end = $start->endOfMonth();

        return [$start->toDateTimeString(), $end->toDateTimeString()];
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
}
