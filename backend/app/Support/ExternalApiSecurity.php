<?php

namespace App\Support;

use InvalidArgumentException;

class ExternalApiSecurity
{
    public static function normalizeBaseUrl(?string $value): ?string
    {
        $normalized = trim((string) $value);

        if ($normalized === '') {
            return null;
        }

        $parts = parse_url($normalized);

        if ($parts !== false && ! empty($parts['scheme']) && ! empty($parts['host'])) {
            $baseUrl = strtolower((string) $parts['scheme']).'://'.$parts['host'];

            if (! empty($parts['port'])) {
                $baseUrl .= ':'.(int) $parts['port'];
            }

            return rtrim($baseUrl, '/');
        }

        return rtrim($normalized, '/');
    }

    public static function assertSafeBaseUrl(?string $value): void
    {
        $baseUrl = self::normalizeBaseUrl($value);
        if ($baseUrl === null) {
            return;
        }

        $parts = parse_url($baseUrl);
        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            throw new InvalidArgumentException('Invalid external API base URL.');
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('External API base URL must use http or https.');
        }

        $host = strtolower((string) $parts['host']);
        if ($host === 'localhost' || str_ends_with($host, '.local')) {
            throw new InvalidArgumentException('Local/private hosts are not allowed for external API base URL.');
        }

        $allowedHosts = config('external-api.allowed_hosts', []);
        if (is_array($allowedHosts) && $allowedHosts !== [] && ! in_array($host, $allowedHosts, true)) {
            throw new InvalidArgumentException('External API base URL host is not in the allowed hosts list.');
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            self::assertPublicIp($host);

            return;
        }

        $resolvedIp = gethostbyname($host);
        if ($resolvedIp === $host) {
            throw new InvalidArgumentException('External API base URL host could not be resolved.');
        }

        self::assertPublicIp($resolvedIp);
    }

    private static function assertPublicIp(string $ip): void
    {
        $isPublic = filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;

        if (! $isPublic) {
            throw new InvalidArgumentException('External API base URL must resolve to a public IP.');
        }
    }
}
