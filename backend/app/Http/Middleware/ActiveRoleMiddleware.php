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
            $this->invalidateCurrentToken($request);

            return response()->json(
                ['message' => 'Invalid credentials.'],
                Response::HTTP_UNAUTHORIZED,
            );
        }

        if ($user->status !== 'active') {
            $reason = $user->status === 'suspended' ? 'account_suspended' : 'account_inactive';
            $message = $user->status === 'suspended'
                ? 'This account is currently suspended.'
                : 'This account is currently inactive.';

            return $this->blockedResponse($request, $reason, $message);
        }

        $user->loadMissing('tenant');
        $tenantStatus = $user->tenant?->status;

        if ($tenantStatus && $tenantStatus !== 'active') {
            $reason = $tenantStatus === 'suspended' ? 'tenant_suspended' : 'tenant_inactive';
            $message = $tenantStatus === 'suspended'
                ? 'This workspace is currently suspended.'
                : 'This workspace is currently inactive.';

            return $this->blockedResponse($request, $reason, $message);
        }

        return $next($request);
    }

    private function blockedResponse(Request $request, string $reason, string $message): Response
    {
        $this->invalidateCurrentToken($request);

        return response()->json([
            'message' => $message,
            'reason' => $reason,
        ], Response::HTTP_FORBIDDEN);
    }

    private function invalidateCurrentToken(Request $request): void
    {
        $request->user()?->currentAccessToken()?->delete();
    }
}
