<?php

namespace App\Support;

use App\Models\DeletedCustomer;
use App\Models\License;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CustomerDeletionService
{
    /**
     * Snapshot customer data and perform soft deletion by moving to deleted_customers table.
     */
    public static function snapshotAndDelete(User $customer, User $actor): DeletedCustomer
    {
        return DB::transaction(function () use ($customer, $actor): DeletedCustomer {
            // Collect licenses
            $licenses = License::query()
                ->where('customer_id', $customer->id)
                ->get()
                ->toArray();

            // Find activity_log IDs for this customer's license activations/renewals
            $activityLogIds = DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($query) use ($customer) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$customer->id])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$customer->name]);
                })
                ->pluck('id')
                ->toArray();

            // Calculate total revenue from those activity logs
            $revenueTotal = DB::table('activity_logs')
                ->whereIn('id', $activityLogIds)
                ->selectRaw('COALESCE(SUM(CAST(JSON_EXTRACT(metadata, "$.price") AS DECIMAL(12,2))), 0) as total')
                ->value('total');

            // Build snapshot JSON
            $snapshot = [
                'user' => $customer->toArray(),
                'licenses' => $licenses,
                'activity_log_ids' => $activityLogIds,
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

            // Delete licenses (hard delete)
            foreach ($licenses as $license) {
                License::query()->where('id', $license['id'])->delete();
            }

            // Delete user (hard delete)
            $customer->delete();

            return $deletedCustomer;
        });
    }
}
