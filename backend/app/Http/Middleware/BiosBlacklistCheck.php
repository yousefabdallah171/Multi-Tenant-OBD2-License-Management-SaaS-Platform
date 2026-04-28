<?php

namespace App\Http\Middleware;

use App\Models\BiosBlacklist;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BiosBlacklistCheck
{
    public function handle(Request $request, Closure $next): Response
    {
        $biosId = (string) ($request->route('bios') ?? $request->input('bios_id', ''));
        $tenantId = $request->user()?->tenant_id;

        if ($biosId !== '' && BiosBlacklist::blocksBios($biosId, $tenantId)) {
            return response()->json([
                'message' => 'This BIOS is blacklisted.',
                'bios_id' => $biosId,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $next($request);
    }
}
