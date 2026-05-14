<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MockDataSeeder extends Seeder
{
    public function run(): void
    {
        // Create Tenants
        $tenant1 = Tenant::firstOrCreate(
            ['name' => 'OBD2 Systems Inc'],
            ['slug' => 'obd2-systems-inc', 'status' => 'active']
        );

        $tenant2 = Tenant::firstOrCreate(
            ['name' => 'Auto Diagnostics Ltd'],
            ['slug' => 'auto-diagnostics-ltd', 'status' => 'active']
        );

        // Create Programs for Tenant 1
        $program1 = Program::firstOrCreate(
            ['tenant_id' => $tenant1->id, 'name' => 'OBD2 Basic'],
            [
                'description' => 'Basic OBD2 diagnostic tool',
                'download_link' => 'https://obd2sw.com/download/basic',
                'base_price' => 99.99,
            ]
        );

        $program2 = Program::firstOrCreate(
            ['tenant_id' => $tenant1->id, 'name' => 'OBD2 Professional'],
            [
                'description' => 'Professional OBD2 diagnostic suite',
                'download_link' => 'https://obd2sw.com/download/professional',
                'base_price' => 199.99,
            ]
        );

        // Create Users (Manager Parent, Manager, Resellers)
        $managerParent = User::firstOrCreate(
            ['email' => 'manager-parent@example.com'],
            [
                'name' => 'Regional Manager',
                'username' => 'manager_parent_1',
                'password' => Hash::make('password'),
                'role' => UserRole::MANAGER_PARENT,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => null,
            ]
        );

        $manager = User::firstOrCreate(
            ['email' => 'manager@example.com'],
            [
                'name' => 'Area Manager',
                'username' => 'manager_1',
                'password' => Hash::make('password'),
                'role' => UserRole::MANAGER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $managerParent->id,
            ]
        );

        $reseller1 = User::firstOrCreate(
            ['email' => 'reseller1@example.com'],
            [
                'name' => 'John\'s Auto Shop',
                'username' => 'reseller_1',
                'password' => Hash::make('password'),
                'role' => UserRole::RESELLER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $manager->id,
            ]
        );

        $reseller2 = User::firstOrCreate(
            ['email' => 'reseller2@example.com'],
            [
                'name' => 'Smith Mechanics',
                'username' => 'reseller_2',
                'password' => Hash::make('password'),
                'role' => UserRole::RESELLER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $manager->id,
            ]
        );

        // Create Customers for Reseller 1
        $customer1 = User::firstOrCreate(
            ['email' => 'customer1@example.com'],
            [
                'name' => 'Bob\'s Auto Repair',
                'username' => 'customer_1',
                'password' => Hash::make('password'),
                'role' => UserRole::CUSTOMER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $reseller1->id,
            ]
        );

        $customer2 = User::firstOrCreate(
            ['email' => 'customer2@example.com'],
            [
                'name' => 'Quick Diagnostics Center',
                'username' => 'customer_2',
                'password' => Hash::make('password'),
                'role' => UserRole::CUSTOMER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $reseller1->id,
            ]
        );

        // Create Licenses with Activity Logs
        $activatedDate = Carbon::now()->subMonths(3);

        $expiresDate1 = $activatedDate->copy()->addDays(365);
        $license1 = License::firstOrCreate(
            ['tenant_id' => $tenant1->id, 'bios_id' => 'BIOS001ABC123'],
            [
                'customer_id' => $customer1->id,
                'reseller_id' => $reseller1->id,
                'program_id' => $program1->id,
                'price' => 150.00,
                'duration_days' => 365,
                'activated_at' => $activatedDate,
                'expires_at' => $expiresDate1,
                'status' => 'active',
                'created_by_reseller_id' => $reseller1->id,
            ]
        );

        // Create activity log for license 1
        ActivityLog::create([
            'tenant_id' => $tenant1->id,
            'user_id' => $reseller1->id,
            'action' => 'license.activated',
            'description' => 'License activated for Bob\'s Auto Repair',
            'metadata' => json_encode([
                'license_id' => $license1->id,
                'bios_id' => $license1->bios_id,
                'customer_id' => $customer1->id,
                'customer_name' => $customer1->name,
                'reseller_id' => $reseller1->id,
                'program_id' => $program1->id,
                'price' => 150.00,
                'duration_days' => 365,
                'activated_at' => $activatedDate->toIso8601String(),
            ]),
            'ip_address' => '127.0.0.1',
            'created_at' => $activatedDate,
        ]);

        // Create second license
        $activatedDate2 = $activatedDate->copy()->subMonths(1);
        $expiresDate2 = $activatedDate2->copy()->addDays(730);
        $license2 = License::firstOrCreate(
            ['tenant_id' => $tenant1->id, 'bios_id' => 'BIOS002XYZ789'],
            [
                'customer_id' => $customer2->id,
                'reseller_id' => $reseller1->id,
                'program_id' => $program2->id,
                'price' => 299.99,
                'duration_days' => 730,
                'activated_at' => $activatedDate2,
                'expires_at' => $expiresDate2,
                'status' => 'active',
                'created_by_reseller_id' => $reseller1->id,
            ]
        );

        ActivityLog::create([
            'tenant_id' => $tenant1->id,
            'user_id' => $reseller1->id,
            'action' => 'license.activated',
            'description' => 'License activated for Quick Diagnostics Center',
            'metadata' => json_encode([
                'license_id' => $license2->id,
                'bios_id' => $license2->bios_id,
                'customer_id' => $customer2->id,
                'customer_name' => $customer2->name,
                'reseller_id' => $reseller1->id,
                'program_id' => $program2->id,
                'price' => 299.99,
                'duration_days' => 730,
                'activated_at' => $activatedDate2->toIso8601String(),
            ]),
            'ip_address' => '127.0.0.1',
            'created_at' => $activatedDate2,
        ]);

        // Create licenses for reseller 2
        $customer3 = User::firstOrCreate(
            ['email' => 'customer3@example.com'],
            [
                'name' => 'Premium Auto Service',
                'username' => 'customer_3',
                'password' => Hash::make('password'),
                'role' => UserRole::CUSTOMER,
                'status' => 'active',
                'tenant_id' => $tenant1->id,
                'created_by' => $reseller2->id,
            ]
        );

        $activatedDate3 = $activatedDate->copy()->subWeeks(2);
        $expiresDate3 = $activatedDate3->copy()->addDays(365);
        $license3 = License::firstOrCreate(
            ['tenant_id' => $tenant1->id, 'bios_id' => 'BIOS003DEF456'],
            [
                'customer_id' => $customer3->id,
                'reseller_id' => $reseller2->id,
                'program_id' => $program1->id,
                'price' => 199.50,
                'duration_days' => 365,
                'activated_at' => $activatedDate3,
                'expires_at' => $expiresDate3,
                'status' => 'active',
                'created_by_reseller_id' => $reseller2->id,
            ]
        );

        ActivityLog::create([
            'tenant_id' => $tenant1->id,
            'user_id' => $reseller2->id,
            'action' => 'license.activated',
            'description' => 'License activated for Premium Auto Service',
            'metadata' => json_encode([
                'license_id' => $license3->id,
                'bios_id' => $license3->bios_id,
                'customer_id' => $customer3->id,
                'customer_name' => $customer3->name,
                'reseller_id' => $reseller2->id,
                'program_id' => $program1->id,
                'price' => 199.50,
                'duration_days' => 365,
                'activated_at' => $activatedDate3->toIso8601String(),
            ]),
            'ip_address' => '127.0.0.1',
            'created_at' => $activatedDate3,
        ]);
    }
}
