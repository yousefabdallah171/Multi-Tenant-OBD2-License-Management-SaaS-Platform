<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE bios_access_logs MODIFY COLUMN action ENUM('activate', 'deactivate', 'renew', 'check', 'blacklist', 'conflict', 'pause', 'resume', 'reactivate')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE bios_access_logs MODIFY COLUMN action ENUM('activate', 'deactivate', 'renew', 'check', 'blacklist', 'conflict')");
    }
};
