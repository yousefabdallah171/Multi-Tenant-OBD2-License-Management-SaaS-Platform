<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->timestamp('scheduled_at')->nullable()->after('expires_at');
            $table->string('scheduled_timezone', 64)->nullable()->after('scheduled_at');
            $table->boolean('is_scheduled')->default(false)->after('scheduled_timezone');
            $table->timestamp('activated_at_scheduled')->nullable()->after('is_scheduled');

            $table->index(['is_scheduled', 'scheduled_at'], 'licenses_scheduled_idx');
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_scheduled_idx');
            $table->dropColumn(['scheduled_at', 'scheduled_timezone', 'is_scheduled', 'activated_at_scheduled']);
        });
    }
};

