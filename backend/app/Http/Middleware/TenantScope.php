<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantScope
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->forgetInstance('tenant.scope.id');

        $user = $request->user();

        if ($user && $user->role !== UserRole::SUPER_ADMIN && $user->tenant_id !== null) {
            app()->instance('tenant.scope.id', (int) $user->tenant_id);
        }

        return $next($request);
    }
}
