<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_logs', function (Blueprint $table): void {
            $table->index(['tenant_id', 'created_at'], 'api_logs_tenant_created_at_idx');
            $table->index(['tenant_id', 'status_code', 'created_at'], 'api_logs_tenant_status_created_at_idx');
            $table->index(['tenant_id', 'method', 'created_at'], 'api_logs_tenant_method_created_at_idx');
        });
    }

    public function down(): void
    {
        Schema::table('api_logs', function (Blueprint $table): void {
            $table->dropIndex('api_logs_tenant_created_at_idx');
            $table->dropIndex('api_logs_tenant_status_created_at_idx');
            $table->dropIndex('api_logs_tenant_method_created_at_idx');
        });
    }
};
