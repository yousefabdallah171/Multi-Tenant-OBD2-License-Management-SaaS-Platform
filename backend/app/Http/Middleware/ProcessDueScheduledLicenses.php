<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class ProcessDueScheduledLicenses
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && Cache::add('licenses:scheduled-fallback:run', true, now()->addSeconds(15))) {
            $this->licenseService->processDueScheduledActivations(25);
        }

        return $next($request);
    }
}
