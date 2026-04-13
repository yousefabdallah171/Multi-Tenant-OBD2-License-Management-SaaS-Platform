<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\DeletedCustomer;
use App\Models\License;
use App\Models\User;
use App\Support\LicenseCacheInvalidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DeletedCustomerController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = DeletedCustomer::query()
            ->with('tenant:id,name', 'deletedBy:id,name,email')
            ->latest('deleted_at');

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('username', 'like', '%'.$validated['search'].'%');
            });
        }

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', $validated['tenant_id']);
        }

        $deletedCustomers = $query->paginate($perPage);

        return response()->json([
            'data' => collect($deletedCustomers->items())->map(fn (DeletedCustomer $dc): array => $this->serialize($dc))->values(),
            'meta' => $this->paginationMeta($deletedCustomers),
        ]);
    }

    public function show(DeletedCustomer $deletedCustomer): JsonResponse
    {
        $deletedCustomer->load('tenant:id,name', 'deletedBy:id,name,email');

        return response()->json([
            'data' => [
                ...$this->serialize($deletedCustomer),
                'snapshot' => $deletedCustomer->snapshot,
            ],
        ]);
    }

    public function restore(Request $request, DeletedCustomer $deletedCustomer): JsonResponse
    {
        $validated = $request->validate([
            'confirm_name' => ['required', 'string'],
            'username' => ['nullable', 'string', 'unique:users,username'],
            'bios_id' => ['nullable', 'string'],
        ]);

        if ($validated['confirm_name'] !== $deletedCustomer->name) {
            return response()->json([
                'message' => 'Customer name confirmation does not match.',
                'errors' => ['confirm_name' => ['Customer name confirmation does not match.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $snapshot = $deletedCustomer->snapshot ?? [];

        try {
            // Check if email already exists
            $email = $snapshot['user']['email'] ?? $deletedCustomer->email;
            $existingUser = User::query()->where('email', $email)->first();

            if ($existingUser) {
                return response()->json([
                    'message' => 'Email already exists. Please restore with a different email or contact support.',
                    'errors' => ['email' => ['Email already in use']],
                    'data' => [
                        'conflict_field' => 'email',
                        'conflict_value' => $email,
                        'needs_update' => true,
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $restoredUser = DB::transaction(function () use ($deletedCustomer, $snapshot, $validated): User {
                // Priority: provided username > original username from snapshot > generate new one
                $username = $validated['username'] ?? $snapshot['user']['username'] ?? User::generateUniqueUsername($snapshot['user']['email'] ?? $deletedCustomer->email);

                // Create user with new ID (can't reuse deleted ID)
                $user = User::query()->create([
                    'tenant_id' => $snapshot['user']['tenant_id'] ?? $deletedCustomer->tenant_id,
                    'name' => $snapshot['user']['name'] ?? $deletedCustomer->name,
                    'username' => $username,
                    'email' => $snapshot['user']['email'] ?? $deletedCustomer->email,
                    'phone' => $snapshot['user']['phone'] ?? $deletedCustomer->phone,
                    'country_name' => $snapshot['user']['country_name'] ?? null,
                    'password' => $snapshot['user']['password'] ?? Hash::make(Str::password(12, true, true, true, false)),
                    'role' => 'customer',
                    'status' => $snapshot['user']['status'] ?? 'active',
                    'username_locked' => $snapshot['user']['username_locked'] ?? false,
                ]);

                // Recreate licenses (with new customer_id)
                foreach ($snapshot['licenses'] ?? [] as $index => $licenseData) {
                    unset($licenseData['id']);
                    $licenseData['customer_id'] = $user->id;
                    // Update BIOS ID if provided (only for first license if multiple)
                    if ($index === 0 && ($validated['bios_id'] ?? false)) {
                        $licenseData['bios_id'] = $validated['bios_id'];
                    }
                    License::query()->create($licenseData);
                }

                // Recreate activity logs (revenue records) from snapshot
                if (!empty($snapshot['activity_logs'] ?? [])) {
                    foreach ($snapshot['activity_logs'] as $activityLog) {
                        // Recreate activity log with original data
                        DB::table('activity_logs')->insert([
                            'user_id' => $activityLog->user_id ?? $activityLog['user_id'],
                            'tenant_id' => $activityLog->tenant_id ?? $activityLog['tenant_id'],
                            'action' => $activityLog->action ?? $activityLog['action'],
                            'description' => $activityLog->description ?? $activityLog['description'],
                            'metadata' => $activityLog->metadata ?? $activityLog['metadata'],
                            'created_at' => $activityLog->created_at ?? $activityLog['created_at'],
                            'updated_at' => $activityLog->updated_at ?? $activityLog['updated_at'],
                        ]);
                    }
                } elseif (!empty($snapshot['activity_log_ids'] ?? [])) {
                    // Fallback for old snapshots that only have IDs
                    foreach ($snapshot['activity_log_ids'] as $activityLogId) {
                        $originalLog = DB::table('activity_logs')->find($activityLogId);
                        if ($originalLog) {
                            DB::table('activity_logs')->insert([
                                'user_id' => $originalLog->user_id,
                                'tenant_id' => $originalLog->tenant_id,
                                'action' => $originalLog->action,
                                'description' => $originalLog->description,
                                'metadata' => $originalLog->metadata,
                                'created_at' => $originalLog->created_at,
                                'updated_at' => $originalLog->updated_at,
                            ]);
                        }
                    }
                }

                return $user->fresh('tenant');
            });

            // Delete the snapshot record
            $deletedCustomer->delete();

            return response()->json([
                'message' => 'Customer restored successfully.',
                'data' => ['customer_id' => $restoredUser->id],
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                if (str_contains($e->getMessage(), 'users_email_unique')) {
                    return response()->json([
                        'message' => 'Email already exists.',
                        'errors' => ['email' => ['Email already in use']],
                    ], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
                if (str_contains($e->getMessage(), 'users_username_unique')) {
                    return response()->json([
                        'message' => 'Username already exists. Please provide a different username.',
                        'errors' => ['username' => ['Username already in use']],
                    ], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
            }
            return response()->json([
                'message' => 'Failed to restore customer: '.$e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to restore customer: '.$e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    public function destroyRevenue(DeletedCustomer $deletedCustomer): JsonResponse
    {
        try {
            $snapshot = $deletedCustomer->snapshot ?? [];
            $activityLogIds = $snapshot['activity_log_ids'] ?? [];

            // If we don't have stored activity log IDs, search by customer name/email
            if (empty($activityLogIds)) {
                $activityLogIds = DB::table('activity_logs')
                    ->whereIn('action', ['license.activated', 'license.renewed'])
                    ->where(function ($query) use ($deletedCustomer) {
                        $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$deletedCustomer->original_customer_id])
                            ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$deletedCustomer->name]);
                    })
                    ->pluck('id')
                    ->toArray();
            }

            if (empty($activityLogIds)) {
                return response()->json([
                    'message' => 'No revenue records found for this customer.',
                ]);
            }

            DB::transaction(function () use ($deletedCustomer, $activityLogIds): void {
                DB::table('activity_logs')
                    ->whereIn('id', $activityLogIds)
                    ->delete();

                $deletedCustomer->update(['revenue_total' => 0]);
            });

            // Invalidate Reports cache
            LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
            if ($deletedCustomer->tenant_id) {
                LicenseCacheInvalidation::bumpVersion("manager-parent:{$deletedCustomer->tenant_id}:reports:version");
            }

            return response()->json([
                'message' => 'Revenue records deleted successfully.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete revenue: '.$e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function destroy(DeletedCustomer $deletedCustomer): JsonResponse
    {
        $snapshot = $deletedCustomer->snapshot;
        $activityLogIds = $snapshot['activity_log_ids'] ?? [];

        // If we don't have stored activity log IDs, search by customer name/email
        if (empty($activityLogIds)) {
            $activityLogIds = DB::table('activity_logs')
                ->whereIn('action', ['license.activated', 'license.renewed'])
                ->where(function ($query) use ($deletedCustomer) {
                    $query->whereRaw('JSON_EXTRACT(metadata, "$.customer_id") = ?', [$deletedCustomer->original_customer_id])
                        ->orWhereRaw('JSON_EXTRACT(metadata, "$.customer_name") = ?', [$deletedCustomer->name]);
                })
                ->pluck('id')
                ->toArray();
        }

        DB::transaction(function () use ($deletedCustomer, $activityLogIds): void {
            // Delete activity logs (revenue) first
            if (!empty($activityLogIds)) {
                DB::table('activity_logs')
                    ->whereIn('id', $activityLogIds)
                    ->delete();
            }

            // Then delete the snapshot record
            $deletedCustomer->delete();
        });

        // Invalidate Reports cache
        LicenseCacheInvalidation::bumpVersion('super-admin:reports:version');
        if ($deletedCustomer->tenant_id) {
            LicenseCacheInvalidation::bumpVersion("manager-parent:{$deletedCustomer->tenant_id}:reports:version");
        }

        return response()->json([
            'message' => 'Deleted customer record and revenue permanently removed.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(DeletedCustomer $deletedCustomer): array
    {
        return [
            'id' => $deletedCustomer->id,
            'original_customer_id' => $deletedCustomer->original_customer_id,
            'name' => $deletedCustomer->name,
            'email' => $deletedCustomer->email,
            'username' => $deletedCustomer->username,
            'phone' => $deletedCustomer->phone,
            'tenant' => $deletedCustomer->tenant ? [
                'id' => $deletedCustomer->tenant->id,
                'name' => $deletedCustomer->tenant->name,
            ] : null,
            'deleted_by' => $deletedCustomer->deletedBy ? [
                'id' => $deletedCustomer->deletedBy->id,
                'name' => $deletedCustomer->deletedBy->name,
                'email' => $deletedCustomer->deletedBy->email,
            ] : null,
            'deleted_at' => $deletedCustomer->deleted_at?->toIso8601String(),
            'licenses_count' => $deletedCustomer->licenses_count,
            'revenue_total' => round((float) $deletedCustomer->revenue_total, 2),
        ];
    }
}
