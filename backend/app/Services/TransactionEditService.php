<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\TransactionEdit;
use App\Models\User;
use App\Support\LicenseCacheInvalidation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TransactionEditService
{
    private const EDITABLE_ACTIONS = [
        'license.activated',
        'license.renewed',
        'license.scheduled_activation_executed',
    ];

    private const TRACKED_FIELDS = [
        'price',
        'customer_id',
        'activated_at',
        'duration_days',
        'program_id',
    ];

    public function __construct(
        private readonly BalanceService $balanceService,
    ) {}

    /**
     * @param array{price?: float, customer_id?: int, activated_at?: string, duration_days?: float, program_id?: int, reason?: string} $newValues
     * @return array{transaction: array, affected: array}
     */
    public function editTransaction(
        License $license,
        ActivityLog $activityLog,
        array $newValues,
        User $superAdmin,
        ?string $reason = null,
    ): array {
        $submittedValues = array_filter($newValues, fn ($value) => $value !== null);

        return DB::transaction(function () use ($license, $activityLog, $submittedValues, $superAdmin, $reason): array {
            $license->refresh();
            $activityLog->refresh();

            $previousValues = $this->snapshotTransaction($license, $activityLog);
            $newSnapshot = $this->buildNewSnapshot($previousValues, $submittedValues);
            $changedFields = $this->changedFields($previousValues, $newSnapshot, array_keys($submittedValues));

            abort_if($changedFields === [], 422, 'No actual changes were detected.');

            $isLatestEvent = $this->isLatestRevenueEventForLicense($license, $activityLog);

            $this->applyActivityLogChanges($activityLog, $changedFields);

            $licenseWasUpdated = $this->applyLicenseChanges($license, $changedFields, $isLatestEvent);

            $edit = null;
            if (DB::connection()->getSchemaBuilder()->hasTable('transaction_edits')) {
                $edit = TransactionEdit::create([
                    'tenant_id' => $license->tenant_id,
                    'license_id' => $license->id,
                    'activity_log_id' => $activityLog->id,
                    'super_admin_id' => $superAdmin->id,
                    'action' => 'edit',
                    'previous_values' => $previousValues,
                    'new_values' => $newSnapshot,
                    'reason' => $reason,
                ]);
            }

            ActivityLog::create([
                'tenant_id' => $license->tenant_id,
                'user_id' => $superAdmin->id,
                'action' => 'transaction.edited',
                'description' => sprintf(
                    'Super Admin edited transaction (ActivityLog #%d, License #%d). Changes: %s',
                    $activityLog->id,
                    $license->id,
                    implode(', ', array_map(
                        fn ($key, $value) => sprintf('%s: %s -> %s', $key, $this->stringifyValue($previousValues[$key] ?? null), $this->stringifyValue($value)),
                        array_keys($changedFields),
                        $changedFields
                    ))
                ),
                'metadata' => [
                    'activity_log_id' => $activityLog->id,
                    'license_id' => $license->id,
                    'transaction_edit_id' => $edit?->id,
                    'previous_values' => $previousValues,
                    'new_values' => $newSnapshot,
                    'changed_fields' => $changedFields,
                    'reseller_id' => $license->reseller_id,
                    'customer_id' => $license->customer_id,
                    'price' => $newSnapshot['price'],
                ],
                'ip_address' => request()?->ip(),
            ]);

            $affectedSellerIds = $this->getAffectedSellerIds($license, $activityLog);
            $invalidatedCaches = $this->invalidateCaches($license, $affectedSellerIds);
            $affectedUsers = $this->recalculateBalances($affectedSellerIds);

            $license->load('reseller:id,name', 'customer:id,name,email', 'program:id,name', 'tenant:id,name');
            $activityLog->refresh();

            return [
                'transaction' => $this->serializeTransaction($license, $activityLog, $edit),
                'affected' => [
                    'licenses_updated' => $licenseWasUpdated ? 1 : 0,
                    'activity_logs_updated' => 1,
                    'caches_invalidated' => count($invalidatedCaches),
                    'balances_recalculated' => $affectedUsers,
                    'edit_id' => $edit?->id,
                ],
            ];
        });
    }

    /**
     * @return array{transaction: array, affected: array}
     */
    public function revertTransaction(
        License $license,
        ActivityLog $activityLog,
        User $superAdmin,
        ?string $reason = null,
    ): array {
        $lastEdit = TransactionEdit::query()
            ->where('license_id', $license->id)
            ->where('activity_log_id', $activityLog->id)
            ->where('action', 'edit')
            ->orderByDesc('created_at')
            ->first();

        abort_unless($lastEdit, 404, 'No edits found to revert.');

        return $this->editTransaction(
            $license,
            $activityLog,
            $lastEdit->previous_values,
            $superAdmin,
            $reason ?? "Revert to previous state (edit #{$lastEdit->id})",
        );
    }

    public function logTransactionDeletion(int $activityLogId, ?ActivityLog $activityLog, User $superAdmin): void
    {
        if ($activityLog === null || !$superAdmin) {
            return;
        }

        if (!DB::connection()->getSchemaBuilder()->hasTable('transaction_edits')) {
            return;
        }

        try {
            $metadata = is_array($activityLog->metadata) ? $activityLog->metadata : json_decode($activityLog->metadata ?? '{}', true) ?? [];

            $previousValues = [
                'license_id' => $metadata['license_id'] ?? null,
                'price' => $metadata['price'] ?? null,
                'customer_id' => $metadata['customer_id'] ?? null,
                'customer_name' => $metadata['customer_name'] ?? null,
                'program_id' => $metadata['program_id'] ?? null,
                'program_name' => $metadata['program_name'] ?? null,
                'bios_id' => $metadata['bios_id'] ?? null,
            ];

            $licenseId = (int) ($metadata['license_id'] ?? 0);
            TransactionEdit::query()->create([
                'tenant_id' => $activityLog->tenant_id ?? 0,
                'license_id' => $licenseId > 0 ? $licenseId : 0,
                'activity_log_id' => null,
                'super_admin_id' => $superAdmin->id,
                'action' => 'delete',
                'previous_values' => $previousValues,
                'new_values' => [],
                'reason' => 'Deleted',
            ]);

            ActivityLog::query()->create([
                'tenant_id' => $activityLog->tenant_id ?? 0,
                'user_id' => $superAdmin->id,
                'action' => 'transaction.deleted',
                'description' => sprintf(
                    'Transaction deleted - BIOS: %s, Price: $%s, Customer: %s',
                    $previousValues['bios_id'] ?? 'Unknown',
                    number_format((float) ($previousValues['price'] ?? 0), 2),
                    $previousValues['customer_name'] ?? 'Unknown'
                ),
                'metadata' => [
                    'activity_log_id' => $activityLogId,
                    'license_id' => $previousValues['license_id'],
                    'previous_values' => $previousValues,
                    'customer_id' => $previousValues['customer_id'],
                    'price' => $previousValues['price'],
                ],
                'ip_address' => request()?->ip(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to log transaction deletion: '.$e->getMessage());
            throw $e;
        }
    }

    public function getTransactionHistory(License $license, ?ActivityLog $activityLog = null): Collection
    {
        if (!DB::connection()->getSchemaBuilder()->hasTable('transaction_edits')) {
            return collect([]);
        }

        return TransactionEdit::query()
            ->where('license_id', $license->id)
            ->when($activityLog !== null, fn ($query) => $query->where('activity_log_id', $activityLog->id))
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

    public function serializeTransaction(License $license, ActivityLog $activityLog, ?TransactionEdit $edit = null): array
    {
        $snapshot = $this->snapshotTransaction($license, $activityLog);

        return [
            'license_id' => $license->id,
            'activity_log_id' => $activityLog->id,
            'tenant_id' => $license->tenant_id,
            'tenant_name' => $license->tenant?->name,
            'reseller_id' => $license->reseller_id,
            'reseller_name' => $license->reseller?->name,
            'customer_id' => $snapshot['customer_id'],
            'customer_name' => $license->customer?->name,
            'customer_email' => $license->customer?->email,
            'bios_id' => $license->bios_id,
            'program_id' => $snapshot['program_id'],
            'program_name' => $license->program?->name,
            'price' => $snapshot['price'],
            'duration_days' => $snapshot['duration_days'],
            'activated_at' => $snapshot['activated_at'],
            'expires_at' => $license->expires_at?->toIso8601String(),
            'status' => $license->status,
            'created_at' => $activityLog->created_at?->toIso8601String(),
            'updated_at' => $activityLog->updated_at?->toIso8601String(),
            'last_edited' => $edit ? [
                'by' => $edit->superAdmin->name,
                'at' => $edit->created_at?->toIso8601String(),
                'reason' => $edit->reason,
            ] : null,
        ];
    }

    /**
     * @return array{price: float, customer_id: ?int, activated_at: ?string, duration_days: ?float, program_id: ?int}
     */
    private function snapshotTransaction(License $license, ActivityLog $activityLog): array
    {
        $metadata = is_array($activityLog->metadata) ? $activityLog->metadata : [];

        return [
            'price' => round((float) ($metadata['price'] ?? $license->price ?? 0), 2),
            'customer_id' => $this->nullableInt($metadata['customer_id'] ?? $license->customer_id),
            'activated_at' => $activityLog->created_at?->toIso8601String() ?? $license->activated_at?->toIso8601String(),
            'duration_days' => $this->nullableFloat($metadata['duration_days'] ?? $license->duration_days, 3),
            'program_id' => $this->nullableInt($metadata['program_id'] ?? $license->program_id),
        ];
    }

    /**
     * @param array<string, mixed> $previousValues
     * @param array<string, mixed> $submittedValues
     * @return array<string, mixed>
     */
    private function buildNewSnapshot(array $previousValues, array $submittedValues): array
    {
        $snapshot = $previousValues;

        foreach ($submittedValues as $field => $value) {
            if (!in_array($field, self::TRACKED_FIELDS, true)) {
                continue;
            }

            $snapshot[$field] = $this->normalizeSnapshotValue($field, $value);
        }

        return $snapshot;
    }

    /**
     * @param array<string, mixed> $previousValues
     * @param array<string, mixed> $newValues
     * @param array<int, string> $submittedFields
     * @return array<string, mixed>
     */
    private function changedFields(array $previousValues, array $newValues, array $submittedFields): array
    {
        $changed = [];

        foreach ($submittedFields as $field) {
            if (!in_array($field, self::TRACKED_FIELDS, true)) {
                continue;
            }

            $previous = $this->normalizeSnapshotValue($field, $previousValues[$field] ?? null);
            $next = $this->normalizeSnapshotValue($field, $newValues[$field] ?? null);

            if ($previous !== $next) {
                $changed[$field] = $next;
            }
        }

        return $changed;
    }

    /**
     * @param array<string, mixed> $changedFields
     */
    private function applyActivityLogChanges(ActivityLog $activityLog, array $changedFields): void
    {
        $metadata = (array) ($activityLog->metadata ?? []);

        if (array_key_exists('price', $changedFields)) {
            $metadata['price'] = round((float) $changedFields['price'], 2);
        }
        if (array_key_exists('customer_id', $changedFields)) {
            $metadata['customer_id'] = $changedFields['customer_id'];
        }
        if (array_key_exists('duration_days', $changedFields)) {
            $metadata['duration_days'] = $changedFields['duration_days'];
        }
        if (array_key_exists('program_id', $changedFields)) {
            $metadata['program_id'] = $changedFields['program_id'];
        }
        if (array_key_exists('activated_at', $changedFields)) {
            $metadata['activated_at'] = $changedFields['activated_at'];
            $activityLog->created_at = CarbonImmutable::parse((string) $changedFields['activated_at']);
        }

        $activityLog->metadata = $metadata;
        $activityLog->save();
    }

    /**
     * @param array<string, mixed> $changedFields
     */
    private function applyLicenseChanges(License $license, array $changedFields, bool $isLatestEvent): bool
    {
        if (!$isLatestEvent) {
            return false;
        }

        if (array_key_exists('price', $changedFields)) {
            $license->price = round((float) $changedFields['price'], 2);
        }
        if (array_key_exists('customer_id', $changedFields)) {
            $license->customer_id = $changedFields['customer_id'];
        }
        if (array_key_exists('program_id', $changedFields)) {
            $license->program_id = $changedFields['program_id'];
        }
        if (array_key_exists('duration_days', $changedFields)) {
            $license->duration_days = $changedFields['duration_days'];
        }
        if (array_key_exists('activated_at', $changedFields)) {
            $license->activated_at = CarbonImmutable::parse((string) $changedFields['activated_at']);
        }

        if (array_key_exists('activated_at', $changedFields) || array_key_exists('duration_days', $changedFields)) {
            $activatedAt = $license->activated_at ? CarbonImmutable::parse($license->activated_at) : null;
            if ($activatedAt !== null && $license->duration_days !== null) {
                $license->expires_at = $activatedAt->addSeconds((int) round((float) $license->duration_days * 86400));
            }
        }

        if (!$license->isDirty()) {
            return false;
        }

        $license->save();

        return true;
    }

    private function isLatestRevenueEventForLicense(License $license, ActivityLog $activityLog): bool
    {
        $latest = ActivityLog::query()
            ->where('tenant_id', $license->tenant_id)
            ->whereMetadataLicenseId((int) $license->id)
            ->whereIn('action', self::EDITABLE_ACTIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return (int) ($latest?->id ?? 0) === (int) $activityLog->id;
    }

    /**
     * @param array<int, int> $affectedSellerIds
     */
    private function invalidateCaches(License $license, array $affectedSellerIds): array
    {
        $invalidated = [];
        $tenantId = (int) $license->tenant_id;

        try {
            Cache::tags(['super-admin', 'financial-reports'])->flush();
            $invalidated[] = 'super-admin:financial-reports:*';

            Cache::tags(['super-admin', 'reseller-payments'])->flush();
            $invalidated[] = 'super-admin:reseller-payments:*';

            Cache::tags(["manager-parent:tenant-{$tenantId}", 'financial-reports'])->flush();
            $invalidated[] = "manager-parent:tenant-{$tenantId}:financial-reports:*";

            Cache::tags(["manager:tenant-{$tenantId}", 'reports'])->flush();
            $invalidated[] = "manager:tenant-{$tenantId}:reports:*";

            foreach ($affectedSellerIds as $sellerId) {
                Cache::tags(["reseller:{$sellerId}", 'reports'])->flush();
                $invalidated[] = "reseller:{$sellerId}:reports:*";
            }
        } catch (\BadMethodCallException $e) {
            // Cache store doesn't support tagging (e.g. file cache).
        }

        LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager-parent:reports:version');
        LicenseCacheInvalidation::bumpVersion('manager:reports:version');
        LicenseCacheInvalidation::bumpVersion('reseller:reports:version');
        $invalidated[] = 'LicenseCacheInvalidation:all-versions';

        return $invalidated;
    }

    /**
     * @param array<int, int> $sellerIds
     * @return array<int, array{user_id: int, user_name: string, user_role: string, total_revenue: float}>
     */
    private function recalculateBalances(array $sellerIds): array
    {
        $affectedUsers = [];

        foreach ($sellerIds as $userId) {
            $user = User::find($userId);
            if ($user === null) {
                continue;
            }

            $totalRevenue = (float) ActivityLog::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('user_id', $user->id)
                ->whereIn('action', self::EDITABLE_ACTIONS)
                ->whereRaw(\App\Support\RevenueAnalytics::earnedCondition())
                ->selectRaw(\App\Support\RevenueAnalytics::priceExpression())
                ->sum(DB::raw(\App\Support\RevenueAnalytics::priceExpression()));

            \App\Models\UserBalance::updateOrCreate(
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
     * @return array<int, int>
     */
    private function getAffectedSellerIds(License $license, ActivityLog $activityLog): array
    {
        $sellerIds = [];
        $users = [];

        if ($activityLog->user instanceof User) {
            $users[] = $activityLog->user;
        } elseif ($activityLog->user_id !== null) {
            $user = User::find((int) $activityLog->user_id);
            if ($user !== null) {
                $users[] = $user;
            }
        }

        if ($license->reseller instanceof User) {
            $users[] = $license->reseller;
        } elseif ($license->reseller_id !== null) {
            $user = User::find((int) $license->reseller_id);
            if ($user !== null) {
                $users[] = $user;
            }
        }

        foreach ($users as $reseller) {
            $sellerIds[] = (int) $reseller->id;

            if ($reseller->created_by === null) {
                continue;
            }

            $manager = User::find($reseller->created_by);
            if ($manager !== null) {
                $sellerIds[] = (int) $manager->id;

                if ($manager->created_by !== null) {
                    $managerParent = User::find($manager->created_by);
                    if ($managerParent !== null) {
                        $sellerIds[] = (int) $managerParent->id;
                    }
                }
            }
        }

        return array_values(array_unique($sellerIds));
    }

    private function normalizeSnapshotValue(string $field, mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        return match ($field) {
            'price' => round((float) $value, 2),
            'customer_id', 'program_id' => (int) $value,
            'duration_days' => round((float) $value, 3),
            'activated_at' => CarbonImmutable::parse((string) $value)->toIso8601String(),
            default => $value,
        };
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private function nullableFloat(mixed $value, int $precision = 2): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round((float) $value, $precision);
    }

    private function stringifyValue(mixed $value): string
    {
        if ($value === null) {
            return '(none)';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return json_encode($value) ?: '(unserializable)';
    }
}
