<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\ImpersonationTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SuperAdminImpersonationTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_non_super_admin_cannot_access_impersonation_endpoints(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);

        $token = $manager->createToken('auth-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/super-admin/impersonation/targets')
            ->assertStatus(403);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $manager->id])
            ->assertStatus(403);
    }

    public function test_super_admin_cannot_impersonate_super_admin_or_customer(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $targetSuperAdmin = $this->createUser('super_admin');
        $targetCustomer = $this->createUser('customer', $tenant);

        $token = $superAdmin->createToken('auth-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $targetSuperAdmin->id])
            ->assertStatus(422);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $targetCustomer->id])
            ->assertStatus(422);
    }

    public function test_impersonation_ticket_has_ten_minute_expiry(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $target = $this->createUser('manager_parent', $tenant);

        $token = $superAdmin->createToken('auth-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $target->id])
            ->assertOk()
            ->json();

        $this->assertNotEmpty($response['data']['token'] ?? null);

        $ticket = ImpersonationTicket::query()->first();
        $this->assertNotNull($ticket);
        $this->assertNotNull($ticket?->expires_at);
        $this->assertEqualsWithDelta(
            now()->addMinutes(10)->timestamp,
            $ticket?->expires_at?->timestamp ?? 0,
            5,
        );
    }

    public function test_exchange_fails_when_actor_token_changes(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $target = $this->createUser('manager', $tenant);

        $firstToken = $superAdmin->createToken('auth-token')->plainTextToken;
        $start = $this->withHeader('Authorization', 'Bearer '.$firstToken)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $target->id])
            ->assertOk()
            ->json();

        $launchToken = (string) ($start['data']['token'] ?? '');
        $this->assertNotSame('', $launchToken);

        $secondToken = $superAdmin->createToken('auth-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$secondToken)
            ->postJson('/api/super-admin/impersonation/exchange', ['token' => $launchToken])
            ->assertStatus(422);
    }

    public function test_exchange_token_is_one_time_use(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $target = $this->createUser('reseller', $tenant);

        $authToken = $superAdmin->createToken('auth-token')->plainTextToken;
        $start = $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $target->id])
            ->assertOk()
            ->json();

        $launchToken = (string) ($start['data']['token'] ?? '');

        $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/exchange', ['token' => $launchToken])
            ->assertOk()
            ->assertJsonPath('data.user.id', $target->id)
            ->assertJsonPath('data.impersonation.active', true);

        $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/exchange', ['token' => $launchToken])
            ->assertStatus(422);
    }

    public function test_impersonation_logs_start_exchange_and_stop_events(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin');
        $target = $this->createUser('manager_parent', $tenant);

        $authToken = $superAdmin->createToken('auth-token')->plainTextToken;

        $start = $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/start', ['target_user_id' => $target->id])
            ->assertOk()
            ->json();

        $launchToken = (string) ($start['data']['token'] ?? '');

        $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/exchange', ['token' => $launchToken])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$authToken)
            ->postJson('/api/super-admin/impersonation/stop', [
                'target_user_id' => $target->id,
                'target_role' => 'manager_parent',
            ])
            ->assertOk();

        $actions = ActivityLog::query()
            ->where('user_id', $superAdmin->id)
            ->whereIn('action', ['impersonation.start', 'impersonation.exchange', 'impersonation.stop'])
            ->pluck('action')
            ->all();

        $this->assertContains('impersonation.start', $actions);
        $this->assertContains('impersonation.exchange', $actions);
        $this->assertContains('impersonation.stop', $actions);
    }
}

