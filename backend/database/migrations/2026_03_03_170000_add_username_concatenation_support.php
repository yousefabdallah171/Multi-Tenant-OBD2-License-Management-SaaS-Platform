<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Reserved migration for username-bios concatenation rollout.
        // Current implementation is service-layer only.
    }

    public function down(): void
    {
        // No schema changes to rollback.
    }
};

