<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestDataSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->updateOrCreate(
            ['slug' => 'test-tenant'],
            [
                'name' => 'Test Tenant',
                'settings' => ['currency' => 'USD'],
                'status' => 'active',
            ]
        );

        $parent = $this->upsertUser('parent@obd2sw.com', 'Manager Parent', 'manager-parent', UserRole::MANAGER_PARENT, $tenant->id);
        $manager = $this->upsertUser('manager@obd2sw.com', 'Manager', 'manager', UserRole::MANAGER, $tenant->id, $parent->id);
        $reseller = $this->upsertUser('reseller@obd2sw.com', 'Reseller', 'reseller', UserRole::RESELLER, $tenant->id, $manager->id);
        $customer = $this->upsertUser('customer@obd2sw.com', 'Customer', 'customer', UserRole::CUSTOMER, $tenant->id, $reseller->id);

        $programs = collect([
            [
                'name' => 'OBD2SW Diagnostic',
                'description' => 'Core diagnostics package.',
                'version' => '1.0.0',
                'download_link' => 'https://example.com/diagnostic',
                'trial_days' => 7,
                'base_price' => 29.99,
                'icon' => 'box',
                'status' => 'active',
            ],
            [
                'name' => 'OBD2SW Flashing',
                'description' => 'Advanced flashing package.',
                'version' => '1.2.0',
                'download_link' => 'https://example.com/flashing',
                'trial_days' => 14,
                'base_price' => 49.99,
                'icon' => 'cpu',
                'status' => 'active',
            ],
        ])->map(fn (array $attributes) => Program::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => $attributes['name']],
            ['tenant_id' => $tenant->id, ...$attributes]
        ));

        $licenses = [
            ['bios_id' => 'BIOS-1001', 'status' => 'active', 'duration_days' => 30, 'program_id' => $programs[0]->id],
            ['bios_id' => 'BIOS-1002', 'status' => 'pending', 'duration_days' => 60, 'program_id' => $programs[1]->id],
            ['bios_id' => 'BIOS-1003', 'status' => 'active', 'duration_days' => 90, 'program_id' => $programs[0]->id],
        ];

        foreach ($licenses as $license) {
            $program = $programs->firstWhere('id', $license['program_id']);

            License::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'bios_id' => $license['bios_id']],
                [
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'reseller_id' => $reseller->id,
                    'program_id' => $license['program_id'],
                    'bios_id' => $license['bios_id'],
                    'duration_days' => $license['duration_days'],
                    'price' => $program?->base_price ?? 0,
                    'activated_at' => now(),
                    'expires_at' => now()->addDays($license['duration_days']),
                    'status' => $license['status'],
                ]
            );
        }
    }

    private function upsertUser(string $email, string $name, string $username, UserRole $role, int $tenantId, ?int $createdBy = null): User
    {
        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'tenant_id' => $tenantId,
                'name' => $name,
                'username' => $username,
                'password' => Hash::make('password'),
                'role' => $role,
                'status' => 'active',
                'created_by' => $createdBy,
                'phone' => null,
                'username_locked' => false,
            ]
        );
    }
}
