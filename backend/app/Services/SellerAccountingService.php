<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Models\User;
use App\Support\RevenueAnalytics;
use Illuminate\Support\Collection;

class SellerAccountingService
{
    /**
     * @param  Collection<int, User>|iterable<int, User>  $sellers
     * @return array<int, array{
     *     total_sales: float,
     *     commission_rate: float,
     *     total_owed: float,
     *     total_paid: float,
     *     still_not_paid: float
     * }>
     */
    public function summariesForSellers(iterable $sellers): array
    {
        $sellerCollection = collect($sellers)
            ->filter(fn ($seller): bool => $seller instanceof User && $seller->id !== null)
            ->values();

        if ($sellerCollection->isEmpty()) {
            return [];
        }

        $totalSalesBySeller = $this->loadTotalSalesBySeller($sellerCollection);
        $resellerIds = $sellerCollection
            ->filter(fn (User $seller): bool => $this->roleValue($seller) === UserRole::RESELLER->value)
            ->pluck('id')
            ->all();

        $commissionsBySeller = empty($resellerIds)
            ? collect()
            : ResellerCommission::query()
                ->whereIn('reseller_id', $resellerIds)
                ->orderByDesc('period')
                ->get()
                ->groupBy('reseller_id');

        $paymentsBySeller = empty($resellerIds)
            ? collect()
            : ResellerPayment::query()
                ->whereIn('reseller_id', $resellerIds)
                ->selectRaw('reseller_id, ROUND(COALESCE(SUM(amount), 0), 2) as total_paid')
                ->groupBy('reseller_id')
                ->pluck('total_paid', 'reseller_id');

        $summaries = [];

        foreach ($sellerCollection as $seller) {
            $sellerId = (int) $seller->id;
            $totalSales = round((float) ($totalSalesBySeller->get($sellerId, 0) ?? 0), 2);

            if ($this->roleValue($seller) !== UserRole::RESELLER->value) {
                $summaries[$sellerId] = [
                    'total_sales' => $totalSales,
                    'commission_rate' => 0.0,
                    'total_owed' => 0.0,
                    'total_paid' => 0.0,
                    'still_not_paid' => 0.0,
                ];

                continue;
            }

            /** @var Collection<int, ResellerCommission> $commissions */
            $commissions = $commissionsBySeller->get($sellerId, collect());
            $latestRate = round((float) ($commissions->first()?->commission_rate ?? 0), 2);
            $totalPaid = round((float) ($paymentsBySeller->get($sellerId, 0) ?? 0), 2);
            $totalOwed = round((float) ($commissions->isEmpty() ? $totalSales : $commissions->sum('commission_owed')), 2);
            $stillNotPaid = round((float) ($commissions->isEmpty() ? ($totalSales - $totalPaid) : $commissions->sum('outstanding')), 2);

            $summaries[$sellerId] = [
                'total_sales' => $totalSales,
                'commission_rate' => $latestRate,
                'total_owed' => $totalOwed,
                'total_paid' => $totalPaid,
                'still_not_paid' => $stillNotPaid,
            ];
        }

        return $summaries;
    }

    /**
     * @param  Collection<int, User>  $sellers
     * @return Collection<int, float>
     */
    private function loadTotalSalesBySeller(Collection $sellers): Collection
    {
        $totals = collect();

        foreach ($sellers->groupBy('tenant_id') as $tenantId => $tenantSellers) {
            $sellerIds = $tenantSellers->pluck('id')->all();

            if ($sellerIds === []) {
                continue;
            }

            $tenantTotals = RevenueAnalytics::baseQuery([], (int) $tenantId, $sellerIds)
                ->selectRaw('activity_logs.user_id as seller_id')
                ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', 'activity_logs', 'total_sales'))
                ->groupBy('activity_logs.user_id')
                ->pluck('total_sales', 'seller_id');

            foreach ($tenantTotals as $sellerId => $totalSales) {
                $totals->put((int) $sellerId, round((float) $totalSales, 2));
            }
        }

        return $totals;
    }

    private function roleValue(User $seller): string
    {
        return $seller->role?->value ?? (string) $seller->role;
    }
}
