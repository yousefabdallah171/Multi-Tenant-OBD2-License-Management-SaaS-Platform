<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_dashboard_returns_license_summary_and_calculated_status(): void
    {
        [$customer, $activeLicense, $expiredLicense] = $this->seedCustomerPortalData();

        $this->withToken($customer->createToken('customer-dashboard')->plainTextToken)
            ->getJson('/api/customer/dashboard')
            ->assertOk()
            ->assertJsonPath('data.summary.total_licenses', 2)
            ->assertJsonPath('data.summary.active_licenses', 1)
            ->assertJsonPath('data.summary.expired_licenses', 1)
            ->assertJsonPath('data.licenses.0.id', $activeLicense->id)
            ->assertJsonPath('data.licenses.0.status', 'active')
            ->assertJsonPath('data.licenses.1.id', $expiredLicense->id)
            ->assertJsonPath('data.licenses.1.status', 'expired');
    }

    public function test_customer_software_only_returns_programs_with_active_licenses(): void
    {
        [$customer, $activeLicense] = $this->seedCustomerPortalData();

        $this->withToken($customer->createToken('customer-software')->plainTextToken)
            ->getJson('/api/customer/software')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.license_id', $activeLicense->id)
            ->assertJsonPath('data.0.name', 'HaynesPro')
            ->assertJsonMissingPath('data.1');
    }

    public function test_customer_downloads_include_metadata_and_last_download_timestamp(): void
    {
        [$customer, $activeLicense] = $this->seedCustomerPortalData();
        $downloadedAt = now()->subDay()->startOfSecond();

        ActivityLog::query()->insert([
            'tenant_id' => $customer->tenant_id,
            'user_id' => $customer->id,
            'action' => 'customer.download',
            'description' => 'Downloaded HaynesPro.',
            'metadata' => json_encode([
                'license_id' => $activeLicense->id,
                'program_id' => $activeLicense->program_id,
            ]),
            'ip_address' => '127.0.0.1',
            'created_at' => $downloadedAt,
            'updated_at' => $downloadedAt,
        ]);

        $this->withToken($customer->createToken('customer-downloads')->plainTextToken)
            ->getJson('/api/customer/downloads')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.program_name', 'HaynesPro')
            ->assertJsonPath('data.0.file_size', '245 MB')
            ->assertJsonPath('data.0.installation_guide_url', 'https://example.com/guide')
            ->assertJsonPath('data.0.system_requirements', 'Windows 10 or newer')
            ->assertJsonPath('data.0.last_downloaded_at', $downloadedAt->toIso8601String());
    }

    public function test_customer_download_logging_creates_activity_entry_for_active_license(): void
    {
        [$customer, $activeLicense, $expiredLicense] = $this->seedCustomerPortalData();

        $this->withToken($customer->createToken('customer-log-download')->plainTextToken)
            ->postJson("/api/customer/downloads/{$activeLicense->id}/log")
            ->assertOk()
            ->assertJsonPath('message', 'Download logged successfully.');

        $this->assertDatabaseHas('activity_logs', [
            'tenant_id' => $customer->tenant_id,
            'user_id' => $customer->id,
            'action' => 'customer.download',
        ]);

        $this->withToken($customer->createToken('customer-expired-download')->plainTextToken)
            ->postJson("/api/customer/downloads/{$expiredLicense->id}/log")
            ->assertStatus(422);
    }

    /**
     * @return array{User, License, License}
     */
    private function seedCustomerPortalData(): array
    {
        $tenant = Tenant::query()->create([
            'name' => 'Tenant Portal',
            'slug' => 'tenant-portal',
            'status' => 'active',
        ]);

        $reseller = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::RESELLER,
            'status' => 'active',
            'email' => 'reseller@example.com',
            'name' => 'Reseller One',
        ]);

        $customer = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'created_by' => $reseller->id,
            'email' => 'customer@example.com',
        ]);

        $activeProgram = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'HaynesPro',
            'description' => 'Vehicle diagnostics',
            'version' => '2.1',
            'download_link' => 'https://example.com/haynespro.exe',
            'file_size' => '245 MB',
            'system_requirements' => 'Windows 10 or newer',
            'installation_guide_url' => 'https://example.com/guide',
            'trial_days' => 7,
            'base_price' => 150,
            'status' => 'active',
        ]);

        $expiredProgram = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Legacy Tool',
            'description' => 'Older package',
            'version' => '1.0',
            'download_link' => 'https://example.com/legacy.exe',
            'trial_days' => 0,
            'base_price' => 80,
            'status' => 'active',
        ]);

        $activeLicense = License::query()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'program_id' => $activeProgram->id,
            'bios_id' => 'BIOS-ACTIVE-100',
            'duration_days' => 60,
            'price' => 180,
            'activated_at' => now()->subDays(10),
            'expires_at' => now()->addDays(20),
            'status' => 'active',
        ]);

        $expiredLicense = License::query()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'program_id' => $expiredProgram->id,
            'bios_id' => 'BIOS-OLD-200',
            'duration_days' => 30,
            'price' => 80,
            'activated_at' => now()->subDays(60),
            'expires_at' => now()->subDays(5),
            'status' => 'active',
        ]);

        return [$customer, $activeLicense, $expiredLicense];
    }
}
