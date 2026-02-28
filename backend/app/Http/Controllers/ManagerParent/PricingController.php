<?php

namespace App\Http\Controllers\ManagerParent;

use App\Enums\UserRole;
use App\Models\PricingHistory;
use App\Models\Program;
use App\Models\ResellerPricing;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PricingController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['nullable', 'integer'],
        ]);

        $resellers = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $selectedResellerId = (int) ($validated['reseller_id'] ?? ($resellers->first()->id ?? 0));

        $pricing = ResellerPricing::query()
            ->where('reseller_id', $selectedResellerId)
            ->get()
            ->keyBy('program_id');

        $programs = Program::query()->orderBy('name')->get()->map(function (Program $program) use ($pricing): array {
            $row = $pricing->get($program->id);
            $resellerPrice = (float) ($row?->reseller_price ?? $program->base_price);

            return [
                'program_id' => $program->id,
                'program_name' => $program->name,
                'base_price' => (float) $program->base_price,
                'reseller_price' => $resellerPrice,
                'commission_rate' => (float) ($row?->commission_rate ?? 0),
                'margin' => round($resellerPrice - (float) $program->base_price, 2),
            ];
        });

        return response()->json([
            'data' => [
                'resellers' => $resellers->values(),
                'selected_reseller_id' => $selectedResellerId ?: null,
                'programs' => $programs->values(),
            ],
        ]);
    }

    public function update(Request $request, Program $program): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['required', 'integer'],
            'reseller_price' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $reseller = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->findOrFail($validated['reseller_id']);

        $pricing = ResellerPricing::query()->firstOrNew([
            'tenant_id' => $this->currentTenantId($request),
            'reseller_id' => $reseller->id,
            'program_id' => $program->id,
        ]);

        $oldPrice = $pricing->exists ? (float) $pricing->reseller_price : null;
        $pricing->fill([
            'reseller_price' => $validated['reseller_price'],
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'updated_by' => $request->user()?->id,
        ]);

        if (! $pricing->exists) {
            $pricing->created_by = $request->user()?->id;
        }

        $pricing->save();

        PricingHistory::query()->create([
            'tenant_id' => $this->currentTenantId($request),
            'reseller_id' => $reseller->id,
            'program_id' => $program->id,
            'old_price' => $oldPrice,
            'new_price' => $validated['reseller_price'],
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'change_type' => 'single',
            'changed_by' => $request->user()?->id,
            'metadata' => ['program' => $program->name, 'reseller' => $reseller->name],
        ]);

        $this->logActivity($request, 'pricing.update', sprintf('Updated pricing for %s / %s.', $reseller->name, $program->name), [
            'program_id' => $program->id,
            'reseller_id' => $reseller->id,
            'price' => (float) $validated['reseller_price'],
        ]);

        return response()->json([
            'data' => [
                'program_id' => $program->id,
                'reseller_id' => $reseller->id,
                'reseller_price' => (float) $pricing->reseller_price,
                'commission_rate' => (float) $pricing->commission_rate,
            ],
        ]);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_ids' => ['required', 'array', 'min:1'],
            'reseller_ids.*' => ['integer'],
            'mode' => ['required', 'in:fixed,markup'],
            'value' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $resellers = User::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('role', UserRole::RESELLER->value)
            ->whereIn('id', $validated['reseller_ids'])
            ->get();

        $programs = Program::query()->get();
        $updated = 0;

        foreach ($resellers as $reseller) {
            foreach ($programs as $program) {
                $newPrice = $validated['mode'] === 'markup'
                    ? round((float) $program->base_price * (1 + ((float) $validated['value'] / 100)), 2)
                    : round((float) $validated['value'], 2);

                $pricing = ResellerPricing::query()->firstOrNew([
                    'tenant_id' => $this->currentTenantId($request),
                    'reseller_id' => $reseller->id,
                    'program_id' => $program->id,
                ]);

                $oldPrice = $pricing->exists ? (float) $pricing->reseller_price : null;
                $pricing->fill([
                    'reseller_price' => $newPrice,
                    'commission_rate' => $validated['commission_rate'] ?? 0,
                    'updated_by' => $request->user()?->id,
                ]);

                if (! $pricing->exists) {
                    $pricing->created_by = $request->user()?->id;
                }

                $pricing->save();

                PricingHistory::query()->create([
                    'tenant_id' => $this->currentTenantId($request),
                    'reseller_id' => $reseller->id,
                    'program_id' => $program->id,
                    'old_price' => $oldPrice,
                    'new_price' => $newPrice,
                    'commission_rate' => $validated['commission_rate'] ?? 0,
                    'change_type' => 'bulk',
                    'changed_by' => $request->user()?->id,
                    'metadata' => ['mode' => $validated['mode'], 'value' => (float) $validated['value']],
                ]);

                $updated++;
            }
        }

        $this->logActivity($request, 'pricing.bulk_update', 'Applied bulk reseller pricing update.', [
            'resellers' => $resellers->pluck('id')->values(),
            'updated' => $updated,
        ]);

        return response()->json([
            'message' => 'Bulk pricing update completed successfully.',
            'updated' => $updated,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reseller_id' => ['nullable', 'integer'],
            'program_id' => ['nullable', 'integer'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = PricingHistory::query()
            ->with(['reseller:id,name', 'program:id,name', 'changedBy:id,name'])
            ->latest();

        if (! empty($validated['reseller_id'])) {
            $query->where('reseller_id', $validated['reseller_id']);
        }

        if (! empty($validated['program_id'])) {
            $query->where('program_id', $validated['program_id']);
        }

        $history = $query->limit((int) ($validated['limit'] ?? 50))->get()->map(fn (PricingHistory $entry): array => [
            'id' => $entry->id,
            'reseller' => $entry->reseller?->name,
            'program' => $entry->program?->name,
            'old_price' => $entry->old_price !== null ? (float) $entry->old_price : null,
            'new_price' => (float) $entry->new_price,
            'commission_rate' => (float) $entry->commission_rate,
            'change_type' => $entry->change_type,
            'changed_by' => $entry->changedBy?->name,
            'created_at' => $entry->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $history]);
    }
}
