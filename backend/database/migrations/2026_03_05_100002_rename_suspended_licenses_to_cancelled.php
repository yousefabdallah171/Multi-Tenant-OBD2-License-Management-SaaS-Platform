<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Expand the ENUM to include 'cancelled' alongside existing values
        DB::statement("ALTER TABLE licenses MODIFY COLUMN status ENUM('active','expired','suspended','cancelled','pending') NOT NULL DEFAULT 'pending'");

        // 2. Rename any existing 'suspended' rows to 'cancelled'
        DB::statement("UPDATE licenses SET status = 'cancelled' WHERE status = 'suspended'");
    }

    public function down(): void
    {
        DB::statement("UPDATE licenses SET status = 'suspended' WHERE status = 'cancelled'");
        DB::statement("ALTER TABLE licenses MODIFY COLUMN status ENUM('active','expired','suspended','pending') NOT NULL DEFAULT 'pending'");
    }
};
