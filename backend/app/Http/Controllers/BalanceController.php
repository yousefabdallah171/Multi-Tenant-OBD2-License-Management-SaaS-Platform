<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\BalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BalanceController extends Controller
{
    public function __construct(private readonly BalanceService $balanceService)
    {
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()?->balance,
        ]);
    }

    public function adjust(Request $request, User $user): JsonResponse
    {
        abort_unless(
            (int) $user->tenant_id === (int) $request->user()?->tenant_id,
            403,
        );

        $validated = $request->validate([
            'amount' => ['required', 'numeric'],
        ]);

        return response()->json([
            'data' => $this->balanceService->credit($user, (float) $validated['amount']),
        ]);
    }
}
