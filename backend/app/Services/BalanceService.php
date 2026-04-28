<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserBalance;

class BalanceService
{
    public const TYPE_EARNED = 'earned';

    public const TYPE_GRANTED = 'granted';

    public function credit(User $user, float $amount): UserBalance
    {
        return $this->recordRevenue($user, $amount, true);
    }

    public function recordRevenue(User $user, float $amount, bool $incrementActivations = false, string $type = self::TYPE_EARNED): UserBalance
    {
        $balance = UserBalance::query()->firstOrCreate(
            [
                'user_id' => $user->id,
            ],
            [
                'tenant_id' => $user->tenant_id,
            ]
        );

        $isGranted = $type === self::TYPE_GRANTED;

        $balance->fill([
            'tenant_id' => $user->tenant_id,
            'total_revenue' => (float) $balance->total_revenue + ($isGranted ? 0 : $amount),
            'pending_balance' => (float) $balance->pending_balance + ($isGranted ? 0 : $amount),
            'granted_value' => (float) $balance->granted_value + ($isGranted ? $amount : 0),
            'total_activations' => (int) $balance->total_activations + ($incrementActivations ? 1 : 0),
            'last_activity_at' => now(),
        ])->save();

        return $balance->fresh();
    }
}
