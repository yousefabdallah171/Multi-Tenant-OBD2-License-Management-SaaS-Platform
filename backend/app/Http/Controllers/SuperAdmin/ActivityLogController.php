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
        try {
            // Fetch activity log before deletion
            $activityLogModel = ActivityLog::query()->find($activityLog);
            $user = auth()->user();

            DB::transaction(function () use ($activityLog, $activityLogModel, $user): void {
                // Log the deletion if we have the activity log and user
                if ($activityLogModel && $user) {
                    try {
                        $this->transactionEditService->logTransactionDeletion($activityLog, $activityLogModel, $user);
                    } catch (\Exception $e) {
                        \Log::warning('Failed to log transaction deletion: ' . $e->getMessage());
                        // Continue with deletion even if logging fails
                    }
                }

                // Delete transaction_edits records that reference this activity log first
                DB::table('transaction_edits')
                    ->where('activity_log_id', $activityLog)
                    ->delete();

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
        } catch (\Exception $e) {
            \Log::error('Error deleting activity log: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Error deleting transaction: ' . $e->getMessage(),
            ], 500);
        }
    }
}
