<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\BiosChangeRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class BiosChangeAuditAccessTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_parent_can_view_unified_bios_change_audit_with_tenant_scoped_real_data(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent, ['name' => 'Tenant Manager']);
        $reseller = $this->createUser('reseller', $tenant, $manager, ['name' => 'Tenant Reseller']);
        $customer = $this->createUser('customer', $tenant, $reseller, ['name' => 'Tenant Customer']);
        $program = $this->createProgram($tenant, ['name' => 'Tenant Program']);
        $license = $this->createLicense($reseller, $program, $customer, ['bios_id' => 'OLD-REQ-001']);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'OLD-REQ-001',
            'new_bios_id' => 'NEW-REQ-001',
            'reason' => 'Customer replaced board',
            'status' => 'approved_pending_sync',
            'reviewer_id' => $manager->id,
            'reviewer_notes' => 'Approved by manager',
            'created_at' => now()->subMinutes(10),
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $manager->id,
            'action' => 'bios.direct_changed',
            'description' => 'Directly changed BIOS ID from OLD-DIRECT-001 to NEW-DIRECT-001.',
            'metadata' => [
                'license_id' => $license->id,
                'customer_id' => $customer->id,
                'program_id' => $program->id,
                'reseller_id' => $reseller->id,
                'old_bios_id' => 'OLD-DIRECT-001',
                'new_bios_id' => 'NEW-DIRECT-001',
            ],
            'created_at' => now()->subMinutes(5),
        ]);

        $foreignTenant = $this->createTenant();
        $foreignParent = $this->createUser('manager_parent', $foreignTenant);
        $foreignManager = $this->createUser('manager', $foreignTenant, $foreignParent, ['name' => 'Foreign Manager']);
        $foreignReseller = $this->createUser('reseller', $foreignTenant, $foreignManager, ['name' => 'Foreign Reseller']);
        $foreignCustomer = $this->createUser('customer', $foreignTenant, $foreignReseller, ['name' => 'Foreign Customer']);
        $foreignProgram = $this->createProgram($foreignTenant, ['name' => 'Foreign Program']);
        $foreignLicense = $this->createLicense($foreignReseller, $foreignProgram, $foreignCustomer, ['bios_id' => 'FOREIGN-OLD']);

        BiosChangeRequest::query()->create([
            'tenant_id' => $foreignTenant->id,
            'license_id' => $foreignLicense->id,
            'reseller_id' => $foreignReseller->id,
            'old_bios_id' => 'FOREIGN-OLD',
            'new_bios_id' => 'FOREIGN-NEW',
            'reason' => 'Foreign request',
            'status' => 'rejected',
            'reviewer_id' => $foreignManager->id,
            'reviewer_notes' => 'Foreign reviewer',
            'created_at' => now()->subMinutes(2),
        ]);

        Sanctum::actingAs($managerParent);

        $summaryResponse = $this->getJson('/api/bios-change-audit/summary')
            ->assertOk()
            ->assertJsonPath('total_requests', 1)
            ->assertJsonPath('approved', 1)
            ->assertJsonPath('rejected', 0)
            ->assertJsonPath('pending', 0)
            ->assertJsonPath('direct_changes', 1);

        $this->assertSame(1, $summaryResponse->json('direct_changes'));

        $response = $this->getJson('/api/bios-change-audit')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $rows = collect($response->json('data'));

        $this->assertCount(2, $rows);
        $this->assertEqualsCanonicalizing(
            ['direct_change', 'request'],
            $rows->pluck('type')->all()
        );
        $this->assertGreaterThanOrEqual(
            strtotime((string) $rows[1]['occurred_at']),
            strtotime((string) $rows[0]['occurred_at'])
        );

        $directRow = $rows->firstWhere('type', 'direct_change');
        $requestRow = $rows->firstWhere('type', 'request');

        $this->assertSame('Tenant Manager', $directRow['manager_name']);
        $this->assertSame('Tenant Reseller', $directRow['reseller_name']);
        $this->assertSame('Tenant Customer', $directRow['customer_name']);
        $this->assertSame('Tenant Program', $directRow['program_name']);
        $this->assertSame('completed', $directRow['status']);
        $this->assertSame('NEW-DIRECT-001', $directRow['new_bios_id']);

        $this->assertSame('Tenant Manager', $requestRow['manager_name']);
        $this->assertSame('Tenant Reseller', $requestRow['reseller_name']);
        $this->assertSame('Tenant Customer', $requestRow['customer_name']);
        $this->assertSame('Tenant Program', $requestRow['program_name']);
        $this->assertSame('approved', $requestRow['status']);
        $this->assertSame('Approved by manager', $requestRow['reviewer_notes']);

        $allText = json_encode($rows->all());
        $this->assertIsString($allText);
        $this->assertStringNotContainsString('Foreign Manager', $allText);
        $this->assertStringNotContainsString('Foreign Reseller', $allText);
    }

    public function test_manager_parent_summary_counts_failed_direct_changes_and_request_statuses(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $license = $this->createLicense($reseller, null, null, ['bios_id' => 'REQ-OLD']);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'REQ-OLD',
            'new_bios_id' => 'REQ-APPROVED',
            'reason' => 'Approved request',
            'status' => 'approved_pending_sync',
            'reviewer_id' => $manager->id,
        ]);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'REQ-OLD',
            'new_bios_id' => 'REQ-REJECTED',
            'reason' => 'Rejected request',
            'status' => 'rejected',
            'reviewer_id' => $manager->id,
        ]);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'REQ-OLD',
            'new_bios_id' => 'REQ-PENDING',
            'reason' => 'Pending request',
            'status' => 'pending',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $manager->id,
            'action' => 'bios.direct_change_failed',
            'description' => 'Direct BIOS change failed.',
            'metadata' => [
                'license_id' => $license->id,
                'old_bios_id' => 'FAIL-OLD',
                'new_bios_id' => 'FAIL-NEW',
            ],
        ]);

        Sanctum::actingAs($managerParent);

        $this->getJson('/api/bios-change-audit/summary')
            ->assertOk()
            ->assertJsonPath('total_requests', 3)
            ->assertJsonPath('approved', 1)
            ->assertJsonPath('rejected', 1)
            ->assertJsonPath('pending', 1)
            ->assertJsonPath('direct_changes', 1);
    }

    public function test_manager_cannot_access_bios_change_audit_endpoints(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);

        Sanctum::actingAs($manager);

        $this->getJson('/api/bios-change-audit')->assertForbidden();
        $this->getJson('/api/bios-change-audit/summary')->assertForbidden();
    }

    public function test_completed_status_returns_only_direct_change_rows(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $license = $this->createLicense($reseller, null, null, ['bios_id' => 'STATUS-OLD']);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'REQ-OLD',
            'new_bios_id' => 'REQ-NEW',
            'reason' => 'Should not leak into completed filter',
            'status' => 'pending',
            'reviewer_id' => $manager->id,
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $manager->id,
            'action' => 'bios.direct_changed',
            'description' => 'Direct success',
            'metadata' => [
                'license_id' => $license->id,
                'old_bios_id' => 'DIR-OLD',
                'new_bios_id' => 'DIR-NEW',
            ],
        ]);

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/bios-change-audit?status=completed')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $rows = collect($response->json('data'));
        $this->assertCount(1, $rows);
        $this->assertSame('direct_change', $rows->first()['type']);
        $this->assertSame('completed', $rows->first()['status']);
    }

    public function test_pending_status_returns_only_request_rows(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $license = $this->createLicense($reseller, null, null, ['bios_id' => 'STATUS-OLD']);

        BiosChangeRequest::query()->create([
            'tenant_id' => $tenant->id,
            'license_id' => $license->id,
            'reseller_id' => $reseller->id,
            'old_bios_id' => 'REQ-OLD',
            'new_bios_id' => 'REQ-NEW',
            'reason' => 'Pending request',
            'status' => 'pending',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $manager->id,
            'action' => 'bios.direct_changed',
            'description' => 'Direct success should not leak into pending filter',
            'metadata' => [
                'license_id' => $license->id,
                'old_bios_id' => 'DIR-OLD',
                'new_bios_id' => 'DIR-NEW',
            ],
        ]);

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/bios-change-audit?status=pending')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $rows = collect($response->json('data'));
        $this->assertCount(1, $rows);
        $this->assertSame('request', $rows->first()['type']);
        $this->assertSame('pending', $rows->first()['status']);
    }
}
