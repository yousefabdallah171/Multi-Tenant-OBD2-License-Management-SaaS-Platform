<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deleted_customers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('original_customer_id')->nullable();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('name');
            $table->string('email');
            $table->string('username')->nullable();
            $table->string('phone', 30)->nullable();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('deleted_at');
            $table->longText('snapshot');
            $table->integer('licenses_count')->default(0);
            $table->decimal('revenue_total', 12, 2)->default(0);
            $table->timestamps();

            $table->index('tenant_id');
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deleted_customers');
    }
};
