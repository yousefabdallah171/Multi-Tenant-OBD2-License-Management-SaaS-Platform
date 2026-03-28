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
            $table->timestamp('activated_at')->nullable()->change();
        });

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

        Schema::table('licenses', function (Blueprint $table): void {
            $table->timestamp('activated_at')->nullable(false)->change();
        });
    }
};
