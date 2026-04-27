<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Only proceed if table exists
        if (!Schema::hasTable('user_username_history')) {
            return;
        }

        // The unique constraint on (tenant_id, old_username) incorrectly blocks renaming
        // back to a previously-used username (e.g. undo scenarios). A username can appear
        // as old_username multiple times over its lifetime, so only an index is needed.
        DB::statement('ALTER TABLE user_username_history DROP INDEX IF EXISTS uuh_tenant_old_username_unique');

        Schema::table('user_username_history', function (Blueprint $table): void {
            // Only add index if it doesn't exist
            if (!$this->indexExists('user_username_history', 'uuh_tenant_old_username_idx')) {
                $table->index(['tenant_id', 'old_username'], 'uuh_tenant_old_username_idx');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('user_username_history')) {
            return;
        }

        DB::statement('ALTER TABLE user_username_history DROP INDEX IF EXISTS uuh_tenant_old_username_idx');

        Schema::table('user_username_history', function (Blueprint $table): void {
            // Only add unique if it doesn't exist
            $columns = DB::select(DB::raw("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'user_username_history' AND CONSTRAINT_NAME = 'uuh_tenant_old_username_unique'"));
            if (empty($columns)) {
                $table->unique(['tenant_id', 'old_username'], 'uuh_tenant_old_username_unique');
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = DB::select(DB::raw("SHOW INDEXES FROM {$table} WHERE Key_name = '{$indexName}'"));
        return !empty($indexes);
    }
};
