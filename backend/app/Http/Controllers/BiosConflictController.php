<?php

namespace App\Http\Controllers;

use App\Models\BiosConflict;
use Illuminate\Http\JsonResponse;

class BiosConflictController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => BiosConflict::query()->latest()->get(),
        ]);
    }
}
