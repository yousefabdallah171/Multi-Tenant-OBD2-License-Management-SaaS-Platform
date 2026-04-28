<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE licenses MODIFY COLUMN status ENUM('active','expired','suspended','cancelled','pending') NOT NULL DEFAULT 'pending'");
        }

        DB::statement("UPDATE licenses SET status = 'cancelled' WHERE status = 'suspended'");
    }

    public function down(): void
    {
        DB::statement("UPDATE licenses SET status = 'suspended' WHERE status = 'cancelled'");

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE licenses MODIFY COLUMN status ENUM('active','expired','suspended','pending') NOT NULL DEFAULT 'pending'");
        }
    }
};
