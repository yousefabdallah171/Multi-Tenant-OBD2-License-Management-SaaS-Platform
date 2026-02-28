<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($this->currentTenantId($request));

        return response()->json([
            'data' => $this->normalizeSettings($tenant),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'business' => ['sometimes', 'array'],
            'business.company_name' => ['sometimes', 'string', 'max:255'],
            'business.email' => ['sometimes', 'email', 'max:255'],
            'business.phone' => ['nullable', 'string', 'max:20'],
            'business.address' => ['nullable', 'string', 'max:500'],
            'defaults' => ['sometimes', 'array'],
            'defaults.trial_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'defaults.base_price' => ['sometimes', 'numeric', 'min:0'],
            'notifications' => ['sometimes', 'array'],
            'notifications.new_activations' => ['sometimes', 'boolean'],
            'notifications.expiry_warnings' => ['sometimes', 'boolean'],
            'branding' => ['sometimes', 'array'],
            'branding.logo' => ['nullable', 'string', 'max:1000'],
        ]);

        $tenant = Tenant::query()->findOrFail($this->currentTenantId($request));
        $settings = array_replace_recursive($this->normalizeSettings($tenant), $validated);
        $tenant->update(['settings' => $settings]);

        $this->logActivity($request, 'settings.update', 'Updated tenant settings.');

        return response()->json([
            'data' => $settings,
            'message' => 'Settings updated successfully.',
        ]);
    }

    private function normalizeSettings(Tenant $tenant): array
    {
        $settings = is_array($tenant->settings) ? $tenant->settings : [];

        return array_replace_recursive([
            'business' => [
                'company_name' => $tenant->name,
                'email' => null,
                'phone' => null,
                'address' => null,
            ],
            'defaults' => [
                'trial_days' => 7,
                'base_price' => 0,
            ],
            'notifications' => [
                'new_activations' => true,
                'expiry_warnings' => true,
            ],
            'branding' => [
                'logo' => null,
            ],
        ], $settings);
    }
}
