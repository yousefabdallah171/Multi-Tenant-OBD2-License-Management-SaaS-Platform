<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->timestamp('paused_at')->nullable()->after('activated_at_scheduled');
            $table->unsignedInteger('pause_remaining_minutes')->nullable()->after('paused_at');

            $table->index(['status', 'paused_at'], 'licenses_pause_state_idx');
        });

        DB::table('licenses')
            ->select(['id', 'updated_at', 'created_at', 'expires_at'])
            ->where('status', 'pending')
            ->where(function ($query): void {
                $query->where('is_scheduled', 0)->orWhereNull('is_scheduled');
            })
            ->whereNull('paused_at')
            ->where('external_deletion_response', 'like', 'Paused locally.%')
            ->whereNotNull('expires_at')
            ->orderBy('id')
            ->chunkById(200, function ($licenses): void {
                foreach ($licenses as $license) {
                    $anchor = Carbon::parse($license->updated_at ?? $license->created_at);
                    $expiresAt = Carbon::parse($license->expires_at);
                    $remainingMinutes = max($anchor->diffInMinutes($expiresAt, false), 1);

                    DB::table('licenses')
                        ->where('id', $license->id)
                        ->update([
                            'paused_at' => $anchor,
                            'pause_remaining_minutes' => $remainingMinutes,
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_pause_state_idx');
            $table->dropColumn(['paused_at', 'pause_remaining_minutes']);
        });
    }
};
