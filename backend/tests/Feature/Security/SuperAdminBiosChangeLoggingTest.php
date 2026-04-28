<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class SuperAdminBiosChangeLoggingTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    public function test_super_admin_direct_bios_change_logs_under_target_license_tenant(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);
        $reseller = $this->createUser('reseller', $tenant, $manager);
        $license = $this->createLicense($reseller, null, null, [
            'bios_id' => 'SA-OLD-001',
            'status' => 'expired',
        ]);
        $superAdmin = $this->createUser('super_admin', null);

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/super-admin/bios-change-requests/direct', [
            'license_id' => $license->id,
            'new_bios_id' => 'SA-NEW-001',
        ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $activity = ActivityLog::query()
            ->where('action', 'bios.direct_changed')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame((int) $tenant->id, (int) $activity->tenant_id);
        $this->assertSame((int) $superAdmin->id, (int) $activity->user_id);
        $this->assertSame((int) $license->id, (int) ($activity->metadata['license_id'] ?? 0));
        $this->assertSame((int) $reseller->id, (int) ($activity->metadata['reseller_id'] ?? 0));
    }
}
