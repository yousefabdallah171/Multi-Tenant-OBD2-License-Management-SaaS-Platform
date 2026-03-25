<?php

namespace App\Http\Controllers;

use App\Services\TablePreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TablePreferenceController extends Controller
{
    public function __construct(private readonly TablePreferenceService $service)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_key' => ['required', 'string', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
            'available_columns' => ['array'],
            'available_columns.*' => ['string', 'max:100'],
            'locked_columns' => ['array'],
            'locked_columns.*' => ['string', 'max:100'],
        ]);

        $user = $request->user();

        abort_unless($user !== null, Response::HTTP_UNAUTHORIZED);

        return response()->json([
            'data' => $this->service->getForUser(
                $user,
                $validated['table_key'],
                array_values($validated['available_columns'] ?? []),
                array_values($validated['locked_columns'] ?? []),
            ),
        ]);
    }

    public function update(Request $request, string $tableKey): JsonResponse
    {
        $validated = $request->validate([
            'visible_columns' => ['required', 'array', 'min:1'],
            'visible_columns.*' => ['string', 'max:100'],
            'available_columns' => ['required', 'array', 'min:1'],
            'available_columns.*' => ['string', 'max:100'],
            'locked_columns' => ['array'],
            'locked_columns.*' => ['string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'in:10,25,50,100'],
        ]);

        abort_unless(preg_match('/^[A-Za-z0-9._:-]+$/', $tableKey) === 1, Response::HTTP_UNPROCESSABLE_ENTITY);

        $user = $request->user();

        abort_unless($user !== null, Response::HTTP_UNAUTHORIZED);

        $availableColumns = array_values($validated['available_columns']);
        $lockedColumns = array_values($validated['locked_columns'] ?? []);
        $visibleColumns = array_values($validated['visible_columns']);

        $hiddenLockedColumns = array_diff($lockedColumns, $visibleColumns);

        if ($hiddenLockedColumns !== []) {
            return response()->json([
                'message' => 'Locked columns must remain visible.',
                'errors' => [
                    'visible_columns' => ['Locked columns must remain visible.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'data' => $this->service->updateForUser(
                $user,
                $tableKey,
                $visibleColumns,
                $validated['per_page'] ?? null,
                $availableColumns,
                $lockedColumns,
            ),
            'message' => 'Table preferences updated successfully.',
        ]);
    }
}
