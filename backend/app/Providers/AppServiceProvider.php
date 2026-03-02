<?php

namespace App\Providers;

use App\Services\GeoIpService;
use App\Services\LoginSecurityService;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(LoginSecurityService::class);
        $this->app->singleton(GeoIpService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (app()->environment('local', 'testing')) {
            return;
        }

        DB::listen(function (QueryExecuted $query): void {
            if ($query->time < 500) {
                return;
            }

            Log::warning('slow-query', [
                'sql' => $query->sql,
                'bindings' => $query->bindings,
                'time_ms' => $query->time,
                'connection' => $query->connectionName,
            ]);
        });
    }
}
