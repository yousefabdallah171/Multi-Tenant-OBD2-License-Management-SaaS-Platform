<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Licenses table - critical for customer/dashboard queries
        Schema::table('licenses', function (Blueprint $table) {
            // Composite indexes for common query patterns
            if (!$this->indexExists('licenses', 'idx_tenant_customer')) {
                $table->index(['tenant_id', 'customer_id'], 'idx_tenant_customer');
            }
            if (!$this->indexExists('licenses', 'idx_tenant_status')) {
                $table->index(['tenant_id', 'status'], 'idx_tenant_status');
            }
            if (!$this->indexExists('licenses', 'idx_program_tenant_activated')) {
                $table->index(['program_id', 'tenant_id', 'activated_at'], 'idx_program_tenant_activated');
            }
        });

        // Activity logs - for activity log queries
        Schema::table('activity_logs', function (Blueprint $table) {
            if (!$this->indexExists('activity_logs', 'idx_activity_logs_user_created')) {
                $table->index(['user_id', 'created_at'], 'idx_activity_logs_user_created');
            }
            if (!$this->indexExists('activity_logs', 'idx_activity_logs_tenant_created')) {
                $table->index(['tenant_id', 'created_at'], 'idx_activity_logs_tenant_created');
            }
        });

        // User IP logs - for IP analytics
        Schema::table('user_ip_logs', function (Blueprint $table) {
            if (!$this->indexExists('user_ip_logs', 'idx_user_ip_logs_user_created')) {
                $table->index(['user_id', 'created_at'], 'idx_user_ip_logs_user_created');
            }
        });

        // BIOS blacklist - critical for activation checks
        Schema::table('bios_blacklist', function (Blueprint $table) {
            if (!$this->indexExists('bios_blacklist', 'idx_bios_status')) {
                $table->index(['bios_id', 'status'], 'idx_bios_status');
            }
        });

        // BIOS conflicts - for conflict detection
        Schema::table('bios_conflicts', function (Blueprint $table) {
            if (!$this->indexExists('bios_conflicts', 'idx_bios_conflicts_tenant_created')) {
                $table->index(['tenant_id', 'created_at'], 'idx_bios_conflicts_tenant_created');
            }
        });

        // Users table - for role-based queries
        Schema::table('users', function (Blueprint $table) {
            if (!$this->indexExists('users', 'idx_tenant_role')) {
                $table->index(['tenant_id', 'role'], 'idx_tenant_role');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop all added indexes
        $indexesToDrop = [
            'licenses' => ['idx_tenant_customer', 'idx_tenant_status', 'idx_program_tenant_activated'],
            'activity_logs' => ['idx_activity_logs_user_created', 'idx_activity_logs_tenant_created'],
            'user_ip_logs' => ['idx_user_ip_logs_user_created'],
            'bios_blacklist' => ['idx_bios_status'],
            'bios_conflicts' => ['idx_bios_conflicts_tenant_created'],
            'users' => ['idx_tenant_role'],
        ];

        foreach ($indexesToDrop as $table => $indexes) {
            Schema::table($table, function (Blueprint $table) use ($indexes) {
                $table->dropIndex($indexes);
            });
        }
    }

    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $indexName): bool
    {
        try {
            $connection = Schema::getConnection();
            $result = $connection->selectOne("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
            return $result !== null;
        } catch (\Exception $e) {
            return false;
        }
    }
};
