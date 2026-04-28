<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->timestamp('scheduled_last_attempt_at')->nullable()->after('scheduled_timezone');
            $table->timestamp('scheduled_failed_at')->nullable()->after('scheduled_last_attempt_at');
            $table->text('scheduled_failure_message')->nullable()->after('scheduled_failed_at');
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropColumn([
                'scheduled_last_attempt_at',
                'scheduled_failed_at',
                'scheduled_failure_message',
            ]);
        });
    }
};
