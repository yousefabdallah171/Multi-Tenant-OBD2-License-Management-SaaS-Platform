<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user) {
            $user->forceFill([
                'last_seen_at' => now(),
            ])->saveQuietly();
        }

        return $response;
    }
}

