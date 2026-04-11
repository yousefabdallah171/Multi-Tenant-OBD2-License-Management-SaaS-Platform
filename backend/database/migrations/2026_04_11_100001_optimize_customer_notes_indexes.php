<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_notes', function (Blueprint $table) {
            // Add composite index for common query pattern
            $table->index(['tenant_id', 'customer_id', 'user_id', 'created_at'], 'idx_notes_tenant_customer_user_created');
            // Add index for quick user lookups
            $table->index(['user_id', 'created_at'], 'idx_notes_user_created');
        });
    }

    public function down(): void
    {
        Schema::table('customer_notes', function (Blueprint $table) {
            $table->dropIndex('idx_notes_tenant_customer_user_created');
            $table->dropIndex('idx_notes_user_created');
        });
    }
};
