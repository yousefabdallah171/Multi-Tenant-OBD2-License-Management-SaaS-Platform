<?php

namespace App\Support;

use App\Models\DeletedCustomer;
use App\Models\License;
use App\Models\User;
use App\Models\UserBalance;
use Illuminate\Support\Facades\DB;

class CustomerDeletionService
{
    /**
     * Snapshot customer data and perform soft deletion by moving to deleted_customers table.
     */
    public static function snapshotAndDelete(User $customer, User $actor): DeletedCustomer
    {
        $deletedCustomer = DB::transaction(function () use ($customer, $actor): DeletedCustomer {
            // Collect licenses
            $licenses = License::query()
                ->where('customer_id', $customer->id)
                ->get()
                ->toArray();

            // Find activity logs for this customer's license activations/renewals
            $activityLogs = DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
                ->where(function ($query) use ($customer) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$customer->id])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customer->name]);
                })
                ->get()
                ->toArray();

            $activityLogIds = array_column($activityLogs, 'id');

            // Calculate total revenue from those activity logs
            $revenueTotal = DB::table('activity_logs')
                ->whereIn('id', $activityLogIds)
                ->selectRaw('COALESCE(SUM(CAST(JSON_EXTRACT(metadata, "$.price") AS DECIMAL(12,2))), 0) as total')
                ->value('total');

            // Build snapshot JSON (include full activity log data for restoration)
            $snapshot = [
                'user' => $customer->toArray(),
                'licenses' => $licenses,
                'activity_log_ids' => $activityLogIds,
                'activity_logs' => $activityLogs, // Store full activity log data for restoration
            ];

            // Create deleted_customers record
            $deletedCustomer = DeletedCustomer::query()->create([
                'original_customer_id' => $customer->id,
                'tenant_id' => $customer->tenant_id,
                'name' => $customer->name,
                'email' => $customer->email,
                'username' => $customer->username,
                'phone' => $customer->phone ?? null,
                'deleted_by' => $actor->id,
                'deleted_at' => now(),
                'snapshot' => $snapshot,
                'licenses_count' => count($licenses),
                'revenue_total' => (float) $revenueTotal,
            ]);

            // Delete activity logs (transaction history) - HARD DELETE for clean history
            DB::table('activity_logs')
                ->whereIn('id', $activityLogIds)
                ->delete();

            // Delete licenses (hard delete)
            foreach ($licenses as $license) {
                License::query()->where('id', $license['id'])->delete();
            }

            // Delete user (hard delete)
            $customer->delete();

            // Recalculate UserBalance for affected resellers (queried after logs deleted = correct lower total)
            $resellerIds = array_values(array_unique(
                array_filter(array_column($licenses, 'reseller_id'))
            ));
            self::recalculateResellerBalances($resellerIds);

            return $deletedCustomer;
        });

        // Invalidate all report caches after transaction commits
        LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager-parent:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager:reports:version');
        LicenseCacheInvalidation::bumpVersion('reseller:reports:version');

        return $deletedCustomer;
    }

    /**
     * Recalculate UserBalance totals for a set of reseller IDs.
     * Should be called after revenue activity logs have been deleted.
     *
     * @param array<int> $resellerIds
     */
    public static function recalculateResellerBalances(array $resellerIds): void
    {
        foreach ($resellerIds as $resellerId) {
            $reseller = User::find((int) $resellerId);
            if ($reseller === null) {
                continue;
            }

            $totalRevenue = (float) DB::table('activity_logs')
                ->where('tenant_id', $reseller->tenant_id)
                ->where('user_id', $resellerId)
                ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
                ->selectRaw('COALESCE(SUM(CAST(JSON_EXTRACT(metadata, "$.price") AS DECIMAL(12,2))), 0) as total')
                ->value('total');

            UserBalance::updateOrCreate(
                ['user_id' => (int) $resellerId],
                [
                    'tenant_id' => $reseller->tenant_id,
                    'total_revenue' => round($totalRevenue, 2),
                    'pending_balance' => round($totalRevenue, 2),
                    'last_activity_at' => now(),
                ]
            );
        }
    }
}
