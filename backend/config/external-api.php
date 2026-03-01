<?php

return [
    'url' => env('EXTERNAL_API_URL'),
    'key' => env('EXTERNAL_API_KEY'),
    'timeout' => (int) env('EXTERNAL_API_TIMEOUT', 10),
    'retries' => (int) env('EXTERNAL_API_RETRIES', 3),
];
