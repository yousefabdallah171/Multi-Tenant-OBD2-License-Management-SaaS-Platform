<?php

namespace Database\Seeders;

use App\Models\Program;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class RealSoftwareSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'test-tenant')->firstOrFail();

        $program = Program::query()->updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'name' => 'OBD2SW Live Software',
            ],
            [
                'tenant_id' => $tenant->id,
                'name' => 'OBD2SW Live Software',
                'description' => 'Real external API integration - software_id configured via EXTERNAL_API_URL env variable.',
                'version' => '2.0.0',
                'download_link' => 'https://obd2sw.com/download/live',
                'trial_days' => 7,
                'base_price' => 25.00,
                'status' => 'active',
                'external_software_id' => 8,
                'has_external_api' => (bool) env('EXTERNAL_API_KEY'),
            ]
        );

        if (env('EXTERNAL_API_KEY')) {
            $program->setExternalApiKeyAttribute(env('EXTERNAL_API_KEY'));
            $program->save();
        }

        $this->command?->info('Real software seeded: OBD2SW Live Software (external_id=8, api=configured)');
    }
}
