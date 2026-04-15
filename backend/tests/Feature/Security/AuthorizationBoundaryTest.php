<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\License;
use App\Models\ProgramDurationPreset;
use App\Models\UserBalance;
use Illuminate\Support\Facades\Cache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class AuthorizationBoundaryTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_manager_cannot_view_license_owned_by_another_manager_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);
        $license = $this->createLicense($resellerB);

        Sanctum::actingAs($managerA);

        $this->getJson('/api/licenses/'.$license->id)
            ->assertNotFound();
    }

    public function test_manager_cannot_activate_license_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);
        $program = $this->createProgram($tenant);
        $preset = ProgramDurationPreset::query()->create([
            'program_id' => $program->id,
            'label' => '30 Days',
            'duration_days' => 30,
            'price' => 25,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'seller_id' => $resellerB->id,
            'customer_name' => 'Escalation Attempt',
            'bios_id' => 'TEAMLOCK1',
            'preset_id' => $preset->id,
            'duration_days' => 30,
            'price' => 25,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seller_id');
    }

    public function test_reseller_cannot_activate_license_for_another_reseller(): void
    {
        $tenant = $this->createTenant();
        $resellerA = $this->createUser('reseller', $tenant);
        $resellerB = $this->createUser('reseller', $tenant);
        $program = $this->createProgram($tenant);
        $preset = ProgramDurationPreset::query()->create([
            'program_id' => $program->id,
            'label' => '30 Days',
            'duration_days' => 30,
            'price' => 10,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        Sanctum::actingAs($resellerA);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'seller_id' => $resellerB->id,
            'customer_name' => 'Wrong Reseller',
            'bios_id' => 'TEAMLOCK2',
            'preset_id' => $preset->id,
            'duration_days' => 30,
            'price' => 10,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seller_id');
    }

    public function test_manager_cannot_reset_password_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/manager/username-management/'.$resellerB->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertNotFound();
    }

    public function test_manager_parent_can_reset_password_for_manager_in_same_tenant(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/username-management/'.$manager->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertOk()
            ->assertJsonStructure(['message', 'temporary_password']);
    }

    public function test_manager_parent_can_unlock_manager_in_same_tenant(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent, ['username_locked' => true]);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/username-management/'.$manager->id.'/unlock', [
            'reason' => 'test',
        ])
            ->assertOk()
            ->assertJsonPath('data.username_locked', false);
    }

    public function test_manager_parent_can_change_manager_username_in_same_tenant(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);

        Sanctum::actingAs($managerParent);

        $this->putJson('/api/username-management/'.$manager->id.'/username', [
            'username' => 'updated-manager-username',
            'reason' => 'test',
        ])
            ->assertOk()
            ->assertJsonPath('data.username', 'updated-manager-username');
    }

    public function test_manager_cannot_unlock_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB, ['username_locked' => true]);

        Sanctum::actingAs($managerA);

        $this->postJson('/api/manager/username-management/'.$resellerB->id.'/unlock', [
            'reason' => 'test',
        ])->assertNotFound();
    }

    public function test_manager_cannot_change_username_for_reseller_outside_his_team(): void
    {
        $tenant = $this->createTenant();
        $managerA = $this->createUser('manager', $tenant);
        $managerB = $this->createUser('manager', $tenant);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);

        Sanctum::actingAs($managerA);

        $this->putJson('/api/manager/username-management/'.$resellerB->id.'/username', [
            'username' => 'blocked-manager-change',
            'reason' => 'test',
        ])->assertNotFound();
    }

    public function test_reseller_cannot_access_manager_username_management_route(): void
    {
        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $customer = $this->createUser('customer', $tenant, $reseller);

        Sanctum::actingAs($reseller);

        $this->postJson('/api/manager/username-management/'.$customer->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertForbidden();
    }

    public function test_manager_parent_can_view_team_network_with_pending_balance_distinct_customers_and_orphan_reseller(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $manager = $this->createUser('manager', $tenant, $managerParent);
        $managedReseller = $this->createUser('reseller', $tenant, $manager);
        $orphanReseller = $this->createUser('reseller', $tenant, $managerParent);
        $sharedCustomer = $this->createUser('customer', $tenant, $managedReseller);

        $this->createLicense($managedReseller, null, $sharedCustomer);
        $this->createLicense($managedReseller);
        $this->createLicense($orphanReseller, null, $sharedCustomer);

        UserBalance::query()->create([
            'user_id' => $managerParent->id,
            'tenant_id' => $tenant->id,
            'pending_balance' => 125.5,
            'total_revenue' => 999,
            'total_activations' => 0,
            'granted_value' => 0,
        ]);

        $this->createEarnedActivity($tenant->id, $manager->id, 50, '2026-04-01 10:00:00');
        $this->createEarnedActivity($tenant->id, $managedReseller->id, 75, '2026-04-02 10:00:00');
        $this->createEarnedActivity($tenant->id, $orphanReseller->id, 25, '2026-04-03 10:00:00');

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/team/network')
            ->assertOk()
            ->assertJsonPath('data.root.balance', 125.5)
            ->assertJsonPath('data.root.managers_count', 1)
            ->assertJsonPath('data.root.resellers_count', 2)
            ->assertJsonPath('data.root.total_customers', 2);

        $this->assertSame(150.0, (float) $response->json('data.root.total_revenue'));

        $managerNode = collect($response->json('data.managers'))->firstWhere('id', $manager->id);
        $managedResellerNode = collect($response->json('data.resellers'))->firstWhere('id', $managedReseller->id);
        $orphanResellerNode = collect($response->json('data.resellers'))->firstWhere('id', $orphanReseller->id);

        $this->assertNotNull($managerNode);
        $this->assertSame(1, (int) $managerNode['resellers_count']);
        $this->assertSame(2, (int) $managerNode['customers_count']);
        $this->assertSame(2, (int) $managerNode['activations_count']);

        $this->assertNotNull($managedResellerNode);
        $this->assertSame($manager->id, (int) $managedResellerNode['manager_id']);
        $this->assertSame(75.0, (float) $managedResellerNode['revenue']);

        $this->assertNotNull($orphanResellerNode);
        $this->assertNull($orphanResellerNode['manager_id']);
        $this->assertSame(25.0, (float) $orphanResellerNode['revenue']);
    }

    public function test_manager_cannot_access_manager_parent_team_network_endpoint(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);

        Sanctum::actingAs($manager);

        $this->getJson('/api/team/network')->assertForbidden();
    }

    public function test_team_network_marks_current_manager_parent_per_request_with_user_scoped_cache(): void
    {
        Cache::flush();

        $tenant = $this->createTenant();
        $managerParentA = $this->createUser('manager_parent', $tenant, null, ['name' => 'Manager Parent A']);
        $managerParentB = $this->createUser('manager_parent', $tenant, null, ['name' => 'Manager Parent B']);

        Sanctum::actingAs($managerParentA);

        $firstResponse = $this->getJson('/api/team/network')
            ->assertOk();

        $firstParents = collect($firstResponse->json('data.manager_parents'))->keyBy('id');
        $this->assertTrue((bool) $firstParents[$managerParentA->id]['is_current']);
        $this->assertFalse((bool) $firstParents[$managerParentB->id]['is_current']);

        Sanctum::actingAs($managerParentB);

        $secondResponse = $this->getJson('/api/team/network')
            ->assertOk();

        $secondParents = collect($secondResponse->json('data.manager_parents'))->keyBy('id');
        $this->assertFalse((bool) $secondParents[$managerParentA->id]['is_current']);
        $this->assertTrue((bool) $secondParents[$managerParentB->id]['is_current']);
    }

    public function test_manager_parent_team_index_can_be_scoped_to_manager_parent_and_manager_subtrees(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $otherParent = $this->createUser('manager_parent', $tenant);
        $managerA = $this->createUser('manager', $tenant, $managerParent);
        $managerB = $this->createUser('manager', $tenant, $otherParent);
        $resellerA = $this->createUser('reseller', $tenant, $managerA);
        $this->createUser('reseller', $tenant, $managerB);
        $directReseller = $this->createUser('reseller', $tenant, $managerParent);

        Sanctum::actingAs($managerParent);

        $this->getJson('/api/team?role=manager&manager_parent_id='.$managerParent->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $managerA->id);

        $response = $this->getJson('/api/team?role=reseller&manager_parent_id='.$managerParent->id)
            ->assertOk();

        $resellerIds = collect($response->json('data'))->pluck('id')->all();
        sort($resellerIds);
        $expectedResellerIds = [$resellerA->id, $directReseller->id];
        sort($expectedResellerIds);
        $this->assertSame($expectedResellerIds, $resellerIds);

        $this->getJson('/api/team?role=reseller&manager_id='.$managerA->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $resellerA->id);
    }

    public function test_manager_parent_customers_manager_filter_uses_direct_license_ownership(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $otherParent = $this->createUser('manager_parent', $tenant);
        $managerA = $this->createUser('manager', $tenant, $managerParent, ['name' => 'Main Manager']);
        $managerB = $this->createUser('manager', $tenant, $otherParent);
        $resellerA = $this->createUser('reseller', $tenant, $managerA);
        $resellerB = $this->createUser('reseller', $tenant, $managerB);
        $scopedCustomer = $this->createUser('customer', $tenant, $resellerA, ['name' => 'Scoped Customer']);
        $outsideCustomer = $this->createUser('customer', $tenant, $resellerB, ['name' => 'Outside Customer']);

        $this->createLicense($resellerA, null, $scopedCustomer);
        $this->createLicense($resellerB, null, $outsideCustomer);

        Sanctum::actingAs($managerParent);

        $response = $this->getJson('/api/customers?manager_id='.$managerA->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $customerIds = collect($response->json('data'))->pluck('id')->all();

        $this->assertSame([], $customerIds);

        $this->getJson('/api/customers?reseller_id='.$resellerA->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $scopedCustomer->id);
    }

    public function test_reseller_sees_historical_customer_as_expired_after_manager_parent_takeover_and_counts_drop_to_current_owners_only(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent, ['name' => 'Legacy Reseller']);
        $customer = $this->createUser('customer', $tenant, $reseller, ['name' => 'Takeover Customer']);
        $program = $this->createProgram($tenant);

        $legacyLicense = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'TAKEOVER1',
            'status' => 'expired',
            'price' => 21686.75,
            'activated_at' => now()->subDays(40),
            'expires_at' => now()->subDays(10),
        ]);
        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.activated',
            'description' => 'Activated legacy license.',
            'metadata' => [
                'license_id' => $legacyLicense->id,
                'price' => 60,
            ],
        ]);

        $this->createLicense($managerParent, $program, $customer, [
            'bios_id' => 'TAKEOVER1',
            'status' => 'active',
            'price' => 75,
            'activated_at' => now()->subDay(),
            'expires_at' => now()->addDays(29),
        ]);

        Sanctum::actingAs($reseller);

        $customers = $this->getJson('/api/reseller/customers')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->assertSame('expired', $customers->json('data.0.status'));
        $this->assertEquals(60.0, (float) $customers->json('data.0.price'));
        $this->assertTrue((bool) $customers->json('data.0.bios_active_elsewhere'));

        $this->getJson('/api/reseller/reports/summary')
            ->assertOk()
            ->assertJsonPath('data.total_customers', 0)
            ->assertJsonPath('data.active_customers', 0);

        $this->getJson('/api/reseller/dashboard/stats')
            ->assertOk()
            ->assertJsonPath('stats.customers', 0)
            ->assertJsonPath('stats.active_licenses', 0);
    }

    public function test_manager_parent_renewing_expired_reseller_license_creates_current_parent_owned_license(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent, ['name' => 'Legacy Reseller']);
        $customer = $this->createUser('customer', $tenant, $reseller, ['name' => 'Renew Takeover']);
        $program = $this->createProgram($tenant);
        $legacyLicense = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'RENEWTAKE1',
            'status' => 'expired',
            'price' => 60,
            'activated_at' => now()->subDays(40),
            'expires_at' => now()->subDays(10),
        ]);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/licenses/'.$legacyLicense->id.'/renew', [
            'duration_days' => 30,
            'price' => 75,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])->assertOk();

        $renewed = License::query()
            ->where('customer_id', $customer->id)
            ->where('bios_id', 'RENEWTAKE1')
            ->whereKeyNot($legacyLicense->id)
            ->firstOrFail();

        $this->assertSame($managerParent->id, (int) $renewed->reseller_id);
        $this->assertSame('pending', $renewed->status);
        $this->assertTrue((bool) $renewed->is_scheduled);

        $legacyLicense->refresh();
        $this->assertSame($reseller->id, (int) $legacyLicense->reseller_id);
        $this->assertSame('expired', $legacyLicense->effectiveStatus());

        Sanctum::actingAs($reseller);

        $customers = $this->getJson('/api/reseller/customers')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->assertSame('expired', $customers->json('data.0.status'));
        $this->assertTrue((bool) $customers->json('data.0.bios_active_elsewhere'));
    }

    public function test_manager_parent_activation_can_take_over_stale_active_expired_reseller_bios(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent, ['name' => 'Legacy Reseller']);
        $customer = $this->createUser('customer', $tenant, $reseller, [
            'name' => 'Stale Active Customer',
            'username' => 'stale_active',
            'username_locked' => true,
        ]);
        $program = $this->createProgram($tenant);

        $legacyLicense = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'STALEACTIVE1',
            'external_username' => 'stale-active',
            'status' => 'active',
            'price' => 60,
            'activated_at' => now()->subDays(40),
            'expires_at' => now()->subDays(10),
        ]);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'customer_name' => 'stale_active',
            'bios_id' => 'STALEACTIVE1',
            'duration_days' => 30,
            'price' => 75,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])->assertCreated();

        $takeoverLicense = License::query()
            ->where('customer_id', $customer->id)
            ->where('bios_id', 'STALEACTIVE1')
            ->whereKeyNot($legacyLicense->id)
            ->firstOrFail();

        $this->assertSame($managerParent->id, (int) $takeoverLicense->reseller_id);
        $this->assertSame('pending', $takeoverLicense->status);
        $this->assertTrue((bool) $takeoverLicense->is_scheduled);

        Sanctum::actingAs($reseller);

        $customers = $this->getJson('/api/reseller/customers')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->assertSame('expired', $customers->json('data.0.status'));
        $this->assertTrue((bool) $customers->json('data.0.bios_active_elsewhere'));
    }

    public function test_owner_repair_command_can_preserve_previous_reseller_history(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant, null, ['email' => 'repair-owner@example.test']);
        $reseller = $this->createUser('reseller', $tenant, $managerParent, ['email' => 'repair-history@example.test']);
        $customer = $this->createUser('customer', $tenant, $reseller, ['username' => 'repair_customer']);
        $program = $this->createProgram($tenant);
        $activatedAt = now()->subDay();
        $historicalExpiresAt = (clone $activatedAt)->addHours(2);
        $currentExpiresAt = (clone $activatedAt)->addDays(30);
        $activeLicense = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => 'REPAIRBIOS1',
            'external_username' => 'repair_customer',
            'status' => 'active',
            'price' => 60,
            'activated_at' => $activatedAt,
            'expires_at' => now()->addDay(),
        ]);

        $this->artisan('licenses:reassign-current-owner', [
            'bios_id' => 'REPAIRBIOS1',
            'owner_email' => 'repair-owner@example.test',
            '--preserve-history' => true,
            '--historical-owner-email' => 'repair-history@example.test',
            '--current-price' => 250,
            '--current-started-at' => $activatedAt->toDateTimeString(),
            '--current-expires-at' => $currentExpiresAt->toDateTimeString(),
            '--historical-price' => 60,
            '--historical-started-at' => $activatedAt->toDateTimeString(),
            '--historical-expires-at' => $historicalExpiresAt->toDateTimeString(),
            '--force' => true,
        ])->assertSuccessful();

        $activeLicense->refresh();
        $this->assertSame($managerParent->id, (int) $activeLicense->reseller_id);
        $this->assertSame(250.0, (float) $activeLicense->price);
        $this->assertGreaterThan(29.0, (float) $activeLicense->duration_days);
        $this->assertTrue($activeLicense->expires_at?->greaterThan($historicalExpiresAt));

        $historicalLicense = License::query()
            ->where('bios_id', 'REPAIRBIOS1')
            ->where('reseller_id', $reseller->id)
            ->where('status', 'expired')
            ->firstOrFail();

        $this->assertSame($customer->id, (int) $historicalLicense->customer_id);
        $this->assertSame(60.0, (float) $historicalLicense->price);
        $this->assertLessThan(1.0, (float) $historicalLicense->duration_days);
        $this->assertSame('expired', $historicalLicense->effectiveStatus());

        Sanctum::actingAs($reseller);

        $customers = $this->getJson('/api/reseller/customers')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->assertSame('expired', $customers->json('data.0.status'));
        $this->assertEquals(60.0, (float) $customers->json('data.0.price'));
        $this->assertTrue((bool) $customers->json('data.0.bios_active_elsewhere'));
    }

    public function test_manager_parent_activation_rejects_unreasonable_price(): void
    {
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $program = $this->createProgram($tenant);

        Sanctum::actingAs($managerParent);

        $this->postJson('/api/licenses/activate', [
            'program_id' => $program->id,
            'customer_name' => 'price_guard',
            'bios_id' => 'PRICE123',
            'duration_days' => 30,
            'price' => 25000,
            'is_scheduled' => true,
            'scheduled_date_time' => now()->addDay()->toIso8601String(),
            'scheduled_timezone' => 'UTC',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price');
    }

    public function test_super_admin_force_activate_assigns_the_selected_seller_as_owner(): void
    {
        $superAdmin = $this->createUser('super_admin');
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $customer = $this->createUser('customer', $tenant, $managerParent, ['username' => 'force_customer']);
        $program = $this->createProgram($tenant);

        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/super-admin/licenses/force-activate', [
            'customer_id' => $customer->id,
            'seller_id' => $managerParent->id,
            'bios_id' => 'FORCE123',
            'program_id' => $program->id,
            'price' => 50,
            'duration_months' => 1,
        ])->assertCreated();

        $licenseId = (int) $response->json('data.id');
        $license = License::query()->findOrFail($licenseId);

        $this->assertSame($managerParent->id, (int) $license->reseller_id);
    }

    private function createEarnedActivity(int $tenantId, int $sellerId, float $price, string $createdAt): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $sellerId,
            'action' => 'license.activated',
            'description' => 'Revenue event for team network tests.',
            'metadata' => [
                'price' => $price,
                'attribution_type' => 'earned',
            ],
            'ip_address' => '127.0.0.1',
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }
}
