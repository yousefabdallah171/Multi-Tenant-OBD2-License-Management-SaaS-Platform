<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class IpAnalyticsController extends BaseManagerParentController
{
    private const PRIVATE_IP_PATTERNS = [
        '/^127\./',
        '/^::1$/',
        '/^10\./',
        '/^192\.168\./',
        '/^172\.(1[6-9]|2\d|3[01])\./',
    ];

    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $response = $this->externalApiService->getGlobalLogs();

        if (! ($response['success'] ?? false)) {
            return response()->json(['data' => []]);
        }

        $raw = (string) ($response['data']['raw'] ?? '');
        $rows = collect(preg_split('/\r\n|\r|\n/', $raw) ?: [])
            ->map(static function (string $line): ?array {
                $trimmed = trim($line);
                if ($trimmed === '') {
                    return null;
                }

                if (! preg_match('/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/', $trimmed, $matches)) {
                    return null;
                }

                return [
                    'username' => trim($matches[1]),
                    'timestamp' => trim($matches[2]),
                    'ip_address' => trim($matches[3]),
                ];
            })
            ->filter()
            ->values();

        $usernames = $rows
            ->pluck('username')
            ->filter(static fn ($username): bool => is_string($username) && $username !== '')
            ->unique()
            ->values()
            ->all();

        $licenseLookup = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->whereIn('external_username', $usernames)
            ->get(['external_username', 'bios_id', 'customer_id'])
            ->keyBy('external_username');

        $rows = $rows
            ->filter(static fn (array $row): bool => $licenseLookup->has($row['username']))
            ->sortByDesc('timestamp')
            ->values();

        // Collect unique public IPs for GeoIP enrichment
        $uniquePublicIps = $rows
            ->pluck('ip_address')
            ->unique()
            ->filter(fn (string $ip): bool => ! $this->isPrivateIp($ip))
            ->values()
            ->all();

        $geoData = $this->fetchGeoData($uniquePublicIps);

        return response()->json([
            'data' => $rows->map(static function (array $row) use ($licenseLookup, $geoData): array {
                $license = $licenseLookup->get($row['username']);
                $geo = $geoData[$row['ip_address']] ?? [
                    'country' => 'Unknown',
                    'country_code' => '',
                    'city' => '',
                    'isp' => '',
                    'proxy' => false,
                    'hosting' => false,
                ];

                return [
                    'username' => $row['username'],
                    'bios_id' => $license?->bios_id,
                    'customer_id' => $license?->customer_id,
                    'ip_address' => $row['ip_address'],
                    'timestamp' => $row['timestamp'],
                    'country' => $geo['country'],
                    'country_code' => $geo['country_code'],
                    'city' => $geo['city'],
                    'isp' => $geo['isp'],
                    'proxy' => $geo['proxy'],
                    'hosting' => $geo['hosting'],
                ];
            })->values(),
        ]);
    }

    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => [
                'countries' => [],
                'suspicious' => [],
            ],
        ]);
    }

    private function isPrivateIp(string $ip): bool
    {
        foreach (self::PRIVATE_IP_PATTERNS as $pattern) {
            if (preg_match($pattern, $ip)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  string[]  $ips
     * @return array<string, array{country: string, country_code: string, city: string, isp: string, proxy: bool, hosting: bool}>
     */
    private function fetchGeoData(array $ips): array
    {
        if (empty($ips)) {
            return [];
        }

        $fallback = ['country' => 'Unknown', 'country_code' => '', 'city' => '', 'isp' => '', 'proxy' => false, 'hosting' => false];
        $result = [];

        foreach (array_chunk($ips, 100) as $chunk) {
            try {
                $payload = array_map(static fn (string $ip): array => ['query' => $ip], $chunk);
                $response = Http::timeout(8)
                    ->post('http://ip-api.com/batch?fields=status,country,countryCode,city,isp,org,proxy,hosting,query', $payload);

                if (! $response->successful()) {
                    foreach ($chunk as $ip) {
                        $result[$ip] = $fallback;
                    }
                    continue;
                }

                foreach ($response->json() as $item) {
                    $ip = (string) ($item['query'] ?? '');
                    if ($ip === '' || ($item['status'] ?? '') !== 'success') {
                        if ($ip !== '') {
                            $result[$ip] = $fallback;
                        }
                        continue;
                    }

                    $result[$ip] = [
                        'country' => (string) ($item['country'] ?? 'Unknown'),
                        'country_code' => (string) ($item['countryCode'] ?? ''),
                        'city' => (string) ($item['city'] ?? ''),
                        'isp' => (string) ($item['org'] !== '' ? ($item['org'] ?? '') : ($item['isp'] ?? '')),
                        'proxy' => (bool) (($item['proxy'] ?? false) || ($item['hosting'] ?? false)),
                        'hosting' => (bool) ($item['hosting'] ?? false),
                    ];
                }
            } catch (\Throwable) {
                foreach ($chunk as $ip) {
                    $result[$ip] = $fallback;
                }
            }
        }

        return $result;
    }
}
