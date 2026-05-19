<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\TransactionEdit;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SuperAdminTransactionEditFlowTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_super_admin_edits_the_selected_historical_transaction_only_and_reports_follow_that_row(): void
    {
        [$superAdmin, $tenant, $reseller, $license, $olderLog, $latestLog] = $this->seedDuplicateTransactionLicense([
            'old_price' => 250,
            'latest_price' => 150,
        ]);

        Sanctum::actingAs($superAdmin);

        $initialRevenue = (float) $this->getJson('/api/super-admin/financial-reports')
            ->assertOk()
            ->json('data.summary.total_platform_revenue');
        $this->assertSame(400.0, $initialRevenue);

        $this->patchJson('/api/super-admin/transactions/activity-logs/'.$olderLog->id, [
            'price' => 0,
        ])->assertOk()
            ->assertJsonPath('data.activity_log_id', $olderLog->id)
            ->assertJsonPath('affected.activity_logs_updated', 1)
            ->assertJsonPath('affected.licenses_updated', 0);

        $olderLog->refresh();
        $latestLog->refresh();
        $license->refresh();

        $this->assertSame(0.0, round((float) data_get($olderLog->metadata, 'price'), 2));
        $this->assertSame(150.0, round((float) data_get($latestLog->metadata, 'price'), 2));
        $this->assertSame(150.0, round((float) $license->price, 2));

        $this->assertDatabaseHas('transaction_edits', [
            'license_id' => $license->id,
            'activity_log_id' => $olderLog->id,
            'action' => 'edit',
        ]);

        $updatedRevenue = (float) $this->getJson('/api/super-admin/financial-reports')
            ->assertOk()
            ->json('data.summary.total_platform_revenue');
        $this->assertSame(150.0, $updatedRevenue);

        $rows = $this->getJson('/api/super-admin/reseller-payments/reseller/'.$reseller->id.'/customers')
            ->assertOk()
            ->json('data');

        $activityLogIds = collect($rows)->pluck('activity_log_id')->all();
        $this->assertSame([$latestLog->id], $activityLogIds);
    }

    public function test_super_admin_editing_latest_transaction_updates_license_price_only_for_that_latest_row(): void
    {
        [$superAdmin, , , $license, $olderLog, $latestLog] = $this->seedDuplicateTransactionLicense([
            'old_price' => 150,
            'latest_price' => 11,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->patchJson('/api/super-admin/transactions/activity-logs/'.$latestLog->id, [
            'price' => 5,
        ])->assertOk()
            ->assertJsonPath('data.activity_log_id', $latestLog->id)
            ->assertJsonPath('affected.licenses_updated', 1);

        $olderLog->refresh();
        $latestLog->refresh();
        $license->refresh();

        $this->assertSame(150.0, round((float) data_get($olderLog->metadata, 'price'), 2));
        $this->assertSame(5.0, round((float) data_get($latestLog->metadata, 'price'), 2));
        $this->assertSame(5.0, round((float) $license->price, 2));
    }

    public function test_transaction_edit_history_only_records_real_changed_fields_and_rejects_same_effective_price(): void
    {
        [$superAdmin, , , $license, $olderLog] = $this->seedDuplicateTransactionLicense([
            'old_price' => 250,
            'latest_price' => 150,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->patchJson('/api/super-admin/transactions/activity-logs/'.$olderLog->id, [
            'price' => 250.00,
        ])->assertStatus(422);

        $this->assertSame(0, TransactionEdit::query()->count());

        $this->patchJson('/api/super-admin/transactions/activity-logs/'.$olderLog->id, [
            'price' => 90,
        ])->assertOk();

        $edit = TransactionEdit::query()->latest('id')->firstOrFail();
        $this->assertSame($olderLog->id, (int) $edit->activity_log_id);
        $this->assertSame(250.0, (float) ($edit->previous_values['price'] ?? 0));
        $this->assertSame(90.0, (float) ($edit->new_values['price'] ?? 0));
        $this->assertSame((int) $license->customer_id, (int) ($edit->new_values['customer_id'] ?? 0));
        $this->assertSame((int) $license->program_id, (int) ($edit->new_values['program_id'] ?? 0));

        $history = $this->getJson('/api/super-admin/transactions/activity-logs/'.$olderLog->id.'/history')
            ->assertOk()
            ->json('data.0.diffs');

        $this->assertArrayHasKey('price', $history);
        $this->assertArrayNotHasKey('customer_id', $history);
        $this->assertArrayNotHasKey('program_id', $history);
        $this->assertArrayNotHasKey('duration_days', $history);
        $this->assertArrayNotHasKey('activated_at', $history);
    }

    /**
     * @return array{0: \App\Models\User, 1: \App\Models\Tenant, 2: \App\Models\User, 3: License, 4: ActivityLog, 5: ActivityLog}
     */
    private function seedDuplicateTransactionLicense(array $prices): array
    {
        $superAdmin = $this->createUser('super_admin');
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent, ['name' => 'Ali Seller']);
        $customer = $this->createUser('customer', $tenant, $reseller, [
            'name' => 'IRAQ Customer',
            'username' => 'IRAQ185',
            'country_name' => 'Iraq',
        ]);
        $program = $this->createProgram($tenant, ['name' => 'GM Techline Connect']);

        $license = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'TXEDIT-1',
            'price' => $prices['latest_price'],
            'duration_days' => 30,
            'activated_at' => CarbonImmutable::parse('2026-05-04 05:19:00'),
            'expires_at' => CarbonImmutable::parse('2026-06-03 05:19:00'),
            'status' => 'active',
        ]);

        $olderLog = $this->createRevenueActivity(
            $tenant->id,
            $reseller->id,
            $license->id,
            $customer->id,
            $program->id,
            $license->bios_id,
            (float) $prices['old_price'],
            '2026-04-19 06:56:38'
        );

        $latestLog = $this->createRevenueActivity(
            $tenant->id,
            $reseller->id,
            $license->id,
            $customer->id,
            $program->id,
            $license->bios_id,
            (float) $prices['latest_price'],
            '2026-05-04 05:19:06'
        );

        return [$superAdmin, $tenant, $reseller, $license, $olderLog, $latestLog];
    }

    private function createRevenueActivity(
        int $tenantId,
        int $resellerId,
        int $licenseId,
        int $customerId,
        int $programId,
        string $biosId,
        float $price,
        string $createdAt
    ): ActivityLog {
        $timestamp = CarbonImmutable::parse($createdAt);

        $activityLog = new ActivityLog([
            'tenant_id' => $tenantId,
            'user_id' => $resellerId,
            'action' => 'license.renewed',
            'description' => 'Revenue event for transaction edit tests.',
            'metadata' => [
                'license_id' => $licenseId,
                'customer_id' => $customerId,
                'program_id' => $programId,
                'bios_id' => $biosId,
                'price' => $price,
                'duration_days' => 30,
                'country_name' => 'Iraq',
                'attribution_type' => 'earned',
                'external_username' => 'IRAQ185',
            ],
            'ip_address' => '127.0.0.1',
        ]);
        $activityLog->created_at = $timestamp;
        $activityLog->updated_at = $timestamp;
        $activityLog->save();

        return $activityLog;
    }
}
