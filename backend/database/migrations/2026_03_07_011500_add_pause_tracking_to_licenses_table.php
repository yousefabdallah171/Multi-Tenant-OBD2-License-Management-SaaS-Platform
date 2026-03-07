<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->timestamp('paused_at')->nullable()->after('activated_at_scheduled');
            $table->unsignedInteger('pause_remaining_minutes')->nullable()->after('paused_at');

            $table->index(['status', 'paused_at'], 'licenses_pause_state_idx');
        });

        DB::statement("
            UPDATE licenses
            SET
                paused_at = COALESCE(updated_at, created_at),
                pause_remaining_minutes = GREATEST(TIMESTAMPDIFF(MINUTE, COALESCE(updated_at, created_at), expires_at), 1)
            WHERE status = 'pending'
              AND (is_scheduled = 0 OR is_scheduled IS NULL)
              AND paused_at IS NULL
              AND external_deletion_response LIKE 'Paused locally.%'
              AND expires_at IS NOT NULL
        ");
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_pause_state_idx');
            $table->dropColumn(['paused_at', 'pause_remaining_minutes']);
        });
    }
};
