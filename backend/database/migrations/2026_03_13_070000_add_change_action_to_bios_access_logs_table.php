<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE bios_access_logs MODIFY COLUMN action ENUM('activate', 'deactivate', 'renew', 'check', 'blacklist', 'conflict', 'pause', 'resume', 'reactivate', 'change')");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE bios_access_logs MODIFY COLUMN action ENUM('activate', 'deactivate', 'renew', 'check', 'blacklist', 'conflict', 'pause', 'resume', 'reactivate')");
    }
};
