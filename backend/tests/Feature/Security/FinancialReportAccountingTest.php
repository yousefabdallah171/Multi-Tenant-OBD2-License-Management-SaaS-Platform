<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\ResellerPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            ->assertOk()
            ->assertJsonPath('data.summary.total_revenue', 40.0);

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
            ->assertOk()
            ->assertJsonPath('data.summary.total_revenue', 40.0);

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

        $this->getJson('/api/reseller/payment-status')
            ->assertOk()
            ->assertJsonPath('data.summary.total_sales', 140.0)
            ->assertJsonPath('data.summary.total_paid', 30.0)
            ->assertJsonPath('data.summary.outstanding_balance', 110.0);
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

    private function createEarnedActivity(int $tenantId, int $sellerId, float $price, string $createdAt, string $action): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $sellerId,
            'action' => $action,
            'description' => 'Revenue event for report tests.',
            'metadata' => [
                'price' => $price,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
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
