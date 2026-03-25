<?php

namespace App\Services;

use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ResellerCommissionService
{
    public function storeCommission(array $payload, User $manager, int $tenantId): ResellerCommission
    {
        return DB::transaction(function () use ($payload, $manager, $tenantId): ResellerCommission {
            $commission = ResellerCommission::query()
                ->where('tenant_id', $tenantId)
                ->where('reseller_id', (int) $payload['reseller_id'])
                ->where('period', (string) $payload['period'])
                ->first() ?? new ResellerCommission();

            $commission->fill([
                'tenant_id' => $tenantId,
                'reseller_id' => (int) $payload['reseller_id'],
                'manager_id' => $manager->id,
                'period' => (string) $payload['period'],
                'total_sales' => round((float) $payload['total_sales'], 2),
                'commission_rate' => round((float) $payload['commission_rate'], 2),
                'commission_owed' => round((float) $payload['commission_owed'], 2),
                'notes' => $payload['notes'] ?? null,
            ]);

            if (! $commission->exists) {
                $commission->amount_paid = 0;
            }

            $this->syncStatus($commission);
            $commission->save();

            return $commission->fresh(['reseller:id,name,email', 'manager:id,name,email', 'payments']);
        });
    }

    public function recordPayment(?ResellerCommission $commission, User $manager, array $payload): ResellerPayment
    {
        return DB::transaction(function () use ($commission, $manager, $payload): ResellerPayment {
            $payment = ResellerPayment::query()->create([
                'commission_id' => $commission?->id,
                'reseller_id' => $commission?->reseller_id ?? (int) $payload['reseller_id'],
                'manager_id' => $manager->id,
                'amount' => round((float) $payload['amount'], 2),
                'payment_date' => isset($payload['payment_date']) && $payload['payment_date'] !== ''
                    ? (string) $payload['payment_date']
                    : now()->toDateString(),
                'payment_method' => (string) $payload['payment_method'],
                'reference' => $payload['reference'] ?? null,
                'notes' => $payload['notes'] ?? null,
            ]);

            if ($commission !== null) {
                $this->recalculateCommission($commission);
            }

            return $payment->fresh(['commission', 'reseller:id,name,email', 'manager:id,name,email']);
        });
    }

    public function updatePayment(ResellerPayment $payment, User $manager, array $payload): ResellerPayment
    {
        return DB::transaction(function () use ($payment, $manager, $payload): ResellerPayment {
            $originalCommissionId = $payment->commission_id !== null ? (int) $payment->commission_id : null;

            $payment->fill([
                'commission_id' => isset($payload['commission_id']) ? (int) $payload['commission_id'] : null,
                'reseller_id' => (int) $payload['reseller_id'],
                'manager_id' => $manager->id,
                'amount' => round((float) $payload['amount'], 2),
                'payment_date' => isset($payload['payment_date']) && $payload['payment_date'] !== ''
                    ? (string) $payload['payment_date']
                    : ($payment->payment_date?->toDateString() ?: now()->toDateString()),
                'payment_method' => (string) $payload['payment_method'],
                'reference' => $payload['reference'] ?? null,
                'notes' => $payload['notes'] ?? null,
            ]);
            $payment->save();

            if ($originalCommissionId !== null) {
                $this->recalculateCommissionById($originalCommissionId);
            }

            if ($payment->commission_id !== null && (int) $payment->commission_id !== $originalCommissionId) {
                $this->recalculateCommissionById((int) $payment->commission_id);
            }

            return $payment->fresh(['commission', 'reseller:id,name,email', 'manager:id,name,email']);
        });
    }

    public function recalculateCommission(ResellerCommission $commission): ResellerCommission
    {
        $commission->amount_paid = round((float) $commission->payments()->sum('amount'), 2);
        $this->syncStatus($commission);
        $commission->save();

        return $commission->fresh(['payments', 'reseller:id,name,email', 'manager:id,name,email']);
    }

    public function recalculateCommissionById(int $commissionId): ?ResellerCommission
    {
        $commission = ResellerCommission::query()->find($commissionId);

        return $commission ? $this->recalculateCommission($commission) : null;
    }

    private function syncStatus(ResellerCommission $commission): void
    {
        $owed = round((float) $commission->commission_owed, 2);
        $paid = round((float) ($commission->amount_paid ?? 0), 2);
        $outstanding = round($owed - $paid, 2);

        $commission->amount_paid = $paid;
        $commission->outstanding = $outstanding;
        $commission->status = match (true) {
            $owed <= 0, $outstanding <= 0 => 'paid',
            $paid > 0 => 'partial',
            default => 'unpaid',
        };
    }
}
