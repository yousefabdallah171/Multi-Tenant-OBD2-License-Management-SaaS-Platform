<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use Illuminate\Http\JsonResponse;

class LicenseController extends BaseSuperAdminController
{
    public function expiring(): JsonResponse
    {
        $baseQuery = License::query()
            ->where('status', 'active')
            ->where('expires_at', '>=', now());

        $day1 = (clone $baseQuery)->where('expires_at', '<=', now()->addDay())->count();
        $day3 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(3))->count();
        $day7 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(7))->count();
        $expired = License::query()->where('status', 'expired')->count();

        return response()->json([
            'data' => [
                'day1' => $day1,
                'day3' => $day3,
                'day7' => $day7,
                'expired' => $expired,
            ],
        ]);
    }
}
