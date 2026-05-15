<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Services\TransactionEditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends BaseSuperAdminController
{
    public function __construct(
        private readonly TransactionEditService $transactionEditService,
    ) {}

    public function destroy(int $activityLog): JsonResponse
    {
        $user = auth()->user();
        $activityLogModel = ActivityLog::query()->find($activityLog);

        DB::transaction(function () use ($activityLog, $activityLogModel, $user): void {
            // Log the deletion
            if ($activityLogModel && $user) {
                $this->transactionEditService->logTransactionDeletion($activityLog, $activityLogModel, $user);
            }

            // Delete the activity log
            DB::table('activity_logs')
                ->where('id', $activityLog)
                ->delete();
        });

        // Invalidate cache
        \App\Support\LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');

        return response()->json([
            'message' => 'Transaction deleted successfully.',
        ]);
    }
}
