<?php

use App\Http\Controllers\ApiProxyController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BalanceController;
use App\Http\Controllers\BiosAvailabilityController;
use App\Http\Controllers\BiosBlacklistController;
use App\Http\Controllers\BiosConflictController;
// use App\Http\Controllers\Customer\DashboardController as CustomerDashboardController;
// use App\Http\Controllers\Customer\DownloadController as CustomerDownloadController;
// use App\Http\Controllers\Customer\SoftwareController as CustomerSoftwareController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LicenseController;
use App\Http\Controllers\Manager\ActivityController as ManagerActivityController;
use App\Http\Controllers\Manager\BiosChangeRequestController as ManagerBiosChangeRequestController;
use App\Http\Controllers\Manager\BiosDetailsController as ManagerBiosDetailsController;
use App\Http\Controllers\Manager\CustomerController as ManagerCustomerController;
use App\Http\Controllers\Manager\DashboardController as ManagerDashboardController;
use App\Http\Controllers\Manager\LicenseController as ManagerLicenseController;
use App\Http\Controllers\Manager\ReportController as ManagerReportController;
use App\Http\Controllers\Manager\ResellerPaymentController as ManagerResellerPaymentController;
use App\Http\Controllers\Manager\ResellerLogController as ManagerResellerLogController;
use App\Http\Controllers\Manager\SoftwareController as ManagerSoftwareController;
use App\Http\Controllers\Manager\TeamController as ManagerTeamController;
use App\Http\Controllers\Manager\UsernameManagementController as ManagerUsernameManagementController;
use App\Http\Controllers\ManagerParent\ActivityController as ManagerParentActivityController;
use App\Http\Controllers\ManagerParent\ApiStatusController as ManagerParentApiStatusController;
use App\Http\Controllers\ManagerParent\BiosChangeRequestController as ManagerParentBiosChangeRequestController;
use App\Http\Controllers\ManagerParent\BiosHistoryController as ManagerParentBiosHistoryController;
use App\Http\Controllers\ManagerParent\BiosDetailsController as ManagerParentBiosDetailsController;
use App\Http\Controllers\ManagerParent\BiosConflictController as ManagerParentBiosConflictController;
use App\Http\Controllers\ManagerParent\CustomerController as ManagerParentCustomerController;
use App\Http\Controllers\ManagerParent\DashboardController as ManagerParentDashboardController;
use App\Http\Controllers\ManagerParent\FinancialReportController as ManagerParentFinancialReportController;
use App\Http\Controllers\ManagerParent\IpAnalyticsController as ManagerParentIpAnalyticsController;
use App\Http\Controllers\ManagerParent\LicenseController as ManagerParentLicenseController;
use App\Http\Controllers\ManagerParent\LogController as ManagerParentLogController;
use App\Http\Controllers\ManagerParent\ProgramController as ManagerParentProgramController;
use App\Http\Controllers\ManagerParent\ProgramLogsController as ManagerParentProgramLogsController;
use App\Http\Controllers\ManagerParent\ReportController as ManagerParentReportController;
use App\Http\Controllers\ManagerParent\ResellerPaymentController as ManagerParentResellerPaymentController;
use App\Http\Controllers\ManagerParent\ResellerLogController as ManagerParentResellerLogController;
use App\Http\Controllers\ManagerParent\SettingsController as ManagerParentSettingsController;
use App\Http\Controllers\ManagerParent\TeamController as ManagerParentTeamController;
use App\Http\Controllers\ManagerParent\UsernameManagementController as ManagerParentUsernameManagementController;
use App\Http\Controllers\OnlineUsersController;
use App\Http\Controllers\ExportTaskController;
use App\Http\Controllers\Reseller\CustomerController as ResellerCustomerController;
use App\Http\Controllers\Reseller\DashboardController as ResellerDashboardController;
use App\Http\Controllers\Reseller\BiosChangeRequestController as ResellerBiosChangeRequestController;
use App\Http\Controllers\Reseller\IpAnalyticsController as ResellerIpAnalyticsController;
use App\Http\Controllers\Reseller\LicenseController as ResellerLicenseController;
use App\Http\Controllers\Reseller\PaymentStatusController as ResellerPaymentStatusController;
use App\Http\Controllers\Reseller\ReportController as ResellerReportController;
use App\Http\Controllers\Reseller\ResellerLogController as ResellerResellerLogController;
use App\Http\Controllers\Reseller\SoftwareController as ResellerSoftwareController;
use App\Http\Middleware\ActiveRoleMiddleware;
use App\Http\Controllers\SuperAdmin\ApiStatusController;
use App\Http\Controllers\SuperAdmin\BiosBlacklistController as SuperAdminBiosBlacklistController;
use App\Http\Controllers\SuperAdmin\BiosConflictController as SuperAdminBiosConflictController;
use App\Http\Controllers\SuperAdmin\BiosHistoryController;
use App\Http\Controllers\SuperAdmin\BiosDetailsController as SuperAdminBiosDetailsController;
use App\Http\Controllers\SuperAdmin\CustomerController as SuperAdminCustomerController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\SuperAdmin\FinancialReportController;
use App\Http\Controllers\SuperAdmin\LogController;
use App\Http\Controllers\SuperAdmin\LicenseController as SuperAdminLicenseController;
use App\Http\Controllers\SuperAdmin\ReportController;
use App\Http\Controllers\SuperAdmin\SecurityController;
use App\Http\Controllers\SuperAdmin\SettingsController;
use App\Http\Controllers\SuperAdmin\TenantController as SuperAdminTenantController;
use App\Http\Controllers\SuperAdmin\TenantResetController as SuperAdminTenantResetController;
use App\Http\Controllers\SuperAdmin\UserController as SuperAdminUserController;
use App\Http\Middleware\ProcessDueScheduledLicenses;
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
    Route::post('/login', [AuthController::class, 'login'])->middleware('api.logger');
});

