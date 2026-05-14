<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use App\Models\Program;
use App\Models\User;
use App\Services\TransactionEditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionEditController extends BaseSuperAdminController
{
    public function __construct(
        private readonly TransactionEditService $editService,
    ) {}

    /**
     * Get transaction details + edit history
     */
    public function show(License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $history = $this->editService->getTransactionHistory($transaction);

        return response()->json([
            'data' => [
                'transaction' => $this->serializeTransaction($transaction),
                'edit_history' => $history,
            ],
        ]);
    }

    /**
     * Edit a transaction
     *
     * @param Request $request
     * @param License $license
     * @return JsonResponse
     */
    public function update(Request $request, License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $tenantId = (int) $transaction->tenant_id;

        $validated = $request->validate([
            'price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'activated_at' => ['nullable', 'date'],
            'duration_days' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        // Count how many fields are actually being changed (ignore nulls)
        $fieldsToChange = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        abort_if(
            count($fieldsToChange) === 0,
            422,
            'At least one field must be changed.'
        );

        // Validate customer belongs to same tenant
        if (isset($validated['customer_id'])) {
            $customer = User::find((int) $validated['customer_id']);
            abort_unless(
                $customer && (int) $customer->tenant_id === $tenantId,
                422,
                'Customer must belong to the same tenant.'
            );
        }

        // Validate program belongs to same tenant
        if (isset($validated['program_id'])) {
            $program = Program::find((int) $validated['program_id']);
            abort_unless(
                $program && (int) $program->tenant_id === $tenantId,
                422,
                'Program must belong to the same tenant.'
            );
        }

        // Cannot edit BIOS ID
        abort_if(
            $request->has('bios_id'),
            422,
            'BIOS ID cannot be edited (would break BIOS tracking).'
        );

        // Cannot edit reseller
        abort_if(
            $request->has('reseller_id'),
            422,
            'Reseller cannot be edited (would credit wrong seller). Deactivate and reactivate if needed.'
        );

        // Cannot edit status
        abort_if(
            $request->has('status'),
            422,
            'License status cannot be edited directly. Use deactivate/cancel endpoints.'
        );

        $result = $this->editService->editTransaction(
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

    /**
     * Revert transaction to previous state
     *
     * @param Request $request
     * @param License $license
     * @return JsonResponse
     */
    public function revert(Request $request, License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->editService->revertTransaction(
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

    /**
     * Get full edit history for a transaction
     *
     * @param License $license
     * @return JsonResponse
     */
    public function history(License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $history = $this->editService->getTransactionHistory($transaction);

        return response()->json([
            'data' => $history,
            'summary' => [
                'license_id' => $license->id,
                'total_edits' => count($history),
            ],
        ]);
    }

    /**
     * Get all transaction edit logs across all customers
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function allLogs(Request $request): JsonResponse
    {
        $query = \App\Models\ActivityLog::query()
            ->where('action', 'transaction.edited')
            ->with('user:id,name')
            ->orderByDesc('created_at');

        // Search by BIOS ID or customer/reseller name
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereRaw(
                "JSON_CONTAINS(metadata, JSON_OBJECT('license_id', (SELECT id FROM licenses WHERE bios_id LIKE ?)))",
                ["%{$search}%"]
            )
            ->orWhereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%"));
        }

        // Filter by date range
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        // Paginate
        $perPage = $request->input('per_page', 25);
        $logs = $query->paginate($perPage);

        // Transform response
        $data = $logs->map(function ($log) {
            $metadata = (array) ($log->metadata ?? []);
            $editData = \App\Models\TransactionEdit::find($metadata['transaction_edit_id'] ?? null);

            return [
                'id' => $editData?->id ?? $log->id,
                'license_id' => $metadata['license_id'] ?? null,
                'tenant_id' => $log->tenant_id,
                'tenant_name' => $log->tenant?->name,
                'bios_id' => $metadata['bios_id'] ?? null,
                'customer_name' => $metadata['customer_id'] ? User::find($metadata['customer_id'])?->name : null,
                'reseller_name' => $metadata['reseller_id'] ? User::find($metadata['reseller_id'])?->name : null,
                'program_name' => null,
                'super_admin_id' => $log->user_id,
                'super_admin_name' => $log->user?->name,
                'previous_values' => $metadata['previous_values'] ?? [],
                'new_values' => $metadata['new_values'] ?? [],
                'reason' => $editData?->reason ?? 'No reason provided',
                'created_at' => $log->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
            ],
        ]);
    }

    /**
     * Resolve and load license with relationships
     *
     * @param License $license
     * @return License
     */
    private function resolveLicense(License $license): License
    {
        $license->loadMissing([
            'tenant:id,name',
            'reseller:id,name,role,created_by',
            'customer:id,name,email,username,country_name',
            'program:id,name',
        ]);

        return $license;
    }

    /**
     * Serialize license transaction for response
     *
     * @param License $license
     * @return array
     */
    private function serializeTransaction(License $license): array
    {
        return [
            'license_id' => $license->id,
            'tenant_id' => $license->tenant_id,
            'tenant_name' => $license->tenant?->name,
            'reseller_id' => $license->reseller_id,
            'reseller_name' => $license->reseller?->name,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'customer_email' => $license->customer?->email,
            'bios_id' => $license->bios_id,
            'program_id' => $license->program_id,
            'program_name' => $license->program?->name,
            'price' => round((float) $license->price, 2),
            'duration_days' => (float) $license->duration_days,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'status' => $license->status,
            'created_at' => $license->created_at?->toIso8601String(),
            'updated_at' => $license->updated_at?->toIso8601String(),
        ];
    }
}
