<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bios_blacklist', function (Blueprint $table): void {
            $table->id();
            $table->string('bios_id')->unique();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason');
            $table->enum('status', ['active', 'removed'])->default('active');
            $table->timestamps();

            $table->index('bios_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bios_blacklist');
    }
};
