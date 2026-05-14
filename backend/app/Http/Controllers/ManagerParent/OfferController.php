<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Program;
use App\Models\ProgramOffer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OfferController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        $query = ProgramOffer::query()
            ->where('tenant_id', $tenantId)
            ->with([
                'program:id,name,status',
                'user:id,name,role',
                'creator:id,name',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('program_id')) {
            $query->where('program_id', (int) $request->input('program_id'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        $perPage = $request->input('per_page', 25);
        $offers = $query->paginate($perPage);

        return response()->json([
            'data' => $offers->items(),
            'meta' => [
                'current_page' => $offers->currentPage(),
                'last_page' => $offers->lastPage(),
                'total' => $offers->total(),
                'per_page' => $offers->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        $validated = $request->validate([
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'discount_percentage' => ['required', 'numeric', 'min:0.01', 'max:99.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        // Verify program belongs to tenant
        $program = Program::where('tenant_id', $tenantId)
            ->where('id', (int) $validated['program_id'])
            ->firstOrFail();

        // Verify user belongs to tenant and is reseller or manager
        $user = User::where('tenant_id', $tenantId)
            ->where('id', (int) $validated['user_id'])
            ->whereIn('role', ['reseller', 'manager'])
            ->firstOrFail();

        // Upsert: update if exists, create if not
        $offer = ProgramOffer::updateOrCreate(
            [
                'program_id' => (int) $validated['program_id'],
                'user_id' => (int) $validated['user_id'],
            ],
            [
                'tenant_id' => $tenantId,
                'discount_percentage' => (float) $validated['discount_percentage'],
                'is_active' => $validated['is_active'] ?? true,
                'created_by' => $request->user()->id,
            ]
        );

        return response()->json([
            'data' => $this->serializeOffer($offer),
            'message' => 'Offer created successfully.',
        ], 201);
    }

    public function update(Request $request, ProgramOffer $offer): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        abort_unless($offer->tenant_id === $tenantId, 403);

        $validated = $request->validate([
            'discount_percentage' => ['nullable', 'numeric', 'min:0.01', 'max:99.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $offer->update(array_filter($validated));

        return response()->json([
            'data' => $this->serializeOffer($offer),
            'message' => 'Offer updated successfully.',
        ]);
    }

    public function destroy(Request $request, ProgramOffer $offer): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        abort_unless($offer->tenant_id === $tenantId, 403);

        $offer->delete();

        return response()->json([
            'message' => 'Offer deleted successfully.',
        ]);
    }

    private function serializeOffer(ProgramOffer $offer): array
    {
        return [
            'id' => $offer->id,
            'program_id' => $offer->program_id,
            'program_name' => $offer->program->name,
            'program_status' => $offer->program->status,
            'user_id' => $offer->user_id,
            'user_name' => $offer->user->name,
            'user_role' => $offer->user->role?->value ?? (string) $offer->user->role,
            'discount_percentage' => round((float) $offer->discount_percentage, 2),
            'is_active' => $offer->is_active,
            'created_by' => $offer->created_by,
            'creator_name' => $offer->creator->name,
            'created_at' => $offer->created_at?->toIso8601String(),
            'updated_at' => $offer->updated_at?->toIso8601String(),
        ];
    }
}
