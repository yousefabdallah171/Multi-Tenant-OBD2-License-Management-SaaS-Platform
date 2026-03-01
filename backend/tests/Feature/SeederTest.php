<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_production_seed_baseline_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseCount('programs', 1);
        $this->assertDatabaseCount('licenses', 5);
        $this->assertDatabaseHas('users', ['email' => 'admin@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'manager@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'reseller1@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'reseller2@obd2sw.com']);
        $this->assertDatabaseHas('users', ['email' => 'customer1@demo.com']);
        $this->assertDatabaseHas('users', ['email' => 'customer5@demo.com']);
    }
}
