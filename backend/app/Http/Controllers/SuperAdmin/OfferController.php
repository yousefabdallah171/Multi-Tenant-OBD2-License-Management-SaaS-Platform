<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Program;
use App\Models\ProgramOffer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OfferController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = ProgramOffer::query()
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
            'data' => collect($offers->items())->map(fn (ProgramOffer $offer) => $this->serializeOffer($offer))->values(),
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
        $validated = $request->validate([
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'discount_percentage' => ['required', 'numeric', 'min:0.01', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        [$program, $user] = $this->resolveOfferScope((int) $validated['program_id'], (int) $validated['user_id']);

        $offer = ProgramOffer::updateOrCreate(
            [
                'program_id' => (int) $program->id,
                'user_id' => (int) $user->id,
            ],
            [
                'tenant_id' => (int) $program->tenant_id,
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
        $validated = $request->validate([
            'discount_percentage' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $this->assertOfferIsTenantSafe($offer);

        $offer->update(array_filter($validated, fn ($value) => $value !== null));

        return response()->json([
            'data' => $this->serializeOffer($offer),
            'message' => 'Offer updated successfully.',
        ]);
    }

    public function destroy(Request $request, ProgramOffer $offer): JsonResponse
    {
        $this->assertOfferIsTenantSafe($offer);

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

    /**
     * @return array{0: Program, 1: User}
     */
    private function resolveOfferScope(int $programId, int $userId): array
    {
        $program = Program::query()->findOrFail($programId);
        $user = User::query()
            ->whereKey($userId)
            ->whereIn('role', ['manager', 'reseller'])
            ->firstOrFail();

        if ((int) $program->tenant_id !== (int) $user->tenant_id) {
            throw ValidationException::withMessages([
                'user_id' => 'The selected user must belong to the same tenant as the selected program.',
            ]);
        }

        return [$program, $user];
    }

    private function assertOfferIsTenantSafe(ProgramOffer $offer): void
    {
        $offer->loadMissing('program:id,tenant_id', 'user:id,tenant_id,role');

        $userRole = $offer->user?->role?->value ?? (string) $offer->user?->role;

        if (! $offer->program || ! $offer->user || (int) $offer->program->tenant_id !== (int) $offer->user->tenant_id) {
            throw ValidationException::withMessages([
                'offer' => 'This offer has invalid tenant ownership and cannot be changed.',
            ]);
        }

        if (! in_array($userRole, ['manager', 'reseller'], true)) {
            throw ValidationException::withMessages([
                'user_id' => 'Offers can only target manager or reseller users.',
            ]);
        }

        if ((int) ($offer->tenant_id ?? 0) !== (int) $offer->program->tenant_id) {
            $offer->forceFill(['tenant_id' => (int) $offer->program->tenant_id])->save();
        }
    }
}
