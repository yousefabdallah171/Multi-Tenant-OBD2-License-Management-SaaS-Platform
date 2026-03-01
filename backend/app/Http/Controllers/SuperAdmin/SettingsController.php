<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Support\SystemSettingsStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends BaseSuperAdminController
{
    public function __construct(private readonly SystemSettingsStore $settingsStore)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => $this->settingsStore->all(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'general' => ['sometimes', 'array'],
            'general.platform_name' => ['sometimes', 'string', 'max:255'],
            'general.default_trial_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'general.maintenance_mode' => ['sometimes', 'boolean'],
            'api' => ['sometimes', 'array'],
            'api.url' => ['sometimes', 'url'],
            'api.key' => ['sometimes', 'string'],
            'api.timeout' => ['sometimes', 'integer', 'min:1', 'max:60'],
            'api.retries' => ['sometimes', 'integer', 'min:0', 'max:10'],
            'notifications' => ['sometimes', 'array'],
            'notifications.email_enabled' => ['sometimes', 'boolean'],
            'notifications.pusher_enabled' => ['sometimes', 'boolean'],
            'security' => ['sometimes', 'array'],
            'security.min_password_length' => ['sometimes', 'integer', 'min:6', 'max:64'],
            'security.session_timeout' => ['sometimes', 'integer', 'min:5', 'max:1440'],
            'widgets' => ['sometimes', 'array'],
            'widgets.show_online_widget_to_resellers' => ['sometimes', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->settingsStore->update($validated),
            'message' => 'Settings updated successfully.',
        ]);
    }
}
