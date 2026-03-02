<?php

namespace App\Http\Middleware;

use App\Jobs\ResolveIpGeolocation;
use Closure;
use Illuminate\Http\Request;
use Throwable;
use Symfony\Component\HttpFoundation\Response;

class IpTracker
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();

        if ($user && $request->route()?->getName() !== 'health') {
            try {
                $ipLog = $user->ipLogs()->create([
                    'tenant_id' => $user->tenant_id,
                    'ip_address' => $request->ip(),
                    'country' => null,
                    'city' => null,
                    'isp' => null,
                    'reputation_score' => 'low',
                    'action' => $request->method().' '.$request->path(),
                ]);

                ResolveIpGeolocation::dispatch((int) $ipLog->id);
            } catch (Throwable) {
                // IP telemetry should not break user-facing API responses.
            }
        }

        return $response;
    }
}
