<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;

require __DIR__.'/../vendor/autoload.php';

$process = new Process([PHP_BINARY, 'artisan', 'route:list', '--json'], dirname(__DIR__));
$process->run();

if (! $process->isSuccessful()) {
    fwrite(STDERR, "Unable to inspect routes.\n".$process->getErrorOutput());
    exit(1);
}

$routes = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);

$checks = [
    [
        'label' => 'username-management account actions',
        'pattern' => '#username-management/.+/(unlock|reset-password|username)$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
    ],
    [
        'label' => 'admin password resets',
        'pattern' => '#admin-management/.+/reset-password$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
    ],
    [
        'label' => 'balance adjustments',
        'pattern' => '#balances/.+/adjust$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
    ],
    [
        'label' => 'license activation',
        'pattern' => '#licenses/activate$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
    ],
    [
        'label' => 'direct BIOS changes',
        'pattern' => '#bios-change-requests/direct$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
    ],
    [
        'label' => 'reseller payment mutations',
        'pattern' => '#reseller-payments(?:/.+)?$#',
        'requiredMiddleware' => ['auth:sanctum', 'role:'],
        'methods' => ['POST', 'PUT', 'PATCH', 'DELETE'],
    ],
];

$failures = [];

foreach ($checks as $check) {
    $matchingRoutes = array_filter($routes, static function (array $route) use ($check): bool {
        $uri = (string) ($route['uri'] ?? '');
        if (preg_match($check['pattern'], $uri) !== 1) {
            return false;
        }

        $methods = $check['methods'] ?? null;

        if ($methods === null) {
            return true;
        }

        $routeMethods = array_map('strtoupper', (array) ($route['method'] ?? []));

        foreach ($methods as $method) {
            if (in_array(strtoupper((string) $method), $routeMethods, true)) {
                return true;
            }
        }

        return false;
    });

    if ($matchingRoutes === []) {
        $failures[] = sprintf('No routes matched check "%s".', $check['label']);
        continue;
    }

    foreach ($matchingRoutes as $route) {
        $middleware = array_map('strval', (array) ($route['middleware'] ?? []));
        $middlewareString = implode(',', $middleware);

        foreach ($check['requiredMiddleware'] as $required) {
            if ($required === 'role:') {
                $hasRoleGuard = collect($middleware)->contains(
                    static fn (string $item): bool => str_starts_with($item, 'role:')
                        || str_starts_with($item, 'App\\Http\\Middleware\\RoleMiddleware:')
                );

                if (! $hasRoleGuard) {
                    $failures[] = sprintf(
                        'Route [%s] is missing role middleware.',
                        (string) ($route['uri'] ?? 'unknown')
                    );
                }

                continue;
            }

            $hasRequiredMiddleware = collect($middleware)->contains(
                static fn (string $item): bool => $item === $required
                    || str_ends_with($item, ':sanctum') && $required === 'auth:sanctum'
            );

            if (! $hasRequiredMiddleware) {
                $failures[] = sprintf(
                    'Route [%s] is missing required middleware [%s]. Current middleware: %s',
                    (string) ($route['uri'] ?? 'unknown'),
                    $required,
                    $middlewareString
                );
            }
        }
    }
}

if ($failures !== []) {
    fwrite(STDERR, "Sensitive route guard audit failed:\n- ".implode("\n- ", $failures)."\n");
    exit(1);
}

fwrite(STDOUT, "Sensitive route guard audit passed.\n");
