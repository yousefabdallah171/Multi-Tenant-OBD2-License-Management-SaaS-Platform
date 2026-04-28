<?php

namespace Tests\Feature\Security;

use App\Models\ApiLog;
use App\Models\TenantBackup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SensitiveLoggingSecurityTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_login_logs_redact_password_and_token(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant, null, [
            'email' => 'manager@example.test',
            'password' => 'password',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $manager->email,
            'password' => 'password',
        ])
            ->assertOk();

        $log = ApiLog::query()->latest('id')->firstOrFail();

        $this->assertSame('[REDACTED]', $log->request_body['password'] ?? null);
        $this->assertSame('[REDACTED]', $log->response_body['token'] ?? null);
    }

    public function test_admin_password_reset_response_is_redacted_in_api_logs(): void
    {
        $superAdmin = $this->createUser('super_admin', null, null, [
            'email' => 'super@example.test',
        ]);
        $tenant = $this->createTenant();
        $target = $this->createUser('manager', $tenant);

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/super-admin/admin-management/'.$target->id.'/reset-password', [
            'revoke_tokens' => true,
        ])
            ->assertOk()
            ->assertJsonStructure(['temporary_password']);

        $log = ApiLog::query()->latest('id')->firstOrFail();

        $this->assertSame('[REDACTED]', $log->response_body['temporary_password'] ?? null);
    }

    public function test_tenant_backup_download_is_not_copied_into_api_logs(): void
    {
        $superAdmin = $this->createUser('super_admin');
        $tenant = $this->createTenant();
        $backup = TenantBackup::query()->create([
            'tenant_id' => $tenant->id,
            'created_by' => $superAdmin->id,
            'label' => 'Security backup',
            'stats' => ['customers' => 1],
            'payload' => json_encode([
                'customers' => [
                    ['id' => 1, 'email' => 'customer@example.test', 'password' => 'never-log-me'],
                ],
            ], JSON_THROW_ON_ERROR),
        ]);

        Sanctum::actingAs($superAdmin);

        $this->get('/api/super-admin/tenants/'.$tenant->id.'/backups/'.$backup->id.'/download')
            ->assertOk();

        $log = ApiLog::query()->latest('id')->firstOrFail();

        $this->assertNull($log->response_body);
    }

    public function test_super_admin_can_create_tenant_backup_snapshot(): void
    {
        $superAdmin = $this->createUser('super_admin');
        $tenant = $this->createTenant();
        $reseller = $this->createUser('reseller', $tenant);
        $customer = $this->createUser('customer', $tenant, $reseller);
        $program = $this->createProgram($tenant);

        $this->createLicense($reseller, $program, $customer, [
            'tenant_id' => $tenant->id,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/super-admin/tenants/'.$tenant->id.'/backups/create', [
            'label' => 'Smoke backup',
        ])
            ->assertOk()
            ->assertJsonPath('data.label', 'Smoke backup')
            ->assertJsonPath('data.stats.customers', 1)
            ->assertJsonPath('data.stats.licenses', 1);

        $backup = TenantBackup::query()->latest('id')->firstOrFail();

        $this->assertSame($tenant->id, $backup->tenant_id);
        $this->assertNotEmpty($backup->payload);
    }
}
