<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('licenses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reseller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->string('bios_id');
            $table->integer('duration_days');
            $table->decimal('price', 10, 2);
            $table->timestamp('activated_at');
            $table->timestamp('expires_at');
            $table->enum('status', ['active', 'expired', 'suspended', 'pending'])->default('pending');
            $table->timestamps();

            $table->index('bios_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('licenses');
    }
};
