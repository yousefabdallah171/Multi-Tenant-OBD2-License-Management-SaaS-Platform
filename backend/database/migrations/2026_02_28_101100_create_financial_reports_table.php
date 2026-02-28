<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('report_type', ['daily', 'weekly', 'monthly']);
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('total_revenue', 12, 2)->default(0);
            $table->unsignedInteger('total_activations')->default(0);
            $table->unsignedInteger('total_renewals')->default(0);
            $table->unsignedInteger('total_deactivations')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'period_start', 'period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_reports');
    }
};
