<?php

namespace App\Http\Controllers\SuperAdmin;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends BaseSuperAdminController
{
    public function destroy(int $activityLogId): JsonResponse
    {
        DB::transaction(function () use ($activityLogId): void {
            DB::table('activity_logs')
                ->where('id', $activityLogId)
                ->delete();
        });

        // Invalidate cache
        \App\Support\LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');

        return response()->json([
            'message' => 'Transaction deleted successfully.',
        ]);
    }
}
