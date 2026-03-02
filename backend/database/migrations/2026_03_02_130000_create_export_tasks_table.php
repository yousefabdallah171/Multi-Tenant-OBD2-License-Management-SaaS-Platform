<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('export_tasks', function (Blueprint $table): void {
            $table->string('id', 26)->primary();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('pending');
            $table->string('format', 10);
            $table->string('filename');
            $table->string('title')->nullable();
            $table->json('payload');
            $table->string('storage_disk')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('mime_type')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status'], 'export_tasks_user_status_idx');
            $table->index(['tenant_id', 'created_at'], 'export_tasks_tenant_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('export_tasks');
    }
};
