<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\UserUsernameHistory;
use App\Services\ExternalApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SuperAdminCustomerUsernameRenameTest extends TestCase
{
    use BuildsSecurityFixtures;
    use MockeryPHPUnitIntegration;
    use RefreshDatabase;

    public function test_super_admin_can_rename_active_customer_username_and_updates_all_references(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $program = $this->createProgram($tenant, [
            'external_software_id' => 10,
            'has_external_api' => true,
        ]);

        $customer = $this->createUser('customer', $tenant, $reseller, [
            'username' => 'old_user',
            'username_locked' => true,
        ]);

        $license = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'BIOS-RENAME-001',
            'status' => 'active',
            'external_username' => 'old_user',
        ]);

        BiosUsernameLink::query()->create([
            'tenant_id' => $tenant->id,
            'bios_id' => strtolower((string) $license->bios_id),
            'username' => 'old_user',
        ]);

        $superAdmin = $this->createUser('super_admin', null);
        Sanctum::actingAs($superAdmin);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldReceive('getActiveUsers')
            ->with(10, Mockery::any())
            ->andReturn(['success' => true, 'data' => ['users' => []], 'status_code' => 200])
            ->once();
        $external->shouldReceive('deactivateUser')
            ->with('test-api-key', 'old_user', Mockery::any())
            ->andReturn(['success' => true, 'data' => ['response' => 'true'], 'status_code' => 200])
            ->once();
        $external->shouldReceive('activateUser')
            ->with('test-api-key', 'new_user', (string) $license->bios_id, Mockery::any())
            ->andReturn(['success' => true, 'data' => ['response' => 'true'], 'status_code' => 200])
            ->once();
        $this->app->instance(ExternalApiService::class, $external);

        $this->putJson('/api/super-admin/customers/'.$customer->id.'/username', [
            'username' => 'New User',
            'reason' => 'fix typo',
        ])
            ->assertOk()
            ->assertJsonPath('data.username', 'new_user');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'tenant_id' => $tenant->id,
            'username' => 'new_user',
            'username_locked' => 1,
        ]);

        $this->assertDatabaseHas('user_username_history', [
            'tenant_id' => $tenant->id,
            'user_id' => $customer->id,
            'old_username' => 'old_user',
            'new_username' => 'new_user',
        ]);

        $this->assertDatabaseHas('licenses', [
            'id' => $license->id,
            'tenant_id' => $tenant->id,
            'external_username' => 'new_user',
        ]);

        $this->assertDatabaseHas('bios_username_links', [
            'tenant_id' => $tenant->id,
            'bios_id' => strtolower((string) $license->bios_id),
            'username' => 'new_user',
        ]);

        $activity = ActivityLog::query()
            ->where('action', 'username.change')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame((int) $tenant->id, (int) $activity->tenant_id);
        $this->assertSame((int) $superAdmin->id, (int) $activity->user_id);
        $this->assertSame((int) $customer->id, (int) ($activity->metadata['target_user_id'] ?? 0));
        $this->assertSame('old_user', (string) ($activity->metadata['old_username'] ?? ''));
        $this->assertSame('new_user', (string) ($activity->metadata['new_username'] ?? ''));
    }

    public function test_rename_hard_fails_and_does_not_change_db_when_external_activate_fails(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $program = $this->createProgram($tenant, [
            'external_software_id' => 11,
            'has_external_api' => true,
        ]);

        $customer = $this->createUser('customer', $tenant, $reseller, [
            'username' => 'old_user2',
            'username_locked' => true,
        ]);

        $license = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'BIOS-RENAME-002',
            'status' => 'active',
            'external_username' => 'old_user2',
        ]);

        BiosUsernameLink::query()->create([
            'tenant_id' => $tenant->id,
            'bios_id' => strtolower((string) $license->bios_id),
            'username' => 'old_user2',
        ]);

        $superAdmin = $this->createUser('super_admin', null);
        Sanctum::actingAs($superAdmin);

        $external = Mockery::mock(ExternalApiService::class);
        $external->shouldReceive('getActiveUsers')
            ->with(11, Mockery::any())
            ->andReturn(['success' => true, 'data' => ['users' => []], 'status_code' => 200])
            ->once();
        $external->shouldReceive('deactivateUser')
            ->with('test-api-key', 'old_user2', Mockery::any())
            ->andReturn(['success' => true, 'data' => ['response' => 'true'], 'status_code' => 200])
            ->once();
        $external->shouldReceive('activateUser')
            ->with('test-api-key', 'new_user2', (string) $license->bios_id, Mockery::any())
            ->andReturn(['success' => false, 'data' => ['response' => 'false'], 'status_code' => 503])
            ->once();
        $external->shouldReceive('activateUser')
            ->with('test-api-key', 'old_user2', (string) $license->bios_id, Mockery::any())
            ->andReturn(['success' => true, 'data' => ['response' => 'true'], 'status_code' => 200])
            ->once();
        $this->app->instance(ExternalApiService::class, $external);

        $this->putJson('/api/super-admin/customers/'.$customer->id.'/username', [
            'username' => 'new_user2',
            'reason' => 'should fail',
        ])
            ->assertStatus(422);

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'tenant_id' => $tenant->id,
            'username' => 'old_user2',
        ]);

        $this->assertDatabaseMissing('user_username_history', [
            'tenant_id' => $tenant->id,
            'user_id' => $customer->id,
            'old_username' => 'old_user2',
        ]);

        $this->assertDatabaseHas('licenses', [
            'id' => $license->id,
            'external_username' => 'old_user2',
        ]);

        $this->assertDatabaseHas('bios_username_links', [
            'tenant_id' => $tenant->id,
            'bios_id' => strtolower((string) $license->bios_id),
            'username' => 'old_user2',
        ]);

        $this->assertNull(ActivityLog::query()->where('action', 'username.change')->first());
        $this->assertNull(UserUsernameHistory::query()->where('user_id', $customer->id)->first());
    }
}
