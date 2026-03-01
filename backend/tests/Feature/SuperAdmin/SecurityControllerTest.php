<?php

namespace Tests\Feature\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Tenant;
use App\Models\User;
use App\Services\LoginSecurityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SecurityControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_get_security_locks_returns_locked_accounts_and_blocked_ips_arrays(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        /** @var LoginSecurityService $security */
        $security = app(LoginSecurityService::class);
        $security->recordFailedAttempt('locked@example.com', '197.55.1.2', 'Mozilla/5.0');
        $security->recordFailedAttempt('locked@example.com', '197.55.1.2', 'Mozilla/5.0');
        $security->recordFailedAttempt('locked@example.com', '197.55.1.2', 'Mozilla/5.0');
        $security->recordFailedAttempt('locked@example.com', '197.55.1.2', 'Mozilla/5.0');
        $security->recordFailedAttempt('locked@example.com', '197.55.1.2', 'Mozilla/5.0');
        $security->blockIp('197.55.1.3', 'blocked@example.com', 'Mozilla/5.0');

        $token = $admin->createToken('test-token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/super-admin/security/locks')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'locked_accounts',
                    'blocked_ips',
                ],
            ]);
    }

    public function test_unblock_email_endpoint_is_idempotent_and_returns_200(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $token = $admin->createToken('test-token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/security/unblock-email', [
                'email' => 'not-locked@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Account lock cleared.');
    }

    public function test_unblock_ip_removes_block_and_returns_200(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        /** @var LoginSecurityService $security */
        $security = app(LoginSecurityService::class);
        $security->blockIp('197.55.1.22', 'blocked@example.com', 'Mozilla/5.0');
        $this->assertTrue($security->isLocked('blocked@example.com', '197.55.1.22')['locked']);

        $token = $admin->createToken('test-token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/security/unblock-ip', [
                'ip' => '197.55.1.22',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'IP block removed.');

        $this->assertFalse($security->isLocked('blocked@example.com', '197.55.1.22')['locked']);
    }

    public function test_audit_log_returns_paginated_security_activity(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => $admin->id,
            'action' => 'security.unblock_ip',
            'description' => 'Unblocked IP',
            'metadata' => ['unblocked_ip' => '197.55.1.2'],
            'ip_address' => '127.0.0.1',
        ]);

        $token = $admin->createToken('test-token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/super-admin/security/audit-log?per_page=10')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'per_page', 'total'],
            ]);
    }

    public function test_non_super_admin_receives_403_for_security_endpoints(): void
    {
        $tenant = Tenant::query()->create([
            'name' => 'Tenant One',
            'slug' => 'tenant-one',
            'status' => 'active',
        ]);

        $managerParent = User::factory()->create([
            'role' => UserRole::MANAGER_PARENT,
            'tenant_id' => $tenant->id,
            'status' => 'active',
        ]);

        $token = $managerParent->createToken('test-token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/super-admin/security/locks')
            ->assertForbidden();
    }
}
