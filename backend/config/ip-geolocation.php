<?php

return [
    'enabled' => filter_var(env('IP_GEOLOCATION_ENABLED', false), FILTER_VALIDATE_BOOL),
    'url' => env('IP_GEOLOCATION_URL', 'https://ipapi.co'),
    'key' => env('IP_GEOLOCATION_KEY'),
    'timeout' => (int) env('IP_GEOLOCATION_TIMEOUT', 5),
];
