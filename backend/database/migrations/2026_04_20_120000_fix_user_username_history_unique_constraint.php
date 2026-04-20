<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_username_history', function (Blueprint $table): void {
            // The unique constraint on (tenant_id, old_username) incorrectly blocks renaming
            // back to a previously-used username (e.g. undo scenarios). A username can appear
            // as old_username multiple times over its lifetime, so only an index is needed.
            $table->dropUnique('uuh_tenant_old_username_unique');
            $table->index(['tenant_id', 'old_username'], 'uuh_tenant_old_username_idx');
        });
    }

    public function down(): void
    {
        Schema::table('user_username_history', function (Blueprint $table): void {
            $table->dropIndex('uuh_tenant_old_username_idx');
            $table->unique(['tenant_id', 'old_username'], 'uuh_tenant_old_username_unique');
        });
    }
};
