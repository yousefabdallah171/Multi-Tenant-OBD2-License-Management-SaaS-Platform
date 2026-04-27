<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('user_username_history')) {
            Schema::create('user_username_history', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('old_username');
                $table->string('new_username');
                $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('reason', 500)->nullable();
                $table->timestamps();

                $table->unique(['tenant_id', 'old_username'], 'uuh_tenant_old_username_unique');
                $table->index(['tenant_id', 'user_id', 'created_at'], 'uuh_tenant_user_created_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_username_history');
    }
};

