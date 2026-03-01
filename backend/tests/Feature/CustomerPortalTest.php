<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_login_returns_invalid_credentials_for_correct_password(): void
    {
        $customer = User::factory()->create([
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $customer->email,
            'password' => 'password',
        ])
            ->assertUnauthorized()
            ->assertExactJson([
                'message' => 'Invalid credentials.',
            ]);
    }

    public function test_customer_login_returns_identical_invalid_credentials_for_wrong_password(): void
    {
        User::factory()->create([
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'customer@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnauthorized()
            ->assertExactJson([
                'message' => 'Invalid credentials.',
            ]);
    }

    public function test_customer_routes_return_not_found_after_portal_removal(): void
    {
        $this->getJson('/api/customer/dashboard')->assertNotFound();
        $this->getJson('/api/customer/software')->assertNotFound();
        $this->getJson('/api/customer/downloads')->assertNotFound();
    }

    public function test_customer_token_is_revoked_by_active_role_middleware(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::CUSTOMER,
            'status' => 'active',
        ]);

        $token = $customer->createToken('customer-token')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/bios-blacklist')
            ->assertUnauthorized()
            ->assertExactJson([
                'message' => 'Invalid credentials.',
            ]);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
