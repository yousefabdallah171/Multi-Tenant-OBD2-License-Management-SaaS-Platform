<?php

return [
    'url' => env('EXTERNAL_API_URL'),
    'key' => env('EXTERNAL_API_KEY'),
    'timeout' => (int) env('EXTERNAL_API_TIMEOUT', 10),
    'retries' => (int) env('EXTERNAL_API_RETRIES', 3),
    'allow_bios_change_fallback' => filter_var(env('EXTERNAL_API_ALLOW_BIOS_CHANGE_FALLBACK', true), FILTER_VALIDATE_BOOLEAN),
    'allowed_hosts' => array_values(array_filter(array_map(
        static fn (string $host): string => strtolower(trim($host)),
        explode(',', (string) env('EXTERNAL_API_ALLOWED_HOSTS', ''))
    ))),
];
