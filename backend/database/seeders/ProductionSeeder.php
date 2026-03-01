<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->firstOrCreate(
            ['slug' => 'obd2sw-main'],
            [
                'name' => 'OBD2SW Main',
                'slug' => 'obd2sw-main',
                'status' => 'active',
            ]
        );

        $program = Program::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'OBD2SW Pro'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'OBD2SW Pro',
                'description' => 'Professional OBD2 diagnostic software.',
                'version' => '2.0.0',
                'download_link' => 'https://obd2sw.com/download/obd2sw-pro',
                'trial_days' => 7,
                'base_price' => 25.00,
                'status' => 'active',
                'external_software_id' => (int) env('EXTERNAL_SOFTWARE_ID', 0) ?: null,
                'has_external_api' => (bool) env('EXTERNAL_API_KEY'),
            ]
        );

        if (env('EXTERNAL_API_KEY') && ! $program->has_external_api) {
            $program->setExternalApiKeyAttribute(env('EXTERNAL_API_KEY'));
            $program->has_external_api = true;
            $program->save();
        }

        $managerParent = User::query()->firstOrCreate(
            ['email' => 'manager@obd2sw.com'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Main Manager',
                'email' => 'manager@obd2sw.com',
                'password' => Hash::make(env('SEED_MANAGER_PASSWORD', 'ChangeMe123!')),
                'role' => UserRole::MANAGER_PARENT,
                'status' => 'active',
                'username' => 'main_manager',
            ]
        );

        $reseller1 = User::query()->firstOrCreate(
            ['email' => 'reseller1@obd2sw.com'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Ahmed Reseller',
                'email' => 'reseller1@obd2sw.com',
                'password' => Hash::make(env('SEED_RESELLER_PASSWORD', 'ChangeMe123!')),
                'role' => UserRole::RESELLER,
                'status' => 'active',
                'username' => 'ahmed_reseller',
                'created_by' => $managerParent->id,
            ]
        );

        $reseller2 = User::query()->firstOrCreate(
            ['email' => 'reseller2@obd2sw.com'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Mohamed Reseller',
                'email' => 'reseller2@obd2sw.com',
                'password' => Hash::make(env('SEED_RESELLER_PASSWORD', 'ChangeMe123!')),
                'role' => UserRole::RESELLER,
                'status' => 'active',
                'username' => 'mohamed_reseller',
                'created_by' => $managerParent->id,
            ]
        );

        $customers = [
            ['name' => 'Customer One', 'email' => 'customer1@demo.com', 'bios' => 'DEMO-BIOS-001', 'days' => 30, 'r' => $reseller1],
            ['name' => 'Customer Two', 'email' => 'customer2@demo.com', 'bios' => 'DEMO-BIOS-002', 'days' => 7, 'r' => $reseller1],
            ['name' => 'Customer Three', 'email' => 'customer3@demo.com', 'bios' => 'DEMO-BIOS-003', 'days' => 90, 'r' => $reseller2],
            ['name' => 'Customer Four', 'email' => 'customer4@demo.com', 'bios' => 'DEMO-BIOS-004', 'days' => 14, 'r' => $reseller2],
            ['name' => 'Customer Five', 'email' => 'customer5@demo.com', 'bios' => 'DEMO-BIOS-005', 'days' => -5, 'r' => $reseller1],
        ];

        foreach ($customers as $entry) {
            $expired = $entry['days'] < 0;
            $customer = User::query()->firstOrCreate(
                ['email' => $entry['email']],
                [
                    'tenant_id' => $tenant->id,
                    'name' => $entry['name'],
                    'email' => $entry['email'],
                    'password' => Hash::make(env('SEED_CUSTOMER_PASSWORD', 'ChangeMe123!')),
                    'role' => UserRole::CUSTOMER,
                    'status' => 'active',
                    'username' => $entry['bios'],
                    'created_by' => $entry['r']->id,
                ]
            );

            License::query()->firstOrCreate(
                ['bios_id' => $entry['bios'], 'program_id' => $program->id],
                [
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'reseller_id' => $entry['r']->id,
                    'program_id' => $program->id,
                    'bios_id' => $entry['bios'],
                    'external_username' => $entry['name'],
                    'duration_days' => abs($entry['days']),
                    'price' => 25.00,
                    'activated_at' => now()->subDays(abs($entry['days']) + 5),
                    'expires_at' => $expired ? now()->subDays(abs($entry['days'])) : now()->addDays($entry['days']),
                    'status' => $expired ? 'expired' : 'active',
                ]
            );
        }

        $this->command?->info('Production seed complete - 1 tenant, 1 program, 2 resellers, 5 customers (4 active + 1 expired)');
        $this->command?->warn('Change all SEED_*_PASSWORD values in .env before going live.');
    }
}
