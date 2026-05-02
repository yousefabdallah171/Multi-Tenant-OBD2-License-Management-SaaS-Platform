<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('mandiag_sub_id', 64)->nullable()->after('country_name');
            $table->json('mandiag_priced_software_keys')->nullable()->after('mandiag_sub_id');
            $table->index('mandiag_sub_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['mandiag_sub_id']);
            $table->dropColumn(['mandiag_sub_id', 'mandiag_priced_software_keys']);
        });
    }
};
