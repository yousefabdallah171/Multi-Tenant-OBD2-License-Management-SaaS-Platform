<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserBalance;

class BalanceService
{
    public function credit(User $user, float $amount): UserBalance
    {
        return $this->recordRevenue($user, $amount, true);
    }

    public function recordRevenue(User $user, float $amount, bool $incrementActivations = false): UserBalance
    {
        $balance = UserBalance::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'tenant_id' => $user->tenant_id,
            ]
        );

        $balance->fill([
            'tenant_id' => $user->tenant_id,
            'total_revenue' => (float) $balance->total_revenue + $amount,
            'pending_balance' => (float) $balance->pending_balance + $amount,
            'total_activations' => (int) $balance->total_activations + ($incrementActivations ? 1 : 0),
            'last_activity_at' => now(),
        ])->save();

        return $balance->fresh();
    }
}
