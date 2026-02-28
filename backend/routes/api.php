<?php

use App\Http\Controllers\ApiProxyController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BalanceController;
use App\Http\Controllers\BiosBlacklistController;
use App\Http\Controllers\BiosConflictController;
use App\Http\Controllers\DashboardController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/health', function (): JsonResponse {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'timestamp' => now()->toIso8601String(),
    ]);
})->name('health');

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});

Route::middleware(['auth:sanctum', 'tenant.scope', 'ip.tracker'])->group(function (): void {
    Route::prefix('auth')->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    Route::prefix('external')->middleware(['api.logger'])->group(function (): void {
        Route::get('/status', [ApiProxyController::class, 'status']);
        Route::get('/check/{bios}', [ApiProxyController::class, 'check'])->middleware(['role:super_admin,manager_parent,manager,reseller', 'bios.blacklist']);
        Route::get('/users', [ApiProxyController::class, 'users'])->middleware('role:super_admin,manager_parent');
    });

    Route::get('/bios-blacklist', [BiosBlacklistController::class, 'index'])->middleware('role:super_admin,manager_parent,manager');
    Route::post('/bios-blacklist', [BiosBlacklistController::class, 'store'])->middleware('role:super_admin,manager_parent,manager');
    Route::delete('/bios-blacklist/{biosBlacklist}', [BiosBlacklistController::class, 'destroy'])->middleware('role:super_admin,manager_parent');
    Route::get('/bios-conflicts', [BiosConflictController::class, 'index'])->middleware('role:super_admin,manager_parent,manager');
    Route::get('/balances/me', [BalanceController::class, 'show'])->middleware('role:super_admin,manager_parent,manager,reseller');
    Route::post('/balances/{user}/adjust', [BalanceController::class, 'adjust'])->middleware('role:super_admin,manager_parent');
});
