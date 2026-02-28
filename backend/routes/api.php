<?php

use App\Http\Controllers\ApiProxyController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BalanceController;
use App\Http\Controllers\BiosBlacklistController;
use App\Http\Controllers\BiosConflictController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\SuperAdmin\AdminManagementController;
use App\Http\Controllers\SuperAdmin\ApiStatusController;
use App\Http\Controllers\SuperAdmin\BiosBlacklistController as SuperAdminBiosBlacklistController;
use App\Http\Controllers\SuperAdmin\BiosHistoryController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\SuperAdmin\FinancialReportController;
use App\Http\Controllers\SuperAdmin\LogController;
use App\Http\Controllers\SuperAdmin\ReportController;
use App\Http\Controllers\SuperAdmin\SettingsController;
use App\Http\Controllers\SuperAdmin\TenantController as SuperAdminTenantController;
use App\Http\Controllers\SuperAdmin\UserController as SuperAdminUserController;
use App\Http\Controllers\SuperAdmin\UsernameManagementController;
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
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/password', [AuthController::class, 'updatePassword']);
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

    Route::prefix('super-admin')->middleware('role:super_admin')->group(function (): void {
        Route::get('/dashboard/stats', [SuperAdminDashboardController::class, 'stats']);
        Route::get('/dashboard/revenue-trend', [SuperAdminDashboardController::class, 'revenueTrend']);
        Route::get('/dashboard/tenant-comparison', [SuperAdminDashboardController::class, 'tenantComparison']);
        Route::get('/dashboard/recent-activity', [SuperAdminDashboardController::class, 'recentActivity']);

        Route::get('/tenants/{tenant}/stats', [SuperAdminTenantController::class, 'stats']);
        Route::apiResource('tenants', SuperAdminTenantController::class);

        Route::get('/users', [SuperAdminUserController::class, 'index']);
        Route::put('/users/{user}/status', [SuperAdminUserController::class, 'updateStatus']);
        Route::delete('/users/{user}', [SuperAdminUserController::class, 'destroy']);

        Route::get('/admin-management', [AdminManagementController::class, 'index']);
        Route::post('/admin-management', [AdminManagementController::class, 'store']);
        Route::put('/admin-management/{user}', [AdminManagementController::class, 'update']);
        Route::delete('/admin-management/{user}', [AdminManagementController::class, 'destroy']);
        Route::post('/admin-management/{user}/reset-password', [AdminManagementController::class, 'resetPassword']);

        Route::get('/bios-blacklist', [SuperAdminBiosBlacklistController::class, 'index']);
        Route::post('/bios-blacklist', [SuperAdminBiosBlacklistController::class, 'store']);
        Route::post('/bios-blacklist/import', [SuperAdminBiosBlacklistController::class, 'import']);
        Route::get('/bios-blacklist/export', [SuperAdminBiosBlacklistController::class, 'export']);
        Route::post('/bios-blacklist/{biosBlacklist}/remove', [SuperAdminBiosBlacklistController::class, 'remove']);

        Route::get('/bios-history', [BiosHistoryController::class, 'index']);
        Route::get('/bios-history/{biosId}', [BiosHistoryController::class, 'show']);

        Route::get('/username-management', [UsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [UsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [UsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [UsernameManagementController::class, 'resetPassword']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/revenue', [ReportController::class, 'revenue']);
            Route::get('/activations', [ReportController::class, 'activations']);
            Route::get('/growth', [ReportController::class, 'growth']);
            Route::get('/top-resellers', [ReportController::class, 'topResellers']);
            Route::get('/export/csv', [ReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ReportController::class, 'exportPdf']);
        });

        Route::get('/financial-reports', [FinancialReportController::class, 'index']);
        Route::get('/financial-reports/export/csv', [FinancialReportController::class, 'exportCsv']);
        Route::get('/financial-reports/export/pdf', [FinancialReportController::class, 'exportPdf']);

        Route::get('/logs', [LogController::class, 'index']);
        Route::get('/logs/{log}', [LogController::class, 'show']);

        Route::get('/api-status', [ApiStatusController::class, 'index']);
        Route::get('/api-status/history', [ApiStatusController::class, 'history']);
        Route::post('/api-status/ping', [ApiStatusController::class, 'ping']);

        Route::get('/settings', [SettingsController::class, 'index']);
        Route::put('/settings', [SettingsController::class, 'update']);
    });
});
