<?php

return [
    'api_key' => env('MANDIAG_API_KEY'),
    'signing_secret' => env('MANDIAG_SIGNING_SECRET'),
    'base_url' => env('MANDIAG_BASE_URL', 'https://mandiag.com/api/partner/v1'),
    'webhook_secret' => env('MANDIAG_WEBHOOK_SECRET'),
];
