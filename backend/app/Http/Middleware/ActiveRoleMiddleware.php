<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ActiveRoleMiddleware
{
    protected array $allowedRoles = [
        'super_admin',
        'manager_parent',
        'manager',
        'reseller',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $role = $user->role?->value ?? (string) $user->role;

        if (! in_array($role, $this->allowedRoles, true)) {
            $request->user()?->currentAccessToken()?->delete();

            return response()->json(
                ['message' => 'Invalid credentials.'],
                Response::HTTP_UNAUTHORIZED,
            );
        }

        return $next($request);
    }
}
