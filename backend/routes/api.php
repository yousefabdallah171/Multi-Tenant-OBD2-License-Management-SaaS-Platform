<?php

use App\Http\Controllers\ApiProxyController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BalanceController;
use App\Http\Controllers\BiosBlacklistController;
use App\Http\Controllers\BiosConflictController;
use App\Http\Controllers\Customer\DashboardController as CustomerDashboardController;
use App\Http\Controllers\Customer\DownloadController as CustomerDownloadController;
use App\Http\Controllers\Customer\SoftwareController as CustomerSoftwareController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Manager\ActivityController as ManagerActivityController;
use App\Http\Controllers\Manager\CustomerController as ManagerCustomerController;
use App\Http\Controllers\Manager\DashboardController as ManagerDashboardController;
use App\Http\Controllers\Manager\ReportController as ManagerReportController;
use App\Http\Controllers\Manager\TeamController as ManagerTeamController;
use App\Http\Controllers\Manager\UsernameManagementController as ManagerUsernameManagementController;
use App\Http\Controllers\ManagerParent\ActivityController as ManagerParentActivityController;
use App\Http\Controllers\ManagerParent\BiosHistoryController as ManagerParentBiosHistoryController;
use App\Http\Controllers\ManagerParent\CustomerController as ManagerParentCustomerController;
use App\Http\Controllers\ManagerParent\DashboardController as ManagerParentDashboardController;
use App\Http\Controllers\ManagerParent\FinancialReportController as ManagerParentFinancialReportController;
use App\Http\Controllers\ManagerParent\IpAnalyticsController as ManagerParentIpAnalyticsController;
use App\Http\Controllers\ManagerParent\PricingController as ManagerParentPricingController;
use App\Http\Controllers\ManagerParent\ProgramController as ManagerParentProgramController;
use App\Http\Controllers\ManagerParent\ReportController as ManagerParentReportController;
use App\Http\Controllers\ManagerParent\SettingsController as ManagerParentSettingsController;
use App\Http\Controllers\ManagerParent\TeamController as ManagerParentTeamController;
use App\Http\Controllers\ManagerParent\UsernameManagementController as ManagerParentUsernameManagementController;
use App\Http\Controllers\Reseller\ActivityController as ResellerActivityController;
use App\Http\Controllers\Reseller\CustomerController as ResellerCustomerController;
use App\Http\Controllers\Reseller\DashboardController as ResellerDashboardController;
use App\Http\Controllers\Reseller\LicenseController as ResellerLicenseController;
use App\Http\Controllers\Reseller\ReportController as ResellerReportController;
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

    Route::get('/programs', [ManagerParentProgramController::class, 'index'])->middleware('role:manager_parent,manager,reseller');
    Route::get('/programs/{program}/stats', [ManagerParentProgramController::class, 'stats'])->middleware('role:manager_parent,manager,reseller');
    Route::get('/programs/{program}', [ManagerParentProgramController::class, 'show'])->middleware('role:manager_parent,manager,reseller');

    Route::middleware('role:manager_parent')->group(function (): void {
        Route::get('/dashboard/revenue-chart', [ManagerParentDashboardController::class, 'revenueChart']);
        Route::get('/dashboard/expiry-forecast', [ManagerParentDashboardController::class, 'expiryForecast']);
        Route::get('/dashboard/team-performance', [ManagerParentDashboardController::class, 'teamPerformance']);
        Route::get('/dashboard/conflict-rate', [ManagerParentDashboardController::class, 'conflictRate']);

        Route::get('/team', [ManagerParentTeamController::class, 'index']);
        Route::post('/team', [ManagerParentTeamController::class, 'store']);
        Route::put('/team/{user}', [ManagerParentTeamController::class, 'update']);
        Route::delete('/team/{user}', [ManagerParentTeamController::class, 'destroy']);
        Route::put('/team/{user}/status', [ManagerParentTeamController::class, 'updateStatus']);
        Route::get('/team/{user}/stats', [ManagerParentTeamController::class, 'stats']);

        Route::post('/programs', [ManagerParentProgramController::class, 'store']);
        Route::put('/programs/{program}', [ManagerParentProgramController::class, 'update']);
        Route::delete('/programs/{program}', [ManagerParentProgramController::class, 'destroy']);

        Route::get('/pricing/history', [ManagerParentPricingController::class, 'history']);
        Route::get('/pricing', [ManagerParentPricingController::class, 'index']);
        Route::post('/pricing/bulk', [ManagerParentPricingController::class, 'bulkUpdate']);
        Route::put('/pricing/{program}', [ManagerParentPricingController::class, 'update']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/revenue-by-reseller', [ManagerParentReportController::class, 'revenueByReseller']);
            Route::get('/revenue-by-program', [ManagerParentReportController::class, 'revenueByProgram']);
            Route::get('/activation-rate', [ManagerParentReportController::class, 'activationRate']);
            Route::get('/retention', [ManagerParentReportController::class, 'retention']);
            Route::get('/export/csv', [ManagerParentReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ManagerParentReportController::class, 'exportPdf']);
        });

        Route::get('/activity/export', [ManagerParentActivityController::class, 'export']);
        Route::get('/activity', [ManagerParentActivityController::class, 'index']);

        Route::get('/customers', [ManagerParentCustomerController::class, 'index']);
        Route::get('/customers/{user}', [ManagerParentCustomerController::class, 'show']);

        Route::get('/settings', [ManagerParentSettingsController::class, 'index']);
        Route::put('/settings', [ManagerParentSettingsController::class, 'update']);

        Route::get('/bios-history', [ManagerParentBiosHistoryController::class, 'index']);
        Route::get('/bios-history/{biosId}', [ManagerParentBiosHistoryController::class, 'show']);

        Route::get('/ip-analytics/stats', [ManagerParentIpAnalyticsController::class, 'stats']);
        Route::get('/ip-analytics', [ManagerParentIpAnalyticsController::class, 'index']);

        Route::get('/username-management', [ManagerParentUsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [ManagerParentUsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [ManagerParentUsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [ManagerParentUsernameManagementController::class, 'resetPassword']);

        Route::get('/financial-reports', [ManagerParentFinancialReportController::class, 'index']);
        Route::get('/financial-reports/export/csv', [ManagerParentFinancialReportController::class, 'exportCsv']);
        Route::get('/financial-reports/export/pdf', [ManagerParentFinancialReportController::class, 'exportPdf']);
    });

    Route::prefix('manager')->middleware('role:manager')->group(function (): void {
        Route::get('/dashboard/stats', [ManagerDashboardController::class, 'stats']);
        Route::get('/dashboard/activations-chart', [ManagerDashboardController::class, 'activationsChart']);
        Route::get('/dashboard/revenue-chart', [ManagerDashboardController::class, 'revenueChart']);
        Route::get('/dashboard/recent-activity', [ManagerDashboardController::class, 'recentActivity']);

        Route::get('/team', [ManagerTeamController::class, 'index']);
        Route::get('/team/{user}', [ManagerTeamController::class, 'show']);

        Route::get('/username-management', [ManagerUsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [ManagerUsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [ManagerUsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [ManagerUsernameManagementController::class, 'resetPassword']);

        Route::get('/customers', [ManagerCustomerController::class, 'index']);
        Route::get('/customers/{user}', [ManagerCustomerController::class, 'show']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/revenue', [ManagerReportController::class, 'revenue']);
            Route::get('/activations', [ManagerReportController::class, 'activations']);
            Route::get('/top-resellers', [ManagerReportController::class, 'topResellers']);
            Route::get('/export/csv', [ManagerReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ManagerReportController::class, 'exportPdf']);
        });

        Route::get('/activity', [ManagerActivityController::class, 'index']);
    });

    Route::prefix('reseller')->middleware('role:reseller')->group(function (): void {
        Route::get('/dashboard/stats', [ResellerDashboardController::class, 'stats']);
        Route::get('/dashboard/activations-chart', [ResellerDashboardController::class, 'activationsChart']);
        Route::get('/dashboard/revenue-chart', [ResellerDashboardController::class, 'revenueChart']);
        Route::get('/dashboard/recent-activity', [ResellerDashboardController::class, 'recentActivity']);

        Route::get('/customers', [ResellerCustomerController::class, 'index']);
        Route::post('/customers', [ResellerCustomerController::class, 'store']);
        Route::get('/customers/{user}', [ResellerCustomerController::class, 'show']);

        Route::get('/licenses/expiring', [ResellerLicenseController::class, 'expiring']);
        Route::get('/licenses', [ResellerLicenseController::class, 'index']);
        Route::get('/licenses/{license}', [ResellerLicenseController::class, 'show']);
        Route::post('/licenses/bulk-renew', [ResellerLicenseController::class, 'bulkRenew']);
        Route::post('/licenses/bulk-deactivate', [ResellerLicenseController::class, 'bulkDeactivate']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/revenue', [ResellerReportController::class, 'revenue']);
            Route::get('/activations', [ResellerReportController::class, 'activations']);
            Route::get('/top-programs', [ResellerReportController::class, 'topPrograms']);
            Route::get('/export/csv', [ResellerReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ResellerReportController::class, 'exportPdf']);
        });

        Route::get('/activity', [ResellerActivityController::class, 'index']);
    });

    Route::middleware('role:reseller')->group(function (): void {
        Route::post('/licenses/activate', [ResellerLicenseController::class, 'activate']);
        Route::post('/licenses/{license}/renew', [ResellerLicenseController::class, 'renew']);
        Route::post('/licenses/{license}/deactivate', [ResellerLicenseController::class, 'deactivate']);
    });

    Route::prefix('customer')->middleware('role:customer')->group(function (): void {
        Route::get('/dashboard', [CustomerDashboardController::class, 'index']);
        Route::get('/software', [CustomerSoftwareController::class, 'index']);
        Route::get('/downloads', [CustomerDownloadController::class, 'index']);
        Route::post('/downloads/{license}/log', [CustomerDownloadController::class, 'logDownload']);
    });

    Route::prefix('super-admin')->middleware('role:super_admin')->group(function (): void {
        Route::get('/dashboard/stats', [SuperAdminDashboardController::class, 'stats']);
        Route::get('/dashboard/revenue-trend', [SuperAdminDashboardController::class, 'revenueTrend']);
        Route::get('/dashboard/tenant-comparison', [SuperAdminDashboardController::class, 'tenantComparison']);
        Route::get('/dashboard/license-timeline', [SuperAdminDashboardController::class, 'licenseTimeline']);
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
        Route::get('/bios-blacklist/stats', [SuperAdminBiosBlacklistController::class, 'stats']);
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
