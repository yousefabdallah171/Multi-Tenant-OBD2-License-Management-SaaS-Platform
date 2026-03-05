<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Strip the `{external_username}-` prefix from bios_id for licenses
        // where bios_id starts with external_username + '-'
        DB::statement("
            UPDATE licenses
            SET bios_id = SUBSTRING(bios_id, LENGTH(external_username) + 2)
            WHERE external_username IS NOT NULL
              AND external_username != ''
              AND bios_id LIKE CONCAT(external_username, '-%')
        ");
    }

    public function down(): void
    {
        // Non-reversible data migration — we cannot know which records were modified
        // without storing the original values. Safe to no-op.
    }
};
