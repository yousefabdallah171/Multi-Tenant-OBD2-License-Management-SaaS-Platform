<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Services\TransactionEditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionEditController extends BaseSuperAdminController
{
    private const EDITABLE_ACTIONS = [
        'license.activated',
        'license.renewed',
        'license.scheduled_activation_executed',
    ];

    public function __construct(
        private readonly TransactionEditService $editService,
    ) {}

    public function showByActivityLog(ActivityLog $activityLog): JsonResponse
    {
        [$transaction, $license] = $this->resolveEditableTransaction($activityLog);
        $history = $this->editService->getTransactionHistory($license, $transaction);

        return response()->json([
            'data' => [
                'transaction' => $this->editService->serializeTransaction($license, $transaction),
                'edit_history' => $history,
            ],
        ]);
    }

    public function updateByActivityLog(Request $request, ActivityLog $activityLog): JsonResponse
    {
        [$transaction, $license] = $this->resolveEditableTransaction($activityLog);
        $tenantId = (int) $license->tenant_id;

        $validated = $request->validate([
            'price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'activated_at' => ['nullable', 'date'],
            'duration_days' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $fieldsToChange = array_filter(
            $validated,
            fn ($value, $key) => $key !== 'reason' && $value !== null && $value !== '',
            ARRAY_FILTER_USE_BOTH
        );

        abort_if(count($fieldsToChange) === 0, 422, 'At least one field must be changed.');

        if (isset($validated['customer_id'])) {
            $customer = User::find((int) $validated['customer_id']);
            abort_unless($customer && (int) $customer->tenant_id === $tenantId, 422, 'Customer must belong to the same tenant.');
        }

        if (isset($validated['program_id'])) {
            $program = Program::find((int) $validated['program_id']);
            abort_unless($program && (int) $program->tenant_id === $tenantId, 422, 'Program must belong to the same tenant.');
        }

        abort_if($request->has('bios_id'), 422, 'BIOS ID cannot be edited (would break BIOS tracking).');
        abort_if($request->has('reseller_id'), 422, 'Reseller cannot be edited (would credit wrong seller). Deactivate and reactivate if needed.');
        abort_if($request->has('status'), 422, 'License status cannot be edited directly. Use deactivate/cancel endpoints.');

        $result = $this->editService->editTransaction(
            $license,
            $transaction,
            $fieldsToChange,
            $request->user(),
            $validated['reason'] ?? null,
        );

        return response()->json([
            'data' => $result['transaction'],
            'message' => 'Transaction edited successfully.',
            'affected' => $result['affected'],
        ]);
    }

    public function revertByActivityLog(Request $request, ActivityLog $activityLog): JsonResponse
    {
        [$transaction, $license] = $this->resolveEditableTransaction($activityLog);
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->editService->revertTransaction(
            $license,
            $transaction,
            $request->user(),
            $validated['reason'] ?? null,
        );

        return response()->json([
            'data' => $result['transaction'],
            'message' => 'Transaction reverted successfully.',
            'affected' => $result['affected'] ?? [],
        ]);
    }

    public function historyByActivityLog(ActivityLog $activityLog): JsonResponse
    {
        [$transaction, $license] = $this->resolveEditableTransaction($activityLog);
        $history = $this->editService->getTransactionHistory($license, $transaction);

        return response()->json([
            'data' => $history,
            'summary' => [
                'license_id' => $license->id,
                'activity_log_id' => $transaction->id,
                'total_edits' => count($history),
            ],
        ]);
    }

    /**
     * Legacy license-scoped endpoints are kept as compatibility shims and resolve to the latest revenue event.
     */
    public function show(License $license): JsonResponse
    {
        $activityLog = $this->resolveLatestEditableActivityLog($license);

        return $this->showByActivityLog($activityLog);
    }

    public function update(Request $request, License $license): JsonResponse
    {
        $activityLog = $this->resolveLatestEditableActivityLog($license);

        return $this->updateByActivityLog($request, $activityLog);
    }

    public function revert(Request $request, License $license): JsonResponse
    {
        $activityLog = $this->resolveLatestEditableActivityLog($license);

        return $this->revertByActivityLog($request, $activityLog);
    }

    public function history(License $license): JsonResponse
    {
        $activityLog = $this->resolveLatestEditableActivityLog($license);

        return $this->historyByActivityLog($activityLog);
    }

    public function allLogs(Request $request): JsonResponse
    {
        $query = \App\Models\TransactionEdit::query()
            ->whereIn('action', ['edit', 'revert', 'delete'])
            ->with([
                'superAdmin:id,name',
                'license:id,bios_id,customer_id,reseller_id,program_id,tenant_id',
                'license.tenant:id,name',
                'license.customer:id,name',
                'license.reseller:id,name',
                'license.program:id,name',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('customer_id')) {
            $customerId = (int) $request->input('customer_id');
            $query->whereHas('license', fn ($q) => $q->where('customer_id', $customerId));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($outer) use ($search): void {
                $outer->whereHas('license', function ($q) use ($search): void {
                    $q->where('bios_id', 'like', "%{$search}%")
                      ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%"))
                      ->orWhereHas('reseller', fn ($rq) => $rq->where('name', 'like', "%{$search}%"));
                })->orWhere('previous_values->bios_id', 'like', "%{$search}%")
                  ->orWhere('previous_values->customer_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        $perPage = $request->input('per_page', 25);
        $edits = $query->paginate($perPage);

        $data = $edits->map(function ($edit) {
            $license = $edit->license;
            $customer = $license?->customer;
            $reseller = $license?->reseller;
            $program = $license?->program;
            $tenant = $license?->tenant;
            $prev = is_array($edit->previous_values) ? $edit->previous_values : [];

            return [
                'id' => $edit->id,
                'action' => $edit->action,
                'license_id' => $edit->license_id,
                'activity_log_id' => $edit->activity_log_id,
                'tenant_id' => $edit->tenant_id,
                'tenant_name' => $tenant?->name,
                'bios_id' => $license?->bios_id ?? ($prev['bios_id'] ?? null),
                'customer_name' => $customer?->name ?? ($prev['customer_name'] ?? null),
                'reseller_name' => $reseller?->name,
                'program_name' => $program?->name ?? ($prev['program_name'] ?? null),
                'super_admin_id' => $edit->super_admin_id,
                'super_admin_name' => $edit->superAdmin?->name,
                'previous_values' => $prev,
                'new_values' => is_array($edit->new_values) ? $edit->new_values : [],
                'reason' => $edit->reason,
                'created_at' => $edit->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $edits->currentPage(),
                'last_page' => $edits->lastPage(),
                'total' => $edits->total(),
                'per_page' => $edits->perPage(),
            ],
        ]);
    }

    private function resolveEditableTransaction(ActivityLog $activityLog): array
    {
        abort_unless(in_array($activityLog->action, self::EDITABLE_ACTIONS, true), 422, 'This activity log cannot be edited as a transaction.');

        $metadata = is_array($activityLog->metadata) ? $activityLog->metadata : [];
        $licenseId = (int) ($metadata['license_id'] ?? 0);
        abort_if($licenseId <= 0, 422, 'This activity log is missing a license reference.');

        $license = License::query()->find($licenseId);
        abort_unless($license !== null, 422, 'The related license for this transaction could not be found.');
        abort_unless((int) $license->tenant_id === (int) $activityLog->tenant_id, 422, 'The transaction tenant does not match the related license.');

        $license->loadMissing([
            'tenant:id,name',
            'reseller:id,name,role,created_by',
            'customer:id,name,email,username,country_name',
            'program:id,name',
        ]);

        return [$activityLog, $license];
    }

    private function resolveLatestEditableActivityLog(License $license): ActivityLog
    {
        $latest = ActivityLog::query()
            ->where('tenant_id', $license->tenant_id)
            ->whereMetadataLicenseId((int) $license->id)
            ->whereIn('action', self::EDITABLE_ACTIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        abort_unless($latest !== null, 404, 'No editable transaction event found for this license.');

        return $latest;
    }
}
