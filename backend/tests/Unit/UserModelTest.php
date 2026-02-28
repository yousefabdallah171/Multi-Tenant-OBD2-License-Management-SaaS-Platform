<?php

namespace Tests\Unit;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_role_is_cast_to_enum(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::MANAGER_PARENT,
            'status' => 'active',
        ]);

        $this->assertInstanceOf(UserRole::class, $user->fresh()->role);
        $this->assertSame(UserRole::MANAGER_PARENT, $user->fresh()->role);
    }
}
