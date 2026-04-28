<?php

namespace App\Http\Middleware;

use App\Models\UserOnlineStatus;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class TrackOnlineStatus
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()) {
            if (! Schema::hasTable('user_online_status')) {
                return $next($request);
            }

            UserOnlineStatus::query()->updateOrCreate(
                ['user_id' => $request->user()->id],
                [
                    'tenant_id' => $request->user()->tenant_id,
                    'ip_address' => $request->ip(),
                    'last_seen_at' => now(),
                    'is_online' => true,
                ],
            );
        }

        return $next($request);
    }
}
