<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->index('status', 'licenses_status_idx');
            $table->index('expires_at', 'licenses_expires_at_idx');
            $table->index(['tenant_id', 'status'], 'licenses_tenant_status_idx');
            $table->index(['tenant_id', 'reseller_id'], 'licenses_tenant_reseller_idx');
            $table->index(['tenant_id', 'customer_id'], 'licenses_tenant_customer_idx');
            $table->index(['tenant_id', 'activated_at'], 'licenses_tenant_activated_at_idx');
        });

        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->index('created_at', 'activity_logs_created_at_idx');
            $table->index(['tenant_id', 'created_at'], 'activity_logs_tenant_created_at_idx');
            $table->index(['user_id', 'created_at'], 'activity_logs_user_created_at_idx');
        });

        Schema::table('bios_conflicts', function (Blueprint $table): void {
            $table->index('bios_id', 'bios_conflicts_bios_id_idx');
            $table->index('created_at', 'bios_conflicts_created_at_idx');
            $table->index(['tenant_id', 'created_at'], 'bios_conflicts_tenant_created_at_idx');
        });

        Schema::table('user_ip_logs', function (Blueprint $table): void {
            $table->index(['tenant_id', 'created_at'], 'user_ip_logs_tenant_created_at_idx');
            $table->index(['user_id', 'created_at'], 'user_ip_logs_user_created_at_idx');
            $table->index(['tenant_id', 'ip_address'], 'user_ip_logs_tenant_ip_idx');
        });
    }

    public function down(): void
    {
        Schema::table('user_ip_logs', function (Blueprint $table): void {
            $table->dropIndex('user_ip_logs_tenant_created_at_idx');
            $table->dropIndex('user_ip_logs_user_created_at_idx');
            $table->dropIndex('user_ip_logs_tenant_ip_idx');
        });

        Schema::table('bios_conflicts', function (Blueprint $table): void {
            $table->dropIndex('bios_conflicts_bios_id_idx');
            $table->dropIndex('bios_conflicts_created_at_idx');
            $table->dropIndex('bios_conflicts_tenant_created_at_idx');
        });

        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->dropIndex('activity_logs_created_at_idx');
            $table->dropIndex('activity_logs_tenant_created_at_idx');
            $table->dropIndex('activity_logs_user_created_at_idx');
        });

        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_status_idx');
            $table->dropIndex('licenses_expires_at_idx');
            $table->dropIndex('licenses_tenant_status_idx');
            $table->dropIndex('licenses_tenant_reseller_idx');
            $table->dropIndex('licenses_tenant_customer_idx');
            $table->dropIndex('licenses_tenant_activated_at_idx');
        });
    }
};
