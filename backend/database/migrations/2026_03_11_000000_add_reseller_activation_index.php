<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->index(['reseller_id', 'activated_at'], 'licenses_reseller_activated_at_idx');
            $table->index(['tenant_id', 'reseller_id', 'activated_at'], 'licenses_tenant_reseller_activated_at_idx');
        });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_reseller_activated_at_idx');
            $table->dropIndex('licenses_tenant_reseller_activated_at_idx');
        });
    }
};
