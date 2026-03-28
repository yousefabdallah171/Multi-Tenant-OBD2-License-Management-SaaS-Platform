<?php

namespace Tests\Concerns;

use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\User;

trait BuildsSecurityFixtures
{
    protected function createTenant(array $attributes = []): Tenant
    {
        return Tenant::factory()->create($attributes);
    }

    protected function createUser(string $role, ?Tenant $tenant = null, ?User $creator = null, array $attributes = []): User
    {
        return User::factory()->create([
            'tenant_id' => $tenant?->id,
            'role' => $role,
            'status' => 'active',
            'created_by' => $creator?->id,
            ...$attributes,
        ]);
    }

    protected function createProgram(Tenant $tenant, array $attributes = []): Program
    {
        return Program::factory()->create([
            'tenant_id' => $tenant->id,
            ...$attributes,
        ]);
    }

    protected function createLicense(User $seller, ?Program $program = null, ?User $customer = null, array $attributes = []): License
    {
        $tenantId = (int) $seller->tenant_id;
        $program ??= Program::factory()->create(['tenant_id' => $tenantId]);
        $customer ??= User::factory()->create([
            'tenant_id' => $tenantId,
            'role' => 'customer',
            'status' => 'active',
            'created_by' => $seller->id,
        ]);

        return License::factory()->create([
            'tenant_id' => $tenantId,
            'reseller_id' => $seller->id,
            'created_by_reseller_id' => $seller->id,
            'customer_id' => $customer->id,
            'program_id' => $program->id,
            'external_username' => $customer->username,
            ...$attributes,
        ]);
    }
}
