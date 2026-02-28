<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_phase_one_users_and_sample_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseCount('programs', 2);
        $this->assertDatabaseCount('licenses', 3);
        $this->assertDatabaseHas('users', ['email' => 'admin@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'parent@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'manager@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'reseller@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'customer@obd2sw.com']);
    }
}
