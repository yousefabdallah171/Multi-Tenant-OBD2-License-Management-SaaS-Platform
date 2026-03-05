<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE licenses SET status = 'cancelled' WHERE status = 'suspended'");
    }

    public function down(): void
    {
        DB::statement("UPDATE licenses SET status = 'suspended' WHERE status = 'cancelled'");
    }
};
