<?php

use App\Http\Middleware\ApiLogger;
use App\Http\Middleware\BiosBlacklistCheck;
use App\Http\Middleware\IpTracker;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\TenantScope;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'tenant.scope' => TenantScope::class,
            'api.logger' => ApiLogger::class,
            'bios.blacklist' => BiosBlacklistCheck::class,
            'ip.tracker' => IpTracker::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
