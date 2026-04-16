<?php

namespace App\Http\Controllers\Reseller;

use App\Models\Program;
use App\Models\ProgramDurationPreset;
use App\Models\ProgramDurationPresetCountryPrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoftwareController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $resellerId = $this->currentReseller($request)->id;

        $programs = Program::query()
            ->with('activeDurationPresets.countryPrices')
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('status', 'active')
            ->orderBy('name')
            ->get()
            ->map(fn (Program $program): array => [
                'id' => $program->id,
                'name' => $program->name,
                'version' => $program->version,
                'price_per_day' => (float) $program->base_price,
                'is_active' => $program->status === 'active',
                'has_external_api' => (bool) $program->has_external_api,
                'external_software_id' => $program->external_software_id,
                'licenses_sold' => (int) $program->licenses()->where('reseller_id', $resellerId)->count(),
                'duration_presets' => $program->activeDurationPresets->map(fn (ProgramDurationPreset $preset): array => [
                    'id' => $preset->id,
                    'program_id' => $preset->program_id,
                    'label' => $preset->label,
                    'duration_days' => (float) $preset->duration_days,
                    'price' => (float) $preset->price,
                    'sort_order' => (int) $preset->sort_order,
                    'is_active' => (bool) $preset->is_active,
                    'country_prices' => ($preset->relationLoaded('countryPrices') ? $preset->countryPrices : $preset->countryPrices()->get())
                        ->map(fn (ProgramDurationPresetCountryPrice $countryPrice): array => [
                            'id' => $countryPrice->id,
                            'country_name' => $countryPrice->country_name,
                            'price' => (float) $countryPrice->price,
                            'is_active' => (bool) $countryPrice->is_active,
                        ])
                        ->values()
                        ->all(),
                ])->values()->all(),
            ])
            ->values();

        return response()->json([
            'data' => $programs,
        ]);
    }
}
