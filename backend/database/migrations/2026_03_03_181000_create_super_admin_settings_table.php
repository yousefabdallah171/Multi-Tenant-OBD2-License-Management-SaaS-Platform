<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('super_admin_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('setting_key')->unique();
            $table->json('setting_value')->nullable();
            $table->timestamps();
        });

        DB::table('super_admin_settings')->insert([
            ['setting_key' => 'server_timezone', 'setting_value' => json_encode('UTC'), 'created_at' => now(), 'updated_at' => now()],
            ['setting_key' => 'dashboard_timezone', 'setting_value' => json_encode('UTC'), 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('super_admin_settings');
    }
};

