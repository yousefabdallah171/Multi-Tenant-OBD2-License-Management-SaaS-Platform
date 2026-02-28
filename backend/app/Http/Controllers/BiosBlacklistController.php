<?php

namespace App\Http\Controllers;

use App\Models\BiosBlacklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiosBlacklistController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => BiosBlacklist::query()->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bios_id' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
        ]);

        $entry = BiosBlacklist::query()->create([
            ...$validated,
            'added_by' => $request->user()?->id,
            'status' => 'active',
        ]);

        return response()->json(['data' => $entry], 201);
    }

    public function destroy(BiosBlacklist $biosBlacklist): JsonResponse
    {
        $biosBlacklist->update(['status' => 'removed']);

        return response()->json(['message' => 'Blacklist entry removed.']);
    }
}
