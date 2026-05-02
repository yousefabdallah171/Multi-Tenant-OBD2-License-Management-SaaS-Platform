<?php

namespace App\Jobs;

use App\Models\License;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessMandiagWebhookEvent implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $event,
        private readonly array $data,
    ) {}

    public function handle(): void
    {
        match ($this->event) {
            'license.expired'       => $this->handleExpired($this->data),
            'license.expiring_soon' => $this->handleExpiringSoon($this->data),
            'license.renewed'       => $this->handleRenewed($this->data),
            'license.disabled'      => $this->handleDisabled($this->data),
            'license.enabled'       => $this->handleEnabled($this->data),
            'license.banned'        => $this->handleBanned($this->data),
            'license.unbanned'      => $this->handleUnbanned($this->data),
            'license.created'       => Log::info('Mandiag license.created', ['license_id' => $this->data['license_id'] ?? null]),
            'license.transferred'   => Log::info('Mandiag license.transferred', ['license_id' => $this->data['license_id'] ?? null, 'to_sub_id' => $this->data['to_sub_id'] ?? null]),
            'license.hwid_changed'  => Log::info('Mandiag license.hwid_changed', ['license_id' => $this->data['license_id'] ?? null, 'new_hwid' => $this->data['new_hwid'] ?? null]),
            'reseller.created',
            'reseller.updated',
            'reseller.deleted'      => Log::info('Mandiag reseller event', ['event' => $this->event, 'sub_id' => $this->data['sub_id'] ?? null]),
            'code.created',
            'code.redeemed',
            'code.expiring_soon'    => Log::info('Mandiag code event', ['event' => $this->event, 'code_id' => $this->data['code_id'] ?? null]),
            default                 => null,
        };
    }

    private function handleExpired(array $data): void
    {
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license && $license->status === 'active') {
            $license->forceFill(['status' => 'expired'])->save();
            // TODO: dispatch expiry notification to reseller
        }
    }

    private function handleExpiringSoon(array $data): void
    {
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license) {
            // TODO: dispatch expiry-warning notification to reseller with $data['days_remaining']
        }
    }

    private function handleRenewed(array $data): void
    {
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license && ! empty($data['expire_date'])) {
            $license->forceFill(['expires_at' => $data['expire_date']])->save();
        }
    }

    private function handleDisabled(array $data): void
    {
        // Handles EXTERNAL disables only (Mandiag admin, not triggered by our platform).
        // status='pending' is the platform's paused state — consistent with platform pause() behavior.
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license && $license->status === 'active') {
            $license->forceFill([
                'status'       => 'pending',
                'paused_at'    => now(),
                'pause_reason' => 'Disabled externally by Mandiag.',
            ])->save();
            // TODO: notify reseller — "Your license for [software] was disabled externally."
        }
    }

    private function handleEnabled(array $data): void
    {
        // Handles EXTERNAL enables (Mandiag admin).
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license && $license->status === 'pending') {
            $license->forceFill(['status' => 'active'])->save();
        }
    }

    private function handleBanned(array $data): void
    {
        // CRITICAL: Mandiag banned this license — customer cannot use it at all.
        $license = License::where('mandiag_license_id', $data['license_id'] ?? null)->first();
        if ($license) {
            $license->forceFill(['status' => 'cancelled'])->save();
            // TODO: notify reseller urgently — ban_reason in $data['ban_reason']
        }
    }

    private function handleUnbanned(array $data): void
    {
        // Log only — do NOT auto-reactivate. Manager Parent decides what to do next.
        Log::info('Mandiag license unbanned', ['license_id' => $data['license_id'] ?? null]);
    }
}
