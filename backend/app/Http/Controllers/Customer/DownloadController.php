<?php

namespace App\Http\Controllers\Customer;

use App\Models\ActivityLog;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DownloadController extends BaseCustomerController
{
    public function index(Request $request): JsonResponse
    {
        $licenses = $this->customerLicenseQuery($request)
            ->with(['program:id,name,version,download_link,file_size,system_requirements,installation_guide_url'])
            ->latest('activated_at')
            ->get()
            ->filter(fn (License $license): bool => $this->effectiveStatus($license) === 'active' && $license->program !== null)
            ->groupBy('program_id')
            ->map(fn ($group) => $group->sortByDesc('expires_at')->first())
            ->filter()
            ->values();

        $downloadActivity = ActivityLog::query()
            ->where('user_id', $this->currentCustomer($request)->id)
            ->where('action', 'customer.download')
            ->latest()
            ->get();

        return response()->json([
            'data' => $licenses->map(function (License $license) use ($downloadActivity): array {
                $lastDownload = $downloadActivity->first(function (ActivityLog $entry) use ($license): bool {
                    return (int) ($entry->metadata['program_id'] ?? 0) === $license->program_id;
                });

                return [
                    'id' => $license->id,
                    'license_id' => $license->id,
                    'program_id' => $license->program_id,
                    'program_name' => $license->program?->name,
                    'version' => $license->program?->version,
                    'download_link' => $license->program?->download_link,
                    'file_size' => $license->program?->file_size,
                    'last_downloaded_at' => $lastDownload?->created_at?->toIso8601String(),
                    'system_requirements' => $license->program?->system_requirements,
                    'installation_guide_url' => $license->program?->installation_guide_url,
                    'status' => $this->effectiveStatus($license),
                    'days_remaining' => $this->daysRemaining($license->expires_at),
                    'can_download' => filled($license->program?->download_link),
                ];
            })->values(),
        ]);
    }

    public function logDownload(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveCustomerLicense($request, $license);
        $resolved->loadMissing('program:id,name,version,download_link');

        abort_unless($this->effectiveStatus($resolved) === 'active' && filled($resolved->program?->download_link), 422, 'Download unavailable.');

        $this->logActivity(
            $request,
            'customer.download',
            sprintf(
                'Downloaded %s%s.',
                $resolved->program?->name ?? 'program',
                $resolved->program?->version ? ' '.$resolved->program->version : '',
            ),
            [
                'license_id' => $resolved->id,
                'program_id' => $resolved->program_id,
                'bios_id' => $resolved->bios_id,
            ],
        );

        return response()->json([
            'message' => 'Download logged successfully.',
            'logged_at' => now()->toIso8601String(),
        ]);
    }
}
