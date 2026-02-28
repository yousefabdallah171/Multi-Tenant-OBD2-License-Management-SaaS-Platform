<?php

namespace App\Events;

use App\Models\License;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LicenseDeactivated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public License $license)
    {
    }

    public function broadcastOn(): array
    {
        $tenantId = $this->license->tenant_id ?? 'global';

        return [new Channel('tenants.'.$tenantId.'.licenses')];
    }

    public function broadcastAs(): string
    {
        return 'license.deactivated';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->license->id,
            'tenant_id' => $this->license->tenant_id,
            'reseller_id' => $this->license->reseller_id,
            'customer_id' => $this->license->customer_id,
            'program_id' => $this->license->program_id,
            'bios_id' => $this->license->bios_id,
            'status' => $this->license->status,
            'price' => (float) $this->license->price,
            'activated_at' => $this->license->activated_at?->toIso8601String(),
            'expires_at' => $this->license->expires_at?->toIso8601String(),
        ];
    }
}
