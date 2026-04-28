<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class ResellerReportRevenueEndpointTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_reseller_revenue_endpoint_returns_grouped_monthly_revenue_without_server_error(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);

        $this->createEarnedActivity($tenant->id, $reseller->id, 85, '2026-04-10 10:00:00');
        $this->createEarnedActivity($tenant->id, $reseller->id, 60, '2026-04-15 10:00:00', 'license.renewed');

        Sanctum::actingAs($reseller);

        $response = $this->getJson('/api/reseller/reports/revenue?from=2025-04-20&to=2026-04-19&period=monthly')
            ->assertOk();

        $rows = collect($response->json('data'));
        $april = $rows->firstWhere('period', '2026-04');

        $this->assertNotNull($april);
        $this->assertSame(145.0, (float) $april['revenue']);
    }

    private function createEarnedActivity(int $tenantId, int $sellerId, float $price, string $createdAt, string $action = 'license.activated'): void
    {
        $activity = new ActivityLog([
            'tenant_id' => $tenantId,
            'user_id' => $sellerId,
            'action' => $action,
            'description' => 'Revenue event for reseller report endpoint.',
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
