<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\ResellerPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ResellerPaymentsIndexTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_parent_reseller_payments_index_returns_period_rows_without_server_error(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant);

        $this->createEarnedActivity($tenant->id, $reseller->id, 120, '2026-03-10 12:00:00', 'license.activated');

        Sanctum::actingAs($managerParent);

        $this->getJson('/api/reseller-payments?period=2026-03')
            ->assertOk()
            ->assertJsonPath('summary.period', '2026-03')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reseller_id', $reseller->id)
            ->assertJsonPath('data.0.total_sales', 120)
            ->assertJsonPath('data.0.status', 'unpaid');
    }

    public function test_manager_reseller_payments_index_returns_team_rows_without_server_error(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        $this->createEarnedActivity($tenant->id, $reseller->id, 75, '2026-03-15 09:30:00', 'license.renewed');

        Sanctum::actingAs($manager);

        $this->getJson('/api/manager/reseller-payments?period=2026-03')
            ->assertOk()
            ->assertJsonPath('summary.period', '2026-03')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reseller_id', $reseller->id)
            ->assertJsonPath('data.0.total_sales', 75)
            ->assertJsonPath('data.0.status', 'unpaid');
    }

    public function test_manager_parent_reseller_payments_index_defaults_to_all_time_balances_when_period_is_missing(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant);
        $creditReseller = $this->createUser('reseller', $tenant);

        $this->createEarnedActivity($tenant->id, $reseller->id, 120, '2026-03-10 12:00:00', 'license.activated');

        ResellerPayment::query()->create([
            'commission_id' => null,
            'reseller_id' => $reseller->id,
            'manager_id' => $managerParent->id,
            'amount' => 20,
            'payment_date' => '2026-03-20',
            'payment_method' => 'cash',
        ]);

        ResellerPayment::query()->create([
            'commission_id' => null,
            'reseller_id' => $creditReseller->id,
            'manager_id' => $managerParent->id,
            'amount' => 10,
            'payment_date' => '2026-03-21',
            'payment_method' => 'cash',
        ]);

        Sanctum::actingAs($managerParent);

        $this->getJson('/api/reseller-payments')
            ->assertOk()
            ->assertJsonPath('summary.period', 'all')
            ->assertJsonPath('summary.total_collectible', 100)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.period', 'All Time')
            ->assertJsonPath('data.0.total_sales', 120)
            ->assertJsonPath('data.0.amount_paid', 20)
            ->assertJsonPath('data.0.outstanding', 100)
            ->assertJsonPath('data.0.status', 'partial');
    }

    public function test_manager_reseller_payments_index_defaults_to_all_time_balances_when_period_is_missing(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        $this->createEarnedActivity($tenant->id, $reseller->id, 75, '2026-03-15 09:30:00', 'license.renewed');

        ResellerPayment::query()->create([
            'commission_id' => null,
            'reseller_id' => $reseller->id,
            'manager_id' => $manager->id,
            'amount' => 25,
            'payment_date' => '2026-03-21',
            'payment_method' => 'cash',
        ]);

        Sanctum::actingAs($manager);

        $this->getJson('/api/manager/reseller-payments')
            ->assertOk()
            ->assertJsonPath('summary.period', 'all')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.period', 'All Time')
            ->assertJsonPath('data.0.total_sales', 75)
            ->assertJsonPath('data.0.amount_paid', 25)
            ->assertJsonPath('data.0.outstanding', 50)
            ->assertJsonPath('data.0.status', 'partial');
    }

    public function test_manager_parent_reseller_payments_index_can_be_scoped_to_a_manager_parent_subtree(): void
    {
        $tenant = $this->createTenant();
        $managerParentA = $this->createUser('manager_parent', $tenant);
        $managerParentB = $this->createUser('manager_parent', $tenant);
        $managerA = $this->createUser('manager', $tenant, $managerParentA);
        $resellerA = $this->createUser('reseller', $tenant, $managerA);
        $resellerB = $this->createUser('reseller', $tenant, $managerParentB);

        $this->createEarnedActivity($tenant->id, $resellerA->id, 110, '2026-03-10 12:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $resellerB->id, 210, '2026-03-11 12:00:00', 'license.activated');

        Sanctum::actingAs($managerParentA);

        $this->getJson('/api/reseller-payments?manager_parent_id='.$managerParentA->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reseller_id', $resellerA->id)
            ->assertJsonPath('summary.total_owed', 110);
    }

    private function createEarnedActivity(int $tenantId, int $sellerId, float $price, string $createdAt, string $action): void
    {
        $activity = new ActivityLog([
            'tenant_id' => $tenantId,
            'user_id' => $sellerId,
            'action' => $action,
            'description' => 'Revenue event for reseller payment tests.',
            'metadata' => [
                'price' => $price,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
        ]);
        $activity->created_at = $createdAt;
        $activity->updated_at = $createdAt;
        $activity->saveQuietly();
    }
}
