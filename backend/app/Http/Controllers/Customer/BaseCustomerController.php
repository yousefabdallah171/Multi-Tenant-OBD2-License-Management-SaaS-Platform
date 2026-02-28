<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;

abstract class BaseCustomerController extends Controller
{
    protected function currentCustomer(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    protected function customerLicenseQuery(Request $request)
    {
        return License::query()
            ->where('customer_id', $this->currentCustomer($request)->id);
    }

    protected function resolveCustomerLicense(Request $request, License $license): License
    {
        abort_unless($license->customer_id === $this->currentCustomer($request)->id, 404);

        return $license;
    }

    protected function effectiveStatus(License $license): string
    {
        if ($license->status === 'suspended') {
            return 'suspended';
        }

        if ($license->expires_at && $license->expires_at->isPast()) {
            return 'expired';
        }

        return $license->status;
    }

    protected function daysRemaining(?CarbonInterface $expiresAt): int
    {
        if (! $expiresAt || $expiresAt->isPast()) {
            return 0;
        }

        return now()->diffInDays($expiresAt, false);
    }

    protected function percentageRemaining(License $license): int
    {
        if (! $license->activated_at || ! $license->expires_at) {
            return $this->effectiveStatus($license) === 'active' ? 100 : 0;
        }

        $totalSeconds = max(1, $license->activated_at->diffInSeconds($license->expires_at, false));
        $remainingSeconds = max(0, now()->diffInSeconds($license->expires_at, false));

        return (int) round(min(100, max(0, ($remainingSeconds / $totalSeconds) * 100)));
    }

    protected function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $this->currentCustomer($request)->tenant_id,
            'user_id' => $this->currentCustomer($request)->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }

    protected function serializeDashboardLicense(License $license): array
    {
        $license->loadMissing(['program:id,name,description,version,download_link,file_size,system_requirements,installation_guide_url,icon', 'reseller:id,name,email']);
        $status = $this->effectiveStatus($license);

        return [
            'id' => $license->id,
            'program_id' => $license->program_id,
            'program_name' => $license->program?->name,
            'program_description' => $license->program?->description,
            'program_version' => $license->program?->version,
            'program_icon' => $license->program?->icon,
            'bios_id' => $license->bios_id,
            'status' => $status,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'days_remaining' => $this->daysRemaining($license->expires_at),
            'percentage_remaining' => $this->percentageRemaining($license),
            'download_link' => $license->program?->download_link,
            'reseller_name' => $license->reseller?->name,
            'reseller_email' => $license->reseller?->email,
            'can_download' => $status === 'active' && filled($license->program?->download_link),
        ];
    }
}
