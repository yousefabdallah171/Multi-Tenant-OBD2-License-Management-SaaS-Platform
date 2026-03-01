<?php

namespace Tests\Unit;

use App\Services\ExternalApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ExternalApiServiceTest extends TestCase
{
    use RefreshDatabase;

    #[DataProvider('activateResponseProvider')]
    public function test_activate_user_calls_expected_endpoint_and_maps_result(string $body, bool $expectedSuccess): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apiuseradd/TEST-KEY/BIOS-XYZ/BIOS-XYZ' => Http::response($body, 200),
        ]);

        $response = app(ExternalApiService::class)->activateUser('TEST-KEY', 'BIOS-XYZ', 'BIOS-XYZ');

        Http::assertSent(function ($request) {
            return $request->url() === 'http://external-api.test/apiuseradd/TEST-KEY/BIOS-XYZ/BIOS-XYZ';
        });

        $this->assertSame($expectedSuccess, $response['success']);
        $this->assertSame(200, $response['status_code']);
        $this->assertSame(trim($body), $response['data']['response']);
    }

    public function test_external_api_service_handles_connection_failures_gracefully(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake(function () {
            throw new ConnectionException('Timed out');
        });

        $response = app(ExternalApiService::class)->getStatus();

        $this->assertFalse($response['success']);
        $this->assertSame(503, $response['status_code']);
        $this->assertArrayHasKey('message', $response['data']);
    }

    #[DataProvider('deactivateResponseProvider')]
    public function test_deactivate_user_maps_success_and_failure(string $body, bool $expectedSuccess): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apideluser/KEY-2/USER-9' => Http::response($body, 200),
        ]);

        $response = app(ExternalApiService::class)->deactivateUser('KEY-2', 'USER-9');

        Http::assertSent(fn ($request) => $request->url() === 'http://external-api.test/apideluser/KEY-2/USER-9');
        $this->assertSame($expectedSuccess, $response['success']);
        $this->assertSame(200, $response['status_code']);
    }

    #[DataProvider('activeUsersProvider')]
    public function test_get_active_users_parses_plaintext_payloads(string $body, bool $expectedSuccess, int $expectedCount): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apiusers/8' => Http::response($body, 200),
        ]);

        $response = app(ExternalApiService::class)->getActiveUsers(8);

        $this->assertSame($expectedSuccess, $response['success']);
        $this->assertSame(200, $response['status_code']);
        $this->assertCount($expectedCount, $response['data']['users']);
    }

    public function test_get_software_stats_casts_numeric_body_to_count(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/showallapi/12' => Http::response('42', 200),
        ]);

        $response = app(ExternalApiService::class)->getSoftwareStats(12);

        $this->assertTrue($response['success']);
        $this->assertSame(42, $response['data']['count']);
    }

    public function test_get_program_logs_returns_raw_text(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apilogs/7' => Http::response("log-line-1\nlog-line-2", 200),
        ]);

        $response = app(ExternalApiService::class)->getProgramLogs(7);

        $this->assertTrue($response['success']);
        $this->assertStringContainsString('log-line-1', $response['data']['raw']);
    }

    public function test_get_global_logs_returns_raw_text(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/getmylogs' => Http::response("global-log", 200),
        ]);

        $response = app(ExternalApiService::class)->getGlobalLogs();

        $this->assertTrue($response['success']);
        $this->assertSame('global-log', $response['data']['raw']);
    }

    public function test_get_status_maps_online_response(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/showallapi/8' => Http::response('17', 200),
        ]);

        $response = app(ExternalApiService::class)->getStatus();

        $this->assertSame('online', $response['data']['status']);
        $this->assertSame(200, $response['status_code']);
    }

    public function test_list_users_is_backward_compat_alias_for_get_active_users(): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apiusers/8' => Http::response("{'BIOS-1': True}", 200),
        ]);

        $response = app(ExternalApiService::class)->listUsers();

        $this->assertTrue($response['success']);
        $this->assertArrayHasKey('BIOS-1', $response['data']['users']);
    }

    #[DataProvider('checkUserProvider')]
    public function test_check_user_reports_presence_from_user_map(string $body, bool $expectedExists): void
    {
        config()->set('external-api.url', 'http://external-api.test');

        Http::fake([
            'http://external-api.test/apiusers/8' => Http::response($body, 200),
        ]);

        $response = app(ExternalApiService::class)->checkUser('BIOS-FOUND');

        $this->assertTrue($response['success']);
        $this->assertSame($expectedExists, $response['data']['exists']);
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function activateResponseProvider(): array
    {
        return [
            'true quoted' => ['"True"', true],
            'true lowercase' => ['true', true],
            'false' => ['"False"', false],
        ];
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function deactivateResponseProvider(): array
    {
        return [
            'success true' => ['True', true],
            'false body' => ['False', false],
        ];
    }

    /**
     * @return array<string, array{string, bool, int}>
     */
    public static function activeUsersProvider(): array
    {
        return [
            'python dict payload' => ["{'BIOS-1': True, 'BIOS-2': False}", true, 2],
            'json payload' => ['{"BIOS-3": true}', true, 1],
            'invalid payload' => ['not-json', false, 0],
        ];
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function checkUserProvider(): array
    {
        return [
            'found in payload' => ["{'BIOS-FOUND': True, 'BIOS-OTHER': False}", true],
            'missing in payload' => ["{'BIOS-OTHER': True}", false],
        ];
    }
}
