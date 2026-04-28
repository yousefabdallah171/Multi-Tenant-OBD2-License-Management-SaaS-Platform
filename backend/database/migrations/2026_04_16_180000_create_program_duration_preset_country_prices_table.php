<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_duration_preset_country_prices', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('program_duration_preset_id');
            $table->foreign('program_duration_preset_id', 'preset_country_price_preset_fk')
                ->references('id')
                ->on('program_duration_presets')
                ->cascadeOnDelete();
            $table->string('country_name', 120);
            $table->string('country_key', 160);
            $table->decimal('price', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['program_duration_preset_id', 'country_key'], 'preset_country_price_unique');
            $table->index(['program_duration_preset_id', 'is_active'], 'preset_country_price_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_duration_preset_country_prices');
    }
};
