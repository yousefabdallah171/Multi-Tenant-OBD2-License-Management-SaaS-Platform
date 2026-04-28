<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\ResellerPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class FinancialReportAccountingTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_parent_financial_report_uses_all_time_still_not_paid_and_zero_for_non_resellers(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        $this->createEarnedActivity($tenant->id, $reseller->id, 100, '2026-01-10 10:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $reseller->id, 40, '2026-03-10 10:00:00', 'license.renewed');
        $this->createPayment($reseller->id, $managerParent->id, 30, '2026-03-20');

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/financial-reports?from=2026-03-01&to=2026-03-31')
            ->assertOk();

        $this->assertSame(40.0, (float) $response->json('data.summary.total_revenue'));

        $rows = collect($response->json('data.reseller_balances'));
        $resellerRow = $rows->firstWhere('id', $reseller->id);
        $managerRow = $rows->firstWhere('id', $manager->id);
        $parentRow = $rows->firstWhere('id', $managerParent->id);

        $this->assertNotNull($resellerRow);
        $this->assertSame(40.0, (float) $resellerRow['total_revenue']);
        $this->assertSame(110.0, (float) $resellerRow['still_not_paid']);
        $this->assertArrayNotHasKey('commission', $resellerRow);

        $this->assertNotNull($managerRow);
        $this->assertSame(0.0, (float) $managerRow['still_not_paid']);

        $this->assertNotNull($parentRow);
        $this->assertSame(0.0, (float) $parentRow['still_not_paid']);
    }

    public function test_manager_financial_report_uses_all_time_still_not_paid_and_zero_for_manager_row(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        $this->createEarnedActivity($tenant->id, $reseller->id, 100, '2026-01-10 10:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $reseller->id, 40, '2026-03-10 10:00:00', 'license.renewed');
        $this->createPayment($reseller->id, $manager->id, 30, '2026-03-20');

        Sanctum::actingAs($manager);

        $response = $this->getJson('/api/manager/reports/financial?from=2026-03-01&to=2026-03-31')
            ->assertOk();

        $this->assertSame(40.0, (float) $response->json('data.summary.total_revenue'));

        $rows = collect($response->json('data.reseller_balances'));
        $resellerRow = $rows->firstWhere('id', $reseller->id);
        $managerRow = $rows->firstWhere('id', $manager->id);

        $this->assertNotNull($resellerRow);
        $this->assertSame(40.0, (float) $resellerRow['total_revenue']);
        $this->assertSame(110.0, (float) $resellerRow['still_not_paid']);
        $this->assertArrayNotHasKey('commission', $resellerRow);

        $this->assertNotNull($managerRow);
        $this->assertSame(0.0, (float) $managerRow['still_not_paid']);
    }

    public function test_reseller_payment_status_keeps_same_all_time_outstanding_logic(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);

        $this->createEarnedActivity($tenant->id, $reseller->id, 100, '2026-01-10 10:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $reseller->id, 40, '2026-03-10 10:00:00', 'license.renewed');
        $this->createPayment($reseller->id, $manager->id, 30, '2026-03-20');

        Sanctum::actingAs($reseller);

        $response = $this->getJson('/api/reseller/payment-status')
            ->assertOk();

        $this->assertSame(140.0, (float) $response->json('data.summary.total_sales'));
        $this->assertSame(30.0, (float) $response->json('data.summary.total_paid'));
        $this->assertSame(110.0, (float) $response->json('data.summary.outstanding_balance'));
    }

    public function test_super_admin_financial_report_exposes_seller_revenue_rows_without_balance_field(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);

        $this->createEarnedActivity($tenant->id, $managerParent->id, 55, '2026-03-08 09:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $reseller->id, 75, '2026-03-09 09:00:00', 'license.renewed');

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/super-admin/financial-reports?from=2026-03-01&to=2026-03-31')
            ->assertOk();

        $rows = collect($response->json('data.reseller_balances'));
        $resellerRow = $rows->firstWhere('id', $reseller->id);

        $this->assertNotNull($resellerRow);
        $this->assertSame(75.0, (float) $resellerRow['total_revenue']);
        $this->assertArrayNotHasKey('balance', $resellerRow);
    }

    public function test_manager_parent_financial_report_can_be_scoped_to_a_manager_subtree(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $managerA = $this->createUser('manager', $tenant, $managerParent);
        $managerB = $this->createUser('manager', $tenant, $managerParent);
        $resellerA = $this->createUser('reseller', $tenant, $managerA);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        $this->createEarnedActivity($tenant->id, $managerA->id, 15, '2026-03-05 10:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $resellerA->id, 40, '2026-03-06 10:00:00', 'license.renewed');
        $this->createEarnedActivity($tenant->id, $managerB->id, 20, '2026-03-07 10:00:00', 'license.activated');
        $this->createEarnedActivity($tenant->id, $resellerB->id, 80, '2026-03-08 10:00:00', 'license.renewed');

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/financial-reports?from=2026-03-01&to=2026-03-31&manager_id='.$managerA->id)
            ->assertOk();

        $this->assertSame(55.0, (float) $response->json('data.summary.total_revenue'));

        $rows = collect($response->json('data.reseller_balances'));

        $this->assertCount(2, $rows);
        $this->assertNotNull($rows->firstWhere('id', $managerA->id));
        $this->assertNotNull($rows->firstWhere('id', $resellerA->id));
        $this->assertNull($rows->firstWhere('id', $managerB->id));
        $this->assertNull($rows->firstWhere('id', $resellerB->id));
    }

    public function test_revenue_widgets_ignore_malformed_activity_log_metadata_instead_of_throwing(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);

        $this->createEarnedActivity($tenant->id, $reseller->id, 85, '2026-04-10 10:00:00', 'license.activated');

        DB::table('activity_logs')->insert([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.activated',
            'description' => 'Legacy malformed activity metadata.',
            'metadata' => '{bad-json',
            'ip_address' => '127.0.0.1',
            'created_at' => '2026-04-10 11:00:00',
            'updated_at' => '2026-04-10 11:00:00',
        ]);

        Sanctum::actingAs($reseller);

        $summary = $this->getJson('/api/reseller/reports/summary?from=2025-04-12&to=2026-04-11&period=monthly')
            ->assertOk();

        $this->assertSame(85.0, (float) $summary->json('data.total_revenue'));

        Sanctum::actingAs($superAdmin);

        $comparison = $this->getJson('/api/super-admin/dashboard/tenant-comparison')
            ->assertOk();

        $tenantRow = collect($comparison->json('data'))->firstWhere('id', $tenant->id);

        $this->assertNotNull($tenantRow);
        $this->assertSame(85.0, (float) $tenantRow['revenue']);
    }

    private function createEarnedActivity(int $tenantId, int $sellerId, float $price, string $createdAt, string $action): void
    {
        $activity = new ActivityLog([
            'tenant_id' => $tenantId,
            'user_id' => $sellerId,
            'action' => $action,
            'description' => 'Revenue event for report tests.',
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

    private function createPayment(int $resellerId, int $managerId, float $amount, string $paymentDate): void
    {
        ResellerPayment::query()->create([
            'commission_id' => null,
            'reseller_id' => $resellerId,
            'manager_id' => $managerId,
            'amount' => $amount,
            'payment_date' => $paymentDate,
            'payment_method' => 'cash',
        ]);
    }
}
