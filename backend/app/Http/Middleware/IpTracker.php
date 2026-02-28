<?php

namespace App\Http\Middleware;

use App\Services\IpGeolocationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IpTracker
{
    public function __construct(private readonly IpGeolocationService $ipGeolocationService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();

        if ($user && $request->route()?->getName() !== 'health') {
            $geo = $this->ipGeolocationService->lookup($request->ip());

            $user->ipLogs()->create([
                'tenant_id' => $user->tenant_id,
                'ip_address' => $request->ip(),
                'country' => $geo['country_name'] ?? null,
                'city' => $geo['city'] ?? null,
                'isp' => $geo['org'] ?? null,
                'reputation_score' => 'low',
                'action' => $request->method().' '.$request->path(),
            ]);
        }

        return $response;
    }
}
