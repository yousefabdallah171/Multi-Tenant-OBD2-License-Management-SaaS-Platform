<?php

namespace Tests\Feature\Security;

use App\Services\IpAnalyticsService;
use Tests\TestCase;

class IpAnalyticsTimestampNormalizationTest extends TestCase
{
    public function test_it_normalizes_external_log_timestamp_to_iso_utc(): void
    {
        $service = new IpAnalyticsService();

        $raw = implode("\n", [
            'ALLOY261   Sun:Apr:19:2026  16:27:58  109.126.175.182',
            'custo6_IRAQ179   Sun:Apr:19:2026  18:42:31  105.101.162.97',
        ]);

        $parsed = $service->parseExternalLogs($raw);

        $this->assertCount(2, $parsed);
        $this->assertSame('ALLOY261', $parsed[0]['username']);
        $this->assertSame('Sun:Apr:19:2026  16:27:58', $parsed[0]['raw_timestamp']);
        $this->assertSame('2026-04-19T16:27:58+00:00', $parsed[0]['timestamp']);
        $this->assertSame('109.126.175.182', $parsed[0]['ip_address']);

        $this->assertSame('custo6_IRAQ179', $parsed[1]['username']);
        $this->assertSame('Sun:Apr:19:2026  18:42:31', $parsed[1]['raw_timestamp']);
        $this->assertSame('2026-04-19T18:42:31+00:00', $parsed[1]['timestamp']);
        $this->assertSame('105.101.162.97', $parsed[1]['ip_address']);
    }
}

