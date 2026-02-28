<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

class IpGeolocationService
{
    /**
     * @return array<string, mixed>
     */
    public function lookup(?string $ip): array
    {
        if (! config('ip-geolocation.enabled', false) || blank($ip)) {
            return [];
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('ip-geolocation.url'), '/'))
                ->timeout((int) config('ip-geolocation.timeout', 5))
                ->acceptJson()
                ->get($ip.'/json/', [
                    'key' => config('ip-geolocation.key'),
                ]);

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (Throwable) {
            return [];
        }
    }
}
