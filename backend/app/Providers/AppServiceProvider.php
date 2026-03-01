<?php

namespace App\Providers;

use App\Services\GeoIpService;
use App\Services\LoginSecurityService;
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
        //
    }
}
