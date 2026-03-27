<?php

namespace App\Http\Controllers\Reseller;

use App\Models\License;
use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Support\RevenueAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentStatusController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $reseller = $this->currentReseller($request);
        $tenantId = $this->currentTenantId($request);

        $commissions = ResellerCommission::query()
            ->with(['manager:id,name,email'])
            ->where('tenant_id', $tenantId)
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('period')
            ->get();

        $payments = ResellerPayment::query()
            ->with(['manager:id,name,email', 'commission:id,period,status'])
            ->where('reseller_id', $reseller->id)
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();

        $totalSales = round((float) (RevenueAnalytics::baseQuery([], $tenantId, null, $reseller->id)
            ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
            ->first()?->total_sales ?? 0), 2);

        $latestRate = $commissions->first()?->commission_rate;
        $totalPaid = round((float) $payments->sum('amount'), 2);
        $monthlyBreakdown = $commissions
            ->take(12)
            ->map(fn (ResellerCommission $commission): array => $this->serializeCommission($commission))
            ->values();

        if ($monthlyBreakdown->isEmpty()) {
            $monthlyBreakdown = collect([
                [
                    'id' => 0,
                    'period' => 'All Time',
                    'total_sales' => $totalSales,
                    'commission_rate' => round((float) ($latestRate ?? 0), 2),
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
                'summary' => [
                    'total_sales' => $totalSales,
                    'commission_rate' => round((float) ($latestRate ?? 0), 2),
                    'total_owed' => round((float) ($commissions->isEmpty() ? $totalSales : $commissions->sum('commission_owed')), 2),
                    'total_paid' => $totalPaid,
                    'outstanding_balance' => round((float) ($commissions->isEmpty() ? ($totalSales - $totalPaid) : $commissions->sum('outstanding')), 2),
                ],
                'monthly_breakdown' => $monthlyBreakdown,
                'payment_history' => $payments
                    ->map(fn (ResellerPayment $payment): array => $this->serializePayment($payment))
                    ->values(),
            ],
        ]);
    }

    private function serializeCommission(ResellerCommission $commission): array
    {
        return [
            'id' => $commission->id,
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

    private function resolveComputedStatus(float $commissionOwed, float $amountPaid): string
    {
        if ($amountPaid <= 0) {
            return $commissionOwed > 0 ? 'unpaid' : 'paid';
        }

        return $amountPaid >= $commissionOwed ? 'paid' : 'partial';
    }
}
