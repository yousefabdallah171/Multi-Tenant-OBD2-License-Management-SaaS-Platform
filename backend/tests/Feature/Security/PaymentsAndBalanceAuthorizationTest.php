<?php

namespace Tests\Feature\Security;

use App\Models\ResellerCommission;
use App\Models\ResellerPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class PaymentsAndBalanceAuthorizationTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_cannot_view_reseller_payment_history_for_another_manager_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        $commission = ResellerCommission::query()->create([
            'tenant_id' => $tenant->id,
            'reseller_id' => $resellerB->id,
            'manager_id' => $managerB->id,
            'period' => '2026-03',
            'total_sales' => 100,
            'commission_rate' => 10,
            'commission_owed' => 10,
            'amount_paid' => 0,
            'outstanding' => 10,
            'status' => 'unpaid',
        ]);

        ResellerPayment::query()->create([
            'commission_id' => $commission->id,
            'reseller_id' => $resellerB->id,
            'manager_id' => $managerB->id,
            'amount' => 5,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
        ]);

        Sanctum::actingAs($managerA);

        $this->getJson('/api/manager/reseller-payments/'.$resellerB->id)
            ->assertNotFound();
    }

    public function test_manager_cannot_record_payment_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/manager/reseller-payments', [
            'reseller_id' => $resellerB->id,
            'amount' => 5,
            'payment_method' => 'cash',
        ])
            ->assertNotFound();
    }

    public function test_manager_cannot_adjust_balances(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        Sanctum::actingAs($manager);

        $this->postJson('/api/balances/'.$reseller->id.'/adjust', [
            'amount' => 25,
        ])
            ->assertForbidden();
    }

    public function test_manager_parent_cannot_adjust_balance_across_tenant_boundary(): void
    {
        $tenantA = $this->createTenant();
        $tenantB = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenantA);
        $foreignReseller = $this->createUser('reseller', $tenantB);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/balances/'.$foreignReseller->id.'/adjust', [
            'amount' => 25,
        ])
            ->assertForbidden();
    }
}
