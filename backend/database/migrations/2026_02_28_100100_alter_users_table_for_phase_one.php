<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->nullOnDelete();
            $table->string('username')->nullable()->after('name');
            $table->string('phone')->nullable()->after('email');
            $table->enum('role', UserRole::values())->default(UserRole::CUSTOMER->value)->after('password');
            $table->enum('status', ['active', 'suspended', 'inactive'])->default('active')->after('role');
            $table->foreignId('created_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->boolean('username_locked')->default(false)->after('created_by');

            $table->index('tenant_id');
            $table->index('role');
            $table->unique(['tenant_id', 'username']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('users_tenant_id_username_unique');
            $table->dropIndex(['tenant_id']);
            $table->dropIndex(['role']);
            $table->dropConstrainedForeignId('created_by');
            $table->dropConstrainedForeignId('tenant_id');
            $table->dropColumn(['username', 'phone', 'role', 'status', 'username_locked']);
        });
    }
};
