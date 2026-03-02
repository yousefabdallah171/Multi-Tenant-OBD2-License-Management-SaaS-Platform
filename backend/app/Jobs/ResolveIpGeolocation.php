<?php

namespace App\Jobs;

use App\Models\UserIpLog;
use App\Services\IpGeolocationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ResolveIpGeolocation implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly int $ipLogId)
    {
    }

    public function handle(IpGeolocationService $ipGeolocationService): void
    {
        $ipLog = UserIpLog::query()->find($this->ipLogId);
        if (! $ipLog || blank($ipLog->ip_address)) {
            return;
        }

        $geo = $ipGeolocationService->lookup($ipLog->ip_address);
        if ($geo === []) {
            return;
        }

        $ipLog->forceFill([
            'country' => $geo['country_name'] ?? $geo['country'] ?? null,
            'city' => $geo['city'] ?? null,
            'isp' => $geo['org'] ?? $geo['isp'] ?? null,
        ])->save();
    }
}
