<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\DeletedCustomer;
use App\Models\License;
use App\Models\User;
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
        ]);

        if ($validated['confirm_name'] !== $deletedCustomer->name) {
            return response()->json([
                'message' => 'Customer name confirmation does not match.',
                'errors' => ['confirm_name' => ['Customer name confirmation does not match.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $snapshot = $deletedCustomer->snapshot;

        try {
            $restoredUser = DB::transaction(function () use ($deletedCustomer, $snapshot): User {
                // Create user with new ID (can't reuse deleted ID)
                $user = User::query()->create([
                    'tenant_id' => $snapshot['user']['tenant_id'] ?? $deletedCustomer->tenant_id,
                    'name' => $snapshot['user']['name'] ?? $deletedCustomer->name,
                    'username' => User::generateUniqueUsername($snapshot['user']['email'] ?? $deletedCustomer->email),
                    'email' => $snapshot['user']['email'] ?? $deletedCustomer->email,
                    'phone' => $snapshot['user']['phone'] ?? $deletedCustomer->phone,
                    'password' => $snapshot['user']['password'] ?? Hash::make(Str::password(12, true, true, true, false)),
                    'role' => 'customer',
                    'status' => $snapshot['user']['status'] ?? 'active',
                    'username_locked' => $snapshot['user']['username_locked'] ?? false,
                ]);

                // Recreate licenses (with new customer_id)
                foreach ($snapshot['licenses'] ?? [] as $licenseData) {
                    unset($licenseData['id']);
                    $licenseData['customer_id'] = $user->id;
                    License::query()->create($licenseData);
                }

                return $user->fresh('tenant');
            });

            // Delete the snapshot record
            $deletedCustomer->delete();

            return response()->json([
                'message' => 'Customer restored successfully.',
                'data' => ['customer_id' => $restoredUser->id],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to restore customer: '.$e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    public function destroyRevenue(DeletedCustomer $deletedCustomer): JsonResponse
    {
        $snapshot = $deletedCustomer->snapshot;
        $activityLogIds = $snapshot['activity_log_ids'] ?? [];

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

        return response()->json([
            'message' => 'Revenue records deleted successfully.',
        ]);
    }

    public function destroy(DeletedCustomer $deletedCustomer): JsonResponse
    {
        $deletedCustomer->delete();

        return response()->json([
            'message' => 'Deleted customer record permanently removed.',
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
