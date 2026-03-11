<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Services\LicenseExpiryService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class TenantScope
{
    public function __construct(private readonly LicenseExpiryService $licenseExpiryService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        app()->forgetInstance('tenant.scope.id');

        $user = $request->user();

        if ($user && $user->role !== UserRole::SUPER_ADMIN && $user->tenant_id !== null) {
            $tenantId = (int) $user->tenant_id;
            app()->instance('tenant.scope.id', $tenantId);

            $throttleKey = 'licenses:expire:tenant:'.$tenantId;
            if (Cache::add($throttleKey, 1, now()->addSecond())) {
                try {
                    $this->licenseExpiryService->expireDue($tenantId, true, 50);
                } catch (\Throwable $exception) {
                    report($exception);
                }
            }
        }

        if ($user && $user->role === UserRole::SUPER_ADMIN && Cache::add('licenses:expire:global', 1, now()->addSecond())) {
            try {
                $this->licenseExpiryService->expireDue(null, true, 100);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $next($request);
    }
}
