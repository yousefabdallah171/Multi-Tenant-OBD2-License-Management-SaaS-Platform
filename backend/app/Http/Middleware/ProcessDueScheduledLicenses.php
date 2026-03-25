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
        if ($request->user() && $this->shouldRunThrottle('licenses:scheduled-fallback:run', now()->addSeconds(15))) {
            try {
                $this->licenseService->processDueScheduledActivations(25);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $next($request);
    }

    private function shouldRunThrottle(string $key, \DateTimeInterface $ttl): bool
    {
        try {
            return Cache::add($key, true, $ttl);
        } catch (\Throwable $exception) {
            report($exception);

            return false;
        }
    }
}
