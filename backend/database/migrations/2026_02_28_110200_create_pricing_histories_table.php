<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pricing_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reseller_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('program_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('old_price', 10, 2)->nullable();
            $table->decimal('new_price', 10, 2);
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->enum('change_type', ['single', 'bulk'])->default('single');
            $table->json('metadata')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_histories');
    }
};
