<?php

namespace App\Http\Controllers\Reseller;

use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Services\SellerAccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentStatusController extends BaseResellerController
{
    public function __construct(
        private readonly SellerAccountingService $sellerAccountingService,
    ) {}

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

        $summary = $this->sellerAccountingService->summariesForSellers([$reseller])[(int) $reseller->id] ?? [
            'total_sales' => 0.0,
            'commission_rate' => 0.0,
            'total_owed' => 0.0,
            'total_paid' => 0.0,
            'still_not_paid' => 0.0,
        ];
        $totalSales = round((float) $summary['total_sales'], 2);
        $latestRate = round((float) $summary['commission_rate'], 2);
        $totalPaid = round((float) $summary['total_paid'], 2);
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
                    'commission_rate' => $latestRate,
                    'total_owed' => round((float) $summary['total_owed'], 2),
                    'total_paid' => $totalPaid,
                    'outstanding_balance' => round((float) $summary['still_not_paid'], 2),
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
