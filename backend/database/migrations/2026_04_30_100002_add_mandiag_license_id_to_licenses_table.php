<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->unsignedBigInteger('mandiag_license_id')->nullable()->after('external_deletion_response');
            $table->index('mandiag_license_id');
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex(['mandiag_license_id']);
            $table->dropColumn('mandiag_license_id');
        });
    }
};
