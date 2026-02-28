<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->string('file_size')->nullable()->after('download_link');
            $table->text('system_requirements')->nullable()->after('file_size');
            $table->string('installation_guide_url')->nullable()->after('system_requirements');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->dropColumn([
                'file_size',
                'system_requirements',
                'installation_guide_url',
            ]);
        });
    }
};
