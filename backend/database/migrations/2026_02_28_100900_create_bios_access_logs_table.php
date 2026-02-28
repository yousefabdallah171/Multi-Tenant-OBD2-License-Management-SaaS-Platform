<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bios_access_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('bios_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('action', ['activate', 'deactivate', 'renew', 'check', 'blacklist', 'conflict']);
            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('bios_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bios_access_logs');
    }
};
