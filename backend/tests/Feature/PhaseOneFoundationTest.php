<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class PhaseOneFoundationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('phase-one.tenant-scope')) {
            Route::middleware(['auth:sanctum', 'tenant.scope'])
                ->get('/api/test/tenant-scope/licenses', function () {
                    return response()->json([
                        'bios_ids' => License::query()->orderBy('bios_id')->pluck('bios_id')->values(),
                    ]);
                })
                ->name('phase-one.tenant-scope');
        }
    }

    public function test_role_middleware_allows_super_admin_to_access_super_admin_route(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->withToken($user->createToken('test-token')->plainTextToken)
            ->getJson('/api/bios-blacklist')
            ->assertOk();
    }

    public function test_customer_tokens_are_silently_denied_by_active_role_middleware(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
        ]);

        $this->withToken($user->createToken('test-token')->plainTextToken)
            ->getJson('/api/bios-blacklist')
            ->assertUnauthorized()
            ->assertExactJson([
                'message' => 'Invalid credentials.',
            ]);
    }

    public function test_tenant_scope_filters_licenses_for_manager_parent(): void
    {
        [$tenantA, $tenantB] = $this->createTenants();
        $managerParent = User::factory()->create([
            'tenant_id' => $tenantA->id,
            'role' => UserRole::MANAGER_PARENT,
            'status' => 'active',
        ]);

        $this->seedTenantLicense($tenantA, 'BIOS-A-100');
        $this->seedTenantLicense($tenantB, 'BIOS-B-200');

        $this->withToken($managerParent->createToken('tenant-scope')->plainTextToken)
            ->getJson('/api/test/tenant-scope/licenses')
            ->assertOk()
            ->assertExactJson([
                'bios_ids' => ['BIOS-A-100'],
            ]);
    }

    public function test_tenant_scope_returns_all_licenses_for_super_admin(): void
    {
        [$tenantA, $tenantB] = $this->createTenants();
        $superAdmin = User::factory()->create([
            'tenant_id' => null,
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->seedTenantLicense($tenantA, 'BIOS-A-100');
        $this->seedTenantLicense($tenantB, 'BIOS-B-200');

        $this->withToken($superAdmin->createToken('global-scope')->plainTextToken)
            ->getJson('/api/test/tenant-scope/licenses')
            ->assertOk()
            ->assertExactJson([
                'bios_ids' => ['BIOS-A-100', 'BIOS-B-200'],
            ]);
    }

    public function test_api_logger_logs_external_status_requests(): void
    {
        config()->set('external-api.url', 'http://72.60.69.185');

        Http::fake([
            'http://72.60.69.185/showallapi/8' => Http::response('0', 200),
        ]);

        $user = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->withToken($user->createToken('api-logger')->plainTextToken)
            ->getJson('/api/external/status')
            ->assertOk()
            ->assertJsonPath('data.status', 'online');

        $this->assertDatabaseHas('api_logs', [
            'user_id' => $user->id,
            'endpoint' => 'api/external/status',
            'method' => 'GET',
            'status_code' => 200,
        ]);
    }

    /**
     * @return array{Tenant, Tenant}
     */
    private function createTenants(): array
    {
        $tenantA = Tenant::query()->create([
            'name' => 'Tenant Alpha',
            'slug' => 'tenant-alpha',
            'status' => 'active',
        ]);

        $tenantB = Tenant::query()->create([
            'name' => 'Tenant Beta',
            'slug' => 'tenant-beta',
            'status' => 'active',
        ]);

        return [$tenantA, $tenantB];
    }

    private function seedTenantLicense(Tenant $tenant, string $biosId): void
    {
        $customer = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
        ]);

        $reseller = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::RESELLER,
            'status' => 'active',
        ]);

        $program = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Program '.str($biosId)->after('BIOS-')->toString(),
            'description' => 'Test program',
            'version' => '1.0.0',
            'download_link' => 'https://example.com/download',
            'trial_days' => 7,
            'base_price' => 10,
            'status' => 'active',
        ]);

        License::query()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'program_id' => $program->id,
            'bios_id' => $biosId,
            'duration_days' => 30,
            'price' => 25,
            'activated_at' => now(),
            'expires_at' => now()->addDays(30),
            'status' => 'active',
        ]);
    }
}
