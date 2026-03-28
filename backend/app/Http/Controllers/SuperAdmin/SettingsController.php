<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Support\SystemSettingsStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingsController extends BaseSuperAdminController
{
    private const FONT_WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900];

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
            'general.server_timezone' => ['sometimes', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
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
            'appearance' => ['sometimes', 'array'],
            'appearance.dashboard' => ['sometimes', 'array'],
            'appearance.dashboard.font_family' => [
                'sometimes',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $normalized = strtolower((string) $value);
                    if (str_contains($normalized, 'url(')
                        || str_contains($normalized, 'expression')
                        || str_contains($normalized, '@import')
                        || str_contains($normalized, '{')
                        || str_contains($normalized, '}')
                        || str_contains($normalized, ';')) {
                        $fail('The '.$attribute.' field contains an unsafe font family value.');
                    }
                },
            ],
            'appearance.dashboard.font_sizes' => ['sometimes', 'array'],
            'appearance.dashboard.font_sizes.display_px' => ['sometimes', 'integer', 'min:16', 'max:56'],
            'appearance.dashboard.font_sizes.heading_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_sizes.body_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_sizes.label_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_sizes.table_header_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_sizes.table_cell_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_sizes.helper_px' => ['sometimes', 'integer', 'min:10', 'max:48'],
            'appearance.dashboard.font_weights' => ['sometimes', 'array'],
            'appearance.dashboard.font_weights.display' => ['sometimes', 'integer', Rule::in(self::FONT_WEIGHT_OPTIONS)],
            'appearance.dashboard.font_weights.heading' => ['sometimes', 'integer', Rule::in(self::FONT_WEIGHT_OPTIONS)],
            'appearance.dashboard.font_weights.body' => ['sometimes', 'integer', Rule::in(self::FONT_WEIGHT_OPTIONS)],
            'appearance.dashboard.font_weights.label' => ['sometimes', 'integer', Rule::in(self::FONT_WEIGHT_OPTIONS)],
            'appearance.dashboard.font_weights.table_header' => ['sometimes', 'integer', Rule::in(self::FONT_WEIGHT_OPTIONS)],
            'appearance.dashboard.surfaces' => ['sometimes', 'array'],
            'appearance.dashboard.surfaces.cards' => ['sometimes', 'array'],
            'appearance.dashboard.surfaces.cards.opacity_percent' => ['sometimes', 'integer', 'min:35', 'max:100'],
            'appearance.dashboard.surfaces.cards.brightness_percent' => ['sometimes', 'integer', 'min:80', 'max:120'],
            'appearance.dashboard.surfaces.charts' => ['sometimes', 'array'],
            'appearance.dashboard.surfaces.charts.opacity_percent' => ['sometimes', 'integer', 'min:35', 'max:100'],
            'appearance.dashboard.surfaces.charts.brightness_percent' => ['sometimes', 'integer', 'min:80', 'max:120'],
            'appearance.dashboard.surfaces.badges' => ['sometimes', 'array'],
            'appearance.dashboard.surfaces.badges.opacity_percent' => ['sometimes', 'integer', 'min:35', 'max:100'],
            'appearance.dashboard.surfaces.badges.brightness_percent' => ['sometimes', 'integer', 'min:80', 'max:120'],
        ]);

        return response()->json([
            'data' => $this->settingsStore->update($validated),
            'message' => 'Settings updated successfully.',
        ]);
    }
}
