<?php

namespace App\Http\Controllers\Reseller;

use App\Models\Program;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoftwareController extends BaseResellerController
{
    public function index(Request $request): JsonResponse
    {
        $programs = Program::query()
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
            ])
            ->values();

        return response()->json([
            'data' => $programs,
        ]);
    }
}
