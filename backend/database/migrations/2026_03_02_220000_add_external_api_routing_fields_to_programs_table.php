<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->string('external_api_base_url', 1000)->nullable()->after('external_software_id');
            $table->string('external_logs_endpoint', 100)->default('apilogs')->after('external_api_base_url');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->dropColumn([
                'external_api_base_url',
                'external_logs_endpoint',
            ]);
        });
    }
};
