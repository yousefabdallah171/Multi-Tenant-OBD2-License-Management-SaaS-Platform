<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RevenueAlignmentQaSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->cleanupExistingQaFixtures();

            foreach ($this->tenantBlueprints() as $blueprint) {
                $this->seedTenantFixture($blueprint);
            }
        });
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function tenantBlueprints(): array
    {
        return [
            [
                'name' => 'QA Revenue Alpha',
                'slug' => 'qa-revenue-alpha',
                'manager_parent' => ['name' => 'QA Alpha Parent', 'username' => 'qa_alpha_parent', 'email' => 'qa.alpha.parent@obd2sw.com'],
                'manager' => ['name' => 'QA Alpha Manager', 'username' => 'qa_alpha_manager', 'email' => 'qa.alpha.manager@obd2sw.com'],
                'resellers' => [
                    ['name' => 'QA Alpha Reseller 1', 'username' => 'qa_alpha_reseller1', 'email' => 'qa.alpha.reseller1@obd2sw.com'],
                    ['name' => 'QA Alpha Reseller 2', 'username' => 'qa_alpha_reseller2', 'email' => 'qa.alpha.reseller2@obd2sw.com'],
                ],
                'programs' => [
                    ['name' => 'QA Alpha Core', 'base_price' => 129],
                    ['name' => 'QA Alpha Pro', 'base_price' => 249],
                ],
                'sales' => [
                    ['seller' => 'manager_parent', 'program' => 0, 'customer' => 0, 'price' => 180, 'activated_at' => '2025-05-12 10:00:00', 'duration_days' => 30, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'manager', 'program' => 1, 'customer' => 1, 'price' => 220, 'activated_at' => '2025-07-18 11:00:00', 'duration_days' => 90, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'reseller:0', 'program' => 0, 'customer' => 2, 'price' => 130, 'activated_at' => '2025-09-04 09:30:00', 'duration_days' => 30, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'reseller:0', 'program' => 1, 'customer' => 3, 'price' => 260, 'activated_at' => '2025-11-23 16:15:00', 'duration_days' => 120, 'status' => 'expired', 'action' => 'license.renewed'],
                    ['seller' => 'reseller:1', 'program' => 0, 'customer' => 4, 'price' => 145, 'activated_at' => '2026-01-10 08:45:00', 'duration_days' => 45, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'reseller:1', 'program' => 1, 'customer' => 5, 'price' => 275, 'activated_at' => '2026-03-01 13:00:00', 'duration_days' => 60, 'status' => 'active', 'action' => 'license.activated'],
                ],
            ],
            [
                'name' => 'QA Revenue Beta',
                'slug' => 'qa-revenue-beta',
                'manager_parent' => ['name' => 'QA Beta Parent', 'username' => 'qa_beta_parent', 'email' => 'qa.beta.parent@obd2sw.com'],
                'manager' => ['name' => 'QA Beta Manager', 'username' => 'qa_beta_manager', 'email' => 'qa.beta.manager@obd2sw.com'],
                'resellers' => [
                    ['name' => 'QA Beta Reseller 1', 'username' => 'qa_beta_reseller1', 'email' => 'qa.beta.reseller1@obd2sw.com'],
                    ['name' => 'QA Beta Reseller 2', 'username' => 'qa_beta_reseller2', 'email' => 'qa.beta.reseller2@obd2sw.com'],
                ],
                'programs' => [
                    ['name' => 'QA Beta Core', 'base_price' => 99],
                    ['name' => 'QA Beta Enterprise', 'base_price' => 299],
                ],
                'sales' => [
                    ['seller' => 'manager_parent', 'program' => 1, 'customer' => 0, 'price' => 310, 'activated_at' => '2025-06-08 14:00:00', 'duration_days' => 365, 'status' => 'active', 'action' => 'license.activated'],
                    ['seller' => 'manager', 'program' => 0, 'customer' => 1, 'price' => 110, 'activated_at' => '2025-08-22 10:30:00', 'duration_days' => 30, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'reseller:0', 'program' => 0, 'customer' => 2, 'price' => 120, 'activated_at' => '2025-10-12 09:15:00', 'duration_days' => 60, 'status' => 'expired', 'action' => 'license.renewed'],
                    ['seller' => 'reseller:0', 'program' => 1, 'customer' => 3, 'price' => 330, 'activated_at' => '2025-12-05 12:00:00', 'duration_days' => 120, 'status' => 'active', 'action' => 'license.activated'],
                    ['seller' => 'reseller:1', 'program' => 1, 'customer' => 4, 'price' => 290, 'activated_at' => '2026-02-14 15:40:00', 'duration_days' => 90, 'status' => 'active', 'action' => 'license.activated'],
                ],
            ],
            [
                'name' => 'QA Revenue Gamma',
                'slug' => 'qa-revenue-gamma',
                'manager_parent' => ['name' => 'QA Gamma Parent', 'username' => 'qa_gamma_parent', 'email' => 'qa.gamma.parent@obd2sw.com'],
                'manager' => ['name' => 'QA Gamma Manager', 'username' => 'qa_gamma_manager', 'email' => 'qa.gamma.manager@obd2sw.com'],
                'resellers' => [
                    ['name' => 'QA Gamma Reseller 1', 'username' => 'qa_gamma_reseller1', 'email' => 'qa.gamma.reseller1@obd2sw.com'],
                    ['name' => 'QA Gamma Reseller 2', 'username' => 'qa.gamma.reseller2', 'email' => 'qa.gamma.reseller2@obd2sw.com'],
                ],
                'programs' => [
                    ['name' => 'QA Gamma Lite', 'base_price' => 79],
                    ['name' => 'QA Gamma Max', 'base_price' => 189],
                ],
                'sales' => [
                    ['seller' => 'manager_parent', 'program' => 0, 'customer' => 0, 'price' => 85, 'activated_at' => '2025-05-20 10:00:00', 'duration_days' => 30, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'manager', 'program' => 1, 'customer' => 1, 'price' => 195, 'activated_at' => '2025-09-16 11:20:00', 'duration_days' => 180, 'status' => 'active', 'action' => 'license.activated'],
                    ['seller' => 'reseller:0', 'program' => 0, 'customer' => 2, 'price' => 90, 'activated_at' => '2025-11-02 09:10:00', 'duration_days' => 30, 'status' => 'expired', 'action' => 'license.activated'],
                    ['seller' => 'reseller:1', 'program' => 1, 'customer' => 3, 'price' => 205, 'activated_at' => '2026-03-22 18:05:00', 'duration_days' => 45, 'status' => 'active', 'action' => 'license.renewed'],
                ],
            ],
        ];
    }

    private function cleanupExistingQaFixtures(): void
    {
        $qaTenants = Tenant::query()
            ->where('slug', 'like', 'qa-revenue-%')
            ->get(['id']);

        $tenantIds = $qaTenants->pluck('id')->all();

        if ($tenantIds !== []) {
            ActivityLog::query()->whereIn('tenant_id', $tenantIds)->delete();
            Tenant::query()->whereIn('id', $tenantIds)->delete();
        }

        $qaEmails = User::query()
            ->where('email', 'like', 'qa.%@obd2sw.com')
            ->pluck('id')
            ->all();

        if ($qaEmails !== []) {
            ActivityLog::query()->whereIn('user_id', $qaEmails)->delete();
            User::query()->whereIn('id', $qaEmails)->delete();
        }
    }

    /**
     * @param  array<string, mixed>  $blueprint
     */
    private function seedTenantFixture(array $blueprint): void
    {
        $tenant = Tenant::query()->create([
            'name' => $blueprint['name'],
            'slug' => $blueprint['slug'],
            'status' => 'active',
            'settings' => ['currency' => 'USD'],
        ]);

        $managerParent = $this->createSeller($tenant, $blueprint['manager_parent'], UserRole::MANAGER_PARENT);
        $manager = $this->createSeller($tenant, $blueprint['manager'], UserRole::MANAGER, $managerParent->id);

        $resellers = collect($blueprint['resellers'])
            ->map(fn (array $seller): User => $this->createSeller($tenant, $seller, UserRole::RESELLER, $manager->id))
            ->values();

        $programs = collect($blueprint['programs'])
            ->map(fn (array $program): Program => Program::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $program['name'],
                'description' => $program['name'].' QA fixture program',
                'version' => '1.0',
                'download_link' => 'https://example.test/download/'.$tenant->slug.'/'.Str::slug($program['name']),
                'trial_days' => 7,
                'base_price' => $program['base_price'],
                'status' => 'active',
            ]))
            ->values();

        $customers = collect(range(1, 6))
            ->map(function (int $index) use ($tenant, $resellers): User {
                $owner = $resellers[($index - 1) % max($resellers->count(), 1)];

                return User::query()->create([
                    'tenant_id' => $tenant->id,
                    'name' => sprintf('%s Customer %d', $tenant->name, $index),
                    'username' => Str::slug($tenant->slug.'-customer-'.$index),
                    'email' => sprintf('%s.customer%d@obd2sw.com', str_replace('-', '.', $tenant->slug), $index),
                    'password' => 'password',
                    'role' => UserRole::CUSTOMER,
                    'status' => 'active',
                    'created_by' => $owner->id,
                    'username_locked' => false,
                ]);
            })
            ->values();

        foreach ($blueprint['sales'] as $sale) {
            $seller = $this->resolveSeller($sale['seller'], $managerParent, $manager, $resellers);
            $program = $programs[(int) $sale['program']];
            $customer = $customers[(int) $sale['customer']];
            $activatedAt = CarbonImmutable::parse($sale['activated_at']);
            $durationDays = (int) $sale['duration_days'];
            $status = (string) $sale['status'];
            $price = (float) $sale['price'];
            $biosId = Str::upper(Str::random(10));

            $license = License::query()->create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'reseller_id' => $seller->id,
                'program_id' => $program->id,
                'bios_id' => $biosId,
                'duration_days' => $durationDays,
                'price' => $price,
                'activated_at' => $activatedAt,
                'expires_at' => $activatedAt->addDays($durationDays),
                'status' => $status,
            ]);

            ActivityLog::query()->create([
                'tenant_id' => $tenant->id,
                'user_id' => $seller->id,
                'action' => $sale['action'],
                'description' => sprintf('%s %s for %s', $sale['action'], $program->name, $customer->username),
                'metadata' => [
                    'license_id' => $license->id,
                    'price' => $price,
                    'program_id' => $program->id,
                    'customer_id' => $customer->id,
                    'bios_id' => $biosId,
                    'attribution_type' => 'earned',
                ],
                'created_at' => $activatedAt,
                'updated_at' => $activatedAt,
            ]);
        }
    }

    /**
     * @param  array<string, string>  $payload
     */
    private function createSeller(Tenant $tenant, array $payload, UserRole $role, ?int $createdBy = null): User
    {
        return User::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'password' => 'password',
            'role' => $role,
            'status' => 'active',
            'created_by' => $createdBy,
            'username_locked' => false,
        ]);
    }

    /**
     * @param  Collection<int, User>  $resellers
     */
    private function resolveSeller(string $sellerKey, User $managerParent, User $manager, $resellers): User
    {
        if ($sellerKey === 'manager_parent') {
            return $managerParent;
        }

        if ($sellerKey === 'manager') {
            return $manager;
        }

        if (str_starts_with($sellerKey, 'reseller:')) {
            $index = (int) Str::after($sellerKey, 'reseller:');

            return $resellers[$index];
        }

        throw new \InvalidArgumentException('Unknown seller key '.$sellerKey);
    }
}
