<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bios_change_requests') || Schema::hasColumn('bios_change_requests', 'tenant_id')) {
            return;
        }

        Schema::table('bios_change_requests', function (Blueprint $table): void {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->index('tenant_id');
        });

        DB::table('bios_change_requests')
            ->join('licenses', 'licenses.id', '=', 'bios_change_requests.license_id')
            ->whereNull('bios_change_requests.tenant_id')
            ->update([
                'bios_change_requests.tenant_id' => DB::raw('licenses.tenant_id'),
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('bios_change_requests') || ! Schema::hasColumn('bios_change_requests', 'tenant_id')) {
            return;
        }

        Schema::table('bios_change_requests', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id']);
            $table->dropConstrainedForeignId('tenant_id');
        });
    }
};
