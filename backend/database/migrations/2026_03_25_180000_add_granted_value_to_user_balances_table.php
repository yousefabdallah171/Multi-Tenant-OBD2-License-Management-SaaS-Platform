<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_balances', function (Blueprint $table): void {
            $table->decimal('granted_value', 12, 2)->default(0)->after('pending_balance');
        });
    }

    public function down(): void
    {
        Schema::table('user_balances', function (Blueprint $table): void {
            $table->dropColumn('granted_value');
        });
    }
};
