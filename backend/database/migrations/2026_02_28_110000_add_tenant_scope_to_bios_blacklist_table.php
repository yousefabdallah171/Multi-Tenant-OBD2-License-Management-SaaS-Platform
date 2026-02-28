<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bios_blacklist', function (Blueprint $table): void {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->dropUnique('bios_blacklist_bios_id_unique');
            $table->unique(['tenant_id', 'bios_id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('bios_blacklist', function (Blueprint $table): void {
            $table->dropIndex('bios_blacklist_tenant_id_status_index');
            $table->dropUnique('bios_blacklist_tenant_id_bios_id_unique');
            $table->dropConstrainedForeignId('tenant_id');
            $table->unique('bios_id');
        });
    }
};
