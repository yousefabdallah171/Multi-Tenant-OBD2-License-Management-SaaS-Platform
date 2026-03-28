<?php

namespace Database\Factories;

use App\Models\Program;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Program>
 */
class ProgramFactory extends Factory
{
    protected $model = Program::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->unique()->words(2, true),
            'description' => fake()->sentence(),
            'version' => '1.0',
            'download_link' => 'https://example.test/download',
            'trial_days' => 0,
            'base_price' => 99.99,
            'icon' => null,
            'status' => 'active',
            'external_api_key_encrypted' => encrypt('test-api-key'),
            'external_api_base_url' => 'https://license-api.test',
            'has_external_api' => true,
        ];
    }
}
