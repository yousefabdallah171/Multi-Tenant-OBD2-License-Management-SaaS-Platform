<?php

return [
    'url' => env('EXTERNAL_API_URL', 'http://72.60.69.185'),
    'key' => env('EXTERNAL_API_KEY', 'L9H2F7Q8XK6M4A'),
    'timeout' => (int) env('EXTERNAL_API_TIMEOUT', 10),
    'retries' => (int) env('EXTERNAL_API_RETRIES', 3),
];
