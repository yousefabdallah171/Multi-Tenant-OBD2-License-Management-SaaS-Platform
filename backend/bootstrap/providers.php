<?php

return array_values(array_filter([
    App\Providers\AppServiceProvider::class,
    class_exists(\Laravel\Telescope\TelescopeServiceProvider::class)
        && (env('TELESCOPE_ENABLED', false) || env('APP_ENV') === 'local')
        ? App\Providers\TelescopeServiceProvider::class
        : null,
]));
