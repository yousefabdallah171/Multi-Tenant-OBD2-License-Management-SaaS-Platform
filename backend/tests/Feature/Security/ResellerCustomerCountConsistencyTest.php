<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ResellerCustomerCountConsistencyTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_dashboard_and_report_total_customers_match_reseller_customer_list_including_expired_history(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);
        $program = $this->createProgram($tenant, ['name' => 'GM Techline Connect']);

        $activeCustomer = $this->createUser('customer', $tenant, $reseller, [
            'name' => 'ELI1DATA1',
            'username' => 'ELI1DATA1',
        ]);
        $expiredCustomer = $this->createUser('customer', $tenant, $reseller, [
            'name' => 'ELI1DATA2',
            'username' => 'ELI1DATA2',
        ]);

        $this->createLicense($reseller, $program, $activeCustomer, [
            'bios_id' => '5CD1213LZD',
            'price' => 0,
            'duration_days' => 215,
            'activated_at' => now()->subDays(2),
            'expires_at' => now()->addDays(215),
            'status' => 'active',
        ]);

        $this->createLicense($reseller, $program, $expiredCustomer, [
            'bios_id' => '4N4BBG2',
            'price' => 85,
            'duration_days' => 1,
            'activated_at' => now()->subDays(10),
            'expires_at' => now()->subDays(1),
            'status' => 'expired',
        ]);

        Sanctum::actingAs($reseller);

        $customerList = $this->getJson('/api/reseller/customers')
            ->assertOk();

        $dashboard = $this->getJson('/api/reseller/dashboard/stats')
            ->assertOk();

        $summary = $this->getJson('/api/reseller/reports/summary')
            ->assertOk();

        $this->assertSame(2, (int) $customerList->json('meta.total'));
        $this->assertSame(2, (int) $dashboard->json('stats.customers'));
        $this->assertSame(2, (int) $summary->json('data.total_customers'));
        $this->assertSame(1, (int) $dashboard->json('stats.active_licenses'));
        $this->assertSame(1, (int) $summary->json('data.active_customers'));
    }
}
