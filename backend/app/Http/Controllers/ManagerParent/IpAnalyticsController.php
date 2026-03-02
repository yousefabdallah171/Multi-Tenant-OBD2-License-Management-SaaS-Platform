<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\License;
use App\Models\Program;
use App\Services\ExternalApiService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
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
        $validated = $request->validate([
            'program_id' => ['required', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'search' => ['nullable', 'string'],
            'reputation' => ['nullable', 'in:all,safe,proxy'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 100);
        $tenantId = $this->currentTenantId($request);
        $program = $this->resolveProgram($request, (int) $validated['program_id']);

        $rows = Cache::get($this->analyticsCacheKey($tenantId, $program->id));
        if (! is_array($rows)) {
            $rows = $this->buildBaseRows($tenantId, $program);
        }

        if (! is_array($rows)) {
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

        $rows = collect($rows);

        if (! empty($validated['search'])) {
            $search = mb_strtolower((string) $validated['search']);
            $rows = $rows->filter(fn (array $row): bool => str_contains(mb_strtolower((string) $row['ip_address']), $search)
                || str_contains(mb_strtolower((string) $row['username']), $search)
                || str_contains(mb_strtolower((string) ($row['customer_username'] ?? '')), $search)
                || str_contains(mb_strtolower((string) ($row['customer_name'] ?? '')), $search)
                || str_contains(mb_strtolower((string) ($row['bios_id'] ?? '')), $search));
        }

        if (! empty($validated['from']) || ! empty($validated['to'])) {
            $from = ! empty($validated['from']) ? CarbonImmutable::parse((string) $validated['from'])->startOfDay() : null;
            $to = ! empty($validated['to']) ? CarbonImmutable::parse((string) $validated['to'])->endOfDay() : null;
            $rows = $rows->filter(function (array $row) use ($from, $to): bool {
                $time = isset($row['parsed_at']) ? CarbonImmutable::parse((string) $row['parsed_at']) : null;
                if ($time === null) {
                    return false;
                }

                if ($from !== null && $time->lt($from)) {
                    return false;
                }

                if ($to !== null && $time->gt($to)) {
                    return false;
                }

                return true;
            });
        }

        // Collect unique public IPs for GeoIP enrichment
        $uniquePublicIps = $rows
            ->pluck('ip_address')
            ->unique()
            ->filter(fn (string $ip): bool => ! $this->isPrivateIp($ip))
            ->values()
            ->all();

        $geoData = $this->fetchGeoData($uniquePublicIps);

        $data = $rows->map(static function (array $row) use ($geoData): array {
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
                    'external_username' => $row['external_username'],
                    'bios_id' => $row['bios_id'],
                    'customer_id' => $row['customer_id'],
                    'customer_name' => $row['customer_name'],
                    'customer_username' => $row['customer_username'],
                    'license_id' => $row['license_id'],
                    'program_id' => $row['program_id'],
                    'program_name' => $row['program_name'],
                    'ip_address' => $row['ip_address'],
                    'timestamp' => $row['timestamp'],
                    'parsed_at' => $row['parsed_at'],
                    'country' => $geo['country'],
                    'country_code' => $geo['country_code'],
                    'city' => $geo['city'],
                    'isp' => $geo['isp'],
                    'proxy' => $geo['proxy'],
                    'hosting' => $geo['hosting'],
                ];
            })->values();

        if (($validated['reputation'] ?? 'all') === 'proxy') {
            $data = $data->filter(fn (array $row): bool => (bool) ($row['proxy'] || $row['hosting']));
        } elseif (($validated['reputation'] ?? 'all') === 'safe') {
            $data = $data->filter(fn (array $row): bool => ! ((bool) ($row['proxy'] || $row['hosting'])));
        }

        $data = $data->sortByDesc(static fn (array $row): string => (string) $row['parsed_at'])->values();
        $total = $data->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset = max(0, ($page - 1) * $perPage);

        return response()->json([
            'data' => $data->slice($offset, $perPage)->values(),
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

    private function isPrivateIp(string $ip): bool
    {
        foreach (self::PRIVATE_IP_PATTERNS as $pattern) {
            if (preg_match($pattern, $ip)) {
                return true;
            }
        }

        return false;
    }

    private function resolveProgram(Request $request, int $programId): Program
    {
        return Program::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('id', $programId)
            ->where('has_external_api', true)
            ->firstOrFail();
    }

    private function parseExternalTimestamp(string $timestamp): ?CarbonImmutable
    {
        $normalized = preg_replace('/\s+/', ' ', trim($timestamp));
        if (! is_string($normalized) || $normalized === '') {
            return null;
        }

        foreach (['D:M:d:Y H:i:s', 'D:M:j:Y H:i:s'] as $format) {
            try {
                return CarbonImmutable::createFromFormat($format, $normalized, config('app.timezone'));
            } catch (\Throwable) {
            }
        }

        try {
            return CarbonImmutable::parse($normalized, config('app.timezone'));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return Collection<string, array<int, array<string, mixed>>>
     */
    private function buildLicenseLookup(int $tenantId, Program $program): Collection
    {
        $licenses = License::query()
            ->where('tenant_id', $tenantId)
            ->where('program_id', $program->id)
            ->with(['customer:id,name,username', 'reseller:id,name'])
            ->get();

        $lookup = collect();

        foreach ($licenses as $license) {
            $payload = [
                'license_id' => $license->id,
                'external_username' => $license->external_username,
                'bios_id' => $license->bios_id,
                'customer_id' => $license->customer_id,
                'customer_name' => $license->customer?->name,
                'customer_username' => $license->customer?->username,
                'reseller_name' => $license->reseller?->name,
            ];

            foreach ([
                $license->external_username,
                $license->customer?->username,
                $license->customer?->name,
            ] as $candidate) {
                $key = $this->normalizeLookupValue($candidate);
                if ($key === null) {
                    continue;
                }

                $existing = $lookup->get($key, []);
                $existing[] = $payload;
                $lookup->put($key, $existing);
            }
        }

        return $lookup;
    }

    /**
     * @param  Collection<string, array<int, array<string, mixed>>>  $lookup
     * @return array<string, mixed>|null
     */
    private function matchLicense(Collection $lookup, string $username): ?array
    {
        $key = $this->normalizeLookupValue($username);
        if ($key === null) {
            return null;
        }

        $matches = $lookup->get($key, []);

        return $matches[0] ?? null;
    }

    private function normalizeLookupValue(?string $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = mb_strtolower(trim($value));

        return $normalized === '' ? null : $normalized;
    }

    /**
     * @return array<int, array<string, mixed>>|null
     */
    private function buildBaseRows(int $tenantId, Program $program): ?array
    {
        $response = $this->externalApiService->getGlobalLogs($program->external_api_base_url);
        if (! ($response['success'] ?? false)) {
            return null;
        }

        $raw = (string) ($response['data']['raw'] ?? '');
        $licenseLookup = $this->buildLicenseLookup($tenantId, $program);

        $rows = collect(preg_split('/\r\n|\r|\n/', $raw) ?: [])
            ->map(function (string $line) use ($licenseLookup, $program): ?array {
                $trimmed = trim($line);
                if ($trimmed === '') {
                    return null;
                }

                if (! preg_match('/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/', $trimmed, $matches)) {
                    return null;
                }

                $parsedAt = $this->parseExternalTimestamp(trim($matches[2]));
                if ($parsedAt === null) {
                    return null;
                }

                $licenseInfo = $this->matchLicense($licenseLookup, trim($matches[1]));
                if ($licenseInfo === null) {
                    return null;
                }

                return [
                    'username' => trim($matches[1]),
                    'timestamp' => trim($matches[2]),
                    'parsed_at' => $parsedAt->toIso8601String(),
                    'parsed_at_unix' => $parsedAt->getTimestamp(),
                    'ip_address' => trim($matches[3]),
                    'program_id' => $program->id,
                    'program_name' => $program->name,
                    'bios_id' => $licenseInfo['bios_id'],
                    'customer_id' => $licenseInfo['customer_id'],
                    'customer_name' => $licenseInfo['customer_name'],
                    'customer_username' => $licenseInfo['customer_username'],
                    'external_username' => $licenseInfo['external_username'],
                    'license_id' => $licenseInfo['license_id'],
                ];
            })
            ->filter()
            ->sortByDesc('parsed_at_unix')
            ->values()
            ->all();

        Cache::put($this->analyticsCacheKey($tenantId, $program->id), $rows, now()->addSeconds(30));

        return $rows;
    }

    private function analyticsCacheKey(int $tenantId, int $programId): string
    {
        return sprintf('ip-analytics:tenant:%d:program:%d:base-rows', $tenantId, $programId);
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
                        Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addDay());
                    }
                    continue;
                }

                foreach ($response->json() as $item) {
                    $ip = (string) ($item['query'] ?? '');
                    if ($ip === '' || ($item['status'] ?? '') !== 'success') {
                        if ($ip !== '') {
                            $result[$ip] = $fallback;
                            Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addDay());
                        }
                        continue;
                    }

                    $geo = [
                        'country' => (string) ($item['country'] ?? 'Unknown'),
                        'country_code' => (string) ($item['countryCode'] ?? ''),
                        'city' => (string) ($item['city'] ?? ''),
                        'isp' => (string) ($item['org'] !== '' ? ($item['org'] ?? '') : ($item['isp'] ?? '')),
                        'proxy' => (bool) (($item['proxy'] ?? false) || ($item['hosting'] ?? false)),
                        'hosting' => (bool) ($item['hosting'] ?? false),
                    ];
                    $result[$ip] = $geo;
                    Cache::put('ip-analytics:geo:'.$ip, $geo, now()->addDay());
                }
            } catch (\Throwable) {
                foreach ($chunk as $ip) {
                    $result[$ip] = $fallback;
                    Cache::put('ip-analytics:geo:'.$ip, $fallback, now()->addDay());
                }
            }
        }

        return $result;
    }
}
