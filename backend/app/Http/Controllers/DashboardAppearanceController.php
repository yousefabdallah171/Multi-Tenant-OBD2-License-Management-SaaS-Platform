<?php

namespace App\Http\Controllers;

use App\Support\SystemSettingsStore;
use Illuminate\Http\JsonResponse;

class DashboardAppearanceController extends Controller
{
    public function __construct(private readonly SystemSettingsStore $settingsStore)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => $this->settingsStore->dashboardAppearance(),
        ]);
    }
}
