<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SqlInjectionAndAuthSecurityTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_check_bios_sql_like_payload_does_not_match_existing_license(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);
        $this->createLicense($reseller, null, null, [
            'bios_id' => 'SAFEBIOS1',
        ]);

        Sanctum::actingAs($managerParent);

        $this->getJson('/api/check-bios?bios_id=%27%20OR%201%3D1%20--')
            ->assertOk()
            ->assertJson([
                'available' => true,
                'is_blacklisted' => false,
            ]);
    }

    public function test_customer_login_is_silently_denied(): void
    {
        $tenant = $this->createTenant();
        $customer = $this->createUser('customer', $tenant, null, [
            'email' => 'customer@example.test',
            'password' => 'password',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $customer->email,
            'password' => 'password',
        ])
            ->assertUnauthorized()
            ->assertJson([
                'message' => 'Invalid credentials.',
            ]);
    }

    public function test_password_reset_can_revoke_existing_tokens(): void
    {
        $superAdmin = $this->createUser('super_admin', null, null, [
            'email' => 'root@example.test',
        ]);
        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);

        $reseller->createToken('first');
        $reseller->createToken('second');

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/super-admin/username-management/'.$reseller->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertOk()
            ->assertJsonStructure(['temporary_password']);

        $this->assertSame(0, $reseller->fresh()->tokens()->count());
    }
}
