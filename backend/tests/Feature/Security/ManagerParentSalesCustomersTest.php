<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ManagerParentSalesCustomersTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_parent_sales_customers_rejects_non_manager_parent_target(): void
    {
        $tenant = $this->createTenant();
        $actor = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $actor);

        Sanctum::actingAs($actor);

        $this->getJson('/api/reseller-payments/manager-parent/'.$manager->id.'/customers')
            ->assertStatus(404);
    }

    public function test_manager_parent_sales_customers_returns_only_selected_manager_parent_events(): void
    {
        $tenant = $this->createTenant();
        $actor = $this->createUser('manager_parent', $tenant);
        $managerParentA = $this->createUser('manager_parent', $tenant);
        $managerParentB = $this->createUser('manager_parent', $tenant);
        $customerA = $this->createUser('customer', $tenant, $managerParentA, ['name' => 'Customer A', 'username' => 'cust_a', 'country_name' => 'Egypt']);
        $customerB = $this->createUser('customer', $tenant, $managerParentB, ['name' => 'Customer B', 'username' => 'cust_b', 'country_name' => 'France']);
        $programA = $this->createProgram($tenant, ['name' => 'Program A']);
        $programB = $this->createProgram($tenant, ['name' => 'Program B']);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParentA->id,
            'action' => 'license.activated',
            'description' => 'A activation',
            'metadata' => [
                'license_id' => 10,
                'customer_id' => $customerA->id,
                'program_id' => $programA->id,
                'bios_id' => 'BIOS-A',
                'external_username' => 'cust_a',
                'price' => 120,
                'attribution_type' => 'earned',
                'country_name' => 'Egypt',
            ],
            'created_at' => '2026-04-01 10:00:00',
            'updated_at' => '2026-04-01 10:00:00',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParentB->id,
            'action' => 'license.renewed',
            'description' => 'B renewal',
            'metadata' => [
                'license_id' => 20,
                'customer_id' => $customerB->id,
                'program_id' => $programB->id,
                'bios_id' => 'BIOS-B',
                'external_username' => 'cust_b',
                'price' => 90,
                'attribution_type' => 'earned',
                'country_name' => 'France',
            ],
            'created_at' => '2026-04-02 10:00:00',
            'updated_at' => '2026-04-02 10:00:00',
        ]);

        Sanctum::actingAs($actor);

        $this->getJson('/api/reseller-payments/manager-parent/'.$managerParentA->id.'/customers')
            ->assertOk()
            ->assertJsonPath('summary.total_sales', 120)
            ->assertJsonPath('summary.total_events', 1)
            ->assertJsonPath('summary.total_customers', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'Customer A')
            ->assertJsonPath('data.0.program_name', 'Program A');
    }

    public function test_manager_parent_sales_customers_applies_filters(): void
    {
        $tenant = $this->createTenant();
        $actor = $this->createUser('manager_parent', $tenant);
        $managerParent = $this->createUser('manager_parent', $tenant);
        $customerA = $this->createUser('customer', $tenant, $managerParent, ['name' => 'Alpha Buyer', 'username' => 'alpha', 'country_name' => 'Egypt']);
        $customerB = $this->createUser('customer', $tenant, $managerParent, ['name' => 'Beta Buyer', 'username' => 'beta', 'country_name' => 'France']);
        $programA = $this->createProgram($tenant, ['name' => 'Program A']);
        $programB = $this->createProgram($tenant, ['name' => 'Program B']);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParent->id,
            'action' => 'license.activated',
            'description' => 'A activation',
            'metadata' => [
                'license_id' => 31,
                'customer_id' => $customerA->id,
                'program_id' => $programA->id,
                'bios_id' => 'BIOS-ALPHA',
                'external_username' => 'alpha',
                'price' => 50,
                'attribution_type' => 'earned',
                'country_name' => 'Egypt',
            ],
            'created_at' => '2026-04-05 10:00:00',
            'updated_at' => '2026-04-05 10:00:00',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParent->id,
            'action' => 'license.renewed',
            'description' => 'B renewal',
            'metadata' => [
                'license_id' => 32,
                'customer_id' => $customerB->id,
                'program_id' => $programB->id,
                'bios_id' => 'BIOS-BETA',
                'external_username' => 'beta',
                'price' => 70,
                'attribution_type' => 'earned',
                'country_name' => 'France',
            ],
            'created_at' => '2026-04-06 10:00:00',
            'updated_at' => '2026-04-06 10:00:00',
        ]);

        Sanctum::actingAs($actor);

        $this->getJson('/api/reseller-payments/manager-parent/'.$managerParent->id.'/customers?program_id='.$programA->id.'&country_name=egypt&search=alpha')
            ->assertOk()
            ->assertJsonPath('summary.total_sales', 50)
            ->assertJsonPath('summary.total_events', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.program_name', 'Program A')
            ->assertJsonPath('data.0.country_name', 'Egypt')
            ->assertJsonPath('data.0.customer_username', 'alpha');
    }

    public function test_super_admin_manager_parent_sales_customers_endpoint_is_scoped_to_target_manager_parent(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $managerParentA = $this->createUser('manager_parent', $tenant);
        $managerParentB = $this->createUser('manager_parent', $tenant);
        $customerA = $this->createUser('customer', $tenant, $managerParentA, ['name' => 'Scoped A', 'username' => 'scoped_a', 'country_name' => 'Egypt']);
        $customerB = $this->createUser('customer', $tenant, $managerParentB, ['name' => 'Scoped B', 'username' => 'scoped_b', 'country_name' => 'France']);
        $program = $this->createProgram($tenant, ['name' => 'Shared Program']);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParentA->id,
            'action' => 'license.activated',
            'description' => 'A activation',
            'metadata' => [
                'license_id' => 100,
                'customer_id' => $customerA->id,
                'program_id' => $program->id,
                'bios_id' => 'A-BIOS',
                'external_username' => 'scoped_a',
                'price' => 111,
                'attribution_type' => 'earned',
            ],
            'created_at' => '2026-04-10 10:00:00',
            'updated_at' => '2026-04-10 10:00:00',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $managerParentB->id,
            'action' => 'license.renewed',
            'description' => 'B renewal',
            'metadata' => [
                'license_id' => 101,
                'customer_id' => $customerB->id,
                'program_id' => $program->id,
                'bios_id' => 'B-BIOS',
                'external_username' => 'scoped_b',
                'price' => 222,
                'attribution_type' => 'earned',
            ],
            'created_at' => '2026-04-10 11:00:00',
            'updated_at' => '2026-04-10 11:00:00',
        ]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/super-admin/reseller-payments/manager-parent/'.$managerParentA->id.'/customers')
            ->assertOk()
            ->assertJsonPath('summary.total_sales', 111)
            ->assertJsonPath('summary.total_events', 1)
            ->assertJsonPath('summary.total_customers', 1)
            ->assertJsonPath('data.0.customer_name', 'Scoped A');
    }
}
