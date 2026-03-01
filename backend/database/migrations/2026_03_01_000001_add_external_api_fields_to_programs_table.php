<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table): void {
            $table->text('external_api_key_encrypted')->nullable()->after('icon');
            $table->unsignedInteger('external_software_id')->nullable()->after('external_api_key_encrypted');
            $table->boolean('has_external_api')->default(false)->after('external_software_id');
        });

        Schema::table('licenses', function (Blueprint $table): void {
            $table->string('external_username')->nullable()->after('bios_id');
            $table->text('external_activation_response')->nullable()->after('external_username');
            $table->text('external_deletion_response')->nullable()->after('external_activation_response');
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropColumn([
                'external_username',
                'external_activation_response',
                'external_deletion_response',
            ]);
        });

        Schema::table('programs', function (Blueprint $table): void {
            $table->dropColumn([
                'external_api_key_encrypted',
                'external_software_id',
                'has_external_api',
            ]);
        });
    }
};
