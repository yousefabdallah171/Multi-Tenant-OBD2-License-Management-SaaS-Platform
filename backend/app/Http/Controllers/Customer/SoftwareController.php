<?php

namespace App\Http\Controllers\Customer;

use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SoftwareController extends BaseCustomerController
{
    public function index(Request $request): JsonResponse
    {
        $licenses = $this->customerLicenseQuery($request)
            ->with(['program:id,name,description,version,download_link,file_size,system_requirements,installation_guide_url,icon,status'])
            ->latest('activated_at')
            ->get()
            ->filter(fn (License $license): bool => $this->effectiveStatus($license) === 'active' && $license->program !== null)
            ->groupBy('program_id')
            ->map(fn ($group) => $group->sortByDesc('expires_at')->first())
            ->filter()
            ->values();

        return response()->json([
            'data' => $licenses->map(function (License $license): array {
                $status = $this->effectiveStatus($license);

                return [
                    'id' => $license->program_id,
                    'license_id' => $license->id,
                    'program_id' => $license->program_id,
                    'name' => $license->program?->name,
                    'description' => $license->program?->description,
                    'version' => $license->program?->version,
                    'icon' => $license->program?->icon ? Storage::disk('public')->url($license->program->icon) : null,
                    'status' => $status,
                    'download_link' => $license->program?->download_link,
                    'file_size' => $license->program?->file_size,
                    'system_requirements' => $license->program?->system_requirements,
                    'installation_guide_url' => $license->program?->installation_guide_url,
                    'expires_at' => $license->expires_at?->toIso8601String(),
                    'days_remaining' => $this->daysRemaining($license->expires_at),
                    'can_download' => $status === 'active' && filled($license->program?->download_link),
                ];
            })->values(),
        ]);
    }
}
