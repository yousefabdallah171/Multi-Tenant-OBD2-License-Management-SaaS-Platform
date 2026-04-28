<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class OnlineUsersVisibilityTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_super_admin_online_users_show_full_names_for_visible_users(): void
    {
        $superAdmin = $this->createUser('super_admin', null, null, ['name' => 'Platform Owner', 'last_seen_at' => now()]);
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant, null, ['name' => 'Farouk', 'last_seen_at' => now()->subMinute()]);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/super-admin/online-users')
            ->assertOk();

        $entry = collect($response->json('data'))->firstWhere('id', $managerParent->id);

        $this->assertNotNull($entry);
        $this->assertSame('Farouk', $entry['display_name']);
        $this->assertSame('Farouk', $entry['full_name']);
        $this->assertSame('F****k', $entry['masked_name']);

        $selfEntry = collect($response->json('data'))->firstWhere('id', $superAdmin->id);
        $this->assertNotNull($selfEntry);
        $this->assertTrue((bool) $selfEntry['is_self']);
        $this->assertSame('You', $selfEntry['display_name']);
        $this->assertSame('Platform Owner', $selfEntry['full_name']);
    }

    public function test_manager_parent_online_users_show_full_names_for_tenant_scoped_rows(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant, null, ['name' => 'Tenant Parent', 'last_seen_at' => now()]);
        $manager = $this->createUser('manager', $tenant, $managerParent, ['name' => 'Main Manager', 'last_seen_at' => now()->subMinute()]);
        $reseller = $this->createUser('reseller', $tenant, $manager, ['name' => 'Farouk', 'last_seen_at' => now()->subMinutes(2)]);
        $otherParent = $this->createUser('manager_parent', $tenant, null, ['name' => 'Other Parent', 'last_seen_at' => now()->subMinute()]);

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/online-users')
            ->assertOk();

        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertTrue((bool) $rows[$managerParent->id]['is_self']);
        $this->assertSame('You', $rows[$managerParent->id]['display_name']);
        $this->assertSame('Tenant Parent', $rows[$managerParent->id]['full_name']);
        $this->assertSame('Other Parent', $rows[$otherParent->id]['display_name']);
        $this->assertSame('Other Parent', $rows[$otherParent->id]['full_name']);
        $this->assertSame('Main Manager', $rows[$manager->id]['display_name']);
        $this->assertSame('Main Manager', $rows[$manager->id]['full_name']);
        $this->assertSame('Farouk', $rows[$reseller->id]['display_name']);
        $this->assertSame('Farouk', $rows[$reseller->id]['full_name']);
    }

    public function test_manager_online_users_keep_masking_for_non_self_users(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent, ['name' => 'Main Manager', 'last_seen_at' => now()]);
        $reseller = $this->createUser('reseller', $tenant, $manager, ['name' => 'Farouk', 'last_seen_at' => now()->subMinute()]);

        Sanctum::actingAs($manager);

        $response = $this->getJson('/api/manager/online-users')
            ->assertOk();

        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertSame('F****k', $rows[$reseller->id]['display_name']);
        $this->assertNull($rows[$reseller->id]['full_name']);
        $this->assertTrue((bool) $rows[$manager->id]['is_self']);
        $this->assertSame('You', $rows[$manager->id]['display_name']);
        $this->assertSame('Main Manager', $rows[$manager->id]['full_name']);
    }

    public function test_reseller_online_users_keep_masking_for_non_self_users(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent, ['name' => 'Main Manager', 'last_seen_at' => now()]);
        $reseller = $this->createUser('reseller', $tenant, $manager, ['name' => 'Farouk', 'last_seen_at' => now()]);

        Sanctum::actingAs($reseller);

        $response = $this->getJson('/api/reseller/online-users')
            ->assertOk();

        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertSame('M**********r', $rows[$manager->id]['display_name']);
        $this->assertNull($rows[$manager->id]['full_name']);
        $this->assertTrue((bool) $rows[$reseller->id]['is_self']);
        $this->assertSame('You', $rows[$reseller->id]['display_name']);
        $this->assertSame('Farouk', $rows[$reseller->id]['full_name']);
    }
}
