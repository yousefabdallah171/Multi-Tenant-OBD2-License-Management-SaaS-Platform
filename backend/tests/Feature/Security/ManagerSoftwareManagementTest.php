<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ManagerSoftwareManagementTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_software_routes_are_removed(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);

        Sanctum::actingAs($manager);

        $this->getJson('/api/manager/software?per_page=12')
            ->assertNotFound();

        $this->postJson('/api/manager/software', [])
            ->assertNotFound();

        $this->putJson('/api/manager/software/1', [])
            ->assertNotFound();

        $this->deleteJson('/api/manager/software/1')
            ->assertNotFound();

        $this->postJson('/api/manager/software/1/activate', [])
            ->assertNotFound();
    }
}
