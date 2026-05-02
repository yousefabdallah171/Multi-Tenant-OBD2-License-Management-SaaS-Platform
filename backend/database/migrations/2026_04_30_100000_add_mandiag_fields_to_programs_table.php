<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->string('api_type', 32)->default('legacy')->after('has_external_api');
            $table->string('mandiag_software_key', 128)->nullable()->after('api_type');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->dropColumn(['api_type', 'mandiag_software_key']);
        });
    }
};
