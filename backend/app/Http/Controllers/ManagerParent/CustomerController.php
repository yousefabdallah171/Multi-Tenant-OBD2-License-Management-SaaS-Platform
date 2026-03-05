<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\UserIpLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CustomerController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled,pending'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::CUSTOMER->value)
            ->select(['id', 'tenant_id', 'name', 'email', 'phone', 'role', 'created_at'])
            ->with(['customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'status', 'activated_at', 'expires_at', 'price'])
                ->with(['program:id,name', 'reseller:id,name'])])
            ->latest();

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('bios_id', 'like', '%'.$validated['search'].'%'));
            });
        }

        if (! empty($validated['reseller_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('reseller_id', $validated['reseller_id']));
        }

        if (! empty($validated['program_id'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('program_id', $validated['program_id']));
        }

        if (! empty($validated['status'])) {
            $query->whereHas('customerLicenses', fn ($licenseQuery) => $licenseQuery->where('status', $validated['status']));
        }

        $customers = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($customers->items())->map(fn (User $user): array => $this->serializeCustomer($user))->values(),
            'meta' => $this->paginationMeta($customers),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $user = $this->resolveTenantUser($request, $user);
        abort_unless(($user->role?->value ?? (string) $user->role) === UserRole::CUSTOMER->value, 404);

        $user->load([
            'customerLicenses' => fn ($licenseQuery) => $licenseQuery
                ->select(['id', 'tenant_id', 'customer_id', 'reseller_id', 'program_id', 'bios_id', 'external_username', 'status', 'duration_days', 'price', 'activated_at', 'expires_at'])
                ->with(['program:id,name', 'reseller:id,name,email']),
            'createdBy:id,name,email',
        ]);

        $resellersSummary = $user->customerLicenses
            ->groupBy('reseller_id')
            ->map(function ($licenses) {
                $latest = $licenses->sortByDesc('activated_at')->first();

                return [
                    'reseller_id' => $latest?->reseller_id,
                    'reseller_name' => $latest?->reseller?->name,
                    'reseller_email' => $latest?->reseller?->email,
                    'activations_count' => $licenses->count(),
                    'last_activation_at' => $latest?->activated_at?->toIso8601String(),
                ];
            })
            ->values();

        $ipLogs = UserIpLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'ip_address', 'country', 'city', 'isp', 'reputation_score', 'action', 'created_at'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('user_id', $user->id)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (UserIpLog $log): array => [
                'id' => $log->id,
                'ip_address' => $log->ip_address,
                'country' => $log->country,
                'city' => $log->city,
                'isp' => $log->isp,
                'reputation_score' => $log->reputation_score,
                'action' => $log->action,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        $activity = ActivityLog::query()
            ->select(['id', 'tenant_id', 'user_id', 'action', 'description', 'metadata', 'ip_address', 'created_at'])
            ->where('tenant_id', $this->currentTenantId($request))
            ->where(function ($query) use ($user): void {
                $query->where('user_id', $user->id)->orWhere('metadata->customer_id', $user->id);
            })
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (ActivityLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'metadata' => $log->metadata ?? [],
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeCustomer($user),
                'username' => $user->username,
                'phone' => $user->phone,
                'created_by' => $user->createdBy ? [
                    'id' => $user->createdBy->id,
                    'name' => $user->createdBy->name,
                    'email' => $user->createdBy->email,
                ] : null,
                'created_at' => $user->created_at?->toIso8601String(),
                'licenses' => $user->customerLicenses->map(fn ($license): array => [
                    'id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'program' => $license->program?->name,
                    'reseller' => $license->reseller?->name,
                    'reseller_id' => $license->reseller_id,
                    'reseller_email' => $license->reseller?->email,
                    'status' => $license->status,
                    'duration_days' => (float) $license->duration_days,
                    'price' => (float) $license->price,
                    'activated_at' => $license->activated_at?->toIso8601String(),
                    'expires_at' => $license->expires_at?->toIso8601String(),
                ])->values(),
                'resellers_summary' => $resellersSummary,
                'ip_logs' => $ipLogs,
                'activity' => $activity,
            ],
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $customer = $this->resolveTenantUser($request, $user);
        abort_unless(($customer->role?->value ?? (string) $customer->role) === UserRole::CUSTOMER->value, 404);

        $activeLicensesCount = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->where('status', 'active')
            ->count();

        if ($activeLicensesCount > 0) {
            return response()->json([
                'message' => 'Cannot delete customer with active licenses. Deactivate licenses first.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $customerName = $customer->name;
        $customerId = $customer->id;
        $licensesCount = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('customer_id', $customer->id)
            ->count();

        $customer->delete();

        $this->logActivity(
            $request,
            'customer.delete',
            sprintf('Deleted customer %s.', $customerName),
            [
                'customer_id' => $customerId,
                'licenses_deleted' => $licensesCount,
            ],
        );

        return response()->json([
            'message' => 'Customer deleted successfully.',
        ]);
    }

    private function serializeCustomer(User $user): array
    {
        $license = $user->customerLicenses->sortByDesc('activated_at')->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $this->visibleEmail($user->email),
            'phone' => $user->phone,
            'license_id' => $license?->id,
            'bios_id' => $license?->bios_id,
            'reseller' => $license?->reseller?->name,
            'program' => $license?->program?->name,
            'status' => $license?->status,
            'expiry' => $license?->expires_at?->toIso8601String(),
            'license_count' => $user->customerLicenses->count(),
        ];
    }

    private function visibleEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        return str_ends_with($email, '@obd2sw.local') ? null : $email;
    }
}
