<?php

namespace App\Http\Controllers\SuperAdmin;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends BaseSuperAdminController
{
    public function destroy(int $activityLog): JsonResponse
    {
        DB::transaction(function () use ($activityLog): void {
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
