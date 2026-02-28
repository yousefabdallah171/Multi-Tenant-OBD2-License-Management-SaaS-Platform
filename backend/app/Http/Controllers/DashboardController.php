<?php

namespace App\Http\Controllers;

use App\Models\License;
use App\Models\Program;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'stats' => [
                'users' => User::query()->count(),
                'programs' => Program::query()->count(),
                'licenses' => License::query()->count(),
                'active_licenses' => License::query()->where('status', 'active')->count(),
                'revenue' => (float) License::query()->sum('price'),
            ],
        ]);
    }
}
