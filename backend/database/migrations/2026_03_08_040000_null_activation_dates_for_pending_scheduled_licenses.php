<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE licenses MODIFY activated_at TIMESTAMP NULL DEFAULT NULL');

        DB::table('licenses')
            ->where('status', 'pending')
            ->where('is_scheduled', true)
            ->update([
                'activated_at' => null,
                'activated_at_scheduled' => null,
            ]);
    }

    public function down(): void
    {
        DB::table('licenses')
            ->whereNull('activated_at')
            ->update([
                'activated_at' => DB::raw('COALESCE(scheduled_at, expires_at, CURRENT_TIMESTAMP)'),
            ]);

        DB::statement('ALTER TABLE licenses MODIFY activated_at TIMESTAMP NOT NULL');
    }
};
