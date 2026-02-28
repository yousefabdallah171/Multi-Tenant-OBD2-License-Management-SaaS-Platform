<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_ip_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ip_address', 45);
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->string('isp')->nullable();
            $table->enum('reputation_score', ['low', 'medium', 'high'])->default('low');
            $table->string('action');
            $table->timestamps();

            $table->index('ip_address');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_ip_logs');
    }
};
