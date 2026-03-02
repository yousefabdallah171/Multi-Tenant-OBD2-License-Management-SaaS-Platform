<?php

use App\Http\Middleware\ApiLogger;
use App\Http\Middleware\ApiSecurityHeaders;
use App\Http\Middleware\ActiveRoleMiddleware;
use App\Http\Middleware\BiosBlacklistCheck;
use App\Http\Middleware\IpTracker;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\TenantScope;
use App\Http\Middleware\UpdateLastSeen;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(ApiSecurityHeaders::class);
        $middleware->appendToGroup('api', ActiveRoleMiddleware::class);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'tenant.scope' => TenantScope::class,
            'api.logger' => ApiLogger::class,
            'bios.blacklist' => BiosBlacklistCheck::class,
            'ip.tracker' => IpTracker::class,
            'update.last_seen' => UpdateLastSeen::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('licenses:expire')->everyMinute()->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
