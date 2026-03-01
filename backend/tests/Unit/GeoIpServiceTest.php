<?php

namespace Tests\Unit;

use App\Services\GeoIpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GeoIpServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    #[DataProvider('localIpProvider')]
    public function test_lookup_returns_local_payload_for_private_or_loopback_ips(string $ip): void
    {
        $payload = app(GeoIpService::class)->lookup($ip);

        $this->assertSame('Local', $payload['country_name']);
        $this->assertSame('Local', $payload['city']);
        $this->assertSame('Local', $payload['isp']);
    }

    public function test_lookup_calls_external_service_for_public_ip(): void
    {
        Http::fake([
            'http://ip-api.com/json/197.55.1.2*' => Http::response([
                'status' => 'success',
                'countryCode' => 'EG',
                'country' => 'Egypt',
                'city' => 'Damanhour',
                'isp' => 'TE Data',
            ], 200),
        ]);

        $payload = app(GeoIpService::class)->lookup('197.55.1.2');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'ip-api.com/json/197.55.1.2'));
        $this->assertSame('EG', $payload['country_code']);
        $this->assertSame('Egypt', $payload['country_name']);
        $this->assertSame('Damanhour', $payload['city']);
    }

    public function test_lookup_uses_cache_for_repeated_public_ip(): void
    {
        Http::fake([
            'http://ip-api.com/json/41.32.1.1*' => Http::response([
                'status' => 'success',
                'countryCode' => 'EG',
                'country' => 'Egypt',
                'city' => 'Cairo',
                'isp' => 'ISP',
            ], 200),
        ]);

        $service = app(GeoIpService::class);
        $first = $service->lookup('41.32.1.1');
        $second = $service->lookup('41.32.1.1');

        Http::assertSentCount(1);
        $this->assertSame($first, $second);
    }

    public function test_lookup_returns_unknown_payload_on_network_error(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Timed out');
        });

        $payload = app(GeoIpService::class)->lookup('8.8.8.8');

        $this->assertNull($payload['country_code']);
        $this->assertSame('Unknown', $payload['country_name']);
        $this->assertSame('', $payload['city']);
    }

    public function test_lookup_returns_unknown_when_api_status_is_fail(): void
    {
        Http::fake([
            'http://ip-api.com/json/8.8.4.4*' => Http::response([
                'status' => 'fail',
            ], 200),
        ]);

        $payload = app(GeoIpService::class)->lookup('8.8.4.4');

        $this->assertSame('Unknown', $payload['country_name']);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function localIpProvider(): array
    {
        return [
            'loopback ipv4' => ['127.0.0.1'],
            'loopback ipv6' => ['::1'],
            'private 10.x' => ['10.0.0.7'],
            'private 192.168.x' => ['192.168.1.2'],
            'private 172.16.x' => ['172.16.5.9'],
            'private 172.31.x' => ['172.31.200.1'],
            'blank' => ['  '],
        ];
    }
}

