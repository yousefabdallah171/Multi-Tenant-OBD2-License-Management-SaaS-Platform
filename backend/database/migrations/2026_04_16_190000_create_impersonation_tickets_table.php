<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('impersonation_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('actor_token_id')->nullable()->index();
            $table->string('actor_token_fingerprint', 64)->nullable()->index();
            $table->foreignId('target_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('secret_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable()->index();
            $table->string('used_ip', 45)->nullable();
            $table->string('used_user_agent', 1024)->nullable();
            $table->timestamps();

            $table->index(['actor_user_id', 'target_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('impersonation_tickets');
    }
};
