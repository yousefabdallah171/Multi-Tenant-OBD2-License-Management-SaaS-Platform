<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_duration_presets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->string('label', 50);
            $table->decimal('duration_days', 10, 4);
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('sort_order')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['program_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_duration_presets');
    }
};
