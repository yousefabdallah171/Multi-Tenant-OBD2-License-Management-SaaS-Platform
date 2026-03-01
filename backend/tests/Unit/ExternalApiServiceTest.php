<?php

namespace Tests\Unit;

use App\Services\ExternalApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExternalApiServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_activate_user_calls_the_expected_external_endpoint(): void
    {
        config()->set('external-api.url', 'http://72.60.69.185');

        Http::fake([
            'http://72.60.69.185/apiuseradd/TEST-KEY/BIOS-XYZ/BIOS-XYZ' => Http::response('"True"', 200),
        ]);

        $response = app(ExternalApiService::class)->activateUser('TEST-KEY', 'BIOS-XYZ', 'BIOS-XYZ');

        Http::assertSent(function ($request) {
            return $request->url() === 'http://72.60.69.185/apiuseradd/TEST-KEY/BIOS-XYZ/BIOS-XYZ';
        });

        $this->assertTrue($response['success']);
        $this->assertSame(200, $response['status_code']);
        $this->assertSame('"True"', $response['data']['response']);
    }

    public function test_external_api_service_handles_connection_failures_gracefully(): void
    {
        config()->set('external-api.url', 'http://72.60.69.185');

        Http::fake(function () {
            throw new ConnectionException('Timed out');
        });

        $response = app(ExternalApiService::class)->getStatus();

        $this->assertFalse($response['success']);
        $this->assertSame(503, $response['status_code']);
        $this->assertArrayHasKey('message', $response['data']);
    }
}
