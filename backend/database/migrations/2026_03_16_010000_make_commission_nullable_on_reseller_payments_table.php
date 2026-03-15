<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reseller_payments', function (Blueprint $table): void {
            $table->dropForeign(['commission_id']);
            $table->foreignId('commission_id')->nullable()->change();
            $table->foreign('commission_id')->references('id')->on('reseller_commissions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reseller_payments', function (Blueprint $table): void {
            $table->dropForeign(['commission_id']);
            $table->foreignId('commission_id')->nullable(false)->change();
            $table->foreign('commission_id')->references('id')->on('reseller_commissions')->cascadeOnDelete();
        });
    }
};
