<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\ApiLog;
use App\Models\BiosAccessLog;
use App\Models\BiosBlacklist;
use App\Models\BiosConflict;
use App\Models\FinancialReport;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserBalance;
use App\Models\UserIpLog;
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

        $this->seedSupportingData($tenant, $parent, $reseller, $customer);
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

    private function seedSupportingData(Tenant $tenant, User $parent, User $reseller, User $customer): void
    {
        UserIpLog::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $reseller->id, 'action' => 'login'],
            [
                'ip_address' => '203.0.113.10',
                'country' => 'Egypt',
                'city' => 'Cairo',
                'isp' => 'Fiber ISP',
                'reputation_score' => 'low',
            ]
        );

        UserIpLog::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $customer->id, 'action' => 'activation'],
            [
                'ip_address' => '198.51.100.18',
                'country' => 'Saudi Arabia',
                'city' => 'Riyadh',
                'isp' => 'Mobile ISP',
                'reputation_score' => 'medium',
            ]
        );

        ActivityLog::query()->updateOrCreate(
            ['tenant_id' => null, 'action' => 'tenant.created', 'description' => 'Seeded tenant created for Phase 02.'],
            [
                'user_id' => $parent->id,
                'metadata' => ['tenant_id' => $tenant->id],
                'ip_address' => '127.0.0.1',
            ]
        );

        ActivityLog::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'action' => 'license.activated', 'description' => 'Seeded activation recorded for sample customer.'],
            [
                'user_id' => $reseller->id,
                'metadata' => ['bios_id' => 'BIOS-1001', 'customer_id' => $customer->id],
                'ip_address' => '198.51.100.18',
            ]
        );

        ApiLog::query()->updateOrCreate(
            ['endpoint' => '/status', 'method' => 'GET', 'user_id' => $parent->id],
            [
                'tenant_id' => null,
                'request_body' => [],
                'response_body' => ['status' => 'ok'],
                'status_code' => 200,
                'response_time_ms' => 184,
            ]
        );

        ApiLog::query()->updateOrCreate(
            ['endpoint' => '/users', 'method' => 'GET', 'user_id' => $parent->id],
            [
                'tenant_id' => null,
                'request_body' => [],
                'response_body' => ['count' => 3],
                'status_code' => 200,
                'response_time_ms' => 226,
            ]
        );

        BiosBlacklist::query()->updateOrCreate(
            ['bios_id' => 'BIOS-BLACKLISTED-1'],
            [
                'added_by' => $parent->id,
                'reason' => 'Chargeback investigation',
                'status' => 'active',
            ]
        );

        BiosConflict::query()->updateOrCreate(
            ['bios_id' => 'BIOS-1002', 'tenant_id' => $tenant->id],
            [
                'attempted_by' => $reseller->id,
                'program_id' => Program::query()->where('tenant_id', $tenant->id)->firstOrFail()->id,
                'conflict_type' => 'duplicate',
                'resolved' => false,
            ]
        );

        BiosAccessLog::query()->updateOrCreate(
            ['bios_id' => 'BIOS-1001', 'action' => 'activate', 'tenant_id' => $tenant->id],
            [
                'user_id' => $customer->id,
                'ip_address' => '198.51.100.18',
                'metadata' => ['status' => 'active', 'description' => 'Initial activation completed.'],
            ]
        );

        UserBalance::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $reseller->id],
            [
                'total_revenue' => 109.97,
                'total_activations' => 3,
                'pending_balance' => 74.50,
                'last_activity_at' => now(),
            ]
        );

        FinancialReport::query()->updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'report_type' => 'monthly',
                'period_start' => now()->startOfMonth()->toDateString(),
                'period_end' => now()->endOfMonth()->toDateString(),
            ],
            [
                'total_revenue' => 109.97,
                'total_activations' => 3,
                'total_renewals' => 1,
                'total_deactivations' => 0,
                'metadata' => ['top_reseller' => $reseller->email],
            ]
        );
    }
}
