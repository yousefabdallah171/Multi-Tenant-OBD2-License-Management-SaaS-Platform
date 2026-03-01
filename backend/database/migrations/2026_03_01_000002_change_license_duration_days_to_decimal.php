<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->decimal('duration_days', 8, 3)->change();
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->integer('duration_days')->change();
        });
    }
};
