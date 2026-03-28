<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('licenses')
            ->select(['id', 'bios_id', 'external_username'])
            ->whereNotNull('external_username')
            ->where('external_username', '!=', '')
            ->orderBy('id')
            ->chunkById(200, function ($licenses): void {
                foreach ($licenses as $license) {
                    $prefix = (string) $license->external_username.'-';
                    $biosId = (string) ($license->bios_id ?? '');

                    if (! Str::startsWith($biosId, $prefix)) {
                        continue;
                    }

                    DB::table('licenses')
                        ->where('id', $license->id)
                        ->update([
                            'bios_id' => Str::after($biosId, $prefix),
                        ]);
                }
            });
    }

    public function down(): void
    {
        // Non-reversible data migration — we cannot know which records were modified
        // without storing the original values. Safe to no-op.
    }
};
