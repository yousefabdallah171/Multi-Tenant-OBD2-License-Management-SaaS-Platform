<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\License>
 */
class LicenseFactory extends Factory
{
    protected $model = License::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'reseller_id' => function (array $attributes): int {
                return User::factory()->create([
                    'tenant_id' => $attributes['tenant_id'],
                    'role' => UserRole::RESELLER->value,
                    'status' => 'active',
                ])->id;
            },
            'created_by_reseller_id' => fn (array $attributes): ?int => isset($attributes['reseller_id']) ? (int) $attributes['reseller_id'] : null,
            'customer_id' => function (array $attributes): int {
                return User::factory()->create([
                    'tenant_id' => $attributes['tenant_id'],
                    'role' => UserRole::CUSTOMER->value,
                    'status' => 'active',
                    'created_by' => $attributes['reseller_id'] ?? null,
                ])->id;
            },
            'program_id' => fn (array $attributes): int => Program::factory()->create([
                'tenant_id' => $attributes['tenant_id'],
            ])->id,
            'bios_id' => Str::upper(Str::random(10)),
            'external_username' => fake()->unique()->userName(),
            'external_activation_response' => 'Activated locally for tests.',
            'external_deletion_response' => null,
            'duration_days' => 30,
            'price' => 50,
            'activated_at' => Carbon::now()->subDay(),
            'expires_at' => Carbon::now()->addDays(29),
            'scheduled_at' => null,
            'scheduled_timezone' => null,
            'scheduled_last_attempt_at' => null,
            'scheduled_failed_at' => null,
            'scheduled_failure_message' => null,
            'is_scheduled' => false,
            'activated_at_scheduled' => null,
            'paused_at' => null,
            'pause_remaining_minutes' => null,
            'pause_reason' => null,
            'paused_by_role' => null,
            'status' => 'active',
        ];
    }
}
