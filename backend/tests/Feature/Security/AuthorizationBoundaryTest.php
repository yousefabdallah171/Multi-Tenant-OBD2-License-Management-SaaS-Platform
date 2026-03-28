<?php

namespace Tests\Feature\Security;

use App\Models\ProgramDurationPreset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class AuthorizationBoundaryTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_cannot_view_license_owned_by_another_manager_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);
        $license = $this->createLicense($resellerB);

        Sanctum::actingAs($managerA);

        $this->getJson('/api/licenses/'.$license->id)
            ->assertNotFound();
    }

    public function test_manager_cannot_activate_license_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);
        $program = $this->createProgram($tenant);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'seller_id' => $resellerB->id,
            'customer_name' => 'Escalation Attempt',
            'bios_id' => 'TEAMLOCK1',
            'duration_days' => 30,
            'price' => 25,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seller_id');
    }

    public function test_reseller_cannot_activate_license_for_another_reseller(): void
    {
        $tenant = $this->createTenant();
        $resellerA = $this->createUser('reseller', $tenant);
        $resellerB = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);
        $preset = ProgramDurationPreset::query()->create([
            'program_id' => $program->id,
            'label' => '30 Days',
            'duration_days' => 30,
            'price' => 10,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        Sanctum::actingAs($resellerA);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'seller_id' => $resellerB->id,
            'customer_name' => 'Wrong Reseller',
            'bios_id' => 'TEAMLOCK2',
            'preset_id' => $preset->id,
            'duration_days' => 30,
            'price' => 10,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seller_id');
    }

    public function test_manager_cannot_reset_password_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/manager/username-management/'.$resellerB->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertNotFound();
    }

    public function test_manager_cannot_unlock_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB, ['username_locked' => true]);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/manager/username-management/'.$resellerB->id.'/unlock', [
            'reason' => 'test',
        ])->assertNotFound();
    }

    public function test_manager_cannot_change_username_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        Sanctum::actingAs($managerA);

        $this->putJson('/api/manager/username-management/'.$resellerB->id.'/username', [
            'username' => 'blocked-manager-change',
            'reason' => 'test',
        ])->assertNotFound();
    }

    public function test_reseller_cannot_access_manager_username_management_route(): void
    {
        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $customer = $this->createUser('customer', $tenant, $reseller);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/manager/username-management/'.$customer->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertForbidden();
    }
}
