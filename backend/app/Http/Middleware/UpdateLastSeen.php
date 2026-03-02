<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Throwable;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user) {
            try {
                $user->forceFill([
                    'last_seen_at' => now(),
                ])->saveQuietly();
            } catch (Throwable) {
                // Non-critical background update: never fail request lifecycle.
            }
        }

        return $response;
    }
}
