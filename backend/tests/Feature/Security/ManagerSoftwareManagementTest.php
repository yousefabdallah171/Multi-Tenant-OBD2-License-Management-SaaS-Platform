<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ManagerSoftwareManagementTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_software_index_returns_programs_for_team_without_type_error(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $teamReseller = $this->createUser('reseller', $tenant, $manager);
        $outsideReseller = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant, ['name' => 'Manager Scoped Program']);

        $this->createLicense($teamReseller, $program, null, ['status' => 'active', 'price' => 75]);
        $this->createLicense($outsideReseller, $program, null, ['status' => 'active', 'price' => 90]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $teamReseller->id,
            'action' => 'license.activated',
            'description' => 'Team reseller activation.',
            'metadata' => [
                'program_id' => $program->id,
                'price' => 75,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $outsideReseller->id,
            'action' => 'license.activated',
            'description' => 'Outside reseller activation.',
            'metadata' => [
                'program_id' => $program->id,
                'price' => 90,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
        ]);

        Sanctum::actingAs($manager);

        $this->getJson('/api/manager/software?per_page=12')
            ->assertOk()
            ->assertJsonPath('data.0.id', $program->id)
            ->assertJsonPath('data.0.licenses_sold', 1)
            ->assertJsonPath('data.0.revenue', 75.0);
    }
}
