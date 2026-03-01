<?php

namespace Tests\Unit;

use App\Models\Program;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProgramModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_set_external_api_key_encrypts_and_decrypts_value(): void
    {
        $tenant = Tenant::query()->create([
            'name' => 'Tenant Program',
            'slug' => 'tenant-program',
            'status' => 'active',
        ]);

        $program = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Program A',
            'download_link' => 'https://example.com/download',
            'base_price' => 10,
            'status' => 'active',
        ]);

        $program->setExternalApiKeyAttribute('L9H2F7Q8XK6M4A');
        $program->save();
        $program->refresh();

        $this->assertNotSame('L9H2F7Q8XK6M4A', $program->getRawOriginal('external_api_key_encrypted'));
        $this->assertSame('L9H2F7Q8XK6M4A', $program->getDecryptedApiKey());
    }

    public function test_get_decrypted_api_key_returns_null_when_no_key_is_set(): void
    {
        $tenant = Tenant::query()->create([
            'name' => 'Tenant Empty Key',
            'slug' => 'tenant-empty-key',
            'status' => 'active',
        ]);

        $program = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Program B',
            'download_link' => 'https://example.com/download',
            'base_price' => 10,
            'status' => 'active',
        ]);

        $this->assertNull($program->getDecryptedApiKey());
    }

    public function test_program_array_output_does_not_expose_encrypted_key(): void
    {
        $tenant = Tenant::query()->create([
            'name' => 'Tenant Hidden Key',
            'slug' => 'tenant-hidden-key',
            'status' => 'active',
        ]);

        $program = Program::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Program C',
            'download_link' => 'https://example.com/download',
            'base_price' => 10,
            'status' => 'active',
        ]);

        $program->setExternalApiKeyAttribute('SECRET-KEY');
        $program->save();

        $serialized = $program->toArray();
        $this->assertArrayNotHasKey('external_api_key', $serialized);
        $this->assertArrayNotHasKey('external_api_key_encrypted', $serialized);
    }
}
