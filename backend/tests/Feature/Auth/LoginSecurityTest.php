<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LoginSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_correct_credentials_return_token_and_rate_limit_header(): void
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
            ->assertJsonStructure(['token', 'user'])
            ->assertHeader('X-RateLimit-Limit', '10');
    }

    public function test_fifth_failed_attempt_returns_429_with_lock_payload_and_retry_after_header(): void
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
            ->assertJsonPath('seconds_remaining', 60)
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Limit', '10');
    }

    public function test_fourth_failed_attempt_has_one_remaining_attempt_header(): void
    {
        User::factory()->create([
            'email' => 'remaining@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'remaining@example.com',
                'password' => 'wrong-password',
            ])->assertUnauthorized();
        }

        $this->postJson('/api/auth/login', [
            'email' => 'remaining@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnauthorized()
            ->assertHeader('X-RateLimit-Remaining', '6');
    }

    public function test_after_first_lockout_expires_next_failed_attempt_escalates_to_five_minutes(): void
    {
        User::factory()->create([
            'email' => 'lock-expire@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'lock-expire@example.com',
                'password' => 'wrong-password',
            ]);
        }

        $this->travel(61)->seconds();

        $this->postJson('/api/auth/login', [
            'email' => 'lock-expire@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('reason', 'account_locked')
            ->assertJsonPath('seconds_remaining', 300);
    }

    public function test_tenth_failed_attempt_permanently_blocks_ip(): void
    {
        User::factory()->create([
            'email' => 'blocked@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 1; $i <= 10; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'blocked@example.com',
                'password' => 'wrong-password',
            ]);

            if ($i < 5) {
                $response->assertUnauthorized();
            } else {
                $response->assertStatus(429);
            }
        }

        $this->postJson('/api/auth/login', [
            'email' => 'blocked@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('reason', 'ip_blocked')
            ->assertJsonPath('unlocks_at', null);
    }

    public function test_successful_login_clears_failed_attempt_counter(): void
    {
        $email = 'reset-attempts@example.com';
        User::factory()->create([
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'wrong-password'])->assertUnauthorized();

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password'])->assertOk();

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'wrong-password'])
            ->assertUnauthorized()
            ->assertHeader('X-RateLimit-Remaining', '9');
    }

    public function test_customer_login_is_silent_deny_with_same_invalid_credentials_message(): void
    {
        $customer = User::factory()->create([
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
            'username' => 'customer-'.Str::random(6),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $customer->email,
            'password' => 'password',
        ])
            ->assertUnauthorized()
            ->assertJson(['message' => 'Invalid credentials.']);
    }

    #[DataProvider('invalidCredentialProvider')]
    public function test_invalid_credentials_always_return_same_error_message(string $email, string $password): void
    {
        User::factory()->create([
            'email' => 'known-user@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ])
            ->assertUnauthorized()
            ->assertJson(['message' => 'Invalid credentials.']);
    }

    public function test_locked_account_retries_keep_lock_payload_shape(): void
    {
        User::factory()->create([
            'email' => 'retry-locked@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'retry-locked@example.com',
                'password' => 'wrong-password',
            ]);
        }

        $this->postJson('/api/auth/login', [
            'email' => 'retry-locked@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('locked', true)
            ->assertJsonPath('reason', 'account_locked')
            ->assertHeader('Retry-After');
    }

    public function test_login_response_includes_rate_limit_limit_header_on_unauthorized(): void
    {
        User::factory()->create([
            'email' => 'header-check@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'header-check@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnauthorized()
            ->assertHeader('X-RateLimit-Limit', '10');
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidCredentialProvider(): array
    {
        return [
            'wrong password known user' => ['known-user@example.com', 'wrong-password'],
            'unknown user' => ['unknown-user@example.com', 'password'],
            'uppercase unknown email' => ['UNKNOWN-USER@EXAMPLE.COM', 'password'],
        ];
    }
}
