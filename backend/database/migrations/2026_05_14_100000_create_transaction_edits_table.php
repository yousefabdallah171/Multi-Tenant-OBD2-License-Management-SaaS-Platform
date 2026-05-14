<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_edits', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('license_id');
            $table->unsignedBigInteger('activity_log_id')->nullable();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('super_admin_id');
            $table->string('action', 50); // 'edit' or 'revert'
            $table->json('previous_values'); // snapshot before edit: {price: 70, customer_id: 42, ...}
            $table->json('new_values'); // what changed: {price: 75, customer_id: 43}
            $table->text('reason')->nullable(); // why was this change made?
            $table->timestamps();

            // Foreign keys
            $table->foreign('license_id')->references('id')->on('licenses')->cascadeOnDelete();
            $table->foreign('activity_log_id')->references('id')->on('activity_logs')->nullableOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('super_admin_id')->references('id')->on('users')->cascadeOnDelete();

            // Indexes for queries
            $table->index(['tenant_id', 'created_at']);
            $table->index(['license_id', 'created_at']);
            $table->index(['super_admin_id', 'created_at']);
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_edits');
    }
};
