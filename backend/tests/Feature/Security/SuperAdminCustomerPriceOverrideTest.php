<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\UserBalance;
use App\Services\BalanceService;
use App\Support\RevenueAnalytics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SuperAdminCustomerPriceOverrideTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_super_admin_price_override_updates_latest_earned_log_not_latest_granted_log(): void
    {
        $superAdmin = $this->createUser('super_admin');
        $tenant = $this->createTenant();
        $managerParent = $this->createUser('manager_parent', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $managerParent);
        $customer = $this->createUser('customer', $tenant, $reseller, [
            'name' => 'ELI1DATA1',
            'username' => 'ELI1DATA1',
        ]);
        $program = $this->createProgram($tenant, [
            'name' => 'GM Techline Connect',
        ]);

        $license = $this->createLicense($reseller, $program, $customer, [
            'bios_id' => '5CD1213LZD',
            'price' => 60,
            'duration_days' => 215,
            'activated_at' => now()->subDays(5),
            'expires_at' => now()->addDays(215),
            'status' => 'active',
        ]);

        $earnedActivationLog = ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.activated',
            'description' => 'Initial reseller activation.',
            'metadata' => [
                'license_id' => $license->id,
                'customer_id' => $customer->id,
                'program_id' => $program->id,
                'bios_id' => $license->bios_id,
                'price' => 60,
                'attribution_type' => BalanceService::TYPE_EARNED,
            ],
            'created_at' => now()->subDays(5),
            'updated_at' => now()->subDays(5),
        ]);

        $grantedRenewalLog = ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.renewed',
            'description' => 'Manager parent added duration without reseller revenue.',
            'metadata' => [
                'license_id' => $license->id,
                'customer_id' => $customer->id,
                'program_id' => $program->id,
                'bios_id' => $license->bios_id,
                'price' => 145,
                'attribution_type' => BalanceService::TYPE_GRANTED,
            ],
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        UserBalance::query()->create([
            'user_id' => $reseller->id,
            'tenant_id' => $tenant->id,
            'total_revenue' => 60,
            'pending_balance' => 60,
            'granted_value' => 145,
            'total_activations' => 1,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->putJson('/api/super-admin/customers/'.$customer->id, [
            'client_name' => 'ELI1DATA1',
            'license_id' => $license->id,
            'price' => 0,
        ])
            ->assertOk()
            ->assertJsonPath('data.price', 0);

        $license->refresh();
        $earnedActivationLog->refresh();
        $grantedRenewalLog->refresh();

        $this->assertSame(0.0, (float) $license->price);
        $this->assertSame(0.0, (float) data_get($earnedActivationLog->metadata, 'price'));
        $this->assertSame('super_admin_override', data_get($earnedActivationLog->metadata, 'price_source'));
        $this->assertSame(60.0, (float) data_get($earnedActivationLog->metadata, 'price_override_previous'));
        $this->assertSame(145.0, (float) data_get($grantedRenewalLog->metadata, 'price'));

        $balance = UserBalance::query()->where('user_id', $reseller->id)->firstOrFail();
        $this->assertSame(0.0, (float) $balance->total_revenue);
        $this->assertSame(0.0, (float) $balance->pending_balance);
        $this->assertSame(145.0, (float) $balance->granted_value);

        Sanctum::actingAs($reseller);

        $this->getJson('/api/reseller/reports/summary')
            ->assertOk()
            ->assertJsonPath('data.total_revenue', 0)
            ->assertJsonPath('data.avg_price', 0);
    }

    public function test_super_admin_price_override_updates_revenue_log_even_when_license_id_is_string_in_metadata(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $customer = $this->createUser('customer', $tenant, $reseller, [
            'country_name' => 'Saudi Arabia',
        ]);
        $license = $this->createLicense($reseller, null, $customer, [
            'status' => 'active',
            'price' => 100.00,
            'bios_id' => 'BIOS-PRICE-001',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $reseller->id,
            'action' => 'license.activated',
            'description' => 'Activation revenue fixture',
            'metadata' => [
                'license_id' => (string) $license->id, // key detail: stored as string
                'customer_id' => $customer->id,
                'program_id' => $license->program_id,
                'bios_id' => $license->bios_id,
                'price' => 100.00,
            ],
            'ip_address' => '127.0.0.1',
        ]);

        $superAdmin = $this->createUser('super_admin', null);
        Sanctum::actingAs($superAdmin);

        $this->putJson('/api/super-admin/customers/'.$customer->id, [
            'client_name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'country_name' => $customer->country_name,
            'license_id' => $license->id,
            'price' => 0,
        ])
            ->assertOk();

        $license->refresh();
        $this->assertSame(0.0, round((float) $license->price, 2));

        $updatedRevenueLog = ActivityLog::query()
            ->where('action', 'license.activated')
            ->whereMetadataLicenseId((int) $license->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($updatedRevenueLog);
        $this->assertSame(0.0, round((float) ($updatedRevenueLog->metadata['price'] ?? 0), 2));

        $this->assertSame(0.0, RevenueAnalytics::totalRevenue([], (int) $tenant->id, null, (int) $reseller->id));
    }
}
