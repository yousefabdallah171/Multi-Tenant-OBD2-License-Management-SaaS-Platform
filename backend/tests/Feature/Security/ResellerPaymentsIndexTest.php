<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
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

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.activated',
            'description' => 'Activated a license.',
            'metadata' => [
                'price' => 120,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
            'created_at' => '2026-03-10 12:00:00',
            'updated_at' => '2026-03-10 12:00:00',
        ]);

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

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.renewed',
            'description' => 'Renewed a license.',
            'metadata' => [
                'price' => 75,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
            'created_at' => '2026-03-15 09:30:00',
            'updated_at' => '2026-03-15 09:30:00',
        ]);

        Sanctum::actingAs($manager);

        $this->getJson('/api/manager/reseller-payments?period=2026-03')
            ->assertOk()
            ->assertJsonPath('summary.period', '2026-03')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reseller_id', $reseller->id)
            ->assertJsonPath('data.0.total_sales', 75)
            ->assertJsonPath('data.0.status', 'unpaid');
    }
}
