<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'email', 'role'],
            ]);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnauthorized()
            ->assertHeader('X-RateLimit-Limit', '10');
    }

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::MANAGER,
            'status' => 'active',
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_logout_invalidates_current_token(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::MANAGER,
            'status' => 'active',
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_role_middleware_blocks_reseller_from_manager_parent_routes(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::RESELLER,
            'status' => 'active',
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bios-blacklist')
            ->assertForbidden();
    }

    public function test_login_returns_lock_response_after_five_failed_attempts(): void
    {
        User::factory()->create([
            'email' => 'locked@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'locked@example.com',
                'password' => 'wrong-password',
            ])->assertUnauthorized();
        }

        $this->postJson('/api/auth/login', [
            'email' => 'locked@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('locked', true)
            ->assertJsonPath('reason', 'account_locked')
            ->assertHeader('Retry-After');
    }

    public function test_login_returns_permanent_ip_block_after_tenth_failed_attempt(): void
    {
        User::factory()->create([
            'email' => 'blocked@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 0; $i < 9; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'blocked@example.com',
                'password' => 'wrong-password',
            ]);
        }

        $this->postJson('/api/auth/login', [
            'email' => 'blocked@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('reason', 'ip_blocked');
    }
}
