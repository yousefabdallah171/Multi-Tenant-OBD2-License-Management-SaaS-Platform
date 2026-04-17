<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserBalance;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ComprehensiveTestDataSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            // Create Main Tenant with full hierarchy
            $tenant = Tenant::query()->create([
                'name' => 'Enterprise Solutions Inc',
                'slug' => 'enterprise-solutions',
                'status' => 'active',
                'settings' => ['currency' => 'USD'],
            ]);

            // Manager Parent
            $managerParent = $this->createUser(
                $tenant,
                'michael.johnson@enterprise.com',
                'Michael Johnson',
                'michael_johnson',
                UserRole::MANAGER_PARENT
            );

            // Managers under Manager Parent
            $manager1 = $this->createUser(
                $tenant,
                'sarah.williams@enterprise.com',
                'Sarah Williams',
                'sarah_williams',
                UserRole::MANAGER,
                $managerParent->id
            );

            $manager2 = $this->createUser(
                $tenant,
                'david.brown@enterprise.com',
                'David Brown',
                'david_brown',
                UserRole::MANAGER,
                $managerParent->id
            );

            // Resellers under Manager 1
            $reseller1 = $this->createUser(
                $tenant,
                'john.smith@reseller.com',
                'John Smith',
                'john_smith',
                UserRole::RESELLER,
                $manager1->id
            );

            $reseller2 = $this->createUser(
                $tenant,
                'jane.doe@reseller.com',
                'Jane Doe',
                'jane_doe',
                UserRole::RESELLER,
                $manager1->id
            );

            // Resellers under Manager 2
            $reseller3 = $this->createUser(
                $tenant,
                'robert.wilson@reseller.com',
                'Robert Wilson',
                'robert_wilson',
                UserRole::RESELLER,
                $manager2->id
            );

            // Programs
            $programs = [
                Program::query()->create([
                    'tenant_id' => $tenant->id,
                    'name' => 'Professional Suite',
                    'description' => 'Complete diagnostic toolkit for professionals',
                    'version' => '3.1.0',
                    'download_link' => 'https://example.com/pro',
                    'base_price' => 199.99,
                    'trial_days' => 14,
                    'status' => 'active',
                ]),
                Program::query()->create([
                    'tenant_id' => $tenant->id,
                    'name' => 'Enterprise Edition',
                    'description' => 'Enterprise-grade diagnostic platform',
                    'version' => '2.5.0',
                    'download_link' => 'https://example.com/enterprise',
                    'base_price' => 499.99,
                    'trial_days' => 30,
                    'status' => 'active',
                ]),
                Program::query()->create([
                    'tenant_id' => $tenant->id,
                    'name' => 'Advanced Analytics',
                    'description' => 'Advanced diagnostics with AI predictions',
                    'version' => '1.8.2',
                    'download_link' => 'https://example.com/analytics',
                    'base_price' => 349.99,
                    'trial_days' => 7,
                    'status' => 'active',
                ]),
            ];

            // Create multiple customers
            $customers = [];
            for ($i = 1; $i <= 20; $i++) {
                $customers[] = $this->createUser(
                    $tenant,
                    "customer$i@business.com",
                    "Customer Business $i",
                    "customer_$i",
                    UserRole::CUSTOMER
                );
            }

            // Create licenses with various statuses
            $licenses = [
                // Active licenses
                $this->createLicense($tenant, $programs[0], $customers[0], $reseller1, 'active', '2026-02-15', '2026-05-15'),
                $this->createLicense($tenant, $programs[1], $customers[1], $reseller1, 'active', '2026-03-01', '2026-09-01'),
                $this->createLicense($tenant, $programs[2], $customers[2], $reseller2, 'active', '2026-01-10', '2026-07-10'),
                $this->createLicense($tenant, $programs[0], $customers[3], $reseller3, 'active', '2026-04-01', '2026-10-01'),

                // Expired licenses
                $this->createLicense($tenant, $programs[0], $customers[4], $reseller1, 'expired', '2025-08-01', '2025-11-01'),
                $this->createLicense($tenant, $programs[1], $customers[5], $reseller2, 'expired', '2025-06-15', '2025-09-15'),
                $this->createLicense($tenant, $programs[2], $customers[6], $reseller3, 'expired', '2025-10-01', '2025-12-31'),

                // Suspended licenses
                $this->createLicense($tenant, $programs[0], $customers[7], $reseller1, 'suspended', '2026-02-01', '2026-08-01'),
                $this->createLicense($tenant, $programs[1], $customers[8], $reseller2, 'suspended', '2025-12-15', '2026-06-15'),
            ];

            // Setup user balances for resellers
            $this->setupResellerBalances([$reseller1, $reseller2, $reseller3]);

            $this->command?->info('✅ Comprehensive test data seeded: 1 tenant, 6 staff (hierarchy), 20 customers, 9 licenses, revenue tracking');
        });
    }

    private function createUser(
        Tenant $tenant,
        string $email,
        string $name,
        string $username,
        UserRole|string $role,
        ?int $createdBy = null
    ): User {
        $roleValue = $role instanceof UserRole ? $role->value : $role;

        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'tenant_id' => $tenant->id,
                'name' => $name,
                'username' => $username,
                'password' => Hash::make('password'),
                'role' => $roleValue,
                'status' => 'active',
                'created_by' => $createdBy,
                'username_locked' => false,
            ]
        );
    }

    private function createLicense(
        Tenant $tenant,
        Program $program,
        User $customer,
        User $reseller,
        string $status,
        string $startDate,
        string $endDate
    ): License {
        return License::query()->create([
            'tenant_id' => $tenant->id,
            'program_id' => $program->id,
            'customer_id' => $customer->id,
            'reseller_id' => $reseller->id,
            'bios_id' => 'BIOS-' . strtoupper(substr(md5(uniqid()), 0, 12)),
            'status' => $status,
            'activated_at' => Carbon::parse($startDate),
            'expires_at' => Carbon::parse($endDate),
            'price' => $program->base_price + rand(-50, 100),
            'duration_days' => Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)),
        ]);
    }

    private function setupResellerBalances(array $resellers): void
    {
        foreach ($resellers as $reseller) {
            UserBalance::query()->updateOrCreate(
                ['user_id' => $reseller->id],
                [
                    'total_activations' => rand(10, 50),
                    'total_revenue' => rand(2000, 15000),
                    'pending_balance' => rand(100, 1500),
                    'granted_value' => rand(500, 2000),
                ]
            );
        }
    }
}