Route::middleware(['auth:sanctum', ActiveRoleMiddleware::class, 'tenant.scope', 'ip.tracker', 'update.last_seen', 'track.online', ProcessDueScheduledLicenses::class, 'api.logger'])->group(function (): void {
    Route::prefix('auth')->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/password', [AuthController::class, 'updatePassword']);
    });

    Route::middleware('role:super_admin,manager_parent,manager,reseller')->group(function (): void {
        Route::get('/exports/{exportTask}', [ExportTaskController::class, 'show']);
        Route::get('/exports/{exportTask}/download', [ExportTaskController::class, 'download']);
    });

    Route::get('/dashboard/stats', [DashboardController::class, 'stats'])->middleware('role:super_admin,manager_parent,manager,reseller');

    Route::prefix('external')->group(function (): void {
        Route::get('/status', [ApiProxyController::class, 'status'])->middleware('role:super_admin,manager_parent,manager,reseller');
        Route::get('/check/{bios}', [ApiProxyController::class, 'check'])->middleware(['role:super_admin,manager_parent,manager,reseller', 'bios.blacklist']);
        Route::get('/users', [ApiProxyController::class, 'users'])->middleware('role:super_admin,manager_parent');
    });

    Route::get('/bios-blacklist', [BiosBlacklistController::class, 'index'])->middleware('role:super_admin,manager_parent,manager');
    Route::post('/bios-blacklist', [BiosBlacklistController::class, 'store'])->middleware('role:super_admin,manager_parent,manager');
    Route::delete('/bios-blacklist/{biosBlacklist}', [BiosBlacklistController::class, 'destroy'])->middleware('role:super_admin,manager_parent');
    Route::get('/bios-conflicts', [BiosConflictController::class, 'index'])->middleware('role:super_admin,manager_parent,manager');
    Route::get('/check-bios', [BiosAvailabilityController::class, 'checkBios'])->middleware(['role:super_admin,manager_parent,manager,reseller', 'throttle:60,1']);
    Route::get('/check-username', [BiosAvailabilityController::class, 'checkUsername'])->middleware(['role:super_admin,manager_parent,manager,reseller', 'throttle:60,1']);
    Route::get('/balances/me', [BalanceController::class, 'show'])->middleware('role:super_admin,manager_parent,manager,reseller');
    Route::post('/balances/{user}/adjust', [BalanceController::class, 'adjust'])->middleware('role:super_admin,manager_parent');
    Route::post('/licenses/activate', [LicenseController::class, 'activateLicense'])->middleware('role:super_admin,reseller,manager,manager_parent');
    Route::get('/online-widget/settings', [OnlineUsersController::class, 'widgetSettings'])->middleware('role:super_admin,manager_parent,manager,reseller');

    Route::get('/programs', [ManagerParentProgramController::class, 'index'])->middleware('role:super_admin,manager_parent,manager,reseller');
    Route::get('/programs/{program}/stats', [ManagerParentProgramController::class, 'stats'])->middleware('role:super_admin,manager_parent,manager,reseller');
    Route::get('/programs/{program}', [ManagerParentProgramController::class, 'show'])->middleware('role:super_admin,manager_parent,manager,reseller');

    Route::middleware('role:manager_parent')->group(function (): void {
        Route::get('/dashboard', [ManagerParentDashboardController::class, 'dashboard']);
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
        Route::get('/team/{user}', [ManagerParentTeamController::class, 'show']);

        Route::post('/programs', [ManagerParentProgramController::class, 'store']);
        Route::put('/programs/{program}', [ManagerParentProgramController::class, 'update']);
        Route::delete('/programs/{program}', [ManagerParentProgramController::class, 'destroy']);
        Route::get('/manager-parent/programs/{program}/logs', [ManagerParentProgramLogsController::class, 'show']);
        Route::get('/manager-parent/programs/{program}/active-users', [ManagerParentProgramLogsController::class, 'activeUsers']);
        Route::get('/manager-parent/programs/{program}/stats', [ManagerParentProgramLogsController::class, 'stats']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/revenue-by-reseller', [ManagerParentReportController::class, 'revenueByReseller']);
            Route::get('/revenue-by-program', [ManagerParentReportController::class, 'revenueByProgram']);
            Route::get('/activation-rate', [ManagerParentReportController::class, 'activationRate']);
            Route::get('/retention', [ManagerParentReportController::class, 'retention']);
            Route::get('/export/csv', [ManagerParentReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ManagerParentReportController::class, 'exportPdf']);
        });
        Route::get('/reseller-payments', [ManagerParentResellerPaymentController::class, 'index']);
        Route::get('/reseller-payments/{user}', [ManagerParentResellerPaymentController::class, 'show']);
        Route::post('/reseller-payments', [ManagerParentResellerPaymentController::class, 'storePayment']);
        Route::put('/reseller-payments/{resellerPayment}', [ManagerParentResellerPaymentController::class, 'updatePayment']);
        Route::post('/reseller-commissions', [ManagerParentResellerPaymentController::class, 'storeCommission']);

        Route::get('/activity/export', [ManagerParentActivityController::class, 'export']);
        Route::get('/activity', [ManagerParentActivityController::class, 'index']);
        Route::get('/reseller-logs', [ManagerParentResellerLogController::class, 'index']);

        Route::get('/customers', [ManagerParentCustomerController::class, 'index']);
        Route::post('/customers', [ManagerParentCustomerController::class, 'store']);
        Route::put('/customers/{user}', [ManagerParentCustomerController::class, 'update']);
        Route::get('/customers/{user}/license-history', [ManagerParentCustomerController::class, 'licenseHistory']);
        Route::get('/customers/{user}/bios-change-history', [ManagerParentCustomerController::class, 'biosChangeHistory']);
        Route::get('/customers/{user}', [ManagerParentCustomerController::class, 'show']);
        Route::delete('/customers/{user}', [ManagerParentCustomerController::class, 'destroy']);
        Route::get('/licenses', [ManagerParentLicenseController::class, 'index']);
        Route::get('/licenses/expiring', [ManagerParentLicenseController::class, 'expiring']);
        Route::get('/licenses/{license}', [ManagerParentLicenseController::class, 'show']);
        Route::delete('/licenses/{license}', [ManagerParentLicenseController::class, 'destroy']);

        Route::get('/settings', [ManagerParentSettingsController::class, 'index']);
        Route::put('/settings', [ManagerParentSettingsController::class, 'update']);
        Route::post('/settings/logo', [ManagerParentSettingsController::class, 'uploadLogo']);

        Route::get('/bios-history', [ManagerParentBiosHistoryController::class, 'index']);
        Route::get('/bios-history/{biosId}', [ManagerParentBiosHistoryController::class, 'show']);
        Route::get('/bios/search', [ManagerParentBiosDetailsController::class, 'search']);
        Route::get('/bios/recent', [ManagerParentBiosDetailsController::class, 'recent']);
        Route::get('/bios/{biosId}', [ManagerParentBiosDetailsController::class, 'show']);
        Route::get('/bios/{biosId}/licenses', [ManagerParentBiosDetailsController::class, 'licenses']);
        Route::get('/bios/{biosId}/resellers', [ManagerParentBiosDetailsController::class, 'resellers']);
        Route::get('/bios/{biosId}/ips', [ManagerParentBiosDetailsController::class, 'ips']);
        Route::get('/bios/{biosId}/activity', [ManagerParentBiosDetailsController::class, 'activity']);
        Route::get('/bios-conflicts', [ManagerParentBiosConflictController::class, 'index']);
        Route::put('/bios-conflicts/{id}/resolve', [ManagerParentBiosConflictController::class, 'resolve']);
        Route::get('/bios-change-requests', [ManagerParentBiosChangeRequestController::class, 'index']);
        Route::post('/bios-change-requests', [ManagerParentBiosChangeRequestController::class, 'store']);
        Route::post('/bios-change-requests/direct', [ManagerParentBiosChangeRequestController::class, 'directChange']);
        Route::put('/bios-change-requests/{biosChangeRequest}/approve', [ManagerParentBiosChangeRequestController::class, 'approve']);
        Route::put('/bios-change-requests/{biosChangeRequest}/reject', [ManagerParentBiosChangeRequestController::class, 'reject']);

        Route::get('/ip-analytics/stats', [ManagerParentIpAnalyticsController::class, 'stats']);
        Route::get('/ip-analytics', [ManagerParentIpAnalyticsController::class, 'index']);

        Route::get('/logs', [ManagerParentLogController::class, 'index']);
        Route::get('/logs/{log}', [ManagerParentLogController::class, 'show']);

        Route::get('/api-status', [ManagerParentApiStatusController::class, 'index']);
        Route::get('/api-status/history', [ManagerParentApiStatusController::class, 'history']);
        Route::post('/api-status/ping', [ManagerParentApiStatusController::class, 'ping']);

        Route::get('/username-management', [ManagerParentUsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [ManagerParentUsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [ManagerParentUsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [ManagerParentUsernameManagementController::class, 'resetPassword']);

        Route::get('/financial-reports', [ManagerParentFinancialReportController::class, 'index']);
        Route::get('/financial-reports/export/csv', [ManagerParentFinancialReportController::class, 'exportCsv']);
        Route::get('/financial-reports/export/pdf', [ManagerParentFinancialReportController::class, 'exportPdf']);
        Route::get('/online-users', [OnlineUsersController::class, 'index']);
    });

    Route::prefix('manager')->middleware('role:manager')->group(function (): void {
        Route::get('/dashboard', [ManagerDashboardController::class, 'dashboard']);
        Route::get('/dashboard/stats', [ManagerDashboardController::class, 'stats']);
        Route::get('/dashboard/activations-chart', [ManagerDashboardController::class, 'activationsChart']);
        Route::get('/dashboard/revenue-chart', [ManagerDashboardController::class, 'revenueChart']);
        Route::get('/dashboard/recent-activity', [ManagerDashboardController::class, 'recentActivity']);

        Route::get('/team', [ManagerTeamController::class, 'index']);
        Route::post('/team', [ManagerTeamController::class, 'store']);
        Route::put('/team/{user}', [ManagerTeamController::class, 'update']);
        Route::delete('/team/{user}', [ManagerTeamController::class, 'destroy']);
        Route::put('/team/{user}/status', [ManagerTeamController::class, 'updateStatus']);
        Route::get('/team/{user}', [ManagerTeamController::class, 'show']);

        Route::get('/username-management', [ManagerUsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [ManagerUsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [ManagerUsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [ManagerUsernameManagementController::class, 'resetPassword']);

        Route::get('/customers', [ManagerCustomerController::class, 'index']);
        Route::post('/customers', [ManagerCustomerController::class, 'store']);
        Route::put('/customers/{user}', [ManagerCustomerController::class, 'update']);
        Route::get('/customers/{user}/license-history', [ManagerCustomerController::class, 'licenseHistory']);
        Route::get('/customers/{user}/bios-change-history', [ManagerCustomerController::class, 'biosChangeHistory']);
        Route::get('/customers/{user}', [ManagerCustomerController::class, 'show']);
        Route::delete('/customers/{user}', [ManagerCustomerController::class, 'destroy']);
        Route::get('/licenses', [ManagerLicenseController::class, 'index']);
        Route::get('/licenses/expiring', [ManagerLicenseController::class, 'expiring']);
        Route::get('/licenses/{license}', [ManagerLicenseController::class, 'show']);
        Route::post('/licenses/{license}/cancel-pending', [ManagerLicenseController::class, 'cancelPending']);

        Route::get('/software', [ManagerSoftwareController::class, 'index']);
        Route::post('/software', [ManagerSoftwareController::class, 'store']);
        Route::put('/software/{program}', [ManagerSoftwareController::class, 'update']);
        Route::delete('/software/{program}', [ManagerSoftwareController::class, 'destroy']);
        Route::post('/software/{program}/activate', [ManagerSoftwareController::class, 'activate']);
        Route::get('/bios/search', [ManagerBiosDetailsController::class, 'search']);
        Route::get('/bios/recent', [ManagerBiosDetailsController::class, 'recent']);
        Route::get('/bios/{biosId}', [ManagerBiosDetailsController::class, 'show']);
        Route::get('/bios/{biosId}/licenses', [ManagerBiosDetailsController::class, 'licenses']);
        Route::get('/bios/{biosId}/resellers', [ManagerBiosDetailsController::class, 'resellers']);
        Route::get('/bios/{biosId}/ips', [ManagerBiosDetailsController::class, 'ips']);
        Route::get('/bios/{biosId}/activity', [ManagerBiosDetailsController::class, 'activity']);
        Route::get('/bios-change-requests', [ManagerBiosChangeRequestController::class, 'index']);
        Route::post('/bios-change-requests', [ManagerBiosChangeRequestController::class, 'store']);
        Route::put('/bios-change-requests/{biosChangeRequest}/approve', [ManagerBiosChangeRequestController::class, 'approve']);
        Route::put('/bios-change-requests/{biosChangeRequest}/reject', [ManagerBiosChangeRequestController::class, 'reject']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/financial', [ManagerReportController::class, 'index']);
            Route::get('/activation-rate', [ManagerReportController::class, 'activationRate']);
            Route::get('/retention', [ManagerReportController::class, 'retention']);
            Route::get('/export/csv', [ManagerReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ManagerReportController::class, 'exportPdf']);
        });
        Route::get('/reseller-payments', [ManagerResellerPaymentController::class, 'index']);
        Route::get('/reseller-payments/{user}', [ManagerResellerPaymentController::class, 'show']);
        Route::post('/reseller-payments', [ManagerResellerPaymentController::class, 'storePayment']);
        Route::put('/reseller-payments/{resellerPayment}', [ManagerResellerPaymentController::class, 'updatePayment']);
        Route::post('/reseller-commissions', [ManagerResellerPaymentController::class, 'storeCommission']);

        Route::get('/activity', [ManagerActivityController::class, 'index']);
        Route::get('/activity/export', [ManagerActivityController::class, 'export']);
        Route::get('/reseller-logs', [ManagerResellerLogController::class, 'index']);
        Route::get('/online-users', [OnlineUsersController::class, 'index']);
    });

    Route::prefix('reseller')->middleware('role:reseller')->group(function (): void {
        Route::get('/dashboard/stats', [ResellerDashboardController::class, 'stats']);
        Route::get('/dashboard/activations-chart', [ResellerDashboardController::class, 'activationsChart']);
        Route::get('/dashboard/revenue-chart', [ResellerDashboardController::class, 'revenueChart']);
        Route::get('/dashboard/recent-activity', [ResellerDashboardController::class, 'recentActivity']);
        Route::get('/payment-status', [ResellerPaymentStatusController::class, 'index']);

        Route::get('/customers', [ResellerCustomerController::class, 'index']);
        Route::post('/customers', [ResellerCustomerController::class, 'store']);
        Route::put('/customers/{user}', [ResellerCustomerController::class, 'update']);
        Route::get('/customers/{user}', [ResellerCustomerController::class, 'show']);
        Route::get('/customers/{user}/bios-change-history', [ResellerCustomerController::class, 'biosChangeHistory']);
        Route::delete('/customers/{user}', [ResellerCustomerController::class, 'destroy']);

        Route::get('/licenses/expiring', [ResellerLicenseController::class, 'expiring']);
        Route::get('/licenses', [ResellerLicenseController::class, 'index']);
        Route::get('/licenses/{license}', [ResellerLicenseController::class, 'show']);
        Route::post('/licenses/bulk-renew', [ResellerLicenseController::class, 'bulkRenew']);
        Route::post('/licenses/bulk-deactivate', [ResellerLicenseController::class, 'bulkDeactivate']);
        Route::post('/licenses/bulk-delete', [ResellerLicenseController::class, 'bulkDelete']);
        Route::delete('/licenses/{license}', [ResellerLicenseController::class, 'destroy']);
        Route::post('/licenses/{license}/pause', [ResellerLicenseController::class, 'pause']);
        Route::post('/licenses/{license}/resume', [ResellerLicenseController::class, 'resume']);
        Route::post('/licenses/{license}/cancel-pending', [ResellerLicenseController::class, 'cancelPending']);
        Route::get('/software', [ResellerSoftwareController::class, 'index']);
        Route::get('/bios-change-requests', [ResellerBiosChangeRequestController::class, 'index']);
        Route::post('/bios-change-requests', [ResellerBiosChangeRequestController::class, 'store']);
        Route::get('/online-users', [OnlineUsersController::class, 'index']);
        Route::get('/reseller-logs', [ResellerResellerLogController::class, 'index']);
        Route::get('/ip-analytics', [ResellerIpAnalyticsController::class, 'index']);

        Route::prefix('reports')->group(function (): void {
            Route::get('/summary', [ResellerReportController::class, 'summary']);
            Route::get('/revenue', [ResellerReportController::class, 'revenue']);
            Route::get('/activations', [ResellerReportController::class, 'activations']);
            Route::get('/top-programs', [ResellerReportController::class, 'topPrograms']);
            Route::get('/export/csv', [ResellerReportController::class, 'exportCsv']);
            Route::get('/export/pdf', [ResellerReportController::class, 'exportPdf']);
        });
    });

    Route::middleware('role:super_admin,reseller,manager,manager_parent')->group(function (): void {
        Route::get('/licenses/{license}', [LicenseController::class, 'show']);
        Route::post('/licenses/{license}/renew', [LicenseController::class, 'renew']);
        Route::post('/licenses/{license}/deactivate', [LicenseController::class, 'deactivate']);
        Route::post('/licenses/{license}/pause', [LicenseController::class, 'pause']);
        Route::post('/licenses/{license}/resume', [LicenseController::class, 'resume']);
        Route::post('/licenses/{license}/retry-scheduled', [LicenseController::class, 'retryScheduled']);
        Route::post('/licenses/{license}/cancel-pending', [LicenseController::class, 'cancelPending']);
        Route::post('/licenses/bulk-renew', [LicenseController::class, 'bulkRenew']);
        Route::post('/licenses/bulk-deactivate', [LicenseController::class, 'bulkDeactivate']);
        Route::post('/licenses/bulk-delete', [LicenseController::class, 'bulkDelete']);
        Route::delete('/licenses/{license}', [LicenseController::class, 'destroy']);
    });

    // ============================================================
    // CUSTOMER PORTAL REMOVED - Phase 11 Role Refactor (2026-03-01)
    // Silent deny is enforced in AuthController + ActiveRoleMiddleware.
    // Controllers remain on disk under backend/app/Http/Controllers/Customer/
    // ============================================================
    // Route::prefix('customer')->middleware('role:customer')->group(function (): void {
    //     Route::get('/dashboard', [CustomerDashboardController::class, 'index']);
    //     Route::get('/software', [CustomerSoftwareController::class, 'index']);
    //     Route::get('/downloads', [CustomerDownloadController::class, 'index']);
    //     Route::post('/downloads/{license}/log', [CustomerDownloadController::class, 'logDownload']);
    // });

    Route::prefix('super-admin')->middleware('role:super_admin')->group(function (): void {
        Route::get('/dashboard/stats', [SuperAdminDashboardController::class, 'stats']);
        Route::get('/dashboard/revenue-trend', [SuperAdminDashboardController::class, 'revenueTrend']);
        Route::get('/dashboard/tenant-comparison', [SuperAdminDashboardController::class, 'tenantComparison']);
        Route::get('/dashboard/license-timeline', [SuperAdminDashboardController::class, 'licenseTimeline']);
        Route::get('/dashboard/recent-activity', [SuperAdminDashboardController::class, 'recentActivity']);

        Route::get('/tenants/{tenant}/stats', [SuperAdminTenantController::class, 'stats']);
        Route::get('/tenants/{tenant}/backups', [SuperAdminTenantResetController::class, 'index']);
        Route::post('/tenants/{tenant}/reset', [SuperAdminTenantResetController::class, 'reset']);
        Route::post('/tenants/{tenant}/backups/import', [SuperAdminTenantResetController::class, 'import']);
        Route::get('/tenants/{tenant}/backups/{backup}/download', [SuperAdminTenantResetController::class, 'download']);
        Route::post('/tenants/{tenant}/backups/{backup}/restore', [SuperAdminTenantResetController::class, 'restore']);
        Route::delete('/tenants/{tenant}/backups/{backup}', [SuperAdminTenantResetController::class, 'destroy']);
        Route::apiResource('tenants', SuperAdminTenantController::class);

        Route::get('/users', [SuperAdminUserController::class, 'index']);
        Route::get('/users/{user}', [SuperAdminUserController::class, 'show']);
        Route::put('/users/{user}/status', [SuperAdminUserController::class, 'updateStatus']);
        Route::delete('/users/{user}', [SuperAdminUserController::class, 'destroy']);
        Route::get('/username-management', [\App\Http\Controllers\SuperAdmin\UsernameManagementController::class, 'index']);
        Route::post('/username-management/{user}/unlock', [\App\Http\Controllers\SuperAdmin\UsernameManagementController::class, 'unlock']);
        Route::put('/username-management/{user}/username', [\App\Http\Controllers\SuperAdmin\UsernameManagementController::class, 'changeUsername']);
        Route::post('/username-management/{user}/reset-password', [\App\Http\Controllers\SuperAdmin\UsernameManagementController::class, 'resetPassword']);
        Route::get('/customers', [SuperAdminCustomerController::class, 'index']);
        Route::post('/customers', [SuperAdminCustomerController::class, 'store']);
        Route::get('/customers/{user}', [SuperAdminCustomerController::class, 'show']);
        Route::put('/customers/{user}', [SuperAdminCustomerController::class, 'update']);
        Route::delete('/customers/{user}', [SuperAdminCustomerController::class, 'destroy']);
        Route::get('/licenses/expiring', [SuperAdminLicenseController::class, 'expiring']);
        Route::post('/licenses/force-activate', [SuperAdminLicenseController::class, 'forceActivate']);
        Route::get('/admin-management', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'index']);
        Route::get('/admin-management/{user}', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'show']);
        Route::post('/admin-management', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'store']);
        Route::put('/admin-management/{user}', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'update']);
        Route::delete('/admin-management/{user}', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'destroy']);
        Route::post('/admin-management/{user}/reset-password', [\App\Http\Controllers\SuperAdmin\AdminManagementController::class, 'resetPassword']);
        Route::get('/security/locks', [SecurityController::class, 'index']);
        Route::post('/security/unblock-email', [SecurityController::class, 'unblockEmail']);
        Route::post('/security/unblock-ip', [SecurityController::class, 'unblockIp']);
        Route::get('/security/audit-log', [SecurityController::class, 'auditLog']);

        Route::get('/bios-blacklist', [SuperAdminBiosBlacklistController::class, 'index']);
        Route::get('/bios-blacklist/stats', [SuperAdminBiosBlacklistController::class, 'stats']);
        Route::post('/bios-blacklist', [SuperAdminBiosBlacklistController::class, 'store']);
        Route::post('/bios-blacklist/import', [SuperAdminBiosBlacklistController::class, 'import']);
        Route::get('/bios-blacklist/export', [SuperAdminBiosBlacklistController::class, 'export']);
        Route::post('/bios-blacklist/{biosBlacklist}/remove', [SuperAdminBiosBlacklistController::class, 'remove']);
        Route::delete('/bios-blacklist/{biosBlacklist}/purge', [SuperAdminBiosBlacklistController::class, 'destroy']);
        Route::get('/bios-conflicts', [SuperAdminBiosConflictController::class, 'index']);
        Route::put('/bios-conflicts/{id}/resolve', [SuperAdminBiosConflictController::class, 'resolve']);

        Route::get('/bios-change-requests', [\App\Http\Controllers\SuperAdmin\BiosChangeRequestController::class, 'index']);
        Route::put('/bios-change-requests/{biosChangeRequest}/approve', [\App\Http\Controllers\SuperAdmin\BiosChangeRequestController::class, 'approve']);
        Route::put('/bios-change-requests/{biosChangeRequest}/reject', [\App\Http\Controllers\SuperAdmin\BiosChangeRequestController::class, 'reject']);

        Route::get('/bios-history', [BiosHistoryController::class, 'index']);
        Route::get('/bios-history/{biosId}', [BiosHistoryController::class, 'show']);
        Route::get('/bios/search', [SuperAdminBiosDetailsController::class, 'search']);
        Route::get('/bios/recent', [SuperAdminBiosDetailsController::class, 'recent']);
        Route::get('/bios/{biosId}', [SuperAdminBiosDetailsController::class, 'show']);
        Route::get('/bios/{biosId}/licenses', [SuperAdminBiosDetailsController::class, 'licenses']);
        Route::get('/bios/{biosId}/resellers', [SuperAdminBiosDetailsController::class, 'resellers']);
        Route::get('/bios/{biosId}/ips', [SuperAdminBiosDetailsController::class, 'ips']);
        Route::get('/bios/{biosId}/activity', [SuperAdminBiosDetailsController::class, 'activity']);

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
        Route::get('/online-users', [OnlineUsersController::class, 'index']);
    });
});
