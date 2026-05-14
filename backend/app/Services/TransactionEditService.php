<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\TransactionEdit;
use App\Models\User;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TransactionEditService
{
    public function __construct(
        private readonly BalanceService $balanceService,
    ) {}

    /**
     * Edit a transaction (license + activity log)
     *
     * @param License $license
     * @param array{price?: float, customer_id?: int, activated_at?: string, duration_days?: float, program_id?: int, reason?: string} $newValues
     * @param User $superAdmin
     * @param string|null $reason
     * @return array{transaction: array, affected: array}
     */
    public function editTransaction(
        License $license,
        array $newValues,
        User $superAdmin,
        ?string $reason = null,
    ): array {
        $newValues = array_filter($newValues, fn ($v) => $v !== null);

        return DB::transaction(function () use ($license, $newValues, $superAdmin, $reason): array {
            $license->refresh();

            // Snapshot previous values for audit
            $previousValues = [
                'price' => $license->price,
                'customer_id' => $license->customer_id,
                'activated_at' => $license->activated_at?->toIso8601String(),
                'duration_days' => $license->duration_days,
                'program_id' => $license->program_id,
            ];

            // Get the corresponding activity log entry (first activation or most recent)
            $activityLog = ActivityLog::query()
                ->where('tenant_id', $license->tenant_id)
                ->whereMetadataLicenseId((int) $license->id)
                ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
                ->orderByDesc('created_at')
                ->first();

            // Update License record
            if (isset($newValues['price'])) {
                $license->price = (float) $newValues['price'];
            }
            if (isset($newValues['customer_id'])) {
                $license->customer_id = (int) $newValues['customer_id'];
            }
            if (isset($newValues['activated_at'])) {
                $license->activated_at = $newValues['activated_at'];
            }
            if (isset($newValues['duration_days'])) {
                $license->duration_days = (float) $newValues['duration_days'];
            }
            if (isset($newValues['program_id'])) {
                $license->program_id = (int) $newValues['program_id'];
            }
            $license->save();

            // Update ActivityLog metadata if it exists
            if ($activityLog !== null) {
                $metadata = (array) ($activityLog->metadata ?? []);

                if (isset($newValues['price'])) {
                    $metadata['price'] = (float) $newValues['price'];
                }
                if (isset($newValues['customer_id'])) {
                    $metadata['customer_id'] = (int) $newValues['customer_id'];
                }
                if (isset($newValues['activated_at'])) {
                    $metadata['activated_at'] = $newValues['activated_at'];
                }
                if (isset($newValues['duration_days'])) {
                    $metadata['duration_days'] = (float) $newValues['duration_days'];
                }
                if (isset($newValues['program_id'])) {
                    $metadata['program_id'] = (int) $newValues['program_id'];
                }

                $activityLog->metadata = $metadata;
                $activityLog->save();
            }

            // Create audit record (only if table exists)
            $edit = null;
            if (DB::connection()->getSchemaBuilder()->hasTable('transaction_edits')) {
                $edit = TransactionEdit::create([
                    'tenant_id' => $license->tenant_id,
                    'license_id' => $license->id,
                    'activity_log_id' => $activityLog?->id,
                    'super_admin_id' => $superAdmin->id,
                    'action' => 'edit',
                    'previous_values' => $previousValues,
                    'new_values' => $newValues,
                    'reason' => $reason,
                ]);
            }

            // Log activity for super admin logs page
            ActivityLog::create([
                'tenant_id' => $license->tenant_id,
                'user_id' => $superAdmin->id,
                'action' => 'transaction.edited',
                'description' => sprintf(
                    'Super Admin edited transaction (License #%d). Changes: %s',
                    $license->id,
                    implode(', ', array_map(
                        fn ($k, $v) => "{$k}: {$previousValues[$k]} → {$v}",
                        array_keys($newValues),
                        $newValues
                    ))
                ),
                'metadata' => [
                    'license_id' => $license->id,
                    'transaction_edit_id' => $edit?->id,
                    'previous_values' => $previousValues,
                    'new_values' => $newValues,
                    'reseller_id' => $license->reseller_id,
                    'customer_id' => $license->customer_id,
                    'price' => $license->price,
                ],
                'ip_address' => request()?->ip(),
            ]);

            // Get affected seller IDs (reseller + their manager + manager parent)
            $affectedSellerIds = $this->getAffectedSellerIds($license->reseller);

            // Invalidate all affected caches
            $invalidatedCaches = $this->invalidateCaches($license);

            // Recalculate balances for affected users
            $affectedUsers = $this->recalculateBalances($affectedSellerIds);

            // Reload license with relationships for response
            $license->load('reseller:id,name', 'customer:id,name,email', 'program:id,name', 'tenant:id,name');

            return [
                'transaction' => $this->serializeTransaction($license, $edit),
                'affected' => [
                    'licenses_updated' => 1,
                    'activity_logs_updated' => $activityLog !== null ? 1 : 0,
                    'caches_invalidated' => count($invalidatedCaches),
                    'balances_recalculated' => $affectedUsers,
                    'edit_id' => $edit?->id,
                ],
            ];
        });
    }

    /**
     * Revert a transaction to its previous state
     *
     * @param License $license
     * @param User $superAdmin
     * @param string|null $reason
     * @return array{transaction: array, affected: array}
     */
    public function revertTransaction(
        License $license,
        User $superAdmin,
        ?string $reason = null,
    ): array {
        $lastEdit = TransactionEdit::query()
            ->where('license_id', $license->id)
            ->where('action', 'edit')
            ->orderByDesc('created_at')
            ->first();

        abort_unless($lastEdit, 404, 'No edits found to revert.');

        $previousValues = $lastEdit->previous_values;

        return $this->editTransaction(
            $license,
            $previousValues,
            $superAdmin,
            $reason ?? "Revert to previous state (edit #{$lastEdit->id})",
        );
    }

    /**
     * Get full edit history for a license
     *
     * @param License $license
     * @return Collection
     */
    public function getTransactionHistory(License $license): Collection
    {
        // Check if transaction_edits table exists (migration might not have been run)
        if (!DB::connection()->getSchemaBuilder()->hasTable('transaction_edits')) {
            return collect([]);
        }

        return TransactionEdit::query()
            ->where('license_id', $license->id)
            ->with('superAdmin:id,name,email')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (TransactionEdit $edit): array => [
                'id' => $edit->id,
                'super_admin_id' => $edit->super_admin_id,
                'super_admin_name' => $edit->superAdmin->name,
                'super_admin_email' => $edit->superAdmin->email,
                'action' => $edit->action,
                'previous_values' => $edit->previous_values,
                'new_values' => $edit->new_values,
                'reason' => $edit->reason,
                'diffs' => $edit->getDiffsAttribute(),
                'created_at' => $edit->created_at?->toIso8601String(),
            ]);
    }

    /**
     * Invalidate all report caches affected by the edit
     *
     * @param License $license
     * @return array List of cache keys invalidated
     */
    private function invalidateCaches(License $license): array
    {
        $invalidated = [];
        $tenantId = (int) $license->tenant_id;
        $resellerId = (int) $license->reseller_id;

        try {
            // Super Admin financial reports cache
            Cache::tags(['super-admin', 'financial-reports'])->flush();
            $invalidated[] = 'super-admin:financial-reports:*';

            // Super Admin reseller payments cache
            Cache::tags(['super-admin', 'reseller-payments'])->flush();
            $invalidated[] = 'super-admin:reseller-payments:*';

            // Manager Parent financial reports for this tenant
            Cache::tags(["manager-parent:tenant-{$tenantId}", 'financial-reports'])->flush();
            $invalidated[] = "manager-parent:tenant-{$tenantId}:financial-reports:*";

            // Manager reports for resellers of this license
            Cache::tags(["manager:tenant-{$tenantId}", 'reports'])->flush();
            $invalidated[] = "manager:tenant-{$tenantId}:reports:*";

            // Reseller reports for this specific reseller
            Cache::tags(["reseller:{$resellerId}", 'reports'])->flush();
            $invalidated[] = "reseller:{$resellerId}:reports:*";
        } catch (\BadMethodCallException $e) {
            // Cache store doesn't support tagging (e.g., file cache), skip tagged invalidation
        }

        // License cache invalidation using existing system (works with all cache drivers)
        LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager-parent:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager:reports:version');
        LicenseCacheInvalidation::bumpVersion('reseller:reports:version');
        $invalidated[] = 'LicenseCacheInvalidation:all-versions';

        return $invalidated;
    }

    /**
     * Recalculate UserBalance totals for affected users
     *
     * @param array $sellerIds
     * @return array List of affected user IDs
     */
    private function recalculateBalances(array $sellerIds): array
    {
        $affectedUsers = [];

        foreach ($sellerIds as $userId) {
            $user = User::find($userId);
            if ($user === null) {
                continue;
            }

            // Recalculate by re-querying activity logs for this user
            // This triggers the BalanceService to update the UserBalance record
            // (This is done via the license service when activating, so we simulate it here)

            $totalRevenue = (float) ActivityLog::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('user_id', $user->id)
                ->whereIn('action', ['license.activated', 'license.renewed', 'license.scheduled_activation_executed'])
                ->whereRaw(\App\Support\RevenueAnalytics::earnedCondition())
                ->selectRaw(\App\Support\RevenueAnalytics::priceExpression())
                ->sum(DB::raw(\App\Support\RevenueAnalytics::priceExpression()));

            // Update or create user balance
            $balance = \App\Models\UserBalance::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'tenant_id' => $user->tenant_id,
                    'total_revenue' => round($totalRevenue, 2),
                    'pending_balance' => round($totalRevenue, 2),
                    'last_activity_at' => now(),
                ]
            );

            $affectedUsers[] = [
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_role' => $user->role?->value ?? (string) $user->role,
                'total_revenue' => round($totalRevenue, 2),
            ];
        }

        return $affectedUsers;
    }

    /**
     * Get all affected seller IDs (reseller + manager + manager parent chain)
     *
     * @param User $reseller
     * @return array
     */
    private function getAffectedSellerIds(User $reseller): array
    {
        $sellerIds = [(int) $reseller->id];

        // Add manager if reseller was created by one
        if ($reseller->created_by !== null) {
            $manager = User::find($reseller->created_by);
            if ($manager !== null) {
                $sellerIds[] = (int) $manager->id;

                // Add manager parent if manager was created by one
                if ($manager->created_by !== null) {
                    $managerParent = User::find($manager->created_by);
                    if ($managerParent !== null) {
                        $sellerIds[] = (int) $managerParent->id;
                    }
                }
            }
        }

        return array_unique($sellerIds);
    }

    /**
     * Serialize license transaction for response
     *
     * @param License $license
     * @param TransactionEdit|null $edit
     * @return array
     */
    private function serializeTransaction(License $license, ?TransactionEdit $edit): array
    {
        return [
            'license_id' => $license->id,
            'activity_log_id' => $edit?->activity_log_id,
            'tenant_id' => $license->tenant_id,
            'tenant_name' => $license->tenant?->name,
            'reseller_id' => $license->reseller_id,
            'reseller_name' => $license->reseller?->name,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'bios_id' => $license->bios_id,
            'program_id' => $license->program_id,
            'program_name' => $license->program?->name,
            'price' => round((float) $license->price, 2),
            'duration_days' => (float) $license->duration_days,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'status' => $license->status,
            'last_edited' => $edit ? [
                'by' => $edit->superAdmin->name,
                'at' => $edit->created_at?->toIso8601String(),
                'reason' => $edit->reason,
            ] : null,
        ];
    }
}
