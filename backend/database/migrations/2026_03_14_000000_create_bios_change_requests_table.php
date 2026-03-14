<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bios_change_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('license_id')->constrained('licenses')->cascadeOnDelete();
            $table->foreignId('reseller_id')->constrained('users')->cascadeOnDelete();
            $table->string('old_bios_id');
            $table->string('new_bios_id');
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected', 'approved_pending_sync'])->default('pending');
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reviewer_notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('tenant_id');
            $table->index('reseller_id');
            $table->index('license_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bios_change_requests');
    }
};
