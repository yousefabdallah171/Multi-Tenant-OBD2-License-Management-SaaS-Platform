<?php

namespace App\Http\Controllers\ManagerParent;

use App\Services\ExternalApiService;
use App\Services\IpAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class IpAnalyticsController extends BaseManagerParentController
{
    public function __construct(
        private readonly ExternalApiService $externalApiService,
        private readonly IpAnalyticsService $ipAnalyticsService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'search' => ['nullable', 'string'],
            'country' => ['nullable', 'string', 'max:100'],
            'program_id' => ['nullable', 'integer', 'min:1'],
            'reputation' => ['nullable', 'in:all,safe,proxy'],
        ]);

        $tenantId = $this->currentTenantId($request);
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 100);

        $response = $this->externalApiService->getGlobalLogs();
        if (! ($response['success'] ?? false)) {
            return response()->json([
                'data' => [],
                'meta' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => 0,
                    'last_page' => 1,
                    'has_next_page' => false,
                    'next_page' => null,
                ],
                'message' => 'External API is currently unavailable.',
            ]);
        }

        $parsed = $this->ipAnalyticsService->parseExternalLogs((string) ($response['data']['raw'] ?? ''));
        $matched = $this->ipAnalyticsService->matchLogsToDatabaseRecords($parsed, $tenantId);

        $geoByIp = $this->fetchGeoData(array_values(array_unique(array_column($matched, 'ip_address'))));
        $rows = collect($this->ipAnalyticsService->formatResponse($matched))
            ->map(function (array $row) use ($geoByIp): array {
                $geo = $geoByIp[$row['ip_address']] ?? [
                    'country' => 'Unknown',
                    'country_code' => '',
                    'city' => '',
                    'isp' => '',
                    'proxy' => false,
                    'hosting' => false,
                ];

                return [
                    ...$row,
                    'country' => $geo['country'],
                    'country_code' => $geo['country_code'],
                    'city' => $geo['city'],
                    'isp' => $geo['isp'],
                    'proxy' => (bool) $geo['proxy'],
                    'hosting' => (bool) $geo['hosting'],
                ];
            });

        if (! empty($validated['search'])) {
            $search = mb_strtolower((string) $validated['search']);
            $rows = $rows->filter(fn (array $row): bool => str_contains(mb_strtolower((string) ($row['username'] ?? '')), $search)
                || str_contains(mb_strtolower((string) ($row['bios_id'] ?? '')), $search)
                || str_contains(mb_strtolower((string) ($row['program_name'] ?? '')), $search)
                || str_contains(mb_strtolower((string) ($row['ip_address'] ?? '')), $search));
        }

        if (! empty($validated['country'])) {
            $country = mb_strtolower((string) $validated['country']);
            $rows = $rows->filter(fn (array $row): bool => str_contains(mb_strtolower((string) ($row['country'] ?? '')), $country));
        }

        if (! empty($validated['program_id'])) {
            $programId = (int) $validated['program_id'];
            $rows = $rows->filter(fn (array $row): bool => (int) ($row['program_id'] ?? 0) === $programId);
        }

        $reputation = (string) ($validated['reputation'] ?? 'all');
        if ($reputation === 'proxy') {
            $rows = $rows->filter(fn (array $row): bool => (bool) ($row['proxy'] || $row['hosting']));
        } elseif ($reputation === 'safe') {
            $rows = $rows->filter(fn (array $row): bool => ! ((bool) ($row['proxy'] || $row['hosting'])));
        }

        $rows = $rows->values();
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset = max(0, ($page - 1) * $perPage);

        return response()->json([
            'data' => $rows->slice($offset, $perPage)->values(),
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_next_page' => $page < $lastPage,
                'next_page' => $page < $lastPage ? $page + 1 : null,
            ],
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

    /**
     * @param string[] $ips
     * @return array<string, array{country: string, country_code: string, city: string, isp: string, proxy: bool, hosting: bool}>
     */
    private function fetchGeoData(array $ips): array
    {
        if (empty($ips)) {
            return [];
        }

        $fallback = ['country' => 'Unknown', 'country_code' => '', 'city' => '', 'isp' => '', 'proxy' => false, 'hosting' => false];
        $result = [];
        $uncachedIps = [];

        foreach ($ips as $ip) {
            $cached = Cache::get('ip-analytics:geo:'.$ip);
            if (is_array($cached)) {
                $result[$ip] = [
                    'country' => (string) ($cached['country'] ?? 'Unknown'),
                    'country_code' => (string) ($cached['country_code'] ?? ''),
                    'city' => (string) ($cached['city'] ?? ''),
                    'isp' => (string) ($cached['isp'] ?? ''),
                    'proxy' => (bool) ($cached['proxy'] ?? false),
                    'hosting' => (bool) ($cached['hosting'] ?? false),
                ];
                continue;
            }

            $uncachedIps[] = $ip;
        }

        foreach (array_chunk($uncachedIps, 100) as $chunk) {
            try {
                $payload = array_map(static fn (string $ip): array => ['query' => $ip], $chunk);
                $response = Http::timeout(8)
                    ->post('http://ip-api.com/batch?fields=status,country,countryCode,city,isp,org,proxy,hosting,query', $payload);

                if (! $response->successful()) {
                    foreach ($chunk as $ip) {
                        $result[$ip] = $fallback;
                        Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addHour());
                    }
                    continue;
                }

                foreach ($response->json() as $item) {
                    $ip = (string) ($item['query'] ?? '');
                    if ($ip === '' || ($item['status'] ?? '') !== 'success') {
                        if ($ip !== '') {
                            $result[$ip] = $fallback;
                            Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addHour());
                        }
                        continue;
                    }

                    $geo = [
                        'country' => (string) ($item['country'] ?? 'Unknown'),
                        'country_code' => (string) ($item['countryCode'] ?? ''),
                        'city' => (string) ($item['city'] ?? ''),
                        'isp' => (string) (($item['org'] ?? '') !== '' ? ($item['org'] ?? '') : ($item['isp'] ?? '')),
                        'proxy' => (bool) (($item['proxy'] ?? false) || ($item['hosting'] ?? false)),
                        'hosting' => (bool) ($item['hosting'] ?? false),
                    ];

                    $result[$ip] = $geo;
                    Cache::put('ip-analytics:geo:'.$ip, $geo, now()->addHour());
                }
            } catch (\Throwable) {
                foreach ($chunk as $ip) {
                    $result[$ip] = $fallback;
                    Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addHour());
                }
            }
        }

        return $result;
    }
}

