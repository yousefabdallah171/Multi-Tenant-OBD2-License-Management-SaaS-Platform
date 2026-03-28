<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsSecurityFixtures;
use Tests\TestCase;

class DashboardAppearanceSettingsTest extends TestCase
{
    use BuildsSecurityFixtures;
    use RefreshDatabase;

    private string $settingsPath;

    private ?string $originalSettings = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->settingsPath = storage_path('app/system-settings.json');
        $this->originalSettings = File::exists($this->settingsPath)
            ? (string) File::get($this->settingsPath)
            : null;

        if (File::exists($this->settingsPath)) {
            File::delete($this->settingsPath);
        }
    }

    protected function tearDown(): void
    {
        if ($this->originalSettings === null) {
            if (File::exists($this->settingsPath)) {
                File::delete($this->settingsPath);
            }
        } else {
            File::ensureDirectoryExists(dirname($this->settingsPath));
            File::put($this->settingsPath, $this->originalSettings);
        }

        parent::tearDown();
    }

    public function test_super_admin_can_update_dashboard_appearance_settings(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin', $tenant);

        Sanctum::actingAs($superAdmin);

        $this->putJson('/api/super-admin/settings', [
            'appearance' => [
                'dashboard' => [
                    'font_family' => '"IBM Plex Sans", sans-serif',
                    'font_sizes' => [
                        'display_px' => 34,
                        'heading_px' => 20,
                    ],
                    'font_weights' => [
                        'display' => 900,
                        'heading' => 800,
                    ],
                    'surfaces' => [
                        'cards' => [
                            'opacity_percent' => 88,
                            'brightness_percent' => 104,
                        ],
                    ],
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.appearance.dashboard.font_family', '"IBM Plex Sans", sans-serif')
            ->assertJsonPath('data.appearance.dashboard.font_sizes.display_px', 34)
            ->assertJsonPath('data.appearance.dashboard.font_weights.display', 900)
            ->assertJsonPath('data.appearance.dashboard.surfaces.cards.opacity_percent', 88);

        $this->getJson('/api/dashboard-appearance/settings')
            ->assertOk()
            ->assertJsonPath('data.font_family', '"IBM Plex Sans", sans-serif')
            ->assertJsonPath('data.font_sizes.display_px', 34)
            ->assertJsonPath('data.font_weights.display', 900)
            ->assertJsonPath('data.surfaces.cards.opacity_percent', 88);
    }

    public function test_dashboard_appearance_endpoint_is_available_to_all_dashboard_roles(): void
    {
        $tenant = $this->createTenant();
        $users = [
            $this->createUser('super_admin', $tenant),
            $this->createUser('manager_parent', $tenant),
            $this->createUser('manager', $tenant),
            $this->createUser('reseller', $tenant),
        ];

        foreach ($users as $user) {
            Sanctum::actingAs($user);

            $this->getJson('/api/dashboard-appearance/settings')
                ->assertOk()
                ->assertJsonPath('data.font_family', "'Cairo', ui-sans-serif, system-ui, -apple-system, sans-serif")
                ->assertJsonPath('data.font_sizes.display_px', 28)
                ->assertJsonPath('data.surfaces.badges.opacity_percent', 100);
        }
    }

    public function test_non_super_admin_cannot_update_dashboard_appearance_settings(): void
    {
        $tenant = $this->createTenant();
        $manager = $this->createUser('manager', $tenant);

        Sanctum::actingAs($manager);

        $this->putJson('/api/super-admin/settings', [
            'appearance' => [
                'dashboard' => [
                    'font_family' => '"Outfit", sans-serif',
                ],
            ],
        ])->assertForbidden();
    }

    public function test_dashboard_appearance_validation_rejects_unsafe_or_out_of_range_values(): void
    {
        $tenant = $this->createTenant();
        $superAdmin = $this->createUser('super_admin', $tenant);

        Sanctum::actingAs($superAdmin);

        $this->putJson('/api/super-admin/settings', [
            'appearance' => [
                'dashboard' => [
                    'font_family' => 'url(javascript:alert(1))',
                    'font_sizes' => [
                        'display_px' => 99,
                    ],
                    'font_weights' => [
                        'display' => 350,
                    ],
                    'surfaces' => [
                        'cards' => [
                            'opacity_percent' => 20,
                            'brightness_percent' => 200,
                        ],
                    ],
                ],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'appearance.dashboard.font_family',
                'appearance.dashboard.font_sizes.display_px',
                'appearance.dashboard.font_weights.display',
                'appearance.dashboard.surfaces.cards.opacity_percent',
                'appearance.dashboard.surfaces.cards.brightness_percent',
            ]);
    }
}
