<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
            'business.email' => ['nullable', 'email', 'max:255'],
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
            'branding.primary_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
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

    public function uploadLogo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'logo' => ['required', 'image', 'max:2048'],
        ]);

        $tenant = Tenant::query()->findOrFail($this->currentTenantId($request));
        $settings = is_array($tenant->settings) ? $tenant->settings : [];

        // Delete old logo if it exists
        if (isset($settings['branding']['logo']) && $settings['branding']['logo']) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $settings['branding']['logo']));
        }

        // Store new logo
        $logoPath = $request->file('logo')->store('tenant-logos', 'public');
        $logoUrl = Storage::disk('public')->url($logoPath);

        // Update settings
        $settings['branding'] = $settings['branding'] ?? [];
        $settings['branding']['logo'] = $logoUrl;
        $tenant->update(['settings' => $settings]);

        $this->logActivity($request, 'settings.logo_uploaded', 'Uploaded tenant logo.');

        return response()->json([
            'data' => ['logo' => $logoUrl],
            'message' => 'Logo uploaded successfully.',
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
                'primary_color' => null,
            ],
        ], $settings);
    }
}
