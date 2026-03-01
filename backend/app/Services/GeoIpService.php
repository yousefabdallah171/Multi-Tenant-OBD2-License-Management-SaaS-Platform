<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class GeoIpService
{
    /**
     * @return array<string, string|null>
     */
    public function lookup(string $ip): array
    {
        $normalizedIp = trim($ip);
        if ($normalizedIp === '' || $this->isPrivateOrLocalIp($normalizedIp)) {
            return [
                'country_code' => null,
                'country_name' => 'Local',
                'city' => 'Local',
                'isp' => 'Local',
            ];
        }

        return Cache::remember('geo:'.$normalizedIp, now()->addDay(), function () use ($normalizedIp): array {
            try {
                $response = Http::timeout(4)
                    ->acceptJson()
                    ->get('http://ip-api.com/json/'.$normalizedIp, [
                        'fields' => 'status,countryCode,country,city,isp',
                    ]);

                $payload = $response->json();
                if (! $response->successful() || ! is_array($payload) || ($payload['status'] ?? 'fail') !== 'success') {
                    return $this->unknown();
                }

                return [
                    'country_code' => is_string($payload['countryCode'] ?? null) ? $payload['countryCode'] : null,
                    'country_name' => is_string($payload['country'] ?? null) ? $payload['country'] : 'Unknown',
                    'city' => is_string($payload['city'] ?? null) ? $payload['city'] : '',
                    'isp' => is_string($payload['isp'] ?? null) ? $payload['isp'] : '',
                ];
            } catch (Throwable) {
                return $this->unknown();
            }
        });
    }

    /**
     * @return array<string, string|null>
     */
    private function unknown(): array
    {
        return [
            'country_code' => null,
            'country_name' => 'Unknown',
            'city' => '',
            'isp' => '',
        ];
    }

    private function isPrivateOrLocalIp(string $ip): bool
    {
        return $ip === '127.0.0.1'
            || $ip === '::1'
            || str_starts_with($ip, '10.')
            || str_starts_with($ip, '192.168.')
            || preg_match('/^172\.(1[6-9]|2\d|3[0-1])\./', $ip) === 1;
    }
}

