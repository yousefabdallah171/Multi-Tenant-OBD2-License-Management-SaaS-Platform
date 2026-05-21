<?php

namespace Tests\Feature\Security;

use App\Models\License;
use App\Services\ExternalApiService;
use App\Services\LicenseExpiryService;
use App\Services\MandiagApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class LicensePauseResumeExpiryTest extends TestCase
{
    use BuildsSecurityFixtures;
    use MockeryPHPUnitIntegration;
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_pause_keeps_original_expiry_and_stores_remaining_time_for_audit_only(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-21 10:00:00'));

        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);
        $license = $this->createLicense($reseller, $program, attributes: [
            'status' => 'active',
            'activated_at' => Carbon::parse('2026-05-21 09:00:00'),
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
        ]);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldReceive('deactivateUser')
            ->with('test-api-key', (string) $license->external_username, $program->external_api_base_url)
            ->andReturn(['success' => true, 'data' => ['response' => 'paused'], 'status_code' => 200])
            ->once();
        $this->app->instance(ExternalApiService::class, $external);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/licenses/'.$license->id.'/pause', [
            'pause_reason' => 'Customer requested pause',
        ])->assertOk();

        $license->refresh();

        $this->assertSame('pending', $license->status);
        $this->assertSame('2026-05-22 06:00:00', $license->expires_at?->format('Y-m-d H:i:s'));
        $this->assertSame(1200, (int) $license->pause_remaining_minutes);
        $this->assertSame('Customer requested pause', $license->pause_reason);
    }

    public function test_resume_before_original_expiry_does_not_extend_expiry(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-21 20:00:00'));

        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);
        $license = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'activated_at' => Carbon::parse('2026-05-21 09:00:00'),
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'paused_at' => Carbon::parse('2026-05-21 10:00:00'),
            'pause_remaining_minutes' => 1200,
            'pause_reason' => 'Pause before travel',
        ]);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldReceive('activateUser')
            ->with('test-api-key', (string) $license->external_username, (string) $license->bios_id, $program->external_api_base_url)
            ->andReturn(['success' => true, 'data' => ['response' => 'resumed'], 'status_code' => 200])
            ->once();
        $this->app->instance(ExternalApiService::class, $external);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/licenses/'.$license->id.'/resume')->assertOk();

        $license->refresh();

        $this->assertSame('active', $license->status);
        $this->assertSame('2026-05-22 06:00:00', $license->expires_at?->format('Y-m-d H:i:s'));
        $this->assertNull($license->paused_at);
        $this->assertNull($license->pause_remaining_minutes);
    }

    public function test_resume_after_original_expiry_is_blocked_before_external_activation(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-22 06:30:00'));

        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);
        $license = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'activated_at' => Carbon::parse('2026-05-21 09:00:00'),
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'paused_at' => Carbon::parse('2026-05-21 10:00:00'),
            'pause_remaining_minutes' => 1200,
        ]);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldNotReceive('activateUser');
        $this->app->instance(ExternalApiService::class, $external);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/licenses/'.$license->id.'/resume')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('license');

        $license->refresh();

        $this->assertSame('expired', $license->status);
        $this->assertSame('2026-05-22 06:00:00', $license->expires_at?->format('Y-m-d H:i:s'));
        $this->assertNull($license->paused_at);
        $this->assertNull($license->pause_remaining_minutes);
    }

    public function test_mandiag_resume_sets_external_expiration_to_original_expiry(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-21 20:00:00'));

        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant, [
            'api_type' => 'mandiag',
            'mandiag_software_key' => 'diag',
        ]);
        $license = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'activated_at' => Carbon::parse('2026-05-21 09:00:00'),
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'paused_at' => Carbon::parse('2026-05-21 10:00:00'),
            'pause_remaining_minutes' => 1200,
            'mandiag_license_id' => 12345,
        ]);

        $mandiag = Mockery::mock(MandiagApiService::class);
        $mandiag->shouldReceive('enableLicense')
            ->with(12345)
            ->andReturn(['success' => true, 'data' => ['response' => 'enabled'], 'status_code' => 200])
            ->once();
        $mandiag->shouldReceive('setExpiration')
            ->with(12345, '2026-05-22 06:00:00')
            ->andReturn(['success' => true, 'data' => [], 'status_code' => 200])
            ->once();
        $this->app->instance(MandiagApiService::class, $mandiag);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/licenses/'.$license->id.'/resume')->assertOk();

        $license->refresh();

        $this->assertSame('active', $license->status);
        $this->assertSame('2026-05-22 06:00:00', $license->expires_at?->format('Y-m-d H:i:s'));
    }

    public function test_expiry_service_expires_paused_pending_licenses_without_touching_plain_or_scheduled_pending(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-22 06:30:00'));

        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);

        $pausedExpired = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'paused_at' => Carbon::parse('2026-05-21 10:00:00'),
            'pause_remaining_minutes' => 1200,
        ]);
        $plainPending = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'paused_at' => null,
            'pause_remaining_minutes' => null,
        ]);
        $scheduledPending = $this->createLicense($reseller, $program, attributes: [
            'status' => 'pending',
            'expires_at' => Carbon::parse('2026-05-22 06:00:00'),
            'is_scheduled' => true,
            'scheduled_at' => Carbon::parse('2026-05-23 06:00:00'),
        ]);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldNotReceive('deactivateUser');
        $this->app->instance(ExternalApiService::class, $external);

        $processed = $this->app->make(LicenseExpiryService::class)->expireDue(null, true);

        $this->assertSame(1, $processed);
        $this->assertSame('expired', $pausedExpired->refresh()->status);
        $this->assertNull($pausedExpired->paused_at);
        $this->assertSame('pending', $plainPending->refresh()->status);
        $this->assertSame('pending', $scheduledPending->refresh()->status);
    }
}
