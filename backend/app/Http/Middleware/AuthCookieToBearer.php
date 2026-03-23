<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * If the request carries the httpOnly auth cookie but no Authorization header,
 * copy the cookie value into the Authorization header so that Sanctum's
 * token guard can authenticate without exposing the token to JavaScript.
 */
class AuthCookieToBearer
{
    public function handle(Request $request, Closure $next): Response
    {
        $cookieName = config('sanctum.cookie_name', 'auth_token');

        if (! $request->bearerToken() && $request->cookie($cookieName)) {
            $request->headers->set(
                'Authorization',
                'Bearer ' . $request->cookie($cookieName)
            );
        }

        return $next($request);
    }
}
